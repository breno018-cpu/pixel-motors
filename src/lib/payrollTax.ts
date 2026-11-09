/**
 * Cálculo de encargos legais da folha de pagamento — Brasil.
 *
 * Tabelas vigentes em 2025 (Reforma Tributária mantém as mesmas faixas para 2026
 * até publicação oficial). Os valores ficam centralizados para fácil atualização.
 */

export const INSS_TABLE_2025 = [
  { limit: 1518.0, rate: 0.075 },
  { limit: 2793.88, rate: 0.09 },
  { limit: 4190.83, rate: 0.12 },
  { limit: 8157.41, rate: 0.14 }, // teto contributivo
];
export const INSS_CEILING_2025 = 951.62;

export const IRRF_TABLE_2025 = [
  { limit: 2428.8, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 182.16 },
  { limit: 3751.05, rate: 0.15, deduction: 394.16 },
  { limit: 4664.68, rate: 0.225, deduction: 675.49 },
  { limit: Infinity, rate: 0.275, deduction: 908.73 },
];
export const IRRF_DEPENDENT_DEDUCTION = 189.59;
export const FGTS_RATE = 0.08;

/** Calcula o desconto de INSS progressivo sobre a base de cálculo (proventos tributáveis). */
export function calcINSS(base: number): number {
  const b = Math.max(0, Number(base) || 0);
  if (b <= 0) return 0;

  let total = 0;
  let prevLimit = 0;
  for (const tier of INSS_TABLE_2025) {
    if (b > tier.limit) {
      total += (tier.limit - prevLimit) * tier.rate;
      prevLimit = tier.limit;
    } else {
      total += (b - prevLimit) * tier.rate;
      return round2(total);
    }
  }
  // Acima do teto
  return round2(Math.min(total, INSS_CEILING_2025));
}

/** Calcula o IRRF pela tabela progressiva. Base = proventos tributáveis - INSS - dependentes. */
export function calcIRRF(base: number, dependents = 0): number {
  const dep = Math.max(0, Number(dependents) || 0);
  const b = Math.max(0, (Number(base) || 0) - dep * IRRF_DEPENDENT_DEDUCTION);
  for (const tier of IRRF_TABLE_2025) {
    if (b <= tier.limit) {
      const tax = b * tier.rate - tier.deduction;
      return round2(Math.max(0, tax));
    }
  }
  return 0;
}

/** FGTS é depositado pela empresa (8% da base) — não é desconto, apenas informativo. */
export function calcFGTS(base: number): number {
  return round2(Math.max(0, Number(base) || 0) * FGTS_RATE);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export interface LegalChargesResult {
  base: number;
  inss: number;
  irrfBase: number;
  irrf: number;
  fgts: number;
}

/**
 * Calcula todos os encargos a partir da base de proventos tributáveis.
 * `base` = salário + comissões + horas extras + bônus + comissão de gerência
 * (valores não-tributáveis como vale transporte/refeição entram conforme regra
 * do usuário — por padrão NÃO somar aqui).
 */
export function calcLegalCharges(base: number, dependents = 0): LegalChargesResult {
  const inss = calcINSS(base);
  const irrfBase = Math.max(0, base - inss);
  const irrf = calcIRRF(irrfBase, dependents);
  const fgts = calcFGTS(base);
  return { base, inss, irrfBase, irrf, fgts };
}