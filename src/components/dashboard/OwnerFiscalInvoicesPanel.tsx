import { useState, useMemo } from 'react';
import {
  ReceiptText,
  ArrowUpRight,
  XCircle,
  CheckCircle2,
  Calendar,
  Download,
  Filter,
  Truck,
  RotateCcw,
  Plus,
  Search,
  Building2,
  AlertTriangle,
  DollarSign,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInvoices, useCancelInvoice, useUpsertInvoice, Invoice } from '@/hooks/useInvoices';
import { useStores } from '@/hooks/useStores';
import { useToast } from '@/hooks/use-toast';
import { exportToXLSX } from '@/lib/export';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { formatFiscalDate, getLocalTodayDateString } from '@/lib/fiscalDates';
import { useAuth } from '@/contexts/AuthContext';

export interface CombinedFiscalRecord {
  id: string;
  invoice_number: string;
  fiscal_type: 'entrada' | 'emissao' | 'cancelamento';
  store_id: string;
  store_name: string;
  party_name: string;
  issue_date: string;
  event_date: string; // Data da entrada, da emissão ou do cancelamento naquela semana
  total_value: number;
  status: string;
  cancellation_reason?: string;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao';
  sefaz_protocol?: string;
  notes?: string;
  rawInvoiceId?: string;
}

export const WEEKS_CONFIG = [
  { key: 'sem_1', label: 'Semana 1', range: '01 a 07 Nov', days: [1, 7] },
  { key: 'sem_2', label: 'Semana 2', range: '08 a 14 Nov', days: [8, 14] },
  { key: 'sem_3', label: 'Semana 3', range: '15 a 21 Nov', days: [15, 21], isCurrent: true },
  { key: 'sem_4', label: 'Semana 4', range: '22 a 28 Nov', days: [22, 28] },
  { key: 'sem_5', label: 'Semana 5', range: '29 a 30 Nov', days: [29, 31] },
];

export function cleanFakeFiscalInvoices(): void {
  try {
    const storageKey = 'dealflow_store_fiscal_invoices_v1';
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((item: any) => {
          if (!item) return false;
          const id = String(item.id || '');
          const invNum = String(item.invoice_number || '').trim();
          if (id.startsWith('fisc-seed-')) return false;
          if (['10420', '10421', '10422', '10425', '10426', '10430', '10431'].includes(invNum)) return false;
          const party = String(item.party_name || '').toLowerCase();
          if (
            party.includes('marcos aurelio') ||
            party.includes('claudio roberto') ||
            party.includes('patricia santos') ||
            party.includes('fernando guimaraes')
          ) {
            return false;
          }
          return true;
        });
        localStorage.setItem(storageKey, JSON.stringify(cleaned));
      }
    }
  } catch {}
}

