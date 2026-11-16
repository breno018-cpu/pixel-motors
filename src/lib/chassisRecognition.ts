import { supabase } from '@/integrations/supabase/client';

interface VehiclePattern {
  brand: string;
  model?: string;
  engine_cc?: number;
  vehicle_type: 'moto' | 'carro';
  fuel_type?: string;
  transmission?: string;
  warranty_months?: number;
  revision_period_months?: number;
  revision_period_km?: number;
  default_purchase_price?: number;
  default_sale_price?: number;
}

export interface StoredVehiclePattern {
  brand: string;
  model_name: string | null;
  engine_cc: number | null;
  vehicle_type: string;
  fuel_type: string | null;
  wmi_code: string;
  model_pattern: string | null;
  transmission?: string | null;
  warranty_months?: number | null;
  service_interval_months?: number | null;
  service_interval_km?: number | null;
  default_purchase_price?: number | null;
  default_sale_price?: number | null;
}

export const DEFAULT_PATTERNS: StoredVehiclePattern[] = [
  // --- SHINERAY MOTOS (Linha Oficial) ---
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'JTS125', model_name: 'JET 125', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 9800, default_sale_price: 13990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'NJ1125', model_name: 'NEW JET 125', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 9800, default_sale_price: 14990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SHF175', model_name: 'SHI 175 EFI', engine_cc: 175, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 14200, default_sale_price: 19990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'NS1175', model_name: 'NEW SHI 175', engine_cc: 175, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 13500, default_sale_price: 18990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SHF250', model_name: 'SHI 250 EFI', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 18900, default_sale_price: 22990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'PHS050', model_name: 'PHOENIX 50', engine_cc: 50, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 6, default_purchase_price: 6200, default_sale_price: 9990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'XY50', model_name: 'PHOENIX 50', engine_cc: 50, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 6, default_purchase_price: 6200, default_sale_price: 9990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'R1C125', model_name: 'RIO 125', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 10000, default_sale_price: 12990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'R1F125', model_name: 'RIO 125 EFI', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 10500, default_sale_price: 13490 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'STF200', model_name: 'STORM 200', engine_cc: 200, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 16900, default_sale_price: 23990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'DVF250', model_name: 'DENVER 250', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 22900, default_sale_price: 28990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'TTF250', model_name: 'TITANIUM 250', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 20500, default_sale_price: 27990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'TIT250', model_name: 'TITANIUM 250', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 20500, default_sale_price: 27990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'FREE150', model_name: 'FREE 150', engine_cc: 150, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 11800, default_sale_price: 14990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'CS2170', model_name: 'NEW FREE 170', engine_cc: 170, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 12000, default_sale_price: 15990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'JF1150', model_name: 'JEF 150', engine_cc: 150, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 11500, default_sale_price: 14500 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'JF1170', model_name: 'NEW JEF 170', engine_cc: 170, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 13900, default_sale_price: 17990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SW1400', model_name: 'SCRAMBLER 400', engine_cc: 400, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 26000, default_sale_price: 26990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SB1400', model_name: 'SBM 400S', engine_cc: 400, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 26000, default_sale_price: 36990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SB1250', model_name: 'SBM 250S', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 36, default_purchase_price: 21000, default_sale_price: 26990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SB3250', model_name: 'SBM 250S', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 36, default_purchase_price: 21000, default_sale_price: 26990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'ST1250', model_name: 'SBM 250 T 6B', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 36, default_purchase_price: 21000, default_sale_price: 26990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SB4400', model_name: 'DENVER 400', engine_cc: 400, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 36, default_purchase_price: 28000, default_sale_price: 35990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'ARF250', model_name: 'IRON 250', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 21000, default_sale_price: 25990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'FLF250', model_name: 'FLASH 250', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 21000, default_sale_price: 23990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'ULF150', model_name: 'URBAN LITE 150', engine_cc: 150, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 12500, default_sale_price: 17990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'URB150', model_name: 'URBAN 150', engine_cc: 150, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 16000, default_sale_price: 22990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'WRK125', model_name: 'WORKER 125', engine_cc: 125, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 6, default_purchase_price: 7400, default_sale_price: 9490 },

  // --- HONDA MOTOS ---
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'KC09', model_name: 'CG 160 FAN', engine_cc: 162, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 14500, default_sale_price: 18500 },
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'KC08', model_name: 'CG 160 TITAN', engine_cc: 162, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 15500, default_sale_price: 19900 },
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'KC10', model_name: 'CG 160 START', engine_cc: 162, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 13000, default_sale_price: 16500 },
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'JC75', model_name: 'BIZ 125', engine_cc: 124, fuel_type: 'flex', transmission: 'semi_automatico', warranty_months: 36, default_purchase_price: 13500, default_sale_price: 17200 },
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'JC67', model_name: 'POP 110I', engine_cc: 109, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 36, default_purchase_price: 9000, default_sale_price: 11500 },
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'KC13', model_name: 'NXR 160 BROS', engine_cc: 162, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 18000, default_sale_price: 22500 },
  { wmi_code: '9C2', brand: 'HONDA', vehicle_type: 'moto', model_pattern: 'PC62', model_name: 'CB 300F TWISTER', engine_cc: 293, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 21000, default_sale_price: 25900 },

  // --- YAMAHA MOTOS ---
  { wmi_code: '9C6', brand: 'YAMAHA', vehicle_type: 'moto', model_pattern: 'RG02', model_name: 'FAZER FZ25', engine_cc: 249, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 19500, default_sale_price: 24500 },
  { wmi_code: '9C6', brand: 'YAMAHA', vehicle_type: 'moto', model_pattern: 'KE19', model_name: 'FACTOR 150', engine_cc: 149, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 13500, default_sale_price: 17500 },
  { wmi_code: '9C6', brand: 'YAMAHA', vehicle_type: 'moto', model_pattern: 'KE18', model_name: 'CROSSER 150', engine_cc: 149, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 17500, default_sale_price: 21900 },
  { wmi_code: '9C6', brand: 'YAMAHA', vehicle_type: 'moto', model_pattern: 'RG01', model_name: 'LANDER 250', engine_cc: 249, fuel_type: 'flex', transmission: 'manual', warranty_months: 36, default_purchase_price: 22500, default_sale_price: 27900 },
];

