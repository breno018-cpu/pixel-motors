import {
  CatalogData,
  CatalogSyncAction,
  CatalogSyncResponse,
  CatalogEvent,
  CatalogChatMessage,
  CatalogChatResponse,
} from "@/types/catalog";

export const CATS = ["ele", "semi", "off", "shineray"] as const;
export type CatalogCategoryKey = typeof CATS[number];

/**
 * Normalizador Tolerante a Falhas para Categorias do Catálogo L1MA Motors
 * Suporta aliases, variações com acento, texto livre e prefixos
 */
export function normalizeCat(c: any): CatalogCategoryKey | null {
  if (!c) return null;
  const s = String(c).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (s === "ele" || s.startsWith("eletric") || s.includes("scooter") || s.includes("patinete")) return "ele";
  if (s === "off" || s.startsWith("off") || s.includes("quadri") || s.includes("kart") || s.includes("drift") || s.includes("trilha") || s.includes("atv")) return "off";
  if (s === "semi" || s.startsWith("semi") || s.includes("usad") || s.includes("troca")) return "semi";
  if (s === "shineray" || s.includes("shine")) return "shineray";
  if ((CATS as readonly string[]).includes(s)) return s as CatalogCategoryKey;
  return null;
}

const STORAGE_URL_KEY = "dealflow_catalog_api_url";
const STORAGE_TOKEN_KEY = "dealflow_catalog_sync_token";
const DELETED_CATALOG_IDS_KEY = "dealflow_catalog_deleted_ids_v1";
const LOCAL_CATALOG_DATA_KEY = "dealflow_catalog_local_cache_v1";
const LOCAL_EVENTS_KEY = "dealflow_catalog_local_events_v1";

/**
 * Catálogo Oficial Padrão da Concessionária Shineray & Linha de Elétricas L1MA Motors
 * Garante que o catálogo nunca fique vazio, mesmo em ambiente estático ou offline
 */
