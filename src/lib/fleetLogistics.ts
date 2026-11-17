/**
 * Sistema de Gestão de Frota Própria e Cálculo Operacional de Frete
 * Concessionárias Shineray / Multimarcas (Divinópolis e Montes Claros)
 * 
 * Modos de transporte próprio:
 * - Carros da loja (Pickups/Caçambas: levam até 2 motos)
 * - Carretinha Reboque de 3 motos (+ 2 no carro = 5 motos)
 * - Carretinha Reboque de 6 motos (+ 2 no carro = 8 motos)
 * 
 * Despesas de viagem automáticas:
 * - Combustível (Consumo km/L com ou sem carretinha)
 * - Café da manhã, Almoço e Janta (por pessoa e duração da viagem)
 * - Parada para dormir / Pernoite / Hotel (para viagens longas)
 * - Manutenção e Pedágio
 */

export type FuelType = 'gasolina' | 'etanol' | 'diesel';

export interface FleetVehicle {
  id: string;
  nome: string;
  modelo: string;
  placa: string;
  tipoCombustivel: FuelType;
  precoCombustivelLitro: number;
  consumoKmPorLitroSozinho: number;
  consumoKmPorLitroComCarretinha: number;
  capacidadeMotosCarro: number; // Padrão: 2 motos
  custoManutencaoPorKm: number; // Desgaste de pneus e mecânica
  lojaOrigemId: string;
  lojaOrigemNome: string;
  ativo: boolean;
  observacoes?: string;
}

export type TrailerType = 'nenhuma' | 'carretinha_3' | 'carretinha_6' | 'custom';

export interface FleetTrailer {
  id: string;
  nome: string;
  tipo: TrailerType;
  placa: string;
  capacidadeMotos: number; // 3 ou 6
  impactoConsumoPercentual: number; // ex: 25% mais consumo
  ativo: boolean;
  descricao?: string;
}

export interface TravelExpenseSettings {
  precoCafeManha: number;
  precoAlmoco: number;
  precoJanta: number;
  precoPernoiteHotel: number;
  velocidadeMediaKmH: number;
  limiteHorasAlmoco: number; // ex: viagens >= 4 horas requerem almoço
  limiteHorasJanta: number; // ex: viagens >= 8 horas requerem janta
  limiteHorasHotel: number; // ex: viagens >= 10 horas requerem pernoite
  limiteKmHotel: number; // ex: viagens >= 500 km requerem pernoite
  custoPedagioMedioPor100Km: number;
}

export interface FleetTripCalculation {
  vehicle: FleetVehicle;
  trailer?: FleetTrailer;
  distanciaIdaKm: number;
  distanciaTotalKm: number;
  idaEVolta: boolean;
  tempoViagemHoras: number;
  tempoViagemFormatado: string;
  quantidadeMotos: number;
  capacidadeMaximaTotal: number;
  capacidadeCarro: number;
  capacidadeCarretinha: number;
  capacidadeExcedida: boolean;
  membrosEquipe: number; // 1 ou 2 pessoas

  // Combustível
  consumoMedioKmPorLitro: number;
  litrosCombustivelTotal: number;
  custoCombustivel: number;
  precoLitroCombustivel: number;

  // Paradas de Alimentação & Hotel
  paradas: {
    cafeManha: { necessarias: boolean; quantidade: number; unitario: number; total: number };
    almoco: { necessarias: boolean; quantidade: number; unitario: number; total: number };
    janta: { necessarias: boolean; quantidade: number; unitario: number; total: number };
    hotel: { necessarias: boolean; quantidade: number; unitario: number; total: number };
  };
  custoTotalRefeicoes: number;
  custoTotalHotel: number;

  // Outros custos
  custoManutencao: number;
  custoPedagio: number;

  // Totais
  custoOperacionalTotal: number;
  custoFretePorMoto: number;
  precoSugeridoTotal: number; // Com margem operacional da loja
  precoSugeridoPorMoto: number;
  formatados: {
    totalOperacional: string;
    custoPorMoto: string;
    precoSugeridoTotal: string;
    precoSugeridoPorMoto: string;
    combustivel: string;
    refeicoes: string;
    hotel: string;
    manutencaoEPedagio: string;
  };
}

const STORAGE_KEY_VEHICLES = 'dealflow_fleet_vehicles_v1';
const STORAGE_KEY_TRAILERS = 'dealflow_fleet_trailers_v1';
const STORAGE_KEY_EXPENSES = 'dealflow_fleet_expenses_v1';

