import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Bike,
  User,
  DollarSign,
  Landmark,
  CreditCard,
  Banknote,
  FileText,
  FileCheck,
  ImageDown,
  Download,
  AlertCircle,
  Loader2,
  Sparkles,
  Search,
  Phone,
  MapPin,
  Building,
  ShieldAlert,
  CheckCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useContracts } from '@/hooks/useContracts';
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useFinancingBanks } from '@/hooks/useFinancingBanks';
import { useActiveTemplates } from '@/hooks/useContractTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { maskCurrency, parseCurrency, maskCPFCNPJ, maskPhone, maskCEP } from '@/lib/masks';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { getStoreFromDatabase } from '@/lib/storeResolution';
import { ChassisSearchInput } from '@/components/common/ChassisSearchInput';
import { cn } from '@/lib/utils';
import {
  generateContractFromTemplate,
  downloadContractFromTemplate,
  loadTemplateAssets,
} from '@/lib/templatePdf';
import { ReceiptAttachmentManager } from '@/components/sales/ReceiptAttachmentManager';
import {
  PaymentMethodsSelector,
  type PaymentMethodsData,
} from '@/components/sales/PaymentMethodsSelector';
import { SheetRowV9 } from '@/lib/dealershipSheetParser';

interface CompleteSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPreSaleId?: string | null;
  initialPreSale?: any | null;
}

