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

export async function saveAttachmentToIdb(attachment: StoredAttachment): Promise<boolean> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(attachment);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('[IndexedDB] Erro ao salvar anexo:', e);
    return false;
  }
}

export async function getAttachmentFromIdb(id: string): Promise<StoredAttachment | null> {
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

export async function deleteAttachmentFromIdb(id: string): Promise<boolean> {
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
