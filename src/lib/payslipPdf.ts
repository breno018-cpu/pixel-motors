import jsPDF from 'jspdf';
import type { Payslip } from '@/hooks/usePayslips';
import { calcFGTS } from './payrollTax';
import { isContractor } from './payrollRoles';

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);
}

function maskDoc(c?: string | null) {
  if (!c) return '—';
  const d = c.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return c;
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const BORDER: [number, number, number] = [60, 60, 60];
const HEAD_BG: [number, number, number] = [240, 244, 247];
const ACCENT: [number, number, number] = [38, 42, 48];
const ACCENT_SOFT: [number, number, number] = [225, 228, 232];
const TEXT_DARK: [number, number, number] = [25, 32, 40];
const TEXT_SOFT: [number, number, number] = [110, 120, 130];

interface PayslipExtras {
  store_cnpj?: string | null;
  pix_key?: string | null;
  bank_info?: string | null;
  payment_status?: string | null;
}

interface Line {
  desc: string;
  ref: string;
  venc: number;
  desc2: number;
}

function earningAdditions(p: Payslip) {
  return (Array.isArray(p.additions) ? p.additions : []).filter((a) => a && !a.is_discount);
}
function discountAdditions(p: Payslip) {
  return (Array.isArray(p.additions) ? p.additions : []).filter((a) => a && a.is_discount);
}

export function payslipTotals(p: Payslip) {
  const breakdown = (p as any).breakdown;
  if (breakdown?.folha_v2 && breakdown?.resultado) {
    const res = breakdown.resultado;
    const earnings = Number(res.totalProventos || 0);
    const discounts = Number(res.totalDescontos || 0);
    return {
      earnings,
      discounts,
      net: res.salarioLiquido !== undefined ? Number(res.salarioLiquido) : earnings - discounts,
    };
  }
  const addEarn = earningAdditions(p).reduce((s, a) => s + Number(a.amount || 0), 0);
  const addDisc = discountAdditions(p).reduce((s, a) => s + Number(a.amount || 0), 0);
  const earnings =
    Number(p.base_salary || 0) +
    Number(p.commission_amount || 0) +
    Number(p.manager_commission || 0) +
    Number(p.bonus || 0) +
    Number(p.overtime || 0) +
    Number(p.transport_allowance || 0) +
    Number(p.meal_allowance || 0) +
    Number(p.other_allowance || 0) +
    addEarn;
  const discounts =
    Number(p.inss_discount || 0) +
    Number(p.irrf_discount || 0) +
    Number(p.other_discounts || 0) +
    addDisc;
  return { earnings, discounts, net: earnings - discounts };
}

/* ────────────────────────── layout base ────────────────────────── */

function drawDocument(
  doc: jsPDF,
  p: Payslip,
  extras: PayslipExtras,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    title: string;
    viaLabel: string;
    personLabel: string;
    docLabel: string;
    items: Line[];
    footerNote: string;
    signatureLabel: string;
    infoLine?: string;
  },
) {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);

  // Cabeçalho
  const headerH = 15;
  doc.setFillColor(...ACCENT);
  doc.rect(x, y, w, headerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text((p.store?.name || '—').toUpperCase(), x + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(215, 218, 222);
  doc.text(`CNPJ: ${maskDoc(extras.store_cnpj)}`, x + 4, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.title, x + w - 4, y + 6, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(215, 218, 222);
  const ref = `${MONTHS[p.reference_month - 1]} / ${p.reference_year}`;
  doc.text(`${ref}   •   ${opts.viaLabel}`, x + w - 4, y + 11, { align: 'right' });

  let cy = y + headerH;

  // Identificação
  const idH = 12;
  doc.setFillColor(248, 250, 252);
  doc.rect(x, cy, w, idH, 'F');
  doc.setDrawColor(220, 225, 230);
  doc.line(x, cy + idH, x + w, cy + idH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_SOFT);
  doc.text(opts.personLabel, x + 3, cy + 4);
  doc.text(opts.docLabel, x + w * 0.55, cy + 4);
  doc.text('FUNÇÃO', x + w * 0.78, cy + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text((p.employee?.full_name || '—').toUpperCase(), x + 3, cy + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(maskDoc(p.employee?.cpf), x + w * 0.55, cy + 9);
  doc.text((p.employee?.position || '—').toUpperCase(), x + w * 0.78, cy + 9);
  cy += idH;

  // Cabeçalho da tabela
  const tHeadH = 6;
  doc.setFillColor(...ACCENT_SOFT);
  doc.rect(x, cy, w, tHeadH, 'F');
  doc.line(x, cy + tHeadH, x + w, cy + tHeadH);

  const colDescX = x + 2;
  const colRefX = x + w * 0.55;
  const sepX1 = x + w * 0.7;
  const sepX2 = x + w * 0.85;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...ACCENT);
  doc.text('DESCRIÇÃO', colDescX, cy + 4);
  doc.text('REFERÊNCIA', colRefX, cy + 4);
  doc.text('VENCIMENTOS', sepX1 + (sepX2 - sepX1) / 2, cy + 4, { align: 'center' });
  doc.text('DESCONTOS', (sepX2 + (x + w)) / 2, cy + 4, { align: 'center' });
  cy += tHeadH;

  // Linhas
  const rowH = 5;
  const reserved = opts.infoLine ? 28 : 23;
  const tableBottomY = y + h - reserved;
  const maxRows = Math.max(1, Math.floor((tableBottomY - cy) / rowH));
  const visible = opts.items.slice(0, maxRows);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);
  let rowY = cy;
  for (const [idx, it] of visible.entries()) {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(x + 0.3, rowY + 0.2, w - 0.6, rowH - 0.4, 'F');
    }
    const descTrunc = String(doc.splitTextToSize(String(it.desc || ''), colRefX - colDescX - 4)[0] || '');
    const refTrunc = String(doc.splitTextToSize(String(it.ref || '—'), sepX1 - colRefX - 2)[0] || '—');
    doc.text(descTrunc, colDescX, rowY + 3.5);
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_SOFT);
    doc.text(refTrunc, colRefX, rowY + 3.5);
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    if (it.venc > 0) doc.text(fmt(it.venc), sepX2 - 1, rowY + 3.5, { align: 'right' });
    if (it.desc2 > 0) doc.text(fmt(it.desc2), x + w - 2, rowY + 3.5, { align: 'right' });
    rowY += rowH;
  }

  doc.setDrawColor(225, 230, 235);
  doc.line(sepX1, cy, sepX1, tableBottomY);
  doc.line(sepX2, cy, sepX2, tableBottomY);
  doc.line(colRefX - 2, cy, colRefX - 2, tableBottomY);

  // Totais
  const totVenc = opts.items.reduce((s, i) => s + i.venc, 0);
  const totDesc = opts.items.reduce((s, i) => s + i.desc2, 0);

  const totY = tableBottomY;
  doc.setDrawColor(...BORDER);
  doc.setFillColor(...HEAD_BG);
  doc.rect(x, totY, w, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_SOFT);
  doc.text('TOTAL BRUTO', sepX1 + 2, totY + 3);
  doc.text('TOTAL DESCONTOS', sepX2 + 2, totY + 3);

  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text(fmt(totVenc), sepX2 - 1, totY + 5.8, { align: 'right' });
  doc.setTextColor(180, 50, 50);
  doc.text(fmt(totDesc), x + w - 2, totY + 5.8, { align: 'right' });

  // Líquido
  const liqY = totY + 7;
  doc.setFillColor(...ACCENT);
  doc.rect(x, liqY, w, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR LÍQUIDO A RECEBER', x + 3, liqY + 5.5);
  doc.setFontSize(13);
  doc.text(`R$ ${fmt(totVenc - totDesc)}`, x + w - 3, liqY + 6, { align: 'right' });

  let footY = liqY + 9;
  if (opts.infoLine) {
    doc.setFillColor(248, 250, 252);
    doc.rect(x, footY, w, 5.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_SOFT);
    doc.text(opts.infoLine, x + 3, footY + 3.5);
    footY += 5.5;
  }

  // Rodapé / assinatura
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_SOFT);
  doc.text(opts.footerNote, x + 3, footY + 3);
  doc.setDrawColor(140, 150, 160);
  doc.line(x + w - 65, footY + 5, x + w - 3, footY + 5);
  doc.setFontSize(7);
  doc.text(opts.signatureLabel, x + w - 34, footY + 7.8, { align: 'center' });
}

