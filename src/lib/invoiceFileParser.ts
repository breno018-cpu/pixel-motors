/**
 * Parser Inteligente de Arquivos de Nota Fiscal (XML, DANFE PDF e Imagem)
 * Extrai automaticamente todos os dados fiscais usando:
 * - DOMParser para XML NF-e padrão SEFAZ
 * - pdfjs-dist (PDF.js) para extração real de texto de PDFs comprimidos (FlateDecode / CMap)
 * - Fallback OCR (Tesseract.js) para DANFEs escaneadas ou fotos/prints de NF
 */

import {
  STORE_DIVINOPOLIS_UUID,
  STORE_MONTESCLAROS_UUID,
  STORE_MONTESCLAROS_MULTIMARCAS_UUID,
} from '@/hooks/useStores';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface ParsedInvoiceData {
  invoice_number?: string;
  series?: string;
  access_key?: string; // 44 dígitos
  sefaz_protocol?: string; // Protocolo de autorização SEFAZ (15 dígitos)
  issue_date?: string; // YYYY-MM-DD
  operation_nature?: string;
  fiscal_type?: 'entrada' | 'emissao';
  issuer_name?: string;
  issuer_document?: string;
  customer_name?: string;
  customer_document?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_zip?: string;
  total_value?: number;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_chassis?: string;
  vehicle_color?: string;
  vehicle_year?: number;
  alienacao?: string;
  store_id?: string;
  store_name?: string;
  parser_type: 'xml' | 'pdf' | 'text' | 'image';
  used_ocr?: boolean;
  raw_text?: string;
}

/**
 * Normaliza formato de data brasileira (DD/MM/YYYY ou ISO) para ISO (YYYY-MM-DD)
 */
function normalizeDateStr(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
      return `${year}-${month}-${day}`;
    }
  }
  return undefined;
}

/**
 * Converte valor em formato string monetário para number
 */
export function parseMoneyValue(val?: string | null): number | undefined {
  if (!val) return undefined;
  const clean = val.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return undefined;
  if (clean.includes(',')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

/**
 * Extrai informações estruturadas diretamente da Chave de Acesso SEFAZ (44 dígitos):
 * cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */
function decodeNfeAccessKey(key: string): {
  issuerCnpj: string;
  model: string;
  series: string;
  invoiceNumber: string;
} | null {
  const digits = key.replace(/\D/g, '');
  if (digits.length !== 44) return null;
  const model = digits.slice(20, 22);
  if (model !== '55' && model !== '65') return null;

  const issuerCnpj = digits.slice(6, 20);
  const rawSeries = digits.slice(22, 25);
  const rawNumber = digits.slice(25, 34);
  const series = String(parseInt(rawSeries, 10) || 1);
  const invoiceNumber = String(parseInt(rawNumber, 10) || rawNumber);

  return { issuerCnpj, model, series, invoiceNumber };
}

/**
 * Detecta loja oficial com base em texto/CNPJ/cidade
 */
function detectStoreFromText(text: string): { store_id: string; store_name: string } | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('multimarcas') || lower.includes('multi marcas') || lower.includes('seminovos')) {
    return {
      store_id: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
      store_name: 'L1MA MOTORS MULTIMARCAS',
    };
  }
  if (
    lower.includes('montes claros') ||
    lower.includes('edgar pereira') ||
    lower.includes('joao xxiii') ||
    lower.includes('joão xxiii') ||
    lower.includes('18.456.789/0002-82') ||
    lower.includes('18456789000282')
  ) {
    return {
      store_id: STORE_MONTESCLAROS_UUID,
      store_name: 'Concessionária Montes Claros',
    };
  }
  if (
    lower.includes('divinópolis') ||
    lower.includes('divinopolis') ||
    lower.includes('espirito santo') ||
    lower.includes('espírito santo') ||
    lower.includes('18.456.789/0001-01') ||
    lower.includes('18456789000101')
  ) {
    return {
      store_id: STORE_DIVINOPOLIS_UUID,
      store_name: 'Concessionária Divinópolis',
    };
  }
  return undefined;
}

