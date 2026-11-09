import React from 'react';
import {
  WidgetDefinition,
  DashboardPreset,
  DashboardBlockConfig,
} from './types';
import {
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon,
  Award,
  Landmark,
  Package,
  Truck,
  Bike,
  Workflow,
  Globe2,
  Radar,
  Flame,
  CheckCircle2,
  Clock,
  BadgePercent,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GlassView } from '@/components/ui/GlassView';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { LogisticsDeliveriesWidget } from './LogisticsDeliveriesWidget';
import { DealershipProcessFlow } from '@/components/dashboard/DealershipProcessFlow';
import { MonthlyCitySalesMap } from '@/components/dashboard/MonthlyCitySalesMap';
import { MarketingLeadRadiusMap } from '@/components/dashboard/MarketingLeadRadiusMap';

export const PALETTE = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  destructive: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  amber: '#d97706',
};

// =========================================================================
// CATÁLOGO COMPLETO DE WIDGETS DISPONÍVEIS
// =========================================================================
export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    id: 'kpis_summary',
    title: 'KPIs Executivos (4 Cards)',
    description: 'Faturamento consolidado, volume de veículos liberados, ticket médio e saúde do estoque.',
    category: 'kpis',
    defaultColSpan: 'full',
    allowedColSpans: ['full'],
    icon: 'DollarSign',
    badge: 'Essencial',
  },
  {
    id: 'sales_timeline',
    title: 'Evolução Diária & Ritmo de Vendas',
    description: 'Gráfico em área do faturamento dia a dia com linha de crescimento acumulado.',
    category: 'sales',
    defaultColSpan: 'two-thirds',
    allowedColSpans: ['full', 'two-thirds', 'half'],
    icon: 'TrendingUp',
    badge: 'Gráfico',
  },
  {
    id: 'payment_mix',
    title: 'Mix de Pagamentos & Liquidação',
    description: 'Gráfico em rosca dos canais de pagamento: PIX, Dinheiro, Financiamento e Cartão.',
    category: 'finance',
    defaultColSpan: 'third',
    allowedColSpans: ['half', 'third', 'two-thirds'],
    icon: 'PieChart',
    badge: 'Financeiro',
  },
  {
    id: 'seller_ranking',
    title: 'Ranking da Equipe de Vendas',
    description: 'Placar com volume de motos, faturamento individual, ticket médio e progresso da meta.',
    category: 'team',
    defaultColSpan: 'half',
    allowedColSpans: ['full', 'two-thirds', 'half'],
    icon: 'Award',
  },
  {
    id: 'banks_fi',
    title: 'Distribuição Bancária & F&I',
    description: 'Ranking de aprovação e volume financiado por bancos parceiros (Altis, Pan, etc.).',
    category: 'finance',
    defaultColSpan: 'half',
    allowedColSpans: ['full', 'half', 'third'],
    icon: 'Landmark',
  },
  {
    id: 'logistics_deliveries',
    title: 'Logística, Motoristas & Entregas',
    description: 'Entregas liberadas vs pendentes, rotas em MG, destinos mais frequentes e frota.',
    category: 'logistics',
    defaultColSpan: 'half',
    allowedColSpans: ['full', 'two-thirds', 'half'],
    icon: 'Truck',
    badge: 'Novo',
  },
  {
    id: 'stock_health',
    title: 'Saúde & Resumo do Pátio',
    description: 'Motos e carros em estoque, unidades disponíveis vs reservadas e patrimônio investido.',
    category: 'stock',
    defaultColSpan: 'half',
    allowedColSpans: ['full', 'half', 'third'],
    icon: 'Package',
  },
  {
    id: 'top_models',
    title: 'Modelos Mais Vendidos',
    description: 'Lista dos modelos de veículos com maior giro comercial e faturamento gerado.',
    category: 'sales',
    defaultColSpan: 'third',
    allowedColSpans: ['half', 'third'],
    icon: 'Bike',
  },
  {
    id: 'process_flow',
    title: 'Fluxo Operacional (6 Etapas)',
    description: 'Visualização completa do funil desde a captação do lead até a entrega na oficina PDI.',
    category: 'flow',
    defaultColSpan: 'full',
    allowedColSpans: ['full'],
    icon: 'Workflow',
  },
  {
    id: 'monthly_geo_map',
    title: 'Atlas Mensal de Saídas por Cidade',
    description: 'Mapa interativo com rotas rodoviárias e ranking de vendas por município em MG.',
    category: 'geo',
    defaultColSpan: 'full',
    allowedColSpans: ['full'],
    icon: 'Globe2',
  },
  {
    id: 'marketing_radar',
    title: 'Radar de Marketing & Raios de Leads',
    description: 'Distribuição e conversão de leads por anéis de distância (0 a 300km+).',
    category: 'geo',
    defaultColSpan: 'full',
    allowedColSpans: ['full'],
    icon: 'Radar',
  },
];

