import { formatPlate } from './vehicleCatalog';
import { TheftStatus, RenajudStatus, AuctionStatus, FinanceStatus } from '@/types/inspection';

export interface ParsedCrlvData {
  plate: string;
  renavam: string;
  chassis: string;
  brand: string;
  model: string;
  year: number;
  manufacture_year?: number;
  color: string;
  engine_number?: string;
  client_name?: string;
  client_document?: string;
  theft_status: TheftStatus;
  renajud_status: RenajudStatus;
  auction_status: AuctionStatus;
  finance_status: FinanceStatus;
  notes?: string;
  rawObservations?: string;
}

/**
 * Lê e extrai dados do texto bruto de um documento CRLV-e emitido pelo Gov.br / SENATRAN
 */
export function parseCrlvText(rawText: string): ParsedCrlvData | null {
  if (!rawText || rawText.length < 20) return null;

  const text = rawText.toUpperCase();

  // 1. Placa (Mercosul ou Antiga)
  const plateMatch = text.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/);
  const plate = plateMatch ? formatPlate(plateMatch[1]) : '';

  // 2. Chassi (17 caracteres alfanuméricos padrão VIN internacional)
  const chassisMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  const chassis = chassisMatch ? chassisMatch[1] : '';

  // 3. Renavam (geralmente 11 dígitos numéricos)
  const renavamMatch = text.match(/RENAVAM\s*:?[\s\n]*([0-9]{9,11})/i) || text.match(/\b([0-9]{11})\b/);
  const renavam = renavamMatch ? renavamMatch[1] : '';

  // 4. Ano de Fabricação e Modelo (ex: 2022/2023 ou 2023)
  const yearMatch = text.match(/ANO\s*FAB\/MOD\s*:?[\s\n]*([0-9]{4})\s*\/?\s*([0-9]{4})?/i) ||
    text.match(/\b(20[0-2][0-9])\s*\/\s*(20[0-2][0-9])\b/);
  const manufacture_year = yearMatch && yearMatch[1] ? parseInt(yearMatch[1], 10) : undefined;
  const year = yearMatch && yearMatch[2] ? parseInt(yearMatch[2], 10) : (manufacture_year || new Date().getFullYear());

  // 5. Marca / Modelo
  let brand = 'HONDA';
  let model = '';
  const mmMatch = text.match(/MARCA\s*\/\s*MODELO(?:\s*\/\s*VERS[AÃ]O)?\s*:?[\s\n]*([A-Z0-9\s\-\/\.]+?)(?=\s*(?:ESP[EÉ]CIE|TIPO|PLACA|CHASSI|ANO|COR|$))/i);
  if (mmMatch && mmMatch[1]) {
    const full = mmMatch[1].trim();
    const parts = full.split(/[\/\s]+/);
    if (parts.length > 0) {
      brand = parts[0];
      model = parts.slice(1).join(' ').trim();
    }
  }

  // 6. Cor
  let color = 'Preto';
  const colorMatch = text.match(/COR(?:\s*PREDOMINANTE)?\s*:?[\s\n]*([A-Z\s]+?)(?=\s*(?:COMBUST[IÍ]VEL|CATEGORIA|POT[EÊ]NCIA|$))/i);
  if (colorMatch && colorMatch[1]) {
    color = colorMatch[1].trim();
  }

  // 7. Nome e CPF do Proprietário
  let client_name = '';
  let client_document = '';
  const nameMatch = text.match(/NOME(?:\s*DO\s*PROPRIET[AÁ]RIO)?\s*:?[\s\n]*([A-Z\s]+?)(?=\s*(?:CPF|CNPJ|ENDERE[CÇ]O|$))/i);
  if (nameMatch && nameMatch[1]) {
    client_name = nameMatch[1].trim();
  }

  const docMatch = text.match(/(?:CPF|CNPJ)\s*:?[\s\n]*([0-9\.\-\/]+)/i);
  if (docMatch && docMatch[1]) {
    client_document = docMatch[1].trim();
  }

  // 8. Observações do CRLV-e (Aqui o Detran registra Sinistro, Leilão, Alienação e Renajud)
  const obsMatch = text.match(/OBSERVA[CÇ][OÕ]ES(?:\s*DO\s*VE[IÍ]CULO)?\s*:?[\s\n]*([\s\S]+?)(?=\s*(?:LOCAL|DATA|ASSINATURA|C[OÓ]DIGO|$))/i);
  const rawObservations = obsMatch ? obsMatch[1].trim() : '';

  // Análise Jurídica Automática das Observações Oficiais
  let auction_status: AuctionStatus = 'sem_passagem';
  let theft_status: TheftStatus = 'nada_consta';
  let renajud_status: RenajudStatus = 'nada_consta';
  let finance_status: FinanceStatus = 'quitado';

  const obsUpper = (rawObservations + ' ' + text).toUpperCase();

  if (obsUpper.includes('RECUPERADO') || obsUpper.includes('SINISTRO') || obsUpper.includes('MEDIA MONTA')) {
    auction_status = 'sinistro_grave';
  } else if (obsUpper.includes('LEILAO') || obsUpper.includes('LEILÃO')) {
    auction_status = 'leilao_seguradora';
  }

  if (obsUpper.includes('ALIENACAO') || obsUpper.includes('ALIENAÇÃO') || obsUpper.includes('GRAVAME') || obsUpper.includes('FINANCIAMENTO')) {
    finance_status = 'alienacao_fiduciaria';
  }

  if (obsUpper.includes('RENAJUD') || obsUpper.includes('BLOQUEIO JUDICIAL') || obsUpper.includes('PENHORA')) {
    renajud_status = 'bloqueio_transferencia';
  }

  if (obsUpper.includes('FURTO') || obsUpper.includes('ROUBO')) {
    theft_status = 'alerta_furto_roubo';
  }

  return {
    plate: plate || 'SEM PLACA',
    renavam,
    chassis,
    brand: brand || 'HONDA',
    model: model || 'MOTO USADA',
    year: year || new Date().getFullYear(),
    manufacture_year,
    color: color || 'Não identificada',
    client_name,
    client_document,
    theft_status,
    renajud_status,
    auction_status,
    finance_status,
    rawObservations,
    notes: rawObservations ? `Observações do CRLV-e: ${rawObservations}` : undefined,
  };
}

/**
 * Lê o arquivo PDF ou TXT do CRLV-e enviado pelo usuário e extrai o texto interno
 */
export async function extractTextFromCrlvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Se for arquivo de texto ou PDF, faz a leitura dos bytes
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      
      // Converte array buffer para string procurando trechos de texto legíveis
      const uint8 = new Uint8Array(result as ArrayBuffer);
      let text = '';
      for (let i = 0; i < uint8.length; i++) {
        const charCode = uint8[i];
        // Filtra caracteres ASCII legíveis
        if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13) {
          text += String.fromCharCode(charCode);
        }
      }
      resolve(text);
    };

    reader.onerror = (e) => reject(e);

    // Tenta ler como ArrayBuffer para decodificar PDFs
    reader.readAsArrayBuffer(file);
  });
}
