import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, FileText, Megaphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/audit';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { maskCPFCNPJ, maskCurrency, maskPhone, parseCurrency } from '@/lib/masks';
import { useFinancingBanks } from '@/hooks/useFinancingBanks';
import { useActiveTemplates } from '@/hooks/useContractTemplates';
import {
  LEAD_SOURCES,
  LEAD_SOURCE_GROUPS,
  LEAD_SOURCE_GROUP_LABELS,
  getLeadSource,
} from '@/lib/leadSources';
import { cn } from '@/lib/utils';
import { AdPicker } from '@/components/ads/AdPicker';
import { ReceiptAttachmentManager } from '@/components/sales/ReceiptAttachmentManager';
import { AddressFormFields } from './AddressFormFields';

interface SaleEditDialogProps {
  sale: {
    id: string;
    buyer_name: string;
    buyer_cpf: string;
    buyer_phone: string | null;
    buyer_email: string | null;
    buyer_address: string | null;
    sale_price: number;
    down_payment: number | null;
    installments: number | null;
    installment_value: number | null;
    status: string;
    notes: string | null;
    contract_type?: string | null;
    payment_method?: string | null;
    financing_bank?: string | null;
    financing_installments?: number | null;
    financing_installment_value?: number | null;
    down_payment_pix?: number | null;
    down_payment_cash?: number | null;
    down_payment_card?: number | null;
    down_payment_card_installments?: number | null;
    lead_source?: string | null;
    lead_source_detail?: string | null;
    store_id?: string | null;
    ad_id?: string | null;
    review_status?: string | null;
    review_note?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando true, a edição é uma correção de uma venda questionada. */
  reviewMode?: boolean;
}


const PAYMENT_METHODS = [
  { value: 'avista', label: 'À vista' },
  { value: 'parcelado', label: 'Parcelado (cartão)' },
  { value: 'financiamento', label: 'Financiamento' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'misto', label: 'Misto (entrada + parcelas)' },
];

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'concluido', label: 'Concluído (quitado)' },
  { value: 'cancelado', label: 'Cancelado' },
];

const CONTRACT_TYPES = [
  { value: 'venda_carro', label: 'Venda de carro' },
  { value: 'venda_moto', label: 'Venda de moto' },
  { value: 'repasse', label: 'Repasse' },
  { value: 'generico', label: 'Genérico' },
];

function detectPaymentMethod(sale: SaleEditDialogProps['sale']): string {
  if (sale.payment_method) return sale.payment_method === 'a_vista' ? 'avista' : sale.payment_method;
  const installments = sale.installments || 0;
  const downPayment = Number(sale.down_payment || 0);
  if (installments <= 1 && downPayment === 0) return 'avista';
  if (downPayment > 0 && installments > 1) return 'misto';
  if (installments > 1) return 'parcelado';
  return 'avista';
}

