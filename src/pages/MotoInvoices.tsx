import { useState, useMemo, useRef } from 'react';
import {
  Plus,
  FileText,
  Download,
  Trash2,
  Bike,
  ImageDown,
  XCircle,
  Paperclip,
  Eye,
  CheckCircle2,
  Calendar,
  Building2,
  Search,
  Upload,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  FileCheck,
  Loader2,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { parseInvoiceFile } from '@/lib/invoiceFileParser';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStores, STORE_DIVINOPOLIS_UUID, STORE_MONTESCLAROS_UUID } from '@/hooks/useStores';
import { useVehicles } from '@/hooks/useVehicles';
import { useContracts, Contract } from '@/hooks/useContracts';
import {
  useInvoices,
  useUpsertInvoice,
  useCancelInvoice,
  useDeleteInvoice,
  Invoice,
  InvoiceItem,
} from '@/hooks/useInvoices';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { maskCPFCNPJ, maskPhone, maskCurrency, parseCurrency, parseFlexibleCurrency, formatBrlNumber } from '@/lib/masks';
import { getAttachmentFromIdb, saveAttachmentToIdb } from '@/lib/invoiceAttachmentStorage';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { getLocalTodayDateString, normalizeDateToYMD, formatFiscalDate } from '@/lib/fiscalDates';
import { cloudAttachInvoiceToSale } from '@/lib/cloudSalesSync';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_TAG = 'moto';

const ALIENACAO_OPTIONS = [
  'À VISTA',
  'ALTIS FINANCIAMENTOS',
  'MOTRIX FINANCEIRA',
  'BANCO PAN',
  'BRADESCO FINANCIAMENTOS',
  'SANTANDER FINANCIAMENTOS',
  'BV FINANCEIRA',
  'CONSORCIO',
];

const OPERATION_NATURE_OPTIONS = [
  'Venda de Moto Zero KM',
  'Venda de Moto Usada / Seminovos',
  'Remessa em Bonificação / Brinde',
  'Remessa para Conserto / Garantia',
  'Devolução de Mercadoria',
  'Outras Saídas',
];

