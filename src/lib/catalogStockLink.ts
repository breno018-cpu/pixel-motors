import { supabase } from "@/integrations/supabase/client";
import { CatalogProduct } from "@/types/catalog";
import { Vehicle } from "@/hooks/useVehicles";

export interface ChassisPatternItem {
  id?: string;
  wmi_code: string;
  model_pattern: string;
  model_name: string;
  brand: string;
  engine_cc?: number | null;
  code: string; // Ex: "99H-WRK125"
  label: string; // Ex: "99H-WRK125 • WORKER 125 (Shineray)"
}

export const FALLBACK_PATTERNS: ChassisPatternItem[] = [
  { wmi_code: "99H", model_pattern: "WRK125", model_name: "WORKER 125", brand: "SHINERAY", engine_cc: 125, code: "99H-WRK125", label: "99H-WRK125 • WORKER 125 (125cc)" },
  { wmi_code: "99H", model_pattern: "JTS125", model_name: "JET 125 SS", brand: "SHINERAY", engine_cc: 125, code: "99H-JTS125", label: "99H-JTS125 • JET 125 SS (125cc)" },
  { wmi_code: "99H", model_pattern: "NJ1125", model_name: "NEW JET 125 SS", brand: "SHINERAY", engine_cc: 125, code: "99H-NJ1125", label: "99H-NJ1125 • NEW JET 125 SS (125cc)" },
  { wmi_code: "99H", model_pattern: "PHS050", model_name: "PHOENIX 50 EFI", brand: "SHINERAY", engine_cc: 50, code: "99H-PHS050", label: "99H-PHS050 • PHOENIX 50 EFI (50cc)" },
  { wmi_code: "99H", model_pattern: "STF200", model_name: "STORM 200 EFI", brand: "SHINERAY", engine_cc: 200, code: "99H-STF200", label: "99H-STF200 • STORM 200 EFI (200cc)" },
  { wmi_code: "99H", model_pattern: "SHF250", model_name: "SHI 250 EFI", brand: "SHINERAY", engine_cc: 250, code: "99H-SHF250", label: "99H-SHF250 • SHI 250 EFI (250cc)" },
  { wmi_code: "99H", model_pattern: "SHF175", model_name: "SHI 175 EFI", brand: "SHINERAY", engine_cc: 175, code: "99H-SHF175", label: "99H-SHF175 • SHI 175 EFI (175cc)" },
  { wmi_code: "99H", model_pattern: "NS1175", model_name: "SHI 175 CARBURADA", brand: "SHINERAY", engine_cc: 175, code: "99H-NS1175", label: "99H-NS1175 • SHI 175 CARBURADA (175cc)" },
  { wmi_code: "99H", model_pattern: "R1F125", model_name: "RIO 125 EFI", brand: "SHINERAY", engine_cc: 125, code: "99H-R1F125", label: "99H-R1F125 • RIO 125 EFI (125cc)" },
  { wmi_code: "99H", model_pattern: "FREE150", model_name: "FREE 150 EFI", brand: "SHINERAY", engine_cc: 150, code: "99H-FREE150", label: "99H-FREE150 • FREE 150 EFI (150cc)" },
  { wmi_code: "99H", model_pattern: "TIT250", model_name: "TITANIUM 250 EFI", brand: "SHINERAY", engine_cc: 250, code: "99H-TIT250", label: "99H-TIT250 • TITANIUM 250 EFI (250cc)" },
  { wmi_code: "99H", model_pattern: "DVF250", model_name: "DENVER 250", brand: "SHINERAY", engine_cc: 250, code: "99H-DVF250", label: "99H-DVF250 • DENVER 250 (250cc)" },
  { wmi_code: "99H", model_pattern: "CS2170", model_name: "SHI 170", brand: "SHINERAY", engine_cc: 170, code: "99H-CS2170", label: "99H-CS2170 • SHI 170 (170cc)" },
];

/**
 * Consulta padrões de verificação cadastrados no Supabase com fallback local
 */
