import { useState, useMemo } from 'react';
import { Plus, FileText, Download, Trash2, Bike, ImageDown, XCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStores } from '@/hooks/useStores';
import { useVehicles } from '@/hooks/useVehicles';
import { useInvoices, useUpsertInvoice, useCancelInvoice, useDeleteInvoice, InvoiceItem } from '@/hooks/useInvoices';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { maskCPFCNPJ, maskPhone, maskCurrency, parseCurrency } from '@/lib/masks';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';

const TYPE_TAG = 'moto';

const ALIENACAO_OPTIONS = [
  'À VISTA',
  'ALTIS FINANCIAMENTOS',
  'MOTRIX FINANCEIRA',
  'BANCO PAN',
  'BRADESCO FINANCIAMENTOS',
  'SANTANDER FINANCIAMENTOS',
  'BV FINANCEIRA',
];

export default function MotoInvoices() {
  const { data: stores = [] } = useStores();
  const { data: vehicles = [] } = useVehicles();
  const { data: invoices = [], isLoading } = useInvoices();
  const upsert = useUpsertInvoice();
  const cancelInvoiceMutation = useCancelInvoice();
  const del = useDeleteInvoice();
  const { toast } = useToast();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedInvoiceToCancel, setSelectedInvoiceToCancel] = useState<any>(null);
  const [cancelDate, setCancelDate] = useState(new Date().toISOString().slice(0, 10));
  const [cancelReason, setCancelReason] = useState('');
  const [cancelType, setCancelType] = useState<'estorno' | 'credito' | 'devolucao'>('estorno');
  const [cancelProtocol, setCancelProtocol] = useState('');

  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status !== 'vendido'),
    [vehicles],
  );

  const motoInvoices = useMemo(
    () => invoices.filter((i) => (i.notes || '').includes(`[${TYPE_TAG}]`)),
    [invoices],
  );

  const [open, setOpen] = useState(false);
  const empty = {
    invoice_type: 'produto' as const,
    customer_name: '',
    customer_document: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    store_id: 'store-divinopolis',
    tax_rate: 0,
    chassi: '',
    alienacao: 'À VISTA',
    items: [{ description: 'SHINERAY FREE 150 2025/2026', quantity: 1, unit_value: 12990 }] as InvoiceItem[],
    notes: `[${TYPE_TAG}] `,
  };
  const [form, setForm] = useState<any>(empty);

  const subtotal = (form.items as InvoiceItem[]).reduce(
    (s, i) => s + Number(i.quantity || 0) * Number(i.unit_value || 0), 0,
  );
  const taxValue = subtotal * (Number(form.tax_rate) / 100);
  const total = subtotal + taxValue;

  const updateItem = (idx: number, field: keyof InvoiceItem, value: any) => {
    const items = [...form.items];
    (items[idx] as any)[field] = value;
    setForm({ ...form, items });
  };

  const handleSelectStockVehicle = (vehId: string) => {
    const v = availableVehicles.find((x) => x.id === vehId);
    if (!v) return;
    setForm({
      ...form,
      store_id: v.store_id || form.store_id,
      chassi: v.chassis || '',
      items: [
        {
          description: `${v.brand} ${v.model} ${v.year} (${v.color || 'Preta'}) - Chassi ${v.chassis}`,
          quantity: 1,
          unit_value: Number(v.sale_price) || 0,
        },
      ],
    });
  };

  const submit = async () => {
    if (!form.customer_name?.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do cliente.' });
      return;
    }
    if (!form.store_id) {
      toast({ variant: 'destructive', title: 'Selecione a loja emissora.' });
      return;
    }
    if (!form.items?.length || !form.items[0]?.description?.trim()) {
      toast({ variant: 'destructive', title: 'Informe a descrição da motocicleta.' });
      return;
    }

    const extraInfo = [
      form.chassi ? `Chassi: ${form.chassi}` : '',
      form.alienacao ? `Alienação: ${form.alienacao}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const rawNotes = form.notes?.includes(`[${TYPE_TAG}]`)
      ? form.notes
      : `[${TYPE_TAG}] ${form.notes || ''}`;
    const notes = extraInfo ? `${rawNotes.trim()} — ${extraInfo}` : rawNotes;

    const { chassi: _c, alienacao: _a, ...payload } = form;
    await upsert.mutateAsync({ ...payload, notes });
    toast({ title: 'Nota Fiscal emitida!', description: `NF registrada para ${form.customer_name}.` });
    setForm(empty);
    setOpen(false);
  };

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
      toast({
        title: 'Nota Fiscal cancelada com sucesso',
        description: `NF ${selectedInvoiceToCancel.invoice_number} registrada como cancelada (${cancelType === 'credito' ? 'Crédito Fiscal na Fábrica' : 'Estorno Financeiro'}).`,
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

  const emitPng = async (inv: any) => {
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
          chassi: chassiMatch ? chassiMatch[1].trim() : '',
          modeloMoto: firstItem?.description || '',
          valorNF: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.total || 0),
          alienacao: alienacaoMatch ? alienacaoMatch[1].trim() : 'À VISTA',
        },
        `solicitacao-nf-${inv.invoice_number || 'moto'}.png`,
      );
      toast({ title: 'PNG gerado', description: 'Solicitação de emissão baixada.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Falha ao gerar PNG', description: e?.message });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="NF de Motos"
        description="Solicitações de faturamento e notas fiscais de motos das lojas de Montes Claros e Divinópolis."
        actions={<Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 font-semibold"><Plus className="w-3.5 h-3.5" /> Nova NF de Moto</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motocicleta / Observações</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : motoInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma NF de moto emitida</TableCell></TableRow>
              ) : motoInvoices.map((inv) => {
                const firstItem = (inv.items || [])[0];
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs">{new Date(inv.issue_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{inv.customer_name}</div>
                      {inv.customer_document && <div className="text-xs text-muted-foreground font-mono">{inv.customer_document}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                      {firstItem?.description || (inv.notes || '').replace(`[${TYPE_TAG}]`, '').trim()}
                    </TableCell>
                    <TableCell className="text-xs">{inv.store?.name || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(inv.total) || 0)}
                    </TableCell>
                    <TableCell>
                      {inv.status === 'cancelada' ? (
                        <div className="space-y-0.5">
                          <Badge variant="destructive" className="text-[10px] font-bold">Cancelada</Badge>
                          <div className="text-[10px] text-muted-foreground">
                            {inv.cancellation_type === 'credito' ? 'Crédito' : 'Estorno'}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="default" className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700">Emitida</Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex items-center gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar PDF da NF" onClick={() => downloadInvoicePDF(inv)}>
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar PNG de solicitação de emissão" onClick={() => emitPng(inv)}>
                        <ImageDown className="w-4 h-4 text-amber-500" />
                      </Button>
                      {inv.status !== 'cancelada' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoiceToCancel(inv);
                            setCancelDialogOpen(true);
                          }}
                          className="h-8 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1 px-2"
                          title="Cancelar Nota Fiscal (Estorno ou Crédito)"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bike className="w-5 h-5 text-primary" /> Emitir Nota Fiscal de Motocicleta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {/* Puxar moto do estoque */}
            <div className="bg-muted/30 border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Preencher com Motocicleta do Estoque (Opcional)</p>
                <p className="text-[11px] text-muted-foreground">Preenche modelo, chassi e valor de venda automaticamente</p>
              </div>
              <Select onValueChange={handleSelectStockVehicle}>
                <SelectTrigger className="h-9 w-full sm:w-[280px] text-xs bg-background">
                  <SelectValue placeholder="Escolher moto em estoque..." />
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.brand} {v.model} ({v.chassis ? (v.chassis.length > 6 ? v.chassis.slice(-6) : v.chassis) : 'S/ Chassi'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Concessionária Emissora *</Label>
                <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Chassi / VIN / Nº Série</Label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, chassi: 'DISPENSADO' })}
                    className="text-[10px] text-amber-600 hover:underline font-semibold"
                  >
                    Sem Chassi
                  </button>
                </div>
                <Input
                  className="h-9 mt-1 font-mono uppercase text-xs"
                  placeholder="Ex: 9C2... ou Nº Quadro / DISPENSADO"
                  value={form.chassi}
                  onChange={(e) => setForm({ ...form, chassi: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label className="text-xs">Alienação / Gravame na NF</Label>
                <Select value={form.alienacao} onValueChange={(v) => setForm({ ...form, alienacao: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALIENACAO_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t">
              <div>
                <Label className="text-xs">Nome Completo do Comprador *</Label>
                <Input
                  className="h-9 mt-1"
                  placeholder="Ex: João Carlos Ferreira"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">CPF / CNPJ *</Label>
                <Input
                  className="h-9 mt-1 font-mono"
                  placeholder="000.000.000-00"
                  value={form.customer_document}
                  onChange={(e) => setForm({ ...form, customer_document: maskCPFCNPJ(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  className="h-9 mt-1"
                  placeholder="(37) 99999-9999"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: maskPhone(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Endereço Completo (Rua, Nº, Cidade/UF)</Label>
                <Input
                  className="h-9 mt-1"
                  placeholder="Rua Goiás, 450, Centro - Divinópolis/MG"
                  value={form.customer_address}
                  onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Itens da Nota Fiscal (Motocicleta / Acessórios)</Label>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_value: 0 }] })}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar item
                </Button>
              </div>
              {form.items.map((it: InvoiceItem, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-7 h-9 text-xs" placeholder="Descrição (ex.: SHINERAY SHI 175 EFI 2025)" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  <Input className="col-span-2 h-9 text-xs" type="number" min={1} placeholder="Qtd" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                  <Input className="col-span-2 h-9 text-xs" placeholder="Valor unit." value={maskCurrency(String(Math.round((it.unit_value || 0) * 100)))} onChange={(e) => updateItem(idx, 'unit_value', parseCurrency(e.target.value))} />
                  <Button className="col-span-1 h-9" size="icon" variant="ghost" onClick={() => setForm({ ...form, items: form.items.filter((_: any, i: number) => i !== idx) })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="bg-muted/40 rounded-xl p-3.5 text-sm space-y-1 border">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal dos Itens</span><span>{maskCurrency(String(Math.round(subtotal * 100)))}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t text-primary"><span>Valor Total da NF</span><span>{maskCurrency(String(Math.round(total * 100)))}</span></div>
            </div>

            <div>
              <Label className="text-xs">Observações Adicionais na NF</Label>
              <Textarea className="mt-1 text-xs" rows={2} placeholder="Observações complementares..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={upsert.isPending}><FileText className="w-4 h-4 mr-1.5" /> Emitir Nota Fiscal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Cancelamento Contábil de NF */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Cancelar Nota Fiscal
            </DialogTitle>
            <DialogDescription className="text-xs">
              O cancelamento contábil preserva o histórico fiscal. A data do cancelamento define se o crédito ou estorno entra na semana/mês atual para controle da diretoria.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoiceToCancel && (
            <div className="space-y-3.5 text-xs py-1">
              <div className="bg-muted/50 p-3 rounded-xl space-y-1 border">
                <div className="flex justify-between font-semibold">
                  <span>NF: {selectedInvoiceToCancel.invoice_number}</span>
                  <span className="text-primary font-mono font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(selectedInvoiceToCancel.total) || 0)}
                  </span>
                </div>
                <div className="text-muted-foreground">Cliente: {selectedInvoiceToCancel.customer_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Emissão Original: {new Date(selectedInvoiceToCancel.issue_date).toLocaleDateString('pt-BR')}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data do Cancelamento (Competência da Semana) *</Label>
                <Input
                  type="date"
                  className="h-9 mt-1 text-xs"
                  value={cancelDate}
                  onChange={(e) => setCancelDate(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Esta data determinará em qual semana/mês o estorno/crédito será contabilizado no Painel do Dono.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Destino Financeiro do Cancelamento *</Label>
                <Select value={cancelType} onValueChange={(val: any) => setCancelType(val)}>
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estorno">Estorno Financeiro a Receber (Devolução em R$)</SelectItem>
                    <SelectItem value="credito">Crédito Fiscal na Fábrica (Abatimento em Faturamento Futuro)</SelectItem>
                    <SelectItem value="devolucao">Devolução de Mercadoria Simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Protocolo SEFAZ / Chave de Cancelamento (Opcional)</Label>
                <Input
                  className="h-9 mt-1 text-xs font-mono"
                  placeholder="Ex: 131240000000000"
                  value={cancelProtocol}
                  onChange={(e) => setCancelProtocol(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Motivo do Cancelamento *</Label>
                <Textarea
                  className="mt-1 text-xs"
                  rows={2}
                  placeholder="Ex: Desistência do cliente, erro nos dados cadastrais ou reemissão necessária..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelInvoiceMutation.isPending}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Confirmar Cancelamento Fiscal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
