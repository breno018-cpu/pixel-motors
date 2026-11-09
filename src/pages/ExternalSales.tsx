import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bike,
  Car,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  Megaphone,
  Paperclip,
  Phone,
  Search,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard, FilterBar, PanelCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewSaleDialog } from '@/components/sales/NewSaleDialog';
import { SaleActionsMenu } from '@/components/sales/SaleActionsMenu';
import { FreightCalculatorDialog } from '@/components/logistics/FreightCalculatorDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useExternalContracts } from '@/hooks/useContracts';
import { useExternalSellers, useMyExternalPanel } from '@/hooks/useExternalSellers';
import { leadSourceLabel } from '@/lib/leadSources';
import { maskCPF } from '@/lib/masks';
import { cn } from '@/lib/utils';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const statusConfig: Record<string, { label: string; className: string }> = {
  pre_venda: { label: 'Pré-venda (NF)', className: 'bg-muted text-muted-foreground' },
  pendente: { label: 'Aguardando aprovação', className: 'bg-warning/10 text-warning' },
  assinado: { label: 'Assinado', className: 'bg-primary/10 text-primary' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive' },
  concluido: { label: 'Quitado', className: 'bg-success/10 text-success' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export default function ExternalSales() {
  const { hasElevatedAccess, isExternalSeller, profile } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [freightDialogOpen, setFreightDialogOpen] = useState(false);
  const { data: sellers, isLoading: loadingSellers } = useExternalSellers(month, year);
  const { data: panel, isLoading: loadingPanel } = useMyExternalPanel(month, year);
  const { data: externalContracts, isLoading: loadingContracts } = useExternalContracts();

  const years = useMemo(() => Array.from({ length: 4 }, (_, index) => now.getFullYear() - index), []);
  const visibleSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (externalContracts || []).filter((sale) => {
      const created = new Date(sale.created_at);
      const external = sale.external_data || {};
      const searchable = [
        sale.contract_number, sale.buyer_name, sale.buyer_cpf, sale.buyer_phone,
        sale.vehicle?.brand, sale.vehicle?.model, sale.vehicle?.chassis,
        sale.campaign_name, sale.lead_source_detail, external.contact_platform,
        external.buyer_city, external.ad_description,
      ].filter(Boolean).join(' ').toLowerCase();
      return created.getMonth() + 1 === month
        && created.getFullYear() === year
        && (statusFilter === 'all' || sale.status === statusFilter)
        && (!term || searchable.includes(term));
    });
  }, [externalContracts, month, year, search, statusFilter]);

  const salesTotal = visibleSales.reduce((sum, sale) => sum + Number(sale.sale_price || 0), 0);
  const completedSales = visibleSales.filter((sale) => ['assinado', 'concluido'].includes(sale.status)).length;
  const evidenceCount = visibleSales.reduce((sum, sale) => sum + (sale.evidence_paths?.length || 0), 0);
  const teamSales = sellers?.reduce((sum, seller) => sum + seller.salesCount, 0) || 0;
  const teamRevenue = sellers?.reduce((sum, seller) => sum + seller.salesTotal, 0) || 0;
  const teamCommission = sellers?.reduce((sum, seller) => sum + seller.commission, 0) || 0;
  const canRegister = hasElevatedAccess || isExternalSeller;

  const periodPicker = (
    <div className="flex gap-2">
      <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
        <SelectTrigger className="h-10 w-[145px]"><SelectValue /></SelectTrigger>
        <SelectContent>{MONTHS.map((label, index) => <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
        <SelectTrigger className="h-10 w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>{years.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const salesView = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Vendas externas" value={visibleSales.length} hint={MONTHS[month - 1]} />
        <StatCard icon={TrendingUp} label="Valor vendido" value={formatCurrency(salesTotal)} />
        <StatCard icon={CheckCircle} label="Concluídas" value={completedSales} tone="success" />
        <StatCard icon={Paperclip} label="Comprovantes" value={evidenceCount} tone="neutral" />
      </div>

      <FilterBar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, telefone, contrato, chassi, anúncio ou cidade" className="h-10 pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-full lg:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pre_venda">Pré-venda</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="assinado">Assinado</SelectItem>
            <SelectItem value="concluido">Quitado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {loadingContracts ? (
        <PanelCard><div className="space-y-3 p-6">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div></PanelCard>
      ) : visibleSales.length === 0 ? (
        <PanelCard><div className="py-14 text-center text-sm text-muted-foreground">Nenhuma venda externa encontrada neste período.</div></PanelCard>
      ) : (
        <PanelCard
          title="Vendas registradas"
          description="Origem, atendimento, comprovantes e ações de cada venda externa"
          aside={<span className="text-xs font-medium text-muted-foreground">{visibleSales.length} venda(s)</span>}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Contrato</TableHead><TableHead>Cliente</TableHead><TableHead>Veículo</TableHead>
                  <TableHead>Origem</TableHead><TableHead>Atendimento</TableHead><TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead><TableHead>Data</TableHead><TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSales.map((sale) => {
                  const external = sale.external_data || {};
                  const status = statusConfig[sale.status] || statusConfig.pendente;
                  const VehicleIcon = sale.vehicle?.vehicle_type === 'moto' ? Bike : Car;
                  return (
                    <TableRow key={sale.id} className={cn(sale.review_status === 'questionada' && 'review-row')}>
                      <TableCell className="whitespace-nowrap font-mono text-sm">{sale.contract_number}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <p className="font-medium">{sale.buyer_name}</p>
                        <p className="text-xs text-muted-foreground">{maskCPF(sale.buyer_cpf)}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{sale.buyer_phone || 'Não informado'}</p>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-start gap-2"><VehicleIcon className="mt-0.5 h-4 w-4 text-muted-foreground" /><div>
                          <p className="text-sm">{sale.vehicle ? `${sale.vehicle.brand} ${sale.vehicle.model}` : '—'}</p>
                          <p className="text-xs text-muted-foreground">{sale.vehicle?.chassis || 'Chassi não informado'}</p>
                        </div></div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate text-sm font-medium">{sale.campaign_name || String(external.ad_description || '') || leadSourceLabel(sale.lead_source, sale.lead_source_detail)}</p>
                        <p className="truncate text-xs text-muted-foreground">{leadSourceLabel(sale.lead_source, sale.lead_source_detail)}</p>
                      </TableCell>
                      <TableCell className="min-w-[175px]">
                        <p className="text-sm">{String(external.contact_platform || 'Não informado')}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{String(external.buyer_city || 'Cidade não informada')}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3 w-3" />{sale.evidence_paths?.length || 0} arquivo(s)</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-display font-semibold">{formatCurrency(Number(sale.sale_price))}</TableCell>
                      <TableCell><Badge variant="secondary" className={cn('whitespace-nowrap text-xs font-medium', status.className)}>{status.label}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell><SaleActionsMenu sale={sale} vehicleName={sale.vehicle ? `${sale.vehicle.brand} ${sale.vehicle.model} ${sale.vehicle.year}` : undefined} storeName={sale.store?.name} resellerName={sale.reseller?.full_name} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </PanelCard>
      )}
    </div>
  );

  const teamPerformance = loadingSellers ? (
    <PanelCard><div className="space-y-3 p-6">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div></PanelCard>
  ) : (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={ShoppingCart} label="Vendas da equipe" value={teamSales} />
        <StatCard icon={TrendingUp} label="Receita externa" value={formatCurrency(teamRevenue)} />
        <StatCard icon={Target} label="Vendedores ativos" value={sellers?.length || 0} tone="neutral" />
      </div>
      <PanelCard title="Desempenho por vendedor" description="Resultados externos do período selecionado">
        {!sellers?.length ? <div className="py-14 text-center text-sm text-muted-foreground">Nenhum Vendedor ++ encontrado.</div> : (
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Vendedor ++</TableHead><TableHead>Loja</TableHead><TableHead className="text-center">Vendas</TableHead><TableHead className="text-right">Receita</TableHead></TableRow></TableHeader>
          <TableBody>{sellers.map((seller) => <TableRow key={seller.id}><TableCell><p className="font-medium">{seller.full_name}</p><p className="text-xs text-muted-foreground">{seller.email}</p></TableCell><TableCell>{seller.store_name || '—'}</TableCell><TableCell className="text-center font-mono">{seller.salesCount}</TableCell><TableCell className="text-right font-semibold">{formatCurrency(seller.salesTotal)}</TableCell></TableRow>)}</TableBody></Table></div>
        )}
      </PanelCard>
    </div>
  );

  const teamCommissions = loadingSellers ? (
    <PanelCard><div className="p-6"><Skeleton className="h-40 w-full" /></div></PanelCard>
  ) : (
    <div className="space-y-4">
      <StatCard icon={Wallet} label="Comissão estimada da equipe" value={formatCurrency(teamCommission)} hint="Período selecionado" />
      <PanelCard title="Comissões" description="Regra e valor calculado individualmente">
        {!sellers?.length ? <div className="py-14 text-center text-sm text-muted-foreground">Nenhuma comissão disponível.</div> : (
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Vendedor ++</TableHead><TableHead>Regra</TableHead><TableHead className="text-center">Vendas</TableHead><TableHead className="text-right">Comissão</TableHead></TableRow></TableHeader>
          <TableBody>{sellers.map((seller) => <TableRow key={seller.id}><TableCell className="font-medium">{seller.full_name}</TableCell><TableCell><Badge variant="outline" className="font-normal">{seller.commissionLabel}</Badge></TableCell><TableCell className="text-center font-mono">{seller.salesCount}</TableCell><TableCell className="text-right font-semibold text-primary">{seller.commissionIsManual ? 'Manual' : formatCurrency(seller.commission)}</TableCell></TableRow>)}</TableBody></Table></div>
        )}
      </PanelCard>
    </div>
  );

  const ownPerformance = loadingPanel ? <Skeleton className="h-40 w-full rounded-2xl" /> : (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={ShoppingCart} label="Minhas vendas" value={panel?.monthSales.length || 0} />
        <StatCard icon={TrendingUp} label="Valor vendido" value={formatCurrency(panel?.monthTotal || 0)} />
        <StatCard icon={Target} label="Meta do mês" value={panel?.target?.qty ? `${panel.monthSales.length}/${panel.target.qty}` : '—'} tone="neutral" />
      </div>
      <PanelCard title="Progresso da meta" description={panel?.target?.qty ? `${Math.max(0, panel.target.qty - panel.monthSales.length)} venda(s) restantes` : 'Nenhuma meta definida para este período'}>
        <div className="space-y-3 p-6"><Progress value={panel?.target?.qty ? Math.min(100, (panel.monthSales.length / panel.target.qty) * 100) : 0} />
        {panel?.target?.value ? <p className="text-xs text-muted-foreground">Meta de valor: {formatCurrency(panel.target.value)}{panel.target.bonus ? ` · Bônus: ${formatCurrency(panel.target.bonus)}` : ''}</p> : null}</div>
      </PanelCard>
    </div>
  );

  const ownCommission = loadingPanel ? <Skeleton className="h-32 w-full rounded-2xl" /> : (
    <div className="grid gap-3 lg:grid-cols-2">
      <StatCard icon={Wallet} label="Minha comissão" value={panel?.commission.isManual ? 'A definir' : formatCurrency(panel?.commission.commission || 0)} />
      <PanelCard title="Regra aplicada" description="Configuração individual do seu cargo"><div className="p-6"><p className="font-display text-xl font-semibold">{panel?.commission.label || 'Sem configuração'}</p><p className="mt-2 text-sm text-muted-foreground">Cálculo referente a {MONTHS[month - 1]} de {year}.</p></div></PanelCard>
    </div>
  );

  const ownHistory = loadingPanel ? <Skeleton className="h-56 w-full rounded-2xl" /> : (
    <PanelCard title="Histórico de comissão" description="Evolução dos últimos seis meses">
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-center">Vendas</TableHead><TableHead className="text-right">Valor vendido</TableHead><TableHead className="text-right">Comissão</TableHead></TableRow></TableHeader>
      <TableBody>{(panel?.history || []).map((item) => <TableRow key={`${item.year}-${item.month}`}><TableCell className="capitalize">{item.label}/{String(item.year).slice(2)}</TableCell><TableCell className="text-center font-mono">{item.count}</TableCell><TableCell className="text-right">{formatCurrency(item.total)}</TableCell><TableCell className="text-right font-semibold text-primary">{panel?.commission.isManual ? '—' : formatCurrency(item.commission)}</TableCell></TableRow>)}</TableBody></Table></div>
    </PanelCard>
  );

  const ownStock = loadingPanel ? <Skeleton className="h-56 w-full rounded-2xl" /> : panel?.stock.length ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{panel.stock.map((vehicle: any) => <Card key={vehicle.id} className="rounded-2xl"><CardContent className="space-y-2 p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">{vehicle.vehicle_type === 'carro' ? <Car className="h-4 w-4" /> : <Bike className="h-4 w-4" />}{vehicle.vehicle_type === 'carro' ? 'Carro' : 'Moto'}</div><p className="font-display text-lg font-semibold">{vehicle.brand} {vehicle.model}</p><p className="text-xs text-muted-foreground">{vehicle.year}{vehicle.color ? ` · ${vehicle.color}` : ''}{vehicle.plate ? ` · ${vehicle.plate}` : ''}</p><p className="font-display text-lg font-semibold text-primary">{vehicle.sale_price ? formatCurrency(Number(vehicle.sale_price)) : 'Sob consulta'}</p></CardContent></Card>)}</div>
  ) : <PanelCard><div className="py-14 text-center text-sm text-muted-foreground">Nenhum veículo disponível no momento.</div></PanelCard>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas Externas"
        description={hasElevatedAccess ? 'Vendas, desempenho e comissões organizados por área' : `Seu painel de vendas externas, ${profile?.full_name?.split(' ')[0] || ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {periodPicker}
            <Button
              variant="outline"
              onClick={() => setFreightDialogOpen(true)}
              className="h-10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            >
              <Truck className="mr-2 h-4 w-4" />
              Cotar Frete & Logística
            </Button>
            {canRegister && (
              <Button className="h-10" onClick={() => setSaleDialogOpen(true)}>
                <Megaphone className="mr-2 h-4 w-4" />Nova venda externa
              </Button>
            )}
          </div>
        }
      />

      <NewSaleDialog key={saleDialogOpen ? 'open' : 'closed'} open={saleDialogOpen} onOpenChange={setSaleDialogOpen} channel="externa" />
      <FreightCalculatorDialog open={freightDialogOpen} onOpenChange={setFreightDialogOpen} />

      {hasElevatedAccess ? (
        <Tabs defaultValue="vendas" className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="vendas">Vendas</TabsTrigger><TabsTrigger value="desempenho">Desempenho</TabsTrigger><TabsTrigger value="comissoes">Comissões</TabsTrigger>
          </TabsList>
          <TabsContent value="vendas" className="mt-0">{salesView}</TabsContent>
          <TabsContent value="desempenho" className="mt-0">{teamPerformance}</TabsContent>
          <TabsContent value="comissoes" className="mt-0">{teamCommissions}</TabsContent>
        </Tabs>
      ) : isExternalSeller ? (
        <Tabs defaultValue="vendas" className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="vendas">Vendas</TabsTrigger><TabsTrigger value="desempenho">Desempenho</TabsTrigger><TabsTrigger value="comissoes">Comissões</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger><TabsTrigger value="estoque">Estoque</TabsTrigger>
          </TabsList>
          <TabsContent value="vendas" className="mt-0">{salesView}</TabsContent>
          <TabsContent value="desempenho" className="mt-0">{ownPerformance}</TabsContent>
          <TabsContent value="comissoes" className="mt-0">{ownCommission}</TabsContent>
          <TabsContent value="historico" className="mt-0">{ownHistory}</TabsContent>
          <TabsContent value="estoque" className="mt-0">{ownStock}</TabsContent>
        </Tabs>
      ) : (
        <PanelCard><div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />Você não tem acesso às vendas externas.</div></PanelCard>
      )}
    </div>
  );
}
