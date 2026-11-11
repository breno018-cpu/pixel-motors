import { CatalogData, CatalogSyncAction, CatalogSyncResponse, CatalogEvent } from "@/types/catalog";

const STORAGE_URL_KEY = "dealflow_catalog_api_url";
const STORAGE_TOKEN_KEY = "dealflow_catalog_sync_token";

export function getCatalogApiSettings() {
  const envUrl = (import.meta.env.VITE_CATALOG_API_URL as string) || "http://localhost:5173";
  const envToken = (import.meta.env.VITE_CATALOG_SYNC_TOKEN as string) || "l1ma-dev-token";

  const savedUrl = localStorage.getItem(STORAGE_URL_KEY);
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
      console.warn("[Catalog SSE] Erro na conexão:", err);
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