// Seed padrão de veículos da frota da loja
export const DEFAULT_FLEET_VEHICLES: FleetVehicle[] = [
  {
    id: 'strada_divinopolis',
    nome: 'Fiat Strada Freedom 1.3 CS (Caçamba)',
    modelo: 'Fiat Strada Freedom 1.3 Firefly',
    placa: 'RVE-4A20',
    tipoCombustivel: 'gasolina',
    precoCombustivelLitro: 5.89,
    consumoKmPorLitroSozinho: 12.8,
    consumoKmPorLitroComCarretinha: 9.6,
    capacidadeMotosCarro: 2,
    custoManutencaoPorKm: 0.22,
    lojaOrigemId: 'store-divinopolis',
    lojaOrigemNome: 'Shineray & Multimarcas Divinópolis',
    ativo: true,
    observacoes: 'Veículo principal para entregas no Centro-Oeste e Belo Horizonte.',
  },
  {
    id: 's10_montesclaros',
    nome: 'Chevrolet S10 2.8 Turbo Diesel (Caçamba)',
    modelo: 'Chevrolet S10 Cabine Simples 2.8 TD',
    placa: 'SHN-2B88',
    tipoCombustivel: 'diesel',
    precoCombustivelLitro: 6.19,
    consumoKmPorLitroSozinho: 11.2,
    consumoKmPorLitroComCarretinha: 8.4,
    capacidadeMotosCarro: 2,
    custoManutencaoPorKm: 0.28,
    lojaOrigemId: 'store-montesclaros',
    lojaOrigemNome: 'Shineray Montes Claros',
    ativo: true,
    observacoes: 'Tração 4x4 ideal para entregas rurais, Norte de Minas e trechos de serra.',
  },
  {
    id: 'toro_geral',
    nome: 'Fiat Toro Volcano 2.0 4x4 Diesel',
    modelo: 'Fiat Toro Volcano 2.0 16V 4x4 Diesel',
    placa: 'RTO-8H15',
    tipoCombustivel: 'diesel',
    precoCombustivelLitro: 6.19,
    consumoKmPorLitroSozinho: 11.8,
    consumoKmPorLitroComCarretinha: 8.9,
    capacidadeMotosCarro: 2,
    custoManutencaoPorKm: 0.25,
    lojaOrigemId: 'store-all',
    lojaOrigemNome: 'Uso Compartilhado (Divinópolis / Montes Claros)',
    ativo: true,
    observacoes: 'Veículo de apoio interlojas e viagens longas expressas.',
  },
];

// Seed padrão de carretinhas
export const DEFAULT_FLEET_TRAILERS: FleetTrailer[] = [
  {
    id: 'carretinha_3',
    nome: 'Carretinha Reboque 3 Motos (Asa Delta)',
    tipo: 'carretinha_3',
    placa: 'CAR-3M01',
    capacidadeMotos: 3,
    impactoConsumoPercentual: 22,
    ativo: true,
    descricao: 'Reboque reforçado para 3 motos leves/médias com rampa embutida.',
  },
  {
    id: 'carretinha_6',
    nome: 'Carretinha Reboque 6 Motos (Eixo Duplo Truck)',
    tipo: 'carretinha_6',
    placa: 'CAR-6M02',
    capacidadeMotos: 6,
    impactoConsumoPercentual: 30,
    ativo: true,
    descricao: 'Carreta de grande porte com freio inercial para lote de 6 motos.',
  },
];

// Seed de despesas de viagem padrão (diárias, alimentação e hospedagem)
export const DEFAULT_TRAVEL_EXPENSES: TravelExpenseSettings = {
  precoCafeManha: 22.0,
  precoAlmoco: 38.0,
  precoJanta: 38.0,
  precoPernoiteHotel: 160.0,
  velocidadeMediaKmH: 65,
  limiteHorasAlmoco: 4,
  limiteHorasJanta: 8,
  limiteHorasHotel: 10,
  limiteKmHotel: 500,
  custoPedagioMedioPor100Km: 14.0,
};

// ==========================================
// FUNÇÕES DE PERSISTÊNCIA LOCALSTORAGE
// ==========================================

export function getFleetVehicles(): FleetVehicle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VEHICLES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar veículos da frota:', e);
  }
  return DEFAULT_FLEET_VEHICLES;
}

export function saveFleetVehicles(vehicles: FleetVehicle[]): void {
  localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(vehicles));
}

export function getFleetTrailers(): FleetTrailer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRAILERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar carretinhas:', e);
  }
  return DEFAULT_FLEET_TRAILERS;
}