/* ────────────────────────── linhas por tipo ────────────────────────── */

function cltLines(p: Payslip): Line[] {
  const breakdown = (p as any).breakdown;
  if (breakdown?.folha_v2 && breakdown?.resultado) {
    const res = breakdown.resultado;
    const items: Line[] = [];
    for (const prov of res.proventos || []) {
      items.push({
        desc: prov.rubrica,
        ref: prov.referencia || '—',
        venc: Number(prov.valor || 0),
        desc2: 0,
      });
    }
    for (const d of res.descontos || []) {
      items.push({
        desc: d.rubrica,
        ref: d.aliquota ? `${d.aliquota}%` : d.aliquotaEfetiva ? `${d.aliquotaEfetiva}%` : '—',
        venc: 0,
        desc2: Number(d.valor || 0),
      });
    }
    return items;
  }

  const items: Line[] = [];
  const push = (desc: string, venc: number, ref = '—') => {
    if (Number(venc) > 0) items.push({ desc, ref, venc: Number(venc), desc2: 0 });
  };
  const pushDisc = (desc: string, val: number, ref = '—') => {
    if (Number(val) > 0) items.push({ desc, ref, venc: 0, desc2: Number(val) });
  };

  push('Salário base', p.base_salary, '30 dias');
  push(
    'Comissão sobre vendas',
    p.commission_amount,
    p.commission_sales_total ? `Vendas ${fmt(p.commission_sales_total)}` : '—',
  );
  push('Comissão de gerência', p.manager_commission);
  push('Bonificação', p.bonus);
  push('Horas extras', p.overtime);
  push('Vale transporte', p.transport_allowance);
  push('Vale refeição / alimentação', p.meal_allowance);
  push('Outras ajudas de custo', p.other_allowance);
  for (const a of earningAdditions(p)) push(a.name || 'Adição', a.amount);

  pushDisc('INSS', p.inss_discount);
  pushDisc('IRRF', p.irrf_discount);
  pushDisc('Outros descontos', p.other_discounts);
  for (const a of discountAdditions(p)) pushDisc(a.name || 'Desconto', a.amount);
  return items;
}

