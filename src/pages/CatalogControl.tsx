import { useState, useMemo } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import { CatalogProduct } from "@/types/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Store,
  Plus,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Radio,
  Settings,
  Megaphone,
  Download,
  MoreVertical,
  Edit,
  Trash2,
  DollarSign,
  Tag,
  Eye,
  EyeOff,
  PackageCheck,
  AlertTriangle,
  History,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { CatalogConfigDialog } from "@/components/catalog/CatalogConfigDialog";
import { CatalogCampaignDialog } from "@/components/catalog/CatalogCampaignDialog";
import { CatalogProductDialog } from "@/components/catalog/CatalogProductDialog";
import { CatalogImportFromStockDialog } from "@/components/catalog/CatalogImportFromStockDialog";
import { CatalogQuickPriceDialog } from "@/components/catalog/CatalogQuickPriceDialog";

export default function CatalogControl() {
  const {
    catalog,
    isLoading,
    isRefetching,
    refetch,
    streamStatus,
    liveEvents,
    toggleActive,
    updateStock,
    updatePrice,
    updateCampaign,
    updateConfig,
    upsertProduct,
    removeProduct,
    batchSync,
    apiSettings,
  } = useCatalog();

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "soldout" | "promo">("all");
  const [showLiveStream, setShowLiveStream] = useState(false);

  // Modais
  const [configOpen, setConfigOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<CatalogProduct | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<CatalogProduct | null>(null);

  // Dialog de Exclusão
  const [deleteProduct, setDeleteProduct] = useState<CatalogProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Produtos do catálogo
  const products = catalog?.products || [];

  // Set de IDs existentes para importar
  const existingIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  // Contadores e KPIs
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.active !== false).length;
  const soldOutCount = products.filter((p) => p.stock === 0).length;
  const promoCount = products.filter(
    (p) => p.oldPrice && p.price && p.oldPrice > p.price
  ).length;

  // Filtragem
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Busca
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesBrand = (p.brand || "").toLowerCase().includes(q);
        const matchesId = (p.id || "").toLowerCase().includes(q);
        const matchesSub = (p.sub || "").toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesId && !matchesSub) {
          return false;
        }
      }

      // Categoria
      if (selectedCat !== "all" && p.cat !== selectedCat) {
        return false;
      }

      // Status
      if (statusFilter === "active" && p.active === false) return false;
      if (statusFilter === "hidden" && p.active !== false) return false;
      if (statusFilter === "soldout" && p.stock !== 0) return false;
      if (statusFilter === "promo") {
        if (!p.oldPrice || !p.price || p.oldPrice <= p.price) return false;
      }

      return true;
    });
  }, [products, search, selectedCat, statusFilter]);

  const handleEditProduct = (prod: CatalogProduct) => {
    setSelectedProductForEdit(prod);
    setProductDialogOpen(true);
  };

  const handleNewProduct = () => {
    setSelectedProductForEdit(null);
    setProductDialogOpen(true);
  };

  const handleQuickPrice = (prod: CatalogProduct) => {
    setSelectedProductForPrice(prod);
    setPriceDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      await removeProduct(deleteProduct.id);
      setDeleteProduct(null);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "Sob Consulta";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Store className="w-6 h-6 text-primary" />
              Controle do Catálogo L1MA Motors
            </h1>

            {/* Status da Conexão SSE */}
            <div className="flex items-center gap-1.5 ml-2">
              {streamStatus === "connected" ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 py-0.5 text-xs font-normal"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  SSE Ativo
                </Badge>
              ) : streamStatus === "connecting" ? (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1.5 py-0.5 text-xs font-normal"
                >
                  <Radio className="w-3 h-3 animate-pulse" /> Conectando API...
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1.5 py-0.5 text-xs font-normal"
                >
                  <WifiOff className="w-3 h-3" /> Offline
                </Badge>
              )}

              {catalog && (
                <Badge variant="secondary" className="text-xs font-mono">
                  v{catalog.version}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Central de comando e sincronização em tempo real (produtos, estoque, preços e promoções) com o catálogo público.
          </p>
        </div>

        {/* Botões do Topo */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="gap-1.5"
            title="Recarregar dados do catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCampaignOpen(true)}
            className="gap-1.5"
          >
            <Megaphone className="w-4 h-4 text-amber-500" />
            Campanha
            {catalog?.events && (
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            className="gap-1.5"
          >
            <Download className="w-4 h-4 text-primary" />
            Importar do Estoque
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
            className="gap-1.5"
          >
            <Settings className="w-4 h-4" />
            Configurações
          </Button>

          <Button size="sm" onClick={handleNewProduct} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Novo Veículo
          </Button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total de Modelos</span>
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Sincronizados no catálogo</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Ativos / Visíveis</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{activeCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Exibidos publicamente aos clientes</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Esgotados</span>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold text-destructive">{soldOutCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Carimbo de esgotado ativo</p>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Em Oferta</span>
            <Tag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">{promoCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Com selo de desconto De/Por</p>
        </div>
      </div>

      {/* BARRA DE BUSCA E ABAS DE CATEGORIA */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Abas Categoria */}
          <Tabs value={selectedCat} onValueChange={setSelectedCat} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-5 w-full sm:w-auto">
              <TabsTrigger value="all" className="text-xs">Todos ({totalCount})</TabsTrigger>
              <TabsTrigger value="shineray" className="text-xs">Shineray</TabsTrigger>
              <TabsTrigger value="ele" className="text-xs">Elétricas</TabsTrigger>
              <TabsTrigger value="semi" className="text-xs">Semi-novos</TabsTrigger>
              <TabsTrigger value="off" className="text-xs">Off-Road</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filtros de Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-8 text-xs"
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="h-8 text-xs gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> Ativos
            </Button>
            <Button
              variant={statusFilter === "hidden" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("hidden")}
              className="h-8 text-xs gap-1"
            >
              <EyeOff className="w-3.5 h-3.5" /> Ocultos
            </Button>
            <Button
              variant={statusFilter === "soldout" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("soldout")}
              className="h-8 text-xs gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Esgotados
            </Button>
            <Button
              variant={statusFilter === "promo" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("promo")}
              className="h-8 text-xs gap-1"
            >
              <Tag className="w-3.5 h-3.5" /> Ofertas
            </Button>
          </div>
        </div>

        {/* Campo de Busca */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do modelo, marca, subcategoria ou ID único..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLiveStream(!showLiveStream)}
            className="gap-1.5 shrink-0"
          >
            <Activity className="w-4 h-4 text-primary" />
            {showLiveStream ? "Ocultar Eventos SSE" : "Eventos SSE"}
            {liveEvents.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {liveEvents.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* PAINEL DE EVENTOS SSE (DRAWER/BOX) */}
      {showLiveStream && (
        <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-primary" />
              Feed de Eventos em Tempo Real (SSE)
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              Endpoint: {apiSettings.url}/api/stream
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
            {liveEvents.length === 0 ? (
              <p className="text-muted-foreground italic py-2">
                Nenhum evento transmitido recentemente. Todas as alterações locais ou remotas aparecerão aqui ao vivo.
              </p>
            ) : (
              liveEvents.map((evt, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-background/50 border">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {evt.action || "sync"}
                    </Badge>
                    <span className="text-foreground">{JSON.stringify(evt.details || evt)}</span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "Agora"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LISTAGEM DE PRODUTOS */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p>Carregando dados do catálogo...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card space-y-3">
          <Store className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-lg font-semibold text-foreground">Nenhum veículo encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {search || selectedCat !== "all" || statusFilter !== "all"
              ? "Tente ajustar os filtros ou termos da sua busca."
              : "Seu catálogo público ainda não possui veículos cadastrados. Adicione um novo ou importe diretamente do estoque."}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-1.5">
              <Download className="w-4 h-4" /> Importar do Estoque
            </Button>
            <Button size="sm" onClick={handleNewProduct} className="gap-1.5">
              <Plus className="w-4 h-4" /> Criar Novo Veículo
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const hasPromo = p.oldPrice && p.price && p.oldPrice > p.price;
            const isSoldOut = p.stock === 0;
            const isUnlimited = p.stock === null || p.stock === undefined;
            const mainPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : "";

            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-card overflow-hidden shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  !p.active ? "opacity-60 border-dashed" : ""
                }`}
              >
                {/* TOPO COM FOTO E BADGES */}
                <div>
                  <div className="relative aspect-video w-full bg-muted/40 overflow-hidden">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        Sem Foto
                      </div>
                    )}

                    {/* Selo Esgotado sobre a foto */}
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-3 py-1 bg-destructive text-destructive-foreground font-bold text-xs uppercase tracking-wider rounded-md shadow">
                          Esgotado
                        </span>
                      </div>
                    )}

                    {/* Badges Flutuantes */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <Badge
                        variant="secondary"
                        className="bg-background/90 backdrop-blur-sm text-[10px] font-semibold uppercase"
                      >
                        {p.cat === "shineray"
                          ? "Shineray"
                          : p.cat === "ele"
                          ? "Elétrica"
                          : p.cat === "semi"
                          ? "Semi-novo"
                          : "Off-Road"}
                      </Badge>
                      {p.sub && (
                        <Badge
                          variant="outline"
                          className="bg-background/80 backdrop-blur-sm text-[9px] border-border"
                        >
                          {p.sub}
                        </Badge>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {hasPromo && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold gap-1 shadow">
                          <Tag className="w-3 h-3" /> OFERTA
                        </Badge>
                      )}
                      {p.readyDelivery && (
                        <Badge className="bg-emerald-600 text-white text-[10px] shadow">
                          Pronta Entrega
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* CORPO DO CARD */}
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{p.brand}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{p.id}</span>
                      </div>
                      <h3 className="font-bold text-base text-foreground truncate" title={p.name}>
                        {p.name}
                      </h3>
                    </div>

                    {/* PREÇO */}
                    <div className="flex items-baseline justify-between pt-1 border-t">
                      <div>
                        {p.oldPrice && (
                          <div className="text-xs line-through text-muted-foreground">
                            {formatCurrency(p.oldPrice)}
                          </div>
                        )}
                        <div className="text-lg font-extrabold text-foreground">
                          {formatCurrency(p.price)}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickPrice(p)}
                        className="h-7 px-2 text-xs text-primary hover:text-primary gap-1"
                        title="Alterar Preço Rápido"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Editar Preço
                      </Button>
                    </div>

                    {/* CONTROLE DE ESTOQUE RÁPIDO */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                      <span className="text-muted-foreground">Estoque:</span>
                      <div className="flex items-center gap-1.5">
                        {isSoldOut ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Esgotado (0)
                          </Badge>
                        ) : isUnlimited ? (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400">
                            Pronta Entrega
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] font-semibold">
                            {p.stock} unid.
                          </Badge>
                        )}

                        {/* Botão rápido para alternar esgotado */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStock(p.id, isSoldOut ? null : 0)}
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          title={isSoldOut ? "Marcar como Pronta Entrega" : "Marcar como Esgotado"}
                        >
                          {isSoldOut ? "Reativar" : "Esgotar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RODAPÉ DO CARD: ATIVO / SWITCH / MENU */}
                <div className="p-3 bg-muted/10 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={p.active !== false}
                      onCheckedChange={() => toggleActive(p.id, p.active !== false)}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {p.active !== false ? "Visível" : "Oculto"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProduct(p)}
                      className="h-8 px-2 text-xs gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações Rápidas</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleQuickPrice(p)} className="gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-500" /> Alterar Preço
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateStock(p.id, isSoldOut ? null : 0)}
                          className="gap-2"
                        >
                          <PackageCheck className="w-4 h-4 text-blue-500" />
                          {isSoldOut ? "Tornar Pronta Entrega" : "Marcar como Esgotado"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditProduct(p)} className="gap-2">
                          <Edit className="w-4 h-4" /> Editar Completo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteProduct(p)}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" /> Remover do Catálogo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIÁLOGOS */}
      <CatalogConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentConfig={catalog?.config}
        onSaveStoreConfig={updateConfig}
      />

      <CatalogCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        currentCampaign={
          catalog?.events?.find((e) => e.action === "campaign")?.details || null
        }
        onSaveCampaign={updateCampaign}
      />

      <CatalogProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProductForEdit}
        onSaveProduct={upsertProduct}
      />

      <CatalogImportFromStockDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingCatalogProductIds={existingIds}
        onBatchSync={batchSync}
      />

      <CatalogQuickPriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        product={selectedProductForPrice}
        onSavePrice={updatePrice}
      />

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(o) => !o && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Veículo do Catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o modelo{" "}
              <strong>{deleteProduct?.name}</strong> (ID: {deleteProduct?.id}) do catálogo público
              L1MA Motors através da operação <code>remove</code>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removendo..." : "Confirmar Remoção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
