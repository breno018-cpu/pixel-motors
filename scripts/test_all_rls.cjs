const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const sb = createClient(url, key);

async function testAllRLS() {
  const tables = [
    'stores', 'vehicles', 'contracts', 'invoices', 'profiles', 
    'employees', 'stock_transfers', 'financing_banks', 'financing_simulations', 
    'resellers', 'sales_targets', 'user_roles', 'role_permissions', 
    'vehicle_models', 'vehicle_colors', 'contract_templates', 'payslips', 
    'payroll_batches', 'payroll_settings', 'activity_logs'
  ];

  console.log('=== TESTE DE POLÍTICAS RLS (ANON / PUBLISHABLE KEY) ===');
  for (const t of tables) {
    // 1. SELECT
    const { data: selData, error: selErr } = await sb.from(t).select('*').limit(1);
    const selStatus = selErr ? `FALHA (${selErr.message})` : `OK (${selData ? selData.length : 0} linhas lidas)`;

    // 2. INSERT dummy with intentional rollback or delete if success
    let insStatus = 'NÃO TESTADO';
    try {
      const { data: insData, error: insErr } = await sb.from(t).insert({}).select();
      if (insErr) {
        insStatus = insErr.message.includes('row-level security') 
          ? 'BLOQUEADO POR RLS' 
          : `ERRO DE SCHEMA/CONSTRAINT (${insErr.message})`;
      } else {
        insStatus = 'PERMITIDO';
      }
    } catch (e) {
      insStatus = `EXCEÇÃO: ${e.message}`;
    }

    console.log(`[${t.padEnd(22)}]: SELECT: ${selStatus.padEnd(25)} | INSERT: ${insStatus}`);
  }
}

testAllRLS();
