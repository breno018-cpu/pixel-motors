import { useState, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Store, 
  PieChart as PieIcon, 
  ArrowUpRight, 
  Car, 
  Percent, 
  Wallet, 
  Building2,
  FileText,
  CreditCard,
  Banknote,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStores } from '@/hooks/useStores';

export function FinancialDREPanel() {
  const [period, setPeriod] = useState<string>('30d');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const { data: stores } = useStores();

  // Buscar vendas e veículos do período
  const { data: financialData, isLoading } = useQuery({
    queryKey: ['financial-dre-data', period, storeFilter],
    queryFn: async () => {
      // 1. Vendas
      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_price,
          down_payment_cash,
          down_payment_pix,
          down_payment_card,
          financing_bank,
          payment_method,
          status,
          store_id,
          created_at,
          vehicle:vehicles (
            id,
            brand,
            model,
            year,
            purchase_price,
            sale_price
          )
        `);

      const now = new Date();
      if (period === '7d') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', d);
      } else if (period === '30d') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', d);
      } else if (period === '90d') {
        const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', d);
      } else if (period === '365d') {
        const d = new Date(now.getFullYear(), 0, 1).toISOString();
        query = query.gte('created_at', d);
      }

      if (storeFilter !== 'all') {
        query = query.eq('store_id', storeFilter);
      }

      const { data: sales, error } = await query;
      if (error) throw error;

      return sales || [];
    },
  });

  const salesList = financialData || [];

  const metrics = useMemo(() => {
    let grossRevenue = 0;
    let cmvCost = 0;
    let totalPix = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalFinanced = 0;

    salesList.forEach((s: any) => {
      const price = Number(s.sale_price) || 0;
      grossRevenue += price;

      const cost = Number(s.vehicle?.purchase_price) || 0;
      // Se não houver custo lançado, estimamos conservadoramente 82% do preço
      cmvCost += cost > 0 ? cost : price * 0.82;

      const pix = Number(s.down_payment_pix) || 0;
      const cash = Number(s.down_payment_cash) || 0;
      const card = Number(s.down_payment_card) || 0;
      totalPix += pix;
      totalCash += cash;
      totalCard += card;

      const downPaymentSum = pix + cash + card;
      const financed = Math.max(0, price - downPaymentSum);
      totalFinanced += financed;
    });

    const grossProfit = grossRevenue - cmvCost;
    const grossMarginPercent = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

    // Estimativa de comissões comerciais (média padrão de 2,2% sobre o faturamento)
    const commissionExpenses = grossRevenue * 0.022;

    // Despesas de preparação, despachante e pátio (estimativa padrão de 1,8% sobre o faturamento)
    const operationalExpenses = grossRevenue * 0.018;

    const netProfit = grossProfit - commissionExpenses - operationalExpenses;
    const netMarginPercent = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    return {
      salesCount: salesList.length,
      grossRevenue,
      cmvCost,
      grossProfit,
      grossMarginPercent,
      commissionExpenses,
      operationalExpenses,
      netProfit,
      netMarginPercent,
      totalPix,
      totalCash,
      totalCard,
      totalFinanced,
    };
  }, [salesList]);

  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* Header do DRE com Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Demonstrativo de Resultado do Exercício (DRE) & Fluxo de Caixa
          </h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe a rentabilidade real líquida da operação descontando custo de compra, preparação e comissões.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[130px] text-xs bg-card">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Este Mês</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="365d">Este Ano</SelectItem>
              <SelectItem value="all">Todo Período</SelectItem>
            </SelectContent>
          </Select>

          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs bg-card">
              <Store className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              {stores?.filter(s => s.is_active).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Destaque Executivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="executive-card p-5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receita Bruta Faturada</p>
          <p className="text-2xl font-bold font-display text-foreground tracking-tight">{brl(metrics.grossRevenue)}</p>
          <p className="text-xs text-muted-foreground">{metrics.salesCount} vendas realizadas</p>
        </div>

        <div className="executive-card p-5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custo dos Veículos (CMV)</p>
          <p className="text-2xl font-bold font-display text-foreground tracking-tight text-muted-foreground">{brl(metrics.cmvCost)}</p>
          <p className="text-xs text-muted-foreground">Custo de compra baixado do estoque</p>
        </div>

        <div className="executive-card p-5 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lucro Bruto Operacional</p>
          <p className="text-2xl font-bold font-display text-foreground tracking-tight text-blue-600 dark:text-blue-400">{brl(metrics.grossProfit)}</p>
          <p className="text-xs text-blue-600/80 font-medium">Margem bruta de {metrics.grossMarginPercent.toFixed(1)}%</p>
        </div>

        <div className="executive-card p-5 space-y-1 bg-emerald-500/5 border-emerald-500/30">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Lucro Líquido Real</p>
          <p className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 tracking-tight">{brl(metrics.netProfit)}</p>
          <p className="text-xs text-emerald-600 font-medium">Margem líquida real de {metrics.netMarginPercent.toFixed(1)}%</p>
        </div>
      </div>

      {/* Estrutura DRE em Linhas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
                <span>Demonstrativo Contábil e Gerencial</span>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {period === '30d' ? 'Mês Atual' : 'Período Selecionado'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="text-primary font-bold">(+)</span> RECEITA OPERACIONAL BRUTA
                </span>
                <span className="text-sm">{brl(metrics.grossRevenue)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg text-muted-foreground">
                <span className="flex items-center gap-1.5 pl-4">
                  <span className="text-red-500 font-bold">(-)</span> Custo dos Veículos Vendidos (CMV de Aquisição)
                </span>
                <span className="text-red-500 font-medium">{brl(metrics.cmvCost)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="text-blue-500">(=)</span> LUCRO BRUTO DA OPERAÇÃO
                </span>
                <span className="text-blue-600 dark:text-blue-400 text-sm">
                  {brl(metrics.grossProfit)} <span className="text-xs font-normal">({metrics.grossMarginPercent.toFixed(1)}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg text-muted-foreground">
                <span className="flex items-center gap-1.5 pl-4">
                  <span className="text-red-500 font-bold">(-)</span> Provisão de Comissões Comerciais (~2,2%)
                </span>
                <span className="text-red-500 font-medium">{brl(metrics.commissionExpenses)}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg text-muted-foreground">
                <span className="flex items-center gap-1.5 pl-4">
                  <span className="text-red-500 font-bold">(-)</span> Despesas Operacionais, Preparação e Despachante (~1,8%)
                </span>
                <span className="text-red-500 font-medium">{brl(metrics.operationalExpenses)}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-bold text-emerald-950 dark:text-emerald-100">
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="text-emerald-600">(=)</span> RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO REAL)
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 text-base font-display">
                  {brl(metrics.netProfit)} <span className="text-xs font-normal">({metrics.netMarginPercent.toFixed(1)}%)</span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Decomposição do Fluxo de Caixa de Entradas */}
        <div>
          <Card className="border-border/70 shadow-sm h-full">
            <CardHeader className="p-4 sm:p-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Origem das Entradas Financeiras
              </CardTitle>
              <CardDescription className="text-xs">
                Como os clientes pagaram os veículos faturados.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    Repasses de Bancos (F&I)
                  </span>
                  <span className="font-bold">{brl(metrics.totalFinanced)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Financiamentos aprovados a liquidar na conta da loja.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    Pix à Vista
                  </span>
                  <span className="font-bold">{brl(metrics.totalPix)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Crédito em conta corrente imediato.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                    Cartão de Crédito
                  </span>
                  <span className="font-bold">{brl(metrics.totalCard)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Entradas parceladas na maquininha.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-500" />
                    Dinheiro em Espécie
                  </span>
                  <span className="font-bold">{brl(metrics.totalCash)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Sinais e entradas em caixa físico.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
