import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sjftdxbahhgfoxpzjdik.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_m2gCMXzMVAm3OKcsPAwt9A_kUijNSg7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  'stores',
  'vehicles',
  'contracts',
  'invoices',
  'profiles',
  'employees',
  'stock_transfers',
  'financing_banks',
  'financing_simulations',
  'resellers',
  'sales_targets',
  'user_roles',
  'role_permissions',
  'vehicle_models',
  'vehicle_colors',
  'contract_templates',
  'payslips',
  'payroll_batches',
  'payroll_settings',
  'activity_logs',
];

export async function runFullDatabaseValidationAndBackup() {
  console.log(`[Backup & DB Validation] Iniciando validação completa em ${new Date().toISOString()}...`);
  const backupData: Record<string, any> = {
    metadata: {
      timestamp: new Date().toISOString(),
      supabase_url: SUPABASE_URL,
      version: '1.0.0',
    },
    tables: {},
    summary: {
      total_tables_checked: TABLES.length,
      successful_tables: 0,
      failed_tables: 0,
      total_rows: 0,
      table_counts: {} as Record<string, number>,
      errors: {} as Record<string, string>,
    },
  };

  for (const table of TABLES) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        console.warn(`[TABLE: ${table}] Erro ao consultar:`, error.message);
        backupData.summary.failed_tables++;
        backupData.summary.errors[table] = error.message;
      } else {
        const rowCount = data?.length || 0;
        backupData.tables[table] = data || [];
        backupData.summary.successful_tables++;
        backupData.summary.total_rows += rowCount;
        backupData.summary.table_counts[table] = rowCount;
        console.log(`[TABLE: ${table}] OK - ${rowCount} registros.`);
      }
    } catch (err: any) {
      console.error(`[TABLE: ${table}] Exceção crítica:`, err?.message);
      backupData.summary.failed_tables++;
      backupData.summary.errors[table] = String(err?.message || err);
    }
  }

  // Criar diretório de backups
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Nome do arquivo com timestamp
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const backupFilePath = path.join(backupsDir, `db_backup_${dateStr}.json`);
  const latestBackupPath = path.join(backupsDir, `latest_backup.json`);

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  fs.writeFileSync(latestBackupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n======================================================`);
  console.log(`[Backup Concluído com Sucesso]`);
  console.log(`Arquivo: ${backupFilePath}`);
  console.log(`Total de Linhas no Banco: ${backupData.summary.total_rows}`);
  console.log(`Tabelas Verificadas: ${backupData.summary.successful_tables}/${TABLES.length}`);
  console.log(`======================================================\n`);

  return backupData;
}

if (process.argv[1] && process.argv[1].includes('backup_database')) {
  runFullDatabaseValidationAndBackup().catch((e) => {
    console.error('Falha geral no backup:', e);
    process.exit(1);
  });
}
