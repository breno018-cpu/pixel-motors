import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AdditionType } from '@/hooks/useEmployees';

export interface PayslipAddition {
  id: string;
  name: string;
  type: AdditionType;
  amount: number;
  is_discount?: boolean;
}

export interface Payslip {
  id: string;
  payslip_number: string;
  employee_id: string;
  store_id: string | null;
  reference_month: number;
  reference_year: number;
  base_salary: number;
  commission_amount: number;
  commission_sales_total: number;
  bonus: number;
  overtime: number;
  transport_allowance: number;
  meal_allowance: number;
  other_allowance: number;
  manager_commission: number;
  additions: PayslipAddition[];
  inss_discount: number;
  irrf_discount: number;
  other_discounts: number;
  net_total: number;
  payment_date: string | null;
  payment_method: string | null;
  status: 'pendente' | 'pago' | 'cancelado';
  notes: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    cpf: string | null;
    role: string;
    position: string | null;
    profile_id: string | null;
  };
  store?: { id: string; name: string; cnpj?: string | null } | null;
}

export function usePayslips(month?: number, year?: number) {
  return useQuery({
    queryKey: month && year ? ['payslips', month, year] : ['payslips'],
    queryFn: async () => {
      let query = (supabase as any)
        .from('payslips')
        .select(
          '*, employee:employees(id, full_name, cpf, role, position, profile_id), store:stores(id, name, cnpj)',
        );
      if (month !== undefined) {
        query = query.eq('reference_month', month);
      }
      if (year !== undefined) {
        query = query.eq('reference_year', year);
      }
      const { data, error } = await query
        .order('reference_year', { ascending: false })
        .order('reference_month', { ascending: false });
      if (error) throw error;
      return (data || []) as Payslip[];
    },
  });
}

/**
 * Calcula a comissão do vendedor a partir das vendas (contracts) do mês.
 *
 * Se `tiers` for fornecido (faixas por quantidade de vendas), o valor por venda
 * é definido pela faixa em que a quantidade de vendas se encaixa. Caso contrário,
 * usa a taxa percentual sobre o valor total vendido.
 */
export async function calculateCommissionForMonth(
  profileId: string,
  rate: number,
  month: number,
  year: number,
  tiers?: Array<{ min_qty: number; max_qty: number | null; value_per_sale: number }>,
) {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  const { data, error } = await supabase
    .from('contracts')
    .select('sale_price, status, created_at')
    .eq('created_by', profileId)
    .gte('created_at', start)
    .lt('created_at', end)
    .in('status', ['concluido', 'assinado', 'quitado', 'pendente']);
  if (error) throw error;
  const rows = data || [];
  const total = rows.reduce((s, r: any) => s + Number(r.sale_price || 0), 0);
  const count = rows.length;

  if (tiers && tiers.length > 0) {
    // Pick the highest tier whose min_qty <= count and (max_qty == null or count <= max_qty)
    const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    const matching = sorted
      .filter((t) => count >= t.min_qty && (t.max_qty == null || count <= t.max_qty))
      .pop();
    const valuePerSale = matching ? Number(matching.value_per_sale) : 0;
    return {
      salesTotal: total,
      salesCount: count,
      commission: valuePerSale * count,
      tier: matching || null,
    };
  }

  const commission = total * (Number(rate) / 100);
  return { salesTotal: total, salesCount: count, commission, tier: null };
}

export function useUpsertPayslip() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<Payslip> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };
      if (!input.id) {
        payload.created_by = u.user?.id;
        if (!payload.payslip_number) {
          payload.payslip_number = `CC-${Date.now().toString(36).toUpperCase()}`;
        }
      }
      // Calcular total líquido apenas se for um payload completo sem net_total explícito
      const hasFinancialFields =
        payload.base_salary !== undefined ||
        payload.commission_amount !== undefined ||
        payload.bonus !== undefined ||
        payload.overtime !== undefined;
      if (payload.net_total === undefined && hasFinancialFields) {
        const proventos =
          Number(payload.base_salary || 0) +
          Number(payload.commission_amount || 0) +
          Number(payload.bonus || 0) +
          Number(payload.overtime || 0) +
          Number(payload.transport_allowance || 0) +
          Number(payload.meal_allowance || 0) +
          Number(payload.other_allowance || 0) +
          Number(payload.manager_commission || 0) +
          (Array.isArray(payload.additions)
            ? payload.additions
                .filter((a: PayslipAddition) => !a.is_discount)
                .reduce((s: number, a: PayslipAddition) => s + Number(a.amount || 0), 0)
            : 0);
        const descontos =
          Number(payload.inss_discount || 0) +
          Number(payload.irrf_discount || 0) +
          Number(payload.other_discounts || 0) +
          (Array.isArray(payload.additions)
            ? payload.additions
                .filter((a: PayslipAddition) => a.is_discount)
                .reduce((s: number, a: PayslipAddition) => s + Number(a.amount || 0), 0)
            : 0);
        payload.net_total = proventos - descontos;
      }

      const { data, error } = payload.id && !hasFinancialFields
        ? await (supabase as any)
            .from('payslips')
            .update(payload)
            .eq('id', payload.id)
            .select()
            .single()
        : await (supabase as any)
            .from('payslips')
            .upsert(payload)
            .select()
            .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast({ title: 'Contracheque salvo' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

export function useDeletePayslip() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('payslips').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast({ title: 'Contracheque removido' });
    },
  });
}