/**
 * Parser de XML da NF-e (Padrão Nacional SEFAZ)
 * Utiliza getElementsByTagName para ser totalmente imune a problemas de namespace XML.
 */
export function parseNfeXml(xmlString: string): ParsedInvoiceData {
  const result: ParsedInvoiceData = {
    parser_type: 'xml',
    raw_text: xmlString.slice(0, 3000),
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const getTag = (name: string, context: Document | Element = doc): string => {
      const el = context.getElementsByTagName(name)[0];
      return el?.textContent?.trim() || '';
    };

    // 1. Chave de Acesso (44 dígitos)
    const infNFeEl = doc.getElementsByTagName('infNFe')[0];
    const idAttr = infNFeEl?.getAttribute('Id') || '';
    const keyFromId = idAttr.replace(/\D/g, '');
    if (keyFromId.length === 44) {
      result.access_key = keyFromId;
    } else {
      const chNFe = getTag('chNFe') || getTag('chNFeProt');
      const cleanCh = chNFe.replace(/\D/g, '');
      if (cleanCh.length === 44) {
        result.access_key = cleanCh;
      }
    }

    // 2. Protocolo de Autorização SEFAZ (15 dígitos)
    const nProt = getTag('nProt');
    if (nProt) {
      result.sefaz_protocol = nProt.replace(/\D/g, '') || nProt;
    }

    // 3. Dados Básicos da NF (ide)
    const ideEl = doc.getElementsByTagName('ide')[0] || doc;
    const nNF = getTag('nNF', ideEl);
    if (nNF) result.invoice_number = String(parseInt(nNF, 10) || nNF);

    const serie = getTag('serie', ideEl);
    if (serie) result.series = serie;

    const dhEmi = getTag('dhEmi', ideEl) || getTag('dEmi', ideEl);
    if (dhEmi) {
      result.issue_date = normalizeDateStr(dhEmi);
    }

    const natOp = getTag('natOp', ideEl);
    if (natOp) result.operation_nature = natOp;

    // 4. Emitente
    const emitEl = doc.getElementsByTagName('emit')[0];
    if (emitEl) {
      const emitNome = getTag('xNome', emitEl);
      const emitCnpj = getTag('CNPJ', emitEl);
      const emitMun = getTag('xMun', emitEl);
      if (emitNome) result.issuer_name = emitNome;
      if (emitCnpj) result.issuer_document = emitCnpj;

      const emitFull = `${emitNome} ${emitCnpj} ${emitMun}`;
      const isSupplier =
        emitFull.toLowerCase().includes('shineray do brasil') ||
        emitFull.toLowerCase().includes('bci') ||
        emitFull.toLowerCase().includes('importadora') ||
        emitFull.toLowerCase().includes('fabrica');

      if (isSupplier) {
        result.fiscal_type = 'entrada';
      } else {
        const detected = detectStoreFromText(emitFull);
        if (detected) {
          result.store_id = detected.store_id;
          result.store_name = detected.store_name;
          result.fiscal_type = 'emissao';
        }
      }
    }

    // 5. Destinatário / Comprador (dest)
    const destEl = doc.getElementsByTagName('dest')[0];
    if (destEl) {
      const xNome = getTag('xNome', destEl);
      if (xNome) result.customer_name = xNome;

      const cpf = getTag('CPF', destEl);
      const cnpj = getTag('CNPJ', destEl);
      if (cpf || cnpj) result.customer_document = cpf || cnpj;

      const fone = getTag('fone', destEl);
      if (fone) result.customer_phone = fone;

      const email = getTag('email', destEl);
      if (email) result.customer_email = email;

      const xLgr = getTag('xLgr', destEl);
      const nro = getTag('nro', destEl);
      const xCpl = getTag('xCpl', destEl);
      const xBairro = getTag('xBairro', destEl);
      const xMun = getTag('xMun', destEl);
      const uf = getTag('UF', destEl);
      const cep = getTag('CEP', destEl);

      result.customer_city = xMun;
      result.customer_state = uf;
      result.customer_zip = cep;

      if (!result.store_id) {
        const destStore = detectStoreFromText(`${xNome} ${cnpj} ${xMun} ${xLgr}`);
        if (destStore) {
          result.store_id = destStore.store_id;
          result.store_name = destStore.store_name;
          result.fiscal_type = 'entrada';
        }
      }

      const addressParts = [
        xLgr ? `${xLgr}${nro ? `, ${nro}` : ''}` : '',
        xCpl,
        xBairro,
        xMun && uf ? `${xMun}/${uf}` : xMun,
        cep ? `CEP: ${cep}` : '',
      ].filter(Boolean);

      if (addressParts.length > 0) {
        result.customer_address = addressParts.join(' - ');
      }
    }

    // Se for NF de entrada (fornecedor -> loja), a parte relevante para o controle é o fornecedor (emitente)
    if (result.fiscal_type === 'entrada' && result.issuer_name) {
      result.customer_name = result.issuer_name;
      if (result.issuer_document) result.customer_document = result.issuer_document;
    }

    // 6. Valor Total da NF
    const vNF = getTag('vNF');
    if (vNF) {
      const parsedVal = parseFloat(vNF);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        result.total_value = parsedVal;
      }
    }

    // 7. Dados do Veículo / Motocicleta
    const prodEl = doc.getElementsByTagName('prod')[0];
    const veicEl = doc.getElementsByTagName('veicProd')[0];

    const xProd = prodEl ? getTag('xProd', prodEl) : getTag('xProd');
    if (xProd) {
      result.vehicle_model = xProd;
    }

    const veicChassi = veicEl ? getTag('chassi', veicEl) : getTag('chassi');
    if (veicChassi) {
      result.vehicle_chassis = veicChassi.toUpperCase();
    } else if (xProd) {
      const chassisInProd = xProd.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
      if (chassisInProd) result.vehicle_chassis = chassisInProd[1].toUpperCase();
    }

    const veicCor = veicEl ? getTag('xCor', veicEl) : getTag('xCor');
    if (veicCor) result.vehicle_color = veicCor;

    const anoMod = veicEl ? getTag('anoMod', veicEl) : getTag('anoMod');
    if (anoMod) result.vehicle_year = parseInt(anoMod, 10);

    result.vehicle_brand = 'SHINERAY';

    // 8. Alienação / Pagamento
    const tPag = getTag('tPag');
    if (tPag === '01') result.alienacao = 'À VISTA (DINHEIRO)';
    else if (tPag === '03') result.alienacao = 'CARTÃO DE CRÉDITO';
    else if (tPag === '17') result.alienacao = 'PIX';
    else if (tPag === '16') result.alienacao = 'FINANCIAMENTO';
  } catch (err) {
    console.warn('Erro ao processar DOM XML da NF-e, aplicando fallback regex:', err);
  }

  // Fallbacks de Regex
  if (!result.access_key) {
    const kMatch =
      xmlString.match(/Id=["']NFe(\d{44})["']/i) ||
      xmlString.match(/<chNFe>(\d{44})<\/chNFe>/i) ||
      xmlString.match(/\b(\d{44})\b/);
    if (kMatch) result.access_key = kMatch[1];
  }

  if (result.access_key) {
    const decoded = decodeNfeAccessKey(result.access_key);
    if (decoded) {
      if (!result.invoice_number) result.invoice_number = decoded.invoiceNumber;
      if (!result.series) result.series = decoded.series;
    }
  }

  if (!result.sefaz_protocol) {
    const pMatch =
      xmlString.match(/<nProt>(\d+)<\/nProt>/i) ||
      xmlString.match(/nProt["']?\s*[:=]\s*["']?(\d+)["']?/i) ||
      xmlString.match(/\b([1-4]\d{14})\b/);
    if (pMatch) result.sefaz_protocol = pMatch[1];
  }

  if (!result.invoice_number) {
    const nMatch = xmlString.match(/<nNF>(\d+)<\/nNF>/i);
    if (nMatch) result.invoice_number = String(parseInt(nMatch[1], 10) || nMatch[1]);
  }

  if (!result.series) {
    const sMatch = xmlString.match(/<serie>(\d+)<\/serie>/i);
    if (sMatch) result.series = sMatch[1];
  }

  if (!result.issue_date) {
    const dMatch = xmlString.match(/<(?:dhEmi|dEmi)>([^<]+)<\/(?:dhEmi|dEmi)>/i);
    if (dMatch) result.issue_date = normalizeDateStr(dMatch[1]);
  }

  if (!result.customer_name) {
    const dMatch = xmlString.match(/<dest>[\s\S]*?<xNome>([^<]+)<\/xNome>/i);
    if (dMatch) result.customer_name = dMatch[1].trim();
  }

  if (!result.customer_document) {
    const docMatch = xmlString.match(/<dest>[\s\S]*?<(?:CPF|CNPJ)>([^<]+)<\/(?:CPF|CNPJ)>/i);
    if (docMatch) result.customer_document = docMatch[1].trim();
  }

  if (!result.vehicle_chassis) {
    const chMatch =
      xmlString.match(/<chassi>([^<]+)<\/chassi>/i) ||
      xmlString.match(/\b([9A-HJ-NPR-Z][A-HJ-NPR-Z0-9]{16})\b/i);
    if (chMatch) result.vehicle_chassis = chMatch[1].trim().toUpperCase();
  }

  if (!result.total_value) {
    const vMatch = xmlString.match(/<vNF>([^<]+)<\/vNF>/i);
    if (vMatch) {
      const val = parseFloat(vMatch[1]);
      if (!isNaN(val) && val > 0) result.total_value = val;
    }
  }

  return result;
}

/**
 * Extrai texto de um PDF preservando a ordem visual (linhas por coordenada Y e colunas por X)
 * usando PDF.js (`pdfjs-dist`). Se o PDF for escaneado (sem camada de texto), aplica OCR via Tesseract.js.
 */
async function extractTextFromPdf(file: File): Promise<{ text: string; usedOcr: boolean }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const maxPages = Math.min(pdf.numPages, 5);
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    type TextEntry = { str: string; x: number; y: number };
    const entries: TextEntry[] = [];

    for (const rawItem of content.items as any[]) {
      const str = typeof rawItem?.str === 'string' ? rawItem.str.trim() : '';
      if (!str) continue;
      const transform = Array.isArray(rawItem.transform) ? rawItem.transform : [1, 0, 0, 1, 0, 0];
      entries.push({
        str,
        x: Number(transform[4]) || 0,
        y: Number(transform[5]) || 0,
      });
    }

    // Ordena por Y decrescente (topo -> base) e agrupa linhas com tolerância de 3.5pt
    entries.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: TextEntry[][] = [];
    for (const entry of entries) {
      const lastLine = lines[lines.length - 1];
      if (lastLine && Math.abs(lastLine[0].y - entry.y) <= 3.5) {
        lastLine.push(entry);
      } else {
        lines.push([entry]);
      }
    }

    const formattedLines = lines.map((line) => {
      line.sort((a, b) => a.x - b.x);
      return line.map((e) => e.str).join(' ');
    });

    pageTexts.push(formattedLines.join('\n'));
  }

  const combinedText = pageTexts.join('\n').trim();

  // Se o PDF tiver camada de texto legível, retorna imediatamente (instantâneo)
  if (combinedText.length >= 40) {
    return { text: combinedText, usedOcr: false };
  }

  // Fallback OCR para PDFs escaneados / imagem (renderiza página 1 em canvas e roda Tesseract)
  if (typeof document !== 'undefined') {
    try {
      const page1 = await pdf.getPage(1);
      const viewport = page1.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page1.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        const { recognize } = await import('tesseract.js');
        const ocrRes = await recognize(canvas, 'por');
        const ocrText = (ocrRes?.data?.text || '').trim();
        if (ocrText.length > combinedText.length) {
          return { text: ocrText, usedOcr: true };
        }
      }
    } catch (ocrErr) {
      console.warn('[invoiceFileParser] Fallback OCR em PDF escaneado falhou:', ocrErr);
    }
  }

  return { text: combinedText, usedOcr: false };
}

