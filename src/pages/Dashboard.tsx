import { useState, useMemo } from 'react';
import {
  Store,
  Users,
  DollarSign,
  Calendar,
  Clock,
  TrendingUp,
  Bike,
  PieChart as PieChartIcon,
  Package,
  Landmark,
  Award,
  RefreshCw,
  Download,
  Activity,
  Flame,
  FileSpreadsheet,
  Navigation,
  Globe2,
  Radar,
  Workflow,
  Compass,
  CheckCircle2,
  BadgePercent,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  HelpCircle,
  Building2,
  Car,
  Truck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassView } from '@/components/ui/GlassView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPie,
  Pie,
  Cell,
  AreaChart,
  Area,
  Line,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { useVehicles, useVehicleStats } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useContracts } from '@/hooks/useContracts';
import { useResellers } from '@/hooks/useResellers';
import { useEmployees } from '@/hooks/useEmployees';
import { resolveSaleStore, OFFICIAL_STORES } from '@/lib/storeResolution';
import { exportToXLSX } from '@/lib/export';
import {
  SheetRowV9,
  getLiveSheetRows,
  formatCurrencyBRL,
} from '@/lib/dealershipSheetParser';
import { GeographicSalesRadiusMap } from '@/components/dashboard/GeographicSalesRadiusMap';
import { DealershipProcessFlow } from '@/components/dashboard/DealershipProcessFlow';
import { MonthlyCitySalesMap } from '@/components/dashboard/MonthlyCitySalesMap';
import { MarketingLeadRadiusMap } from '@/components/dashboard/MarketingLeadRadiusMap';
import { LogisticsDeliveriesWidget } from '@/components/dashboard/modular/LogisticsDeliveriesWidget';
import { TRANSPORT_LOGISTICS_METHODS } from '@/lib/transportLogistics';
import { TabTransition } from '@/components/ui/TabTransition';
import { DashboardCustomizerModal } from '@/components/dashboard/modular/DashboardCustomizerModal';
import { ModularBlockWrapper } from '@/components/dashboard/modular/ModularBlockWrapper';
import { DASHBOARD_PRESETS } from '@/components/dashboard/modular/widgetRegistry';
import { DashboardBlockConfig, WidgetColSpan } from '@/components/dashboard/modular/types';
import { SlidersHorizontal, LayoutGrid, Plus } from 'lucide-react';

