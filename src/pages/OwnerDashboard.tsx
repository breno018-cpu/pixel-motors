import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Crown,
  TrendingUp,
  DollarSign,
  Bike,
  Building2,
  Users,
  MapPin,
  Calendar,
  Layers,
  BarChart3,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Landmark,
  Sparkles,
  Store,
  Wallet,
  Car,
  ReceiptText,
  FileSpreadsheet,
  Paperclip,
  QrCode,
  Banknote,
  AlertTriangle,
  Trophy,
  Eye,
  Boxes,
  ArrowLeftRight,
  XCircle,
  Percent,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useConsolidatedSales, ConsolidatedSaleItem } from '@/hooks/useConsolidatedSales';
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useEmployees } from '@/hooks/useEmployees';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { exportToXLSX } from '@/lib/export';
import { isMontesClarosStore, getStoreDisplayName, formatStoreShortName } from '@/lib/storeResolution';
import { resolveSellerDisplayName } from '@/lib/sellerSanitizer';
import {
  useDealershipScope,
  DealershipBadge,
  resolveStoreToKey,
} from '@/contexts/DealershipScopeContext';
import { DealershipSegmentedBar } from '@/components/common/DealershipSegmentedBar';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerFiscalInvoicesPanel } from '@/components/dashboard/OwnerFiscalInvoicesPanel';
import { ExecutiveSalesReceiptsAuditor } from '@/components/dashboard/ExecutiveSalesReceiptsAuditor';
import { CloudMonthlySpreadsheet } from '@/components/sheets/CloudMonthlySpreadsheet';
import { ExecutiveStockExchangePanel } from '@/components/dashboard/ExecutiveStockExchangePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ResellerControlPanel } from '@/components/dashboard/ResellerControlPanel';

function getCanonicalModelName(rawModel: string | null | undefined): string {
  if (!rawModel) return 'OUTROS MODELOS';
  const upper = rawModel.trim().toUpperCase().replace(/\s+/g, ' ');
  if (upper === 'JET' || upper === 'JET 125' || upper === 'JET125' || upper.startsWith('JET 125 ')) {
    return 'JET 125';
  }
  if (upper.startsWith('NEW JET 125')) {
    return 'NEW JET 125';
  }
  if (upper.startsWith('SHI 175') || upper.startsWith('SHI175')) {
    return 'SHI 175 EFI';
  }
  if (upper.startsWith('NEW SHI 175')) {
    return 'NEW SHI 175 EFI';
  }
  if (upper.startsWith('SHI 250') || upper.startsWith('SHI250')) {
    return 'SHI 250 EFI';
  }
  if (upper.startsWith('PHOENIX')) {
    return 'PHOENIX 50';
  }
  if (upper.startsWith('FREE 150')) {
    return 'FREE 150';
  }
  if (upper.startsWith('NEW FREE 170')) {
    return 'NEW FREE 170';
  }
  if (upper.startsWith('JEF 150')) {
    return 'JEF 150';
  }
  if (upper.startsWith('TITANIUM')) {
    return 'TITANIUM 250';
  }
  if (upper.startsWith('SBM 250')) {
    return 'SBM 250S';
  }
  if (upper.startsWith('STORM 200') || upper === 'STORM') {
    return 'STORM 200';
  }
  if (upper.startsWith('RIO 125')) {
    return 'RIO 125';
  }
  return upper;
}

interface ModelStockGroup {
  model: string;
  brand: string;
  totalCount: number;
  storeCounts: Map<string, number>;
  totalValue: number;
  avgPrice: number;
  colorCounts: { color: string; count: number }[];
  vehicles: any[];
}

export default function OwnerDashboard() {
  const { isAdmin, isManager, isStoreOwner, hasElevatedAccess, roles } = useAuth();

  if (!hasElevatedAccess && !isAdmin && !isManager && !isStoreOwner && !roles.includes('dono_loja')) {
    return <Navigate to="/" replace />;
  }

  return <OwnerDashboardContent />;
}

