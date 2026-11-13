import officialContractsSeed from '@/data/officialContractsSeed.json';

export interface SheetRowV9 {
  id: string;
  month_key: string; // Ex: '2026-10'
  qt: string; // '01', '02', '03'...
  lead_mapping: string; // Mapeamento de lead
  data: string; // '01/10/2026'
  vendedor: string; // 'Lilian', 'Geibriel', 'Daniel', 'Breno'
  chassi: string; // '99HSHF250VS001222'
  modelo: string; // 'SHI 250', 'RIO 125', etc.
  cliente: string; // 'RODRIGO VICTOR DE MOURA'
  regiao: string; // 'BELO HORIZONTE', 'DIVINOPOLIS', etc.
  valor: number; // R$ 23.330,00
  financiamento: number; // R$ 13.998,00
  banco: string; // 'ALTIS', 'MOTRIX', 'PAN', 'BRADESCO M', 'SANTANDER'
  dinheiro: number; // R$ 9.332,00
  pix: number; // R$ 3.000,00
  carta_credito: number; // Consórcio / Carta
  cartao: number; // R$ 6.000,00
  comp: string; // Comprovante: 'Imagem', URL, etc.
  boleto: number; // Boleto
  custos: number; // Custos da venda
  total: number; // Total recebido
  observacoes: string; // Observações da venda
  tipo_registro: 'venda' | 'pre_venda' | 'emissao_nf';
  is_permitted: boolean; // Se false = opaca/mais clara (em análise); se true = faturada/normal
  permitted_by?: string | null;
  permitted_at?: string | null;
}

