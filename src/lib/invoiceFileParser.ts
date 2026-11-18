/**
 * Parser Inteligente de Arquivos de Nota Fiscal (XML e DANFE PDF)
 * Extrai automaticamente todos os dados fiscais, protocolo SEFAZ, chave de acesso,
 * dados do comprador e do veículo/moto.
 */

import { STORE_DIVINOPOLIS_UUID, STORE_MONTESCLAROS_UUID } from '@/hooks/useStores';

export interface ParsedInvoiceData {
  invoice_number?: string;
  series?: string;
  access_key?: string; // 44 dígitos
  sefaz_protocol?: string; // Protocolo de autorização SEFAZ (15 dígitos)
  issue_date?: string; // YYYY-MM-DD
  operation_nature?: string;
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
  raw_text?: string;
}

/**
 * Normaliza formato de data brasileira (DD/MM/YYYY) para ISO (YYYY-MM-DD)
 */
function normalizeDateStr(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

/**
 * Converte valor em formato string monetário para number
 */
function parseMoneyValue(val?: string | null): number | undefined {
  if (!val) return undefined;
  const clean = val.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return undefined;
  // Se contiver vírgula como decimal (padrão BR)
  if (clean.includes(',')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

/**
 * Parser de XML da NF-e (Padrão Nacional SEFAZ)
 */
export function parseNfeXml(xmlString: string): ParsedInvoiceData {
  const result: ParsedInvoiceData = {
    parser_type: 'xml',
    raw_text: xmlString.slice(0, 2000),
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // 1. Chave de Acesso (44 dígitos)
    const infNFe = doc.querySelector('infNFe');
    const idAttr = infNFe?.getAttribute('Id') || '';
    const keyMatch = idAttr.replace(/\D/g, '');
    if (keyMatch.length === 44) {
      result.access_key = keyMatch;
    } else {
      const chNFeEl = doc.querySelector('chNFe') || doc.querySelector('chNFeProt');
      const chClean = chNFeEl?.textContent?.replace(/\D/g, '') || '';
      if (chClean.length === 44) {
        result.access_key = chClean;
      }
    }

    // 2. Protocolo de Autorização SEFAZ (15 dígitos)
    const nProtEl = doc.querySelector('protNFe > infProt > nProt') || doc.querySelector('nProt');
    if (nProtEl?.textContent) {
      result.sefaz_protocol = nProtEl.textContent.trim();
    }

    // 3. Dados Básicos da NF (ide)
    const nNF = doc.querySelector('ide > nNF')?.textContent?.trim();
    if (nNF) result.invoice_number = nNF;

    const serie = doc.querySelector('ide > serie')?.textContent?.trim();
    if (serie) result.series = serie;

    const dhEmi = doc.querySelector('ide > dhEmi, ide > dEmi')?.textContent?.trim();
    if (dhEmi) {
      result.issue_date = normalizeDateStr(dhEmi);
    }

    const natOp = doc.querySelector('ide > natOp')?.textContent?.trim();
    if (natOp) result.operation_nature = natOp;

    // 4. Emitente / Loja
    const emitNome = doc.querySelector('emit > xNome')?.textContent?.trim() || '';
    const emitCnpj = doc.querySelector('emit > CNPJ')?.textContent?.trim() || '';
    const emitMun = doc.querySelector('emit > enderEmit > xMun')?.textContent?.trim() || '';

    const emitFull = `${emitNome} ${emitCnpj} ${emitMun}`.toLowerCase();
    if (emitFull.includes('montes') || emitFull.includes('moc')) {
      result.store_id = STORE_MONTESCLAROS_UUID;
      result.store_name = 'Concessionária Montes Claros';
    } else if (emitFull.includes('divin')) {
      result.store_id = STORE_DIVINOPOLIS_UUID;
      result.store_name = 'Concessionária Divinópolis';
    }

    // 5. Destinatário / Comprador (dest)
    const xNome = doc.querySelector('dest > xNome')?.textContent?.trim();
    if (xNome) result.customer_name = xNome;

    const cpfCnpj = doc.querySelector('dest > CPF, dest > CNPJ')?.textContent?.trim();
    if (cpfCnpj) result.customer_document = cpfCnpj;

    const fone = doc.querySelector('dest > enderDest > fone')?.textContent?.trim();
    if (fone) result.customer_phone = fone;

    const email = doc.querySelector('dest > email')?.textContent?.trim();
    if (email) result.customer_email = email;

    // Endereço do Destinatário
    const xLgr = doc.querySelector('dest > enderDest > xLgr')?.textContent?.trim() || '';
    const nro = doc.querySelector('dest > enderDest > nro')?.textContent?.trim() || '';
    const xCpl = doc.querySelector('dest > enderDest > xCpl')?.textContent?.trim() || '';
    const xBairro = doc.querySelector('dest > enderDest > xBairro')?.textContent?.trim() || '';
    const xMun = doc.querySelector('dest > enderDest > xMun')?.textContent?.trim() || '';
    const uf = doc.querySelector('dest > enderDest > UF')?.textContent?.trim() || '';
    const cep = doc.querySelector('dest > enderDest > CEP')?.textContent?.trim() || '';

    result.customer_city = xMun;
    result.customer_state = uf;
    result.customer_zip = cep;

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

    // 6. Valor Total da NF
    const vNF = doc.querySelector('total > ICMSTot > vNF')?.textContent?.trim();
    if (vNF) {
      result.total_value = parseFloat(vNF);
    }

    // 7. Dados do Veículo / Motocicleta
    const xProd = doc.querySelector('det > prod > xProd')?.textContent?.trim();
    if (xProd) {
      result.vehicle_model = xProd;
    }

    const veicChassi = doc.querySelector('det > prod > veicProd > chassi')?.textContent?.trim();
    if (veicChassi) {
      result.vehicle_chassis = veicChassi.toUpperCase();
    } else if (xProd) {
      const chassisInProd = xProd.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
      if (chassisInProd) result.vehicle_chassis = chassisInProd[1].toUpperCase();
    }

    const veicCor = doc.querySelector('det > prod > veicProd > xCor')?.textContent?.trim();
    if (veicCor) result.vehicle_color = veicCor;

    const anoMod = doc.querySelector('det > prod > veicProd > anoMod')?.textContent?.trim();
    if (anoMod) result.vehicle_year = parseInt(anoMod, 10);

    result.vehicle_brand = 'SHINERAY';

    // 8. Alienação / Pagamento
    const tPag = doc.querySelector('pag > detPag > tPag')?.textContent?.trim();
    if (tPag === '01') result.alienacao = 'À VISTA (DINHEIRO)';
    else if (tPag === '03') result.alienacao = 'CARTÃO DE CRÉDITO';
    else if (tPag === '17') result.alienacao = 'PIX';
    else if (tPag === '16') result.alienacao = 'FINANCIAMENTO';
  } catch (err) {
    console.warn('Erro ao processar DOM XML da NF-e, aplicando fallback regex:', err);
  }

  // Fallbacks de Regex para garantir que nada passe em branco
  if (!result.access_key) {
    const kMatch = xmlString.match(/Id=["']NFe(\d{44})["']/i) || xmlString.match(/<chNFe>(\d{44})<\/chNFe>/i);
    if (kMatch) result.access_key = kMatch[1];
  }

  if (!result.sefaz_protocol) {
    const pMatch = xmlString.match(/<nProt>(\d+)<\/nProt>/i);
    if (pMatch) result.sefaz_protocol = pMatch[1];
  }

  if (!result.invoice_number) {
    const nMatch = xmlString.match(/<nNF>(\d+)<\/nNF>/i);
    if (nMatch) result.invoice_number = nMatch[1];
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
    const chMatch = xmlString.match(/<chassi>([^<]+)<\/chassi>/i) || xmlString.match(/\b([9A-HJ-NPR-Z][A-HJ-NPR-Z0-9]{16})\b/i);
    if (chMatch) result.vehicle_chassis = chMatch[1].trim().toUpperCase();
  }

  if (!result.total_value) {
    const vMatch = xmlString.match(/<vNF>([^<]+)<\/vNF>/i);
    if (vMatch) result.total_value = parseFloat(vMatch[1]);
  }

  return result;
}

/**
 * Extrai texto bruto e campos fiscais de um arquivo PDF ou de texto
 */
export function parsePdfText(text: string): ParsedInvoiceData {
  const result: ParsedInvoiceData = {
    parser_type: 'pdf',
    raw_text: text.slice(0, 3000),
  };

  // 1. Chave de Acesso (44 dígitos numéricos)
  // No DANFE PDF muitas vezes vem formatada em blocos de 4 dígitos: 3124 1112 3456 ...
  const formattedKeyMatch = text.match(/\b(\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4})\b/);
  if (formattedKeyMatch) {
    const cleanKey = formattedKeyMatch[1].replace(/\D/g, '');
    if (cleanKey.length === 44) {
      result.access_key = cleanKey;
    }
  }

  if (!result.access_key) {
    const raw44Match = text.match(/\b(\d{44})\b/);
    if (raw44Match) result.access_key = raw44Match[1];
  }

  // 2. Protocolo de Autorização SEFAZ (15 dígitos)
  // Ex: "Protocolo de autorização de uso: 131260001234567" ou "131240001234567"
  const protocolMatch =
    text.match(/(?:protocolo\s*(?:de)?\s*(?:autoriza[cç][aã]o|uso)?|n[ºo]?\s*prot(?:ocolo)?)[^\d]{0,25}(\d{15})/i) ||
    text.match(/\b(131\d{12})\b/) ||
    text.match(/\b(132\d{12})\b/) ||
    text.match(/\b(\d{15})\b/);

  if (protocolMatch) {
    result.sefaz_protocol = protocolMatch[1];
  }

  // 3. Número da NF e Série
  const nfMatch =
    text.match(/(?:DANFE.*?N[ºo°]\.?|N[ºo°]\.?\s*(?:DA\s*NOTA)?|N[ºo°]\s*:\s*)(\d{1,9})\b/i) ||
    text.match(/N[ºo°]\.?\s*0*([1-9]\d{0,8})\b/i);
  if (nfMatch) {
    result.invoice_number = nfMatch[1].replace(/\D/g, '');
  }

  const serieMatch = text.match(/S[ée]rie\s*[:.]?\s*(\d{1,3})\b/i);
  if (serieMatch) {
    result.series = serieMatch[1];
  }

  // 4. Data de Emissão (DD/MM/YYYY)
  const dateMatch =
    text.match(/(?:DATA\s*(?:DA\s*)?EMISS[ÃA]O|EMISS[ÃA]O)[^\d]{0,20}(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
    text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (dateMatch) {
    result.issue_date = normalizeDateStr(dateMatch[1]);
  }

  // 5. CPF / CNPJ do Destinatário
  const cnpjMatch = text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  const cpfMatch = text.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);

  if (cpfMatch) {
    result.customer_document = cpfMatch[1].replace(/\D/g, '');
  } else if (cnpjMatch) {
    // Evita pegar o CNPJ do emitente caso haja mais de um
    const allCnpjs = [...text.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)].map((m) => m[1]);
    if (allCnpjs.length > 1) {
      result.customer_document = allCnpjs[allCnpjs.length - 1].replace(/\D/g, '');
    } else {
      result.customer_document = cnpjMatch[1].replace(/\D/g, '');
    }
  }

  // 6. Chassi (17 caracteres)
  const chassiMatch =
    text.match(/(?:CHASSI|VIN|N[ºo°]\s*CHASSI)[^\w]{0,10}([A-HJ-NPR-Z0-9]{17})\b/i) ||
    text.match(/\b(99H[A-HJ-NPR-Z0-9]{14})\b/i) ||
    text.match(/\b(95V[A-HJ-NPR-Z0-9]{14})\b/i) ||
    text.match(/\b([9A-Z][A-HJ-NPR-Z0-9]{16})\b/);

  if (chassiMatch) {
    result.vehicle_chassis = chassiMatch[1].toUpperCase();
  }

  // 7. Valor Total da NF
  const totalMatch =
    text.match(/(?:VALOR\s*TOTAL\s*(?:DA\s*NOTA)?|V\.?\s*TOTAL)[^\d]{0,25}(?:R\$\s*)?([\d.,]+)/i) ||
    text.match(/(?:TOTAL\s*DA\s*NOTA)[^\d]{0,25}(?:R\$\s*)?([\d.,]+)/i);

  if (totalMatch) {
    result.total_value = parseMoneyValue(totalMatch[1]);
  }

  // 8. Nome do Cliente
  const destNameMatch = text.match(/(?:DESTINAT[ÁA]RIO\s*\/?\s*REMETENTE|NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL)[\s\S]{0,80}?(?:NOME\s*:\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{5,60})/i);
  if (destNameMatch) {
    const rawName = destNameMatch[1].trim();
    if (rawName && !rawName.includes('CNPJ') && !rawName.includes('ENDERE')) {
      result.customer_name = rawName;
    }
  }

  // 9. Loja Emissora (Montes Claros ou Divinópolis)
  const lowerText = text.toLowerCase();
  if (lowerText.includes('montes claros') || lowerText.includes('moc')) {
    result.store_id = STORE_MONTESCLAROS_UUID;
    result.store_name = 'Concessionária Montes Claros';
  } else if (lowerText.includes('divinópolis') || lowerText.includes('divinopolis')) {
    result.store_id = STORE_DIVINOPOLIS_UUID;
    result.store_name = 'Concessionária Divinópolis';
  }

  result.vehicle_brand = 'SHINERAY';

  return result;
}

/**
 * Lê e analisa automaticamente qualquer arquivo de Nota Fiscal anexado
 * Suporta XML (.xml), PDF (.pdf) e imagens/textos
 */
export async function parseInvoiceFile(file: File): Promise<ParsedInvoiceData> {
  const fileName = (file.name || '').toLowerCase();
  const fileType = (file.type || '').toLowerCase();

  // 1. Arquivo XML Oficial de NF-e
  if (fileName.endsWith('.xml') || fileType.includes('xml')) {
    const text = await file.text();
    return parseNfeXml(text);
  }

  // 2. Arquivo PDF de DANFE
  if (fileName.endsWith('.pdf') || fileType.includes('pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      // Extrai cadeias de caracteres legíveis do buffer do PDF
      const bytes = new Uint8Array(buffer);
      let textChunk = '';
      
      // Decodificação rápida de strings UTF-8 / Latin-1 em blocos
      const decoder = new TextDecoder('latin1');
      const rawText = decoder.decode(bytes);

      // Limpa caracteres de controle para análise de texto
      textChunk = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');

      const parsed = parsePdfText(textChunk);
      parsed.parser_type = 'pdf';
      return parsed;
    } catch (err) {
      console.warn('Erro ao decodificar PDF diretamente:', err);
    }
  }

  // 3. Fallback: Leitura como texto plano se suportado
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
