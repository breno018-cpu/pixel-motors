import { useState, useMemo, useEffect } from 'react';
import { 
  Search, ShoppingCart, Calendar, Store, User, Car, Bike, Plus,
  TrendingUp, DollarSign, Clock, CheckCircle, AlertCircle, FileText,
  ImageDown, CheckCircle2, ArrowRight, Paperclip, FileSpreadsheet,
  Printer, Pencil,
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
import { useContracts, Contract } from '@/hooks/useContracts';
import { useQueryClient } from '@tanstack/react-query';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import { useEmployees } from '@/hooks/useEmployees';
import { resolveSaleStore } from '@/lib/storeResolution';
import { useAuth } from '@/contexts/AuthContext';
import { isUserSellerRestricted, filterSalesBySellerScope } from '@/lib/salesScope';
import { isMatchingStore } from '@/pages/Vehicles';
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

const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle }> = {
  pre_venda: { label: 'Pré-venda (NF)', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30', icon: FileText },
  pendente: { label: 'Aguardando aprovação', class: 'bg-warning/10 text-warning', icon: Clock },
  assinado: { label: 'Assinado', class: 'bg-primary/10 text-primary', icon: FileText },
  cancelado: { label: 'Cancelado', class: 'bg-destructive/10 text-destructive', icon: AlertCircle },
  concluido: { label: 'Quitado / Faturado', class: 'bg-success/10 text-success', icon: CheckCircle },
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
  const isMoc =
    storeId === 'store-montesclaros' ||
    storeId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
    (storeName || '').toLowerCase().includes('montes');
  
  let createdAt = new Date().toISOString();
  if (r.data) {
    const parts = r.data.split('/');
    if (parts.length === 3) {
      createdAt = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0, 0).toISOString();
    }
  }

  const downPayment = (r.dinheiro || 0) + (r.pix || 0) + (r.cartao || 0) + (r.carta_credito || 0);

  return {
    id: r.id || `sheet-${r.qt}`,
    contract_number: `${isMoc ? 'MOC' : 'DIV'}-${r.qt || '00'}`,
    vehicle_id: (r as any).vehicle_id || `veh-${r.id || r.qt}`,
    reseller_id: (r as any).reseller_id || null,
    store_id: storeId,
    created_by: (r as any).created_by || (r as any).user_id || r.vendedor || 'Vendedor',
    user_id: (r as any).user_id || (r as any).created_by || null,
    vendedor: r.vendedor,
    buyer_name: r.cliente || 'Cliente não informado',
    buyer_cpf: r.lead_mapping || '—',
    buyer_phone: (r as any).buyer_phone || null,
    buyer_email: (r as any).buyer_email || null,
    buyer_address: `${r.regiao || 'Divinópolis'} - MG`,
    sale_price: r.valor || 0,
    down_payment: downPayment,
    installments: 1,
    installment_value: null,
    status: (r.is_permitted || (r as any).tipo_registro === 'venda') && (r as any).tipo_registro !== 'pre_venda' ? 'concluido' : 'pre_venda',
    payment_method: r.banco || (r.financiamento > 0 ? 'Financiamento' : 'À Vista'),
    financing_bank: r.banco || null,
    financing_installments: null,
    financing_installment_value: null,
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
    evidence_paths: r.comp ? [r.comp] : [],
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
      full_name: r.vendedor || 'Vendedor',
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
  const {
    periodFilter,
    setPeriodFilter,
    isDateInPeriod,
    defaultMonthKey,
    resetToActiveMonth,
  } = useDateFilter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modais de Vendas
  const [createSaleOpen, setCreateSaleOpen] = useState(false);
  const [completeSaleOpen, setCompleteSaleOpen] = useState(false);
  const [targetPreSaleForComplete, setTargetPreSaleForComplete] = useState<any | null>(null);
  const [receiptsModalOpen, setReceiptsModalOpen] = useState(false);
  const [selectedSaleForReceipts, setSelectedSaleForReceipts] = useState<any | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedSaleForManage, setSelectedSaleForManage] = useState<any | null>(null);
  const [manageDefaultTab, setManageDefaultTab] = useState<'cadastro' | 'veiculo' | 'finalizacao' | 'documentos'>('cadastro');

  const { data: contracts, isLoading: contractsLoading } = useContracts();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const { data: employees = [] } = useEmployees();
  const {
    user,
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
      const resolved = resolveSaleStore(
        {
          store_id: c.store_id,
          store: c.store,
          vendedor: c.operator?.full_name,
          observacoes: c.notes,
        },
        employees
      );
      return {
        ...c,
        store_id: resolved.storeId,
        store: {
          id: resolved.storeId,
          name: resolved.storeName,
        },
      };
    });
    const contractIds = new Set(fromContracts.map((c) => c.id));
    const fromSheet = monthlySheetRows
      .filter((r) => !contractIds.has(r.id))
      .map((r) => sheetRowToContract(r, employees));
    const rawConsolidated = [...fromContracts, ...fromSheet];

    // Se o usuário for vendedor restrito, isola estritamente apenas suas próprias vendas
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

  // Vendedores — colaboradores da loja selecionada + quem tiver vendas registradas
  const sellerOptions = useMemo(() => {
    if (isRestrictedSeller) {
      const myName = profile?.full_name || 'Minhas Vendas';
      return [{ id: myName, name: myName }];
    }

    const map = new Map<string, string>();

    // 1. Dos colaboradores cadastrados (employees)
    (employees || []).forEach((emp) => {
      const role = (emp.role || '').toLowerCase();
      const isComercial = role.includes('vendedor') || role.includes('comercial') || role.includes('plus') || role.includes('externo');
      if (isComercial && emp.full_name) {
        const sId = emp.store_id || 'store-divinopolis';
        if (storeFilter !== 'all' && sId !== storeFilter) return;
        const key = emp.full_name.trim();
        map.set(key, key);
      }
    });

    // 2. Das vendas consolidadas
    allSales.forEach((s: any) => {
      const sellerName = (s.operator?.full_name || s.created_by || '').trim();
      if (!sellerName) return;
      if (storeFilter !== 'all' && s.store_id !== storeFilter) return;
      map.set(sellerName, sellerName);
    });

    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, allSales, storeFilter]);

  // 1. Vendas que atendem aos filtros gerais (busca, loja, vendedor, período)
  const baseFilteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = search.replace(/\D/g, '');

    return allSales.filter(sale => {
      // 1. Filtro de Busca Geral (Cliente, CPF, Contrato, Modelo, Chassi, Vendedor, Observações)
      if (term) {
        const rawCpf = (sale.buyer_cpf || '').replace(/\D/g, '');
        const rawChassis = (sale.vehicle?.chassis || (sale as any).external_data?.chassis || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const termClean = term.replace(/[^a-z0-9]/g, '');

        const searchable = [
          sale.buyer_name,
          sale.buyer_cpf,
          sale.buyer_phone,
          sale.contract_number,
          sale.vehicle?.brand,
          sale.vehicle?.model,
          sale.vehicle?.chassis,
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

      // 2. Filtro de Concessionária
      const matchesStore = storeFilter === 'all' || isMatchingStore(sale.store_id, storeFilter);
      if (!matchesStore) return false;

      // 3. Filtro de Vendedor / Operador
      const sellerName = ((sale as any).created_by || (sale as any).operator?.full_name || (sale as any).seller_name || (sale as any).vendedor || '').trim().toLowerCase();
      const targetReseller = resellerFilter.trim().toLowerCase();
      const matchesReseller = isRestrictedSeller || resellerFilter === 'all' ||
        sellerName === targetReseller ||
        sellerName.includes(targetReseller) ||
        targetReseller.includes(sellerName);
      if (!matchesReseller) return false;

      // 4. Filtro de Período
      let matchesPeriod = true;
      if (periodFilter !== 'all' && (sale as any).review_status !== 'questionada') {
        matchesPeriod = isDateInPeriod(sale.signed_at || sale.created_at);
      }
      if (!matchesPeriod) return false;

      return true;
    });
  }, [allSales, search, storeFilter, resellerFilter, periodFilter, isDateInPeriod, isRestrictedSeller]);

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
    <div className="space-y-5 pb-8">
      {/* CABEÇALHO COM AÇÕES DIRETAS E CLARAS */}
      <PageHeader
        title="Vendas & Faturamento"
        description="Acompanhe vendas faturadas, emissão de NF e integração com as concessionárias de Divinópolis e Montes Claros."
        actions={
          <div className="flex items-center gap-2">
            {canCreateSales && (
              <Button
                size="sm"
                onClick={() => setCreateSaleOpen(true)}
                className="gap-2 h-9 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
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
        <div className="flex items-center gap-2.5 p-3 rounded-2xl border border-primary/30 bg-primary/5 text-xs text-primary font-medium">
          <User className="w-4 h-4 shrink-0 text-primary" />
          <span>
            <strong>Painel Individual do Vendedor:</strong> Você está visualizando exclusivamente as suas próprias vendas registradas (<strong>{profile?.full_name || 'Seu Perfil'}</strong>). Vendas de outros colaboradores são estritamente restritas à gerência.
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={isRestrictedSeller ? "Minhas Vendas Faturadas" : "Vendas Faturadas"} value={totalSales} icon={ShoppingCart} tone="success" />
        <StatCard label={isRestrictedSeller ? "Minhas Pré-Vendas (NF)" : "Pré-Vendas (NF Solicitada)"} value={preSalesCount} icon={FileText} tone="warning" />
        <StatCard label={isRestrictedSeller ? "Meu Faturamento" : "Receita Faturada"} value={formatCurrency(totalRevenue)} icon={DollarSign} />
        <StatCard label={isRestrictedSeller ? "Meu Ticket Médio" : "Ticket médio"} value={formatCurrency(avgTicket)} icon={TrendingUp} tone="neutral" />
      </div>

      {/* ABAS DO MÓDULO DE VENDAS */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border w-fit">
        <Button
          size="sm"
          variant={activeTab === 'todas' ? 'default' : 'ghost'}
          onClick={() => {
            setActiveTab('todas');
            setStatusFilter('all');
          }}
          className="text-xs font-bold gap-2 h-9 px-3.5 rounded-xl shadow-xs"
        >
          <ShoppingCart className="w-4 h-4" />
          Todas as Vendas ({baseFilteredSales.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'faturadas' ? 'default' : 'ghost'}
          onClick={() => {
            setActiveTab('faturadas');
            setStatusFilter('all');
          }}
          className={cn(
            "text-xs font-bold gap-2 h-9 px-3.5 rounded-xl transition-colors",
            activeTab === 'faturadas'
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          )}
        >
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Vendas Faturadas ({completedSales.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'pre_venda' ? 'default' : 'ghost'}
          onClick={() => {
            setActiveTab('pre_venda');
            setStatusFilter('all');
          }}
          className={cn(
            "text-xs font-bold gap-2 h-9 px-3.5 rounded-xl transition-colors",
            activeTab === 'pre_venda'
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          )}
        >
          <FileText className="w-4 h-4 text-amber-500" />
          Pré-Vendas & NF ({preSalesCount})
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'segunda_via' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('segunda_via')}
          className={cn(
            "text-xs font-bold gap-2 h-9 px-3.5 rounded-xl transition-colors",
            activeTab === 'segunda_via'
              ? "bg-red-600 hover:bg-red-700 text-white shadow-xs"
              : "text-red-700 dark:text-red-400 hover:bg-red-500/10"
          )}
        >
          <Printer className="w-4 h-4 text-red-500" />
          Gestão & 2ª Via Oficial
        </Button>
        {!isRestrictedSeller && (
          <Button
            size="sm"
            variant={activeTab === 'planilha' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('planilha')}
            className={cn(
              "text-xs font-bold gap-2 h-9 px-3.5 rounded-xl transition-colors",
              activeTab === 'planilha'
                ? "bg-sky-600 hover:bg-sky-700 text-white"
                : "text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
            )}
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-500" />
            Planilha de Vendas & Excel Online
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
          {/* Filters */}
          <FilterBar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, CPF/CNPJ, contrato, chassi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Concessionária Filter */}
          <Select
            value={storeFilter}
            onValueChange={(val) => {
              setStoreFilter(val);
              if (val !== 'all' && resellerFilter !== 'all') {
                setResellerFilter('all');
              }
            }}
          >
            <SelectTrigger className="w-[195px] h-10 text-xs">
              <Store className="w-3.5 h-3.5 mr-1.5 text-primary" />
              <SelectValue placeholder="Concessionária" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Concessionárias (MG)</SelectItem>
              <SelectItem value="store-divinopolis">Concessionária Divinópolis</SelectItem>
              <SelectItem value="store-montesclaros">Concessionária Montes Claros</SelectItem>
              {(stores || [])
                .filter((s) => s.id !== 'store-montesclaros' && s.id !== 'store-divinopolis')
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Vendedor Filter */}
          {isRestrictedSeller ? (
            <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
              <User className="w-3.5 h-3.5" />
              <span>Minhas Vendas ({profile?.full_name || 'Vendedor'})</span>
            </div>
          ) : (
            <Select value={resellerFilter} onValueChange={setResellerFilter}>
              <SelectTrigger className="w-[165px] h-10 text-xs">
                <User className="w-3.5 h-3.5 mr-1.5 text-primary" />
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {storeFilter === 'all' ? 'Toda Equipe' : 'Equipe da Loja'}
                </SelectItem>
                {sellerOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] h-10 text-xs">
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
            <SelectTrigger className="w-[185px] h-10 text-xs font-medium">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue placeholder="Selecione o período" />
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
              className="h-10 text-xs px-2.5 text-muted-foreground hover:text-foreground"
            >
              Resetar filtros
            </Button>
          )}
        </div>
      </FilterBar>

      {/* Table */}
      {contractsLoading ? (
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
          <h3 className="font-display text-lg font-semibold text-foreground">Nenhuma venda encontrada</h3>
          <p className="mb-4 mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {search || storeFilter !== 'all' || resellerFilter !== 'all' || periodFilter !== 'all' || statusFilter !== 'all'
              ? 'Tente ajustar os filtros de busca.'
              : 'Registre novas solicitações de NF ou finalize vendas para vê-las aqui.'}
          </p>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Contrato / Ref</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Veículo</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground hidden xl:table-cell">Loja</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground hidden lg:table-cell">Operador</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Status / Etapa</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">Data</TableHead>
                  <TableHead className="w-28 text-right pr-3">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const statusInfo = statusConfig[sale.status] || statusConfig.pendente;
                  const vehicle = sale.vehicle;
                  const VehicleIcon = vehicle?.vehicle_type === 'moto' ? Bike : Car;
                  const isPreSale = sale.status === 'pre_venda';
                  const receiptsCount = Math.max(
                    getSaleReceipts(sale.id).length,
                    ((sale.external_data as any)?.receipts as any[])?.length || 0,
                    sale.evidence_paths?.length || 0,
                  );

                  return (
                    <TableRow
                      key={sale.id}
                      className={cn(
                        'group transition-colors',
                        isPreSale && 'bg-amber-500/5 hover:bg-amber-500/10',
                        (sale as any).review_status === 'questionada' && 'review-row'
                      )}
                    >
                      <TableCell>
                        <span className="whitespace-nowrap font-mono text-xs font-bold">{sale.contract_number}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-bold text-xs text-foreground">{sale.buyer_name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{formatCPFDisplay(sale.buyer_cpf)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle ? (
                          <div className="flex items-center gap-2">
                            <VehicleIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {vehicle.year} {vehicle.chassis && `— #${vehicle.chassis.slice(-6)}`}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {(sale as any).external_data?.vehicle_model_custom || '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-xs xl:table-cell">{sale.store?.name || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {(sale as any).operator?.full_name || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <span className="font-display font-black text-xs text-foreground">{formatCurrency(Number(sale.sale_price))}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="secondary" className={cn('text-[10px] font-bold py-0.5 px-2', statusInfo.class)}>
                            {statusInfo.label}
                          </Badge>
                          
                          {/* BOTÃO DIRETO DE FINALIZAR VENDA (CONCLUIR CADASTRO) */}
                          {isPreSale && canCreateSales && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartCompleteExisting(sale)}
                              className="h-6 px-2 text-[10px] gap-1 font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 mt-1 shadow-2xs"
                              title="Concluir todo o cadastro do comprador, chassi e pagamento para faturar e emitir contrato"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Concluir Cadastro
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(sale.created_at)}</TableCell>
                      <TableCell className="text-right pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSaleForManage(sale);
                              setManageDefaultTab('documentos');
                              setManageModalOpen(true);
                            }}
                            className="h-8 px-2 text-xs font-bold gap-1 text-primary border-primary/20 hover:bg-primary/10 hidden sm:inline-flex"
                            title="Emitir 2ª via ou alterar dados cadastrais / finalização"
                          >
                            <Printer className="w-3.5 h-3.5 text-primary" />
                            <span className="hidden xl:inline">2ª Via & Gestão</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedSaleForReceipts(sale);
                              setReceiptsModalOpen(true);
                            }}
                            className={cn(
                              'h-8 px-2 text-xs gap-1.5 transition-colors',
                              receiptsCount > 0
                                ? 'text-primary font-medium hover:bg-primary/10'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                            title="Gerenciar e anexar comprovantes da venda"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {receiptsCount > 0 ? (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 font-mono font-bold">
                                {receiptsCount}
                              </Badge>
                            ) : (
                              <span className="text-[11px] hidden sm:inline text-muted-foreground/70">Anexar</span>
                            )}
                          </Button>
                          <SaleActionsMenu 
                            sale={sale}
                            vehicleName={vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : undefined}
                            storeName={sale.store?.name}
                            resellerName={sale.reseller?.full_name}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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

      {/* Modal Dedicado para Anexar e Gerenciar Comprovantes Após a Venda */}
      {selectedSaleForReceipts && (
        <SaleReceiptsModal
          open={receiptsModalOpen}
          onOpenChange={(open) => {
            setReceiptsModalOpen(open);
            if (!open) setSelectedSaleForReceipts(null);
          }}
          sale={selectedSaleForReceipts}
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