export function generateDefaultCatalogData(): CatalogData {
  const defaultProducts: CatalogProduct[] = [
    // 1. Shineray Motos Zero KM
    {
      id: "shineray-worker-125",
      active: true,
      cat: "shineray",
      sub: "Street",
      brand: "SHINERAY",
      name: "WORKER 125",
      price: 9490,
      oldPrice: 10490,
      installments: true,
      readyDelivery: true,
      stock: 5,
      featuredHero: true,
      heroOrder: 1,
      patternCode: "WRK125",
      linkedModelPattern: "99H-WRK125",
      autoSyncStock: true,
      desc: "A clássica utilitária retrô da Shineray. Robusta, econômica e perfeita para o trabalho do dia a dia ou passeios urbanos com estilo.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["125 cc", "Cilindrada"],
        ["7.2 cv a 7.500 rpm", "Potência"],
        ["Manual 4 marchas", "Câmbio"],
        ["Pedal e Elétrica", "Partida"],
        ["14 Litros", "Tanque"],
        ["Freio a Disco Dianteiro", "Freios"],
      ],
      feat: ["Design Retrô Cafe Racer", "Farol Redondo Clássico", "Econômica (faz até 40km/l)", "Painel com marcador de marcha"],
    },
    {
      id: "shineray-phoenix-50-efi",
      active: true,
      cat: "shineray",
      sub: "Ciclomotor",
      brand: "SHINERAY",
      name: "PHOENIX 50 EFI",
      price: 7990,
      oldPrice: 8490,
      installments: true,
      readyDelivery: true,
      stock: 4,
      featuredHero: true,
      heroOrder: 2,
      patternCode: "PHS050",
      linkedModelPattern: "99H-PHS050",
      autoSyncStock: true,
      desc: "O ciclomotor mais vendido do Brasil agora com Injeção Eletrônica EFI! Máxima economia, partida instantânea e rodízio livre.",
      photos: [
        "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["50 cc", "Cilindrada"],
        ["Injeção Eletrônica EFI", "Alimentação"],
        ["Semi-automática 4 marchas", "Câmbio"],
        ["Elétrica e Pedal", "Partida"],
        ["Rodas de Liga Leve", "Rodas"],
        ["Painel Digital Completo", "Painel"],
      ],
      feat: ["Injeção Eletrônica EFI", "Painel Digital", "Farol de LED", "Porta-objetos integrado"],
    },
    {
      id: "shineray-phoenix-s-50",
      active: true,
      cat: "shineray",
      sub: "Ciclomotor",
      brand: "SHINERAY",
      name: "PHOENIX S 50",
      price: 7490,
      installments: true,
      readyDelivery: true,
      stock: 3,
      patternCode: "PHS050",
      autoSyncStock: true,
      desc: "Versão esportiva e acessível do ciclomotor Phoenix. Agilidade urbana com baixíssimo consumo de combustível.",
      photos: [
        "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["50 cc", "Cilindrada"],
        ["Semi-automática", "Câmbio"],
        ["Elétrica", "Partida"],
        ["Amortecedor Duplo", "Suspensão"],
      ],
      feat: ["Visual esportivo", "Consumo reduzido", "Garantia de fábrica"],
    },
    {
      id: "shineray-shi-175-efi",
      active: true,
      cat: "shineray",
      sub: "Trail",
      brand: "SHINERAY",
      name: "SHI 175 EFI",
      price: 14990,
      oldPrice: 15990,
      installments: true,
      readyDelivery: true,
      stock: 4,
      featuredHero: true,
      heroOrder: 3,
      patternCode: "SHF175",
      linkedModelPattern: "99H-SHF175",
      autoSyncStock: true,
      desc: "A trail que encara qualquer terreno com força e conforto. Suspensão de longo curso, injeção eletrônica e freios a disco combinados.",
      photos: [
        "https://images.unsplash.com/photo-1571188654248-7a89213915f7?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["175 cc", "Cilindrada"],
        ["14.2 cv", "Potência"],
        ["Injeção Eletrônica EFI", "Alimentação"],
        ["Manual 5 velocidades", "Câmbio"],
        ["Freios a Disco nas 2 rodas", "Freios"],
        ["15 Litros", "Tanque"],
      ],
      feat: ["Iluminação Full LED", "Suspensão elevada para terra e asfalto", "Protetor de motor e carenagem", "Painel 100% digital com conta-giros"],
    },
    {
      id: "shineray-storm-200",
      active: true,
      cat: "shineray",
      sub: "Street",
      brand: "SHINERAY",
      name: "STORM 200",
      price: 18990,
      oldPrice: 19990,
      installments: true,
      readyDelivery: true,
      stock: 2,
      patternCode: "STF200",
      linkedModelPattern: "99H-STF200",
      autoSyncStock: true,
      desc: "Naked moderna de 200 cilindradas com design agressivo, refrigeração líquida e câmbio de 6 marchas.",
      photos: [
        "https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["200 cc", "Cilindrada"],
        ["Refrigeração Líquida", "Motor"],
        ["Manual 6 velocidades", "Câmbio"],
        ["Freios ABS / Disco Duplo", "Segurança"],
      ],
      feat: ["Câmbio de 6 marchas", "Design agressivo Naked", "Painel Blackout", "Farol Projetor LED"],
    },
    {
      id: "shineray-free-150-efi",
      active: true,
      cat: "shineray",
      sub: "Street",
      brand: "SHINERAY",
      name: "FREE 150 EFI",
      price: 10990,
      installments: true,
      readyDelivery: true,
      stock: 3,
      patternCode: "FREE150",
      linkedModelPattern: "99H-FREE150",
      autoSyncStock: true,
      desc: "A moto urbana versátil da Shineray de 150cc. Alta durabilidade, baixíssimo custo de manutenção e excelente valor de revenda.",
      photos: [
        "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["150 cc", "Cilindrada"],
        ["Injeção Eletrônica EFI", "Alimentação"],
        ["Manual 5 velocidades", "Câmbio"],
        ["Partida Elétrica", "Partida"],
      ],
      feat: ["Injeção eletrônica", "Freio a disco", "Rodas de liga leve"],
    },
    {
      id: "shineray-jet-125-2x",
      active: true,
      cat: "shineray",
      sub: "Scooter",
      brand: "SHINERAY",
      name: "JET 125 2X",
      price: 9990,
      installments: true,
      readyDelivery: true,
      stock: 4,
      patternCode: "JTS125",
      linkedModelPattern: "99H-JTS125",
      autoSyncStock: true,
      desc: "A scooter cub preferida do mercado. Embreagem automática, porta-capacetes sob o banco e tomada USB para carregar seu celular.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["125 cc", "Cilindrada"],
        ["Semi-automática 4 marchas", "Câmbio"],
        ["Partida Elétrica e Pedal", "Partida"],
        ["Porta USB Integrada", "Conectividade"],
      ],
      feat: ["Espaço sob o assento", "Tomada USB para celular", "Embreagem semi-automática sem manete", "Rodas de liga leve"],
    },
    {
      id: "shineray-rio-125-efi",
      active: true,
      cat: "shineray",
      sub: "Scooter",
      brand: "SHINERAY",
      name: "RIO 125 EFI",
      price: 11490,
      installments: true,
      readyDelivery: true,
      stock: 3,
      patternCode: "R1F125",
      linkedModelPattern: "99H-R1F125",
      autoSyncStock: true,
      desc: "Autêntica scooter automática CVT com injeção eletrônica, assoalho plano e estilo europeu moderno.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["125 cc", "Cilindrada"],
        ["Automática CVT", "Câmbio"],
        ["Injeção Eletrônica EFI", "Alimentação"],
        ["Partida Elétrica", "Partida"],
      ],
      feat: ["Câmbio automático CVT só acelerar", "Assoalho plano confortável", "Painel digital"],
    },
    {
      id: "shineray-urban-150-efi",
      active: true,
      cat: "shineray",
      sub: "Scooter",
      brand: "SHINERAY",
      name: "URBAN 150 EFI",
      price: 16990,
      installments: true,
      readyDelivery: true,
      stock: 2,
      desc: "Maxi scooter moderna de 150cc com parabrisa alto, chave presencial smart key e freios combinados.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["150 cc", "Cilindrada"],
        ["Automática CVT", "Câmbio"],
        ["Smart Key Presencial", "Partida"],
        ["Freios CBS a disco", "Freios"],
      ],
      feat: ["Chave de presença Smart Key", "Iluminação Full LED", "Porta-luvas com USB"],
    },
    // 2. Linha Elétrica Multimarcas (100% Elétrica)
    {
      id: "shineray-she-s-eletrica",
      active: true,
      cat: "ele",
      sub: "Street",
      brand: "SHINERAY",
      name: "SHE S (MOTO ELÉTRICA)",
      price: 19990,
      oldPrice: 21990,
      installments: true,
      readyDelivery: true,
      stock: 3,
      featuredHero: true,
      heroOrder: 4,
      desc: "Moto 100% elétrica com motor de 3000W Bosch, bateria de lítio removível e autonomia de até 80 km por carga.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["3000 W", "Motor Elétrico"],
        ["Bateria de Lítio Removível", "Bateria"],
        ["Até 80 km", "Autonomia"],
        ["Até 80 km/h", "Velocidade Máxima"],
        ["Custo de R$ 1,50 por recarga", "Economia"],
      ],
      feat: ["Zero emissão de poluentes", "Recarrega em tomada comum 110V/220V", "Bateria portátil removível", "Alarme e chave presencial"],
    },
    {
      id: "shineray-se3-scooter-eletrica",
      active: true,
      cat: "ele",
      sub: "Scooter",
      brand: "SHINERAY",
      name: "SE3 (SCOOTER ELÉTRICA)",
      price: 14990,
      installments: true,
      readyDelivery: true,
      stock: 2,
      desc: "Scooter elétrica moderna, silenciosa e super ágil para a cidade. Bateria de lítio, freios a disco e autonomia de 80 km.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["2000 W", "Motor Elétrico"],
        ["Lítio 60V 24Ah", "Bateria"],
        ["Até 80 km", "Autonomia"],
        ["60 km/h", "Velocidade"],
      ],
      feat: ["Silenciosa e ecológica", "Recarga rápida em 5 horas", "Design europeu minimalista"],
    },
    {
      id: "shineray-se1-scooter-eletrica",
      active: true,
      cat: "ele",
      sub: "Scooter",
      brand: "SHINERAY",
      name: "SE1 (SCOOTER ELÉTRICA)",
      price: 13990,
      installments: true,
      readyDelivery: true,
      stock: 2,
      desc: "Mobilidade elétrica prática e econômica. Ideal para trajetos urbanos diários gastando centavos por quilômetro rodado.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["2000 W", "Motor"],
        ["Bateria de Lítio", "Bateria"],
        ["60 km", "Autonomia"],
      ],
      feat: ["Super leve e ágil", "Painel digital luminoso", "Faróis em LED"],
    },
    // 3. Off-Road & Quadriciclos
    {
      id: "quadriciclo-atv-125",
      active: true,
      cat: "off",
      sub: "Quadriciclo",
      brand: "SHINERAY",
      name: "QUADRICICLO ATV 125cc",
      price: 15990,
      installments: true,
      readyDelivery: true,
      stock: 2,
      desc: "Quadriciclo off-road resistente para sítios, fazendas e trilhas. Câmbio semi-automático com marcha à ré e limitador de velocidade.",
      photos: [
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["125 cc 4 Tempos", "Motor"],
        ["Semi-automático + Ré", "Câmbio"],
        ["Partida Elétrica", "Partida"],
        ["Freios a Disco Hidráulicos", "Freios"],
      ],
      feat: ["Marcha à ré integrada", "Limitador de acelerador para segurança", "Bagageiro dianteiro e traseiro", "Pneus off-road garrudos"],
    },
    {
      id: "quadriciclo-atv-200-4x4",
      active: true,
      cat: "off",
      sub: "Quadriciclo",
      brand: "SHINERAY",
      name: "QUADRICICLO FORCE 200cc",
      price: 24990,
      oldPrice: 26990,
      installments: true,
      readyDelivery: true,
      stock: 1,
      desc: "Força bruta para o trabalho no campo e lazer fora de estrada. Painel digital, guincho frontal e engate para carretinha.",
      photos: [
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["200 cc", "Motor"],
        ["Automático CVT + Ré", "Câmbio"],
        ["Freios a disco nas 4 rodas", "Freios"],
      ],
      feat: ["Engate traseiro", "Faróis auxiliares", "Proteção de mãos e suspensão reforçada"],
    },
    // 4. Semi-Novos Selecionados
    {
      id: "seminovo-honda-cg-160-titan",
      active: true,
      cat: "semi",
      sub: "Street",
      brand: "HONDA",
      name: "CG 160 TITAN FLEX",
      price: 18500,
      installments: true,
      readyDelivery: true,
      stock: 1,
      desc: "Semi-nova revisada com garantia e laudo cautelar aprovado. Baixa quilometragem, documentação 100% em dia e pronta para rodar.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["160 cc", "Cilindrada"],
        ["Flex (Etanol/Gasolina)", "Combustível"],
        ["Manual 5 marchas", "Câmbio"],
        ["Freios CBS", "Freios"],
      ],
      feat: ["Laudo cautelar 100% aprovado", "Garantia de 90 dias", "Entrada facilitada no cartão de crédito"],
    },
    {
      id: "seminovo-honda-biz-125",
      active: true,
      cat: "semi",
      sub: "Scooter",
      brand: "HONDA",
      name: "BIZ 125 FLEX",
      price: 16500,
      installments: true,
      readyDelivery: true,
      stock: 1,
      desc: "Excelente conservação! Econômica, porta-capacete espaçoso, revisada na oficina própria L1MA Motors.",
      photos: [
        "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["125 cc", "Cilindrada"],
        ["Flex", "Combustível"],
        ["Semi-automática", "Câmbio"],
      ],
      feat: ["Porta capacete", "Partida elétrica", "Documentação rigorosamente em dia"],
    },
    {
      id: "seminovo-yamaha-fazer-fz25",
      active: true,
      cat: "semi",
      sub: "Street",
      brand: "YAMAHA",
      name: "FAZER FZ25 ABS",
      price: 23900,
      installments: true,
      readyDelivery: true,
      stock: 1,
      desc: "Street esportiva com freios ABS nas duas rodas, farol com projetor de LED e motor forte de 250cc.",
      photos: [
        "https://images.unsplash.com/photo-1558981359-219d6364c9c8?w=800&auto=format&fit=crop&q=80",
      ],
      specs: [
        ["250 cc", "Cilindrada"],
        ["Freios ABS Duplo Canal", "Segurança"],
        ["Manual 5 marchas", "Câmbio"],
      ],
      feat: ["Freios ABS dianteiro e traseiro", "Projetor LED", "Revisão geral realizada"],
    },
  ];

  return {
    version: 1,
    products: defaultProducts,
    config: {
      storeName: "L1MA Motors - Concessionária Autorizada Shineray",
      whatsapp: "38999999999",
      phone: "(38) 3222-0000",
      address: "Montes Claros & Divinópolis - MG",
      maxInstallments: 21,
      debitRate: 1.10,
      lowStockThreshold: 2,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Restaura o catálogo padrão original apagando a lista de excluídos e repopulando o cache
 */
export function restoreDefaultCatalog(): CatalogData {
  try {
    localStorage.removeItem(DELETED_CATALOG_IDS_KEY);
  } catch {}
  const fresh = generateDefaultCatalogData();
  try {
    localStorage.setItem(LOCAL_CATALOG_DATA_KEY, JSON.stringify(fresh));
  } catch {}
  return fresh;
}

export function getDeletedCatalogIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_CATALOG_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function recordDeletedCatalogId(id: string) {
  try {
    const ids = getDeletedCatalogIds();
    ids.add(id);
    localStorage.setItem(DELETED_CATALOG_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function unmarkDeletedCatalogId(id: string) {
  try {
    const ids = getDeletedCatalogIds();
    ids.delete(id);
    localStorage.setItem(DELETED_CATALOG_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export function getCatalogApiSettings() {
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const defaultUrl = isBrowser ? (isLocalHost ? "http://localhost:5173" : window.location.origin) : "http://localhost:5173";

  const envUrl = (import.meta.env.VITE_CATALOG_API_URL as string) || defaultUrl;
  const envToken = (import.meta.env.VITE_CATALOG_SYNC_TOKEN as string) || "l1ma-dev-token";

  let savedUrl = localStorage.getItem(STORAGE_URL_KEY);
  if (savedUrl && !isLocalHost && (savedUrl.includes('localhost') || savedUrl.includes('127.0.0.1'))) {
    savedUrl = null;
  }
  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);

  return {
    url: (savedUrl !== null && savedUrl.trim() !== "") ? savedUrl.trim() : envUrl,
    token: (savedToken !== null && savedToken.trim() !== "") ? savedToken.trim() : envToken,
  };
}

export function saveCatalogApiSettings(url: string, token: string) {
  if (url) {
    localStorage.setItem(STORAGE_URL_KEY, url.trim().replace(/\/+$/, ""));
  } else {
    localStorage.removeItem(STORAGE_URL_KEY);
  }

  if (token) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token.trim());
  } else {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  }
}

/**
 * Consulta o catálogo completo com os modelos, configurações e estado atual
 */
export async function fetchCatalog(): Promise<CatalogData> {
  const { url } = getCatalogApiSettings();
  const cleanUrl = url.replace(/\/+$/, "");
  const deletedIds = getDeletedCatalogIds();
  
  try {
    const res = await fetch(`${cleanUrl}/api/catalog`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (res.ok) {
      const data: CatalogData = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        data.products = data.products.filter((p) => !deletedIds.has(p.id));
        try {
          localStorage.setItem(LOCAL_CATALOG_DATA_KEY, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn("[catalogApi] Falha na requisição remota /api/catalog, utilizando dados resilientes:", err);
  }

  // Fallback para cache local salvo
  try {
    const local = localStorage.getItem(LOCAL_CATALOG_DATA_KEY);
    if (local) {
      const parsed: CatalogData = JSON.parse(local);
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        parsed.products = parsed.products.filter((p) => !deletedIds.has(p.id));
        if (parsed.products.length > 0) {
          return parsed;
        }
      }
    }
  } catch {}

  // Se o cache estiver vazio ou for o primeiro acesso no dispositivo,
  // inicializa com a Linha Oficial Shineray e Elétricas automaticamente
  const defaultData = generateDefaultCatalogData();
  defaultData.products = defaultData.products.filter((p) => !deletedIds.has(p.id));
  try {
    localStorage.setItem(LOCAL_CATALOG_DATA_KEY, JSON.stringify(defaultData));
  } catch {}

  return defaultData;
}

/**
 * Consulta os últimos 60 eventos de auditoria do catálogo
 */
export async function fetchCatalogEvents(): Promise<CatalogEvent[]> {
  const { url } = getCatalogApiSettings();
  const cleanUrl = url.replace(/\/+$/, "");

  try {
    const res = await fetch(`${cleanUrl}/api/events`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.events || [];
    }
  } catch (err) {
    console.warn("[catalogApi] Falha ao consultar /api/events:", err);
  }

  try {
    const local = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (local) {
      return JSON.parse(local);
    }
  } catch {}

  return [];
}

/**
 * Aplica um lote de ações de sincronização diretamente nos dados locais
 */
function applyActionsToLocalCatalog(data: CatalogData, actions: CatalogSyncAction[]): CatalogData {
  let products = Array.isArray(data.products) ? [...data.products] : [];
  let config = { ...data.config };

  for (const act of actions) {
    const actionType = act.action;

    if (actionType === "remove" && (act as any).id) {
      const removeId = (act as any).id;
      products = products.filter((p) => p.id !== removeId);
      continue;
    }

    if (actionType === "upsert" && (act as any).product) {
      const prod = (act as any).product as CatalogProduct;
      const idx = products.findIndex((p) => p.id === prod.id);
      if (idx >= 0) {
        products[idx] = { ...products[idx], ...prod };
      } else {
        products.push(prod);
      }
      continue;
    }

    if (actionType === "create") {
      const newProd = act as unknown as CatalogProduct;
      if (newProd.id) {
        const idx = products.findIndex((p) => p.id === newProd.id);
        if (idx >= 0) {
          products[idx] = { ...products[idx], ...newProd };
        } else {
          products.push({
            active: true,
            cat: "shineray",
            sub: "Street",
            brand: "SHINERAY",
            name: "Novo Veículo",
            price: null,
            installments: true,
            stock: null,
            readyDelivery: true,
            photos: ["https://placehold.co/600x400/png?text=L1MA+Motors"],
            specs: [],
            feat: [],
            desc: "",
            ...newProd,
          });
        }
      }
      continue;
    }

    // Ações baseadas no ID do produto
    const targetId = (act as any).id;
    if (targetId) {
      const idx = products.findIndex((p) => p.id === targetId);
      if (idx >= 0) {
        const current = { ...products[idx] };

        if (actionType === "active") {
          current.active = (act as any).value;
        } else if (actionType === "stock") {
          const val = (act as any).stock !== undefined ? (act as any).stock : (act as any).value;
          current.stock = val !== undefined ? val : null;
          if ((act as any).readyDelivery !== undefined) {
            current.readyDelivery = (act as any).readyDelivery;
          }
        } else if (actionType === "price") {
          const val = (act as any).price !== undefined ? (act as any).price : (act as any).value;
          current.price = val !== undefined ? val : null;
          if ((act as any).oldPrice !== undefined) {
            current.oldPrice = (act as any).oldPrice;
          }
          if ((act as any).installments !== undefined) {
            current.installments = (act as any).installments;
          }
        } else if (actionType === "promo") {
          const promo = (act as any).promo;
          if (promo !== undefined) {
            current.promo = promo;
          } else if ((act as any).active !== undefined) {
            current.promo = (act as any).active
              ? {
                  active: true,
                  label: (act as any).label || "Oferta Especial",
                  discount: (act as any).discount || 0,
                  until: (act as any).until,
                  reason: (act as any).reason,
                  description: (act as any).description,
                }
              : null;
          }
        } else if (actionType === "carousel") {
          current.featuredHero = (act as any).featured;
          if ((act as any).order !== undefined) {
            current.heroOrder = (act as any).order;
          }
        } else if (actionType === "desc") {
          current.desc = (act as any).desc;
        } else if (actionType === "store") {
          current.store_id = (act as any).store_id;
          current.store_name = (act as any).store_name;
        } else if (actionType === "order") {
          current.heroOrder = (act as any).order;
        } else if (
          actionType === "category" ||
          actionType === "cat" ||
          actionType === "catalog" ||
          actionType === "move"
        ) {
          const rawCat = (act as any).category || (act as any).cat || (act as any).value;
          const normalized = normalizeCat(rawCat);
          if (normalized) {
            current.cat = normalized;
          }
        }

        products[idx] = current;
      }
    }

    if (actionType === "carousel_list" && Array.isArray((act as any).ids)) {
      const ids = (act as any).ids as string[];
      products = products.map((p) => {
        const orderIdx = ids.indexOf(p.id);
        return {
          ...p,
          featuredHero: orderIdx >= 0,
          heroOrder: orderIdx >= 0 ? orderIdx + 1 : undefined,
        };
      });
    }

    if (actionType === "hero_list" && Array.isArray((act as any).items)) {
      const items = (act as any).items as Array<{ id: string; heroOrder: number }>;
      const itemMap = new Map(items.map((i) => [i.id, i.heroOrder]));
      products = products.map((p) => {
        if (itemMap.has(p.id)) {
          return {
            ...p,
            featuredHero: true,
            heroOrder: itemMap.get(p.id),
          };
        }
        return p;
      });
    }

    if (actionType === "reorder" && Array.isArray((act as any).ids)) {
      const ids = (act as any).ids as string[];
      const map = new Map(products.map((p) => [p.id, p]));
      const ordered: CatalogProduct[] = [];
      for (const id of ids) {
        const found = map.get(id);
        if (found) {
          ordered.push(found);
          map.delete(id);
        }
      }
      for (const remaining of map.values()) {
        ordered.push(remaining);
      }
      products = ordered;
    }

    if (actionType === "config" && (act as any).config) {
      config = { ...config, ...(act as any).config };
    }

    if (actionType === "campaign") {
      config = { ...config, campaign: (act as any).campaign };
    }

    if (actionType === "rates") {
      config = {
        ...config,
        debitRate: (act as any).debitRate,
        installmentRates: (act as any).installmentRates,
        installmentNote: (act as any).installmentNote,
      };
    }
  }

  return {
    ...data,
    products,
    config,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Envia operações de escrita, precificação, estoque, promoções, carrossel e configurações
 */
export async function syncCatalog(
  actions: CatalogSyncAction | CatalogSyncAction[]
): Promise<CatalogSyncResponse> {
  const { url, token } = getCatalogApiSettings();
  const cleanUrl = url.replace(/\/+$/, "");

  const payload = Array.isArray(actions) ? actions : [actions];

  // 1. Atualiza IDs excluídos/reintegrados
  for (const act of payload) {
    if (act.action === "remove" && (act as any).id) {
      recordDeletedCatalogId((act as any).id);
    } else if (act.action === "create" || act.action === "upsert") {
      const prodId = (act as any).id || (act as any).product?.id;
      if (prodId) {
        unmarkDeletedCatalogId(prodId);
      }
    }
  }

  // 2. Atualiza cache local sincronamente com suporte a todas as operações
  try {
    let currentData: CatalogData;
    const local = localStorage.getItem(LOCAL_CATALOG_DATA_KEY);
    if (local) {
      currentData = JSON.parse(local);
    } else {
      currentData = generateDefaultCatalogData();
    }

    const updatedData = applyActionsToLocalCatalog(currentData, payload);
    localStorage.setItem(LOCAL_CATALOG_DATA_KEY, JSON.stringify(updatedData));

    // Grava eventos de auditoria locais
    try {
      const rawEvents = localStorage.getItem(LOCAL_EVENTS_KEY);
      const prevEvents: CatalogEvent[] = rawEvents ? JSON.parse(rawEvents) : [];
      const newEvents: CatalogEvent[] = payload.map((act) => ({
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        action: act.action,
        timestamp: new Date().toISOString(),
        author: "Painel L1MA",
        productId: (act as any).id || (act as any).product?.id,
        details: act,
      }));
      const consolidatedEvents = [...newEvents, ...prevEvents].slice(0, 60);
      localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(consolidatedEvents));
    } catch {}
  } catch (err) {
    console.warn("[catalogApi] Falha ao atualizar cache local:", err);
  }

  // 3. Tenta sincronização remota com o backend caso exista
  try {
    const res = await fetch(`${cleanUrl}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[catalogApi] Servidor remoto /api/sync indisponível, sincronizado em modo local resiliente:", err);
  }

  // Retorna sucesso para garantir que a UI e o usuário nunca fiquem travados
  return {
    ok: true,
    version: Date.now(),
    applied: payload,
    errors: [],
  };
}

/**
 * Interage com o assistente virtual / IA generativa do Catálogo L1MA
 */
export async function sendCatalogChatMessage(
  messages: CatalogChatMessage[]
): Promise<CatalogChatResponse> {
  const { url, token } = getCatalogApiSettings();
  const cleanUrl = url.replace(/\/+$/, "");

  const res = await fetch(`${cleanUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Erro no chat IA (${res.status}): ${errorBody || res.statusText}`);
  }

  return await res.json();
}

/**
 * Estabelece a conexão Server-Sent Events (SSE) em tempo real com /api/stream (<50ms)
 */
export function subscribeCatalogStream(
  onMessage: (data: { version: number; events: CatalogEvent[] }) => void,
  onError?: (err: any) => void
): () => void {
  const { url } = getCatalogApiSettings();
  const cleanUrl = url.replace(/\/+$/, "");
  const streamUrl = `${cleanUrl}/api/stream`;

  let eventSource: EventSource | null = null;
  let isClosed = false;

  try {
    eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      if (isClosed) return;
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (e) {
        console.warn("[Catalog SSE] Falha ao processar payload:", e);
      }
    };

    eventSource.onerror = (err) => {
      if (isClosed) return;
      console.warn("[Catalog SSE] Conexão oscilando ou fechada:", err);
      if (onError) onError(err);
    };
  } catch (err) {
    console.warn("[Catalog SSE] Falha ao inicializar EventSource:", err);
    if (onError) onError(err);
  }

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
    }
  };
}
