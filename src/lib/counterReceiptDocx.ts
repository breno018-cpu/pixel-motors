import JSZip from 'jszip';

const IDB_NAME = 'dealflow_counter_docx_templates_db';
const IDB_STORE = 'docx_files';

function openDocxDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocxTemplateBlob(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openDocxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(buffer, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getDocxTemplateBlob(id: string): Promise<ArrayBuffer | null> {
  const db = await openDocxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as ArrayBuffer) || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteDocxTemplateBlob(id: string): Promise<void> {
  const db = await openDocxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const TARGET_XML_REGEX = /^word\/(document|header\d+|footer\d+)\.xml$/i;
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

/**
 * Coleta os nós <w:t> diretos de cada parágrafo <w:p> e reconstrói o texto contínuo
 * mesmo quando o Microsoft Word quebra {{variavel}} em vários runs XML (<w:r><w:t>).
 */
function getParagraphTextNodes(p: Element): Element[] {
  const nodes: Element[] = [];
  const walk = (el: Element) => {
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      const local = child.localName || child.nodeName.split(':').pop();
      // Evita descer em parágrafos aninhados (ex: caixas de texto dentro de parágrafos),
      // pois eles serão processados separadamente na lista global de <w:p>.
      if (local === 'p') continue;
      if (local === 't') {
        nodes.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(p);
  return nodes;
}

function getAllParagraphs(xmlDoc: Document): Element[] {
  const all = Array.from(xmlDoc.getElementsByTagName('*'));
  return all.filter((el) => (el.localName || el.nodeName.split(':').pop()) === 'p');
}

/**
 * Lê um arquivo .docx e retorna todas as variáveis {{...}} encontradas no documento,
 * cabeçalhos e rodapés.
 */
export async function inspectDocxPlaceholders(buffer: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const found = new Set<string>();
  const parser = new DOMParser();

  const xmlFiles = Object.keys(zip.files).filter((name) => TARGET_XML_REGEX.test(name));
  for (const name of xmlFiles) {
    const xmlStr = await zip.file(name)?.async('string');
    if (!xmlStr) continue;
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    for (const p of getAllParagraphs(xmlDoc)) {
      const tNodes = getParagraphTextNodes(p);
      if (tNodes.length === 0) continue;
      const fullText = tNodes.map((n) => n.textContent || '').join('');
      let match: RegExpExecArray | null;
      PLACEHOLDER_REGEX.lastIndex = 0;
      while ((match = PLACEHOLDER_REGEX.exec(fullText)) !== null) {
        found.add(`{{${match[1]}}}`);
      }
    }
  }

  return Array.from(found);
}

/**
 * Substitui todas as variáveis {{chave}} dentro de um arquivo .docx preservando
 * 100% da formatação original do Word (tabelas, logos, fontes, bordas, margens,
 * cabeçalhos e rodapés).
 */
export async function fillDocxTemplate(
  buffer: ArrayBuffer,
  values: Record<string, string>
): Promise<Blob> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // Normaliza mapa para aceitar tanto "{{chave}}" quanto "chave"
  const normalizedMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    const cleanKey = k.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();
    normalizedMap[cleanKey] = v ?? '';
  }

  const xmlFiles = Object.keys(zip.files).filter((name) => TARGET_XML_REGEX.test(name));
  for (const name of xmlFiles) {
    const xmlStr = await zip.file(name)?.async('string');
    if (!xmlStr) continue;
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    let modified = false;

    for (const p of getAllParagraphs(xmlDoc)) {
      const tNodes = getParagraphTextNodes(p);
      if (tNodes.length === 0) continue;

      // Mapeia posições de cada nó <w:t> no texto concatenado do parágrafo
      let segments = tNodes.map((node) => ({
        node,
        text: node.textContent || '',
      }));

      let fullText = segments.map((s) => s.text).join('');
      if (!fullText.includes('{{')) continue;

      // Processa substituições da direita para a esquerda para manter índices estáveis
      const matches: Array<{ start: number; end: number; key: string }> = [];
      PLACEHOLDER_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PLACEHOLDER_REGEX.exec(fullText)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, key: m[1].trim() });
      }
      if (matches.length === 0) continue;

      for (let mi = matches.length - 1; mi >= 0; mi--) {
        const { start, end, key } = matches[mi];
        if (!(key in normalizedMap)) continue;
        const replacement = normalizedMap[key];

        // Localiza quais segmentos cobrem [start, end)
        let cursor = 0;
        let firstReplaced = false;
        for (let si = 0; si < segments.length; si++) {
          const seg = segments[si];
          const segStart = cursor;
          const segEnd = cursor + seg.text.length;
          cursor = segEnd;

          if (segEnd <= start || segStart >= end) continue;

          const localStart = Math.max(0, start - segStart);
          const localEnd = Math.min(seg.text.length, end - segStart);
          const before = seg.text.slice(0, localStart);
          const after = seg.text.slice(localEnd);

          if (!firstReplaced) {
            seg.text = before + replacement + after;
            firstReplaced = true;
          } else {
            seg.text = before + after;
          }
          modified = true;
        }
      }

      if (modified) {
        for (const seg of segments) {
          seg.node.textContent = seg.text;
          if (seg.text.startsWith(' ') || seg.text.endsWith(' ')) {
            seg.node.setAttribute('xml:space', 'preserve');
          }
        }
      }
    }

    if (modified) {
      zip.file(name, serializer.serializeToString(xmlDoc));
    }
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export function downloadDocxBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
