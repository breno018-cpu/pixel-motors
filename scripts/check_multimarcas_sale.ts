import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sjftdxbahhgfoxpzjdik.supabase.co',
  'sb_publishable_m2gCMXzMVAm3OKcsPAwt9A_kUijNSg7'
);

async function main() {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_number, buyer_name, store_id, sale_price, external_data')
    .or('contract_number.ilike.%241%,buyer_name.ilike.%FORTE MUDAS%');
  
  if (error) console.error('Error fetching contracts:', error);
  console.log('Contracts found:', JSON.stringify(contracts, null, 2));

  // Also check DEALFLOW_GLOBAL_SYNC
  const { data: syncRow } = await supabase
    .from('contracts')
    .select('id, external_data')
    .eq('contract_number', 'DEALFLOW_GLOBAL_SYNC')
    .maybeSingle();

  if (syncRow?.external_data?.sheet_rows) {
    const rows = syncRow.external_data.sheet_rows;
    const match = rows.filter((r: any) => 
      String(r.qt).includes('241') || 
      (r.cliente && r.cliente.toUpperCase().includes('FORTE MUDAS'))
    );
    console.log('Sheet rows match in DEALFLOW_GLOBAL_SYNC:', JSON.stringify(match, null, 2));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
