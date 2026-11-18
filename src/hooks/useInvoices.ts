import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  fetchCloudInvoices,
  cloudSaveInvoice,
  cloudCancelInvoice,
  cloudDeleteInvoice,
  RegisteredInvoice,
  LOCAL_INVOICES_KEY,
} from '@/lib/cloudSalesSync';
import { normalizeDateToYMD, getLocalTodayDateString } from '@/lib/fiscalDates';
import { STORE_DIVINOPOLIS_UUID } from '@/hooks/useStores';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_value: number;
  chassis?: string;
  contract_number?: string;
  sale_id?: string;
  attachment_name?: string;
  attachment_url?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  series?: string;
  access_key?: string;
  invoice_type: 'servico' | 'produto' | 'entrada' | 'cancelamento';
  issue_date: string;
  store_id: string | null;
  sale_id?: string | null;
  contract_number?: string | null;
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
  attachment_name?: string | null;
  attachment_url?: string | null;
  attachment_size?: number | null;
  attachment_type?: string | null;
  created_at: string;
  cancellation_date?: string | null;
  cancellation_reason?: string | null;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao' | null;
  sefaz_protocol?: string | null;
  cancelled_by?: string | null;
  store?: { id: string; name: string; cnpj?: string | null; address?: string | null; city?: string | null; state?: string | null } | null;
}

/**
 * Lê do cache local as notas fiscais para retorno imediato (0ms de latência / sem loading skeleton).
 */
