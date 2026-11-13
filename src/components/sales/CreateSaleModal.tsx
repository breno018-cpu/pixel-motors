import { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  Bike,
  DollarSign,
  Landmark,
  CreditCard,
  Banknote,
  QrCode,
  FileText,
  Loader2,
  AlertCircle,
  Plus,
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
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useEmployees } from '@/hooks/useEmployees';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { maskCPFCNPJ, maskPhone } from '@/lib/masks';
import { SheetRowV9 } from '@/lib/dealershipSheetParser';
import { ChassisSearchInput } from '@/components/common/ChassisSearchInput';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { isUserSellerRestricted, resolveUserSellerStore } from '@/lib/salesScope';
import { downloadInvoiceRequestPng } from '@/lib/invoiceRequestPng';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { getMonthlySheetRows } from '@/hooks/useContracts';
import { cn } from '@/lib/utils';
import { AddressFormFields } from './AddressFormFields';
import { type AddressData, INITIAL_ADDRESS } from '@/lib/cepService';

interface CreateSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVehicleId?: string | null;
  initialPreSaleId?: string | null;
  channel?: 'interna' | 'externa';
}

const COMMON_BANKS = [
  'ALTIS',
  'MOTRIX',
  'PAN',
  'BRADESCO M',
  'SANTANDER',
  'BV',
  'SAFRA',
  'À VISTA',
  'OUTRO',
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'financiamento_entrada', label: 'Financiamento Bancário com Entrada' },
  { value: 'financiamento_100', label: 'Financiamento 100% (Sem Entrada)' },
  { value: 'a_vista_pix', label: 'À Vista (PIX / Transferência)' },
  { value: 'a_vista_dinheiro', label: 'À Vista (Dinheiro em Espécie)' },
  { value: 'cartao_credito', label: 'Cartão de Crédito Parcelado' },
  { value: 'consorcio', label: 'Consórcio / Carta de Crédito' },
  { value: 'troca_com_volta', label: 'Veículo na Troca + Entrada / Financiamento' },
  { value: 'misto', label: 'Pagamento Misto / Personalizado' },
];

const FINANCING_INSTALLMENTS_OPTIONS = [12, 18, 24, 30, 36, 42, 48, 60];
const CARD_INSTALLMENTS_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 21];

const PRESET_SELLERS = [
  'Mariana',
  'Sabrina',
  'Halana',
  'Natan',
  'Lilian',
  'Geibriel',
  'Daniel',
  'Breno',
];