// =========================================================================
// PRESETS PRONTOS PARA CARREGAMENTO RÁPIDO
// =========================================================================
export const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'executivo_padrao',
    name: 'Cockpit Executivo (Padrão)',
    description: 'Visão equilibrada com KPIs, evolução de vendas, mix financeiro, ranking e estoque.',
    blocks: [
      { id: 'b-kpi', widgetId: 'kpis_summary', colSpan: 'full', visible: true, order: 1 },
      { id: 'b-timeline', widgetId: 'sales_timeline', colSpan: 'two-thirds', visible: true, order: 2 },
      { id: 'b-mix', widgetId: 'payment_mix', colSpan: 'third', visible: true, order: 3 },
      { id: 'b-ranking', widgetId: 'seller_ranking', colSpan: 'half', visible: true, order: 4 },
      { id: 'b-logistics', widgetId: 'logistics_deliveries', colSpan: 'half', visible: true, order: 5 },
      { id: 'b-banks', widgetId: 'banks_fi', colSpan: 'half', visible: true, order: 6 },
      { id: 'b-stock', widgetId: 'stock_health', colSpan: 'half', visible: true, order: 7 },
    ],
  },
  {
    id: 'foco_vendas_fi',
    name: 'Foco em Vendas & F&I',
    description: 'Prioriza métricas comerciais, aprovação de financiamento bancário e ritmo diário.',
    blocks: [
      { id: 'b-kpi', widgetId: 'kpis_summary', colSpan: 'full', visible: true, order: 1 },
      { id: 'b-timeline', widgetId: 'sales_timeline', colSpan: 'two-thirds', visible: true, order: 2 },
      { id: 'b-mix', widgetId: 'payment_mix', colSpan: 'third', visible: true, order: 3 },
      { id: 'b-banks', widgetId: 'banks_fi', colSpan: 'half', visible: true, order: 4 },
      { id: 'b-ranking', widgetId: 'seller_ranking', colSpan: 'half', visible: true, order: 5 },
      { id: 'b-models', widgetId: 'top_models', colSpan: 'half', visible: true, order: 6 },
    ],
  },
  {
    id: 'foco_logistica_patio',
    name: 'Foco em Logística & Pátio',
    description: 'Ideal para gestão de estoque, entregas, motoristas e despacho de motos.',
    blocks: [
      { id: 'b-kpi', widgetId: 'kpis_summary', colSpan: 'full', visible: true, order: 1 },
      { id: 'b-logistics', widgetId: 'logistics_deliveries', colSpan: 'half', visible: true, order: 2 },
      { id: 'b-stock', widgetId: 'stock_health', colSpan: 'half', visible: true, order: 3 },
      { id: 'b-geo', widgetId: 'monthly_geo_map', colSpan: 'full', visible: true, order: 4 },
    ],
  },
  {
    id: 'foco_estrategico_mapas',
    name: 'Inteligência Geográfica & Marketing',
    description: 'Exploração de rotas de entrega e abrangência regional de campanhas.',
    blocks: [
      { id: 'b-kpi', widgetId: 'kpis_summary', colSpan: 'full', visible: true, order: 1 },
      { id: 'b-geo', widgetId: 'monthly_geo_map', colSpan: 'full', visible: true, order: 2 },
      { id: 'b-radar', widgetId: 'marketing_radar', colSpan: 'full', visible: true, order: 3 },
      { id: 'b-flow', widgetId: 'process_flow', colSpan: 'full', visible: true, order: 4 },
    ],
  },
];

