import { jsPDF } from 'jspdf';
import { LIMA_MOTORS_LOGO_DATA_URI } from '../assets/limaMotorsLogoBase64';

export interface InvoiceDraftPayload {
  draftCode: string; // Código interno de teste (ex: PRV-2026-000001)
  issueDate: string; // DD/MM/YYYY
  operationNature: string;
  // Emitente
  issuerName: string;
  issuerCnpj: string;
  issuerIe: string;
  issuerAddress: string;
  issuerCityUf: string;
  issuerCep: string;
  issuerPhone?: string;
  // Destinatário / Cliente
  customerName: string;
  customerDocument: string;
  customerAddress: string;
  customerNeighborhood: string;
  customerCep: string;
  customerCity: string;
  customerUf: string;
  customerPhone?: string;
  // Pagamento
  paymentDescription: string;
  totalValue: number;
  // Produto / Moto
  productCode: string;
  productDescription: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitValue: number;
  // Observações
  additionalInfo?: string;
}

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function generateDraftCode(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `TESTE-${yr}-${rnd}`;
}

/**
 * Renderiza a logomarca oficial LM LIMA MOTORS MULTIMARCAS no quadro do emitente.
 */
function drawLimaMotorsLogo(doc: jsPDF, cx: number, topY: number): void {
  // Proporção original da imagem oficial: 250x136 (1.838:1)
  const logoW = 26.5;
  const logoH = 14.4;
  doc.addImage(LIMA_MOTORS_LOGO_DATA_URI, 'JPEG', cx - logoW / 2, topY, logoW, logoH);
}

/**
 * Gera um PDF A4 com acabamento gráfico completo (logo oficial LM Lima Motors,
 * Times serifada, caixas arredondadas e todas as seções estruturadas), claramente
 * identificado com faixa e marca d'água "TESTE — SEM VALOR FISCAL" (sem chave SEFAZ falsa)
 * para validação antes de ativar o emissor NF-e homologado.
 */
