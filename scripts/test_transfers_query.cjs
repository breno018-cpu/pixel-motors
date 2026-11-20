const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function testSelect() {
  const { data, error } = await sb
    .from('stock_transfers')
    .select(`
      *,
      vehicle:vehicles(id, brand, model, year, color, chassis, vehicle_type, status),
      from_store:stores!stock_transfers_from_store_id_fkey(id, name),
      to_store:stores!stock_transfers_to_store_id_fkey(id, name),
      to_reseller:resellers!stock_transfers_to_reseller_id_fkey(id, full_name)
    `);

  console.log('stock_transfers select result:', error ? error.message : `Success! Count: ${data?.length}`);
}

testSelect();
