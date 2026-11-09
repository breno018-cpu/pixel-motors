export type InspectionFinalStatus = 'aprovado' | 'aprovado_com_apontamentos' | 'reprovado';

export type AuctionStatus =
  | 'sem_passagem'
  | 'recuperado_financeira'
  | 'leilao_seguradora'
  | 'sinistro_grave';

export type RenajudStatus =
  | 'nada_consta'
  | 'bloqueio_transferencia'
  | 'penhora';

export type TheftStatus =
  | 'nada_consta'
  | 'alerta_furto_roubo'
  | 'recuperado';

export type FinanceStatus =
  | 'quitado'
  | 'alienacao_fiduciaria'
  | 'arrendamento';

export interface VehicleDebt {
  id: string;
  description: string;
  amount: number;
  type: 'ipva' | 'multa' | 'licenciamento' | 'outro';
}

export interface UsedMotoInspectionData {
  id: string;
  code: string; // Ex: LAU-2026-0001
  created_at: string;
  updated_at: string;
  store_name?: string;
  inspector_name: string;

  // 1. Dados da Moto Usada
  brand: string; // Honda, Yamaha, Shineray, etc.
  model: string; // CG 160 Fan, Fazer 250, Worker 125...
  year: number; // Ano modelo
  manufacture_year?: number;
  color: string;
  plate: string;
  chassis: string; // VIN gravado no canote
  renavam?: string;
  engine_number?: string;
  mileage: number; // Km rodado

  // 2. Cliente / Vendedor da Troca
  client_name?: string;
  client_phone?: string;
  client_document?: string;

  // 3. Procedência & Débitos (Risco Jurídico / Multas)
  theft_status: TheftStatus;
  renajud_status: RenajudStatus;
  auction_status: AuctionStatus;
  finance_status: FinanceStatus;
  debts: VehicleDebt[];
  total_debts: number;

  // 4. Vistoria Mecânica e Física da Moto (Apenas o essencial de moto)
  frame_chassis: 'alinhado_original' | 'soldado_reparado' | 'empenado_batido'; // Quadro / Canote
  engine_condition: 'otimo_silencioso' | 'fumando_queimando_oleo' | 'vazamento_junta' | 'barulho_biela'; // Motor
  transmission_gears: 'engates_perfeitos' | 'arranhando_escapando'; // Câmbio
  front_fork: 'alinhada_sem_vazamento' | 'retentor_vazando' | 'empenada'; // Bengalas / Suspensão diant.
  chain_kit: 'otimo' | 'meia_vida' | 'gasto_trocar'; // Kit Relação (corrente, coroa, pinhão)
  tires: 'bons' | 'meia_vida' | 'gastos_trocar'; // Pneus
  fairings_paint: 'original_impecavel' | 'riscos_ralados_leves' | 'carenagens_quebradas'; // Carenagens
  numbers_match: boolean; // Chassi e motor conferem com documento

  // 5. Parecer Comercial & Avaliação de Troca
  score: number; // 0 a 100
  final_status: InspectionFinalStatus;
  estimated_workshop_cost: number; // Custo oficina para colocar à venda (pneu, óleo, relação)
  suggested_trade_in_value?: number; // Preço sugerido para pagar na troca
  notes?: string;
}

export type InspectionData = UsedMotoInspectionData;
