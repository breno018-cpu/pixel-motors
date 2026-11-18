/**
 * Utilitário IndexedDB para armazenamento seguro e persistente de anexos de Notas Fiscais
 * Evita o estouro de cota (5MB) do localStorage no navegador ao armazenar PDFs e imagens grandes.
 */

const DB_NAME = 'dealflow_attachments_db';
const DB_VERSION = 1;
const STORE_NAME = 'invoice_attachments';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste ambiente.'));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredAttachment {
  id: string; // ID da Nota Fiscal ou chave única
  name: string;
  url: string; // Base64 DataURL ou link
  size: number;
  type: string;
  updated_at: string;
}

/**
 * Salva anexo com segurança no IndexedDB e retorna o identificador seguro idb://{id}.
 * Suporta chamada com objeto único StoredAttachment ou com parâmetros posicionais.
 */
export async function saveAttachmentToIdb(
  attachmentOrId: StoredAttachment | string,
  name?: string,
  url?: string,
  type?: string,
  size?: number
): Promise<string> {
  let attachment: StoredAttachment;

  if (typeof attachmentOrId === 'object' && attachmentOrId !== null) {
    attachment = attachmentOrId;
  } else {
    const id = String(attachmentOrId || `att_${Date.now()}`);
    attachment = {
      id,
      name: name || `NF_${id}.pdf`,
      url: url || '',
      size: size || (url ? url.length : 0),
      type: type || 'application/pdf',
      updated_at: new Date().toISOString(),
    };
  }

  // Se a URL não for um base64 data URL pesado, não precisa do IDB
  if (attachment.url && !attachment.url.startsWith('data:')) {
    return attachment.url;
  }

  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(attachment);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    return `idb://${attachment.id}`;
  } catch (e) {
    console.warn('[IndexedDB] Erro ao salvar anexo:', e);
    // Em caso de falha no IDB, retorna idb:// para nunca sujar o localStorage com megabytes
    return `idb://${attachment.id}`;
  }
}

/**
 * Recupera um anexo armazenado no IndexedDB a partir de um ID ou URL no formato idb://{id}.
 */
export async function getAttachmentFromIdb(idOrUrl: string): Promise<StoredAttachment | null> {
  if (!idOrUrl) return null;
  const id = idOrUrl.startsWith('idb://') ? idOrUrl.slice(6) : idOrUrl;

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('[IndexedDB] Erro ao recuperar anexo:', e);
    return null;
  }
}

export async function deleteAttachmentFromIdb(idOrUrl: string): Promise<boolean> {
  if (!idOrUrl) return false;
  const id = idOrUrl.startsWith('idb://') ? idOrUrl.slice(6) : idOrUrl;

  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('[IndexedDB] Erro ao deletar anexo:', e);
    return false;
  }
}

/**
 * Remove qualquer DataURL base64 pesado de objetos antes de gravar no localStorage,
 * substituindo por ponteiro idb://{id} para nunca estourar a cota de 5MB.
 */
export function sanitizeAttachmentsForLocalStorage<T>(list: T[]): T[] {
  if (!Array.isArray(list)) return list;
  return list.map((item: any) => {
    if (!item) return item;
    const url = item.attachment_url;
    if (typeof url === 'string' && url.length > 500 && url.startsWith('data:')) {
      const safeId = item.id || `inv_${item.invoice_number || Date.now()}`;
      return {
        ...item,
        attachment_url: `idb://${safeId}`,
      };
    }
    return item;
  });
}

/**
 * Grava dados no localStorage com proteção contra QuotaExceededError.
 * Limpa DataURLs pesados automaticamente e recupera a integridade da chave.
 */
export function safeSaveToLocalStorage(key: string, data: any): boolean {
  try {
    const sanitized = Array.isArray(data) ? sanitizeAttachmentsForLocalStorage(data) : data;
    localStorage.setItem(key, JSON.stringify(sanitized));
    return true;
  } catch (err: any) {
    console.warn(`[safeSaveToLocalStorage] Cota excedida ao gravar chave "${key}". Executando limpeza emergencial...`, err);
    try {
      // 1. Limpa todas as chaves fiscais conhecidas que possam ter sido infladas
      cleanLocalStorageBloat();

      // 2. Tenta novamente após a purga
      const sanitized = Array.isArray(data) ? sanitizeAttachmentsForLocalStorage(data) : data;
      localStorage.setItem(key, JSON.stringify(sanitized));
      return true;
    } catch (err2: any) {
      console.error(`[safeSaveToLocalStorage] Falha crítica de cota no localStorage para "${key}":`, err2);
      // Como última tentativa: grava os itens desprovidos completamente do campo attachment_url
      try {
        if (Array.isArray(data)) {
          const minimal = data.map((item: any) => {
            const { attachment_url, ...rest } = item || {};
            return { ...rest, attachment_url: item?.id ? `idb://${item.id}` : undefined };
          });
          localStorage.setItem(key, JSON.stringify(minimal));
          return true;
        }
      } catch {}
      return false;
    }
  }
}

/**
 * Faz a varredura e purga proativa de qualquer DataURL Base64 em chaves do localStorage,
 * liberando imediatamente megabytes ocupados.
 */
export function cleanLocalStorageBloat(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const targetKeys = [
    'dealflow_store_fiscal_invoices_v1',
    'dealflow_cloud_invoices_v1',
    'dealflow_registered_invoices_v1',
    'dealflow_local_invoices_v1',
  ];

  targetKeys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      // Se a string da chave tiver mais de 200KB, com certeza tem DataURLs de PDFs/imagens embutidos
      if (raw.length > 200 * 1024 || raw.includes('data:application/pdf') || raw.includes('data:image/')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = sanitizeAttachmentsForLocalStorage(parsed);
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    } catch (e) {
      console.warn(`[cleanLocalStorageBloat] Erro ao limpar chave ${key}:`, e);
    }
  });
}

// Executa limpeza proativa na importação deste módulo para liberar a cota caso o usuário já esteja com o storage cheio
try {
  cleanLocalStorageBloat();
} catch {}

