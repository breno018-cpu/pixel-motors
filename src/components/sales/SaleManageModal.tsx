import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  User,
  Bike,
  CreditCard,
  Printer,
  Download,
  CheckCircle2,
  Calendar,
  Store,
  MessageSquare,
  ShieldCheck,
  Save,
  Clock,
  AlertCircle,
  ExternalLink,
  Paperclip,
  Share2,
  FileCheck,
  Receipt,
  Car,
  DollarSign,
  Landmark,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStores } from '@/hooks/useStores';
import { useFinancingBanks } from '@/hooks/useFinancingBanks';
import { useActiveTemplates } from '@/hooks/useContractTemplates';
import { maskCPFCNPJ, maskCurrency, maskPhone, parseCurrency } from '@/lib/masks';
import { logActivity } from '@/lib/audit';
import {
  downloadContractSecondCopyPDF,
  downloadPaymentReceiptSecondCopyPDF,
  downloadVehicleDeliveryTermPDF,
  SecondCopySaleData,
} from '@/lib/secondCopyPdfs';
import { getStoreFromDatabase } from '@/lib/storeResolution';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { ReceiptAttachmentManager } from '@/components/sales/ReceiptAttachmentManager';
import { SheetRowV9 } from '@/lib/dealershipSheetParser';

interface SaleManageModalProps {
  sale: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'cadastro' | 'veiculo' | 'finalizacao' | 'documentos';
}

