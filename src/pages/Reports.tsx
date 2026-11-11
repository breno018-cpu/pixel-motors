import { useMemo, useState } from 'react';
import { Target, TrendingUp, Clock, Percent, RefreshCw, Download, Plus, Trash2 } from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';
import { useVehicles } from '@/hooks/useVehicles';
import { useStores } from '@/hooks/useStores';
import { useAuth } from '@/contexts/AuthContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { useSalesTargets, useSaveSalesTarget, useDeleteSalesTarget, useProfilesList } from '@/hooks/useSalesTargets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToXLSX } from '@/lib/export';
import { PageHeader } from '@/components/layout/PageHeader';
import { FinancialDREPanel } from '@/components/finance/FinancialDREPanel';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

function MetricCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle?: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-display font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { profile, isAdmin, hasElevatedAccess } = useAuth();
  const { isDateInPeriod, activePeriodLabel } = useDateFilter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [storeFilter, setStoreFilter] = useState('all');

  const { data: contracts } = useContracts();
  const { data: vehicles } = useVehicles();
  const { data: stores } = useStores();
  const { data: targets } = useSalesTargets(year, month);
  const { data: profiles } = useProfilesList();
  const saveTarget = useSaveSalesTarget();
  const deleteTarget = useDeleteSalesTarget();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ user_id: 'all', store_id: 'all', target_qty: '', target_value: '', bonus_on_target: '' });

  const vehicleMap = useMemo(() => {
    const m = new Map<string, any>();
    (vehicles || []).forEach(v => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const monthSales = useMemo(() => {
    return (contracts || []).filter(c => {
      const okDate = isDateInPeriod(c.signed_at || c.created_at);
      const okStore = storeFilter === 'all' || c.store_id === storeFilter;
      const okStatus = c.status === 'concluido' || c.status === 'assinado';
      return okDate && okStore && okStatus;
    });
  }, [contracts, isDateInPeriod, storeFilter]);

  const financials = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let daysSum = 0;
    let daysCount = 0;
    monthSales.forEach(c => {
      const v = vehicleMap.get(c.vehicle_id);
      revenue += Number(c.sale_price) || 0;
      cost += Number(v?.purchase_price) || 0;
      if (v?.created_at) {
        const diff = (new Date(c.created_at).getTime() - new Date(v.created_at).getTime()) / 86400000;
        if (diff >= 0) { daysSum += diff; daysCount++; }
      }
    });
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    const stock = (vehicles || []).filter(v => v.status !== 'vendido' && (storeFilter === 'all' || v.store_id === storeFilter));
    const turnover = stock.length > 0 ? (monthSales.length / stock.length) * 100 : 0;
    const avgDays = daysCount > 0 ? daysSum / daysCount : 0;
    const stockValue = stock.reduce((s, v) => s + (Number(v.sale_price) || 0), 0);
    return { revenue, cost, margin, marginPct, turnover, avgDays, stockCount: stock.length, stockValue, avgTicket: monthSales.length ? revenue / monthSales.length : 0 };
  }, [monthSales, vehicleMap, vehicles, storeFilter]);

  const resolveSellerProfile = (idOrName?: string | null) => {
    if (!idOrName) return null;
    const lower = idOrName.toLowerCase();
    return (
      profiles?.find((p) => p.id === idOrName) ||
      profiles?.find((p) => p.full_name.toLowerCase().includes(lower)) ||
      null
    );
  };

  const nameOf = (id?: string | null) =>
    resolveSellerProfile(id)?.full_name || id || 'Consultor Comercial';

  const performance = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number; value: number; margin: number }>();
    monthSales.forEach(c => {
      const matched = resolveSellerProfile(c.created_by);
      const id = matched?.id || c.created_by || 'unknown';
      const v = vehicleMap.get(c.vehicle_id);
      const cur = map.get(id) || { id, name: matched?.full_name || nameOf(c.created_by), qty: 0, value: 0, margin: 0 };
      cur.qty += 1;
      cur.value += Number(c.sale_price) || 0;
      const estCost = Number(v?.purchase_price) || Math.round((Number(c.sale_price) || 0) * 0.78);
      cur.margin += (Number(c.sale_price) || 0) - estCost;
      map.set(id, cur);
    });
    return Array.from(map.values()).map(row => {
      const t = (targets || []).find(t => t.user_id === row.id) || (targets || []).find(t => !t.user_id);
      const qtyPct = t?.target_qty ? Math.min(100, (row.qty / t.target_qty) * 100) : 0;
      const valuePct = t?.target_value ? Math.min(100, (row.value / t.target_value) * 100) : 0;
      const hit = !!t && (t.target_qty ? row.qty >= t.target_qty : true) && (t.target_value ? row.value >= t.target_value : true);
      return { ...row, target: t, qtyPct, valuePct, bonus: hit ? Number(t?.bonus_on_target) || 0 : 0 };
    }).sort((a, b) => b.value - a.value);
  }, [monthSales, targets, profiles, vehicleMap]);

  const globalTarget = useMemo(() => (targets || []).find(t => !t.user_id), [targets]);
  const globalQtyPct = globalTarget?.target_qty ? Math.min(100, (monthSales.length / globalTarget.target_qty) * 100) : 0;
  const globalValuePct = globalTarget?.target_value ? Math.min(100, (financials.revenue / globalTarget.target_value) * 100) : 0;

  const handleExport = async () => {
    await exportToXLSX({
      title: `Relatório gerencial — ${MONTHS[month - 1]}/${year}`,
      module: 'sales',
      filters: { periodo: `${month}/${year}`, loja: storeFilter },
      columns: [
        { key: 'contract_number', label: 'Contrato' },
        { key: 'created_at', label: 'Data', type: 'date' },
        { key: 'buyer_name', label: 'Cliente' },
        { key: 'vehicle_label', label: 'Veículo' },
        { key: 'seller', label: 'Vendedor' },
        { key: 'sale_price', label: 'Venda', type: 'currency' },
        { key: 'cost', label: 'Custo', type: 'currency' },
        { key: 'margin', label: 'Margem', type: 'currency' },
        { key: 'days_in_stock', label: 'Dias em estoque' },
      ],
      data: monthSales.map(c => {
        const v = vehicleMap.get(c.vehicle_id);
        const cost = Number(v?.purchase_price) || 0;
        const days = v?.created_at ? Math.round((new Date(c.created_at).getTime() - new Date(v.created_at).getTime()) / 86400000) : 0;
        return {
          contract_number: c.contract_number,
          created_at: c.created_at,
          buyer_name: c.buyer_name,
          vehicle_label: v ? `${v.brand} ${v.model}` : '',
          seller: nameOf(c.created_by),
          sale_price: Number(c.sale_price) || 0,
          cost,
          margin: (Number(c.sale_price) || 0) - cost,
          days_in_stock: days,
        };
      }),
      userName: profile?.full_name || 'Usuário',
      storeName: stores?.find(s => s.id === storeFilter)?.name,
    });
  };

  const submitTarget = () => {
    saveTarget.mutate(
      {
        month,
        year,
        user_id: form.user_id === 'all' ? null : form.user_id,
        store_id: form.store_id === 'all' ? null : form.store_id,
        target_qty: Number(form.target_qty) || 0,
        target_value: Number(form.target_value) || 0,
        bonus_on_target: Number(form.bonus_on_target) || 0,
      },
      { onSuccess: () => { setDialogOpen(false); setForm({ user_id: 'all', store_id: 'all', target_qty: '', target_value: '', bonus_on_target: '' }); } },
    );
  };

  if (!hasElevatedAccess) {
    return <div className="max-w-2xl mx-auto py-16 text-center text-muted-foreground text-sm">Acesso restrito a administradores e gerentes.</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Relatórios e Metas"
        description={`Desempenho comercial de ${MONTHS[month - 1]} de ${year}`}
        actions={<>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px] h-9 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-9 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[160px] h-9 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores?.filter(s => s.is_active).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar
          </Button>
        </>}
      />

      <Tabs defaultValue="gerencial">
        <TabsList>
          <TabsTrigger value="gerencial">Visão Geral</TabsTrigger>
          <TabsTrigger value="dre" className="font-semibold text-primary">DRE & Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="metas">Metas e comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="dre" className="space-y-4 mt-4">
          <FinancialDREPanel />
        </TabsContent>

        <TabsContent value="gerencial" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Receita" value={brl(financials.revenue)} subtitle={`${monthSales.length} vendas · ticket ${brl(financials.avgTicket)}`} icon={TrendingUp} />
            {isAdmin && <MetricCard title="Margem bruta" value={brl(financials.margin)} subtitle={`${financials.marginPct.toFixed(1)}% sobre a receita`} icon={Percent} />}
            <MetricCard title="Giro de estoque" value={`${financials.turnover.toFixed(1)}%`} subtitle={`${financials.stockCount} veículos em estoque`} icon={RefreshCw} />
            <MetricCard title="Tempo médio de venda" value={`${financials.avgDays.toFixed(0)} dias`} subtitle={`Estoque parado: ${brl(financials.stockValue)}`} icon={Clock} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Vendas do período</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {monthSales.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda concluída neste período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      {isAdmin && <TableHead className="text-right">Margem</TableHead>}
                      <TableHead className="text-right">Dias em estoque</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthSales.map(c => {
                      const v = vehicleMap.get(c.vehicle_id);
                      const cost = Number(v?.purchase_price) || 0;
                      const days = v?.created_at ? Math.round((new Date(c.created_at).getTime() - new Date(v.created_at).getTime()) / 86400000) : 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.contract_number}</TableCell>
                          <TableCell>{v ? `${v.brand} ${v.model}` : '—'}</TableCell>
                          <TableCell>{nameOf(c.created_by)}</TableCell>
                          <TableCell className="text-right">{brl(Number(c.sale_price))}</TableCell>
                          {isAdmin && <TableCell className="text-right">{brl(Number(c.sale_price) - cost)}</TableCell>}
                          <TableCell className="text-right">{days}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metas" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Meta geral do mês</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8"><Plus className="w-4 h-4 mr-1.5" /> Nova meta</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Meta de {MONTHS[month - 1]}/{year}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Vendedor</Label>
                      <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Meta geral (equipe)</SelectItem>
                          {profiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Loja</Label>
                      <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as lojas</SelectItem>
                          {stores?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Qtd.</Label>
                        <Input inputMode="numeric" value={form.target_qty} onChange={(e) => setForm({ ...form, target_qty: e.target.value.replace(/\D/g, '') })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor (R$)</Label>
                        <Input inputMode="numeric" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value.replace(/\D/g, '') })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bônus (R$)</Label>
                        <Input inputMode="numeric" value={form.bonus_on_target} onChange={(e) => setForm({ ...form, bonus_on_target: e.target.value.replace(/\D/g, '') })} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={submitTarget} disabled={saveTarget.isPending}>Salvar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {!globalTarget ? (
                <p className="text-sm text-muted-foreground">Nenhuma meta geral definida para este mês.</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Quantidade</span>
                      <span>{monthSales.length} / {globalTarget.target_qty}</span>
                    </div>
                    <Progress value={globalQtyPct} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Faturamento</span>
                      <span>{brl(financials.revenue)} / {brl(globalTarget.target_value)}</span>
                    </div>
                    <Progress value={globalValuePct} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ranking de vendedores</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {performance.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas registradas neste período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="w-[180px]">Meta</TableHead>
                      <TableHead className="text-right">Bônus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right">{brl(p.value)}</TableCell>
                        <TableCell>
                          {p.target ? (
                            <div className="space-y-1">
                              <Progress value={Math.max(p.qtyPct, p.valuePct)} />
                              <p className="text-[11px] text-muted-foreground">{Math.round(Math.max(p.qtyPct, p.valuePct))}% da meta</p>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">sem meta</span>}
                        </TableCell>
                        <TableCell className="text-right">{p.bonus > 0 ? brl(p.bonus) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Metas cadastradas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(targets || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada para {MONTHS[month - 1]}/{year}.</p>}
              {(targets || []).map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                  <Target className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm flex-1 truncate">
                    {t.user_id ? nameOf(t.user_id) : 'Equipe'} — {t.target_qty} vendas · {brl(Number(t.target_value))}
                    {Number(t.bonus_on_target) > 0 && ` · bônus ${brl(Number(t.bonus_on_target))}`}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTarget.mutate(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}