/**
 * Sistema Unificado de Métodos de Logística e Transporte da Concessionária
 * Gestão de fretes rodoviários, carretas cegonha, reboques dedicados e transferências entre filiais.
 */

export type LogisticsTransportType =
  | 'RODOVIARIO_LOTE'
  | 'RODOVIARIO_EXCLUSIVO'
  | 'INTERLOJAS'
  | 'EXPRESSO_REGIONAL'
  | 'PRESENCIAL';

export interface TransportLogisticsMethod {
  id: string;
  nome: string;
  subtitulo: string;
  descricao: string;
  tipo: LogisticsTransportType;
  tarifaBaseKm: number;
  taxaFixaExpedicao: number;
  prazoFormatado: string;
  prazoMedioDiasMin: number;
  prazoMedioDiasMax: number;
  capacidadeLote: string;
  seguroCarga: string;
  rastreamentoGps: boolean;
  vistoriaPdiObrigatoria: boolean;
  corBadge: string;
  destaqueBadge: string;
}

export interface FreightCostBreakdown {
  methodId: string;
  methodName: string;
  roadKm: number;
  vehicleCount: number;
  tarifaKm: number;
  custoDistancia: number;
  taxaExpedicao: number;
  custoSeguro: number;
  descontoLote: number;
  totalFrete: number;
  prazoEstimado: string;
  formattedTotal: string;
}

/**
 * Catálogo Oficial de Métodos de Transporte & Logística das Concessionárias
 */
export const TRANSPORT_LOGISTICS_METHODS: TransportLogisticsMethod[] = [
  {
    id: 'cegonha_coletiva',
    nome: 'Cegonha Multiveículos (Lote Regional)',
    subtitulo: 'Frete compartilhado com economia de escala',
    descricao:
      'Transporte em caminhão cegonha ou prancha coletiva especializada. Ideal para rotas programadas e entregas consolidadas com rotas semanais.',
    tipo: 'RODOVIARIO_LOTE',
    tarifaBaseKm: 1.95,
    taxaFixaExpedicao: 90,
    prazoFormatado: '3 a 7 dias úteis',
    prazoMedioDiasMin: 3,
    prazoMedioDiasMax: 7,
    capacidadeLote: 'Até 12 a 16 motos por carga',
    seguroCarga: 'RCTR-C 100% Cobertura de Lote',
    rastreamentoGps: true,
    vistoriaPdiObrigatoria: true,
    corBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    destaqueBadge: 'Mais Econômico',
  },
  {
    id: 'reboque_dedicado',
    nome: 'Guincho Plataforma / Reboque Exclusivo VIP',
    subtitulo: 'Entrega direta expressa na residência do cliente',
    descricao:
      'Veículo plataforma exclusivo para transporte individual. Atendimento porta a porta imediato com agendamento flexível de horário.',
    tipo: 'RODOVIARIO_EXCLUSIVO',
    tarifaBaseKm: 4.80,
    taxaFixaExpedicao: 150,
    prazoFormatado: '24h a 48h (Express)',
    prazoMedioDiasMin: 1,
    prazoMedioDiasMax: 2,
    capacidadeLote: '1 a 2 motos dedicadas',
    seguroCarga: 'Apólice Individual Porta a Porta com Termo de Vistoria',
    rastreamentoGps: true,
    vistoriaPdiObrigatoria: true,
    corBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    destaqueBadge: 'Entrega Express VIP',
  },
  {
    id: 'transferencia_polo',
    nome: 'Shuttle Interlojas Divinópolis ⇄ Montes Claros',
    subtitulo: 'Transferência corporativa entre centros de distribuição',
    descricao:
      'Corredor logístico regular de abastecimento entre Divinópolis e Montes Claros via BR-135 e BR-040.',
    tipo: 'INTERLOJAS',
    tarifaBaseKm: 1.40,
    taxaFixaExpedicao: 60,
    prazoFormatado: '2 a 4 dias úteis (Rotas Terças e Sextas)',
    prazoMedioDiasMin: 2,
    prazoMedioDiasMax: 4,
    capacidadeLote: 'Até 20 motos em carreta fechada baú',
    seguroCarga: 'Seguro Patrimonial de Frota Própria da Rede',
    rastreamentoGps: true,
    vistoriaPdiObrigatoria: true,
    corBadge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    destaqueBadge: 'Corredor Interfiliais',
  },
  {
    id: 'expresso_regional',
    nome: 'Despacho Expresso Regional (Até 150 km)',
    subtitulo: 'Transporte ágil em picape/reboque rápido para cidades vizinhas',
    descricao:
      'Serviço ágil para entregas em municípios de raio curto e médio (ex: Nova Serrana, Itaúna, Bocaiúva, Janaúba) com saída no mesmo dia do faturamento.',
    tipo: 'EXPRESSO_REGIONAL',
    tarifaBaseKm: 3.20,
    taxaFixaExpedicao: 80,
    prazoFormatado: 'Mesmo Dia a 24h',
    prazoMedioDiasMin: 0,
    prazoMedioDiasMax: 1,
    capacidadeLote: '1 a 3 motos leves',
    seguroCarga: 'Seguro de Carga Regional Imediato',
    rastreamentoGps: true,
    vistoriaPdiObrigatoria: true,
    corBadge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    destaqueBadge: 'Mesmo Dia',
  },
  {
    id: 'retirada_patio',
    nome: 'Retirada Presencial no Pátio Oficial (Showroom)',
    subtitulo: 'Entrega técnica na concessionária sem custo de frete',
    descricao:
      'O cliente retira a motocicleta presencialmente na concessionária de origem. Acompanha checklist PDI presencial, tanque cortesia e termo de entrega assinado.',
    tipo: 'PRESENCIAL',
    tarifaBaseKm: 0,
    taxaFixaExpedicao: 0,
    prazoFormatado: 'Imediato (Agendado na Loja)',
    prazoMedioDiasMin: 0,
    prazoMedioDiasMax: 0,
    capacidadeLote: 'Showroom da Loja',
    seguroCarga: 'Garantia Concessionária de Fábrica',
    rastreamentoGps: false,
    vistoriaPdiObrigatoria: true,
    corBadge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    destaqueBadge: 'Frete Grátis',
  },
];

