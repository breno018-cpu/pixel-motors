import jsPDF from 'jspdf';

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
  return `PRV-${yr}-${rnd}`;
}

/**
 * Gera um PDF A4 estruturado de "Espelho / Prévia de Faturamento (SEM VALOR FISCAL)"
 * para validação do fluxo de emissão antes da integração com a API oficial da SEFAZ.
 */
export function generateInvoiceDraftPdf(data: InvoiceDraftPayload): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentW = pageW - margin * 2;
  let y = 10;

  const drawBox = (x: number, top: number, w: number, h: number, label?: string, value?: string, opts?: {
    boldValue?: boolean;
    alignValue?: 'left' | 'right' | 'center';
    valueSize?: number;
  }) => {
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.25);
    doc.rect(x, top, w, h);
    if (label) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(70, 70, 70);
      doc.text(label.toUpperCase(), x + 1.5, top + 3);
    }
    if (value !== undefined && value !== '') {
      doc.setFont('helvetica', opts?.boldValue ? 'bold' : 'normal');
      doc.setFontSize(opts?.valueSize ?? 8);
      doc.setTextColor(15, 15, 15);
      const align = opts?.alignValue || 'left';
      const tx = align === 'right' ? x + w - 1.5 : align === 'center' ? x + w / 2 : x + 1.5;
      doc.text(value, tx, top + h - 2, { align, maxWidth: w - 3 });
    }
  };

  // Faixa superior de aviso de homologação / sem valor fiscal
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentW, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text(
    'ESPELHO / PRÉVIA DE FATURAMENTO — SEM VALOR FISCAL (AMBIENTE DE TESTE)',
    pageW / 2,
    y + 5.2,
    { align: 'center' }
  );
  y += 10;

  // 1. Canhoto de recebimento
  const canhotoW = contentW - 36;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, canhotoW, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(25, 25, 25);
  const canhotoText = `RECEBEMOS DE ${data.issuerName} OS PRODUTOS CONSTANTES NESTE ESPELHO DE PEDIDO. EMISSÃO: ${data.issueDate} | VALOR TOTAL: R$ ${fmtBRL(data.totalValue)} | CLIENTE: ${data.customerName} - ${data.customerAddress}, ${data.customerNeighborhood}, ${data.customerCity}-${data.customerUf}`;
  doc.text(doc.splitTextToSize(canhotoText, canhotoW - 3), margin + 1.5, y + 3.5);

  drawBox(margin, y + 10, 38, 9, 'Data de Recebimento');
  drawBox(margin + 38, y + 10, canhotoW - 38, 9, 'Identificação e Assinatura do Recebedor');

  doc.rect(margin + canhotoW, y, 36, 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 15, 15);
  doc.text('PRÉVIA', margin + canhotoW + 18, y + 6, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text(data.draftCode, margin + canhotoW + 18, y + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('SEM VALOR FISCAL', margin + canhotoW + 18, y + 16.5, { align: 'center' });

  y += 21;
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 2;

  // 2. Cabeçalho Emitente + Quadro Central + Código Interno
  const emitW = 78;
  const midW = 38;
  const rightW = contentW - emitW - midW;

  doc.rect(margin, y, emitW, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(70, 70, 70);
  doc.text('IDENTIFICAÇÃO DO EMITENTE', margin + 1.5, y + 3.5);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 15, 15);
  doc.text(doc.splitTextToSize(data.issuerName, emitW - 4), margin + emitW / 2, y + 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(data.issuerAddress, margin + emitW / 2, y + 18, { align: 'center', maxWidth: emitW - 4 });
  doc.text(`${data.issuerCityUf} - CEP ${data.issuerCep}`, margin + emitW / 2, y + 22, { align: 'center', maxWidth: emitW - 4 });
  if (data.issuerPhone) {
    doc.text(`Fone: ${data.issuerPhone}`, margin + emitW / 2, y + 26, { align: 'center' });
  }

  doc.rect(margin + emitW, y, midW, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ESPELHO', margin + emitW + midW / 2, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Documento de Conferência', margin + emitW + midW / 2, y + 11.5, { align: 'center' });
  doc.text('Sem Valor Fiscal', margin + emitW + midW / 2, y + 15, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('1 - SAÍDA', margin + emitW + midW / 2, y + 20.5, { align: 'center' });
  doc.setFontSize(7);
  doc.text('Folha 1/1', margin + emitW + midW / 2, y + 25.5, { align: 'center' });

  doc.rect(margin + emitW + midW, y, rightW, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(70, 70, 70);
  doc.text('CÓDIGO INTERNO DO DOCUMENTO (TESTE)', margin + emitW + midW + 1.5, y + 4);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 15);
  doc.text(data.draftCode, margin + emitW + midW + rightW / 2, y + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  doc.text(
    doc.splitTextToSize(
      'Prévia interna gerada para validação dos dados. Não substitui a NF-e autorizada pela SEFAZ.',
      rightW - 4
    ),
    margin + emitW + midW + rightW / 2,
    y + 19,
    { align: 'center' }
  );
  y += 28;

  // Natureza da operação + Status
  drawBox(margin, y, emitW + midW, 9, 'Natureza da Operação', data.operationNature, { boldValue: true });
  drawBox(margin + emitW + midW, y, rightW, 9, 'Status Fiscal', 'PRÉVIA / AGUARDANDO EMISSÃO NF-E', { boldValue: true, valueSize: 7 });
  y += 9;

  // IE + CNPJ Emitente
  drawBox(margin, y, contentW * 0.34, 9, 'Inscrição Estadual', data.issuerIe, { boldValue: true });
  drawBox(margin + contentW * 0.34, y, contentW * 0.33, 9, 'Inscrição Estadual do Subst. Trib.', '');
  drawBox(margin + contentW * 0.67, y, contentW * 0.33, 9, 'CNPJ do Emitente', data.issuerCnpj, { boldValue: true });
  y += 11;

  // 3. Destinatário / Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 30, 30);
  doc.text('DESTINATÁRIO / CLIENTE', margin, y);
  y += 1.5;

  drawBox(margin, y, contentW * 0.60, 9, 'Nome / Razão Social', data.customerName, { boldValue: true });
  drawBox(margin + contentW * 0.60, y, contentW * 0.24, 9, 'CNPJ / CPF', data.customerDocument, { boldValue: true });
  drawBox(margin + contentW * 0.84, y, contentW * 0.16, 9, 'Data da Emissão', data.issueDate, { boldValue: true, alignValue: 'center' });
  y += 9;

  drawBox(margin, y, contentW * 0.46, 9, 'Endereço', data.customerAddress);
  drawBox(margin + contentW * 0.46, y, contentW * 0.24, 9, 'Bairro / Distrito', data.customerNeighborhood);
  drawBox(margin + contentW * 0.70, y, contentW * 0.14, 9, 'CEP', data.customerCep, { alignValue: 'center' });
  drawBox(margin + contentW * 0.84, y, contentW * 0.16, 9, 'Data da Saída', data.issueDate, { alignValue: 'center' });
  y += 9;

  drawBox(margin, y, contentW * 0.46, 9, 'Município', data.customerCity, { boldValue: true });
  drawBox(margin + contentW * 0.46, y, contentW * 0.08, 9, 'UF', data.customerUf, { boldValue: true, alignValue: 'center' });
  drawBox(margin + contentW * 0.54, y, contentW * 0.30, 9, 'Fone / Fax', data.customerPhone || '');
  drawBox(margin + contentW * 0.84, y, contentW * 0.16, 9, 'Inscrição Estadual', '');
  y += 11;

  // 4. Fatura / Pagamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('FATURA / PAGAMENTO', margin, y);
  y += 1.5;
  drawBox(margin, y, contentW, 8.5, undefined, `${data.paymentDescription} — R$ ${fmtBRL(data.totalValue)}`, { boldValue: true });
  y += 10.5;

  // 5. Resumo de Valores
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('RESUMO DE VALORES', margin, y);
  y += 1.5;
  const col6 = contentW / 6;
  drawBox(margin, y, col6, 9, 'Base Cálc. ICMS', '0,00', { alignValue: 'right' });
  drawBox(margin + col6, y, col6, 9, 'Valor ICMS', '0,00', { alignValue: 'right' });
  drawBox(margin + col6 * 2, y, col6, 9, 'Valor Frete', '0,00', { alignValue: 'right' });
  drawBox(margin + col6 * 3, y, col6, 9, 'Desconto', '0,00', { alignValue: 'right' });
  drawBox(margin + col6 * 4, y, col6, 9, 'Valor Produtos', fmtBRL(data.totalValue), { boldValue: true, alignValue: 'right' });
  drawBox(margin + col6 * 5, y, col6, 9, 'Valor Total', fmtBRL(data.totalValue), { boldValue: true, alignValue: 'right' });
  y += 11;

  // 6. Dados dos Produtos / Serviços
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('DADOS DOS PRODUTOS / SERVIÇOS', margin, y);
  y += 1.5;

  const cols = [
    { label: 'CÓD.', w: 14, align: 'center' as const },
    { label: 'DESCRIÇÃO DO PRODUTO / VEÍCULO', w: 100, align: 'left' as const },
    { label: 'NCM/SH', w: 18, align: 'center' as const },
    { label: 'CFOP', w: 12, align: 'center' as const },
    { label: 'UN', w: 10, align: 'center' as const },
    { label: 'QTD', w: 12, align: 'right' as const },
    { label: 'V. UNIT', w: 12, align: 'right' as const },
    { label: 'V. TOTAL', w: 12, align: 'right' as const },
  ];
  // Ajusta larguras para somar exatamente contentW (190mm)
  cols[1].w = contentW - (14 + 18 + 12 + 10 + 12 + 20 + 20);
  cols[6].w = 20;
  cols[7].w = 20;

  let cx = margin;
  cols.forEach((col) => {
    doc.rect(cx, y, col.w, 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(col.label, cx + col.w / 2, y + 4.2, { align: 'center' });
    cx += col.w;
  });
  y += 6.5;

  const prodLines = doc.splitTextToSize(data.productDescription, cols[1].w - 3);
  const rowH = Math.max(58, prodLines.length * 4 + 8);
  cx = margin;
  const rowVals = [
    data.productCode,
    prodLines,
    data.ncm,
    data.cfop,
    'UN',
    data.quantity.toFixed(4).replace('.', ','),
    fmtBRL(data.unitValue),
    fmtBRL(data.totalValue),
  ];

  cols.forEach((col, i) => {
    doc.rect(cx, y, col.w, rowH);
    doc.setFont('helvetica', i === 1 ? 'normal' : 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 15, 15);
    const val = rowVals[i];
    if (Array.isArray(val)) {
      doc.text(val, cx + 1.5, y + 4.5);
    } else {
      const tx = col.align === 'right' ? cx + col.w - 1.5 : col.align === 'center' ? cx + col.w / 2 : cx + 1.5;
      doc.text(val, tx, y + 4.5, { align: col.align });
    }
    cx += col.w;
  });
  y += rowH + 3;

  // 7. Dados Adicionais
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES', margin, y);
  y += 1.5;
  doc.rect(margin, y, contentW, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const infoText = [
    data.additionalInfo?.trim() || 'MOTO ENTREGUE E PAGA.',
    'AVISO: Este documento é um espelho/prévia gerado em ambiente de teste e NÃO possui validade fiscal perante a SEFAZ.',
  ].join('\n');
  doc.text(doc.splitTextToSize(infoText, contentW - 4), margin + 2, y + 5);

  // Marca d'água diagonal "SEM VALOR FISCAL" para impossibilitar confusão com NF-e oficial
  doc.saveGraphicsState();
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  if ((doc as any).GState) {
    doc.setGState(new (doc as any).GState({ opacity: 0.14 }));
  }
  doc.text('SEM VALOR FISCAL', pageW / 2, 165, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();

  // Rodapé
  const nowStr = new Date().toLocaleString('pt-BR');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em ${nowStr} • Código Interno: ${data.draftCode} • Modo Teste / Prévia`, margin, 289);

  const safeClient = data.customerName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 30);
  doc.save(`Previa_Pedido_${data.draftCode}_${safeClient || 'Cliente'}.pdf`);
}