export function CompleteSaleModal({
  open,
  onOpenChange,
  initialPreSaleId,
  initialPreSale,
}: CompleteSaleModalProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { profile, user, isAdmin, isManager } = useAuth();

  const { data: contracts = [] } = useContracts();
  const { data: vehicles = [] } = useVehicles();
  const { data: stores = [] } = useStores();
  const { data: financingBanks = [] } = useFinancingBanks();
  const { data: templates = [] } = useActiveTemplates();

  // Lista de Pré-Vendas pendentes no sistema (status: 'pre_venda' ou com flag nf_requested)
  const pendingPreSales = useMemo(() => {
    return contracts.filter(
      (c) =>
        c.status === 'pre_venda' ||
        c.status === 'pendente' ||
        (c.external_data && (c.external_data as any).nf_requested),
    );
  }, [contracts]);

  // Pré-venda selecionada para preencher o que falta
  const [selectedPreSaleId, setSelectedPreSaleId] = useState<string>(
    initialPreSaleId || initialPreSale?.id || '',
  );

  // Estados dos Dados da Venda & Cadastro Completo
  const [buyerName, setBuyerName] = useState('');
  const [buyerCpf, setBuyerCpf] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerState, setBuyerState] = useState('');
  const [buyerCep, setBuyerCep] = useState('');
  const [storeId, setStoreId] = useState('');

  const [vehicleId, setVehicleId] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleChassis, setVehicleChassis] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [salePrice, setSalePrice] = useState('');

  // Composição de Pagamento (Multi-Métodos)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsData>({
    payPix: '',
    payCash: '',
    payCreditCard: '',
    creditCardInstallments: 1,
    payDebitCard: '',
    payFinanced: '',
    financing: {
      bank: '',
      installments: 48,
      installmentValue: '',
    },
    tradeIn: {
      enabled: false,
      brand: '',
      model: '',
      year: '',
      plate: '',
      evaluated_value: '',
    },
    payConsorcio: '',
    consorcio: {
      admin: '',
      groupQuota: '',
    },
    payBoleto: '',
    boleto: {
      installments: 12,
      firstDueDate: '',
    },
  });
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');

  // Flag indicando se a NF já foi solicitada
  const [nfAlreadyRequested, setNfAlreadyRequested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ID da venda para gerenciar comprovantes
  const activeSaleTrackingId = useMemo(() => {
    return selectedPreSaleId || `sale-temp-${Date.now()}`;
  }, [selectedPreSaleId]);

  // Carrega template padrão
  useEffect(() => {
    if (templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id);
    }
  }, [templates, templateId]);

  // Atualiza ao abrir com preSaleId ou pré-venda inicial
  useEffect(() => {
    const targetId = initialPreSaleId || initialPreSale?.id;
    if (targetId) {
      setSelectedPreSaleId(targetId);
    }
  }, [initialPreSaleId, initialPreSale]);

  // Carrega os dados da pré-venda selecionada
  useEffect(() => {
    if (selectedPreSaleId) {
      const ps =
        initialPreSale?.id === selectedPreSaleId
          ? initialPreSale
          : contracts.find((c) => c.id === selectedPreSaleId);

      if (ps) {
        setBuyerName(ps.buyer_name || '');
        setBuyerCpf(ps.buyer_cpf ? maskCPFCNPJ(ps.buyer_cpf) : '');
        setBuyerPhone(ps.buyer_phone ? maskPhone(ps.buyer_phone) : '');
        setBuyerEmail(ps.buyer_email || '');
        setBuyerAddress(ps.buyer_address || '');
        setStoreId(ps.store_id || stores[0]?.id || '');
        setVehicleId(ps.vehicle_id || '');

        const ext = (ps.external_data || {}) as any;
        const v = ps.vehicle || vehicles.find((x) => x.id === ps.vehicle_id);
        if (v) {
          setVehicleModel(`${v.brand} ${v.model} ${v.year}`.trim());
          setVehicleChassis(v.chassis || '');
          setVehicleColor(v.color || '');
          setVehicleYear(v.year ? String(v.year) : '');
          if (v.store_id) setStoreId(v.store_id);
        } else if (ext?.vehicle_model_custom) {
          setVehicleModel(ext.vehicle_model_custom);
          setVehicleChassis(ext.vehicle_chassis_custom || ext.chassi || '');
          setVehicleColor(ext.cor || '');
          setVehicleYear(ext.ano ? String(ext.ano) : '');
        }

        if (ps.sale_price) {
          setSalePrice(
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              Number(ps.sale_price),
            ),
          );
        }

        const comp = ext?.payment_composition || ext?.folha_sale_meta?.payment_breakdown;
        if (comp) {
          setPaymentMethods({
            payPix: comp.pix ? maskCurrency(comp.pix) : '',
            payCash: comp.dinheiro ? maskCurrency(comp.dinheiro) : '',
            payCreditCard: comp.cartao ? maskCurrency(comp.cartao) : '',
            creditCardInstallments: comp.cartao_parcelas || 1,
            payDebitCard: comp.debito ? maskCurrency(comp.debito) : '',
            payFinanced: comp.financiado ? maskCurrency(comp.financiado) : '',
            financing: {
              bank: comp.financiamento_banco || ps.financing_bank || 'BANCO PAN',
              installments: comp.financiamento_parcelas || Number(ps.financing_installments) || 48,
              installmentValue: ps.financing_installment_value
                ? maskCurrency(ps.financing_installment_value)
                : '',
            },
            tradeIn: {
              enabled: Boolean(comp.trade_in_valor),
              brand: comp.trade_in?.brand || '',
              model: comp.trade_in?.model || '',
              year: comp.trade_in?.year || '',
              plate: comp.trade_in?.plate || '',
              evaluated_value: comp.trade_in_valor ? maskCurrency(comp.trade_in_valor) : '',
            },
            payConsorcio: comp.consorcio ? maskCurrency(comp.consorcio) : '',
            consorcio: {
              admin: comp.consorcio_admin || '',
              groupQuota: '',
            },
            payBoleto: comp.boleto ? maskCurrency(comp.boleto) : '',
            boleto: {
              installments: comp.boleto_parcelas || 12,
              firstDueDate: '',
            },
          });
        } else {
          setPaymentMethods((prev) => ({
            ...prev,
            payPix: ps.down_payment_pix ? maskCurrency(ps.down_payment_pix) : '',
            payCash: ps.down_payment_cash ? maskCurrency(ps.down_payment_cash) : '',
            payCreditCard: ps.down_payment_card ? maskCurrency(ps.down_payment_card) : '',
            creditCardInstallments: ps.down_payment_card_installments || 1,
            payFinanced: ps.financed_amount ? maskCurrency(ps.financed_amount) : '',
            financing: {
              bank: ps.financing_bank || 'BANCO PAN',
              installments: Number(ps.financing_installments) || 48,
              installmentValue: ps.financing_installment_value
                ? maskCurrency(ps.financing_installment_value)
                : '',
            },
          }));
        }

        const hasNf = ps.status === 'pre_venda' || !!ext?.nf_requested;
        setNfAlreadyRequested(hasNf);
      }
    } else {
      setNfAlreadyRequested(false);
      setBuyerName('');
      setBuyerCpf('');
      setBuyerPhone('');
      setBuyerEmail('');
      setBuyerAddress('');
      setBuyerCity('');
      setBuyerState('');
      setBuyerCep('');
      setVehicleId('');
      setVehicleModel('');
      setVehicleChassis('');
      setVehicleColor('');
      setVehicleYear('');
      setSalePrice('');
      setPaymentMethods({
        payPix: '',
        payCash: '',
        payCreditCard: '',
        creditCardInstallments: 1,
        payDebitCard: '',
        payFinanced: '',
        financing: { bank: '', installments: 48, installmentValue: '' },
        tradeIn: { enabled: false, brand: '', model: '', year: '', plate: '', evaluated_value: '' },
        payConsorcio: '',
        consorcio: { admin: '', groupQuota: '' },
        payBoleto: '',
        boleto: { installments: 12, firstDueDate: '' },
      });
    }
  }, [selectedPreSaleId, contracts, vehicles, initialPreSale, stores]);

  // Cálculos de Conciliação Financeira
  const priceNum = useMemo(() => parseCurrency(salePrice) || 0, [salePrice]);
  const pixNum = useMemo(() => parseCurrency(paymentMethods.payPix) || 0, [paymentMethods.payPix]);
  const cashNum = useMemo(() => parseCurrency(paymentMethods.payCash) || 0, [paymentMethods.payCash]);
  const cardNum = useMemo(() => parseCurrency(paymentMethods.payCreditCard) || 0, [paymentMethods.payCreditCard]);
  const debitNum = useMemo(() => parseCurrency(paymentMethods.payDebitCard) || 0, [paymentMethods.payDebitCard]);
  const financedNum = useMemo(() => parseCurrency(paymentMethods.payFinanced) || 0, [paymentMethods.payFinanced]);
  const tradeInNum = useMemo(
    () => (paymentMethods.tradeIn.enabled ? parseCurrency(paymentMethods.tradeIn.evaluated_value) || 0 : 0),
    [paymentMethods.tradeIn]
  );
  const consorcioNum = useMemo(() => parseCurrency(paymentMethods.payConsorcio) || 0, [paymentMethods.payConsorcio]);
  const boletoNum = useMemo(() => parseCurrency(paymentMethods.payBoleto) || 0, [paymentMethods.payBoleto]);

  const totalDownPayment = pixNum + cashNum + cardNum + debitNum + tradeInNum + consorcioNum + boletoNum;
  const totalPayments = totalDownPayment + financedNum;
  const financialDiff = useMemo(() => priceNum - totalPayments, [priceNum, totalPayments]);

  // REGRA DE OURO: Para sair de Pré-NF e virar Venda, PRECISA CONCLUIR TODO O CADASTRO!
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!buyerName.trim() || buyerName.trim().length < 3) {
      errors.push('Nome completo do comprador');
    }
    const unmaskedCpf = buyerCpf.replace(/\D/g, '');
    if (unmaskedCpf.length < 11) {
      errors.push('CPF ou CNPJ válido do comprador');
    }
    const unmaskedPhone = buyerPhone.replace(/\D/g, '');
    if (unmaskedPhone.length < 10) {
      errors.push('Telefone / WhatsApp com DDD do comprador');
    }
    if (!buyerAddress.trim() || buyerAddress.trim().length < 5 || buyerAddress.toLowerCase().includes('não informado')) {
      errors.push('Endereço completo de entrega/faturamento (Rua, Número, Bairro ou Cidade)');
    }
    if (!vehicleModel.trim()) {
      errors.push('Modelo da motocicleta');
    }
    const cleanChassis = vehicleChassis.trim().toUpperCase();
    if (
      !cleanChassis ||
      cleanChassis.length < 8 ||
      cleanChassis.includes('DEFINIR') ||
      cleanChassis.includes('INFORMADO') ||
      cleanChassis.includes('PROVISORIO')
    ) {
      errors.push('Número do Chassi definitivo do veículo (não provisório)');
    }
    if (priceNum <= 0) {
      errors.push('Valor total da venda (R$)');
    }
    if (priceNum > 0 && Math.abs(financialDiff) > 0.05) {
      errors.push(
        `Conciliação financeira: soma dos pagamentos (R$ ${totalPayments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) difere do valor da venda (R$ ${priceNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) - diferença de R$ ${Math.abs(financialDiff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      );
    }
    if (financedNum > 0) {
      if (!paymentMethods.financing.bank) {
        errors.push('Banco parceiro do financiamento');
      }
      if (!paymentMethods.financing.installments || paymentMethods.financing.installments <= 0) {
        errors.push('Quantidade de parcelas do financiamento');
      }
      if (!parseCurrency(paymentMethods.financing.installmentValue)) {
        errors.push('Valor da parcela mensal do financiamento (R$)');
      }
    }
    if (paymentMethods.tradeIn.enabled) {
      if (!paymentMethods.tradeIn.model) errors.push('Modelo da moto usada na troca');
      if (!paymentMethods.tradeIn.plate) errors.push('Placa da moto usada na troca');
      if (tradeInNum <= 0) errors.push('Valor de avaliação da moto usada na troca');
    }
    return errors;
  }, [
    buyerName,
    buyerCpf,
    buyerPhone,
    buyerAddress,
    vehicleModel,
    vehicleChassis,
    priceNum,
    financialDiff,
    totalPayments,
    financedNum,
    paymentMethods,
    tradeInNum,
  ]);

  const isRegistrationComplete = validationErrors.length === 0;

  // Submissão: Finalizar Venda com a Regra do Usuário
  const handleCompleteSale = async () => {
    if (!isRegistrationComplete) {
      toast({
        title: 'Cadastro Incompleto para Finalizar Venda',
        description: `Para sair de Pré-NF e concluir a venda, você precisa preencher todo o cadastro obrigatório:\n• ${validationErrors.join('\n• ')}`,
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Concluir Venda e Faturamento?',
      description: `Deseja concluir a venda do veículo ${vehicleModel} para ${buyerName}? O veículo será dado como entregue/faturado.`,
      confirmText: 'Sim, Concluir Venda',
      cancelText: 'Voltar',
      variant: 'success',
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    const unmaskedCpf = buyerCpf.replace(/\D/g, '');
    const financingBank = financedNum > 0 ? paymentMethods.financing.bank : '';
    const installments = financedNum > 0 ? String(paymentMethods.financing.installments) : '1';
    const installmentValue = financedNum > 0 ? paymentMethods.financing.installmentValue : '';

    try {
      // REGRA: Se NÃO tiver solicitado NF previamente, emite a imagem oficial de NF
      if (!nfAlreadyRequested) {
        try {
          await downloadInvoiceRequestPng(
            {
              nomeCompleto: buyerName.trim().toUpperCase(),
              cpf: unmaskedCpf,
              cep: buyerCep || (buyerAddress.match(/\d{5}-?\d{3}/)?.[0] || ''),
              endereco: buyerAddress,
              chassi: vehicleChassis.trim().toUpperCase(),
              modeloMoto: vehicleModel.trim().toUpperCase(),
              valorNF: salePrice || 'R$ 0,00',
              alienacao: financingBank ? `ALIENADO - ${financingBank.toUpperCase()}` : 'AVISTA',
            },
            `solicitacao-nf-${(vehicleChassis || 'moto').slice(-8)}.png`,
          );
        } catch (err) {
          console.warn('Erro ao emitir imagem da NF:', err);
        }
      }

      // REGRA: Identifica a concessionária correta do veículo a partir do cadastro em Organização
      const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
      const targetStoreId = storeId || selectedVehicle?.store_id || (user as any)?.user_metadata?.store_id || stores[0]?.id;
      const selectedStoreData = getStoreFromDatabase(targetStoreId, stores);

      // REGRA: Ao finalizar a venda, GERA O CONTRATO PDF DEFINITIVO!
      const selectedTemplate = templates.find((t) => t.id === templateId) || templates[0];
      if (selectedTemplate) {
        try {
          const assets = await loadTemplateAssets(selectedTemplate as any);
          const contractPayloadForPdf: any = {
            template: {
              header_content: selectedTemplate.header_content,
              body_content: selectedTemplate.body_content,
              clauses_content: selectedTemplate.clauses_content,
              signature_content: selectedTemplate.signature_content,
              fixed_clauses: selectedTemplate.fixed_clauses || [],
              optional_clauses: selectedTemplate.optional_clauses || [],
              ...assets,
            },
            client: {
              name: buyerName.trim().toUpperCase(),
              cpf: unmaskedCpf,
              phone: buyerPhone,
              address: buyerAddress,
            },
            vehicle: {
              brand: vehicleModel.split(' ')[0] || 'SHINERAY',
              model: vehicleModel,
              year: parseInt(vehicleYear, 10) || 2026,
              color: vehicleColor,
              chassis: vehicleChassis.trim().toUpperCase(),
            },
            store: {
              name: selectedStoreData.storeName,
              cnpj: selectedStoreData.cnpj || '',
              city: selectedStoreData.city ? `${selectedStoreData.city}/${selectedStoreData.state || 'MG'}` : '',
              address: selectedStoreData.address || '',
              phone: selectedStoreData.phone || '',
              email: selectedStoreData.email || '',
            },
            payment: {
              total: priceNum,
              downPayment: totalDownPayment,
              method: financedNum > 0 ? `Financiamento ${financingBank}` : 'À Vista',
              installments: Number(installments) || 48,
              installmentValue: parseCurrency(installmentValue) || 0,
            },
            contractNumber: `CTR-${Date.now().toString().slice(-6)}`,
            contractDate: new Date().toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }),
          };

          downloadContractFromTemplate(contractPayloadForPdf);
        } catch (pdfErr) {
          console.error('Falha ao gerar PDF do contrato:', pdfErr);
        }
      } else {
        const { downloadContractPDF } = await import('@/lib/contractPdf');
        downloadContractPDF({
          contractNumber: `CTR-${Date.now().toString().slice(-6)}`,
          contractType: 'venda',
          createdAt: new Date().toISOString(),
          storeName: selectedStoreData.storeName,
          storeCnpj: selectedStoreData.cnpj,
          storeAddress: selectedStoreData.address,
          storePhone: selectedStoreData.phone,
          storeEmail: selectedStoreData.email,
          buyerName: buyerName.trim().toUpperCase(),
          buyerCpf: unmaskedCpf,
          buyerPhone,
          buyerAddress,
          vehicleBrand: vehicleModel.split(' ')[0] || 'SHINERAY',
          vehicleModel,
          vehicleYear: parseInt(vehicleYear, 10) || 2026,
          vehicleColor,
          vehicleChassis: vehicleChassis.trim().toUpperCase(),
          salePrice: priceNum,
          downPayment: totalDownPayment,
          installments: Number(installments) || 48,
          installmentValue: parseCurrency(installmentValue) || 0,
        });
      }

      // Atualiza ou insere o contrato no Supabase com status 'concluido'
      const payload: any = {
        buyer_name: buyerName.trim().toUpperCase(),
        buyer_cpf: unmaskedCpf,
        buyer_phone: buyerPhone.replace(/\D/g, '') || null,
        buyer_address: buyerAddress,
        sale_price: priceNum,
        down_payment: totalDownPayment,
        down_payment_pix: pixNum,
        down_payment_cash: cashNum,
        down_payment_card: cardNum,
        financed_amount: financedNum,
        financing_bank: financingBank || null,
        financing_installments: Number(installments) || null,
        financing_installment_value: parseCurrency(installmentValue) || null,
        status: 'concluido', // Concluída oficialmente! Saiu de Pré-NF para Venda
        notes: notes || null,
        template_id: templateId || null,
        store_id: targetStoreId || selectedStoreData.storeId,
        signed_at: new Date().toISOString(),
        external_data: {
          nf_requested: true,
          completed_at: new Date().toISOString(),
          completed_by: profile?.full_name || 'Vendedor',
          chassi: vehicleChassis.trim().toUpperCase(),
          cor: vehicleColor,
          ano: vehicleYear,
          buyer_phone: buyerPhone,
          buyer_address: buyerAddress,
          vehicle_model_custom: vehicleModel,
          payment_composition: {
            pix: pixNum,
            dinheiro: cashNum,
            cartao: cardNum,
            cartao_parcelas: paymentMethods.creditCardInstallments || 1,
            debito: debitNum,
            financiado: financedNum,
            financiamento_banco: paymentMethods.financing.bank || null,
            financiamento_parcelas: paymentMethods.financing.installments || 1,
            trade_in_valor: tradeInNum,
            trade_in: paymentMethods.tradeIn.enabled ? paymentMethods.tradeIn : null,
            consorcio: consorcioNum,
            consorcio_admin: paymentMethods.consorcio.admin || null,
            boleto: boletoNum,
            boleto_parcelas: paymentMethods.boleto.installments || 1,
          },
        },
      };

      if (selectedPreSaleId) {
        await supabase.from('contracts').update(payload).eq('id', selectedPreSaleId);
      } else {
        payload.contract_number = `CTR-${Date.now().toString().slice(-6)}`;
        payload.created_by = user?.id;
        if (vehicleId) payload.vehicle_id = vehicleId;
        await supabase.from('contracts').insert(payload);
      }

      // Marca o veículo como vendido no pátio
      if (vehicleId) {
        await supabase.from('vehicles').update({ status: 'vendido' }).eq('id', vehicleId);
      }

      // Sincroniza na Planilha Mensal Local v9 da Loja: transforma em faturada / permitida (sem tom claro)
      try {
        const sheetKey = 'dealflow_cloud_monthly_sheet_v9';
        const raw = localStorage.getItem(sheetKey);
        if (raw) {
          const list: SheetRowV9[] = JSON.parse(raw);
          const updated = list.map((r) => {
            if (
              (vehicleChassis && r.chassis === vehicleChassis) ||
              r.cliente.toUpperCase().includes(buyerName.toUpperCase().slice(0, 5))
            ) {
              return {
                ...r,
                is_permitted: true, // Faturada oficial!
                tipo_registro: 'venda' as const,
                valor: priceNum || r.valor,
                financiamento: financedNum || r.financiamento,
                banco: financingBank || r.banco,
                dinheiro: cashNum || r.dinheiro,
                pix: pixNum || r.pix,
                cartao: cardNum || r.cartao,
                total: priceNum || r.total,
                observacoes: notes || r.observacoes,
              };
            }
            return r;
          });
          localStorage.setItem(sheetKey, JSON.stringify(updated));
        }
      } catch (sheetErr) {
        console.warn('Erro ao atualizar planilha v9:', sheetErr);
      }

      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['cloud-monthly-sheet-v9'] });

      toast({
        title: '🎉 Cadastro Concluído & Venda Finalizada!',
        description: nfAlreadyRequested
          ? 'Contrato de venda gerado e baixado. Registro migrado com sucesso de Pré-NF para Venda Quitado!'
          : 'Imagem da NF e Contrato de Venda gerados com sucesso (Ambos concluídos)!',
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao finalizar venda:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar venda',
        description: err.message || 'Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-3xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                Concluir Cadastro & Finalizar Venda (Gerar Contrato)
              </DialogTitle>
              <DialogDescription className="text-xs">
                {nfAlreadyRequested
                  ? 'A Pré-NF foi emitida previamente. Para migrar para Venda Quitado/Faturado e liberar o contrato definitivo, é obrigatório concluir todo o cadastro do comprador, veículo e pagamento.'
                  : 'Venda Direta: Conclua todos os dados cadastrais para gerar a Imagem da NF e o Contrato de Compra e Venda.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* BANNER DINÂMICO CONFORME O ESTADO DA NF */}
          {nfAlreadyRequested ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <strong>Solicitação de NF Emitida Anteriormente:</strong> Para sair do status de Pré-NF e faturar a venda, confirme e complete todos os dados obrigatórios abaixo. O <strong>Contrato de Compra e Venda</strong> só é emitido e liberado após o cadastro estar 100% concluído.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>Venda Direta Completa:</strong> Conclua o cadastro para emissão simultânea do <strong>Papel de NF (PNG)</strong> e do <strong>Contrato de Compra e Venda (PDF)</strong>.
              </div>
            </div>
          )}

          {/* CHECKLIST EM TEMPO REAL: REGRA DE CONCLUSÃO CADASTRAL */}
          <div
            className={cn(
              'p-3.5 rounded-2xl border transition-colors',
              isRegistrationComplete
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                {isRegistrationComplete ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className="text-xs font-bold">
                  {isRegistrationComplete
                    ? '✓ Cadastro 100% Concluído — Venda Liberada para Finalização'
                    : `⚠️ Cadastro Incompleto (${validationErrors.length} ${validationErrors.length === 1 ? 'pendência' : 'pendências'} para virar venda)`}
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5',
                  isRegistrationComplete
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300'
                )}
              >
                {isRegistrationComplete ? 'Apto para Venda' : 'Pendente Conclusão'}
              </Badge>
            </div>

            {!isRegistrationComplete && (
              <div className="text-[11px] space-y-1 pl-6">
                <p className="font-semibold text-foreground">
                  Para sair de Pré-NF e concluir a venda, preencha todos os campos obrigatórios:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {validationErrors.map((err, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[10px] font-medium text-amber-900 dark:text-amber-200"
                    >
                      • {err}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SELETOR DE PRÉ-VENDA EXISTENTE (SE HOUVER) */}
          {!initialPreSaleId && pendingPreSales.length > 0 && (
            <div className="p-3 rounded-2xl border bg-muted/20 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Continuar uma Pré-Venda Existente (Completar o que falta):
              </Label>
              <Select
                value={selectedPreSaleId}
                onValueChange={(id) => setSelectedPreSaleId(id)}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Selecione uma pré-venda ou preencha nova venda direta..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma (Nova Venda Direta com NF + Contrato) —</SelectItem>
                  {pendingPreSales.map((ps) => (
                    <SelectItem key={ps.id} value={ps.id}>
                      {ps.buyer_name} • {ps.vehicle?.model || 'Moto'} • {ps.contract_number} (NF Solicitada)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 1. DADOS CADASTRAIS DO COMPRADOR */}
          <div className="p-4 rounded-2xl bg-muted/20 border space-y-3">
            <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" /> 1. Qualificação Completa do Comprador
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">
                  Nome Completo do Cliente <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value.toUpperCase())}
                  placeholder="Nome e Sobrenome do Comprador"
                  className="h-10 mt-1 text-xs uppercase font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">
                  CPF ou CNPJ <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={buyerCpf}
                  onChange={(e) => setBuyerCpf(maskCPFCNPJ(e.target.value))}
                  placeholder="000.000.000-00"
                  className="h-10 mt-1 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  Telefone / WhatsApp <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(maskPhone(e.target.value))}
                  placeholder="(37) 99999-9999"
                  className="h-10 mt-1 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">E-mail do Cliente</Label>
                <Input
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="h-10 mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">CEP</Label>
                <Input
                  value={buyerCep}
                  onChange={(e) => setBuyerCep(maskCEP(e.target.value))}
                  placeholder="35500-000"
                  className="h-10 mt-1 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-3">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  Endereço Completo de Faturamento & Entrega <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                  className="h-10 mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 2. DADOS DO VEÍCULO & CONCESSIONÁRIA */}
          <div className="p-4 rounded-2xl bg-muted/20 border space-y-3">
            <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-primary" /> 2. Identificação do Veículo & Concessionária
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Building className="w-3 h-3 text-muted-foreground" />
                  Concessionária / Filial
                </Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className="h-10 mt-1 text-xs">
                    <SelectValue placeholder="Selecione a loja..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.city}/{s.state || 'MG'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">
                  Modelo do Veículo <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value.toUpperCase())}
                  placeholder="Ex: SHI 175 EFI"
                  className="h-10 mt-1 text-xs uppercase font-bold"
                />
              </div>

              <div>
                <ChassisSearchInput
                  label="Número do Chassi Oficial *"
                  value={vehicleChassis}
                  onChange={(val) => setVehicleChassis(val)}
                  onSelectVehicle={(veh) => {
                    setVehicleChassis(veh.chassis || '');
                    if (veh.model) setVehicleModel(veh.model);
                    if (veh.color) setVehicleColor(veh.color);
                    if (veh.year) setVehicleYear(String(veh.year));
                    if (veh.store_id) setStoreId(veh.store_id);
                    if (veh.sale_price) {
                      const pFormatted = new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(veh.sale_price);
                      setSalePrice(pFormatted);
                      setPaymentMethods((prev) => {
                        if (!prev.payFinanced && !prev.payCash && !prev.payCreditCard) {
                          return { ...prev, payPix: pFormatted };
                        }
                        return prev;
                      });
                    }
                  }}
                  filterStoreId={storeId}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Cor</Label>
                <Input
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value.toUpperCase())}
                  placeholder="Ex: PRETO, VERMELHO..."
                  className="h-10 mt-1 text-xs uppercase"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Ano de Fabricação / Modelo</Label>
                <Input
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  placeholder="Ex: 2026"
                  className="h-10 mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Modelo de Contrato PDF</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="h-10 mt-1 text-xs">
                    <SelectValue placeholder="Selecione o modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 md:col-span-3">
                <Label className="text-xs font-semibold">
                  Valor Total da Venda (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={salePrice}
                  onChange={(e) => {
                    const masked = maskCurrency(e.target.value);
                    setSalePrice(masked);
                    setPaymentMethods((prev) => {
                      if (!prev.payFinanced && !prev.payCash && !prev.payCreditCard) {
                        return { ...prev, payPix: masked };
                      }
                      return prev;
                    });
                  }}
                  placeholder="R$ 0,00"
                  className="h-11 mt-1 text-sm font-black text-foreground bg-primary/5 border-primary/30"
                />
              </div>
            </div>
          </div>

          {/* 3. COMPOSIÇÃO DE PAGAMENTO & CONCILIAÇÃO FINANCEIRA */}
          <div className="p-4 rounded-2xl bg-muted/20 border space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" /> 3. Composição & Condições Financeiras
              </span>

              {/* Conciliação Financeira Badge */}
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold px-2.5 py-0.5',
                  priceNum > 0 && Math.abs(financialDiff) <= 0.05
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-destructive/40 bg-destructive/10 text-destructive'
                )}
              >
                {priceNum > 0 && Math.abs(financialDiff) <= 0.05
                  ? 'Conciliação 100% Batida'
                  : `Diferença: ${financialDiff > 0 ? '+' : ''}R$ ${financialDiff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </Badge>
            </div>

            <PaymentMethodsSelector
              totalSalePrice={priceNum}
              data={paymentMethods}
              onChange={setPaymentMethods}
            />

            <div className="pt-2 border-t border-border/60">
              <Label className="text-xs font-semibold">Observações de Pagamento & Entrega</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Moto conferida com chave reserva, documentação de NF entregue..."
                className="h-8 mt-1 text-xs bg-background"
              />
            </div>
          </div>

          {/* 4. COMPROVANTES DE PAGAMENTO DA VENDA */}
          <div className="p-3.5 rounded-2xl bg-muted/20 border space-y-3">
            <span className="font-bold text-xs uppercase text-foreground flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-primary" /> 4. Comprovantes de Pagamento Anexados
            </span>
            <ReceiptAttachmentManager
              saleId={activeSaleTrackingId}
              saleTitle={`${buyerName || 'Cliente'} (${vehicleModel || 'Moto'})`}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 justify-between items-center w-full">
          <span className="text-[11px] text-muted-foreground">
            {isRegistrationComplete
              ? 'Tudo preenchido! Ao finalizar, o contrato de venda será emitido.'
              : `Atenção: faltam ${validationErrors.length} dados obrigatórios para liberar a venda.`}
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>

            <Button
              size="sm"
              onClick={handleCompleteSale}
              disabled={isSubmitting}
              className={cn(
                'font-bold gap-1.5 text-white shadow-md transition-all',
                isRegistrationComplete
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-muted-foreground/60 hover:bg-muted-foreground/80'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Finalizando Venda...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isRegistrationComplete
                    ? 'Concluir Cadastro & Emitir Contrato'
                    : 'Finalizar Venda (Verificar Pendências)'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