export function OwnerFiscalInvoicesPanel() {
  const { isAdmin, isManager, hasElevatedAccess } = useAuth();
  const canModifyNf = Boolean(isAdmin || isManager || hasElevatedAccess);

  const { data: invoices = [], isLoading } = useInvoices();
  const { data: stores = [] } = useStores();
  const { toast } = useToast();
  const cancelInvoiceMutation = useCancelInvoice();
  const upsertInvoiceMutation = useUpsertInvoice();

  // Foco estritamente semanal: por padrão a Semana 3 (atual de 16/11/2026)
  const [weekFilter, setWeekFilter] = useState<string>('sem_3');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modais de Controle
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<CombinedFiscalRecord | null>(null);

  // Formulário de Nova NF
  const [newType, setNewType] = useState<'entrada' | 'emissao'>('entrada');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newStoreId, setNewStoreId] = useState('store-montesclaros');
  const [newEventDate, setNewEventDate] = useState('2026-11-16');
  const [newPartyName, setNewPartyName] = useState('Shineray do Brasil S.A.');
  const [newTotalValue, setNewTotalValue] = useState('');
  const [newSefazProtocol, setNewSefazProtocol] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Formulário de Cancelamento
  const [cancellationDate, setCancellationDate] = useState('2026-11-16');
  const [cancellationType, setCancellationType] = useState<'estorno' | 'credito'>('estorno');
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationProtocol, setCancellationProtocol] = useState('');

  // Formulário de Edição de NF da Diretoria
  const [editingRecord, setEditingRecord] = useState<CombinedFiscalRecord | null>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editStoreId, setEditStoreId] = useState('store-montesclaros');
  const [editEventDate, setEditEventDate] = useState(getLocalTodayDateString());
  const [editPartyName, setEditPartyName] = useState('');
  const [editTotalValue, setEditTotalValue] = useState('');
  const [editSefazProtocol, setEditSefazProtocol] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleOpenEdit = (r: CombinedFiscalRecord) => {
    if (!canModifyNf) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas a Diretoria e Gerência têm permissão para editar dados de Notas Fiscais.',
      });
      return;
    }
    setEditingRecord(r);
    setEditInvoiceNumber(r.invoice_number);
    setEditStoreId(r.store_id || 'store-montesclaros');
    setEditEventDate(r.event_date || r.issue_date || getLocalTodayDateString());
    setEditPartyName(r.party_name || '');
    setEditTotalValue(r.total_value ? String(r.total_value) : '');
    setEditSefazProtocol(r.sefaz_protocol || '');
    setEditNotes(r.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!canModifyNf) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas a Diretoria e Gerência têm permissão para salvar alterações de Notas Fiscais.',
      });
      return;
    }
    if (!editingRecord) return;
    if (!editInvoiceNumber.trim()) {
      toast({ variant: 'destructive', title: 'Número da NF obrigatório' });
      return;
    }
    const val = Number(editTotalValue.replace(/\D/g, '')) / 100 || Number(editTotalValue) || 0;
    if (val <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Informe o valor total da NF.' });
      return;
    }

    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];

      list = list.map((item: any) => {
        if (
          item.id === editingRecord.id ||
          item.invoice_number === editingRecord.invoice_number
        ) {
          return {
            ...item,
            invoice_number: editInvoiceNumber.trim(),
            store_id: editStoreId,
            issue_date: editEventDate,
            entry_or_cancel_date: editEventDate,
            party_name: editPartyName.trim(),
            total_value: val,
            sefaz_protocol: editSefazProtocol.trim(),
            notes: editNotes.trim(),
          };
        }
        return item;
      });
      localStorage.setItem(storageKey, JSON.stringify(list));

      if (editingRecord.rawInvoiceId && !editingRecord.rawInvoiceId.startsWith('loc-')) {
        const rawInv = invoices.find((x) => x.id === editingRecord.rawInvoiceId);
        const storeObj = stores.find((s) => s.id === editStoreId);
        const storeName = storeObj?.name || (editStoreId.includes('montes') ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis');

        await upsertInvoiceMutation.mutateAsync({
          id: editingRecord.rawInvoiceId,
          invoice_number: editInvoiceNumber.trim(),
          issue_date: editEventDate,
          store_id: editStoreId,
          store_name: storeName,
          customer_name: editPartyName.trim(),
          total_value: val,
          total: val,
          subtotal: val,
          sefaz_protocol: editSefazProtocol.trim(),
          notes: editNotes.trim(),
          status: rawInv?.status || (editingRecord.fiscal_type === 'cancelamento' ? 'cancelada' : 'emitida'),
          created_at: rawInv?.created_at,
          sale_id: rawInv?.sale_id,
          contract_number: rawInv?.contract_number,
          attachment_name: rawInv?.attachment_name,
          attachment_url: rawInv?.attachment_url,
          attachment_size: rawInv?.attachment_size,
          attachment_type: rawInv?.attachment_type,
        });
      }

      toast({
        title: 'NF Atualizada com Sucesso!',
        description: `Dados da NF ${editInvoiceNumber} atualizados no painel da diretoria.`,
      });

      setEditingRecord(null);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar alterações da NF', description: err?.message });
    }
  };

  // Sincronização e união de registros
  const allFiscalRecords = useMemo(() => {
    let localRecords: any[] = [];
    try {
      cleanFakeFiscalInvoices();
      const raw = localStorage.getItem('dealflow_store_fiscal_invoices_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localRecords = parsed.filter((loc: any) => {
            const id = String(loc.id || '');
            const invNum = String(loc.invoice_number || '').trim();
            return !id.startsWith('fisc-seed-') && !['10420', '10421', '10422', '10425', '10426', '10430', '10431'].includes(invNum);
          });
        }
      }
    } catch {
      localRecords = [];
    }

    const recordsList: CombinedFiscalRecord[] = [];

    // 1. Processa Invoices do Banco de Dados
    invoices.forEach((inv) => {
      const isEntrada = inv.invoice_type === 'entrada';
      const isCancelada = inv.status === 'cancelada' || inv.invoice_type === 'cancelamento';
      const storeName = inv.store?.name || (inv.store_id?.includes('montes') ? 'Montes Claros' : 'Divinópolis');
      const issueDate = inv.issue_date || inv.created_at?.slice(0, 10) || '';

      if (isEntrada) {
        recordsList.push({
          id: `entry-${inv.id}`,
          invoice_number: inv.invoice_number,
          fiscal_type: 'entrada',
          store_id: inv.store_id || '',
          store_name: storeName,
          party_name: inv.customer_name || 'Shineray do Brasil S.A.',
          issue_date: issueDate,
          event_date: issueDate,
          total_value: Number(inv.total) || 0,
          status: 'conferido',
          sefaz_protocol: inv.sefaz_protocol || '',
          notes: inv.notes || '',
          rawInvoiceId: inv.id,
        });
        return;
      }

      // Emissão original
      recordsList.push({
        id: `emit-${inv.id}`,
        invoice_number: inv.invoice_number,
        fiscal_type: 'emissao',
        store_id: inv.store_id || '',
        store_name: storeName,
        party_name: inv.customer_name || 'Consumidor Final',
        issue_date: issueDate,
        event_date: issueDate,
        total_value: Number(inv.total) || 0,
        status: isCancelada ? 'cancelada_posteriormente' : 'emitida',
        notes: inv.notes || '',
        rawInvoiceId: inv.id,
      });

      // Se foi cancelada, cria o evento de cancelamento na DATA DO CANCELAMENTO
      if (isCancelada) {
        const cancelDate = inv.cancellation_date || inv.issue_date || inv.created_at?.slice(0, 10) || '';
        recordsList.push({
          id: `canc-${inv.id}`,
          invoice_number: inv.invoice_number,
          fiscal_type: 'cancelamento',
          store_id: inv.store_id || '',
          store_name: storeName,
          party_name: inv.customer_name || 'Consumidor Final',
          issue_date: issueDate,
          event_date: cancelDate,
          total_value: Number(inv.total) || 0,
          status: 'cancelada',
          cancellation_reason: inv.cancellation_reason || inv.notes || 'Cancelamento registrado',
          cancellation_type: inv.cancellation_type || 'estorno',
          sefaz_protocol: inv.sefaz_protocol || '',
          notes: inv.notes || '',
          rawInvoiceId: inv.id,
        });
      }
    });

    // 2. Processa Registros Locais (inclusões do usuário)
    localRecords.forEach((loc: any) => {
      const storeName = stores.find((s) => s.id === loc.store_id)?.name || (loc.store_id?.includes('montes') ? 'Montes Claros' : 'Divinópolis');
      const isEntrada = loc.fiscal_type === 'entrada';
      const isCancel = loc.fiscal_type === 'cancelamento' || loc.status === 'cancelada';

      const issueDate = loc.issue_date || loc.entry_or_cancel_date || loc.created_at?.slice(0, 10) || '';
      const eventDate = loc.entry_or_cancel_date || loc.issue_date || loc.created_at?.slice(0, 10) || '';

      const alreadyHas = recordsList.some(
        (r) => r.invoice_number === loc.invoice_number && r.fiscal_type === (isEntrada ? 'entrada' : isCancel ? 'cancelamento' : 'emissao')
      );

      if (!alreadyHas) {
        recordsList.push({
          id: loc.id || `loc-${loc.invoice_number}-${Math.random()}`,
          invoice_number: loc.invoice_number,
          fiscal_type: isEntrada ? 'entrada' : isCancel ? 'cancelamento' : 'emissao',
          store_id: loc.store_id || '',
          store_name: storeName,
          party_name: loc.party_name || (isEntrada ? 'Shineray do Brasil S.A.' : 'Consumidor Final'),
          issue_date: issueDate,
          event_date: eventDate,
          total_value: Number(loc.total_value) || 0,
          status: loc.status || (isCancel ? 'cancelada' : 'conferido'),
          cancellation_reason: loc.cancellation_reason || loc.notes || '',
          cancellation_type: loc.cancellation_type || 'estorno',
          sefaz_protocol: loc.sefaz_protocol || '',
          notes: loc.notes || '',
          rawInvoiceId: loc.id,
        });
      }
    });

    return recordsList.sort(
      (a, b) => new Date(b.event_date || b.issue_date).getTime() - new Date(a.event_date || a.issue_date).getTime()
    );
  }, [invoices, stores]);

  // Mapa com o Resumo Consolidado de cada Semana do Mês para os Botões do Topo
  const weeklyMetricsMap = useMemo(() => {
    const map: Record<string, { entradas: number; emissoes: number; canceladas: number; entradasVal: number; emissoesVal: number; canceladasVal: number; estornoVal: number }> = {
      sem_1: { entradas: 0, emissoes: 0, canceladas: 0, entradasVal: 0, emissoesVal: 0, canceladasVal: 0, estornoVal: 0 },
      sem_2: { entradas: 0, emissoes: 0, canceladas: 0, entradasVal: 0, emissoesVal: 0, canceladasVal: 0, estornoVal: 0 },
      sem_3: { entradas: 0, emissoes: 0, canceladas: 0, entradasVal: 0, emissoesVal: 0, canceladasVal: 0, estornoVal: 0 },
      sem_4: { entradas: 0, emissoes: 0, canceladas: 0, entradasVal: 0, emissoesVal: 0, canceladasVal: 0, estornoVal: 0 },
      sem_5: { entradas: 0, emissoes: 0, canceladas: 0, entradasVal: 0, emissoesVal: 0, canceladasVal: 0, estornoVal: 0 },
    };

    allFiscalRecords.forEach((r) => {
      const dStr = r.event_date || r.issue_date;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;
      const day = d.getDate();
      const weekKey = day <= 7 ? 'sem_1' : day <= 14 ? 'sem_2' : day <= 21 ? 'sem_3' : day <= 28 ? 'sem_4' : 'sem_5';

      if (map[weekKey]) {
        if (r.fiscal_type === 'entrada') {
          map[weekKey].entradas++;
          map[weekKey].entradasVal += r.total_value;
        } else if (r.fiscal_type === 'cancelamento') {
          map[weekKey].canceladas++;
          map[weekKey].canceladasVal += r.total_value;
          map[weekKey].estornoVal += r.total_value;
        } else {
          map[weekKey].emissoes++;
          map[weekKey].emissoesVal += r.total_value;
        }
      }
    });

    return map;
  }, [allFiscalRecords]);

  // Registros Filtrados estritamente pela Semana / Filtros Atuais
  const filteredRecords = useMemo(() => {
    return allFiscalRecords.filter((rec) => {
      // 1. Filtro de Loja
      if (storeFilter !== 'all') {
        const matchesStore =
          rec.store_id === storeFilter ||
          (storeFilter === 'store-montesclaros' && rec.store_name.toLowerCase().includes('montes')) ||
          (storeFilter === 'store-divinopolis' && rec.store_name.toLowerCase().includes('divin'));
        if (!matchesStore) return false;
      }

      // 2. Filtro de Tipo
      if (typeFilter !== 'all' && rec.fiscal_type !== typeFilter) {
        return false;
      }

      // 3. Filtro de Semana (O Coração da Regra)
      const dStr = rec.event_date || rec.issue_date;
      if (!dStr) return true;
      const recDate = new Date(dStr);
      if (isNaN(recDate.getTime())) return true;
      const dayOfMonth = recDate.getDate();

      if (weekFilter === 'sem_1' && !(dayOfMonth >= 1 && dayOfMonth <= 7)) return false;
      if (weekFilter === 'sem_2' && !(dayOfMonth >= 8 && dayOfMonth <= 14)) return false;
      if (weekFilter === 'sem_3' && !(dayOfMonth >= 15 && dayOfMonth <= 21)) return false;
      if (weekFilter === 'sem_4' && !(dayOfMonth >= 22 && dayOfMonth <= 28)) return false;
      if (weekFilter === 'sem_5' && !(dayOfMonth >= 29)) return false;

      // 4. Busca
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        return (
          rec.invoice_number.toLowerCase().includes(q) ||
          rec.party_name.toLowerCase().includes(q) ||
          (rec.sefaz_protocol || '').toLowerCase().includes(q) ||
          (rec.cancellation_reason || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allFiscalRecords, storeFilter, weekFilter, typeFilter, searchTerm]);

  // Métricas do Dono calculadas sobre a SEMANA selecionada
  const metrics = useMemo(() => {
    let entradasCount = 0;
    let entradasValue = 0;
    let emissoesCount = 0;
    let emissoesValue = 0;
    let cancelamentosCount = 0;
    let cancelamentosValue = 0;
    let estornosValue = 0;
    let creditosValue = 0;

    filteredRecords.forEach((r) => {
      if (r.fiscal_type === 'entrada') {
        entradasCount++;
        entradasValue += r.total_value;
      } else if (r.fiscal_type === 'cancelamento') {
        cancelamentosCount++;
        cancelamentosValue += r.total_value;
        if (r.cancellation_type === 'credito') {
          creditosValue += r.total_value;
        } else {
          estornosValue += r.total_value;
        }
      } else {
        emissoesCount++;
        emissoesValue += r.total_value;
      }
    });

    return {
      entradasCount,
      entradasValue,
      emissoesCount,
      emissoesValue,
      cancelamentosCount,
      cancelamentosValue,
      estornosValue,
      creditosValue,
      saldoSemanal: entradasValue - emissoesValue + estornosValue,
    };
  }, [filteredRecords]);

  // Ação: Lançar Nova NF (Inclusão manual pelo operador)
  const handleCreateInvoice = async () => {
    if (!newInvoiceNumber.trim()) {
      toast({ variant: 'destructive', title: 'Informe o número da NF' });
      return;
    }
    const val = parseFloat(newTotalValue.replace(/\D/g, '')) / 100 || Number(newTotalValue) || 0;
    if (val <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor total válido para a NF' });
      return;
    }

    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      const list = raw ? JSON.parse(raw) : [];

      const newRecord = {
        id: `fisc-man-${Date.now()}`,
        invoice_number: newInvoiceNumber.trim(),
        fiscal_type: newType,
        store_id: newStoreId,
        issue_date: newEventDate,
        entry_or_cancel_date: newEventDate,
        party_name: newPartyName.trim() || (newType === 'entrada' ? 'Shineray do Brasil S.A.' : 'Consumidor Final'),
        total_value: val,
        status: newType === 'entrada' ? 'conferido' : 'emitida',
        sefaz_protocol: newSefazProtocol.trim(),
        notes: newNotes.trim(),
        created_at: new Date().toISOString(),
      };

      list.unshift(newRecord);
      localStorage.setItem(storageKey, JSON.stringify(list));

      toast({
        title: 'NF Registrada com Sucesso!',
        description: `NF ${newInvoiceNumber} adicionada na semana de ${new Date(newEventDate).toLocaleDateString('pt-BR')}.`,
      });

      // Limpa formulário
      setNewInvoiceNumber('');
      setNewTotalValue('');
      setNewNotes('');
      setNewSefazProtocol('');
      setIsNewInvoiceModalOpen(false);
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao registrar NF', description: err?.message });
    }
  };

  // Ação: Cancelar NF (Gera evento de cancelamento na data selecionada sem apagar a emissão original)
  const handleConfirmCancellation = async () => {
    if (!invoiceToCancel) return;
    if (!cancellationReason.trim()) {
      toast({ variant: 'destructive', title: 'Informe o motivo do cancelamento da NF' });
      return;
    }

    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];

      // Atualiza o registro original para marcar status
      list = list.map((item: any) => {
        if (item.invoice_number === invoiceToCancel.invoice_number && item.fiscal_type === 'emissao') {
          return {
            ...item,
            status: 'cancelada_posteriormente',
            cancellation_date: cancellationDate,
            cancellation_type: cancellationType,
            cancellation_reason: cancellationReason.trim(),
          };
        }
        return item;
      });

      // Adiciona o EVENTO de cancelamento com a DATA DO CANCELAMENTO (para apuração daquela semana!)
      const cancelRecord = {
        id: `canc-${invoiceToCancel.invoice_number}-${Date.now()}`,
        invoice_number: invoiceToCancel.invoice_number,
        fiscal_type: 'cancelamento',
        store_id: invoiceToCancel.store_id,
        issue_date: invoiceToCancel.issue_date,
        entry_or_cancel_date: cancellationDate,
        party_name: invoiceToCancel.party_name,
        total_value: invoiceToCancel.total_value,
        status: 'cancelada',
        cancellation_reason: cancellationReason.trim(),
        cancellation_type: cancellationType,
        sefaz_protocol: cancellationProtocol.trim() || invoiceToCancel.sefaz_protocol || '',
        notes: `Cancelamento de NF emitida em ${new Date(invoiceToCancel.issue_date).toLocaleDateString('pt-BR')} com ${cancellationType === 'estorno' ? 'Estorno Financeiro' : 'Crédito na Fábrica'}. Motivo: ${cancellationReason.trim()}`,
        created_at: new Date().toISOString(),
      };

      list.unshift(cancelRecord);
      localStorage.setItem(storageKey, JSON.stringify(list));

      // Se tiver vínculo com o Supabase, chama a mutation também
      if (invoiceToCancel.rawInvoiceId && !invoiceToCancel.rawInvoiceId.startsWith('loc-')) {
        void cancelInvoiceMutation.mutateAsync({
          id: invoiceToCancel.rawInvoiceId,
          cancellation_date: cancellationDate,
          cancellation_reason: cancellationReason.trim(),
          cancellation_type: cancellationType,
          sefaz_protocol: cancellationProtocol.trim(),
        });
      }

      toast({
        title: 'NF Cancelada com Sucesso!',
        description: `Cancelamento homologado na data ${new Date(cancellationDate).toLocaleDateString('pt-BR')}. O valor de ${formatCurrencyBRL(invoiceToCancel.total_value)} constará como ${cancellationType === 'estorno' ? 'Estorno Financeiro' : 'Crédito Fiscal'} na semana correspondente.`,
      });

      setInvoiceToCancel(null);
      setCancellationReason('');
      setCancellationProtocol('');
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar NF', description: err?.message });
    }
  };

  // Exportar relatório em XLSX
  const handleExportXLSX = () => {
    const exportData = filteredRecords.map((r) => ({
      Numero_NF: r.invoice_number,
      Tipo_Evento:
        r.fiscal_type === 'entrada'
          ? 'Entrada de Fábrica (Remessa)'
          : r.fiscal_type === 'cancelamento'
          ? 'Cancelamento SEFAZ'
          : 'Emissão de Venda',
      Semana_Apuracao:
        new Date(r.event_date).getDate() <= 7
          ? 'Semana 1'
          : new Date(r.event_date).getDate() <= 14
          ? 'Semana 2'
          : new Date(r.event_date).getDate() <= 21
          ? 'Semana 3'
          : new Date(r.event_date).getDate() <= 28
          ? 'Semana 4'
          : 'Semana 5',
      Data_Evento_Semana: formatFiscalDate(r.event_date),
      Data_Emissao_Original: formatFiscalDate(r.issue_date),
      Concessionaria: r.store_name,
      Cliente_Fornecedor: r.party_name,
      Valor_Total: r.total_value,
      Tratamento_Financeiro:
        r.fiscal_type === 'cancelamento'
          ? r.cancellation_type === 'credito'
            ? 'Crédito na Fábrica'
            : 'Estorno Financeiro a Receber'
          : r.fiscal_type === 'entrada'
          ? 'Entrada de Estoque'
          : 'Faturamento de Venda',
      Protocolo_SEFAZ: r.sefaz_protocol || '—',
      Justificativa_Motivo: r.cancellation_reason || r.notes || '—',
      Status: r.status,
    }));

    void exportToXLSX({
      title: `Controle_Semanal_NFs_${weekFilter}_${new Date().toISOString().slice(0, 10)}`,
      module: 'sales',
      filters: { loja: storeFilter, semana: weekFilter },
      columns: Object.keys(exportData[0] || {}).map((k) => ({ key: k, label: k })),
      data: exportData,
      userName: 'Diretoria / Dono',
    });
  };

  const currentWeekLabel =
    weekFilter === 'all'
      ? 'Mês Completo (Novembro / 2026)'
      : WEEKS_CONFIG.find((w) => w.key === weekFilter)?.label + ' (' + WEEKS_CONFIG.find((w) => w.key === weekFilter)?.range + ')';

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho com Ações de Lançamento e Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ReceiptText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
              Controle Semanal de Notas Fiscais
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                Gestão por Semana
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Acompanhe as NFs que entraram da fábrica, faturamentos e cancelamentos por semana, com apuração de estornos e créditos fiscais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setIsNewInvoiceModalOpen(true)}
            className="gap-1.5 font-bold text-xs rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Lançar NF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXLSX}
            className="gap-1.5 font-semibold text-xs rounded-xl border-dashed"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar XLSX
          </Button>
        </div>
      </div>

      {/* 2. REGUA DE NAVEGAÇÃO SEMANAL (O Centro da Interface) */}
      <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Selecione a Semana de Competência
            </span>
          </div>
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
            Visualizando: <strong>{currentWeekLabel}</strong>
          </span>
        </div>

        {/* Grade de Semanas com Resumo Em Cada Botão */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WEEKS_CONFIG.map((w) => {
            const isSelected = weekFilter === w.key;
            const wM = weeklyMetricsMap[w.key] || { entradas: 0, emissoes: 0, canceladas: 0 };
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setWeekFilter(w.key)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                    : 'bg-muted/30 hover:bg-muted/70 border-border text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{w.label}</span>
                  {w.isCurrent && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      Atual
                    </span>
                  )}
                </div>
                <p className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {w.range}
                </p>
                <div className="flex flex-wrap items-center gap-1 mt-2 text-[10px] font-semibold">
                  <span className={`px-1 py-0.2 rounded ${isSelected ? 'bg-primary-foreground/20' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    +{wM.entradas} E
                  </span>
                  <span className={`px-1 py-0.2 rounded ${isSelected ? 'bg-primary-foreground/20' : 'bg-blue-500/10 text-blue-600'}`}>
                    {wM.emissoes} S
                  </span>
                  {wM.canceladas > 0 && (
                    <span className={`px-1 py-0.2 rounded ${isSelected ? 'bg-destructive/80 text-white' : 'bg-destructive/10 text-destructive'}`}>
                      {wM.canceladas} C
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Botão de Visão Consolidada do Mês */}
          <button
            type="button"
            onClick={() => setWeekFilter('all')}
            className={`p-3 rounded-xl border text-left transition-all ${
              weekFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                : 'bg-muted/30 hover:bg-muted/70 border-border text-foreground'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">Mês Completo</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                  weekFilter === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                Todas
              </span>
            </div>
            <p className={`text-[11px] font-mono mt-0.5 ${weekFilter === 'all' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              01 a 30 Nov
            </p>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-semibold">
              <span className={`px-1 py-0.2 rounded ${weekFilter === 'all' ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'}`}>
                Extrato Geral
              </span>
            </div>
          </button>
        </div>

        {/* Filtros Auxiliares (Loja, Tipo e Busca) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Filtrar Loja</label>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-8 text-xs rounded-xl mt-1">
                <SelectValue placeholder="Concessionária" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Concessionárias</SelectItem>
                <SelectItem value="store-montesclaros">Montes Claros (Matriz)</SelectItem>
                <SelectItem value="store-divinopolis">Divinópolis (Filial)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Tipo de Operação</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs rounded-xl mt-1">
                <SelectValue placeholder="Operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Operações ({filteredRecords.length})</SelectItem>
                <SelectItem value="entrada">Apenas Entradas de Fábrica</SelectItem>
                <SelectItem value="emissao">Apenas NFs Faturadas (Vendas)</SelectItem>
                <SelectItem value="cancelamento">Apenas NFs Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar Operação</label>
            <div className="relative mt-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs rounded-xl"
                placeholder="Buscar por NF, cliente ou protocolo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Cards com Resumo Financeiro da SEMANA SELECIONADA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas de Fábrica na Semana */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Entradas da Fábrica
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-foreground">
              {formatCurrencyBRL(metrics.entradasValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-emerald-600 dark:text-emerald-400">{metrics.entradasCount} NFs de remessa</strong> na semana
            </p>
          </CardContent>
        </Card>

        {/* NFs Faturadas / Emitidas na Semana */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                NFs Faturadas (Vendas)
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-foreground">
              {formatCurrencyBRL(metrics.emissoesValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-blue-600 dark:text-blue-400">{metrics.emissoesCount} NFs emitidas</strong> na semana
            </p>
          </CardContent>
        </Card>

        {/* NFs Canceladas na Semana */}
        <Card className="rounded-2xl border shadow-xs bg-card border-destructive/30">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                NFs Canceladas na Semana
              </span>
              <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-destructive">
              {formatCurrencyBRL(metrics.cancelamentosValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-destructive">{metrics.cancelamentosCount} NFs canceladas</strong> nesta semana
            </p>
          </CardContent>
        </Card>

        {/* Estornos e Créditos da Semana */}
        <Card className="rounded-2xl border shadow-xs bg-card border-amber-500/30">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Estornos / Créditos a Receber
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-foreground">
              {formatCurrencyBRL(metrics.estornosValue + metrics.creditosValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {metrics.estornosValue > 0 && <span>Estorno: {formatCurrencyBRL(metrics.estornosValue)} • </span>}
              <span>Crédito Fábrica: {formatCurrencyBRL(metrics.creditosValue)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Tabela Executiva Detalhada da Semana */}
      <Card className="rounded-2xl border shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-primary" />
                Operações Fiscais da {currentWeekLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                {filteredRecords.length} lançamentos fiscais apurados com data de operação nesta semana.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold self-start sm:self-center">
              {weekFilter === 'all' ? 'Mês Completo' : weekFilter.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[550px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                <TableRow>
                  <TableHead className="text-xs">Operação</TableHead>
                  <TableHead className="text-xs">Número da NF</TableHead>
                  <TableHead className="text-xs">Data da Operação (Semana)</TableHead>
                  <TableHead className="text-xs">Emissão Original</TableHead>
                  <TableHead className="text-xs">Concessionária</TableHead>
                  <TableHead className="text-xs">Fornecedor / Cliente</TableHead>
                  <TableHead className="text-xs text-right">Valor Total</TableHead>
                  <TableHead className="text-xs">Tratamento Financeiro</TableHead>
                  <TableHead className="text-xs">Protocolo / Motivo</TableHead>
                  <TableHead className="text-xs text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-xs text-muted-foreground">
                      Carregando dados fiscais da semana...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-xs text-muted-foreground">
                      Nenhuma operação de NF registrada para {currentWeekLabel}.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => {
                    const isEntrada = r.fiscal_type === 'entrada';
                    const isCancel = r.fiscal_type === 'cancelamento';
                    const canCancel = r.fiscal_type === 'emissao' && r.status !== 'cancelada_posteriormente';

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/40">
                        {/* Tipo de Operação */}
                        <TableCell>
                          <Badge
                            className={`text-[10px] font-bold ${
                              isEntrada
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : isCancel
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {isEntrada ? 'ENTRADA FÁBRICA' : isCancel ? 'CANCELADA' : 'FATURADA'}
                          </Badge>
                        </TableCell>

                        {/* Número da NF */}
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {r.invoice_number}
                        </TableCell>

                        {/* Data da Operação nesta Semana */}
                        <TableCell className="text-xs">
                          <span className="font-semibold text-foreground">
                            {formatFiscalDate(r.event_date)}
                          </span>
                        </TableCell>

                        {/* Emissão Original */}
                        <TableCell className="text-xs text-muted-foreground">
                          {formatFiscalDate(r.issue_date)}
                        </TableCell>

                        {/* Concessionária */}
                        <TableCell className="text-xs font-medium">
                          {r.store_name}
                        </TableCell>

                        {/* Fornecedor / Destinatário */}
                        <TableCell className="text-xs max-w-[180px] truncate text-foreground font-medium">
                          {r.party_name}
                        </TableCell>

                        {/* Valor Total */}
                        <TableCell className="text-xs text-right font-bold font-mono">
                          <span className={isCancel ? 'text-destructive' : 'text-foreground'}>
                            {formatCurrencyBRL(r.total_value)}
                          </span>
                        </TableCell>

                        {/* Tratamento Financeiro */}
                        <TableCell className="text-xs">
                          {isCancel ? (
                            r.cancellation_type === 'credito' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" /> Crédito na Fábrica
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                                <RotateCcw className="w-3 h-3" /> Estorno a Receber
                              </span>
                            )
                          ) : isEntrada ? (
                            <span className="text-muted-foreground text-[11px]">Carga Recebida</span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Faturamento de Venda</span>
                          )}
                        </TableCell>

                        {/* Protocolo / Motivo */}
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {r.sefaz_protocol ? (
                            <span className="font-mono text-[10px] text-foreground font-semibold">
                              Prot: {r.sefaz_protocol}
                            </span>
                          ) : (
                            r.cancellation_reason || r.notes || '—'
                          )}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canModifyNf && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEdit(r)}
                                className="h-6 text-[10px] px-2 rounded-lg text-primary border-primary/30 hover:bg-primary/10 gap-1 font-semibold"
                                title="Editar dados desta NF"
                              >
                                <Pencil className="w-3 h-3" />
                                Editar
                              </Button>
                            )}
                            {canModifyNf && canCancel && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInvoiceToCancel(r);
                                  setCancellationDate(getLocalTodayDateString());
                                  setCancellationType('estorno');
                                  setCancellationReason('');
                                }}
                                className="h-6 text-[10px] px-2 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancelar NF
                              </Button>
                            )}
                            {isCancel ? (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                Cancelada
                              </Badge>
                            ) : !canModifyNf ? (
                              <span className="text-muted-foreground text-[10px]">Conferido</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* =================================================================== */}
      {/* MODAL 1: LANÇAR / REGISTRAR NOVA NF                                  */}
      {/* =================================================================== */}
      <Dialog open={isNewInvoiceModalOpen} onOpenChange={setIsNewInvoiceModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-primary" />
              Lançar Nota Fiscal no Controle Semanal
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione uma nova NF de entrada de fábrica ou de saída/faturamento para controle da diretoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de Operação</Label>
                <Select
                  value={newType}
                  onValueChange={(val: any) => {
                    setNewType(val);
                    if (val === 'entrada') setNewPartyName('Shineray do Brasil S.A.');
                    else setNewPartyName('');
                  }}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada de Fábrica (Remessa)</SelectItem>
                    <SelectItem value="emissao">Emissão / Faturamento (Venda)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Número da NF</Label>
                <Input
                  className="h-9 text-xs font-mono rounded-xl mt-1"
                  placeholder="Ex: 10450"
                  value={newInvoiceNumber}
                  onChange={(e) => setNewInvoiceNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Concessionária</Label>
                <Select value={newStoreId} onValueChange={setNewStoreId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store-montesclaros">Montes Claros (Matriz)</SelectItem>
                    <SelectItem value="store-divinopolis">Divinópolis (Filial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Operação (Semana)</Label>
                <Input
                  type="date"
                  className="h-9 text-xs rounded-xl mt-1"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">
                  {newType === 'entrada' ? 'Montadora / Fornecedor' : 'Nome do Cliente / Comprador'}
                </Label>
                <Input
                  className="h-9 text-xs rounded-xl mt-1"
                  placeholder={newType === 'entrada' ? 'Shineray do Brasil S.A.' : 'Nome do Cliente'}
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Total da NF (R$)</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="Ex: 18.990,00"
                  value={newTotalValue}
                  onChange={(e) => setNewTotalValue(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Protocolo SEFAZ / Chave (Opcional)</Label>
              <Input
                className="h-9 text-xs font-mono rounded-xl mt-1"
                placeholder="Ex: 312611009182399"
                value={newSefazProtocol}
                onChange={(e) => setNewSefazProtocol(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações / Detalhes do Lote</Label>
              <Textarea
                className="text-xs rounded-xl mt-1 resize-none"
                rows={2}
                placeholder="Ex: Lote com 10 motos SHI 175 e JET 125..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsNewInvoiceModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateInvoice} className="font-bold rounded-xl">
              Salvar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: CANCELAR NF (COM SELEÇÃO DE DATA, ESTORNO OU CRÉDITO)       */}
      {/* =================================================================== */}
      <Dialog open={!!invoiceToCancel} onOpenChange={(open) => !open && setInvoiceToCancel(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5 text-destructive" />
              Cancelar Nota Fiscal #{invoiceToCancel?.invoice_number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              O cancelamento não apaga a NF original emitida em {invoiceToCancel ? formatFiscalDate(invoiceToCancel.issue_date) : ''}. Ele registra a operação de cancelamento na semana indicada para controle de estorno ou crédito fiscal do dono.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor da NF:</span>
                <strong className="font-mono text-foreground">{formatCurrencyBRL(invoiceToCancel?.total_value || 0)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente / Destinatário:</span>
                <span className="font-semibold text-foreground">{invoiceToCancel?.party_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data da Emissão Original:</span>
                <span className="font-mono">{invoiceToCancel ? formatFiscalDate(invoiceToCancel.issue_date) : ''}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Data do Cancelamento (Semana de Apuração)</Label>
              <Input
                type="date"
                className="h-9 text-xs rounded-xl mt-1"
                value={cancellationDate}
                onChange={(e) => setCancellationDate(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Esta data define em qual semana o dono receberá o estorno ou crédito fiscal.
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold">Tratamento Financeiro do Dono</Label>
              <Select value={cancellationType} onValueChange={(val: any) => setCancellationType(val)}>
                <SelectTrigger className="h-9 text-xs font-semibold rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estorno">Estorno Financeiro a Receber (Devolução de Dinheiro)</SelectItem>
                  <SelectItem value="credito">Crédito Fiscal na Fábrica (Abatimento em Compras)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Motivo do Cancelamento</Label>
              <Textarea
                className="text-xs rounded-xl mt-1 resize-none"
                rows={2}
                placeholder="Ex: Financiamento recusado na vistoria de entrega, desistência do cliente..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Protocolo SEFAZ de Cancelamento (Opcional)</Label>
              <Input
                className="h-9 text-xs font-mono rounded-xl mt-1"
                placeholder="Ex: 312611009999001"
                value={cancellationProtocol}
                onChange={(e) => setCancellationProtocol(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInvoiceToCancel(null)} className="rounded-xl">
              Voltar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmCancellation} className="font-bold rounded-xl">
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: EDIÇÃO DE NF NO PAINEL DIRETOR                             */}
      {/* =================================================================== */}
      <Dialog open={Boolean(editingRecord)} onOpenChange={(v) => { if (!v) setEditingRecord(null); }}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Dados da Nota Fiscal Nº {editInvoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atualize as informações contábeis, loja, data, cliente e valores desta NF diretamente pelo Painel Diretor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Número da NF *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="Ex: 10450"
                  value={editInvoiceNumber}
                  onChange={(e) => setEditInvoiceNumber(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Operação / Emissão *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs rounded-xl mt-1"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Concessionária *</Label>
                <Select value={editStoreId} onValueChange={(val) => setEditStoreId(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store-montesclaros">Concessionária Montes Claros (MOC)</SelectItem>
                    <SelectItem value="store-divinopolis">Concessionária Divinópolis (DIV)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Total (R$) *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="R$ 0,00"
                  value={editTotalValue}
                  onChange={(e) => setEditTotalValue(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Cliente / Fornecedor / Destinatário *</Label>
              <Input
                className="h-9 text-xs rounded-xl mt-1"
                placeholder="Ex: Nome do cliente ou Shineray do Brasil"
                value={editPartyName}
                onChange={(e) => setEditPartyName(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Protocolo SEFAZ (Opcional)</Label>
              <Input
                className="h-9 text-xs font-mono rounded-xl mt-1"
                placeholder="Ex: 312611000000001"
                value={editSefazProtocol}
                onChange={(e) => setEditSefazProtocol(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações Fiscais</Label>
              <Textarea
                className="text-xs rounded-xl mt-1 resize-none"
                rows={2}
                placeholder="Observações complementares ou dados do veículo..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingRecord(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveEdit} className="font-bold rounded-xl gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Salvar Alterações da NF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
