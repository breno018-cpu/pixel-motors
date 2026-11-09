export interface InboundCargoItem {
  id: string;
  batch_id: string;
  code_id_1: string;          // Código de Identificação 1 (ex: 115684, 115699)
  transport_code: string;     // Código de Transporte (ex: 53880)
  model_code: string;         // Código de Identificação 2 / Modelo de Fábrica (ex: MBR1PSH0500413Y)
  chassis: string;            // Chassi VIN (ex: 99HPHS050VS001704)
  primary_color: string;      // Cor Primária (ex: BRANCA, CINZA, PRETA, VERMELHA)
  engine_number: string;      // Número do Motor (ex: WY152FMHT3140897)
  model_year: number;         // Ano Modelo (ex: 2027)
  manufacture_year: number;   // Ano Fabricação (ex: 2026)
  group_cc: string;           // Grupo / Cilindrada (ex: 49, 125, 175, 200, 250)
  secondary_color: string;    // Cor Secundária / Cor do Banco (ex: BANCOMARROM, BANCOAZUL, BANCOVINHO)
  destination_store: string;  // Loja Destino (ex: L1ma motors)
  model_name?: string;        // Nome amigável do modelo (ex: PHOENIX 50 EFI, NEW JET 125 SS)
  brand?: string;             // Marca (ex: SHINERAY)
  scanned: boolean;           // Bipado na descarga
  scanned_at?: string | null; // Data/hora da leitura
  scanned_by?: string | null; // Nome de quem bipou
  stock_vehicle_id?: string;  // ID no estoque oficial se já integrado
}

export interface InboundDivergenceLog {
  id: string;
  timestamp: string;
  scanned_value: string;
  reason: 'not_in_manifest' | 'already_scanned' | 'wrong_store';
  message: string;
  resolved?: boolean;
}

export type InboundBatchStatus = 'aguardando_descarga' | 'em_conferencia' | 'concluido' | 'divergente';

export interface InboundCargoBatch {
  id: string;
  batch_code: string;          // Ex: "115684 / 115699"
  transport_code: string;      // Ex: "53880"
  destination_store: string;   // Ex: "L1ma motors"
  carrier_name?: string;       // Ex: "Transportadora Cegonha"
  driver_name?: string;
  truck_plate?: string;
  status: InboundBatchStatus;
  total_items: number;
  scanned_items: number;
  divergent_items: number;
  image_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  items: InboundCargoItem[];
  divergence_logs: InboundDivergenceLog[];
}
