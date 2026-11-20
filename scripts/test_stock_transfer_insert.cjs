const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function testTransfer() {
  const { data: veh } = await sb.from('vehicles').select('id, store_id').limit(1).single();
  const { data: store } = await sb.from('stores').select('id').neq('id', veh.store_id).limit(1).single();

  const payload = {
    vehicle_id: veh.id,
    transfer_type: 'loja_para_loja',
    from_store_id: veh.store_id,
    to_store_id: store.id,
    agreed_amount: 0,
    received_amount: 0,
    status: 'concluida',
    transfer_date: new Date().toISOString().slice(0, 10),
    notes: 'TESTE FORENSE TRANSFERENCIA',
    created_by: null
  };

  const { data, error } = await sb.from('stock_transfers').insert(payload).select();
  console.log('Insert test result:', error ? error.message : 'SUCCESS!');
  if (data && data.length > 0) {
    console.log('Inserted transfer id:', data[0].id);
    await sb.from('stock_transfers').delete().eq('id', data[0].id);
  }
}

testTransfer();
