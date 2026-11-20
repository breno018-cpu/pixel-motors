const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function inspectColumns() {
  const tables = ['stores', 'vehicles', 'contracts', 'invoices', 'profiles', 'employees', 'stock_transfers', 'activity_logs'];

  for (const t of tables) {
    const { data, error } = await sb.from(t).select('*').limit(1);
    if (error) {
      console.log(`[${t}] Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`[${t}] Columns:`, Object.keys(data[0]));
    } else {
      console.log(`[${t}] Table empty, checking column headers via empty select`);
    }
  }

  // Check contracts statuses
  const { data: contracts } = await sb.from('contracts').select('id, contract_number, status, buyer_name, store_id, created_at, updated_at');
  if (contracts) {
    const statuses = {};
    contracts.forEach(c => {
      statuses[c.status] = (statuses[c.status] || 0) + 1;
    });
    console.log('\nStatus de contracts:', statuses);
  }

  // Check vehicles statuses
  const { data: vehicles } = await sb.from('vehicles').select('id, chassis, status, store_id, brand, model');
  if (vehicles) {
    const statuses = {};
    const chassisMap = new Map();
    let duplicates = 0;
    vehicles.forEach(v => {
      statuses[v.status] = (statuses[v.status] || 0) + 1;
      if (v.chassis) {
        const ch = v.chassis.toUpperCase().trim();
        if (chassisMap.has(ch)) {
          duplicates++;
        } else {
          chassisMap.set(ch, v.id);
        }
      }
    });
    console.log('Status de vehicles:', statuses);
    console.log('Chassis duplicados em vehicles:', duplicates);
  }
}

inspectColumns();
