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
  invoice_type: 'servico' | 'produto';
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
  status: 'emitida' | 'cancelada';
  notes: string | null;
  created_at: string;
  store?: { id: string; name: string; cnpj?: string | null; address?: string | null; city?: string | null; state?: string | null } | null;
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('invoices')
        .select('*, store:stores(id, name, cnpj, address, city, state)')
        .order('issue_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
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