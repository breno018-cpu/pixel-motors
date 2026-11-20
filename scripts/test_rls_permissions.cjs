const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function testRLS() {
  console.log('=== TESTE DE RLS E ESCRITA NAS TABELAS ===');
  
  // 1. Activity Logs
  const testLog = {
    id: '00000000-0000-4000-a000-000000000001',
    user_id: null,
    action: 'TESTE_AUDITORIA',
    entity_type: 'sistema',
    entity_id: 'test-1',
    created_at: new Date().toISOString()
  };
  const { data: logData, error: logErr } = await sb.from('activity_logs').insert(testLog).select();
  console.log('activity_logs insert result:', logErr ? `FALHOU: ${logErr.message} (${logErr.code})` : 'SUCESSO');
  if (!logErr) {
    await sb.from('activity_logs').delete().eq('id', testLog.id);
  }

  // 2. Stock Transfers
  const testTransfer = {
    id: '00000000-0000-4000-a000-000000000002',
    vehicle_id: null,
    from_store_id: 'e8254a81-d669-464b-9806-457ba25ce7f0',
    to_store_id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
    status: 'completed',
    transferred_at: new Date().toISOString()
  };
  const { data: transData, error: transErr } = await sb.from('stock_transfers').insert(testTransfer).select();
  console.log('stock_transfers insert result:', transErr ? `FALHOU: ${transErr.message} (${transErr.code})` : 'SUCESSO');
  if (!transErr) {
    await sb.from('stock_transfers').delete().eq('id', testTransfer.id);
  }

  // 3. Invoices
  const testInvoice = {
    id: '00000000-0000-4000-a000-000000000003',
    invoice_number: 'TEST-999999',
    store_id: 'e8254a81-d669-464b-9806-457ba25ce7f0',
    status: 'emitida',
    amount: 100,
    created_at: new Date().toISOString()
  };
  const { data: invData, error: invErr } = await sb.from('invoices').insert(testInvoice).select();
  console.log('invoices insert result:', invErr ? `FALHOU: ${invErr.message} (${invErr.code})` : 'SUCESSO');
  if (!invErr) {
    await sb.from('invoices').delete().eq('id', testInvoice.id);
  }

  // 4. Vehicles update
  const { data: vehData, error: vehErr } = await sb.from('vehicles').select('id, notes').limit(1).single();
  if (vehData) {
    const { error: vehUpErr } = await sb.from('vehicles').update({ notes: vehData.notes }).eq('id', vehData.id);
    console.log('vehicles update result:', vehUpErr ? `FALHOU: ${vehUpErr.message} (${vehUpErr.code})` : 'SUCESSO');
  }

  // 5. Contracts update
  const { data: conData, error: conErr } = await sb.from('contracts').select('id, notes').limit(1).single();
  if (conData) {
    const { error: conUpErr } = await sb.from('contracts').update({ notes: conData.notes }).eq('id', conData.id);
    console.log('contracts update result:', conUpErr ? `FALHOU: ${conUpErr.message} (${conUpErr.code})` : 'SUCESSO');
  }
}

testRLS();
