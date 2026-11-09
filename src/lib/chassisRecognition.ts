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

interface StoredVehiclePattern {
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

const DEFAULT_PATTERNS: StoredVehiclePattern[] = [
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SHF250', model_name: 'SHI 250 EFI', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 18900, default_sale_price: 23330 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'R1F125', model_name: 'RIO 125 EFI', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 10500, default_sale_price: 13490 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'SHF175', model_name: 'SHI 175 EFI', engine_cc: 175, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 14200, default_sale_price: 17990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'NS1175', model_name: 'SHI 175 CARBURADA', engine_cc: 175, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 13500, default_sale_price: 17500 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'NJ1125', model_name: 'NEW JET 125 SS', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 9800, default_sale_price: 12690 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'JTS125', model_name: 'JET 125 SS', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 12, default_purchase_price: 9800, default_sale_price: 12690 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'PHS050', model_name: 'PHOENIX 50 EFI', engine_cc: 50, fuel_type: 'gasolina', transmission: 'semi_automatico', warranty_months: 6, default_purchase_price: 6200, default_sale_price: 7990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'STF200', model_name: 'STORM 200 EFI', engine_cc: 200, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 16900, default_sale_price: 20990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'DVF250', model_name: 'DENVER 250', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 22900, default_sale_price: 28990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'WRK125', model_name: 'WORKER 125', engine_cc: 125, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 6, default_purchase_price: 7400, default_sale_price: 9490 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'TIT250', model_name: 'TITANIUM 250 EFI', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 20500, default_sale_price: 25990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'FREE150', model_name: 'FREE 150 EFI', engine_cc: 150, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 11800, default_sale_price: 14990 },
  { wmi_code: '99H', brand: 'SHINERAY', vehicle_type: 'moto', model_pattern: 'CS2170', model_name: 'SHI 170', engine_cc: 170, fuel_type: 'gasolina', transmission: 'manual', warranty_months: 12, default_purchase_price: 12000, default_sale_price: 15000 },
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
export async function recognizeFromChassis(chassis: string): Promise<VehiclePattern | null> {
  if (!chassis || chassis.length < 3) return null;

  const vin = chassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin.length < 3) return null;

  const { data: allPatterns, error } = await supabase
    .from('chassis_patterns')
    .select('*');

  const patternSource = (allPatterns && allPatterns.length > 0) ? allPatterns : DEFAULT_PATTERNS;

  const sorted = [...patternSource]
    .map((pattern) => ({
      ...pattern,
      wmi_code: normalizePatternToken(pattern.wmi_code),
      model_pattern: normalizePatternToken(pattern.model_pattern),
    }))
    .sort((a, b) => getPatternSpecificity(b) - getPatternSpecificity(a));

  const matched = sorted.filter((pattern) => patternMatchesVin(vin, pattern));
  if (matched.length === 0) return null;

  return toVehiclePattern(matched[0]);
}

function normalizeFuelType(fuel: string | null): string | undefined {
  if (!fuel) return undefined;
  const lower = fuel.toLowerCase().trim();
  const map: Record<string, string> = {
    'flex': 'flex', 'gasolina': 'gasolina', 'etanol': 'etanol',
    'diesel': 'diesel', 'elétrico': 'eletrico', 'eletrico': 'eletrico',
    'híbrido': 'hibrido', 'hibrido': 'hibrido',
  };
  return map[lower] || lower;
}

function normalizePatternToken(value?: string | null): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getPatternSpecificity(pattern: StoredVehiclePattern): number {
  const wmi = normalizePatternToken(pattern.wmi_code);
  const model = normalizePatternToken(pattern.model_pattern);
  return Math.max(wmi.length, model.length, `${wmi}${model}`.length);
}

function patternMatchesVin(vin: string, pattern: StoredVehiclePattern): boolean {
  const wmi = normalizePatternToken(pattern.wmi_code);
  const model = normalizePatternToken(pattern.model_pattern);

  if (!wmi && !model) return false;

  if (model) {
    if (vin.startsWith(model)) return true;
    if (wmi && vin.startsWith(`${wmi}${model}`)) return true;
    if (wmi && vin.startsWith(wmi) && vin.slice(wmi.length).includes(model)) return true;
  }

  return !!wmi && vin.startsWith(wmi);
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
