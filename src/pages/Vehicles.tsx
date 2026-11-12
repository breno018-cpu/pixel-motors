import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
  Bike,
  CalendarClock,
  Car,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Flame,
  LayoutGrid,
  ListFilter,
  Package,
  Boxes,
  Plus,
  ScanLine,
  FileCheck,
  Search,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  User,
  X,
  Truck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard, PanelCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useVehicles, type Vehicle } from '@/hooks/useVehicles';
import { useVehicleModels, effectiveModelPrice } from '@/hooks/useVehicleModels';
import { normalizeName } from '@/lib/vehicleCatalog';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VehicleFormDialog } from '@/components/forms/VehicleFormDialog';
import { BatchVehicleEntryDialog } from '@/components/forms/BatchVehicleEntryDialog';
import { BarcodeScannerDialog } from '@/components/vehicles/BarcodeScannerDialog';
import { VehicleActionsMenu } from '@/components/actions/VehicleActionsMenu';
import { ReservationsPanel } from '@/components/vehicles/ReservationsPanel';
import { TransfersPanel } from '@/components/vehicles/TransfersPanel';
import { StockTransferDialog } from '@/components/vehicles/StockTransferDialog';
import { NewSaleDialog } from '@/components/sales/NewSaleDialog';
import { CreateReservationDialog } from '@/components/reservations/CreateReservationDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useInspections } from '@/hooks/useInspections';
import { LaudosTabPanel } from '@/components/inspections/LaudosTabPanel';
import InboundCargo from '@/pages/InboundCargo';
import { cn } from '@/lib/utils';

