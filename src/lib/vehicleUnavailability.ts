import type { Vehicle } from '@/hooks/useVehicles';

export interface UnavailabilityTask {
  id: string;
  label: string;
  done: boolean;
  estimatedCost?: number;
}

export interface VehicleUnavailabilityMeta {
  active: boolean;
  reason: string;
  description: string;
  tasks: UnavailabilityTask[];
  updatedAt: string;
}

export const UNAVAILABILITY_REASONS = [
  'Faltando peça para montagem',
  'Em montagem na oficina',
  'Avaria de transporte',
  'Aguardando bateria / carregador',
  'Revisão / manutenção preventiva',
  'Pendência documental',
] as const;

const START_MARKER = '[[INDISPONIVEL_JSON:';
const END_MARKER = ':FIM_INDISPONIVEL]]';

/**
 * Extrai metadados estruturados de indisponibilidade temporária + checklist do campo `notes` do veículo.
 * Mantém 100% de compatibilidade com observações normais existentes sem alterar o schema do banco.
 */
export function parseVehicleUnavailability(notes?: string | null): VehicleUnavailabilityMeta | null {
  if (!notes) return null;
  const startIdx = notes.indexOf(START_MARKER);
  if (startIdx === -1) return null;
  const endIdx = notes.indexOf(END_MARKER, startIdx + START_MARKER.length);
  if (endIdx === -1) return null;

  const rawJson = notes.slice(startIdx + START_MARKER.length, endIdx).trim();
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') return null;
    const tasks: UnavailabilityTask[] = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t: any) => t && typeof t.label === 'string' && t.label.trim())
          .map((t: any, idx: number) => ({
            id: String(t.id || `task-${idx}`),
            label: String(t.label).trim(),
            done: Boolean(t.done),
            estimatedCost: typeof t.estimatedCost === 'number' && !Number.isNaN(t.estimatedCost) ? t.estimatedCost : undefined,
          }))
      : [];

    return {
      active: parsed.active !== false,
      reason: String(parsed.reason || 'Em montagem / pendência').trim(),
      description: String(parsed.description || '').trim(),
      tasks,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

/**
 * Remove o bloco estruturado de indisponibilidade preservando o restante das observações do veículo.
 */
export function stripUnavailabilityBlock(notes?: string | null): string {
  if (!notes) return '';
  const startIdx = notes.indexOf(START_MARKER);
  if (startIdx === -1) return notes.trim();
  const endIdx = notes.indexOf(END_MARKER, startIdx + START_MARKER.length);
  if (endIdx === -1) return notes.slice(0, startIdx).trim();
  const before = notes.slice(0, startIdx).trim();
  const after = notes.slice(endIdx + END_MARKER.length).trim();
  return [before, after].filter(Boolean).join('\n').trim();
}

/**
 * Grava o bloco estruturado dentro de `notes` preservando observações anteriores.
 */
export function serializeVehicleUnavailability(
  existingNotes: string | null | undefined,
  meta: VehicleUnavailabilityMeta
): string {
  const cleanNotes = stripUnavailabilityBlock(existingNotes);
  const block = `${START_MARKER}${JSON.stringify({
    active: meta.active,
    reason: meta.reason.trim(),
    description: meta.description.trim(),
    tasks: meta.tasks,
    updatedAt: meta.updatedAt || new Date().toISOString(),
  })}${END_MARKER}`;

  return cleanNotes ? `${cleanNotes}\n${block}` : block;
}

export function isVehicleTemporarilyUnavailable(vehicle?: Pick<Vehicle, 'status' | 'notes'> | null): boolean {
  if (!vehicle || vehicle.status === 'vendido') return false;
  const meta = parseVehicleUnavailability(vehicle.notes);
  return Boolean(meta?.active);
}

export function getUnavailabilityProgress(meta?: VehicleUnavailabilityMeta | null): {
  total: number;
  done: number;
  percent: number;
} {
  const tasks = meta?.tasks || [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}
