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
import { useToast } from '@/hooks/use-toast';
import { exportToXLSX } from '@/lib/export';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { formatFiscalDate, getLocalTodayDateString } from '@/lib/fiscalDates';
import { useAuth } from '@/contexts/AuthContext';
import { parseInvoiceFile } from '@/lib/invoiceFileParser';
import { parseFlexibleCurrency, formatBrlNumber } from '@/lib/masks';
import { saveAttachmentToIdb, getAttachmentFromIdb, safeSaveToLocalStorage, cleanLocalStorageBloat } from '@/lib/invoiceAttachmentStorage';
import { cloudSaveInvoice } from '@/lib/cloudSalesSync';
import { cn } from '@/lib/utils';

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
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
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

  // Foco estritamente semanal: por padrão a Semana 3 (atual de 16/11/2026)
  const [weekFilter, setWeekFilter] = useState<string>('sem_3');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modais de Controle
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<CombinedFiscalRecord | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<CombinedFiscalRecord | null>(null);

  // Formulário de Nova NF
  const [newType, setNewType] = useState<'entrada' | 'emissao'>('entrada');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newStoreId, setNewStoreId] = useState('store-montesclaros');
  const [newEventDate, setNewEventDate] = useState('2026-11-16');
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

      if (parsed.invoice_number) setNewInvoiceNumber(parsed.invoice_number);
      if (parsed.sefaz_protocol) setNewSefazProtocol(parsed.sefaz_protocol);
      if (parsed.customer_name) setNewPartyName(parsed.customer_name);
      if (parsed.store_id) setNewStoreId(parsed.store_id);
      if (parsed.issue_date) setNewEventDate(parsed.issue_date);
      if (parsed.total_value !== undefined && parsed.total_value > 0) {
        setNewTotalValue(formatBrlNumber(parsed.total_value));
      }
      if (parsed.vehicle_model || parsed.vehicle_chassis) {
        const extraNote = `${parsed.vehicle_brand || 'SHINERAY'} ${parsed.vehicle_model || ''}${parsed.vehicle_chassis ? ` - Chassi: ${parsed.vehicle_chassis}` : ''}`.trim();
        setNewNotes((prev) => (prev ? `${prev} | ${extraNote}` : extraNote));
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
        parsed.sefaz_protocol ? `Protocolo SEFAZ ${parsed.sefaz_protocol}` : null,
        parsed.customer_name ? `Parte: ${parsed.customer_name}` : null,
        parsed.total_value ? `R$ ${formatBrlNumber(parsed.total_value)}` : null,
      ].filter(Boolean);

      toast({
        title: 'Leitura da NF realizada com sucesso!',
        description: filled.length > 0 ? `${filled.join(' • ')} preenchidos automaticamente.` : 'Arquivo carregado com sucesso.',
      });
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
      if (parsed.invoice_number) setEditInvoiceNumber(parsed.invoice_number);
      if (parsed.sefaz_protocol) setEditSefazProtocol(parsed.sefaz_protocol);
      if (parsed.customer_name) setEditPartyName(parsed.customer_name);
      if (parsed.store_id) setEditStoreId(parsed.store_id);
      if (parsed.issue_date) setEditEventDate(parsed.issue_date);
      if (parsed.total_value !== undefined && parsed.total_value > 0) {
        setEditTotalValue(formatBrlNumber(parsed.total_value));
      }
      toast({
        title: 'Arquivo lido e associado!',
        description: `${file.name} vinculado à NF.`,
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
      const idbFile = await getAttachmentFromIdb(url);
      if (idbFile?.dataUrl) {
        url = idbFile.dataUrl;
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
      const idbFile = await getAttachmentFromIdb(url);
      if (idbFile?.dataUrl) {
        url = idbFile.dataUrl;
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

      try {
        await cloudSaveInvoice(payload as any);
        await upsertInvoiceMutation.mutateAsync(payload);
      } catch (cloudErr) {
        console.warn('Aviso sincronização cloud anexo:', cloudErr);
      }

      toast({
        title: 'Anexo Vinculado com Sucesso!',
        description: `Arquivo vinculado à NF Nº ${quickAttachRecord.invoice_number}.`,
      });

      setQuickAttachDialogOpen(false);
      setQuickAttachRecord(null);
      setQuickAttachFile(null);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao anexar arquivo',
        description: err?.message,
      });
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
    setEditStoreId(r.store_id || 'store-montesclaros');
    setEditEventDate(r.event_date || r.issue_date || getLocalTodayDateString());
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
            store_id: editStoreId,
            issue_date: editEventDate,
            entry_or_cancel_date: editEventDate,
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

      const rawInv = invoices.find((x) => x.id === editingRecord.rawInvoiceId || x.invoice_number === editingRecord.invoice_number);
      const storeObj = stores.find((s) => s.id === editStoreId);
      const storeName = storeObj?.name || (editStoreId.includes('montes') ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis');

      const editPayload = {
        id: editingRecord.rawInvoiceId && !editingRecord.rawInvoiceId.startsWith('loc-') ? editingRecord.rawInvoiceId : rawInv?.id,
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
        attachment_name: editAttachedFile?.name,
        attachment_url: finalAttachmentUrl,
        attachment_size: editAttachedFile?.size,
        attachment_type: editAttachedFile?.type,
      };

      try {
        await cloudSaveInvoice(editPayload as any);
        await upsertInvoiceMutation.mutateAsync(editPayload);
      } catch (cloudErr) {
        console.warn('Aviso sincronização cloud edição:', cloudErr);
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
          attachment_url: inv.attachment_url,
          attachment_name: inv.attachment_name,
          attachment_type: inv.attachment_type,
          attachment_size: inv.attachment_size,
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
        sefaz_protocol: inv.sefaz_protocol || '',
        notes: inv.notes || '',
        rawInvoiceId: inv.id,
        attachment_url: inv.attachment_url,
        attachment_name: inv.attachment_name,
        attachment_type: inv.attachment_type,
        attachment_size: inv.attachment_size,
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
          attachment_url: inv.attachment_url,
          attachment_name: inv.attachment_name,
          attachment_type: inv.attachment_type,
          attachment_size: inv.attachment_size,
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
          attachment_url: loc.attachment_url,
          attachment_name: loc.attachment_name,
          attachment_type: loc.attachment_type,
          attachment_size: loc.attachment_size,
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
    const storeObj = stores.find((s) => s.id === newStoreId);
    const isMoc = newStoreId.includes('montes');
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

    const newRecordId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `fisc-man-${Date.now()}`;

    const newRecord = {
      id: newRecordId,
      invoice_number: cleanNum,
      fiscal_type: newType,
      store_id: newStoreId,
      store_name: storeName,
      issue_date: newEventDate,
      entry_or_cancel_date: newEventDate,
      party_name: cleanParty,
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

    try {
      const storageKey = 'dealflow_store_fiscal_invoices_v1';
      const raw = localStorage.getItem(storageKey);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(newRecord);
      safeSaveToLocalStorage(storageKey, list);

      try {
        await cloudSaveInvoice(newRecord as any);
        await upsertInvoiceMutation.mutateAsync({
          id: newRecord.id,
          invoice_number: newRecord.invoice_number,
          invoice_type: newRecord.fiscal_type,
          issue_date: newRecord.issue_date,
          store_id: newRecord.store_id,
          store_name: storeName,
          customer_name: newRecord.party_name,
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
      } catch (cloudErr) {
        console.warn('Persistência local concluída, aviso de sincronização nuvem:', cloudErr);
      }

      toast({
        title: 'NF Registrada com Sucesso!',
        description: `NF Nº ${cleanNum} com protocolo e anexo salvos para a Diretoria.`,
      });

      // Limpa formulário
      setNewInvoiceNumber('');
      setNewTotalValue('');
      setNewNotes('');
      setNewSefazProtocol('');
      setAttachedFile(null);
      setParsedBannerInfo(null);
      setIsNewInvoiceModalOpen(false);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
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
      safeSaveToLocalStorage(storageKey, list);

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

  // Ação: Excluir NF permanentemente (Remove do Banco, Supabase e LocalStorage)
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
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
      await deleteInvoiceMutation.mutateAsync({
        id: targetId,
        invoice_number: invoiceToDelete.invoice_number,
      });

      toast({
        title: 'NF Excluída com Sucesso!',
        description: `A Nota Fiscal Nº ${invoiceToDelete.invoice_number} foi permanentemente removida.`,
      });

      setInvoiceToDelete(null);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('dealflow:invoices-updated'));
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir NF',
        description: err?.message,
      });
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
          <div className="w-full max-h-[580px] overflow-y-auto">
            <Table className="w-full">
              <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px] text-xs">Operação</TableHead>
                  <TableHead className="w-[140px] text-xs">NF / Protocolo SEFAZ</TableHead>
                  <TableHead className="w-[95px] text-xs">Data (Sem.)</TableHead>
                  <TableHead className="w-[120px] text-xs">Concessionária</TableHead>
                  <TableHead className="min-w-[140px] text-xs">Fornecedor / Cliente</TableHead>
                  <TableHead className="w-[110px] text-xs text-right">Valor Total</TableHead>
                  <TableHead className="w-[105px] text-xs text-center">Anexo NF</TableHead>
                  <TableHead className="w-[160px] text-xs text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      Carregando dados fiscais da semana...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
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
                        {/* 1. Tipo de Operação */}
                        <TableCell className="align-middle">
                          <Badge
                            className={`text-[10px] font-bold ${
                              isEntrada
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : isCancel
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {isEntrada ? 'ENTRADA' : isCancel ? 'CANCELADA' : 'FATURADA'}
                          </Badge>
                          {isCancel && (
                            <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                              {r.cancellation_type === 'credito' ? 'Crédito Fábrica' : 'Estorno Financeiro'}
                            </div>
                          )}
                        </TableCell>

                        {/* 2. Número da NF & Protocolo SEFAZ */}
                        <TableCell className="align-middle">
                          <div className="font-mono text-xs font-bold text-foreground">
                            NF {r.invoice_number}
                          </div>
                          {r.sefaz_protocol ? (
                            <div
                              className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[130px]"
                              title={`Protocolo SEFAZ: ${r.sefaz_protocol}`}
                            >
                              Prot: {r.sefaz_protocol}
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                              {r.cancellation_reason || r.notes || '—'}
                            </div>
                          )}
                        </TableCell>

                        {/* 3. Data da Operação nesta Semana */}
                        <TableCell className="text-xs align-middle">
                          <span className="font-semibold text-foreground">
                            {formatFiscalDate(r.event_date)}
                          </span>
                          {isCancel && r.issue_date && r.issue_date !== r.event_date && (
                            <div className="text-[10px] text-muted-foreground">
                              Emis: {formatFiscalDate(r.issue_date)}
                            </div>
                          )}
                        </TableCell>

                        {/* 4. Concessionária */}
                        <TableCell className="text-xs font-medium align-middle">
                          <span className="truncate block max-w-[110px]" title={r.store_name}>
                            {r.store_name.replace('Concessionária ', '')}
                          </span>
                        </TableCell>

                        {/* 5. Fornecedor / Destinatário */}
                        <TableCell className="text-xs align-middle">
                          <span className="truncate block max-w-[160px] font-medium text-foreground" title={r.party_name}>
                            {r.party_name}
                          </span>
                        </TableCell>

                        {/* 6. Valor Total */}
                        <TableCell className="text-xs text-right font-bold font-mono align-middle">
                          <span className={isCancel ? 'text-destructive' : 'text-foreground'}>
                            {formatCurrencyBRL(r.total_value)}
                          </span>
                        </TableCell>

                        {/* 7. Anexo Oficial da NF */}
                        <TableCell className="text-center align-middle">
                          {r.attachment_url ? (
                            <div className="flex items-center justify-center gap-1">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadAttachment(r)}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                title="Baixar arquivo oficial da NF"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
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
                                  setCancellationProtocol(r.sefaz_protocol || '');
                                }}
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
      {/* MODAL 1: LANÇAR / REGISTRAR NOVA NF COM AUTO-LEITURA E ANEXO         */}
      {/* =================================================================== */}
      <Dialog open={isNewInvoiceModalOpen} onOpenChange={setIsNewInvoiceModalOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-primary" />
              Lançar Nota Fiscal no Controle Semanal
            </DialogTitle>
            <DialogDescription className="text-xs">
              Importe o XML ou PDF da NF para leitura e preenchimento automático de todos os campos contábeis, ou preencha manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ETAPA 1: IMPORTAÇÃO E ANEXO DO ARQUIVO DA NF COM AUTO-LEITURA */}
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
                "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-2 border-dashed rounded-xl p-4 space-y-3 transition-all",
                isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-primary/40 hover:border-primary/70"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-primary uppercase tracking-wider">
                  <Upload className="w-4 h-4" /> 1. Importação da NF (XML ou PDF) — Preenchimento Automático
                </div>
                {attachedFile && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                    ✓ Arquivo Anexado & Lido
                  </Badge>
                )}
              </div>

              {parsedBannerInfo && (
                <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-lg p-2.5 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-emerald-800 dark:text-emerald-200">
                      ✅ Leitura da NF realizada com sucesso! Todos os dados foram auto-preenchidos:
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                      {parsedBannerInfo.invoice_number && (
                        <Badge variant="secondary" className="bg-background text-foreground border">
                          NF Nº {parsedBannerInfo.invoice_number}
                        </Badge>
                      )}
                      {parsedBannerInfo.sefaz_protocol && (
                        <Badge variant="secondary" className="bg-background text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                          Protocolo SEFAZ: {parsedBannerInfo.sefaz_protocol}
                        </Badge>
                      )}
                      {parsedBannerInfo.chassis && (
                        <Badge variant="secondary" className="bg-background text-foreground border">
                          Chassi: {parsedBannerInfo.chassis}
                        </Badge>
                      )}
                      {parsedBannerInfo.total_value ? (
                        <Badge variant="secondary" className="bg-background text-primary border font-bold">
                          {formatCurrencyBRL(parsedBannerInfo.total_value)}
                        </Badge>
                      ) : null}
                      {parsedBannerInfo.customer_name && (
                        <Badge variant="secondary" className="bg-background text-muted-foreground border truncate max-w-xs">
                          {parsedBannerInfo.customer_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
                onChange={handleNewFileUpload}
                className="hidden"
              />

              {!attachedFile ? (
                <div
                  onClick={() => !isReadingFile && fileInputRef.current?.click()}
                  className={cn(
                    "cursor-pointer py-5 px-4 flex flex-col items-center justify-center gap-2 text-center rounded-lg transition-all border-2 border-dashed bg-card/60",
                    isReadingFile ? "bg-primary/5 border-primary animate-pulse" : "hover:bg-primary/5 hover:border-primary border-border/80"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {isReadingFile ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {isReadingFile
                      ? 'Lendo dados da NF (XML/PDF) e auto-preenchendo todos os campos...'
                      : 'Clique ou arraste o arquivo da NF (XML ou PDF) aqui'}
                  </div>
                  <div className="text-[11px] text-muted-foreground max-w-md mx-auto">
                    O sistema extrai automaticamente o Número da NF, Protocolo SEFAZ, Concessionária, Data, Destinatário e Valor Total.
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold truncate text-foreground">{attachedFile.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({(attachedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-[11px] text-primary hover:bg-primary/10 px-2"
                    >
                      Trocar Arquivo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAttachment}
                      className="h-7 text-[11px] text-destructive hover:bg-destructive/10 px-2"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 2: CAMPOS FISCAIS (AUTO-PREENCHIDOS OU MANUAIS) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de Operação</Label>
                <Select
                  value={newType}
                  onValueChange={(val: any) => {
                    setNewType(val);
                    if (val === 'entrada' && !newPartyName) setNewPartyName('Shineray do Brasil S.A.');
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
                <Label className="text-xs font-semibold">Número da NF *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
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
                    <SelectItem value="store-montesclaros">Concessionária Montes Claros (Matriz)</SelectItem>
                    <SelectItem value="store-divinopolis">Concessionária Divinópolis (Filial)</SelectItem>
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
                  {newType === 'entrada' ? 'Montadora / Fornecedor' : 'Nome do Cliente / Comprador'} *
                </Label>
                <Input
                  className="h-9 text-xs rounded-xl mt-1"
                  placeholder={newType === 'entrada' ? 'Shineray do Brasil S.A.' : 'Nome do Cliente'}
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Valor Total da NF (R$) *</Label>
                <Input
                  className="h-9 text-xs font-mono font-bold rounded-xl mt-1"
                  placeholder="Ex: 18.990,00"
                  value={newTotalValue}
                  onChange={(e) => setNewTotalValue(e.target.value)}
                  onBlur={() => {
                    if (newTotalValue.trim()) {
                      const parsedVal = parseFlexibleCurrency(newTotalValue);
                      if (parsedVal > 0) {
                        setNewTotalValue(formatBrlNumber(parsedVal));
                      }
                    }
                  }}
                />
                {parseFlexibleCurrency(newTotalValue) > 0 && (
                  <span className="text-[10px] text-primary font-bold font-mono mt-0.5 block">
                    Valor reconhecido: {formatCurrencyBRL(parseFlexibleCurrency(newTotalValue))}
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Protocolo SEFAZ de Autorização / Chave de Acesso</Label>
              <Input
                className="h-9 text-xs font-mono rounded-xl mt-1"
                placeholder="Ex: 312611009182399 ou 44 dígitos da chave"
                value={newSefazProtocol}
                onChange={(e) => setNewSefazProtocol(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                Salvo e vinculado permanentemente à NF no banco de dados e nuvem.
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações / Detalhes dos Veículos</Label>
              <Textarea
                className="text-xs rounded-xl mt-1 resize-none"
                rows={2}
                placeholder="Ex: Lote com 10 motos SHI 175 EFI..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsNewInvoiceModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateInvoice} className="font-bold rounded-xl gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Salvar Lançamento da NF
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
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA DA NF                    */}
      {/* =================================================================== */}
      <Dialog open={Boolean(invoiceToDelete)} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Excluir Nota Fiscal Nº {invoiceToDelete?.invoice_number}?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação excluirá permanentemente esta NF do sistema, da apuração semanal da diretoria e da nuvem. O registro e o anexo serão removidos de forma definitiva.
            </DialogDescription>
          </DialogHeader>

          {invoiceToDelete && (
            <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1.5 my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Total:</span>
                <strong className="font-mono text-foreground">{formatCurrencyBRL(invoiceToDelete.total_value)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente / Fornecedor:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">{invoiceToDelete.party_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concessionária:</span>
                <span className="text-foreground">{invoiceToDelete.store_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data da Operação:</span>
                <span className="font-mono">{formatFiscalDate(invoiceToDelete.event_date)}</span>
              </div>
              {invoiceToDelete.sefaz_protocol && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocolo SEFAZ:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{invoiceToDelete.sefaz_protocol}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInvoiceToDelete(null)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="font-bold rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="w-4 h-4" />
              Sim, Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: EDIÇÃO DE NF NO PAINEL DIRETOR                             */}
      {/* =================================================================== */}
      <Dialog open={Boolean(editingRecord)} onOpenChange={(v) => { if (!v) setEditingRecord(null); }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Dados da Nota Fiscal Nº {editInvoiceNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atualize as informações contábeis, loja, data, cliente, valores, protocolo SEFAZ e anexo desta NF diretamente pelo Painel Diretor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Anexo da NF na Edição */}
            <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-primary">
                  <Paperclip className="w-4 h-4" /> Anexo Oficial da NF
                </span>
                {editAttachedFile && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Arquivo Vinculado
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
                <div className="flex items-center justify-between p-2 rounded-lg bg-background border text-xs">
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
                  className="w-full text-xs border-dashed gap-1.5 text-primary hover:bg-primary/10"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {editIsReadingFile ? 'Lendo arquivo...' : 'Vincular Arquivo (XML ou PDF)'}
                </Button>
              )}
            </div>

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
                {parseFlexibleCurrency(editTotalValue) > 0 && (
                  <span className="text-[10px] text-primary font-bold font-mono mt-0.5 block">
                    Valor reconhecido: {formatCurrencyBRL(parseFlexibleCurrency(editTotalValue))}
                  </span>
                )}
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
              <Label className="text-xs font-semibold">Protocolo SEFAZ de Autorização / Chave de Acesso</Label>
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
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Anexar Arquivo Oficial da NF Nº {quickAttachRecord?.invoice_number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule o arquivo oficial (PDF ou XML) a esta Nota Fiscal para consulta e auditoria da diretoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
                  {quickAttachIsReading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-xs font-bold text-foreground">
                  {quickAttachIsReading ? 'Lendo arquivo...' : 'Clique para selecionar o PDF ou XML da NF'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Formatos suportados: PDF, XML ou imagem (máx. 25MB).
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate text-foreground">{quickAttachFile.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({(quickAttachFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuickAttachFile(null)}
                  className="h-7 text-[11px] text-destructive hover:bg-destructive/10 px-2"
                >
                  Remover
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
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
              disabled={!quickAttachFile}
              onClick={handleSaveQuickAttach}
              className="font-bold rounded-xl gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar Anexo da NF
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
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <FileText className="w-5 h-5 text-primary" />
                  Arquivo Oficial da Nota Fiscal Nº {viewingAttachment?.invoiceNumber}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {viewingAttachment?.name} • Cliente / Destinatário: {viewingAttachment?.customerName}
                </DialogDescription>
              </div>
              {viewingAttachment?.url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = viewingAttachment.url;
                    a.download = viewingAttachment.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="gap-1.5 text-xs font-semibold rounded-xl"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Arquivo
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-[450px] w-full rounded-xl overflow-hidden border bg-muted/20 my-2 flex items-center justify-center">
            {viewingAttachment?.type?.includes('pdf') || viewingAttachment?.url.startsWith('data:application/pdf') ? (
              <iframe
                src={viewingAttachment.url}
                className="w-full h-[550px] border-none rounded-xl"
                title={viewingAttachment.name}
              />
            ) : viewingAttachment?.type?.includes('image') || viewingAttachment?.url.startsWith('data:image/') ? (
              <img
                src={viewingAttachment.url}
                alt={viewingAttachment.name}
                className="max-h-[550px] max-w-full object-contain rounded-xl"
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
                  className="gap-1.5 font-bold rounded-xl"
                >
                  <Download className="w-4 h-4" />
                  Baixar Arquivo XML Completo
                </Button>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                <div className="text-sm font-semibold text-foreground">
                  Visualização direta não disponível no navegador.
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = viewingAttachment?.url || '';
                    a.download = viewingAttachment?.name || 'arquivo';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="gap-1.5 font-bold rounded-xl"
                >
                  <Download className="w-4 h-4" />
                  Baixar Arquivo
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingAttachment(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Fechar Visualizador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