export default function MotoInvoices() {
  const { isAdmin, isManager, hasElevatedAccess } = useAuth();
  const canModifyNf = Boolean(isAdmin || isManager || hasElevatedAccess);

  const { data: stores = [] } = useStores();
  const { data: vehicles = [] } = useVehicles();
  const { data: allContracts = [] } = useContracts();
  const { data: invoices = [], isLoading } = useInvoices();
  const upsert = useUpsertInvoice();
  const cancelInvoiceMutation = useCancelInvoice();
  const del = useDeleteInvoice();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos Diálogos
  const [open, setOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedInvoiceToCancel, setSelectedInvoiceToCancel] = useState<Invoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInvoiceToDelete, setSelectedInvoiceToDelete] = useState<Invoice | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<{
    name: string;
    url: string;
    invoiceNumber: string;
    customerName: string;
    type?: string;
  } | null>(null);

  // Estados do Cancelamento
  const [cancelDate, setCancelDate] = useState(getLocalTodayDateString());
  const [cancelReason, setCancelReason] = useState('');
  const [cancelType, setCancelType] = useState<'estorno' | 'credito' | 'devolucao'>('estorno');
  const [cancelProtocol, setCancelProtocol] = useState('');

  // Estado da Venda Selecionada para preenchimento semi-manual
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [saleSearchQuery, setSaleSearchQuery] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Estado do Arquivo Anexado (Cadastro Principal)
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);

  // Estado da Anexação Rápida Direta na Tabela
  const [selectedInvoiceForQuickAttach, setSelectedInvoiceForQuickAttach] = useState<Invoice | null>(null);
  const [quickAttachFile, setQuickAttachFile] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);
  const [quickAttachDialogOpen, setQuickAttachDialogOpen] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [isReadingNfFile, setIsReadingNfFile] = useState(false);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  // Formulário de Cadastro Semi-Manual de NF
  const initialForm = {
    invoice_number: '',
    series: '1',
    access_key: '',
    sefaz_protocol: '',
    issue_date: getLocalTodayDateString(),
    store_id: STORE_DIVINOPOLIS_UUID,
    sale_id: '',
    contract_number: '',
    customer_name: '',
    customer_document: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    vehicle_model: '',
    vehicle_chassis: '',
    vehicle_brand: 'SHINERAY',
    vehicle_color: 'Padrão',
    vehicle_year: 2026,
    alienacao: 'À VISTA',
    operation_nature: 'Venda de Moto Zero KM',
    total_value: 0,
    tax_rate: 0,
    notes: '',
  };

  const [form, setForm] = useState<any>(initialForm);
  const [displayTotalValue, setDisplayTotalValue] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedBannerInfo, setParsedBannerInfo] = useState<{
    invoice_number?: string;
    sefaz_protocol?: string;
    chassis?: string;
    total_value?: number;
    customer_name?: string;
  } | null>(null);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Filtra as vendas válidas da loja selecionada para vinculação semi-manual
  const storeSales = useMemo(() => {
    if (!form.store_id) return allContracts;
    const isMocTarget = form.store_id.includes('montes');

    return allContracts.filter((c) => {
      if (c.status === 'cancelado') return false;
      const sId = (c.store_id || c.store?.id || '').toLowerCase();
      const sName = (c.store?.name || '').toLowerCase();
      const matchStore = isMocTarget
        ? sId.includes('montes') || sName.includes('montes')
        : sId.includes('divin') || sName.includes('divin') || (!sId.includes('montes') && !sName.includes('montes'));

      if (!matchStore) return false;

      if (saleSearchQuery.trim()) {
        const q = saleSearchQuery.toLowerCase();
        const client = (c.buyer_name || '').toLowerCase();
        const num = (c.contract_number || '').toLowerCase();
        const ch = (c.vehicle?.chassis || (c.external_data as any)?.chassis || '').toLowerCase();
        return client.includes(q) || num.includes(q) || ch.includes(q);
      }

      return true;
    });
  }, [allContracts, form.store_id, saleSearchQuery]);

  // Lista estrita de notas fiscais cadastradas (sem preenchimento fantasma)
  const motoInvoices = useMemo(() => {
    return invoices;
  }, [invoices]);

  // Handler: Seleciona loja e reseta venda vinculada
  const handleStoreChange = (storeId: string) => {
    setForm((prev: any) => ({
      ...prev,
      store_id: storeId,
      sale_id: '',
      contract_number: '',
    }));
    setSelectedSaleId('');
  };

  // Handler: Seleciona venda da loja e preenche dados cadastrais e da moto automaticamente
  const handleSelectSale = (saleId: string) => {
    if (!saleId || saleId === 'none') {
      setSelectedSaleId('');
      setForm((prev: any) => ({
        ...prev,
        sale_id: '',
        contract_number: '',
      }));
      return;
    }

    const sale = allContracts.find((x) => x.id === saleId);
    if (!sale) return;

    setSelectedSaleId(saleId);
    const ext = (sale.external_data || {}) as any;

    const motoModel = sale.vehicle?.model || ext.vehicle_model_custom || ext.modelo || 'MOTO SHINERAY';
    const motoChassis = sale.vehicle?.chassis || ext.chassis || ext.chassi || '';
    const salePrice = Number(sale.sale_price) || 0;
    const alienacaoBank =
      sale.financing_bank ||
      ext.banco ||
      (sale.installments > 1 || ext.financiamento > 0 ? 'FINANCIAMENTO' : 'À VISTA');

    const saleDateRaw = sale.contract_date || ext.data || ext.data_venda || sale.created_at;
    const resolvedSaleDate = saleDateRaw ? normalizeDateToYMD(saleDateRaw) : undefined;

    setForm((prev: any) => ({
      ...prev,
      sale_id: sale.id,
      contract_number: sale.contract_number,
      issue_date: resolvedSaleDate || prev.issue_date || getLocalTodayDateString(),
      customer_name: sale.buyer_name || prev.customer_name,
      customer_document: sale.buyer_cpf ? maskCPFCNPJ(sale.buyer_cpf) : prev.customer_document,
      customer_phone: sale.buyer_phone ? maskPhone(sale.buyer_phone) : prev.customer_phone,
      customer_email: sale.buyer_email || prev.customer_email,
      customer_address: sale.buyer_address || prev.customer_address,
      vehicle_model: motoModel,
      vehicle_chassis: motoChassis,
      vehicle_brand: sale.vehicle?.brand || 'SHINERAY',
      vehicle_color: sale.vehicle?.color || ext.cor || 'Padrão',
      vehicle_year: sale.vehicle?.year || 2026,
      alienacao: alienacaoBank,
      total_value: salePrice || prev.total_value,
    }));

    if (salePrice > 0) {
      setDisplayTotalValue(formatBrlNumber(salePrice));
    }

    toast({
      title: 'Venda vinculada!',
      description: `Dados de ${sale.buyer_name} e da moto ${motoModel} preenchidos.`,
    });
  };

  // Processamento e leitura inteligente do arquivo da NF (XML ou PDF)
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

    setIsReadingNfFile(true);

    try {
      // 1. Leitura promissificada em Base64 para garantir o DataURL imediatamente
      const dataUrl = await readFileAsDataUrl(file);
      const mimeType = file.type || (file.name.endsWith('.xml') ? 'text/xml' : 'application/pdf');

      setAttachedFile({
        name: file.name,
        url: dataUrl,
        size: file.size,
        type: mimeType,
      });

      // 2. Extração inteligente de dados fiscais (XML ou PDF)
      const parsed = await parseInvoiceFile(file);

      // 3. Tenta localizar venda já cadastrada por chassi ou documento
      let matchedSaleId = selectedSaleId;
      if (!matchedSaleId && (parsed.vehicle_chassis || parsed.customer_document)) {
        const found = allContracts.find((c) => {
          const ch = (c.vehicle?.chassis || (c.external_data as any)?.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const parsedCh = (parsed.vehicle_chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (parsedCh.length >= 6 && ch.includes(parsedCh)) return true;

          const doc = (c.buyer_cpf || '').replace(/\D/g, '');
          const parsedDoc = (parsed.customer_document || '').replace(/\D/g, '');
          if (parsedDoc.length >= 8 && doc.includes(parsedDoc)) return true;

          return false;
        });

        if (found) {
          matchedSaleId = found.id;
          setSelectedSaleId(found.id);
        }
      }

      // 4. Preenche formulário com os dados extraídos
      setForm((prev: any) => ({
        ...prev,
        invoice_number: parsed.invoice_number || prev.invoice_number,
        series: parsed.series || prev.series || '1',
        access_key: parsed.access_key || prev.access_key,
        sefaz_protocol: parsed.sefaz_protocol || prev.sefaz_protocol,
        issue_date: parsed.issue_date || prev.issue_date,
        operation_nature: parsed.operation_nature || prev.operation_nature,
        store_id: parsed.store_id || prev.store_id,
        sale_id: matchedSaleId || prev.sale_id,
        customer_name: parsed.customer_name || prev.customer_name,
        customer_document: parsed.customer_document ? maskCPFCNPJ(parsed.customer_document) : prev.customer_document,
        customer_phone: parsed.customer_phone ? maskPhone(parsed.customer_phone) : prev.customer_phone,
        customer_email: parsed.customer_email || prev.customer_email,
        customer_address: parsed.customer_address || prev.customer_address,
        vehicle_model: parsed.vehicle_model || prev.vehicle_model,
        vehicle_chassis: parsed.vehicle_chassis || prev.vehicle_chassis,
        vehicle_brand: parsed.vehicle_brand || prev.vehicle_brand || 'SHINERAY',
        vehicle_color: parsed.vehicle_color || prev.vehicle_color,
        vehicle_year: parsed.vehicle_year || prev.vehicle_year,
        alienacao: parsed.alienacao || prev.alienacao,
        total_value: parsed.total_value !== undefined ? parsed.total_value : prev.total_value,
      }));

      if (parsed.total_value !== undefined && parsed.total_value > 0) {
        setDisplayTotalValue(formatBrlNumber(parsed.total_value));
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
        parsed.access_key ? 'Chave de Acesso' : null,
        parsed.customer_name ? `Cliente: ${parsed.customer_name}` : null,
        parsed.vehicle_chassis ? `Chassi: ${parsed.vehicle_chassis}` : null,
        parsed.total_value ? `R$ ${formatBrlNumber(parsed.total_value)}` : null,
      ].filter(Boolean);

      toast({
        title: 'Leitura da NF realizada com sucesso!',
        description: filled.length > 0
          ? `${filled.join(' • ')} preenchidos automaticamente.`
          : 'Arquivo carregado com sucesso.',
      });
    } catch (err: any) {
      console.warn('Erro ao processar arquivo da NF:', err);
      toast({
        title: 'Arquivo anexado',
        description: `${file.name} carregado. Preencha os campos fiscais manualmente se necessário.`,
      });
    } finally {
      setIsReadingNfFile(false);
    }
  };

  // Upload e leitura do arquivo da NF como DataURL com extração inteligente de campos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Handler para abrir edição de uma NF já cadastrada
  const handleOpenEdit = (inv: Invoice) => {
    if (!canModifyNf) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas a Diretoria e Gerência têm permissão para editar dados de Notas Fiscais.',
      });
      return;
    }

    const firstItem = (inv.items || [])[0];
    const chassiMatch = (inv.notes || '').match(/Chassi:\s*([^\s|—]+)/i);
    const alienacaoMatch = (inv.notes || '').match(/Alienação:\s*([^|—]+)/i);
    const modelMatch = (inv.notes || '').match(/\[moto\]\s*([^-]+)/i);

    let rawNotes = inv.notes || '';
    if (rawNotes.includes('—')) {
      rawNotes = rawNotes.split('—').slice(1).join('—').trim();
    } else if (rawNotes.startsWith('[moto]')) {
      rawNotes = '';
    }

    const effectiveChassis = chassiMatch ? chassiMatch[1].trim() : firstItem?.chassis || '';
    const effectiveModel = modelMatch
      ? modelMatch[1].trim()
      : firstItem?.description?.replace(/\(Chassi:.*\)/, '').replace(/^SHINERAY\s*/i, '').trim() || 'MOTO SHINERAY';
    const effectiveAlienacao = alienacaoMatch ? alienacaoMatch[1].trim() : 'À VISTA';

    setForm({
      invoice_number: inv.invoice_number || '',
      series: inv.series || '1',
      access_key: inv.access_key || '',
      sefaz_protocol: inv.sefaz_protocol || '',
      issue_date: inv.issue_date ? normalizeDateToYMD(inv.issue_date) : getLocalTodayDateString(),
      store_id: inv.store_id || STORE_DIVINOPOLIS_UUID,
      sale_id: inv.sale_id || '',
      contract_number: (inv as any).contract_number || firstItem?.contract_number || '',
      customer_name: inv.customer_name || '',
      customer_document: inv.customer_document || '',
      customer_phone: inv.customer_phone || '',
      customer_email: inv.customer_email || '',
      customer_address: inv.customer_address || '',
      vehicle_model: effectiveModel,
      vehicle_chassis: effectiveChassis,
      vehicle_brand: 'SHINERAY',
      vehicle_color: 'Padrão',
      vehicle_year: 2026,
      alienacao: effectiveAlienacao,
      operation_nature: inv.operation_nature || 'Venda de Moto Zero KM',
      total_value: Number(inv.total) || 0,
      tax_rate: Number(inv.tax_rate) || 0,
      notes: rawNotes,
      created_at: inv.created_at,
    });

    const editVal = Number(inv.total) || 0;
    setDisplayTotalValue(editVal > 0 ? formatBrlNumber(editVal) : '');
    setParsedBannerInfo(null);

    if (inv.attachment_url) {
      setAttachedFile({
        name: inv.attachment_name || 'anexo_nf.pdf',
        url: inv.attachment_url,
        size: inv.attachment_size || 0,
        type: inv.attachment_type || 'application/pdf',
      });
    } else {
      setAttachedFile(null);
    }

    setSelectedSaleId(inv.sale_id || '');
    setEditingInvoiceId(inv.id);
    setOpen(true);
  };

  // Submissão do cadastro semi-manual de NF
  const submit = async () => {
    if (!canModifyNf) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas a Diretoria e Gerência têm permissão para cadastrar ou modificar Notas Fiscais.',
      });
      return;
    }

    if (!form.invoice_number?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Número da NF obrigatório',
        description: 'Por favor, informe o número oficial da Nota Fiscal.',
      });
      return;
    }

    if (!form.customer_name?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome do cliente obrigatório',
        description: 'Informe o nome completo do comprador.',
      });
      return;
    }

    if (!form.store_id) {
      toast({
        variant: 'destructive',
        title: 'Loja emissora obrigatória',
        description: 'Selecione a concessionária emissora da NF.',
      });
      return;
    }

    const currentStore = stores.find((s) => s.id === form.store_id);
    const isMoc = (form.store_id || '').includes('montes');
    const storeName = currentStore?.name || (isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis');

    const cleanNum = form.invoice_number.trim();
    const cleanChassis = (form.vehicle_chassis || '').trim().toUpperCase();
    const normalizedDate = normalizeDateToYMD(form.issue_date);
    const isEditing = Boolean(editingInvoiceId);

    const finalId = editingInvoiceId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);

    const payload = {
      ...form,
      id: finalId,
      created_at: form.created_at || new Date().toISOString(),
      invoice_number: cleanNum,
      series: form.series || '1',
      access_key: form.access_key?.replace(/\D/g, '') || undefined,
      sefaz_protocol: form.sefaz_protocol?.trim() || undefined,
      issue_date: normalizedDate,
      store_name: storeName,
      vehicle_chassis: cleanChassis,
      total_value: Number(form.total_value) || 0,
      attachment_name: attachedFile?.name,
      attachment_url: attachedFile?.url,
      attachment_size: attachedFile?.size,
      attachment_type: attachedFile?.type,
      notes: `[${TYPE_TAG}] ${form.vehicle_model || 'Moto'} - Chassi: ${cleanChassis || 'S/ Chassi'}${form.alienacao ? ` | Alienação: ${form.alienacao}` : ''}${form.sefaz_protocol ? ` | Protocolo SEFAZ: ${form.sefaz_protocol.trim()}` : ''}${form.notes ? ` — ${form.notes}` : ''}`,
      items: [
        {
          description: `${form.vehicle_brand || 'SHINERAY'} ${form.vehicle_model || 'Motocicleta'} (Chassi: ${cleanChassis || 'Não informado'})`,
          quantity: 1,
          unit_value: Number(form.total_value) || 0,
          chassis: cleanChassis,
          contract_number: form.contract_number,
          sale_id: form.sale_id,
          series: form.series || '1',
          access_key: form.access_key?.replace(/\D/g, '') || undefined,
          sefaz_protocol: form.sefaz_protocol?.trim() || undefined,
          attachment_name: attachedFile?.name,
          attachment_url: attachedFile?.url,
          attachment_size: attachedFile?.size,
          attachment_type: attachedFile?.type,
          vehicle_model: form.vehicle_model,
          vehicle_brand: form.vehicle_brand || 'SHINERAY',
          vehicle_color: form.vehicle_color || 'Padrão',
          vehicle_year: form.vehicle_year || 2026,
          alienacao: form.alienacao || 'À VISTA',
        },
      ],
    };

    // Fecha o modal e reseta formulário imediatamente para feedback instantâneo (0ms)
    setOpen(false);
    setEditingInvoiceId(null);
    setForm(initialForm);
    setDisplayTotalValue('');
    setParsedBannerInfo(null);
    setAttachedFile(null);
    setSelectedSaleId('');

    try {
      await upsert.mutateAsync(payload);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: isEditing ? 'Erro ao atualizar NF' : 'Erro ao cadastrar NF',
        description: e?.message || 'Falha ao salvar a Nota Fiscal na nuvem.',
      });
    }
  };

  // Confirmação de cancelamento contábil
  const handleConfirmCancel = async () => {
    if (!selectedInvoiceToCancel) return;
    if (!cancelReason.trim()) {
      toast({ variant: 'destructive', title: 'Informe o motivo do cancelamento.' });
      return;
    }
    const target = selectedInvoiceToCancel;
    const date = cancelDate;
    const reason = cancelReason;
    const type = cancelType;
    const protocol = cancelProtocol;

    // Resposta imediata: fecha diálogo e limpa estado
    setCancelDialogOpen(false);
    setSelectedInvoiceToCancel(null);
    setCancelReason('');
    setCancelProtocol('');

    try {
      await cancelInvoiceMutation.mutateAsync({
        id: target.id,
        cancellation_date: date,
        cancellation_reason: reason,
        cancellation_type: type,
        sefaz_protocol: protocol || undefined,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar NF',
        description: e?.message || 'Tente novamente.',
      });
    }
  };

  // Confirmação de exclusão permanente da NF
  const handleConfirmDelete = async () => {
    if (!selectedInvoiceToDelete) return;
    const target = selectedInvoiceToDelete;

    // Resposta imediata: fecha diálogo e limpa seleção
    setDeleteDialogOpen(false);
    setSelectedInvoiceToDelete(null);

    try {
      await del.mutateAsync({
        id: target.id,
        invoice_number: target.invoice_number,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir NF',
        description: err?.message,
      });
    }
  };

  // Visualização de anexo da NF com suporte a IndexedDB
  const openAttachmentViewer = async (inv: Invoice) => {
    let url = inv.attachment_url;
    if (url && url.startsWith('idb://')) {
      const stored = await getAttachmentFromIdb(inv.id);
      if (stored?.url) url = stored.url;
    }
    if (!url) {
      toast({
        variant: 'destructive',
        title: 'Sem anexo',
        description: 'Esta Nota Fiscal não possui arquivo anexado.',
      });
      return;
    }
    setViewingAttachment({
      name: inv.attachment_name || `NF_${inv.invoice_number}.pdf`,
      url,
      invoiceNumber: inv.invoice_number,
      customerName: inv.customer_name,
      type: inv.attachment_type || undefined,
    });
  };

  // Download do arquivo anexado da NF com suporte a IndexedDB
  const handleDownloadAttachment = async (inv: Invoice) => {
    let url = inv.attachment_url;
    if (url && url.startsWith('idb://')) {
      const stored = await getAttachmentFromIdb(inv.id);
      if (stored?.url) url = stored.url;
    }
    if (!url) {
      toast({
        variant: 'destructive',
        title: 'Sem anexo',
        description: 'Esta Nota Fiscal não possui arquivo anexado.',
      });
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download =
      inv.attachment_name ||
      `NF_${inv.invoice_number}_${(inv.customer_name || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Salva anexo rápido direto da tabela
  const handleSaveQuickAttachment = async () => {
    if (!selectedInvoiceForQuickAttach || !quickAttachFile) return;

    const inv = selectedInvoiceForQuickAttach;
    const file = quickAttachFile;

    // Fecha o modal e limpa estado imediatamente para resposta instantânea (0ms)
    setQuickAttachDialogOpen(false);
    setQuickAttachFile(null);
    setSelectedInvoiceForQuickAttach(null);

    toast({
      title: 'Arquivo Anexado com Sucesso!',
      description: `O arquivo ${file.name} foi vinculado à NF ${inv.invoice_number}.`,
    });

    try {
      const chassiMatch = (inv.notes || '').match(/Chassi:\s*([^\s|]+)/i);
      const vehicleDesc = inv.items?.[0]?.description || '';
      const vehicleModel = vehicleDesc.replace(/\(Chassi:.*\)/, '').trim();

      const newAccessKey = (file as any).parsedAccessKey || inv.access_key;
      const newProtocol = (file as any).parsedProtocol || inv.sefaz_protocol;

      // Salva em IndexedDB para cache permanente sem risco de quota
      saveAttachmentToIdb({
        id: inv.id,
        name: file.name,
        url: file.url,
        size: file.size,
        type: file.type,
        updated_at: new Date().toISOString(),
      }).catch(() => {});

      // Atualiza a Nota Fiscal no cache e Supabase com o protocolo e novo arquivo
      await upsert.mutateAsync({
        ...inv,
        access_key: newAccessKey,
        sefaz_protocol: newProtocol,
        vehicle_model: vehicleModel || 'SHINERAY',
        vehicle_chassis: chassiMatch?.[1] || '',
        attachment_name: file.name,
        attachment_url: file.url,
        attachment_size: file.size,
        attachment_type: file.type,
      });

      if (inv.sale_id) {
        await cloudAttachInvoiceToSale(inv.sale_id, {
          invoice_number: inv.invoice_number,
          series: inv.series || '1',
          access_key: newAccessKey,
          sefaz_protocol: newProtocol,
          issue_date: inv.issue_date,
          attachment_name: file.name,
          attachment_url: file.url,
          attachment_size: file.size,
          attachment_type: file.type,
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao sincronizar arquivo',
        description: err?.message || 'Tente novamente.',
      });
    }
  };

  // Emissão de PNG de solicitação de faturamento
  const emitPng = async (inv: Invoice) => {
    try {
      const firstItem = (inv.items || [])[0];
      const chassiMatch = (inv.notes || '').match(/Chassi:\s*([^\s|]+)/i);
      const alienacaoMatch = (inv.notes || '').match(/Alienação:\s*([^|]+)/i);

      await downloadInvoiceRequestPng(
        {
          nomeCompleto: inv.customer_name || '',
          cpf: inv.customer_document || '',
          cep: '',
          endereco: inv.customer_address || 'Divinópolis - MG',
          chassi: chassiMatch ? chassiMatch[1].trim() : firstItem?.chassis || '',
          modeloMoto: firstItem?.description || '',
          valorNF: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.total || 0),
          alienacao: alienacaoMatch ? alienacaoMatch[1].trim() : 'À VISTA',
        },
        `solicitacao-nf-${inv.invoice_number || 'moto'}.png`
      );
      toast({ title: 'PNG gerado', description: 'Solicitação de emissão baixada.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Falha ao gerar PNG', description: e?.message });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Notas Fiscais (NF)"
        description="Gestão semi-manual de notas fiscais: selecione a loja, vincule à venda realizada, preencha os dados e anexe a NF oficial."
        actions={
          canModifyNf ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={headerFileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEditingInvoiceId(null);
                  setForm(initialForm);
                  setDisplayTotalValue('');
                  setParsedBannerInfo(null);
                  setSelectedSaleId('');
                  setOpen(true);
                  await processFileAttachment(file);
                  if (headerFileInputRef.current) headerFileInputRef.current.value = '';
                }}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => headerFileInputRef.current?.click()}
                className="gap-1.5 font-semibold border-primary/40 text-primary hover:bg-primary/10 shadow-xs"
              >
                <Upload className="w-4 h-4" /> Importar NF (XML ou PDF)
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingInvoiceId(null);
                  setForm(initialForm);
                  setDisplayTotalValue('');
                  setParsedBannerInfo(null);
                  setAttachedFile(null);
                  setSelectedSaleId('');
                  setOpen(true);
                }}
                className="gap-1.5 font-semibold shadow-xs"
              >
                <Plus className="w-4 h-4" /> Cadastrar Nova NF
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card className="border shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-hidden">
          <div className="w-full overflow-x-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs py-2.5 w-[15%]">Nota Fiscal</TableHead>
                  <TableHead className="font-semibold text-xs py-2.5 w-[13%]">Loja / Venda</TableHead>
                  <TableHead className="font-semibold text-xs py-2.5 w-[19%]">Comprador</TableHead>
                  <TableHead className="font-semibold text-xs py-2.5 w-[20%]">Motocicleta / Chassi</TableHead>
                  <TableHead className="font-semibold text-xs py-2.5 w-[13%]">Valor & Status</TableHead>
                  <TableHead className="font-semibold text-xs py-2.5 text-center w-[11%]">Arquivo da NF</TableHead>
                  <TableHead className="font-semibold text-xs py-2.5 text-right w-[9%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Carregando notas fiscais em nuvem...
                  </TableCell>
                </TableRow>
              ) : motoInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-base font-semibold text-foreground">
                        Nenhuma Nota Fiscal cadastrada no momento
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        As notas fiscais são cadastradas de forma semi-manual. Você pode cadastrar uma nova NF ou anexar o arquivo (XML ou PDF) para que o sistema preencha tudo automaticamente.
                      </p>
                      {canModifyNf && (
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => headerFileInputRef.current?.click()}
                            className="gap-1.5 font-semibold border-primary/40 text-primary"
                          >
                            <Upload className="w-3.5 h-3.5" /> Importar NF (XML / PDF)
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingInvoiceId(null);
                              setForm(initialForm);
                              setAttachedFile(null);
                              setSelectedSaleId('');
                              setOpen(true);
                            }}
                            className="gap-1.5 font-semibold"
                          >
                            <Plus className="w-3.5 h-3.5" /> Cadastrar Primeira NF
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                motoInvoices.map((inv) => {
                  const firstItem = (inv.items || [])[0];
                  const chassiMatch = (inv.notes || '').match(/Chassi:\s*([^\s|]+)/i);
                  const effectiveChassis = chassiMatch ? chassiMatch[1].trim() : firstItem?.chassis || '—';
                  const hasAttachment = Boolean(inv.attachment_url);

                  return (
                    <TableRow key={inv.id} className="hover:bg-muted/20">
                      {/* 1. NOTA FISCAL (Número, Série, Emissão) */}
                      <TableCell className="py-2.5 truncate">
                        {canModifyNf ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(inv)}
                            className="text-left group cursor-pointer focus:outline-none max-w-full truncate block"
                            title="Clique para editar dados desta Nota Fiscal"
                          >
                            <div className="font-mono font-bold text-sm text-foreground group-hover:text-primary group-hover:underline flex items-center gap-1.5 truncate">
                              <span>NF {inv.invoice_number}</span>
                              <Pencil className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {inv.series ? `Série ${inv.series}` : 'Série 1'} • {formatFiscalDate(inv.issue_date)}
                            </div>
                          </button>
                        ) : (
                          <div className="max-w-full truncate">
                            <div className="font-mono font-bold text-sm text-foreground truncate">
                              NF {inv.invoice_number}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {inv.series ? `Série ${inv.series}` : 'Série 1'} • {formatFiscalDate(inv.issue_date)}
                            </div>
                          </div>
                        )}
                      </TableCell>

                      {/* 2. LOJA / VENDA */}
                      <TableCell className="py-2.5 truncate">
                        <div className="text-xs font-medium text-foreground truncate" title={inv.store?.name || 'Concessionária'}>
                          {inv.store?.name || 'Concessionária'}
                        </div>
                        {inv.contract_number ? (
                          <Badge variant="outline" className="font-mono text-[10px] font-semibold bg-primary/5 text-primary border-primary/20 mt-0.5 truncate max-w-full">
                            Venda {inv.contract_number}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Venda direta</span>
                        )}
                      </TableCell>

                      {/* 3. COMPRADOR & PROTOCOLO */}
                      <TableCell className="py-2.5 truncate">
                        <div className="font-semibold text-xs text-foreground truncate" title={inv.customer_name}>
                          {inv.customer_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {inv.customer_document && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {maskCPFCNPJ(inv.customer_document)}
                            </span>
                          )}
                          {inv.sefaz_protocol && (
                            <Badge variant="outline" className="text-[9px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 px-1 py-0 truncate" title={`Protocolo SEFAZ: ${inv.sefaz_protocol}`}>
                              SEFAZ: {inv.sefaz_protocol}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* 4. MOTOCICLETA & CHASSI */}
                      <TableCell className="py-2.5 truncate">
                        <div className="text-xs font-medium text-foreground truncate" title={firstItem?.description || (inv.notes || '').replace(`[${TYPE_TAG}]`, '').trim()}>
                          {firstItem?.description || (inv.notes || '').replace(`[${TYPE_TAG}]`, '').trim()}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate" title={`Chassi: ${effectiveChassis}`}>
                          Chassi: {effectiveChassis}
                        </div>
                      </TableCell>

                      {/* 5. VALOR & STATUS */}
                      <TableCell className="py-2.5">
                        <div className="font-bold text-xs text-primary truncate">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            Number(inv.total) || 0
                          )}
                        </div>
                        <div className="mt-0.5">
                          {inv.status === 'cancelada' ? (
                            <Badge variant="destructive" className="text-[9px] font-bold px-1.5 py-0">
                              Cancelada
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 px-1.5 py-0">
                              Emitida
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* 6. ARQUIVO ANEXO (Preview inline ou Anexar) */}
                      <TableCell className="py-3 text-center truncate">
                        {hasAttachment ? (
                          <div className="inline-flex items-center justify-center gap-1 max-w-full">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAttachmentViewer(inv)}
                              className="h-7 text-[11px] font-semibold gap-1 px-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 max-w-[85px] truncate"
                              title="Visualizar arquivo da NF na tela"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Ver NF</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownloadAttachment(inv)}
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 shrink-0"
                              title="Baixar arquivo da NF"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoiceForQuickAttach(inv);
                              setQuickAttachFile(null);
                              setQuickAttachDialogOpen(true);
                            }}
                            className="h-7 text-[11px] font-semibold gap-1 px-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 max-w-[85px] truncate"
                            title="Anexar arquivo oficial desta Nota Fiscal"
                          >
                            <Upload className="w-3 h-3 shrink-0" />
                            <span className="truncate">Anexar</span>
                          </Button>
                        )}
                      </TableCell>

                      {/* 7. AÇÕES COMPACTAS */}
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canModifyNf && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              title="Editar dados desta Nota Fiscal"
                              onClick={() => handleOpenEdit(inv)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canModifyNf && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Excluir Nota Fiscal permanentemente"
                              onClick={() => {
                                setSelectedInvoiceToDelete(inv);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Mais opções da Nota Fiscal"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuItem onClick={() => downloadInvoicePDF(inv)} className="gap-2 cursor-pointer">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Gerar DANFE (PDF)</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => emitPng(inv)} className="gap-2 cursor-pointer">
                                <ImageDown className="w-3.5 h-3.5 text-amber-500" />
                                <span>Baixar Solicitação (PNG)</span>
                              </DropdownMenuItem>
                              {canModifyNf && inv.status !== 'cancelada' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedInvoiceToCancel(inv);
                                      setCancelDialogOpen(true);
                                    }}
                                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Cancelar Nota Fiscal</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                              {canModifyNf && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedInvoiceToDelete(inv);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 cursor-pointer font-semibold"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Excluir Nota Fiscal</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* DIÁLOGO: CADASTRO E EDIÇÃO DE NOTA FISCAL */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditingInvoiceId(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {editingInvoiceId ? (
                <>
                  <Pencil className="w-5 h-5 text-primary" /> Editar Dados da Nota Fiscal Nº {form.invoice_number || ''}
                </>
              ) : (
                <>
                  <FileCheck className="w-5 h-5 text-primary" /> Cadastrar Nova Nota Fiscal (Semi-Manual)
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingInvoiceId
                ? 'Edite qualquer dado fiscal, comprador, veículo, valores, observações ou anexo oficial desta Nota Fiscal.'
                : 'Selecione a loja e a venda realizada para preencher os dados cadastrais da moto e do comprador automaticamente, e anexe o arquivo oficial da NF.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm py-2">
            {/* ETAPA 1: IMPORTAÇÃO E ANEXO DO ARQUIVO DA NOTA FISCAL COM AUTO-LEITURA */}
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
                "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-2 border-dashed rounded-xl p-4 space-y-3 transition-all shadow-2xs",
                isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-primary/40 hover:border-primary/70"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-primary uppercase tracking-wider">
                  <Upload className="w-4 h-4" /> 1. Importação Rápida da NF (XML ou PDF) — Preenchimento Automático
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
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsedBannerInfo.total_value)}
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
                onChange={handleFileUpload}
                className="hidden"
              />

              {!attachedFile ? (
                <div
                  onClick={() => !isReadingNfFile && fileInputRef.current?.click()}
                  className={cn(
                    "cursor-pointer py-6 px-4 flex flex-col items-center justify-center gap-2 text-center rounded-lg transition-all border-2 border-dashed bg-card/60",
                    isReadingNfFile ? "bg-primary/5 border-primary animate-pulse" : "hover:bg-primary/5 hover:border-primary border-border/80"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {isReadingNfFile ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {isReadingNfFile
                      ? 'Lendo dados da NF (XML/PDF) e auto-preenchendo todos os campos...'
                      : 'Clique ou arraste o arquivo da NF (XML ou PDF / DANFE) aqui'}
                  </div>
                  <div className="text-[11px] text-muted-foreground max-w-lg mx-auto">
                    O sistema extrai instantaneamente: <strong>Número, Série, Data de Emissão, Chave de Acesso (44 dígitos), Protocolo SEFAZ (15 dígitos), Comprador, Chassi e Valor Total</strong>!
                  </div>
                </div>
              ) : (
                <div className="bg-background border rounded-lg p-3 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div className="truncate text-xs">
                      <div className="font-semibold text-foreground truncate">{attachedFile.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {(attachedFile.size / 1024).toFixed(1)} KB • {attachedFile.type || 'Documento'} • Anexo pronto para salvar
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-xs px-2.5"
                    >
                      Trocar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveAttachment}
                      className="h-7 text-xs text-destructive hover:text-destructive px-2"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 2: SELEÇÃO DA LOJA E DA VENDA REALIZADA */}
            <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-primary" /> 2. Loja e Venda Vinculada
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Concessionária / Loja *</Label>
                  <Select value={form.store_id} onValueChange={handleStoreChange}>
                    <SelectTrigger className="h-9 mt-1 bg-background text-xs">
                      <SelectValue placeholder="Selecione a loja..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s: any) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium">Vincular Venda Realizada (Semi-Manual)</Label>
                  <Select value={selectedSaleId} onValueChange={handleSelectSale}>
                    <SelectTrigger className="h-9 mt-1 bg-background text-xs">
                      <SelectValue placeholder="Escolha a venda realizada..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Buscar cliente, contrato ou chassi..."
                          value={saleSearchQuery}
                          onChange={(e) => setSaleSearchQuery(e.target.value)}
                          className="h-8 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem value="none" className="text-xs italic text-muted-foreground">
                        Nenhuma venda vinculada (Preenchimento avulso)
                      </SelectItem>
                      {storeSales.map((s) => {
                        const ext = (s.external_data || {}) as any;
                        const moto = s.vehicle?.model || ext.vehicle_model_custom || ext.modelo || 'Moto';
                        const chassi = s.vehicle?.chassis || ext.chassis || ext.chassi || '';
                        const chDisplay = chassi && chassi.length > 6 ? chassi.slice(-6) : chassi;
                        return (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            <span className="font-mono font-bold text-primary mr-1.5">{s.contract_number}</span>
                            <span>{s.buyer_name}</span>
                            <span className="text-muted-foreground ml-1">
                              — {moto} ({chDisplay || 'S/ Chassi'}) - R$ {Number(s.sale_price).toLocaleString('pt-BR')}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ETAPA 3: DADOS FISCAIS DA NOTA FISCAL */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider">
                <FileText className="w-4 h-4 text-primary" /> 2. Dados Oficiais da Nota Fiscal
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-medium">Número da Nota Fiscal (NF) *</Label>
                  <Input
                    className="h-9 mt-1 font-mono font-bold text-sm"
                    placeholder="Ex: 10432 ou 000.010.432"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Série</Label>
                  <Input
                    className="h-9 mt-1 font-mono text-xs"
                    placeholder="1"
                    value={form.series}
                    onChange={(e) => setForm({ ...form, series: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Data de Emissão *</Label>
                  <Input
                    type="date"
                    className="h-9 mt-1 text-xs"
                    value={form.issue_date}
                    onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">Chave de Acesso (44 dígitos)</Label>
                  <Input
                    className="h-9 mt-1 font-mono text-xs"
                    placeholder="312611...44 dígitos..."
                    maxLength={50}
                    value={form.access_key}
                    onChange={(e) => setForm({ ...form, access_key: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Protocolo SEFAZ (15 dígitos)</Label>
                  <Input
                    className="h-9 mt-1 font-mono text-xs font-semibold text-primary"
                    placeholder="Ex: 131260001234567"
                    maxLength={25}
                    value={form.sefaz_protocol || ''}
                    onChange={(e) => setForm({ ...form, sefaz_protocol: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Natureza da Operação</Label>
                  <Select
                    value={form.operation_nature}
                    onValueChange={(v) => setForm({ ...form, operation_nature: v })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATION_NATURE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium flex items-center justify-between">
                    <span>Valor Total da NF (R$) *</span>
                    {form.total_value > 0 && (
                      <span className="text-[11px] font-mono font-semibold text-emerald-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(form.total_value)}
                      </span>
                    )}
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none pointer-events-none">
                      R$
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-9 pl-9 font-bold text-primary font-mono text-sm"
                      placeholder="0,00"
                      value={displayTotalValue}
                      onFocus={() => {
                        if (form.total_value) {
                          setDisplayTotalValue(
                            form.total_value % 1 === 0
                              ? String(form.total_value)
                              : form.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          );
                        }
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setDisplayTotalValue(raw);
                        const parsed = parseFlexibleCurrency(raw);
                        setForm((prev: any) => ({ ...prev, total_value: parsed }));
                      }}
                      onBlur={() => {
                        const parsed = parseFlexibleCurrency(displayTotalValue);
                        setForm((prev: any) => ({ ...prev, total_value: parsed }));
                        setDisplayTotalValue(
                          parsed > 0
                            ? parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : ''
                        );
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">Alienação Fiduciária / Gravame</Label>
                  <Select
                    value={form.alienacao}
                    onValueChange={(v) => setForm({ ...form, alienacao: v })}
                  >
                    <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALIENACAO_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ETAPA 4: DADOS DO COMPRADOR E DA MOTOCICLETA (AUTO-PREENCHIDOS) */}
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider">
                <Bike className="w-4 h-4 text-primary" /> 3. Comprador e Motocicleta Faturada
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Nome Completo do Cliente *</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">CPF / CNPJ do Comprador</Label>
                  <Input
                    className="h-9 mt-1 font-mono text-xs"
                    placeholder="000.000.000-00"
                    value={form.customer_document}
                    onChange={(e) => setForm({ ...form, customer_document: maskCPFCNPJ(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Modelo da Motocicleta *</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    placeholder="Ex: SHINERAY SHI 175 EFI 2026"
                    value={form.vehicle_model}
                    onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Chassi Oficial / VIN</Label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, vehicle_chassis: 'DISPENSADO' })}
                      className="text-[10px] text-amber-600 hover:underline font-semibold"
                    >
                      Sem Chassi
                    </button>
                  </div>
                  <Input
                    className="h-9 mt-1 font-mono uppercase text-xs"
                    placeholder="99H..."
                    value={form.vehicle_chassis}
                    onChange={(e) => setForm({ ...form, vehicle_chassis: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Telefone / WhatsApp</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    placeholder="(37) 99999-9999"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: maskPhone(e.target.value) })}
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Endereço Completo</Label>
                  <Input
                    className="h-9 mt-1 text-xs"
                    placeholder="Rua, Número, Bairro - Cidade/UF"
                    value={form.customer_address}
                    onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Observações Fiscais Adicionais</Label>
              <Textarea
                className="mt-1 text-xs"
                rows={2}
                placeholder="Observações complementares que constam no corpo da NF..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={upsert.isPending} className="gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> {editingInvoiceId ? 'Salvar Alterações da NF' : 'Cadastrar e Salvar NF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CANCELAMENTO CONTÁBIL DE NF */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Cancelar Nota Fiscal
            </DialogTitle>
            <DialogDescription className="text-xs">
              O cancelamento contábil preserva o histórico fiscal e registra se o cancelamento gerou estorno financeiro ou crédito de fábrica.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceToCancel && (
            <div className="space-y-3.5 text-xs py-1">
              <div className="bg-muted/50 p-3 rounded-xl space-y-1 border">
                <div className="flex justify-between font-semibold">
                  <span>NF: {selectedInvoiceToCancel.invoice_number}</span>
                  <span className="text-primary font-mono font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      Number(selectedInvoiceToCancel.total) || 0
                    )}
                  </span>
                </div>
                <div className="text-muted-foreground">Cliente: {selectedInvoiceToCancel.customer_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Emissão: {formatFiscalDate(selectedInvoiceToCancel.issue_date)}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Tipo de Cancelamento Contábil *</Label>
                <Select
                  value={cancelType}
                  onValueChange={(v: any) => setCancelType(v)}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estorno" className="text-xs">
                      Estorno Financeiro (Devolução do pagamento ao cliente)
                    </SelectItem>
                    <SelectItem value="credito" className="text-xs">
                      Crédito Fiscal na Fábrica (Compensação em compras futuras)
                    </SelectItem>
                    <SelectItem value="devolucao" className="text-xs">
                      Devolução Física da Moto
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Data do Cancelamento *</Label>
                <Input
                  type="date"
                  className="h-9 mt-1 text-xs"
                  value={cancelDate}
                  onChange={(e) => setCancelDate(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Protocolo SEFAZ do Cancelamento (opcional)</Label>
                <Input
                  className="h-9 mt-1 font-mono text-xs"
                  placeholder="Ex: 131260000..."
                  value={cancelProtocol}
                  onChange={(e) => setCancelProtocol(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Motivo do Cancelamento *</Label>
                <Textarea
                  rows={3}
                  className="mt-1 text-xs"
                  placeholder="Descreva detalhadamente a justificativa fiscal do cancelamento..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelInvoiceMutation.isPending}
              className="gap-1.5 font-semibold"
            >
              {cancelInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: ANEXAÇÃO RÁPIDA DE ARQUIVO DE NF */}
      <Dialog open={quickAttachDialogOpen} onOpenChange={setQuickAttachDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileCheck className="w-5 h-5 text-primary" />
              Anexar Arquivo à NF {selectedInvoiceForQuickAttach?.invoice_number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule o arquivo oficial (PDF ou DANFE) a esta Nota Fiscal e ao contrato do cliente.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceForQuickAttach && (
            <div className="space-y-3.5 py-2">
              <div className="bg-muted/40 p-3 rounded-xl border text-xs space-y-1">
                <p>
                  <span className="text-muted-foreground">Cliente: </span>
                  <strong className="text-foreground">{selectedInvoiceForQuickAttach.customer_name}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Emissão: </span>
                  <strong className="text-foreground">{formatFiscalDate(selectedInvoiceForQuickAttach.issue_date)}</strong>
                  {selectedInvoiceForQuickAttach.contract_number && (
                    <span className="ml-2 text-muted-foreground font-mono">
                      (Venda: {selectedInvoiceForQuickAttach.contract_number})
                    </span>
                  )}
                </p>
              </div>

              {/* Upload Zone */}
              <div
                onClick={() => quickFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  quickAttachFile
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-border/80 hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <input
                  ref={quickFileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xml"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 25 * 1024 * 1024) {
                      toast({ variant: 'destructive', title: 'Arquivo muito grande (máx 25MB)' });
                      return;
                    }
                    try {
                      const dataUrl = await readFileAsDataUrl(f);
                      const parsed = await parseInvoiceFile(f);
                      setQuickAttachFile({
                        name: f.name,
                        url: dataUrl,
                        size: f.size,
                        type: f.type || (f.name.endsWith('.xml') ? 'text/xml' : 'application/pdf'),
                        parsedAccessKey: parsed.access_key,
                        parsedProtocol: parsed.sefaz_protocol,
                      } as any);

                      if (parsed.sefaz_protocol || parsed.access_key) {
                        toast({
                          title: 'Dados Fiscais Identificados!',
                          description: `Protocolo SEFAZ: ${parsed.sefaz_protocol || 'Detectado'} | Chave: ${parsed.access_key ? 'OK' : '—'}`,
                        });
                      }
                    } catch {
                      try {
                        const dataUrl = await readFileAsDataUrl(f);
                        setQuickAttachFile({
                          name: f.name,
                          url: dataUrl,
                          size: f.size,
                          type: f.type || 'application/pdf',
                        });
                      } catch {}
                    }
                  }}
                  className="hidden"
                />

                {quickAttachFile ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="text-xs font-bold text-foreground truncate max-w-xs">{quickAttachFile.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(quickAttachFile.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <Upload className="w-8 h-8 text-primary" />
                    <p className="text-xs font-bold text-foreground">Clique para escolher o arquivo da NF</p>
                    <p className="text-[11px] text-muted-foreground">Formatos: PDF, XML ou imagens (máx 20MB)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuickAttachDialogOpen(false);
                setQuickAttachFile(null);
                setSelectedInvoiceForQuickAttach(null);
              }}
              className="text-xs"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={!quickAttachFile || isQuickSaving}
              onClick={handleSaveQuickAttachment}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <FileCheck className="w-3.5 h-3.5" />
              {isQuickSaving ? 'Salvando...' : 'Salvar Anexo da NF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* DIÁLOGO: VISUALIZADOR INTEGRADO DE ARQUIVO DA NF */}
      <Dialog open={Boolean(viewingAttachment)} onOpenChange={(v) => !v && setViewingAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-4">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Visualizar Anexo — NF {viewingAttachment?.invoiceNumber} ({viewingAttachment?.customerName})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs truncate">
              {viewingAttachment?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-[65vh] max-h-[75vh] w-full overflow-hidden flex items-center justify-center bg-muted/20 rounded-lg p-2">
            {viewingAttachment?.url?.startsWith('data:image/') || viewingAttachment?.name?.match(/\.(png|jpe?g|webp)$/i) ? (
              <img
                src={viewingAttachment.url}
                alt={viewingAttachment.name}
                className="max-h-[72vh] max-w-full object-contain rounded shadow-sm"
              />
            ) : viewingAttachment?.name?.endsWith('.xml') || viewingAttachment?.type?.includes('xml') ? (
              <div className="w-full h-full min-h-[65vh] max-h-[72vh] overflow-auto bg-slate-950 text-slate-100 p-4 rounded-lg font-mono text-xs select-text whitespace-pre-wrap">
                {viewingAttachment.url.startsWith('data:')
                  ? (() => {
                      try {
                        const base64 = viewingAttachment.url.split(',')[1];
                        return decodeURIComponent(escape(atob(base64)));
                      } catch {
                        return viewingAttachment.url;
                      }
                    })()
                  : 'Arquivo XML anexado e pronto para download.'}
              </div>
            ) : (
              <iframe
                src={viewingAttachment?.url}
                title={viewingAttachment?.name}
                className="w-full h-full min-h-[65vh] rounded border bg-white"
              />
            )}
          </div>

          <DialogFooter className="pt-2 border-t flex sm:justify-between items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewingAttachment(null)} className="text-xs">
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!viewingAttachment) return;
                const a = document.createElement('a');
                a.href = viewingAttachment.url;
                a.download = viewingAttachment.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="gap-1.5 font-bold text-xs"
            >
              <Download className="w-3.5 h-3.5" /> Baixar Arquivo da NF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CONFIRMAÇÃO DE EXCLUSÃO DE NOTA FISCAL */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-bold">
              <Trash2 className="w-5 h-5 text-rose-600" />
              Excluir Nota Fiscal Nº {selectedInvoiceToDelete?.invoice_number}?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação excluirá permanentemente esta NF do sistema e da nuvem. O registro contábil e o anexo serão removidos de forma definitiva.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceToDelete && (
            <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1.5 my-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <strong className="font-mono text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedInvoiceToDelete.total || 0)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">{selectedInvoiceToDelete.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concessionária:</span>
                <span className="text-foreground">{selectedInvoiceToDelete.store?.name || 'Não informada'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data da Emissão:</span>
                <span className="font-mono">{formatFiscalDate(selectedInvoiceToDelete.issue_date)}</span>
              </div>
              {selectedInvoiceToDelete.sefaz_protocol && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocolo SEFAZ:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{selectedInvoiceToDelete.sefaz_protocol}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedInvoiceToDelete(null);
              }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={del.isPending}
              className="font-bold rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {del.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Sim, Excluir Definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