export function saveFleetTrailers(trailers: FleetTrailer[]): void {
  localStorage.setItem(STORAGE_KEY_TRAILERS, JSON.stringify(trailers));
}

export function getTravelExpenseSettings(): TravelExpenseSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPENSES);
    if (raw) {
      return { ...DEFAULT_TRAVEL_EXPENSES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Erro ao carregar parâmetros de viagem:', e);
  }
  return DEFAULT_TRAVEL_EXPENSES;
}

export function saveTravelExpenseSettings(settings: TravelExpenseSettings): void {
  localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(settings));
}

// ==========================================
// MOTOR DE CÁLCULO OPERACIONAL DE FRETE PRÓPRIO
// ==========================================

export interface CalculateTripParams {
  vehicleId: string;
  trailerId?: string | 'nenhuma';
  distanciaIdaKm: number;
  idaEVolta?: boolean; // Padrão: true (veículo da loja precisa retornar à concessionária)
  quantidadeMotos?: number;
  membrosEquipe?: number; // 1 (só motorista) ou 2 (motorista + ajudante para descarregar)
  margemLucroPercentual?: number; // ex: 20% sobre o custo operacional
  customExpenses?: Partial<TravelExpenseSettings>;
}

export function calculateFleetTrip(params: CalculateTripParams): FleetTripCalculation {
  const vehicles = getFleetVehicles();
  const trailers = getFleetTrailers();
  const baseExpenses = { ...getTravelExpenseSettings(), ...(params.customExpenses || {}) };

  const vehicle =
    vehicles.find((v) => v.id === params.vehicleId && v.ativo) ||
    vehicles[0] ||
    DEFAULT_FLEET_VEHICLES[0];

  const trailer =
    params.trailerId && params.trailerId !== 'nenhuma'
      ? trailers.find((t) => t.id === params.trailerId && t.ativo)
      : undefined;

  const distanciaIdaKm = Math.max(0, params.distanciaIdaKm || 0);
  const idaEVolta = params.idaEVolta !== false; // Padrão true
  const distanciaTotalKm = idaEVolta ? distanciaIdaKm * 2 : distanciaIdaKm;

  const quantidadeMotos = Math.max(1, params.quantidadeMotos || 1);
  const membrosEquipe = Math.max(1, Math.min(3, params.membrosEquipe || 1));
  const margemLucro = (params.margemLucroPercentual ?? 20) / 100;

  // Capacidade
  const capacidadeCarro = vehicle.capacidadeMotosCarro || 2;
  const capacidadeCarretinha = trailer ? trailer.capacidadeMotos : 0;
  const capacidadeMaximaTotal = capacidadeCarro + capacidadeCarretinha;
  const capacidadeExcedida = quantidadeMotos > capacidadeMaximaTotal;

  // Tempo de Viagem
  const velocidade = Math.max(40, baseExpenses.velocidadeMediaKmH || 65);
  const tempoViagemHoras = distanciaTotalKm > 0 ? distanciaTotalKm / velocidade : 0;

  const horasInteiras = Math.floor(tempoViagemHoras);
  const minutos = Math.round((tempoViagemHoras - horasInteiras) * 60);
  const tempoViagemFormatado =
    distanciaTotalKm === 0
      ? '0 min'
      : horasInteiras > 0
      ? `${horasInteiras}h ${minutos > 0 ? `${minutos}min` : ''}`
      : `${minutos} min`;

  // Consumo de Combustível
  const temCarretinha = !!trailer;
  const consumoMedioKmPorLitro = temCarretinha
    ? vehicle.consumoKmPorLitroComCarretinha || vehicle.consumoKmPorLitroSozinho * 0.75
    : vehicle.consumoKmPorLitroSozinho;

  const litrosCombustivelTotal =
    consumoMedioKmPorLitro > 0 ? Math.round((distanciaTotalKm / consumoMedioKmPorLitro) * 10) / 10 : 0;
  const custoCombustivel = Math.round(litrosCombustivelTotal * vehicle.precoCombustivelLitro);

  // Paradas de Alimentação & Pernoite
  // 1. Almoço: se a viagem passar de X horas (ex: >= 4h)
  const precisaAlmoco = tempoViagemHoras >= baseExpenses.limiteHorasAlmoco;
  const qtdAlmoco = precisaAlmoco ? 1 : 0;
  const custoAlmoco = qtdAlmoco * baseExpenses.precoAlmoco * membrosEquipe;

  // 2. Janta: se a viagem passar de X horas (ex: >= 8h)
  const precisaJanta = tempoViagemHoras >= baseExpenses.limiteHorasJanta;
  const qtdJanta = precisaJanta ? 1 : 0;
  const custoJanta = qtdJanta * baseExpenses.precoJanta * membrosEquipe;

  // 3. Café da Manhã: se for viagem longa (> 5h) ou com pernoite
  const precisaCafe = tempoViagemHoras >= 5 || tempoViagemHoras >= baseExpenses.limiteHorasHotel;
  const qtdCafe = precisaCafe ? 1 : 0;
  const custoCafe = qtdCafe * baseExpenses.precoCafeManha * membrosEquipe;

  // 4. Pernoite / Hotel: se ultrapassar o limite de horas (>= 10h) ou KM total (>= 500km)
  const precisaHotel =
    tempoViagemHoras >= baseExpenses.limiteHorasHotel ||
    distanciaTotalKm >= baseExpenses.limiteKmHotel;
  const qtdHotel = precisaHotel ? Math.ceil(tempoViagemHoras / 12) : 0;
  const custoHotel = qtdHotel * baseExpenses.precoPernoiteHotel * (membrosEquipe > 1 ? 1.4 : 1.0); // Quarto duplo com acréscimo se forem 2

  const custoTotalRefeicoes = custoCafe + custoAlmoco + custoJanta;
  const custoTotalHotel = Math.round(custoHotel);

  // Manutenção e Pedágio
  const custoManutencao = Math.round(distanciaTotalKm * (vehicle.custoManutencaoPorKm || 0.25));
  const custoPedagio = Math.round((distanciaTotalKm / 100) * (baseExpenses.custoPedagioMedioPor100Km || 14));

  // Custo Operacional Total
  const custoOperacionalTotal =
    distanciaTotalKm === 0
      ? 0
      : Math.round(
          custoCombustivel +
          custoTotalRefeicoes +
          custoTotalHotel +
          custoManutencao +
          custoPedagio
        );

  const custoFretePorMoto =
    quantidadeMotos > 0 ? Math.round(custoOperacionalTotal / quantidadeMotos) : custoOperacionalTotal;

  // Preço Sugerido para Cobrança do Cliente (com margem para cobrir riscos e lucro)
  const precoSugeridoTotal = Math.round(custoOperacionalTotal * (1 + margemLucro));
  const precoSugeridoPorMoto =
    quantidadeMotos > 0 ? Math.round(precoSugeridoTotal / quantidadeMotos) : precoSugeridoTotal;

  const toBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return {
    vehicle,
    trailer,
    distanciaIdaKm,
    distanciaTotalKm,
    idaEVolta,
    tempoViagemHoras,
    tempoViagemFormatado,
    quantidadeMotos,
    capacidadeMaximaTotal,
    capacidadeCarro,
    capacidadeCarretinha,
    capacidadeExcedida,
    membrosEquipe,

    consumoMedioKmPorLitro,
    litrosCombustivelTotal,
    custoCombustivel,
    precoLitroCombustivel: vehicle.precoCombustivelLitro,

    paradas: {
      cafeManha: {
        necessarias: precisaCafe,
        quantidade: qtdCafe,
        unitario: baseExpenses.precoCafeManha,
        total: custoCafe,
      },
      almoco: {
        necessarias: precisaAlmoco,
        quantidade: qtdAlmoco,
        unitario: baseExpenses.precoAlmoco,
        total: custoAlmoco,
      },
      janta: {
        necessarias: precisaJanta,
        quantidade: qtdJanta,
        unitario: baseExpenses.precoJanta,
        total: custoJanta,
      },
      hotel: {
        necessarias: precisaHotel,
        quantidade: qtdHotel,
        unitario: baseExpenses.precoPernoiteHotel,
        total: custoTotalHotel,
      },
    },
    custoTotalRefeicoes,
    custoTotalHotel,

    custoManutencao,
    custoPedagio,

    custoOperacionalTotal,
    custoFretePorMoto,
    precoSugeridoTotal,
    precoSugeridoPorMoto,

    formatados: {
      totalOperacional: toBRL(custoOperacionalTotal),
      custoPorMoto: toBRL(custoFretePorMoto),
      precoSugeridoTotal: toBRL(precoSugeridoTotal),
      precoSugeridoPorMoto: toBRL(precoSugeridoPorMoto),
      combustivel: toBRL(custoCombustivel),
      refeicoes: toBRL(custoTotalRefeicoes),
      hotel: toBRL(custoTotalHotel),
      manutencaoEPedagio: toBRL(custoManutencao + custoPedagio),
    },
  };
}
