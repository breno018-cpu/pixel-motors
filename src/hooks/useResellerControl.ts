import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

export interface ResellerRecord {
  id: string;
  full_name: string;
  store_id: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  commission_rate: number | null;
  is_active: boolean;
  partner_type: string;
  created_at: string;
}

export interface ResellerStockItem {
  id: string;
  reseller_id: string;
  vehicle_id: string | null;
  store_id: string | null;
  vehicle_model: string;
  chassis: string | null;
  year: number | null;
  color: string | null;
  total_value: number;
  paid_amount: number;
  payment_status: 'pendente' | 'parcial' | 'pago';
  stock_status: 'em_estoque' | 'vendido' | 'devolvido';
  entry_date: string;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface ResellerFinancing {
  id: string;
  reseller_id: string;
  store_id: string | null;
  stock_item_id: string | null;
  client_name: string;
  vehicle_model: string;
  chassis: string | null;
  bank_name: string;
  financed_amount: number;
  down_payment: number;
  installments: number | null;
  status: 'em_analise' | 'aprovado' | 'liberado' | 'quitado' | 'recusado';
  financing_date: string;
  release_date: string | null;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface ResellerPayment {
  id: string;
  reseller_id: string;
  store_id: string | null;
  stock_item_id: string | null;
  financing_id: string | null;
  payment_type: 'pagamento_estoque' | 'repasse_financiamento' | 'comissao' | 'adiantamento' | 'outro';
  payment_method: 'pix' | 'transferencia' | 'dinheiro' | 'boleto' | 'cartao' | 'outro';
  amount: number;
  payment_date: string;
  reference_code: string | null;
  description: string | null;
  is_deleted: boolean;
  created_at: string;
}

function computePaymentStatus(totalValue: number, paidAmount: number): 'pendente' | 'parcial' | 'pago' {
  if (paidAmount <= 0) return 'pendente';
  if (totalValue > 0 && paidAmount >= totalValue - 0.01) return 'pago';
  return 'parcial';
}

export function useResellerControl() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reseller-control-resellers'] });
    queryClient.invalidateQueries({ queryKey: ['reseller-control-stock'] });
    queryClient.invalidateQueries({ queryKey: ['reseller-control-financings'] });
    queryClient.invalidateQueries({ queryKey: ['reseller-control-payments'] });
    queryClient.invalidateQueries({ queryKey: ['resellers'] });
  };

  const resellersQuery = useQuery<ResellerRecord[]>({
    queryKey: ['reseller-control-resellers'],
    queryFn: async () => {
      await ensureSupabaseSession();
      // Revendedores = apenas parceiros/lojas EXTERNAS (nunca vendedores internos com user_id ou partner_type = 'interno')
      const { data, error } = await (supabase as any)
        .from('resellers')
        .select('id, full_name, store_id, cpf, phone, email, commission_rate, is_active, partner_type, created_at')
        .neq('partner_type', 'interno')
        .is('user_id', null)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as ResellerRecord[];
    },
  });