export function buildInvoiceDraftPdfDocument(data: InvoiceDraftPayload): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm
  const m = 4.5;
  const W = pageW - m * 2; // 201mm
  const R = 0.85; // raio de canto arredondado fiel ao modelo
  let y = 4.5;

  const box = (
    x: number,
    top: number,
    w: number,
    h: number,
    label?: string,
    value?: string,
    opts?: {
      bold?: boolean;
      align?: 'left' | 'right' | 'center';
      size?: number;
      font?: 'times' | 'helvetica' | 'courier';
      valueYOffset?: number;
    }
  ) => {
    doc.setDrawColor(25, 25, 25);
    doc.setLineWidth(0.22);
    doc.roundedRect(x, top, w, h, R, R, 'S');
    if (label) {
      doc.setFont('times', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(35, 35, 35);
      doc.text(label.toUpperCase(), x + 1.2, top + 2.3);
    }
    if (value !== undefined && value !== '') {
      doc.setFont(opts?.font || 'times', opts?.bold ? 'bold' : 'normal');
      doc.setFontSize(opts?.size ?? 8.5);
      doc.setTextColor(10, 10, 10);
      const align = opts?.align || 'left';
      const tx = align === 'right' ? x + w - 1.4 : align === 'center' ? x + w / 2 : x + 1.4;
      const ty = top + h - (opts?.valueYOffset ?? 1.4);
      doc.text(value, tx, ty, { align, maxWidth: w - 2.6 });
    }
  };

  const sectionTitle = (title: string, top: number) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 15, 15);
    doc.text(title.toUpperCase(), m + 0.5, top);
  };

  // =========================================================================
  // FAIXA SUPERIOR OBRIGATÓRIA DE IDENTIFICAÇÃO DE TESTE
  // =========================================================================
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(m, y, W, 6.2, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('AMBIENTE DE TESTE — DOCUMENTO DE PRÉVIA SEM VALOR FISCAL', pageW / 2, y + 4.2, { align: 'center' });
  y += 7.4;

  // =========================================================================
  // 1. CANHOTO DE RECEBIMENTO
  // =========================================================================
  const canhotoRightW = 36;
  const canhotoLeftW = W - canhotoRightW;

  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.22);
  doc.roundedRect(m, y, canhotoLeftW, 8.2, R, R, 'S');
  doc.setFont('times', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 15, 15);
  const canhotoTxt = `RECEBEMOS DE ${data.issuerName} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NESTE DOCUMENTO DE TESTE. EMISSÃO: ${data.issueDate} VALOR TOTAL: R$ ${fmtBRL(data.totalValue)} DESTINATÁRIO: ${data.customerName} - ${data.customerAddress} ${data.customerNeighborhood} ${data.customerCity}-${data.customerUf}`;
  doc.text(doc.splitTextToSize(canhotoTxt, canhotoLeftW - 3), m + 1.4, y + 2.8);

  box(m, y + 8.2, 34, 7.6, 'DATA DE RECEBIMENTO');
  box(m + 34, y + 8.2, canhotoLeftW - 34, 7.6, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR');

  doc.roundedRect(m + canhotoLeftW, y, canhotoRightW, 15.8, R, R, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 15);
  doc.text('PRÉVIA', m + canhotoLeftW + canhotoRightW / 2, y + 5.2, { align: 'center' });
  doc.setFontSize(7.6);
  doc.text(data.draftCode, m + canhotoLeftW + canhotoRightW / 2, y + 10.2, { align: 'center' });
  doc.setFontSize(6.8);
  doc.text('SEM VALOR FISCAL', m + canhotoLeftW + canhotoRightW / 2, y + 14, { align: 'center' });

  y += 17.4;
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setDrawColor(70, 70, 70);
  doc.line(m, y, pageW - m, y);
  doc.setLineDashPattern([], 0);
  y += 1.6;

  // =========================================================================
  // 2. CABEÇALHO PRINCIPAL (EMITENTE | QUADRO CENTRAL | CÓDIGO INTERNO)
  // =========================================================================
  const emitW = 81;
  const midW = 35;
  const rightW = W - emitW - midW;
  const topH = 33.5;

  // Bloco Emitente
  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.24);
  doc.roundedRect(m, y, emitW, topH, R, R, 'S');
  doc.setFont('times', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(35, 35, 35);
  doc.text('IDENTIFICAÇÃO DO EMITENTE', m + emitW / 2, y + 2.3, { align: 'center' });

  drawLimaMotorsLogo(doc, m + emitW / 2, y + 3.2);

  doc.setFont('times', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(10, 10, 10);
  doc.text(data.issuerName, m + emitW / 2, y + 21.4, { align: 'center', maxWidth: emitW - 2.5 });
  doc.setFont('times', 'normal');
  doc.setFontSize(7.6);
  const addrParts = data.issuerAddress.split(' - ');
  if (addrParts.length >= 3) {
    const line1 = `${addrParts[0]} - ${addrParts[1]}`;
    const line2 = `${addrParts.slice(2).join(' - ')} - ${data.issuerCep}`;
    doc.text(line1, m + emitW / 2, y + 25.0, { align: 'center', maxWidth: emitW - 2.5 });
    doc.text(line2, m + emitW / 2, y + 28.2, { align: 'center', maxWidth: emitW - 2.5 });
  } else {
    doc.text(data.issuerAddress, m + emitW / 2, y + 25.0, { align: 'center', maxWidth: emitW - 2.5 });
    doc.text(`CEP ${data.issuerCep}`, m + emitW / 2, y + 28.2, { align: 'center', maxWidth: emitW - 2.5 });
  }
  doc.text(
    `${data.issuerCityUf} Fone/Fax: ${data.issuerPhone || ''}`.trim(),
    m + emitW / 2,
    y + 31.4,
    { align: 'center', maxWidth: emitW - 2.5 }
  );

  // Bloco Central
  doc.roundedRect(m + emitW, y, midW, topH, R, R, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('PRÉVIA', m + emitW + midW / 2, y + 5.6, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(7.0);
  doc.text('Espelho de Conferência', m + emitW + midW / 2, y + 9.2, { align: 'center' });
  doc.text('Sem Valor Fiscal', m + emitW + midW / 2, y + 12.2, { align: 'center' });

  doc.setFontSize(6.6);
  doc.text('0 - ENTRADA', m + emitW + 2.2, y + 17.0);
  doc.text('1 - SAÍDA', m + emitW + 2.2, y + 20.4);
  doc.roundedRect(m + emitW + midW - 8.5, y + 15.0, 6.2, 6.5, 0.5, 0.5, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('1', m + emitW + midW - 5.4, y + 19.6, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(8.0);
  doc.text(data.draftCode, m + emitW + midW / 2, y + 26.2, { align: 'center' });
  doc.setFont('times', 'italic');
  doc.setFontSize(7.2);
  doc.text('Folha 1/1', m + emitW + midW / 2, y + 31.0, { align: 'center' });

  // Bloco Direito (Código Interno de Teste — SEM chave SEFAZ falsa)
  doc.roundedRect(m + emitW + midW, y, rightW, 15.0, R, R, 'S');
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(m + emitW + midW + 3, y + 2.5, rightW - 6, 10.0, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(185, 28, 28);
  doc.text('MODO TESTE — SEM VALOR FISCAL', m + emitW + midW + rightW / 2, y + 8.8, { align: 'center' });

  box(m + emitW + midW, y + 15.0, rightW, 8.5, 'CÓDIGO INTERNO DE TESTE', data.draftCode, {
    bold: true,
    align: 'center',
    size: 10,
    font: 'courier',
  });

  doc.roundedRect(m + emitW + midW, y + 23.5, rightW, 10.0, R, R, 'S');
  doc.setFont('times', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(40, 40, 40);
  doc.text(
    'Documento gerado apenas para validação visual e de dados.',
    m + emitW + midW + rightW / 2,
    y + 27.4,
    { align: 'center' }
  );
  doc.text(
    'Para emissão oficial, conecte o emissor NF-e homologado na SEFAZ.',
    m + emitW + midW + rightW / 2,
    y + 31.4,
    { align: 'center' }
  );

  y += topH;

  // Natureza da operação + Protocolo
  box(m, y, emitW + midW, 7.2, 'NATUREZA DA OPERAÇÃO', data.operationNature, { bold: true, align: 'center', size: 9 });
  box(m + emitW + midW, y, rightW, 7.2, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', 'AMBIENTE DE TESTE (NÃO TRANSMITIDO À SEFAZ)', {
    bold: true,
    align: 'center',
    size: 6.8,
  });
  y += 7.2;

  // IE + IE Subst + CNPJ
  box(m, y, W * 0.34, 7.2, 'INSCRIÇÃO ESTADUAL', data.issuerIe, { bold: true, align: 'center', size: 9 });
  box(m + W * 0.34, y, W * 0.33, 7.2, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', '');
  box(m + W * 0.67, y, W * 0.33, 7.2, 'CNPJ', data.issuerCnpj, { bold: true, align: 'center', size: 9 });
  y += 9.5;

  // =========================================================================
  // 3. DESTINATÁRIO / REMETENTE
  // =========================================================================
  sectionTitle('DESTINATÁRIO / REMETENTE', y);
  y += 1.2;

  box(m, y, W * 0.61, 7.4, 'NOME / RAZÃO SOCIAL', data.customerName, { bold: true, size: 9 });
  box(m + W * 0.61, y, W * 0.23, 7.4, 'CNPJ / CPF', data.customerDocument, { bold: true, align: 'center', size: 9 });
  box(m + W * 0.84, y, W * 0.16, 7.4, 'DATA DA EMISSÃO', data.issueDate, { bold: true, align: 'center', size: 9 });
  y += 7.4;

  box(m, y, W * 0.47, 7.4, 'ENDEREÇO', data.customerAddress, { bold: true, size: 8.5 });
  box(m + W * 0.47, y, W * 0.23, 7.4, 'BAIRRO / DISTRITO', data.customerNeighborhood, { bold: true, align: 'center', size: 8.5 });
  box(m + W * 0.70, y, W * 0.14, 7.4, 'CEP', data.customerCep, { bold: true, align: 'center', size: 8.5 });
  box(m + W * 0.84, y, W * 0.16, 7.4, 'DATA DA SAÍDA', data.issueDate, { align: 'center', size: 8.5 });
  y += 7.4;

  box(m, y, W * 0.455, 7.4, 'MUNICÍPIO', data.customerCity, { bold: true, size: 8.8 });
  box(m + W * 0.455, y, W * 0.055, 7.4, 'UF', data.customerUf, { bold: true, align: 'center', size: 8.5 });
  box(m + W * 0.51, y, W * 0.16, 7.4, 'FONE / FAX', data.customerPhone || '', { size: 8.2 });
  box(m + W * 0.67, y, W * 0.17, 7.4, 'INSCRIÇÃO ESTADUAL', '');
  box(m + W * 0.84, y, W * 0.16, 7.4, 'HORA DA SAÍDA', '');
  y += 9.8;

  // =========================================================================
  // 4. FATURA / PAGAMENTO
  // =========================================================================
  sectionTitle('FATURA / PAGAMENTO', y);
  y += 1.2;
  box(m, y, W, 6.8, undefined, `${data.paymentDescription} - R$ ${fmtBRL(data.totalValue)}`, {
    size: 8.2,
    valueYOffset: 2,
  });
  y += 9.2;

  // =========================================================================
  // 5. CÁLCULO DO IMPOSTO (2 LINHAS COMPLETAS — 12 QUADROS)
  // =========================================================================
  sectionTitle('CÁLCULO DO IMPOSTO', y);
  y += 1.2;

  const impW = [W * 0.16, W * 0.16, W * 0.16, W * 0.16, W * 0.16, W * 0.20];
  let ix = m;
  const row1Imp: Array<[string, string]> = [
    ['BASE DE CÁLCULO ICMS', '0,00'],
    ['VALOR DO ICMS', '0,00'],
    ['BASE DE CÁLC. ICMS ST', '0,00'],
    ['VALOR DO ICMS ST', '0,00'],
    ['VALOR DO II', '0,00'],
    ['VALOR TOTAL PRODUTOS', fmtBRL(data.totalValue)],
  ];
  row1Imp.forEach(([lbl, val], idx) => {
    box(ix, y, impW[idx], 7.4, lbl, val, { bold: true, align: 'right', size: 10 });
    ix += impW[idx];
  });
  y += 7.4;

  ix = m;
  const row2Imp: Array<[string, string]> = [
    ['VALOR DO FRETE', '0,00'],
    ['VALOR DO SEGURO', '0,00'],
    ['DESCONTO', '0,00'],
    ['OUTRAS DESPESAS', '0,00'],
    ['VALOR TOTAL DO IPI', '0,00'],
    ['VALOR TOTAL DA NOTA', fmtBRL(data.totalValue)],
  ];
  row2Imp.forEach(([lbl, val], idx) => {
    box(ix, y, impW[idx], 7.4, lbl, val, { bold: true, align: 'right', size: 10 });
    ix += impW[idx];
  });
  y += 9.8;

  // =========================================================================
  // 6. TRANSPORTADOR / VOLUMES TRANSPORTADOS (3 LINHAS COMPLETAS)
  // =========================================================================
  sectionTitle('TRANSPORTADOR / VOLUMES TRANSPORTADOS', y);
  y += 1.2;

  box(m, y, W * 0.29, 7.2, 'NOME / RAZÃO SOCIAL', '');
  box(m + W * 0.29, y, W * 0.15, 7.2, 'FRETE POR CONTA', '(9) Sem Frete', { bold: true, align: 'center', size: 8.5 });
  box(m + W * 0.44, y, W * 0.15, 7.2, 'CÓDIGO ANTT', '');
  box(m + W * 0.59, y, W * 0.15, 7.2, 'PLACA DO VEÍCULO', '');
  box(m + W * 0.74, y, W * 0.04, 7.2, 'UF', '');
  box(m + W * 0.78, y, W * 0.22, 7.2, 'CNPJ / CPF', '');
  y += 7.2;

  box(m, y, W * 0.44, 7.2, 'ENDEREÇO', '');
  box(m + W * 0.44, y, W * 0.30, 7.2, 'MUNICÍPIO', '');
  box(m + W * 0.74, y, W * 0.04, 7.2, 'UF', '');
  box(m + W * 0.78, y, W * 0.22, 7.2, 'INSCRIÇÃO ESTADUAL', '');
  y += 7.2;

  box(m, y, W * 0.10, 7.2, 'QUANTIDADE', '');
  box(m + W * 0.10, y, W * 0.16, 7.2, 'ESPÉCIE', '');
  box(m + W * 0.26, y, W * 0.18, 7.2, 'MARCA', '');
  box(m + W * 0.44, y, W * 0.17, 7.2, 'NUMERAÇÃO', '');
  box(m + W * 0.61, y, W * 0.20, 7.2, 'PESO BRUTO', '');
  box(m + W * 0.81, y, W * 0.19, 7.2, 'PESO LÍQUIDO', '');
  y += 9.8;

  // =========================================================================
  // 7. DADOS DOS PRODUTOS / SERVIÇOS (TABELA COMPLETA DE 14 COLUNAS)
  // =========================================================================
  sectionTitle('DADOS DOS PRODUTOS / SERVIÇOS', y);
  y += 1.2;

  const prodCols = [
    { label: 'CÓDIGO\nPRODUTO', w: 14.5, align: 'center' as const },
    { label: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', w: 69.5, align: 'left' as const },
    { label: 'NCM/SH', w: 13.5, align: 'center' as const },
    { label: 'O/CST', w: 8.5, align: 'center' as const },
    { label: 'CFOP', w: 9, align: 'center' as const },
    { label: 'UN', w: 7, align: 'center' as const },
    { label: 'QUANT', w: 12, align: 'right' as const },
    { label: 'VALOR\nUNIT', w: 14.5, align: 'right' as const },
    { label: 'VALOR\nTOTAL', w: 14.5, align: 'right' as const },
    { label: 'B.CÁLC\nICMS', w: 9.5, align: 'right' as const },
    { label: 'VALOR\nICMS', w: 9, align: 'right' as const },
    { label: 'ALÍQ.\nICMS', w: 6.5, align: 'right' as const },
    { label: 'VALOR\nIPI', w: 6.5, align: 'right' as const },
    { label: 'ALÍQ.\nIPI', w: 6.5, align: 'right' as const },
  ];

  // Cabeçalho da tabela
  const thH = 7.2;
  let px = m;
  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.22);
  prodCols.forEach((col) => {
    doc.rect(px, y, col.w, thH);
    doc.setFont('times', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(25, 25, 25);
    const lblLines = col.label.split('\n');
    const startY = lblLines.length > 1 ? y + 2.8 : y + 4.4;
    lblLines.forEach((line, li) => {
      doc.text(line, px + col.w / 2, startY + li * 2.4, { align: 'center' });
    });
    px += col.w;
  });
  y += thH;

  // Corpo estendido até a seção Dados Adicionais
  const footerBlockTop = pageH - 28;
  const tableBodyH = Math.max(68, footerBlockTop - y - 4);
  px = m;
  // Define fonte ANTES de splitTextToSize para cálculo exato da largura (zero sobreposição em NCM/SH)
  doc.setFont('times', 'normal');
  doc.setFontSize(6.6);
  const wrappedDesc = doc.splitTextToSize(data.productDescription, prodCols[1].w - 2.6);
  const rowVals = [
    data.productCode,
    wrappedDesc,
    data.ncm,
    '041',
    data.cfop,
    'UN',
    data.quantity.toFixed(4).replace('.', ','),
    fmtBRL(data.unitValue),
    fmtBRL(data.totalValue),
    '0,00',
    '0,00',
    '0,00',
    '0,00',
    '0,00',
  ];

  prodCols.forEach((col, i) => {
    doc.rect(px, y, col.w, tableBodyH);
    doc.setFont('times', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(15, 15, 15);
    const val = rowVals[i];
    if (Array.isArray(val)) {
      doc.text(val, px + 1.2, y + 3.6);
    } else {
      const tx = col.align === 'right' ? px + col.w - 1.1 : col.align === 'center' ? px + col.w / 2 : px + 1.1;
      doc.text(val, tx, y + 3.6, { align: col.align });
    }
    px += col.w;
  });

  // Linha tracejada logo abaixo da descrição do item (igual ao modelo clássico)
  const descLinesCount = Array.isArray(rowVals[1]) ? rowVals[1].length : 1;
  const dashY = y + Math.max(12, descLinesCount * 3.1 + 4);
  doc.setLineWidth(0.25);
  doc.setDrawColor(70, 70, 70);
  doc.setLineDashPattern([2, 1.3], 0);
  doc.line(m, dashY, pageW - m, dashY);
  doc.setLineDashPattern([], 0);

  y += tableBodyH + 3.2;

  // =========================================================================
  // 8. DADOS ADICIONAIS (INFORMAÇÕES COMPLEMENTARES + RESERVADO AO FISCO)
  // =========================================================================
  sectionTitle('DADOS ADICIONAIS', y);
  y += 1.2;

  const infoW = W * 0.67;
  const fiscoW = W - infoW;
  const addH = 18;

  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.22);
  doc.roundedRect(m, y, infoW, addH, R, R, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(35, 35, 35);
  doc.text('INFORMAÇÕES COMPLEMENTARES', m + 1.2, y + 2.4);
  doc.setFont('times', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 15, 15);
  const compLines = [
    `Inf. Contribuinte: ${data.additionalInfo?.trim() || 'MOTO ENTREGUE E PAGA.'}`,
    'AMBIENTE DE TESTE — DOCUMENTO SEM VALOR FISCAL (AGUARDANDO INTEGRAÇÃO SEFAZ).',
  ];
  doc.text(doc.splitTextToSize(compLines.join('\n'), infoW - 3), m + 1.4, y + 5.8);

  box(m + infoW, y, fiscoW, addH, 'RESERVADO AO FISCO', '');

  // =========================================================================
  // MARCA D'ÁGUA DIAGONAL GRANDE "TESTE — SEM VALOR FISCAL"
  // =========================================================================
  doc.saveGraphicsState();
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  if ((doc as any).GState) {
    doc.setGState(new (doc as any).GState({ opacity: 0.16 }));
  }
  doc.text('TESTE — SEM VALOR FISCAL', pageW / 2, pageH * 0.56, { align: 'center', angle: 38 });
  doc.restoreGraphicsState();

  // Rodapé
  const nowStr = new Date().toLocaleString('pt-BR');
  doc.setFont('times', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(40, 40, 40);
  doc.text(`Impresso em ${nowStr}`, m, pageH - 4.2);
  doc.text(`Prévia v1.0 • Código Interno: ${data.draftCode} • SEM VALOR FISCAL`, pageW - m, pageH - 4.2, { align: 'right' });

  return doc;
}

export function generateInvoiceDraftPdf(data: InvoiceDraftPayload): void {
  const doc = buildInvoiceDraftPdfDocument(data);
  const safeClient = data.customerName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
  doc.save(`Previa_Eletrica_${data.draftCode}_${safeClient || 'Cliente'}.pdf`);
}