export function SaleManageModal({
  sale,
  open,
  onOpenChange,
  defaultTab = 'cadastro',
}: SaleManageModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();
  const { data: banks = [] } = useFinancingBanks();
  const { data: templates = [] } = useActiveTemplates();

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isSaving, setIsSaving] = useState(false);

  // ABA 1: DADOS CADASTRAIS DO CLIENTE E LOJA
  const [buyerName, setBuyerName] = useState('');
  const [buyerCpf, setBuyerCpf] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [storeId, setStoreId] = useState('');
  const [operatorName, setOperatorName] = useState('');

  // ABA 2: DADOS DO VEÍCULO & NEGOCIAÇÃO
  const [vehicleBrand, setVehicleBrand] = useState('SHINERAY');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('2026');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleChassis, setVehicleChassis] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [notes, setNotes] = useState('');

  // ABA 3: FINALIZAÇÃO & CONDIÇÕES DE PAGAMENTO
  const [saleStatus, setSaleStatus] = useState('concluido');
  const [contractNumber, setContractNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('avista');
  const [downPayPix, setDownPayPix] = useState('');
  const [downPayCash, setDownPayCash] = useState('');
  const [downPayCard, setDownPayCard] = useState('');
  const [downPayCardInstallments, setDownPayCardInstallments] = useState('1');
  const [financedAmount, setFinancedAmount] = useState('');
  const [financingBank, setFinancingBank] = useState('');
  const [financingInstallments, setFinancingInstallments] = useState('48');
  const [financingInstallmentValue, setFinancingInstallmentValue] = useState('');

  // Sincroniza os estados quando a venda selecionada mudar
  useEffect(() => {
    if (!sale || !open) return;

    setActiveTab(defaultTab);

    // Cliente
    setBuyerName(sale.buyer_name || '');
    setBuyerCpf(maskCPFCNPJ(sale.buyer_cpf || ''));
    setBuyerPhone(sale.buyer_phone ? maskPhone(sale.buyer_phone) : '');
    setBuyerEmail(sale.buyer_email || '');
    setBuyerAddress(sale.buyer_address || '');
    setStoreId(sale.store_id || (stores[0]?.id || ''));
    setOperatorName(
      sale.operator?.full_name ||
        sale.created_by ||
        (sale.external_data as any)?.completed_by ||
        ''
    );

    // Veículo
    const veh = sale.vehicle;
    setVehicleBrand(veh?.brand || 'SHINERAY');
    setVehicleModel(veh?.model || (sale.external_data as any)?.vehicle_model_custom || '');
    setVehicleYear(String(veh?.year || 2026));
    setVehicleColor(veh?.color || '');
    setVehicleChassis(veh?.chassis || (sale.external_data as any)?.chassi || '');
    setVehiclePlate(veh?.plate || '');
    setSalePrice(maskCurrency(Number(sale.sale_price || 0)));
    setNotes(sale.notes || '');

    // Finalização
    setSaleStatus(sale.status || 'concluido');
    setContractNumber(sale.contract_number || '');
    setInvoiceNumber((sale.external_data as any)?.invoice_number || '');
    setTemplateId(sale.template_id || '');
    setSaleDate(
      sale.created_at ? sale.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
    );

    const m = (sale.payment_method || '').toLowerCase();
    const isFinanced =
      m.includes('financ') ||
      Number((sale.external_data as any)?.financiamento || 0) > 0 ||
      Number(sale.financing_installments || 0) > 0;
    setPaymentMethod(isFinanced ? 'financiamento' : 'avista');

    const ext = (sale.external_data || {}) as any;
    const pixVal = Number(sale.down_payment_pix ?? ext.pix ?? 0);
    const cashVal = Number(sale.down_payment_cash ?? ext.dinheiro ?? 0);
    const cardVal = Number(sale.down_payment_card ?? ext.cartao ?? 0);
    const finVal = Number(
      sale.financed_amount ??
        ext.financiamento ??
        (isFinanced ? Math.max(0, Number(sale.sale_price || 0) - (pixVal + cashVal + cardVal)) : 0)
    );

    setDownPayPix(maskCurrency(pixVal));
    setDownPayCash(maskCurrency(cashVal));
    setDownPayCard(maskCurrency(cardVal));
    setDownPayCardInstallments(String(sale.down_payment_card_installments || 1));
    setFinancedAmount(maskCurrency(finVal));
    setFinancingBank(sale.financing_bank || ext.banco || 'BANCO PAN');
    setFinancingInstallments(String(sale.financing_installments || 48));
    setFinancingInstallmentValue(
      maskCurrency(Number(sale.financing_installment_value || 0))
    );
  }, [sale, open, defaultTab, stores]);

  // Objeto preparado para os geradores de 2ª via com dados padronizados de Organização
  const currentStore = useMemo(() => {
    return getStoreFromDatabase(storeId || sale?.store_id || sale?.store?.id, stores);
  }, [stores, storeId, sale]);

  const secondCopyData: SecondCopySaleData = useMemo(() => {
    return {
      id: sale?.id,
      contractNumber: contractNumber || sale?.contract_number || 'CTR-2VIA',
      status: saleStatus,
      createdAt: saleDate || sale?.created_at || new Date().toISOString(),
      completedAt: sale?.signed_at || saleDate,
      buyerName: buyerName || 'Cliente',
      buyerCpf: buyerCpf || '',
      buyerPhone: buyerPhone || '',
      buyerEmail: buyerEmail || '',
      buyerAddress: buyerAddress || '',
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehicleChassis,
      vehiclePlate,
      salePrice: parseCurrency(salePrice),
      downPayment:
        parseCurrency(downPayPix) +
        parseCurrency(downPayCash) +
        parseCurrency(downPayCard),
      downPaymentPix: parseCurrency(downPayPix),
      downPaymentCash: parseCurrency(downPayCash),
      downPaymentCard: parseCurrency(downPayCard),
      downPaymentCardInstallments: parseInt(downPayCardInstallments || '1', 10),
      financedAmount: parseCurrency(financedAmount),
      financingBank,
      financingInstallments: parseInt(financingInstallments || '48', 10),
      financingInstallmentValue: parseCurrency(financingInstallmentValue),
      paymentMethod:
        paymentMethod === 'financiamento' ? `Financiamento (${financingBank})` : 'À Vista',
      invoiceNumber: invoiceNumber || undefined,
      storeName: currentStore.storeName,
      storeCnpj: currentStore.cnpj || '18.456.789/0001-01',
      storeAddress: currentStore.address || '',
      storeCity: currentStore.city ? `${currentStore.city} / ${currentStore.state || 'MG'}` : 'Minas Gerais',
      storePhone: currentStore.phone || '(37) 3222-1000',
      storeEmail: currentStore.email || 'divinopolis@pixelmotors.com.br',
      operatorName: operatorName || sale?.operator?.full_name || 'Vendedor',
      notes,
      authorizedPersonName: sale?.pickup_person?.name || (sale?.external_data as any)?.pickup_person?.name,
      authorizedPersonCpf: sale?.pickup_person?.cpf || (sale?.external_data as any)?.pickup_person?.cpf,
      authorizedPersonRg: sale?.pickup_person?.rg || (sale?.external_data as any)?.pickup_person?.rg,
      authorizedPersonPhone: sale?.pickup_person?.phone || (sale?.external_data as any)?.pickup_person?.phone,
      authorizedPersonRelationship: sale?.pickup_person?.relationship || (sale?.external_data as any)?.pickup_person?.relationship,
    };
  }, [
    sale,
    contractNumber,
    saleStatus,
    saleDate,
    buyerName,
    buyerCpf,
    buyerPhone,
    buyerEmail,
    buyerAddress,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    vehicleChassis,
    vehiclePlate,
    salePrice,
    downPayPix,
    downPayCash,
    downPayCard,
    downPayCardInstallments,
    financedAmount,
    financingBank,
    financingInstallments,
    financingInstallmentValue,
    paymentMethod,
    invoiceNumber,
    currentStore,
    operatorName,
    notes,
  ]);

  // SALVAR ALTERAÇÕES (CADASTRAIS + FINALIZAÇÃO)
  const handleSaveChanges = async () => {
    if (!sale) return;
    setIsSaving(true);
    try {
      const priceNum = parseCurrency(salePrice);
      const pixNum = parseCurrency(downPayPix);
      const cashNum = parseCurrency(downPayCash);
      const cardNum = parseCurrency(downPayCard);
      const finNum = parseCurrency(financedAmount);
      const totalDown = pixNum + cashNum + cardNum;

      const unmaskedCpf = buyerCpf.replace(/\D/g, '');

      // REGRA DE OURO: Para sair de Pré-Venda (NF) para Venda Quitado/Faturado,
      // é obrigatório concluir todo o cadastro antes!
      if (sale.status === 'pre_venda' && (saleStatus === 'concluido' || saleStatus === 'assinado')) {
        const missing: string[] = [];
        if (!buyerName.trim() || buyerName.trim().length < 3) missing.push('Nome completo do comprador');
        if (unmaskedCpf.length < 11) missing.push('CPF / CNPJ válido do comprador');
        const unmaskedPhone = (buyerPhone || '').replace(/\D/g, '');
        if (unmaskedPhone.length < 10) missing.push('Telefone / WhatsApp com DDD do comprador');
        if (!buyerAddress.trim() || buyerAddress.trim().length < 5 || buyerAddress.toLowerCase().includes('não informado')) {
          missing.push('Endereço completo do comprador');
        }
        if (!vehicleModel.trim()) missing.push('Modelo da moto');
        const cleanChassis = (vehicleChassis || '').trim().toUpperCase();
        if (
          !cleanChassis ||
          cleanChassis.length < 8 ||
          cleanChassis.includes('DEFINIR') ||
          cleanChassis.includes('INFORMADO') ||
          cleanChassis.includes('PROVISORIO')
        ) {
          missing.push('Chassi oficial definitivo do veículo');
        }
        if (priceNum <= 0) missing.push('Valor total da venda (R$)');

        const totalPaid = totalDown + finNum;
        if (priceNum > 0 && Math.abs(priceNum - totalPaid) > 0.05) {
          missing.push(
            `Conciliação financeira: soma dos pagamentos (R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do valor da venda (R$ ${priceNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
          );
        }
        if (paymentMethod === 'financiamento' || finNum > 0) {
          if (!financingBank) missing.push('Banco do financiamento');
          if (!financingInstallments || parseInt(financingInstallments, 10) <= 0) missing.push('Parcelas do financiamento');
          if (!parseCurrency(financingInstallmentValue)) missing.push('Valor da parcela do financiamento');
        }

        if (missing.length > 0) {
          setIsSaving(false);
          toast({
            title: 'Cadastro Incompleto para Finalizar Venda',
            description: `Para sair de Pré-NF e faturar a venda com contrato definitivo, conclua os dados obrigatórios pendentes:\n• ${missing.join('\n• ')}`,
            variant: 'destructive',
          });
          return;
        }
      }

      // 1. Atualizar no Supabase se for registro salvo
      const payload: any = {
        buyer_name: buyerName.trim().toUpperCase(),
        buyer_cpf: unmaskedCpf,
        buyer_phone: buyerPhone ? buyerPhone.replace(/\D/g, '') : null,
        buyer_email: buyerEmail || null,
        buyer_address: buyerAddress || null,
        sale_price: priceNum,
        down_payment: totalDown,
        down_payment_pix: pixNum,
        down_payment_cash: cashNum,
        down_payment_card: cardNum,
        down_payment_card_installments: parseInt(downPayCardInstallments || '1', 10),
        status: saleStatus,
        contract_number: contractNumber.trim().toUpperCase() || sale.contract_number,
        notes: notes || null,
        template_id: templateId || null,
        store_id: storeId || sale.store_id,
        created_at: saleDate ? new Date(saleDate).toISOString() : sale.created_at,
        payment_method: paymentMethod,
        financing_bank: paymentMethod === 'financiamento' ? financingBank : null,
        financing_installments:
          paymentMethod === 'financiamento' ? parseInt(financingInstallments || '48', 10) : null,
        financing_installment_value:
          paymentMethod === 'financiamento' ? parseCurrency(financingInstallmentValue) : null,
        external_data: {
          ...(sale.external_data || {}),
          invoice_number: invoiceNumber || null,
          vehicle_model_custom: vehicleModel,
          chassi: vehicleChassis,
          placa: vehiclePlate,
          cor: vehicleColor,
          banco: financingBank,
          financiamento: finNum,
          dinheiro: cashNum,
          pix: pixNum,
          cartao: cardNum,
          completed_by: operatorName,
          last_edited_at: new Date().toISOString(),
        },
      };

      // Tenta persistir no Supabase (se o ID for de contrato do banco)
      if (sale.id && !String(sale.id).startsWith('sheet-')) {
        const { error } = await supabase.from('contracts').update(payload).eq('id', sale.id);
        if (error) console.warn('Aviso Supabase update:', error);

        // Se tiver veículo vinculado, atualiza chassi e placa
        if (sale.vehicle_id && !String(sale.vehicle_id).startsWith('veh-sheet')) {
          await supabase
            .from('vehicles')
            .update({
              brand: vehicleBrand,
              model: vehicleModel,
              color: vehicleColor || null,
              chassis: vehicleChassis || null,
              plate: vehiclePlate || null,
              year: parseInt(vehicleYear || '2026', 10),
            })
            .eq('id', sale.vehicle_id);
        }
      }

      // 2. Sincroniza também na Planilha Mensal Local v9 da Loja
      try {
        const sheetKey = 'dealflow_cloud_monthly_sheet_v9';
        const raw = localStorage.getItem(sheetKey);
        if (raw) {
          const list: SheetRowV9[] = JSON.parse(raw);
          const updated = list.map((r) => {
            if (
              r.id === sale.id ||
              (vehicleChassis && r.chassi === vehicleChassis) ||
              r.cliente.toUpperCase().includes(buyerName.toUpperCase().slice(0, 4))
            ) {
              return {
                ...r,
                cliente: buyerName.trim().toUpperCase(),
                modelo: vehicleModel || r.modelo,
                chassi: vehicleChassis || r.chassi,
                cor: vehicleColor,
                valor: priceNum || r.valor,
                total: priceNum || r.total,
                pix: pixNum,
                dinheiro: cashNum,
                cartao: cardNum,
                financiamento: finNum,
                banco: financingBank || r.banco,
                observacoes: notes || r.observacoes,
                vendedor: operatorName || r.vendedor,
                is_permitted: saleStatus === 'concluido' || saleStatus === 'assinado',
              };
            }
            return r;
          });
          localStorage.setItem(sheetKey, JSON.stringify(updated));
        }
      } catch (sheetErr) {
        console.warn('Erro ao atualizar planilha:', sheetErr);
      }

      // 3. Emite eventos de atualização e invalida queries
      window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
      window.dispatchEvent(new CustomEvent('dealflow:sheet-updated'));
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });

      logActivity('editar', 'venda', sale.id, {
        cliente: buyerName,
        status: saleStatus,
        contrato: contractNumber,
      });

      toast({
        title: 'Venda e Contrato Atualizados!',
        description: 'Dados cadastrais, valores e finalização salvos com sucesso.',
      });

      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar alterações',
        description: err.message || 'Ocorreu uma falha ao persistir os dados.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ENVIAR SEGUNDA VIA VIA WHATSAPP
  const handleSendWhatsApp = () => {
    const rawPhone = (buyerPhone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Telefone inválido',
        description: 'Cadastre um número de telefone com DDD para enviar no WhatsApp.',
      });
      return;
    }
    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const text = encodeURIComponent(
      `Olá ${buyerName}! Segue o link de atendimento e a 2ª via oficial do seu contrato de compra e venda da concessionária ${currentStore?.storeName || 'Shineray'}.\n\n*Contrato:* ${contractNumber}\n*Veículo:* ${vehicleBrand} ${vehicleModel}\n*Valor:* ${maskCurrency(parseCurrency(salePrice))}\n\nFicamos à sua total disposição!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  // GERAR PNG DE SOLICITAÇÃO DE NF
  const handleGenerateInvoicePng = async () => {
    try {
      const rawAddress = buyerAddress || '';
      const cepMatch = rawAddress.match(/\b(\d{5})-?(\d{3})\b/);
      const cep = cepMatch ? `${cepMatch[1]}-${cepMatch[2]}` : '';
      const cleanAddress = (cepMatch ? rawAddress.replace(cepMatch[0], '') : rawAddress)
        .replace(/\s*,\s*,/g, ',')
        .trim();

      await downloadInvoiceRequestPng(
        {
          nomeCompleto: buyerName,
          cpf: buyerCpf,
          cep,
          endereco: cleanAddress || 'Não informado',
          chassi: vehicleChassis || 'Em faturamento',
          modeloMoto: `${vehicleBrand} ${vehicleModel} ${vehicleYear}`.trim(),
          valorNF: salePrice,
          alienacao: paymentMethod === 'financiamento' ? financingBank || 'BANCO PAN' : 'AVISTA',
        },
        `solicitacao_nf_${contractNumber || 'venda'}.png`
      );
      toast({ title: 'PNG gerado!', description: 'Solicitação de NF baixada em alta resolução.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar PNG', description: err.message });
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        {/* Cabeçalho Premium com Ações e Carimbo */}
        <div className="bg-muted/40 border-b px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  Gestão da Venda & Emissão de 2ª Via
                </DialogTitle>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-background">
                  {contractNumber || sale.contract_number}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Altere dados cadastrais do cliente, condições de finalização, contrato e emita 2ª vias oficiais.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('documentos')}
              className="h-8 text-xs gap-1.5 font-bold border-primary/30 text-primary hover:bg-primary/10"
            >
              <Printer className="w-3.5 h-3.5" />
              Emitir 2ª Via
            </Button>
            <Button
              size="sm"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="h-8 text-xs gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>

        {/* Abas da Partição de Vendas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b bg-card">
            <TabsList className="bg-transparent h-11 p-0 gap-6">
              <TabsTrigger
                value="cadastro"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs font-bold gap-2"
              >
                <User className="w-4 h-4" />
                1. Dados Cadastrais
              </TabsTrigger>
              <TabsTrigger
                value="veiculo"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs font-bold gap-2"
              >
                <Bike className="w-4 h-4" />
                2. Veículo & Moto
              </TabsTrigger>
              <TabsTrigger
                value="finalizacao"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs font-bold gap-2"
              >
                <CreditCard className="w-4 h-4" />
                3. Finalização & Contrato
              </TabsTrigger>
              <TabsTrigger
                value="documentos"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 h-11 text-xs font-bold gap-2 text-primary"
              >
                <Printer className="w-4 h-4 text-primary" />
                4. Central de 2ª Via & Docs
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ABA 1: DADOS CADASTRAIS */}
            <TabsContent value="cadastro" className="m-0 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Nome Completo do Cliente *</Label>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Ex: JOÃO DA SILVA"
                    className="h-10 text-xs font-semibold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">CPF ou CNPJ do Comprador *</Label>
                  <Input
                    value={buyerCpf}
                    onChange={(e) => setBuyerCpf(maskCPFCNPJ(e.target.value))}
                    placeholder="000.000.000-00"
                    className="h-10 text-xs font-mono font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Telefone / WhatsApp</Label>
                  <Input
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">E-mail do Cliente</Label>
                  <Input
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    type="email"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Endereço Completo (Rua, Nº, Bairro, Cidade/UF, CEP)</Label>
                  <Textarea
                    value={buyerAddress}
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    placeholder="Ex: Rua das Flores, 120, Centro, Divinópolis/MG - CEP 35500-000"
                    className="text-xs min-h-[70px] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Loja / Concessionária Responsável</Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Selecione a loja..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.city})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Operador / Vendedor Responsável</Label>
                  <Input
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Ex: Carlos Vendas"
                    className="h-10 text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA 2: DADOS DO VEÍCULO & NEGOCIAÇÃO */}
            <TabsContent value="veiculo" className="m-0 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Marca / Fabricante</Label>
                  <Input
                    value={vehicleBrand}
                    onChange={(e) => setVehicleBrand(e.target.value)}
                    placeholder="SHINERAY"
                    className="h-10 text-xs uppercase"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Modelo da Moto / Veículo *</Label>
                  <Input
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ex: SHINERAY SHI 175 EFI CARBURADA"
                    className="h-10 text-xs font-bold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Ano Fabricação / Modelo</Label>
                  <Input
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    placeholder="2026"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Cor Predominante</Label>
                  <Input
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    placeholder="Ex: Vermelha, Preta, Cinza"
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Placa (se houver)</Label>
                  <Input
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC1D23 ou 0 KM"
                    className="h-10 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Número de Chassi (VIN Completo)</Label>
                  <Input
                    value={vehicleChassis}
                    onChange={(e) => setVehicleChassis(e.target.value.toUpperCase())}
                    placeholder="Ex: 95Vxxxxxxxxxxxxxx"
                    className="h-10 text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Valor Total da Venda (R$) *</Label>
                  <Input
                    value={salePrice}
                    onChange={(e) => setSalePrice(maskCurrency(parseCurrency(e.target.value)))}
                    placeholder="R$ 0,00"
                    className="h-10 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs font-bold">Observações / Itens Negociados</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações internas sobre garantia, brindes (capacete, capa), documentação..."
                    className="text-xs min-h-[70px] resize-none"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: FINALIZAÇÃO & CONDIÇÕES DE PAGAMENTO */}
            <TabsContent value="finalizacao" className="m-0 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Status da Venda</Label>
                  <Select value={saleStatus} onValueChange={setSaleStatus}>
                    <SelectTrigger className="h-10 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concluido">Quitado / Faturado</SelectItem>
                      <SelectItem value="pre_venda">Pré-Venda (NF Solicitada)</SelectItem>
                      <SelectItem value="assinado">Assinado</SelectItem>
                      <SelectItem value="pendente">Aguardando Aprovação</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Número do Contrato</Label>
                  <Input
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value.toUpperCase())}
                    placeholder="DIV-01 ou CTR-..."
                    className="h-10 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Número da Nota Fiscal (NF)</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex: NF-00452"
                    className="h-10 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Data da Venda / Emissão</Label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Modelo de Contrato Vinculado</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Modelo Padrão da Concessionária" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.template_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs font-bold">Modalidade de Pagamento Principal</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-10 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avista">À Vista (PIX / Dinheiro / Cartão Débito)</SelectItem>
                      <SelectItem value="financiamento">Financiamento Bancário</SelectItem>
                      <SelectItem value="misto">Misto (Entrada + Parcelas)</SelectItem>
                      <SelectItem value="consorcio">Consórcio / Carta de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Composição de Entrada */}
              <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Composição da Entrada / Pagamento Próprio
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Entrada em PIX</Label>
                    <Input
                      value={downPayPix}
                      onChange={(e) => setDownPayPix(maskCurrency(parseCurrency(e.target.value)))}
                      className="h-9 text-xs font-mono"
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Entrada em Dinheiro</Label>
                    <Input
                      value={downPayCash}
                      onChange={(e) => setDownPayCash(maskCurrency(parseCurrency(e.target.value)))}
                      className="h-9 text-xs font-mono"
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Entrada no Cartão de Crédito</Label>
                    <div className="flex gap-1.5">
                      <Input
                        value={downPayCard}
                        onChange={(e) => setDownPayCard(maskCurrency(parseCurrency(e.target.value)))}
                        className="h-9 text-xs font-mono flex-1"
                        placeholder="R$ 0,00"
                      />
                      <Input
                        type="number"
                        min="1"
                        max="24"
                        value={downPayCardInstallments}
                        onChange={(e) => setDownPayCardInstallments(e.target.value)}
                        className="h-9 w-14 text-xs font-mono text-center"
                        title="Parcelas no cartão"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Financiamento */}
              {paymentMethod === 'financiamento' && (
                <div className="rounded-xl border p-4 bg-blue-500/5 border-blue-500/20 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" />
                    Condições do Financiamento Bancário
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-semibold">Banco Financiador</Label>
                      <Input
                        value={financingBank}
                        onChange={(e) => setFinancingBank(e.target.value.toUpperCase())}
                        placeholder="Ex: BANCO PAN, SANTANDER, BV..."
                        className="h-9 text-xs uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Valor Financiado</Label>
                      <Input
                        value={financedAmount}
                        onChange={(e) => setFinancedAmount(maskCurrency(parseCurrency(e.target.value)))}
                        className="h-9 text-xs font-mono font-bold"
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Qtd. Parcelas</Label>
                      <Input
                        type="number"
                        value={financingInstallments}
                        onChange={(e) => setFinancingInstallments(e.target.value)}
                        className="h-9 text-xs font-mono text-center"
                        placeholder="48"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-semibold">Valor de Cada Parcela</Label>
                      <Input
                        value={financingInstallmentValue}
                        onChange={(e) =>
                          setFinancingInstallmentValue(maskCurrency(parseCurrency(e.target.value)))
                        }
                        className="h-9 text-xs font-mono"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ABA 4: CENTRAL DE 2ª VIA & DOCUMENTOS REAIS */}
            <TabsContent value="documentos" className="m-0 space-y-6">
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Printer className="w-4 h-4 text-primary" />
                    Emissão Direta de 2ª Via Oficial
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Todos os documentos são gerados instantaneamente em PDF com cabeçalho da concessionária, carimbo de 2ª via e os dados atualizados.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs font-bold px-2.5 py-1">
                  {contractNumber}
                </Badge>
              </div>

              {/* Grid de Documentos de 2ª Via */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. 2ª Via do Contrato */}
                <div className="rounded-xl border bg-card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="h-9 w-9 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h5 className="text-sm font-bold text-foreground">2ª Via do Contrato</h5>
                    <p className="text-xs text-muted-foreground">
                      Contrato completo de Compra e Venda com todas as cláusulas jurídicas, dados da moto e assinaturas.
                    </p>
                  </div>
                    <Button
                      onClick={async () => {
                        try {
                          const { downloadOriginalContract } = await import('@/lib/originalContractExport');
                          await downloadOriginalContract(sale);
                          toast({ title: 'Contrato baixado', description: 'O PDF do contrato original foi baixado com sucesso.' });
                        } catch (e: any) {
                          try {
                            downloadContractSecondCopyPDF(secondCopyData);
                            toast({ title: 'Contrato baixado', description: 'O PDF do contrato original foi baixado com sucesso.' });
                          } catch (e2: any) {
                            toast({ variant: 'destructive', title: 'Erro ao gerar contrato', description: e2?.message || e?.message || 'Falha ao processar.' });
                          }
                        }
                      }}
                      className="mt-4 w-full text-xs font-bold gap-2 bg-red-600 hover:bg-red-700 text-white shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Contrato Oficial (PDF)
                    </Button>
                </div>

                {/* 2. 2ª Via do Recibo de Quitação */}
                <div className="rounded-xl border bg-card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <h5 className="text-sm font-bold text-foreground">2ª Via do Recibo Financeiro</h5>
                    <p className="text-xs text-muted-foreground">
                      Comprovante de pagamento e quitação integral com discriminação detalhada de PIX, dinheiro e financiamento.
                    </p>
                  </div>
                  <Button
                    onClick={() => downloadPaymentReceiptSecondCopyPDF(secondCopyData)}
                    className="mt-4 w-full text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Recibo (PDF)
                  </Button>
                </div>

                {/* 3. 2ª Via do Termo de Entrada a Pessoas Autorizadas com Assinatura Gov.br */}
                <div className="rounded-xl border bg-card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h5 className="text-sm font-bold text-foreground">Termo Pessoas Autorizadas (Gov.br)</h5>
                    <p className="text-xs text-muted-foreground">
                      Autorização formal de entrada e retirada nas dependências da loja com assinatura digital oficial Gov.br do comprador (Lei nº 14.063/2020).
                    </p>
                  </div>
                  <Button
                    onClick={() => downloadVehicleDeliveryTermPDF(secondCopyData)}
                    className="mt-4 w-full text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Termo Gov.br (PDF)
                  </Button>
                </div>
              </div>

              {/* Ações Complementares */}
              <div className="rounded-xl border p-4 bg-muted/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateInvoicePng}
                    className="text-xs font-bold gap-1.5 h-9"
                  >
                    <FileCheck className="w-4 h-4 text-amber-500" />
                    Solicitar NF (PNG)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleSendWhatsApp}
                    className="text-xs font-bold gap-1.5 h-9 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    Enviar WhatsApp ao Cliente
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Loja: <strong>{currentStore?.storeName || 'Divinópolis'}</strong>
                </div>
              </div>

              {/* Comprovantes Anexados */}
              <div className="space-y-2 pt-2 border-t">
                <ReceiptAttachmentManager saleId={sale.id} saleTitle={buyerName} />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Rodapé do Modal */}
        <DialogFooter className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {saleDate ? `Data de Registro: ${new Date(saleDate).toLocaleDateString('pt-BR')}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs font-medium">
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="h-8 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