const DEFAULT_YEAR_CODES = [
  { year_code: 'VS', model_year: 2026, manufacture_year: 2026, brand: 'SHINERAY' },
  { year_code: 'V', model_year: 2026, manufacture_year: 2026, brand: 'SHINERAY' },
  { year_code: 'TS', model_year: 2026, manufacture_year: 2025, brand: 'SHINERAY' },
  { year_code: 'T', model_year: 2026, manufacture_year: 2025, brand: 'SHINERAY' },
  { year_code: 'SS', model_year: 2025, manufacture_year: 2025, brand: 'SHINERAY' },
  { year_code: 'S', model_year: 2025, manufacture_year: 2025, brand: 'SHINERAY' },
  { year_code: 'RS', model_year: 2024, manufacture_year: 2024, brand: 'SHINERAY' },
  { year_code: 'R', model_year: 2024, manufacture_year: 2024, brand: 'SHINERAY' },
  { year_code: 'WS', model_year: 2027, manufacture_year: 2026, brand: 'SHINERAY' },
];

/**
 * Recognizes vehicle data from a chassis/VIN number using database patterns
 */
/**
 * Normaliza strings para comparação de padrões de chassi.
 */
function normalizePatternToken(value?: string | null): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extrai tokens canônicos de prefixo e modelo a partir da regra salva.
 */
function getPatternTokens(pattern: StoredVehiclePattern): {
  wmi: string;
  modelPattern: string;
  fullPrefix: string;
  bareModel: string;
} {
  const rawWmi = normalizePatternToken(pattern.wmi_code);
  const rawModel = normalizePatternToken(pattern.model_pattern);

  // Em números VIN padrão, o WMI da montadora tem 3 caracteres (ex: 99H para Shineray).
  // Se wmi_code foi salvo com o código inteiro (ex: 99HNS1175), baseWmi são os 3 primeiros caracteres.
  const baseWmi = rawWmi.length > 3 ? rawWmi.slice(0, 3) : rawWmi;

  let bareModel = rawModel;
  if (baseWmi && bareModel.startsWith(baseWmi)) {
    bareModel = bareModel.slice(baseWmi.length);
  } else if (!bareModel && rawWmi.length > 3) {
    bareModel = rawWmi.slice(3);
  }

  let fullPrefix = '';
  if (baseWmi && bareModel) {
    fullPrefix = `${baseWmi}${bareModel}`;
  } else if (bareModel) {
    fullPrefix = bareModel;
  } else if (rawWmi) {
    fullPrefix = rawWmi;
  }

  return { wmi: baseWmi, modelPattern: rawModel, fullPrefix, bareModel };
}

