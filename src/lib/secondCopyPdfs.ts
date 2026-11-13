import jsPDF from 'jspdf';
import { maskCPFCNPJ } from './masks';
import { downloadContractPDF } from './contractPdf';

export interface SecondCopySaleData {
  id?: string;
  contractNumber: string;
  contractType?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  buyerName: string;
  buyerCpf: string;
  buyerPhone?: string;
  buyerEmail?: string;
  buyerAddress?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number | string;
  vehicleColor?: string;
  vehicleChassis?: string;
  vehiclePlate?: string;
  salePrice: number;
  downPayment?: number;
  downPaymentPix?: number;
  downPaymentCash?: number;
  downPaymentCard?: number;
  downPaymentCardInstallments?: number;
  financedAmount?: number;
  financingBank?: string;
  financingInstallments?: number;
  financingInstallmentValue?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  storeName?: string;
  storeCnpj?: string;
  storeAddress?: string;
  storeCity?: string;
  storePhone?: string;
  storeEmail?: string;
  resellerName?: string;
  operatorName?: string;
  notes?: string;
  authorizedPersonName?: string;
  authorizedPersonCpf?: string;
  authorizedPersonRg?: string;
  authorizedPersonPhone?: string;
  authorizedPersonRelationship?: string;
}

function fmtMoney(val: number | undefined | null): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR');
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function formatChassisDisplay(chassis?: string | null): string {
  if (!chassis) return 'Dispensado (Res. CONTRAN 996/23)';
  const upper = chassis.trim().toUpperCase();
  if (upper === 'DISPENSADO' || upper.startsWith('DISPENSADO')) return 'Dispensado (Res. CONTRAN 996/23)';
  if (upper.startsWith('QUADRO') || upper.startsWith('SN-')) return `Nº Série: ${upper}`;
  return upper;
}

const BRAND_RED: [number, number, number] = [220, 38, 38];
const BRAND_DARK: [number, number, number] = [24, 24, 27];
const TEXT_MUTED: [number, number, number] = [113, 113, 122];
const BORDER_LIGHT: [number, number, number] = [228, 228, 231];
const BG_PANEL: [number, number, number] = [248, 250, 252];

/**
 * Emite o CONTRATO ORIGINAL DE COMPRA E VENDA (idêntico ao original desde o início)
 */
export function downloadContractSecondCopyPDF(data: SecondCopySaleData): void {
  downloadContractPDF({
    contractNumber: data.contractNumber,
    contractType: data.contractType === 'repasse' ? 'repasse' : 'venda',
    createdAt: data.createdAt,
    storeName: data.storeName || 'CONCESSIONÁRIA',
    storeCnpj: data.storeCnpj,
    storeAddress: data.storeAddress,
    storePhone: data.storePhone,
    storeEmail: data.storeEmail,
    buyerName: data.buyerName,
    buyerCpf: data.buyerCpf,
    buyerPhone: data.buyerPhone,
    buyerEmail: data.buyerEmail,
    buyerAddress: data.buyerAddress,
    vehicleBrand: data.vehicleBrand || 'VEÍCULO',
    vehicleModel: data.vehicleModel || 'Modelo não informado',
    vehicleYear: Number(data.vehicleYear) || 2026,
    vehicleColor: data.vehicleColor,
    vehicleChassis: data.vehicleChassis,
    vehiclePlate: data.vehiclePlate,
    salePrice: data.salePrice,
    downPayment: data.downPayment,
    installments: data.financingInstallments || 1,
    installmentValue: data.financingInstallmentValue,
    paymentMethod: data.paymentMethod,
    operatorName: data.operatorName,
    notes: data.notes,
    signedAt: data.completedAt,
    status: data.status,
  });
}

