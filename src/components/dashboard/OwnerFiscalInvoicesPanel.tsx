import { useState, useMemo, useRef } from 'react';
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
  Sparkles,
  Plus,
  Search,
  Building2,
  AlertTriangle,
  DollarSign,
  Pencil,
  Upload,
  Eye,
  Paperclip,
  FileCheck,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  Trash2,
  ArrowRight,
  LayoutGrid,
  List,
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
import { useInvoices, useCancelInvoice, useUpsertInvoice, useDeleteInvoice, Invoice } from '@/hooks/useInvoices';
import { useStores } from '@/hooks/useStores';
import {
  STORE_DIVINOPOLIS_UUID,
  STORE_MONTESCLAROS_UUID,
  STORE_MONTESCLAROS_MULTIMARCAS_UUID,
  formatStoreShortName,
  isMatchingStore,
  getContractPrefix,
} from '@/lib/storeResolution';
import {
  useDealershipScope,
  DealershipBadge,
  resolveStoreToKey,
} from '@/contexts/DealershipScopeContext';
import { DealershipSegmentedBar } from '@/components/common/DealershipSegmentedBar';
import { useToast } from '@/hooks/use-toast';
import { exportToXLSX } from '@/lib/export';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { formatFiscalDate, getLocalTodayDateString } from '@/lib/fiscalDates';
import { useAuth } from '@/contexts/AuthContext';
import { parseInvoiceFile } from '@/lib/invoiceFileParser';
import { parseFlexibleCurrency, formatBrlNumber, maskCurrency } from '@/lib/masks';
import { saveAttachmentToIdb, getAttachmentFromIdb, safeSaveToLocalStorage, cleanLocalStorageBloat } from '@/lib/invoiceAttachmentStorage';
import { cloudSaveInvoice } from '@/lib/cloudSalesSync';
import { InvoiceDraftGeneratorDialog } from '@/components/dashboard/InvoiceDraftGeneratorDialog';
import { cn } from '@/lib/utils';

export interface CombinedFiscalRecord {
  id: string;
  invoice_number: string;
  fiscal_type: 'entrada' | 'emissao' | 'cancelamento';
  store_id: string;
  store_name: string;
  party_name: string;
  party_doc?: string;
  issue_date: string;
  event_date: string; // Data da entrada, da emissão ou do cancelamento naquela semana
  original_issue_date?: string;
  cancellation_date?: string;
  total_value: number;
  original_value?: number;
  value_difference?: number;
  status: string;
  cancellation_reason?: string;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao';
  sefaz_protocol?: string;
  reissued_as_invoice_number?: string;
  reissue_of_invoice_number?: string;
  notes?: string;
  rawInvoiceId?: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
}

export interface InvoiceLifecycleData {
  originalNumber: string;
  originalIssueDate: string;
  originalValue: number;
  isCancelled: boolean;
  cancellationDate?: string;
  cancellationReason?: string;
  sefazProtocol?: string;
  cancellationType?: string;
  hasReissue: boolean;
  isReissueChild: boolean;
  isReissueParent: boolean;
  reissuedAsNumber?: string;
  reissuedAsDate?: string;
  reissuedAsStatus?: string;
  reissuedAsValue?: number;
  valueDifference: number;
  reissuedFromNumber?: string;
  reissuedFromDate?: string;
  reissuedFromCancellationDate?: string;
}

export function computeInvoiceLifecycle(
  r: CombinedFiscalRecord,
  allRecords: CombinedFiscalRecord[]
): InvoiceLifecycleData {
  const isCancelled = r.fiscal_type === 'cancelamento' || r.status === 'cancelada';
  const originalIssueDate = r.original_issue_date || r.issue_date || r.event_date;

  // Se esta NF foi cancelada e substituída por outra (Reissue Parent)
  const reissuedAsNumber = r.reissued_as_invoice_number;
  let reissuedAsDate: string | undefined = undefined;
  let reissuedAsStatus: string | undefined = undefined;
  let child: CombinedFiscalRecord | undefined = undefined;

  if (reissuedAsNumber) {
    child = allRecords.find(
      (c) => c.invoice_number === reissuedAsNumber && (c.store_id === r.store_id || !c.store_id || !r.store_id)
    );
    if (child) {
      reissuedAsDate = child.issue_date || child.event_date;
      reissuedAsStatus = child.status === 'cancelada' ? 'Cancelada' : 'Faturada / Ativa';
    } else {
      reissuedAsDate = r.event_date || r.issue_date;
      reissuedAsStatus = 'Faturada / Ativa';
    }
  }

  // Se esta NF É a reemissão gerada a partir de uma NF anterior (Reissue Child)
  const reissuedFromNumber = r.reissue_of_invoice_number;
  let reissuedFromDate: string | undefined = undefined;
  let reissuedFromCancellationDate: string | undefined = undefined;
  let parent: CombinedFiscalRecord | undefined = undefined;

  if (reissuedFromNumber) {
    parent = allRecords.find(
      (p) => p.invoice_number === reissuedFromNumber && (p.store_id === r.store_id || !p.store_id || !r.store_id)
    );
    if (parent) {
      reissuedFromDate = parent.original_issue_date || parent.issue_date || parent.event_date;
      reissuedFromCancellationDate = parent.cancellation_date || parent.event_date;
    }
  }

  const isReissueParent = Boolean(reissuedAsNumber);
  const isReissueChild = Boolean(reissuedFromNumber);
  const hasReissue = isReissueParent || isReissueChild;

  const effectiveOrigDate = isReissueChild
    ? (r.original_issue_date || reissuedFromDate || originalIssueDate)
    : originalIssueDate;

  const effectiveCancDate = r.cancellation_date || (isCancelled ? (r.event_date || r.issue_date) : (reissuedFromCancellationDate || r.event_date));

  const originalVal = isReissueChild
    ? (r.original_value || (parent ? parent.total_value : r.total_value))
    : (r.original_value || r.total_value);
  const reissuedAsVal = isReissueChild
    ? r.total_value
    : (reissuedAsNumber ? (child ? child.total_value : r.total_value) : r.total_value);
  const valueDifference = hasReissue ? (reissuedAsVal - originalVal) : (r.value_difference || 0);

  return {
    originalNumber: isReissueChild && reissuedFromNumber ? reissuedFromNumber : r.invoice_number,
    originalIssueDate: effectiveOrigDate,
    originalValue: originalVal,
    isCancelled: isCancelled || isReissueParent || Boolean(isReissueChild && effectiveCancDate),
    cancellationDate: effectiveCancDate,
    cancellationReason: r.cancellation_reason || (isReissueParent ? 'Cancelada para substituição e reemissão de nova NF' : (isReissueChild ? 'Cancelada para reemissão (Substituição de NF)' : undefined)),
    sefazProtocol: r.sefaz_protocol,
    cancellationType: r.cancellation_type,
    hasReissue,
    isReissueChild,
    isReissueParent,
    reissuedAsNumber: isReissueChild ? r.invoice_number : reissuedAsNumber,
    reissuedAsDate: isReissueChild ? (r.issue_date || r.event_date) : reissuedAsDate,
    reissuedAsStatus: isReissueChild ? (r.status === 'cancelada' ? 'Cancelada' : 'Faturada / Ativa') : reissuedAsStatus,
    reissuedAsValue: reissuedAsVal,
    valueDifference,
    reissuedFromNumber,
    reissuedFromDate,
    reissuedFromCancellationDate,
  };
}

export const WEEKS_CONFIG = [
  { key: 'sem_1', label: 'Semana 1', range: '01 a 07 Nov', days: [1, 7] },
  { key: 'sem_2', label: 'Semana 2', range: '08 a 14 Nov', days: [8, 14] },
  { key: 'sem_3', label: 'Semana 3', range: '15 a 21 Nov', days: [15, 21] },
  { key: 'sem_4', label: 'Semana 4', range: '22 a 28 Nov', days: [22, 28], isCurrent: true },
  { key: 'sem_5', label: 'Semana 5', range: '29 a 30 Nov', days: [29, 31] },
];

const HISTORY_PREFIX = '[Hist] ';

/** Retorna as linhas de histórico (cancelamentos/reemissões sucessivas) gravadas nas observações da NF. */
export function extractHistoryLines(notes?: string | null): string[] {
  return String(notes || '')
    .split('\n')
    .filter((l) => l.startsWith(HISTORY_PREFIX))
    .map((l) => l.slice(HISTORY_PREFIX.length).trim())
    .filter(Boolean);
}

/** Acrescenta uma linha de histórico preservando a observação principal e todo o histórico anterior. */
export function appendHistoryLine(notes: string | null | undefined, line: string): string {
  const base = String(notes || '').trimEnd();
  return `${base}${base ? '\n' : ''}${HISTORY_PREFIX}${line}`;
}

function getWeekKeyForDate(dateStr?: string): string {
  const day = dateStr ? parseInt(String(dateStr).slice(8, 10), 10) : new Date().getDate();
  if (!Number.isFinite(day) || day < 1) return 'all';
  if (day <= 7) return 'sem_1';
  if (day <= 14) return 'sem_2';
  if (day <= 21) return 'sem_3';
  if (day <= 28) return 'sem_4';
  return 'sem_5';
}

export function normalizeStoreId(storeId?: string | null): string {
  if (!storeId) return STORE_DIVINOPOLIS_UUID;
  const s = String(storeId).toLowerCase().trim();
  if (
    s === STORE_MONTESCLAROS_MULTIMARCAS_UUID.toLowerCase() ||
    s === 'store-multimarcas' ||
    s.includes('multimarcas') ||
    s.includes('multi marcas') ||
    s.includes('seminovos')
  ) {
    return STORE_MONTESCLAROS_MULTIMARCAS_UUID;
  }
  if (s.includes('montes') || s === STORE_MONTESCLAROS_UUID.toLowerCase() || s === 'store-montesclaros' || s.includes('moc')) {
    return STORE_MONTESCLAROS_UUID;
  }
  if (s.includes('divin') || s === STORE_DIVINOPOLIS_UUID.toLowerCase() || s === 'store-divinopolis' || s.includes('matriz')) {
    return STORE_DIVINOPOLIS_UUID;
  }
  return storeId;
}

