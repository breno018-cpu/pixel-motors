import { useState } from 'react';
import { 
  FileText, 
  User, 
  Car, 
  Bike,
  Store, 
  Calendar, 
  CreditCard, 
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Megaphone,
  MapPin, 
  Truck, 
  MessageCircle, 
  Paperclip, 
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getLeadSource } from '@/lib/leadSources';
import { ReceiptAttachmentManager } from '@/components/sales/ReceiptAttachmentManager';
import { useToast } from '@/hooks/use-toast';

interface Sale {
  id: string;
  contract_number: string;
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
  vehicle_id: string;
  store_id: string;
  reseller_id: string;
  notes: string | null;
  created_at: string;
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
  campaign_name?: string | null;
  sale_channel?: string | null;
  evidence_paths?: string[];
  external_data?: Record<string, unknown> | null;
  vehicle?: {
    id?: string;
    brand?: string;
    model?: string;
    year?: number;
    color?: string | null;
    plate?: string | null;
    chassis?: string | null;
    vehicle_type?: string | null;
    status?: string;
  } | null;
  chassi?: string;
  vehicle_chassis?: string;
  operator?: {
    id?: string;
    full_name?: string;
  };
}

interface SaleDetailsDialogProps {
  sale: Sale | null;
  vehicleName?: string;
  storeName?: string;
  resellerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle }> = {
  pendente: { label: 'Contrato Pendente', class: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  assinado: { label: 'Assinado', class: 'bg-primary/10 text-primary border-primary/20', icon: FileText },
  cancelado: { label: 'Cancelado', class: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertCircle },
  concluido: { label: 'Quitado', class: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
};

const paymentMethodLabels: Record<string, string> = {
  a_vista: 'À vista',
  parcelado: 'Parcelado (cartão)',
  financiamento: 'Financiamento',
  consorcio: 'Consórcio',
  misto: 'Misto (entrada + parcelas)',
};

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function SaleDetailsDialog({ 
  sale, 
  vehicleName, 
  storeName, 
  resellerName, 
  open, 
  onOpenChange 
}: SaleDetailsDialogProps) {
  const { toast } = useToast();
  const [copiedChassis, setCopiedChassis] = useState(false);

  if (!sale) return null;

  const salePayments: any[] = [];
  const totalPaid = sale.status === 'concluido' ? Number(sale.sale_price) : 0;
  const remaining = Number(sale.sale_price) - totalPaid;

  const statusInfo = statusConfig[sale.status] || statusConfig.pendente;
  const StatusIcon = statusInfo.icon;
  const external = (sale.external_data || {}) as Record<string, unknown>;
  const externalText = (key: string) => typeof external[key] === 'string' ? String(external[key]) : '';
  const evidenceCount = sale.evidence_paths?.length || 0;

  const chassis = (
    sale.vehicle?.chassis ||
    (sale.external_data as any)?.chassis ||
    (sale.external_data as any)?.chassi ||
    (sale.external_data as any)?.vehicle_chassis_custom ||
    (sale as any).chassi ||
    (sale as any).vehicle_chassis ||
    ''
  ).trim();

  const vehicleModel =
    sale.vehicle?.model ||
    (sale.external_data as any)?.vehicle_model_custom ||
    (sale.external_data as any)?.modelo ||
    vehicleName ||
    'Não informado';

  const vehicleBrand = sale.vehicle?.brand || (sale.external_data as any)?.brand || 'SHINERAY';
  const vehicleYear = sale.vehicle?.year || (sale.external_data as any)?.year || (sale.external_data as any)?.ano || 2026;
  const vehicleColor = sale.vehicle?.color || (sale.external_data as any)?.cor || '';
  const vehiclePlate = sale.vehicle?.plate || (sale.external_data as any)?.placa || '';

  const handleCopyChassis = () => {
    if (!chassis) return;
    navigator.clipboard.writeText(chassis);
    setCopiedChassis(true);
    toast({
      title: 'Chassi copiado!',
      description: `O chassi ${chassis} foi copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedChassis(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <FileText className="w-5 h-5 text-primary" />
            Detalhes da Venda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-lg font-bold text-foreground">{sale.contract_number}</p>
              <p className="text-muted-foreground text-sm flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(sale.created_at)}
              </p>
            </div>
            <Badge variant="outline" className={cn("text-sm flex items-center gap-1", statusInfo.class)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusInfo.label}
            </Badge>
          </div>

          <Separator />

          {sale.sale_channel === 'externa' && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <Megaphone className="h-4 w-4" /> Dados da venda externa
              </h4>
              <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Canal do contato</p>
                  <p className="font-medium">{externalText('contact_platform') || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cidade do comprador</p>
                  <p className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5" />{externalText('buyer_city') || 'Não informada'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Forma de entrega</p>
                  <p className="flex items-center gap-1 font-medium"><Truck className="h-3.5 w-3.5" />{externalText('delivery_method') || 'Não informada'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comprovantes</p>
                  <p className="flex items-center gap-1 font-medium"><Paperclip className="h-3.5 w-3.5" />{evidenceCount} arquivo(s)</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Anúncio / campanha</p>
                  <p className="font-medium">{sale.campaign_name || externalText('ad_description') || sale.lead_source_detail || 'Não informado'}</p>
                </div>
                {externalText('conversation_link') && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Conversa ou perfil</p>
                    <a className="inline-flex items-center gap-1 break-all font-medium text-primary hover:underline" href={externalText('conversation_link')} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" /> Abrir link <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
                {externalText('notes') && (
                  <div className="border-t border-border/50 pt-2 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Observações da negociação</p>
                    <p className="mt-1 whitespace-pre-wrap">{externalText('notes')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <User className="w-4 h-4" /> Cliente
            </h4>
            <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{sale.buyer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPF</span>
                <span className="font-mono">{sale.buyer_cpf}</span>
              </div>
              {sale.buyer_phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span>{sale.buyer_phone}</span>
                </div>
              )}
              {sale.buyer_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail</span>
                  <span className="truncate max-w-[180px]">{sale.buyer_email}</span>
                </div>
              )}
              {sale.buyer_address && (
                <div className="pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Endereço</span>
                  <p className="mt-1">{sale.buyer_address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Veículo & Identificação do Chassi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Bike className="w-4 h-4 text-primary" /> Moto & Chassi
              </h4>
              {chassis && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyChassis}
                  className="h-7 px-2.5 text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
                  title="Copiar número do chassi completo"
                >
                  {copiedChassis ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedChassis ? 'Chassi Copiado!' : 'Copiar Chassi'}
                </Button>
              )}
            </div>
            
            <div className="bg-muted/50 p-3.5 rounded-lg border border-border/60 space-y-3 text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-border/40">
                <div>
                  <p className="text-xs text-muted-foreground">Modelo / Fabricante</p>
                  <p className="font-bold text-foreground text-sm uppercase">{vehicleBrand} {vehicleModel}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Ano: <strong className="text-foreground">{vehicleYear}</strong></span>
                  {vehicleColor && <span>Cor: <strong className="text-foreground">{vehicleColor}</strong></span>}
                  {vehiclePlate && <span>Placa: <strong className="text-foreground font-mono">{vehiclePlate}</strong></span>}
                </div>
              </div>

              {/* Destaque do Chassi com Ação Direta */}
              <div className="bg-background/90 rounded-md p-3 border border-border/80 flex items-center justify-between gap-2 shadow-2xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Chassi (Número de Identificação)
                    </span>
                    {chassis && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                        {chassis.length} caracteres
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-sm font-black tracking-wider text-foreground break-all select-all">
                    {chassis || (
                      <span className="text-amber-600 dark:text-amber-400 font-normal italic text-xs">
                        Chassi a definir (Em faturamento / estoque)
                      </span>
                    )}
                  </p>
                </div>
                {chassis && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyChassis}
                    className="h-8 px-3 shrink-0 font-bold text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                  >
                    {copiedChassis ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedChassis ? 'Copiado' : 'Copiar'}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Loja & Operador */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> Concessionária
              </p>
              <p className="font-semibold text-sm">{storeName || 'Não informada'}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Vendedor / Operador
              </p>
              <p className="font-semibold text-sm truncate">{resellerName || (sale as any).operator?.full_name || (sale as any).external_data?.seller_name || 'Vendedor'}</p>
            </div>
          </div>

          {/* Lead origin */}
          <div className="bg-muted/50 p-3 rounded-lg flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> Origem do lead
            </p>
            {sale.lead_source ? (
              <div className="text-right">
                <p className="font-medium text-sm">
                  {getLeadSource(sale.lead_source)?.label || sale.lead_source}
                </p>
                {sale.lead_source_detail && (
                  <p className="text-xs text-muted-foreground">{sale.lead_source_detail}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Não informada</p>
            )}
          </div>

          {/* Payment Summary */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Financeiro
            </h4>
            <div className="bg-primary/5 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valor Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(sale.sale_price)}</span>
              </div>

              {sale.payment_method && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Forma de pagamento</span>
                  <Badge variant="outline">{paymentMethodLabels[sale.payment_method] || sale.payment_method}</Badge>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-sm text-center py-2 border-y border-border/30">
                <div>
                  <p className="text-muted-foreground">Entrada</p>
                  <p className="font-medium">{formatCurrency(sale.down_payment)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Parcelas</p>
                  <p className="font-medium">{sale.installments || 1}x</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Parcela</p>
                  <p className="font-medium">{formatCurrency(sale.installment_value)}</p>
                </div>
              </div>

              {(Number(sale.down_payment_pix || 0) > 0 ||
                Number(sale.down_payment_cash || 0) > 0 ||
                Number(sale.down_payment_card || 0) > 0) && (
                <div className="space-y-1.5 pb-2 border-b border-border/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {Number(sale.down_payment || 0) > 0 ? 'Composição da entrada' : 'Pagamento à vista'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm text-center">
                    <div>
                      <p className="text-muted-foreground text-xs">PIX</p>
                      <p className="font-medium">{formatCurrency(sale.down_payment_pix ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Dinheiro</p>
                      <p className="font-medium">{formatCurrency(sale.down_payment_cash ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Cartão{sale.down_payment_card_installments ? ` (${sale.down_payment_card_installments}x)` : ''}
                      </p>
                      <p className="font-medium">{formatCurrency(sale.down_payment_card ?? 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              {sale.payment_method === 'financiamento' && (
                <div className="space-y-1.5 pb-2 border-b border-border/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Financiamento</p>
                  <div className="grid grid-cols-3 gap-2 text-sm text-center">
                    <div>
                      <p className="text-muted-foreground text-xs">Banco</p>
                      <p className="font-medium truncate">{sale.financing_bank || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Parcelas</p>
                      <p className="font-medium">{sale.financing_installments || '-'}x</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Valor Parcela</p>
                      <p className="font-medium">{formatCurrency(sale.financing_installment_value ?? 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-success">Total Pago</span>
                <span className="font-medium text-success">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className={remaining > 0 ? 'text-warning' : 'text-muted-foreground'}>
                  Saldo Restante
                </span>
                <span className={cn("font-medium", remaining > 0 ? 'text-warning' : 'text-muted-foreground')}>
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {salePayments.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Histórico de Pagamentos</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {salePayments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center text-sm bg-muted/30 p-2 rounded">
                    <div>
                      <p className="font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.payment_date)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {payment.payment_method || 'N/A'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comprovantes de Pagamento */}
          <div className="space-y-2 pt-2 border-t">
            <ReceiptAttachmentManager saleId={sale.id} saleTitle={sale.buyer_name} />
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Observações</h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {sale.notes}
              </p>
            </div>
          )}

          {/* Standard Clause */}
          <div className="p-3 border border-warning/30 bg-warning/5 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Cláusula padrão:</strong> "O emplacamento é de responsabilidade do cliente."
            </p>
          </div>

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-center">
            Revendedor: {resellerName || 'Não informado'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