function getPatternSpecificity(pattern: StoredVehiclePattern): number {
  const { fullPrefix } = getPatternTokens(pattern);
  return fullPrefix.length;
}

/**
 * Verifica se um VIN informado corresponde estritamente ao padrão do modelo.
 * REGRA CRÍTICA:
 * - Se o padrão possui modelo (ex: 'NJ1125', 'SHF250'), o chassi DEVE conter o código completo do modelo.
 * - NUNCA retorna true apenas por coincidir os primeiros 3 ou 4 dígitos do fabricante (ex: '99H' ou '99HN')!
 */
function patternMatchesVin(vin: string, pattern: StoredVehiclePattern): boolean {
  const { wmi, fullPrefix, bareModel } = getPatternTokens(pattern);

  if (!fullPrefix) return false;

  // Quando existe código de modelo específico:
  if (bareModel && bareModel.length >= 3) {
    // 1. Prefixo exato completo: '99HNJ1125...' começa com '99HNJ1125'
    if (fullPrefix && vin.startsWith(fullPrefix)) {
      return true;
    }

    // 2. Inserção direta sem WMI: 'NJ1125...'
    if (vin.startsWith(bareModel)) {
      return true;
    }

    // 3. Se o chassi começa com o WMI do fabricante (ex: 99H), a seção VDS (posições 4 a 10) DEVE conter o modelo
    if (wmi && vin.startsWith(wmi)) {
      const vdsPortion = vin.slice(wmi.length, Math.max(wmi.length + bareModel.length + 2, 10));
      if (vdsPortion.startsWith(bareModel) || (vdsPortion.length >= bareModel.length && vdsPortion.includes(bareModel))) {
        return true;
      }
    }

    // Se o modelo especificado não foi digitado na íntegra, NÃO É ESTE VEÍCULO!
    return false;
  }

  // Apenas se o padrão NÃO tiver modelo cadastrado (padrão genérico de marca pura):
  if (wmi && vin.startsWith(wmi)) {
    return !pattern.model_name;
  }

  return false;
}

/**
 * Reconhece dados técnicos do veículo a partir do número de chassi/VIN.
 * Só aciona quando preenchida a parte necessária para descobrir o modelo (mínimo 7 a 9 caracteres).
 */
export async function recognizeFromChassis(chassis: string): Promise<VehiclePattern | null> {
  if (!chassis) return null;

  const vin = chassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // A leitura só deve ocorrer quando a parte necessária para identificar o modelo estiver digitada
  // (WMI 3 dígitos + VDS mínimo de 4-6 dígitos = 7 a 9 caracteres).
  if (vin.length < 7) return null;

  const { data: allPatterns } = await supabase
    .from('chassis_patterns')
    .select('*');

  const patternSource = (allPatterns && allPatterns.length > 0) ? allPatterns : DEFAULT_PATTERNS;

  const sorted = [...patternSource]
    .sort((a, b) => getPatternSpecificity(b) - getPatternSpecificity(a));

  const matched = sorted.filter((pattern) => patternMatchesVin(vin, pattern));
  if (matched.length === 0) return null;

  return toVehiclePattern(matched[0]);
}

function normalizeFuelType(fuel?: string | null): string {
  if (!fuel) return 'gasolina';
  const clean = fuel.toLowerCase().trim();
  if (clean.includes('eletri')) return 'eletrico';
  if (clean.includes('flex')) return 'flex';
  if (clean.includes('diesel')) return 'diesel';
  return 'gasolina';
}