/**
 * Limpa possíveis rótulos capturados acidentalmente junto ao nome do cliente/fornecedor
 */
function sanitizePartyName(raw: string): string | undefined {
  let clean = raw
    .replace(/\s+/g, ' ')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b.*$/i, '')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b.*$/i, '')
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b.*$/i, '')
    .replace(/\b(?:CNPJ|CPF|DATA\s+DA\s+EMISS|INSCRI[CÇ][AÃ]O|FONE|CEP)\b.*$/i, '')
    .replace(/^[:\-\s/]+|[:\-\s/]+$/g, '')
    .trim();

  if (clean.length < 3) return undefined;
  const upper = clean.toUpperCase();
  const forbidden = [
    'NOME / RAZÃO SOCIAL',
    'NOME/RAZÃO SOCIAL',
    'NOME / RAZAO SOCIAL',
    'DESTINATÁRIO',
    'DESTINATARIO',
    'REMETENTE',
    'ENDEREÇO',
    'ENDERECO',
    'BAIRRO',
    'MUNICÍPIO',
    'MUNICIPIO',
    'CÁLCULO DO IMPOSTO',
    'CALCULO DO IMPOSTO',
    'CHAVE DE ACESSO',
  ];
  if (forbidden.some((f) => upper === f || upper.startsWith(f))) {
    return undefined;
  }
  return clean;
}

