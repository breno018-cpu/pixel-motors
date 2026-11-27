import { jsPDF } from 'jspdf';

export interface CounterReceiptTemplate {
  id: string;
  name: string;
  subtitle: string;
  body: string;
  updatedAt: string;
}

export interface CounterReceiptData {
  receiptNumber: string; // Ex: REC-2026-0001 (controle interno)
  issueDate: string; // DD/MM/YYYY
  // Loja / Emitente
  storeName: string;
  storeCnpj: string;
  storeAddress: string;
  storeCityUf: string;
  storePhone: string;
  // Cliente
  customerName: string;
  customerDocument: string;
  customerAddress: string;
  customerNeighborhood: string;
  customerCep: string;
  customerCity: string;
  customerUf: string;
  customerPhone: string;
  // Produto / Veículo
  productDescription: string;
  productColor: string;
  productSerial: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  paymentMethod: string;
  notes: string;
  // Modelo utilizado
  templateName: string;
  renderedBody: string;
}

export const COUNTER_RECEIPT_VARIABLES: Array<{ token: string; label: string }> = [
  { token: '{{numero_recibo}}', label: 'Nº Recibo' },
  { token: '{{data_emissao}}', label: 'Data Emissão' },
  { token: '{{loja_nome}}', label: 'Nome da Loja' },
  { token: '{{loja_cnpj}}', label: 'CNPJ da Loja' },
  { token: '{{loja_endereco}}', label: 'Endereço da Loja' },
  { token: '{{cliente_nome}}', label: 'Nome do Cliente' },
  { token: '{{cliente_documento}}', label: 'CPF / CNPJ' },
  { token: '{{cliente_endereco}}', label: 'Endereço Cliente' },
  { token: '{{cliente_cidade_uf}}', label: 'Cidade/UF Cliente' },
  { token: '{{cliente_telefone}}', label: 'Telefone Cliente' },
  { token: '{{produto_descricao}}', label: 'Descrição Produto' },
  { token: '{{produto_cor}}', label: 'Cor' },
  { token: '{{produto_motor_chassi}}', label: 'Nº Motor / Chassi' },
  { token: '{{quantidade}}', label: 'Quantidade' },
  { token: '{{valor_unitario}}', label: 'Valor Unitário' },
  { token: '{{valor_total}}', label: 'Valor Total' },
  { token: '{{forma_pagamento}}', label: 'Forma de Pagamento' },
  { token: '{{observacoes}}', label: 'Observações' },
];

export const DEFAULT_COUNTER_TEMPLATES: CounterReceiptTemplate[] = [
  {
    id: 'tpl-eletrica-padrao',
    name: 'Recibo de Balcão — Moto Elétrica',
    subtitle: 'Comprovante interno de venda e entrega de bicicleta/moto elétrica',
    updatedAt: new Date().toISOString(),
    body: `Pelo presente COMPROVANTE INTERNO DE VENDA DE BALCÃO nº {{numero_recibo}}, emitido em {{data_emissao}}, a empresa {{loja_nome}}, inscrita no CNPJ {{loja_cnpj}}, sediada em {{loja_endereco}}, declara ter recebido de {{cliente_nome}}, inscrito(a) no CPF/CNPJ {{cliente_documento}}, residente em {{cliente_endereco}} — {{cliente_cidade_uf}}, a importância total de R$ {{valor_total}} ({{forma_pagamento}}), referente à aquisição do bem abaixo descrito:

ITEM: {{produto_descricao}}
COR: {{produto_cor}} | Nº MOTOR / CHASSI: {{produto_motor_chassi}} | QTD: {{quantidade}}

CONDIÇÕES DE ENTREGA E GARANTIA:
1. O comprador declara ter conferido o veículo, carregador, bateria e acessórios no ato da retirada/entrega, recebendo-os em perfeito estado de funcionamento.
2. Observações adicionais: {{observacoes}}
3. Este documento tem finalidade exclusivamente administrativa e de comprovação interna de pagamento e entrega, não substituindo Nota Fiscal Eletrônica (NF-e).`,
  },
  {
    id: 'tpl-balcao-geral',
    name: 'Recibo de Balcão — Venda Geral',
    subtitle: 'Modelo administrativo editável para vendas de balcão e acessórios',
    updatedAt: new Date().toISOString(),
    body: `Recebemos de {{cliente_nome}} (CPF/CNPJ {{cliente_documento}}), telefone {{cliente_telefone}}, residente em {{cliente_endereco}} — {{cliente_cidade_uf}}, a quantia de R$ {{valor_total}} via {{forma_pagamento}}, referente a:

{{produto_descricao}} (Qtd: {{quantidade}} • Valor Unitário: R$ {{valor_unitario}}).
Identificação / Série: {{produto_motor_chassi}} | Cor: {{produto_cor}}.

Observações: {{observacoes}}

Emitido por {{loja_nome}} (CNPJ {{loja_cnpj}}) em {{data_emissao}}. Documento de controle interno de balcão (sem valor fiscal).`,
  },
];

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function resolveCounterReceiptBody(
  templateBody: string,
  data: Omit<CounterReceiptData, 'renderedBody'>
): string {
  const fullCustomerAddress = [data.customerAddress, data.customerNeighborhood, data.customerCep ? `CEP ${data.customerCep}` : '']
    .filter(Boolean)
    .join(' - ');
  const cityUf = [data.customerCity, data.customerUf].filter(Boolean).join('/');

  const map: Record<string, string> = {
    '{{numero_recibo}}': data.receiptNumber,
    '{{data_emissao}}': data.issueDate,
    '{{loja_nome}}': data.storeName,
    '{{loja_cnpj}}': data.storeCnpj,
    '{{loja_endereco}}': `${data.storeAddress} - ${data.storeCityUf}`,
    '{{cliente_nome}}': data.customerName || '—',
    '{{cliente_documento}}': data.customerDocument || '—',
    '{{cliente_endereco}}': fullCustomerAddress || '—',
    '{{cliente_cidade_uf}}': cityUf || '—',
    '{{cliente_telefone}}': data.customerPhone || '—',
    '{{produto_descricao}}': data.productDescription || '—',
    '{{produto_cor}}': data.productColor || '—',
    '{{produto_motor_chassi}}': data.productSerial || '—',
    '{{quantidade}}': String(data.quantity || 1),
    '{{valor_unitario}}': formatBRL(data.unitValue || 0),
    '{{valor_total}}': formatBRL(data.totalValue || 0),
    '{{forma_pagamento}}': data.paymentMethod || '—',
    '{{observacoes}}': data.notes?.trim() || 'Sem observações adicionais.',
  };

  let out = templateBody;
  for (const [token, val] of Object.entries(map)) {
    out = out.split(token).join(val);
  }
  return out;
}