export async function fetchChassisPatterns(): Promise<ChassisPatternItem[]> {
  try {
    const { data, error } = await supabase
      .from("chassis_patterns")
      .select("*")
      .order("brand", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((p) => {
        const wmi = (p.wmi_code || "").toUpperCase();
        const pat = (p.model_pattern || "").toUpperCase();
        const code = pat ? (wmi ? `${wmi}-${pat}` : pat) : wmi;
        return {
          id: p.id,
          wmi_code: wmi,
          model_pattern: pat,
          model_name: p.model_name || pat,
          brand: p.brand || "SHINERAY",
          engine_cc: p.engine_cc,
          code,
          label: `${code} • ${p.model_name || pat}${p.engine_cc ? ` (${p.engine_cc}cc)` : ""}`,
        };
      });
    }
  } catch (err) {
    console.warn("[catalogStockLink] Usando padrões padrão:", err);
  }

  return FALLBACK_PATTERNS;
}

/**
 * Normaliza textos para comparação sem acento e caracteres especiais
 */
function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Sugere automaticamente o padrão de verificação para um produto do catálogo
 */
export function suggestPatternForProduct(
  product: CatalogProduct,
  patterns: ChassisPatternItem[]
): ChassisPatternItem | null {
  if (product.patternCode) {
    const found = patterns.find(
      (p) =>
        p.code.toUpperCase() === product.patternCode?.toUpperCase() ||
        p.model_pattern.toUpperCase() === product.patternCode?.toUpperCase()
    );
    if (found) return found;
  }

  const pNormName = normalize(product.name);
  const pNormId = normalize(product.id);

  // 1. Busca por equivalência de modelo
  for (const pat of patterns) {
    const patNormName = normalize(pat.model_name);
    const patNormCode = normalize(pat.model_pattern);

    if (
      pNormName.includes(patNormName) ||
      patNormName.includes(pNormName) ||
      pNormId.includes(patNormCode)
    ) {
      return pat;
    }
  }

  return null;
}

export interface RealStockMatchResult {
  totalCount: number;
  availableVehicles: Vehicle[];
  chassisList: string[];
  matchedPattern: ChassisPatternItem | null;
  storeCounts: Record<string, number>;
}

/**
 * Calcula em tempo real quantas motos físicas existem no estoque (status: 'disponivel')
 * que correspondem a este modelo do catálogo.
 */
export function calculateRealStockForProduct(
  product: CatalogProduct,
  vehicles: Vehicle[],
  patterns: ChassisPatternItem[]
): RealStockMatchResult {
  const pattern = suggestPatternForProduct(product, patterns);
  const patternToken = pattern?.model_pattern?.toUpperCase() || "";
  const normProductName = normalize(product.name);

  // Filtra apenas motos disponíveis no estoque físico
  const availableVehicles = vehicles.filter((v) => {
    if (v.status !== "disponivel") return false;

    // Se tiver padrão de chassi vinculado, testa no número do chassi
    const cleanChassis = (v.chassis || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (patternToken && cleanChassis.includes(patternToken)) {
      return true;
    }

    // Compara pelo nome do modelo cadastrado no pátio
    const normVehicleModel = normalize(v.model || "");
    if (normVehicleModel && normProductName) {
      if (
        normVehicleModel.includes(normProductName) ||
        normProductName.includes(normVehicleModel)
      ) {
        return true;
      }
    }

    // Se o padrão tiver model_name
    if (pattern?.model_name) {
      const normPatternName = normalize(pattern.model_name);
      if (
        normVehicleModel.includes(normPatternName) ||
        normPatternName.includes(normVehicleModel)
      ) {
        return true;
      }
    }

    return false;
  });

  const chassisList = availableVehicles
    .map((v) => v.chassis)
    .filter((c): c is string => !!c && c.toUpperCase() !== "DISPENSADO");

  const storeCounts: Record<string, number> = {};
  availableVehicles.forEach((v) => {
    const sId = v.store_id || "sem_loja";
    storeCounts[sId] = (storeCounts[sId] || 0) + 1;
  });

  return {
    totalCount: availableVehicles.length,
    availableVehicles,
    chassisList,
    matchedPattern: pattern,
    storeCounts,
  };
}
