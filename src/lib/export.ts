import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface ExportConfig {
  title: string;
  module: 'vehicles' | 'sales' | 'contracts' | 'payments';
  filters: Record<string, string>;
  columns: { key: string; label: string; type?: 'currency' | 'date' | 'text' | 'cpf' | 'phone' }[];
  data: Record<string, unknown>[];
  userName: string;
  storeName?: string;
}

// Formatters
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return date.toISOString().split('T')[0];
}

function formatCPF(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatPhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

function formatValue(value: unknown, type?: string): string | number {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'currency':
      return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    case 'date':
      return formatDate(String(value));
    case 'cpf':
      return formatCPF(String(value));
    case 'phone':
      return formatPhone(String(value));
    default:
      return String(value);
  }
}

// Generate unique audit ID
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `EXP-${timestamp}-${random}`.toUpperCase();
}

// Log export action
async function logExport(config: ExportConfig, auditId: string, recordCount: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('activity_logs').insert({
      action: 'export',
      entity_type: config.module,
      details: {
        audit_id: auditId,
        title: config.title,
        filters: config.filters,
        record_count: recordCount,
        exported_at: new Date().toISOString(),
        user_name: config.userName,
        store_name: config.storeName,
      },
      user_id: user?.id,
    });
  } catch (error) {
    console.error('Failed to log export:', error);
  }
}

// Build filter string for header
function buildFilterString(filters: Record<string, string>): string {
  const parts = Object.entries(filters)
    .filter(([, value]) => value && value !== 'all')
    .map(([key, value]) => `${key}=${value}`);
  
  return parts.length > 0 ? parts.join('; ') : 'Nenhum filtro aplicado';
}

