import type jsPDF from 'jspdf';

/** Dados de quem vai retirar o veículo no lugar do comprador. */
export interface PickupPerson {
  name: string;
  cpf: string;
  rg?: string | null;
  phone?: string | null;
  relationship?: string | null;
}

export function normalizePickup(raw: unknown): PickupPerson | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const name = String(p.name || '').trim();
  const cpf = String(p.cpf || '').trim();
  if (!name || !cpf) return null;
  return {
    name,
    cpf,
    rg: p.rg ? String(p.rg) : null,
    phone: p.phone ? String(p.phone) : null,
    relationship: p.relationship ? String(p.relationship) : null,
  };
}

function fmtDoc(v: string) {
  const c = v.replace(/\D/g, '');
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

/**
 * Página extra: cláusula de retirada por terceiro + assinaturas do comprador
 * (obrigatória, física ou via gov.br) e de quem retira.
 */
export function renderPickupAuthorization(
  doc: jsPDF,
  pickup: PickupPerson,
  buyer: { name: string; cpf: string },
  contractNumber: string,
) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  const m = 16;
  const cw = pw - 2 * m;
  let y = 22;

  doc.setFillColor(23, 23, 26);
  doc.rect(0, 0, pw, 14, 'F');
  doc.setFillColor(237, 28, 36);
  doc.rect(0, 14, pw, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TERMO DE AUTORIZAÇÃO DE RETIRADA POR TERCEIRO', m, 9.3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Anexo ao contrato Nº ${contractNumber}`, pw - m, 9.3, { align: 'right' });

  y = 28;
  const label = (t: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(110, 112, 120);
    doc.text(t.toUpperCase(), x, yy);
  };
  const value = (t: string, x: number, yy: number, w: number) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(23, 23, 26);
    doc.text(doc.splitTextToSize(t || '—', w)[0], x, yy + 4.2);
  };
  const col2 = m + cw / 2;

  // Dados de quem retira
  doc.setFillColor(245, 245, 247);
  doc.roundedRect(m, y - 5, cw, 30, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(23, 23, 26);
  doc.text('DADOS DE QUEM FARÁ A RETIRADA', m + 4, y);
  y += 6;
  label('Nome completo', m + 4, y); value(pickup.name, m + 4, y, cw / 2 - 8);
  label('CPF', col2, y); value(fmtDoc(pickup.cpf), col2, y, cw / 2 - 4);
  y += 10;
  label('RG', m + 4, y); value(pickup.rg || '—', m + 4, y, cw / 4 - 4);
  label('Telefone', m + 4 + cw / 4, y); value(pickup.phone || '—', m + 4 + cw / 4, y, cw / 4 - 4);
  label('Vínculo com o comprador', col2, y); value(pickup.relationship || '—', col2, y, cw / 2 - 4);
  y += 18;

  // Cláusula
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(23, 23, 26);
  doc.text('CLÁUSULA DE RETIRADA', m, y);
  y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(60, 62, 70);
  const paragraphs = [
    `O COMPRADOR ${buyer.name}, inscrito(a) no CPF/CNPJ ${fmtDoc(buyer.cpf)}, em nome de quem o veículo objeto do contrato Nº ${contractNumber} é vendido e será registrado, AUTORIZA expressamente ${pickup.name}, CPF ${fmtDoc(pickup.cpf)}, a retirar o(s) veículo(s) junto ao VENDEDOR.`,
    'A retirada por terceiro não transfere a propriedade nem altera a titularidade do veículo, que permanece em nome do COMPRADOR para todos os fins legais, inclusive perante o DETRAN.',
    'No ato da retirada, o autorizado deverá apresentar documento oficial com foto. A partir da entrega, o COMPRADOR assume integral responsabilidade civil, criminal e administrativa pelo veículo, isentando o VENDEDOR de qualquer ocorrência posterior.',
    'A assinatura do COMPRADOR neste termo é OBRIGATÓRIA e pode ser feita de forma física ou eletrônica pelo Assinador gov.br (ITI), com validade jurídica nos termos da Lei nº 14.063/2020. Sem essa assinatura o veículo não será entregue.',
  ];
  paragraphs.forEach((p, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${p}`, cw);
    doc.text(lines, m, y);
    y += lines.length * 3.8 + 2.4;
  });

  // Assinaturas
  y = Math.max(y + 26, 190);
  const lw = 70;
  const c1 = m + cw / 4;
  const c2 = m + (3 * cw) / 4;
  doc.setDrawColor(222, 224, 228); doc.setLineWidth(0.5);
  doc.line(c1 - lw / 2, y, c1 + lw / 2, y);
  doc.line(c2 - lw / 2, y, c2 + lw / 2, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(237, 28, 36);
  doc.text('COMPRADOR — ASSINATURA OBRIGATÓRIA', c1, y + 4.5, { align: 'center' });
  doc.setTextColor(110, 112, 120);
  doc.text('AUTORIZADO A RETIRAR', c2, y + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(23, 23, 26);
  doc.text(doc.splitTextToSize(buyer.name, lw + 10)[0], c1, y + 9, { align: 'center' });
  doc.text(`CPF/CNPJ ${fmtDoc(buyer.cpf)}`, c1, y + 13, { align: 'center' });
  doc.text(doc.splitTextToSize(pickup.name, lw + 10)[0], c2, y + 9, { align: 'center' });
  doc.text(`CPF ${fmtDoc(pickup.cpf)}`, c2, y + 13, { align: 'center' });
  doc.setFontSize(7); doc.setTextColor(110, 112, 120);
  doc.text('( ) Assinatura física   ( ) Assinatura gov.br', c1, y + 18, { align: 'center' });

  y += 32;
  doc.setFontSize(8); doc.setTextColor(60, 62, 70);
  doc.text('Data da retirada: ____/____/________     Documento apresentado: ______________________', m, y);
}
