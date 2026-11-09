export interface PresetModel {
  brand: string;
  model: string;
  vehicle_type: 'moto' | 'carro';
  engine_cc?: number;
  fuel_type: string;
  transmission: string;
  suggested_price?: number;
  warranty_months?: number;
}

/** Catálogo Oficial de Modelos da Concessionária Shineray do Brasil */
export const SHINERAY_OFFICIAL_LINEUP: PresetModel[] = [
  {
    brand: 'SHINERAY',
    model: 'WORKER 125',
    vehicle_type: 'moto',
    engine_cc: 125,
    fuel_type: 'Gasolina',
    transmission: 'Manual 4 velocidades',
    suggested_price: 9490,
    warranty_months: 6,
  },
  {
    brand: 'SHINERAY',
    model: 'PHOENIX 50 EFI',
    vehicle_type: 'moto',
    engine_cc: 50,
    fuel_type: 'Gasolina',
    transmission: 'Semi-automática 4 marchas',
    suggested_price: 7990,
    warranty_months: 6,
  },
  {
    brand: 'SHINERAY',
    model: 'PHOENIX S 50',
    vehicle_type: 'moto',
    engine_cc: 50,
    fuel_type: 'Gasolina',
    transmission: 'Semi-automática 4 marchas',
    suggested_price: 7490,
    warranty_months: 6,
  },
  {
    brand: 'SHINERAY',
    model: 'SHI 175 EFI',
    vehicle_type: 'moto',
    engine_cc: 175,
    fuel_type: 'Gasolina',
    transmission: 'Manual 5 velocidades',
    suggested_price: 14990,
    warranty_months: 12,
  },
  {
    brand: 'SHINERAY',
    model: 'STORM 200',
    vehicle_type: 'moto',
    engine_cc: 200,
    fuel_type: 'Gasolina',
    transmission: 'Manual 6 velocidades',
    suggested_price: 18990,
    warranty_months: 12,
  },
  {
    brand: 'SHINERAY',
    model: 'FREE 150 EFI',
    vehicle_type: 'moto',
    engine_cc: 150,
    fuel_type: 'Gasolina',
    transmission: 'Manual 5 velocidades',
    suggested_price: 10990,
    warranty_months: 12,
  },
  {
    brand: 'SHINERAY',
    model: 'JET 125 2X',
    vehicle_type: 'moto',
    engine_cc: 125,
    fuel_type: 'Gasolina',
    transmission: 'Semi-automática 4 marchas',
    suggested_price: 9990,
    warranty_months: 6,
  },
  {
    brand: 'SHINERAY',
    model: 'RIO 125 EFI',
    vehicle_type: 'moto',
    engine_cc: 125,
    fuel_type: 'Gasolina',
    transmission: 'Automática CVT',
    suggested_price: 11490,
    warranty_months: 12,
  },
  {
    brand: 'SHINERAY',
    model: 'URBAN 150 EFI',
    vehicle_type: 'moto',
    engine_cc: 150,
    fuel_type: 'Gasolina',
    transmission: 'Automática CVT',
    suggested_price: 16990,
    warranty_months: 12,
  },
  {
    brand: 'SHINERAY',
    model: 'SHE S (ELÉTRICA)',
    vehicle_type: 'moto',
    engine_cc: 0,
    fuel_type: 'Elétrico',
    transmission: 'Automática',
    suggested_price: 19990,
    warranty_months: 12,
  },
  {
    brand: 'SHINERAY',
    model: 'SE3 (SCOOTER ELÉTRICA)',
    vehicle_type: 'moto',
    engine_cc: 0,
    fuel_type: 'Elétrico',
    transmission: 'Automática',
    suggested_price: 14990,
    warranty_months: 12,
  },
];

