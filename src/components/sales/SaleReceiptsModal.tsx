import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  X,
  FileCheck2,
  Bike,
  User,
  DollarSign,
  ShieldCheck,
  FileText,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FilePlus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ReceiptAttachmentManager,
  getSaleReceipts,
} from '@/components/sales/ReceiptAttachmentManager';
import {
  cloudAttachInvoiceToSale,
  cloudDetachInvoiceFromSale,
  fetchCloudInvoices,
  type RegisteredInvoice,
} from '@/lib/cloudSalesSync';
import { getLocalTodayDateString, formatFiscalDate } from '@/lib/fiscalDates';

interface SaleReceiptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    id: string;
    contract_number?: string;
    buyer_name?: string;
    buyer_cpf?: string;
    buyer_phone?: string;
    buyer_email?: string;
    buyer_address?: string;
    sale_price?: number;
    status?: string;
    vehicle?: {
      brand?: string;
      model?: string;
      year?: number;
      plate?: string | null;
      chassis?: string | null;
      color?: string;
    };
    external_data?: Record<string, unknown> | null;
  };
  vehicleName?: string;
  defaultTab?: 'nf' | 'receipts';
}

export function SaleReceiptsModal({
  open,
  onOpenChange,
  sale,
  vehicleName,
  defaultTab = 'receipts',
}: SaleReceiptsModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'nf' | 'receipts'>(defaultTab);
  const [receiptCount, setReceiptCount] = useState(0);

  // Estados da NF
  const [isEditingNf, setIsEditingNf] = useState(false);
  const [isSavingNf, setIsSavingNf] = useState(false);
  const [isDetachingNf, setIsDetachingNf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Dados da NF atual
  const ext = (sale.external_data || {}) as Record<string, any>;
  const [currentNf, setCurrentNf] = useState<{
    invoice_number?: string;
    series?: string;
    issue_date?: string;
    attachment_name?: string;
    attachment_url?: string;
    attachment_size?: number;
    attachment_type?: string;
  }>({});

  // Formulário de Nova NF / Edição
  const [nfNumber, setNfNumber] = useState('');
  const [nfSeries, setNfSeries] = useState('1');
  const [nfIssueDate, setNfIssueDate] = useState(getLocalTodayDateString());
  const [nfNotes, setNfNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    url: string;
    size: number;
    type: string;
  } | null>(null);

  const displayVehicle =
    vehicleName ||
    (sale.vehicle
      ? `${sale.vehicle.brand || ''} ${sale.vehicle.model || ''} ${sale.vehicle.year || ''}`.trim()
      : (sale.external_data as any)?.vehicle_model_custom || 'Veículo');

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(sale.sale_price) || 0);

  // Sincroniza estado inicial ao abrir
  useEffect(() => {
    if (open && sale.id) {
      setActiveTab(defaultTab);
      const currentReceipts = getSaleReceipts(sale.id);
      setReceiptCount(currentReceipts.length);

      // Carrega dados da NF do contrato e da lista de NFs
      const contractNf = {
        invoice_number: ext.invoice_number,
        series: ext.invoice_series || '1',
        issue_date: ext.invoice_date || ext.invoice_registered_at?.slice(0, 10),
        attachment_name: ext.invoice_name,
        attachment_url: ext.invoice_url,
        attachment_size: ext.invoice_size,
        attachment_type: ext.invoice_type,
      };

      // Tenta cruzar com lista de NFs global para garantir dados mais recentes
      fetchCloudInvoices().then((invoices) => {
        const matching = invoices.find(
          (inv) => inv.sale_id === sale.id || (sale.contract_number && inv.contract_number === sale.contract_number)
        );
        if (matching) {
          setCurrentNf({
            invoice_number: matching.invoice_number || contractNf.invoice_number,
            series: matching.series || contractNf.series,
            issue_date: matching.issue_date || contractNf.issue_date,
            attachment_name: matching.attachment_name || contractNf.attachment_name,
            attachment_url: matching.attachment_url || contractNf.attachment_url,
            attachment_size: matching.attachment_size || contractNf.attachment_size,
            attachment_type: matching.attachment_type || contractNf.attachment_type,
          });
          setNfNumber(matching.invoice_number || '');
          setNfSeries(matching.series || '1');
          setNfIssueDate(matching.issue_date || getLocalTodayDateString());
        } else {
          setCurrentNf(contractNf);
          setNfNumber(contractNf.invoice_number || '');
          setNfSeries(contractNf.series || '1');
          setNfIssueDate(contractNf.issue_date || getLocalTodayDateString());
        }
      });

      setSelectedFile(null);
      setIsEditingNf(false);
    }
  }, [open, sale.id, defaultTab]);

  // Processa arquivo selecionado
  const processFile = (file: File) => {
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
      setSelectedFile({
        name: file.name,
        url: reader.result as string,
        size: file.size,
        type: file.type || 'application/pdf',
      });
      // Sugere número da NF se o nome do arquivo contiver dígitos (ex: NF_12345.pdf)
      const numMatch = file.name.match(/\b\d{4,9}\b/);
      if (numMatch && !nfNumber) {
        setNfNumber(numMatch[0]);
      }
      toast({
        title: 'Arquivo carregado!',
        description: `${file.name} pronto para anexação.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Salva ou atualiza a anexação da NF
  const handleSaveInvoiceAttachment = async () => {
    if (!nfNumber.trim()) {
      toast({
        variant: 'destructive',
        title: 'Número da NF obrigatório',
        description: 'Por favor, informe o número da Nota Fiscal.',
      });
      return;
    }

    const finalAttachmentUrl = selectedFile?.url || currentNf.attachment_url;
    const finalAttachmentName = selectedFile?.name || currentNf.attachment_name;
    const finalAttachmentSize = selectedFile?.size || currentNf.attachment_size;
    const finalAttachmentType = selectedFile?.type || currentNf.attachment_type;

    if (!finalAttachmentUrl) {
      toast({
        variant: 'destructive',
        title: 'Arquivo da NF necessário',
        description: 'Selecione ou arraste o arquivo PDF/DANFE da Nota Fiscal.',
      });
      return;
    }

    // Atualiza imediatamente a visualização local (0ms)
    setCurrentNf({
      invoice_number: nfNumber.trim(),
      series: nfSeries.trim() || '1',
      issue_date: nfIssueDate,
      attachment_name: finalAttachmentName,
      attachment_url: finalAttachmentUrl,
      attachment_size: finalAttachmentSize,
      attachment_type: finalAttachmentType,
    });
    setIsEditingNf(false);
    setSelectedFile(null);

    toast({
      title: 'Nota Fiscal Anexada com Sucesso!',
      description: `NF ${nfNumber.trim()} vinculada a esta venda e sincronizada para toda a equipe.`,
    });

    setIsSavingNf(true);
    try {
      await cloudAttachInvoiceToSale(sale.id, {
        invoice_number: nfNumber.trim(),
        series: nfSeries.trim() || '1',
        issue_date: nfIssueDate || getLocalTodayDateString(),
        attachment_name: finalAttachmentName || `NF_${nfNumber.trim()}.pdf`,
        attachment_url: finalAttachmentUrl,
        attachment_size: finalAttachmentSize,
        attachment_type: finalAttachmentType,
        notes: nfNotes.trim() || undefined,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Aviso na sincronização em nuvem da NF',
        description: e?.message || 'Tente novamente.',
      });
    } finally {
      setIsSavingNf(false);
    }
  };

  // Baixar arquivo oficial da NF
  const handleDownloadNf = () => {
    if (!currentNf.attachment_url) return;
    const a = document.createElement('a');
    a.href = currentNf.attachment_url;
    a.download =
      currentNf.attachment_name ||
      `NF_${currentNf.invoice_number || 'venda'}_${(sale.buyer_name || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Remover anexo da NF
  const handleDetachNf = async () => {
    if (!window.confirm('Deseja realmente desanexar o arquivo desta Nota Fiscal?')) return;
    setIsDetachingNf(true);
    try {
      const ok = await cloudDetachInvoiceFromSale(sale.id);
      if (ok) {
        setCurrentNf((prev) => ({
          ...prev,
          attachment_name: undefined,
          attachment_url: undefined,
          attachment_size: undefined,
          attachment_type: undefined,
        }));
        setSelectedFile(null);
        toast({
          title: 'Anexo removido',
          description: 'O arquivo da NF foi desvinculado desta venda.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover anexo',
        description: err?.message || 'Falha ao processar.',
      });
    } finally {
      setIsDetachingNf(false);
    }
  };

  const hasAttachedNf = Boolean(currentNf.attachment_url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Paperclip className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Documentação & Anexos da Venda</span>
                  {sale.contract_number && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {sale.contract_number}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Anexe a Nota Fiscal oficial (DANFE) e os comprovantes de pagamento (PIX/TED/Boletos)
                </DialogDescription>
              </div>
            </div>

            <Badge
              variant="secondary"
              className="text-[11px] font-semibold uppercase tracking-wider shrink-0"
            >
              {sale.status === 'concluido'
                ? 'Quitada'
                : sale.status === 'pre_venda'
                  ? 'Pré-venda'
                  : 'Pendente'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Resumo do Negócio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/70 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-muted-foreground block">Cliente</span>
              <span className="font-semibold text-foreground truncate block">
                {sale.buyer_name || 'Não informado'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Bike className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-muted-foreground block">Veículo</span>
              <span className="font-semibold text-foreground truncate block">
                {displayVehicle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-[10px] text-muted-foreground block">Valor Total</span>
              <span className="font-bold text-foreground">
                {formattedPrice}
              </span>
            </div>
          </div>
        </div>

        {/* ABAS: NOTA FISCAL (NF) vs COMPROVANTES DE PAGAMENTO */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="nf"
              className="flex items-center gap-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs py-2"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>1. Nota Fiscal (NF)</span>
              {hasAttachedNf && (
                <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-600 hover:bg-emerald-700">
                  Anexada
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="receipts"
              className="flex items-center gap-2 text-xs font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs py-2"
            >
              <Paperclip className="w-4 h-4 text-primary" />
              <span>2. Comprovantes (PIX/TED)</span>
              {receiptCount > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono font-bold">
                  {receiptCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: NOTA FISCAL (NF) */}
          <TabsContent value="nf" className="space-y-4 pt-3 focus-visible:outline-hidden">
            {hasAttachedNf && !isEditingNf ? (
              /* CARD DE NF ANEXADA COM SUCESSO */
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          Nota Fiscal nº {currentNf.invoice_number || 'Sem número'}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                          Série {currentNf.series || '1'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Emissão: <strong>{formatFiscalDate(currentNf.issue_date)}</strong>
                      </p>
                    </div>
                  </div>

                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    NF Vinculada
                  </Badge>
                </div>

                {/* Arquivo Anexado */}
                <div className="rounded-lg border bg-background/80 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 truncate">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {currentNf.attachment_name || `NF_${currentNf.invoice_number}.pdf`}
                      </p>
                      {currentNf.attachment_size ? (
                        <p className="text-[10px] text-muted-foreground">
                          {(currentNf.attachment_size / 1024).toFixed(1)} KB
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={handleDownloadNf}
                      className="h-8 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      title="Baixar arquivo da Nota Fiscal"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar NF
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingNf(true)}
                      className="h-8 text-xs font-medium gap-1"
                      title="Substituir arquivo ou atualizar dados da NF"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Substituir
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleDetachNf}
                      disabled={isDetachingNf}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Remover anexo da NF"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Sincronizada em tempo real com a Central de Notas Fiscais (/moto-invoices).</span>
                </div>
              </div>
            ) : (
              /* FORMULÁRIO DE ANEXAÇÃO / UPLOAD DE NF */
              <div className="space-y-4">
                {/* Zona de Drop / Seleção de Arquivo */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-primary bg-primary/10'
                      : selectedFile
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-border/80 hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.xml"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-foreground truncate max-w-sm">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        Clique ou arraste o arquivo da Nota Fiscal (DANFE)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Formatos aceitos: PDF, XML ou imagens (máx. 20MB)
                      </p>
                    </div>
                  )}
                </div>

                {/* Campos Fiscais */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Número da NF *</Label>
                    <Input
                      value={nfNumber}
                      onChange={(e) => setNfNumber(e.target.value)}
                      placeholder="Ex: 98765"
                      className="h-9 text-xs font-mono font-bold mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Série</Label>
                    <Input
                      value={nfSeries}
                      onChange={(e) => setNfSeries(e.target.value)}
                      placeholder="1"
                      className="h-9 text-xs font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Data de Emissão *</Label>
                    <Input
                      type="date"
                      value={nfIssueDate}
                      onChange={(e) => setNfIssueDate(e.target.value)}
                      className="h-9 text-xs font-mono mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Observações / Chave de Acesso (Opcional)</Label>
                  <Input
                    value={nfNotes}
                    onChange={(e) => setNfNotes(e.target.value)}
                    placeholder="Ex: Chave de 44 dígitos da SEFAZ ou observação fiscal"
                    className="h-9 text-xs mt-1"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {isEditingNf ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingNf(false);
                        setSelectedFile(null);
                      }}
                      className="text-xs text-muted-foreground"
                    >
                      Cancelar Edição
                    </Button>
                  ) : <div />}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveInvoiceAttachment}
                    disabled={isSavingNf || (!selectedFile && !currentNf.attachment_url)}
                    className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ml-auto"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    {isSavingNf ? 'Salvando e Anexando...' : 'Salvar e Anexar Nota Fiscal'}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ABA 2: COMPROVANTES DE PAGAMENTO (PIX/TED/BOLETOS) */}
          <TabsContent value="receipts" className="pt-2 focus-visible:outline-hidden">
            <ReceiptAttachmentManager
              saleId={sale.id}
              saleTitle={sale.buyer_name}
              onReceiptsChange={(items) => setReceiptCount(items.length)}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex sm:justify-between items-center border-t border-border/60 pt-3 mt-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Documentos vinculados permanentemente para auditoria da concessionária</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