// Export to XLSX
export async function exportToXLSX(config: ExportConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const auditId = generateAuditId();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    // Prepare header rows
    const headerRows = [
      [`${config.title} — ${config.storeName || 'Todas as Lojas'} — ${dateStr}`],
      [`Filtros: ${buildFilterString(config.filters)}`],
      [`Exportado por: ${config.userName} | ID: ${auditId} | Data/Hora: ${now.toLocaleString('pt-BR')}`],
      [], // Empty row
      config.columns.map(col => col.label), // Column headers
    ];
    
    // Prepare data rows
    const dataRows = config.data.map(row => 
      config.columns.map(col => formatValue(row[col.key], col.type))
    );
    
    // Create worksheet
    const allRows = [...headerRows, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    
    // Set column widths
    const colWidths = config.columns.map(col => ({ wch: Math.max(col.label.length + 2, 15) }));
    ws['!cols'] = colWidths;
    
    // Apply number format for currency columns
    const currencyColumns = config.columns
      .map((col, idx) => col.type === 'currency' ? idx : -1)
      .filter(idx => idx >= 0);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.module);
    
    // Generate file
    const fileName = `${config.module}_${dateStr}_${auditId}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    // Log the export
    await logExport(config, auditId, config.data.length);
    
    return { success: true };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Falha na exportação' };
  }
}

// Export to CSV
export async function exportToCSV(config: ExportConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const auditId = generateAuditId();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    // Build CSV content
    const lines: string[] = [];
    
    // Header info
    lines.push(`"${config.title} — ${config.storeName || 'Todas as Lojas'} — ${dateStr}"`);
    lines.push(`"Filtros: ${buildFilterString(config.filters)}"`);
    lines.push(`"Exportado por: ${config.userName} | ID: ${auditId}"`);
    lines.push(''); // Empty row
    
    // Column headers
    lines.push(config.columns.map(col => `"${col.label}"`).join(','));
    
    // Data rows
    config.data.forEach(row => {
      const values = config.columns.map(col => {
        const value = formatValue(row[col.key], col.type);
        // Escape quotes and wrap in quotes for text fields
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      lines.push(values.join(','));
    });
    
    // Create blob and download
    const csvContent = lines.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.module}_${dateStr}_${auditId}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    // Log the export
    await logExport(config, auditId, config.data.length);
    
    return { success: true };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Falha na exportação' };
  }
}

// Get export columns for each module
export function getExportColumns(module: string): ExportConfig['columns'] {
  switch (module) {
    case 'vehicles':
      return [
        { key: 'brand', label: 'Marca', type: 'text' },
        { key: 'model', label: 'Modelo', type: 'text' },
        { key: 'year', label: 'Ano', type: 'text' },
        { key: 'plate', label: 'Placa', type: 'text' },
        { key: 'chassis', label: 'Chassi', type: 'text' },
        { key: 'renavam', label: 'Renavam', type: 'text' },
        { key: 'color', label: 'Cor', type: 'text' },
        { key: 'mileage', label: 'Km', type: 'text' },
        { key: 'purchase_price', label: 'Preço Compra', type: 'currency' },
        { key: 'sale_price', label: 'Preço Venda', type: 'currency' },
        { key: 'status', label: 'Status', type: 'text' },
      ];
    case 'sales':
    case 'contracts':
      return [
        { key: 'contract_number', label: 'Contrato', type: 'text' },
        { key: 'buyer_name', label: 'Cliente', type: 'text' },
        { key: 'buyer_cpf', label: 'CPF', type: 'cpf' },
        { key: 'buyer_phone', label: 'Telefone', type: 'phone' },
        { key: 'buyer_email', label: 'E-mail', type: 'text' },
        { key: 'vehicle_chassis', label: 'Chassi', type: 'text' },
        { key: 'vehicle_info', label: 'Veículo', type: 'text' },
        { key: 'sale_price', label: 'Valor', type: 'currency' },
        { key: 'down_payment', label: 'Entrada', type: 'currency' },
        { key: 'installments', label: 'Parcelas', type: 'text' },
        { key: 'status', label: 'Status', type: 'text' },
        { key: 'created_at', label: 'Data', type: 'date' },
      ];
    case 'payments':
      return [
        { key: 'payment_date', label: 'Data', type: 'date' },
        { key: 'amount', label: 'Valor', type: 'currency' },
        { key: 'payment_method', label: 'Método', type: 'text' },
        { key: 'reference', label: 'Referência', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'text' },
      ];
    default:
      return [];
  }
}

// Exportação Nativa Multi-Abas Excel (.xlsx) por Concessionária (Ex: MOC / Matriz / Resumo)
export function exportDealershipWorksheetMultiStore({
  rows,
  monthKey,
  selectedStoreFilter = 'all',
  userName = 'Administrador',
}: {
  rows: any[];
  monthKey: string;
  selectedStoreFilter?: string;
  userName?: string;
}) {
  const wb = XLSX.utils.book_new();

  const mapRow = (r: any) => ({
    'QT': r.qt,
    'Canal / Lead': r.lead_mapping || 'Balcão',
    'Data': r.data,
    'Vendedor': r.vendedor,
    'Chassi': r.chassi,
    'Modelo': r.modelo,
    'Cliente': r.cliente,
    'Região / Concessionária': r.regiao,
    'Valor Total (R$)': Number(r.valor) || 0,
    'Financiamento (R$)': Number(r.financiamento) || 0,
    'Banco': r.banco || 'À VISTA',
    'Entrada Dinheiro (R$)': Number(r.dinheiro) || 0,
    'Entrada PIX (R$)': Number(r.pix) || 0,
    'Carta de Crédito (R$)': Number(r.carta_credito) || 0,
    'Cartão (R$)': Number(r.cartao) || 0,
    'Boleto (R$)': Number(r.boleto) || 0,
    'Comprovante': r.comp || 'Não anexado',
    'Custos / Despesas (R$)': Number(r.custos) || 0,
    'Status Faturamento': r.is_permitted ? 'Faturado / Liberado' : 'Pré-Venda (Em Análise)',
    'Observações': r.observacoes || '',
  });

  // Sheet 1: Todas as Vendas Consolidadas
  const wsAll = XLSX.utils.json_to_sheet(rows.map(mapRow));
  XLSX.utils.book_append_sheet(wb, wsAll, 'Todas as Vendas');

  // Sheet 2: Vendas MOC (Montes Claros)
  const mocRows = rows.filter((r) => {
    const reg = (r.regiao || '').toUpperCase();
    return reg.includes('MOC') || reg.includes('MONTES CLAROS');
  });
  if (mocRows.length > 0) {
    const wsMoc = XLSX.utils.json_to_sheet(mocRows.map(mapRow));
    XLSX.utils.book_append_sheet(wb, wsMoc, 'Vendas MOC (Montes Claros)');
  }

  // Sheet 3: Vendas Outras Regiões / Matriz
  const outrasRows = rows.filter((r) => {
    const reg = (r.regiao || '').toUpperCase();
    return !reg.includes('MOC') && !reg.includes('MONTES CLAROS');
  });
  if (outrasRows.length > 0) {
    const wsOutras = XLSX.utils.json_to_sheet(outrasRows.map(mapRow));
    XLSX.utils.book_append_sheet(wb, wsOutras, 'Demais Concessionárias');
  }

  // Sheet 4: Resumo Executivo e Indicadores por Unidade
  let totalFatGeral = 0;
  let totalMotosGeral = rows.length;
  let totalFinGeral = 0;
  rows.forEach((r) => {
    totalFatGeral += Number(r.valor) || 0;
    totalFinGeral += Number(r.financiamento) || 0;
  });

  let totalFatMoc = 0;
  let totalFinMoc = 0;
  mocRows.forEach((r) => {
    totalFatMoc += Number(r.valor) || 0;
    totalFinMoc += Number(r.financiamento) || 0;
  });

  const resumoData = [
    { Indicador: 'Sistema', Valor: 'PIXEL MOTORS OS' },
    { Indicador: 'Mês de Referência', Valor: monthKey },
    { Indicador: 'Exportado por', Valor: userName },
    { Indicador: 'Data/Hora de Emissão', Valor: new Date().toLocaleString('pt-BR') },
    { Indicador: '---', Valor: '---' },
    { Indicador: 'Total de Veículos Faturados (Geral)', Valor: totalMotosGeral },
    { Indicador: 'Faturamento Total Bruto (Geral R$)', Valor: totalFatGeral },
    { Indicador: 'Volume Financiado Bancário (Geral R$)', Valor: totalFinGeral },
    { Indicador: 'Ticket Médio Geral (R$)', Valor: totalMotosGeral > 0 ? totalFatGeral / totalMotosGeral : 0 },
    { Indicador: '---', Valor: '---' },
    { Indicador: 'Total de Veículos MOC (Montes Claros)', Valor: mocRows.length },
    { Indicador: 'Faturamento MOC (R$)', Valor: totalFatMoc },
    { Indicador: 'Volume Financiado MOC (R$)', Valor: totalFinMoc },
    { Indicador: 'Ticket Médio MOC (R$)', Valor: mocRows.length > 0 ? totalFatMoc / mocRows.length : 0 },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

  // Grava arquivo oficial Excel .xlsx
  const fileName = `Planilha_Vendas_PIXEL_MOTORS_${monthKey}_MultiUnidades.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
