import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScanBarcode,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Copy,
  Download,
  Trash2,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { useStores } from '@/hooks/useStores';
import { formatStoreShortName } from '@/lib/storeResolution';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { exportToXLSX } from '@/lib/export';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface RawVehicle {
  id: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  chassis: string | null;
  status: string;
  store_id: string | null;
  sale_price: number | null;
  created_at: string;
}

interface RawContract {
  id: string;
  contract_number: string | null;
  vehicle_id: string | null;
  buyer_name: string | null;
  sale_price: number | null;
  status: string | null;
  store_id: string | null;
  created_at: string;
  external_data: any;
}

type CheckStatus = 'disponivel' | 'reservado' | 'vendido' | 'divergencia' | 'nao_cadastrado';

interface CheckRow {
  input: string;
  clean: string;
  status: CheckStatus;
  vehicles: RawVehicle[];
  contracts: RawContract[];
  note: string;
}

function normalizeChassis(raw?: string | null): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function matchChassis(targetClean: string, candidateClean: string): boolean {
  if (!targetClean || !candidateClean) return false;
  if (targetClean === candidateClean) return true;
  if (targetClean.length >= 6 && candidateClean.length >= 6) {
    return candidateClean.endsWith(targetClean) || targetClean.endsWith(candidateClean);
  }
  return false;
}

