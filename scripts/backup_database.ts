import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)/);

const SUPABASE_URL = urlMatch ? urlMatch[1].trim() : 'https://sjftdxbahhgfoxpzjdik.supabase.co';
const SUPABASE_KEY = keyMatch ? keyMatch[1].trim() : 'sb_publishable_m2gCMXzMVAm3OKcsPAwt9A_kUijNSg7';

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

async function fetchAllRows(tableName: string) {
  let allRows: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return allRows;
}

export async function runFullDatabaseValidationAndBackup() {
  console.log(`[Backup & DB Validation] Iniciando validação completa em ${new Date().toISOString()}...`);
  const backupData: Record<string, any> = {
    metadata: {
      timestamp: new Date().toISOString(),
      supabase_url: SUPABASE_URL,
      version: '2.0.0-forensic',
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

  const sqlStatements: string[] = [
    `-- DEALFLOW HUB FORENSIC BACKUP`,
    `-- GENERATED AT: ${new Date().toISOString()}`,
    `-- TARGET: ${SUPABASE_URL}\n`,
  ];

  for (const table of TABLES) {
    try {
      const rows = await fetchAllRows(table);
      const rowCount = rows.length;
      backupData.tables[table] = rows;
      backupData.summary.successful_tables++;
      backupData.summary.total_rows += rowCount;
      backupData.summary.table_counts[table] = rowCount;
      console.log(`[TABLE: ${table}] OK - ${rowCount} registros.`);

      // Gera SQL INSERT statements se houver registros
      if (rows.length > 0) {
        sqlStatements.push(`-- Table: ${table} (${rows.length} rows)`);
        for (const row of rows) {
          const keys = Object.keys(row);
          const columns = keys.map((k) => `"${k}"`).join(', ');
          const values = keys
            .map((k) => {
              const val = row[k];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number' || typeof val === 'boolean') return String(val);
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
              return `'${String(val).replace(/'/g, "''")}'`;
            })
            .join(', ');
          sqlStatements.push(`INSERT INTO public."${table}" (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
        }
        sqlStatements.push('');
      }
    } catch (err: any) {
      console.error(`[TABLE: ${table}] Erro:`, err?.message);
      backupData.summary.failed_tables++;
      backupData.summary.errors[table] = String(err?.message || err);
    }
  }

  // Criar diretório de backups
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const backupFilePath = path.join(backupsDir, `forensic_backup_${dateStr}.json`);
  const backupSqlPath = path.join(backupsDir, `forensic_backup_${dateStr}.sql`);
  const latestBackupPath = path.join(backupsDir, `latest_backup.json`);

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  fs.writeFileSync(backupSqlPath, sqlStatements.join('\n'), 'utf-8');
  fs.writeFileSync(latestBackupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n======================================================`);
  console.log(`[Backup Forense Concluído com Sucesso]`);
  console.log(`JSON: ${backupFilePath}`);
  console.log(`SQL:  ${backupSqlPath}`);
  console.log(`Total de Linhas no Banco: ${backupData.summary.total_rows}`);
  console.log(`Tabelas Verificadas: ${backupData.summary.successful_tables}/${TABLES.length}`);
  console.log(`======================================================\n`);

  return backupData;
}

runFullDatabaseValidationAndBackup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha no backup:', err);
    process.exit(1);
  });
