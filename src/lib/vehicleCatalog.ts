/** Cores padronizadas do estoque — evita variações como "prata"/"Prata "/"cinza prata". */
export const STANDARD_COLORS = [
  'Branco',
  'Preto',
  'Prata',
  'Cinza',
  'Vermelho',
  'Azul',
  'Verde',
  'Amarelo',
  'Laranja',
  'Marrom',
  'Bege',
  'Dourado',
  'Vinho',
  'Grafite',
] as const;

/** Normaliza texto livre para comparação (sem acento, minúsculo, espaços colapsados). */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Padroniza nomes em CAIXA ALTA (ex.: "cg 160 titan" -> "CG 160 TITAN"). */
export function standardizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Converte texto livre para CAIXA ALTA preservando digitação em andamento. */
export function upper(value: string): string {
  return (value || '').toUpperCase();
}

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/** Consulta o CEP nos Correios (ViaCEP) e devolve o endereço padronizado em caixa alta. */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const clean = (cep || '').replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      street: upper(data.logradouro || ''),
      neighborhood: upper(data.bairro || ''),
      city: upper(data.localidade || ''),
      state: upper(data.uf || ''),
    };
  } catch {
    return null;
  }
}

const VIN_INVALID = /[IOQ]/;

export interface VinCheck {
  valid: boolean;
  message?: string;
}

/** Validação estrutural de VIN (17 caracteres, sem I/O/Q). */
export function validateVin(chassis: string): VinCheck {
  const vin = (chassis || '').toUpperCase().trim();
  if (vin.length !== 17) return { valid: false, message: 'O chassi deve ter exatamente 17 caracteres.' };
  if (!/^[A-Z0-9]+$/.test(vin)) return { valid: false, message: 'O chassi aceita apenas letras e números.' };
  if (VIN_INVALID.test(vin)) return { valid: false, message: 'O chassi não pode conter as letras I, O ou Q.' };
  return { valid: true };
}

/** Validação de placa nos formatos antigo (ABC1234) e Mercosul (ABC1D23). */
export function validatePlate(plate: string): boolean {
  const clean = (plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return true;
  return /^[A-Z]{3}\d{4}$/.test(clean) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(clean);
}

export function formatPlate(plate: string): string {
  const clean = (plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}
