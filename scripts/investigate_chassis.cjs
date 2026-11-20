const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function investigateChassisContracts() {
  const duplicateVehicleIds = [
    '8cc29de9-110a-4d22-b012-99b29b4eecde', '97aa9ae0-2212-4e31-8e30-c31034d6184f',
    'e921abb8-c3d6-44b6-b098-bbb2a08c0ad1', '8d599bd9-ab84-4ba7-9e53-cbc4b6494b11',
    'ac10ae03-3d51-4dac-b4ab-78144ab51197', '82073910-afad-4c67-8dc5-57dbc307716b', 'a82e11c2-f586-4493-ae1e-dd84e3b92b54',
    '228487a6-7744-48d0-9958-88af2ef14621', '706ddb73-c7e1-4ec8-b6d5-4ffb2655bce6',
    '0a284879-97a1-46af-b33f-0f2f0548898d', 'fa61dd2a-406e-4390-ba25-8c4298c2cf6c'
  ];

  console.log('=== CONTRATOS VINCULADOS AOS VEÍCULOS DUPLICADOS ===');
  const { data: contracts } = await sb.from('contracts').select('id, contract_number, vehicle_id, buyer_name, status, store_id, created_at, external_data');
  
  for (const vId of duplicateVehicleIds) {
    const matchedContracts = contracts?.filter(c => c.vehicle_id === vId || (c.external_data && JSON.stringify(c.external_data).includes(vId)));
    console.log(`\nVeículo ID: ${vId}`);
    if (matchedContracts && matchedContracts.length > 0) {
      matchedContracts.forEach(c => {
        console.log(`  -> Contrato: ${c.contract_number} | Cliente: ${c.buyer_name} | Status: ${c.status} | Loja: ${c.store_id} | Chassi no contrato: ${c.external_data?.chassis}`);
      });
    } else {
      console.log('  -> Nenhum contrato vinculado');
    }
  }

  // Check also by chassis string in contracts
  const chassisList = [
    '99HSB3250VS000323', '99HSHF250TS001098', '99HKCS200TS000054',
    '99HJTS125VS001005', '99HST1250TS000494'
  ];

  console.log('\n=== BUSCA POR CHASSI NO CAMPO EXTERNAL_DATA DOS CONTRATOS ===');
  for (const ch of chassisList) {
    const matched = contracts?.filter(c => JSON.stringify(c).toUpperCase().includes(ch));
    console.log(`\nChassi: ${ch} (${matched?.length || 0} contratos encontrados):`);
    matched?.forEach(c => {
      console.log(`  -> Contrato: ${c.contract_number} (ID: ${c.id}) | Cliente: ${c.buyer_name} | Status: ${c.status} | Veículo ID: ${c.vehicle_id}`);
    });
  }
}

investigateChassisContracts();