function contractorLines(p: Payslip): Line[] {
  const breakdown = (p as any).breakdown;
  if (breakdown?.folha_v2 && breakdown?.resultado) {
    return cltLines(p);
  }

  const items: Line[] = [];
  const push = (desc: string, venc: number, ref = '—') => {
    if (Number(venc) > 0) items.push({ desc, ref, venc: Number(venc), desc2: 0 });
  };
  const pushDisc = (desc: string, val: number, ref = '—') => {
    if (Number(val) > 0) items.push({ desc, ref, venc: 0, desc2: Number(val) });
  };

  push('Serviço prestado', p.base_salary, 'Serviços do mês');
  push(
    'Comissão por venda',
    p.commission_amount,
    p.commission_sales_total ? `Vendas ${fmt(p.commission_sales_total)}` : '—',
  );
  push('Serviços adicionais / bonificação', p.bonus);
  push('Outros valores', Number(p.other_allowance || 0) + Number(p.overtime || 0));
  for (const a of earningAdditions(p)) push(a.name || 'Serviço', a.amount);

  pushDisc('Descontos / valores adiantados', p.other_discounts);
  for (const a of discountAdditions(p)) pushDisc(a.name || 'Desconto', a.amount);
  return items;
}

/* ────────────────────────── export ────────────────────────── */

export function downloadPayslipPDF(p: Payslip, extras: PayslipExtras = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const innerW = W - 2 * M;
  const innerH = H - 2 * M;

  const breakdown = (p as any).breakdown;
  const contractor =
    isContractor(p.employee) || breakdown?.resultado?.tipoContrato === 'TERCEIRIZADO';

  if (contractor) {
    const items = contractorLines(p);
    const opts = {
      title: 'RECIBO DE PRESTAÇÃO DE SERVIÇOS',
      personLabel: 'PRESTADOR',
      docLabel: 'CPF / CNPJ',
      items,
      infoLine:
        'Prestação de serviços autônoma — não gera vínculo empregatício (art. 3º da CLT). Sem incidência de FGTS, INSS ou IRRF por parte da empresa.',
      footerNote:
        'Declaro ter recebido a importância líquida acima, referente aos serviços prestados no período.',
      signatureLabel: 'Assinatura do prestador',
    };
    drawDocument(doc, p, extras, M, M, innerW, innerH, { ...opts, viaLabel: 'DOCUMENTO OFICIAL' });
    doc.save(`recibo_servicos_${p.payslip_number || 'pagamento'}.pdf`);
    return;
  }

  const fgtsBase =
    breakdown?.folha_v2 && breakdown?.resultado?.baseFGTS !== undefined
      ? Number(breakdown.resultado.baseFGTS || 0)
      : Number(p.base_salary || 0) +
        Number(p.commission_amount || 0) +
        Number(p.manager_commission || 0) +
        Number(p.bonus || 0) +
        Number(p.overtime || 0);
  const fgtsValor =
    breakdown?.folha_v2 && breakdown?.resultado?.fgts !== undefined
      ? Number(breakdown.resultado.fgts || 0)
      : calcFGTS(fgtsBase);
  const pixInfo = extras.pix_key
    ? `  •  PIX: ${extras.pix_key}`
    : extras.bank_info
      ? `  •  Banco: ${extras.bank_info}`
      : '';
  const items = cltLines(p);
  const opts = {
    title: 'RECIBO DE PAGAMENTO DE SALÁRIO',
    personLabel: 'EMPREGADO',
    docLabel: 'CPF',
    items,
    infoLine: `FGTS (8% s/ ${fmt(fgtsBase)}): R$ ${fmt(
      fgtsValor,
    )}  •  Base: R$ ${fmt(p.base_salary)}${pixInfo}`,
    footerNote:
      'Declaro ter recebido a importância líquida discriminada neste recibo, dando plena e geral quitação.',
    signatureLabel: 'Assinatura do Empregado',
  };
  drawDocument(doc, p, extras, M, M, innerW, innerH, { ...opts, viaLabel: 'DOCUMENTO OFICIAL' });
  doc.save(`contracheque_${p.payslip_number || 'salario'}.pdf`);
}
