/**
 * Controle de estado "Moto ainda na caixa" armazenado de forma segura em `vehicles.notes`
 * (sem exigir alteração de schema no banco de dados e 100% sincronizado entre dispositivos).
 */

export const VEHICLE_IN_BOX_TAG = '[NA_CAIXA]';

export function isVehicleInBox(notes?: string | null): boolean {
  if (!notes) return false;
  return notes.includes(VEHICLE_IN_BOX_TAG);
}

export function stripVehicleBoxTag(notes?: string | null): string {
  if (!notes) return '';
  return notes
    .replace(/\[NA_CAIXA\]\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function setVehicleInBoxNotes(notes: string | null | undefined, inBox: boolean): string | null {
  const clean = stripVehicleBoxTag(notes);
  if (inBox) {
    return clean ? `${VEHICLE_IN_BOX_TAG}\n${clean}` : VEHICLE_IN_BOX_TAG;
  }
  return clean || null;
}
