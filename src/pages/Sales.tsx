import { useState, useMemo, useEffect } from 'react';
import { 
  Search, ShoppingCart, Calendar, Store, User, Car, Bike, Plus,
  TrendingUp, DollarSign, Clock, CheckCircle, AlertCircle, AlertTriangle, FileText,
  ImageDown, CheckCircle2, ArrowRight, Paperclip, FileSpreadsheet,
  Printer, Pencil, Copy, Check, FileCheck2, Eye, XCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useContracts, Contract, normalizeContractKey, normalizeChassisKey } from '@/hooks/useContracts';
import { useQueryClient } from '@tanstack/react-query';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import { useEmployees } from '@/hooks/useEmployees';
import {
  resolveSaleStore,
  isMatchingStore,
  STORE_DIVINOPOLIS_UUID,
  STORE_MONTESCLAROS_UUID,
  STORE_MONTESCLAROS_MULTIMARCAS_UUID,
  getContractPrefix,
  formatStoreShortName,
} from '@/lib/storeResolution';
import {
  useDealershipScope,
  DealershipBadge,
  resolveStoreToKey,
} from '@/contexts/DealershipScopeContext';
import { DealershipSegmentedBar } from '@/components/common/DealershipSegmentedBar';
import { getCleanSellerOptions, resolveSellerDisplayName, isValidSellerName, matchesSellerFilter } from '@/lib/sellerSanitizer';
import { useAuth } from '@/contexts/AuthContext';
import { isUserSellerRestricted, filterSalesBySellerScope } from '@/lib/salesScope';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { maskCPF } from '@/lib/masks';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard, FilterBar, PanelCard } from '@/components/ui/stat-card';
import { CreateSaleModal } from '@/components/sales/CreateSaleModal';
import { SaleActionsMenu } from '@/components/sales/SaleActionsMenu';
import { CompleteSaleModal } from '@/components/sales/CompleteSaleModal';
import { SaleReceiptsModal } from '@/components/sales/SaleReceiptsModal';
import { SaleManageModal } from '@/components/sales/SaleManageModal';
import { SalesSecondCopyCenter } from '@/components/sales/SalesSecondCopyCenter';
import { getSaleReceipts } from '@/components/sales/ReceiptAttachmentManager';
import { CloudMonthlySpreadsheet } from '@/components/sheets/CloudMonthlySpreadsheet';
import { INITIAL_USER_BACKUP_CSV, ONEDRIVE_DEFAULT_URL, SheetRowV9, parseBackupCsv } from '@/lib/dealershipSheetParser';
import { extractInstallmentInfoFromNotes } from '@/lib/contractDataResolver';

