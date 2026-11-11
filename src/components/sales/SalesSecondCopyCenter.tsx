import { useState, useMemo } from 'react';
import {
  Printer,
  Search,
  FileText,
  Receipt,
  Bike,
  Pencil,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Building,
  Store,
  DollarSign,
  ImageDown,
  UserCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PanelCard } from '@/components/ui/stat-card';
import { maskCPF } from '@/lib/masks';
import { cn } from '@/lib/utils';
import {
  downloadContractSecondCopyPDF,
  downloadPaymentReceiptSecondCopyPDF,
  downloadVehicleDeliveryTermPDF,
  SecondCopySaleData,
} from '@/lib/secondCopyPdfs';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { SaleManageModal } from '@/components/sales/SaleManageModal';
import { useStores } from '@/hooks/useStores';
import { getStoreFromDatabase } from '@/lib/storeResolution';

interface SalesSecondCopyCenterProps {
  sales: any[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

function formatCPFDisplay(cpf: string) {
  if (!cpf || cpf === '—') return '—';
  if (cpf.includes('.') || cpf.includes('-') || cpf.includes('/')) return cpf;
  return maskCPF(cpf);
}

export function SalesSecondCopyCenter({ sales }: SalesSecondCopyCenterProps) {
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<'cadastro' | 'veiculo' | 'finalizacao' | 'documentos'>('documentos');

  const { data: stores = [] } = useStores();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      const name = (s.buyer_name || '').toLowerCase();
      const cpf = (s.buyer_cpf || '').replace(/\D/g, '');
      const ctr = (s.contract_number || '').toLowerCase();
      const mod = (s.vehicle?.model || (s.external_data as any)?.vehicle_model_custom || '').toLowerCase();
      const cha = (s.vehicle?.chassis || (s.external_data as any)?.chassi || '').toLowerCase();
      return (
        name.includes(q) ||
        cpf.includes(q.replace(/\D/g, '')) ||
        ctr.includes(q) ||
        mod.includes(q) ||
        cha.includes(q)
      );
    });
  }, [sales, search]);

  const mapToSecondCopy = (sale: any): SecondCopySaleData => {
    const veh = sale.vehicle;
    const resolvedStore = getStoreFromDatabase(sale.store_id || sale.store?.id || (veh as any)?.store_id, stores);
    const ext = (sale.external_data || {}) as any;

    const pix = Number(sale.down_payment_pix ?? ext.pix ?? 0);
    const cash = Number(sale.down_payment_cash ?? ext.dinheiro ?? 0);
    const card = Number(sale.down_payment_card ?? ext.cartao ?? 0);
    const fin = Number(sale.financed_amount ?? ext.financiamento ?? 0);

    return {
      id: sale.id,
      contractNumber: sale.contract_number || 'CTR-2VIA',
      status: sale.status || 'concluido',
      createdAt: sale.created_at,
      completedAt: sale.signed_at || sale.created_at,
      buyerName: sale.buyer_name || 'Cliente',
      buyerCpf: sale.buyer_cpf || '',
      buyerPhone: sale.buyer_phone || '',
      buyerEmail: sale.buyer_email || '',
      buyerAddress: sale.buyer_address || '',
      vehicleBrand: veh?.brand || 'SHINERAY',
      vehicleModel: veh?.model || ext.vehicle_model_custom || 'Moto',
      vehicleYear: veh?.year || 2026,
      vehicleColor: veh?.color || ext.cor || 'Padrão',
      vehicleChassis: veh?.chassis || ext.chassi || '',
      vehiclePlate: veh?.plate || ext.placa || '',
      salePrice: Number(sale.sale_price || 0),
      downPayment: Number(sale.down_payment || pix + cash + card),
      downPaymentPix: pix,
      downPaymentCash: cash,
      downPaymentCard: card,
      downPaymentCardInstallments: sale.down_payment_card_installments || 1,
      financedAmount: fin,
      financingBank: sale.financing_bank || ext.banco || 'BANCO PAN',
      financingInstallments: sale.financing_installments || 48,
      financingInstallmentValue: Number(sale.financing_installment_value || 0),
      paymentMethod: sale.payment_method || (fin > 0 ? 'Financiamento' : 'À Vista'),
      invoiceNumber: ext.invoice_number,
      storeName: resolvedStore.storeName,
      storeCnpj: resolvedStore.cnpj || '18.456.789/0001-01',
      storeAddress: resolvedStore.address || 'Av. Autorama, 1200 - Judeia',
      storeCity: resolvedStore.city ? `${resolvedStore.city} / ${resolvedStore.state || 'MG'}` : 'Minas Gerais',
      storePhone: resolvedStore.phone || '(37) 3222-1000',
      storeEmail: resolvedStore.email || 'divinopolis@pixelmotors.com.br',
      operatorName: sale.operator?.full_name || sale.created_by || ext.completed_by || 'Vendedor',
      notes: sale.notes || '',
      authorizedPersonName: sale.pickup_person?.name || ext.pickup_person?.name,
      authorizedPersonCpf: sale.pickup_person?.cpf || ext.pickup_person?.cpf,
      authorizedPersonRg: sale.pickup_person?.rg || ext.pickup_person?.rg,
      authorizedPersonPhone: sale.pickup_person?.phone || ext.pickup_person?.phone,
      authorizedPersonRelationship: sale.pickup_person?.relationship || ext.pickup_person?.relationship,
    };
  };

  const handleOpenManage = (sale: any, tab: 'cadastro' | 'veiculo' | 'finalizacao' | 'documentos') => {
    setSelectedSale(sale);
    setManageTab(tab);
    setManageOpen(true);
  };

  const handleSendWhatsApp = (sale: any) => {
    const rawPhone = (sale.buyer_phone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      alert('Telefone do comprador não cadastrado ou incompleto. Abra a gestão para cadastrar.');
      return;
    }
    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const text = encodeURIComponent(
      `Olá ${sale.buyer_name}! Segue a 2ª via do seu contrato e comprovantes de compra na Concessionária Shineray.\n\n*Contrato:* ${sale.contract_number}\n*Veículo:* ${sale.vehicle?.brand || 'SHINERAY'} ${sale.vehicle?.model || ''}\n*Valor:* ${formatCurrency(Number(sale.sale_price))}`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleDownloadInvoicePng = async (sale: any) => {
    try {
      const veh = sale.vehicle;
      const ext = (sale.external_data || {}) as any;
      const val = Number(sale.sale_price || 0);
      const fin = Number(sale.financed_amount || ext.financiamento || 0);
      const bank = sale.financing_bank || ext.banco || '';

      await downloadInvoiceRequestPng(
        {
          nomeCompleto: sale.buyer_name || 'CLIENTE',
          cpf: sale.buyer_cpf || '',
          cep: (sale.buyer_address?.match(/\d{5}-?\d{3}/)?.[0]) || '',
          endereco: sale.buyer_address || '',
          chassi: veh?.chassis || ext.chassi || 'A DEFINIR',
          modeloMoto: veh?.model || ext.vehicle_model_custom || 'MOTO SHINERAY',
          valorNF: val ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00',
          alienacao: fin > 0 ? (bank ? `ALIENADO - ${bank.toUpperCase()}` : 'ALIENADO') : 'À VISTA',
        },
        `solicitacao-nf-${(sale.buyer_name || 'cliente').toLowerCase().replace(/\s+/g, '-')}.png`
      );
    } catch (e: any) {
      alert('Erro ao gerar Papel de NF: ' + (e?.message || 'Falha ao processar'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Informativo Superior */}
      <div className="rounded-2xl border bg-gradient-to-r from-red-500/10 via-primary/5 to-muted/40 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Central de Gestão de Contratos & Emissão de 2ª Via
              </h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Altere dados cadastrais do cliente e da concessionária, retifique informações de finalização de vendas, contratos e emita instantaneamente segundas vias de <strong>Contratos de Compra e Venda</strong>, <strong>Recibos de Quitação Financeira</strong> e <strong>Termos de Entrada a Pessoas Autorizadas com Assinatura Gov.br</strong> em PDF real.
            </p>
          </div>

          <Badge variant="outline" className="px-3 py-1.5 text-xs font-bold border-red-500/30 text-red-600 bg-red-500/10">
            {sales.length} Vendas Registradas
          </Badge>
        </div>

        {/* 3 Cartões de Acesso Rápido a Recursos de 2ª Via */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border bg-card/80 p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
              <FileText className="w-4 h-4" />
              2ª Via do Contrato Oficial
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              PDF completo com qualificação das partes, cláusulas legais, dados do veículo e garantia de fábrica.
            </p>
          </div>

          <div className="rounded-xl border bg-card/80 p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-4 h-4" />
              2ª Via do Recibo Financeiro
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Declaração de quitação e discriminação exata de entradas (PIX/dinheiro/cartão) e financiamento.
            </p>
          </div>

          <div className="rounded-xl border bg-card/80 p-3.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              Termo Pessoas Autorizadas (Gov.br)
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Autorização de entrada e retirada com chancela e assinatura digital oficial Gov.br do comprador (Lei nº 14.063/2020).
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa Rápida */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar venda por nome do cliente, CPF, chassi da moto, número do contrato ou placa..."
          className="h-11 pl-10 text-xs rounded-xl shadow-xs"
        />
      </div>

      {/* Tabela de Vendas & Documentos para 2ª Via */}
      <PanelCard
        title="Emissão de 2ª Via & Alterações Cadastrais"
        description="Localize a venda desejada e clique diretamente no documento a ser gerado ou acesse a partição de gestão completa."
        aside={<span className="text-xs font-semibold text-muted-foreground">{filtered.length} registros</span>}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Contrato / Ref</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Cliente & CPF</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Veículo / Chassi</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Loja</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Valor</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right pr-4 text-[10px] font-bold uppercase tracking-wider">
                  Emissão de 2ª Via & Gestão
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                    Nenhuma venda encontrada para os critérios de busca informados.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sale) => {
                  const veh = sale.vehicle;
                  const dataForPdf = mapToSecondCopy(sale);
                  const isCompleted = sale.status === 'concluido' || sale.status === 'assinado';

                  return (
                    <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {sale.contract_number}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{formatDate(sale.created_at)}</p>
                      </TableCell>

                      <TableCell>
                        <p className="text-xs font-bold text-foreground">{sale.buyer_name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{formatCPFDisplay(sale.buyer_cpf)}</p>
                      </TableCell>

                      <TableCell>
                        <p className="text-xs font-semibold text-foreground">
                          {veh?.brand || 'SHINERAY'} {veh?.model || (sale.external_data as any)?.vehicle_model_custom || 'Moto'}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {veh?.chassis ? `#${veh.chassis.slice(-8)}` : (sale.external_data as any)?.chassi || '0 KM'}
                        </p>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {sale.store?.name || 'Divinópolis'}
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <span className="font-display font-bold text-xs text-foreground">
                          {formatCurrency(Number(sale.sale_price))}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {dataForPdf.paymentMethod}
                        </p>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] font-bold py-0.5 px-2',
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                          )}
                        >
                          {isCompleted ? 'Quitado' : 'Pré-Venda'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. 2ª Via do Contrato Oficial (Disponível para todas as vendas) */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const { downloadOriginalContract } = await import('@/lib/originalContractExport');
                                await downloadOriginalContract(sale);
                              } catch (e: any) {
                                try {
                                  downloadContractSecondCopyPDF(dataForPdf);
                                } catch (e2: any) {
                                  alert('Erro ao gerar contrato: ' + (e2?.message || e?.message || 'Falha ao processar'));
                                }
                              }
                            }}
                            className="h-8 px-2.5 text-xs font-bold gap-1 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                            title="Baixar 2ª Via do Contrato Oficial (PDF)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Contrato</span>
                          </Button>

                          {/* 1.1 Papel NF (Exclusivo para Pré-Vendas) */}
                          {!isCompleted && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadInvoicePng(sale)}
                              className="h-8 px-2.5 text-xs font-bold gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                              title="Pré-Venda: Baixar Papel de Solicitação de NF (PNG)"
                            >
                              <ImageDown className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Papel NF</span>
                            </Button>
                          )}

                          {/* 2. 2ª Via Recibo */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadPaymentReceiptSecondCopyPDF(dataForPdf)}
                            className="h-8 px-2.5 text-xs font-bold gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            title="Baixar 2ª Via do Recibo Financeiro (PDF)"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Recibo</span>
                          </Button>

                          {/* 3. Termo de Entrada a Pessoas Autorizadas com Assinatura Gov.br */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadVehicleDeliveryTermPDF(dataForPdf)}
                            className="h-8 px-2.5 text-xs font-bold gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                            title="Baixar Termo de Entrada e Retirada a Pessoas Autorizadas com Assinatura Gov.br do Comprador (PDF)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Termo Gov.br</span>
                          </Button>

                          {/* 4. Gestão & Alteração Cadastral */}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleOpenManage(sale, 'cadastro')}
                            className="h-8 px-2.5 text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                            title="Alterar dados cadastrais, veículo ou finalização"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Alterar / Gestão</span>
                          </Button>

                          {/* 5. WhatsApp */}
                          {sale.buyer_phone && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendWhatsApp(sale)}
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              title="Enviar 2ª Via no WhatsApp do Cliente"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </PanelCard>

      {/* Modal de Gestão da Venda e Alteração de Dados */}
      {selectedSale && (
        <SaleManageModal
          open={manageOpen}
          onOpenChange={setManageOpen}
          sale={selectedSale}
          defaultTab={manageTab}
        />
      )}
    </div>
  );
}