const PALETTE = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  destructive: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  amber: '#d97706',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, canCreateSales } = useAuth();

  // Filtros Globais (Período Unificado com Todas as Abas)
  const {
    periodFilter,
    setPeriodFilter,
    isDateInPeriod,
    availablePeriods: globalAvailablePeriods,
  } = useDateFilter();
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'all' | 'moto' | 'carro'>('all');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sistema de Dashboard Modular & Personalizável
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [modularBlocks, setModularBlocks] = useState<DashboardBlockConfig[]>(() => {
    try {
      const saved = localStorage.getItem('dealflow_dashboard_modular_blocks_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar layout modular:', e);
    }
    return DASHBOARD_PRESETS[0].blocks;
  });

  const handleSaveBlocks = (newBlocks: DashboardBlockConfig[]) => {
    setModularBlocks(newBlocks);
    localStorage.setItem('dealflow_dashboard_modular_blocks_v1', JSON.stringify(newBlocks));
  };

  const handleResetBlocks = () => {
    const defaultBlocks = DASHBOARD_PRESETS[0].blocks;
    setModularBlocks(defaultBlocks);
    localStorage.removeItem('dealflow_dashboard_modular_blocks_v1');
  };

  const handleChangeBlockWidget = (index: number, newWidgetId: string) => {
    const updated = [...modularBlocks];
    updated[index] = { ...updated[index], widgetId: newWidgetId };
    handleSaveBlocks(updated);
  };

  const handleChangeBlockColSpan = (index: number, newColSpan: WidgetColSpan) => {
    const updated = [...modularBlocks];
    updated[index] = { ...updated[index], colSpan: newColSpan };
    handleSaveBlocks(updated);
  };

  const handleRemoveBlock = (index: number) => {
    const updated = modularBlocks.filter((_, idx) => idx !== index);
    updated.forEach((b, idx) => {
      b.order = idx + 1;
    });
    handleSaveBlocks(updated);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modularBlocks.length) return;
    const updated = [...modularBlocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updated.forEach((b, idx) => {
      b.order = idx + 1;
    });
    handleSaveBlocks(updated);
  };

  const handleAddBlockQuick = () => {
    const newBlock: DashboardBlockConfig = {
      id: `block-${Date.now()}`,
      widgetId: 'logistics_deliveries',
      colSpan: 'half',
      visible: true,
      order: modularBlocks.length + 1,
    };
    handleSaveBlocks([...modularBlocks, newBlock]);
  };

  // Consultas Oficiais do Supabase / LocalFallback
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: stores = [] } = useStores();
  const { data: contracts = [], isLoading: loadingContracts } = useContracts();
  const { data: employees = [] } = useEmployees();

  // Dados das Vendas Mensais (Planilha v9.0 Oficial com Divinópolis e Montes Claros)
  const monthlySheetRows: SheetRowV9[] = useMemo(() => {
    return getLiveSheetRows();
  }, [isRefreshing]);

  // =========================================================================
  // CONSOLIDAÇÃO E DEDUPLICAÇÃO VERÍDICA (100% AUDITADO E SEM DUPLICATAS)
  // =========================================================================
  const consolidatedSales = useMemo(() => {
    const salesMap = new Map<string, any>();

    // Helper para gerar chave única imutável para cada venda real
    const makeDedupeKey = (item: {
      id?: string;
      chassi?: string;
      cliente?: string;
      dateStr?: string;
      valor?: number;
      modelo?: string;
    }) => {
      const cleanChassis = (item.chassi || '').trim().toUpperCase();
      if (cleanChassis && cleanChassis.length >= 6) {
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
      return `sale:${cleanClient}:${cleanVal}:${cleanModel}`;
    };

    // 1. Processa vendas da Planilha v9.0 da Concessionária
    monthlySheetRows.forEach((r) => {
      const parts = r.data.split('/');
      let dateObj = new Date();
      if (parts.length === 3) {
        dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
      }

      // Resolução contábil e geográfica rigorosa da loja faturadora
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

      const saleItem = {
        id: r.id,
        source: 'sheet' as const,
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
        vehicle_type: 'moto' as const,
      };

      const key = makeDedupeKey(saleItem);
      salesMap.set(key, saleItem);
    });

    // 2. Processa contratos digitados/gerados na plataforma (evitando duplicatas com a planilha)
    (contracts || []).forEach((c) => {
      // Ignora contratos sintetizados internamente pelo hook a partir da própria planilha
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

      const contractItem = {
        id: c.id,
        contract_number: c.contract_number,
        source: 'contract' as const,
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
        vehicle_type: (c.vehicle?.vehicle_type === 'carro' ? 'carro' : 'moto') as 'carro' | 'moto',
      };

      const key = makeDedupeKey(contractItem);
      if (salesMap.has(key)) {
        // Já existe na planilha: mescla dados enriquecidos mantendo venda única
        const existing = salesMap.get(key);
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

    return Array.from(salesMap.values());
  }, [monthlySheetRows, contracts, employees]);

  // =========================================================================
  // CATÁLOGO E FILTRAGEM INTELIGENTE DE VENDEDORES (NUNCA DESAPARECEM DOS FILTROS)
  // =========================================================================
  const allSellersList = useMemo(() => {
    const list: Array<{ name: string; storeId: string; storeLabel: string }> = [];
    const seen = new Set<string>();

    // 1. Dos colaboradores cadastrados no banco de dados (employees)
    (employees || []).forEach((emp) => {
      const role = (emp.role || '').toLowerCase();
      const isComercial =
        role.includes('vendedor') ||
        role.includes('comercial') ||
        role.includes('plus') ||
        role.includes('externo');
      if (isComercial && emp.full_name) {
        const name = emp.full_name.trim();
        const sId = emp.store_id || 'store-divinopolis';
        const sLabel = sId === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis';
        const key = `${name.toLowerCase()}::${sId}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ name, storeId: sId, storeLabel: sLabel });
        }
      }
    });

    // 2. Das vendas consolidadas reais (vinculando vendedor à respectiva loja)
    consolidatedSales.forEach((s) => {
      if (s.vendedor) {
        const name = s.vendedor.trim();
        const sId = s.store_id || 'store-divinopolis';
        const sLabel = sId === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis';
        const key = `${name.toLowerCase()}::${sId}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ name, storeId: sId, storeLabel: sLabel });
        }
      }
    });

    return list;
  }, [employees, consolidatedSales]);

  // Vendedores disponíveis respeitando o contexto da concessionária selecionada
  const availableSellers = useMemo(() => {
    if (storeFilter === 'all') {
      const uniqueByName = new Map<string, { name: string; storeLabel: string }>();
      allSellersList.forEach((s) => {
        if (!uniqueByName.has(s.name.toLowerCase())) {
          uniqueByName.set(s.name.toLowerCase(), { name: s.name, storeLabel: s.storeLabel });
        }
      });
      return Array.from(uniqueByName.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    return allSellersList
      .filter((s) => s.storeId === storeFilter)
      .map((s) => ({ name: s.name, storeLabel: s.storeLabel }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSellersList, storeFilter]);

  const handleStoreFilterChange = (newStore: string) => {
    setStoreFilter(newStore);
    if (newStore !== 'all' && sellerFilter !== 'all') {
      const sellerStillInStore = allSellersList.some(
        (s) =>
          s.name.toLowerCase() === sellerFilter.trim().toLowerCase() &&
          (s.storeId === newStore || newStore === 'all')
      );
      if (!sellerStillInStore) {
        setSellerFilter('all');
      }
    }
  };

  // =========================================================================
  // PERIODOS / COMPETÊNCIAS DETECTADAS DINAMICAMENTE DOS DADOS REAIS
  // =========================================================================
  const availablePeriods = useMemo(() => {
    const monthsMap = new Map<string, { key: string; label: string; count: number }>();
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    consolidatedSales.forEach((s) => {
      if (s.date && !isNaN(s.date.getTime())) {
        const y = s.date.getFullYear();
        const m = s.date.getMonth();
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
  }, [consolidatedSales]);

  // =========================================================================
  // VENDAS FILTRADAS RIGOROSAMENTE PELOS PARÂMETROS GLOBAIS
  // =========================================================================
  const filteredSales = useMemo(() => {
    const now = new Date();

    return consolidatedSales.filter((s) => {
      // 1. Filtro de Período e Competência Contábil Rigoroso (Unificado)
      if (!isDateInPeriod(s.date)) return false;

      // 2. Filtro rigoroso de loja
      if (storeFilter !== 'all') {
        const matchesVirtualId = s.store_id === storeFilter;
        const matchesRawId = s.raw_store_id === storeFilter;
        if (!matchesVirtualId && !matchesRawId) return false;
      }

      // 3. Filtro de vendedor
      if (sellerFilter !== 'all') {
        const saleSeller = (s.vendedor || '').trim().toLowerCase();
        const targetSeller = sellerFilter.trim().toLowerCase();
        if (
          saleSeller !== targetSeller &&
          !saleSeller.includes(targetSeller) &&
          !targetSeller.includes(saleSeller)
        ) {
          return false;
        }
      }

      // 4. Filtro de tipo de veículo
      if (vehicleTypeFilter !== 'all' && s.vehicle_type !== vehicleTypeFilter) return false;

      return true;
    });
  }, [consolidatedSales, isDateInPeriod, storeFilter, sellerFilter, vehicleTypeFilter]);

  // Contratos Filtrados pelo Contexto de Loja e Vendedor
  const filteredContracts = useMemo(() => {
    return (contracts || []).filter((c) => {
      if (storeFilter !== 'all') {
        const resolved = resolveSaleStore(
          {
            store_id: c.store_id,
            store: c.store,
            vendedor: c.operator?.full_name,
            observacoes: c.notes,
            cliente: c.buyer_name,
          },
          employees
        );
        if (resolved.storeId !== storeFilter) return false;
      }
      if (sellerFilter !== 'all') {
        const seller = (
          (c as any).seller_name ||
          c.operator?.full_name ||
          (c as any).created_by ||
          ''
        )
          .trim()
          .toLowerCase();
        const target = sellerFilter.trim().toLowerCase();
        if (seller !== target && !seller.includes(target) && !target.includes(seller)) return false;
      }
      return true;
    });
  }, [contracts, storeFilter, sellerFilter, employees]);

  // =========================================================================
  // MÉTRICAS E KPIS EXECUTIVOS 100% REAIS (SEM NENHUM NÚMERO FICTÍCIO)
  // =========================================================================
  const metrics = useMemo(() => {
    let faturamentoTotal = 0;
    let totalFinanciado = 0;
    let totalAVista = 0;
    let faturamentoFaturado = 0;
    let vendasFaturadas = 0;
    let preVendasPendentes = 0;

    filteredSales.forEach((s) => {
      faturamentoTotal += s.valor;
      totalFinanciado += s.financiamento;
      const aVista = s.dinheiro + s.pix + s.cartao + s.carta_credito + s.boleto;
      totalAVista += aVista;

      if (s.is_permitted) {
        vendasFaturadas++;
        faturamentoFaturado += s.valor;
      } else {
        preVendasPendentes++;
      }
    });

    const totalVendas = filteredSales.length;
    const ticketMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;
    const percentualFinanciado =
      faturamentoTotal > 0 ? (totalFinanciado / faturamentoTotal) * 100 : 0;
    const percentualAVista = faturamentoTotal > 0 ? (totalAVista / faturamentoTotal) * 100 : 0;

    // Metas Comerciais Oficiais de Acordo com o Contexto Selecionado
    let metaFaturamento = 530000; // Global (Ambas lojas)
    let metaMotos = 30;

    if (storeFilter === 'store-divinopolis') {
      metaFaturamento = 350000;
      metaMotos = 20;
    } else if (storeFilter === 'store-montesclaros') {
      metaFaturamento = 180000;
      metaMotos = 10;
    }

    if (sellerFilter !== 'all') {
      metaFaturamento = 140000;
      metaMotos = 8;
    }

    const progressoMetaValor = Math.min(
      Math.round((faturamentoTotal / metaFaturamento) * 100),
      100
    );
    const progressoMetaMotos = Math.min(Math.round((totalVendas / metaMotos) * 100), 100);

    return {
      faturamentoTotal,
      totalFinanciado,
      totalAVista,
      faturamentoFaturado,
      vendasFaturadas,
      preVendasPendentes,
      totalVendas,
      ticketMedio,
      percentualFinanciado,
      percentualAVista,
      metaFaturamento,
      metaMotos,
      progressoMetaValor,
      progressoMetaMotos,
    };
  }, [filteredSales, storeFilter, sellerFilter]);

  // 1. Dados para o Gráfico de Evolução Diária e Ritmo
  const timelineChartData = useMemo(() => {
    const map = new Map<
      string,
      { data: string; faturamento: number; motos: number; acumulado: number }
    >();

    const sorted = [...filteredSales].sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningTotal = 0;
    sorted.forEach((s) => {
      const key = s.dateStr;
      const existing = map.get(key) || { data: key, faturamento: 0, motos: 0, acumulado: 0 };
      existing.faturamento += s.valor;
      existing.motos += 1;
      runningTotal += s.valor;
      existing.acumulado = runningTotal;
      map.set(key, existing);
    });

    return Array.from(map.values());
  }, [filteredSales]);

  // Modelo Mais Vendido Real
  const topModel = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    filteredSales.forEach((s) => {
      const m = s.modelo || 'Outros';
      if (!counts[m]) counts[m] = { count: 0, total: 0 };
      counts[m].count += 1;
      counts[m].total += s.valor;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
    return sorted[0]
      ? { name: sorted[0][0], count: sorted[0][1].count, total: sorted[0][1].total }
      : null;
  }, [filteredSales]);

  // Lista Ordenada de Modelos de Veículos Mais Vendidos
  const topModelsList = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    filteredSales.forEach((s) => {
      const m = s.modelo || 'Outros';
      if (!counts[m]) counts[m] = { count: 0, total: 0 };
      counts[m].count += 1;
      counts[m].total += s.valor;
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSales]);

  // 2. Composição de Meios de Pagamento (Donut Chart)
  const paymentDistributionData = useMemo(() => {
    let fin = 0;
    let pix = 0;
    let din = 0;
    let card = 0;
    let carta = 0;

    filteredSales.forEach((s) => {
      fin += s.financiamento;
      pix += s.pix;
      din += s.dinheiro;
      card += s.cartao;
      carta += s.carta_credito;
    });

    return [
      { name: 'Financiamento Bancário', value: fin, color: PALETTE.primary },
      { name: 'PIX Direto', value: pix, color: PALETTE.success },
      { name: 'Dinheiro Espécie', value: din, color: PALETTE.cyan },
      { name: 'Cartão Débito/Crédito', value: card, color: PALETTE.warning },
      { name: 'Carta de Crédito / Consórcio', value: carta, color: PALETTE.purple },
    ].filter((d) => d.value > 0);
  }, [filteredSales]);

  // 3. Funil Comercial & Pipeline de Conversão 100% Autêntico
  const funnelData = useMemo(() => {
    const faturadas = metrics.vendasFaturadas;
    const preVendas = metrics.preVendasPendentes;

    const totalReservasEstoque = vehicles.filter((v) => {
      if (v.status === 'vendido') return false;
      if (storeFilter !== 'all' && v.store_id !== storeFilter) return false;
      return (v.status as string) === 'reservado' || (v.status as string) === 'pre_venda';
    }).length;

    const totalNegociacoes = filteredSales.length + totalReservasEstoque;

    return [
      {
        stage: '1. Oportunidades & Atendimentos Registrados',
        count: totalNegociacoes,
        pct: 100,
        sub: 'Vendas registradas e veículos em atendimento no pátio',
        color: '#6366f1',
      },
      {
        stage: '2. Em Análise F&I e Fichas Bancárias',
        count: preVendas + totalReservasEstoque,
        pct:
          totalNegociacoes > 0
            ? Math.round(((preVendas + totalReservasEstoque) / totalNegociacoes) * 100)
            : 0,
        sub: 'Propostas com crédito em esteira bancária ou reservas',
        color: '#0ea5e9',
      },
      {
        stage: '3. Pré-Vendas Aprovadas (Aguardando Liberação)',
        count: preVendas,
        pct: totalNegociacoes > 0 ? Math.round((preVendas / totalNegociacoes) * 100) : 0,
        sub: 'Aprovadas aguardando faturamento / emissão de NF',
        color: '#f59e0b',
      },
      {
        stage: '4. Vendas Faturadas & Entregues',
        count: faturadas,
        pct: totalNegociacoes > 0 ? Math.round((faturadas / totalNegociacoes) * 100) : 0,
        sub: 'Veículos 100% liquidados e entregues aos compradores',
        color: '#10b981',
      },
    ];
  }, [metrics, vehicles, filteredSales, storeFilter]);

  // 4. Inteligência por Banco Financiador
  const bankAnalytics = useMemo(() => {
    const stats: Record<string, { count: number; volumeFinanciado: number; volumeTotal: number }> =
      {};

    filteredSales.forEach((s) => {
      const b = s.banco?.toUpperCase().trim() || 'À VISTA';
      if (!stats[b]) stats[b] = { count: 0, volumeFinanciado: 0, volumeTotal: 0 };
      stats[b].count += 1;
      stats[b].volumeFinanciado += s.financiamento || 0;
      stats[b].volumeTotal += s.valor || 0;
    });

    return Object.entries(stats)
      .map(([banco, data]) => ({
        banco,
        ...data,
        ticketMedio: data.count > 0 ? data.volumeFinanciado / data.count : 0,
      }))
      .sort((a, b) => b.volumeFinanciado - a.volumeFinanciado);
  }, [filteredSales]);

  // 5. Ranking & Placar de Vendedores
  const sellerRankings = useMemo(() => {
    const stats: Record<
      string,
      { count: number; faturamento: number; financiamento: number; aVista: number }
    > = {};

    filteredSales.forEach((s) => {
      const v = s.vendedor || 'Outros';
      if (!stats[v]) stats[v] = { count: 0, faturamento: 0, financiamento: 0, aVista: 0 };
      stats[v].count += 1;
      stats[v].faturamento += s.valor || 0;
      stats[v].financiamento += s.financiamento || 0;
      stats[v].aVista += (s.dinheiro + s.pix + s.cartao + s.carta_credito + s.boleto) || 0;
    });

    const targetPerSeller = storeFilter === 'store-montesclaros' ? 6 : 8;

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        ...data,
        ticketMedio: data.count > 0 ? data.faturamento / data.count : 0,
        metaIndividualPct: Math.min(Math.round((data.count / targetPerSeller) * 100), 100),
      }))
      .sort((a, b) => b.count - a.count || b.faturamento - a.faturamento);
  }, [filteredSales, storeFilter]);

  // 6. Saúde e Estoque do Pátio (Filtrado estritamente pela Loja e Tipo)
  const stockAnalytics = useMemo(() => {
    const activeVehicles = (vehicles || []).filter((v) => {
      if (v.status === 'vendido') return false;
      if (storeFilter !== 'all' && v.store_id !== storeFilter) return false;
      if (vehicleTypeFilter !== 'all' && v.vehicle_type !== vehicleTypeFilter) return false;
      return true;
    });

    const motos = activeVehicles.filter((v) => v.vehicle_type === 'moto');
    const carros = activeVehicles.filter((v) => v.vehicle_type !== 'moto');
    const disponiveis = activeVehicles.filter((v) => v.status === 'disponivel');
    const reservados = activeVehicles.filter(
      (v) => (v.status as string) === 'reservado' || (v.status as string) === 'pre_venda'
    );

    const valorEstoque = activeVehicles.reduce(
      (acc, v) => acc + (Number(v.sale_price) || 0),
      0
    );
    const custoEstoque = activeVehicles.reduce(
      (acc, v) => acc + (Number(v.purchase_price) || 0),
      0
    );

    return {
      total: activeVehicles.length,
      motosCount: motos.length,
      carrosCount: carros.length,
      disponiveisCount: disponiveis.length,
      reservadosCount: reservados.length,
      valorEstoque,
      custoEstoque,
    };
  }, [vehicles, storeFilter, vehicleTypeFilter]);

  // Dados consolidados injetados nos blocos modulares dinâmicos
  const sharedWidgetData = useMemo(() => {
    return {
      metrics,
      timelineChartData,
      paymentDistributionData,
      sellerRankings,
      stockAnalytics,
      banksAnalytics: bankAnalytics,
      topModels: topModelsList,
      filteredSales,
      filteredContracts,
      baseCity: storeFilter === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis',
      storeFilter,
    };
  }, [
    metrics,
    timelineChartData,
    paymentDistributionData,
    sellerRankings,
    stockAnalytics,
    bankAnalytics,
    topModelsList,
    filteredSales,
    filteredContracts,
    storeFilter,
  ]);

  // Simular Recarregamento / Sincronização
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Exportar Relatório Executivo
  const handleExportDashboard = () => {
    const data = filteredSales.map((s) => ({
      Data: s.dateStr,
      Concessionária: s.store_name,
      Vendedor: s.vendedor,
      Cliente: s.cliente,
      Modelo: s.modelo,
      Região: s.regiao,
      Valor: s.valor,
      Financiamento: s.financiamento,
      Banco: s.banco,
      'Entradas à Vista': s.dinheiro + s.pix + s.cartao + s.carta_credito,
      Status: s.is_permitted ? 'Faturada' : 'Pré-Venda',
    }));

    exportToXLSX({
      title: 'Relatório Executivo DealFlow',
      module: 'sales',
      filters: { Período: periodFilter, Concessionária: storeFilter, Vendedor: sellerFilter },
      columns: [
        { key: 'Data', label: 'Data', type: 'text' },
        { key: 'Concessionária', label: 'Concessionária', type: 'text' },
        { key: 'Vendedor', label: 'Vendedor', type: 'text' },
        { key: 'Cliente', label: 'Cliente', type: 'text' },
        { key: 'Modelo', label: 'Modelo', type: 'text' },
        { key: 'Região', label: 'Região', type: 'text' },
        { key: 'Valor', label: 'Valor', type: 'currency' },
        { key: 'Financiamento', label: 'Financiamento', type: 'currency' },
        { key: 'Banco', label: 'Banco', type: 'text' },
        { key: 'Entradas à Vista', label: 'Entradas à Vista', type: 'currency' },
        { key: 'Status', label: 'Status', type: 'text' },
      ],
      data,
      userName: profile?.full_name || 'Gestor',
    });
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-12 animate-fade-in overflow-hidden">
      {/* ======================================================== */}
      {/* 1. CABEÇALHO EXECUTIVO COM FILTROS AVANÇADOS             */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-4 border-b border-border/40 pb-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground flex items-center gap-2 font-display truncate">
                <Compass className="w-6 h-6 sm:w-7 sm:h-7 text-primary shrink-0" />
                <span className="truncate">Cockpit Executivo Comercial</span>
              </h1>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5 inline-block" />
                Dealership v9.0
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Gestão executiva de <strong className="text-foreground">Divinópolis (Matriz Oeste)</strong> e{' '}
              <strong className="text-foreground">Montes Claros (Polo Norte)</strong> com rastreabilidade total de contratos, F&I e estoque.
            </p>
          </div>
        </div>

        {/* BARRA DE FILTROS INTEGRADOS (Responsiva com flex wrap que não ultrapassa a tela) */}
        <GlassView
          glassEffectStyle="regular"
          className="flex flex-wrap items-center gap-2 p-2 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm w-full min-w-0"
        >
          {/* Seletor de Concessionária */}
          <Select value={storeFilter} onValueChange={handleStoreFilterChange}>
            <SelectTrigger className="w-full sm:w-[210px] h-9 text-xs btn-glass font-semibold rounded-xl border truncate">
              <Store className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue placeholder="Concessionária" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Concessionárias (MG)</SelectItem>
              <SelectItem value="store-divinopolis">
                Concessionária Divinópolis (Matriz Oeste)
              </SelectItem>
              <SelectItem value="store-montesclaros">
                Concessionária Montes Claros (Polo Norte)
              </SelectItem>
              {stores
                .filter((s) => s.id !== 'store-montesclaros' && s.id !== 'store-divinopolis')
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Período / Competência */}
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[185px] h-9 text-xs btn-glass font-semibold rounded-xl border truncate">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo Histórico ({consolidatedSales.length} vendas)</SelectItem>
              {availablePeriods.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label} ({p.count} {p.count === 1 ? 'venda' : 'vendas'})
                </SelectItem>
              ))}
              <SelectItem value="month">Este Mês (Atual)</SelectItem>
              <SelectItem value="year-2026">Ano de 2026 Completo</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="90d">Último Trimestre</SelectItem>
            </SelectContent>
          </Select>

          {/* Vendedor (Organizado e Filtrado pela Concessionária) */}
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-full sm:w-[165px] h-9 text-xs btn-glass font-semibold rounded-xl border truncate">
              <Users className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {storeFilter === 'all' ? 'Toda a Equipe Comercial' : 'Equipe da Concessionária'}
              </SelectItem>
              {availableSellers.map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  {v.name} {storeFilter === 'all' ? `(${v.storeLabel})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tipo de Veículo */}
          <Select value={vehicleTypeFilter} onValueChange={(v: any) => setVehicleTypeFilter(v)}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs btn-glass font-semibold rounded-xl border">
              <Bike className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Motos & Carros</SelectItem>
              <SelectItem value="moto">Apenas Motos</SelectItem>
              <SelectItem value="carro">Apenas Carros</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 ml-auto sm:ml-auto">
            {/* Botão Sincronizar */}
            <Button
              size="sm"
              variant="glass"
              onClick={handleRefresh}
              className="h-9 px-2.5 text-xs rounded-xl font-bold"
              title="Sincronizar Métricas"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </Button>

            {/* Botão Exportar Relatório */}
            <Button
              size="sm"
              variant="glass"
              onClick={handleExportDashboard}
              className="h-9 px-3 text-xs gap-1.5 rounded-xl font-bold hover:bg-primary/5 hover:border-primary/40"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>

            {/* Atalho Planilha Oficial */}
            {canCreateSales && (
              <Button
                size="sm"
                onClick={() => navigate('/spreadsheets')}
                className="h-9 px-3 text-xs gap-1.5 font-bold bg-primary text-white shadow-sm shadow-primary/20 rounded-xl"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                <span className="hidden xs:inline">Planilha v9.0</span>
              </Button>
            )}
          </div>
        </GlassView>
      </div>

      {/* ======================================================== */}
      {/* 2. KPIS EXECUTIVOS COM DADOS REAIS & AUDITADOS           */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Total */}
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Faturamento Consolidado
            </span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-black font-display text-foreground tracking-tight">
              {formatCurrencyBRL(metrics.faturamentoTotal)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold mt-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span>
                {metrics.totalVendas} vendas faturadas/ativas no período
              </span>
            </div>
          </div>

          {/* Barra de Meta Comercial */}
          <div className="mt-4 pt-3 border-t border-border/40 space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Meta da Unidade ({formatCurrencyBRL(metrics.metaFaturamento)})</span>
              <span className="font-bold text-foreground">{metrics.progressoMetaValor}%</span>
            </div>
            <Progress value={metrics.progressoMetaValor} className="h-1.5 bg-muted/60" />
          </div>
        </GlassView>

        {/* Card 2: Volume de Vendas & Faturadas */}
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Volume de Vendas
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Bike className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-black font-display text-foreground tracking-tight flex items-baseline gap-2">
              <span>{metrics.totalVendas} {metrics.totalVendas === 1 ? 'veículo' : 'veículos'}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                ({metrics.vendasFaturadas} liberados)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{metrics.preVendasPendentes} em fase de análise pré-venda</span>
            </div>
          </div>

          {/* Barra de Meta de Unidades */}
          <div className="mt-4 pt-3 border-t border-border/40 space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Meta ({metrics.metaMotos} Unidades)</span>
              <span className="font-bold text-foreground">{metrics.progressoMetaMotos}%</span>
            </div>
            <Progress value={metrics.progressoMetaMotos} className="h-1.5 bg-muted/60" />
          </div>
        </GlassView>

        {/* Card 3: Ticket Médio por Veículo */}
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Ticket Médio Efetivo
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <BadgePercent className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-black font-display text-foreground tracking-tight">
              {formatCurrencyBRL(metrics.ticketMedio)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mt-1">
              <span>Média real por unidade negociada</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Mais vendido:</span>
            <strong className="text-foreground font-black truncate max-w-[170px]" title={topModel?.name}>
              {topModel ? `${topModel.name} (${topModel.count} un)` : 'Sem vendas'}
            </strong>
          </div>
        </GlassView>

        {/* Card 4: Financiamentos vs Entradas à Vista */}
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Mix de Liquidação
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
              <Landmark className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-black font-display text-primary tracking-tight">
              {formatCurrencyBRL(metrics.totalFinanciado)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Financiado Bancário ({metrics.percentualFinanciado.toFixed(0)}% do volume total)
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Entradas no Caixa:</span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-black">
              {formatCurrencyBRL(metrics.totalAVista)}
            </strong>
          </div>
        </GlassView>
      </div>

      {/* ======================================================== */}
      {/* 3. NAVEGAÇÃO EXECUTIVA SIMPLIFICADA                      */}
      {/* ======================================================== */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 w-full min-w-0">
        <GlassView
          glassEffectStyle="clear"
          className="p-1 rounded-2xl border border-white/20 dark:border-white/10 shadow-xs max-w-full overflow-hidden"
        >
          <TabsList className="bg-transparent border-none flex items-center gap-2 p-1 w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
            <TabsTrigger
              value="overview"
              className="h-9 px-4 text-xs font-bold gap-2 rounded-xl shrink-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white shadow-xs transition-all"
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Visão Geral Executiva</span>
            </TabsTrigger>
            <TabsTrigger
              value="flow"
              className="h-9 px-4 text-xs font-bold gap-2 rounded-xl shrink-0 whitespace-nowrap text-sky-600 dark:text-sky-400 data-[state=active]:bg-sky-600 data-[state=active]:text-white shadow-xs transition-all"
            >
              <Workflow className="w-4 h-4 shrink-0" />
              <span>Fluxo Operacional (6 Etapas)</span>
            </TabsTrigger>
            <TabsTrigger
              value="geo"
              className="h-9 px-4 text-xs font-bold gap-2 rounded-xl shrink-0 whitespace-nowrap text-emerald-600 dark:text-emerald-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white shadow-xs transition-all"
            >
              <Globe2 className="w-4 h-4 shrink-0" />
              <span>Atlas de Entregas & Raio Geográfico</span>
            </TabsTrigger>
            <TabsTrigger
              value="logistics"
              className="h-9 px-4 text-xs font-bold gap-2 rounded-xl shrink-0 whitespace-nowrap text-sky-600 dark:text-sky-400 data-[state=active]:bg-sky-600 data-[state=active]:text-white shadow-xs transition-all"
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Logística & Despacho</span>
            </TabsTrigger>
          </TabsList>
        </GlassView>

        {/* -------------------------------------------------------- */}
        {/* ABA 1: VISÃO GERAL EXECUTIVA UNIFICADA                   */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          {/* Seção 1: Ritmo de Vendas Diário + Mix de Pagamentos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gráfico 1: Curva de Faturamento Acumulado & Ritmo Diário */}
            <Card className="lg:col-span-2 rounded-3xl border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Evolução Diária & Ritmo de Vendas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Faturamento diário e linha de crescimento acumulado no período.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs font-bold">
                    {timelineChartData.length} datas registradas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineChartData}>
                      <defs>
                        <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
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
                        dataKey="faturamento"
                        stroke={PALETTE.primary}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorFaturamento)"
                        name="Faturamento Diário"
                      />
                      <Line
                        type="monotone"
                        dataKey="motos"
                        stroke={PALETTE.warning}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Veículos Vendidos"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico 2: Composição de Pagamentos (Donut Chart) */}
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-500" />
                  Mix de Pagamentos
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribuição dos canais de liquidação financeira.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={paymentDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrencyBRL(v), 'Volume']} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t text-[11px]">
                  {paymentDistributionData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção 2: Destaques Comerciais em Cards Reais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Liderança de Vendas</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {sellerRankings[0] ? (
                    <>
                      <strong className="text-foreground">{sellerRankings[0].name}</strong> lidera o placar com{' '}
                      {sellerRankings[0].count} {sellerRankings[0].count === 1 ? 'veículo' : 'veículos'} ({formatCurrencyBRL(sellerRankings[0].faturamento)}).
                    </>
                  ) : (
                    'Nenhuma venda registrada no período selecionado.'
                  )}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border bg-gradient-to-br from-emerald-500/5 via-card to-card flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Instituição Principal de F&I</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {bankAnalytics[0] ? (
                    <>
                      <strong className="text-foreground">{bankAnalytics[0].banco}</strong> lidera as operações com{' '}
                      {formatCurrencyBRL(bankAnalytics[0].volumeFinanciado)} ({bankAnalytics[0].count} contratos).
                    </>
                  ) : (
                    'Sem operações de financiamento no período.'
                  )}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border bg-gradient-to-br from-amber-500/5 via-card to-card flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Status Operacional</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {metrics.vendasFaturadas} vendas faturadas e {metrics.preVendasPendentes} em fase de análise pré-venda.
                </p>
              </div>
            </div>
          </div>

          {/* Seção 3: Equipe de Consultores & Bancos F&I lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card Ranking de Consultores */}
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Ranking de Consultores Comerciais
                  </CardTitle>
                  <Badge variant="outline" className="font-bold text-xs">
                    {sellerRankings.length} consultores
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Volume de vendas, faturamento e atingimento de metas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {sellerRankings.slice(0, 5).map((seller, idx) => {
                  const medals = ['🥇', '🥈', '🥉', '4º', '5º'];
                  return (
                    <div
                      key={seller.name}
                      className="p-3 rounded-2xl border bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold text-muted-foreground">{medals[idx] || `${idx + 1}º`}</span>
                        <div>
                          <strong className="text-foreground text-sm">{seller.name}</strong>
                          <div className="text-[11px] text-muted-foreground">
                            {seller.count} {seller.count === 1 ? 'veículo' : 'veículos'} • Ticket: {formatCurrencyBRL(seller.ticketMedio)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-foreground">
                          {formatCurrencyBRL(seller.faturamento)}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          Meta: {seller.metaIndividualPct}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Card Bancos & Financiamentos */}
            <Card className="rounded-3xl border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-cyan-500" />
                    Distribuição Bancária & F&I
                  </CardTitle>
                  <Badge variant="outline" className="font-bold text-xs">
                    {bankAnalytics.length} instituições
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Valores liquidados e penetração de cada banco parceiro.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {bankAnalytics.slice(0, 5).map((b, idx) => (
                  <div
                    key={b.banco}
                    className="p-3 rounded-2xl border bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <strong className="text-foreground text-sm">{b.banco}</strong>
                        <div className="text-[11px] text-muted-foreground">
                          {b.count} contratos liberados
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-foreground">
                        {formatCurrencyBRL(b.volumeFinanciado)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold">
                        {metrics.totalFinanciado > 0
                          ? ((b.volumeFinanciado / metrics.totalFinanciado) * 100).toFixed(1)
                          : '0.0'}% do crédito
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Seção 4: Resumo de Estoque & Pátio */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Total no Pátio
              </span>
              <div className="text-2xl font-black text-foreground">
                {stockAnalytics.total} {stockAnalytics.total === 1 ? 'veículo' : 'veículos'}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Patrimônio: {formatCurrencyBRL(stockAnalytics.valorEstoque)}
              </span>
            </div>

            <div className="p-4 rounded-2xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-primary">
                Motos em Estoque
              </span>
              <div className="text-2xl font-black text-primary">
                {stockAnalytics.motosCount} motos
              </div>
              <span className="text-[10px] text-muted-foreground">
                0km e seminovas
              </span>
            </div>

            <div className="p-4 rounded-2xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                Pronta Entrega
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stockAnalytics.disponiveisCount} disponíveis
              </div>
              <span className="text-[10px] text-muted-foreground">
                Liberadas para venda imediata
              </span>
            </div>

            <div className="p-4 rounded-2xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                Reservados
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {stockAnalytics.reservadosCount} reservados
              </div>
              <span className="text-[10px] text-muted-foreground">
                Aguardando faturamento
              </span>
            </div>
          </div>

          {/* Seção 5: Atlas de Entregas por Município de MG (Mapa Oficial) */}
          <div className="pt-2">
            <MonthlyCitySalesMap
              sales={filteredSales}
              baseCity={
                storeFilter === 'store-montesclaros'
                  ? 'Montes Claros'
                  : stores.find((s) => s.id === storeFilter)?.city || 'Divinópolis'
              }
              selectedStoreId={storeFilter}
            />
          </div>
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 2: FLUXO OPERACIONAL (6 ETAPAS)                      */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="flow" className="space-y-4 mt-0">
          <DealershipProcessFlow
            contracts={filteredContracts}
            sales={filteredSales}
          />
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 3: ATLAS DE ENTREGAS & RAIO GEOGRÁFICO               */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="geo" className="space-y-4 mt-0">
          <GeographicSalesRadiusMap
            sales={filteredSales}
            referenceStoreCity={
              storeFilter === 'store-montesclaros'
                ? 'Montes Claros'
                : stores.find((s) => s.id === storeFilter)?.city || 'Divinópolis'
            }
            storeName={
              storeFilter === 'store-montesclaros'
                ? 'Concessionária Montes Claros (Polo Norte)'
                : stores.find((s) => s.id === storeFilter)?.name ||
                  'Concessionária Divinópolis (Matriz Oeste)'
            }
          />
        </TabsContent>

        {/* -------------------------------------------------------- */}
        {/* ABA 4: LOGÍSTICA, FROTAS & ENTREGAS                      */}
        {/* -------------------------------------------------------- */}
        <TabsContent value="logistics" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border bg-gradient-to-r from-sky-500/10 via-card to-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Coordenação de Logística & Frotas
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gestão de saídas rodoviárias, carretas cegonha, guinchos dedicados e termos de entrega
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => navigate('/logistics')}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5 rounded-xl shadow-xs"
            >
              <Truck className="w-4 h-4" />
              Abrir Central Completa de Logística
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              <LogisticsDeliveriesWidget
                sales={filteredSales}
                baseCity={
                  storeFilter === 'store-montesclaros'
                    ? 'Montes Claros'
                    : stores.find((s) => s.id === storeFilter)?.city || 'Divinópolis'
                }
              />
            </div>

            <div className="lg:col-span-5 space-y-3">
              <Card className="rounded-3xl border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-sky-500" />
                    Modalidades de Transporte Homologadas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Capacidade operacional e tarifas por km rodoviário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {TRANSPORT_LOGISTICS_METHODS.slice(0, 3).map((m) => (
                    <div key={m.id} className="p-3 rounded-2xl border bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-foreground">{m.nome}</span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          R$ {m.tarifaBaseKm.toFixed(2)}/km
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{m.subtitulo}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>Prazo: {m.prazoFormatado}</span>
                        <span>{m.capacidadeLote}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
