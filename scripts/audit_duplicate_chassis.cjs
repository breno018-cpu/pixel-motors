const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function checkDuplicates() {
  const { data: vehicles } = await sb.from('vehicles').select('*');
  const chassisMap = new Map();

  console.log('=== VEÍCULOS COM CHASSI DUPLICADO ===');
  vehicles.forEach(v => {
    if (!v.chassis) return;
    const ch = v.chassis.toUpperCase().trim();
    if (!chassisMap.has(ch)) {
      chassisMap.set(ch, []);
    }
    chassisMap.get(ch).push(v);
  });

  for (const [ch, list] of chassisMap.entries()) {
    if (list.length > 1) {
      console.log(`\nChassi duplicado: "${ch}" (${list.length} ocorrências):`);
      list.forEach(item => {
        console.log(`  - ID: ${item.id} | Modelo: ${item.brand} ${item.model} (${item.year}) | Status: ${item.status} | Loja: ${item.store_id} | Created: ${item.created_at}`);
      });
    }
  }
}

checkDuplicates();