/**
 * Extrai campos fiscais de texto estruturado de DANFE (PDF ou OCR)
 */
export function parsePdfText(text: string): ParsedInvoiceData {
  const result: ParsedInvoiceData = {
    parser_type: 'pdf',
    raw_text: text.slice(0, 4000),
  };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // 1. Chave de Acesso (44 dígitos numéricos — com ou sem espaços/pontos/hífens)
  const keyPatterns = [
    /\b((?:\d{4}[\s.-]?){10}\d{4})\b/g,
    /\b(\d{44})\b/g,
  ];
  for (const pat of keyPatterns) {
    for (const m of text.matchAll(pat)) {
      const digits = m[1].replace(/\D/g, '');
      if (digits.length === 44) {
        const decoded = decodeNfeAccessKey(digits);
        if (decoded) {
          result.access_key = digits;
          result.invoice_number = decoded.invoiceNumber;
          result.series = decoded.series;
          result.issuer_document = decoded.issuerCnpj;
          break;
        }
      }
    }
    if (result.access_key) break;
  }

  // 2. Protocolo de Autorização SEFAZ (15 dígitos)
  const protocolBlock =
    text.match(/PROTOCOLO\s+DE\s+AUTORIZA[CÇ][AÃ]O[^\n]*\n?([^\n]{0,120})/i)?.[0] || '';
  const protocolMatch =
    protocolBlock.match(/\b(\d{15})\b/) ||
    text.match(/(?:protocolo\s*(?:de)?\s*(?:autoriza[cç][aã]o|uso)?|n[ºo°]?\s*prot(?:ocolo)?)[^\d]{0,35}(\d{15})/i) ||
    text.match(/\b(1[1-5]\d{13})\b/) ||
    text.match(/\b(2[1-5]\d{13})\b/) ||
    text.match(/\b(3[1-5]\d{13})\b/);

  if (protocolMatch) {
    result.sefaz_protocol = protocolMatch[1];
  }

  // 3. Número da NF e Série (fallback caso não haja chave de acesso)
  if (!result.invoice_number) {
    const nfMatch =
      text.match(/N[ºo°]\.?\s*[:.]?\s*0*([1-9]\d{0,8}(?:\.\d{3})*)\b/i) ||
      text.match(/NF-e[\s\S]{0,40}?N[ºo°]\.?\s*0*([1-9]\d{0,8})\b/i);
    if (nfMatch) {
      result.invoice_number = nfMatch[1].replace(/\D/g, '');
    }
  }

  if (!result.series) {
    const serieMatch = text.match(/S[ÉE]RIE\s*[:.]?\s*0*(\d{1,3})\b/i);
    if (serieMatch) {
      result.series = serieMatch[1];
    }
  }

  // 4. Data de Emissão (mesma linha ou linha seguinte ao rótulo DATA DA EMISSÃO)
  for (let i = 0; i < lines.length; i++) {
    if (/DATA\s+(?:DA\s+)?EMISS[ÃA]O/i.test(lines[i])) {
      const sameLine = lines[i].match(/(\d{2}\/\d{2}\/\d{4})/);
      if (sameLine) {
        result.issue_date = normalizeDateStr(sameLine[1]);
        break;
      }
      if (i + 1 < lines.length) {
        const nextLineDates = [...lines[i + 1].matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((m) => m[1]);
        if (nextLineDates.length > 0) {
          // Na DANFE, DATA DA EMISSÃO costuma ser a última coluna da linha do Nome/Razão Social
          result.issue_date = normalizeDateStr(nextLineDates[nextLineDates.length - 1]);
          break;
        }
      }
    }
  }
  if (!result.issue_date) {
    const protDate = protocolBlock.match(/(\d{2}\/\d{2}\/\d{4})/);
    const anyDate = text.match(/\b(\d{2}\/\d{2}\/20\d{2})\b/);
    result.issue_date = normalizeDateStr(protDate?.[1] || anyDate?.[1]);
  }

  // 5. Valor Total da Nota (procura no bloco VALOR TOTAL DA NOTA — mesma linha ou 1-2 linhas abaixo)
  const moneyRegex = /\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
  for (let i = 0; i < lines.length; i++) {
    if (/VALOR\s+TOTAL\s+DA\s+NOTA|V\.?\s*TOTAL\s+DA\s+NOTA/i.test(lines[i])) {
      // Primeiro tenta na mesma linha após o rótulo
      const afterLabel = lines[i].split(/VALOR\s+TOTAL\s+DA\s+NOTA|V\.?\s*TOTAL\s+DA\s+NOTA/i)[1] || '';
      const sameLineVals = [...afterLabel.matchAll(moneyRegex)].map((m) => parseMoneyValue(m[1])).filter((n): n is number => !!n && n > 0);
      if (sameLineVals.length > 0) {
        result.total_value = sameLineVals[0];
        break;
      }
      // Na DANFE padrão, os valores ficam na linha logo abaixo; VALOR TOTAL DA NOTA é a última coluna da linha
      for (let offset = 1; offset <= 2 && i + offset < lines.length; offset++) {
        const nextVals = [...lines[i + offset].matchAll(moneyRegex)]
          .map((m) => parseMoneyValue(m[1]))
          .filter((n): n is number => n !== undefined && n > 0);
        if (nextVals.length > 0) {
          result.total_value = nextVals[nextVals.length - 1];
          break;
        }
      }
      if (result.total_value) break;
    }
  }

  // Fallback para Valor Total dos Produtos se não encontrou Valor Total da Nota
  if (!result.total_value) {
    for (let i = 0; i < lines.length; i++) {
      if (/VALOR\s+TOTAL\s+DOS\s+PRODUTOS/i.test(lines[i])) {
        const nextLine = lines[i + 1] || '';
        const vals = [...(lines[i] + ' ' + nextLine).matchAll(moneyRegex)]
          .map((m) => parseMoneyValue(m[1]))
          .filter((n): n is number => !!n && n > 0);
        if (vals.length > 0) {
          result.total_value = vals[vals.length - 1];
          break;
        }
      }
    }
  }

  // 6. Detectar Tipo (Entrada vs Emissão) e Emitente/Destinatário
  const headerTop = lines.slice(0, 12).join(' ').toLowerCase();
  const isSupplierHeader =
    headerTop.includes('shineray do brasil') ||
    headerTop.includes('bci ') ||
    headerTop.includes('importadora') ||
    headerTop.includes('foston') ||
    headerTop.includes('ibike') ||
    headerTop.includes('fabrica');

  const isOurStoreIssuer =
    (result.issuer_document && result.issuer_document.startsWith('18456789')) ||
    headerTop.includes('l1ma motors') ||
    headerTop.includes('lima motors') ||
    headerTop.includes('shineray grupo l1ma');

  if (isSupplierHeader && !isOurStoreIssuer) {
    result.fiscal_type = 'entrada';
  } else if (isOurStoreIssuer) {
    result.fiscal_type = 'emissao';
  } else if (/\b0\s*[-–]\s*ENTRADA\b/i.test(text) && !/\b1\s*[-–]\s*SA[IÍ]DA\b/i.test(text)) {
    result.fiscal_type = 'entrada';
  }

  // 7. Nome do Destinatário / Cliente (ou Fornecedor se Entrada)
  for (let i = 0; i < lines.length; i++) {
    if (/NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL/i.test(lines[i])) {
      // Tenta na mesma linha depois do rótulo
      const after = lines[i].split(/NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL/i)[1] || '';
      const fromSame = sanitizePartyName(after);
      if (fromSame) {
        result.customer_name = fromSame;
        break;
      }
      // Tenta na linha imediatamente abaixo
      if (i + 1 < lines.length) {
        const fromNext = sanitizePartyName(lines[i + 1]);
        if (fromNext) {
          result.customer_name = fromNext;
          break;
        }
      }
    }
  }

  // Se for entrada da fábrica Shineray, define o fornecedor se o destinatário for a própria loja
  if (result.fiscal_type === 'entrada') {
    const custLower = (result.customer_name || '').toLowerCase();
    if (!result.customer_name || custLower.includes('l1ma') || custLower.includes('shineray grupo')) {
      if (headerTop.includes('shineray do brasil')) {
        result.customer_name = 'Shineray do Brasil S.A.';
      } else if (headerTop.includes('foston')) {
        result.customer_name = 'Foston';
      } else if (headerTop.includes('ibike')) {
        result.customer_name = 'IBike';
      }
    }
  }

  // 8. CPF / CNPJ do Destinatário
  const cpfMatch = text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
  const allCnpjs = [...text.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)].map((m) => m[1]);
  if (cpfMatch) {
    result.customer_document = cpfMatch[1].replace(/\D/g, '');
  } else if (allCnpjs.length > 0) {
    result.customer_document = allCnpjs[allCnpjs.length - 1].replace(/\D/g, '');
  }

  // 9. Chassi (17 caracteres padrão VIN — sem I, O, Q)
  const chassiMatch =
    text.match(/(?:CHASSI|VIN|N[ºo°]\s*CHASSI)[^\w]{0,12}([A-HJ-NPR-Z0-9]{17})\b/i) ||
    text.match(/\b(99H[A-HJ-NPR-Z0-9]{14})\b/i) ||
    text.match(/\b(95V[A-HJ-NPR-Z0-9]{14})\b/i) ||
    text.match(/\b(9C[A-HJ-NPR-Z0-9]{15})\b/i) ||
    text.match(/\b(L[A-HJ-NPR-Z0-9]{16})\b/i);

  if (chassiMatch) {
    result.vehicle_chassis = chassiMatch[1].toUpperCase();
  }

  // 10. Modelo da motocicleta / produto
  const modelMatch = text.match(
    /\b((?:NEW\s+)?(?:JET\s*125|SHI\s*175|SHI\s*250|PHOENIX\s*(?:50|S)?|FREE\s*(?:150|170)|JEF\s*150|WORKER\s*(?:125|150)|STORM\s*200|RIO\s*125|TITANIUM\s*250|SBM\s*250S?|URBAN\s*150|XY\s*\d+|GT6X|QUATRO\s*E|GOAT|PASSION|X15\s*MAX)[^\n,;|]{0,25})/i
  );
  if (modelMatch) {
    result.vehicle_model = modelMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 11. Loja Emissora / Destino
  const detectedStore = detectStoreFromText(text);
  if (detectedStore) {
    result.store_id = detectedStore.store_id;
    result.store_name = detectedStore.store_name;
  }

  result.vehicle_brand = /FOSTON/i.test(text)
    ? 'FOSTON'
    : /IBIKE/i.test(text)
    ? 'IBIKE'
    : 'SHINERAY';

  return result;
}

/**
 * Lê e analisa automaticamente qualquer arquivo de Nota Fiscal anexado
 * Suporta XML (.xml), PDF (.pdf via PDF.js + fallback OCR) e imagens (.png/.jpg via OCR)
 */
export async function parseInvoiceFile(file: File): Promise<ParsedInvoiceData> {
  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  // 1. Arquivo XML Oficial de NF-e
  if (fileName.endsWith('.xml') || fileType.includes('xml')) {
    const text = await file.text();
    return parseNfeXml(text);
  }

  // 2. Arquivo PDF de DANFE (extração real com PDF.js + fallback OCR)
  if (fileName.endsWith('.pdf') || fileType.includes('pdf')) {
    try {
      const { text, usedOcr } = await extractTextFromPdf(file);
      if (text && text.length > 0) {
        const parsed = parsePdfText(text);
        parsed.parser_type = 'pdf';
        parsed.used_ocr = usedOcr;
        return parsed;
      }
    } catch (err) {
      console.warn('[invoiceFileParser] Erro ao extrair texto do PDF via pdfjs-dist:', err);
    }

    // Fallback final caso pdfjs falhe por algum motivo inesperado
    try {
      const buffer = await file.arrayBuffer();
      const rawText = new TextDecoder('latin1').decode(new Uint8Array(buffer));
      const textChunk = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
      const parsed = parsePdfText(textChunk);
      parsed.parser_type = 'pdf';
      return parsed;
    } catch {
      return { parser_type: 'pdf' };
    }
  }

  // 3. Imagem de DANFE (JPG / PNG / WEBP) via OCR Tesseract.js
  if (
    fileType.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp)$/i.test(fileName)
  ) {
    try {
      const { recognize } = await import('tesseract.js');
      const ocrRes = await recognize(file, 'por');
      const ocrText = (ocrRes?.data?.text || '').trim();
      const parsed = parsePdfText(ocrText);
      parsed.parser_type = 'image';
      parsed.used_ocr = true;
      return parsed;
    } catch (err) {
      console.warn('[invoiceFileParser] Erro ao executar OCR na imagem da NF:', err);
      return { parser_type: 'image' };
    }
  }

  // 4. Fallback: Leitura como texto plano
  try {
    const text = await file.text();
    if (text.includes('<nfeProc') || text.includes('<infNFe') || text.includes('<NFe')) {
      return parseNfeXml(text);
    }
    return parsePdfText(text);
  } catch {
    return {
      parser_type: 'text',
    };
  }
}