export function SaleEditDialog({ sale, open, onOpenChange, reviewMode = false }: SaleEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [buyerName, setBuyerName] = useState('');
  const [buyerCpf, setBuyerCpf] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [installments, setInstallments] = useState('1');
  const [installmentValue, setInstallmentValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('avista');
  const [status, setStatus] = useState('pendente');
  const [notes, setNotes] = useState('');
  const [contractType, setContractType] = useState<string>('venda_carro');
  const [templateId, setTemplateId] = useState<string>('');
  const [financingBank, setFinancingBank] = useState('');
  const [financingInstallments, setFinancingInstallments] = useState('');
  const [financingInstallmentValue, setFinancingInstallmentValue] = useState('');
  const [downPayPix, setDownPayPix] = useState('');
  const [downPayCash, setDownPayCash] = useState('');
  const [downPayCard, setDownPayCard] = useState('');
  const [downPayCardInstallments, setDownPayCardInstallments] = useState('1');
  const [leadSource, setLeadSource] = useState('');
  const [leadSourceDetail, setLeadSourceDetail] = useState('');
  const [adId, setAdId] = useState('');
  const [storeId, setStoreId] = useState('');

  const { data: templates } = useActiveTemplates();
  const { data: banks } = useFinancingBanks();
  const activeBanks = (banks || []).filter((b) => b.is_active);
  const filteredTemplates = (templates || []).filter(
    (t) => !contractType || t.template_type === contractType,
  );

  useEffect(() => {
    if (!open) return;
    setBuyerName(sale.buyer_name || '');
    setBuyerCpf(maskCPFCNPJ(sale.buyer_cpf || ''));
    setBuyerPhone(sale.buyer_phone ? maskPhone(sale.buyer_phone) : '');
    setBuyerEmail(sale.buyer_email || '');
    setBuyerAddress(sale.buyer_address || '');
    setSalePrice(maskCurrency(Number(sale.sale_price || 0)));
    setDownPayment(maskCurrency(Number(sale.down_payment || 0)));
    setInstallments(String(sale.installments || 1));
    setInstallmentValue(maskCurrency(Number(sale.installment_value || 0)));
    setPaymentMethod(detectPaymentMethod(sale));
    setStatus(sale.status || 'pendente');
    setNotes(sale.notes || '');
    setContractType(sale.contract_type || 'venda_carro');
    setFinancingBank(sale.financing_bank || '');
    setFinancingInstallments(sale.financing_installments ? String(sale.financing_installments) : '');
    setFinancingInstallmentValue(maskCurrency(Number(sale.financing_installment_value || 0)));
    const method = detectPaymentMethod(sale);
    const pix = Number(sale.down_payment_pix || 0);
    const cash = Number(sale.down_payment_cash || 0);
    // Vendas antigas à vista não têm composição gravada: pré-preenche com o total
    if (method === 'avista' && pix + cash === 0) {
      setDownPayPix(maskCurrency(Number(sale.sale_price || 0)));
      setDownPayCash(maskCurrency(0));
    } else {
      setDownPayPix(maskCurrency(pix));
      setDownPayCash(maskCurrency(cash));
    }
    setDownPayCard(maskCurrency(Number(sale.down_payment_card || 0)));
    setDownPayCardInstallments(String(sale.down_payment_card_installments || 1));
    setLeadSource(sale.lead_source || '');
    setLeadSourceDetail(sale.lead_source_detail || '');
    setAdId(sale.ad_id || '');
    setStoreId(sale.store_id || '');

    // Carrega os dados completos do contrato direto da base (garante todos os campos de pagamento)
    (async () => {
      const { data } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', sale.id)
        .maybeSingle();
      if (!data) return;
      const c = data as any;
      setTemplateId(c.template_id || '');
      if (c.contract_type) setContractType(c.contract_type);
      if (c.payment_method) {
        setPaymentMethod(c.payment_method === 'a_vista' ? 'avista' : c.payment_method);
      }
      setInstallments(String(c.installments || 1));
      setInstallmentValue(maskCurrency(Number(c.installment_value || 0)));
      setDownPayment(maskCurrency(Number(c.down_payment || 0)));
      setFinancingBank(c.financing_bank || '');
      setFinancingInstallments(c.financing_installments ? String(c.financing_installments) : '');
      setFinancingInstallmentValue(maskCurrency(Number(c.financing_installment_value || 0)));
      const pixDb = Number(c.down_payment_pix || 0);
      const cashDb = Number(c.down_payment_cash || 0);
      const methodDb = (c.payment_method === 'a_vista' ? 'avista' : c.payment_method) || method;
      if (methodDb === 'avista' && pixDb + cashDb === 0) {
        setDownPayPix(maskCurrency(Number(c.sale_price || 0)));
        setDownPayCash(maskCurrency(0));
      } else {
        setDownPayPix(maskCurrency(pixDb));
        setDownPayCash(maskCurrency(cashDb));
      }
      setDownPayCard(maskCurrency(Number(c.down_payment_card || 0)));
      setDownPayCardInstallments(String(c.down_payment_card_installments || 1));
      setLeadSource(c.lead_source || '');
      setLeadSourceDetail(c.lead_source_detail || '');
      setAdId(c.ad_id || '');
      setStoreId(c.store_id || '');
    })();

  }, [open, sale]);

  const cashCompositionTotal = parseCurrency(downPayPix) + parseCurrency(downPayCash);
  const cashCompositionOk =
    paymentMethod !== 'avista' ||
    Math.abs(cashCompositionTotal - parseCurrency(salePrice)) < 0.01;
  const leadSourceOption = getLeadSource(leadSource);
  const leadSourceOk =
    !!leadSource && (!leadSourceOption?.requiresDetail || leadSourceDetail.trim().length >= 2);

  const update = useMutation({
    mutationFn: async () => {
      if (!cashCompositionOk) {
        throw new Error('A soma de PIX + dinheiro deve ser igual ao valor total da venda à vista.');
      }
      if (!leadSourceOk) {
        throw new Error('Informe a origem do lead (e o detalhe, quando exigido).');
      }
      const total = parseCurrency(salePrice);
      const down = parseCurrency(downPayment);
      const inst = Math.max(1, parseInt(installments || '1', 10));
      const instValue = parseCurrency(installmentValue);

      let normalizedInstallments = inst;
      let normalizedDown: number | null = down || null;
      let normalizedInstValue: number | null = instValue || null;

      if (paymentMethod === 'avista') {
        normalizedInstallments = 1;
        normalizedDown = null;
        normalizedInstValue = null;
      }

      const { error } = await supabase
        .from('contracts')
        .update({
          buyer_name: buyerName.trim(),
          buyer_cpf: buyerCpf.replace(/\D/g, ''),
          buyer_phone: buyerPhone ? buyerPhone.replace(/\D/g, '') : null,
          buyer_email: buyerEmail || null,
          buyer_address: buyerAddress || null,
          sale_price: total,
          down_payment: normalizedDown,
          installments: normalizedInstallments,
          installment_value: normalizedInstValue,
          status,
          notes: notes || null,
          contract_type: contractType || null,
          lead_source: leadSource || null,
          lead_source_detail: leadSourceDetail.trim().toUpperCase() || null,
          ad_id: adId || null,
          campaign_name: leadSource.startsWith('ANUNCIO_')
            ? leadSourceDetail.trim().toUpperCase() || null
            : null,
          template_id: templateId || null,
          payment_method: paymentMethod,
          financing_bank: paymentMethod === 'financiamento' ? (financingBank || null) : null,
          financing_installments:
            paymentMethod === 'financiamento' && financingInstallments
              ? parseInt(financingInstallments, 10)
              : null,
          financing_installment_value:
            paymentMethod === 'financiamento' ? parseCurrency(financingInstallmentValue) || null : null,
          // Estes três campos são NOT NULL no banco. Valores ausentes precisam
          // ser persistidos como zero, inclusive ao editar vendas antigas.
          down_payment_pix: parseCurrency(downPayPix) || 0,
          down_payment_cash: parseCurrency(downPayCash) || 0,
          down_payment_card: paymentMethod === 'avista' ? 0 : parseCurrency(downPayCard) || 0,
          down_payment_card_installments:
            paymentMethod !== 'avista' && parseCurrency(downPayCard) > 0
              ? Math.max(1, parseInt(downPayCardInstallments || '1', 10))
              : null,
          ...(reviewMode
            ? {
                review_status: 'corrigida',
                review_resolved_at: new Date().toISOString(),
                review_resolved_by: (await supabase.auth.getUser()).data.user?.id ?? null,
              }
            : {}),
        } as any)
        .eq('id', sale.id);
      if (error) throw error;
      logActivity('editar', 'venda', sale.id, {
        cliente: buyerName.trim(),
        pagamento: paymentMethod,
        correcao: reviewMode ? 'sim' : 'nao',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      toast({
        title: reviewMode ? 'Correção enviada' : 'Venda atualizada',
        description: reviewMode
          ? 'A venda foi corrigida e marcada como resolvida.'
          : 'Os dados da venda foram salvos com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: e.message || 'Não foi possível atualizar a venda.',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {reviewMode ? 'Ajustar proposta em revisão' : 'Editar venda (administrador)'}
          </DialogTitle>
          <DialogDescription>
            {reviewMode
              ? 'Ajuste os dados apontados na observação. Ao salvar, a venda será marcada como corrigida.'
              : 'Ação restrita: ajuste os dados desta venda, inclusive a forma de pagamento e o status.'}
          </DialogDescription>
        </DialogHeader>

        {reviewMode && sale.review_note && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Pendência apontada na revisão
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{sale.review_note}</p>
          </div>
        )}

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Comprador</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome / Razão social *</Label>
                <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CPF / CNPJ *</Label>
                <Input
                  value={buyerCpf}
                  onChange={(e) => setBuyerCpf(maskCPFCNPJ(e.target.value))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(maskPhone(e.target.value))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <AddressFormFields
                  value={buyerAddress}
                  onChange={(_addr, formatted) => setBuyerAddress(formatted)}
                  title="Endereço do Comprador"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Pagamento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pagamento *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor total *</Label>
                <Input
                  value={salePrice}
                  onChange={(e) => setSalePrice(maskCurrency(e.target.value))}
                  className="h-9"
                />
              </div>
              {paymentMethod === 'avista' && (
                <div className="sm:col-span-2 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-medium">Como a venda à vista foi paga? *</p>
                  <p className="text-[11px] text-muted-foreground">
                    Informe os valores em PIX e/ou dinheiro. A soma deve ser igual ao valor total.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">PIX</Label>
                      <Input
                        value={downPayPix}
                        onChange={(e) => setDownPayPix(maskCurrency(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Dinheiro</Label>
                      <Input
                        value={downPayCash}
                        onChange={(e) => setDownPayCash(maskCurrency(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-dashed">
                    <span className="text-muted-foreground">
                      Somatório: {maskCurrency(parseCurrency(downPayPix) + parseCurrency(downPayCash))}
                    </span>
                    <span
                      className={
                        Math.abs(parseCurrency(downPayPix) + parseCurrency(downPayCash) - parseCurrency(salePrice)) < 0.01
                          ? 'text-primary'
                          : 'text-destructive'
                      }
                    >
                      {Math.abs(parseCurrency(downPayPix) + parseCurrency(downPayCash) - parseCurrency(salePrice)) < 0.01
                        ? 'OK'
                        : 'Divergente do valor total'}
                    </span>
                  </div>
                </div>
              )}
              {paymentMethod !== 'avista' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Entrada</Label>
                    <Input
                      value={downPayment}
                      onChange={(e) => setDownPayment(maskCurrency(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Valor da parcela</Label>
                    <Input
                      value={installmentValue}
                      onChange={(e) => setInstallmentValue(maskCurrency(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2 rounded-md border border-border/60 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Como a entrada foi paga?</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">PIX</Label>
                        <Input
                          value={downPayPix}
                          onChange={(e) => setDownPayPix(maskCurrency(e.target.value))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Dinheiro</Label>
                        <Input
                          value={downPayCash}
                          onChange={(e) => setDownPayCash(maskCurrency(e.target.value))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Cartão</Label>
                        <Input
                          value={downPayCard}
                          onChange={(e) => setDownPayCard(maskCurrency(e.target.value))}
                          className="h-9"
                        />
                      </div>
                    </div>
                    {parseCurrency(downPayCard) > 0 && (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Parcelas do cartão</Label>
                        <Input
                          type="number"
                          min={1}
                          value={downPayCardInstallments}
                          onChange={(e) => setDownPayCardInstallments(e.target.value)}
                          className="h-9 w-32"
                        />
                      </div>
                    )}
                  </div>
                  {paymentMethod === 'financiamento' && (
                    <div className="sm:col-span-2 space-y-2 rounded-md border border-border/60 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Dados do financiamento</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1 sm:col-span-3">
                          <Label className="text-[11px]">Banco financiador *</Label>
                          {activeBanks.length > 0 && (
                            <div className="flex flex-wrap gap-2 pb-1">
                              {activeBanks.map((b) => (
                                <Button
                                  key={b.id}
                                  type="button"
                                  size="sm"
                                  variant={financingBank === b.name ? 'default' : 'outline'}
                                  className="h-8"
                                  onClick={() => setFinancingBank(b.name)}
                                >
                                  {b.name}
                                </Button>
                              ))}
                            </div>
                          )}
                          <Input
                            value={financingBank}
                            onChange={(e) => setFinancingBank(e.target.value)}
                            className="h-9"
                            placeholder="Ex: Santander, BV, Itaú..."
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Nº de parcelas</Label>
                          <Input
                            type="number"
                            min={1}
                            value={financingInstallments}
                            onChange={(e) => setFinancingInstallments(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[11px]">Valor da parcela</Label>
                          <Input
                            value={financingInstallmentValue}
                            onChange={(e) => setFinancingInstallmentValue(maskCurrency(e.target.value))}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Status e observações</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Origem do lead *
            </h3>
            <div className="space-y-3">
              {LEAD_SOURCE_GROUPS.map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {LEAD_SOURCE_GROUP_LABELS[group]}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {LEAD_SOURCES.filter((o) => o.group === group).map((option) => {
                      const Icon = option.icon;
                      const selected = leadSource === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setLeadSource(option.value);
                            setLeadSourceDetail('');
                            setAdId('');
                          }}
                          className={cn(
                            'text-left rounded-lg border p-2.5 transition-all duration-200 hover:border-primary/60 hover:bg-primary/5',
                            selected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                              : 'border-border bg-card',
                          )}
                        >
                          <Icon
                            className={cn('w-4 h-4 mb-1', selected ? 'text-primary' : 'text-muted-foreground')}
                          />
                          <p className="text-xs font-medium leading-tight">{option.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(leadSource === 'ANUNCIO_INSTAGRAM' || leadSource === 'ANUNCIO_FACEBOOK') && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium mb-2">Qual anúncio da loja trouxe este cliente?</p>
                  <AdPicker
                    storeId={storeId}
                    platformFilter={leadSource === 'ANUNCIO_INSTAGRAM' ? 'instagram' : 'facebook'}
                    campaignName={leadSourceDetail}
                    adId={adId}
                    compact
                    onChange={({ campaignName, adId: next }) => {
                      setLeadSourceDetail(campaignName);
                      setAdId(next);
                    }}
                  />
                </div>
              )}
              {leadSourceOption?.requiresDetail && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{leadSourceOption.detailLabel || 'Detalhe'} *</Label>
                  <Input
                    value={leadSourceDetail}
                    onChange={(e) => setLeadSourceDetail(e.target.value.toUpperCase())}
                    className="h-9 uppercase"
                    placeholder="EX: CAMPANHA JULHO"
                  />
                </div>
              )}
              {!leadSourceOk && (
                <p className="text-xs text-destructive">
                  Selecione a origem do lead {leadSourceOption?.requiresDetail ? 'e preencha o detalhe' : ''}.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contrato de venda
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de contrato</Label>
                <Select
                  value={contractType}
                  onValueChange={(v) => {
                    setContractType(v);
                    setTemplateId('');
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo de contrato</Label>
                <Select value={templateId || 'none'} onValueChange={(v) => setTemplateId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem modelo</SelectItem>
                    {filteredTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} (v{t.version})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Alterar o modelo regera o PDF do contrato com base no novo template ao reemitir.
            </p>
          </section>

          {/* Anexos de Comprovantes de Pagamento (PIX, Cartão, Dinheiro) */}
          <section className="space-y-3 pt-3 border-t">
            <ReceiptAttachmentManager saleId={sale.id} saleTitle={buyerName} />
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => update.mutate()}
              disabled={update.isPending}
            >
              {update.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}