export function parseCurrencyBRL(val: string | number | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  
  // Limpa caracteres que não são números, ponto, vírgula ou sinal de menos
  let s = String(val).trim().replace(/[^\d,.-]/g, '');
  if (!s) return 0;

  // Formato brasileiro com separador de milhar '.' e decimal ',' (Ex: '23.330,00')
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Apenas vírgula decimal (Ex: '23330,00' ou '9,50')
    s = s.replace(',', '.');
  } else if (/^\d+\.\d{3}$/.test(s)) {
    // Formato com ponto de milhar sem centavos (Ex: '23.330')
    s = s.replace('.', '');
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

export function formatCurrencyBRL(val: number | undefined): string {
  if (val === undefined || isNaN(val) || val === 0) return '—';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

export function parseBackupCsv(csvText: string, defaultMonthKey = '2026-10'): {
  rows: SheetRowV9[];
  sellerStats: Record<string, number>;
} {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: SheetRowV9[] = [];
  const sellerStats: Record<string, number> = {};

  let headerFound = false;

  for (const line of lines) {
    // Suporta tanto cópia direta do Excel Online / Desktop (separado por Tab '\t') quanto CSV (separado por ';')
    const delimiter = line.includes('\t') ? '\t' : ';';
    const cols = line.split(delimiter).map((c) => c.trim());

    // Detecta cabeçalho
    if (cols[0]?.toUpperCase() === 'QT' && cols.some((c) => c.toUpperCase() === 'VENDEDOR')) {
      headerFound = true;
      continue;
    }

    // Detecta resumo de vendedores no rodapé (ex: "2;Daniel", "7;Geibriel")
    if (cols.length >= 2 && /^\d+$/.test(cols[0]) && cols[1] && !cols[2] && !cols[3]) {
      const count = parseInt(cols[0], 10);
      const seller = cols[1];
      sellerStats[seller] = count;
      continue;
    }

    // Linha de venda com QT preenchido
    if (cols[0] && /^\d+$/.test(cols[0])) {
      const qt = cols[0].padStart(2, '0');
      const lead_mapping = cols[1] || '';
      const data = cols[2] || '';
      const vendedor = cols[3] || 'Vendedor';
      const chassi = cols[4] || '';
      const modelo = cols[5] || '';
      const cliente = cols[6] || '';
      const regiao = cols[7] || '';
      const valor = parseCurrencyBRL(cols[8]);
      const financiamento = parseCurrencyBRL(cols[9]);
      const banco = cols[10] || '';
      const dinheiro = parseCurrencyBRL(cols[11]);
      const pix = parseCurrencyBRL(cols[12]);
      const carta_credito = parseCurrencyBRL(cols[13]);
      const cartao = parseCurrencyBRL(cols[14]);
      const comp = cols[15] || '';
      const boleto = parseCurrencyBRL(cols[17]);
      const custos = parseCurrencyBRL(cols[18]);
      const total = parseCurrencyBRL(cols[19]) || valor;
      const observacoes = cols[20] || '';

      // Tenta extrair mês da data (ex: 01/10/2026 -> 2026-10)
      let mKey = defaultMonthKey;
      if (data && data.includes('/')) {
        const parts = data.split('/');
        if (parts.length === 3) {
          mKey = `${parts[2]}-${parts[1].padStart(2, '0')}`;
        }
      }

      // Se houver observações com pendência de pagamento ou ferramenta, marca como pré-venda/claro
      const isPending =
        observacoes.toUpperCase().includes('SERÃO PAGOS NA ENTREGA') ||
        observacoes.toUpperCase().includes('FINALIZANDO') ||
        lead_mapping.toUpperCase().includes('AGUARDANDO') ||
        !banco && valor > 0 && total === 0;

      rows.push({
        id: `row-v9-${mKey}-${qt}-${Date.now() + Math.random()}`,
        month_key: mKey,
        qt,
        lead_mapping,
        data,
        vendedor,
        chassi,
        modelo,
        cliente,
        regiao,
        valor,
        financiamento,
        banco,
        dinheiro,
        pix,
        carta_credito,
        cartao,
        comp,
        boleto,
        custos,
        total,
        observacoes,
        tipo_registro: isPending ? 'pre_venda' : 'venda',
        is_permitted: !isPending,
      });

      // Contabiliza vendedor
      if (vendedor) {
        sellerStats[vendedor] = (sellerStats[vendedor] || 0) + 1;
      }
    }
  }

  return { rows, sellerStats };
}

/** URL padrão da Planilha de Vendas de Divinópolis no OneDrive */
export const ONEDRIVE_DEFAULT_URL = 'https://1drv.ms/x/c/b5177ebc01be67e9/IQCk_omgPi8VSJ0OGrk3iPR2AWd0LdLxQxkKIyA7KtAZhbE?e=bWHhCy';

export const SHEET_STORAGE_KEY_V9 = 'dealflow_cloud_monthly_sheet_v9';

/** Converte a base oficial de contratos do grupo em linhas estruturadas de planilha */
export function convertContractsSeedToSheetRows(): SheetRowV9[] {
  const seed = (officialContractsSeed as any[]) || [];
  return seed.map((c, index) => {
    const v = c.vehicle || {};
    const ext = c.external_data || {};
    const d = new Date(c.signed_at || c.created_at || '2026-01-01');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear() || 2026;
    const month_key = `${year}-${month}`;
    const dataStr = `${day}/${month}/${year}`;
    const saleVal = Number(c.sale_price) || 0;
    const downPay = Number(c.down_payment) || 0;
    const finVal =
      Number(
        c.financing_installments && c.financing_installment_value
          ? c.financing_installments * c.financing_installment_value
          : Math.max(0, saleVal - downPay)
      ) || 0;
    const bankName = c.financing_bank || (finVal > 0 ? 'FINANCIAMENTO' : 'À VISTA');

    let cityStr = c.store?.name?.includes('Montes Claros') ? 'Montes Claros' : 'Divinópolis';
    if (c.buyer_address) {
      const parts = c.buyer_address.split('-');
      if (parts.length >= 2) {
        cityStr = parts[parts.length - 2].trim();
      }
    }

    const vehicleModel = v.model
      ? `${v.brand || ''} ${v.model}`.trim()
      : ext.vehicle_model_custom || 'MOTO';

    return {
      id: c.id,
      month_key,
      qt: String(index + 1).padStart(2, '0'),
      lead_mapping: c.lead_source || 'Balcão',
      data: dataStr,
      vendedor: c.vendedor || c.operator?.full_name || 'Vendedor',
      chassi: v.chassis || ext.chassis || '',
      modelo: vehicleModel,
      cliente: c.buyer_name || 'Cliente',
      regiao: cityStr,
      valor: saleVal,
      financiamento: finVal,
      banco: bankName,
      dinheiro: Number(c.down_payment_cash) || (downPay > 0 ? downPay : 0),
      pix: Number(c.down_payment_pix) || 0,
      carta_credito: 0,
      cartao: Number(c.down_payment_card) || 0,
      comp: '',
      boleto: 0,
      custos: 0,
      total: saleVal,
      observacoes: c.notes || '',
      is_permitted: c.status === 'concluido' || c.status === 'assinado',
      tipo_registro: (c.status === 'pre_venda' ? 'pre_venda' : 'venda') as any,
    };
  });
}

/** Retorna as linhas vivas salvas na nuvem/localStorage com fallback automático para a base oficial */
export function getLiveSheetRows(): SheetRowV9[] {
  try {
    const stored = localStorage.getItem(SHEET_STORAGE_KEY_V9);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Se o dispositivo ainda não possui cache local, hidrata instantaneamente a partir da base oficial
  const seeded = convertContractsSeedToSheetRows();
  try {
    if (typeof localStorage !== 'undefined' && seeded.length > 0) {
      localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(seeded));
    }
  } catch {}
  return seeded;
}

/** Converte um array de SheetRowV9 em TSV (separado por Tab) pronto para Ctrl+V direto no Excel Online */
export function serializeRowsToTsv(rows: SheetRowV9[]): string {
  const header = [
    'QT',
    'MAPEAMENTO DE LEAD',
    'DATA',
    'VENDEDOR',
    'CHASSI',
    'MODELO',
    'CLIENTE',
    'REGIÃO',
    'VALOR',
    'FINANCIAMENTO',
    'BANCO',
    'DINHEIRO',
    'PIX',
    'CARTA DE CRÉDITO',
    'CARTÃO',
    'Comp',
    '',
    'BOLETO',
    'CUSTOS',
    'TOTAL',
    'OBSERVAÇÕES',
  ].join('\t');

  const fmtNum = (n: number) => (n && n > 0 ? formatCurrencyBRL(n) : '');

  const body = rows.map((r) =>
    [
      r.qt,
      r.lead_mapping || '',
      r.data || '',
      r.vendedor || '',
      r.chassi || '',
      r.modelo || '',
      r.cliente || '',
      r.regiao || '',
      fmtNum(r.valor),
      fmtNum(r.financiamento),
      r.banco || '',
      fmtNum(r.dinheiro),
      fmtNum(r.pix),
      fmtNum(r.carta_credito),
      fmtNum(r.cartao),
      r.comp || '',
      '',
      fmtNum(r.boleto),
      fmtNum(r.custos),
      fmtNum(r.total || r.valor),
      r.observacoes || '',
    ].join('\t')
  );

  return [header, ...body].join('\n');
}

/** Planilha inicial limpa para novos lançamentos */
export const INITIAL_USER_BACKUP_CSV = `QT;MAPEAMENTO DE LEAD;DATA;VENDEDOR;CHASSI;MODELO;CLIENTE;REGIÃO;VALOR;FINANCIAMENTO;BANCO;DINHEIRO;PIX;CARTA DE CRÉDITO;CARTÃO;Comp;;BOLETO;CUSTOS;TOTAL;OBSERVAÇÕES`;

/** Backup limpo sem dados fictícios */
export const BACKUP_ORIGINAL_USER_IMPORT_CSV = `QT;MAPEAMENTO DE LEAD;DATA;VENDEDOR;CHASSI;MODELO;CLIENTE;REGIÃO;VALOR;FINANCIAMENTO;BANCO;DINHEIRO;PIX;CARTA DE CRÉDITO;CARTÃO;Comp;;BOLETO;CUSTOS;TOTAL;OBSERVAÇÕES`;;
