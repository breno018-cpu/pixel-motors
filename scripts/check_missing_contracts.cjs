const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function checkEdna() {
  const { data } = await sb.from('contracts').select('id, contract_number, buyer_name, status, created_at').ilike('buyer_name', '%EDNA%');
  console.log('Edna in contracts:', data);
}

checkEdna();
