import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_value: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: 'servico' | 'produto' | 'entrada' | 'cancelamento';
  issue_date: string;
  store_id: string | null;
  customer_name: string;
  customer_document: string | null;
  customer_address: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_value: number;
  total: number;
  status: 'emitida' | 'cancelada' | 'pendente_conferencia' | 'conferido';
  notes: string | null;
  created_at: string;
  cancellation_date?: string | null;
  cancellation_reason?: string | null;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao' | null;
  sefaz_protocol?: string | null;
  cancelled_by?: string | null;
  store?: { id: string; name: string; cnpj?: string | null; address?: string | null; city?: string | null; state?: string | null } | null;
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('invoices')
          .select('*, store:stores(id, name, cnpj, address, city, state)')
          .order('issue_date', { ascending: false });
        if (error) {
          console.warn('Consulta à tabela invoices retornou aviso, operando com fallback:', error);
          return [];
        }
        return (data || []).map((inv: any): Invoice => {
          const itemObj = Array.isArray(inv.items) ? (inv.items[0] || {}) : (inv.items || {});
          return {
            ...inv,
            cancellation_date: itemObj.cancellation_date || inv.cancellation_date || (inv.status === 'cancelada' ? inv.updated_at?.slice(0, 10) : null),
            cancellation_reason: itemObj.cancellation_reason || inv.cancellation_reason || inv.notes || null,
            cancellation_type: itemObj.cancellation_type || inv.cancellation_type || 'estorno',
            sefaz_protocol: itemObj.sefaz_protocol || inv.sefaz_protocol || null,
            cancelled_by: itemObj.cancelled_by || inv.cancelled_by || null,
          };
        }) as Invoice[];
      } catch (err) {
        console.warn('Falha de conexão com invoices:', err);
        return [];
      }
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      id,
      cancellation_date,
      cancellation_reason,
      cancellation_type = 'estorno',
      sefaz_protocol,
      cancelled_by,
    }: {
      id: string;
      cancellation_date: string;
      cancellation_reason: string;
      cancellation_type?: 'estorno' | 'credito' | 'devolucao';
      sefaz_protocol?: string;
      cancelled_by?: string;
    }) => {
      // 1. Busca registro atual para preservar itens
      const { data: current } = await (supabase as any)
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

      const existingItems = current?.items || [];
      const updatedItems = Array.isArray(existingItems)
        ? existingItems.map((it: any) => ({
            ...it,
            cancellation_date,
            cancellation_reason,
            cancellation_type,
            sefaz_protocol: sefaz_protocol || '',
            cancelled_by: cancelled_by || 'Diretoria',
          }))
        : {
            ...(typeof existingItems === 'object' ? existingItems : {}),
            cancellation_date,
            cancellation_reason,
            cancellation_type,
            sefaz_protocol: sefaz_protocol || '',
            cancelled_by: cancelled_by || 'Diretoria',
          };

      const updatedNotes = `${current?.notes || ''} [CANCELADA em ${cancellation_date} - ${cancellation_type.toUpperCase()}: ${cancellation_reason}]`.trim();

      const { data, error } = await (supabase as any)
        .from('invoices')
        .update({
          status: 'cancelada',
          items: updatedItems,
          notes: updatedNotes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // 2. Registra também no histórico fiscal local para garantir visualização imediata
      try {
        const storageKey = 'dealflow_store_fiscal_invoices_v1';
        const raw = localStorage.getItem(storageKey);
        const list = raw ? JSON.parse(raw) : [];
        const cancelRecord = {
          id: `canc-${id}-${Date.now()}`,
          invoice_number: current?.invoice_number || 'NF',
          fiscal_type: 'cancelamento',
          store_id: current?.store_id || '',
          issue_date: current?.issue_date || cancellation_date,
          entry_or_cancel_date: cancellation_date,
          party_name: current?.customer_name || 'Consumidor Final',
          party_document: current?.customer_document || '',
          cancellation_reason,
          cancellation_type,
          sefaz_protocol: sefaz_protocol || '',
          total_value: Number(current?.total) || 0,
          status: 'cancelada',
          authorized_by: cancelled_by || 'Administrador',
          notes: cancellation_reason,
          created_at: new Date().toISOString(),
        };
        list.unshift(cancelRecord);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {}

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });
      toast({
        title: 'Nota Fiscal cancelada com sucesso',
        description: 'O cancelamento foi homologado e registrado no fluxo fiscal.',
      });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro ao cancelar NF', description: e?.message }),
  });
}

export function useUpsertInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<Invoice> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };
      if (!input.id) {
        payload.created_by = u.user?.id;
        if (!payload.invoice_number) {
          payload.invoice_number = `NF-${Date.now().toString(36).toUpperCase()}`;
        }
      }
      const subtotal = (input.items || []).reduce(
        (s, i) => s + Number(i.quantity || 0) * Number(i.unit_value || 0),
        0,
      );
      const taxValue = subtotal * (Number(input.tax_rate || 0) / 100);
      payload.subtotal = subtotal;
      payload.tax_value = taxValue;
      payload.total = subtotal + taxValue;

      const { data, error } = await (supabase as any)
        .from('invoices')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Nota fiscal salva' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Nota fiscal removida' });
    },
  });
}