const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function testDeletePrevention() {
  const { data: c } = await sb.from('contracts').select('id').neq('contract_number', 'DEALFLOW_GLOBAL_SYNC').limit(1).single();
  const { error: delErr } = await sb.from('contracts').delete().eq('id', c.id);
  console.log('Tentativa de DELETE físico em contracts:', delErr ? `BLOQUEADO COM SUCESSO: ${delErr.message}` : 'FALHA - PERMITIU DELETE');

  const { data: v } = await sb.from('vehicles').select('id').limit(1).single();
  const { error: vDelErr } = await sb.from('vehicles').delete().eq('id', v.id);
  console.log('Tentativa de DELETE físico em vehicles:', vDelErr ? `BLOQUEADO COM SUCESSO: ${vDelErr.message}` : 'FALHA - PERMITIU DELETE');
}

testDeletePrevention();
