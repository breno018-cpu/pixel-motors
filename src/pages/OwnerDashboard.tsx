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
  PieChart as PieChartIcon,
  BarChart3,
  SlidersHorizontal,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  Landmark,
  Compass,
  Sparkles,
  Calculator,
  AlertTriangle,
  ArrowRight,
  Store,
  Wallet,
  Car,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useConsolidatedSales, ConsolidatedSaleItem } from '@/hooks/useConsolidatedSales';
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useEmployees } from '@/hooks/useEmployees';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { exportToXLSX } from '@/lib/export';
import { GeographicSalesRadiusMap } from '@/components/dashboard/GeographicSalesRadiusMap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const PALETTE = {
  primary: '#2563eb',
  sky: '#0284c7',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  teal: '#14b8a6',
  slate: '#64748b',
};

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b'];

type DimensionType = 'store' | 'seller' | 'payment' | 'bank' | 'model' | 'channel' | 'weekday' | 'price_range';
type MetricType = 'revenue' | 'volume' | 'ticket';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isManager, hasElevatedAccess } = useAuth();
  const { sales, isRefreshing, refresh, isRestrictedSeller } = useConsolidatedSales();
  const { data: vehicles } = useVehicles();
  const { data: stores } = useStores();
  const { data: employees } = useEmployees();

  // Controle de Abas Principais: VER, DIVIDIR, MAPEAR, SIMULAR
  const [activeMainTab, setActiveMainTab] = useState<'ver' | 'dividir' | 'mapear' | 'simular'>('ver');

  // =========================================================================
  // FILTROS GLOBAIS ("O que ele quiser")
  // =========================================================================
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // =========================================================================
  // ESTADOS DO MÓDULO "DIVIDIR"
  // =========================================================================
  const [splitDimension, setSplitDimension] = useState<DimensionType>('seller');
  const [splitMetric, setSplitMetric] = useState<MetricType>('revenue');

  // =========================================================================
  // ESTADOS DO SIMULADOR
  // =========================================================================
  const [simTargetUnits, setSimTargetUnits] = useState<number>(60);
  const [simAvgTicket, setSimAvgTicket] = useState<number>(14900);
  const [simFinancingRatio, setSimFinancingRatio] = useState<number>(65);
  const [simMarginPercent, setSimMarginPercent] = useState<number>(18);

  // Lista de vendedores únicos
  const availableSellers = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.vendedor && s.vendedor.trim()) set.add(s.vendedor.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  // Lista de modelos únicos
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.modelo && s.modelo.trim()) set.add(s.modelo.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  // =========================================================================
  // FILTRAGEM DINÂMICA UNIFICADA
  // =========================================================================
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    return sales.filter((item) => {
      // 1. Filtro de Loja
      if (storeFilter !== 'all') {
        const itemStoreNorm = (item.store_name || '').toUpperCase();
        const selectedStore = stores?.find((s) => s.id === storeFilter);
        const targetName = (selectedStore?.name || storeFilter).toUpperCase();
        if (storeFilter === 'divinopolis') {
          if (!itemStoreNorm.includes('DIVINOPOLIS')) return false;
        } else if (storeFilter === 'montesclaros') {
          if (!itemStoreNorm.includes('MONTES CLAROS') && !itemStoreNorm.includes('MOC')) return false;
        } else {
          if (!itemStoreNorm.includes(targetName) && item.store_id !== storeFilter) return false;
        }
      }

      // 2. Filtro de Vendedor
      if (sellerFilter !== 'all' && item.vendedor !== sellerFilter) {
        return false;
      }

      // 3. Filtro de Forma de Pagamento
      if (paymentFilter !== 'all') {
        if (paymentFilter === 'financiamento' && (item.financiamento || 0) <= 0) return false;
        if (paymentFilter === 'pix_dinheiro' && (item.pix || 0) <= 0 && (item.dinheiro || 0) <= 0) return false;
        if (paymentFilter === 'cartao' && (item.cartao || 0) <= 0) return false;
        if (paymentFilter === 'consorcio' && (item.carta_credito || 0) <= 0) return false;
      }

      // 4. Filtro de Busca Geral
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.cliente.toLowerCase().includes(q) ||
          item.chassi.toLowerCase().includes(q) ||
          item.modelo.toLowerCase().includes(q) ||
          item.regiao.toLowerCase().includes(q) ||
          item.vendedor.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 5. Filtro de Período
      const saleDate = new Date(item.date);
      if (periodPreset === 'today') {
        return saleDate >= todayStart;
      }
      if (periodPreset === 'yesterday') {
        const yStart = new Date(todayStart.getTime() - 86400000);
        return saleDate >= yStart && saleDate < todayStart;
      }
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
      if (periodPreset === 'this_year') {
        return saleDate.getFullYear() === now.getFullYear();
      }
      if (periodPreset === 'custom' && (startDate || endDate)) {
        if (startDate && saleDate < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && saleDate > new Date(`${endDate}T23:59:59`)) return false;
      }

      return true;
    });
  }, [sales, storeFilter, sellerFilter, paymentFilter, searchQuery, periodPreset, startDate, endDate]);

  // =========================================================================
  // INDICADORES EXECUTIVOS (MÓDULO VER)
  // =========================================================================
  const executiveMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalFinancing = 0;
    let totalCashPix = 0;
    let totalCard = 0;
    let totalConsortium = 0;
    let count = filteredSales.length;

    filteredSales.forEach((s) => {
      totalRevenue += s.valor || 0;
      totalFinancing += s.financiamento || 0;
      totalCashPix += (s.dinheiro || 0) + (s.pix || 0);
      totalCard += s.cartao || 0;
      totalConsortium += s.carta_credito || 0;
    });

    const avgTicket = count > 0 ? totalRevenue / count : 0;
    // Margem bruta estimada conservadora da operação (~18.5% sobre motos zero + receita agregada F&I)
    const estimatedGrossProfit = totalRevenue * 0.185;
    const grossMarginPercent = totalRevenue > 0 ? (estimatedGrossProfit / totalRevenue) * 100 : 0;

    // Métricas por Loja (Montes Claros vs Divinópolis)
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

    // Métricas de Estoque Geral
    const availableVehicles = (vehicles || []).filter((v) => v.status === 'disponivel' || (v.status as any) === 'em_estoque');
    const totalStockCount = availableVehicles.length;
    const totalStockValue = availableVehicles.reduce((acc, v) => acc + (Number(v.purchase_price) || Number(v.sale_price) || 0), 0);

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
    };
  }, [filteredSales, vehicles]);

  // Evolução Diária de Faturamento
  const timelineData = useMemo(() => {
    const map = new Map<string, { date: string; displayDate: string; revenue: number; count: number }>();
    filteredSales.forEach((s) => {
      const d = new Date(s.date);
      const iso = d.toISOString().split('T')[0];
      const display = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const curr = map.get(iso) || { date: iso, displayDate: display, revenue: 0, count: 0 };
      curr.revenue += s.valor || 0;
      curr.count += 1;
      map.set(iso, curr);
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales]);

  // Mix de Pagamento
  const paymentMixData = useMemo(() => {
    return [
      { name: 'Financiamento Bancário', value: executiveMetrics.totalFinancing, color: PALETTE.primary },
      { name: 'À Vista / PIX / Dinheiro', value: executiveMetrics.totalCashPix, color: PALETTE.emerald },
      { name: 'Cartão de Crédito', value: executiveMetrics.totalCard, color: PALETTE.amber },
      { name: 'Consórcio / Outros', value: executiveMetrics.totalConsortium, color: PALETTE.purple },
    ].filter((item) => item.value > 0);
  }, [executiveMetrics]);

  // =========================================================================
  // MOTOR MULTI-DIMENSIONAL DE DIVISÃO ("DIVIDIR O QUE ELE QUISER")
  // =========================================================================
  const splitAnalysis = useMemo(() => {
    const groupMap = new Map<string, { label: string; revenue: number; count: number; items: ConsolidatedSaleItem[] }>();

    filteredSales.forEach((s) => {
      let key = 'Outros';

      switch (splitDimension) {
        case 'store':
          key = s.store_name?.toUpperCase().includes('MONTES CLAROS')
            ? 'Concessionária Montes Claros'
            : 'Concessionária Divinópolis';
          break;
        case 'seller':
          key = s.vendedor?.trim() || 'Vendedor Não Identificado';
          break;
        case 'payment':
          if ((s.financiamento || 0) > 0) key = 'Financiamento Bancário';
          else if ((s.cartao || 0) > 0) key = 'Cartão de Crédito';
          else if ((s.carta_credito || 0) > 0) key = 'Carta de Crédito / Consórcio';
          else if ((s.pix || 0) > 0 || (s.dinheiro || 0) > 0) key = 'À Vista / PIX';
          else key = 'Outras Formas';
          break;
        case 'bank':
          key = s.banco?.trim().toUpperCase() || 'À VISTA / SEM BANCO';
          break;
        case 'model':
          key = s.modelo?.trim().toUpperCase() || 'MOTO DIVERSA';
          break;
        case 'channel':
          key = s.lead_mapping?.trim() || 'Balcão da Loja';
          break;
        case 'weekday': {
          const dayIndex = new Date(s.date).getDay();
          const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
          key = days[dayIndex] || 'Indefinido';
          break;
        }
        case 'price_range': {
          const v = s.valor || 0;
          if (v < 10000) key = 'Até R$ 10.000';
          else if (v <= 14000) key = 'R$ 10.001 a R$ 14.000';
          else if (v <= 18000) key = 'R$ 14.001 a R$ 18.000';
          else if (v <= 22000) key = 'R$ 18.001 a R$ 22.000';
          else key = 'Acima de R$ 22.000';
          break;
        }
      }

      const curr = groupMap.get(key) || { label: key, revenue: 0, count: 0, items: [] };
      curr.revenue += s.valor || 0;
      curr.count += 1;
      curr.items.push(s);
      groupMap.set(key, curr);
    });

    const totalRev = executiveMetrics.totalRevenue || 1;
    const totalCount = executiveMetrics.count || 1;

    const list = Array.from(groupMap.values()).map((g) => {
      const avgTicket = g.count > 0 ? g.revenue / g.count : 0;
      const share = splitMetric === 'revenue' ? (g.revenue / totalRev) * 100 : (g.count / totalCount) * 100;
      return {
        ...g,
        avgTicket,
        share,
        sortValue: splitMetric === 'revenue' ? g.revenue : splitMetric === 'volume' ? g.count : avgTicket,
      };
    });

    list.sort((a, b) => b.sortValue - a.sortValue);
    return list;
  }, [filteredSales, splitDimension, splitMetric, executiveMetrics]);

  // =========================================================================
  // MAPEAMENTO GEOGRÁFICO DE CLIENTES E CIDADES ("MAPEAR")
  // =========================================================================
  const cityMappingData = useMemo(() => {
    const cityMap = new Map<string, { city: string; count: number; revenue: number }>();

    filteredSales.forEach((s) => {
      let rawCity = (s.regiao || '').trim();
      if (!rawCity || rawCity.toUpperCase() === 'INDEFINIDO' || rawCity.toUpperCase() === 'MG') {
        rawCity = s.store_name?.toUpperCase().includes('MONTES CLAROS') ? 'Montes Claros' : 'Divinópolis';
      }
      // Normalização amigável de nomes de cidades
      const normCity = rawCity
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())
        .replace(/\s+-\s+mg/i, '')
        .trim();

      const curr = cityMap.get(normCity) || { city: normCity, count: 0, revenue: 0 };
      curr.count += 1;
      curr.revenue += s.valor || 0;
      cityMap.set(normCity, curr);
    });

    const list = Array.from(cityMap.values()).sort((a, b) => b.count - a.count);
    const totalCount = executiveMetrics.count || 1;
    return list.map((c) => ({
      ...c,
      share: (c.count / totalCount) * 100,
    }));
  }, [filteredSales, executiveMetrics]);

  // Mapeamento de Funil Operacional / Esteira
  const pipelineMapping = useMemo(() => {
    // Categoriza vendas por estágio de conclusão
    const stages = [
      { id: 'fechada', label: '1. Vendas Fechadas', count: 0, revenue: 0, color: 'text-blue-500' },
      { id: 'nf', label: '2. Emissão de NF / Faturamento', count: 0, revenue: 0, color: 'text-amber-500' },
      { id: 'preparacao', label: '3. Preparação Técnica / Pátio', count: 0, revenue: 0, color: 'text-purple-500' },
      { id: 'entrega', label: '4. Pronta para Retirada / Transporte', count: 0, revenue: 0, color: 'text-sky-500' },
      { id: 'concluida', label: '5. Entregue ao Cliente', count: 0, revenue: 0, color: 'text-emerald-500' },
    ];

    filteredSales.forEach((s) => {
      const isConcluded = s.is_permitted || s.source === 'sheet';
      if (isConcluded) {
        stages[4].count += 1;
        stages[4].revenue += s.valor || 0;
      } else {
        stages[1].count += 1;
        stages[1].revenue += s.valor || 0;
      }
    });

    return stages;
  }, [filteredSales]);

  // =========================================================================
  // SIMULADOR DO PROPRIETÁRIO
  // =========================================================================
  const simulationResults = useMemo(() => {
    const projectedRevenue = simTargetUnits * simAvgTicket;
    const projectedFinancingUnits = Math.round(simTargetUnits * (simFinancingRatio / 100));
    const projectedCashUnits = simTargetUnits - projectedFinancingUnits;
    const projectedGrossProfit = projectedRevenue * (simMarginPercent / 100);
    // Comissão de retorno de retorno de banco F&I média (~R$ 450 por moto financiada)
    const projectedFinancingReturn = projectedFinancingUnits * 450;
    const totalProjectedNet = projectedGrossProfit + projectedFinancingReturn;

    const diffVsCurrentRevenue = projectedRevenue - executiveMetrics.totalRevenue;
    const diffVsCurrentUnits = simTargetUnits - executiveMetrics.count;

    return {
      projectedRevenue,
      projectedFinancingUnits,
      projectedCashUnits,
      projectedGrossProfit,
      projectedFinancingReturn,
      totalProjectedNet,
      diffVsCurrentRevenue,
      diffVsCurrentUnits,
    };
  }, [simTargetUnits, simAvgTicket, simFinancingRatio, simMarginPercent, executiveMetrics]);

  // Exportação para Excel
  const handleExportXLSX = () => {
    const rows = filteredSales.map((s) => ({
      ID: s.id,
      Contrato: s.contract_number || '-',
      Loja: s.store_name,
      Data: s.dateStr,
      Cliente: s.cliente,
      Cidade_Regiao: s.regiao,
      Modelo_Moto: s.modelo,
      Chassi: s.chassi,
      Vendedor: s.vendedor,
      Valor_Total: s.valor,
      Financiamento: s.financiamento,
      Banco: s.banco,
      Pix: s.pix,
      Dinheiro: s.dinheiro,
      Cartao: s.cartao,
      Consorcio: s.carta_credito,
      Origem_Lead: s.lead_mapping,
    }));

    void exportToXLSX({
      title: 'Relatório Executivo do Proprietário - L1MA Motors',
      module: 'sales',
      filters: { Período: periodPreset, Concessionária: storeFilter, Vendedor: sellerFilter },
      columns: [
        { key: 'Data', label: 'Data', type: 'text' },
        { key: 'Concessionaria', label: 'Concessionária', type: 'text' },
        { key: 'Vendedor', label: 'Vendedor', type: 'text' },
        { key: 'Cliente', label: 'Cliente', type: 'text' },
        { key: 'Modelo', label: 'Modelo', type: 'text' },
        { key: 'Chassi', label: 'Chassi', type: 'text' },
        { key: 'Valor_Venda', label: 'Valor Venda', type: 'currency' },
        { key: 'Financiamento', label: 'Financiamento', type: 'currency' },
        { key: 'Banco', label: 'Banco', type: 'text' },
        { key: 'Pix', label: 'PIX', type: 'currency' },
        { key: 'Dinheiro', label: 'Dinheiro', type: 'currency' },
        { key: 'Cartao', label: 'Cartão', type: 'currency' },
        { key: 'Consorcio', label: 'Consórcio', type: 'currency' },
        { key: 'Origem_Lead', label: 'Origem Lead', type: 'text' },
      ],
      data: rows as any,
      userName: 'Proprietário',
    });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* =================================================================== */}
      {/* 1. CABEÇALHO EXECUTIVO MASTER                                      */}
      {/* =================================================================== */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-slate-700/50">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Ala Executiva da Diretoria • Acesso do Proprietário
            </span>
            <Badge variant="outline" className="text-slate-300 border-slate-600 font-mono text-[11px]">
              2 Concessionárias Ativas
            </Badge>
          </div>
          <h1 className="text-2xl lg:text-3xl font-display font-extrabold tracking-tight flex items-center gap-3">
            <span>Painel do Dono & Centro de Comando 360°</span>
          </h1>
          <p className="text-slate-300 text-xs lg:text-sm max-w-3xl leading-relaxed">
            Visão panorâmica e fatiamento dinâmico: divida métricas por loja, vendedor, modelo ou forma de pagamento, e
            mapeie a penetração geográfica das concessionárias de <strong className="text-white">Divinópolis</strong> e{' '}
            <strong className="text-white">Montes Claros</strong>.
          </p>
        </div>

        {/* Botões de Ação Executiva */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl gap-2 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXLSX}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/40 rounded-xl gap-2 font-medium"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Exportar XLSX</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl gap-2 font-medium"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Imprimir</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/')}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-semibold shadow-md"
          >
            <Store className="w-4 h-4" />
            <span>Voltar ao Dashboard Geral</span>
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. BARRA DE FILTROS GLOBAIS ("O que ele quiser")                   */}
      {/* =================================================================== */}
      <Card className="rounded-2xl border shadow-sm bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Filtros Dinâmicos de Comando
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{filteredSales.length} vendas filtradas</span>
              <span className="text-slate-300">•</span>
              <strong className="text-foreground">{formatCurrencyBRL(executiveMetrics.totalRevenue)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Filtro de Concessionária */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Concessionária</label>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Todas as Lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Concessionárias</SelectItem>
                  {(stores || [])
                    .filter((s) => s.is_active !== false)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Período Preset */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Período de Análise</label>
              <Select value={periodPreset} onValueChange={setPeriodPreset}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="this_month">Este Mês Atual</SelectItem>
                  <SelectItem value="last_month">Mês Anterior</SelectItem>
                  <SelectItem value="this_year">Ano de 2026</SelectItem>
                  <SelectItem value="all">Todo o Histórico</SelectItem>
                  <SelectItem value="custom">Personalizado por Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Vendedor */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Vendedor</label>
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Todos os Vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Vendedores ({availableSellers.length})</SelectItem>
                  {availableSellers.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Forma de Pagamento */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Forma de Pagamento</label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-medium">
                  <SelectValue placeholder="Todas as Formas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Formas</SelectItem>
                  <SelectItem value="financiamento">Financiamento Bancário</SelectItem>
                  <SelectItem value="pix_dinheiro">À Vista / PIX / Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                  <SelectItem value="consorcio">Consórcio / Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Busca Rápida */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Busca Livre</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cliente, chassi, modelo, cidade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Filtro Customizado de Datas (se selecionado) */}
          {periodPreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs">
              <span className="font-semibold text-muted-foreground">Intervalo personalizado:</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">De:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs w-36 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Até:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs w-36 rounded-lg"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================================================================== */}
      {/* 3. NAVEGAÇÃO ENTRE OS 4 PILARES: VER, DIVIDIR, MAPEAR, SIMULAR      */}
      {/* =================================================================== */}
      <Tabs value={activeMainTab} onValueChange={(v: any) => setActiveMainTab(v)} className="space-y-6">
        <TabsList className="bg-muted/70 p-1.5 rounded-2xl w-full grid grid-cols-4 max-w-4xl mx-auto shadow-inner">
          <TabsTrigger
            value="ver"
            className="rounded-xl text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all py-2.5"
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>1. VER (Cockpit)</span>
          </TabsTrigger>

          <TabsTrigger
            value="dividir"
            className="rounded-xl text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all py-2.5"
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>2. DIVIDIR (Fatiar)</span>
          </TabsTrigger>

          <TabsTrigger
            value="mapear"
            className="rounded-xl text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all py-2.5"
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>3. MAPEAR (Cidades & Rotas)</span>
          </TabsTrigger>

          <TabsTrigger
            value="simular"
            className="rounded-xl text-xs sm:text-sm font-bold gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all py-2.5"
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span>4. SIMULAR (Metas)</span>
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* ABA 1: VER (COCKPIT EXECUTIVO & VISÃO 360°)                       */}
        {/* ================================================================= */}
        <TabsContent value="ver" className="space-y-6 mt-0">
          {/* 4 Cards de Destaque Primário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Faturamento Total */}
            <Card className="rounded-3xl border-2 border-primary/20 shadow-md bg-gradient-to-br from-card to-primary/5 hover:border-primary/40 transition-all">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Faturamento Bruto</span>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-display font-black text-foreground tracking-tight">
                  {formatCurrencyBRL(executiveMetrics.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Consolidado no período selecionado</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Lucro Bruto Estimado & Margem */}
            <Card className="rounded-3xl border-2 border-emerald-500/20 shadow-md bg-gradient-to-br from-card to-emerald-500/5 hover:border-emerald-500/40 transition-all">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lucro Bruto Estimado</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-display font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {formatCurrencyBRL(executiveMetrics.estimatedGrossProfit)}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Margem média de contribuição:</span>
                  <Badge variant="outline" className="text-emerald-600 font-bold border-emerald-500/30">
                    {executiveMetrics.grossMarginPercent.toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Volume de Motos Faturadas */}
            <Card className="rounded-3xl border-2 border-indigo-500/20 shadow-md bg-gradient-to-br from-card to-indigo-500/5 hover:border-indigo-500/40 transition-all">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Motos Faturadas</span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <Bike className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-display font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                  {executiveMetrics.count} <span className="text-base font-medium text-muted-foreground">motos</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>Em ambas as concessionárias</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Ticket Médio por Moto */}
            <Card className="rounded-3xl border-2 border-amber-500/20 shadow-md bg-gradient-to-br from-card to-amber-500/5 hover:border-amber-500/40 transition-all">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ticket Médio</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-display font-black text-amber-600 dark:text-amber-400 tracking-tight">
                  {formatCurrencyBRL(executiveMetrics.avgTicket)}
                </div>
                <p className="text-xs text-muted-foreground">Média geral por unidade vendida</p>
              </CardContent>
            </Card>
          </div>

          {/* Comparativo de Lojas: Montes Claros vs Divinópolis */}
          <Card className="rounded-3xl border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/40 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Comparativo Executivo entre as Concessionárias
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Desempenho comparado de faturamento, volume de motos e ticket médio por unidade.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Rede Oficial L1MA Motors
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Concessionária Divinópolis */}
                <div className="p-5 rounded-2xl border-2 border-blue-500/20 bg-blue-500/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Polo Centro-Oeste
                      </span>
                      <h3 className="text-lg font-bold text-foreground">Concessionária Divinópolis</h3>
                    </div>
                    <Badge className="bg-blue-600 text-white font-bold">{executiveMetrics.divShare.toFixed(1)}% do total</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-card p-3 rounded-xl border">
                      <span className="text-[11px] text-muted-foreground font-semibold">Faturamento</span>
                      <p className="text-lg font-bold text-blue-600">{formatCurrencyBRL(executiveMetrics.divRevenue)}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border">
                      <span className="text-[11px] text-muted-foreground font-semibold">Motos Faturadas</span>
                      <p className="text-lg font-bold text-foreground">{executiveMetrics.divCount} un.</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border col-span-2">
                      <span className="text-[11px] text-muted-foreground font-semibold">Ticket Médio</span>
                      <p className="text-base font-bold text-foreground">{formatCurrencyBRL(executiveMetrics.divAvgTicket)}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Participação no faturamento do grupo</span>
                      <span className="font-bold">{executiveMetrics.divShare.toFixed(1)}%</span>
                    </div>
                    <Progress value={executiveMetrics.divShare} className="h-2 bg-blue-200 dark:bg-blue-950" />
                  </div>
                </div>

                {/* Concessionária Montes Claros */}
                <div className="p-5 rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Polo Norte de Minas
                      </span>
                      <h3 className="text-lg font-bold text-foreground">Concessionária Montes Claros</h3>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold">{executiveMetrics.mocShare.toFixed(1)}% do total</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-card p-3 rounded-xl border">
                      <span className="text-[11px] text-muted-foreground font-semibold">Faturamento</span>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrencyBRL(executiveMetrics.mocRevenue)}</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border">
                      <span className="text-[11px] text-muted-foreground font-semibold">Motos Faturadas</span>
                      <p className="text-lg font-bold text-foreground">{executiveMetrics.mocCount} un.</p>
                    </div>
                    <div className="bg-card p-3 rounded-xl border col-span-2">
                      <span className="text-[11px] text-muted-foreground font-semibold">Ticket Médio</span>
                      <p className="text-base font-bold text-foreground">{formatCurrencyBRL(executiveMetrics.mocAvgTicket)}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Participação no faturamento do grupo</span>
                      <span className="font-bold">{executiveMetrics.mocShare.toFixed(1)}%</span>
                    </div>
                    <Progress value={executiveMetrics.mocShare} className="h-2 bg-emerald-200 dark:bg-emerald-950" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Evolução Diária & Mix Financeiro */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Evolução */}
            <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Ritmo Diário de Vendas & Faturamento Acumulado
                </CardTitle>
                <CardDescription className="text-xs">
                  Acompanhe a curva de faturamento diário durante o período selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="ownerColorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrencyBRL(val), 'Faturamento']}
                        labelFormatter={(l) => `Data: ${l}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={PALETTE.primary}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#ownerColorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Mix de Pagamentos */}
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  Composição do Faturamento
                </CardTitle>
                <CardDescription className="text-xs">
                  Divisão de entrada por modalidade de pagamento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMixData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {paymentMixData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrencyBRL(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 text-xs">
                  {paymentMixData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrencyBRL(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* ABA 2: DIVIDIR (MOTOR DE FATIAMENTO E DRILL-DOWN DINÂMICO)        */}
        {/* ================================================================= */}
        <TabsContent value="dividir" className="space-y-6 mt-0">
          <Card className="rounded-3xl border shadow-md">
            <CardHeader className="bg-muted/40 border-b pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    Motor de Fatiamento Multi-Dimensional
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Escolha a dimensão e a métrica desejada para dissecar o negócio sob qualquer perspectiva.
                  </CardDescription>
                </div>

                {/* Seletores de Dimensão e Métrica */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Dividir por:</span>
                    <Select value={splitDimension} onValueChange={(v: any) => setSplitDimension(v)}>
                      <SelectTrigger className="h-9 w-44 rounded-xl text-xs font-bold bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller">👤 Vendedor (Ranking)</SelectItem>
                        <SelectItem value="store">🏬 Concessionária</SelectItem>
                        <SelectItem value="payment">💳 Forma de Pagamento</SelectItem>
                        <SelectItem value="bank">🏦 Banco / Financeira</SelectItem>
                        <SelectItem value="model">🏍️ Modelo de Moto</SelectItem>
                        <SelectItem value="channel">🎯 Origem do Lead</SelectItem>
                        <SelectItem value="weekday">📅 Dia da Semana</SelectItem>
                        <SelectItem value="price_range">💰 Faixa de Preço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Métrica:</span>
                    <Select value={splitMetric} onValueChange={(v: any) => setSplitMetric(v)}>
                      <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-bold bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Faturamento (R$)</SelectItem>
                        <SelectItem value="volume">Volume (Motos)</SelectItem>
                        <SelectItem value="ticket">Ticket Médio (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Gráfico de Barras Horizontais do Fatiamento */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">
                    Visualização Gráfica: {splitAnalysis.length} segmentos mapeados
                  </span>
                  <span>Ordenado pelo maior impacto</span>
                </div>

                <div className="h-[340px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={splitAnalysis.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          splitMetric === 'volume' ? `${v} un` : `R$ ${(v / 1000).toFixed(0)}k`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        width={120}
                      />
                      <Tooltip
                        formatter={(val: number) =>
                          splitMetric === 'volume' ? [`${val} motos`, 'Volume'] : [formatCurrencyBRL(val), 'Valor']
                        }
                      />
                      <Bar dataKey="sortValue" radius={[0, 8, 8, 0]}>
                        {splitAnalysis.slice(0, 10).map((_, index) => (
                          <Cell key={`bar-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela Analítica Completa com Drill-down */}
              <div className="rounded-2xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold">Segmento / Categoria</TableHead>
                      <TableHead className="text-center font-bold">Volume (Motos)</TableHead>
                      <TableHead className="text-right font-bold">Faturamento Total</TableHead>
                      <TableHead className="text-right font-bold">Ticket Médio</TableHead>
                      <TableHead className="text-right font-bold">Participação %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {splitAnalysis.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="font-semibold flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[250px]">{row.label}</span>
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium">{row.count} un.</TableCell>
                        <TableCell className="text-right font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrencyBRL(row.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrencyBRL(row.avgTicket)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-xs font-mono">{row.share.toFixed(1)}%</span>
                            <div className="w-16">
                              <Progress value={row.share} className="h-1.5" />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* ABA 3: MAPEAR (CIDADES, RAIO GEOGRÁFICO & ESTEIRA OPERACIONAL)     */}
        {/* ================================================================= */}
        <TabsContent value="mapear" className="space-y-6 mt-0">
          {/* Mapeamento de Cidades e Penetração Regional */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tabela de Cidades */}
            <Card className="rounded-3xl border shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-600">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Origem dos Clientes por Cidade
                </CardTitle>
                <CardDescription className="text-xs">
                  Ranking dos municípios com maior volume de compras.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {cityMappingData.slice(0, 15).map((city, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-all space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          {city.city}
                        </span>
                        <span className="font-bold font-mono text-emerald-600">{city.count} motos</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatCurrencyBRL(city.revenue)}</span>
                        <span>{city.share.toFixed(1)}% das vendas</span>
                      </div>
                      <Progress value={city.share} className="h-1 bg-emerald-100 dark:bg-emerald-950" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Mapeamento da Esteira Operacional */}
            <Card className="lg:col-span-2 rounded-3xl border shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-600">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Mapeamento da Esteira Operacional (Funil da Venda ao Pátio)
                </CardTitle>
                <CardDescription className="text-xs">
                  Fluxo de vida do pedido: onde os veículos e processos estão situados agora.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pipelineMapping.map((stg, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase tracking-wide ${stg.color}`}>{stg.label}</span>
                        <Badge variant="outline" className="font-mono font-bold">
                          {stg.count} motos
                        </Badge>
                      </div>
                      <div className="text-lg font-bold font-mono">{formatCurrencyBRL(stg.revenue)}</div>
                      <p className="text-[11px] text-muted-foreground">
                        {stg.id === 'concluida' ? 'Motos faturadas e liberadas' : 'Em trâmite documental ou oficina'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Resumo Estratégico de Pátio */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Capital Ativo em Estoque</h4>
                      <p className="text-xs text-muted-foreground">
                        {executiveMetrics.totalStockCount} motos disponíveis nos pátios de Divinópolis e Montes Claros
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-muted-foreground">Valor em Estoque:</span>
                    <p className="text-base font-bold font-mono text-foreground">
                      {formatCurrencyBRL(executiveMetrics.totalStockValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mapa Visual de Raio Geográfico Integrado */}
          <Card className="rounded-3xl border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/40 border-b pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-600" />
                Atlas Cartográfico de Vendas & Rotas de Clientes
              </CardTitle>
              <CardDescription className="text-xs">
                Visualização espacial das rotas, polos de Divinópolis e Montes Claros, e dispersão das motos vendidas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <GeographicSalesRadiusMap
                sales={filteredSales.map((s) => ({
                  id: s.id,
                  cliente: s.cliente,
                  regiao: s.regiao,
                  valor: s.valor,
                  modelo: s.modelo,
                  vendedor: s.vendedor,
                  dateStr: s.dateStr,
                  store_id: s.store_id,
                  store_name: s.store_name,
                }))}
                referenceStoreCity={storeFilter === 'montesclaros' ? 'Montes Claros' : 'Divinópolis'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* ABA 4: SIMULAR (METAS, CENÁRIOS E PROJEÇÕES DO PROPRIETÁRIO)      */}
        {/* ================================================================= */}
        <TabsContent value="simular" className="space-y-6 mt-0">
          <Card className="rounded-3xl border shadow-md">
            <CardHeader className="bg-muted/40 border-b pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Calculator className="w-5 h-5 text-amber-600" />
                Simulador Executivo de Metas & Rentabilidade
              </CardTitle>
              <CardDescription className="text-xs">
                Ajuste os parâmetros abaixo para projetar o faturamento, volume de financiamentos bancários e retorno
                estimado do grupo.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Sliders / Controles da Simulação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4 rounded-2xl bg-muted/20 border">
                {/* Meta de Unidades */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Meta de Motos / Mês:</span>
                    <strong className="text-primary font-mono text-sm">{simTargetUnits} un.</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={simTargetUnits}
                    onChange={(e) => setSimTargetUnits(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>10</span>
                    <span>100</span>
                    <span>200</span>
                  </div>
                </div>

                {/* Ticket Médio Desejado */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Ticket Médio por Moto:</span>
                    <strong className="text-emerald-600 font-mono text-sm">{formatCurrencyBRL(simAvgTicket)}</strong>
                  </div>
                  <input
                    type="range"
                    min="9000"
                    max="30000"
                    step="500"
                    value={simAvgTicket}
                    onChange={(e) => setSimAvgTicket(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>R$ 9k</span>
                    <span>R$ 18k</span>
                    <span>R$ 30k</span>
                  </div>
                </div>

                {/* % de Financiamento */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Mix Financiamento Bancário:</span>
                    <strong className="text-indigo-600 font-mono text-sm">{simFinancingRatio}%</strong>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="95"
                    step="5"
                    value={simFinancingRatio}
                    onChange={(e) => setSimFinancingRatio(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>20%</span>
                    <span>60%</span>
                    <span>95%</span>
                  </div>
                </div>

                {/* Margem Bruta Estimada */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Margem Bruta Média:</span>
                    <strong className="text-amber-600 font-mono text-sm">{simMarginPercent}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="35"
                    step="1"
                    value={simMarginPercent}
                    onChange={(e) => setSimMarginPercent(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>10%</span>
                    <span>20%</span>
                    <span>35%</span>
                  </div>
                </div>
              </div>

              {/* Resultados da Projeção */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-2xl border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-5 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Faturamento Projetado</span>
                    <div className="text-2xl font-black font-display text-foreground">
                      {formatCurrencyBRL(simulationResults.projectedRevenue)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Motos faturadas:</span>
                      <strong className="font-mono">{simTargetUnits} un.</strong>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-5 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Lucro Bruto Projetado</span>
                    <div className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyBRL(simulationResults.projectedGrossProfit)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Margem configurada:</span>
                      <strong className="font-mono">{simMarginPercent}%</strong>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-2 border-indigo-500/20 bg-indigo-500/5">
                  <CardContent className="p-5 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Retorno Extra F&I Bancos</span>
                    <div className="text-2xl font-black font-display text-indigo-600 dark:text-indigo-400">
                      {formatCurrencyBRL(simulationResults.projectedFinancingReturn)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Motos em financiamento:</span>
                      <strong className="font-mono">{simulationResults.projectedFinancingUnits} un.</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Resumo Consolidado do Cenário */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Resultado Consolidado da Simulação
                    </h4>
                    <p className="text-xs text-slate-300">
                      Lucro bruto da venda de motos + bonificação estimada de retorno bancário (F&I).
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Lucro Operacional Projetado:</span>
                    <div className="text-2xl font-black font-mono text-emerald-400">
                      {formatCurrencyBRL(simulationResults.totalProjectedNet)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