/**
 * Calcula o custo discriminado do frete para uma distância e método selecionados
 */
export function calculateFreightCost(
  methodId: string,
  roadKm: number,
  vehicleCount: number = 1
): FreightCostBreakdown {
  const method =
    TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === methodId) ||
    TRANSPORT_LOGISTICS_METHODS[0];

  if (method.id === 'retirada_patio' || roadKm === 0) {
    return {
      methodId: method.id,
      methodName: method.nome,
      roadKm,
      vehicleCount,
      tarifaKm: 0,
      custoDistancia: 0,
      taxaExpedicao: 0,
      custoSeguro: 0,
      descontoLote: 0,
      totalFrete: 0,
      prazoEstimado: 'Imediato (Retirada no Pátio)',
      formattedTotal: 'R$ 0,00 (Grátis)',
    };
  }

  const custoDistancia = Math.round(roadKm * method.tarifaBaseKm * vehicleCount);
  const taxaExpedicao = method.taxaFixaExpedicao;
  
  // Seguro de carga: ~0.4% do valor médio estimado da carga por unidade (R$ 80 base)
  const custoSeguro = method.tipo === 'RODOVIARIO_EXCLUSIVO' ? 95 : 55 * vehicleCount;

  // Desconto progressivo para lotes múltiplos no mesmo frete
  const descontoLote =
    vehicleCount > 1 && method.tipo === 'RODOVIARIO_LOTE'
      ? Math.round(custoDistancia * 0.15)
      : 0;

  const totalFrete = Math.max(
    taxaExpedicao + 50,
    custoDistancia + taxaExpedicao + custoSeguro - descontoLote
  );

  return {
    methodId: method.id,
    methodName: method.nome,
    roadKm,
    vehicleCount,
    tarifaKm: method.tarifaBaseKm,
    custoDistancia,
    taxaExpedicao,
    custoSeguro,
    descontoLote,
    totalFrete,
    prazoEstimado: method.prazoFormatado,
    formattedTotal: totalFrete.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }),
  };
}