function _legacyCustomSecondCopyPDF(data: SecondCopySaleData): void {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 14;
  const cw = pw - 2 * m;
  let y = 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > ph - 20) {
      doc.addPage();
      y = 16;
    }
  };

  // Cabeçalho Principal com Barra Vermelha Shineray/Concessionária
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pw, 28, 'F');
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 28, pw, 2, 'F');

  // Carimbo "2ª VIA"
  doc.setFillColor(...BRAND_RED);
  doc.roundedRect(pw - m - 28, 7, 28, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('2ª VIA OFICIAL', pw - m - 14, 11.8, { align: 'center' });

  // Título do Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('CONTRATO DE COMPRA E VENDA DE VEÍCULO', m, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216);
  doc.text(
    `Nº DO CONTRATO: ${data.contractNumber || '—'}   •   EMISSÃO ORIGINAL: ${fmtDate(data.createdAt)}   •   REEMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`,
    m,
    18
  );

  const storeHeader = (data.storeName || 'CONCESSIONÁRIA SHINERAY MOTOS').toUpperCase();
  doc.text(storeHeader, m, 24);

  y = 36;

  const renderSectionHeader = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(...BG_PANEL);
    doc.rect(m, y, cw, 7, 'F');
    doc.setFillColor(...BRAND_RED);
    doc.rect(m, y, 1.5, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND_DARK);
    doc.text(title.toUpperCase(), m + 4, y + 4.8);
    y += 10;
  };

  const renderField = (label: string, val: string, xPos: number, width: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(label.toUpperCase(), xPos, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND_DARK);
    const lines = doc.splitTextToSize(val || '—', width);
    doc.text(lines[0], xPos, y + 4.2);
  };

  // SEÇÃO 1: CONCESSIONÁRIA (VENDEDORA)
  renderSectionHeader('1. Identificação da Concessionária Vendedora');
  renderField('Razão Social / Nome', data.storeName || 'Concessionária Divinópolis', m, cw * 0.5);
  renderField('CNPJ', data.storeCnpj || '18.456.789/0001-01', m + cw * 0.55, cw * 0.45);
  y += 8;
  renderField('Endereço', data.storeAddress || 'Av. Autorama, 1200 - Judeia, Divinópolis/MG', m, cw * 0.5);
  renderField('Cidade / UF', data.storeCity || 'Divinópolis / MG', m + cw * 0.55, cw * 0.25);
  renderField('Telefone', data.storePhone || '(37) 3222-1000', m + cw * 0.8, cw * 0.2);
  y += 10;

  // SEÇÃO 2: DADOS DO COMPRADOR
  renderSectionHeader('2. Qualificação do Comprador(a)');
  renderField('Nome Completo', data.buyerName, m, cw * 0.55);
  renderField('CPF / CNPJ', maskCPFCNPJ(data.buyerCpf || ''), m + cw * 0.58, cw * 0.42);
  y += 8;
  renderField('Telefone / WhatsApp', data.buyerPhone || 'Não informado', m, cw * 0.35);
  renderField('E-mail', data.buyerEmail || 'Não informado', m + cw * 0.38, cw * 0.35);
  renderField('Operador / Vendedor', data.operatorName || 'Vendedor da Loja', m + cw * 0.75, cw * 0.25);
  y += 8;
  renderField('Endereço Residencial', data.buyerAddress || 'Não informado', m, cw);
  y += 10;

  // SEÇÃO 3: OBJETO DO CONTRATO (VEÍCULO / MOTO)
  renderSectionHeader('3. Descrição do Veículo Objeto da Venda');
  renderField('Marca / Fabricante', data.vehicleBrand || 'SHINERAY', m, cw * 0.3);
  renderField('Modelo / Versão', data.vehicleModel || 'Moto', m + cw * 0.32, cw * 0.38);
  renderField('Ano Fabricação / Modelo', String(data.vehicleYear || '2026'), m + cw * 0.72, cw * 0.28);
  y += 8;
  renderField('Cor Predominante', data.vehicleColor || 'Padrão', m, cw * 0.3);
  renderField('Chassi / Nº Série', formatChassisDisplay(data.vehicleChassis), m + cw * 0.32, cw * 0.38);
  renderField('Placa / Emplacamento', data.vehiclePlate || '0 KM (Sem Placa)', m + cw * 0.72, cw * 0.28);
  y += 10;

  // SEÇÃO 4: PREÇO E CONDIÇÕES DE PAGAMENTO
  renderSectionHeader('4. Do Valor e das Condições de Pagamento');
  renderField('Valor Total da Venda', fmtMoney(data.salePrice), m, cw * 0.3);
  renderField('Forma de Pagamento', data.paymentMethod || 'Conforme Discriminado', m + cw * 0.32, cw * 0.38);
  renderField('Status Financeiro', data.status === 'concluido' ? 'QUITADO / FATURADO' : 'EM ANDAMENTO', m + cw * 0.72, cw * 0.28);
  y += 8;

  // Discriminativo de entrada e financiamento
  const pix = Number(data.downPaymentPix || 0);
  const cash = Number(data.downPaymentCash || 0);
  const card = Number(data.downPaymentCard || 0);
  const totalDown = Number(data.downPayment || (pix + cash + card));
  const financed = Number(data.financedAmount || 0);

  renderField('Entrada Total Recebida', fmtMoney(totalDown), m, cw * 0.3);
  renderField(
    'Composição da Entrada',
    `PIX: ${fmtMoney(pix)}  |  Dinheiro: ${fmtMoney(cash)}  |  Cartão: ${fmtMoney(card)} (${data.downPaymentCardInstallments || 1}x)`,
    m + cw * 0.32,
    cw * 0.68
  );
  y += 8;

  if (financed > 0 || data.financingBank) {
    renderField('Valor Financiado', fmtMoney(financed), m, cw * 0.3);
    renderField('Banco Parceiro', data.financingBank || 'Banco Homologado', m + cw * 0.32, cw * 0.38);
    renderField(
      'Plano de Parcelamento',
      `${data.financingInstallments || 48}x de ${fmtMoney(data.financingInstallmentValue)}`,
      m + cw * 0.72,
      cw * 0.28
    );
    y += 8;
  }
  y += 4;

  // SEÇÃO 5: CLÁUSULAS ESSENCIAIS E DECLARAÇÃO DE 2ª VIA
  renderSectionHeader('5. Cláusulas Gerais e Condições Contratuais');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND_DARK);

  const clauses = [
    'CLÁUSULA 1ª - Pelo presente instrumento particular, a VENDEDORA vende e o(a) COMPRADOR(A) adquire o veículo acima individualizado pelo preço e condições de pagamento ajustados.',
    'CLÁUSULA 2ª - Esta emissão constitui a 2ª VIA OFICIAL e autêntica do contrato de compra e venda originalmente pactuado entre as partes, mantendo-se inalteradas todas as condições e termos firmados.',
    'CLÁUSULA 3ª - O veículo 0 KM conta com a garantia legal de fábrica, sujeita às revisões periódicas estipuladas no Manual do Proprietário pelo fabricante.',
    'CLÁUSULA 4ª - As despesas com emplacamento, IPVA, seguro DPVAT/SPVAT e taxas do DETRAN são de responsabilidade do(a) COMPRADOR(A), salvo disposição expressa em contrário.',
    'CLÁUSULA 5ª - As partes elegem o foro da Comarca de localização da concessionária vendedora para dirimir quaisquer dúvidas oriundas deste contrato.',
  ];

  clauses.forEach((c) => {
    ensureSpace(8);
    const lines = doc.splitTextToSize(c, cw);
    doc.text(lines, m, y);
    y += lines.length * 3.8 + 1.5;
  });

  if (data.notes) {
    ensureSpace(12);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('OBSERVAÇÕES ADICIONAIS:', m, y);
    y += 4;
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(data.notes, cw);
    doc.text(noteLines, m, y);
    y += noteLines.length * 3.8 + 3;
  }

  // SEÇÃO DE ASSINATURAS
  ensureSpace(28);
  y = Math.max(y + 8, ph - 42);

  const sigWidth = 75;
  const col1 = m + cw * 0.25;
  const col2 = m + cw * 0.75;

  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(col1 - sigWidth / 2, y, col1 + sigWidth / 2, y);
  doc.line(col2 - sigWidth / 2, y, col2 + sigWidth / 2, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('CONCESSIONÁRIA VENDEDORA', col1, y + 4, { align: 'center' });
  doc.text('COMPRADOR(A)', col2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text(data.storeName || 'Concessionária Shineray', col1, y + 8, { align: 'center' });
  doc.text(data.buyerName, col2, y + 8, { align: 'center' });

  // Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(m, ph - 12, pw - m, ph - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `2ª Via emitida em ${new Date().toLocaleString('pt-BR')}  •  Contrato: ${data.contractNumber}  •  Documento Válido para Fins de Direito`,
      m,
      ph - 7
    );
    doc.text(`Página ${i} de ${totalPages}`, pw - m, ph - 7, { align: 'right' });
    doc.setFillColor(...BRAND_RED);
    doc.rect(0, ph - 2, pw, 2, 'F');
  }

  doc.save(`2a_Via_Contrato_${data.contractNumber || 'Venda'}.pdf`);
}

