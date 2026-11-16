import { useState, useMemo } from 'react';
import { 
  ReceiptText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  XCircle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Plus, 
  Building2, 
  Calendar, 
  Download, 
  Eye, 
  Copy, 
  Check, 
  Filter, 
  Trash2, 
  AlertTriangle,
  FileSpreadsheet,
  Bike,
  ShieldAlert,
  HelpCircle,
  Truck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useStores } from '@/hooks/useStores';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maskCPFCNPJ } from '@/lib/masks';

export interface FiscalInvoiceRecord {
  id: string;
  invoice_number: string;
  fiscal_type: 'entrada' | 'cancelamento';
  store_id: string;
  issue_date: string;
  entry_or_cancel_date: string;
  party_name: string; // Fornecedor/Fábrica ou Cliente
  party_document?: string;
  access_key?: string; // Chave de 44 dígitos
  sefaz_protocol?: string;
  cancellation_reason?: string;
  chassis_list?: string[];
  total_value: number;
  status: 'conferido' | 'pendente_conferencia' | 'cancelada' | 'registrada';
  carrier?: string;
  authorized_by?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

const STORAGE_KEY = 'dealflow_store_fiscal_invoices_v1';

function getStoredFiscalInvoices(): FiscalInvoiceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: any) => {
      if (!item) return false;
      const id = String(item.id || '');
      const invNum = String(item.invoice_number || '').trim();
      if (id.startsWith('fisc-seed-')) return false;
      if (['10420', '10421', '10422', '10425', '10426', '10430', '10431'].includes(invNum)) return false;
      return true;
    });
  } catch {
    return [];
  }
}