const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle }> = {
  pre_venda: { label: 'Pré-venda (NF)', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30', icon: FileText },
  pendente: { label: 'Aguardando aprovação', class: 'bg-warning/10 text-warning border border-warning/30', icon: Clock },
  assinado: { label: 'Assinado', class: 'bg-primary/10 text-primary border border-primary/30', icon: FileText },
  cancelado: { label: 'Cancelado', class: 'bg-destructive/10 text-destructive border border-destructive/30', icon: AlertCircle },
  concluido: { label: 'Quitado / Faturado', class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30', icon: CheckCircle },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatCPFDisplay(cpf: string) {
  if (!cpf || cpf === '—') return '—';
  if (cpf.includes('.') || cpf.includes('-') || cpf.includes('/')) return cpf;
  return maskCPF(cpf);
}

export function formatShortStoreName(storeName?: string | null): string {
  return formatStoreShortName(storeName);
}

export function getSaleChassis(sale: any): string {
  if (!sale) return '';
  return (
    sale.vehicle?.chassis ||
    (sale.external_data as any)?.chassis ||
    (sale.external_data as any)?.chassi ||
    (sale.external_data as any)?.vehicle_chassis_custom ||
    (sale as any).chassi ||
    (sale as any).vehicle_chassis ||
    ''
  ).trim();
}

function sheetRowToContract(r: SheetRowV9, employeesList?: any[]): Contract {
  const resolved = resolveSaleStore(
    {
      store_id: (r as any).store_id,
      vendedor: r.vendedor,
      observacoes: r.observacoes,
      cliente: r.cliente,
      regiao: r.regiao,
    },
    employeesList
  );
  const storeId = resolved.storeId;
  const storeName = resolved.storeName;
  const prefix = getContractPrefix(storeId, storeName);
  const isMoc = prefix === 'MOC';
  
  let createdAt = new Date().toISOString();
  if (r.data) {
    const parts = r.data.split('/');
    if (parts.length === 3) {
      createdAt = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0, 0).toISOString();
    }
  }

  const downPayment = (r.dinheiro || 0) + (r.pix || 0) + (r.cartao || 0) + (r.carta_credito || 0);

  const obsNotes = r.observacoes || (r as any).notes || '';
  const noteInfo = extractInstallmentInfoFromNotes(obsNotes);
  const isFin = (r.financiamento || 0) > 0 || Boolean(r.banco) || Boolean(noteInfo.bank);
  const resolvedInstQty = noteInfo.installments || (isFin ? 48 : 1);
  const resolvedInstVal = noteInfo.installmentValue || (isFin && (r.financiamento || 0) > 0 ? (r.financiamento / resolvedInstQty) : null);
  const resolvedBank = r.banco || noteInfo.bank || null;
  const resolvedPaymentMethod = resolvedBank 
    ? `Financiamento (${resolvedBank})` 
    : (isFin ? 'Financiamento' : (r.cartao > 0 ? 'Cartão de Crédito' : 'À Vista'));

  return {
    id: r.id || `sheet-${r.qt}`,
    contract_number: `${prefix}-${r.qt || '00'}`,
    vehicle_id: (r as any).vehicle_id || `veh-${r.id || r.qt}`,
    reseller_id: (r as any).reseller_id || null,
    store_id: storeId,
    created_by: (r as any).created_by || (r as any).user_id || r.vendedor || 'Vendedor',
    ...(r as any),
    buyer_name: r.cliente || 'Cliente não informado',
    buyer_cpf: r.lead_mapping || '—',
    buyer_phone: (r as any).buyer_phone || null,
    buyer_email: (r as any).buyer_email || null,
    buyer_address: `${r.regiao || 'Divinópolis'} - MG`,
    sale_price: r.valor || 0,
    down_payment: downPayment,
    installments: resolvedInstQty,
    installment_value: resolvedInstVal,
    status: (r.is_permitted || (r as any).tipo_registro === 'venda') && (r as any).tipo_registro !== 'pre_venda' ? 'concluido' : 'pre_venda',
    payment_method: resolvedPaymentMethod,
    financing_bank: resolvedBank,
    financing_installments: isFin ? resolvedInstQty : null,
    financing_installment_value: isFin ? resolvedInstVal : null,
    down_payment_pix: r.pix || 0,
    down_payment_cash: r.dinheiro || 0,
    down_payment_card: r.cartao || 0,
    down_payment_card_installments: null,
    lead_source: r.lead_mapping || 'Balcão',
    lead_source_detail: r.regiao || null,
    ad_id: null,
    campaign_name: null,
    signed_at: createdAt,
    signed_contract_url: null,
    notes: r.observacoes || null,
    active_clause_ids: null,
    clause_variables: null,
    revision_number: 1,
    review_status: null,
    review_note: null,
    review_requested_at: null,
    review_resolved_at: null,
    template_id: null,
    sale_group_id: null,
    sale_channel: 'interna',
    evidence_paths:
      r.comp &&
      (r.comp.startsWith('http') ||
        r.comp.startsWith('data:') ||
        r.comp.startsWith('blob:') ||
        r.comp.startsWith('/'))
        ? [r.comp]
        : [],
    external_data: {
      ...((r as any).external_data || {}),
      vehicle_model_custom: r.modelo,
      chassis: r.chassi,
      banco: r.banco,
      financiamento: r.financiamento,
      dinheiro: r.dinheiro,
      pix: r.pix,
      cartao: r.cartao,
      regiao: r.regiao,
      buyer_city: r.regiao,
      seller_name: r.vendedor,
      sale_date: r.data,
      contact_platform: r.lead_mapping || 'WhatsApp / Balcão',
    },
    created_at: createdAt,
    updated_at: createdAt,
    vehicle: {
      id: (r as any).vehicle_id || `veh-${r.id || r.qt}`,
      brand: 'SHINERAY',
      model: r.modelo || 'Moto',
      year: 2026,
      color: (r as any).cor || 'Padrão',
      plate: (r as any).placa || null,
      chassis: r.chassi || null,
      vehicle_type: 'moto',
      status: 'vendido',
    },
    store: {
      id: storeId,
      name: storeName,
    },
    operator: (r as any).operator || {
      id: (r as any).user_id || (r as any).created_by || null,
      full_name: resolveSellerDisplayName(r.vendedor, employeesList) || 'Vendedor',
    },
  };
}

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'todas' | 'faturadas' | 'pre_venda' | 'segunda_via' | 'planilha'>('todas');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [resellerFilter, setResellerFilter] = useState<string>('all');
  const dealershipScope = useDealershipScope();
  const {
    periodFilter,
    setPeriodFilter,
    isDateInPeriod,
    defaultMonthKey,
    resetToActiveMonth,
    activePeriodLabel,
  } = useDateFilter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modais de Vendas
  const [createSaleOpen, setCreateSaleOpen] = useState(false);
  const [completeSaleOpen, setCompleteSaleOpen] = useState(false);
  const [targetPreSaleForComplete, setTargetPreSaleForComplete] = useState<any | null>(null);
  const [receiptsModalOpen, setReceiptsModalOpen] = useState(false);
  const [selectedSaleForReceipts, setSelectedSaleForReceipts] = useState<any | null>(null);
  const [receiptsDefaultTab, setReceiptsDefaultTab] = useState<'nf' | 'receipts'>('receipts');
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedSaleForManage, setSelectedSaleForManage] = useState<any | null>(null);
  const [manageDefaultTab, setManageDefaultTab] = useState<'cadastro' | 'veiculo' | 'finalizacao' | 'documentos'>('cadastro');
  const [copiedChassisId, setCopiedChassisId] = useState<string | null>(null);

  const handleCopyChassis = (chassisText: string, contractNumber?: string) => {
    if (!chassisText) return;
    navigator.clipboard.writeText(chassisText);
    setCopiedChassisId(chassisText);
    toast({
      title: 'Chassi copiado!',
      description: `Chassi ${chassisText} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedChassisId(null), 2000);
  };

  const { data: contracts, isLoading: contractsLoading } = useContracts();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const { data: employees = [] } = useEmployees();
  const {
    user,
    session,
    signOut,
    profile,
    roles,
    isAdmin,
    isManager,
    hasElevatedAccess,
    canCreateSales,
    isSeller,
    isSellerPlus,
    isExternalSeller,
    dataScope,
  } = useAuth();

  // Regra de Privacidade Estrita: Vendedores NÃO veem vendas de outros vendedores
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

  const [sheetVersion, setSheetVersion] = useState(0);

  useEffect(() => {
    const handleSalesUpdate = (e: any) => {
      setSheetVersion((v) => v + 1);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });

      const detail = e?.detail;
      if (detail?.monthKey) {
        setPeriodFilter(detail.monthKey);
      }
      if (detail?.status === 'pre_venda') {
        setActiveTab('pre_venda');
      } else if (detail?.status === 'concluido') {
        setActiveTab('faturadas');
      }
      setStatusFilter('all');
      setSearch('');
    };

    const handleSheetUpdate = (e: any) => {
      setSheetVersion((v) => v + 1);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      const detail = e?.detail;
      if (detail?.monthKey) {
        setPeriodFilter(detail.monthKey);
      }
    };

    window.addEventListener('dealflow:sales-updated', handleSalesUpdate);
    window.addEventListener('dealflow:sheet-updated', handleSheetUpdate);
    return () => {
      window.removeEventListener('dealflow:sales-updated', handleSalesUpdate);
      window.removeEventListener('dealflow:sheet-updated', handleSheetUpdate);
    };
  }, [queryClient, setPeriodFilter]);

  const { currentMonthLabel, lastMonthLabel } = useMemo(() => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const now = new Date();
    const cm = now.getMonth();
    const cy = now.getFullYear();
    const lm = cm === 0 ? 11 : cm - 1;
    const ly = cm === 0 ? cy - 1 : cy;
    return {
      currentMonthLabel: `${monthNames[cm]} / ${cy}`,
      lastMonthLabel: `${monthNames[lm]} / ${ly}`,
    };
  }, []);

  const monthlySheetRows: SheetRowV9[] = useMemo(() => {
    try {
      const stored = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return parseBackupCsv(INITIAL_USER_BACKUP_CSV, '2026-10').rows;
  }, [sheetVersion]);

  // Consolidação de vendas reais (Planilha Mensal + Contratos Cadastrados)
  const allSales = useMemo(() => {
    const fromContracts = (contracts || []).map((c) => {
      const ext = (c.external_data || {}) as any;
      const rawOp =
        c.operator?.full_name ||
        ext.seller_name ||
        ext.operator_name ||
        ext.vendedor ||
        (c as any).vendedor ||
        (c as any).seller_name ||
        c.created_by;
      const opFullName = resolveSellerDisplayName(rawOp, employees) || null;
      const resolved = resolveSaleStore(
        {
          store_id: c.store_id || c.vehicle?.store_id,
          store: c.store,
          vendedor: opFullName,
          operator: opFullName ? { full_name: opFullName } : null,
          observacoes: c.notes || ext.observacoes,
          regiao: ext.regiao || ext.buyer_city || c.buyer_address,
          external_data: ext,
        },
        employees
      );
      const expectedPrefix = getContractPrefix(resolved.storeId, resolved.storeName);
      let alignedContractNumber = c.contract_number;
      if (alignedContractNumber && expectedPrefix) {
        if (/^[A-Z]{3}-/i.test(alignedContractNumber)) {
          const currentPrefix = alignedContractNumber.slice(0, 3).toUpperCase();
          if (currentPrefix !== expectedPrefix) {
            alignedContractNumber = `${expectedPrefix}-${alignedContractNumber.slice(4)}`;
          }
        } else if (/^\d+$/.test(alignedContractNumber)) {
          alignedContractNumber = `${expectedPrefix}-${alignedContractNumber}`;
        }
      }
      return {
        ...c,
        contract_number: alignedContractNumber,
        store_id: resolved.storeId,
        store: {
          id: resolved.storeId,
          name: resolved.storeName,
        },
        operator: opFullName ? { full_name: opFullName } : (c.operator && isValidSellerName(c.operator.full_name) ? c.operator : null),
      };
    });
    const contractIds = new Set(fromContracts.map((c) => c.id).filter(Boolean));
    const seenContractKeys = new Set(
      fromContracts.map((c) => normalizeContractKey(c.contract_number)).filter(Boolean)
    );
    const seenChassis = new Set(
      fromContracts
        .map((c) => normalizeChassisKey(getSaleChassis(c)))
        .filter(Boolean)
    );

    const fromSheet = monthlySheetRows
      .filter((r) => {
        if (r.id && contractIds.has(r.id)) return false;
        const resolved = resolveSaleStore({
          store_id: (r as any).store_id,
          vendedor: r.vendedor,
          observacoes: r.observacoes,
          cliente: r.cliente,
          regiao: r.regiao,
        });
        const prefix = getContractPrefix(resolved.storeId, resolved.storeName);
        const expectedNum = `${prefix}-${r.qt || '00'}`;
        const scKey = normalizeContractKey(expectedNum) || normalizeContractKey(r.qt);
        if (scKey && seenContractKeys.has(scKey)) return false;
        const ch = normalizeChassisKey(r.chassi);
        if (ch && seenChassis.has(ch)) return false;
        return true;
      })
      .map((r) => sheetRowToContract(r, employees));

    const deletedIds = new Set<string>();
    const cancelledIds = new Set<string>();
    try {
      const rawDel = localStorage.getItem('dealflow_deleted_contract_ids');
      if (rawDel) {
        const parsed = JSON.parse(rawDel);
        if (Array.isArray(parsed)) parsed.forEach((x: string) => deletedIds.add(String(x)));
      }
      const rawCanc = localStorage.getItem('dealflow_cancelled_contract_ids');
      if (rawCanc) {
        const parsed = JSON.parse(rawCanc);
        if (Array.isArray(parsed)) parsed.forEach((x: string) => cancelledIds.add(String(x)));
      }
    } catch {}

    const isDeleted = (c: any) => {
      if (deletedIds.has(c.id)) return true;
      if (c.contract_number && deletedIds.has(c.contract_number)) return true;
      return false;
    };

    const applyStatusOverrides = (c: any) => {
      if (cancelledIds.has(c.id) || (c.contract_number && cancelledIds.has(c.contract_number))) {
        return { ...c, status: 'cancelado' };
      }
      return c;
    };

    // O banco é a autoridade: contratos reais já vêm filtrados por is_deleted=false na query.
    // A lista negra local vale apenas para linhas da planilha antiga.
    const rawConsolidated = [
      ...fromContracts,
      ...fromSheet.filter((c) => !isDeleted(c)),
    ].map(applyStatusOverrides);

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
        employees
      );
    }

    return rawConsolidated;
  }, [
    contracts,
    monthlySheetRows,
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

  // Períodos e competências mensais disponíveis nas vendas
  const availablePeriods = useMemo(() => {
    const monthsMap = new Map<string, { key: string; label: string; count: number }>();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    allSales.forEach((s) => {
      const dStr = s.signed_at || s.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${monthNames[m]} / ${y}`;
        const existing = monthsMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          monthsMap.set(key, { key, label, count: 1 });
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [allSales]);

  // Vendedores — colaboradores oficiais do banco de dados (employees e DEFAULT_OFFICIAL_USERS)
  const sellerOptions = useMemo(() => {
    return getCleanSellerOptions({
      employees,
      allSales,
      storeFilter,
      isRestrictedSeller,
      currentUserFullName: profile?.full_name,
    });
  }, [employees, allSales, storeFilter, isRestrictedSeller, profile]);

  // 1. Vendas que atendem aos filtros gerais (busca, loja, vendedor, período)
  const baseFilteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = search.replace(/\D/g, '');

    return allSales.filter(sale => {
      // 1. Filtro de Busca Geral (Cliente, CPF, Contrato, Modelo, Chassi, Vendedor, Observações)
      if (term) {
        const rawCpf = (sale.buyer_cpf || '').replace(/\D/g, '');
        const saleChassis = getSaleChassis(sale);
        const rawChassis = saleChassis.toLowerCase().replace(/[^a-z0-9]/g, '');
        const termClean = term.replace(/[^a-z0-9]/g, '');

        const searchable = [
          sale.buyer_name,
          sale.buyer_cpf,
          sale.buyer_phone,
          sale.contract_number,
          sale.vehicle?.brand,
          sale.vehicle?.model,
          saleChassis,
          (sale as any).external_data?.vehicle_model_custom,
          (sale as any).external_data?.chassis,
          (sale as any).external_data?.regiao,
          (sale as any).external_data?.buyer_city,
          (sale as any).external_data?.seller_name,
          (sale as any).created_by,
          (sale as any).operator?.full_name,
          (sale as any).seller_name,
          (sale as any).vendedor,
          (sale as any).notes,
          (sale as any).observacoes,
          (sale as any).store?.name,
          (sale as any).banco,
          (sale as any).payment_method,
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesText = searchable.includes(term);
        const matchesDigits = termDigits.length >= 3 && rawCpf.includes(termDigits);
        const matchesCleanChassis = termClean.length >= 3 && rawChassis.includes(termClean);

        if (!matchesText && !matchesDigits && !matchesCleanChassis) {
          return false;
        }
      }

      // 2. Filtro de Concessionária (Escopo Global e Local)
      if (dealershipScope.activeScope !== 'all') {
        const matches = dealershipScope.matchesScope(sale.store_id || sale.store?.id || sale.store?.name);
        if (!matches) return false;
      } else if (storeFilter !== 'all') {
        const matchesStore = isMatchingStore(sale.store_id || sale.store?.id, storeFilter);
        if (!matchesStore) return false;
      }

      // 3. Filtro de Vendedor / Operador
      let matchesReseller = true;
      if (resellerFilter === 'mine') {
        matchesReseller = matchesSellerFilter(sale, profile?.full_name || user?.email || '', employees);
      } else if (resellerFilter !== 'all') {
        matchesReseller = matchesSellerFilter(sale, resellerFilter, employees);
      }
      if (!matchesReseller) return false;

      // 4. Filtro de Período
      let matchesPeriod = true;
      if (periodFilter !== 'all' && (sale as any).review_status !== 'questionada') {
        matchesPeriod = isDateInPeriod(sale.signed_at || sale.created_at);
      }
      if (!matchesPeriod) return false;

      return true;
    });
  }, [allSales, search, dealershipScope.activeScope, storeFilter, resellerFilter, periodFilter, isDateInPeriod, isRestrictedSeller, employees]);

  // Contadores e Totais Financeiros por Concessionária (Grupo L1MA Motors)
  const { dealershipCounts, dealershipFinancials } = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const financials: Record<string, number> = { all: 0 };

    allSales.forEach((sale) => {
      if (periodFilter !== 'all' && (sale as any).review_status !== 'questionada') {
        if (!isDateInPeriod(sale.signed_at || sale.created_at)) return;
      }

      const sId = sale.store_id || sale.store?.id;
      const key = resolveStoreToKey(sId || sale.store?.name);
      const val = Number(sale.sale_price) || 0;

      counts.all = (counts.all || 0) + 1;
      financials.all = (financials.all || 0) + val;

      if (key && key !== 'all') {
        counts[key] = (counts[key] || 0) + 1;
        financials[key] = (financials[key] || 0) + val;
      }
      if (sId && sId !== key) {
        counts[sId] = (counts[sId] || 0) + 1;
        financials[sId] = (financials[sId] || 0) + val;
      }
    });

    return { dealershipCounts: counts, dealershipFinancials: financials };
  }, [allSales, periodFilter, isDateInPeriod]);

  // Contadores oficiais das abas e métricas baseadas no escopo atual
  const completedSales = useMemo(() => {
    return baseFilteredSales.filter(s => s.status === 'concluido' || s.status === 'assinado');
  }, [baseFilteredSales]);

  const preSales = useMemo(() => {
    return baseFilteredSales.filter(s => s.status === 'pre_venda');
  }, [baseFilteredSales]);

  const totalSales = completedSales.length;
  const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.sale_price), 0);
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const preSalesCount = preSales.length;
  const inProgress = baseFilteredSales.filter(s => s.status === 'pendente').length;

  // 2. Vendas exibidas na tabela (respeitando a aba ativa e eventuais filtros de status específicos)
  const filteredSales = useMemo(() => {
    return baseFilteredSales
      .filter(sale => {
        if (activeTab === 'faturadas') {
          return sale.status === 'concluido' || sale.status === 'assinado';
        }
        if (activeTab === 'pre_venda') {
          return sale.status === 'pre_venda';
        }
        if (statusFilter !== 'all') {
          return sale.status === statusFilter;
        }
        return true;
      })
      .sort((a, b) => {
        const aQ = (a as any).review_status === 'questionada' ? 1 : 0;
        const bQ = (b as any).review_status === 'questionada' ? 1 : 0;
        if (aQ !== bQ) return bQ - aQ;
        const bTime = new Date(b.created_at || b.signed_at || 0).getTime() || 0;
        const aTime = new Date(a.created_at || a.signed_at || 0).getTime() || 0;
        return bTime - aTime;
      });
  }, [baseFilteredSales, activeTab, statusFilter]);

  const handleStartCompleteExisting = (sale: any) => {
    setTargetPreSaleForComplete(sale);
    setCompleteSaleOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ALERTA DE SESSÃO LOCAL SEM JWT SUPABASE */}
      {!session && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Sessão em modo local (desconectada do banco de dados em nuvem)</p>
              <p className="text-[11px] opacity-90">
                Você está vendo apenas dados antigos em cache local. Clique em <strong>Reconectar</strong> e entre com seu e-mail e senha cadastrados no Supabase para ver todas as vendas atualizadas do banco em tempo real.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => signOut()}
            className="h-8 text-xs font-bold border-amber-500/40 hover:bg-amber-500/20 shrink-0"
          >
            Reconectar ao Banco
          </Button>
        </div>
      )}

      {/* CABEÇALHO PADRONIZADO */}
      <PageHeader
        title="Vendas"
        description="Vendas faturadas, pré-vendas e emissão de contratos das lojas de Montes Claros e Divinópolis."
        actions={
          <div className="flex items-center gap-2">
            {canCreateSales && (
              <Button
                size="sm"
                onClick={() => setCreateSaleOpen(true)}
                className="gap-1.5 font-semibold"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Venda
              </Button>
            )}
          </div>
        }
      />

      {/* Alerta de Escopo Restrito para Vendedores */}
      {isRestrictedSeller && (
        <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border border-primary/30 bg-primary/5 text-xs text-primary font-medium">
          <User className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span className="truncate">
            Painel Individual: <strong>{profile?.full_name || 'Vendedor'}</strong>
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label={isRestrictedSeller ? "Minhas Faturadas" : "Vendas Faturadas"} value={totalSales} icon={ShoppingCart} tone="success" small />
        <StatCard label={isRestrictedSeller ? "Minhas Pré-Vendas" : "Pré-Vendas (NF)"} value={preSalesCount} icon={FileText} tone="warning" small />
        <StatCard label={isRestrictedSeller ? "Meu Faturamento" : "Receita Faturada"} value={formatCurrency(totalRevenue)} icon={DollarSign} small />
        <StatCard label={isRestrictedSeller ? "Ticket Médio" : "Ticket médio"} value={formatCurrency(avgTicket)} icon={TrendingUp} tone="neutral" small />
      </div>

      {/* ABAS DO MÓDULO DE VENDAS */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-muted/50 rounded-xl sm:rounded-2xl border overflow-x-auto no-scrollbar w-full sm:w-fit">
        <Button
          size="sm"
          variant={activeTab === 'todas' ? 'default' : 'ghost'}
          onClick={() => {
            setActiveTab('todas');
            setStatusFilter('all');
          }}
          className="text-xs font-bold gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl shadow-xs shrink-0"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Todas ({baseFilteredSales.length})</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'faturadas' ? 'default' : 'ghost'}
          onClick={() => {
            setActiveTab('faturadas');
            setStatusFilter('all');
          }}
          className={cn(
            "text-xs font-bold gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl transition-colors shrink-0",
            activeTab === 'faturadas'
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          )}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>Faturadas ({completedSales.length})</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'pre_venda' ? 'default' : 'ghost'}
          onClick={() => {
            setActiveTab('pre_venda');
            setStatusFilter('all');
          }}
          className={cn(
            "text-xs font-bold gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl transition-colors shrink-0",
            activeTab === 'pre_venda'
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          )}
        >
          <FileText className="w-3.5 h-3.5 text-amber-500" />
          <span>Pré-Vendas ({preSalesCount})</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'segunda_via' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('segunda_via')}
          className={cn(
            "text-xs font-bold gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl transition-colors shrink-0",
            activeTab === 'segunda_via'
              ? "bg-red-600 hover:bg-red-700 text-white shadow-xs"
              : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
          )}
        >
          <Printer className="w-3.5 h-3.5 text-red-500" />
          <span>2ª Via</span>
        </Button>
        {!isRestrictedSeller && (
          <Button
            size="sm"
            variant={activeTab === 'planilha' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('planilha')}
            className={cn(
              "text-xs font-bold gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl transition-colors shrink-0",
              activeTab === 'planilha'
                ? "bg-sky-600 hover:bg-sky-700 text-white"
                : "text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-500" />
            <span className="hidden sm:inline">Planilha de Vendas & Excel Online</span>
            <span className="sm:hidden">Planilha</span>
          </Button>
        )}
      </div>

      {activeTab === 'planilha' && !isRestrictedSeller ? (
        <div className="pt-2">
          <CloudMonthlySpreadsheet onedriveUrl={ONEDRIVE_DEFAULT_URL} />
        </div>
      ) : activeTab === 'segunda_via' ? (
        <div className="pt-2">
          <SalesSecondCopyCenter sales={allSales} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtro de loja via Select na FilterBar abaixo */}

          {/* Filters */}
          <FilterBar>
            <div className="relative min-w-0 flex-1 w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, CPF, contrato, chassi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 sm:h-10 pl-9 text-xs w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2 w-full sm:w-auto">
              {/* Quick Toggle: Toda Equipe vs Minhas Vendas */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={resellerFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setResellerFilter('all')}
                  className="h-9 sm:h-10 text-xs font-semibold px-2.5 rounded-lg flex-1 sm:flex-initial"
                >
                  Toda Equipe
                </Button>
                {profile?.full_name && (
                  <Button
                    type="button"
                    size="sm"
                    variant={resellerFilter === 'mine' ? 'default' : 'outline'}
                    onClick={() => setResellerFilter(resellerFilter === 'mine' ? 'all' : 'mine')}
                    className="h-9 sm:h-10 text-xs font-semibold px-2.5 rounded-lg flex-1 sm:flex-initial"
                  >
                    Minhas Vendas
                  </Button>
                )}
              </div>

              {/* Concessionária Filter */}
              <Select
                value={storeFilter}
                onValueChange={(val) => {
                  setStoreFilter(val);
                  dealershipScope.setActiveScope(val);

                  if (val !== 'all' && resellerFilter !== 'all') {
                    setResellerFilter('all');
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-[175px] h-9 sm:h-10 text-xs">
                  <Store className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas</SelectItem>
                  {(stores || [])
                    .filter((s) => s.is_active !== false)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatStoreShortName(s.name)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Vendedor Filter */}
              <Select value={resellerFilter} onValueChange={setResellerFilter}>
                <SelectTrigger className="w-full sm:w-[165px] h-9 sm:h-10 text-xs">
                  <User className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {storeFilter === 'all' ? 'Toda Equipe' : 'Equipe da Loja'}
                  </SelectItem>
                  {profile?.full_name && (
                    <SelectItem value="mine">
                      👤 Minhas Vendas ({profile.full_name.split(' ')[0]})
                    </SelectItem>
                  )}
                  {sellerOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 sm:h-10 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pre_venda">Pré-venda (NF)</SelectItem>
                  <SelectItem value="concluido">Quitado / Faturado</SelectItem>
                  <SelectItem value="pendente">Aguardando aprovação</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              {/* Period Filter */}
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-full sm:w-[165px] h-9 sm:h-10 text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent className="max-h-[340px]">
                  <SelectItem value="month">Este mês ({currentMonthLabel})</SelectItem>
                  <SelectItem value="lastmonth">Mês anterior ({lastMonthLabel})</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="365d">Este ano ({new Date().getFullYear()})</SelectItem>
                  <SelectItem value="all">Todo o período ({allSales.length} vendas)</SelectItem>
                  {availablePeriods.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t my-1">
                        Meses Específicos
                      </div>
                      {availablePeriods.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label} ({p.count})
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>

              {(search || storeFilter !== 'all' || resellerFilter !== 'all' || statusFilter !== 'all' || periodFilter !== defaultMonthKey) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStoreFilter('all');
                    setResellerFilter('all');
                    setStatusFilter('all');
                    resetToActiveMonth();
                  }}
                  className="col-span-2 sm:col-span-1 h-8 sm:h-10 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                >
                  Resetar filtros
                </Button>
              )}
            </div>
          </FilterBar>

          {/* Banner de Transparência e Escopo do Período */}
          {periodFilter !== 'all' ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs animate-scale-in">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Exibindo competência: <strong className="text-foreground">{activePeriodLabel || currentMonthLabel}</strong> ({filteredSales.length} de {allSales.length} vendas registradas no sistema).
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriodFilter('all')}
                className="h-7 text-xs font-semibold gap-1.5 shrink-0 bg-background hover:bg-muted shadow-2xs border-primary/30"
              >
                <Eye className="w-3.5 h-3.5 text-primary" />
                Ver Todo o Histórico ({allSales.length} Vendas)
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs animate-scale-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Exibindo o <strong>Histórico Completo da Concessionária</strong> ({allSales.length} vendas cadastradas em todos os meses).
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetToActiveMonth}
                className="h-7 text-xs font-semibold gap-1.5 shrink-0 bg-background hover:bg-muted shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Voltar para Mês Atual ({currentMonthLabel})
              </Button>
            </div>
          )}

      {/* Table */}
      {contractsLoading && allSales.length === 0 ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShoppingCart className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {activeTab === 'faturadas' && preSalesCount > 0
              ? 'Nenhuma venda quitada/faturada ainda neste período'
              : 'Nenhuma venda encontrada'}
          </h3>
          {activeTab === 'faturadas' && preSalesCount > 0 ? (
            <div className="my-3 p-3 max-w-md bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Você possui {preSalesCount} pré-venda(s) com NF solicitada cadastrada(s) neste período.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('pre_venda')}
                className="mt-2.5 gap-2 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              >
                <FileText className="w-4 h-4 text-amber-500" />
                Ver Pré-Vendas & NF ({preSalesCount})
              </Button>
            </div>
          ) : (
            <p className="mb-4 mt-1 max-w-sm text-center text-sm text-muted-foreground">
              {search || storeFilter !== 'all' || resellerFilter !== 'all' || periodFilter !== 'all' || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca ou o período selecionado.'
                : 'Registre novas solicitações de NF ou finalize vendas para vê-las aqui.'}
            </p>
          )}
          {canCreateSales && (
            <Button
              onClick={() => setCreateSaleOpen(true)}
              className="gap-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Venda
            </Button>
          )}
        </div>
      ) : (
        <PanelCard
          title="Vendas & Pré-Vendas Registradas"
          description="Acompanhe as pré-vendas com NF solicitada e as vendas faturadas com contrato emitido."
          aside={<span className="text-xs font-medium text-muted-foreground">{filteredSales.length} registros</span>}
        >
          {/* Visualização Mobile Otimizada: Cards Verticais Touch sem Scroll Lateral */}
          <div className="md:hidden space-y-2.5">
            {filteredSales.map((sale) => {
              const statusInfo = statusConfig[sale.status] || statusConfig.pendente;
              const vehicle = sale.vehicle;
              const VehicleIcon = vehicle?.vehicle_type === 'moto' ? Bike : Car;
              const isPreSale = sale.status === 'pre_venda';
              const isCancelled = sale.status === 'cancelado';
              const saleChassis = getSaleChassis(sale);
              const receiptsCount = Math.max(
                getSaleReceipts(sale.id).length,
                ((sale.external_data as any)?.receipts as any[])?.length || 0,
                sale.evidence_paths?.length || 0,
              );

              return (
                <div
                  key={`mobile-${sale.id}`}
                  className={cn(
                    "rounded-2xl border bg-card/90 p-3 shadow-xs space-y-2.5 transition-all relative",
                    isPreSale && "bg-amber-500/5 border-amber-500/30",
                    isCancelled && "opacity-75 bg-rose-500/[0.03] border-rose-500/20",
                    (sale as any).review_status === 'questionada' && "border-destructive/40 bg-destructive/5"
                  )}
                >
                  {/* Top: Contrato / Ref + Status Badge + Ações */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {sale.contract_number}
                      </span>
                      {isCancelled ? (
                        <Badge variant="outline" className="text-[9.5px] font-bold px-2 py-0 h-4.5 shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                          Cancelado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className={cn("text-[9.5px] font-bold px-2 py-0 h-4.5 shrink-0", statusInfo.class)}>
                          {statusInfo.label}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSaleForReceipts(sale);
                          setReceiptsModalOpen(true);
                        }}
                        className={cn(
                          'h-7 w-7 p-0',
                          receiptsCount > 0 ? 'text-primary' : 'text-muted-foreground'
                        )}
                        title="Comprovantes"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {receiptsCount > 0 && (
                          <span className="text-[9px] font-mono font-bold ml-0.5">{receiptsCount}</span>
                        )}
                      </Button>
                      <SaleActionsMenu 
                        sale={sale}
                        vehicleName={vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : undefined}
                        storeName={sale.store?.name}
                        resellerName={sale.reseller?.full_name}
                      />
                    </div>
                  </div>

                  {/* Meio: Cliente & Veículo */}
                  <div className="space-y-1.5 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground truncate">{sale.buyer_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">{formatCPFDisplay(sale.buyer_cpf)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <VehicleIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-medium text-foreground truncate">
                        {vehicle ? `${vehicle.brand} ${vehicle.model}` : (sale as any).external_data?.vehicle_model_custom || 'Veículo não informado'}
                      </span>
                      {vehicle?.color && (
                        <span className="text-[10px] text-muted-foreground shrink-0">({vehicle.color})</span>
                      )}
                    </div>

                    {/* Linha de Chassi no Mobile com Cópia Rápida */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/40">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">
                        Chassi:
                      </span>
                      {saleChassis ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyChassis(saleChassis, sale.contract_number);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/80 hover:bg-primary/10 border border-border/70 text-[11px] font-mono font-bold text-foreground transition-all group/chassis"
                          title="Toque para copiar o chassi"
                        >
                          {copiedChassisId === saleChassis ? (
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground group-hover/chassis:text-primary shrink-0" />
                          )}
                          <span className="truncate">{saleChassis}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                          A definir / Em faturamento
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rodapé: Loja/Vendedor + Data + Preço */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate flex-wrap">
                      <DealershipBadge storeIdOrName={sale.store?.name || sale.store_id} />
                      <span>•</span>
                      <span className="truncate">{resolveSellerDisplayName((sale as any).operator?.full_name || (sale as any).external_data?.seller_name || (sale as any).external_data?.operator_name || (sale as any).vendedor || (sale as any).created_by, employees) || 'Vendedor'}</span>
                      <span>•</span>
                      <span className="shrink-0">{formatDate(sale.created_at)}</span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={cn("font-display font-black text-xs", isCancelled ? "line-through text-muted-foreground" : "text-foreground")}>
                        {formatCurrency(Number(sale.sale_price))}
                      </span>
                    </div>
                  </div>

                  {/* Ação rápida direta para Pré-Venda: Concluir Cadastro */}
                  {isPreSale && canCreateSales && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartCompleteExisting(sale)}
                      className="w-full h-7 text-[11px] gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shadow-2xs mt-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Concluir Cadastro & Faturar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Visualização Desktop: Tabela Compacta 100% Ajustada sem Quebra de Linhas Indesejadas */}
          <div className="hidden md:block rounded-xl border border-border/60 overflow-x-auto bg-card/40">
            <table className="w-full min-w-[990px] table-fixed text-sm">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-left">
                  <th className="whitespace-nowrap px-2.5 py-2.5 w-[85px]">Contrato</th>
                  <th className="px-2 py-2.5 w-[145px]">Cliente</th>
                  <th className="px-2 py-2.5 w-[170px]">Veículo & Chassi</th>
                  <th className="hidden lg:table-cell px-2 py-2.5 w-[105px] whitespace-nowrap">Loja</th>
                  <th className="hidden lg:table-cell px-2 py-2.5 w-[90px] whitespace-nowrap">Operador</th>
                  <th className="text-right whitespace-nowrap px-2 py-2.5 w-[80px]">Valor</th>
                  <th className="whitespace-nowrap px-2 py-2.5 w-[135px]">Status / Etapa</th>
                  <th className="whitespace-nowrap text-center px-2 py-2.5 w-[75px]">Data</th>
                  <th className="text-right whitespace-nowrap pr-3 px-2 py-2.5 w-[115px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredSales.map((sale) => {
                  const statusInfo = statusConfig[sale.status] || statusConfig.pendente;
                  const StatusIcon = statusInfo.icon || CheckCircle;
                  const vehicle = sale.vehicle;
                  const VehicleIcon = vehicle?.vehicle_type === 'moto' ? Bike : Car;
                  const isPreSale = sale.status === 'pre_venda';
                  const isCancelled = sale.status === 'cancelado';
                  const saleChassis = getSaleChassis(sale);
                  const receiptsCount = Math.max(
                    getSaleReceipts(sale.id).length,
                    ((sale.external_data as any)?.receipts as any[])?.length || 0,
                    sale.evidence_paths?.length || 0,
                  );

                  return (
                    <tr
                      key={sale.id}
                      className={cn(
                        'group transition-colors hover:bg-muted/40',
                        isPreSale && 'bg-amber-500/5 hover:bg-amber-500/10',
                        isCancelled && 'opacity-70 bg-rose-500/[0.02] dark:bg-rose-500/[0.04]',
                        (sale as any).review_status === 'questionada' && 'review-row'
                      )}
                    >
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span className="whitespace-nowrap font-mono text-xs font-bold text-foreground">{sale.contract_number}</span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="max-w-[140px]">
                          <p className="font-bold text-xs text-foreground truncate" title={sale.buyer_name}>{sale.buyer_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{formatCPFDisplay(sale.buyer_cpf)}</p>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-start gap-1.5 max-w-[165px]">
                          <VehicleIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-semibold text-foreground truncate" title={vehicle ? `${vehicle.brand} ${vehicle.model}` : (sale as any).external_data?.vehicle_model_custom}>
                              {vehicle ? `${vehicle.brand} ${vehicle.model}` : (sale as any).external_data?.vehicle_model_custom || 'Veículo'}
                              {vehicle?.year ? ` (${vehicle.year})` : ''}
                            </p>
                            {saleChassis ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyChassis(saleChassis, sale.contract_number);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/80 hover:bg-primary/10 border border-border/70 hover:border-primary/40 text-[9.5px] font-mono font-bold text-foreground transition-all group/chassis shadow-2xs whitespace-nowrap shrink-0"
                                title={`Clique para copiar o chassi: ${saleChassis}`}
                              >
                                {copiedChassisId === saleChassis ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 text-muted-foreground group-hover/chassis:text-primary shrink-0" />
                                )}
                                <span className="tracking-tight">{saleChassis}</span>
                              </button>
                            ) : (
                              <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium italic whitespace-nowrap">
                                Chassi a definir
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-2 whitespace-nowrap">
                        <DealershipBadge storeIdOrName={sale.store?.name || sale.store_id} />
                      </td>
                      <td className="hidden lg:table-cell px-2 py-2 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground truncate max-w-[85px] block whitespace-nowrap" title={resolveSellerDisplayName((sale as any).operator?.full_name || (sale as any).external_data?.seller_name || (sale as any).external_data?.operator_name || (sale as any).vendedor || (sale as any).created_by, employees) || '-'}>
                          {resolveSellerDisplayName((sale as any).operator?.full_name || (sale as any).external_data?.seller_name || (sale as any).external_data?.operator_name || (sale as any).vendedor || (sale as any).created_by, employees) || '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-right px-2 py-2">
                        <span className={cn('font-display font-black text-xs whitespace-nowrap', isCancelled ? 'line-through text-muted-foreground' : 'text-foreground')}>{formatCurrency(Number(sale.sale_price))}</span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <div className="flex flex-col items-start gap-1 shrink-0 whitespace-nowrap">
                          {isCancelled ? (
                            <Badge variant="outline" className="text-[9.5px] font-bold py-0.5 px-2 whitespace-nowrap shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 shadow-2xs">
                              <XCircle className="w-2.5 h-2.5 shrink-0" />
                              <span className="whitespace-nowrap">Cancelado</span>
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className={cn('text-[9.5px] font-bold py-0.5 px-2 whitespace-nowrap shrink-0 inline-flex items-center gap-1 rounded-full shadow-2xs', statusInfo.class)}>
                              <StatusIcon className="w-2.5 h-2.5 shrink-0" />
                              <span className="whitespace-nowrap">{statusInfo.label}</span>
                            </Badge>
                          )}
                          
                          {/* BOTÃO DIRETO DE FINALIZAR VENDA (CONCLUIR CADASTRO) */}
                          {isPreSale && canCreateSales && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartCompleteExisting(sale)}
                              className="h-5 px-1.5 text-[9px] gap-1 font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shadow-2xs whitespace-nowrap shrink-0"
                              title="Concluir todo o cadastro do comprador, chassi e pagamento para faturar e emitir contrato"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                              <span className="whitespace-nowrap">Concluir</span>
                            </Button>
                          )}

                          {/* INDICADOR & ATALHO DE NOTA FISCAL (NF) */}
                          {!isCancelled && (() => {
                            const ext = (sale.external_data || {}) as Record<string, any>;
                            const nfNum = ext.invoice_number;
                            const hasNfFile = Boolean(ext.invoice_url);

                            if (nfNum || hasNfFile) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSaleForReceipts(sale);
                                    setReceiptsDefaultTab('nf');
                                    setReceiptsModalOpen(true);
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors shadow-2xs whitespace-nowrap shrink-0',
                                    hasNfFile
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                  )}
                                  title={`Nota Fiscal ${nfNum ? `nº ${nfNum}` : ''} ${hasNfFile ? '(Arquivo Anexado)' : '(Pendente de Arquivo)'}. Clique para visualizar ou anexar.`}
                                >
                                  <FileCheck2 className="w-2.5 h-2.5 shrink-0" />
                                  <span className="whitespace-nowrap">NF {nfNum || 'Anexa'}</span>
                                </button>
                              );
                            }

                            if (!isPreSale) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSaleForReceipts(sale);
                                    setReceiptsDefaultTab('nf');
                                    setReceiptsModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted/70 text-muted-foreground border border-dashed border-border/80 hover:border-primary/50 hover:text-primary transition-all shadow-2xs whitespace-nowrap shrink-0"
                                  title="Clique para anexar a Nota Fiscal oficial desta venda"
                                >
                                  <FileText className="w-2.5 h-2.5 shrink-0" />
                                  <span className="whitespace-nowrap">+ Anexar NF</span>
                                </button>
                              );
                            }

                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="text-xs text-muted-foreground whitespace-nowrap text-center px-2 py-2">{formatDate(sale.created_at)}</td>
                      <td className="text-right pr-3 whitespace-nowrap px-2 py-2">
                        <div className="flex items-center justify-end gap-1 shrink-0 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSaleForManage(sale);
                              setManageDefaultTab('documentos');
                              setManageModalOpen(true);
                            }}
                            className="h-7 px-2 text-[10.5px] font-bold text-primary border-primary/25 hover:bg-primary/10 hover:border-primary/40 shadow-2xs shrink-0 gap-1 whitespace-nowrap"
                            title="Emitir 2ª via do contrato ou gerenciar documentos da venda"
                          >
                            <Printer className="w-3 h-3 text-primary shrink-0" />
                            <span className="whitespace-nowrap">2ª Via</span>
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedSaleForReceipts(sale);
                              setReceiptsDefaultTab('receipts');
                              setReceiptsModalOpen(true);
                            }}
                            className={cn(
                              'h-7 w-7 transition-colors relative shrink-0',
                              receiptsCount > 0
                                ? 'text-primary font-bold hover:bg-primary/10'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                            title="Gerenciar comprovantes da venda"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {receiptsCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8.5px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center font-mono">
                                {receiptsCount}
                              </span>
                            )}
                          </Button>
                          <SaleActionsMenu 
                            sale={sale}
                            vehicleName={vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : undefined}
                            storeName={sale.store?.name}
                            resellerName={sale.reseller?.full_name}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}
        </div>
      )}

      {/* Modal Principal e Direto de Cadastro de Vendas */}
      <CreateSaleModal
        open={createSaleOpen}
        onOpenChange={setCreateSaleOpen}
      />

      {/* Modal de Finalização de Pré-Venda existente */}
      <CompleteSaleModal
        open={completeSaleOpen}
        onOpenChange={(open) => {
          setCompleteSaleOpen(open);
          if (!open) setTargetPreSaleForComplete(null);
        }}
        initialPreSale={targetPreSaleForComplete}
        initialPreSaleId={targetPreSaleForComplete?.id}
      />

      {/* Modal Dedicado para Anexar e Gerenciar Comprovantes & NF Após a Venda */}
      {selectedSaleForReceipts && (
        <SaleReceiptsModal
          open={receiptsModalOpen}
          onOpenChange={(open) => {
            setReceiptsModalOpen(open);
            if (!open) {
              setSelectedSaleForReceipts(null);
              setReceiptsDefaultTab('receipts');
            }
          }}
          sale={selectedSaleForReceipts}
          defaultTab={receiptsDefaultTab}
          vehicleName={
            selectedSaleForReceipts.vehicle
              ? `${selectedSaleForReceipts.vehicle.brand} ${selectedSaleForReceipts.vehicle.model} ${selectedSaleForReceipts.vehicle.year}`
              : undefined
          }
        />
      )}

      {/* Partição Completa de Gestão da Venda & Emissão de 2ª Via */}
      {selectedSaleForManage && (
        <SaleManageModal
          open={manageModalOpen}
          onOpenChange={(open) => {
            setManageModalOpen(open);
            if (!open) setSelectedSaleForManage(null);
          }}
          sale={selectedSaleForManage}
          defaultTab={manageDefaultTab}
        />
      )}
    </div>
  );
}
