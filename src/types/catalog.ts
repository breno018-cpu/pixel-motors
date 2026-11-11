export interface CatalogPromo {
  active: boolean;
  label: string;       // Ex: "R$ 1.000 OFF", "Queima de Estoque", "Taxa Zero"
  discount?: number;   // Valor em reais do desconto
  until?: string;      // Data limite da oferta (ex: "2026-12-31" ou ISO)
}

export interface CatalogProduct {
  id: string;               // ID único (kebab-case, ex: "shineray-worker-125", "passion")
  active: boolean;          // Visibilidade pública instantânea (true/false)
  cat: "ele" | "semi" | "off" | "shineray"; // Aba/categoria principal
  sub: string;              // Subcategoria ("Ciclomotor", "Scooter", "Street", "Trail", "Custom", "Esportiva", "Off-Road", "Patinete", "Elétrica")
  brand: string;            // Ex: "Shineray", "GOAT", "MXF", "Foston"
  name: string;             // Nome comercial (ex: "WORKER 125", "JET 125", "SHI 175s EFI")
  price: number | null;     // Preço à vista em reais (ou null para "Sob consulta")
  oldPrice?: number | null; // Preço original ("De R$ X"). Se price < oldPrice, gera badge de desconto
  installments: boolean;    // Habilita simulação de parcelas em até 21x no cartão
  promo?: CatalogPromo | null; // Dados da promoção em destaque

  // Carrossel de Destaque do Topo (Hero)
  featuredHero?: boolean;   // Se vai para o carrossel rotativo principal de topo
  heroOrder?: number;       // Ordem numérica de prioridade nos slides (1º, 2º, 3º lugar...)

  // Estoque
  stock: number | null;     // 0 = ESGOTADO; 1 a 2 = "Últimas unidades!"; > 2 = normal; null = pronta entrega
  readyDelivery: boolean;   // Selo de pronta entrega

  // Mídias
  photos: string[];         // URLs das fotos oficiais em alta definição (photos[0] é a principal)
  rotation360?: string[] | null; // 24 fotos para giro interativo 360°
  video?: string | null;    // Código ou link do YouTube
  colors?: [string, string, number][]; // [Nome da cor, Hexadecimal, Índice da foto correspondente]

  // Ficha técnica e comercial
  specs: [string, string][];// [Valor, Rótulo] (motor, potência, câmbio, partida, tanque, freios)
  feat: string[];           // Itens de série e diferenciais comerciais
  desc: string;             // Breve texto comercial do veículo
  disc?: string;            // Aviso legal e condições de emplacamento
}

export interface CatalogCampaign {
  title: string;
  text: string;
  until?: string; // Data limite para contagem regressiva
}

export interface CatalogConfig {
  storeName?: string;
  whatsapp?: string;
  maxInstallments?: number;        // Até 21x
  debitRate?: number;              // Taxa percentual débito (ex: 1.10)
  installmentRates?: number[];     // Array com taxas de juros reais de 1x até 21x
  installmentNote?: string;        // Aviso legal do simulador
  campaign?: CatalogCampaign | null; // Campanha sazonal com contagem regressiva
  lowStockThreshold?: number;      // Limite para disparar "Últimas unidades" (padrão: 2)
  phone?: string;
  address?: string;
  instagram?: string;
  [key: string]: any;
}

export interface CatalogEvent {
  id?: string;
  action: string;
  timestamp: string;
  author?: string;
  details?: any;
  productId?: string;
}

export interface CatalogData {
  version: number;
  updatedAt: string;
  totalProducts?: number;
  products: CatalogProduct[];
  config: CatalogConfig;
  events?: CatalogEvent[];
}

export type CatalogSyncAction =
  | { action: "upsert"; product: CatalogProduct }
  | { action: "price"; id: string; value: number | null; keepOld?: boolean }
  | { action: "stock"; id: string; value: number | null }
  | { action: "active"; id: string; value: boolean }
  | { action: "promo"; id: string; promo: CatalogPromo | null }
  | { action: "featuredHero"; id: string; value: boolean; heroOrder?: number }
  | { action: "hero_list"; items: Array<{ id: string; heroOrder: number }> }
  | { action: "campaign"; campaign: CatalogCampaign | null }
  | { action: "remove"; id: string }
  | { action: "config"; config: CatalogConfig }
  | { action: "rates"; debitRate: number; installmentRates: number[]; installmentNote?: string };

export interface CatalogSyncResponse {
  ok: boolean;
  version: number;
  applied: any[];
  errors?: any[];
  message?: string;
}

export interface CatalogChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CatalogChatResponse {
  ok: boolean;
  reply: string;
  productsSuggested?: string[];
  [key: string]: any;
}
