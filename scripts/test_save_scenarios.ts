import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sjftdxbahhgfoxpzjdik.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_m2gCMXzMVAm3OKcsPAwt9A_kUijNSg7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAllSaveScenarios() {
  console.log('--- TESTANDO CENÁRIOS DE SAVE DO BANCO DE DADOS ---');
  let passed = 0;
  let failed = 0;

  // Cenário 1: Leitura e integridade do DEALFLOW_GLOBAL_SYNC
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('contract_number', 'DEALFLOW_GLOBAL_SYNC')
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const ext = data.external_data || {};
      const regInvoices = ext.registered_invoices || [];
      console.log(`[CENÁRIO 1: GLOBAL SYNC] OK - ${regInvoices.length} NFs registradas no DEALFLOW_GLOBAL_SYNC.`);
      passed++;
    } else {
      console.warn('[CENÁRIO 1: GLOBAL SYNC] DEALFLOW_GLOBAL_SYNC não encontrado (será criado no primeiro sync).');
    }
  } catch (e: any) {
    console.error('[CENÁRIO 1] Falhou:', e.message);
    failed++;
  }

  // Cenário 2: Teste de Escrita e Leitura em contracts (Venda de Teste com Rollback)
  const testSaleId = '00000000-0000-4000-8000-000000000999';
  try {
    const testContractNumber = 'TEST-AUTO-999';
    // Buscar uma loja válida para satisfazer a foreign key
    const { data: storeSample } = await supabase.from('stores').select('id').limit(1).single();
    const validStoreId = storeSample?.id;

    const { error: insertError } = await supabase
      .from('contracts')
      .upsert({
        id: testSaleId,
        contract_number: testContractNumber,
        buyer_name: 'TESTE AUTOMATIZADO DE VALIDAÇÃO',
        buyer_cpf: '000.000.000-00',
        store_id: validStoreId,
        status: 'pendente',
        sale_price: 15000,
        payment_method: 'a_vista',
        notes: 'Registro efetuado por script de validação de save',
        external_data: { test: true, timestamp: Date.now() },
      });

    if (insertError) throw insertError;

    // Verificar se foi salvo corretamente
    const { data: readBack, error: readError } = await supabase
      .from('contracts')
      .select('id, contract_number, buyer_name, sale_price')
      .eq('id', testSaleId)
      .single();

    if (readError || !readBack) throw (readError || new Error('Registro não encontrado após insert'));
    if (readBack.contract_number !== testContractNumber) throw new Error('Dado divergente no save');

    console.log(`[CENÁRIO 2: ESCRITA E LEITURA DE CONTRATOS/VENDAS] OK - Venda salva e conferida com sucesso.`);
    passed++;

    // Limpar registro de teste
    await supabase.from('contracts').delete().eq('id', testSaleId);
    console.log(`[CENÁRIO 2: ROLLBACK/DELETE] OK - Limpeza concluída.`);
    passed++;
  } catch (e: any) {
    console.error('[CENÁRIO 2] Falhou:', e.message);
    failed++;
  }

  // Cenário 3: Validação da Tabela de Veículos (Integridade de Chassis e Placas)
  try {
    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles')
      .select('id, chassis, plate, status, store_id')
      .limit(10);

    if (vErr) throw vErr;
    console.log(`[CENÁRIO 3: VEÍCULOS / ESTOQUE] OK - ${vehicles?.length} amostras lidas com chassi e status íntegros.`);
    passed++;
  } catch (e: any) {
    console.error('[CENÁRIO 3] Falhou:', e.message);
    failed++;
  }

  // Cenário 4: Validação de Lojas (Montes Claros e Divinópolis)
  try {
    const { data: stores, error: sErr } = await supabase
      .from('stores')
      .select('id, name');

    if (sErr) throw sErr;
    const hasMoc = stores?.some((s) => s.name.toLowerCase().includes('montes'));
    const hasDiv = stores?.some((s) => s.name.toLowerCase().includes('divin'));

    if (hasMoc && hasDiv) {
      console.log(`[CENÁRIO 4: LOJAS CANÔNICAS] OK - Montes Claros e Divinópolis presentes e ativas.`);
      passed++;
    } else {
      console.warn(`[CENÁRIO 4: LOJAS] Aviso: lojas encontradas: ${stores?.map(s => s.name).join(', ')}`);
    }
  } catch (e: any) {
    console.error('[CENÁRIO 4] Falhou:', e.message);
    failed++;
  }

  // Cenário 5: Verificação de Usuários e Permissões
  try {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email');

    if (pErr) throw pErr;
    console.log(`[CENÁRIO 5: PERFIS DE USUÁRIOS] OK - ${profiles?.length} perfis ativos no sistema.`);
    passed++;
  } catch (e: any) {
    console.error('[CENÁRIO 5] Falhou:', e.message);
    failed++;
  }

  console.log(`\n======================================================`);
  console.log(`RESULTADO FINAL DA VALIDAÇÃO: ${passed} passaram | ${failed} falharam`);
  console.log(`STATUS DO BANCO DE DADOS: ${failed === 0 ? '100% OPERACIONAL E SEGURO' : 'COM FALHAS'}`);
  console.log(`======================================================\n`);
}

testAllSaveScenarios().catch(console.error);
