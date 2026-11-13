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
 * Consulta o catálogo completo com os 79 modelos, configurações e estado atual
 */
export async function fetchCatalog(): Promise<CatalogData> {
  const { url } = getCatalogApiSettings();
  const cleanUrl = url.replace(/\/+$/, "");
  
  const res = await fetch(`${cleanUrl}/api/catalog`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Falha ao obter dados do catálogo (${res.status} ${res.statusText})`);
  }

  return await res.json();
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

  return [];
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

  const res = await fetch(`${cleanUrl}/api/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Erro de sincronização (${res.status}): ${errorBody || res.statusText}`);
  }

  return await res.json();
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