  const stockQuery = useQuery<ResellerStockItem[]>({
    queryKey: ['reseller-control-stock'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await (supabase as any)
        .from('reseller_stock_items')
        .select('*')
        .eq('is_deleted', false)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        total_value: Number(r.total_value) || 0,
        paid_amount: Number(r.paid_amount) || 0,
      }));
    },
  });

  const financingsQuery = useQuery<ResellerFinancing[]>({
    queryKey: ['reseller-control-financings'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await (supabase as any)
        .from('reseller_financings')
        .select('*')
        .eq('is_deleted', false)
        .order('financing_date', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        financed_amount: Number(r.financed_amount) || 0,
        down_payment: Number(r.down_payment) || 0,
      }));
    },
  });

  const paymentsQuery = useQuery<ResellerPayment[]>({
    queryKey: ['reseller-control-payments'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await (supabase as any)
        .from('reseller_payments')
        .select('*')
        .eq('is_deleted', false)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        amount: Number(r.amount) || 0,
      }));
    },
  });

  const createReseller = useMutation({
    mutationFn: async (input: {
      full_name: string;
      phone?: string;
      cpf?: string;
      email?: string;
      store_id?: string | null;
      commission_rate?: number | null;
    }) => {
      await ensureSupabaseSession();
      const { data, error } = await (supabase as any)
        .from('resellers')
        .insert({
          full_name: input.full_name.trim(),
          phone: input.phone?.trim() || null,
          cpf: input.cpf?.trim() || null,
          email: input.email?.trim() || null,
          store_id: input.store_id || null,
          commission_rate: input.commission_rate ?? null,
          is_active: true,
          user_id: null,
          partner_type: 'parceiro_externo',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const createStockItem = useMutation({
    mutationFn: async (input: {
      reseller_id: string;
      vehicle_id?: string | null;
      store_id?: string | null;
      vehicle_model: string;
      chassis?: string;
      year?: number | null;
      color?: string;
      total_value: number;
      paid_amount: number;
      stock_status?: 'em_estoque' | 'vendido' | 'devolvido';
      entry_date?: string;
      notes?: string;
    }) => {
      await ensureSupabaseSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const payment_status = computePaymentStatus(input.total_value, input.paid_amount);
      const { data, error } = await (supabase as any)
        .from('reseller_stock_items')
        .insert({
          reseller_id: input.reseller_id,
          vehicle_id: input.vehicle_id || null,
          store_id: input.store_id || null,
          vehicle_model: input.vehicle_model.trim().toUpperCase(),
          chassis: input.chassis?.trim().toUpperCase() || null,
          year: input.year || null,
          color: input.color?.trim() || null,
          total_value: input.total_value,
          paid_amount: input.paid_amount,
          payment_status,
          stock_status: input.stock_status || 'em_estoque',
          entry_date: input.entry_date || new Date().toISOString().slice(0, 10),
          notes: input.notes?.trim() || null,
          created_by: sessionData?.session?.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const updateStockItem = useMutation({
    mutationFn: async (input: {
      id: string;
      total_value?: number;
      paid_amount?: number;
      stock_status?: 'em_estoque' | 'vendido' | 'devolvido';
      notes?: string | null;
    }) => {
      await ensureSupabaseSession();
      const current = (stockQuery.data || []).find((s) => s.id === input.id);
      const nextTotal = input.total_value ?? current?.total_value ?? 0;
      const nextPaid = input.paid_amount ?? current?.paid_amount ?? 0;
      const payment_status = computePaymentStatus(nextTotal, nextPaid);

      const { error } = await (supabase as any)
        .from('reseller_stock_items')
        .update({
          ...(input.total_value !== undefined ? { total_value: input.total_value } : {}),
          ...(input.paid_amount !== undefined ? { paid_amount: input.paid_amount } : {}),
          payment_status,
          ...(input.stock_status ? { stock_status: input.stock_status } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteStockItem = useMutation({
    mutationFn: async (id: string) => {
      await ensureSupabaseSession();
      const { error } = await (supabase as any)
        .from('reseller_stock_items')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const createFinancing = useMutation({
    mutationFn: async (input: {
      reseller_id: string;
      store_id?: string | null;
      stock_item_id?: string | null;
      client_name: string;
      vehicle_model: string;
      chassis?: string;
      bank_name: string;
      financed_amount: number;
      down_payment?: number;
      installments?: number | null;
      status?: 'em_analise' | 'aprovado' | 'liberado' | 'quitado' | 'recusado';
      financing_date?: string;
      release_date?: string | null;
      notes?: string;
    }) => {
      await ensureSupabaseSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await (supabase as any)
        .from('reseller_financings')
        .insert({
          reseller_id: input.reseller_id,
          store_id: input.store_id || null,
          stock_item_id: input.stock_item_id || null,
          client_name: input.client_name.trim().toUpperCase(),
          vehicle_model: input.vehicle_model.trim().toUpperCase(),
          chassis: input.chassis?.trim().toUpperCase() || null,
          bank_name: input.bank_name.trim().toUpperCase(),
          financed_amount: input.financed_amount,
          down_payment: input.down_payment || 0,
          installments: input.installments || 48,
          status: input.status || 'em_analise',
          financing_date: input.financing_date || new Date().toISOString().slice(0, 10),
          release_date: input.release_date || null,
          notes: input.notes?.trim() || null,
          created_by: sessionData?.session?.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateAll,
  });

  const updateFinancingStatus = useMutation({
    mutationFn: async (input: {
      id: string;
      status: 'em_analise' | 'aprovado' | 'liberado' | 'quitado' | 'recusado';
    }) => {
      await ensureSupabaseSession();
      const { error } = await (supabase as any)
        .from('reseller_financings')
        .update({
          status: input.status,
          ...(input.status === 'liberado' || input.status === 'quitado'
            ? { release_date: new Date().toISOString().slice(0, 10) }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const deleteFinancing = useMutation({
    mutationFn: async (id: string) => {
      await ensureSupabaseSession();
      const { error } = await (supabase as any)
        .from('reseller_financings')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const createPayment = useMutation({
    mutationFn: async (input: {
      reseller_id: string;
      store_id?: string | null;
      stock_item_id?: string | null;
      financing_id?: string | null;
      payment_type: 'pagamento_estoque' | 'repasse_financiamento' | 'comissao' | 'adiantamento' | 'outro';
      payment_method: 'pix' | 'transferencia' | 'dinheiro' | 'boleto' | 'cartao' | 'outro';
      amount: number;
      payment_date?: string;
      reference_code?: string;
      description?: string;
    }) => {
      await ensureSupabaseSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await (supabase as any)
        .from('reseller_payments')
        .insert({
          reseller_id: input.reseller_id,
          store_id: input.store_id || null,
          stock_item_id: input.stock_item_id || null,
          financing_id: input.financing_id || null,
          payment_type: input.payment_type,
          payment_method: input.payment_method,
          amount: input.amount,
          payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
          reference_code: input.reference_code?.trim() || null,
          description: input.description?.trim() || null,
          created_by: sessionData?.session?.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Se o pagamento foi vinculado a uma moto do estoque do revendedor, atualiza automaticamente o valor pago!
      if (input.stock_item_id) {
        const linked = (stockQuery.data || []).find((s) => s.id === input.stock_item_id);
        if (linked) {
          const nextPaid = Math.min(linked.total_value > 0 ? linked.total_value : Infinity, (linked.paid_amount || 0) + input.amount);
          const nextStatus = computePaymentStatus(linked.total_value, nextPaid);
          await (supabase as any)
            .from('reseller_stock_items')
            .update({
              paid_amount: nextPaid,
              payment_status: nextStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', linked.id);
        }
      }

      return data;
    },
    onSuccess: invalidateAll,
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      await ensureSupabaseSession();
      const { error } = await (supabase as any)
        .from('reseller_payments')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  return {
    resellers: resellersQuery.data || [],
    stockItems: stockQuery.data || [],
    financings: financingsQuery.data || [],
    payments: paymentsQuery.data || [],
    isLoading:
      resellersQuery.isLoading ||
      stockQuery.isLoading ||
      financingsQuery.isLoading ||
      paymentsQuery.isLoading,
    createReseller,
    createStockItem,
    updateStockItem,
    deleteStockItem,
    createFinancing,
    updateFinancingStatus,
    deleteFinancing,
    createPayment,
    deletePayment,
  };
}
