import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sjftdxbahhgfoxpzjdik.supabase.co',
  'sb_publishable_m2gCMXzMVAm3OKcsPAwt9A_kUijNSg7'
);

const STORE_MONTESCLAROS_MULTIMARCAS_UUID = '6b3afc94-86b2-41b0-9427-6f58ae8dbf21';

async function main() {
  console.log('1. Updating contracts table for DIV-241 -> MLT-241...');
  const { data: updatedContract, error: errContract } = await supabase
    .from('contracts')
    .update({
      contract_number: 'MLT-241',
      store_id: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
    })
    .eq('contract_number', 'DIV-241')
    .select();

  console.log('Contract update result:', updatedContract, errContract);

  console.log('2. Updating DEALFLOW_GLOBAL_SYNC sheet_rows...');
  const { data: syncRow, error: syncErr } = await supabase
    .from('contracts')
    .select('id, external_data')
    .eq('contract_number', 'DEALFLOW_GLOBAL_SYNC')
    .maybeSingle();

  if (syncRow?.external_data?.sheet_rows) {
    let modified = false;
    const updatedRows = syncRow.external_data.sheet_rows.map((r: any) => {
      if (String(r.qt) === '241' || (r.cliente && r.cliente.toUpperCase().includes('FORTE MUDAS'))) {
        modified = true;
        return {
          ...r,
          store_id: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
          store_name: 'L1MA MOTORS MULTIMARCAS',
          external_data: {
            ...(r.external_data || {}),
            store_id: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
            store_name: 'L1MA MOTORS MULTIMARCAS',
          },
        };
      }
      return r;
    });

    if (modified) {
      const { error: saveErr } = await supabase
        .from('contracts')
        .update({
          external_data: {
            ...syncRow.external_data,
            sheet_rows: updatedRows,
            last_synced_at: new Date().toISOString(),
          },
        })
        .eq('id', syncRow.id);

      console.log('Global sync update result error:', saveErr);
    } else {
      console.log('No matching row found in sheet_rows.');
    }
  }

  console.log('Done!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