function OwnerDashboardContent() {
  const navigate = useNavigate();
  const dealershipScope = useDealershipScope();

  const { sales, isRefreshing, refresh } = useConsolidatedSales();
  const { data: vehicles = [] } = useVehicles();
  const { data: stores = [] } = useStores();
  const { data: employees = [] } = useEmployees();

  // Abas Executivas: caixa | nfs | patio | revendedores | troca-estoque | vendedores | comprovantes | planilha
  const [activeTab, setActiveTab] = useState<'caixa' | 'nfs' | 'patio' | 'revendedores' | 'troca-estoque' | 'vendedores' | 'comprovantes' | 'planilha'>(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    const valid = ['caixa', 'nfs', 'patio', 'revendedores', 'troca-estoque', 'vendedores', 'comprovantes', 'planilha'];
    return (valid.includes(requested || '') ? requested : 'caixa') as any;
  });

  // Filtros Globais do Cockpit
  const [periodPreset, setPeriodPreset] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockSearch, setStockSearch] = useState<string>('');
  const [stockStoreFilter, setStockStoreFilter] = useState<string>('all');
  const [stockSortBy, setStockSortBy] = useState<'count_desc' | 'count_asc' | 'value_desc' | 'name_asc'>('count_desc');
  const [selectedModelForChassis, setSelectedModelForChassis] = useState<ModelStockGroup | null>(null);

  // Filtragem dinâmica de vendas
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    return sales.filter((item) => {
      // 1. Filtro de Concessionária (Global via DealershipScope)
      if (dealershipScope.activeScope !== 'all') {
        const k = resolveStoreToKey(item.loja_slug || item.store_id || item.loja_cidade || item.loja_nome);
        if (k !== dealershipScope.activeScope) return false;
      }

      // 2. Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          (item.cliente || '').toLowerCase().includes(q) ||
          (item.chassi || '').toLowerCase().includes(q) ||
          (item.modelo || '').toLowerCase().includes(q) ||
          (item.vendedor || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 3. Filtro de Período
      if (periodPreset === 'all') return true;
      const saleDate = new Date(item.date);
      if (periodPreset === 'today') return saleDate >= todayStart;
      if (periodPreset === '7days') {
        const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);
        return saleDate >= sevenDaysAgo;
      }
      if (periodPreset === 'this_month') {
        return saleDate.getFullYear() === now.getFullYear() && saleDate.getMonth() === now.getMonth();
      }
      if (periodPreset === 'last_month') {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return saleDate.getFullYear() === prevYear && saleDate.getMonth() === prevMonth;
      }
      if (periodPreset === 'custom' && (startDate || endDate)) {
        if (startDate && saleDate < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && saleDate > new Date(`${endDate}T23:59:59`)) return false;
      }

      return true;
    });
  }, [sales, dealershipScope.activeScope, searchQuery, periodPreset, startDate, endDate]);

  // Contadores e Totais Financeiros por Concessionária
  const { dealershipCounts, dealershipFinancials } = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    const financials: Record<string, number> = { all: 0 };

    sales.forEach((s) => {
      const sId = s.store_id || s.loja_slug;
      const k = resolveStoreToKey(s.loja_slug || s.store_id || s.loja_cidade || s.loja_nome);
      const val = Number(s.valor) || 0;

      counts.all = (counts.all || 0) + 1;
      financials.all = (financials.all || 0) + val;

      if (k && k !== 'all') {
        counts[k] = (counts[k] || 0) + 1;
        financials[k] = (financials[k] || 0) + val;
      }
      if (sId && sId !== k) {
        counts[sId] = (counts[sId] || 0) + 1;
        financials[sId] = (financials[sId] || 0) + val;
      }
    });

    return { dealershipCounts: counts, dealershipFinancials: financials };
  }, [sales]);

  // Indicadores de Caixa & Resultados Financeiros
  const executiveMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalFinancing = 0;
    let totalCashPix = 0;
    let totalCard = 0;
    let totalConsortium = 0;
    const count = filteredSales.length;

    filteredSales.forEach((s) => {
      totalRevenue += s.valor || 0;
      totalFinancing += s.financiamento || 0;
      totalCashPix += (s.dinheiro || 0) + (s.pix || 0);
      totalCard += s.cartao || 0;
      totalConsortium += s.carta_credito || 0;
    });

    const avgTicket = count > 0 ? totalRevenue / count : 0;
    // Margem bruta real média da operação de concessionária Shineray (~18.5% sobre faturamento)
    const estimatedGrossProfit = totalRevenue * 0.185;
    const grossMarginPercent = totalRevenue > 0 ? (estimatedGrossProfit / totalRevenue) * 100 : 0;

    // Métricas do Pátio / Estoque
    const inStockVehicles = vehicles.filter((v) => v.status === 'disponivel' || (v.status as any) === 'em_estoque');
    const totalStockCount = inStockVehicles.length;
    const totalStockValue = inStockVehicles.reduce((acc, v) => acc + (Number(v.purchase_price) || Number(v.sale_price) || 0), 0);

    return {
      totalRevenue,
      count,
      avgTicket,
      estimatedGrossProfit,
      grossMarginPercent,
      totalFinancing,
      totalCashPix,
      totalCard,
      totalConsortium,
      totalStockCount,
      totalStockValue,
    };
  }, [filteredSales, vehicles]);

  // Desempenho 100% Dinâmico por Concessionária (Grupo L1MA Motors)
  const storePerformance = useMemo(() => {
    const map = new Map<string, {
      key: string;
      id: string;
      name: string;
      shortName: string;
      revenue: number;
      count: number;
      stockCount: number;
      stockValue: number;
    }>();

    // 1. Inicializa com todas as lojas cadastradas no sistema
    stores.filter((s) => s.is_active !== false).forEach((s) => {
      const key = resolveStoreToKey(s.id || s.slug || s.name);
      map.set(key, {
        key,
        id: s.id,
        name: s.name,
        shortName: formatStoreShortName(s.name),
        revenue: 0,
        count: 0,
        stockCount: 0,
        stockValue: 0,
      });
    });

    // 2. Apuração de vendas a partir das vendas filtradas no período
    filteredSales.forEach((s) => {
      const key = resolveStoreToKey(s.loja_slug || s.store_id || s.loja_cidade || s.loja_nome);
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key,
          id: key,
          name: s.store_name || key,
          shortName: formatStoreShortName(s.store_name || key),
          revenue: 0,
          count: 0,
          stockCount: 0,
          stockValue: 0,
        };
        map.set(key, entry);
      }
      entry.revenue += Number(s.valor) || 0;
      entry.count += 1;
    });

    // 3. Apuração de estoque físico no pátio
    const inStock = vehicles.filter((v) => v.status === 'disponivel' || (v.status as any) === 'em_estoque');
    inStock.forEach((v) => {
      const key = resolveStoreToKey(v.store_id);
      const entry = map.get(key);
      if (entry) {
        entry.stockCount += 1;
        entry.stockValue += Number(v.sale_price) || 0;
      }
    });

    const totalRev = executiveMetrics.totalRevenue;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgTicket: item.count > 0 ? item.revenue / item.count : 0,
        share: totalRev > 0 ? (item.revenue / totalRev) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [stores, filteredSales, vehicles, executiveMetrics.totalRevenue]);

  // Margem e Lucro por Modelo de Moto
  const modelProfitability = useMemo(() => {
    const map = new Map<string, { model: string; count: number; revenue: number; marginValue: number }>();

    filteredSales.forEach((s) => {
      const model = s.modelo?.trim() || 'Modelo Não Informado';
      const curr = map.get(model) || { model, count: 0, revenue: 0, marginValue: 0 };
      curr.count += 1;
      curr.revenue += s.valor || 0;
      // Margem média por modelo (~18.5% sobre o preço de venda faturado)
      curr.marginValue += (s.valor || 0) * 0.185;
      map.set(model, curr);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((item) => ({
        ...item,
        avgTicket: item.count > 0 ? item.revenue / item.count : 0,
        share: executiveMetrics.totalRevenue > 0 ? (item.revenue / executiveMetrics.totalRevenue) * 100 : 0,
      }));
  }, [filteredSales, executiveMetrics.totalRevenue]);

  // Financiamento por Banco
  const bankDistribution = useMemo(() => {
    const map = new Map<string, { bank: string; count: number; totalFinanced: number }>();

    filteredSales.forEach((s) => {
      if ((s.financiamento || 0) > 0) {
        const bank = s.banco?.trim().toUpperCase() || 'BANCO NÃO INFORMADO';
        const curr = map.get(bank) || { bank, count: 0, totalFinanced: 0 };
        curr.count += 1;
        curr.totalFinanced += s.financiamento || 0;
        map.set(bank, curr);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalFinanced - a.totalFinanced);
  }, [filteredSales]);

  // Ranking de Vendedores e Cálculo Real de Comissões
  const sellerPerformance = useMemo(() => {
    const map = new Map<string, {
      name: string;
      store: string;
      count: number;
      revenue: number;
      commissionRate: number;
      commissionTotal: number;
    }>();

    filteredSales.forEach((s) => {
      const rawSeller = s.vendedor?.trim() || 'Vendedor Não Identificado';
      const sellerName = resolveSellerDisplayName(rawSeller, employees) || rawSeller;
      const curr = map.get(sellerName) || {
        name: sellerName,
        store: getStoreDisplayName(s),
        count: 0,
        revenue: 0,
        commissionRate: 1.5,
        commissionTotal: 0,
      };

      curr.count += 1;
      curr.revenue += s.valor || 0;
      map.set(sellerName, curr);
    });

    // Vincula a taxa de comissão cadastrada para cada vendedor
    return Array.from(map.values())
      .map((seller) => {
        const emp = employees.find((e) => e.full_name?.toLowerCase().trim() === seller.name.toLowerCase().trim());
        const rate = Number(emp?.commission_rate) || 1.5; // padrão 1.5%
        const commissionTotal = seller.revenue * (rate / 100);
        const avgTicket = seller.count > 0 ? seller.revenue / seller.count : 0;

        return {
          ...seller,
          commissionRate: rate,
          commissionTotal,
          avgTicket,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, employees]);

  const totalCommissionsToPay = useMemo(() => {
    return sellerPerformance.reduce((acc, s) => acc + s.commissionTotal, 0);
  }, [sellerPerformance]);

  // Agrupamento Dinâmico do Pátio focado em MODELOS e QUANTIDADES
  const modelStockSummary = useMemo(() => {
    const inStock = vehicles.filter((v) => v.status === 'disponivel' || (v.status as any) === 'em_estoque');
    const map = new Map<string, {
      model: string;
      brand: string;
      totalCount: number;
      totalValue: number;
      storeCounts: Map<string, number>;
      colorMap: Map<string, number>;
      vehicles: typeof vehicles;
    }>();

    inStock.forEach((v) => {
      const canonical = getCanonicalModelName(v.model);
      const vKey = resolveStoreToKey(v.store_id);

      const curr = map.get(canonical) || {
        model: canonical,
        brand: v.brand || 'SHINERAY',
        totalCount: 0,
        totalValue: 0,
        storeCounts: new Map<string, number>(),
        colorMap: new Map<string, number>(),
        vehicles: [],
      };

      curr.totalCount += 1;
      curr.storeCounts.set(vKey, (curr.storeCounts.get(vKey) || 0) + 1);

      const price = Number(v.sale_price) || 0;
      curr.totalValue += price;

      const color = (v.color || 'Padrão').trim();
      curr.colorMap.set(color, (curr.colorMap.get(color) || 0) + 1);

      curr.vehicles.push(v);
      map.set(canonical, curr);
    });

    let list: ModelStockGroup[] = Array.from(map.values()).map((item) => {
      const colorCounts = Array.from(item.colorMap.entries())
        .map(([color, count]) => ({ color, count }))
        .sort((a, b) => b.count - a.count);
      const avgPrice = item.totalCount > 0 ? item.totalValue / item.totalCount : 0;

      return {
        model: item.model,
        brand: item.brand,
        totalCount: item.totalCount,
        storeCounts: item.storeCounts,
        totalValue: item.totalValue,
        avgPrice,
        colorCounts,
        vehicles: item.vehicles,
      };
    });

    // Filtro Dinâmico por Concessionária
    if (stockStoreFilter !== 'all') {
      const targetKey = resolveStoreToKey(stockStoreFilter);
      list = list.filter((m) => (m.storeCounts.get(targetKey) || 0) > 0);
    }

    // Busca textual por modelo ou cor
    if (stockSearch.trim()) {
      const q = stockSearch.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.model.toLowerCase().includes(q) ||
          m.brand.toLowerCase().includes(q) ||
          m.colorCounts.some((c) => c.color.toLowerCase().includes(q))
      );
    }

    // Ordenação
    if (stockSortBy === 'count_desc') {
      list.sort((a, b) => b.totalCount - a.totalCount);
    } else if (stockSortBy === 'count_asc') {
      list.sort((a, b) => a.totalCount - b.totalCount);
    } else if (stockSortBy === 'value_desc') {
      list.sort((a, b) => b.totalValue - a.totalValue);
    } else if (stockSortBy === 'name_asc') {
      list.sort((a, b) => a.model.localeCompare(b.model));
    }

    return list;
  }, [vehicles, stockSearch, stockStoreFilter, stockSortBy]);

  const exportModelStockExcel = () => {
    const data = modelStockSummary.map((m) => ({
      Modelo: m.model,
      Marca: m.brand,
      'Quantidade Total': m.totalCount,
      'Preço Médio Unitário': m.avgPrice,
      'Valor Total no Pátio': m.totalValue,
      'Cores Disponíveis': m.colorCounts.map((c) => `${c.color}: ${c.count}`).join(', '),
    }));

    exportToXLSX({
      title: 'Estoque do Pátio Consolidado por Modelo',
      module: 'vehicles',
      filters: { Loja: stockStoreFilter, Ordenação: stockSortBy },
      columns: [
        { key: 'Modelo', label: 'Modelo', type: 'text' },
        { key: 'Marca', label: 'Marca', type: 'text' },
        { key: 'Quantidade Total', label: 'Quantidade Total', type: 'number' },
        { key: 'Preço Médio Unitário', label: 'Preço Médio Unitário', type: 'currency' },
        { key: 'Valor Total no Pátio', label: 'Valor Total no Pátio', type: 'currency' },
        { key: 'Cores Disponíveis', label: 'Cores Disponíveis', type: 'text' },
      ],
      data,
      userName: 'Diretoria Executiva',
    });
  };

  const exportExecutiveExcel = () => {
    const data = filteredSales.map((s) => ({
      Data: s.dateStr,
      Concessionária: s.store_name,
      Vendedor: s.vendedor,
      Cliente: s.cliente,
      Modelo: s.modelo,
      Chassi: s.chassi,
      'Valor da Venda': s.valor,
      'PIX / Dinheiro': s.dinheiro + s.pix,
      Financiamento: s.financiamento,
      Banco: s.banco,
      Cartão: s.cartao,
      Consórcio: s.carta_credito,
    }));

    exportToXLSX({
      title: 'Cockpit da Diretoria - Relatório Executivo',
      module: 'sales',
      filters: { Período: periodPreset, Loja: dealershipScope.activeScope },
      columns: [
        { key: 'Data', label: 'Data', type: 'text' },
        { key: 'Concessionária', label: 'Concessionária', type: 'text' },
        { key: 'Vendedor', label: 'Vendedor', type: 'text' },
        { key: 'Cliente', label: 'Cliente', type: 'text' },
        { key: 'Modelo', label: 'Modelo', type: 'text' },
        { key: 'Chassi', label: 'Chassi', type: 'text' },
        { key: 'Valor da Venda', label: 'Valor da Venda', type: 'currency' },
        { key: 'PIX / Dinheiro', label: 'PIX / Dinheiro', type: 'currency' },
        { key: 'Financiamento', label: 'Financiamento', type: 'currency' },
        { key: 'Banco', label: 'Banco', type: 'text' },
        { key: 'Cartão', label: 'Cartão', type: 'currency' },
        { key: 'Consórcio', label: 'Consórcio', type: 'currency' },
      ],
      data,
      userName: 'Diretoria Executiva',
    });
  };

  const hasActiveFilters = searchQuery.trim() !== '' || periodPreset !== 'this_month';

  const resetFilters = () => {
    setSearchQuery('');
    setPeriodPreset('this_month');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-5 w-full min-w-0 pb-16 animate-fade-in">
      {/* 1. CABEÇALHO EXECUTIVO PADRONIZADO */}
      <PageHeader
        title="Cockpit da Diretoria"
        description="Painel estratégico consolidado: fluxo financeiro, pátio em R$, apuração de comissões e gestão de NFs."
        badge={
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 shrink-0 gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            Diretoria Shineray Motos
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isRefreshing}
              className="gap-1.5 rounded-xl h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar Dados</span>
            </Button>
            <Button
              size="sm"
              onClick={exportExecutiveExcel}
              className="gap-1.5 font-semibold rounded-xl h-9 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar XLSX</span>
            </Button>
          </div>
        }
      />

      {/* 2. SELETOR UNIFICADO DE CONCESSIONÁRIA (GRUPO L1MA MOTORS) */}
      <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                  Divisão por Concessionária
                </h2>
                <span className="text-[10px] font-bold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                  Grupo L1MA Motors
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Alterne entre a holding unificada ou filtre métricas isoladas de faturamento e estoque por concessionária.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
            <span className="text-[11px] font-medium text-muted-foreground">Filtro Ativo:</span>
            <DealershipBadge />
          </div>
        </div>

        <DealershipSegmentedBar
          variant="pills"
          activeScope={dealershipScope.activeScope}
          onChange={(scope) => {
            dealershipScope.setActiveScope(scope);
          }}
          counts={dealershipCounts}
          financials={dealershipFinancials}
          showCounts
          showTotals
        />
      </div>

      {/* 3. BARRA DE CONTROLE EXECUTIVO GLOBAL (PERÍODO + BUSCA) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Seletor de Período Global */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4 text-muted-foreground ml-1" />
            <Select value={periodPreset} onValueChange={setPeriodPreset}>
              <SelectTrigger className="h-8.5 text-xs w-44 rounded-xl font-medium">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">Mês Atual (Novembro)</SelectItem>
                <SelectItem value="last_month">Mês Anterior (Outubro)</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="all">Todos os Períodos</SelectItem>
                <SelectItem value="custom">Data Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Range Personalizado de Data */}
          {periodPreset === 'custom' && (
            <div className="flex items-center gap-1.5 shrink-0 animate-fade-in">
              <Input
                type="date"
                className="h-8.5 text-xs w-32 rounded-xl"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                className="h-8.5 text-xs w-32 rounded-xl"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8.5 pl-8.5 text-xs rounded-xl pr-7"
              placeholder="Buscar por cliente, chassi, modelo ou vendedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8.5 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5 rounded-xl"
            >
              <XCircle className="w-3.5 h-3.5" />
              Limpar Filtros
            </Button>
          )}
        </div>

        {/* Resumo Dinâmico dos Registros */}
        <div className="flex items-center gap-2 text-xs shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50 justify-between md:justify-end">
          <Badge variant="secondary" className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-lg">
            {filteredSales.length} {filteredSales.length === 1 ? 'venda apurada' : 'vendas apuradas'}
          </Badge>
          <span className="font-mono font-bold text-foreground text-xs">
            {formatCurrencyBRL(executiveMetrics.totalRevenue)}
          </span>
        </div>
      </div>

      {/* 4. NAVEGAÇÃO DE ABAS EXECUTIVAS REORGANIZADAS */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <div className="w-full overflow-x-auto pb-1 no-scrollbar">
          <TabsList className="bg-muted/40 p-1 rounded-2xl border border-border/80 w-full flex items-center gap-1 shadow-xs min-w-[720px]">
            <TabsTrigger
              value="caixa"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/80 border border-transparent transition-all"
            >
              <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Caixa &amp; Margens</span>
            </TabsTrigger>

            <TabsTrigger
              value="nfs"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/80 border border-transparent transition-all"
            >
              <ReceiptText className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Controle de NFs</span>
            </TabsTrigger>

            <TabsTrigger
              value="patio"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/80 border border-transparent transition-all"
            >
              <Bike className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Pátio em R$</span>
            </TabsTrigger>

            <TabsTrigger
              value="revendedores"
              className="flex-1 rounded-xl text-xs font-bold gap-1.5 py-2.5 text-blue-600 dark:text-blue-400 data-[state=active]:bg-background data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-xs data-[state=active]:border-blue-500/30 border border-transparent transition-all"
            >
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Revendedores</span>
            </TabsTrigger>

            <TabsTrigger
              value="troca-estoque"
              className="flex-1 rounded-xl text-xs font-bold gap-1.5 py-2.5 text-emerald-600 dark:text-emerald-400 data-[state=active]:bg-background data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-xs data-[state=active]:border-emerald-500/30 border border-transparent transition-all"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Troca de Estoque</span>
            </TabsTrigger>

            <TabsTrigger
              value="vendedores"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/80 border border-transparent transition-all"
            >
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Vendedores</span>
            </TabsTrigger>

            <TabsTrigger
              value="comprovantes"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/80 border border-transparent transition-all"
            >
              <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Comprovantes</span>
            </TabsTrigger>

            <TabsTrigger
              value="planilha"
              className="flex-1 rounded-xl text-xs font-semibold gap-1.5 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs data-[state=active]:border-border/80 border border-transparent transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Planilha</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* =================================================================== */}
        {/* ABA 1: CAIXA & RESULTADOS FINANCEIROS                               */}
        {/* =================================================================== */}
        <TabsContent value="caixa" className="space-y-6 mt-0">
          {/* 4 Cards Principais de Liquidez e Caixa Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Faturamento Bruto */}
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Faturamento Bruto</span>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {formatCurrencyBRL(executiveMetrics.totalRevenue)}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="font-bold text-foreground">{executiveMetrics.count} motos</span>
                  <span>• Ticket Médio:</span>
                  <span className="font-mono font-medium">{formatCurrencyBRL(executiveMetrics.avgTicket)}</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Entradas Imediatas (PIX / Dinheiro) */}
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Caixa Imediato (PIX / Dinheiro)</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {formatCurrencyBRL(executiveMetrics.totalCashPix)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {executiveMetrics.totalRevenue > 0
                    ? `${((executiveMetrics.totalCashPix / executiveMetrics.totalRevenue) * 100).toFixed(1)}% liquidado à vista na loja`
                    : 'Sem faturamento apurado'}
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Financiamentos a Receber dos Bancos */}
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Financiamentos Bancários</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {formatCurrencyBRL(executiveMetrics.totalFinancing)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Repasses bancários contratados
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Lucro Bruto Estimado */}
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lucro Bruto Estimado</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {formatCurrencyBRL(executiveMetrics.estimatedGrossProfit)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Margem média operacional:</span>
                  <Badge variant="outline" className="font-mono font-bold text-[10px] bg-primary/5 text-primary border-primary/20">
                    {executiveMetrics.grossMarginPercent.toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COMPOSIÇÃO DOS PAGAMENTOS (MIX FINANCEIRO) */}
          <div className="p-4 rounded-2xl bg-card border shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Composição do Faturamento por Modalidade de Pagamento
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Total Faturado: <strong className="text-foreground font-mono">{formatCurrencyBRL(executiveMetrics.totalRevenue)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* PIX / Dinheiro */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" /> PIX / Dinheiro
                  </span>
                  <span className="font-mono text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {executiveMetrics.totalRevenue > 0 ? ((executiveMetrics.totalCashPix / executiveMetrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <p className="text-sm font-bold font-mono text-foreground">{formatCurrencyBRL(executiveMetrics.totalCashPix)}</p>
              </div>

              {/* Financiamento */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-600" /> Financiamento
                  </span>
                  <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
                    {executiveMetrics.totalRevenue > 0 ? ((executiveMetrics.totalFinancing / executiveMetrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <p className="text-sm font-bold font-mono text-foreground">{formatCurrencyBRL(executiveMetrics.totalFinancing)}</p>
              </div>

              {/* Cartão de Crédito/Débito */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Cartão de Crédito
                  </span>
                  <span className="font-mono text-[10px] font-bold text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded">
                    {executiveMetrics.totalRevenue > 0 ? ((executiveMetrics.totalCard / executiveMetrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <p className="text-sm font-bold font-mono text-foreground">{formatCurrencyBRL(executiveMetrics.totalCard)}</p>
              </div>

              {/* Consórcio / Cartas */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-600" /> Consórcio / Carta
                  </span>
                  <span className="font-mono text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    {executiveMetrics.totalRevenue > 0 ? ((executiveMetrics.totalConsortium / executiveMetrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <p className="text-sm font-bold font-mono text-foreground">{formatCurrencyBRL(executiveMetrics.totalConsortium)}</p>
              </div>
            </div>
          </div>

          {/* DESEMPENHO DINÂMICO POR CONCESSIONÁRIA (GRUPO L1MA MOTORS) */}
          {dealershipScope.activeScope === 'all' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Desempenho por Unidade Comercial
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Comparativo consolidado da holding
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storePerformance.map((store) => (
                  <Card key={store.key} className="rounded-2xl border shadow-xs bg-card hover:border-primary/40 transition-all">
                    <CardHeader className="p-4 pb-2 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 truncate">
                          <Store className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{store.name}</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] font-bold font-mono shrink-0 bg-primary/5 text-primary border-primary/20">
                          {store.share.toFixed(1)}% do total
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento</span>
                          <p className="text-sm font-black font-mono text-foreground mt-0.5">{formatCurrencyBRL(store.revenue)}</p>
                        </div>
                        <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Vendas Faturadas</span>
                          <p className="text-sm font-black font-mono text-foreground mt-0.5">{store.count} un.</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                        <span>Ticket Médio:</span>
                        <span className="font-bold font-mono text-foreground">{formatCurrencyBRL(store.avgTicket)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Estoque Físico em Pátio:</span>
                        <span className="font-bold font-mono text-foreground">{store.stockCount} motos ({formatCurrencyBRL(store.stockValue)})</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dealershipScope.setActiveScope(store.key)}
                        className="w-full h-7 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-lg gap-1 mt-1"
                      >
                        <span>Isolar Dados desta Loja</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    Filtro Ativo: <DealershipBadge />
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Os números, métricas de caixa, vendedores e modelos exibidos no cockpit estão restritos a esta concessionária.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => dealershipScope.setActiveScope('all')}
                className="h-8 text-xs font-medium rounded-xl gap-1.5 shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Ver Grupo Consolidado</span>
              </Button>
            </div>
          )}

          {/* INTELIGÊNCIA COMERCIAL: MODELOS MAIS VENDIDOS & BANCOS LADO A LADO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tabela de Lucratividade por Modelo (7 Colunas no Desktop) */}
            <Card className="lg:col-span-7 rounded-2xl border shadow-xs overflow-hidden flex flex-col">
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Bike className="w-4 h-4 text-primary" />
                  Top Modelos Vendidos &amp; Rentabilidade
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Faturamento e margem bruta real estimada por modelo de motocicleta.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                <Table>
                  <TableHeader className="bg-muted/30 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Modelo</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider">Qtd</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Faturamento</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Margem (R$)</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Part.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelProfitability.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                          Nenhuma venda registrada no período selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelProfitability.slice(0, 10).map((m, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/20 border-b border-border/40">
                          <TableCell className="font-bold text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-muted font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="truncate max-w-[150px]">{m.model}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold font-mono text-xs">{m.count}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-foreground">{formatCurrencyBRL(m.revenue)}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{formatCurrencyBRL(m.marginValue)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{m.share.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Repasses por Banco de Financiamento (5 Colunas no Desktop) */}
            <Card className="lg:col-span-5 rounded-2xl border shadow-xs overflow-hidden flex flex-col">
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  Financiamentos por Banco
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Instituições financeiras parceiras e volume total contratado.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                <Table>
                  <TableHeader className="bg-muted/30 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Banco</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider">Contratos</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Total Financiado</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankDistribution.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                          Nenhum financiamento bancário registrado no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bankDistribution.map((b, idx) => {
                        const share = executiveMetrics.totalFinancing > 0 ? (b.totalFinanced / executiveMetrics.totalFinancing) * 100 : 0;
                        return (
                          <TableRow key={idx} className="hover:bg-muted/20 border-b border-border/40">
                            <TableCell className="font-bold text-xs truncate max-w-[120px]">{b.bank}</TableCell>
                            <TableCell className="text-center font-mono font-bold text-xs">{b.count}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-foreground">{formatCurrencyBRL(b.totalFinanced)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{share.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 2: CONTROLE SEMANAL DE NFS (ENTRADAS, SAÍDAS E ESTORNOS)         */}
        {/* =================================================================== */}
        <TabsContent value="nfs" className="space-y-6 mt-0">
          <OwnerFiscalInvoicesPanel />
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 3: PÁTIO & VALOR DO ESTOQUE EM R$                              */}
        {/* =================================================================== */}
        <TabsContent value="patio" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor Total do Estoque</span>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {formatCurrencyBRL(executiveMetrics.totalStockValue)}
                </div>
                <p className="text-[11px] text-muted-foreground">{executiveMetrics.totalStockCount} motos em pátio</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modelos no Catálogo</span>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {modelStockSummary.length} modelos
                </div>
                <p className="text-[11px] text-muted-foreground">Linhas ativas com estoque físico</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preço Médio por Moto</span>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {formatCurrencyBRL(executiveMetrics.totalStockCount > 0 ? executiveMetrics.totalStockValue / executiveMetrics.totalStockCount : 0)}
                </div>
                <p className="text-[11px] text-muted-foreground">Média geral do pátio</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Concessionárias Ativas</span>
                <div className="text-2xl font-black font-mono tracking-tight text-foreground tabular-nums">
                  {stores.filter((s) => s.is_active !== false).length} unidades
                </div>
                <p className="text-[11px] text-muted-foreground">Pontos de venda e pátios integrados</p>
              </CardContent>
            </Card>
          </div>

          {/* Listagem do Estoque do Pátio focada em MODELOS E QUANTIDADES */}
          <Card className="rounded-2xl border shadow-xs overflow-hidden bg-card">
            <CardHeader className="p-4 border-b bg-muted/20">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Bike className="w-4 h-4 text-primary" />
                  Estoque Físico de Motocicletas por Modelo &amp; Volume
                </CardTitle>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-8.5 pl-8 text-xs rounded-xl"
                      placeholder="Filtrar por modelo ou cor..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                    />
                  </div>

                  <Select value={stockStoreFilter} onValueChange={(val: any) => setStockStoreFilter(val)}>
                    <SelectTrigger className="h-8.5 text-xs w-48 rounded-xl">
                      <SelectValue placeholder="Concessionária" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Concessionárias</SelectItem>
                      {stores
                        .filter((s) => s.is_active !== false)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            Pátio {formatStoreShortName(s.name)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select value={stockSortBy} onValueChange={(val: any) => setStockSortBy(val)}>
                    <SelectTrigger className="h-8.5 text-xs w-44 rounded-xl">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count_desc">Maior Quantidade</SelectItem>
                      <SelectItem value="count_asc">Menor Quantidade</SelectItem>
                      <SelectItem value="value_desc">Maior Valor Total</SelectItem>
                      <SelectItem value="name_asc">Nome do Modelo (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportModelStockExcel}
                    className="h-8.5 text-xs gap-1.5 rounded-xl border-dashed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar Excel
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="max-h-[550px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/40 z-10 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Modelo da Motocicleta</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider">Total em Pátio</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Preço Médio</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Capital Total</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Cores em Estoque</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelStockSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                          Nenhum modelo disponível encontrado com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelStockSummary.map((item) => (
                        <TableRow key={item.model} className="hover:bg-muted/20 border-b border-border/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground">{item.model}</span>
                              <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">
                                {item.brand}
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="font-mono font-bold text-xs text-foreground">
                              {item.totalCount} un.
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatCurrencyBRL(item.avgPrice)}
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                            {formatCurrencyBRL(item.totalValue)}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                              {item.colorCounts.slice(0, 4).map((c) => (
                                <Badge key={c.color} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                  {c.color}: <strong className="ml-1 font-semibold">{c.count}</strong>
                                </Badge>
                              ))}
                              {item.colorCounts.length > 4 && (
                                <span className="text-[10px] text-muted-foreground self-center">
                                  +{item.colorCounts.length - 4} cores
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedModelForChassis(item)}
                              className="h-7 text-[11px] gap-1 px-2.5 rounded-lg hover:border-primary/50"
                              title="Consultar chassis individuais deste modelo"
                            >
                              <Eye className="w-3 h-3 text-primary" />
                              Ver Chassis ({item.totalCount})
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Modal de Detalhes dos Chassis do Modelo */}
          <Dialog open={!!selectedModelForChassis} onOpenChange={(open) => !open && setSelectedModelForChassis(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Bike className="w-5 h-5 text-primary" />
                  Chassis em Pátio — {selectedModelForChassis?.model}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Listagem física individual dos {selectedModelForChassis?.totalCount} veículos deste modelo em estoque físico.
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-y-auto flex-1 border rounded-xl mt-2 max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 z-10 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Chassi</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Cor</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Concessionária</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Preço de Venda</TableHead>
                      <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedModelForChassis?.vehicles.map((veh) => {
                      const store = stores.find((s) => s.id === veh.store_id);
                      const storeName = store?.name ? formatStoreShortName(store.name) : 'Concessionária Padrão';
                      return (
                        <TableRow key={veh.id} className="text-xs hover:bg-muted/20 border-b border-border/40">
                          <TableCell className="font-mono font-bold">{veh.chassis || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{veh.color || 'Padrão'}</TableCell>
                          <TableCell className="font-medium">{storeName}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {formatCurrencyBRL(Number(veh.sale_price) || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/30 text-[10px] font-bold">
                              No Pátio
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 4: CONTROLE DE TROCA DE ESTOQUE & TRANSFERÊNCIAS INTERLOJAS       */}
        {/* =================================================================== */}
        <TabsContent value="troca-estoque" className="space-y-6 mt-0">
          <ExecutiveStockExchangePanel />
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 5: VENDEDORES & COMISSÕES — EM PRODUÇÃO                         */}
        {/* =================================================================== */}
        <TabsContent value="vendedores" className="space-y-6 mt-0">
          <div className="rounded-2xl border border-dashed border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-10 flex flex-col items-center justify-center gap-4 text-center min-h-[320px]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-500">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-black text-foreground tracking-tight">Módulo em Desenvolvimento</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O painel de <strong className="text-foreground">Vendedores & Comissões</strong> está sendo desenvolvido e será disponibilizado em breve com ranking completo, cálculo automático de comissões e metas individuais.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Em Produção • Em Breve</span>
            </div>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 6: COMPROVANTES DE VENDA — EM PRODUÇÃO                          */}
        {/* =================================================================== */}
        <TabsContent value="comprovantes" className="space-y-6 mt-0">
          <div className="rounded-2xl border border-dashed border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-10 flex flex-col items-center justify-center gap-4 text-center min-h-[320px]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-500">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-black text-foreground tracking-tight">Módulo em Desenvolvimento</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A auditoria de <strong className="text-foreground">Comprovantes de Venda</strong> está sendo desenvolvida. Em breve será possível visualizar, validar e exportar comprovantes de cada operação diretamente por aqui.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Em Produção • Em Breve</span>
            </div>
          </div>
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA: CONTROLE DE REVENDEDORES (ESTOQUE, PAGAMENTO, FINANCIAMENTOS)  */}
        {/* =================================================================== */}
        <TabsContent value="revendedores" className="space-y-6 mt-0">
          <ResellerControlPanel />
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 7: PLANILHA INTERNA DA CONCESSIONÁRIA INTEGRADA                 */}
        {/* =================================================================== */}
        <TabsContent value="planilha" className="space-y-6 mt-0">
          <CloudMonthlySpreadsheet />
        </TabsContent>
      </Tabs>
    </div>
  );
}
