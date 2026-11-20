const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function testUniqueChassisConstraint() {
  const { data: v } = await sb.from('vehicles').select('chassis, brand, model, store_id').eq('is_deleted', false).limit(1).single();
  console.log(`Tentando inserir veículo com o mesmo chassi de um existente: "${v.chassis}"`);

  const { data, error } = await sb.from('vehicles').insert({
    brand: v.brand,
    model: v.model,
    year: 2026,
    store_id: v.store_id,
    chassis: v.chassis,
    status: 'disponivel'
  }).select();

  console.log('Resultado da tentativa:', error ? `BLOQUEADO COM SUCESSO: ${error.message} (${error.code})` : 'FALHA - PERMITIU DUPLICATA');
}

testUniqueChassisConstraint();
