import _jsPDF from 'jspdf';
const jsPDF: any = (_jsPDF as any).jsPDF || _jsPDF;
import { renderPickupAuthorization, type PickupPerson } from './pickupAuthorization';
import { DEFAULT_CONTRACT_WATERMARK } from '@/assets/contractWatermark';
import { isElectricVehicle } from '@/lib/vehicleCatalog';

export interface OptionalClauseRenderable {
  id: string;
  label: string;
  body_bbcode: string;
  enabled_by_default: boolean;
  vehicle_types: Array<'carro' | 'moto'>;
  category?: string;
  variables?: Array<{ key: string; label: string; type: 'text' | 'number' | 'currency' | 'date'; required?: boolean; default?: string }>;
  condition?: {
    field: 'payment_method' | 'vehicle_type' | 'has_plate' | 'has_financing';
    op: 'eq' | 'neq' | 'in';
    value: string | string[] | boolean;
  } | null;
}

interface TemplatePreviewData {
  header: string;
  body: string;
  clauses: string;
  signature: string;
  fixedClauses: string[];
  optionalClauses?: OptionalClauseRenderable[];
  activeClauseIds?: string[];
  clauseVariables?: Record<string, Record<string, string>>;
}

export interface ContractGenerationData {
  template: {
    header_content: string | null;
    body_content: string;
    clauses_content: string | null;
    signature_content: string | null;
    fixed_clauses: string[];
    optional_clauses?: OptionalClauseRenderable[];
    logo_data_url?: string | null;
    watermark_data_url?: string | null;
    signature_data_url?: string | null;
    watermark_opacity?: number | null;
    accent_color?: [number, number, number] | string | null;
  };
  activeClauseIds?: string[];
  clauseVariables?: Record<string, Record<string, string>>;
  /** Retirada por terceiro (anexa termo + assinaturas). */
  pickup?: PickupPerson | null;
  acceptance?: {
    accepted_at: string;
    accepted_ip?: string | null;
    buyer_name_typed?: string | null;
  } | null;
  client: {
    name: string;
    cpf: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  vehicle: {
    brand: string;
    model: string;
    year: number;
    color?: string;
    chassis?: string;
    plate?: string;
    renavam?: string;
    warranty_months?: number | null;
    revision_period_months?: number | null;
    revision_period_km?: number | null;
  };
  /** Lista completa de veículos do contrato (uma venda pode ter várias motos). */
  vehicles?: Array<{
    brand: string;
    model: string;
    year?: number | null;
    color?: string | null;
    chassis?: string | null;
    plate?: string | null;
    renavam?: string | null;
    price?: number | null;
  }>;
  store: {
    name: string;
    cnpj?: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
  };
  reseller?: {
    name?: string;
    cpf?: string;
    email?: string;
    phone?: string;
    commission?: number;
  };
  payment: {
    total: number;
    downPayment?: number;
    method?: string;
    installments?: number;
    installmentValue?: number;
  };
  contractNumber: string;
  contractDate: string;
}

// Sample data for preview
const SAMPLE_DATA = {
  client: {
    name: 'João da Silva',
    cpf: '123.456.789-00',
    address: 'Rua das Flores, 123 - Centro',
    phone: '(11) 99999-9999',
    email: 'joao@email.com',
  },
  vehicle: {
    brand: 'Honda',
    model: 'Civic EXL',
    year: 2023,
    color: 'Preto',
    chassis: '9BWZZZ377VT004251',
    plate: 'ABC-1234',
    renavam: '00123456789',
    warranty_months: 3,
    revision_period_months: 6,
    revision_period_km: 1000,
  },
  store: {
    name: 'Auto Revenda Premium',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Principal, 1000 - Centro',
    city: 'São Paulo/SP',
    phone: '(11) 3333-3333',
    email: 'contato@autorevenda.com.br',
  },
  reseller: {
    name: 'Carlos Revendedor',
    cpf: '987.654.321-00',
    email: 'carlos@email.com',
    phone: '(11) 88888-8888',
    commission: 5,
  },
  payment: {
    total: 150000,
    downPayment: 30000,
    method: 'Financiamento',
    installments: 48,
    installmentValue: 2500,
  },
  contractNumber: 'PREV-001',
  contractDate: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCPF(val: string): string {
  if (!val) return '';
  const cleaned = val.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return val;
}

function replaceVariables(text: string, data: ContractGenerationData): string {
  const client = data.client || ({} as any);
  const vehicle = data.vehicle || ({} as any);
  const store = data.store || ({} as any);
  const payment = data.payment || ({} as any);

  const replacements: Record<string, string> = {
    '{{CLIENTE_NOME}}': client.name || 'COMPRADOR',
    '{{CLIENTE_CPF}}': formatCPF(client.cpf || ''),
    '{{CLIENTE_ENDERECO}}': client.address || '',
    '{{CLIENTE_TELEFONE}}': client.phone || '',
    '{{CLIENTE_EMAIL}}': client.email || '',
    '{{VEICULO_MARCA}}': vehicle.brand || 'SHINERAY',
    '{{VEICULO_MODELO}}': vehicle.model || 'MOTO',
    '{{VEICULO_ANO}}': String(vehicle.year || 2026),
    '{{VEICULO_COR}}': vehicle.color || '',
    '{{VEICULO_CHASSI}}': vehicle.chassis?.trim()
      ? (vehicle.chassis.trim().toUpperCase() === 'DISPENSADO'
          ? 'DISPENSADO (RES. CONTRAN 996/23)'
          : vehicle.chassis)
      : 'DISPENSADO (RES. CONTRAN 996/23)',
    '{{VEICULO_PLACA}}': vehicle.plate || 'Sem placa / Dispensado',
    '{{VEICULO_RENAVAM}}': vehicle.renavam || 'Dispensado',
    '{{VEICULOS_QTD}}': String(data.vehicles?.length || 1),
    '{{VEICULOS_LISTA}}': (data.vehicles && data.vehicles.length > 0 ? data.vehicles : [{
      brand: vehicle.brand || 'SHINERAY', model: vehicle.model || 'MOTO', year: vehicle.year || 2026,
      color: vehicle.color, chassis: vehicle.chassis, plate: vehicle.plate,
      price: payment.total || 0,
    }]).map((v, i) => {
      const isElec = isElectricVehicle(v);
      const idLabel = isElec ? ' - Nº da Moto/Motor ' : ' - Chassi ';
      const chassisText = v.chassis
        ? (v.chassis.toUpperCase().includes('DISPENSADO') ? ' - ' + v.chassis : `${idLabel}${v.chassis}`)
        : (isElec ? ' - Nº Moto Dispensado' : ' - Chassi Dispensado (Res. 996/23)');
      return `${i + 1}) ${v.brand} ${v.model}${v.year ? ' ' + v.year : ''}${v.color ? ' - ' + v.color : ''}${chassisText}${v.price ? ' - ' + formatCurrency(Number(v.price)) : ''}`;
    }).join('\n'),
    '{{GARANTIA_MESES}}': vehicle.warranty_months ? String(vehicle.warranty_months) : '—',
    '{{REVISAO_MESES}}': vehicle.revision_period_months ? String(vehicle.revision_period_months) : '—',
    '{{REVISAO_KM}}': vehicle.revision_period_km ? vehicle.revision_period_km.toLocaleString('pt-BR') : '—',
    '{{REVENDEDOR_NOME}}': data.reseller?.name || '',
    '{{REVENDEDOR_CPF}}': data.reseller?.cpf ? formatCPF(data.reseller.cpf) : '',
    '{{REVENDEDOR_EMAIL}}': data.reseller?.email || '',
    '{{REVENDEDOR_TELEFONE}}': data.reseller?.phone || '',
    '{{REVENDEDOR_COMISSAO}}': data.reseller?.commission ? `${data.reseller.commission}%` : '',
    '{{LOJA_RAZAO_SOCIAL}}': store.name || 'CONCESSIONÁRIA',
    '{{LOJA_CNPJ}}': store.cnpj || '',
    '{{LOJA_ENDERECO}}': store.address || '',
    '{{LOJA_CIDADE}}': store.city || '',
    '{{LOJA_TELEFONE}}': store.phone || '',
    '{{LOJA_EMAIL}}': store.email || '',
    '{{VALOR_TOTAL}}': formatCurrency(payment.total || 0),
    '{{VALOR_ENTRADA}}': payment.downPayment ? formatCurrency(payment.downPayment) : 'R$ 0,00',
    '{{FORMA_PAGAMENTO}}': payment.method || 'À Vista',
    '{{PARCELAS}}': payment.installments && payment.installments > 0 ? `${payment.installments}x` : '1x',
    '{{VALOR_PARCELA}}': payment.installmentValue
      ? formatCurrency(payment.installmentValue)
      : (payment.installments && payment.installments > 1
          ? formatCurrency(Math.max(0, ((payment.total || 0) - (payment.downPayment || 0)) / payment.installments))
          : formatCurrency(Math.max(0, (payment.total || 0) - (payment.downPayment || 0)))),
    '{{NUMERO_CONTRATO}}': data.contractNumber || 'CTR-000000',
    '{{DATA_CONTRATO}}': data.contractDate || new Date().toLocaleDateString('pt-BR'),
  };

  let result = text;
  for (const [variable, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

function formatClauseVariable(type: 'text' | 'number' | 'currency' | 'date', raw: string): string {
  if (raw === undefined || raw === null || raw === '') return '—';
  if (type === 'currency') {
    const n = Number(String(raw).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(n)) return String(raw);
    return formatCurrency(n);
  }
  if (type === 'number') return String(raw);
  if (type === 'date') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    return String(raw);
  }
  return String(raw);
}

function replaceClauseVariables(
  text: string,
  clause: OptionalClauseRenderable,
  values: Record<string, string> | undefined,
): string {
  const vars = clause.variables || [];
  if (vars.length === 0) return text;
  let out = text;
  for (const v of vars) {
    const raw = values?.[v.key] ?? v.default ?? '';
    const formatted = formatClauseVariable(v.type, raw);
    const regex = new RegExp(`\\{\\{var\\.${v.key.replace(/[^a-zA-Z0-9_]/g, '')}\\}\\}`, 'g');
    out = out.replace(regex, formatted);
  }
  return out;
}

/**
 * Evaluate whether an optional clause's condition is satisfied by the runtime data.
 * Returns true when there is no condition or when it matches.
 */
export function evaluateClauseCondition(
  clause: OptionalClauseRenderable,
  ctx: {
    payment_method?: string;
    vehicle_type?: string | null;
    has_plate?: boolean;
    has_financing?: boolean;
  },
): boolean {
  const cond = clause.condition;
  if (!cond) return true;
  const actual: any = (ctx as any)[cond.field];
  const val = cond.value;
  if (cond.op === 'eq') return String(actual ?? '') === String(val);
  if (cond.op === 'neq') return String(actual ?? '') !== String(val);
  if (cond.op === 'in') {
    const arr = Array.isArray(val) ? val : [String(val)];
    return arr.map(String).includes(String(actual ?? ''));
  }
  return true;
}

// ─── Rich text rendering engine ───

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
  color: string; // hex
}

interface RichLine {
  segments: TextSegment[];
  align: 'left' | 'center' | 'right';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Aplica as tags de alinhamento que envolvem vários parágrafos.
 * Sem isso, um bloco [center] com mais de uma linha vazava como texto literal.
 */
function expandAlignmentBlocks(text: string): string {
  return text.replace(
    /\[(center|right|left)\]([\s\S]*?)\[\/\1\]/g,
    (_all, tag: string, inner: string) =>
      inner
        .split('\n')
        .map((ln) => (ln.trim() ? `[${tag}]${ln}[/${tag}]` : ln))
        .join('\n'),
  );
}

/** Remove tags de formatação que sobraram sem par, para nunca aparecerem no PDF. */
function stripLeftoverTags(text: string): string {
  return text.replace(/\[\/?(center|right|left|b|i|u|size(:\d+)?|color(:#[0-9a-fA-F]{3,6})?)\]/g, '');
}

function parseRichText(text: string, defaultFontSize: number = 10): RichLine[] {
  const rawLines = expandAlignmentBlocks(text).split('\n');
  const result: RichLine[] = [];

  for (const rawLine of rawLines) {
    let line = rawLine;
    let align: 'left' | 'center' | 'right' = 'left';

    // Check for alignment tags wrapping entire line
    const centerMatch = line.match(/^\[center\](.*)\[\/center\]$/s);
    const rightMatch = line.match(/^\[right\](.*)\[\/right\]$/s);
    const leftMatch = line.match(/^\[left\](.*)\[\/left\]$/s);

    if (centerMatch) {
      align = 'center';
      line = centerMatch[1];
    } else if (rightMatch) {
      align = 'right';
      line = rightMatch[1];
    } else if (leftMatch) {
      align = 'left';
      line = leftMatch[1];
    }

    const segments = parseSegments(line, defaultFontSize)
      .map((seg) => ({ ...seg, text: stripLeftoverTags(seg.text) }));
    result.push({ segments, align });
  }

  return result;
}

function parseSegments(text: string, defaultFontSize: number): TextSegment[] {
  const segments: TextSegment[] = [];

  // State stack
  let bold = false;
  let italic = false;
  let underline = false;
  let fontSize = defaultFontSize;
  let color = '#000000';

  // Tokenize: split on tags
  const tagRegex = /\[(b|i|u|\/b|\/i|\/u|size:\d+|\/size|color:#[0-9a-fA-F]{3,6}|\/color)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    // Text before tag
    if (match.index > lastIndex) {
      const t = text.substring(lastIndex, match.index);
      if (t) {
        segments.push({ text: t, bold, italic, underline, fontSize, color });
      }
    }

    const tag = match[1];
    if (tag === 'b') bold = true;
    else if (tag === '/b') bold = false;
    else if (tag === 'i') italic = true;
    else if (tag === '/i') italic = false;
    else if (tag === 'u') underline = true;
    else if (tag === '/u') underline = false;
    else if (tag.startsWith('size:')) fontSize = parseInt(tag.split(':')[1], 10) || defaultFontSize;
    else if (tag === '/size') fontSize = defaultFontSize;
    else if (tag.startsWith('color:')) color = tag.split(':')[1];
    else if (tag === '/color') color = '#000000';

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    const t = text.substring(lastIndex);
    if (t) {
      segments.push({ text: t, bold, italic, underline, fontSize, color });
    }
  }

  // If no segments, add empty
  if (segments.length === 0) {
    segments.push({ text: '', bold: false, italic: false, underline: false, fontSize: defaultFontSize, color: '#000000' });
  }

  return segments;
}

function getFontStyle(segment: Pick<TextSegment, 'bold' | 'italic'>): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  return (segment.bold && segment.italic)
    ? 'bolditalic'
    : segment.bold
      ? 'bold'
      : segment.italic
        ? 'italic'
        : 'normal';
}

function applySegmentFont(doc: jsPDF, segment: Pick<TextSegment, 'bold' | 'italic' | 'fontSize'>): void {
  doc.setFontSize(segment.fontSize);
  doc.setFont('helvetica', getFontStyle(segment));
}

function measureSegmentText(doc: jsPDF, segment: TextSegment, text: string): number {
  applySegmentFont(doc, segment);
  return doc.getTextWidth(text);
}

function hasSameFormatting(a: TextSegment, b: TextSegment): boolean {
  return a.bold === b.bold
    && a.italic === b.italic
    && a.underline === b.underline
    && a.fontSize === b.fontSize
    && a.color === b.color;
}

function appendSegmentText(target: TextSegment[], segment: TextSegment, text: string): void {
  if (!text) return;

  const lastSegment = target[target.length - 1];
  if (lastSegment && hasSameFormatting(lastSegment, segment)) {
    lastSegment.text += text;
    return;
  }

  target.push({ ...segment, text });
}

function splitOversizedToken(doc: jsPDF, segment: TextSegment, token: string, maxWidth: number): string[] {
  const chunks: string[] = [];
  let remaining = token;

  while (remaining) {
    let low = 1;
    let high = remaining.length;
    let best = 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = remaining.slice(0, mid);

      if (measureSegmentText(doc, segment, candidate) <= maxWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    chunks.push(remaining.slice(0, best));
    remaining = remaining.slice(best);
  }

  return chunks;
}

function trimWrappedRow(rowSegments: TextSegment[]): TextSegment[] {
  const trimmed = rowSegments.map((segment) => ({ ...segment }));

  while (trimmed.length > 0) {
    const first = trimmed[0];
    const nextText = first.text.replace(/^\s+/, '');

    if (nextText === first.text) break;
    if (!nextText) {
      trimmed.shift();
      continue;
    }

    first.text = nextText;
    break;
  }

  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    const nextText = last.text.replace(/\s+$/, '');

    if (nextText === last.text) break;
    if (!nextText) {
      trimmed.pop();
      continue;
    }

    last.text = nextText;
    break;
  }

  return trimmed;
}

function wrapSegments(doc: jsPDF, segments: TextSegment[], maxWidth: number): TextSegment[][] {
  const wrappedLines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  const pushCurrentLine = () => {
    const trimmedLine = trimWrappedRow(currentLine);

    if (trimmedLine.length > 0) {
      wrappedLines.push(trimmedLine);
    }

    currentLine = [];
    currentLineWidth = 0;
  };

  for (const segment of segments) {
    const tokens = segment.text.match(/\S+|\s+/g) ?? [];

    for (const token of tokens) {
      if (!token) continue;

      if (/^\s+$/.test(token)) {
        if (currentLine.length === 0) continue;

        const tokenWidth = measureSegmentText(doc, segment, token);
        if (currentLineWidth + tokenWidth <= maxWidth) {
          appendSegmentText(currentLine, segment, token);
          currentLineWidth += tokenWidth;
        } else {
          pushCurrentLine();
        }

        continue;
      }

      const chunks = measureSegmentText(doc, segment, token) <= maxWidth
        ? [token]
        : splitOversizedToken(doc, segment, token, maxWidth);

      for (const chunk of chunks) {
        const chunkWidth = measureSegmentText(doc, segment, chunk);

        if (currentLineWidth > 0 && currentLineWidth + chunkWidth > maxWidth) {
          pushCurrentLine();
        }

        appendSegmentText(currentLine, segment, chunk);
        currentLineWidth += chunkWidth;

        if (chunkWidth >= maxWidth) {
          pushCurrentLine();
        }
      }
    }
  }

  if (currentLine.length > 0) {
    pushCurrentLine();
  }

  return wrappedLines.length > 0 ? wrappedLines : [segments];
}

function renderRichLines(doc: jsPDF, lines: RichLine[], startY: number, margin: number, contentWidth: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;

  for (const line of lines) {
    const maxFontSize = Math.max(...line.segments.map((segment) => segment.fontSize));
    const lineHeight = maxFontSize * 0.45 + 1;

    if (line.segments.length === 1 && line.segments[0].text === '') {
      if (y + lineHeight > pageHeight - 20) {
        doc.addPage();
        y = margin;
      }
      y += lineHeight;
      continue;
    }

    const wrappedRows = wrapSegments(doc, line.segments, contentWidth);

    for (const rowSegments of wrappedRows) {
      if (rowSegments.length === 0) continue;

      const rowMaxFont = Math.max(...rowSegments.map((segment) => segment.fontSize));
      const rowLineHeight = rowMaxFont * 0.45 + 1;

      if (y + rowLineHeight > pageHeight - 20) {
        doc.addPage();
        y = margin;
      }

      let totalWidth = 0;
      for (const segment of rowSegments) {
        totalWidth += measureSegmentText(doc, segment, segment.text);
      }

      const remainingWidth = Math.max(contentWidth - totalWidth, 0);
      let x = margin;

      if (line.align === 'center') {
        x = margin + remainingWidth / 2;
      } else if (line.align === 'right') {
        x = margin + remainingWidth;
      }

      for (const segment of rowSegments) {
        applySegmentFont(doc, segment);

        const [r, g, b] = hexToRgb(segment.color);
        doc.setTextColor(r, g, b);

        doc.text(segment.text, x, y);
        const segmentWidth = measureSegmentText(doc, segment, segment.text);

        if (segment.underline) {
          doc.setDrawColor(r, g, b);
          doc.setLineWidth(0.3);
          doc.line(x, y + 1, x + segmentWidth, y + 1);
        }

        x += segmentWidth;
      }

      y += rowLineHeight;
    }
  }

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  return y;
}

function renderRichContent(doc: jsPDF, text: string, y: number, margin: number, contentWidth: number, defaultFontSize: number = 10): number {
  if (!text) return y;
  const lines = parseRichText(text, defaultFontSize);
  return renderRichLines(doc, lines, y, margin, contentWidth);
}

/**
 * Renders signature blocks as geometrically centered two-column layout.
 * Detects [signatures]LEFT_LABEL|LEFT_SUBTITLE||RIGHT_LABEL|RIGHT_SUBTITLE[/signatures]
 * Returns null if no signature block found in text (caller falls back to rich rendering).
 */
function renderSignatureBlock(
  doc: jsPDF,
  text: string,
  y: number,
  margin: number,
  contentWidth: number,
  pageWidth: number
): { handled: boolean; nextY: number; remainingText: string } {
  const sigRegex = /\[signatures\]([\s\S]*?)\[\/signatures\]/;
  const match = text.match(sigRegex);

  if (!match) return { handled: false, nextY: y, remainingText: text };

  // Render any text before the signature block
  const beforeText = text.substring(0, match.index!).trim();
  let currentY = y;

  if (beforeText) {
    currentY = renderRichContent(doc, beforeText, currentY, margin, contentWidth, 9.5);
    currentY += 6;
  } else {
    currentY += 4;
  }

  // Parse signature columns: LEFT_LABEL|LEFT_SUB||RIGHT_LABEL|RIGHT_SUB
  const inner = match[1].trim();
  const columns = inner.split('||').map((col) => col.split('|').map((s) => s.trim()));

  if (columns.length < 2) return { handled: false, nextY: y, remainingText: text };

  const pageHeight = doc.internal.pageSize.getHeight();
  const sigBlockHeight = 22;

  if (currentY + sigBlockHeight > pageHeight - 20) {
    doc.addPage();
    currentY = margin;
  }

  // Two columns, perfectly centered within content area
  const colWidth = contentWidth / 2;
  const lineWidth = Math.min(colWidth - 10, 70);

  const leftCenterX = margin + colWidth / 2;
  const rightCenterX = margin + colWidth + colWidth / 2;

  const lineY = currentY + 8;

  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);
  doc.line(leftCenterX - lineWidth / 2, lineY, leftCenterX + lineWidth / 2, lineY);
  doc.line(rightCenterX - lineWidth / 2, lineY, rightCenterX + lineWidth / 2, lineY);

  doc.setTextColor(0, 0, 0);

  // Left column
  const [leftLabel = '', leftSub = ''] = columns[0];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(leftLabel, leftCenterX, lineY + 4, { align: 'center' });
  if (leftSub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const leftSubLines = doc.splitTextToSize(leftSub, colWidth - 6);
    leftSubLines.forEach((ln: string, i: number) => {
      doc.text(ln, leftCenterX, lineY + 8 + i * 3.5, { align: 'center' });
    });
  }

  // Right column
  const [rightLabel = '', rightSub = ''] = columns[1];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(rightLabel, rightCenterX, lineY + 4, { align: 'center' });
  if (rightSub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const rightSubLines = doc.splitTextToSize(rightSub, colWidth - 6);
    rightSubLines.forEach((ln: string, i: number) => {
      doc.text(ln, rightCenterX, lineY + 8 + i * 3.5, { align: 'center' });
    });
  }

  // Render any text after the signature block
  let nextY = lineY + 14;
  const afterText = text.substring(match.index! + match[0].length).trim();
  if (afterText) {
    nextY += 2;
    nextY = renderRichContent(doc, afterText, nextY, margin, contentWidth, 9);
  }

  return { handled: true, nextY, remainingText: '' };
}

// ─── PDF Generators ───

interface TemplatePreviewAssets {
  logo_data_url?: string | null;
  watermark_data_url?: string | null;
  signature_data_url?: string | null;
  watermark_opacity?: number | null;
}

/**
 * Monta os dados de exemplo usados na prévia / teste do modelo,
 * reaproveitando exatamente a mesma estrutura do contrato real.
 */
export function buildTemplateSampleData(
  data: TemplatePreviewData & TemplatePreviewAssets,
): ContractGenerationData {
  return {
    template: {
      header_content: data.header,
      body_content: data.body,
      clauses_content: data.clauses,
      signature_content: data.signature,
      fixed_clauses: data.fixedClauses,
      optional_clauses: data.optionalClauses || [],
      logo_data_url: data.logo_data_url ?? null,
      watermark_data_url: data.watermark_data_url ?? null,
      signature_data_url: data.signature_data_url ?? null,
      watermark_opacity: data.watermark_opacity ?? null,
    },
    activeClauseIds:
      data.activeClauseIds ||
      (data.optionalClauses || []).filter((c) => c.enabled_by_default).map((c) => c.id),
    clauseVariables: data.clauseVariables,
    ...SAMPLE_DATA,
  };
}

/**
 * Prévia / teste do modelo: usa o MESMO gerador do contrato definitivo,
 * para que o layout visto no teste seja idêntico ao documento emitido.
 */
export function generateTemplatePreviewPDF(
  data: TemplatePreviewData & TemplatePreviewAssets,
): string {
  const doc = generateContractFromTemplate(buildTemplateSampleData(data));
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(52);
    doc.setTextColor(226, 226, 230);
    doc.text('PRÉVIA', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
    doc.setTextColor(0, 0, 0);
  }
  return doc.output('dataurlstring');
}


function parseAccentColor(c?: [number, number, number] | string | null): [number, number, number] {
  if (Array.isArray(c) && c.length === 3) return c as [number, number, number];
  if (typeof c === 'string') {
    const hex = c.replace('#', '').trim();
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
  }
  return [237, 28, 36];
}

export function generateContractFromTemplate(data: ContractGenerationData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  const template = data.template;

  // Logo (top centered)
  if (template.logo_data_url) {
    try {
      const logoH = 18;
      const logoW = 40;
      doc.addImage(template.logo_data_url, 'PNG', (pageWidth - logoW) / 2, y, logoW, logoH, undefined, 'FAST');
      y += logoH + 4;
    } catch { /* ignore invalid image */ }
  }

  // Header
  if (template.header_content) {
    const headerText = replaceVariables(template.header_content, data);
    y = renderRichContent(doc, headerText, y, margin, contentWidth, 14);
    y += 3;
  }

  // Contract info
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Contrato Nº: ${data.contractNumber}  •  Data: ${data.contractDate}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  const [accentR, accentG, accentB] = parseAccentColor(template.accent_color);

  // Separator
  doc.setDrawColor(accentR, accentG, accentB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  doc.setTextColor(0, 0, 0);

  // Body
  const bodyText = replaceVariables(template.body_content, data);
  y = renderRichContent(doc, bodyText, y, margin, contentWidth, 9.5);
  y += 3;

  // Tabela de veículos (somente quando a venda tem mais de um veículo)
  const multiVehicles = data.vehicles && data.vehicles.length > 1 ? data.vehicles : null;
  if (multiVehicles) {
    const pageH = doc.internal.pageSize.getHeight();
    const cItem = margin + 3;
    const cDesc = margin + 10;
    const cChassis = margin + contentWidth * 0.52;
    const cPrice = pageWidth - margin - 3;
    const drawHead = () => {
      doc.setFillColor(23, 23, 26);
      doc.rect(margin, y - 4.4, contentWidth, 6.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(255, 255, 255);
      doc.text('#', cItem, y);
      doc.text('MARCA / MODELO / ANO / COR', cDesc, y);
      doc.text('CHASSI / PLACA', cChassis, y);
      doc.text('VALOR', cPrice, y, { align: 'right' });
      y += 6.4;
    };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`VEÍCULOS DESTE CONTRATO (${multiVehicles.length})`, margin, y);
    y += 5;
    drawHead();
    multiVehicles.forEach((v, i) => {
      if (y + 10 > pageH - 30) { doc.addPage(); y = margin; drawHead(); }
      if (i % 2 === 1) {
        doc.setFillColor(248, 248, 249);
        doc.rect(margin, y - 4.2, contentWidth, 7.4, 'F');
      }
      const desc = [`${v.brand} ${v.model}`.trim(), v.year ? String(v.year) : '', v.color || '']
        .filter(Boolean).join('  •  ');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(110, 112, 120);
      doc.text(String(i + 1), cItem, y);
      doc.setTextColor(23, 23, 26);
      doc.text(doc.splitTextToSize(desc, cChassis - cDesc - 3)[0], cDesc, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(70, 72, 80);
      doc.text(`${v.chassis || '—'}${v.plate ? '  •  ' + v.plate : ''}`, cChassis, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(23, 23, 26);
      doc.text(v.price ? formatCurrency(Number(v.price)) : '—', cPrice, y, { align: 'right' });
      y += 5.2;
      doc.setDrawColor(222, 224, 228);
      doc.setLineWidth(0.2);
      doc.line(margin, y - 3.2, pageWidth - margin, y - 3.2);
    });
    const vehiclesTotal = multiVehicles.reduce((sum, v) => sum + (Number(v.price) || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 23, 26);
    doc.text('TOTAL', cDesc, y + 1.4);
    doc.setTextColor(237, 28, 36);
    doc.text(formatCurrency(vehiclesTotal || data.payment.total), cPrice, y + 1.4, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  // Fixed Clauses
  if (template.fixed_clauses && template.fixed_clauses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('CLÁUSULAS OBRIGATÓRIAS:', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    template.fixed_clauses.forEach((clause, index) => {
      const clauseLines = doc.splitTextToSize(`${index + 1}. ${clause}`, contentWidth);
      for (const line of clauseLines) {
        if (y > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 3.8;
      }
      y += 1;
    });
    y += 3;
  }

  // Clauses
  if (template.clauses_content) {
    const clausesText = replaceVariables(template.clauses_content, data);
    y = renderRichContent(doc, clausesText, y, margin, contentWidth, 9);
    y += 4;
  }

  // Optional Clauses (dynamic, selected at sale finalization)
  const activeIds = data.activeClauseIds || [];
  const optional = template.optional_clauses || [];
  const paymentMethod = data.payment.method?.toLowerCase() || '';
  const conditionCtx = {
    payment_method: paymentMethod.includes('financ') ? 'financiamento' : paymentMethod.includes('parcel') ? 'parcelado' : 'avista',
    vehicle_type: undefined as string | undefined,
    has_plate: !!(data.vehicle.plate && data.vehicle.plate !== 'Sem placa'),
    has_financing: paymentMethod.includes('financ'),
  };
  const chosen = optional.filter((c) => activeIds.includes(c.id) && evaluateClauseCondition(c, conditionCtx));
  if (chosen.length > 0) {
    for (const clause of chosen) {
      const withVars = replaceClauseVariables(clause.body_bbcode, clause, data.clauseVariables?.[clause.id]);
      const block = `[b]${clause.label.toUpperCase()}[/b]\n${withVars}`;
      const text = replaceVariables(block, data);
      y = renderRichContent(doc, text, y, margin, contentWidth, 9);
      y += 3;
    }
    y += 2;
  }

  // Signature
  if (template.signature_content) {
    if (y > doc.internal.pageSize.getHeight() - 45) {
      doc.addPage();
      y = margin;
    }
    const signatureText = replaceVariables(template.signature_content, data);
    const sigResult = renderSignatureBlock(doc, signatureText, y, margin, contentWidth, pageWidth);
    if (sigResult.handled) {
      y = sigResult.nextY;
    } else {
      y = renderRichContent(doc, signatureText, y, margin, contentWidth, 9.5);
    }
  }

  if (data.pickup) {
    renderPickupAuthorization(doc, data.pickup, { name: data.client.name, cpf: data.client.cpf }, data.contractNumber);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Digital acceptance stamp
  if (data.acceptance?.accepted_at) {
    const dt = new Date(data.acceptance.accepted_at).toLocaleString('pt-BR');
    const ip = data.acceptance.accepted_ip ? ` • IP ${data.acceptance.accepted_ip}` : '';
    const nm = data.acceptance.buyer_name_typed ? ` • ${data.acceptance.buyer_name_typed}` : '';
    doc.setFontSize(7.5);
    doc.setTextColor(237, 28, 36);
    doc.text(
      `Aceito digitalmente em ${dt}${nm}${ip}`,
      pageWidth / 2,
      footerY - 4,
      { align: 'center' },
    );
    doc.setTextColor(128, 128, 128);
  }

  // Bottom accent line
  doc.setDrawColor(accentR, accentG, accentB);
  doc.setLineWidth(1.2);
  doc.line(margin, doc.internal.pageSize.getHeight() - 8, pageWidth - margin, doc.internal.pageSize.getHeight() - 8);

  // Watermark + signature image overlays on every page
  applyOverlays(doc, template);

  return doc;
}

function applyOverlays(doc: jsPDF, template: ContractGenerationData['template']): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const watermark = template.watermark_data_url || DEFAULT_CONTRACT_WATERMARK;
    if (watermark) {
      try {
        const opacity = Math.max(0.03, Math.min(0.5, Number(template.watermark_opacity ?? 0.1)));
        const gs = (doc as any).GState ? new (doc as any).GState({ opacity }) : null;
        if (gs) (doc as any).setGState(gs);
        const w = pageWidth * 0.6;
        const h = w;
        doc.addImage(watermark, 'PNG', (pageWidth - w) / 2, (pageHeight - h) / 2, w, h, undefined, 'FAST');
        if (gs) {
          const reset = new (doc as any).GState({ opacity: 1 });
          (doc as any).setGState(reset);
        }
      } catch { /* ignore */ }
    }
  }

  // Signature image: place above footer on last page
  if (template.signature_data_url) {
    try {
      doc.setPage(pageCount);
      const w = 50, h = 18;
      doc.addImage(template.signature_data_url, 'PNG', (pageWidth - w) / 2, pageHeight - 32, w, h, undefined, 'FAST');
    } catch { /* ignore */ }
  }
}

/**
 * Fetch a remote image URL and return a data URL usable by jsPDF.addImage.
 */
export async function fetchImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Resolves logo/watermark/signature URLs into data URLs so PDFs render them.
 */
export async function loadTemplateAssets(template: {
  logo_url?: string | null;
  watermark_url?: string | null;
  signature_url?: string | null;
  watermark_opacity?: number | null;
}): Promise<{
  logo_data_url: string | null;
  watermark_data_url: string | null;
  signature_data_url: string | null;
  watermark_opacity: number;
}> {
  const [logo, watermark, signature] = await Promise.all([
    fetchImageAsDataUrl(template.logo_url),
    fetchImageAsDataUrl(template.watermark_url),
    fetchImageAsDataUrl(template.signature_url),
  ]);
  return {
    logo_data_url: logo,
    watermark_data_url: watermark,
    signature_data_url: signature,
    watermark_opacity: Number(template.watermark_opacity ?? 0.1),
  };
}

export function downloadContractFromTemplate(data: ContractGenerationData): void {
  const doc = generateContractFromTemplate(data);
  const safeNumber = String(data.contractNumber || 'CTR-000000').replace(/[\/\\:*?"<>|]/g, '-');
  doc.save(`contrato_${safeNumber}.pdf`);
}

export function previewContractFromTemplate(data: ContractGenerationData): string {
  const doc = generateContractFromTemplate(data);
  return doc.output('dataurlstring');
}
