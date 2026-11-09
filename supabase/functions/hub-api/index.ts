import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
const allowHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

/** Recursos expostos para os apps do ecossistema. */
const RESOURCES: Record<string, { table: string; columns: string; scope: string }> = {
  stores: { table: 'stores', columns: 'id,name,city,state,cnpj,is_active', scope: 'read' },
  vehicles: {
    table: 'vehicles',
    columns:
      'id,store_id,reseller_id,brand,model,year,manufacture_year,color,plate,chassis,vehicle_type,engine_cc,mileage,sale_price,status,updated_at',
    scope: 'read',
  },
  sales: {
    table: 'contracts',
    columns:
      'id,contract_number,store_id,vehicle_id,buyer_name,sale_price,payment_method,financing_bank,status,signed_at,created_at',
    scope: 'read',
  },
  employees: {
    table: 'employees',
    columns: 'id,store_id,full_name,role,position,is_active,commission_rate,base_salary',
    scope: 'read',
  },
  resellers: {
    table: 'resellers',
    columns: 'id,store_id,full_name,partner_type,commission_rate,is_active',
    scope: 'read',
  },
  payslips: {
    table: 'payslips',
    columns:
      'id,payslip_number,employee_id,store_id,reference_month,reference_year,net_total,status,payment_date',
    scope: 'read:payroll',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: allowHeaders });

  try {
    const apiKey = req.headers.get('x-api-key') ?? '';
    if (!apiKey) return json({ error: 'Missing x-api-key header' }, 401);

    const { data: keyRow } = await admin
      .from('api_keys')
      .select('id,scopes,is_active,expires_at')
      .eq('key_hash', await sha256(apiKey))
      .maybeSingle();

    if (!keyRow || !keyRow.is_active) return json({ error: 'Invalid API key' }, 401);
    if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date())
      return json({ error: 'API key expired' }, 401);

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const resource = path[path.indexOf('hub-api') + 1] ?? '';

    if (!resource) {
      return json({
        service: 'PixelLoom Hub API',
        version: '1',
        resources: Object.keys(RESOURCES),
        usage: 'GET /functions/v1/hub-api/{resource}?limit=100&offset=0&updated_since=ISO_DATE',
      });
    }

    const def = RESOURCES[resource];
    if (!def) return json({ error: `Unknown resource "${resource}"` }, 404);

    const scopes: string[] = keyRow.scopes ?? [];
    if (!scopes.includes(def.scope) && !scopes.includes('read:all'))
      return json({ error: `Missing scope "${def.scope}"` }, 403);

    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100) || 100, 500);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
    const storeId = url.searchParams.get('store_id');
    const updatedSince = url.searchParams.get('updated_since');

    let query = admin.from(def.table).select(def.columns).range(offset, offset + limit - 1);
    if (storeId) query = query.eq('store_id', storeId);
    if (updatedSince && def.table !== 'payslips') query = query.gte('updated_at', updatedSince);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 400);

    await admin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id);

    return json({ resource, count: data?.length ?? 0, limit, offset, data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