/** Modelos de Motos Multimarcas Mais Vendidas */
export const MULTIBRAND_MOTOS: PresetModel[] = [
  { brand: 'HONDA', model: 'CG 160 TITAN', vehicle_type: 'moto', engine_cc: 160, fuel_type: 'Flex', transmission: 'Manual', suggested_price: 18500, warranty_months: 3 },
  { brand: 'HONDA', model: 'CG 160 FAN', vehicle_type: 'moto', engine_cc: 160, fuel_type: 'Flex', transmission: 'Manual', suggested_price: 17200, warranty_months: 3 },
  { brand: 'HONDA', model: 'BIZ 125', vehicle_type: 'moto', engine_cc: 125, fuel_type: 'Flex', transmission: 'Semi-automática', suggested_price: 16500, warranty_months: 3 },
  { brand: 'HONDA', model: 'NXR 160 BROS', vehicle_type: 'moto', engine_cc: 160, fuel_type: 'Flex', transmission: 'Manual', suggested_price: 21500, warranty_months: 3 },
  { brand: 'HONDA', model: 'POP 110I', vehicle_type: 'moto', engine_cc: 110, fuel_type: 'Gasolina', transmission: 'Semi-automática', suggested_price: 10800, warranty_months: 3 },
  { brand: 'YAMAHA', model: 'FAZER FZ25', vehicle_type: 'moto', engine_cc: 250, fuel_type: 'Flex', transmission: 'Manual', suggested_price: 23900, warranty_months: 3 },
  { brand: 'YAMAHA', model: 'FACTOR 150', vehicle_type: 'moto', engine_cc: 150, fuel_type: 'Flex', transmission: 'Manual', suggested_price: 16800, warranty_months: 3 },
  { brand: 'YAMAHA', model: 'CROSSER 150 Z', vehicle_type: 'moto', engine_cc: 150, fuel_type: 'Flex', transmission: 'Manual', suggested_price: 21200, warranty_months: 3 },
];

/** Modelos de Carros Multimarcas Mais Vendidos */
export const MULTIBRAND_CARS: PresetModel[] = [
  { brand: 'TOYOTA', model: 'COROLLA XEI 2.0', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Automático CVT', suggested_price: 135000, warranty_months: 3 },
  { brand: 'FIAT', model: 'STRADA FREEDOM 1.3', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Manual', suggested_price: 88000, warranty_months: 3 },
  { brand: 'CHEVROLET', model: 'ONIX 1.0 TURBO', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Automático', suggested_price: 79000, warranty_months: 3 },
  { brand: 'VOLKSWAGEN', model: 'POLO TRACK 1.0', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Manual', suggested_price: 74000, warranty_months: 3 },
  { brand: 'HYUNDAI', model: 'HB20 COMFORT 1.0', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Manual', suggested_price: 72000, warranty_months: 3 },
  { brand: 'JEEP', model: 'COMPASS LONGITUDE', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Automático', suggested_price: 125000, warranty_months: 3 },
  { brand: 'RENAULT', model: 'KWID ZEN 1.0', vehicle_type: 'carro', fuel_type: 'Flex', transmission: 'Manual', suggested_price: 49000, warranty_months: 3 },
];

/** Cores Oficiais de Fábrica da Shineray */
export const SHINERAY_FACTORY_COLORS = [
  'Vermelho Metálico',
  'Preto Fosco',
  'Preto Brilhante',
  'Branco Pérola',
  'Azul Petróleo',
  'Cinza Nardo',
  'Amarelo',
  'Verde Militar',
  'Prata',
];

/**
 * Calculadora Inteligente de Margem na Compra/Entrada
 */
export function calculateTargetPrice(params: {
  purchaseCost: number; // Custo de compra/faturamento
  prepExpenses?: number; // Despesas de ativação/oficina/frete
  desiredMarginPercent?: number; // Margem desejada em % (padrão 18%)
}) {
  const cost = params.purchaseCost || 0;
  const prep = params.prepExpenses || 0;
  const totalCost = cost + prep;
  const marginPct = (params.desiredMarginPercent || 18) / 100;

  // Preço de venda = Custo Total / (1 - Margem)
  const suggestedSalePrice = marginPct < 1 ? totalCost / (1 - marginPct) : totalCost * 1.2;
  const projectedProfit = suggestedSalePrice - totalCost;

  return {
    totalCost,
    suggestedSalePrice: Math.round(suggestedSalePrice / 10) * 10, // Arredonda para dezena
    projectedProfit,
  };
}