export function cleanFakeFiscalInvoices(): void {
  try {
    cleanLocalStorageBloat();
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
        safeSaveToLocalStorage(storageKey, cleaned);
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
  const deleteInvoiceMutation = useDeleteInvoice();
  const dealershipScope = useDealershipScope();

  // Foco semanal: inicia automaticamente na semana da data atual
  const [weekFilter, setWeekFilter] = useState<string>(() => getWeekKeyForDate(getLocalTodayDateString()));
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedLifecycleRecord, setSelectedLifecycleRecord] = useState<CombinedFiscalRecord | null>(null);

  // Modais de Controle
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isDraftPdfModalOpen, setIsDraftPdfModalOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<CombinedFiscalRecord | null>(null);
  const [cancelModalMode, setCancelModalMode] = useState<'cancel' | 'reissue'>('cancel');
  const [invoiceToDelete, setInvoiceToDelete] = useState<CombinedFiscalRecord | null>(null);

  const resetNewInvoiceForm = () => {
    setNewType('entrada');
    setNewInvoiceNumber('');
    setNewStoreId(STORE_MONTESCLAROS_UUID);
    setNewEventDate(getLocalTodayDateString());
    setNewPartyName('Shineray do Brasil S.A.');
    setNewTotalValue('');
    setNewSefazProtocol('');
    setNewNotes('');
    setAttachedFile(null);
    setParsedBannerInfo(null);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewTypeChange = (val: 'entrada' | 'emissao') => {
    setNewType(val);
    if (val === 'entrada') {
      if (!newPartyName.trim()) setNewPartyName('Shineray do Brasil S.A.');
    } else if (newPartyName.trim() === 'Shineray do Brasil S.A.') {
      setNewPartyName('');
    }
  };

  // Formulário de Nova NF (Data padrão sempre hoje, com livre alteração pelo usuário)
  const [newType, setNewType] = useState<'entrada' | 'emissao'>('entrada');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newStoreId, setNewStoreId] = useState(STORE_MONTESCLAROS_UUID);
  const [newEventDate, setNewEventDate] = useState(getLocalTodayDateString());
  const [newPartyName, setNewPartyName] = useState('Shineray do Brasil S.A.');
  const [newTotalValue, setNewTotalValue] = useState('');
  const [newSefazProtocol, setNewSefazProtocol] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Anexo & Auto-Leitura de Arquivo da Nova NF
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedBannerInfo, setParsedBannerInfo] = useState<{
    invoice_number?: string;
    sefaz_protocol?: string;
    chassis?: string;
    total_value?: number;
    customer_name?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulário de Cancelamento
  const [cancellationDate, setCancellationDate] = useState(getLocalTodayDateString());
  const [cancellationType, setCancellationType] = useState<'estorno' | 'credito'>('estorno');
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationProtocol, setCancellationProtocol] = useState('');

  // Cancelamento & Reemissão de NF (Substituição no mesmo plano com Livre Alteração de Valor)
  const [invoiceToReissue, setInvoiceToReissue] = useState<CombinedFiscalRecord | null>(null);
  const [reissueNewNumber, setReissueNewNumber] = useState('');
  const [reissueNewValue, setReissueNewValue] = useState('');
  const [reissueNewDate, setReissueNewDate] = useState(getLocalTodayDateString());
  const [reissueCancelDate, setReissueCancelDate] = useState(getLocalTodayDateString());
  const [reissueProtocol, setReissueProtocol] = useState('');
  const [reissueReason, setReissueReason] = useState('Cancelada para reemissão (Substituição de NF)');
  const [reissueAttachment, setReissueAttachment] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);

  const activeCancelOrReissueTarget = invoiceToReissue || invoiceToCancel;
  const reissueParsedNewVal = parseFlexibleCurrency(reissueNewValue) || 0;
  const reissueOriginalVal = activeCancelOrReissueTarget?.original_value || activeCancelOrReissueTarget?.total_value || 0;
  const reissueDifference = reissueParsedNewVal > 0 ? (reissueParsedNewVal - reissueOriginalVal) : 0;
  const [reissueIsReadingFile, setReissueIsReadingFile] = useState(false);
  const [isSubmittingReissue, setIsSubmittingReissue] = useState(false);
  const reissueFileInputRef = useRef<HTMLInputElement>(null);

  // Formulário de Edição de NF da Diretoria
  const [editingRecord, setEditingRecord] = useState<CombinedFiscalRecord | null>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editStoreId, setEditStoreId] = useState(STORE_MONTESCLAROS_UUID);
  const [editEventDate, setEditEventDate] = useState(getLocalTodayDateString());
  const [editCancellationDate, setEditCancellationDate] = useState('');
  const [editPartyName, setEditPartyName] = useState('');
  const [editTotalValue, setEditTotalValue] = useState('');
  const [editSefazProtocol, setEditSefazProtocol] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAttachedFile, setEditAttachedFile] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);
  const [editIsReadingFile, setEditIsReadingFile] = useState(false);
  const [editIsDragging, setEditIsDragging] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Modal de Visualização de Arquivo Oficial
  const [viewingAttachment, setViewingAttachment] = useState<{
    name: string;
    url: string;
    invoiceNumber: string;
    customerName: string;
    type?: string;
  } | null>(null);

  // Modal de Anexação Rápida Direto na Linha da Tabela
  const [quickAttachRecord, setQuickAttachRecord] = useState<CombinedFiscalRecord | null>(null);
  const [quickAttachFile, setQuickAttachFile] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);
  const [quickAttachDialogOpen, setQuickAttachDialogOpen] = useState(false);
  const [quickAttachIsReading, setQuickAttachIsReading] = useState(false);
  const quickAttachFileInputRef = useRef<HTMLInputElement>(null);

  // Estados de resposta instantânea / loading dos botões de ação
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSubmittingQuickAttach, setIsSubmittingQuickAttach] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Processa arquivo da Nova NF (XML ou PDF) com auto-preenchimento
  const processFileAttachment = async (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido para o anexo da NF é de 25MB.',
      });
      return;
    }

    setIsReadingFile(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const mimeType = file.type || (file.name.endsWith('.xml') ? 'text/xml' : 'application/pdf');

      setAttachedFile({
        name: file.name,
        url: dataUrl,
        size: file.size,
        type: mimeType,
      });

      const parsed = await parseInvoiceFile(file);

      if (parsed.fiscal_type) setNewType(parsed.fiscal_type);
      if (parsed.invoice_number) setNewInvoiceNumber(parsed.invoice_number);
      if (parsed.sefaz_protocol) setNewSefazProtocol(parsed.sefaz_protocol);
      if (parsed.customer_name) setNewPartyName(parsed.customer_name);
      if (parsed.store_id) setNewStoreId(normalizeStoreId(parsed.store_id));
      if (parsed.issue_date) setNewEventDate(parsed.issue_date);
      if (parsed.total_value !== undefined && parsed.total_value > 0) {
        setNewTotalValue(formatBrlNumber(parsed.total_value));
      }
      if (parsed.vehicle_model || parsed.vehicle_chassis) {
        const extraNote = `${parsed.vehicle_brand || 'SHINERAY'} ${parsed.vehicle_model || ''}${parsed.vehicle_chassis ? ` - Chassi: ${parsed.vehicle_chassis}` : ''}`.trim();
        setNewNotes((prev) => (prev && !prev.includes(extraNote) ? `${prev} | ${extraNote}` : extraNote));
      }

      setParsedBannerInfo({
        invoice_number: parsed.invoice_number,
        sefaz_protocol: parsed.sefaz_protocol,
        chassis: parsed.vehicle_chassis,
        total_value: parsed.total_value,
        customer_name: parsed.customer_name,
      });

      const filled = [
        parsed.invoice_number ? `Nº ${parsed.invoice_number}` : null,
        parsed.issue_date ? `Data ${formatFiscalDate(parsed.issue_date)}` : null,
        parsed.customer_name ? `Parte: ${parsed.customer_name}` : null,
        parsed.total_value ? `R$ ${formatBrlNumber(parsed.total_value)}` : null,
        parsed.sefaz_protocol ? `Protocolo ${parsed.sefaz_protocol}` : null,
        parsed.vehicle_chassis ? `Chassi ${parsed.vehicle_chassis}` : null,
      ].filter(Boolean);

      if (filled.length > 0) {
        toast({
          title: parsed.used_ocr
            ? 'Leitura da NF concluída (OCR)!'
            : 'Dados extraídos do arquivo da NF!',
          description: `${filled.join(' • ')} preenchidos automaticamente.`,
        });
      } else {
        toast({
          title: 'Arquivo anexado sem campos legíveis',
          description: 'O PDF/arquivo foi anexado, mas não encontramos texto fiscal estruturado. Revise e preencha os campos manualmente.',
        });
      }
    } catch (err: any) {
      console.warn('Erro ao processar arquivo da NF:', err);
      toast({
        title: 'Arquivo anexado',
        description: `${file.name} carregado. Preencha os campos fiscais manualmente se necessário.`,
      });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleNewFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileAttachment(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setParsedBannerInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Processa arquivo da Edição de NF
  const processEditFileAttachment = async (file: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido para o anexo é de 25MB.',
      });
      return;
    }

    setEditIsReadingFile(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const mimeType = file.type || (file.name.endsWith('.xml') ? 'text/xml' : 'application/pdf');

      setEditAttachedFile({
        name: file.name,
        url: dataUrl,
        size: file.size,
        type: mimeType,
      });

      const parsed = await parseInvoiceFile(file);
      if (parsed.invoice_number && !editInvoiceNumber.trim()) setEditInvoiceNumber(parsed.invoice_number);
      if (parsed.sefaz_protocol && !editSefazProtocol.trim()) setEditSefazProtocol(parsed.sefaz_protocol);
      if (parsed.customer_name && !editPartyName.trim()) setEditPartyName(parsed.customer_name);
      if (parsed.issue_date && !editEventDate) setEditEventDate(parsed.issue_date);
      if (parsed.total_value !== undefined && parsed.total_value > 0 && !editTotalValue.trim()) {
        setEditTotalValue(formatBrlNumber(parsed.total_value));
      }
      toast({
        title: 'Arquivo vinculado à NF',
        description: `${file.name} anexado com sucesso.`,
      });
    } catch (err) {
      console.warn('Erro ao ler anexo de edição:', err);
    } finally {
      setEditIsReadingFile(false);
    }
  };

  // Visualização e Download de Anexo
  const handleOpenAttachment = async (record: CombinedFiscalRecord) => {
    let url = record.attachment_url;
    if (!url) return;
    if (url.startsWith('idb:')) {
      const idbFile = await getAttachmentFromIdb(url, record.rawInvoiceId || record.id);
      if (idbFile?.url) {
        url = idbFile.url;
      }
    }
    setViewingAttachment({
      name: record.attachment_name || `NF_${record.invoice_number}.pdf`,
      url,
      invoiceNumber: record.invoice_number,
      customerName: record.party_name,
      type: record.attachment_type || (record.attachment_name?.endsWith('.xml') ? 'text/xml' : 'application/pdf'),
    });
  };

  const handleDownloadAttachment = async (record: CombinedFiscalRecord) => {
    let url = record.attachment_url;
    if (!url) return;
    if (url.startsWith('idb:')) {
      const idbFile = await getAttachmentFromIdb(url, record.rawInvoiceId || record.id);
      if (idbFile?.url) {
        url = idbFile.url;
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = record.attachment_name || `NF_${record.invoice_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Salvar Anexo Rápido vindo da Tabela
  const handleSaveQuickAttach = async () => {
    if (!quickAttachRecord || !quickAttachFile) return;

    setIsSubmittingQuickAttach(true);
    try {
      let finalUrl = quickAttachFile.url;
      if (finalUrl.startsWith('data:')) {
        try {
          finalUrl = await saveAttachmentToIdb(
            `inv_${quickAttachRecord.invoice_number}_${Date.now()}`,
            quickAttachFile.name,
            quickAttachFile.url,
            quickAttachFile.type,
            quickAttachFile.size
          );
        } catch (e) {
          console.warn('Falha ao salvar no IDB:', e);
        }
      }

      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];
      let foundInLocal = false;
      list = list.map((item: any) => {
        if (item.id === quickAttachRecord.id || item.invoice_number === quickAttachRecord.invoice_number) {
          foundInLocal = true;
          return {
            ...item,
            attachment_name: quickAttachFile.name,
            attachment_url: finalUrl,
            attachment_size: quickAttachFile.size,
            attachment_type: quickAttachFile.type,
          };
        }
        return item;
      });
      if (!foundInLocal) {
        list.unshift({
          id: quickAttachRecord.id,
          invoice_number: quickAttachRecord.invoice_number,
          fiscal_type: quickAttachRecord.fiscal_type,
          store_id: quickAttachRecord.store_id,
          store_name: quickAttachRecord.store_name,
          issue_date: quickAttachRecord.issue_date,
          entry_or_cancel_date: quickAttachRecord.event_date,
          party_name: quickAttachRecord.party_name,
          total_value: quickAttachRecord.total_value,
          sefaz_protocol: quickAttachRecord.sefaz_protocol,
          status: quickAttachRecord.status,
          notes: quickAttachRecord.notes,
          attachment_name: quickAttachFile.name,
          attachment_url: finalUrl,
          attachment_size: quickAttachFile.size,
          attachment_type: quickAttachFile.type,
        });
      }
      safeSaveToLocalStorage(storageKey, list);

      const rawInv = invoices.find((x) => x.id === quickAttachRecord.rawInvoiceId || x.invoice_number === quickAttachRecord.invoice_number);
      const invId = rawInv?.id || (quickAttachRecord.rawInvoiceId && !quickAttachRecord.rawInvoiceId.startsWith('loc-') ? quickAttachRecord.rawInvoiceId : undefined);

      const payload = {
        id: invId,
        invoice_number: quickAttachRecord.invoice_number,
        invoice_type: quickAttachRecord.fiscal_type,
        issue_date: quickAttachRecord.event_date || quickAttachRecord.issue_date,
        store_id: quickAttachRecord.store_id,
        store_name: quickAttachRecord.store_name,
        customer_name: quickAttachRecord.party_name,
        total_value: quickAttachRecord.total_value,
        total: quickAttachRecord.total_value,
        subtotal: quickAttachRecord.total_value,
        sefaz_protocol: quickAttachRecord.sefaz_protocol,
        status: rawInv?.status || (quickAttachRecord.fiscal_type === 'cancelamento' ? 'cancelada' : 'emitida'),
        attachment_name: quickAttachFile.name,
        attachment_url: finalUrl,
        attachment_size: quickAttachFile.size,
        attachment_type: quickAttachFile.type,
      };

      // Resposta instantânea (0ms): fecha modal e atualiza interface sem bloquear o usuário
      const invoiceNumberAttached = quickAttachRecord.invoice_number;
      setQuickAttachDialogOpen(false);
      setQuickAttachRecord(null);
      setQuickAttachFile(null);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));

      toast({
        title: 'Anexo Vinculado com Sucesso!',
        description: `Arquivo vinculado à NF Nº ${invoiceNumberAttached}.`,
      });

      // Sincronização em nuvem em segundo plano
      void upsertInvoiceMutation.mutateAsync(payload);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao anexar arquivo',
        description: err?.message,
      });
    } finally {
      setIsSubmittingQuickAttach(false);
    }
  };

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
    setEditStoreId(normalizeStoreId(r.store_id));
    setEditEventDate(r.event_date || r.issue_date || getLocalTodayDateString());
    setEditCancellationDate(r.cancellation_date || (r.status === 'cancelada' || r.fiscal_type === 'cancelamento' ? (r.event_date || r.issue_date) : ''));
    setEditPartyName(r.party_name || '');
    setEditTotalValue(r.total_value ? formatBrlNumber(r.total_value) : '');
    setEditSefazProtocol(r.sefaz_protocol || '');
    setEditNotes(r.notes || '');

    if (r.attachment_url) {
      setEditAttachedFile({
        name: r.attachment_name || `NF_${r.invoice_number}.pdf`,
        url: r.attachment_url,
        size: r.attachment_size || 0,
        type: r.attachment_type || 'application/pdf',
      });
    } else {
      setEditAttachedFile(null);
    }
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
    const val = parseFlexibleCurrency(editTotalValue);
    if (val <= 0) {
      toast({ variant: 'destructive', title: 'Valor inválido', description: 'Informe o valor total da NF.' });
      return;
    }

    setIsSubmittingEdit(true);
    try {
      let finalAttachmentUrl = editAttachedFile?.url;
      if (editAttachedFile?.url && editAttachedFile.url.startsWith('data:')) {
        try {
          finalAttachmentUrl = await saveAttachmentToIdb(
            `inv_edit_${editInvoiceNumber.trim()}_${Date.now()}`,
            editAttachedFile.name,
            editAttachedFile.url,
            editAttachedFile.type,
            editAttachedFile.size
          );
        } catch (e) {
          console.warn('Falha ao salvar no IDB:', e);
        }
      }

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
            store_id: normalizeStoreId(editStoreId),
            issue_date: editEventDate,
            entry_or_cancel_date: editEventDate,
            cancellation_date: editCancellationDate.trim() || item.cancellation_date || undefined,
            party_name: editPartyName.trim(),
            total_value: val,
            total: val,
            subtotal: val,
            sefaz_protocol: editSefazProtocol.trim(),
            notes: editNotes.trim(),
            attachment_name: editAttachedFile?.name,
            attachment_url: finalAttachmentUrl,
            attachment_size: editAttachedFile?.size,
            attachment_type: editAttachedFile?.type,
          };
        }
        return item;
      });
      safeSaveToLocalStorage(storageKey, list);

      const resolvedStoreId = normalizeStoreId(editStoreId);
      const rawInv = invoices.find((x) => x.id === editingRecord.rawInvoiceId || x.invoice_number === editingRecord.invoice_number);
      const storeObj = stores.find((s) => s.id === resolvedStoreId);
      const storeName = storeObj?.name || (resolvedStoreId === STORE_MONTESCLAROS_UUID ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis');

      const editPayload = {
        id: editingRecord.rawInvoiceId && !editingRecord.rawInvoiceId.startsWith('loc-') ? editingRecord.rawInvoiceId : rawInv?.id,
        invoice_number: editInvoiceNumber.trim(),
        fiscal_type: editingRecord.fiscal_type,
        issue_date: editEventDate,
        entry_or_cancel_date: editEventDate,
        cancellation_date: editCancellationDate.trim() || editingRecord.cancellation_date || undefined,
        store_id: resolvedStoreId,
        store_name: storeName,
        customer_name: editPartyName.trim(),
        party_name: editPartyName.trim(),
        total_value: val,
        total: val,
        subtotal: val,
        sefaz_protocol: editSefazProtocol.trim(),
        notes: editNotes.trim(),
        status: rawInv?.status || (editingRecord.fiscal_type === 'cancelamento' ? 'cancelada' : 'emitida'),
        created_at: rawInv?.created_at,
        sale_id: rawInv?.sale_id,
        contract_number: rawInv?.contract_number,
        attachment_name: editAttachedFile?.name,
        attachment_url: finalAttachmentUrl,
        attachment_size: editAttachedFile?.size,
        attachment_type: editAttachedFile?.type,
      };

      // Resposta instantânea (0ms): fecha modal e notifica UI imediatamente
      const updatedNum = editInvoiceNumber;
      setEditingRecord(null);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));

      toast({
        title: 'NF Atualizada com Sucesso!',
        description: `Dados da NF ${updatedNum} atualizados no painel da diretoria.`,
      });

      // Sincronização em nuvem em segundo plano
      void upsertInvoiceMutation.mutateAsync(editPayload);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar alterações da NF', description: err?.message });
    } finally {
      setIsSubmittingEdit(false);
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

      const reissuedAs = (inv as any).reissued_as_invoice_number || (inv as any).items?.reissued_as_invoice_number || (inv.notes || '').match(/Substituída pela NF\s*([0-9.]+)/i)?.[1];
      const reissueOf = (inv as any).reissue_of_invoice_number || (inv as any).items?.reissue_of_invoice_number || (inv.notes || '').match(/Reemissão.*NF\s*([0-9.]+)/i)?.[1];

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
          attachment_url: inv.attachment_url,
          attachment_name: inv.attachment_name,
          attachment_type: inv.attachment_type,
          attachment_size: inv.attachment_size,
        });
        return;
      }

      // Se foi cancelada, mantém APENAS 1 registro com status cancelada no mesmo plano
      if (isCancelada) {
        const cancelDate = inv.cancellation_date || inv.issue_date || inv.created_at?.slice(0, 10) || '';
        recordsList.push({
          id: `inv-${inv.id}`,
          invoice_number: inv.invoice_number,
          fiscal_type: 'cancelamento',
          store_id: inv.store_id || '',
          store_name: storeName,
          party_name: inv.customer_name || 'Consumidor Final',
          issue_date: issueDate,
          original_issue_date: (inv as any).original_issue_date || issueDate,
          event_date: cancelDate,
          cancellation_date: cancelDate,
          total_value: Number(inv.total) || 0,
          original_value: (inv as any).original_value || Number(inv.total) || 0,
          value_difference: (inv as any).value_difference || 0,
          status: 'cancelada',
          cancellation_reason: inv.cancellation_reason || inv.notes || 'Cancelamento registrado',
          cancellation_type: inv.cancellation_type || 'estorno',
          sefaz_protocol: inv.sefaz_protocol || '',
          reissued_as_invoice_number: reissuedAs,
          reissue_of_invoice_number: reissueOf,
          notes: inv.notes || '',
          rawInvoiceId: inv.id,
          attachment_url: inv.attachment_url,
          attachment_name: inv.attachment_name,
          attachment_type: inv.attachment_type,
          attachment_size: inv.attachment_size,
        });
      } else {
        // Emissão ativa
        recordsList.push({
          id: `inv-${inv.id}`,
          invoice_number: inv.invoice_number,
          fiscal_type: 'emissao',
          store_id: inv.store_id || '',
          store_name: storeName,
          party_name: inv.customer_name || 'Consumidor Final',
          issue_date: issueDate,
          original_issue_date: (inv as any).original_issue_date || issueDate,
          event_date: issueDate,
          cancellation_date: inv.cancellation_date || undefined,
          cancellation_reason: inv.cancellation_reason || undefined,
          cancellation_type: inv.cancellation_type || undefined,
          total_value: Number(inv.total) || 0,
          original_value: (inv as any).original_value || Number(inv.total) || 0,
          value_difference: (inv as any).value_difference || 0,
          status: 'emitida',
          sefaz_protocol: inv.sefaz_protocol || '',
          reissued_as_invoice_number: reissuedAs,
          reissue_of_invoice_number: reissueOf,
          notes: inv.notes || '',
          rawInvoiceId: inv.id,
          attachment_url: inv.attachment_url,
          attachment_name: inv.attachment_name,
          attachment_type: inv.attachment_type,
          attachment_size: inv.attachment_size,
        });
      }
    });

    // 2. Processa Registros Locais (inclusões do usuário com deduplicação inteligente)
    localRecords.forEach((loc: any) => {
      const storeName = stores.find((s) => s.id === loc.store_id)?.name || (loc.store_id?.includes('montes') ? 'Montes Claros' : 'Divinópolis');
      const isEntrada = loc.fiscal_type === 'entrada';
      const isCancel = loc.fiscal_type === 'cancelamento' || loc.status === 'cancelada';

      const issueDate = loc.issue_date || loc.entry_or_cancel_date || loc.created_at?.slice(0, 10) || '';
      const eventDate = loc.entry_or_cancel_date || loc.event_date || loc.issue_date || loc.created_at?.slice(0, 10) || '';
      const reissuedAs = loc.reissued_as_invoice_number || (loc.notes || '').match(/Substituída pela NF\s*([0-9.]+)/i)?.[1];
      const reissueOf = loc.reissue_of_invoice_number || (loc.notes || '').match(/Reemissão.*NF\s*([0-9.]+)/i)?.[1];

      const existingIdx = recordsList.findIndex(
        (r) =>
          r.invoice_number === loc.invoice_number &&
          (isEntrada ? r.fiscal_type === 'entrada' : r.fiscal_type !== 'entrada')
      );

      if (existingIdx >= 0) {
        const existing = recordsList[existingIdx];
        recordsList[existingIdx] = {
          ...existing,
          ...loc,
          id: existing.id || loc.id,
          rawInvoiceId: existing.rawInvoiceId || loc.rawInvoiceId || loc.id,
          fiscal_type: isEntrada ? 'entrada' : isCancel ? 'cancelamento' : existing.fiscal_type,
          status: loc.status || (isCancel ? 'cancelada' : existing.status),
          store_id: loc.store_id || existing.store_id,
          store_name: storeName || existing.store_name,
          party_name: loc.party_name || existing.party_name,
          issue_date: loc.issue_date || existing.issue_date,
          original_issue_date: loc.original_issue_date || existing.original_issue_date,
          event_date: isCancel ? (loc.cancellation_date || eventDate) : (existing.event_date || eventDate),
          cancellation_date: loc.cancellation_date || (isCancel ? eventDate : undefined) || existing.cancellation_date,
          original_value: loc.original_value !== undefined ? loc.original_value : existing.original_value,
          value_difference: loc.value_difference !== undefined ? loc.value_difference : existing.value_difference,
          sefaz_protocol: loc.sefaz_protocol || existing.sefaz_protocol,
          reissued_as_invoice_number: reissuedAs || existing.reissued_as_invoice_number,
          reissue_of_invoice_number: reissueOf || existing.reissue_of_invoice_number,
          attachment_url: loc.attachment_url || existing.attachment_url,
          attachment_name: loc.attachment_name || existing.attachment_name,
          attachment_type: loc.attachment_type || existing.attachment_type,
          attachment_size: loc.attachment_size || existing.attachment_size,
          notes: loc.notes || existing.notes,
        };
      } else {
        recordsList.push({
          id: loc.id || `loc-${loc.invoice_number}-${Math.random()}`,
          invoice_number: loc.invoice_number,
          fiscal_type: isEntrada ? 'entrada' : isCancel ? 'cancelamento' : 'emissao',
          store_id: loc.store_id || '',
          store_name: storeName,
          party_name: loc.party_name || (isEntrada ? 'Shineray do Brasil S.A.' : 'Consumidor Final'),
          issue_date: issueDate,
          original_issue_date: loc.original_issue_date || issueDate,
          event_date: eventDate,
          cancellation_date: loc.cancellation_date || (isCancel ? eventDate : undefined),
          total_value: Number(loc.total_value) || 0,
          original_value: loc.original_value !== undefined ? loc.original_value : Number(loc.total_value) || 0,
          value_difference: loc.value_difference || 0,
          status: loc.status || (isCancel ? 'cancelada' : 'conferido'),
          cancellation_reason: loc.cancellation_reason || loc.notes || '',
          cancellation_type: loc.cancellation_type || 'estorno',
          sefaz_protocol: loc.sefaz_protocol || '',
          reissued_as_invoice_number: reissuedAs,
          reissue_of_invoice_number: reissueOf,
          notes: loc.notes || '',
          rawInvoiceId: loc.id,
          attachment_url: loc.attachment_url,
          attachment_name: loc.attachment_name,
          attachment_type: loc.attachment_type,
          attachment_size: loc.attachment_size,
        });
      }
    });

    // 1. Unificação inicial: agrupa emissão e cancelamento pelo mesmo número de NF
    const unifiedMap = new Map<string, CombinedFiscalRecord>();
    recordsList.forEach((r) => {
      const key = `${r.store_id || ''}-${r.invoice_number}-${r.fiscal_type === 'entrada' ? 'in' : 'out'}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, r);
      } else {
        const prev = unifiedMap.get(key)!;
        const isPrevCancel = prev.fiscal_type === 'cancelamento' || prev.status === 'cancelada';
        const isCurrCancel = r.fiscal_type === 'cancelamento' || r.status === 'cancelada';
        const isCancelled = isPrevCancel || isCurrCancel;

        unifiedMap.set(key, {
          ...prev,
          ...r,
          fiscal_type: isCancelled ? 'cancelamento' : prev.fiscal_type,
          status: isCancelled ? 'cancelada' : prev.status,
          issue_date: prev.issue_date || r.issue_date,
          original_issue_date: prev.original_issue_date || r.original_issue_date || prev.issue_date || r.issue_date,
          cancellation_date: isCancelled ? (prev.cancellation_date || r.cancellation_date || (prev.cancellation_reason ? prev.event_date : r.event_date)) : undefined,
          event_date: isCancelled ? (prev.cancellation_reason ? prev.event_date : r.event_date) : (prev.event_date || r.event_date),
          cancellation_reason: prev.cancellation_reason || r.cancellation_reason,
          cancellation_type: prev.cancellation_type || r.cancellation_type,
          reissued_as_invoice_number: prev.reissued_as_invoice_number || r.reissued_as_invoice_number,
          reissue_of_invoice_number: prev.reissue_of_invoice_number || r.reissue_of_invoice_number,
          sefaz_protocol: prev.sefaz_protocol || r.sefaz_protocol,
          attachment_url: prev.attachment_url || r.attachment_url,
          notes: prev.notes || r.notes,
        });
      }
    });

    const unifiedList = Array.from(unifiedMap.values());

    // 2. CONSOLIDAÇÃO E DEDUPLICAÇÃO DE SUBSTITUIÇÃO (MANTÉM APENAS UMA CÓPIA)
    // Se a NF antiga foi cancelada e substituída por outra (ou se a nova foi reemitida a partir da antiga),
    // funde ambas na NF ativa / atualizada e remove a cópia antiga do plano.
    const supersededNumbers = new Set<string>();

    unifiedList.forEach((r) => {
      if (r.reissue_of_invoice_number) {
        supersededNumbers.add(r.reissue_of_invoice_number);
      }
      if (r.reissued_as_invoice_number) {
        // Se a nova NF também já existe na lista, a antiga é descartada como cópia secundária
        const childExists = unifiedList.some(
          (c) => c.invoice_number === r.reissued_as_invoice_number && (c.store_id === r.store_id || !c.store_id || !r.store_id)
        );
        if (childExists) {
          supersededNumbers.add(r.invoice_number);
        }
      }
    });

    const consolidatedRecords = unifiedList
      .filter((r) => !supersededNumbers.has(r.invoice_number))
      .map((r) => {
        // Se r aponta para uma NF anterior que foi substituída, incorpora os dados históricos da antiga
        if (r.reissue_of_invoice_number) {
          const oldParent = unifiedList.find(
            (p) => p.invoice_number === r.reissue_of_invoice_number && (p.store_id === r.store_id || !p.store_id || !r.store_id)
          );
          if (oldParent) {
            return {
              ...r,
              original_issue_date: oldParent.original_issue_date || oldParent.issue_date,
              cancellation_date: r.cancellation_date || oldParent.cancellation_date || oldParent.event_date,
              cancellation_reason: r.cancellation_reason || oldParent.cancellation_reason || 'Cancelada para reemissão (Substituição de NF)',
              cancellation_type: r.cancellation_type || oldParent.cancellation_type,
              sefaz_protocol: r.sefaz_protocol || oldParent.sefaz_protocol,
              attachment_url: r.attachment_url || oldParent.attachment_url,
              attachment_name: r.attachment_name || oldParent.attachment_name,
            };
          }
        }
        // Se r tem reissued_as_invoice_number mas o filho não existia separadamente,
        // transforma r diretamente na nova NF para manter apenas 1 cópia ativa
        if (r.reissued_as_invoice_number) {
          return {
            ...r,
            reissue_of_invoice_number: r.invoice_number,
            original_issue_date: r.original_issue_date || r.issue_date,
            cancellation_date: r.cancellation_date || r.event_date,
            cancellation_reason: r.cancellation_reason || 'Cancelada para reemissão (Substituição de NF)',
            invoice_number: r.reissued_as_invoice_number,
            reissued_as_invoice_number: undefined,
            status: 'emitida',
            fiscal_type: 'emissao' as const,
          };
        }
        return r;
      });

    return consolidatedRecords.sort(
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

  // Contadores e Totais Financeiros por Concessionária (Grupo L1MA Motors)
  const { dealershipCounts, dealershipFinancials } = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const financials: Record<string, number> = { all: 0 };

    allFiscalRecords.forEach((r) => {
      const sId = r.store_id;
      const key = resolveStoreToKey(sId || r.store_name);
      const val = Number(r.total_value) || 0;

      counts.all = (counts.all || 0) + 1;
      financials.all = (financials.all || 0) + val;

      if (key && key !== 'all') {
        counts[key] = (counts[key] || 0) + 1;
        financials[key] = (financials[key] || 0) + val;
      }
      if (sId && sId !== key) {
        counts[sId] = (counts[sId] || 0) + 1;
        financials[sId] = (financials[sId] || 0) + val;
      }
    });

    return { dealershipCounts: counts, dealershipFinancials: financials };
  }, [allFiscalRecords]);

  // Registros Filtrados estritamente pela Concessionária / Semana / Filtros Atuais
  const filteredRecords = useMemo(() => {
    return allFiscalRecords.filter((rec) => {
      // 1. Filtro de Concessionária (Escopo Global e Local)
      if (dealershipScope.activeScope !== 'all') {
        const matches = dealershipScope.matchesScope(rec.store_id || rec.store_name);
        if (!matches) return false;
      } else if (storeFilter !== 'all') {
        const normFilter = normalizeStoreId(storeFilter);
        const normRec = normalizeStoreId(rec.store_id || rec.store_name);
        const matchesStore =
          normRec === normFilter ||
          isMatchingStore(rec.store_id || rec.store_name, storeFilter);
        if (!matchesStore) return false;
      }

      // 2. Filtro de Tipo
      if (typeFilter !== 'all') {
        if (typeFilter === 'reissue') {
          if (!rec.reissued_as_invoice_number && !rec.reissue_of_invoice_number) return false;
        } else if (typeFilter === 'cancel_only') {
          if ((rec.fiscal_type !== 'cancelamento' && rec.status !== 'cancelada') || rec.reissued_as_invoice_number) return false;
        } else if (typeFilter === 'emissao') {
          if (rec.fiscal_type !== 'emissao' && rec.status !== 'autorizada') return false;
        } else if (rec.fiscal_type !== typeFilter) {
          return false;
        }
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
  }, [allFiscalRecords, dealershipScope.activeScope, storeFilter, weekFilter, typeFilter, searchTerm]);

  // Contadores para os Botões de Grupo de Formatos
  const lifecycleCounts = useMemo(() => {
    let reissued = 0;
    let active = 0;
    let cancelledOnly = 0;
    let entradas = 0;

    allFiscalRecords.forEach((r) => {
      if (r.fiscal_type === 'entrada') {
        entradas++;
      } else if (r.reissued_as_invoice_number || r.reissue_of_invoice_number) {
        reissued++;
      } else if (r.fiscal_type === 'cancelamento' || r.status === 'cancelada') {
        cancelledOnly++;
      } else {
        active++;
      }
    });

    return {
      total: allFiscalRecords.length,
      reissued,
      active,
      cancelledOnly,
      entradas,
    };
  }, [allFiscalRecords]);

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

  // Ação: Lançar Nova NF com persistência robusta (Cloud + LocalStorage + Anexo)
  const handleCreateInvoice = async () => {
    if (!canModifyNf) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas a Diretoria e Gerência têm permissão para cadastrar Notas Fiscais.',
      });
      return;
    }
    if (!newInvoiceNumber.trim()) {
      toast({ variant: 'destructive', title: 'Informe o número da NF' });
      return;
    }
    const val = parseFlexibleCurrency(newTotalValue);
    if (val <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor total válido para a NF' });
      return;
    }

    const cleanNum = newInvoiceNumber.trim();
    const cleanProtocol = newSefazProtocol.trim();
    const cleanParty = newPartyName.trim() || (newType === 'entrada' ? 'Shineray do Brasil S.A.' : 'Consumidor Final');
    const resolvedStoreId = normalizeStoreId(newStoreId);
    const storeObj = stores.find((s) => s.id === resolvedStoreId);
    const isMoc = resolvedStoreId === STORE_MONTESCLAROS_UUID;
    const storeName = storeObj?.name || (isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis');

    let finalAttachmentUrl = attachedFile?.url;
    if (attachedFile?.url && attachedFile.url.startsWith('data:')) {
      try {
        finalAttachmentUrl = await saveAttachmentToIdb(
          `inv_${cleanNum}_${Date.now()}`,
          attachedFile.name,
          attachedFile.url,
          attachedFile.type,
          attachedFile.size
        );
      } catch (e) {
        console.warn('Falha ao salvar anexo no IDB:', e);
      }
    }

    const newRecordId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

    const newRecord = {
      id: newRecordId,
      invoice_number: cleanNum,
      fiscal_type: newType,
      store_id: resolvedStoreId,
      store_name: storeName,
      issue_date: newEventDate,
      entry_or_cancel_date: newEventDate,
      party_name: cleanParty,
      customer_name: cleanParty,
      total_value: val,
      total: val,
      subtotal: val,
      status: newType === 'entrada' ? 'conferido' : 'emitida',
      sefaz_protocol: cleanProtocol || undefined,
      notes: newNotes.trim() || undefined,
      attachment_name: attachedFile?.name,
      attachment_url: finalAttachmentUrl,
      attachment_size: attachedFile?.size,
      attachment_type: attachedFile?.type,
      created_at: new Date().toISOString(),
      items: [
        {
          description: newType === 'entrada' ? 'Entrada de Veículos / Peças (Remessa Montadora)' : 'Venda de Veículo / Mercadoria',
          quantity: 1,
          unit_value: val,
          sefaz_protocol: cleanProtocol || undefined,
          attachment_name: attachedFile?.name,
          attachment_url: finalAttachmentUrl,
          attachment_size: attachedFile?.size,
          attachment_type: attachedFile?.type,
        },
      ],
    };

    setIsSubmittingInvoice(true);
    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(newRecord);
      safeSaveToLocalStorage(storageKey, list);

      // Resposta instantânea (0ms): fecha modal, limpa campos e garante visibilidade na semana correta
      setIsNewInvoiceModalOpen(false);
      if (weekFilter !== 'all') {
        const targetWeek = getWeekKeyForDate(newEventDate);
        if (targetWeek && targetWeek !== weekFilter) {
          setWeekFilter(targetWeek);
        }
      }
      resetNewInvoiceForm();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));

      toast({
        title: 'NF Registrada com Sucesso!',
        description: `NF Nº ${cleanNum} com protocolo e anexo salvos para a Diretoria.`,
      });

      // Sincronização em nuvem em segundo plano sem travar a interface
      void upsertInvoiceMutation.mutateAsync({
        id: newRecord.id,
        invoice_number: newRecord.invoice_number,
        invoice_type: newRecord.fiscal_type,
        fiscal_type: newRecord.fiscal_type,
        issue_date: newRecord.issue_date,
        entry_or_cancel_date: newRecord.entry_or_cancel_date,
        store_id: resolvedStoreId,
        store_name: storeName,
        customer_name: newRecord.party_name,
        party_name: newRecord.party_name,
        total_value: val,
        total: val,
        subtotal: val,
        sefaz_protocol: cleanProtocol || undefined,
        attachment_name: attachedFile?.name,
        attachment_url: finalAttachmentUrl,
        attachment_size: attachedFile?.size,
        attachment_type: attachedFile?.type,
        status: newRecord.status,
        notes: newRecord.notes,
        items: newRecord.items,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao registrar NF', description: err?.message });
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  // Ação: Cancelar NF (Apenas confirmação direta sem questionários ou campos obrigatórios)
  const handleConfirmCancellation = async () => {
    if (!invoiceToCancel) return;

    const effectiveCancelDate = cancellationDate || getLocalTodayDateString();
    const effectiveType = cancellationType || 'estorno';
    const effectiveReason = cancellationReason.trim() || 'Cancelamento confirmado pela diretoria';

    setIsSubmittingCancel(true);
    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];

      // Atualiza o registro diretamente para cancelamento (1 única linha limpa)
      let foundInLocal = false;
      list = list.map((item: any) => {
        if (item.invoice_number === invoiceToCancel.invoice_number) {
          foundInLocal = true;
          return {
            ...item,
            fiscal_type: 'cancelamento',
            status: 'cancelada',
            cancellation_date: effectiveCancelDate,
            entry_or_cancel_date: effectiveCancelDate,
            cancellation_type: effectiveType,
            cancellation_reason: effectiveReason,
            sefaz_protocol: cancellationProtocol.trim() || item.sefaz_protocol || '',
            notes: appendHistoryLine(
              item.notes,
              `NF ${invoiceToCancel.invoice_number} cancelada em ${formatFiscalDate(effectiveCancelDate)} (${effectiveReason})`
            ),
          };
        }
        return item;
      });

      if (!foundInLocal) {
        list.unshift({
          id: invoiceToCancel.rawInvoiceId || `canc-${invoiceToCancel.invoice_number}-${Date.now()}`,
          invoice_number: invoiceToCancel.invoice_number,
          fiscal_type: 'cancelamento',
          store_id: invoiceToCancel.store_id,
          issue_date: invoiceToCancel.issue_date,
          entry_or_cancel_date: effectiveCancelDate,
          party_name: invoiceToCancel.party_name,
          total_value: invoiceToCancel.total_value,
          status: 'cancelada',
          cancellation_reason: effectiveReason,
          cancellation_type: effectiveType,
          sefaz_protocol: cancellationProtocol.trim() || invoiceToCancel.sefaz_protocol || '',
          notes: `Cancelamento de NF Nº ${invoiceToCancel.invoice_number}`,
          created_at: new Date().toISOString(),
        });
      }

      // Filtra duplicidades para que nunca haja mais de uma linha por NF
      const seen = new Set<string>();
      list = list.filter((item: any) => {
        const key = `${item.store_id || ''}-${item.invoice_number}-${item.fiscal_type === 'entrada' ? 'in' : 'out'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      safeSaveToLocalStorage(storageKey, list);

      // Resposta instantânea (0ms): fecha modal e notifica UI imediatamente
      const cancelledTotal = invoiceToCancel.total_value;
      const num = invoiceToCancel.invoice_number;
      const rawInvId = invoiceToCancel.rawInvoiceId;
      handleCloseCancelOrReissueModal();
      setCancellationReason('');
      setCancellationProtocol('');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));

      toast({
        title: 'NF Cancelada com Sucesso!',
        description: `Cancelamento da NF Nº ${num} (${formatCurrencyBRL(cancelledTotal)}) confirmado com sucesso.`,
      });

      // Se tiver vínculo com o Supabase, chama a mutation em segundo plano
      if (rawInvId && !rawInvId.startsWith('loc-')) {
        void cancelInvoiceMutation.mutateAsync({
          id: rawInvId,
          cancellation_date: effectiveCancelDate,
          cancellation_reason: effectiveReason,
          cancellation_type: effectiveType,
          sefaz_protocol: cancellationProtocol.trim(),
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao cancelar NF', description: err?.message });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Ação: Reativar NF (Desfazer cancelamento)
  const handleReactivateInvoice = async (record: CombinedFiscalRecord) => {
    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];

      list = list.map((item: any) => {
        if (item.invoice_number === record.invoice_number) {
          return {
            ...item,
            fiscal_type: 'emissao',
            status: 'emitida',
            cancellation_date: null,
            cancellation_reason: null,
            cancellation_type: null,
          };
        }
        return item;
      });
      safeSaveToLocalStorage(storageKey, list);

      if (record.rawInvoiceId && !record.rawInvoiceId.startsWith('loc-')) {
        void cloudSaveInvoice({
          id: record.rawInvoiceId,
          status: 'emitida',
          cancellation_date: null,
          cancellation_reason: null,
          invoice_type: 'saida',
        });
      }

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
      toast({
        title: 'NF Reativada com Sucesso!',
        description: `A NF Nº ${record.invoice_number} foi reativada como emitida.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao reativar',
        description: err?.message || 'Falha ao reativar a nota fiscal.',
      });
    }
  };

  // Abertura do Modal Unificado de Cancelar / Reemitir NF
  const prepareReissueFields = (record: CombinedFiscalRecord) => {
    const rawDigits = record.invoice_number.replace(/\D/g, '');
    let suggested = '';
    if (rawDigits) {
      const nextVal = parseInt(rawDigits, 10) + 1;
      suggested = String(nextVal).padStart(rawDigits.length, '0');
      if (record.invoice_number.includes('.')) {
        suggested = formatBrlNumber(nextVal) || suggested;
      }
    }
    setReissueNewNumber(suggested || '');
    setReissueNewValue(formatBrlNumber(record.total_value));
    setReissueNewDate(getLocalTodayDateString());
    setReissueCancelDate(getLocalTodayDateString());
    setReissueProtocol('');
    setReissueReason('Cancelada para reemissão (Substituição de NF)');
    setReissueAttachment(null);
  };

  const handleOpenCancel = (record: CombinedFiscalRecord) => {
    setInvoiceToCancel(record);
    setInvoiceToReissue(record);
    setCancelModalMode('cancel');
    setCancellationDate(
      record.cancellation_date ||
        (record.status === 'cancelada' ? (record.event_date || record.issue_date) : getLocalTodayDateString())
    );
    setCancellationType('estorno');
    setCancellationReason(record.cancellation_reason || '');
    setCancellationProtocol(record.sefaz_protocol || '');
    prepareReissueFields(record);
  };

  const handleOpenReissue = (record: CombinedFiscalRecord) => {
    setInvoiceToCancel(record);
    setInvoiceToReissue(record);
    setCancelModalMode('reissue');
    setCancellationDate(getLocalTodayDateString());
    prepareReissueFields(record);
  };

  const handleCloseCancelOrReissueModal = () => {
    setInvoiceToCancel(null);
    setInvoiceToReissue(null);
    setCancelModalMode('cancel');
  };

  // Confirmação de Cancelamento & Reemissão no Mesmo Plano (com Valor e Data Atualizados)
  const handleConfirmCancelAndReissue = async () => {
    if (!invoiceToReissue) return;
    if (!reissueNewNumber.trim()) {
      toast({ variant: 'destructive', title: 'Informe o número da nova Nota Fiscal.' });
      return;
    }

    const cleanNewNum = reissueNewNumber.trim();
    const effectiveCancelDate = reissueCancelDate || getLocalTodayDateString();
    const effectiveNewDate = reissueNewDate || getLocalTodayDateString();
    const effectiveReason = reissueReason.trim() || `Cancelada para reemissão (Substituída pela NF ${cleanNewNum})`;
    const oldNum = invoiceToReissue.invoice_number;

    const parsedNewVal = parseFlexibleCurrency(reissueNewValue);
    const effectiveNewValue = parsedNewVal > 0 ? parsedNewVal : invoiceToReissue.total_value;
    const originalValue = invoiceToReissue.original_value || invoiceToReissue.total_value;
    const valueDifference = effectiveNewValue - originalValue;

    // Preserva TODO o histórico anterior (reemissões sucessivas) e acrescenta esta etapa
    let reissueNotes = `Reemissão substituta da NF ${oldNum}${valueDifference !== 0 ? ` (Ajuste: ${formatCurrencyBRL(originalValue)} ➔ ${formatCurrencyBRL(effectiveNewValue)})` : ''}`;
    for (const h of extractHistoryLines(invoiceToReissue.notes)) {
      reissueNotes = appendHistoryLine(reissueNotes, h);
    }
    reissueNotes = appendHistoryLine(
      reissueNotes,
      `NF ${oldNum} (${formatCurrencyBRL(invoiceToReissue.total_value)}) cancelada em ${formatFiscalDate(effectiveCancelDate)} → nova NF ${cleanNewNum} (${formatCurrencyBRL(effectiveNewValue)})`
    );

    setIsSubmittingReissue(true);
    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      let list = raw ? JSON.parse(raw) : [];

      // Substitui a NF anterior pela nova NF reemitida com o histórico completo preservado
      // Mantém estritamente UMA ÚNICA NOTA no sistema (elimina a duplicata da NF anterior)
      const unifiedReissuedRecord: CombinedFiscalRecord = {
        id: invoiceToReissue.rawInvoiceId || `inv-reissue-${Date.now()}`,
        invoice_number: cleanNewNum,
        fiscal_type: 'emissao',
        store_id: invoiceToReissue.store_id,
        store_name: invoiceToReissue.store_name,
        issue_date: effectiveNewDate,
        original_issue_date: invoiceToReissue.original_issue_date || invoiceToReissue.issue_date,
        event_date: effectiveNewDate,
        party_name: invoiceToReissue.party_name,
        party_doc: invoiceToReissue.party_doc,
        total_value: effectiveNewValue,
        original_value: originalValue,
        value_difference: valueDifference,
        status: 'emitida',
        reissue_of_invoice_number: oldNum,
        cancellation_date: effectiveCancelDate,
        cancellation_reason: effectiveReason,
        cancellation_type: 'estorno',
        sefaz_protocol: reissueProtocol.trim() || invoiceToReissue.sefaz_protocol || undefined,
        notes: reissueNotes,
        attachment_url: reissueAttachment?.url || invoiceToReissue.attachment_url || undefined,
        attachment_name: reissueAttachment?.name || invoiceToReissue.attachment_name || undefined,
        attachment_size: reissueAttachment?.size || invoiceToReissue.attachment_size || undefined,
        attachment_type: reissueAttachment?.type || invoiceToReissue.attachment_type || undefined,
        rawInvoiceId: invoiceToReissue.rawInvoiceId,
      };

      // Remove tanto a NF antiga quanto qualquer duplicata do novo número, mantendo apenas 1 registro único
      list = list.filter((item: any) => item.invoice_number !== oldNum && item.invoice_number !== cleanNewNum);
      list.unshift(unifiedReissuedRecord);

      // Garante deduplicação rigorosa de números
      const seen = new Set<string>();
      list = list.filter((item: any) => {
        const key = `${item.store_id || ''}-${item.invoice_number}-${item.fiscal_type === 'entrada' ? 'in' : 'out'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      safeSaveToLocalStorage(storageKey, list);

      // 3. Atualiza na nuvem in-place mantendo apenas 1 registro único da operação
      const cloudId = invoiceToReissue.rawInvoiceId && !invoiceToReissue.rawInvoiceId.startsWith('loc-')
        ? invoiceToReissue.rawInvoiceId
        : unifiedReissuedRecord.id;

      void cloudSaveInvoice({
        id: cloudId,
        invoice_number: cleanNewNum,
        reissue_of_invoice_number: oldNum,
        original_issue_date: invoiceToReissue.original_issue_date || invoiceToReissue.issue_date,
        issue_date: effectiveNewDate,
        cancellation_date: effectiveCancelDate,
        cancellation_reason: effectiveReason,
        cancellation_type: 'estorno',
        store_id: invoiceToReissue.store_id,
        store_name: invoiceToReissue.store_name,
        party_name: invoiceToReissue.party_name,
        customer_name: invoiceToReissue.party_name,
        customer_document: invoiceToReissue.party_doc || '',
        vehicle_model: 'Motocicleta Shineray',
        vehicle_chassis: '',
        total_value: effectiveNewValue,
        original_value: originalValue,
        value_difference: valueDifference,
        status: 'emitida',
        fiscal_type: 'emissao',
        sefaz_protocol: reissueProtocol.trim() || invoiceToReissue.sefaz_protocol || undefined,
        notes: reissueNotes,
        attachment_url: reissueAttachment?.url || invoiceToReissue.attachment_url,
        attachment_name: reissueAttachment?.name || invoiceToReissue.attachment_name,
        attachment_size: reissueAttachment?.size || invoiceToReissue.attachment_size,
        attachment_type: reissueAttachment?.type || invoiceToReissue.attachment_type,
        created_at: new Date().toISOString(),
      });

      // Fecha modais e dispara evento
      setInvoiceToReissue(null);
      setInvoiceToCancel(null);
      setReissueNewNumber('');
      setReissueNewValue('');
      setReissueProtocol('');
      setReissueReason('');
      setReissueAttachment(null);

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));

      toast({
        title: 'NF Cancelada e Reemitida com Sucesso!',
        description: `A NF Nº ${oldNum} foi cancelada e a nova NF Nº ${cleanNewNum} foi emitida e vinculada no mesmo plano.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao reemitir NF',
        description: err?.message || 'Falha ao reemitir nota fiscal.',
      });
    } finally {
      setIsSubmittingReissue(false);
    }
  };

  // Ação: Excluir NF permanentemente (Remove do Banco, Supabase e LocalStorage)
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;

    setIsSubmittingDelete(true);
    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const updated = list.filter((item: any) => {
            if (item.id === invoiceToDelete.id) return false;
            if (item.rawInvoiceId === invoiceToDelete.id) return false;
            if (item.invoice_number === invoiceToDelete.invoice_number) return false;
            return true;
          });
          safeSaveToLocalStorage(storageKey, updated);
        }
      }

      const targetId = invoiceToDelete.rawInvoiceId || invoiceToDelete.id;
      const numToDelete = invoiceToDelete.invoice_number;

      // Resposta instantânea (0ms): fecha modal e notifica UI imediatamente
      setInvoiceToDelete(null);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));

      toast({
        title: 'NF Excluída com Sucesso!',
        description: `A Nota Fiscal Nº ${numToDelete} foi permanentemente removida.`,
      });

      // Sincronização e exclusão no banco em segundo plano
      void deleteInvoiceMutation.mutateAsync({
        id: targetId,
        invoice_number: numToDelete,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir NF',
        description: err?.message,
      });
    } finally {
      setIsSubmittingDelete(false);
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
            onClick={() => {
              resetNewInvoiceForm();
              setIsNewInvoiceModalOpen(true);
            }}
            className="gap-1.5 font-bold text-xs rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Lançar NF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDraftPdfModalOpen(true)}
            className="gap-1.5 font-semibold text-xs rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            title="Gerar espelho PDF de conferência para venda de motos elétricas (Sem Valor Fiscal)"
          >
            <FileText className="w-3.5 h-3.5" />
            Prévia Elétricas (PDF)
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



      {/* 3. REGUA DE NAVEGAÇÃO SEMANAL (O Centro da Interface) */}
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
            <Select
              value={storeFilter}
              onValueChange={(val) => {
                setStoreFilter(val);
                dealershipScope.setActiveScope(val);
              }}
            >
              <SelectTrigger className="h-8 text-xs rounded-xl mt-1">
                <SelectValue placeholder="Concessionária" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Lojas</SelectItem>
                {stores
                  .filter((s) => s.is_active !== false)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {formatStoreShortName(s.name)}
                    </SelectItem>
                  ))}
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

      {/* 4. Painel Executivo: Grupo de Formatos da NF & Tabela Detalhada */}
      <Card className="rounded-2xl border shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-primary" />
                Controle Fiscal por Grupo de Formatos — {currentWeekLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                Acompanhe com clareza o ciclo completo da NF: quando foi emitida, quando foi cancelada e quando foi gerada outra NF.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Badge variant="outline" className="text-xs font-mono font-bold">
                {weekFilter === 'all' ? 'Mês Completo' : weekFilter.replace('_', ' ').toUpperCase()}
              </Badge>

              {/* Seletor de Modo de Visualização */}
              <div className="flex items-center bg-background rounded-xl p-0.5 border shadow-2xs">
                <Button
                  size="sm"
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('cards')}
                  className="h-7 text-xs font-bold gap-1.5 px-2.5 rounded-lg"
                  title="Visualizar em Grupo de Formatos (Cards com linha do tempo de 3 etapas)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grupo de Formatos</span>
                  <span className="sm:hidden">Cards</span>
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('table')}
                  className="h-7 text-xs font-bold gap-1.5 px-2.5 rounded-lg"
                  title="Visualizar em Tabela Executiva compacta"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tabela</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Filtros Rápidos por Grupo de Formatos */}
          <div className="flex items-center gap-1.5 pt-3 overflow-x-auto no-scrollbar">
            <Button
              size="sm"
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setTypeFilter('all')}
              className="h-7 text-[11px] font-bold px-2.5 rounded-lg shrink-0 gap-1.5"
            >
              <span>Todas as NFs</span>
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-mono">
                {allFiscalRecords.length}
              </Badge>
            </Button>

            <Button
              size="sm"
              variant={typeFilter === 'reissue' ? 'default' : 'outline'}
              onClick={() => setTypeFilter(typeFilter === 'reissue' ? 'all' : 'reissue')}
              className={cn(
                "h-7 text-[11px] font-bold px-2.5 rounded-lg shrink-0 gap-1.5 transition-colors",
                typeFilter === 'reissue'
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
              )}
            >
              <RotateCcw className="w-3 h-3 text-blue-500" />
              <span>Canceladas & Reemitidas (Substituições)</span>
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-mono bg-blue-500/20 text-blue-700 dark:text-blue-300">
                {lifecycleCounts.reissued}
              </Badge>
            </Button>

            <Button
              size="sm"
              variant={typeFilter === 'emissao' ? 'default' : 'outline'}
              onClick={() => setTypeFilter(typeFilter === 'emissao' ? 'all' : 'emissao')}
              className={cn(
                "h-7 text-[11px] font-bold px-2.5 rounded-lg shrink-0 gap-1.5 transition-colors",
                typeFilter === 'emissao'
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              )}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>Faturadas Ativas</span>
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                {lifecycleCounts.active}
              </Badge>
            </Button>

            <Button
              size="sm"
              variant={typeFilter === 'cancel_only' ? 'default' : 'outline'}
              onClick={() => setTypeFilter(typeFilter === 'cancel_only' ? 'all' : 'cancel_only')}
              className={cn(
                "h-7 text-[11px] font-bold px-2.5 rounded-lg shrink-0 gap-1.5 transition-colors",
                typeFilter === 'cancel_only'
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
              )}
            >
              <XCircle className="w-3 h-3 text-rose-500" />
              <span>Canceladas (Estornos)</span>
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-mono bg-rose-500/20 text-rose-700 dark:text-rose-300">
                {lifecycleCounts.cancelledOnly}
              </Badge>
            </Button>

            <Button
              size="sm"
              variant={typeFilter === 'entrada' ? 'default' : 'outline'}
              onClick={() => setTypeFilter(typeFilter === 'entrada' ? 'all' : 'entrada')}
              className={cn(
                "h-7 text-[11px] font-bold px-2.5 rounded-lg shrink-0 gap-1.5 transition-colors",
                typeFilter === 'entrada'
                  ? "bg-sky-600 hover:bg-sky-700 text-white"
                  : "border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
              )}
            >
              <Truck className="w-3 h-3 text-sky-500" />
              <span>Entradas de Fábrica</span>
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] font-mono bg-sky-500/20 text-sky-700 dark:text-sky-300">
                {lifecycleCounts.entradas}
              </Badge>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              Carregando dados fiscais da semana...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground space-y-2">
              <ReceiptText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p>Nenhuma operação de NF encontrada para os filtros selecionados.</p>
              {typeFilter !== 'all' && (
                <Button size="sm" variant="ghost" onClick={() => setTypeFilter('all')} className="text-xs text-primary font-semibold">
                  Limpar filtro de formatos
                </Button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* ================================================================= */
            /* 1. VISUALIZAÇÃO POR GRUPO DE FORMATOS (CARDS COM CICLO COMPLETO)   */
            /* ================================================================= */
            <div className="p-4 space-y-3">
              {filteredRecords.map((r) => {
                const lifecycle = computeInvoiceLifecycle(r, allFiscalRecords);
                const isEntrada = r.fiscal_type === 'entrada';
                const isCancel = lifecycle.isCancelled;
                const canCancel = r.fiscal_type === 'emissao' && r.status !== 'cancelada_posteriormente';

                return (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-2xl border p-4 transition-all shadow-xs space-y-3.5 bg-card/90",
                      lifecycle.hasReissue
                        ? "border-blue-500/30 bg-blue-500/[0.02]"
                        : isCancel
                        ? "border-rose-500/30 bg-rose-500/[0.02]"
                        : isEntrada
                        ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                        : "border-border/80 hover:border-primary/40"
                    )}
                  >
                    {/* Topo do Card: Loja, Badges, Destinatário, Valor e Ações */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DealershipBadge storeIdOrName={r.store_name || r.store_id} />

                          <Badge
                            className={cn(
                              "text-[10px] font-bold py-0.5 px-2",
                              isEntrada
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                                : lifecycle.isReissueParent
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : lifecycle.isReissueChild
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                : isCancel
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                            )}
                          >
                            {isEntrada
                              ? 'ENTRADA DE FÁBRICA'
                              : lifecycle.isReissueParent
                              ? 'SUBSTITUÍDA (REEMITIDA)'
                              : lifecycle.isReissueChild
                              ? 'NOVA NF (REEMISSÃO)'
                              : isCancel
                              ? 'CANCELADA (ESTORNO)'
                              : 'FATURADA (REGULAR)'}
                          </Badge>

                          <span className="text-xs font-mono font-bold text-foreground">
                            NF nº {r.invoice_number}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-foreground truncate max-w-[280px]" title={r.party_name}>
                            {r.party_name}
                          </span>
                          {r.party_doc && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              • Doc: {r.party_doc}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lado Direito: Valor Total e Botões Rápidos */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className={cn(
                            "font-display font-black text-sm sm:text-base font-mono",
                            isCancel && !lifecycle.hasReissue ? "line-through text-muted-foreground" : "text-foreground"
                          )}>
                            {formatCurrencyBRL(r.total_value)}
                          </div>
                          {lifecycle.hasReissue && lifecycle.valueDifference !== 0 && (
                            <div className="text-[10px] font-mono flex items-center justify-end gap-1">
                              <span className="line-through text-muted-foreground">{formatCurrencyBRL(lifecycle.originalValue)}</span>
                              <span className={cn(
                                "font-bold",
                                lifecycle.valueDifference > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              )}>
                                {lifecycle.valueDifference > 0 ? `(+${formatCurrencyBRL(lifecycle.valueDifference)})` : `(${formatCurrencyBRL(lifecycle.valueDifference)})`}
                              </span>
                            </div>
                          )}
                          <span className="text-[10px] text-muted-foreground block">
                            {isCancel && !lifecycle.hasReissue ? 'Valor Estornado' : 'Valor Total NF'}
                          </span>
                        </div>

                        {/* Ações do Card */}
                        <div className="flex items-center gap-1">
                          {/* Anexo Ver/Baixar */}
                          {r.attachment_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAttachment(r)}
                              className="h-7 text-[10.5px] px-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 font-bold"
                              title="Visualizar anexo oficial da NF"
                            >
                              <Eye className="w-3 h-3" />
                              Ver NF
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setQuickAttachRecord(r);
                                setQuickAttachFile(null);
                                setQuickAttachDialogOpen(true);
                              }}
                              className="h-7 text-[10.5px] px-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 gap-1 font-bold"
                              title="Anexar arquivo oficial da NF"
                            >
                              <Upload className="w-3 h-3" />
                              Anexar
                            </Button>
                          )}

                          {/* Reemitir Nova NF */}
                          {canModifyNf && canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenReissue(r)}
                              className="h-7 text-[10.5px] px-2 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 gap-1 font-bold"
                              title="Cancelar e gerar nova NF substituta no mesmo plano"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reemitir
                            </Button>
                          )}

                          {/* Cancelar NF Direto */}
                          {canModifyNf && canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenCancel(r)}
                              className="h-7 text-[10.5px] px-2 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
                              title="Cancelar Nota Fiscal"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Cancelar
                            </Button>
                          )}

                          {/* Reativar se cancelada */}
                          {canModifyNf && isCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReactivateInvoice(r)}
                              className="h-7 text-[10.5px] px-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 font-bold"
                              title="Reativar esta Nota Fiscal"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reativar
                            </Button>
                          )}

                          {canModifyNf && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(r)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Editar dados da NF"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}

                          {canModifyNf && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setInvoiceToDelete(r)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              title="Excluir NF permanentemente"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ------------------------------------------------------------- */}
                    {/* FORMATO CONDICIONAL POR ESTADO DA NOTA FISCAL                 */}
                    {/* Simples para notas regulares; destacado para canceladas/reemitidas */}
                    {/* ------------------------------------------------------------- */}

                    {/* CASO 1: NOTA CANCELADA & REEMITIDA (FLUXO COMPLETO DE 3 MOMENTOS) */}
                    {lifecycle.hasReissue ? (
                      <div className="pt-2.5 border-t border-blue-500/25 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                            Substituição de NF Homologada — Linha do Tempo
                          </span>
                          <span className="font-mono text-[9.5px] bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                            Mesmo Plano Fiscal
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {/* 1. Emissão Original */}
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                1. NOTA ORIGINAL
                              </span>
                              <span className="font-mono text-[11px] font-black bg-emerald-500/20 px-1.5 rounded">
                                NF {lifecycle.originalNumber}
                              </span>
                            </div>
                            <div className="text-xs text-foreground font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span>Emitida em: <strong>{formatFiscalDate(lifecycle.originalIssueDate)}</strong></span>
                            </div>
                            <div className="text-[10.5px] text-muted-foreground">
                              Valor: {formatCurrencyBRL(lifecycle.originalValue)}
                            </div>
                          </div>

                          {/* 2. Cancelamento */}
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1">
                            <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 font-bold text-xs">
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                2. CANCELAMENTO
                              </span>
                              <span className="text-[9px] font-bold uppercase bg-rose-500/20 text-rose-800 dark:text-rose-200 px-1.5 rounded">
                                Homologado
                              </span>
                            </div>
                            <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>Cancelada em: <strong>{formatFiscalDate(lifecycle.cancellationDate)}</strong></span>
                            </div>
                            <div className="text-[10.5px] text-muted-foreground truncate" title={lifecycle.cancellationReason || 'Cancelamento para substituição'}>
                              Motivo: <strong>{lifecycle.cancellationReason || 'Cancelamento para substituição'}</strong>
                            </div>
                          </div>

                          {/* 3. Nova NF Gerada */}
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 font-bold text-xs">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                                3. NOVA NF GERADA
                              </span>
                              <span className="font-mono text-[11px] font-black bg-blue-500/25 text-blue-900 dark:text-blue-100 px-1.5 rounded">
                                NF {lifecycle.reissuedAsNumber || lifecycle.originalNumber}
                              </span>
                            </div>
                            <div className="text-xs text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-blue-500 shrink-0" />
                              <span>Gerada em: <strong>{formatFiscalDate(lifecycle.reissuedAsDate || lifecycle.originalIssueDate)}</strong></span>
                            </div>
                            <div className="text-[10.5px] font-bold text-foreground flex items-center justify-between pt-0.5 border-t border-blue-500/20">
                              <span>Novo Valor:</span>
                              <span className="font-mono text-blue-700 dark:text-blue-300 font-black">
                                {formatCurrencyBRL(lifecycle.reissuedAsValue || r.total_value)}
                              </span>
                            </div>
                            {lifecycle.valueDifference !== 0 && (
                              <div className="text-[10px] font-semibold flex items-center justify-between">
                                <span className="text-muted-foreground">Ajuste de Valor:</span>
                                <span className={cn(
                                  "font-mono px-1 py-0.2 rounded font-bold",
                                  lifecycle.valueDifference > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                )}>
                                  {lifecycle.valueDifference > 0 ? `+${formatCurrencyBRL(lifecycle.valueDifference)}` : formatCurrencyBRL(lifecycle.valueDifference)}
                                </span>
                              </div>
                            )}
                            <div className="text-[10.5px] text-muted-foreground flex items-center justify-between pt-0.5">
                              <span className="text-blue-600 dark:text-blue-400 font-bold">Ativa no faturamento</span>
                              <Badge variant="outline" className="text-[9px] font-bold border-blue-500/40 text-blue-600 dark:text-blue-300">
                                Substituta
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : lifecycle.isCancelled ? (
                      /* CASO 2: NOTA CANCELADA COM ESTORNO (SEM REEMISSÃO) */
                      <div className="pt-2.5 border-t border-rose-500/20 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>Cancelamento Homologado na SEFAZ — Estorno Financeiro</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 space-y-1">
                            <div className="flex items-center justify-between text-muted-foreground font-bold text-xs">
                              <span>1. Emissão Original</span>
                              <span className="font-mono text-[11px]">NF {lifecycle.originalNumber}</span>
                            </div>
                            <div className="text-xs text-foreground font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span>Emitida em: {formatFiscalDate(lifecycle.originalIssueDate)}</span>
                            </div>
                            <div className="text-[10.5px] text-muted-foreground">
                              Valor Original: {formatCurrencyBRL(lifecycle.originalValue)}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1">
                            <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 font-bold text-xs">
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                2. Cancelamento Oficial
                              </span>
                              <span className="text-[9px] font-bold uppercase bg-rose-500/20 text-rose-800 dark:text-rose-200 px-1.5 rounded">
                                Estornado
                              </span>
                            </div>
                            <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>Cancelada em: <strong>{formatFiscalDate(lifecycle.cancellationDate)}</strong></span>
                            </div>
                            <div className="text-[10.5px] text-muted-foreground truncate" title={lifecycle.cancellationReason || 'Cancelamento fiscal homologado'}>
                              Motivo: <strong>{lifecycle.cancellationReason || 'Cancelamento fiscal homologado'}</strong>
                            </div>
                            {lifecycle.sefazProtocol && (
                              <div className="text-[9.5px] font-mono text-muted-foreground truncate" title={`Protocolo SEFAZ: ${lifecycle.sefazProtocol}`}>
                                Prot SEFAZ: {lifecycle.sefazProtocol}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* CASO 3: NOTA REGULAR / SEM CANCELAMENTO (SUPER SIMPLES, LIMPO E DESCOMPLICADO) */
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Emitida em: <strong>{formatFiscalDate(lifecycle.originalIssueDate)}</strong>
                          </span>
                          <span>•</span>
                          <span>{isEntrada ? 'Remessa Fábrica' : 'Série 1 Oficial'}</span>
                          {r.sefaz_protocol && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10.5px]">Prot: {r.sefaz_protocol}</span>
                            </>
                          )}
                        </div>

                        <span className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          ✓ Ativa na SEFAZ
                        </span>
                      </div>
                    )}

                    {/* HISTÓRICO COMPLETO DE ALTERAÇÕES (cancelamentos / reemissões sucessivas) */}
                    {(() => {
                      const historyLines = extractHistoryLines(r.notes);
                      if (historyLines.length === 0) return null;
                      return (
                        <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-dashed text-[10.5px] space-y-1">
                          <div className="font-bold uppercase tracking-wider text-[9.5px] text-muted-foreground">
                            Histórico de alterações
                          </div>
                          {historyLines.map((line, i) => (
                            <div key={i} className="text-foreground/80 leading-snug break-words">• {line}</div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================================================================= */
            /* 2. VISUALIZAÇÃO POR TABELA EXECUTIVA COM FORMATOS INTEGRADOS      */
            /* ================================================================= */
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                  <TableRow className="hover:bg-transparent text-xs">
                    <TableHead className="w-[110px]">Operação</TableHead>
                    <TableHead className="w-[130px]">NF / Doc</TableHead>
                    <TableHead className="min-w-[280px]">Grupo de Formatos (Ciclo: Emissão ➔ Cancelamento ➔ Nova NF)</TableHead>
                    <TableHead className="w-[110px]">Loja</TableHead>
                    <TableHead className="w-[140px]">Destinatário</TableHead>
                    <TableHead className="w-[105px] text-right">Valor Total</TableHead>
                    <TableHead className="w-[90px] text-center">Anexo</TableHead>
                    <TableHead className="w-[150px] text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r) => {
                    const lifecycle = computeInvoiceLifecycle(r, allFiscalRecords);
                    const isEntrada = r.fiscal_type === 'entrada';
                    const isCancel = lifecycle.isCancelled;
                    const canCancel = r.fiscal_type === 'emissao' && r.status !== 'cancelada_posteriormente';

                    return (
                      <TableRow
                        key={r.id}
                        className={isCancel ? 'bg-rose-500/[0.03] dark:bg-rose-500/[0.05] hover:bg-muted/40' : 'hover:bg-muted/40'}
                      >
                        {/* 1. Tipo de Operação */}
                        <TableCell className="align-middle">
                          <Badge
                            className={cn(
                              "text-[10px] font-bold py-0.5 px-1.5 whitespace-nowrap",
                              isEntrada
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : lifecycle.isReissueParent
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                : lifecycle.isReissueChild
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'
                                : isCancel
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            )}
                          >
                            {isEntrada
                              ? 'ENTRADA'
                              : lifecycle.isReissueParent
                              ? 'SUBSTITUÍDA'
                              : lifecycle.isReissueChild
                              ? 'REEMISSÃO'
                              : isCancel
                              ? 'CANCELADA'
                              : 'FATURADA'}
                          </Badge>
                        </TableCell>

                        {/* 2. Número da NF & Protocolo */}
                        <TableCell className="align-middle">
                          <div className={cn("font-mono text-xs font-bold", isCancel && !lifecycle.hasReissue ? "line-through text-muted-foreground" : "text-foreground")}>
                            NF {r.invoice_number}
                          </div>
                          {r.sefaz_protocol && (
                            <div className="text-[9.5px] font-mono text-muted-foreground truncate max-w-[120px]" title={`Prot: ${r.sefaz_protocol}`}>
                              Prot: {r.sefaz_protocol}
                            </div>
                          )}
                        </TableCell>

                        {/* 3. GRUPO DE FORMATOS INTEGRADO NA LINHA (LINHA DO TEMPO) */}
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Momento 1: Emitida */}
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-bold whitespace-nowrap" title={`Emitida em ${formatFiscalDate(lifecycle.originalIssueDate)}`}>
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                              <span>Emis: {formatFiscalDate(lifecycle.originalIssueDate)}</span>
                            </div>

                            {/* Seta */}
                            {lifecycle.isCancelled && (
                              <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                            )}

                            {/* Momento 2: Cancelada */}
                            {lifecycle.isCancelled && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 text-[10px] font-bold whitespace-nowrap" title={`Cancelada em ${formatFiscalDate(lifecycle.cancellationDate)} • Motivo: ${lifecycle.cancellationReason || 'Cancelamento fiscal'}`}>
                                <XCircle className="w-2.5 h-2.5 shrink-0" />
                                <span>Canc: {formatFiscalDate(lifecycle.cancellationDate)}</span>
                              </div>
                            )}

                            {/* Seta */}
                            {lifecycle.hasReissue && (
                              <ArrowRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                            )}

                            {/* Momento 3: Nova NF Gerada */}
                            {lifecycle.hasReissue && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 text-[10px] font-bold whitespace-nowrap" title={`Nova NF ${lifecycle.reissuedAsNumber} gerada em ${formatFiscalDate(lifecycle.reissuedAsDate || lifecycle.originalIssueDate)}${lifecycle.valueDifference !== 0 ? ` • Novo Valor: ${formatCurrencyBRL(lifecycle.reissuedAsValue || r.total_value)}` : ''}`}>
                                <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                <span>Nova NF {lifecycle.reissuedAsNumber}: {formatFiscalDate(lifecycle.reissuedAsDate || lifecycle.originalIssueDate)}</span>
                                {lifecycle.valueDifference !== 0 && (
                                  <span className="ml-0.5 font-mono text-[9px] px-1 rounded bg-blue-500/20 text-blue-800 dark:text-blue-200">
                                    {formatCurrencyBRL(lifecycle.reissuedAsValue || r.total_value)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* 4. Concessionária */}
                        <TableCell className="text-xs font-medium align-middle">
                          <DealershipBadge storeIdOrName={r.store_name || r.store_id} />
                        </TableCell>

                        {/* 5. Fornecedor / Destinatário */}
                        <TableCell className="text-xs align-middle">
                          <span className="truncate block max-w-[140px] font-medium text-foreground" title={r.party_name}>
                            {r.party_name}
                          </span>
                        </TableCell>

                        {/* 6. Valor Total */}
                        <TableCell className="text-xs text-right font-mono align-middle">
                          <span className={cn(
                            "font-bold block",
                            isCancel && !lifecycle.hasReissue ? 'line-through text-muted-foreground' : 'text-foreground'
                          )}>
                            {formatCurrencyBRL(r.total_value)}
                          </span>
                          {lifecycle.hasReissue && lifecycle.valueDifference !== 0 && (
                            <div className="text-[9.5px] text-muted-foreground flex items-center justify-end gap-1 font-mono">
                              <span className="line-through">{formatCurrencyBRL(lifecycle.originalValue)}</span>
                              <span className={cn(
                                "font-bold",
                                lifecycle.valueDifference > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              )}>
                                {lifecycle.valueDifference > 0 ? `(+${formatCurrencyBRL(lifecycle.valueDifference)})` : `(${formatCurrencyBRL(lifecycle.valueDifference)})`}
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* 7. Anexo Oficial da NF */}
                        <TableCell className="text-center align-middle">
                          {r.attachment_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAttachment(r)}
                              className="h-6 text-[10px] px-2 rounded-lg text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 font-semibold"
                              title="Visualizar arquivo oficial desta NF"
                            >
                              <Eye className="w-3 h-3" />
                              Ver NF
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setQuickAttachRecord(r);
                                setQuickAttachFile(null);
                                setQuickAttachDialogOpen(true);
                              }}
                              className="h-6 text-[10px] px-2 rounded-lg border-dashed border-primary/40 text-primary hover:bg-primary/10 gap-1 font-semibold"
                              title="Anexar arquivo oficial desta Nota Fiscal"
                            >
                              <Upload className="w-3 h-3" />
                              Anexar
                            </Button>
                          )}
                        </TableCell>

                        {/* 8. Ações */}
                        <TableCell className="text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            {canModifyNf && canCancel && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenReissue(r)}
                                className="h-6 text-[10px] px-2 rounded-lg text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 gap-1 font-semibold"
                                title="Cancelar esta NF e reemitir uma nova nota fiscal substituta no mesmo plano"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Reemitir
                              </Button>
                            )}

                            {isCancel ? (
                              <>
                                {canModifyNf && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReactivateInvoice(r)}
                                    className="h-6 text-[10px] px-2 rounded-lg text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 font-semibold"
                                    title="Reativar esta Nota Fiscal"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Reativar
                                  </Button>
                                )}
                                {canModifyNf && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setInvoiceToDelete(r)}
                                    className="h-6 text-[10px] px-2 rounded-lg text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 gap-0.5 font-semibold"
                                    title="Excluir Nota Fiscal permanentemente"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Excluir
                                  </Button>
                                )}
                              </>
                            ) : (
                              <>
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
                                    onClick={() => handleOpenCancel(r)}
                                    className="h-6 text-[10px] px-2 rounded-lg text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                    title="Cancelar Nota Fiscal"
                                  >
                                    <XCircle className="w-3 h-3 mr-0.5" />
                                    Cancelar
                                  </Button>
                                )}
                                {canModifyNf && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setInvoiceToDelete(r)}
                                    className="h-6 text-[10px] px-2 rounded-lg text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 gap-0.5 font-semibold"
                                    title="Excluir Nota Fiscal permanentemente"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Excluir
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================================================================== */}
      {/* MODAL 1: LANÇAR NOVA NOTA FISCAL                                    */}
      {/* =================================================================== */}
      <Dialog
        open={isNewInvoiceModalOpen}
        onOpenChange={(open) => {
          setIsNewInvoiceModalOpen(open);
          if (!open) resetNewInvoiceForm();
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-primary shrink-0" />
              Lançar Nota Fiscal
            </DialogTitle>
            <DialogDescription className="text-xs">
              Importe o PDF/XML para preencher automaticamente ou informe os dados abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* Seletor visual de Tipo de Nota */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Tipo da Nota Fiscal</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleNewTypeChange('entrada')}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all',
                    newType === 'entrada'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30'
                      : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                  )}
                >
                  <Truck className={cn('w-4 h-4 shrink-0', newType === 'entrada' ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">Entrada de Fábrica</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">Remessa / Compra</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleNewTypeChange('emissao')}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all',
                    newType === 'emissao'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30'
                      : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                  )}
                >
                  <ArrowUpRight className={cn('w-4 h-4 shrink-0', newType === 'emissao' ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold leading-tight">Emissão / Venda</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">Faturamento ao cliente</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Importação opcional de PDF / XML */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) await processFileAttachment(file);
              }}
              className={cn(
                'rounded-xl border border-dashed p-3 transition-all',
                isDragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/60'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
                onChange={handleNewFileUpload}
                className="hidden"
              />

              {!attachedFile ? (
                <button
                  type="button"
                  onClick={() => !isReadingFile && fileInputRef.current?.click()}
                  disabled={isReadingFile}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {isReadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground">
                        {isReadingFile ? 'Lendo arquivo da NF...' : 'Importar PDF ou XML (opcional)'}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Arraste ou clique para preencher número, data e valor automaticamente
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">Selecionar</Badge>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold truncate text-foreground">{attachedFile.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        ({(attachedFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-[11px] text-primary px-2"
                      >
                        Trocar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAttachment}
                        className="h-7 text-[11px] text-destructive px-2"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                  {parsedBannerInfo && (parsedBannerInfo.invoice_number || parsedBannerInfo.total_value) && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        Dados preenchidos automaticamente. Confira os campos abaixo antes de salvar.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Campos Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Número da NF *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="Ex: 10450"
                  value={newInvoiceNumber}
                  onChange={(e) => setNewInvoiceNumber(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Total (R$) *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="Ex: 18.990,00"
                  value={newTotalValue}
                  onChange={(e) => setNewTotalValue(e.target.value)}
                  onBlur={() => {
                    if (newTotalValue.trim()) {
                      const parsedVal = parseFlexibleCurrency(newTotalValue);
                      if (parsedVal > 0) setNewTotalValue(formatBrlNumber(parsedVal));
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Concessionária *</Label>
                <Select value={normalizeStoreId(newStoreId)} onValueChange={setNewStoreId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stores
                      .filter((s) => s.is_active !== false)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatStoreShortName(s.name)} ({s.city})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Nota *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs rounded-xl mt-1"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">
                {newType === 'entrada' ? 'Montadora / Fornecedor' : 'Cliente / Destinatário'} *
              </Label>
              <Input
                className="h-9 text-xs rounded-xl mt-1"
                placeholder={newType === 'entrada' ? 'Shineray do Brasil S.A.' : 'Nome completo do cliente'}
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
              />
            </div>

            {/* Campos Complementares */}
            <div className="pt-2 border-t space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Protocolo SEFAZ / Chave de Acesso (opcional)</Label>
                <Input
                  className="h-9 text-xs font-mono rounded-xl mt-1"
                  placeholder="Ex: 312611009182399"
                  value={newSefazProtocol}
                  onChange={(e) => setNewSefazProtocol(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Observações / Veículos (opcional)</Label>
                <Textarea
                  className="text-xs rounded-xl mt-1 resize-none"
                  rows={2}
                  placeholder="Ex: Lote com motos SHI 175, chassi..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsNewInvoiceModalOpen(false);
                resetNewInvoiceForm();
              }}
              className="rounded-xl"
              disabled={isSubmittingInvoice}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateInvoice} disabled={isSubmittingInvoice} className="font-bold rounded-xl gap-1.5">
              {isSubmittingInvoice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Nota Fiscal
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2 (UNIFICADO): CANCELAR OU CANCELAR & REEMITIR NOTA FISCAL    */}
      {/* =================================================================== */}
      <Dialog
        open={Boolean(activeCancelOrReissueTarget)}
        onOpenChange={(open) => {
          if (!open) handleCloseCancelOrReissueModal();
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
            <DialogTitle
              className={cn(
                'text-base font-bold flex items-center gap-2',
                cancelModalMode === 'reissue' ? 'text-blue-600 dark:text-blue-400' : 'text-destructive'
              )}
            >
              {cancelModalMode === 'reissue' ? (
                <RotateCcw className="w-5 h-5 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 shrink-0" />
              )}
              {cancelModalMode === 'reissue'
                ? `Substituir NF Nº ${activeCancelOrReissueTarget?.invoice_number}`
                : `Cancelar NF Nº ${activeCancelOrReissueTarget?.invoice_number}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {cancelModalMode === 'reissue'
                ? 'Cancela a nota original e registra a nova NF substituta mantendo o histórico.'
                : 'Escolha se deseja apenas cancelar esta nota ou já registrar uma nova NF substituta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* Resumo compacto da NF alvo */}
            <div className="p-3 rounded-xl bg-muted/40 border text-xs grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <span className="text-[10.5px] text-muted-foreground block">Nota Original</span>
                <strong className="font-mono text-foreground">Nº {activeCancelOrReissueTarget?.invoice_number}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10.5px] text-muted-foreground block">Valor Original</span>
                <strong className="font-mono text-foreground">
                  {formatCurrencyBRL(activeCancelOrReissueTarget?.total_value || 0)}
                </strong>
              </div>
              <div className="col-span-2 pt-1 border-t border-border/50 flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate" title={activeCancelOrReissueTarget?.party_name}>
                  {activeCancelOrReissueTarget?.party_name}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                  {formatStoreShortName(activeCancelOrReissueTarget?.store_name || activeCancelOrReissueTarget?.store_id)}
                </span>
              </div>
            </div>

            {/* Seletor de Modo: Apenas Cancelar vs Cancelar e Reemitir */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border">
              <button
                type="button"
                onClick={() => setCancelModalMode('cancel')}
                className={cn(
                  'py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                  cancelModalMode === 'cancel'
                    ? 'bg-background text-destructive shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <XCircle className="w-3.5 h-3.5" />
                Apenas Cancelar
              </button>
              <button
                type="button"
                onClick={() => setCancelModalMode('reissue')}
                className={cn(
                  'py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                  cancelModalMode === 'reissue'
                    ? 'bg-background text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Cancelar e Reemitir
              </button>
            </div>

            {cancelModalMode === 'cancel' ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Data do Cancelamento *</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs rounded-xl mt-1"
                    value={cancellationDate}
                    onChange={(e) => setCancellationDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Motivo (opcional)</Label>
                  <Input
                    className="h-9 text-xs rounded-xl mt-1"
                    placeholder="Ex: Erro de digitação, desistência..."
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Novo Nº da NF *</Label>
                    <Input
                      className="text-xs font-mono font-bold rounded-xl mt-1 h-9"
                      placeholder="Ex: 000.001.391"
                      value={reissueNewNumber}
                      onChange={(e) => setReissueNewNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Novo Valor (R$) *</Label>
                      {reissueDifference !== 0 && (
                        <span
                          className={cn(
                            'text-[10px] font-bold font-mono',
                            reissueDifference > 0 ? 'text-emerald-600' : 'text-rose-600'
                          )}
                        >
                          {reissueDifference > 0 ? `+${formatCurrencyBRL(reissueDifference)}` : formatCurrencyBRL(reissueDifference)}
                        </span>
                      )}
                    </div>
                    <Input
                      type="text"
                      className="text-xs font-mono font-bold rounded-xl mt-1 h-9"
                      placeholder="Ex: 18.990,00"
                      value={reissueNewValue}
                      onChange={(e) => setReissueNewValue(e.target.value)}
                      onBlur={() => {
                        if (reissueNewValue.trim()) {
                          const parsed = parseFlexibleCurrency(reissueNewValue);
                          if (parsed > 0) setReissueNewValue(formatBrlNumber(parsed));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Data da Nova Emissão</Label>
                    <Input
                      type="date"
                      className="text-xs rounded-xl mt-1 h-9"
                      value={reissueNewDate}
                      onChange={(e) => setReissueNewDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Data do Cancelamento</Label>
                    <Input
                      type="date"
                      className="text-xs rounded-xl mt-1 h-9"
                      value={reissueCancelDate}
                      onChange={(e) => setReissueCancelDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Protocolo SEFAZ (opcional)</Label>
                    <Input
                      className="text-xs font-mono rounded-xl mt-1 h-9"
                      placeholder="Ex: 131260000000000"
                      value={reissueProtocol}
                      onChange={(e) => setReissueProtocol(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Motivo</Label>
                    <Input
                      className="text-xs rounded-xl mt-1 h-9"
                      placeholder="Substituição de NF"
                      value={reissueReason}
                      onChange={(e) => setReissueReason(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Anexo da Nova NF (opcional)</Label>
                  <input
                    ref={reissueFileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setReissueIsReadingFile(true);
                        try {
                          const dataUrl = await readFileAsDataUrl(file);
                          const mimeType = file.type || (file.name.endsWith('.xml') ? 'text/xml' : 'application/pdf');
                          setReissueAttachment({
                            name: file.name,
                            url: dataUrl,
                            size: file.size,
                            type: mimeType,
                          });

                          const parsed = await parseInvoiceFile(file);
                          if (parsed.invoice_number) setReissueNewNumber(parsed.invoice_number);
                          if (parsed.total_value !== undefined && parsed.total_value > 0) {
                            setReissueNewValue(maskCurrency(formatBrlNumber(parsed.total_value)));
                          }
                          if (parsed.issue_date) setReissueNewDate(parsed.issue_date);
                          if (parsed.sefaz_protocol) setReissueProtocol(parsed.sefaz_protocol);

                          const filled = [
                            parsed.invoice_number ? `Nº ${parsed.invoice_number}` : null,
                            parsed.total_value ? `R$ ${formatBrlNumber(parsed.total_value)}` : null,
                            parsed.issue_date ? `Data ${formatFiscalDate(parsed.issue_date)}` : null,
                          ].filter(Boolean);
                          if (filled.length > 0) {
                            toast({
                              title: 'Dados da nova NF lidos automaticamente!',
                              description: `${filled.join(' • ')} preenchidos.`,
                            });
                          }
                        } catch (err: any) {
                          toast({ variant: 'destructive', title: 'Erro ao ler arquivo', description: err?.message });
                        } finally {
                          setReissueIsReadingFile(false);
                        }
                      }
                      if (reissueFileInputRef.current) reissueFileInputRef.current.value = '';
                    }}
                  />
                  {!reissueAttachment ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => reissueFileInputRef.current?.click()}
                      disabled={reissueIsReadingFile}
                      className="w-full mt-1 border-dashed rounded-xl h-9 text-xs gap-1.5 text-primary hover:bg-primary/5"
                    >
                      {reissueIsReadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Anexar PDF / XML da Nova NF
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between p-2 mt-1 rounded-xl border bg-muted/30 text-xs">
                      <span className="truncate font-semibold">{reissueAttachment.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReissueAttachment(null)}
                        className="h-6 text-[10px] text-destructive hover:bg-destructive/10 px-2"
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseCancelOrReissueModal}
              disabled={isSubmittingCancel || isSubmittingReissue}
              className="rounded-xl"
            >
              Fechar
            </Button>
            {cancelModalMode === 'cancel' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancellation}
                disabled={isSubmittingCancel}
                className="font-bold rounded-xl gap-1.5"
              >
                {isSubmittingCancel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Confirmar Cancelamento
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConfirmCancelAndReissue}
                disabled={isSubmittingReissue || !reissueNewNumber.trim()}
                className="font-bold rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmittingReissue ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Confirmar Substituição
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA DA NF                    */}
      {/* =================================================================== */}
      <Dialog open={Boolean(invoiceToDelete)} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
              Excluir NF Nº {invoiceToDelete?.invoice_number}?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação remove a NF e seu anexo da apuração da diretoria.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
            {invoiceToDelete && (
              <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <strong className="font-mono text-foreground">{formatCurrencyBRL(invoiceToDelete.total_value)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Cliente / Fornecedor:</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px] text-right">{invoiceToDelete.party_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Concessionária:</span>
                  <span className="text-foreground text-right">{formatStoreShortName(invoiceToDelete.store_name || invoiceToDelete.store_id)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-mono">{formatFiscalDate(invoiceToDelete.event_date)}</span>
                </div>
                {invoiceToDelete.sefaz_protocol && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Protocolo SEFAZ:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[180px]">{invoiceToDelete.sefaz_protocol}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInvoiceToDelete(null)}
              disabled={isSubmittingDelete}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isSubmittingDelete}
              className="font-bold rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirmar Exclusão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: EDIÇÃO DE NF NO PAINEL DIRETOR                             */}
      {/* =================================================================== */}
      <Dialog open={Boolean(editingRecord)} onOpenChange={(v) => { if (!v) setEditingRecord(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary shrink-0" />
              Editar NF Nº {editInvoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atualize os dados, valor, loja ou anexo desta Nota Fiscal.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* Anexo da NF na Edição */}
            <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-primary">
                  <Paperclip className="w-3.5 h-3.5" /> Anexo da NF
                </span>
                {editAttachedFile && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Vinculado
                  </Badge>
                )}
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await processEditFileAttachment(file);
                  if (editFileInputRef.current) editFileInputRef.current.value = '';
                }}
                className="hidden"
              />

              {editAttachedFile ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium truncate">{editAttachedFile.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editFileInputRef.current?.click()}
                      className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10"
                    >
                      Trocar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditAttachedFile(null)}
                      className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/10"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => editFileInputRef.current?.click()}
                  className="w-full text-xs border-dashed gap-1.5 text-primary hover:bg-primary/10 rounded-xl"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {editIsReadingFile ? 'Lendo arquivo...' : 'Vincular PDF ou XML'}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <Label className="text-xs font-semibold">Data da Nota *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs rounded-xl mt-1"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Concessionária *</Label>
                <Select value={normalizeStoreId(editStoreId)} onValueChange={(val) => setEditStoreId(val)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stores
                      .filter((s) => s.is_active !== false)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatStoreShortName(s.name)} ({getContractPrefix(s.id, s.name)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Total (R$) *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="Ex: 18.990,00"
                  value={editTotalValue}
                  onChange={(e) => setEditTotalValue(e.target.value)}
                  onBlur={() => {
                    if (editTotalValue.trim()) {
                      const parsed = parseFlexibleCurrency(editTotalValue);
                      if (parsed > 0) setEditTotalValue(formatBrlNumber(parsed));
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Cliente / Fornecedor *</Label>
              <Input
                className="h-9 text-xs rounded-xl mt-1"
                placeholder="Ex: Nome do cliente ou Shineray do Brasil"
                value={editPartyName}
                onChange={(e) => setEditPartyName(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Protocolo SEFAZ / Chave de Acesso</Label>
              <Input
                className="h-9 text-xs font-mono rounded-xl mt-1"
                placeholder="Ex: 312611000000001"
                value={editSefazProtocol}
                onChange={(e) => setEditSefazProtocol(e.target.value)}
              />
            </div>

            {(editingRecord?.fiscal_type === 'cancelamento' || editingRecord?.status === 'cancelada' || editingRecord?.reissue_of_invoice_number || editingRecord?.cancellation_date || editCancellationDate) && (
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  Data do Cancelamento
                </Label>
                <Input
                  type="date"
                  className="h-9 text-xs rounded-xl font-medium bg-background border-rose-500/30"
                  value={editCancellationDate}
                  onChange={(e) => setEditCancellationDate(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Observações</Label>
              <Textarea
                className="text-xs rounded-xl mt-1 resize-none"
                rows={2}
                placeholder="Observações complementares ou dados do veículo..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingRecord(null)} disabled={isSubmittingEdit} className="rounded-xl">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={isSubmittingEdit} className="font-bold rounded-xl gap-1.5">
              {isSubmittingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 4: ANEXAÇÃO RÁPIDA DE ARQUIVO DA NF                           */}
      {/* =================================================================== */}
      <Dialog open={quickAttachDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setQuickAttachDialogOpen(false);
          setQuickAttachRecord(null);
          setQuickAttachFile(null);
        }
      }}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary shrink-0" />
              Anexar Arquivo da NF Nº {quickAttachRecord?.invoice_number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule o PDF, XML ou imagem oficial desta Nota Fiscal.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
            <input
              ref={quickAttachFileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setQuickAttachIsReading(true);
                  try {
                    const dataUrl = await readFileAsDataUrl(file);
                    const mimeType = file.type || (file.name.endsWith('.xml') ? 'text/xml' : 'application/pdf');
                    setQuickAttachFile({
                      name: file.name,
                      url: dataUrl,
                      size: file.size,
                      type: mimeType,
                    });
                  } finally {
                    setQuickAttachIsReading(false);
                  }
                }
                if (quickAttachFileInputRef.current) quickAttachFileInputRef.current.value = '';
              }}
              className="hidden"
            />

            {!quickAttachFile ? (
              <div
                onClick={() => !quickAttachIsReading && quickAttachFileInputRef.current?.click()}
                className="cursor-pointer py-8 px-4 flex flex-col items-center justify-center gap-2 text-center rounded-xl transition-all border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 bg-muted/20"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {quickAttachIsReading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </div>
                <div className="text-xs font-bold text-foreground">
                  {quickAttachIsReading ? 'Lendo arquivo...' : 'Clique para selecionar o PDF ou XML'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  PDF, XML ou imagem (máx. 25MB)
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-muted/20 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate text-foreground">{quickAttachFile.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    ({(quickAttachFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickAttachFile(null)}
                  className="h-7 text-[11px] text-destructive hover:bg-destructive/10 px-2 shrink-0"
                >
                  Remover
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isSubmittingQuickAttach}
              onClick={() => {
                setQuickAttachDialogOpen(false);
                setQuickAttachRecord(null);
                setQuickAttachFile(null);
              }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!quickAttachFile || isSubmittingQuickAttach}
              onClick={handleSaveQuickAttach}
              className="font-bold rounded-xl gap-1.5"
            >
              {isSubmittingQuickAttach ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Anexo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 5: VISUALIZADOR DE ARQUIVO ANEXADO DA NF                      */}
      {/* =================================================================== */}
      <Dialog
        open={Boolean(viewingAttachment)}
        onOpenChange={(v) => {
          if (!v) setViewingAttachment(null);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              Arquivo da NF Nº {viewingAttachment?.invoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs truncate">
              {viewingAttachment?.name} • {viewingAttachment?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-muted/15 flex items-center justify-center min-h-[300px]">
            {viewingAttachment?.type?.includes('pdf') || viewingAttachment?.url.startsWith('data:application/pdf') ? (
              <iframe
                src={viewingAttachment.url}
                className="w-full h-[62vh] border rounded-xl bg-background"
                title={viewingAttachment.name}
              />
            ) : viewingAttachment?.type?.includes('image') || viewingAttachment?.url.startsWith('data:image/') ? (
              <img
                src={viewingAttachment.url}
                alt={viewingAttachment.name}
                className="max-h-[62vh] max-w-full object-contain rounded-xl border bg-background"
              />
            ) : viewingAttachment?.name.endsWith('.xml') || viewingAttachment?.type?.includes('xml') ? (
              <div className="p-6 text-center space-y-3">
                <FileText className="w-12 h-12 text-primary mx-auto" />
                <div className="text-sm font-bold text-foreground">
                  Arquivo XML da Nota Fiscal Eletrônica (NF-e)
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {viewingAttachment?.name}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-2">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                <div className="text-sm font-semibold text-foreground">
                  Visualização direta não disponível no navegador.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2">
            {viewingAttachment?.url && (
              <Button
                size="sm"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = viewingAttachment.url;
                  a.download = viewingAttachment.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="gap-1.5 text-xs font-bold rounded-xl"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Arquivo
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingAttachment(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceDraftGeneratorDialog
        open={isDraftPdfModalOpen}
        onOpenChange={setIsDraftPdfModalOpen}
      />
    </div>
  );
}