export function ChassisAuditPanel() {
  const { toast } = useToast();
  const { data: stores = [] } = useStores();

  const [mode, setMode] = useState<'batch' | 'catalog'>('batch');
  const [batchInput, setBatchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CheckStatus>('all');

  // Filtros do catálogo completo
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogStore, setCatalogStore] = useState('all');
  const [catalogStatus, setCatalogStatus] = useState('all');

  const vehiclesQuery = useQuery<RawVehicle[]>({
    queryKey: ['admin-chassis-audit-vehicles'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await (supabase as any)
        .from('vehicles')
        .select('id, brand, model, color, year, chassis, status, store_id, sale_price, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RawVehicle[];
    },
    staleTime: 30_000,
  });

  const contractsQuery = useQuery<RawContract[]>({
    queryKey: ['admin-chassis-audit-contracts'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await (supabase as any)
        .from('contracts')
        .select('id, contract_number, vehicle_id, buyer_name, sale_price, status, store_id, created_at, external_data')
        .eq('is_deleted', false)
        .neq('contract_number', 'DEALFLOW_GLOBAL_SYNC')
        .neq('status', 'cancelado')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as RawContract[];
    },
    staleTime: 30_000,
  });

  const vehicles = vehiclesQuery.data || [];
  const contracts = contractsQuery.data || [];
  const isRefreshing = vehiclesQuery.isFetching || contractsQuery.isFetching;

  const storeNameById = useMemo(() => {
    const map = new Map<string, string>();
    stores.forEach((s) => map.set(s.id, formatStoreShortName(s.name)));
    return map;
  }, [stores]);

  const getStoreLabel = (storeId?: string | null) => {
    if (!storeId) return 'Sem loja';
    return storeNameById.get(storeId) || formatStoreShortName(storeId);
  };

  // Indexa contratos por vehicle_id e por chassi normalizado
  const contractsIndex = useMemo(() => {
    const byVehicleId = new Map<string, RawContract[]>();
    const withChassis: Array<{ clean: string; contract: RawContract }> = [];

    contracts.forEach((c) => {
      if (c.vehicle_id) {
        const list = byVehicleId.get(c.vehicle_id) || [];
        list.push(c);
        byVehicleId.set(c.vehicle_id, list);
      }
      const ext = c.external_data || {};
      const ch = normalizeChassis(ext.chassis || ext.chassi || ext.vehicle_chassis);
      if (ch.length >= 6 && ch !== 'DISPENSADO') {
        withChassis.push({ clean: ch, contract: c });
      }
    });

    return { byVehicleId, withChassis };
  }, [contracts]);

  const vehiclesWithClean = useMemo(
    () =>
      vehicles.map((v) => ({
        vehicle: v,
        clean: normalizeChassis(v.chassis),
      })),
    [vehicles]
  );

  // Processa a lista colada/digitada no conferidor em lote
  const checkResults = useMemo<CheckRow[]>(() => {
    const tokens = batchInput
      .split(/[\n,;\t\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4);

    if (tokens.length === 0) return [];

    const seen = new Set<string>();
    const rows: CheckRow[] = [];

    tokens.forEach((token) => {
      const clean = normalizeChassis(token);
      if (!clean || seen.has(clean)) return;
      seen.add(clean);

      const matchedVehicles = vehiclesWithClean
        .filter((item) => matchChassis(clean, item.clean))
        .map((item) => item.vehicle);

      const matchedContractMap = new Map<string, RawContract>();
      matchedVehicles.forEach((v) => {
        (contractsIndex.byVehicleId.get(v.id) || []).forEach((c) => matchedContractMap.set(c.id, c));
      });
      contractsIndex.withChassis.forEach(({ clean: cClean, contract }) => {
        if (matchChassis(clean, cClean)) {
          matchedContractMap.set(contract.id, contract);
        }
      });
      const matchedContracts = Array.from(matchedContractMap.values());

      let status: CheckStatus = 'nao_cadastrado';
      let note = 'Não localizado no estoque nem em vendas.';

      if (matchedVehicles.length === 0 && matchedContracts.length === 0) {
        status = 'nao_cadastrado';
      } else if (matchedVehicles.length > 1) {
        status = 'divergencia';
        note = `Chassi duplicado em ${matchedVehicles.length} registros do estoque.`;
      } else if (matchedVehicles.length === 1) {
        const v = matchedVehicles[0];
        const hasSale = matchedContracts.length > 0;
        if (hasSale && v.status !== 'vendido') {
          status = 'divergencia';
          note = `Consta em venda (${matchedContracts[0].contract_number || 'sem nº'}), mas no estoque está "${v.status}".`;
        } else if (v.status === 'vendido' || hasSale) {
          status = 'vendido';
          note = hasSale
            ? `Vendido (${matchedContracts[0].contract_number || 'contrato'} - ${matchedContracts[0].buyer_name || 'cliente'}).`
            : 'Marcado como vendido no estoque (sem contrato vinculado).';
        } else if (v.status === 'reservado') {
          status = 'reservado';
          note = 'Reservado no estoque.';
        } else {
          status = 'disponivel';
          note = 'Cadastrado e disponível no pátio.';
        }
      } else if (matchedContracts.length > 0) {
        status = 'divergencia';
        note = `Consta apenas em venda (${matchedContracts[0].contract_number || 'sem nº'}), sem registro no estoque.`;
      }

      rows.push({
        input: token.toUpperCase(),
        clean,
        status,
        vehicles: matchedVehicles,
        contracts: matchedContracts,
        note,
      });
    });

    return rows;
  }, [batchInput, vehiclesWithClean, contractsIndex]);

  const counts = useMemo(() => {
    const c = {
      all: checkResults.length,
      disponivel: 0,
      reservado: 0,
      vendido: 0,
      divergencia: 0,
      nao_cadastrado: 0,
    };
    checkResults.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [checkResults]);

  const filteredCheckResults = useMemo(() => {
    if (statusFilter === 'all') return checkResults;
    return checkResults.filter((r) => r.status === statusFilter);
  }, [checkResults, statusFilter]);

  // Catálogo completo de chassis cadastrados
  const catalogRows = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const qClean = normalizeChassis(catalogSearch);
    return vehicles
      .filter((v) => Boolean(v.chassis && v.chassis.trim()))
      .filter((v) => {
        if (catalogStore !== 'all' && v.store_id !== catalogStore) return false;
        if (catalogStatus !== 'all' && v.status !== catalogStatus) return false;
        if (!q) return true;
        const chClean = normalizeChassis(v.chassis);
        const linked = contractsIndex.byVehicleId.get(v.id)?.[0];
        return (
          (qClean.length >= 3 && chClean.includes(qClean)) ||
          (v.model || '').toLowerCase().includes(q) ||
          (v.brand || '').toLowerCase().includes(q) ||
          (v.color || '').toLowerCase().includes(q) ||
          (linked?.buyer_name || '').toLowerCase().includes(q) ||
          (linked?.contract_number || '').toLowerCase().includes(q)
        );
      });
  }, [vehicles, catalogSearch, catalogStore, catalogStatus, contractsIndex]);

  const handleRefresh = () => {
    vehiclesQuery.refetch();
    contractsQuery.refetch();
    toast({ title: 'Base de chassis atualizada do banco de dados.' });
  };

  const handleCopyNotFound = () => {
    const list = checkResults.filter((r) => r.status === 'nao_cadastrado').map((r) => r.input);
    if (list.length === 0) {
      toast({ title: 'Nenhum chassi não cadastrado na conferência atual.' });
      return;
    }
    navigator.clipboard.writeText(list.join('\n'));
    toast({
      title: `${list.length} chassi(s) copiado(s)!`,
      description: 'Lista de chassis não cadastrados copiada para a área de transferência.',
    });
  };

  const handleExportBatch = () => {
    if (checkResults.length === 0) return;
    const rows = checkResults.map((r) => {
      const v = r.vehicles[0];
      const c = r.contracts[0];
      return {
        Chassi_Informado: r.input,
        Situacao:
          r.status === 'disponivel'
            ? 'Disponível'
            : r.status === 'reservado'
              ? 'Reservado'
              : r.status === 'vendido'
                ? 'Vendido'
                : r.status === 'divergencia'
                  ? 'Divergência'
                  : 'Não Cadastrado',
        Chassi_Sistema: v?.chassis || '—',
        Modelo: v ? `${v.brand || ''} ${v.model || ''}`.trim() : '—',
        Cor: v?.color || '—',
        Loja: v ? getStoreLabel(v.store_id) : '—',
        Status_Estoque: v?.status || '—',
        Contrato: c?.contract_number || '—',
        Comprador: c?.buyer_name || '—',
        Observacao: r.note,
      };
    });
    exportToXLSX(rows, `conferencia_chassis_${new Date().toISOString().slice(0, 10)}`);
  };

  const renderStatusBadge = (status: CheckStatus) => {
    switch (status) {
      case 'disponivel':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1" variant="outline">
            <CheckCircle2 className="w-3 h-3" /> Disponível
          </Badge>
        );
      case 'reservado':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1" variant="outline">
            <Clock className="w-3 h-3" /> Reservado
          </Badge>
        );
      case 'vendido':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1" variant="outline">
            <Package className="w-3 h-3" /> Vendido
          </Badge>
        );
      case 'divergencia':
        return (
          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 gap-1" variant="outline">
            <AlertTriangle className="w-3 h-3" /> Divergência
          </Badge>
        );
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1" variant="outline">
            <XCircle className="w-3 h-3" /> Não Cadastrado
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ScanBarcode className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold">Conferência Exclusiva de Chassis</CardTitle>
                <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 gap-1">
                  <ShieldCheck className="w-3 h-3" /> Somente Admin Master
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Cole uma lista de chassis (ou últimos 6+ dígitos) para conferir instantaneamente o status no Estoque e em Vendas, ou pesquise toda a base cadastrada ({vehicles.filter((v) => v.chassis).length} chassis no banco).
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-1.5 text-xs h-9 shrink-0">
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              Atualizar Base
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'batch' | 'catalog')} className="space-y-4">
            <TabsList className="h-9 bg-muted/70 p-1">
              <TabsTrigger value="batch" className="text-xs gap-1.5">
                <ScanBarcode className="w-3.5 h-3.5" />
                Conferir Lista / Bipar
              </TabsTrigger>
              <TabsTrigger value="catalog" className="text-xs gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Todos os Chassis Cadastrados ({vehicles.filter((v) => v.chassis).length})
              </TabsTrigger>
            </TabsList>

            {/* MODO 1: CONFERÊNCIA EM LOTE */}
            <TabsContent value="batch" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  rows={4}
                  placeholder="Cole aqui os chassis (um por linha, ou separados por vírgula/espaço) ou bipe com o leitor de código de barras. Aceita chassi completo ou os últimos 6+ dígitos..."
                  className="font-mono text-xs rounded-xl"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {counts.all > 0
                      ? `${counts.all} chassi(s) único(s) analisado(s) contra ${vehicles.length} veículos e ${contracts.length} vendas.`
                      : 'Digite, cole ou bipe qualquer chassi acima para conferir em tempo real.'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {counts.nao_cadastrado > 0 && (
                      <Button variant="outline" size="sm" onClick={handleCopyNotFound} className="h-8 text-xs gap-1.5">
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Não Cadastrados ({counts.nao_cadastrado})
                      </Button>
                    )}
                    {counts.all > 0 && (
                      <>
                        <Button variant="outline" size="sm" onClick={handleExportBatch} className="h-8 text-xs gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          Exportar XLSX
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBatchInput('');
                            setStatusFilter('all');
                          }}
                          className="h-8 text-xs gap-1 text-muted-foreground"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Limpar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {counts.all > 0 && (
                <>
                  {/* KPIs Clicáveis */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {(
                      [
                        { key: 'all', label: 'Conferidos', value: counts.all, cls: 'border-border' },
                        { key: 'disponivel', label: 'Disponíveis', value: counts.disponivel, cls: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300' },
                        { key: 'reservado', label: 'Reservados', value: counts.reservado, cls: 'border-amber-500/30 text-amber-700 dark:text-amber-300' },
                        { key: 'vendido', label: 'Vendidos', value: counts.vendido, cls: 'border-blue-500/30 text-blue-700 dark:text-blue-300' },
                        { key: 'divergencia', label: 'Divergências', value: counts.divergencia, cls: 'border-orange-500/30 text-orange-700 dark:text-orange-300' },
                        { key: 'nao_cadastrado', label: 'Não Cadastrados', value: counts.nao_cadastrado, cls: 'border-rose-500/30 text-rose-700 dark:text-rose-300' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setStatusFilter(item.key)}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-all bg-card hover:bg-muted/40',
                          item.cls,
                          statusFilter === item.key && 'ring-2 ring-primary/40 bg-primary/5'
                        )}
                      >
                        <div className="text-[10.5px] text-muted-foreground font-medium">{item.label}</div>
                        <div className="text-lg font-black font-mono mt-0.5">{item.value}</div>
                      </button>
                    ))}
                  </div>

                  {/* Tabela de Resultados */}
                  <div className="rounded-xl border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Chassi Informado</TableHead>
                          <TableHead>Situação</TableHead>
                          <TableHead>Veículo / Loja</TableHead>
                          <TableHead>Vínculo de Venda</TableHead>
                          <TableHead>Observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCheckResults.map((row) => {
                          const v = row.vehicles[0];
                          const c = row.contracts[0];
                          return (
                            <TableRow key={row.clean} className="text-xs">
                              <TableCell className="font-mono font-bold">
                                <div>{row.input}</div>
                                {v?.chassis && normalizeChassis(v.chassis) !== row.clean && (
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    Completo: {v.chassis}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{renderStatusBadge(row.status)}</TableCell>
                              <TableCell>
                                {v ? (
                                  <div>
                                    <div className="font-semibold">
                                      {v.brand} {v.model} {v.color ? `• ${v.color}` : ''}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {getStoreLabel(v.store_id)} • {v.sale_price ? formatCurrencyBRL(v.sale_price) : 'Sem preço'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {c ? (
                                  <div>
                                    <div className="font-semibold font-mono">{c.contract_number || 'Sem nº'}</div>
                                    <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                      {c.buyer_name || 'Cliente'} • {c.sale_price ? formatCurrencyBRL(c.sale_price) : 'R$ 0,00'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-[11px] text-muted-foreground max-w-[260px]">
                                {row.note}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            {/* MODO 2: CATÁLOGO COMPLETO DE CHASSIS CADASTRADOS */}
            <TabsContent value="catalog" className="space-y-3 mt-0">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar por chassi, final do chassi, modelo, cor ou cliente..."
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <select
                  value={catalogStore}
                  onChange={(e) => setCatalogStore(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-xs"
                >
                  <option value="all">Todas as Lojas</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatStoreShortName(s.name)}
                    </option>
                  ))}
                </select>
                <select
                  value={catalogStatus}
                  onChange={(e) => setCatalogStatus(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-xs"
                >
                  <option value="all">Todos os Status</option>
                  <option value="disponivel">Disponível</option>
                  <option value="reservado">Reservado</option>
                  <option value="vendido">Vendido</option>
                </select>
              </div>

              <div className="rounded-xl border overflow-x-auto max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="text-xs">
                      <TableHead>Chassi</TableHead>
                      <TableHead>Modelo / Cor</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Status Estoque</TableHead>
                      <TableHead>Venda Vinculada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          Nenhum chassi encontrado com os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      catalogRows.slice(0, 200).map((v) => {
                        const linked = contractsIndex.byVehicleId.get(v.id)?.[0];
                        return (
                          <TableRow key={v.id} className="text-xs">
                            <TableCell className="font-mono font-bold">{v.chassis}</TableCell>
                            <TableCell>
                              <div className="font-semibold">
                                {v.brand} {v.model}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {v.color || 'Sem cor'} {v.year ? `• ${v.year}` : ''}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{getStoreLabel(v.store_id)}</TableCell>
                            <TableCell>
                              {renderStatusBadge(
                                linked && v.status !== 'vendido'
                                  ? 'divergencia'
                                  : v.status === 'vendido'
                                    ? 'vendido'
                                    : v.status === 'reservado'
                                      ? 'reservado'
                                      : 'disponivel'
                              )}
                            </TableCell>
                            <TableCell>
                              {linked ? (
                                <div>
                                  <span className="font-mono font-semibold">{linked.contract_number}</span>
                                  <span className="text-muted-foreground"> • {linked.buyer_name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {catalogRows.length > 200 && (
                <p className="text-[11px] text-muted-foreground">
                  Exibindo os primeiros 200 de {catalogRows.length} chassis. Refine a busca acima para localizar um chassi específico.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