export function generateCounterReceiptPdf(data: CounterReceiptData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14;
  const W = pageW - m * 2;
  let y = 14;

  // Cabeçalho
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(m, y, W, 24, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RECIBO / COMPROVANTE DE BALCÃO', m + 5, y + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(data.storeName, m + 5, y + 14.5);
  doc.setFontSize(7.5);
  doc.setTextColor(212, 212, 216);
  doc.text(`CNPJ: ${data.storeCnpj}  •  ${data.storeAddress} — ${data.storeCityUf}`, m + 5, y + 19.5);

  // Badge número do recibo
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - m - 48, y + 4, 44, 16, 1.5, 1.5, 'F');
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PROTOCOLO INTERNO', pageW - m - 26, y + 9, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(data.receiptNumber, pageW - m - 26, y + 14.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Emissão: ${data.issueDate}`, pageW - m - 26, y + 18.5, { align: 'center' });

  y += 28;

  // Aviso claro não fiscal
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, W, 7, 1.2, 1.2, 'FD');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(
    'COMPROVANTE ADMINISTRATIVO DE BALCÃO — SEM VALOR FISCAL (NÃO SUBSTITUI NF-e)',
    pageW / 2,
    y + 4.6,
    { align: 'center' }
  );
  y += 11;

  // Bloco Cliente
  doc.setDrawColor(212, 212, 216);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(m, y, W, 28, 1.5, 1.5, 'FD');
  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DADOS DO CLIENTE', m + 4, y + 5.5);

  doc.setTextColor(24, 24, 27);
  doc.setFontSize(9);
  doc.text(`Nome: ${data.customerName || '—'}`, m + 4, y + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`CPF / CNPJ: ${data.customerDocument || '—'}`, m + 4, y + 17);
  doc.text(`Telefone: ${data.customerPhone || '—'}`, m + 95, y + 17);
  const fullAddr = [data.customerAddress, data.customerNeighborhood, data.customerCity, data.customerUf, data.customerCep]
    .filter(Boolean)
    .join(' - ');
  doc.text(`Endereço: ${fullAddr || '—'}`, m + 4, y + 22.5, { maxWidth: W - 8 });
  y += 33;

  // Bloco Item / Pagamento
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(m, y, W, 30, 1.5, 1.5, 'FD');
  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ITEM E CONDIÇÕES DE PAGAMENTO', m + 4, y + 5.5);

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(data.productDescription || '—', m + 4, y + 11.5, { maxWidth: W - 8 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Cor: ${data.productColor || '—'}`, m + 4, y + 17.5);
  doc.text(`Nº Motor / Chassi: ${data.productSerial || '—'}`, m + 65, y + 17.5);
  doc.text(`Qtd: ${data.quantity}`, m + 150, y + 17.5);

  doc.text(`Pagamento: ${data.paymentMethod || '—'}`, m + 4, y + 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`TOTAL: R$ ${formatBRL(data.totalValue)}`, pageW - m - 4, y + 24, { align: 'right' });
  y += 36;

  // Corpo do Modelo Editável
  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`DECLARAÇÃO E TERMOS (${data.templateName.toUpperCase()})`, m, y);
  y += 5;

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const bodyLines = doc.splitTextToSize(data.renderedBody, W);
  const maxBodyY = pageH - 52;
  for (const line of bodyLines) {
    if (y > maxBodyY) break;
    doc.text(line, m, y);
    y += 4.8;
  }

  // Assinaturas
  const sigY = pageH - 34;
  doc.setDrawColor(63, 63, 70);
  doc.setLineWidth(0.35);
  doc.line(m + 4, sigY, m + 78, sigY);
  doc.line(pageW - m - 78, sigY, pageW - m - 4, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(24, 24, 27);
  doc.text(data.storeName, m + 41, sigY + 4.5, { align: 'center', maxWidth: 74 });
  doc.text(data.customerName || 'Cliente / Comprador', pageW - m - 41, sigY + 4.5, { align: 'center', maxWidth: 74 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text(`CNPJ: ${data.storeCnpj}`, m + 41, sigY + 9, { align: 'center' });
  doc.text(`CPF/CNPJ: ${data.customerDocument || '—'}`, pageW - m - 41, sigY + 9, { align: 'center' });

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `Impresso em ${new Date().toLocaleString('pt-BR')} • Controle Interno ${data.receiptNumber} • Documento Administrativo Sem Valor Fiscal`,
    pageW / 2,
    pageH - 10,
    { align: 'center' }
  );

  const safeClient = (data.customerName || 'Cliente').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 28);
  doc.save(`Recibo_Balcao_${data.receiptNumber}_${safeClient}.pdf`);
}
