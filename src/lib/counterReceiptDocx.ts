import JSZip from 'jszip';

const IDB_NAME = 'dealflow_counter_docx_templates_db';
const IDB_STORE = 'docx_files';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Cache em memória para acesso instantâneo e imune a falhas/atrasos de IndexedDB
const memoryDocxCache = new Map<string, ArrayBuffer>();

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
  const safeCopy = buffer.slice(0);
  memoryDocxCache.set(id, safeCopy);

  try {
    const db = await openDocxDb();
    const blob = new Blob([safeCopy.slice(0)], { type: DOCX_MIME });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[counterReceiptDocx] Falha ao persistir no IndexedDB (mantido em memória):', err);
  }
}

export async function getDocxTemplateBlob(id: string): Promise<ArrayBuffer | null> {
  const cached = memoryDocxCache.get(id);
  if (cached) {
    return cached.slice(0);
  }

  try {
    const db = await openDocxDb();
    const stored = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });

    if (!stored) return null;

    let buf: ArrayBuffer | null = null;
    if (stored instanceof Blob) {
      buf = await stored.arrayBuffer();
    } else if (stored instanceof ArrayBuffer) {
      buf = stored;
    } else if (ArrayBuffer.isView(stored)) {
      buf = stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength);
    }

    if (buf) {
      memoryDocxCache.set(id, buf.slice(0));
      return buf.slice(0);
    }
    return null;
  } catch (err) {
    console.warn('[counterReceiptDocx] Falha ao ler do IndexedDB:', err);
    return null;
  }
}

export async function deleteDocxTemplateBlob(id: string): Promise<void> {
  memoryDocxCache.delete(id);
  try {
    const db = await openDocxDb();
    await new Promise<void>((resolve, reject) => {
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
  } catch {
    // ignore
  }
}

const TARGET_XML_REGEX = /^word\/(document|header\d+|footer\d+)\.xml$/i;
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export interface DocxTextBlock {
  blockKey: string;
  xmlPath: string;
  pIndex: number;
  text: string;
}

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

function getSortedTargetXmlFiles(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => TARGET_XML_REGEX.test(name))
    .sort((a, b) => {
      if (a === 'word/document.xml') return -1;
      if (b === 'word/document.xml') return 1;
      return a.localeCompare(b);
    });
}

/**
 * Extrai todos os blocos de texto/células editáveis de um arquivo .docx,
 * permitindo edição direta dentro do sistema preservando o layout do Word.
 */
export async function extractDocxTextBlocks(buffer: ArrayBuffer): Promise<DocxTextBlock[]> {
  const zip = await JSZip.loadAsync(buffer.slice(0));
  const parser = new DOMParser();
  const blocks: DocxTextBlock[] = [];

  for (const xmlPath of getSortedTargetXmlFiles(zip)) {
    const xmlStr = await zip.file(xmlPath)?.async('string');
    if (!xmlStr) continue;
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    const paragraphs = getAllParagraphs(xmlDoc);

    paragraphs.forEach((p, pIndex) => {
      const tNodes = getParagraphTextNodes(p);
      if (tNodes.length === 0) return;
      const text = tNodes.map((n) => n.textContent || '').join('');
      if (!text.trim()) return;
      blocks.push({
        blockKey: `${xmlPath}::${pIndex}`,
        xmlPath,
        pIndex,
        text,
      });
    });
  }

  return blocks;
}

/**
 * Aplica edições de blocos de texto diretamente no XML do .docx, mantendo
 * intacta toda a formatação do Word (tabelas, fontes, tamanhos, cores, logos e bordas).
 */
export async function applyDocxTextBlockEdits(
  buffer: ArrayBuffer,
  edits: Record<string, string>
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer.slice(0));
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  for (const xmlPath of getSortedTargetXmlFiles(zip)) {
    const xmlStr = await zip.file(xmlPath)?.async('string');
    if (!xmlStr) continue;
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    const paragraphs = getAllParagraphs(xmlDoc);
    let modified = false;

    paragraphs.forEach((p, pIndex) => {
      const key = `${xmlPath}::${pIndex}`;
      if (!(key in edits)) return;
      const newText = edits[key];
      const tNodes = getParagraphTextNodes(p);
      if (tNodes.length === 0) return;

      const currentText = tNodes.map((n) => n.textContent || '').join('');
      if (currentText === newText) return;

      // Mantém a formatação do primeiro run (<w:rPr>) e limpa os demais runs do parágrafo
      tNodes[0].textContent = newText;
      if (newText.startsWith(' ') || newText.endsWith(' ')) {
        tNodes[0].setAttribute('xml:space', 'preserve');
      }
      for (let i = 1; i < tNodes.length; i++) {
        tNodes[i].textContent = '';
      }
      modified = true;
    });

    if (modified) {
      zip.file(xmlPath, serializer.serializeToString(xmlDoc));
    }
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Lê um arquivo .docx e retorna todas as variáveis {{...}} encontradas no documento,
 * cabeçalhos e rodapés.
 */
export async function inspectDocxPlaceholders(buffer: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer.slice(0));
  const found = new Set<string>();
  const parser = new DOMParser();

  for (const name of getSortedTargetXmlFiles(zip)) {
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
  const zip = await JSZip.loadAsync(buffer.slice(0));
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const normalizedMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    const cleanKey = k.replace(/^\{\{\s*|\s*\}\}$/g, '').trim();
    normalizedMap[cleanKey] = v ?? '';
  }

  for (const name of getSortedTargetXmlFiles(zip)) {
    const xmlStr = await zip.file(name)?.async('string');
    if (!xmlStr) continue;
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    let modified = false;

    for (const p of getAllParagraphs(xmlDoc)) {
      const tNodes = getParagraphTextNodes(p);
      if (tNodes.length === 0) continue;

      const segments = tNodes.map((node) => ({
        node,
        text: node.textContent || '',
      }));

      const fullText = segments.map((s) => s.text).join('');
      if (!fullText.includes('{{')) continue;

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
    mimeType: DOCX_MIME,
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