export function getLocalCachedInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(LOCAL_INVOICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: RegisteredInvoice): Invoice => {
          const isMoc = (r.store_id || '').includes('montes') || (r.store_name || '').toLowerCase().includes('montes');
          return {
            id: r.id,
            invoice_number: r.invoice_number,
            series: r.series || '1',
            access_key: r.access_key || undefined,
            invoice_type: 'produto',
            issue_date: r.issue_date,
            store_id: r.store_id,
            sale_id: r.sale_id || null,
            contract_number: r.contract_number || null,
            customer_name: r.customer_name,
            customer_document: r.customer_document,
            customer_address: r.customer_address || null,
            customer_email: r.customer_email || null,
            customer_phone: r.customer_phone || null,
            items: [
              {
                description: `${r.vehicle_brand || 'SHINERAY'} ${r.vehicle_model} (Chassi: ${r.vehicle_chassis})`,
                quantity: 1,
                unit_value: r.total_value,
                chassis: r.vehicle_chassis,
                contract_number: r.contract_number,
                sale_id: r.sale_id,
                attachment_name: r.attachment_name,
                attachment_url: r.attachment_url,
              },
            ],
            subtotal: r.total_value,
            tax_rate: r.tax_rate || 0,
            tax_value: r.tax_value || 0,
            total: r.total_value,
            status: r.status,
            notes: r.notes || `[moto] ${r.vehicle_model} - Chassi: ${r.vehicle_chassis}${r.alienacao ? ` | Alienação: ${r.alienacao}` : ''}`,
            attachment_name: r.attachment_name || null,
            attachment_url: r.attachment_url || null,
            attachment_size: r.attachment_size || null,
            attachment_type: r.attachment_type || null,
            created_at: r.created_at,
            cancellation_date: r.cancellation_date || null,
            cancellation_reason: r.cancellation_reason || null,
            cancellation_type: r.cancellation_type || null,
            sefaz_protocol: r.sefaz_protocol || null,
            store: {
              id: r.store_id,
              name: r.store_name || (isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis'),
              city: isMoc ? 'Montes Claros' : 'Divinópolis',
              state: 'MG',
            },
          };
        });
      }
    }
  } catch {}
  return [];
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    initialData: getLocalCachedInvoices,
    staleTime: 1000 * 30, // 30 segundos
    queryFn: async (): Promise<Invoice[]> => {
      // 1. Busca notas fiscais cadastradas de forma semi-manual na nuvem
      const cloudList = await fetchCloudInvoices();

      // 2. Tenta complementar com tabela invoices do Supabase se houver registros reais
      let dbList: any[] = [];
      try {
        const { data, error } = await (supabase as any)
          .from('invoices')
          .select('*')
          .order('issue_date', { ascending: false });

        if (!error && Array.isArray(data)) {
          dbList = data.filter((inv: any) => {
            const invNum = String(inv.invoice_number || '').trim();
            const id = String(inv.id || '');
            if (id.startsWith('fisc-seed-')) return false;
            if (['10420', '10421', '10422', '10425', '10426', '10430', '10431'].includes(invNum)) return false;
            const cust = String(inv.customer_name || '').toLowerCase();
            if (
              cust.includes('marcos aurelio') ||
              cust.includes('claudio roberto') ||
              cust.includes('patricia santos') ||
              cust.includes('fernando guimaraes')
            ) {
              return false;
            }
            return true;
          });
        }
      } catch {}

      // Mapeia cloudList para Invoice
      const mappedCloud: Invoice[] = cloudList.map((r: RegisteredInvoice): Invoice => {
        const isMoc = (r.store_id || '').includes('montes') || (r.store_name || '').toLowerCase().includes('montes');
        return {
          id: r.id,
          invoice_number: r.invoice_number,
          series: r.series || '1',
          access_key: r.access_key || undefined,
          invoice_type: 'produto',
          issue_date: r.issue_date,
          store_id: r.store_id,
          sale_id: r.sale_id || null,
          contract_number: r.contract_number || null,
          customer_name: r.customer_name,
          customer_document: r.customer_document,
          customer_address: r.customer_address || null,
          customer_email: r.customer_email || null,
          customer_phone: r.customer_phone || null,
          items: [
            {
              description: `${r.vehicle_brand || 'SHINERAY'} ${r.vehicle_model} (Chassi: ${r.vehicle_chassis})`,
              quantity: 1,
              unit_value: r.total_value,
              chassis: r.vehicle_chassis,
              contract_number: r.contract_number,
              sale_id: r.sale_id,
              attachment_name: r.attachment_name,
              attachment_url: r.attachment_url,
            },
          ],
          subtotal: r.total_value,
          tax_rate: r.tax_rate || 0,
          tax_value: r.tax_value || 0,
          total: r.total_value,
          status: r.status,
          notes: r.notes || `[moto] ${r.vehicle_model} - Chassi: ${r.vehicle_chassis}${r.alienacao ? ` | Alienação: ${r.alienacao}` : ''}`,
          attachment_name: r.attachment_name || null,
          attachment_url: r.attachment_url || null,
          attachment_size: r.attachment_size || null,
          attachment_type: r.attachment_type || null,
          created_at: r.created_at,
          cancellation_date: r.cancellation_date || null,
          cancellation_reason: r.cancellation_reason || null,
          cancellation_type: r.cancellation_type || null,
          sefaz_protocol: r.sefaz_protocol || null,
          store: {
            id: r.store_id,
            name: r.store_name || (isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis'),
            city: isMoc ? 'Montes Claros' : 'Divinópolis',
            state: 'MG',
          },
        };
      });

      const seenIds = new Set(mappedCloud.map((x) => x.id));
      const seenNumbers = new Set(mappedCloud.map((x) => `${x.store_id || ''}-${x.invoice_number}`));

      const mappedDb: Invoice[] = dbList
        .filter((inv: any) => !seenIds.has(inv.id) && !seenNumbers.has(`${inv.store_id || ''}-${inv.invoice_number}`))
        .map((inv: any): Invoice => {
          const itemObj = Array.isArray(inv.items) ? (inv.items[0] || {}) : (inv.items || {});
          return {
            ...inv,
            cancellation_date: itemObj.cancellation_date || inv.cancellation_date || (inv.status === 'cancelada' ? inv.updated_at?.slice(0, 10) : null),
            cancellation_reason: itemObj.cancellation_reason || inv.cancellation_reason || inv.notes || null,
            cancellation_type: itemObj.cancellation_type || inv.cancellation_type || 'estorno',
            sefaz_protocol: itemObj.sefaz_protocol || inv.sefaz_protocol || null,
            cancelled_by: itemObj.cancelled_by || inv.cancelled_by || null,
            attachment_name: itemObj.attachment_name || null,
            attachment_url: itemObj.attachment_url || null,
          };
        });

      return [...mappedCloud, ...mappedDb];
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
      await cloudCancelInvoice(id, {
        date: cancellation_date,
        reason: cancellation_reason,
        type: cancellation_type,
        protocol: sefaz_protocol,
      });
      return { success: true };
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
    onMutate: async (input: any) => {
      await qc.cancelQueries({ queryKey: ['invoices'] });
      await qc.cancelQueries({ queryKey: ['store-fiscal-invoices'] });

      const prevInvoices = qc.getQueryData<Invoice[]>(['invoices']) || [];
      const cleanIssueDate = normalizeDateToYMD(input.issue_date);
      const isMoc = (input.store_id || '').includes('montes') || (input.store_name || '').toLowerCase().includes('montes');

      const isUuid = (val: any) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (!input.id || !isUuid(input.id)) {
        input.id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
      }

      const optimisticInvoice: Invoice = {
        id: input.id,
        invoice_number: String(input.invoice_number || '').trim(),
        series: input.series || '1',
        access_key: input.access_key,
        invoice_type: 'produto',
        issue_date: cleanIssueDate,
        store_id: input.store_id || STORE_DIVINOPOLIS_UUID,
        sale_id: input.sale_id || null,
        contract_number: input.contract_number || null,
        customer_name: input.customer_name || 'Consumidor Final',
        customer_document: input.customer_document || null,
        customer_phone: input.customer_phone || null,
        customer_email: input.customer_email || null,
        customer_address: input.customer_address || null,
        items: input.items || [
          {
            description: `${input.vehicle_brand || 'SHINERAY'} ${input.vehicle_model || 'Motocicleta'} (Chassi: ${input.vehicle_chassis || 'Não informado'})`,
            quantity: 1,
            unit_value: Number(input.total || input.total_value || 0),
            chassis: input.vehicle_chassis,
            contract_number: input.contract_number,
            sale_id: input.sale_id,
            attachment_name: input.attachment_name,
            attachment_url: input.attachment_url,
          },
        ],
        subtotal: Number(input.total || input.total_value || 0),
        tax_rate: Number(input.tax_rate || 0),
        tax_value: Number(input.tax_value || 0),
        total: Number(input.total || input.total_value || 0),
        status: input.status || 'emitida',
        notes: input.notes,
        attachment_name: input.attachment_name || null,
        attachment_url: input.attachment_url || null,
        attachment_size: input.attachment_size || null,
        attachment_type: input.attachment_type || null,
        created_at: input.created_at || new Date().toISOString(),
        store: {
          id: input.store_id || STORE_DIVINOPOLIS_UUID,
          name: input.store_name || (isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis'),
          city: isMoc ? 'Montes Claros' : 'Divinópolis',
          state: 'MG',
        },
      };

      qc.setQueryData<Invoice[]>(['invoices'], (old = []) => {
        const idx = old.findIndex(
          (x) => x.id === optimisticInvoice.id || (x.invoice_number === optimisticInvoice.invoice_number && x.store_id === optimisticInvoice.store_id)
        );
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], ...optimisticInvoice };
          return updated;
        }
        return [optimisticInvoice, ...old];
      });

      return { prevInvoices };
    },
    mutationFn: async (input: any) => {
      const isUuid = (val: any) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      const id = isUuid(input.id)
        ? input.id
        : typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

      const cleanIssueDate = normalizeDateToYMD(input.issue_date);

      const regInvoice: RegisteredInvoice = {
        id,
        invoice_number: String(input.invoice_number || '').trim(),
        series: input.series || '1',
        access_key: input.access_key || undefined,
        issue_date: cleanIssueDate,
        store_id: input.store_id || STORE_DIVINOPOLIS_UUID,
        store_name: input.store_name,
        sale_id: input.sale_id || undefined,
        contract_number: input.contract_number || undefined,
        customer_name: input.customer_name || 'Consumidor Final',
        customer_document: input.customer_document || '',
        customer_phone: input.customer_phone || undefined,
        customer_email: input.customer_email || undefined,
        customer_address: input.customer_address || undefined,
        vehicle_model: input.vehicle_model || (input.items?.[0]?.description || 'Motocicleta Shineray'),
        vehicle_chassis: input.vehicle_chassis || input.chassi || '',
        vehicle_brand: input.vehicle_brand || 'SHINERAY',
        vehicle_color: input.vehicle_color,
        vehicle_year: input.vehicle_year,
        alienacao: input.alienacao || 'À VISTA',
        operation_nature: input.operation_nature || 'Venda de Moto Zero KM',
        total_value: Number(input.total || input.total_value || 0),
        tax_rate: Number(input.tax_rate || 0),
        tax_value: Number(input.tax_value || 0),
        status: input.status || 'emitida',
        notes: input.notes,
        attachment_name: input.attachment_name,
        attachment_url: input.attachment_url,
        attachment_size: input.attachment_size,
        attachment_type: input.attachment_type,
        created_at: input.created_at || new Date().toISOString(),
      };

      const ok = await cloudSaveInvoice(regInvoice);
      if (!ok) throw new Error('Falha ao persistir Nota Fiscal em nuvem');
      return regInvoice;
    },
    onSuccess: (data) => {
      // Invalida em segundo plano sem apagar ou travar a UI instantânea
      qc.invalidateQueries({ queryKey: ['invoices'], refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ['store-fiscal-invoices'], refetchType: 'none' });
      qc.invalidateQueries({ queryKey: ['contracts'], refetchType: 'none' });
      toast({
        title: 'Nota Fiscal salva com sucesso!',
        description: `NF Nº ${data.invoice_number} vinculada e salva em tempo real.`,
      });
    },
    onError: (e: any, _vars, context: any) => {
      if (context?.prevInvoices) {
        qc.setQueryData(['invoices'], context.prevInvoices);
      }
      toast({ variant: 'destructive', title: 'Erro ao cadastrar NF', description: e?.message });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      await cloudDeleteInvoice(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });
      toast({ title: 'Nota fiscal removida com sucesso' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro ao remover NF', description: e?.message }),
  });
}