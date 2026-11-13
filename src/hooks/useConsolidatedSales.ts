import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isUserSellerRestricted, filterSalesBySellerScope } from '@/lib/salesScope';
import { useContracts } from '@/hooks/useContracts';
import { useEmployees } from '@/hooks/useEmployees';
import { resolveSaleStore } from '@/lib/storeResolution';
import { SheetRowV9, getLiveSheetRows } from '@/lib/dealershipSheetParser';

export interface ConsolidatedSaleItem {
  id: string;
  contract_number?: string;
  source: 'sheet' | 'contract';
  store_id: string;
  raw_store_id?: string;
  store_name: string;
  date: Date;
  dateStr: string;
  vendedor: string;
  chassi: string;
  modelo: string;
  cliente: string;
  regiao: string;
  valor: number;
  financiamento: number;
  banco: string;
  dinheiro: number;
  pix: number;
  cartao: number;
  carta_credito: number;
  boleto: number;
  custos: number;
  lead_mapping: string;
  is_permitted: boolean;
  vehicle_type: 'moto' | 'carro';
}

export function useConsolidatedSales() {
  const auth = useAuth();
  const {
    profile,
    user,
    roles,
    isAdmin,
    isManager,
    hasElevatedAccess,
    isSeller,
    isSellerPlus,
    isExternalSeller,
    dataScope,
  } = auth;

  const [sheetVersion, setSheetVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: contracts, isLoading: contractsLoading, refetch: refetchContracts } = useContracts();
  const { data: employees } = useEmployees();

  // Escuta eventos em tempo real do DealFlow
  useEffect(() => {
    const handleUpdate = () => setSheetVersion((v) => v + 1);
    window.addEventListener('dealflow:sheet-updated', handleUpdate);
    window.addEventListener('dealflow:sales-updated', handleUpdate);
    return () => {
      window.removeEventListener('dealflow:sheet-updated', handleUpdate);
      window.removeEventListener('dealflow:sales-updated', handleUpdate);
    };
  }, []);

  const isRestrictedSeller = useMemo(() => {
    return isUserSellerRestricted({
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
    });
  }, [user, profile, roles, isAdmin, isManager, hasElevatedAccess, isSeller, isSellerPlus, isExternalSeller, dataScope]);

  const monthlySheetRows: SheetRowV9[] = useMemo(() => {
    return getLiveSheetRows();
  }, [isRefreshing, sheetVersion]);

  const consolidatedSales = useMemo(() => {
    const salesMap = new Map<string, ConsolidatedSaleItem>();

    const makeDedupeKey = (item: {
      id?: string;
      chassi?: string;
      cliente?: string;
      dateStr?: string;
      valor?: number;
      modelo?: string;
    }) => {
      const cleanChassis = (item.chassi || '').trim().toUpperCase();
      const isGenericChassis =
        !cleanChassis ||
        cleanChassis.includes('DISPENSADO') ||
        cleanChassis.includes('SEM CHASSI') ||
        cleanChassis.includes('DEFINIR') ||
        cleanChassis.includes('PROVISORIO') ||
        cleanChassis === 'NAO POSSUI';

      if (!isGenericChassis && cleanChassis.length >= 6) {
        return `chassis:${cleanChassis}`;
      }
      const cleanClient = (item.cliente || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .slice(0, 16);
      const cleanVal = Math.round(item.valor || 0);
      const cleanModel = (item.modelo || '').trim().toUpperCase().slice(0, 10);
      return `sale:${item.id || ''}:${cleanClient}:${cleanVal}:${cleanModel}`;
    };

    // 1. Processa vendas da planilha oficial v9.0
    monthlySheetRows.forEach((r) => {
      const parts = r.data.split('/');
      let dateObj = new Date();
      if (parts.length === 3) {
        dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
      }

      const resolvedStore = resolveSaleStore(
        {
          store_id: (r as any).store_id,
          vendedor: r.vendedor,
          observacoes: r.observacoes,
          cliente: r.cliente,
          regiao: r.regiao,
          chassi: r.chassi,
        },
        employees
      );

      const saleItem: ConsolidatedSaleItem = {
        id: r.id,
        source: 'sheet',
        store_id: resolvedStore.storeId,
        raw_store_id: (r as any).store_id,
        store_name: resolvedStore.storeName,
        date: dateObj,
        dateStr: r.data,
        vendedor: r.vendedor?.trim() || 'Vendedor',
        chassi: r.chassi?.trim() || '',
        modelo: r.modelo?.trim() || 'Moto',
        cliente: r.cliente?.trim() || 'Cliente Balcão',
        regiao: r.regiao?.trim() || resolvedStore.city,
        valor: r.valor || 0,
        financiamento: r.financiamento || 0,
        banco: r.banco?.trim() || (r.financiamento > 0 ? 'FINANCIAMENTO' : 'À VISTA'),
        dinheiro: r.dinheiro || 0,
        pix: r.pix || 0,
        cartao: r.cartao || 0,
        carta_credito: r.carta_credito || 0,
        boleto: r.boleto || 0,
        custos: r.custos || 0,
        lead_mapping: r.lead_mapping || 'Balcão',
        is_permitted: Boolean(r.is_permitted),
        vehicle_type: 'moto',
      };

      const key = makeDedupeKey(saleItem);
      salesMap.set(key, saleItem);
    });

    // 2. Processa contratos gerados na plataforma
    (contracts || []).forEach((c) => {
      if (c.id && (c.id.startsWith('sheet-') || c.id.startsWith('row-v9-'))) {
        return;
      }

      const dateObj = new Date(c.created_at);
      const vehicleModel = c.vehicle?.model
        ? `${c.vehicle?.brand || ''} ${c.vehicle.model}`.trim()
        : ((c as any).external_data?.vehicle_model_custom || 'Veículo');
      const saleVal = Number(c.sale_price) || 0;
      const downPay = Number(c.down_payment) || 0;
      const finVal =
        Number(
          c.financing_installments && c.financing_installment_value
            ? c.financing_installments * c.financing_installment_value
            : Math.max(0, saleVal - downPay)
        ) || 0;
      const bankName = c.financing_bank || (finVal > 0 ? 'FINANCIAMENTO' : 'À VISTA');

      let cityStr = c.store?.name || 'Divinópolis';
      if (c.buyer_address) {
        const addressParts = c.buyer_address.split('-');
        if (addressParts.length >= 2) {
          cityStr = addressParts[addressParts.length - 2].trim();
        } else {
          cityStr = c.buyer_address.trim();
        }
      }

      const resolvedStore = resolveSaleStore(
        {
          store_id: c.store_id,
          store: c.store,
          vendedor: c.operator?.full_name,
          observacoes: c.notes,
          cliente: c.buyer_name,
          regiao: cityStr,
          chassi: c.vehicle?.chassis,
        },
        employees
      );

      const contractItem: ConsolidatedSaleItem = {
        id: c.id,
        contract_number: c.contract_number,
        source: 'contract',
        store_id: resolvedStore.storeId,
        raw_store_id: c.store_id,
        store_name: resolvedStore.storeName,
        date: dateObj,
        dateStr: dateObj.toLocaleDateString('pt-BR'),
        vendedor: c.operator?.full_name || 'Vendedor',
        chassi: c.vehicle?.chassis || '',
        modelo: vehicleModel,
        cliente: c.buyer_name || 'Cliente Registrado',
        regiao: cityStr,
        valor: saleVal,
        financiamento: finVal,
        banco: bankName,
        dinheiro: Number(c.down_payment_cash) || (downPay > 0 ? downPay : 0),
        pix: Number(c.down_payment_pix) || 0,
        cartao: Number(c.down_payment_card) || 0,
        carta_credito: 0,
        boleto: 0,
        custos: 0,
        lead_mapping: c.lead_source || 'Balcão',
        is_permitted: c.status === 'concluido' || c.status === 'assinado',
        vehicle_type: (c.vehicle?.vehicle_type === 'carro' ? 'carro' : 'moto'),
      };

      const key = makeDedupeKey(contractItem);
      if (salesMap.has(key)) {
        const existing = salesMap.get(key)!;
        salesMap.set(key, {
          ...existing,
          contract_number: c.contract_number,
          is_permitted: existing.is_permitted || contractItem.is_permitted,
          banco: existing.banco && existing.banco !== 'À VISTA' ? existing.banco : contractItem.banco,
        });
      } else {
        salesMap.set(key, contractItem);
      }
    });

    const rawConsolidated = Array.from(salesMap.values());

    if (isRestrictedSeller) {
      return filterSalesBySellerScope(
        rawConsolidated,
        {
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
        },
        (s) => s.vendedor
      );
    }

    return rawConsolidated;
  }, [
    monthlySheetRows,
    contracts,
    employees,
    isRestrictedSeller,
    user,
    profile,
    roles,
    isAdmin,
    isManager,
    hasElevatedAccess,
    isSeller,
    isSellerPlus,
    isExternalSeller,
    dataScope,
  ]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (refetchContracts) {
        await refetchContracts();
      }
      setSheetVersion((v) => v + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchContracts]);

  return {
    sales: consolidatedSales,
    isRestrictedSeller,
    isLoading: contractsLoading,
    isRefreshing,
    refresh,
  };
}
