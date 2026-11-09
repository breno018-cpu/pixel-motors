/** Normaliza um @ do Instagram: remove @, espaços e URL. */
export function normalizeHandle(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9._]/g, '')
    .toLowerCase();
}

export function instagramProfileUrl(handle: string) {
  return `https://www.instagram.com/${normalizeHandle(handle)}/`;
}

/**
 * Biblioteca de Anúncios da Meta, pública e sem login, já filtrada
 * pelos anúncios ativos do @ informado no Brasil.
 */
export function adLibraryUrl(handle: string, opts?: { country?: string; activeOnly?: boolean }) {
  const params = new URLSearchParams({
    active_status: opts?.activeOnly === false ? 'all' : 'active',
    ad_type: 'all',
    country: opts?.country || 'BR',
    q: normalizeHandle(handle),
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}