function toVehiclePattern(pattern: StoredVehiclePattern): VehiclePattern {
  return {
    brand: pattern.brand,
    model: pattern.model_name || undefined,
    engine_cc: pattern.engine_cc || undefined,
    vehicle_type: pattern.vehicle_type as 'moto' | 'carro',
    fuel_type: normalizeFuelType(pattern.fuel_type),
    transmission: pattern.transmission || undefined,
    warranty_months: pattern.warranty_months ?? undefined,
    revision_period_months: pattern.service_interval_months ?? undefined,
    revision_period_km: pattern.service_interval_km ?? undefined,
    default_purchase_price: pattern.default_purchase_price ?? undefined,
    default_sale_price: pattern.default_sale_price ?? undefined,
  };
}

/**
 * Extract model year from VIN position 10
 */
export function extractYearFromVIN(chassis: string): number | null {
  if (!chassis || chassis.length < 10) return null;
  const vin = chassis.toUpperCase();
  const yearChar = vin[9];

  const yearMap: Record<string, number[]> = {
    'A': [2010, 1980], 'B': [2011, 1981], 'C': [2012, 1982], 'D': [2013, 1983],
    'E': [2014, 1984], 'F': [2015, 1985], 'G': [2016, 1986], 'H': [2017, 1987],
    'J': [2018, 1988], 'K': [2019, 1989], 'L': [2020, 1990], 'M': [2021, 1991],
    'N': [2022, 1992], 'P': [2023, 1993], 'R': [2024, 1994], 'S': [2025, 1995],
    'T': [2026, 1996], 'V': [2027, 1997], 'W': [2028, 1998], 'X': [2029, 1999],
    'Y': [2030, 2000], '1': [2031, 2001], '2': [2032, 2002], '3': [2033, 2003],
    '4': [2034, 2004], '5': [2035, 2005], '6': [2036, 2006], '7': [2037, 2007],
    '8': [2038, 2008], '9': [2039, 2009],
  };

  const years = yearMap[yearChar];
  if (!years) return null;

  const currentYear = new Date().getFullYear();
  return years.find(y => y <= currentYear + 1) || years[0];
}

export interface YearResolution {
  year: number | null;
  /** Ano de fabricação cadastrado junto do código (opcional). */
  manufactureYear?: number | null;
  /** 'catalogo' = regra cadastrada; 'nenhum' = não há regra para este chassi. */
  source: 'catalogo' | 'nenhum';
  matchedCode?: string;
  matchedBrand?: string | null;
}

/**
 * Resolve o ano/modelo usando exclusivamente o catálogo configurável
 * (posições 10 e 11 do chassi). Sem regra cadastrada, não adivinha o ano —
 * a tabela internacional de anos não vale para as marcas usadas na loja.
 */
export async function resolveModelYearFromVin(
  chassis: string,
  brand?: string | null,
): Promise<YearResolution> {
  const vin = (chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin.length < 10) return { year: null, source: 'nenhum' };

  const two = vin.slice(9, 11);
  const one = vin.slice(9, 10);

  const { data } = await supabase
    .from('chassis_year_codes')
    .select('year_code, model_year, manufacture_year, brand');

  const sourceData = (data && data.length > 0) ? data : DEFAULT_YEAR_CODES;
  const normalizedBrand = (brand || '').toUpperCase().trim();

  const candidates = sourceData
    .map((r) => ({
      code: normalizePatternToken(r.year_code),
      brand: r.brand ? r.brand.toUpperCase().trim() : null,
      model_year: r.model_year,
      manufacture_year: r.manufacture_year ?? null,
    }))
    .filter((r) => r.code.length > 0 && (r.code === two || r.code === one))
    // ignora regras de outra marca quando a marca é conhecida
    .filter((r) => !r.brand || !normalizedBrand || r.brand === normalizedBrand)
    .map((r) => ({
      ...r,
      score:
        (r.brand && normalizedBrand && r.brand === normalizedBrand ? 4 : 0) +
        (r.code.length === 2 ? 2 : 0) +
        (r.brand ? 0 : 1),
    }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return { year: null, source: 'nenhum' };

  const chosen = candidates[0];
  return {
    year: chosen.model_year,
    manufactureYear: chosen.manufacture_year,
    source: 'catalogo',
    matchedCode: chosen.code,
    matchedBrand: chosen.brand,
  };
}
