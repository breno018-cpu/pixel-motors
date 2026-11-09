import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return json(400, { error: 'token inválido' });

    if (req.method === 'GET') {
      // Return public contract metadata for the acceptance page
      const { data: acc, error: aErr } = await admin
        .from('contract_acceptances')
        .select('id, contract_id, revision_number, accepted_at, buyer_name_typed')
        .eq('acceptance_token', token)
        .maybeSingle();
      if (aErr || !acc) return json(404, { error: 'link inválido' });

      const { data: contract, error: cErr } = await admin
        .from('contracts')
        .select('id, contract_number, buyer_name, buyer_cpf, sale_price, status, template_id, active_clause_ids, clause_variables, vehicle_id, store_id, reseller_id, buyer_phone, buyer_email, buyer_address, down_payment, installments, installment_value, created_at, revision_number')
        .eq('id', acc.contract_id)
        .maybeSingle();
      if (cErr || !contract) return json(404, { error: 'contrato não encontrado' });

      const [tpl, vehicle, store] = await Promise.all([
        contract.template_id
          ? admin.from('contract_templates').select('*').eq('id', contract.template_id).maybeSingle()
          : Promise.resolve({ data: null }),
        admin.from('vehicles').select('*').eq('id', contract.vehicle_id).maybeSingle(),
        admin.from('stores').select('*').eq('id', contract.store_id).maybeSingle(),
      ]);

      return json(200, {
        contract,
        template: tpl.data,
        vehicle: vehicle.data,
        store: store.data,
        acceptance: acc,
      });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const buyerName = String(body.buyer_name_typed || '').trim();
      if (!buyerName || buyerName.length < 3) return json(400, { error: 'Digite seu nome completo' });

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
      const ua = req.headers.get('user-agent') || null;

      const { data: acc, error: aErr } = await admin
        .from('contract_acceptances')
        .select('id, contract_id, accepted_at')
        .eq('acceptance_token', token)
        .maybeSingle();
      if (aErr || !acc) return json(404, { error: 'link inválido' });
      if (acc.accepted_at) return json(409, { error: 'contrato já aceito' });

      const nowIso = new Date().toISOString();
      const { error: uErr } = await admin
        .from('contract_acceptances')
        .update({
          accepted_at: nowIso,
          accepted_ip: ip,
          accepted_user_agent: ua,
          buyer_name_typed: buyerName,
        })
        .eq('id', acc.id);
      if (uErr) return json(500, { error: uErr.message });

      // Promote contract to signed if still pendente
      await admin
        .from('contracts')
        .update({ status: 'assinado', signed_at: nowIso })
        .eq('id', acc.contract_id)
        .eq('status', 'pendente');

      return json(200, { ok: true, accepted_at: nowIso });
    }

    return json(405, { error: 'method not allowed' });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});