const statusConfig = {
  disponivel: { label: 'Disponível', class: 'bg-success/10 text-success border-success/20' },
  reservado: { label: 'Reservado', class: 'bg-warning/10 text-warning border-warning/20' },
  vendido: { label: 'Vendido', class: 'bg-muted text-muted-foreground border-border' },
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getDaysInStock(createdAt: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const diff = Date.now() - created;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getAgingBadgeClass(days: number): string {
  if (days > 60) return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (days > 30) return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-border/70 bg-muted/40 text-muted-foreground';
}

type ModelGroup = {
  key: string;
  brand: string;
  model: string;
  type: 'moto' | 'carro';
  vehicles: Vehicle[];
  colors: [string, number][];
  available: number;
  reserved: number;
  sold: number;
  price: number | null;
  listPrice: number | null;
  isPromo: boolean;
  promoLabel: string | null;
  promoEndsOn: string | null;
  maxAgingDays: number;
  avgAgingDays: number;
  totalValue: number;
};

type ViewMode = 'grouped' | 'units';
type SortBy = 'default' | 'qty_desc' | 'aging_desc' | 'price_asc' | 'price_desc';

export default function Vehicles() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // 'active' | 'disponivel' | 'reservado' | 'aging60' | 'vendido'
  const [typeFilter, setTypeFilter] = useState<'all' | 'moto' | 'carro'>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState(searchParams.get('store') || 'all');
  const [resellerFilter, setResellerFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [saleVehicleId, setSaleVehicleId] = useState<string | null>(null);
  const [reserveVehicleId, setReserveVehicleId] = useState<string | null>(null);
  const [scannedChassisForForm, setScannedChassisForForm] = useState<string>('');
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'estoque');

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== tab) {
      setTab(urlTab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    const next = new URLSearchParams(searchParams);
    if (newTab === 'estoque') {
      next.delete('tab');
    } else {
      next.set('tab', newTab);
    }
    setSearchParams(next, { replace: true });
  };

  const { data: vehicles, isLoading } = useVehicles();
  const { inspections = [] } = useInspections();
  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const { data: models } = useVehicleModels();
  const {
    isAdmin,
    hasElevatedAccess,
    canRegisterVehicles,
    canCreateSales,
    canViewMargins,
    userStore,
  } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setFormOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!hasElevatedAccess && userStore?.id) setStoreFilter(userStore.id);
  }, [hasElevatedAccess, userStore?.id]);

  // Lista base de veículos ativos no escopo de loja/revendedor (para contadores globais)
  const scopedVehicles = useMemo(() => {
    return (vehicles || []).filter((vehicle) => {
      const matchesStore = storeFilter === 'all' || vehicle.store_id === storeFilter;
      const matchesReseller =
        resellerFilter === 'all' ||
        (resellerFilter === 'loja'
          ? !vehicle.reseller_id
          : vehicle.reseller_id === resellerFilter);
      const matchesType =
        typeFilter === 'all' || (vehicle.vehicle_type || 'carro') === typeFilter;
      return matchesStore && matchesReseller && matchesType;
    });
  }, [vehicles, storeFilter, resellerFilter, typeFilter]);

  const activeInventory = useMemo(
    () => scopedVehicles.filter((v) => v.status !== 'vendido'),
    [scopedVehicles],
  );

  // Todas as cores disponíveis para filtro rápido
  const availableColors = useMemo(() => {
    const counts = new Map<string, number>();
    activeInventory.forEach((v) => {
      const c = v.color?.trim();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeInventory]);

  const filteredVehicles = useMemo(() => {
    const list = scopedVehicles.filter((vehicle) => {
      if (statusFilter === 'all') {
        // Exibe todos os veículos
      } else if (statusFilter === 'active') {
        if (vehicle.status === 'vendido') return false;
      } else if (statusFilter === 'aging60') {
        if (vehicle.status === 'vendido' || getDaysInStock(vehicle.created_at) <= 60) {
          return false;
        }
      } else if (vehicle.status !== statusFilter) {
        return false;
      }

      if (colorFilter !== 'all') {
        const vColor = (vehicle.color?.trim() || 'Sem cor informada').toLowerCase();
        if (vColor !== colorFilter.toLowerCase()) return false;
      }

      if (!search.trim()) return true;
      const searchLower = search.toLowerCase().trim();
      const searchDigits = search.replace(/\D/g, '');
      return (
        vehicle.brand.toLowerCase().includes(searchLower) ||
        vehicle.model.toLowerCase().includes(searchLower) ||
        `${vehicle.brand} ${vehicle.model}`.toLowerCase().includes(searchLower) ||
        vehicle.plate?.toLowerCase().includes(searchLower) ||
        vehicle.chassis?.toLowerCase().includes(searchLower) ||
        Boolean(searchDigits && vehicle.renavam?.includes(searchDigits)) ||
        vehicle.color?.toLowerCase().includes(searchLower) ||
        String(vehicle.year).includes(searchLower)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'aging_desc') {
        return getDaysInStock(b.created_at) - getDaysInStock(a.created_at);
      }
      if (sortBy === 'price_asc') {
        return (a.sale_price || 0) - (b.sale_price || 0);
      }
      if (sortBy === 'price_desc') {
        return (b.sale_price || 0) - (a.sale_price || 0);
      }
      // Default: disponíveis primeiro, depois mais recentes
      if (a.status !== b.status) {
        return a.status === 'disponivel' ? -1 : 1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [scopedVehicles, statusFilter, colorFilter, search, sortBy]);

  const modelGroups = useMemo<ModelGroup[]>(() => {
    const grouped = new Map<string, Vehicle[]>();
    filteredVehicles.forEach((vehicle) => {
      const key = `${vehicle.vehicle_type || 'carro'}::${vehicle.brand.trim()}::${vehicle.model.trim()}`.toLowerCase();
      grouped.set(key, [...(grouped.get(key) || []), vehicle]);
    });

    const groups = Array.from(grouped.entries()).map(([key, list]) => {
      const colorCounts = new Map<string, number>();
      let agingSum = 0;
      let maxAging = 0;
      let totalVal = 0;

      list.forEach((vehicle) => {
        const color = vehicle.color?.trim() || 'Sem cor informada';
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
        const days = getDaysInStock(vehicle.created_at);
        agingSum += days;
        if (days > maxAging) maxAging = days;
        totalVal += Number(vehicle.sale_price) || 0;
      });

      const type = (list[0].vehicle_type === 'moto' ? 'moto' : 'carro') as ModelGroup['type'];
      const catalog = (models || []).find(
        (item) =>
          item.vehicle_type === type &&
          normalizeName(item.brand) === normalizeName(list[0].brand) &&
          normalizeName(item.model) === normalizeName(list[0].model),
      );
      const priced = catalog ? effectiveModelPrice(catalog) : { price: null, isPromo: false };

      return {
        key,
        brand: list[0].brand,
        model: list[0].model,
        type,
        vehicles: list,
        colors: Array.from(colorCounts.entries()).sort((a, b) => b[1] - a[1]),
        available: list.filter((vehicle) => vehicle.status === 'disponivel').length,
        reserved: list.filter((vehicle) => vehicle.status === 'reservado').length,
        sold: list.filter((vehicle) => vehicle.status === 'vendido').length,
        price:
          priced.price ?? list.find((item) => (item.sale_price ?? 0) > 0)?.sale_price ?? null,
        listPrice: (catalog?.default_sale_price ?? 0) > 0 ? catalog!.default_sale_price : null,
        isPromo: priced.isPromo,
        promoLabel: catalog?.promo_label ?? null,
        promoEndsOn: catalog?.promo_ends_on ?? null,
        maxAgingDays: maxAging,
        avgAgingDays: list.length > 0 ? Math.round(agingSum / list.length) : 0,
        totalValue: totalVal,
      };
    });

    return groups.sort((a, b) => {
      if (sortBy === 'qty_desc') return b.vehicles.length - a.vehicles.length;
      if (sortBy === 'aging_desc') return b.maxAgingDays - a.maxAgingDays;
      if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
      return (
        Number(b.isPromo) - Number(a.isPromo) ||
        b.vehicles.length - a.vehicles.length ||
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)
      );
    });
  }, [filteredVehicles, models, sortBy]);

  const activeGroup = modelGroups.find((group) => group.key === selectedModel);

  // KPIs do Estoque Filtrado
  const kpis = useMemo(() => {
    const totalUnits = filteredVehicles.length;
    const availCount = filteredVehicles.filter((v) => v.status === 'disponivel').length;
    const resCount = filteredVehicles.filter((v) => v.status === 'reservado').length;
    const aging60Count = activeInventory.filter((v) => getDaysInStock(v.created_at) > 60).length;

    let totalSaleValue = 0;
    let totalCostValue = 0;
    let unitsWithBothPrices = 0;
    let totalDays = 0;

    filteredVehicles.forEach((v) => {
      const sale = Number(v.sale_price) || 0;
      const cost = Number(v.purchase_price) || 0;
      totalSaleValue += sale;
      if (cost > 0 && sale > 0) {
        totalCostValue += cost;
        unitsWithBothPrices++;
      }
      totalDays += getDaysInStock(v.created_at);
    });

    const avgDays = totalUnits > 0 ? Math.round(totalDays / totalUnits) : 0;
    const projectedMargin =
      totalCostValue > 0 ? totalSaleValue - totalCostValue : 0;

    return {
      totalUnits,
      availCount,
      resCount,
      aging60Count,
      avgDays,
      totalSaleValue,
      totalCostValue,
      projectedMargin,
      unitsWithBothPrices,
    };
  }, [filteredVehicles, activeInventory]);

  useEffect(() => {
    if (selectedModel && !modelGroups.some((group) => group.key === selectedModel)) {
      setSelectedModel(null);
    }
  }, [modelGroups, selectedModel]);

  const toggleExpandModel = (key: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCopyText = (label: string, text?: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado`,
      description: text,
    });
  };

  const handleExportCsv = () => {
    if (filteredVehicles.length === 0) return;
    const headers = [
      'Tipo',
      'Marca',
      'Modelo',
      'Ano Fab/Mod',
      'Cor',
      'Chassi',
      'Placa',
      'RENAVAM',
      'Loja',
      'Revendedor',
      'Status',
      'Dias em Estoque',
      'Preco Venda (R$)',
      ...(canViewMargins ? ['Preco Custo (R$)', 'Margem Bruta (R$)'] : []),
    ];

    const rows = filteredVehicles.map((v) => {
      const storeName = stores?.find((s) => s.id === v.store_id)?.name || 'Loja Principal';
      const resellerName = resellers?.find((r) => r.id === v.reseller_id)?.full_name || 'Estoque Loja';
      const days = getDaysInStock(v.created_at);
      const sale = Number(v.sale_price) || 0;
      const cost = Number(v.purchase_price) || 0;
      const base = [
        v.vehicle_type === 'moto' ? 'Moto' : 'Carro',
        v.brand,
        v.model,
        v.manufacture_year ? `${v.manufacture_year}/${v.year}` : String(v.year),
        v.color || '',
        v.chassis || '',
        v.plate || '',
        v.renavam || '',
        storeName,
        resellerName,
        statusConfig[v.status]?.label || v.status,
        String(days),
        sale.toFixed(2).replace('.', ','),
      ];
      if (canViewMargins) {
        base.push(
          cost > 0 ? cost.toFixed(2).replace('.', ',') : '',
          cost > 0 && sale > 0 ? (sale - cost).toFixed(2).replace('.', ',') : '',
        );
      }
      return base.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estoque-veiculos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== 'active' ||
    typeFilter !== 'all' ||
    colorFilter !== 'all' ||
    (hasElevatedAccess && storeFilter !== 'all') ||
    resellerFilter !== 'all';

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('active');
    setTypeFilter('all');
    setColorFilter('all');
    if (hasElevatedAccess) setStoreFilter('all');
    setResellerFilter('all');
    setSortBy('default');
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Estoque de Veículos"
        description="Gestão de disponibilidade, giro de pátio e precificação de vendas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredVehicles.length === 0}
              className="h-9"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exportar CSV
            </Button>
            {canRegisterVehicles && (
              <>
                {hasElevatedAccess && (
                  <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)} className="h-9">
                    <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                    Transferir
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setScannerOpen(true)} className="h-9">
                  <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                  Escanear Chassi
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleTabChange('laudos')} 
                  className={cn(
                    "h-9 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold",
                    tab === 'laudos' && "bg-emerald-500/15 border-emerald-500/60 ring-2 ring-emerald-500/20"
                  )}
                  title="Abrir aba de laudos periciais cautelares, vistorias e procedência"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Laudos Cautelares ({inspections.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setBatchOpen(true)} 
                  className="h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  title="Cadastre múltiplas motos de uma remessa de fábrica colando a lista de chassis"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Entrada em Lote (NF Fábrica)
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleTabChange('entrada')} 
                  className={cn(
                    "h-9 gap-1.5 font-semibold shadow-xs",
                    tab === 'entrada'
                      ? "bg-red-700 text-white ring-2 ring-red-500/30"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  title="Receber caminhão: anexe a imagem da lista do caminhão e bipe as caixas das motos"
                >
                  <Truck className="h-3.5 w-3.5" />
                  Controle de Entrada
                </Button>
                <Button size="sm" onClick={() => setFormOpen(true)} className="h-9">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Novo Veículo
                </Button>
              </>
            )}
          </div>
        }
      />

      <VehicleFormDialog 
        open={formOpen} 
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setScannedChassisForForm('');
        }} 
        initialChassis={scannedChassisForForm}
      />
      <BatchVehicleEntryDialog open={batchOpen} onOpenChange={setBatchOpen} />
      <BarcodeScannerDialog 
        open={scannerOpen} 
        onOpenChange={setScannerOpen} 
        onOpenFullForm={(chassis) => {
          setScannedChassisForForm(chassis);
          setFormOpen(true);
        }}
      />
      <StockTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />

      {/* Diálogo de Venda Rápida a partir da unidade do estoque */}
      {saleVehicleId && (
        <NewSaleDialog
          open={Boolean(saleVehicleId)}
          onOpenChange={(open) => {
            if (!open) setSaleVehicleId(null);
          }}
          initialVehicleId={saleVehicleId}
        />
      )}

      {/* Diálogo de Reserva Rápida a partir da unidade do estoque */}
      {reserveVehicleId && (
        <CreateReservationDialog
          open={Boolean(reserveVehicleId)}
          onOpenChange={(open) => {
            if (!open) setReserveVehicleId(null);
          }}
          initialVehicleId={reserveVehicleId}
        />
      )}

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="h-10 rounded-xl border bg-card p-1 shadow-2xs w-fit">
            <TabsTrigger value="estoque" className="gap-2 text-xs">
              <Package className="h-3.5 w-3.5" />
              Posição de Estoque ({activeInventory.length})
            </TabsTrigger>
            <TabsTrigger 
              value="entrada" 
              className="gap-2 text-xs text-red-600 dark:text-red-400 font-bold data-[state=active]:bg-red-500/15 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-300"
            >
              <Truck className="h-3.5 w-3.5 text-red-500" />
              Controle de Entrada
            </TabsTrigger>
            <TabsTrigger value="laudos" className="gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300">
              <FileCheck className="h-3.5 w-3.5 text-emerald-500" />
              Laudos & Cautelares ({inspections.length})
            </TabsTrigger>
            <TabsTrigger value="reservas" className="gap-2 text-xs">
              <CalendarClock className="h-3.5 w-3.5" />
              Reservas Ativas
            </TabsTrigger>
            <TabsTrigger value="transferencias" className="gap-2 text-xs">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transferências
            </TabsTrigger>
          </TabsList>

          {tab === 'estoque' && !selectedModel && (
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card p-1 w-fit">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'grouped'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Agrupado por Modelo
              </button>
              <button
                type="button"
                onClick={() => setViewMode('units')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'units'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Lista Geral de Unidades
              </button>
            </div>
          )}
        </div>

        <TabsContent value="reservas" className="mt-0">
          <ReservationsPanel />
        </TabsContent>
        <TabsContent value="transferencias" className="mt-0">
          <TransfersPanel />
        </TabsContent>

        <TabsContent value="estoque" className="mt-0 space-y-5">
          {/* KPIs EXECUTIVOS DO PÁTIO */}
          {!isLoading && (
            <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5', canViewMargins ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
              <StatCard
                label="Unidades Filtradas"
                value={kpis.totalUnits}
                icon={Package}
                tone="primary"
                hint={`${kpis.availCount} disponíveis · ${kpis.resCount} reservadas`}
              />
              <StatCard
                label="Diversidade de Pátio"
                value={`${modelGroups.length} modelos`}
                icon={Bike}
                hint={`${availableColors.length} cores ativas no estoque`}
              />
              <StatCard
                label="Giro & Tempo de Pátio"
                value={`${kpis.avgDays} dias`}
                icon={Clock}
                tone={kpis.aging60Count > 0 ? 'warning' : 'neutral'}
                hint={
                  kpis.aging60Count > 0
                    ? `${kpis.aging60Count} unid. acima de 60 dias`
                    : 'Giro saudável (< 60 dias)'
                }
              />
              <StatCard
                label="Valor em Estoque (Venda)"
                value={formatCurrency(kpis.totalSaleValue)}
                icon={Tag}
                tone="success"
                hint={
                  modelGroups.filter((g) => g.isPromo).length > 0
                    ? `${modelGroups.filter((g) => g.isPromo).length} modelos em promoção`
                    : 'Baseado na tabela vigente'
                }
              />
              {canViewMargins && (
                <StatCard
                  label="Margem Bruta Projetada"
                  value={formatCurrency(kpis.projectedMargin)}
                  icon={TrendingUp}
                  tone="neutral"
                  hint={
                    kpis.totalCostValue > 0
                      ? `Custo imobilizado: ${formatCurrency(kpis.totalCostValue)}`
                      : 'Informe preço de compra p/ margem'
                  }
                />
              )}
            </div>
          )}

          {/* BARRA DE FILTROS AVANÇADA E SÓBRIA */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs space-y-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por modelo, cor, placa, final do chassi ou RENAVAM..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 pl-9 text-xs sm:text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Tipo: Todos / Motos / Carros */}
              <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-0.5 shrink-0">
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'moto', label: 'Motos' },
                    { id: 'carro', label: 'Carros' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTypeFilter(item.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      typeFilter === item.id
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Loja */}
              <Select
                value={storeFilter}
                onValueChange={setStoreFilter}
                disabled={!isAdmin && !hasElevatedAccess}
              >
                <SelectTrigger className="h-9 w-full lg:w-[175px] text-xs">
                  <Store className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  {hasElevatedAccess && <SelectItem value="all">Todas as lojas</SelectItem>}
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Revendedor */}
              <Select value={resellerFilter} onValueChange={setResellerFilter}>
                <SelectTrigger className="h-9 w-full lg:w-[175px] text-xs">
                  <User className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Alocação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Loja + Consignados</SelectItem>
                  <SelectItem value="loja">Pátio Próprio da Loja</SelectItem>
                  {resellers
                    ?.filter((item) => item.is_active)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Ordenação */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="h-9 w-full lg:w-[180px] text-xs">
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão (Promo / Volume)</SelectItem>
                  <SelectItem value="qty_desc">Maior Volume no Pátio</SelectItem>
                  <SelectItem value="aging_desc">Mais Antigos no Pátio</SelectItem>
                  <SelectItem value="price_asc">Menor Preço</SelectItem>
                  <SelectItem value="price_desc">Maior Preço</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Segunda linha: Status e Filtro rápido de Cor */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'all', label: `Todos (${scopedVehicles.length})` },
                  { id: 'active', label: `Estoque Ativo (${activeInventory.length})` },
                  { id: 'disponivel', label: 'Disponíveis' },
                  { id: 'reservado', label: 'Reservados' },
                  { id: 'aging60', label: `Pátio > 60d (${kpis.aging60Count})` },
                  { id: 'vendido', label: 'Histórico Vendidos' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      statusFilter === st.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {colorFilter !== 'all' && (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 text-xs cursor-pointer"
                    onClick={() => setColorFilter('all')}
                  >
                    Cor: {colorFilter}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetAllFilters}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* CONTEÚDO PRINCIPAL DO ESTOQUE */}
          {isLoading ? (
            <LoadingList />
          ) : filteredVehicles.length === 0 ? (
            <EmptyState filtered={hasActiveFilters} onReset={resetAllFilters} />
          ) : activeGroup ? (
            <UnitList
              group={activeGroup}
              stores={stores || []}
              resellers={resellers || []}
              canCreateSales={canCreateSales}
              canViewMargins={canViewMargins}
              onBack={() => setSelectedModel(null)}
              onSell={(id) => setSaleVehicleId(id)}
              onReserve={(id) => setReserveVehicleId(id)}
              onCopy={handleCopyText}
            />
          ) : viewMode === 'units' ? (
            /* VISÃO DE TABELA GERAL DE UNIDADES */
            <PanelCard
              title="Relação Geral de Unidades"
              description={`${filteredVehicles.length} ${filteredVehicles.length === 1 ? 'veículo listado' : 'veículos listados'} com chassi, alocação e tempo de pátio`}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Veículo / Modelo</TableHead>
                      <TableHead>Cor & Ano</TableHead>
                      <TableHead>Identificação (Chassi / Placa)</TableHead>
                      <TableHead>Alocação</TableHead>
                      <TableHead className="text-center">Giro (Pátio)</TableHead>
                      <TableHead className="text-right">Preço Venda</TableHead>
                      {canViewMargins && <TableHead className="text-right">Margem</TableHead>}
                      <TableHead className="text-right">Ações Rápidas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle) => {
                      const store = stores?.find((s) => s.id === vehicle.store_id);
                      const reseller = resellers?.find((r) => r.id === vehicle.reseller_id);
                      const days = getDaysInStock(vehicle.created_at);
                      const margin =
                        (Number(vehicle.sale_price) || 0) > 0 &&
                        (Number(vehicle.purchase_price) || 0) > 0
                          ? Number(vehicle.sale_price) - Number(vehicle.purchase_price)
                          : null;

                      return (
                        <TableRow key={vehicle.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] px-1.5 py-0', statusConfig[vehicle.status].class)}
                              >
                                {statusConfig[vehicle.status].label}
                              </Badge>
                              <div>
                                <div className="font-medium text-foreground text-sm">
                                  {vehicle.brand} {vehicle.model}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {vehicle.vehicle_type === 'moto' ? 'Moto' : 'Carro'}
                                  {vehicle.engine_cc ? ` · ${vehicle.engine_cc}cc` : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() =>
                                setColorFilter(vehicle.color?.trim() || 'Sem cor informada')
                              }
                              className="text-xs font-medium text-foreground hover:text-primary transition-colors block"
                            >
                              {vehicle.color || 'Não informada'}
                            </button>
                            <span className="text-[11px] text-muted-foreground">
                              {vehicle.manufacture_year
                                ? `${vehicle.manufacture_year}/${vehicle.year}`
                                : vehicle.year}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5 font-mono text-xs">
                              {vehicle.chassis && vehicle.chassis.toUpperCase() !== 'DISPENSADO' && !vehicle.chassis.toUpperCase().startsWith('DISPENSADO') ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText('Chassi', vehicle.chassis!)}
                                  className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                                  title="Clique para copiar o chassi"
                                >
                                  <span>{vehicle.chassis}</span>
                                  <Copy className="h-3 w-3 opacity-60" />
                                </button>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                  Sem Chassi (Elétrica / Bicicleta)
                                </Badge>
                              )}
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                <span>{vehicle.plate ? `Placa ${vehicle.plate}` : 'Zero KM / S/ Placa'}</span>
                                {vehicle.renavam && <span>· RENAVAM {vehicle.renavam}</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-foreground font-medium">
                              {store?.name || 'Loja Principal'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {reseller ? `Consignado: ${reseller.full_name}` : 'Pátio próprio'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn('text-[11px] font-mono', getAgingBadgeClass(days))}
                            >
                              {days}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-foreground">
                            {formatCurrency(vehicle.sale_price)}
                          </TableCell>
                          {canViewMargins && (
                            <TableCell className="text-right font-mono text-xs">
                              {margin !== null ? (
                                <span className={margin >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                                  {formatCurrency(margin)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canCreateSales && vehicle.status !== 'vendido' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setSaleVehicleId(vehicle.id)}
                                  className="h-7 px-2.5 text-xs"
                                >
                                  <ShoppingBag className="h-3 w-3 mr-1" />
                                  Vender
                                </Button>
                              )}
                              {vehicle.status === 'disponivel' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReserveVehicleId(vehicle.id)}
                                  className="h-7 px-2 text-xs"
                                >
                                  Reservar
                                </Button>
                              )}
                              <VehicleActionsMenu vehicle={vehicle} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </PanelCard>
          ) : (
            /* VISÃO AGRUPADA POR MODELO COM EXPANSÃO INLINE */
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
              <div className="flex min-w-[760px] items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3.5">
                <div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Modelos no Estoque
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Clique em uma cor para filtrar, expanda a linha para ação rápida ou abra o detalhamento do modelo
                  </p>
                </div>
                <span className="text-xs font-mono font-medium text-muted-foreground">
                  {modelGroups.length} {modelGroups.length === 1 ? 'modelo' : 'modelos'} ·{' '}
                  {filteredVehicles.length} un.
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {modelGroups.map((group) => {
                  const isExpanded = expandedModels.has(group.key);
                  return (
                    <div key={group.key} className="transition-colors">
                      <div className="group grid min-w-[760px] gap-4 px-5 py-3.5 hover:bg-muted/20 lg:grid-cols-[minmax(200px,1.2fr)_minmax(180px,1.2fr)_140px_100px_160px] lg:items-center">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleExpandModel(group.key)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/30 text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                            title={isExpanded ? 'Recolher unidades' : 'Expandir unidades aqui'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleExpandModel(group.key)}
                                className="truncate font-semibold text-foreground hover:text-primary transition-colors text-left"
                              >
                                {group.brand} {group.model}
                              </button>
                              {group.isPromo && (
                                <Badge className="gap-1 border-none bg-primary/10 px-1.5 text-[10px] font-semibold uppercase text-primary">
                                  <Flame className="h-3 w-3" />
                                  Promo
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {group.type === 'moto' ? 'Moto' : 'Carro'} ·{' '}
                              <span className="text-success font-medium">{group.available} disp.</span>
                              {group.reserved > 0 && (
                                <span className="text-warning font-medium"> · {group.reserved} res.</span>
                              )}
                              {' · '}Giro médio {group.avgAgingDays}d
                            </p>
                          </div>
                        </div>

                        {/* Cores clicáveis */}
                        <div className="flex flex-wrap gap-1.5">
                          {group.colors.map(([color, count]) => {
                            const isSelectedColor =
                              colorFilter.toLowerCase() === color.toLowerCase();
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() =>
                                  setColorFilter(isSelectedColor ? 'all' : color)
                                }
                                className={cn(
                                  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                                  isSelectedColor
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border/80 bg-muted/40 text-foreground/85 hover:border-primary/40',
                                )}
                                title={`Filtrar cor ${color}`}
                              >
                                {color}
                                <span className="ml-1.5 font-mono text-[11px] font-semibold text-primary">
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Preço */}
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'font-display text-base font-bold font-mono',
                              group.isPromo ? 'text-primary' : 'text-foreground',
                            )}
                          >
                            {formatCurrency(group.price)}
                          </p>
                          {group.isPromo ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {group.listPrice ? (
                                <span className="line-through">{formatCurrency(group.listPrice)}</span>
                              ) : null}
                              {group.promoLabel ? ` · ${group.promoLabel}` : ''}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Preço de tabela</p>
                          )}
                        </div>

                        {/* Volume + Alerta de pátio */}
                        <div className="flex items-center gap-2 lg:justify-center">
                          <span className="text-lg font-bold font-mono text-foreground">
                            {group.vehicles.length}
                          </span>
                          <span className="text-xs text-muted-foreground">unid.</span>
                          {group.maxAgingDays > 60 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-warning/40 text-warning"
                              title={`Unidade mais antiga há ${group.maxAgingDays} dias`}
                            >
                              {group.maxAgingDays}d
                            </Badge>
                          )}
                        </div>

                        {/* Ações do grupo */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpandModel(group.key)}
                            className="flex-1 h-8 text-xs"
                          >
                            {isExpanded ? 'Ocultar' : 'Expandir'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedModel(group.key)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Detalhes
                          </Button>
                        </div>
                      </div>

                      {/* EXPANSÃO INLINE DAS UNIDADES DO MODELO */}
                      {isExpanded && (
                        <div className="border-t border-border/50 bg-muted/15 px-5 py-3 space-y-2">
                          {group.vehicles.map((vehicle) => {
                            const store = stores?.find((s) => s.id === vehicle.store_id);
                            const reseller = resellers?.find((r) => r.id === vehicle.reseller_id);
                            const days = getDaysInStock(vehicle.created_at);

                            return (
                              <div
                                key={vehicle.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[10px]', statusConfig[vehicle.status].class)}
                                  >
                                    {statusConfig[vehicle.status].label}
                                  </Badge>
                                  <span className="font-semibold text-foreground">
                                    {vehicle.color || 'Cor não informada'}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {vehicle.manufacture_year
                                      ? `${vehicle.manufacture_year}/${vehicle.year}`
                                      : vehicle.year}
                                  </span>
                                  {vehicle.chassis && vehicle.chassis.toUpperCase() !== 'DISPENSADO' && !vehicle.chassis.toUpperCase().startsWith('DISPENSADO') ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText('Chassi', vehicle.chassis!)}
                                      className="inline-flex items-center gap-1 font-mono text-[11px] bg-muted/50 px-2 py-0.5 rounded border border-border/60 hover:border-primary/40"
                                      title="Copiar chassi"
                                    >
                                      Chassi: {vehicle.chassis}
                                      <Copy className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                      Sem Chassi (Elétrica)
                                    </span>
                                  )}
                                  {vehicle.plate && (
                                    <span className="font-mono text-muted-foreground">
                                      Placa: {vehicle.plate}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">
                                    {store?.name || 'Loja'}
                                    {reseller ? ` · ${reseller.full_name}` : ''}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2.5">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[10px] font-mono', getAgingBadgeClass(days))}
                                  >
                                    {days}d no pátio
                                  </Badge>
                                  <span className="font-mono font-semibold text-foreground">
                                    {formatCurrency(vehicle.sale_price)}
                                  </span>
                                  {canCreateSales && vehicle.status !== 'vendido' && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => setSaleVehicleId(vehicle.id)}
                                      className="h-7 px-2.5 text-xs"
                                    >
                                      <ShoppingBag className="h-3 w-3 mr-1" />
                                      Vender
                                    </Button>
                                  )}
                                  {vehicle.status === 'disponivel' && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setReserveVehicleId(vehicle.id)}
                                      className="h-7 px-2 text-xs"
                                    >
                                      Reservar
                                    </Button>
                                  )}
                                  <VehicleActionsMenu vehicle={vehicle} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="laudos" className="mt-0">
          <LaudosTabPanel vehiclesInStock={vehicles || []} />
        </TabsContent>

        <TabsContent value="entrada" className="mt-0">
          <InboundCargo embedded={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UnitList({
  group,
  stores,
  resellers,
  canCreateSales,
  canViewMargins,
  onBack,
  onSell,
  onReserve,
  onCopy,
}: {
  group: ModelGroup;
  stores: Array<{ id: string; name: string }>;
  resellers: Array<{ id: string; full_name: string }>;
  canCreateSales: boolean;
  canViewMargins: boolean;
  onBack: () => void;
  onSell: (vehicleId: string) => void;
  onReserve: (vehicleId: string) => void;
  onCopy: (label: string, text?: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
      <div className="flex min-w-[760px] flex-col gap-3 border-b border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar aos modelos">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-foreground">
                {group.brand} {group.model}
              </h2>
              {group.isPromo && (
                <Badge className="gap-1 border-none bg-primary/10 px-1.5 text-[10px] font-bold uppercase text-primary">
                  <Flame className="h-3 w-3" />
                  {group.promoLabel || 'Promoção'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {group.vehicles.length} unidades ·{' '}
              {group.colors.map(([color, count]) => `${color}: ${count}`).join(' · ')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          Voltar para todos os modelos
        </Button>
      </div>

      <div className="divide-y divide-border/60">
        {group.vehicles.map((vehicle) => {
          const store = stores.find((item) => item.id === vehicle.store_id);
          const reseller = resellers.find((item) => item.id === vehicle.reseller_id);
          const days = getDaysInStock(vehicle.created_at);
          const margin =
            canViewMargins &&
            (Number(vehicle.sale_price) || 0) > 0 &&
            (Number(vehicle.purchase_price) || 0) > 0
              ? Number(vehicle.sale_price) - Number(vehicle.purchase_price)
              : null;

          return (
            <div
              key={vehicle.id}
              className="grid min-w-[760px] gap-3 px-5 py-3.5 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(200px,1.2fr)_1.2fr_120px_140px_auto] md:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-xs', statusConfig[vehicle.status].class)}
                  >
                    {statusConfig[vehicle.status].label}
                  </Badge>
                  <span className="font-medium text-sm text-foreground">
                    {vehicle.color || 'Cor não informada'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vehicle.manufacture_year
                    ? `${vehicle.manufacture_year}/${vehicle.year}`
                    : vehicle.year}
                  {vehicle.engine_cc ? ` · ${vehicle.engine_cc}cc` : ''}
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-0.5">
                {vehicle.chassis ? (
                  <button
                    type="button"
                    onClick={() => onCopy('Chassi', vehicle.chassis)}
                    className="flex items-center gap-1 font-mono text-foreground hover:text-primary transition-colors"
                  >
                    <span>Chassi {vehicle.chassis}</span>
                    <Copy className="h-3 w-3 opacity-60" />
                  </button>
                ) : (
                  <p>Chassi não informado</p>
                )}
                <p>
                  {vehicle.plate ? `Placa ${vehicle.plate}` : 'Sem placa'}
                  {store ? ` · ${store.name}` : ''}
                  {reseller ? ` · ${reseller.full_name}` : ''}
                </p>
              </div>

              <div>
                <Badge
                  variant="outline"
                  className={cn('text-[11px] font-mono', getAgingBadgeClass(days))}
                >
                  {days} dias no pátio
                </Badge>
              </div>

              <div className="text-right md:text-left">
                <p className="font-mono font-semibold text-foreground">
                  {formatCurrency(vehicle.sale_price)}
                </p>
                {margin !== null && (
                  <p className="text-[11px] font-mono text-success">
                    Margem: {formatCurrency(margin)}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-1.5">
                {canCreateSales && vehicle.status !== 'vendido' && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onSell(vehicle.id)}
                    className="h-8 px-3 text-xs"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                    Vender
                  </Button>
                )}
                {vehicle.status === 'disponivel' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReserve(vehicle.id)}
                    className="h-8 px-2.5 text-xs"
                  >
                    Reservar
                  </Button>
                )}
                <VehicleActionsMenu vehicle={vehicle} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-14">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Car className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-display text-base font-semibold text-foreground">
          {filtered ? 'Nenhum veículo encontrado com esses filtros' : 'Nenhum veículo cadastrado'}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered
            ? 'Ajuste os termos de busca ou limpe os filtros ativos.'
            : 'Adicione veículos ao estoque para visualizá-los aqui.'}
        </p>
        {filtered && (
          <Button variant="outline" size="sm" onClick={onReset} className="mt-4 text-xs">
            Limpar todos os filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
}