import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface SimInput {
  store_id: string;
  bank_code: string;
  customer_name: string;
  customer_document: string;
  customer_phone?: string;
  customer_email?: string;
  customer_income?: number;
  customer_birthdate?: string;
  vehicle_id?: string | null;
  vehicle_value: number;
  down_payment: number;
  installments: number;
}

function priceCalc(pv: number, monthlyRate: number, n: number) {
  if (monthlyRate <= 0) return pv / n;
  const i = monthlyRate;
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}

// Default fallback rates (used when the bank API isn't reachable / no creds).
// These are realistic Brazilian vehicle-financing ranges (a.m.) — overridable
// per credential via extra_config.monthly_rate.
const FALLBACK_RATES: Record<string, number> = {
  santander: 0.0189,
  bv: 0.0215,
  itau: 0.0179,
  bradesco: 0.0195,
  omni: 0.0249,
  pan: 0.0229,
  safra: 0.0185,
  caixa: 0.0175,
};

// ===== Banco Pan — Originador / F1 ============================
// Public docs: https://developers.bancopan.com.br/
// Sandbox base: https://apihml.bancopan.com.br
// Production:   https://api.bancopan.com.br
// OAuth2 client_credentials -> /auth/oauth/v2/token  (scope: financiamento.simulacao)
// Simulation:                  /financiamento/v1/simulacoes  (POST)
async function callPan(creds: any, input: SimInput) {
  const base = creds.api_environment === 'producao'
    ? 'https://api.bancopan.com.br'
    : 'https://apihml.bancopan.com.br';

  if (!creds.client_id || !creds.client_secret) {
    throw new Error('pan_missing_credentials');
  }

  // 1) Obtain OAuth2 token
  const basic = btoa(`${creds.client_id}:${creds.client_secret}`);
  const tokenRes = await fetch(`${base}/auth/oauth/v2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=financiamento.simulacao',
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`pan_auth_failed_${tokenRes.status}: ${t.slice(0, 200)}`);
  }
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) throw new Error('pan_no_access_token');

  // 2) Call simulation endpoint
  const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
  const payload = {
    codigoCorrespondente: creds.partner_code || undefined,
    cliente: {
      cpf: onlyDigits(input.customer_document),
      nome: input.customer_name,
      dataNascimento: input.customer_birthdate || undefined,
      rendaMensal: input.customer_income ?? undefined,
    },
    operacao: {
      valorBem: input.vehicle_value,
      valorEntrada: input.down_payment,
      valorFinanciado: input.vehicle_value - input.down_payment,
      quantidadeParcelas: input.installments,
      tipoBem: 'VEICULO',
    },
  };

  const simRes = await fetch(`${base}/financiamento/v1/simulacoes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const simText = await simRes.text();
  let simJson: any = null;
  try { simJson = JSON.parse(simText); } catch { /* keep text */ }

  if (!simRes.ok) {
    throw new Error(`pan_simulation_failed_${simRes.status}: ${simText.slice(0, 300)}`);
  }

  // Pan returns a list of proposals; pick the best (lowest installment).
  const propostas = simJson?.propostas || simJson?.simulacoes || [];
  const best = Array.isArray(propostas) && propostas.length
    ? propostas.reduce((a: any, b: any) =>
        (a.valorParcela ?? Infinity) <= (b.valorParcela ?? Infinity) ? a : b)
    : null;

  return {
    monthly_rate: Number(best?.taxaJurosMensal ?? simJson?.taxaJurosMensal) || null,
    installment_value: Number(best?.valorParcela ?? simJson?.valorParcela) || null,
    total_amount: Number(best?.valorTotal ?? simJson?.valorTotal) || null,
    cet: Number(best?.cet ?? simJson?.cet) || null,
    raw: simJson,
  };
}

async function callSantander(creds: any, input: SimInput) {
  // TODO: integration with Santander Use Car / F1 (requires OAuth2 + signed
  // request — endpoint /api/v1/financing/simulate). Until homologated, fall
  // back to local Price calculation.
  throw new Error('santander_not_homologated');
}
async function callBV(creds: any, input: SimInput) {
  throw new Error('bv_not_homologated');
}

const BANK_HANDLERS: Record<string, (c: any, i: SimInput) => Promise<any>> = {
  santander: callSantander,
  bv: callBV,
  pan: callPan,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const input = (await req.json()) as SimInput;
    if (!input?.store_id || !input?.bank_code || !input?.vehicle_value || !input?.installments) {
      return new Response(JSON.stringify({ error: 'invalid_input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const financed = Number(input.vehicle_value) - Number(input.down_payment || 0);
    if (financed <= 0) {
      return new Response(JSON.stringify({ error: 'down_payment_exceeds_value' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up credentials for this store + bank
    const { data: cred } = await supabase
      .from('bank_credentials')
      .select('*')
      .eq('store_id', input.store_id)
      .eq('bank_code', input.bank_code)
      .eq('is_active', true)
      .maybeSingle();

    let monthlyRate = FALLBACK_RATES[input.bank_code] ?? 0.02;
    let status: 'aprovada' | 'pendente' | 'erro' = 'pendente';
    let responseData: any = null;
    let errorMessage: string | null = null;

    const handler = BANK_HANDLERS[input.bank_code];
    if (cred && handler) {
      try {
        responseData = await handler(cred, input);
        if (responseData?.monthly_rate) monthlyRate = Number(responseData.monthly_rate);
        status = 'aprovada';
      } catch (err) {
        errorMessage = (err as Error).message;
        status = 'pendente';
      }
    } else if (cred?.extra_config?.monthly_rate) {
      monthlyRate = Number(cred.extra_config.monthly_rate);
      status = 'pendente';
    } else {
      errorMessage = cred
        ? 'API do banco ainda não homologada — usando cálculo Price com taxa padrão.'
        : 'Sem credenciais cadastradas para este banco/loja — usando cálculo Price com taxa padrão.';
    }

    // Prefer real numbers from the bank API when available; else use Price calc.
    const installmentValue = responseData?.installment_value
      ?? priceCalc(financed, monthlyRate, input.installments);
    const total = responseData?.total_amount
      ?? (installmentValue * input.installments + Number(input.down_payment || 0));
    const cet = responseData?.cet ?? monthlyRate * 12 * 100; // approximation

    const { data: row, error: insertErr } = await supabase
      .from('financing_simulations')
      .insert({
        store_id: input.store_id,
        vehicle_id: input.vehicle_id ?? null,
        bank_code: input.bank_code,
        customer_name: input.customer_name,
        customer_document: input.customer_document,
        customer_phone: input.customer_phone ?? null,
        customer_email: input.customer_email ?? null,
        customer_income: input.customer_income ?? null,
        customer_birthdate: input.customer_birthdate ?? null,
        vehicle_value: input.vehicle_value,
        down_payment: input.down_payment,
        installments: input.installments,
        financed_amount: financed,
        monthly_rate: monthlyRate,
        installment_value: installmentValue,
        total_amount: total,
        cet,
        status,
        response_data: responseData,
        error_message: errorMessage,
        created_by: userId,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ simulation: row, used_fallback: !responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('bank-simulation error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});