function saveStoredFiscalInvoices(records: FiscalInvoiceRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function StoreFiscalControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, user, isAdmin, hasElevatedAccess } = useAuth();
  const { data: stores = [] } = useStores();

  // Estados de Filtros
  const [activeTab, setActiveTab] = useState<'todas' | 'entradas' | 'cancelamentos'>('todas');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados de Modais
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FiscalInvoiceRecord | null>(null);

  // Formulário de Entrada de NF
  const [entryForm, setEntryForm] = useState({
    invoice_number: '',
    series: '1',
    access_key: '',
    store_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    entry_date: new Date().toISOString().slice(0, 10),
    party_name: 'SHINERAY DO BRASIL S.A.',
    party_document: '04.912.449/0001-44',
    total_value: '',
    carrier: '',
    chassis_input: '',
    notes: '',
  });

  // Formulário de Cancelamento de NF
  const [cancelForm, setCancelForm] = useState({
    invoice_number: '',
    access_key: '',
    store_id: '',
    cancel_date: new Date().toISOString().slice(0, 10),
    party_name: '',
    party_document: '',
    sefaz_protocol: '',
    cancellation_reason: '',
    total_value: '',
    chassis_involved: '',
    return_to_stock: true,
    notes: '',
  });

  // Consulta Geral de Registros Fiscais (com integração ao Supabase e fallback local)
  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['store-fiscal-invoices'],
    queryFn: async () => {
      let remoteRecords: FiscalInvoiceRecord[] = [];
      try {
        const { data, error } = await (supabase as any)
          .from('invoices')
          .select('*, store:stores(id, name)')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          remoteRecords = data
            .filter((inv: any) => {
              const notes = inv.notes || '';
              const items = inv.items;
              return (
                inv.invoice_type === 'entrada' ||
                inv.invoice_type === 'cancelamento' ||
                inv.status === 'cancelada' ||
                notes.includes('[FISCAL_') ||
                (items && (items as any).fiscal_type)
              );
            })
            .map((inv: any): FiscalInvoiceRecord => {
              const itemsObj = Array.isArray(inv.items) ? (inv.items[0] || {}) : (inv.items || {});
              const isEntrada = inv.invoice_type === 'entrada' || itemsObj.fiscal_type === 'entrada';
              return {
                id: inv.id,
                invoice_number: inv.invoice_number,
                fiscal_type: isEntrada ? 'entrada' : 'cancelamento',
                store_id: inv.store_id || '',
                issue_date: inv.issue_date || inv.created_at?.slice(0, 10) || '',
                entry_or_cancel_date: itemsObj.entry_or_cancel_date || inv.issue_date || inv.created_at?.slice(0, 10) || '',
                party_name: inv.customer_name || (isEntrada ? 'Shineray do Brasil S.A.' : 'Consumidor'),
                party_document: inv.customer_document || '',
                access_key: itemsObj.access_key || '',
                sefaz_protocol: itemsObj.sefaz_protocol || '',
                cancellation_reason: itemsObj.cancellation_reason || inv.notes || '',
                chassis_list: itemsObj.chassis_list || [],
                total_value: Number(inv.total) || 0,
                status: inv.status === 'cancelada' ? 'cancelada' : (itemsObj.status || 'conferido'),
                carrier: itemsObj.carrier || '',
                authorized_by: itemsObj.authorized_by || '',
                notes: inv.notes || '',
                created_at: inv.created_at || new Date().toISOString(),
                created_by: inv.created_by || '',
              };
            });
        }
      } catch (err) {
        console.warn('Erro ao consultar invoices remotas, usando cache local:', err);
      }

      const localList = getStoredFiscalInvoices();
      const combined = [...remoteRecords];
      for (const loc of localList) {
        if (!combined.some(c => c.id === loc.id || c.invoice_number === loc.invoice_number)) {
          combined.push(loc);
        }
      }

      // Ordenar por data decrescente
      return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Salvar Entrada de NF
  const saveEntryMutation = useMutation({
    mutationFn: async () => {
      if (!entryForm.invoice_number.trim()) throw new Error('Informe o número da Nota Fiscal.');
      if (!entryForm.store_id) throw new Error('Selecione a loja física de destino da carga.');
      const valNum = parseFloat(entryForm.total_value.replace(/\./g, '').replace(',', '.')) || 0;
      if (valNum <= 0) throw new Error('Informe o valor total da Nota Fiscal.');

      const chassisArr = entryForm.chassis_input
        .split(/[\n,;]+/)
        .map(c => c.trim().toUpperCase())
        .filter(Boolean);

      const newId = `nf-ent-${Date.now()}`;
      const newRecord: FiscalInvoiceRecord = {
        id: newId,
        invoice_number: entryForm.invoice_number.trim(),
        fiscal_type: 'entrada',
        store_id: entryForm.store_id,
        issue_date: entryForm.issue_date,
        entry_or_cancel_date: entryForm.entry_date,
        party_name: entryForm.party_name.trim() || 'SHINERAY DO BRASIL S.A.',
        party_document: entryForm.party_document.trim(),
        access_key: entryForm.access_key.replace(/\s+/g, ''),
        chassis_list: chassisArr,
        total_value: valNum,
        status: 'pendente_conferencia',
        carrier: entryForm.carrier.trim(),
        authorized_by: profile?.full_name || 'Diretoria',
        notes: entryForm.notes.trim(),
        created_at: new Date().toISOString(),
        created_by: user?.id,
      };

      // Tentar salvar no Supabase
      try {
        await (supabase as any).from('invoices').insert({
          id: newId,
          invoice_number: newRecord.invoice_number,
          invoice_type: 'entrada',
          issue_date: newRecord.issue_date,
          store_id: newRecord.store_id,
          customer_name: newRecord.party_name,
          customer_document: newRecord.party_document,
          subtotal: newRecord.total_value,
          tax_rate: 0,
          tax_value: 0,
          total: newRecord.total_value,
          status: 'pendente_conferencia',
          notes: `[FISCAL_ENTRADA] Loja: ${newRecord.store_id} | Chassi(s): ${chassisArr.length} un. | ${newRecord.notes}`,
          items: {
            fiscal_type: 'entrada',
            access_key: newRecord.access_key,
            entry_or_cancel_date: newRecord.entry_or_cancel_date,
            chassis_list: newRecord.chassis_list,
            carrier: newRecord.carrier,
            authorized_by: newRecord.authorized_by,
            status: 'pendente_conferencia',
          },
          created_by: user?.id || null,
        });
      } catch (err) {
        console.warn('Erro ao persistir remoto, salvando localmente:', err);
      }

      // Persistir no cache local
      const current = getStoredFiscalInvoices();
      saveStoredFiscalInvoices([newRecord, ...current]);
      return newRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });
      setEntryModalOpen(false);
      setEntryForm({
        invoice_number: '',
        series: '1',
        access_key: '',
        store_id: '',
        issue_date: new Date().toISOString().slice(0, 10),
        entry_date: new Date().toISOString().slice(0, 10),
        party_name: 'SHINERAY DO BRASIL S.A.',
        party_document: '04.912.449/0001-44',
        total_value: '',
        carrier: '',
        chassis_input: '',
        notes: '',
      });
      toast({
        title: 'Entrada de NF registrada',
        description: 'A nota fiscal de remessa da fábrica foi cadastrada e aguarda conferência de pátio.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha no cadastro',
        description: err?.message || 'Verifique os dados preenchidos.',
      });
    },
  });

  // Salvar Cancelamento de NF
  const saveCancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelForm.invoice_number.trim()) throw new Error('Informe o número da Nota Fiscal cancelada.');
      if (!cancelForm.store_id) throw new Error('Selecione a loja emissora da NF.');
      if (!cancelForm.sefaz_protocol.trim()) throw new Error('Informe o Protocolo de Homologação de Cancelamento da SEFAZ.');
      if (!cancelForm.cancellation_reason.trim() || cancelForm.cancellation_reason.trim().length < 15) {
        throw new Error('A justificativa de cancelamento deve ter pelo menos 15 caracteres (exigência SEFAZ).');
      }

      const valNum = parseFloat(cancelForm.total_value.replace(/\./g, '').replace(',', '.')) || 0;

      const newId = `nf-canc-${Date.now()}`;
      const newRecord: FiscalInvoiceRecord = {
        id: newId,
        invoice_number: cancelForm.invoice_number.trim(),
        fiscal_type: 'cancelamento',
        store_id: cancelForm.store_id,
        issue_date: cancelForm.cancel_date,
        entry_or_cancel_date: cancelForm.cancel_date,
        party_name: cancelForm.party_name.trim() || 'Consumidor Final',
        party_document: cancelForm.party_document.trim(),
        access_key: cancelForm.access_key.replace(/\s+/g, ''),
        sefaz_protocol: cancelForm.sefaz_protocol.trim(),
        cancellation_reason: cancelForm.cancellation_reason.trim(),
        chassis_list: cancelForm.chassis_involved ? [cancelForm.chassis_involved.trim().toUpperCase()] : [],
        total_value: valNum,
        status: 'cancelada',
        authorized_by: profile?.full_name || 'Administrador',
        notes: cancelForm.notes.trim(),
        created_at: new Date().toISOString(),
        created_by: user?.id,
      };

      // Tentar salvar no Supabase
      try {
        await (supabase as any).from('invoices').insert({
          id: newId,
          invoice_number: newRecord.invoice_number,
          invoice_type: 'cancelamento',
          issue_date: newRecord.issue_date,
          store_id: newRecord.store_id,
          customer_name: newRecord.party_name,
          customer_document: newRecord.party_document,
          subtotal: newRecord.total_value,
          tax_rate: 0,
          tax_value: 0,
          total: newRecord.total_value,
          status: 'cancelada',
          notes: `[FISCAL_CANCELAMENTO] Protocolo SEFAZ: ${newRecord.sefaz_protocol} | Motivo: ${newRecord.cancellation_reason}`,
          items: {
            fiscal_type: 'cancelamento',
            access_key: newRecord.access_key,
            sefaz_protocol: newRecord.sefaz_protocol,
            cancellation_reason: newRecord.cancellation_reason,
            entry_or_cancel_date: newRecord.entry_or_cancel_date,
            chassis_list: newRecord.chassis_list,
            authorized_by: newRecord.authorized_by,
            return_to_stock: cancelForm.return_to_stock,
            status: 'cancelada',
          },
          created_by: user?.id || null,
        });

        // Se marcou para retornar ao estoque e informou chassi
        if (cancelForm.return_to_stock && cancelForm.chassis_involved) {
          const cleanChassis = cancelForm.chassis_involved.trim().toUpperCase();
          await supabase
            .from('vehicles')
            .update({ status: 'disponivel' })
            .ilike('chassis', `%${cleanChassis}%`);
        }
      } catch (err) {
        console.warn('Erro ao persistir cancelamento remoto:', err);
      }

      // Persistir no cache local
      const current = getStoredFiscalInvoices();
      saveStoredFiscalInvoices([newRecord, ...current]);
      return newRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setCancelModalOpen(false);
      setCancelForm({
        invoice_number: '',
        access_key: '',
        store_id: '',
        cancel_date: new Date().toISOString().slice(0, 10),
        party_name: '',
        party_document: '',
        sefaz_protocol: '',
        cancellation_reason: '',
        total_value: '',
        chassis_involved: '',
        return_to_stock: true,
        notes: '',
      });
      toast({
        title: 'Cancelamento fiscal homologado',
        description: 'O cancelamento da NF foi registrado com o protocolo SEFAZ e estorno contábil.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha no cancelamento',
        description: err?.message || 'Verifique os dados preenchidos.',
      });
    },
  });

  // Confirmar conferência de pátio para uma NF de entrada
  const confirmConferenceMutation = useMutation({
    mutationFn: async (recordId: string) => {
      try {
        await (supabase as any)
          .from('invoices')
          .update({
            status: 'conferido',
          })
          .eq('id', recordId);
      } catch {}

      const current = getStoredFiscalInvoices();
      const updated = current.map(r => r.id === recordId ? { ...r, status: 'conferido' as const } : r);
      saveStoredFiscalInvoices(updated);
      return recordId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-fiscal-invoices'] });
      toast({
        title: 'Conferência física confirmada',
        description: 'Todos os chassis da nota fiscal foram validados na descarga do pátio da loja.',
      });
    },
  });

  // Copiar chave de acesso
  const handleCopyKey = (key: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast({ title: 'Chave de acesso copiada!' });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Filtragem dos registros
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Filtro de aba
      if (activeTab === 'entradas' && rec.fiscal_type !== 'entrada') return false;
      if (activeTab === 'cancelamentos' && rec.fiscal_type !== 'cancelamento') return false;

      // Filtro de loja
      if (storeFilter !== 'all' && rec.store_id !== storeFilter) return false;

      // Filtro de status
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;

      // Filtro de busca
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const numMatch = rec.invoice_number.toLowerCase().includes(q);
        const partyMatch = rec.party_name.toLowerCase().includes(q);
        const keyMatch = (rec.access_key || '').toLowerCase().includes(q);
        const protocolMatch = (rec.sefaz_protocol || '').toLowerCase().includes(q);
        const chassisMatch = (rec.chassis_list || []).some(c => c.toLowerCase().includes(q));
        if (!numMatch && !partyMatch && !keyMatch && !protocolMatch && !chassisMatch) {
          return false;
        }
      }

      return true;
    });
  }, [records, activeTab, storeFilter, statusFilter, searchTerm]);

  // Cálculos de Indicadores Globais
  const stats = useMemo(() => {
    const entradas = records.filter(r => r.fiscal_type === 'entrada');
    const cancelamentos = records.filter(r => r.fiscal_type === 'cancelamento');

    const totalEntradaVal = entradas.reduce((sum, r) => sum + r.total_value, 0);
    const totalCancelVal = cancelamentos.reduce((sum, r) => sum + r.total_value, 0);
    const pendentesConf = entradas.filter(r => r.status === 'pendente_conferencia').length;
    const chassisRecebidos = entradas.reduce((sum, r) => sum + (r.chassis_list?.length || 0), 0);

    return {
      qtdEntradas: entradas.length,
      valEntradas: totalEntradaVal,
      qtdCancelamentos: cancelamentos.length,
      valCancelamentos: totalCancelVal,
      pendentesConf,
      chassisRecebidos,
    };
  }, [records]);

  // Exportar dados fiscais
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast({ title: 'Nenhum registro para exportar' });
      return;
    }

    const headers = ['Tipo', 'Numero_NF', 'Loja', 'Data_Emissao', 'Data_Entrada_Cancelamento', 'Favorecido', 'CPF_CNPJ', 'Valor_Total', 'Status', 'Chave_Acesso', 'Protocolo_SEFAZ', 'Chassis'];
    const rows = filteredRecords.map(r => {
      const storeName = stores.find(s => s.id === r.store_id)?.name || 'Matriz';
      return [
        r.fiscal_type.toUpperCase(),
        `"${r.invoice_number}"`,
        `"${storeName}"`,
        r.issue_date,
        r.entry_or_cancel_date,
        `"${r.party_name}"`,
        `"${r.party_document || ''}"`,
        r.total_value.toFixed(2),
        r.status.toUpperCase(),
        `"${r.access_key || ''}"`,
        `"${r.sefaz_protocol || ''}"`,
        `"${(r.chassis_list || []).join('; ')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `controle-fiscal-nfs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Relatório Fiscal CSV baixado' });
  };

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DO MÓDULO FISCAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ReceiptText className="w-5 h-5" />
            </div>
            <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
              Controle Fiscal de Entrada & Cancelamento de NFs
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 pl-8">
            Gestão das notas de remessa da fábrica recebidas pelas lojas e registro oficial de NFs canceladas na SEFAZ.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="h-9 text-xs gap-1.5 border-border/80 hover:bg-muted/50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar Contábil</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setEntryModalOpen(true)}
            className="h-9 text-xs gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            <span>Entrada de NF</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setCancelModalOpen(true)}
            className="h-9 text-xs gap-1.5 font-bold border-destructive/40 text-destructive hover:bg-destructive/10 shadow-xs"
          >
            <XCircle className="w-4 h-4 text-destructive" />
            <span>Registrar Cancelamento</span>
          </Button>
        </div>
      </div>

      {/* KPIS EXECUTIVOS */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {/* KPI 1: Entradas */}
        <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/80" />
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">NFs Entrada (Fábrica)</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-black font-display text-foreground">
              {stats.qtdEntradas} <span className="text-xs font-normal text-muted-foreground">NFs</span>
            </span>
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate mt-0.5">
              R$ {stats.valEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
            {stats.chassisRecebidos} veículos faturados p/ pátio
          </p>
        </div>

        {/* KPI 2: Cancelamentos */}
        <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-destructive/80" />
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">NFs Canceladas (SEFAZ)</span>
            <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-black font-display text-foreground">
              {stats.qtdCancelamentos} <span className="text-xs font-normal text-muted-foreground">NFs</span>
            </span>
            <p className="text-[11px] font-mono text-destructive font-semibold truncate mt-0.5">
              R$ {stats.valCancelamentos.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} estornados
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
            Protocoladas com justificativa legal
          </p>
        </div>

        {/* KPI 3: Pendentes de Conferência Física */}
        <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500/80" />
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Conferência no Pátio</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-black font-display text-foreground">
              {stats.pendentesConf} <span className="text-xs font-normal text-muted-foreground">pendentes</span>
            </span>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate mt-0.5">
              {stats.pendentesConf === 0 ? 'Todas conferidas no pátio' : 'Aguardando validação de chassi'}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
            Descarga física e checagem de avarias
          </p>
        </div>

        {/* KPI 4: Unidades Lojas Ativas */}
        <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/80" />
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cobertura de Lojas</span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-black font-display text-foreground">
              {stores.length || 2} <span className="text-xs font-normal text-muted-foreground">lojas</span>
            </span>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              Montes Claros & Divinópolis
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/40">
            Emissão e estorno sincronizados
          </p>
        </div>
      </div>

      {/* FILTROS E ABAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Abas */}
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('todas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'todas'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todas ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('entradas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'entradas'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Entradas ({stats.qtdEntradas})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cancelamentos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'cancelamentos'
                ? 'bg-destructive text-white shadow-xs'
                : 'text-destructive hover:bg-destructive/10'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancelamentos ({stats.qtdCancelamentos})
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          {/* Busca */}
          <div className="relative col-span-2 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar Nº NF, Chave, Chassi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>

          {/* Loja */}
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="h-9 text-xs sm:w-44">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="conferido">Conferido no Pátio</SelectItem>
              <SelectItem value="pendente_conferencia">Pendente Conferência</SelectItem>
              <SelectItem value="cancelada">Cancelada SEFAZ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* LISTAGEM DE REGISTROS FISCAIS */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-0">
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
                <ReceiptText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Nenhum registro fiscal encontrado
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm || storeFilter !== 'all'
                  ? 'Ajuste os filtros de busca ou loja para localizar notas fiscais.'
                  : 'Cadastre a primeira entrada de remessa da fábrica ou registre cancelamentos de notas.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button size="sm" onClick={() => setEntryModalOpen(true)} className="gap-1.5 text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Dar Entrada de NF
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Visualização Mobile: Cards Touch Verticais */}
              <div className="md:hidden divide-y divide-border/60 p-2 space-y-2">
                {filteredRecords.map((rec) => {
                  const storeName = stores.find(s => s.id === rec.store_id)?.name || 'Matriz';
                  const isEntrada = rec.fiscal_type === 'entrada';

                  return (
                    <div
                      key={rec.id}
                      className="p-3 rounded-xl border bg-card space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-foreground">
                            NF {rec.invoice_number}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[9.5px] font-bold px-2 py-0 h-4.5 ${
                              isEntrada
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-destructive/10 text-destructive border-destructive/20'
                            }`}
                          >
                            {isEntrada ? 'ENTRADA' : 'CANCELADA'}
                          </Badge>
                        </div>
                        <span className="font-display font-black text-xs text-foreground shrink-0">
                          R$ {rec.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs pt-1 border-t border-border/50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground truncate">{rec.party_name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            {rec.party_document || '—'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">{storeName}</span>
                          <span>•</span>
                          <span>{rec.entry_or_cancel_date}</span>
                        </p>
                      </div>

                      {/* Chave de Acesso / Protocolo */}
                      {(rec.access_key || rec.sefaz_protocol) && (
                        <div className="p-2 rounded-lg bg-muted/40 text-[10px] font-mono flex items-center justify-between gap-2">
                          <span className="truncate text-muted-foreground">
                            {rec.access_key ? `Chave: ${String(rec.access_key).slice(0, 18)}...` : `Prot: ${rec.sefaz_protocol}`}
                          </span>
                          {rec.access_key && (
                            <button
                              type="button"
                              onClick={() => handleCopyKey(rec.access_key!)}
                              className="text-primary hover:underline shrink-0"
                            >
                              Copiar
                            </button>
                          )}
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                        <div>
                          {isEntrada && rec.status === 'pendente_conferencia' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmConferenceMutation.mutate(rec.id)}
                              className="h-7 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Conferir no Pátio
                            </Button>
                          )}
                          {isEntrada && rec.status === 'conferido' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Pátio Conferido
                            </span>
                          )}
                          {!isEntrada && (
                            <span className="text-[10px] font-mono text-destructive">
                              Prot: {rec.sefaz_protocol || 'SEFAZ-OK'}
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRecord(rec);
                            setDetailsModalOpen(true);
                          }}
                          className="h-7 px-2 text-xs text-primary font-bold"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Detalhes
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visualização Desktop: Tabela Completa */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-28 text-[10px] font-bold uppercase tracking-wider">Tipo</TableHead>
                      <TableHead className="w-28 text-[10px] font-bold uppercase tracking-wider">Nº da NF</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Loja / Unidade</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Fornecedor / Cliente</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Data</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Valor Total</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Conferência / SEFAZ</TableHead>
                      <TableHead className="text-right pr-4 text-[10px] font-bold uppercase tracking-wider">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((rec) => {
                      const storeName = stores.find(s => s.id === rec.store_id)?.name || 'Matriz';
                      const isEntrada = rec.fiscal_type === 'entrada';

                      return (
                        <TableRow key={rec.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] font-bold px-2 py-0.5 ${
                                isEntrada
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-destructive/10 text-destructive border-destructive/20'
                              }`}
                            >
                              {isEntrada ? 'ENTRADA' : 'CANCELADA'}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {rec.invoice_number}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate max-w-[150px]">{storeName}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div>
                              <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                                {rec.party_name}
                              </p>
                              {rec.party_document && (
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {rec.party_document}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {rec.entry_or_cancel_date}
                          </TableCell>

                          <TableCell className="text-right font-display font-black text-xs text-foreground whitespace-nowrap">
                            R$ {rec.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell>
                            {isEntrada ? (
                              rec.status === 'conferido' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Conferido no Pátio
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => confirmConferenceMutation.mutate(rec.id)}
                                  className="h-6 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                                >
                                  <Clock className="w-3 h-3 mr-1" /> Validar Descarga
                                </Button>
                              )
                            ) : (
                              <div className="text-[11px] font-mono">
                                <span className="text-destructive font-semibold">Prot. SEFAZ:</span>{' '}
                                <span className="text-muted-foreground">{rec.sefaz_protocol || 'Homologado'}</span>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {rec.access_key && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyKey(rec.access_key!)}
                                  className="h-7 w-7 p-0"
                                  title="Copiar Chave de Acesso da NF"
                                >
                                  {copiedKey === rec.access_key ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRecord(rec);
                                  setDetailsModalOpen(true);
                                }}
                                className="h-7 px-2.5 text-xs font-semibold"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Espelho
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* MODAL: NOVA ENTRADA DE NF (FÁBRICA / FORNECEDOR) */}
      <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
              Registrar Entrada de Nota Fiscal (Fábrica / Fornecedor)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre a remessa de veículos recebida na concessionária para controle contábil e conferência de chassi.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Número da NF *</Label>
              <Input
                placeholder="Ex: 000.124.890"
                value={entryForm.invoice_number}
                onChange={(e) => setEntryForm({ ...entryForm, invoice_number: e.target.value })}
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Loja de Destino (Recebimento) *</Label>
              <Select
                value={entryForm.store_id}
                onValueChange={(val) => setEntryForm({ ...entryForm, store_id: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a loja..." />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Chave de Acesso SEFAZ (44 dígitos)</Label>
              <Input
                placeholder="31260100000000000000550010000000011000000010"
                value={entryForm.access_key}
                maxLength={44}
                onChange={(e) => setEntryForm({ ...entryForm, access_key: e.target.value.replace(/\D/g, '') })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Emitente / Fornecedor</Label>
              <Input
                value={entryForm.party_name}
                onChange={(e) => setEntryForm({ ...entryForm, party_name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">CNPJ do Emitente</Label>
              <Input
                value={entryForm.party_document}
                onChange={(e) => setEntryForm({ ...entryForm, party_document: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Data de Emissão da NF</Label>
              <Input
                type="date"
                value={entryForm.issue_date}
                onChange={(e) => setEntryForm({ ...entryForm, issue_date: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Data de Entrada Física no Pátio</Label>
              <Input
                type="date"
                value={entryForm.entry_date}
                onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Valor Total da NF (R$) *</Label>
              <Input
                placeholder="Ex: 125.400,00"
                value={entryForm.total_value}
                onChange={(e) => setEntryForm({ ...entryForm, total_value: e.target.value })}
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Transportadora / CTe</Label>
              <Input
                placeholder="Ex: Transmoto / CTe 54312"
                value={entryForm.carrier}
                onChange={(e) => setEntryForm({ ...entryForm, carrier: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Chassis Recebidos nesta Carga (separados por vírgula ou linha)</Label>
              <Textarea
                placeholder="Cole aqui os números de chassi constantes na NF (ex: 95P123..., 95P124...)"
                rows={3}
                value={entryForm.chassis_input}
                onChange={(e) => setEntryForm({ ...entryForm, chassis_input: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Observações Internas / Avarias na Descarga</Label>
              <Input
                placeholder="Ex: Todos os veículos descarregados sem avarias, lacres intactos."
                value={entryForm.notes}
                onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEntryModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => saveEntryMutation.mutate()}
              disabled={saveEntryMutation.isPending}
              className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saveEntryMutation.isPending ? 'Salvando...' : 'Confirmar Entrada de NF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: REGISTRAR CANCELAMENTO DE NF (SEFAZ) */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-destructive">
              <XCircle className="w-5 h-5 text-destructive" />
              Homologar Cancelamento de Nota Fiscal (SEFAZ)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre a nota fiscal cancelada por desistência, erro de faturamento ou devolução com protocolo fiscal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Número da NF Cancelada *</Label>
              <Input
                placeholder="Ex: 000.089.123"
                value={cancelForm.invoice_number}
                onChange={(e) => setCancelForm({ ...cancelForm, invoice_number: e.target.value })}
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Loja Emissora *</Label>
              <Select
                value={cancelForm.store_id}
                onValueChange={(val) => setCancelForm({ ...cancelForm, store_id: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a loja..." />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Protocolo de Cancelamento SEFAZ (Obrigatório) *</Label>
              <Input
                placeholder="Ex: 131260012345678 (15 dígitos emitidos pela SEFAZ MG)"
                value={cancelForm.sefaz_protocol}
                onChange={(e) => setCancelForm({ ...cancelForm, sefaz_protocol: e.target.value })}
                className="h-9 text-xs font-mono font-bold text-destructive"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Chave de Acesso da NF (44 dígitos)</Label>
              <Input
                placeholder="31260100000000000000550010000000011000000010"
                value={cancelForm.access_key}
                maxLength={44}
                onChange={(e) => setCancelForm({ ...cancelForm, access_key: e.target.value.replace(/\D/g, '') })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Cliente / Destinatário Original</Label>
              <Input
                placeholder="Nome do cliente constante na nota"
                value={cancelForm.party_name}
                onChange={(e) => setCancelForm({ ...cancelForm, party_name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">CPF / CNPJ do Destinatário</Label>
              <Input
                placeholder="000.000.000-00"
                value={cancelForm.party_document}
                onChange={(e) => setCancelForm({ ...cancelForm, party_document: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Data do Cancelamento</Label>
              <Input
                type="date"
                value={cancelForm.cancel_date}
                onChange={(e) => setCancelForm({ ...cancelForm, cancel_date: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Valor Total Estornado (R$)</Label>
              <Input
                placeholder="Ex: 18.990,00"
                value={cancelForm.total_value}
                onChange={(e) => setCancelForm({ ...cancelForm, total_value: e.target.value })}
                className="h-9 text-xs font-mono font-bold text-destructive"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Chassi da Moto Envolvida (Opcional)</Label>
              <Input
                placeholder="Ex: 95P2A1B2C3D4E5F6G"
                value={cancelForm.chassis_involved}
                onChange={(e) => setCancelForm({ ...cancelForm, chassis_involved: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Motivo Legal / Justificativa SEFAZ (Mínimo 15 caracteres) *</Label>
              <Textarea
                placeholder="Descreva a justificativa homologada no portal da Receita Estadual (ex: Desistência da compra antes da saída da mercadoria pelo cliente)."
                rows={3}
                value={cancelForm.cancellation_reason}
                onChange={(e) => setCancelForm({ ...cancelForm, cancellation_reason: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)}>
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={() => saveCancelMutation.mutate()}
              disabled={saveCancelMutation.isPending}
              className="font-bold bg-destructive hover:bg-destructive/90 text-white gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              {saveCancelMutation.isPending ? 'Homologando...' : 'Homologar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: DETALHES / ESPELHO DA NF */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ReceiptText className="w-5 h-5 text-primary" />
              Espelho do Registro Fiscal — NF {selectedRecord?.invoice_number}
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-3.5 text-xs py-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Natureza da Operação:</span>
                  <Badge
                    variant="secondary"
                    className={`font-bold px-2 py-0.5 ${
                      selectedRecord.fiscal_type === 'entrada'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {selectedRecord.fiscal_type === 'entrada' ? 'ENTRADA / REMESSA FÁBRICA' : 'CANCELAMENTO SEFAZ'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Unidade / Loja:</span>
                  <span className="font-bold text-foreground">
                    {stores.find(s => s.id === selectedRecord.store_id)?.name || 'Matriz'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">
                    {selectedRecord.fiscal_type === 'entrada' ? 'Fornecedor / Emitente:' : 'Cliente / Tomador:'}
                  </span>
                  <span className="font-bold text-foreground">{selectedRecord.party_name}</span>
                </div>

                {selectedRecord.party_document && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">CNPJ / CPF:</span>
                    <span className="font-mono text-foreground">{selectedRecord.party_document}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Valor Total da NF:</span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    R$ {selectedRecord.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Chave de Acesso */}
              {selectedRecord.access_key && (
                <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Chave de Acesso SEFAZ (44 Dígitos)
                  </span>
                  <p className="font-mono text-[11px] break-all select-all text-primary font-semibold">
                    {selectedRecord.access_key}
                  </p>
                </div>
              )}

              {/* Protocolo SEFAZ ou Justificativa de Cancelamento */}
              {selectedRecord.sefaz_protocol && (
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-destructive tracking-wider">
                    Protocolo de Homologação SEFAZ
                  </span>
                  <p className="font-mono text-xs font-bold text-destructive">
                    {selectedRecord.sefaz_protocol}
                  </p>
                  {selectedRecord.cancellation_reason && (
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-destructive/20 mt-1">
                      <strong>Motivo:</strong> {selectedRecord.cancellation_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Chassis Inclusos */}
              {selectedRecord.chassis_list && selectedRecord.chassis_list.length > 0 && (
                <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Chassis Vinculados ({selectedRecord.chassis_list.length} unidades)
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                    {selectedRecord.chassis_list.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-muted text-[10px] font-mono font-semibold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setDetailsModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
