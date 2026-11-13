import jsPDF from 'jspdf';
import type { Invoice } from '@/hooks/useInvoices';

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(v) || 0,
  );
}

function maskDoc(c?: string | null) {
  if (!c) return '—';
  const d = c.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return c;
}

export function downloadInvoicePDF(inv: Invoice) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const m = 18;
  let y = m;

  // Header
  doc.setFillColor(20, 80, 80);
  doc.rect(0, 0, w, 22, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('NOTA FISCAL', m, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.invoice_type === 'servico' ? 'PRESTAÇÃO DE SERVIÇOS' : 'VENDA DE PRODUTOS', m, 19);
  doc.text(`Nº ${inv.invoice_number}`, w - m, 14, { align: 'right' });
  doc.text(
    `Emissão: ${new Date(inv.issue_date).toLocaleDateString('pt-BR')}`,
    w - m,
    19,
    { align: 'right' },
  );

  doc.setTextColor(0);
  y = 30;

  // Emitente (Concessionária)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EMITENTE (CONCESSIONÁRIA)', m, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  const storeName = inv.store?.name || 'Concessionária Divinópolis';
  const storeCnpj = inv.store?.cnpj ? `CNPJ: ${inv.store.cnpj}` : 'CNPJ: 18.456.789/0001-01';
  const storeAddr = inv.store?.address ? `${inv.store.address} - ${inv.store.city || ''}/${inv.store.state || ''}` : '';
  doc.text(`${storeName}  |  ${storeCnpj}`, m, y);
  y += 4;
  if (storeAddr) {
    doc.text(storeAddr, m, y);
    y += 4;
  }
  y += 3;

  // Tomador / Cliente
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', m, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${inv.customer_name}`, m, y);
  doc.text(`CPF/CNPJ: ${maskDoc(inv.customer_document)}`, w / 2, y);
  y += 4;
  if (inv.customer_address) {
    doc.text(`Endereço: ${inv.customer_address}`, m, y);
    y += 4;
  }
  if (inv.customer_email || inv.customer_phone) {
    doc.text(`E-mail: ${inv.customer_email || '—'}`, m, y);
    doc.text(`Telefone: ${inv.customer_phone || '—'}`, w / 2, y);
    y += 4;
  }
  y += 4;

  // Itens
  doc.setFillColor(240, 240, 240);
  doc.rect(m, y, w - 2 * m, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DESCRIÇÃO', m + 2, y + 4);
  doc.text('QTD', w - m - 70, y + 4, { align: 'right' });
  doc.text('VALOR UNIT.', w - m - 35, y + 4, { align: 'right' });
  doc.text('TOTAL', w - m - 2, y + 4, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  for (const it of inv.items || []) {
    const total = Number(it.quantity || 0) * Number(it.unit_value || 0);
    const lines = doc.splitTextToSize(it.description || '—', w - 2 * m - 80);
    doc.text(lines, m + 2, y + 4);
    doc.text(String(it.quantity || 0), w - m - 70, y + 4, { align: 'right' });
    doc.text(fmt(it.unit_value), w - m - 35, y + 4, { align: 'right' });
    doc.text(fmt(total), w - m - 2, y + 4, { align: 'right' });
    y += Math.max(5, lines.length * 4) + 1;
    doc.setDrawColor(220);
    doc.line(m, y, w - m, y);
  }

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Subtotal: ${fmt(inv.subtotal)}`, w - m, y, { align: 'right' });
  y += 5;
  if (inv.tax_rate) {
    doc.text(`Imposto (${inv.tax_rate}%): ${fmt(inv.tax_value)}`, w - m, y, { align: 'right' });
    y += 5;
  }

  // Total
  doc.setFillColor(20, 80, 80);
  doc.setTextColor(255);
  doc.rect(w - m - 80, y, 80, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VALOR TOTAL', w - m - 76, y + 6.5);
  doc.text(fmt(inv.total), w - m - 4, y + 6.5, { align: 'right' });
  doc.setTextColor(0);
  y += 16;

  if (inv.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(80);
    const lines = doc.splitTextToSize(inv.notes, w - 2 * m);
    doc.text(lines, m, y);
    doc.setTextColor(0);
  }

  doc.setFontSize(7);
  doc.setTextColor(140);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')}`,
    w / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' },
  );

  doc.save(`nota_fiscal_${inv.invoice_number}.pdf`);
}