export function CreateSaleModal({
  open,
  onOpenChange,
  initialVehicleId,
  channel = 'interna',
}: CreateSaleModalProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles();
  const { data: stores = [] } = useStores();
  const { data: employees = [] } = useEmployees();

  const auth = useAuth();
  const { profile, user, roles, isAdmin, isManager, hasElevatedAccess, isSeller, isSellerPlus, isExternalSeller, dataScope } = auth;
  const isRestrictedSeller = useMemo(() => isUserSellerRestricted({
    userId: user?.id,
    profileId: profile?.id,
    fullName: profile?.full_name,
    email: user?.email,
    roles,
    isAdmin,
    isManager,
    hasElevatedAccess,
    isSeller,
    isSellerPlus,
    isExternalSeller,
    dataScope,
  }), [user, profile, roles, isAdmin, isManager, hasElevatedAccess, isSeller, isSellerPlus, isExternalSeller, dataScope]);

  const sellerStore = useMemo(() => resolveUserSellerStore(auth, employees), [auth, employees]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setPeriodFilter } = useDateFilter();

  // Status da Venda
  const [saleType, setSaleType] = useState<'concluido' | 'pre_venda'>('concluido');

  // Loja & Vendedor & Data (Preenchidos automaticamente para vendedores)
  const [storeId, setStoreId] = useState<string>(() => (isRestrictedSeller ? sellerStore.storeId : 'store-divinopolis'));
  const [sellerName, setSellerName] = useState<string>(() => (isRestrictedSeller && profile?.full_name ? profile.full_name : ''));
  const [customSeller, setCustomSeller] = useState('');
  const [saleDate, setSaleDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (open && isRestrictedSeller) {
      if (sellerStore?.storeId) setStoreId(sellerStore.storeId);
      if (profile?.full_name) setSellerName(profile.full_name);
      setSaleDate(new Date().toISOString().split('T')[0]);
    }
  }, [open, isRestrictedSeller, profile, sellerStore]);

  // Veículo
  const [vehicleSource, setVehicleSource] = useState<'inventory' | 'manual'>('inventory');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId || '');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleChassis, setVehicleChassis] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  // Cliente
  const [buyerName, setBuyerName] = useState('');
  const [buyerDoc, setBuyerDoc] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerAddressData, setBuyerAddressData] = useState<AddressData>(INITIAL_ADDRESS);
  const [buyerAddress, setBuyerAddress] = useState<string>('');

  // Método de Fechamento & Condições Comerciais
  const [paymentMethodCategory, setPaymentMethodCategory] = useState<string>('a_vista_pix');
  const [saleValue, setSaleValue] = useState<string>('');

  // Financiamento Bancário Detalhado
  const [finVal, setFinVal] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [finInstallments, setFinInstallments] = useState<number>(48);
  const [finInstallmentValue, setFinInstallmentValue] = useState<string>('');
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });

  // Entradas em Espécie / PIX / Consórcio
  const [cashVal, setCashVal] = useState<string>('');
  const [pixVal, setPixVal] = useState<string>('');
  const [consortiumVal, setConsortiumVal] = useState<string>('');

  // Cartão de Crédito Detalhado
  const [cardVal, setCardVal] = useState<string>('');
  const [cardInstallments, setCardInstallments] = useState<number>(1);
  const [cardInstallmentValue, setCardInstallmentValue] = useState<string>('');

  // Veículo Usado na Troca (Trade-In)
  const [hasTradeIn, setHasTradeIn] = useState<boolean>(false);
  const [tradeInModel, setTradeInModel] = useState<string>('');
  const [tradeInPlate, setTradeInPlate] = useState<string>('');
  const [tradeInValue, setTradeInValue] = useState<string>('');

  // Origem & Observações
  const [leadSource, setLeadSource] = useState('Balcão');
  const [notes, setNotes] = useState('');

  // Ajuste automático de valores conforme a forma de pagamento selecionada
  const handlePaymentMethodChange = (category: string) => {
    setPaymentMethodCategory(category);
    const total = parseFloat(saleValue) || 0;
    const totalStr = total > 0 ? String(total) : '';

    if (category === 'a_vista_pix') {
      setPixVal(totalStr);
      setCashVal('');
      setFinVal('');
      setSelectedBank('');
      setFinInstallmentValue('');
      setCardVal('');
      setConsortiumVal('');
      setHasTradeIn(false);
    } else if (category === 'a_vista_dinheiro') {
      setCashVal(totalStr);
      setPixVal('');
      setFinVal('');
      setSelectedBank('');
      setFinInstallmentValue('');
      setCardVal('');
      setConsortiumVal('');
      setHasTradeIn(false);
    } else if (category === 'financiamento_100') {
      setFinVal(totalStr);
      setSelectedBank((prev) => prev || 'BANCO PAN');
      setPixVal('');
      setCashVal('');
      setCardVal('');
      setConsortiumVal('');
      setHasTradeIn(false);
    } else if (category === 'financiamento_entrada') {
      const half = total > 0 ? (total * 0.7).toFixed(2) : '';
      const down = total > 0 ? (total * 0.3).toFixed(2) : '';
      setFinVal(half);
      setSelectedBank((prev) => prev || 'BANCO PAN');
      setPixVal(down);
      setCashVal('');
      setCardVal('');
      setConsortiumVal('');
      setHasTradeIn(false);
    } else if (category === 'cartao_credito') {
      setCardVal(totalStr);
      setFinVal('');
      setSelectedBank('');
      setFinInstallmentValue('');
      setPixVal('');
      setCashVal('');
      setConsortiumVal('');
      setHasTradeIn(false);
    } else if (category === 'consorcio') {
      setConsortiumVal(totalStr);
      setFinVal('');
      setSelectedBank('');
      setFinInstallmentValue('');
      setPixVal('');
      setCashVal('');
      setCardVal('');
      setHasTradeIn(false);
    } else if (category === 'troca_com_volta') {
      setHasTradeIn(true);
    }
  };

  // Veículos disponíveis para seleção
  const availableVehicles = useMemo(() => {
    return vehicles.filter(
      (v) => v.status === 'disponivel' || v.id === initialVehicleId || v.id === selectedVehicleId
    );
  }, [vehicles, initialVehicleId, selectedVehicleId]);

  // Atualiza campos se selecionar do estoque
  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    const found = vehicles.find((v) => v.id === id);
    if (found) {
      setVehicleModel(`${found.brand} ${found.model}`.trim());
      setVehicleChassis(found.chassis || '');
      setVehicleYear(found.year ? String(found.year) : '');
      if (found.color) setVehicleColor(found.color);
      if (found.sale_price) {
        const pStr = String(found.sale_price);
        setSaleValue(pStr);
        if (paymentMethodCategory === 'a_vista_pix') setPixVal(pStr);
        else if (paymentMethodCategory === 'a_vista_dinheiro') setCashVal(pStr);
        else if (paymentMethodCategory === 'financiamento_100') setFinVal(pStr);
      }
      if (found.store_id && !isRestrictedSeller) {
        const isMoc =
          found.store_id === 'store-montesclaros' ||
          found.store_id === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
          found.store_id.toLowerCase().includes('montes');
        setStoreId(isMoc ? 'store-montesclaros' : 'store-divinopolis');
      }
    }
  };

  const handleSaleValueChange = (val: string) => {
    setSaleValue(val);
    if (paymentMethodCategory === 'a_vista_pix') {
      setPixVal(val);
    } else if (paymentMethodCategory === 'a_vista_dinheiro') {
      setCashVal(val);
    } else if (paymentMethodCategory === 'financiamento_100') {
      setFinVal(val);
    } else if (paymentMethodCategory === 'cartao_credito') {
      setCardVal(val);
    } else if (paymentMethodCategory === 'consorcio') {
      setConsortiumVal(val);
    }
  };

  useEffect(() => {
    if (open && initialVehicleId) {
      setVehicleSource('inventory');
      handleSelectVehicle(initialVehicleId);
    } else if (!open) {
      setBuyerName('');
      setBuyerDoc('');
      setBuyerPhone('');
      setBuyerCity('');
      setBuyerAddressData(INITIAL_ADDRESS);
      setBuyerAddress('');
      setVehicleModel('');
      setVehicleChassis('');
      setVehicleYear('');
      setSelectedVehicleId('');
      setSaleValue('');
      setFinVal('');
      setSelectedBank('');
      setFinInstallmentValue('');
      setPixVal('');
      setCashVal('');
      setCardVal('');
      setCardInstallmentValue('');
      setConsortiumVal('');
      setHasTradeIn(false);
      setTradeInModel('');
      setTradeInPlate('');
      setTradeInValue('');
      setNotes('');
    }
  }, [open, initialVehicleId, vehicles]);

  // Cálculos em tempo real
  const totalValNum = parseFloat(saleValue) || 0;
  const finValNum = parseFloat(finVal) || 0;
  const cashValNum = parseFloat(cashVal) || 0;
  const pixValNum = parseFloat(pixVal) || 0;
  const cardValNum = parseFloat(cardVal) || 0;
  const consValNum = parseFloat(consortiumVal) || 0;
  const tradeInValNum = hasTradeIn ? (parseFloat(tradeInValue) || 0) : 0;

  const totalPayments = finValNum + cashValNum + pixValNum + cardValNum + consValNum + tradeInValNum;
  const diff = totalValNum - totalPayments;
  const isBalanced = Math.abs(diff) < 0.01;

  const currentSellerName = useMemo(() => {
    return (
      profile?.full_name?.trim() ||
      (user as any)?.user_metadata?.full_name?.trim() ||
      (user as any)?.user_metadata?.name?.trim() ||
      user?.email?.split('@')[0]?.trim() ||
      'Vendedor'
    );
  }, [profile, user]);

  const activeSeller = isRestrictedSeller
    ? currentSellerName
    : (sellerName === 'OUTRO' ? customSeller.trim() : (sellerName || currentSellerName));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyerName.trim()) {
      toast({
        title: 'Nome do cliente obrigatório',
        description: 'Por favor, informe o nome completo do cliente comprador.',
        variant: 'destructive',
      });
      return;
    }

    if (!vehicleModel.trim()) {
      toast({
        title: 'Modelo do veículo obrigatório',
        description: 'Informe o modelo da motocicleta/veículo vendido.',
        variant: 'destructive',
      });
      return;
    }

    if (totalValNum <= 0) {
      toast({
        title: 'Valor de venda inválido',
        description: 'O valor total da venda deve ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmar Lançamento da Venda?',
      description: `Deseja registrar a venda de ${vehicleModel} para ${buyerName} no valor de R$ ${totalValNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`,
      confirmText: 'Sim, Finalizar Venda',
      cancelText: 'Revisar Dados',
      variant: 'default',
    });

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      // 1. Atualiza a Planilha Mensal (dealflow_cloud_monthly_sheet_v9)
      let currentRows: SheetRowV9[] = [];
      try {
        const stored = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) currentRows = parsed;
        }
      } catch {}
      if (currentRows.length === 0) {
        currentRows = getMonthlySheetRows();
      }

      const nextQtNumber = String(currentRows.length + 1).padStart(2, '0');
      const effectiveStoreId = isRestrictedSeller ? (sellerStore?.storeId || storeId || 'store-divinopolis') : (storeId || 'store-divinopolis');
      const effectiveSaleDate = isRestrictedSeller ? new Date().toISOString().split('T')[0] : (saleDate || new Date().toISOString().split('T')[0]);
      const effectiveSeller = activeSeller || currentSellerName || 'Vendedor';

      const cleanSeller = effectiveSeller.toLowerCase().trim();
      const isMoc =
        (effectiveStoreId || '').includes('montesclaros') ||
        effectiveStoreId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
        (sellerStore?.storeId || '').includes('montesclaros') ||
        sellerStore?.storeId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
        cleanSeller.includes('mariana') ||
        cleanSeller.includes('sabrina') ||
        cleanSeller.includes('halana') ||
        cleanSeller.includes('natan') ||
        (buyerCity || '').toUpperCase().includes('MONTES CLAROS');
      const storeName = isMoc
        ? 'Concessionária Montes Claros (Polo Norte)'
        : 'Concessionária Divinópolis (Matriz Oeste)';

      const dateParts = effectiveSaleDate.split('-');
      const formattedDateBR = dateParts.length === 3
        ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
        : new Date().toLocaleDateString('pt-BR');

      const saleYear = dateParts.length === 3 ? dateParts[0] : String(new Date().getFullYear());
      const saleMonth = dateParts.length === 3 ? dateParts[1] : String(new Date().getMonth() + 1).padStart(2, '0');
      const saleMonthKey = `${saleYear}-${saleMonth}`;

      const newRowId = `venda-${Date.now()}`;
      const contractNumber = `${isMoc ? 'MOC' : 'DIV'}-${nextQtNumber}`;

      const installmentSummary = [
        (notes || '').trim(),
        finValNum > 0 ? `Financiamento: ${finInstallments}x de R$ ${finInstallmentValue || (finInstallments > 0 ? (finValNum / finInstallments).toFixed(2) : '0.00')} (${selectedBank || 'Banco'})` : '',
        cardValNum > 0 && cardInstallments > 1 ? `Cartão: ${cardInstallments}x de R$ ${cardInstallmentValue || (cardInstallments > 0 ? (cardValNum / cardInstallments).toFixed(2) : '0.00')}` : '',
        hasTradeIn && tradeInValNum > 0 ? `Troca: ${tradeInModel || 'Veículo Usado'} (R$ ${tradeInValNum.toLocaleString('pt-BR')})` : '',
      ].filter(Boolean).join(' | ');

      const newSheetRow: SheetRowV9 & { created_by?: string; user_id?: string; operator?: any; store_id?: string; external_data?: any } = {
        id: newRowId,
        month_key: saleMonthKey,
        qt: nextQtNumber,
        lead_mapping: leadSource || 'Balcão',
        data: formattedDateBR,
        vendedor: effectiveSeller,
        created_by: user?.id || effectiveSeller,
        user_id: user?.id || null,
        operator: {
          id: user?.id || null,
          full_name: effectiveSeller,
        },
        store_id: effectiveStoreId,
        chassi: (vehicleChassis || '').trim().toUpperCase() || `CH-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        modelo: (vehicleModel || '').trim().toUpperCase(),
        cliente: (buyerName || '').trim().toUpperCase(),
        regiao: (buyerCity || 'Divinópolis').trim().toUpperCase(),
        valor: totalValNum,
        financiamento: finValNum,
        banco: finValNum > 0 ? (selectedBank || 'Banco') : 'À VISTA',
        dinheiro: cashValNum,
        pix: pixValNum,
        carta_credito: consValNum,
        cartao: cardValNum,
        comp: 'Registrado no Sistema',
        boleto: 0,
        custos: 0,
        total: totalPayments,
        observacoes: installmentSummary,
        tipo_registro: saleType === 'pre_venda' ? 'pre_venda' : 'venda',
        is_permitted: saleType === 'concluido',
        permitted_by: saleType === 'concluido' ? (profile?.full_name || 'Administrador') : null,
        permitted_at: saleType === 'concluido' ? new Date().toISOString() : null,
        external_data: {
          vehicle_model_custom: vehicleModel,
          chassis: vehicleChassis,
          regiao: buyerCity,
          buyer_city: buyerCity,
          seller_name: effectiveSeller,
          sale_date: effectiveSaleDate,
          store_name: storeName,
        },
      };

      // Adiciona na planilha local imediatamente
      const updatedRows = [...currentRows, newSheetRow];
      localStorage.setItem('dealflow_cloud_monthly_sheet_v9', JSON.stringify(updatedRows));

      // Sincroniza o período ativo do sistema para o mês da venda recém-criada
      try {
        setPeriodFilter(saleMonthKey);
      } catch {}

      // 2. Insere no Supabase Contracts em segundo plano
      try {
        const isUuid = (val: any): boolean =>
          typeof val === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

        let targetStoreUuid: string | null = null;
        if (isUuid(effectiveStoreId)) {
          targetStoreUuid = effectiveStoreId;
        } else {
          const matchedDbStore = stores.find((s: any) =>
            isUuid(s.id) && (
              s.id === effectiveStoreId ||
              (isMoc && (s.name?.toLowerCase().includes('montes') || s.city?.toLowerCase().includes('montes'))) ||
              (!isMoc && (s.name?.toLowerCase().includes('divin') || s.city?.toLowerCase().includes('divin')))
            )
          );
          if (matchedDbStore && isUuid(matchedDbStore.id)) {
            targetStoreUuid = matchedDbStore.id;
          } else {
            targetStoreUuid = isMoc ? 'e8254a81-d669-464b-9806-457ba25ce7f0' : 'ccf8e097-09d7-4305-8077-5c16fc8b5634';
          }
        }

        const contractPayload: any = {
          contract_number: contractNumber,
          buyer_name: buyerName.trim(),
          buyer_cpf: buyerDoc.replace(/\D/g, '') || '00000000000',
          buyer_phone: buyerPhone || null,
          buyer_address: buyerAddress || (buyerCity ? `${buyerCity} - MG` : 'Não informado'),
          sale_price: totalValNum,
          down_payment: cashValNum + pixValNum + cardValNum + consValNum + tradeInValNum,
          installments: finValNum > 0 ? finInstallments : 1,
          installment_value: finValNum > 0 ? (parseFloat(finInstallmentValue) || (finValNum / finInstallments)) : null,
          status: saleType,
          payment_method: PAYMENT_METHOD_OPTIONS.find(p => p.value === paymentMethodCategory)?.label || (finValNum > 0 ? 'Financiamento' : 'À Vista'),
          financing_bank: finValNum > 0 ? selectedBank : null,
          financing_installments: finValNum > 0 ? finInstallments : null,
          financing_installment_value: finValNum > 0 ? (parseFloat(finInstallmentValue) || (finValNum / finInstallments)) : null,
          down_payment_pix: pixValNum,
          down_payment_cash: cashValNum,
          down_payment_card: cardValNum,
          down_payment_card_installments: cardInstallments,
          lead_source: leadSource,
          notes: installmentSummary || null,
          sale_channel: channel,
          external_data: {
            vehicle_model_custom: vehicleModel,
            chassis: vehicleChassis,
            regiao: buyerCity,
            buyer_city: buyerCity,
            buyer_address: buyerAddress || (buyerCity ? `${buyerCity} - MG` : 'Não informado'),
            buyer_cep: buyerAddressData.cep || '',
            buyer_street: buyerAddressData.street || '',
            buyer_number: buyerAddressData.number || '',
            buyer_neighborhood: buyerAddressData.neighborhood || '',
            buyer_complement: buyerAddressData.complement || '',
            buyer_state: buyerAddressData.state || 'MG',
            contact_platform: leadSource,
            seller_name: effectiveSeller,
            sale_date: effectiveSaleDate,
            store_name: storeName,
            payment_method_category: paymentMethodCategory,
            financing_installments: finInstallments,
            financing_installment_value: parseFloat(finInstallmentValue) || (finInstallments > 0 ? finValNum / finInstallments : 0),
            first_due_date: firstDueDate,
            card_installments: cardInstallments,
            card_installment_value: parseFloat(cardInstallmentValue) || (cardInstallments > 0 ? cardValNum / cardInstallments : 0),
            has_trade_in: hasTradeIn,
            trade_in_model: tradeInModel,
            trade_in_plate: tradeInPlate,
            trade_in_value: tradeInValNum,
            banco: selectedBank,
            financiamento: finValNum,
            dinheiro: cashValNum,
            pix: pixValNum,
            cartao: cardValNum,
          },
        };

        if (targetStoreUuid) {
          contractPayload.store_id = targetStoreUuid;
        } else {
          // Fallback seguro para as lojas padrão do banco de dados
          contractPayload.store_id = isMoc ? 'e8254a81-d669-464b-9806-457ba25ce7f0' : 'ccf8e097-09d7-4305-8077-5c16fc8b5634';
        }
        if (user?.id && isUuid(user.id)) {
          contractPayload.created_by = user.id;
        }

        let finalVehicleId = selectedVehicleId && isUuid(selectedVehicleId) ? selectedVehicleId : null;

        // Se o usuário digitou o chassi manualmente, tenta localizar o veículo no estoque (memória / Supabase)
        if (!finalVehicleId && vehicleChassis && vehicleChassis.trim().length >= 4) {
          const cleanCh = vehicleChassis.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
          const localMatch = vehicles.find((v) => {
            const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return vCh && (vCh === cleanCh || vCh.endsWith(cleanCh) || cleanCh.endsWith(vCh));
          });

          if (localMatch && isUuid(localMatch.id)) {
            finalVehicleId = localMatch.id;
          } else {
            const cleanChassis = vehicleChassis.trim().toLowerCase();
            const { data: foundV } = await supabase
              .from('vehicles')
              .select('id')
              .ilike('chassis', `%${cleanChassis}%`)
              .limit(1)
              .maybeSingle();
            if (foundV?.id) {
              finalVehicleId = foundV.id;
            }
          }
        }

        // Se o veículo ainda não existe no pátio (ou chassi novo digitado), cadastra-o no Supabase para manter integridade referencial
        if (!finalVehicleId) {
          const { data: newV, error: newVErr } = await supabase
            .from('vehicles')
            .insert([{
              brand: 'SHINERAY',
              model: vehicleModel || 'MOTO SHINERAY',
              chassis: vehicleChassis ? vehicleChassis.trim().toUpperCase() : null,
              color: vehicleColor || 'Padrão',
              status: saleType === 'concluido' ? 'vendido' : 'reservado',
              store_id: contractPayload.store_id,
              year: new Date().getFullYear(),
              sale_price: totalValNum || null,
            }])
            .select('id')
            .single();

          if (!newVErr && newV?.id) {
            finalVehicleId = newV.id;
          }
        } else {
          // Atualiza status do veículo existente
          await supabase.from('vehicles').update({ status: saleType === 'concluido' ? 'vendido' : 'reservado' }).eq('id', finalVehicleId);
        }

        contractPayload.vehicle_id = finalVehicleId;

        if (contractPayload.store_id && contractPayload.vehicle_id) {
          const { error: insErr } = await (supabase as any).from('contracts').insert([contractPayload]);
          if (insErr) {
            console.warn('[CreateSaleModal] Erro ao inserir contrato no Supabase:', insErr);
          } else {
            console.log('[CreateSaleModal] Contrato persistido com sucesso no Supabase!');
          }
        }
      } catch (err) {
        console.warn('Registro em Supabase contratos salvo localmente:', err);
      }

      // REGRA DE OURO: Se for Pré-Venda (Pré-NF), emite AUTOMATICAMENTE o papel de solicitação de NF (PNG) e NUNCA o contrato de venda!
      if (saleType === 'pre_venda') {
        try {
          await downloadInvoiceRequestPng(
            {
              nomeCompleto: buyerName.trim().toUpperCase(),
              cpf: buyerDoc || '—',
              cep: buyerAddressData.cep || '35500-000',
              endereco: buyerAddress || `${buyerCity} - MG`,
              chassi: vehicleChassis.trim().toUpperCase() || 'EM ESTOQUE / A DEFINIR',
              modeloMoto: vehicleModel.trim().toUpperCase(),
              valorNF: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValNum),
              alienacao: finValNum > 0 ? selectedBank : 'AVISTA',
            },
            `solicitacao-nf-${contractNumber}.png`
          );
        } catch (pngErr) {
          console.warn('Erro ao gerar PNG de solicitação de NF:', pngErr);
        }

        toast({
          title: 'Pré-Venda Cadastrada com Sucesso!',
          description: `Papel Oficial de Solicitação de NF gerado para ${buyerName.toUpperCase()}. (O contrato de venda NÃO foi emitido, conforme regra de Pré-NF).`,
        });
      } else {
        toast({
          title: 'Venda Faturada com Sucesso!',
          description: `Venda ${contractNumber} concluída para ${buyerName.toUpperCase()}. O contrato oficial de venda foi liberado para emissão.`,
        });
      }

      // Notifica todos os módulos da aplicação
      window.dispatchEvent(
        new CustomEvent('dealflow:sales-updated', {
          detail: {
            newSaleId: newRowId,
            monthKey: saleMonthKey,
            status: saleType,
            storeId: effectiveStoreId,
            seller: effectiveSeller,
          },
        })
      );
      window.dispatchEvent(
        new CustomEvent('dealflow:sheet-updated', {
          detail: {
            newSaleId: newRowId,
            monthKey: saleMonthKey,
          },
        })
      );
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });

      onOpenChange(false);
      // Reset completo dos campos
      setBuyerName('');
      setBuyerDoc('');
      setBuyerPhone('');
      setBuyerCity('');
      setBuyerAddressData(INITIAL_ADDRESS);
      setBuyerAddress('');
      setVehicleModel('');
      setVehicleChassis('');
      setVehicleYear('');
      setSelectedVehicleId('');
      setSaleValue('');
      setFinVal('');
      setSelectedBank('');
      setFinInstallmentValue('');
      setPixVal('');
      setCashVal('');
      setCardVal('');
      setCardInstallmentValue('');
      setConsortiumVal('');
      setHasTradeIn(false);
      setTradeInModel('');
      setTradeInPlate('');
      setTradeInValue('');
      setNotes('');
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar venda',
        description: error?.message || 'Ocorreu um erro ao salvar o lançamento.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl sm:rounded-3xl border bg-card shadow-2xl">
        {/* Cabeçalho */}
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Cadastrar Nova Venda
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Registre a venda diretamente no sistema, mapa de calor e planilha mensal da concessionária.
                </DialogDescription>
              </div>
            </div>

            {/* Alternador de Tipo de Venda */}
            <div className="flex items-center p-1 bg-muted rounded-xl border">
              <button
                type="button"
                onClick={() => setSaleType('concluido')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  saleType === 'concluido'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Quitada / Faturada
              </button>
              <button
                type="button"
                onClick={() => setSaleType('pre_venda')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  saleType === 'pre_venda'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pré-Venda (NF)
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* BANNER INFORMATIVO SE FOR PRÉ-VENDA */}
          {saleType === 'pre_venda' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300 animate-fade-in">
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Regra de Emissão de Pré-Venda (Pré-NF):</strong>
                <span>
                  Ao cadastrar, o sistema emitirá <strong>apenas o papel oficial de solicitação de NF (PNG)</strong>. O <strong>Contrato de Venda Definitivo NÃO será emitido agora</strong> — ele só é liberado no faturamento final da venda.
                </span>
              </div>
            </div>
          )}

          {/* SEÇÃO 1: LOJA, VENDEDOR E DATA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                1. Concessionária & Operador
              </h4>
              {isRestrictedSeller && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border border-primary/20">
                  Dados Oficiais Bloqueados pelo Sistema
                </Badge>
              )}
            </div>

            {isRestrictedSeller && (
              <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-md px-3 py-1.5 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Concessionária, Vendedor e Data são preenchidos automaticamente com seus dados oficiais e não podem ser alterados.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Concessionária</Label>
                {isRestrictedSeller ? (
                  <div className="h-10 px-3 mt-1 rounded-md border border-primary/30 bg-muted/40 flex items-center justify-between text-xs font-medium text-foreground">
                    <span className="flex items-center gap-2 truncate">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{sellerStore.storeName}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-background shrink-0 text-muted-foreground">
                      Bloqueado
                    </Badge>
                  </div>
                ) : (
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger className="h-10 text-xs mt-1">
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="store-divinopolis">Divinópolis (Matriz Oeste)</SelectItem>
                      <SelectItem value="store-montesclaros">Montes Claros (Polo Norte)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold">Vendedor</Label>
                {isRestrictedSeller ? (
                  <div className="h-10 px-3 mt-1 rounded-md border border-primary/30 bg-muted/40 flex items-center justify-between text-xs font-medium text-foreground">
                    <span className="flex items-center gap-2 truncate">
                      <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{profile?.full_name || 'Seu Usuário'}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-background shrink-0 text-muted-foreground">
                      Bloqueado
                    </Badge>
                  </div>
                ) : (
                  <>
                    <Select
                      value={sellerName}
                      onValueChange={(val) => {
                        setSellerName(val);
                        const clean = val.toLowerCase().trim();
                        if (
                          clean.includes('mariana') ||
                          clean.includes('sabrina') ||
                          clean.includes('halana') ||
                          clean.includes('natan')
                        ) {
                          setStoreId('store-montesclaros');
                        } else if (
                          clean.includes('lilian') ||
                          clean.includes('geibriel') ||
                          clean.includes('carlos')
                        ) {
                          setStoreId('store-divinopolis');
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs mt-1">
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESET_SELLERS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        <SelectItem value="OUTRO">Outro Vendedor...</SelectItem>
                      </SelectContent>
                    </Select>
                    {sellerName === 'OUTRO' && (
                      <Input
                        placeholder="Nome do vendedor"
                        value={customSeller}
                        onChange={(e) => setCustomSeller(e.target.value)}
                        className="h-9 text-xs mt-1.5"
                        required
                      />
                    )}
                  </>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Venda</Label>
                {isRestrictedSeller ? (
                  <div className="h-10 px-3 mt-1 rounded-md border border-primary/30 bg-muted/40 flex items-center justify-between text-xs font-medium text-foreground">
                    <span className="flex items-center gap-2 truncate">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{new Date().toLocaleDateString('pt-BR')} (Hoje)</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-background shrink-0 text-muted-foreground">
                      Bloqueado
                    </Badge>
                  </div>
                ) : (
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="h-10 text-xs mt-1"
                    required
                  />
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: VEÍCULO */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-primary" />
                2. Motocicleta / Veículo Vendido
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVehicleSource('manual')}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    vehicleSource === 'manual' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'
                  }`}
                >
                  Digitação Direta
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleSource('inventory')}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    vehicleSource === 'inventory' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'
                  }`}
                >
                  Selecionar do Estoque
                </button>
              </div>
            </div>

            {vehicleSource === 'inventory' && availableVehicles.length > 0 && (
              <div className="mb-3">
                <Label className="text-xs font-semibold">Veículo do Estoque</Label>
                <Select value={selectedVehicleId} onValueChange={handleSelectVehicle}>
                  <SelectTrigger className="h-10 text-xs mt-1">
                    <SelectValue placeholder="Selecione um veículo disponível" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.brand} {v.model} ({v.year}) {v.chassis ? `— Chassi: ${v.chassis.slice(-6)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Modelo do Veículo</Label>
                <Input
                  placeholder="Ex: SHI 250, RIO 125, SHI 175 EFI..."
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="h-10 text-xs mt-1 font-semibold"
                  required
                />
              </div>

              <div>
                <ChassisSearchInput
                  label="Chassi (Pesquise ou Digite)"
                  value={vehicleChassis}
                  onChange={(val) => setVehicleChassis(val)}
                  onSelectVehicle={(veh) => {
                    setVehicleChassis(veh.chassis || '');
                    if (veh.brand || veh.model) {
                      setVehicleModel(`${veh.brand || ''} ${veh.model || ''}`.trim());
                    }
                    if (veh.year) {
                      setVehicleYear(String(veh.year));
                    }
                    if (veh.color) {
                      setVehicleColor(veh.color);
                    }
                    if (veh.sale_price) {
                      const pStr = String(veh.sale_price);
                      setSaleValue(pStr);
                      if (paymentMethodCategory === 'a_vista_pix') setPixVal(pStr);
                      else if (paymentMethodCategory === 'a_vista_dinheiro') setCashVal(pStr);
                      else if (paymentMethodCategory === 'financiamento_100') setFinVal(pStr);
                    }
                    if (veh.id) {
                      setSelectedVehicleId(veh.id);
                      setVehicleSource('inventory');
                    }
                    if (veh.store_id && !isRestrictedSeller) {
                      const isMoc =
                        veh.store_id === 'store-montesclaros' ||
                        veh.store_id === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
                        veh.store_id.toLowerCase().includes('montes');
                      setStoreId(isMoc ? 'store-montesclaros' : 'store-divinopolis');
                    }
                  }}
                  filterStoreId={storeId}
                />
                <div className="flex items-center justify-between mt-1 px-0.5">
                  <span className="text-[10px] text-muted-foreground">Elétricas / Bicicletas</span>
                  <button
                    type="button"
                    onClick={() => setVehicleChassis('DISPENSADO')}
                    className="text-[10px] text-amber-600 hover:underline font-bold"
                  >
                    Sem Chassi (Dispensado)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: CLIENTE */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              3. Dados do Cliente Comprador
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Nome Completo</Label>
                <Input
                  placeholder="Ex: Rodrigo Victor de Moura"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="h-10 text-xs mt-1 font-semibold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">CPF ou CNPJ</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={buyerDoc}
                  onChange={(e) => setBuyerDoc(maskCPFCNPJ(e.target.value))}
                  className="h-10 text-xs mt-1 font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                <Input
                  placeholder="(37) 99999-0000"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(maskPhone(e.target.value))}
                  className="h-10 text-xs mt-1 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <AddressFormFields
                  value={buyerAddressData}
                  required
                  onChange={(data, formatted) => {
                    setBuyerAddressData(data);
                    setBuyerAddress(formatted);
                    if (data.city) {
                      setBuyerCity(data.city);
                    }
                  }}
                  title="Endereço Residencial do Comprador"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: CONDIÇÕES COMERCIAIS & DETALHAMENTO DE PAGAMENTO */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                4. Como Foi Feita a Venda & Pagamento
              </h4>
              <Badge variant="outline" className="text-[10px] font-bold">
                Detalhamento Completo
              </Badge>
            </div>

            {/* Como foi feita a venda (Método Principal) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-foreground">Como foi feita a venda? (Método Principal) *</Label>
                <Select value={paymentMethodCategory} onValueChange={handlePaymentMethodChange}>
                  <SelectTrigger className="h-10 text-xs mt-1 font-semibold">
                    <SelectValue placeholder="Selecione a forma de fechamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">Valor Total da Venda (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={saleValue}
                  onChange={(e) => handleSaleValueChange(e.target.value)}
                  className="h-10 text-xs mt-1 font-black text-foreground bg-primary/5 border-primary/30"
                  required
                />
              </div>
            </div>

            {/* BLOCO: FINANCIAMENTO BANCÁRIO & PARCELAS */}
            {(paymentMethodCategory.startsWith('financiamento') || paymentMethodCategory === 'misto' || finValNum > 0) && (
              <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        Financiamento Bancário (CDC)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Instituição financeira parceira e parcelas
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {finValNum > 0 && (
                      <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 text-[10px] font-bold">
                        R$ {finValNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFinVal('');
                        setSelectedBank('');
                        setFinInstallmentValue('');
                        if (paymentMethodCategory.startsWith('financiamento')) {
                          setPaymentMethodCategory('a_vista_pix');
                          setPixVal(saleValue);
                        }
                      }}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 border border-destructive/20 gap-1 font-semibold rounded-lg px-2"
                      title="Fechar e remover financiamento"
                    >
                      Fechar Financiamento (Ir para À Vista)
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Valor Financiado (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={finVal}
                      onChange={(e) => setFinVal(e.target.value)}
                      className="h-9 text-xs mt-1 font-semibold bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Banco Financiador</Label>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger className="h-9 text-xs mt-1 bg-background">
                        <SelectValue placeholder="Selecione o banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_BANKS.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Parcelamento do Banco</Label>
                    <Select
                      value={String(finInstallments)}
                      onValueChange={(val) => setFinInstallments(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1 font-semibold bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINANCING_INSTALLMENTS_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x parcelas
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {finValNum > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Valor da Parcela Mensal (R$/mês) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={finInstallments > 0 ? `Sugerido: ${(finValNum / finInstallments).toFixed(2)}` : '0.00'}
                        value={finInstallmentValue}
                        onChange={(e) => setFinInstallmentValue(e.target.value)}
                        className="h-9 text-xs mt-1 font-bold text-foreground bg-background"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {finInstallments}x de R$ {finInstallmentValue || (finValNum / finInstallments).toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Data do 1º Vencimento
                      </Label>
                      <Input
                        type="date"
                        value={firstDueDate}
                        onChange={(e) => setFirstDueDate(e.target.value)}
                        className="h-9 text-xs mt-1 bg-background"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BLOCO: CARTÃO DE CRÉDITO & PARCELAMENTO */}
            {(paymentMethodCategory === 'cartao_credito' || paymentMethodCategory === 'misto' || cardValNum > 0) && (
              <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    Cartão de Crédito
                  </span>
                  <div className="flex items-center gap-2">
                    {cardValNum > 0 && (
                      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
                        {cardInstallments}x de R${' '}
                        {(parseFloat(cardInstallmentValue) || (cardValNum / cardInstallments)).toFixed(2)}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCardVal('');
                        setCardInstallmentValue('');
                        if (paymentMethodCategory === 'cartao_credito') {
                          setPaymentMethodCategory('a_vista_pix');
                          setPixVal(saleValue);
                        }
                      }}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 border border-destructive/20 gap-1 font-semibold rounded-lg px-2"
                      title="Fechar e remover cartão"
                    >
                      Fechar Cartão
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Valor no Cartão (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cardVal}
                      onChange={(e) => setCardVal(e.target.value)}
                      className="h-9 text-xs mt-1 font-semibold bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Parcelas no Cartão</Label>
                    <Select
                      value={String(cardInstallments)}
                      onValueChange={(val) => setCardInstallments(parseInt(val, 10))}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARD_INSTALLMENTS_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 1 ? '1x (À Vista)' : `${n}x parcelas`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Valor da Parcela no Cartão</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={cardValNum > 0 ? (cardValNum / cardInstallments).toFixed(2) : '0.00'}
                      value={cardInstallmentValue}
                      onChange={(e) => setCardInstallmentValue(e.target.value)}
                      className="h-9 text-xs mt-1 font-semibold bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BLOCO: ENTRADAS & MEIOS À VISTA */}
            {(paymentMethodCategory.includes('vista') || paymentMethodCategory === 'financiamento_entrada' || paymentMethodCategory === 'misto' || pixValNum > 0 || cashValNum > 0 || consValNum > 0) && (
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-500" />
                    {paymentMethodCategory === 'financiamento_entrada'
                      ? 'Entrada da Venda (PIX / Dinheiro)'
                      : 'Pagamento À Vista (PIX / Dinheiro / Consórcio)'}
                  </span>
                  {(pixValNum > 0 || cashValNum > 0) && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                      Total À Vista: R$ {(pixValNum + cashValNum).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className={cn("text-[11px] font-semibold flex items-center gap-1", paymentMethodCategory === 'a_vista_pix' ? "text-emerald-600 font-bold" : "text-muted-foreground")}>
                      <QrCode className="w-3 h-3 text-emerald-500" /> PIX (R$) {paymentMethodCategory === 'a_vista_pix' && '(À Vista)'}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pixVal}
                      onChange={(e) => setPixVal(e.target.value)}
                      className="h-9 text-xs mt-1 bg-background font-semibold"
                    />
                  </div>

                  <div>
                    <Label className={cn("text-[11px] font-semibold flex items-center gap-1", paymentMethodCategory === 'a_vista_dinheiro' ? "text-green-600 font-bold" : "text-muted-foreground")}>
                      <DollarSign className="w-3 h-3 text-emerald-500" /> Dinheiro em Espécie (R$) {paymentMethodCategory === 'a_vista_dinheiro' && '(À Vista)'}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashVal}
                      onChange={(e) => setCashVal(e.target.value)}
                      className="h-9 text-xs mt-1 bg-background font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3 text-purple-500" /> Carta de Crédito / Consórcio (R$)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={consortiumVal}
                      onChange={(e) => setConsortiumVal(e.target.value)}
                      className="h-9 text-xs mt-1 bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BLOCO: VEÍCULO NA TROCA (TRADE-IN) */}
            <div className="p-3.5 rounded-2xl border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={hasTradeIn}
                    onCheckedChange={setHasTradeIn}
                    id="trade-in-switch"
                  />
                  <Label htmlFor="trade-in-switch" className="text-xs font-bold text-foreground cursor-pointer">
                    Recebeu veículo usado na troca?
                  </Label>
                </div>
                {hasTradeIn && tradeInValNum > 0 && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                    Entrada Troca: R$ {tradeInValNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                )}
              </div>

              {hasTradeIn && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40 animate-fade-in">
                  <div className="sm:col-span-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Modelo / Marca do Usado</Label>
                    <Input
                      placeholder="Ex: Honda CG 160 Fan 2021"
                      value={tradeInModel}
                      onChange={(e) => setTradeInModel(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Placa do Usado</Label>
                    <Input
                      placeholder="Ex: ABC-1D23"
                      value={tradeInPlate}
                      onChange={(e) => setTradeInPlate(e.target.value.toUpperCase())}
                      className="h-9 text-xs mt-1 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">Valor Avaliado / Entrada (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={tradeInValue}
                      onChange={(e) => setTradeInValue(e.target.value)}
                      className="h-9 text-xs mt-1 font-semibold text-emerald-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Painel de Resumo & Conciliação em Tempo Real */}
            <div className="p-3.5 rounded-2xl border bg-muted/40 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                <span className="font-bold text-foreground">Resumo do Fechamento:</span>
                <div>
                  {isBalanced ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                      Valores 100% Conciliados
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
                      Diferença: R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground block">Valor Venda:</span>
                  <strong className="text-foreground text-xs">R$ {totalValNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Entradas + Troca:</span>
                  <strong className="text-foreground text-xs">
                    R$ {(cashValNum + pixValNum + consValNum + tradeInValNum).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Financiamento:</span>
                  <strong className="text-foreground text-xs">
                    {finValNum > 0 ? `${finInstallments}x (${selectedBank})` : 'Sem fin.'}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Cartão:</span>
                  <strong className="text-foreground text-xs">
                    {cardValNum > 0 ? `${cardInstallments}x parcelas` : 'Sem cartão'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 5: OBSERVAÇÕES & ORIGEM */}
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Origem do Lead</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger className="h-10 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Balcão">Balcão / Loja Física</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="OLX">OLX</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Tráfego Pago">Anúncio / Tráfego Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Observações da Venda</Label>
                <Input
                  placeholder="Ex: Emplacamento incluso, capacete brinde, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-10 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Rodapé com Ações */}
          <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "gap-1.5 font-bold text-white shadow-md rounded-xl h-10 px-4",
                saleType === 'pre_venda'
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando Lançamento...
                </>
              ) : saleType === 'pre_venda' ? (
                <>
                  <FileText className="w-4 h-4" />
                  Cadastrar Pré-Venda & Emitir Papel de NF (PNG)
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Cadastrar Venda Faturada
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