// =========================================================================
// RENDERIZADOR CENTRAL DOS WIDGETS
// =========================================================================
interface WidgetRendererProps {
  widgetId: string;
  data: {
    metrics: any;
    timelineChartData: any[];
    paymentDistributionData: any[];
    sellerRankings: any[];
    stockAnalytics: any;
    banksAnalytics: any[];
    topModels: any[];
    filteredSales: any[];
    filteredContracts: any[];
    baseCity: string;
    storeFilter: string;
  };
}

export function RenderWidget({ widgetId, data }: WidgetRendererProps) {
  const {
    metrics,
    timelineChartData,
    paymentDistributionData,
    sellerRankings,
    stockAnalytics,
    banksAnalytics,
    topModels,
    filteredSales,
    filteredContracts,
    baseCity,
    storeFilter,
  } = data;

  switch (widgetId) {
    case 'kpis_summary':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* Card 1: Faturamento */}
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
          >
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
                <span>{metrics.totalVendas} vendas no período</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                <span>Meta ({formatCurrencyBRL(metrics.metaFaturamento)})</span>
                <span className="font-bold text-foreground">{metrics.progressoMetaValor}%</span>
              </div>
              <Progress value={metrics.progressoMetaValor} className="h-1.5 bg-muted/60" />
            </div>
          </GlassView>

          {/* Card 2: Volume */}
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
          >
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
                <span>{metrics.totalVendas} un</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  ({metrics.vendasFaturadas} liberadas)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{metrics.preVendasPendentes} em pré-venda</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                <span>Meta ({metrics.metaMotos} Unidades)</span>
                <span className="font-bold text-foreground">{metrics.progressoMetaMotos}%</span>
              </div>
              <Progress value={metrics.progressoMetaMotos} className="h-1.5 bg-muted/60" />
            </div>
          </GlassView>

          {/* Card 3: Ticket Médio */}
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Ticket Médio
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
                <span>Média por veículo negociado</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Mais vendido:</span>
              <strong className="text-foreground font-black truncate max-w-[140px]">
                {topModels[0] ? `${topModels[0].name}` : '—'}
              </strong>
            </div>
          </GlassView>

          {/* Card 4: Saúde do Pátio */}
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            className="group relative overflow-hidden rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-border/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Estoque do Pátio
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-3xl font-black font-display text-foreground tracking-tight">
                {stockAnalytics.total} un
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mt-1">
                <span className="text-emerald-600 font-bold">{stockAnalytics.disponiveisCount} livres</span>
                <span>•</span>
                <span className="text-amber-600 font-bold">{stockAnalytics.reservadosCount} reservadas</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Valor em estoque:</span>
              <span className="font-bold text-foreground">
                {formatCurrencyBRL(stockAnalytics.valorEstoque)}
              </span>
            </div>
          </GlassView>
        </div>
      );

    case 'sales_timeline':
      return (
        <Card className="rounded-3xl border shadow-sm h-full flex flex-col justify-between">
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
                {timelineChartData.length} dias registrados
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[270px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData}>
                  <defs>
                    <linearGradient id="colorFaturamentoModular" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#colorFaturamentoModular)"
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
      );

    case 'payment_mix':
      return (
        <Card className="rounded-3xl border shadow-sm h-full flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-500" />
              Mix de Pagamentos
            </CardTitle>
            <CardDescription className="text-xs">
              Distribuição dos canais de liquidação financeira.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[200px] w-full">
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
      );

    case 'seller_ranking':
      return (
        <Card className="rounded-3xl border shadow-sm h-full flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Ranking da Equipe de Vendas
              </CardTitle>
              <Badge variant="outline" className="text-xs font-bold">
                {sellerRankings.length} Vendedores
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {sellerRankings.slice(0, 5).map((seller, idx) => (
              <div key={seller.name} className="p-2.5 rounded-2xl border bg-muted/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-xs ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-600 border border-amber-500/40'
                          : idx === 1
                          ? 'bg-slate-300/30 text-slate-700 dark:text-slate-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}º
                    </span>
                    <span className="font-bold text-foreground">{seller.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground font-display">
                      {formatCurrencyBRL(seller.faturamento)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-bold">
                      ({seller.count} {seller.count === 1 ? 'moto' : 'motos'})
                    </span>
                  </div>
                </div>
                <Progress value={seller.metaIndividualPct} className="h-1.5 bg-muted/50" />
              </div>
            ))}
          </CardContent>
        </Card>
      );

    case 'banks_fi':
      return (
        <Card className="rounded-3xl border shadow-sm h-full flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Landmark className="w-4 h-4 text-cyan-500" />
                Distribuição Bancária & F&I
              </CardTitle>
              <Badge variant="outline" className="text-xs font-bold text-cyan-600">
                {banksAnalytics.length} Instituições
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Volume total e aprovações por instituição parceira.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {banksAnalytics.slice(0, 5).map((b) => (
              <div
                key={b.banco}
                className="flex items-center justify-between p-2.5 rounded-2xl border bg-muted/10 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                  <span className="font-bold text-foreground truncate max-w-[150px]">{b.banco}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-foreground">{formatCurrencyBRL(b.volumeFinanciado || b.volumeTotal || b.total || 0)}</span>
                  <p className="text-[10px] text-muted-foreground">{b.count} contratos</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      );

    case 'logistics_deliveries':
      return <LogisticsDeliveriesWidget sales={filteredSales} baseCity={baseCity} />;

    case 'stock_health':
      return (
        <Card className="rounded-3xl border shadow-sm h-full flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              Saúde do Pátio & Estoque Físico
            </CardTitle>
            <CardDescription className="text-xs">
              Disponibilidade real filtrada na loja selecionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                  Prontas p/ Venda
                </span>
                <div className="text-2xl font-black font-display text-emerald-900 dark:text-emerald-100">
                  {stockAnalytics.disponiveisCount}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
                  Reservadas / Pré-NF
                </span>
                <div className="text-2xl font-black font-display text-amber-900 dark:text-amber-100">
                  {stockAnalytics.reservadosCount}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Motos no pátio:</span>
                <strong className="text-foreground">{stockAnalytics.motosCount} un</strong>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Carros / Outros:</span>
                <strong className="text-foreground">{stockAnalytics.carrosCount} un</strong>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Capital em estoque:</span>
                <strong className="text-foreground">{formatCurrencyBRL(stockAnalytics.valorEstoque)}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      );

    case 'top_models':
      return (
        <Card className="rounded-3xl border shadow-sm h-full flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Bike className="w-4 h-4 text-primary" />
              Modelos Mais Vendidos
            </CardTitle>
            <CardDescription className="text-xs">
              Giro de modelos na competência.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {topModels.slice(0, 5).map((m, idx) => (
              <div
                key={m.name}
                className="flex items-center justify-between p-2 rounded-xl border bg-muted/10 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-foreground truncate max-w-[130px]">{m.name}</span>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {m.count} {m.count === 1 ? 'un' : 'uns'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      );

    case 'process_flow':
      return <DealershipProcessFlow contracts={filteredContracts} sales={filteredSales} />;

    case 'monthly_geo_map':
      return (
        <MonthlyCitySalesMap
          sales={filteredSales}
          baseCity={baseCity}
          selectedStoreId={storeFilter}
        />
      );

    case 'marketing_radar':
      return (
        <MarketingLeadRadiusMap
          sales={filteredSales}
          contracts={filteredContracts}
          baseCity={baseCity}
        />
      );

    default:
      return (
        <Card className="rounded-3xl border shadow-sm p-6 text-center text-muted-foreground">
          Widget não encontrado ({widgetId})
        </Card>
      );
  }
}