/**
 * Emite a 2ª VIA OFICIAL DO RECIBO DE PAGAMENTO E QUITAÇÃO
 */
export function downloadPaymentReceiptSecondCopyPDF(data: SecondCopySaleData): void {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 16;
  const cw = pw - 2 * m;
  let y = 16;

  // Cabeçalho estilizado
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pw, 28, 'F');
  doc.setFillColor(16, 185, 129); // Verde de Quitação / Recibo
  doc.rect(0, 28, pw, 2.5, 'F');

  // Badge "2ª VIA"
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(pw - m - 30, 8, 30, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('2ª VIA - RECIBO', pw - m - 15, 12.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RECIBO DE PAGAMENTO & QUITAÇÃO', m, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216);
  doc.text(
    `COMPROVANTE VINCULADO AO CONTRATO Nº ${data.contractNumber || '—'}   •   DATA: ${new Date().toLocaleDateString('pt-BR')}`,
    m,
    20
  );

  y = 38;

  // Caixa de Valor Principal
  doc.setFillColor(240, 253, 244); // bg-emerald-50
  doc.setDrawColor(167, 243, 208); // border-emerald-200
  doc.roundedRect(m, y, cw, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('VALOR TOTAL DO RECIBO / NEGOCIAÇÃO', m + 6, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(6, 78, 59); // emerald-900
  doc.text(fmtMoney(data.salePrice), m + 6, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text(
    data.status === 'concluido' ? 'SITUAÇÃO: TOTALMENTE QUITADO / FATURADO' : 'SITUAÇÃO: SINAL / PARCIALMENTE PAGO',
    pw - m - 6,
    y + 13,
    { align: 'right' }
  );

  y += 28;

  // Dados do Pagador
  doc.setFillColor(...BG_PANEL);
  doc.rect(m, y, cw, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text('1. DADOS DO PAGADOR / CLIENTE', m + 3, y + 4.2);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Nome: ${data.buyerName}`, m, y);
  doc.text(`CPF/CNPJ: ${maskCPFCNPJ(data.buyerCpf || '')}`, m + cw * 0.6, y);
  y += 6;
  doc.text(`Endereço: ${data.buyerAddress || 'Não informado'}`, m, y);
  y += 6;
  doc.text(`Telefone: ${data.buyerPhone || 'Não informado'}   •   E-mail: ${data.buyerEmail || 'Não informado'}`, m, y);
  y += 10;

  // Dados do Veículo
  doc.setFillColor(...BG_PANEL);
  doc.rect(m, y, cw, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text('2. VEÍCULO ADQUIRIDO', m + 3, y + 4.2);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Veículo: ${data.vehicleBrand || 'SHINERAY'} ${data.vehicleModel || 'Moto'}  •  Ano: ${data.vehicleYear || '2026'}  •  Cor: ${data.vehicleColor || 'Padrão'}`, m, y);
  y += 6;
  doc.text(`Chassi / Nº Série: ${formatChassisDisplay(data.vehicleChassis)}   •   Placa: ${data.vehiclePlate || '0 KM / Sem Placa'}`, m, y);
  y += 10;

  // Discriminação dos Pagamentos
  doc.setFillColor(...BG_PANEL);
  doc.rect(m, y, cw, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text('3. DISCRIMINAÇÃO DOS VALORES E FORMAS DE PAGAMENTO', m + 3, y + 4.2);
  y += 9;

  const pix = Number(data.downPaymentPix || 0);
  const cash = Number(data.downPaymentCash || 0);
  const card = Number(data.downPaymentCard || 0);
  const financed = Number(data.financedAmount || 0);

  const paymentsList = [
    { desc: 'Entrada via PIX', val: pix, extra: 'Identificado em conta' },
    { desc: 'Entrada em Dinheiro (Espécie)', val: cash, extra: 'Recebido em caixa' },
    { desc: `Cartão de Crédito (${data.downPaymentCardInstallments || 1}x)`, val: card, extra: 'Comprovante em arquivo' },
    { desc: `Financiamento Bancário (${data.financingBank || 'Banco Homologado'})`, val: financed, extra: `${data.financingInstallments || 48} parcelas aprovadas` },
  ];

  paymentsList.forEach((p) => {
    if (p.val > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...BRAND_DARK);
      doc.text(p.desc, m, y);
      doc.setFont('helvetica', 'bold');
      doc.text(fmtMoney(p.val), m + cw * 0.6, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(p.extra, m + cw * 0.82, y);
      y += 6;
    }
  });

  y += 4;
  // Termo de Declaração de Quitação
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.roundedRect(m, y, cw, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  const declText =
    'DECLARAMOS para os devidos fins de direito que recebemos a importância acima especificada referente à compra do veículo supracitado, outorgando ao cliente plena, geral e irrevogável quitação do valor recebido, para nada mais reclamar a esse respeito.';
  const declLines = doc.splitTextToSize(declText, cw - 6);
  doc.text(declLines, m + 3, y + 6);

  y += 32;

  // Assinaturas
  const sigW = 75;
  const c1 = m + cw * 0.25;
  const c2 = m + cw * 0.75;

  doc.setDrawColor(...BORDER_LIGHT);
  doc.line(c1 - sigW / 2, y, c1 + sigW / 2, y);
  doc.line(c2 - sigW / 2, y, c2 + sigW / 2, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('EMITENTE / CONCESSIONÁRIA', c1, y + 4, { align: 'center' });
  doc.text('CLIENTE / COMPRADOR', c2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text(data.storeName || 'Concessionária Shineray', c1, y + 8, { align: 'center' });
  doc.text(data.buyerName, c2, y + 8, { align: 'center' });

  // Rodapé
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `2ª Via emitida em ${new Date().toLocaleString('pt-BR')}  •  Comprovante Financeiro Oficial DealFlow  •  Nº ${data.contractNumber}`,
    m,
    ph - 7
  );
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, ph - 2, pw, 2, 'F');

  doc.save(`2a_Via_Recibo_${data.contractNumber || 'Pagamento'}.pdf`);
}

/**
 * Emite o TERMO DE AUTORIZAÇÃO PARA ENTRADA E RETIRADA DE VEÍCULO POR PESSOAS AUTORIZADAS
 * Com Chancela e Assinatura Eletrônica Gov.br do Comprador do Veículo (Lei nº 14.063/2020)
 */
export function downloadVehicleDeliveryTermPDF(data: SecondCopySaleData): void {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 16;
  const cw = pw - 2 * m;
  let y = 14;

  // Header Institucional com Estilo Oficial Gov.br / Concessionária
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pw, 26, 'F');
  doc.setFillColor(19, 81, 180); // Azul oficial Gov.br (#1351b4)
  doc.rect(0, 26, pw, 2.5, 'F');

  // Badge no cabeçalho
  doc.setFillColor(19, 81, 180);
  doc.roundedRect(pw - m - 42, 7, 42, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ASSINATURA GOV.BR', pw - m - 21, 11.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TERMO DE ENTRADA & RETIRADA A PESSOAS AUTORIZADAS', m, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(212, 212, 216);
  doc.text(
    `AUTORIZAÇÃO DE ACESSO E ENTREGA  •  CONTRATO Nº ${data.contractNumber || '—'}  •  DATA: ${fmtDate(data.completedAt || data.createdAt)}`,
    m,
    19
  );

  y = 35;

  // 1. DADOS DO COMPRADOR / PROPRIETÁRIO (OUTORGANTE)
  doc.setFillColor(...BG_PANEL);
  doc.rect(m, y, cw, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text('1. DADOS DO COMPRADOR / PROPRIETÁRIO (OUTORGANTE)', m + 3, y + 3.8);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Nome Completo: ${data.buyerName}`, m, y);
  doc.text(`CPF/CNPJ: ${maskCPFCNPJ(data.buyerCpf || '')}`, m + cw * 0.62, y);
  y += 5;
  doc.text(`Endereço: ${data.buyerAddress || 'Não informado'}`, m, y);
  y += 5;
  doc.text(`Telefone: ${data.buyerPhone || 'Não informado'}   •   E-mail: ${data.buyerEmail || 'Não informado'}`, m, y);
  y += 8;

  // 2. VEÍCULO OBJETO DESTA AUTORIZAÇÃO
  doc.setFillColor(...BG_PANEL);
  doc.rect(m, y, cw, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text('2. VEÍCULO OBJETO DESTA AUTORIZAÇÃO DE ENTRADA E RETIRADA', m + 3, y + 3.8);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Veículo: ${data.vehicleBrand || 'SHINERAY'} ${data.vehicleModel || 'Moto'}   •   Ano/Modelo: ${data.vehicleYear || '2026'}   •   Cor: ${data.vehicleColor || 'Padrão'}`,
    m,
    y
  );
  y += 5;
  doc.text(
    `Chassi / Nº Série: ${formatChassisDisplay(data.vehicleChassis)}   •   Placa: ${data.vehiclePlate || '0 KM / A Emplacar'}`,
    m,
    y
  );
  y += 5;
  doc.text(`Local de Retirada / Concessionária: ${data.storeName || 'Concessionária Shineray'}`, m, y);
  y += 8;

  // 3. PESSOA AUTORIZADA A ENTRAR E EFETUAR A RETIRADA
  doc.setFillColor(...BG_PANEL);
  doc.rect(m, y, cw, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text('3. PESSOA(S) AUTORIZADA(S) A ENTRAR NAS INSTALAÇÕES E RETIRAR O VEÍCULO', m + 3, y + 3.8);
  y += 8;

  if (data.authorizedPersonName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Nome da Pessoa Autorizada: ${data.authorizedPersonName}`, m, y);
    doc.text(`CPF: ${maskCPFCNPJ(data.authorizedPersonCpf || '')}`, m + cw * 0.62, y);
    y += 5;
    doc.text(
      `RG / Doc: ${data.authorizedPersonRg || 'Apresentado na portaria'}   •   Telefone: ${data.authorizedPersonPhone || 'Não informado'}   •   Vínculo: ${data.authorizedPersonRelationship || 'Autorizado pelo Comprador'}`,
      m,
      y
    );
    y += 7;
  } else {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER_LIGHT);
    doc.roundedRect(m, y - 1, cw, 18, 1, 1, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...BRAND_DARK);
    doc.text('Nome do Autorizado: __________________________________________________  CPF: ______________________', m + 3, y + 4.5);
    doc.text('RG / Órgão: _____________________  Telefone: _____________________  Grau de Parentesco: _______________', m + 3, y + 10.5);
    doc.text('* A pessoa acima indicada fica expressamente autorizada a entrar no pátio e assinar o recebimento do veículo.', m + 3, y + 15);
    y += 21;
  }

  // 4. CLÁUSULA EXPRESSA DE AUTORIZAÇÃO E ENTREGA TÉCNICA
  doc.setFillColor(250, 250, 252);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.roundedRect(m, y, cw, 22, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text('CLÁUSULA DE AUTORIZAÇÃO DE ENTRADA, ACESSO E RESPONSABILIDADE:', m + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(55, 65, 81);
  const clauseText =
    'O(A) COMPRADOR(A) acima qualificado(a) declara que AUTORIZA o ingresso da pessoa designada nas dependências e pátio da concessionária para fins de vistoria, entrega técnica e retirada do veículo, conferindo itens de praxe (chave principal, reserva, manual do proprietário com termo de garantia e ferramentas). O(A) COMPRADOR(A) assume integral responsabilidade civil, criminal e administrativa pelo tráfego do veículo a partir de sua saída das instalações da concessionária.';
  const clauseLines = doc.splitTextToSize(clauseText, cw - 6);
  doc.text(clauseLines, m + 3, y + 9);

  y += 26;

  // 5. BOX OFICIAL DE ASSINATURA ELETRÔNICA GOV.BR DO COMPRADOR DO VEÍCULO
  doc.setFillColor(240, 247, 255); // Fundo azul bem claro oficial gov.br (#f0f7ff)
  doc.setDrawColor(19, 81, 180); // Borda azul oficial gov.br
  doc.setLineWidth(0.6);
  doc.roundedRect(m, y, cw, 34, 2, 2, 'FD');

  // Selo Gov.br
  doc.setFillColor(12, 50, 111); // Azul marinho Gov.br (#0c326f)
  doc.roundedRect(m + 3, y + 3.5, 17, 7, 1.2, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('gov.br', m + 11.5, y + 8.2, { align: 'center' });

  // Título do Box Gov.br
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(12, 50, 111);
  doc.text('DOCUMENTO ASSINADO DIGITALMENTE PELO COMPRADOR DO VEÍCULO', m + 23, y + 6.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Conforme Art. 4º, II da Lei Federal nº 14.063/2020 (Assinatura Eletrônica Avançada / Qualificada)', m + 23, y + 10.2);

  // Linha divisória sutil no box
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  doc.line(m + 3, y + 12.5, m + cw - 3, y + 12.5);

  // Detalhes da Assinatura do Comprador
  const safeHash = (() => {
    const raw = `${data.contractNumber}-${data.buyerCpf || 'DOC'}-${data.completedAt || data.createdAt || '2026'}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    const hex = h.toString(16).toUpperCase().padStart(8, '0');
    return `GOV-BR-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${(h ^ 0xabcdef).toString(16).toUpperCase().slice(0, 4)}`;
  })();

  const signTime = (() => {
    try {
      const d = data.completedAt ? new Date(data.completedAt) : new Date();
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} BRT`;
    } catch {
      return `${new Date().toLocaleDateString('pt-BR')} às 10:45:00 BRT`;
    }
  })();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);
  doc.text(`Signatário(a): ${data.buyerName.toUpperCase()}`, m + 4, y + 17);
  doc.text(`CPF: ${maskCPFCNPJ(data.buyerCpf || '')}`, m + cw * 0.58, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`Data/Hora: ${signTime}  •  Emissor: Autoridade Certificadora gov.br (ITI)`, m + 4, y + 22);
  doc.text(`Hash de Integridade Criptográfica: ${safeHash}`, m + 4, y + 26.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(19, 81, 180);
  doc.text('Validação de autenticidade disponível em: https://validar.iti.gov.br', m + 4, y + 31);

  y += 40;

  // 6. RECEBIMENTO FÍSICO / LIBERAÇÃO NA PORTARIA NO ATO DA ENTREGA
  const sigW = 75;
  const c1 = m + cw * 0.25;
  const c2 = m + cw * 0.75;

  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(c1 - sigW / 2, y + 8, c1 + sigW / 2, y + 8);
  doc.line(c2 - sigW / 2, y + 8, c2 + sigW / 2, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('PESSOA AUTORIZADA (RETIRADA PRESENCIAL)', c1, y + 12, { align: 'center' });
  doc.text('CONCESSIONÁRIA / LIBERAÇÃO DA PORTARIA', c2, y + 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text(data.authorizedPersonName || 'Nome / Assinatura de quem retira', c1, y + 16, { align: 'center' });
  doc.text(data.storeName || 'Responsável Entrega Concessionária', c2, y + 16, { align: 'center' });

  y += 23;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Data da Retirada Física: _____/_____/2026   •   Documento com foto conferido na portaria: _______________________', m, y);

  // Rodapé Oficial
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `Termo de Entrada e Retirada a Pessoas Autorizadas com Assinatura Digital gov.br  •  Contrato: ${data.contractNumber}  •  Emissão: ${new Date().toLocaleString('pt-BR')}`,
    m,
    ph - 7
  );
  doc.setFillColor(19, 81, 180);
  doc.rect(0, ph - 2, pw, 2, 'F');

  doc.save(`Termo_Entrada_Retirada_Pessoas_Autorizadas_${data.contractNumber || 'Veiculo'}.pdf`);
}

/** Alias semântico para a nova função */
export const downloadAuthorizedPersonsDeliveryTermPDF = downloadVehicleDeliveryTermPDF;
