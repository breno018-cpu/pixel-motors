/**
 * Utilitários para tratamento seguro de datas fiscais (Notas Fiscais, Cancelamentos e Remessas)
 * Evita desvios de fuso horário UTC (ex: 17/11 virar 16/11 ou 18/11).
 */

/**
 * Retorna a data local corrente no formato YYYY-MM-DD estrito.
 * Diferente de new Date().toISOString() que usa UTC e avança o dia após as 21h no Brasil (UTC-3).
 */
export function getLocalTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normaliza qualquer formato de data (YYYY-MM-DD, DD/MM/YYYY, ISO timestamp)
 * para o formato YYYY-MM-DD aceito pelo <input type="date"> e coluna DATE do PostgreSQL.
 */
export function normalizeDateToYMD(val?: string | null): string {
  if (!val) return getLocalTodayDateString();
  const clean = String(val).trim();
  if (!clean) return getLocalTodayDateString();

  // Caso 1: Já está em YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  const ymdMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Caso 2: Está em DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Caso 3: Fallback usando objeto Date local
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return getLocalTodayDateString();
}

/**
 * Formata com segurança qualquer representação de data para exibição em pt-BR (DD/MM/YYYY).
 * NUNCA subtrai 1 dia devido ao fuso de Brasília (UTC-3).
 */
export function formatFiscalDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const clean = String(dateStr).trim();
  if (!clean) return '—';

  // Se já for DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
    return clean.slice(0, 10);
  }

  // Se for YYYY-MM-DD ou ISO
  const ymdMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${day}/${month}/${year}`;
  }

  // Fallback
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  return clean;
}
