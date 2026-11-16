import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerFiscalInvoicesPanel } from '@/components/dashboard/OwnerFiscalInvoicesPanel';
import { ExecutiveSalesReceiptsAuditor } from '@/components/dashboard/ExecutiveSalesReceiptsAuditor';
import { CloudMonthlySpreadsheet } from '@/components/sheets/CloudMonthlySpreadsheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

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
  mocCount: number;
  divCount: number;
  totalValue: number;
  avgPrice: number;
  colorCounts: { color: string; count: number }[];
  vehicles: any[];
}

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isManager, hasElevatedAccess } = useAuth();
  const { sales, isRefreshing, refresh } = useConsolidatedSales();
  const { data: vehicles = [] } = useVehicles();
  const { data: stores = [] } = useStores();
  const { data: employees = [] } = useEmployees();

  // Abas Executivas: caixa | nfs | patio | vendedores | comprovantes | planilha
  const [activeTab, setActiveTab] = useState<'caixa' | 'nfs' | 'patio' | 'vendedores' | 'comprovantes' | 'planilha'>('caixa');

  // Filtros Globais
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockSearch, setStockSearch] = useState<string>('');
  const [stockStoreFilter, setStockStoreFilter] = useState<'all' | 'montesclaros' | 'divinopolis'>('all');
  const [stockSortBy, setStockSortBy] = useState<'count_desc' | 'count_asc' | 'value_desc' | 'name_asc'>('count_desc');
  const [selectedModelForChassis, setSelectedModelForChassis] = useState<ModelStockGroup | null>(null);

  // Filtragem dinâmica de vendas
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    return sales.filter((item) => {
      // 1. Filtro de Loja
      if (storeFilter !== 'all') {
        const itemStoreNorm = (item.store_name || '').toUpperCase();
        if (storeFilter === 'divinopolis' && !itemStoreNorm.includes('DIVINOPOLIS')) return false;
        if (storeFilter === 'montesclaros' && !itemStoreNorm.includes('MONTES CLAROS') && !itemStoreNorm.includes('MOC')) return false;
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
  }, [sales, storeFilter, searchQuery, periodPreset, startDate, endDate]);

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

    // Divisão por Loja
    let mocRevenue = 0;
    let mocCount = 0;
    let divRevenue = 0;
    let divCount = 0;

    filteredSales.forEach((s) => {
      const name = (s.store_name || '').toUpperCase();
      if (name.includes('MONTES CLAROS') || name.includes('MOC')) {
        mocRevenue += s.valor || 0;
        mocCount += 1;
      } else {
        divRevenue += s.valor || 0;
        divCount += 1;
      }
    });

    const mocAvgTicket = mocCount > 0 ? mocRevenue / mocCount : 0;
    const divAvgTicket = divCount > 0 ? divRevenue / divCount : 0;
    const mocShare = totalRevenue > 0 ? (mocRevenue / totalRevenue) * 100 : 0;
    const divShare = totalRevenue > 0 ? (divRevenue / totalRevenue) * 100 : 0;

    // Métricas do Pátio / Estoque Parado
    const inStockVehicles = vehicles.filter((v) => v.status === 'disponivel' || (v.status as any) === 'em_estoque');
    const totalStockCount = inStockVehicles.length;
    const totalStockValue = inStockVehicles.reduce((acc, v) => acc + (Number(v.purchase_price) || Number(v.sale_price) || 0), 0);

    const mocStockVehicles = inStockVehicles.filter((v) => {
      const s = stores.find((st) => st.id === v.store_id);
      return (s?.name || '').toUpperCase().includes('MONTES') || (s?.city || '').toUpperCase().includes('MONTES');
    });
    const mocStockValue = mocStockVehicles.reduce((acc, v) => acc + (Number(v.sale_price) || 0), 0);

    const divStockVehicles = inStockVehicles.filter((v) => {
      const s = stores.find((st) => st.id === v.store_id);
      return (s?.name || '').toUpperCase().includes('DIVINOPOLIS') || (s?.city || '').toUpperCase().includes('DIVINOPOLIS');
    });
    const divStockValue = divStockVehicles.reduce((acc, v) => acc + (Number(v.sale_price) || 0), 0);

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
      mocRevenue,
      mocCount,
      mocAvgTicket,
      mocShare,
      divRevenue,
      divCount,
      divAvgTicket,
      divShare,
      totalStockCount,
      totalStockValue,
      mocStockCount: mocStockVehicles.length,
      mocStockValue,
      divStockCount: divStockVehicles.length,
      divStockValue,
    };
  }, [filteredSales, vehicles, stores]);

  // Margem e Lucro por Modelo de Moto
  const modelProfitability = useMemo(() => {
    const map = new Map<string, { model: string; count: number; revenue: number; marginValue: number }>();

    filteredSales.forEach((s) => {
      const model = s.modelo?.trim() || 'Modelo Não Informado';
      const curr = map.get(model) || { model, count: 0, revenue: 0, marginValue: 0 };
      curr.count += 1;
      curr.revenue += s.valor || 0;
      // Margem média por modelo (~18% sobre o preço de venda faturado)
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
      const sellerName = s.vendedor?.trim() || 'Vendedor Não Identificado';
      const curr = map.get(sellerName) || {
        name: sellerName,
        store: s.store_name?.includes('MONTES') ? 'Montes Claros' : 'Divinópolis',
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

  // Agrupamento Executivo do Pátio focado em MODELOS e QUANTIDADES
  const modelStockSummary = useMemo(() => {
    const inStock = vehicles.filter((v) => v.status === 'disponivel' || (v.status as any) === 'em_estoque');
    const map = new Map<string, {
      model: string;
      brand: string;
      totalCount: number;
      mocCount: number;
      divCount: number;
      totalValue: number;
      colorMap: Map<string, number>;
      vehicles: typeof vehicles;
    }>();

    inStock.forEach((v) => {
      const canonical = getCanonicalModelName(v.model);
      const store = stores.find((s) => s.id === v.store_id);
      const storeUpper = (store?.name || store?.city || '').toUpperCase();
      const isMoc = storeUpper.includes('MONTES') || storeUpper.includes('MOC');
      const isDiv = storeUpper.includes('DIVINOPOLIS') || storeUpper.includes('DIV');

      const curr = map.get(canonical) || {
        model: canonical,
        brand: v.brand || 'SHINERAY',
        totalCount: 0,
        mocCount: 0,
        divCount: 0,
        totalValue: 0,
        colorMap: new Map<string, number>(),
        vehicles: [],
      };

      curr.totalCount += 1;
      if (isDiv) curr.divCount += 1;
      else curr.mocCount += 1; // Padrão Montes Claros (Matriz)

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
        mocCount: item.mocCount,
        divCount: item.divCount,
        totalValue: item.totalValue,
        avgPrice,
        colorCounts,
        vehicles: item.vehicles,
      };
    });

    // Filtro por Concessionária
    if (stockStoreFilter === 'montesclaros') {
      list = list.filter((m) => m.mocCount > 0);
    } else if (stockStoreFilter === 'divinopolis') {
      list = list.filter((m) => m.divCount > 0);
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
  }, [vehicles, stores, stockSearch, stockStoreFilter, stockSortBy]);

  const exportModelStockExcel = () => {
    const data = modelStockSummary.map((m) => ({
      Modelo: m.model,
      Marca: m.brand,
      'Quantidade Total': m.totalCount,
      'Qtd Montes Claros': m.mocCount,
      'Qtd Divinópolis': m.divCount,
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
        { key: 'Qtd Montes Claros', label: 'Qtd Montes Claros', type: 'number' },
        { key: 'Qtd Divinópolis', label: 'Qtd Divinópolis', type: 'number' },
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
      filters: { Período: periodPreset, Loja: storeFilter },
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

  return (
    <div className="space-y-6 w-full min-w-0 pb-16 animate-fade-in">
      {/* 1. CABEÇALHO EXECUTIVO PADRONIZADO */}
      <PageHeader
        title="Cockpit da Diretoria"
        description="Painel estratégico e financeiro: fluxo de caixa real, pátio em R$, comissões a pagar e auditoria de comprovantes."
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
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={exportExecutiveExcel}
              className="gap-1.5 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Relatório XLSX
            </Button>
          </div>
        }
      />

      {/* BARRA DE FILTROS GLOBAIS */}
      <Card className="rounded-2xl border shadow-xs bg-card">
        <CardContent className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-8 text-xs w-44 rounded-xl">
                  <SelectValue placeholder="Concessionária" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Concessionárias</SelectItem>
                  <SelectItem value="montesclaros">Montes Claros (MOC)</SelectItem>
                  <SelectItem value="divinopolis">Divinópolis (DIV)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={periodPreset} onValueChange={setPeriodPreset}>
                <SelectTrigger className="h-8 text-xs w-40 rounded-xl">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">Mês Atual (Novembro)</SelectItem>
                  <SelectItem value="last_month">Mês Anterior (Outubro)</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="custom">Data Personalizada</SelectItem>
                </SelectContent>
              </Select>

              {periodPreset === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    className="h-8 text-xs w-32 rounded-xl"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="date"
                    className="h-8 text-xs w-32 rounded-xl"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs rounded-xl"
                placeholder="Buscar cliente, chassi, vendedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. NAVEGAÇÃO ENTRE AS ABAS ESTRATÉGICAS */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <TabsList className="bg-muted/70 p-1.5 rounded-2xl w-full grid grid-cols-2 md:grid-cols-6 max-w-6xl mx-auto shadow-inner">
          <TabsTrigger
            value="caixa"
            className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xs py-2.5"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>1. Caixa &amp; Margens</span>
          </TabsTrigger>

          <TabsTrigger
            value="nfs"
            className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xs py-2.5"
          >
            <ReceiptText className="w-4 h-4 shrink-0" />
            <span>2. Controle de NFs</span>
          </TabsTrigger>

          <TabsTrigger
            value="patio"
            className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-xs py-2.5"
          >
            <Bike className="w-4 h-4 shrink-0" />
            <span>3. Pátio em R$</span>
          </TabsTrigger>

          <TabsTrigger
            value="vendedores"
            className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xs py-2.5"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>4. Vendedores &amp; Comissões</span>
          </TabsTrigger>

          <TabsTrigger
            value="comprovantes"
            className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-xs py-2.5"
          >
            <Paperclip className="w-4 h-4 shrink-0" />
            <span>5. Comprovantes</span>
          </TabsTrigger>

          <TabsTrigger
            value="planilha"
            className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-xs py-2.5"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>6. Planilha Interna</span>
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* ABA 1: CAIXA & RESULTADOS FINANCEIROS                               */}
        {/* =================================================================== */}
        <TabsContent value="caixa" className="space-y-6 mt-0">
          {/* 4 Cards de Liquidez e Caixa Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Faturamento Bruto */}
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Faturamento Bruto</span>
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-foreground">
                  {formatCurrencyBRL(executiveMetrics.totalRevenue)}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span>{executiveMetrics.count} motos faturadas</span>
                  <span className="text-muted-foreground/60">• Ticket médio: {formatCurrencyBRL(executiveMetrics.avgTicket)}</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Entradas Imediatas (PIX / Dinheiro) */}
            <Card className="rounded-2xl border border-emerald-500/20 shadow-xs bg-emerald-500/5">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Caixa Imediato (PIX / Dinheiro)</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600">
                    <QrCode className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyBRL(executiveMetrics.totalCashPix)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {executiveMetrics.totalRevenue > 0
                    ? `${((executiveMetrics.totalCashPix / executiveMetrics.totalRevenue) * 100).toFixed(1)}% do faturamento total já liquidado`
                    : 'Sem faturamento'}
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Financiamentos a Receber dos Bancos */}
            <Card className="rounded-2xl border border-blue-500/20 shadow-xs bg-blue-500/5">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Financiamentos dos Bancos</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-600">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {formatCurrencyBRL(executiveMetrics.totalFinancing)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Repasses em análise/liquidação (BV, Pan, Santander)
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Lucro Bruto Estimado */}
            <Card className="rounded-2xl border border-amber-500/20 shadow-xs bg-amber-500/5">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Lucro Bruto Real Estimado</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {formatCurrencyBRL(executiveMetrics.estimatedGrossProfit)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Margem média da operação:</span>
                  <Badge variant="outline" className="text-amber-600 font-bold border-amber-500/30 text-[10px]">
                    {executiveMetrics.grossMarginPercent.toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparativo entre Montes Claros e Divinópolis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardHeader className="p-4 pb-2 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Store className="w-4 h-4 text-primary" /> Concessionária Montes Claros
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    {executiveMetrics.mocShare.toFixed(1)}% das vendas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento</span>
                    <p className="text-base font-black text-primary mt-0.5">{formatCurrencyBRL(executiveMetrics.mocRevenue)}</p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Motos Faturadas</span>
                    <p className="text-base font-black text-foreground mt-0.5">{executiveMetrics.mocCount} un.</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between pt-1">
                  <span>Ticket Médio:</span>
                  <span className="font-bold text-foreground">{formatCurrencyBRL(executiveMetrics.mocAvgTicket)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardHeader className="p-4 pb-2 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600" /> Concessionária Divinópolis
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-bold font-mono">
                    {executiveMetrics.divShare.toFixed(1)}% das vendas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento</span>
                    <p className="text-base font-black text-emerald-600 mt-0.5">{formatCurrencyBRL(executiveMetrics.divRevenue)}</p>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-xl border">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Motos Faturadas</span>
                    <p className="text-base font-black text-foreground mt-0.5">{executiveMetrics.divCount} un.</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between pt-1">
                  <span>Ticket Médio:</span>
                  <span className="font-bold text-foreground">{formatCurrencyBRL(executiveMetrics.divAvgTicket)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Lucratividade & Margem por Modelo de Moto */}
          <Card className="rounded-2xl border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bike className="w-4 h-4 text-primary" />
                Margem Real e Lucro Líquido por Modelo de Moto
              </CardTitle>
              <CardDescription className="text-xs">
                Ranking de faturamento, volume de unidades e margem de contribuição bruta gerada por cada modelo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo da Motocicleta</TableHead>
                    <TableHead className="text-center">Unidades Faturadas</TableHead>
                    <TableHead className="text-right">Faturamento Total</TableHead>
                    <TableHead className="text-right">Ticket Médio Unitário</TableHead>
                    <TableHead className="text-right">Margem Bruta Estimada (R$)</TableHead>
                    <TableHead className="text-right">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelProfitability.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhuma venda registrada no período selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    modelProfitability.map((m, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="font-bold text-xs flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span>{m.model}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">{m.count} un.</TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-primary">{formatCurrencyBRL(m.revenue)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCurrencyBRL(m.avgTicket)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">{formatCurrencyBRL(m.marginValue)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{m.share.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Repasses por Banco de Financiamento */}
          <Card className="rounded-2xl border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                Financiamentos Bancários por Instituição
              </CardTitle>
              <CardDescription className="text-xs">
                Valores repassados e em liquidação por financeira (BV, Pan, Santander, Altis, Motrix).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição Financeira</TableHead>
                    <TableHead className="text-center">Contratos Financiados</TableHead>
                    <TableHead className="text-right">Total Financiado a Receber</TableHead>
                    <TableHead className="text-right">Participação no Financiado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankDistribution.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                        Nenhum financiamento bancário registrado no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bankDistribution.map((b, idx) => {
                      const share = executiveMetrics.totalFinancing > 0 ? (b.totalFinanced / executiveMetrics.totalFinancing) * 100 : 0;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-xs">{b.bank}</TableCell>
                          <TableCell className="text-center font-bold text-xs">{b.count} contratos</TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-blue-600">{formatCurrencyBRL(b.totalFinanced)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{share.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Valor Total do Estoque Parado</span>
                <div className="text-2xl font-black text-primary">
                  {formatCurrencyBRL(executiveMetrics.totalStockValue)}
                </div>
                <p className="text-xs text-muted-foreground">Capital imobilizado em {executiveMetrics.totalStockCount} motocicletas</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pátio Montes Claros</span>
                <div className="text-2xl font-black text-foreground">
                  {formatCurrencyBRL(executiveMetrics.mocStockValue)}
                </div>
                <p className="text-xs text-muted-foreground">{executiveMetrics.mocStockCount} motocicletas em estoque físico</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pátio Divinópolis</span>
                <div className="text-2xl font-black text-foreground">
                  {formatCurrencyBRL(executiveMetrics.divStockValue)}
                </div>
                <p className="text-xs text-muted-foreground">{executiveMetrics.divStockCount} motocicletas em estoque físico</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Modelos no Catálogo</span>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {modelStockSummary.length} modelos
                </div>
                <p className="text-xs text-muted-foreground">Linhas ativas com unidades físicas disponíveis</p>
              </CardContent>
            </Card>
          </div>

          {/* Listagem do Estoque do Pátio focada em MODELOS E QUANTIDADES */}
          <Card className="rounded-2xl border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Bike className="w-4 h-4 text-primary" />
                    Motocicletas Disponíveis no Pátio
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Consolidado estratégico por modelo e volume de unidades disponíveis no estoque das lojas.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-8 pl-8 text-xs rounded-xl"
                      placeholder="Filtrar por modelo ou cor..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                    />
                  </div>

                  <Select value={stockStoreFilter} onValueChange={(val: any) => setStockStoreFilter(val)}>
                    <SelectTrigger className="h-8 text-xs w-44 rounded-xl">
                      <SelectValue placeholder="Concessionária" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Concessionárias</SelectItem>
                      <SelectItem value="montesclaros">Pátio Montes Claros</SelectItem>
                      <SelectItem value="divinopolis">Pátio Divinópolis</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={stockSortBy} onValueChange={(val: any) => setStockSortBy(val)}>
                    <SelectTrigger className="h-8 text-xs w-44 rounded-xl">
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
                    className="h-8 text-xs gap-1.5 rounded-xl border-dashed"
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
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-xs">
                    <TableRow>
                      <TableHead>Modelo da Motocicleta</TableHead>
                      <TableHead className="text-center font-bold">Qtd Total no Pátio</TableHead>
                      <TableHead className="text-center">Montes Claros</TableHead>
                      <TableHead className="text-center">Divinópolis</TableHead>
                      <TableHead className="text-right">Preço Médio Unitário</TableHead>
                      <TableHead className="text-right">Capital Total no Pátio</TableHead>
                      <TableHead>Cores em Estoque</TableHead>
                      <TableHead className="text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelStockSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                          Nenhum modelo disponível encontrado com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelStockSummary.map((item) => (
                        <TableRow key={item.model} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground">{item.model}</span>
                              <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">
                                {item.brand}
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge className="font-black text-xs px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/25">
                              {item.totalCount} {item.totalCount === 1 ? 'moto' : 'motos'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="font-semibold text-xs text-foreground">
                              {item.mocCount} un
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <span className="font-semibold text-xs text-foreground">
                              {item.divCount} un
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatCurrencyBRL(item.avgPrice)}
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {formatCurrencyBRL(item.totalValue)}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                              {item.colorCounts.slice(0, 4).map((c) => (
                                <Badge key={c.color} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {c.color}: <strong className="ml-1">{c.count}</strong>
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
                  <TableHeader className="sticky top-0 bg-muted/80 z-10">
                    <TableRow>
                      <TableHead>Chassi</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Concessionária</TableHead>
                      <TableHead className="text-right">Preço de Venda</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedModelForChassis?.vehicles.map((veh) => {
                      const store = stores.find((s) => s.id === veh.store_id);
                      const isMoc = (store?.name || store?.city || '').toUpperCase().includes('MONTES');
                      return (
                        <TableRow key={veh.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-mono font-bold">{veh.chassis || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{veh.color || 'Padrão'}</TableCell>
                          <TableCell className="font-medium">{isMoc ? 'Montes Claros' : 'Divinópolis'}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary">
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
        {/* ABA 4: VENDEDORES & COMISSÕES                                       */}
        {/* =================================================================== */}
        <TabsContent value="vendedores" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total de Comissões a Pagar</span>
                <div className="text-2xl font-black text-indigo-600">
                  {formatCurrencyBRL(totalCommissionsToPay)}
                </div>
                <p className="text-xs text-muted-foreground">Estimativa acumulada sobre as vendas do período</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Consultores Ativos</span>
                <div className="text-2xl font-black text-foreground">
                  {sellerPerformance.length} consultores
                </div>
                <p className="text-xs text-muted-foreground">Com vendas registradas no período selecionado</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ticket Médio por Vendedor</span>
                <div className="text-2xl font-black text-primary">
                  {formatCurrencyBRL(executiveMetrics.avgTicket)}
                </div>
                <p className="text-xs text-muted-foreground">Média geral das operações</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Ranking de Vendas e Comissões por Vendedor
              </CardTitle>
              <CardDescription className="text-xs">
                Acompanhe quem está vendendo, o faturamento gerado e o montante de comissão a pagar para cada consultor.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Vendedor / Consultor</TableHead>
                    <TableHead>Concessionária</TableHead>
                    <TableHead className="text-center">Motos Vendidas</TableHead>
                    <TableHead className="text-right">Faturamento Gerado</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-center">Taxa de Comissão</TableHead>
                    <TableHead className="text-right">Comissão a Pagar (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellerPerformance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhum vendedor pontuou no período selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sellerPerformance.map((seller, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs p-0 ${
                              idx === 0
                                ? 'bg-amber-500 text-slate-950'
                                : idx === 1
                                ? 'bg-slate-400 text-slate-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {idx + 1}º
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-xs text-foreground">{seller.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{seller.store}</TableCell>
                        <TableCell className="text-center font-black text-xs">{seller.count} un.</TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-primary">{formatCurrencyBRL(seller.revenue)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCurrencyBRL(seller.avgTicket)}</TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {seller.commissionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-xs text-indigo-600">
                          {formatCurrencyBRL(seller.commissionTotal)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 5: AUDITORIA DE COMPROVANTES DE CADA VENDA                      */}
        {/* =================================================================== */}
        <TabsContent value="comprovantes" className="space-y-6 mt-0">
          <ExecutiveSalesReceiptsAuditor sales={filteredSales} />
        </TabsContent>

        {/* =================================================================== */}
        {/* ABA 6: PLANILHA INTERNA DA CONCESSIONÁRIA INTEGRADA                 */}
        {/* =================================================================== */}
        <TabsContent value="planilha" className="space-y-6 mt-0">
          <CloudMonthlySpreadsheet />
        </TabsContent>
      </Tabs>
    </div>
  );
}
