import { useMemo, useState } from 'react';
import {
  ExternalLink,
  Instagram,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStores } from '@/hooks/useStores';
import {
  AD_PLATFORM_LABEL,
  AD_STATUS_LABEL,
  useAdSales,
  useDeleteStoreAd,
  useStoreAds,
  type StoreAd,
} from '@/hooks/useStoreAds';
import { adLibraryUrl, instagramProfileUrl } from '@/lib/adLibrary';
import { AdFormDialog } from '@/components/ads/AdFormDialog';
import { AdThumb } from '@/components/ads/AdPicker';
import { StoreEditDialog } from '@/components/dialogs/StoreEditDialog';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const ALL = '__all__';

export default function Ads() {
  const { data: stores = [], isLoading: loadingStores } = useStores();
  const [storeId, setStoreId] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreAd | null>(null);
  const [deleting, setDeleting] = useState<StoreAd | null>(null);
  const [editStore, setEditStore] = useState(false);
  const deleteAd = useDeleteStoreAd();

  const activeStores = stores.filter((s) => s.is_active);
  const selectedStore = stores.find((s) => s.id === storeId) || null;
  const { data: ads = [], isLoading: loadingAds } = useStoreAds(storeId === ALL ? null : storeId);
  const { data: sales = [] } = useAdSales();

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name || '—';

  // Métricas por anúncio e por campanha
  const perAd = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    for (const s of sales) {
      if (!s.ad_id) continue;
      map[s.ad_id] ??= { count: 0, revenue: 0 };
      map[s.ad_id].count += 1;
      map[s.ad_id].revenue += Number(s.sale_price || 0);
    }
    return map;
  }, [sales]);

  const perCampaign = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; spent: number; store_id: string }> = {};
    const key = (sid: string, c: string) => `${sid}::${c}`;
    for (const a of ads) {
      const k = key(a.store_id, a.campaign_name);
      map[k] ??= { count: 0, revenue: 0, spent: 0, store_id: a.store_id };
      map[k].spent += Number(a.budget_spent || 0);
    }
    for (const s of sales) {
      if (!s.campaign_name) continue;
      if (storeId !== ALL && s.store_id !== storeId) continue;
      const k = key(s.store_id, s.campaign_name);
      map[k] ??= { count: 0, revenue: 0, spent: 0, store_id: s.store_id };
      map[k].count += 1;
      map[k].revenue += Number(s.sale_price || 0);
    }
    return Object.entries(map)
      .map(([k, v]) => ({ campaign: k.split('::')[1], ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [ads, sales, storeId]);

  const perStore = useMemo(() => {
    const map: Record<string, { vendas: number; faturamento: number; gasto: number }> = {};
    for (const s of stores) map[s.id] = { vendas: 0, faturamento: 0, gasto: 0 };
    for (const s of sales) {
      if (!map[s.store_id]) continue;
      map[s.store_id].vendas += 1;
      map[s.store_id].faturamento += Number(s.sale_price || 0);
    }
    return Object.entries(map)
      .map(([id, v]) => ({ loja: storeName(id), ...v }))
      .filter((r) => r.vendas > 0)
      .sort((a, b) => b.faturamento - a.faturamento);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, stores]);

  const timeline = useMemo(() => {
    const map: Record<string, { vendas: number; faturamento: number }> = {};
    for (const s of sales) {
      if (storeId !== ALL && s.store_id !== storeId) continue;
      const d = new Date(s.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[k] ??= { vendas: 0, faturamento: 0 };
      map[k].vendas += 1;
      map[k].faturamento += Number(s.sale_price || 0);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ mes: k.split('-').reverse().join('/'), ...v }));
  }, [sales, storeId]);

  const visibleSales = storeId === ALL ? sales : sales.filter((s) => s.store_id === storeId);
  const totalSpent = ads.reduce((acc, a) => acc + Number(a.budget_spent || 0), 0);
  const totalRevenue = visibleSales.reduce((acc, s) => acc + Number(s.sale_price || 0), 0);
  const costPerSale = visibleSales.length ? totalSpent / visibleSales.length : 0;
  const activeAds = ads.filter((a) => a.status === 'ativo').length;
  const storesWithoutHandle = activeStores.filter((s) => !s.instagram_handle);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Anúncios"
        description="Mapeie o que cada loja está anunciando e de onde cada venda realmente saiu."
        actions={<>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as lojas</SelectItem>
              {activeStores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo anúncio
          </Button>
        </>}
      />

      {/* Loja selecionada: @ e atalhos */}
      {selectedStore ? (
        <Card className="animate-slide-up">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Instagram className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedStore.name}</p>
                {selectedStore.instagram_handle ? (
                  <a
                    href={instagramProfileUrl(selectedStore.instagram_handle)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    @{selectedStore.instagram_handle}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem @ do Instagram cadastrado</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedStore.instagram_handle ? (
                <Button asChild variant="outline" size="sm">
                  <a href={adLibraryUrl(selectedStore.instagram_handle)} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Ver anúncios ativos na Biblioteca da Meta
                  </a>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => setEditStore(true)}>
                <Pencil className="w-4 h-4 mr-2" /> {selectedStore.instagram_handle ? 'Alterar @' : 'Cadastrar @'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : storesWithoutHandle.length > 0 && !loadingStores ? (
        <Card className="border-dashed animate-slide-up">
          <CardContent className="py-3 flex items-start gap-2.5 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {storesWithoutHandle.length === 1
                ? `A loja ${storesWithoutHandle[0].name} ainda não tem @ do Instagram.`
                : `${storesWithoutHandle.length} lojas ainda não têm @ do Instagram.`}{' '}
              Selecione a loja acima para cadastrar.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <Kpi label="Anúncios ativos" value={String(activeAds)} />
        <Kpi label="Vendas por anúncio" value={String(visibleSales.length)} />
        <Kpi label="Faturamento" value={brl(totalRevenue)} />
        <Kpi label="Custo por venda" value={totalSpent ? brl(costPerSale) : '—'} hint={totalSpent ? `Verba ${brl(totalSpent)}` : 'Informe a verba dos anúncios'} />
      </div>

      <Tabs defaultValue="anuncios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="anuncios">Anúncios</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="lojas">Comparativo de lojas</TabsTrigger>
          <TabsTrigger value="tempo">Linha do tempo</TabsTrigger>
        </TabsList>

        <TabsContent value="anuncios" className="mt-0">
          {loadingAds ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : ads.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Megaphone className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-2">Nenhum anúncio cadastrado</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {selectedStore
                    ? 'Abra a Biblioteca da Meta pelo botão acima, veja os anúncios que estão rodando e cadastre cada um aqui com um print.'
                    : 'Selecione uma loja para cadastrar os anúncios que ela está rodando.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ads.map((ad, i) => {
                const m = perAd[ad.id] || { count: 0, revenue: 0 };
                const cps = m.count && ad.budget_spent ? Number(ad.budget_spent) / m.count : null;
                return (
                  <Card key={ad.id} className="overflow-hidden animate-scale-in group" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="relative">
                      <AdThumb path={ad.image_url} className="w-full aspect-[4/3] rounded-none" />
                      <div className="absolute top-2 left-2 flex gap-1.5">
                        <Badge variant={ad.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">
                          {AD_STATUS_LABEL[ad.status]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-background/80">
                          {AD_PLATFORM_LABEL[ad.platform]}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="secondary" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(ad); setFormOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            {ad.ad_url && (
                              <DropdownMenuItem asChild>
                                <a href={ad.ad_url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" /> Abrir anúncio
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(ad)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{ad.campaign_name}</p>
                        <p className="font-medium leading-tight">{ad.title}</p>
                        {storeId === ALL && (
                          <p className="text-xs text-muted-foreground mt-0.5">{storeName(ad.store_id)}</p>
                        )}
                      </div>
                      {ad.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{ad.caption}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <Stat label="Vendas" value={String(m.count)} />
                        <Stat label="Faturou" value={m.revenue ? brl(m.revenue) : '—'} />
                        <Stat label="Custo/venda" value={cps ? brl(cps) : '—'} />
                      </div>
                      {(ad.started_at || ad.ended_at) && (
                        <p className="text-[11px] text-muted-foreground">
                          {ad.started_at ? new Date(ad.started_at + 'T00:00:00').toLocaleDateString('pt-BR') : '…'}
                          {' → '}
                          {ad.ended_at ? new Date(ad.ended_at + 'T00:00:00').toLocaleDateString('pt-BR') : 'em andamento'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campanhas" className="mt-0">
          <Card>
            <CardContent className="p-0">
              {perCampaign.length === 0 ? (
                <Empty text="Nenhuma venda vinculada a campanhas ainda." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      {storeId === ALL && <TableHead>Loja</TableHead>}
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Verba</TableHead>
                      <TableHead className="text-right">Custo/venda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perCampaign.map((r) => (
                      <TableRow key={`${r.store_id}-${r.campaign}`}>
                        <TableCell className="font-medium">{r.campaign}</TableCell>
                        {storeId === ALL && <TableCell className="text-muted-foreground">{storeName(r.store_id)}</TableCell>}
                        <TableCell className="text-right">{r.count}</TableCell>
                        <TableCell className="text-right">{brl(r.revenue)}</TableCell>
                        <TableCell className="text-right">{r.spent ? brl(r.spent) : '—'}</TableCell>
                        <TableCell className="text-right">{r.spent && r.count ? brl(r.spent / r.count) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lojas" className="mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Faturamento vindo de anúncios por loja</CardTitle>
            </CardHeader>
            <CardContent>
              {perStore.length === 0 ? (
                <Empty text="Nenhuma venda de anúncio registrada ainda." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={perStore}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="loja" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => brl(v)} width={90} />
                    <Tooltip
                      formatter={(v: number, name: string) => (name === 'faturamento' ? brl(v) : v)}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    />
                    <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {perStore.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perStore.map((r) => (
                    <div key={r.loja} className="rounded-lg border p-3 text-sm flex items-center justify-between">
                      <span className="font-medium truncate">{r.loja}</span>
                      <span className="text-muted-foreground">{r.vendas} vendas · {brl(r.faturamento)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tempo" className="mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Vendas de anúncios por mês</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <Empty text="Sem histórico ainda." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number, name: string) => (name === 'faturamento' ? brl(v) : v)}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="vendas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AdFormDialog
        storeId={selectedStore?.id || activeStores[0]?.id || 'store-divinopolis'}
        ad={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <StoreEditDialog store={selectedStore} open={editStore} onOpenChange={setEditStore} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anúncio?</AlertDialogTitle>
            <AlertDialogDescription>
              As vendas já vinculadas a "{deleting?.title}" continuam registradas, mas perdem o vínculo com este anúncio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) deleteAd.mutate(deleting); setDeleting(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('rounded-md bg-muted/40 py-1.5')}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold truncate px-1">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{text}</p>;
}
