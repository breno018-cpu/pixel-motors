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
  RotateCcw,
} from 'lucide-react';
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
import { maskCPFCNPJ, maskPhone, maskCurrency, parseCurrency } from '@/lib/masks';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { getLocalTodayDateString, normalizeDateToYMD, formatFiscalDate } from '@/lib/fiscalDates';
import { cloudAttachInvoiceToSale } from '@/lib/cloudSalesSync';

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
  const { data: stores = [] } = useStores();
  const { data: vehicles = [] } = useVehicles();
  const { data: allContracts = [] } = useContracts();
  const { data: invoices = [], isLoading } = useInvoices();
  const upsert = useUpsertInvoice();
  const cancelInvoiceMutation = useCancelInvoice();
  const del = useDeleteInvoice();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos Diálogos
  const [open, setOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedInvoiceToCancel, setSelectedInvoiceToCancel] = useState<Invoice | null>(null);
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
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  // Formulário de Cadastro Semi-Manual de NF
  const initialForm = {
    invoice_number: '',
    series: '1',
    access_key: '',
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

    toast({
      title: 'Venda vinculada!',
      description: `Dados de ${sale.buyer_name} e da moto ${motoModel} preenchidos.`,
    });
  };

  // Upload e leitura do arquivo da NF como DataURL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido para o anexo da NF é de 20MB.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        url: reader.result as string,
        size: file.size,
        type: file.type || 'application/pdf',
      });
      toast({
        title: 'Arquivo da NF anexado com sucesso!',
        description: `${file.name} (${(file.size / 1024).toFixed(1)} KB) pronto para ser salvo.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submissão do cadastro semi-manual de NF
  const submit = async () => {
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

    const payload = {
      ...form,
      invoice_number: cleanNum,
      series: form.series || '1',
      access_key: form.access_key?.replace(/\D/g, '') || undefined,
      issue_date: normalizedDate,
      store_name: storeName,
      vehicle_chassis: cleanChassis,
      total_value: Number(form.total_value) || 0,
      attachment_name: attachedFile?.name,
      attachment_url: attachedFile?.url,
      attachment_size: attachedFile?.size,
      attachment_type: attachedFile?.type,
      notes: `[${TYPE_TAG}] ${form.vehicle_model || 'Moto'} - Chassi: ${cleanChassis || 'S/ Chassi'}${form.alienacao ? ` | Alienação: ${form.alienacao}` : ''}${form.notes ? ` — ${form.notes}` : ''}`,
      items: [
        {
          description: `${form.vehicle_brand || 'SHINERAY'} ${form.vehicle_model || 'Motocicleta'} (Chassi: ${cleanChassis || 'Não informado'})`,
          quantity: 1,
          unit_value: Number(form.total_value) || 0,
          chassis: cleanChassis,
          contract_number: form.contract_number,
          sale_id: form.sale_id,
        },
      ],
    };

    // Fecha o modal e reseta formulário imediatamente para feedback instantâneo (0ms)
    setOpen(false);
    setForm(initialForm);
    setAttachedFile(null);
    setSelectedSaleId('');

    try {
      await upsert.mutateAsync(payload);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar NF',
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
    try {
      await cancelInvoiceMutation.mutateAsync({
        id: selectedInvoiceToCancel.id,
        cancellation_date: cancelDate,
        cancellation_reason: cancelReason,
        cancellation_type: cancelType,
        sefaz_protocol: cancelProtocol || undefined,
      });
      setCancelDialogOpen(false);
      setSelectedInvoiceToCancel(null);
      setCancelReason('');
      setCancelProtocol('');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar NF',
        description: e?.message || 'Tente novamente.',
      });
    }
  };

  // Download do arquivo anexado da NF
  const handleDownloadAttachment = (inv: Invoice) => {
    if (!inv.attachment_url) {
      toast({
        variant: 'destructive',
        title: 'Sem anexo',
        description: 'Esta Nota Fiscal não possui arquivo anexado.',
      });
      return;
    }

    const a = document.createElement('a');
    a.href = inv.attachment_url;
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

    setIsQuickSaving(true);
    try {
      const inv = selectedInvoiceForQuickAttach;
      const chassiMatch = (inv.notes || '').match(/Chassi:\s*([^\s|]+)/i);
      const vehicleDesc = inv.items?.[0]?.description || '';
      const vehicleModel = vehicleDesc.replace(/\(Chassi:.*\)/, '').trim();

      await upsert.mutateAsync({
        ...inv,
        vehicle_model: vehicleModel || 'SHINERAY',
        vehicle_chassis: chassiMatch?.[1] || '',
        attachment_name: quickAttachFile.name,
        attachment_url: quickAttachFile.url,
        attachment_size: quickAttachFile.size,
        attachment_type: quickAttachFile.type,
      });

      // Se a NF estiver vinculada a uma venda, sincroniza o contrato da venda também
      if (inv.sale_id) {
        await cloudAttachInvoiceToSale(inv.sale_id, {
          invoice_number: inv.invoice_number,
          series: inv.series || '1',
          issue_date: inv.issue_date,
          attachment_name: quickAttachFile.name,
          attachment_url: quickAttachFile.url,
          attachment_size: quickAttachFile.size,
          attachment_type: quickAttachFile.type,
        });
      }

      toast({
        title: 'Arquivo Anexado com Sucesso!',
        description: `O arquivo ${quickAttachFile.name} foi vinculado à NF ${inv.invoice_number}.`,
      });
      setQuickAttachDialogOpen(false);
      setQuickAttachFile(null);
      setSelectedInvoiceForQuickAttach(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao anexar arquivo',
        description: err?.message || 'Tente novamente.',
      });
    } finally {
      setIsQuickSaving(false);
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
          <Button
            size="sm"
            onClick={() => {
              setForm(initialForm);
              setAttachedFile(null);
              setSelectedSaleId('');
              setOpen(true);
            }}
            className="gap-1.5 font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Cadastrar Nova NF
          </Button>
        }
      />

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Número / Série</TableHead>
                <TableHead className="font-semibold">Data Emissão</TableHead>
                <TableHead className="font-semibold">Loja</TableHead>
                <TableHead className="font-semibold">Venda Vinculada</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Motocicleta / Chassi</TableHead>
                <TableHead className="text-right font-semibold">Valor da NF</TableHead>
                <TableHead className="text-center font-semibold">Arquivo Anexo</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold w-36">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    Carregando notas fiscais em nuvem...
                  </TableCell>
                </TableRow>
              ) : motoInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-base font-semibold text-foreground">
                        Nenhuma Nota Fiscal cadastrada no momento
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        As notas fiscais são cadastradas de forma semi-manual. Mesmo com vendas registradas, as NFs só aparecem aqui quando você cadastrar, selecionar a loja, vincular a venda e anexar a NF.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => {
                          setForm(initialForm);
                          setAttachedFile(null);
                          setSelectedSaleId('');
                          setOpen(true);
                        }}
                        className="gap-1.5 font-semibold mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Cadastrar Primeira NF
                      </Button>
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
                      <TableCell>
                        <div className="font-mono font-bold text-sm text-foreground">
                          NF {inv.invoice_number}
                        </div>
                        {inv.series && (
                          <div className="text-[11px] text-muted-foreground">Série {inv.series}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {formatFiscalDate(inv.issue_date)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {inv.store?.name || 'Concessionária'}
                      </TableCell>
                      <TableCell>
                        {inv.contract_number ? (
                          <Badge variant="outline" className="font-mono text-[11px] font-semibold bg-primary/5 text-primary border-primary/20">
                            {inv.contract_number}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Venda direta</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-foreground">{inv.customer_name}</div>
                        {inv.customer_document && (
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {maskCPFCNPJ(inv.customer_document)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="text-xs font-medium truncate text-foreground">
                          {firstItem?.description || (inv.notes || '').replace(`[${TYPE_TAG}]`, '').trim()}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          Chassi: {effectiveChassis}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          Number(inv.total) || 0
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasAttachment ? (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadAttachment(inv)}
                              className="h-7 text-[11px] font-semibold gap-1 px-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15"
                              title={inv.attachment_name || 'Baixar arquivo da NF'}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="max-w-[80px] truncate">{inv.attachment_name || 'Ver NF'}</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedInvoiceForQuickAttach(inv);
                                setQuickAttachFile(null);
                                setQuickAttachDialogOpen(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Substituir arquivo desta NF"
                            >
                              <Upload className="w-3 h-3" />
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
                            className="h-7 text-[11px] font-semibold gap-1 px-2 border-dashed border-primary/40 text-primary hover:bg-primary/10"
                            title="Anexar arquivo oficial desta Nota Fiscal"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Anexar NF</span>
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.status === 'cancelada' ? (
                          <div className="space-y-0.5">
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              Cancelada
                            </Badge>
                            <div className="text-[10px] text-muted-foreground">
                              {inv.cancellation_type === 'credito' ? 'Crédito' : 'Estorno'}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="default" className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700">
                            Emitida
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasAttachment && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                              title="Baixar arquivo oficial da NF anexada"
                              onClick={() => handleDownloadAttachment(inv)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            title="Gerar DANFE / PDF do sistema"
                            onClick={() => downloadInvoicePDF(inv)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-amber-500"
                            title="Baixar PNG de solicitação de emissão"
                            onClick={() => emitPng(inv)}
                          >
                            <ImageDown className="w-4 h-4" />
                          </Button>
                          {inv.status !== 'cancelada' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedInvoiceToCancel(inv);
                                setCancelDialogOpen(true);
                              }}
                              className="h-8 w-8 text-destructive/80 hover:text-destructive"
                              title="Cancelar Nota Fiscal"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Excluir cadastro da NF"
                            onClick={async () => {
                              if (window.confirm(`Deseja realmente remover o registro da NF ${inv.invoice_number}?`)) {
                                await del.mutateAsync(inv.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIÁLOGO: CADASTRO SEMI-MANUAL DE NOTA FISCAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="w-5 h-5 text-primary" /> Cadastrar Nova Nota Fiscal (Semi-Manual)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione a loja e a venda realizada para preencher os dados cadastrais da moto e do comprador automaticamente, e anexe o arquivo oficial da NF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm py-2">
            {/* ETAPA 1 & 2: SELEÇÃO DA LOJA E DA VENDA REALIZADA */}
            <div className="bg-muted/40 border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-primary" /> 1. Loja e Venda Vinculada
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
                <div className="sm:col-span-2">
                  <Label className="text-xs font-medium">Chave de Acesso da NFe (44 dígitos - opcional)</Label>
                  <Input
                    className="h-9 mt-1 font-mono text-xs"
                    placeholder="312611...44 dígitos..."
                    maxLength={50}
                    value={form.access_key}
                    onChange={(e) => setForm({ ...form, access_key: e.target.value })}
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
                  <Label className="text-xs font-medium">Valor Total da NF (R$) *</Label>
                  <Input
                    className="h-9 mt-1 font-bold text-primary font-mono"
                    placeholder="R$ 0,00"
                    value={form.total_value ? maskCurrency(form.total_value) : ''}
                    onChange={(e) => setForm({ ...form, total_value: parseCurrency(e.target.value) })}
                  />
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

            {/* ETAPA 5: ANEXO DO ARQUIVO DA NOTA FISCAL */}
            <div className="bg-muted/30 border-2 border-dashed rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider">
                  <Paperclip className="w-4 h-4 text-primary" /> 4. Anexar Arquivo da Nota Fiscal (PDF ou Imagem)
                </div>
                {attachedFile && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                    Arquivo Carregado
                  </Badge>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.xml"
                onChange={handleFileUpload}
                className="hidden"
              />

              {!attachedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer py-6 flex flex-col items-center justify-center gap-2 text-center hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Clique aqui para selecionar o arquivo da Nota Fiscal
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Formatos aceitos: PDF oficial, DANFE digitalizada (PNG/JPG) ou XML (Máx. 20MB)
                  </div>
                </div>
              ) : (
                <div className="bg-background border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate text-xs">
                      <div className="font-semibold text-foreground truncate">{attachedFile.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {(attachedFile.size / 1024).toFixed(1)} KB • {attachedFile.type || 'Documento'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 text-xs px-2"
                    >
                      Trocar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveAttachment}
                      className="h-8 text-xs text-destructive hover:text-destructive px-2"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              )}
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
              <CheckCircle2 className="w-4 h-4" /> Cadastrar e Salvar NF
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
              Confirmar Cancelamento
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
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 20 * 1024 * 1024) {
                      toast({ variant: 'destructive', title: 'Arquivo muito grande (máx 20MB)' });
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setQuickAttachFile({
                        name: f.name,
                        url: reader.result as string,
                        size: f.size,
                        type: f.type || 'application/pdf',
                      });
                    };
                    reader.readAsDataURL(f);
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
    </div>
  );
}
