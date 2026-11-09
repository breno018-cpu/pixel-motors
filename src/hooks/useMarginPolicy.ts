import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export interface MarginPolicy {
  minMarginPercent: number; // Ex: 8%
  targetMarginPercent: number; // Ex: 18%
  maxDiscountPercent: number; // Ex: 5%
  maxDiscountAmount: number; // Ex: R$ 3500
  blockBelowCost: boolean; // Se true, impede venda abaixo do custo para vendedores
  requireManagerApproval: boolean; // Se true, vendas abaixo da margem mínima exigem liberação
}

export const DEFAULT_MARGIN_POLICY: MarginPolicy = {
  minMarginPercent: 8,
  targetMarginPercent: 18,
  maxDiscountPercent: 6,
  maxDiscountAmount: 3500,
  blockBelowCost: true,
  requireManagerApproval: true,
};

const STORAGE_KEY = 'dealflow_margin_policy_v1';

export function useMarginPolicy() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery<MarginPolicy>({
    queryKey: ['margin-policy'],
    queryFn: async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...DEFAULT_MARGIN_POLICY, ...JSON.parse(stored) };
        }
      } catch {
        // fallback
      }
      return DEFAULT_MARGIN_POLICY;
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (newPolicy: MarginPolicy) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPolicy));
      return newPolicy;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['margin-policy'], saved);
      toast({
        title: 'Políticas de margem atualizadas',
        description: `Margem mínima em ${saved.minMarginPercent}%, alvo em ${saved.targetMarginPercent}% e trava de desconto em ${saved.maxDiscountPercent}%.`,
      });
    },
  });

  return {
    policy: query.data || DEFAULT_MARGIN_POLICY,
    isLoading: query.isLoading,
    savePolicy: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

/**
 * Avalia a saúde da margem e validação comercial da proposta.
 */
export function evaluateSaleMargin(params: {
  vehicleSalePrice: number;
  negotiatedPrice: number;
  purchasePrice: number | null | undefined;
  policy: MarginPolicy;
}) {
  const { vehicleSalePrice, negotiatedPrice, purchasePrice, policy } = params;

  const cost = purchasePrice && purchasePrice > 0 ? purchasePrice : null;
  const originalPrice = vehicleSalePrice > 0 ? vehicleSalePrice : negotiatedPrice;

  // Desconto concedido em relação ao preço de tabela
  const discountAmount = Math.max(0, originalPrice - negotiatedPrice);
  const discountPercent = originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0;

  // Lucro bruto e margem calculados
  let grossProfit: number | null = null;
  let marginPercent: number | null = null;

  if (cost !== null) {
    grossProfit = negotiatedPrice - cost;
    marginPercent = negotiatedPrice > 0 ? (grossProfit / negotiatedPrice) * 100 : 0;
  }

  // Avaliação de risco
  const isBelowCost = cost !== null && negotiatedPrice < cost;
  const isBelowMinMargin =
    marginPercent !== null && marginPercent < policy.minMarginPercent;
  const isDiscountExceeded =
    discountPercent > policy.maxDiscountPercent ||
    discountAmount > policy.maxDiscountAmount;

  let health: 'healthy' | 'warning' | 'critical' = 'healthy';
  let message = 'Preço e rentabilidade dentro dos parâmetros comerciais aprovados.';

  if (isBelowCost) {
    health = 'critical';
    message = `Venda abaixo do custo do veículo! Prejuízo imediato de R$ ${Math.abs(grossProfit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
  } else if (isBelowMinMargin) {
    health = 'warning';
    message = `Margem de lucro (${marginPercent?.toFixed(1)}%) abaixo do piso mínimo de segurança (${policy.minMarginPercent}%).`;
  } else if (isDiscountExceeded) {
    health = 'warning';
    message = `Desconto concedido (R$ ${discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / ${discountPercent.toFixed(1)}%) ultrapassa a alçada comercial permitida sem gerência.`;
  }

  return {
    cost,
    originalPrice,
    negotiatedPrice,
    discountAmount,
    discountPercent,
    grossProfit,
    marginPercent,
    isBelowCost,
    isBelowMinMargin,
    isDiscountExceeded,
    health,
    message,
    canSellerProceed: (!policy.blockBelowCost || !isBelowCost) && (!policy.requireManagerApproval || !isDiscountExceeded),
  };
}
