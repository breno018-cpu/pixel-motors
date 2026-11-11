export interface CatalogProduct {
  id: string;               // ID único (kebab-case, ex: "shineray-shi-175ss", "toky01")
  active: boolean;          // Visível no catálogo (true/false)
  cat: "ele" | "semi" | "off" | "shineray"; // Aba/categoria principal
  sub: string;              // Subcategoria (ex: "Trail", "Street", "Custom", "Scooter", "Ciclomotor", "Esportiva", "Off-Road", "Patinete")
  brand: string;            // Ex: "Shineray", "Voltz", "GOAT", "MXF"
  name: string;             // Nome do modelo (ex: "SHI 175ss", "Storm 200 EFI")
  price: number | null;     // Preço à vista em reais (ou null para "Sob consulta")
  oldPrice?: number | null; // Preço original antes do corte promocional
  installments: boolean;    // Habilita simulação de parcelas até 21x
  readyDelivery: boolean;   // Selo de pronta entrega
  stock: number | null;     // Quantidade em estoque (0 = Esgotado; null = pronta entrega sem estoque fixo)
  desc: string;             // Breve descrição comercial do veículo
  photos: string[];         // URLs das fotos oficiais em alta definição (photos[0] é a foto principal)
  specs: [string, string][];// Ficha técnica [Valor, Rótulo] (ex: [["169 cc", "Cilindrada"], ["13,59 cv", "Potência"]])
  feat: string[];           // Lista de destaques comerciais
  colors?: [string, string, number][]; // [Nome da cor, Hexadecimal, Índice da foto correspondente]
  rotation360?: string[] | null;       // URLs dos 24 frames do giro 360 interativo
  video?: string | null;               // ID do YouTube (ex: "1Y598CuK7kg")
  disc?: string;            // Aviso legal de rodapé
}

export interface CatalogConfig {
  storeName?: string;
  whatsapp?: string;
  maxInstallments?: number;
  phone?: string;
  address?: string;
  instagram?: string;
  [key: string]: any;
}

export interface CatalogCampaign {
  title: string;
  text: string;
  until?: string; // ISO Date string
}

export interface CatalogEvent {
  id?: string;
  action: string;
  timestamp: string;
  details?: any;
}

export interface CatalogData {
  version: number;
  updatedAt: string;
  products: CatalogProduct[];
  config: CatalogConfig;
  events?: CatalogEvent[];
}

export type CatalogSyncAction =
  | { action: "upsert"; product: CatalogProduct }
  | { action: "price"; id: string; value: number | null; keepOld?: boolean }
  | { action: "stock"; id: string; value: number | null }
  | { action: "active"; id: string; value: boolean }
  | { action: "promo"; id: string; promo: { label: string; until?: string } | null }
  | { action: "campaign"; campaign: CatalogCampaign | null }
  | { action: "remove"; id: string }
  | { action: "config"; config: CatalogConfig };

export interface CatalogSyncResponse {
  ok: boolean;
  version: number;
  applied: any[];
  errors?: any[];
  message?: string;
}
