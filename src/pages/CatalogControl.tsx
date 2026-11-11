import { useState, useMemo } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import { CatalogProduct, CatalogPromo } from "@/types/catalog";
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
  Sparkles,
  Bot,
  Star,
  CheckCircle2,
} from "lucide-react";
import { CatalogConfigDialog } from "@/components/catalog/CatalogConfigDialog";
import { CatalogCampaignDialog } from "@/components/catalog/CatalogCampaignDialog";
import { CatalogProductDialog } from "@/components/catalog/CatalogProductDialog";
import { CatalogImportFromStockDialog } from "@/components/catalog/CatalogImportFromStockDialog";
import { CatalogQuickPriceDialog } from "@/components/catalog/CatalogQuickPriceDialog";
import { CatalogHeroCarouselDialog } from "@/components/catalog/CatalogHeroCarouselDialog";
import { CatalogPromoDialog } from "@/components/catalog/CatalogPromoDialog";
import { CatalogChatTestDialog } from "@/components/catalog/CatalogChatTestDialog";

export default function CatalogControl() {
  const {
    catalog,
    events,
    isLoading,
    isRefetching,
    refetch,
    streamStatus,
    liveEvents,
    chatMutation,
    toggleActive,
    updateStock,
    updatePrice,
    updatePromo,
    toggleFeaturedHero,
    setHeroList,
    updateCampaign,
    updateConfig,
    updateRates,
    upsertProduct,
    removeProduct,
    batchSync,
    apiSettings,
  } = useCatalog();

  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "soldout" | "promo" | "hero">("all");
  const [showLiveStream, setShowLiveStream] = useState(false);

  // Modais
  const [configOpen, setConfigOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [heroDialogOpen, setHeroDialogOpen] = useState(false);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<CatalogProduct | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<CatalogProduct | null>(null);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [selectedProductForPromo, setSelectedProductForPromo] = useState<CatalogProduct | null>(null);

  // Dialog de Exclusão
  const [deleteProduct, setDeleteProduct] = useState<CatalogProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Produtos do catálogo
  const products = catalog?.products || [];
  const lowStockLimit = catalog?.config?.lowStockThreshold ?? 2;

  // Set de IDs existentes para importar
  const existingIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  // Contadores e KPIs
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.active !== false).length;
  const soldOutCount = products.filter((p) => p.stock === 0).length;
  const promoCount = products.filter(
    (p) => (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price)
  ).length;
  const heroCount = products.filter((p) => p.featuredHero).length;

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
      if (statusFilter === "hero" && !p.featuredHero) return false;
      if (statusFilter === "promo") {
        const isPromo = (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price);
        if (!isPromo) return false;
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

  const handleOpenPromo = (prod: CatalogProduct) => {
    setSelectedProductForPromo(prod);
    setPromoDialogOpen(true);
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

  // Combina eventos de GET /api/events e SSE
  const allEvents = useMemo(() => {
    const list = [...liveEvents, ...events];
    const unique = new Map<string, any>();
    list.forEach((e) => {
      const key = `${e.timestamp}-${e.action}-${e.productId || ""}`;
      if (!unique.has(key)) unique.set(key, e);
    });
    return Array.from(unique.values()).slice(0, 60);
  }, [liveEvents, events]);

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

            {/* Status da Conexão SSE (<50ms) */}
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
                  SSE Ao Vivo (&lt;50ms)
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

              <Badge variant="secondary" className="text-xs font-mono">
                {totalCount} Modelos • v{catalog?.version || 1}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Central de comando e sincronização em tempo real (produtos, estoque, preços, promoções e fotos) com o catálogo público.
          </p>
        </div>

        {/* Botões de Ações do Cabeçalho */}
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
            onClick={() => setHeroDialogOpen(true)}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Carrossel Topo ({heroCount})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCampaignOpen(true)}
            className="gap-1.5"
          >
            <Megaphone className="w-4 h-4 text-primary" />
            Campanha
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setChatDialogOpen(true)}
            className="gap-1.5"
          >
            <Bot className="w-4 h-4 text-blue-500" />
            Testar IA
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            className="gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            Importar do Estoque
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
            className="gap-1.5"
          >
            <Settings className="w-4 h-4" />
            Taxas & Loja
          </Button>

          <Button size="sm" onClick={handleNewProduct} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Novo Veículo
          </Button>
        </div>
      </div>

      {/* KPIS DE RESUMO */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Modelos</span>
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cadastrados no catálogo</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ativos / Visíveis</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{activeCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Visíveis publicamente</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Esgotados</span>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold text-destructive">{soldOutCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Botão "Avise-me"</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Em Oferta</span>
            <Tag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">{promoCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Com selo e desconto R$</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Carrossel Topo</span>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">{heroCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Slides Hero ativos</p>
        </div>
      </div>

      {/* BARRA DE FILTROS & ABAS DE CATEGORIA */}
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
            <Button
              variant={statusFilter === "hero" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("hero")}
              className="h-8 text-xs gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Carrossel
            </Button>
          </div>
        </div>

        {/* Campo de Busca */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do modelo, marca, subcategoria (Trail, Scooter, Street...) ou ID único..."
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
            <History className="w-4 h-4 text-primary" />
            {showLiveStream ? "Ocultar Auditoria" : "Auditoria (60 eventos)"}
            {allEvents.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {allEvents.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* PAINEL DE AUDITORIA & HISTÓRICO (ÚLTIMOS 60 EVENTOS) */}
      {showLiveStream && (
        <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-primary" />
              Histórico de Auditoria & Tempo Real (GET /api/events & SSE)
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              {allEvents.length} eventos registrados
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 text-xs font-mono">
            {allEvents.length === 0 ? (
              <p className="text-muted-foreground italic py-2">
                Nenhum evento registrado ainda. Qualquer alteração de preços, estoque ou promoções aparecerá aqui.
              </p>
            ) : (
              allEvents.map((evt, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-background/60 border text-[11px]">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] uppercase font-bold">
                      {evt.action || "sync"}
                    </Badge>
                    <span className="text-foreground">
                      {evt.productId ? `[${evt.productId}] ` : ""}
                      {typeof evt.details === "string" ? evt.details : JSON.stringify(evt.details || "")}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-[10px] whitespace-nowrap ml-2">
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleString("pt-BR") : "Agora"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LISTAGEM DOS 79 MODELOS */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p>Carregando modelos do catálogo público...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card space-y-3">
          <Store className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-lg font-semibold text-foreground">Nenhum veículo encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {search || selectedCat !== "all" || statusFilter !== "all"
              ? "Tente ajustar os filtros ou termos da sua busca."
              : "Seu catálogo público ainda não possui modelos cadastrados. Crie um novo ou importe diretamente do estoque."}
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
            const hasPromo = (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price);
            const isSoldOut = p.stock === 0;
            const isLowStock = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= lowStockLimit;
            const isUnlimited = p.stock === null || p.stock === undefined;
            const mainPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : "";

            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-card overflow-hidden shadow-2xs transition-all hover:shadow-md flex flex-col justify-between ${
                  !p.active ? "opacity-60 border-dashed" : ""
                }`}
              >
                {/* TOPO COM FOTO, BADGES E SELOS */}
                <div>
                  <div className="relative aspect-video w-full bg-muted/40 overflow-hidden">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto}
                        alt={p.name}
                        className={`w-full h-full object-cover transition-transform hover:scale-105 duration-300 ${
                          isSoldOut ? "grayscale filter contrast-125" : ""
                        }`}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        Sem Foto
                      </div>
                    )}

                    {/* Carimbo de ESGOTADO com botão Avise-me */}
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5">
                        <span className="px-3 py-1 bg-destructive text-destructive-foreground font-black text-xs uppercase tracking-widest rounded shadow-md">
                          ESGOTADO
                        </span>
                        <span className="text-[10px] text-white/90">Botão WhatsApp: "Avise-me quando chegar"</span>
                      </div>
                    )}

                    {/* Badges Flutuantes Superiores */}
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

                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      {p.featuredHero && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                          <Star className="w-3 h-3 fill-white" /> HERO {p.heroOrder ? `#${p.heroOrder}` : ""}
                        </Badge>
                      )}

                      {hasPromo && (
                        <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold gap-1 shadow-xs">
                          <Tag className="w-3 h-3" /> {p.promo?.label || "OFERTA"}
                        </Badge>
                      )}

                      {p.readyDelivery && (
                        <Badge className="bg-emerald-600 text-white text-[10px] shadow-xs">
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

                    {/* PREÇO E VALOR ANTERIOR (DE / POR) */}
                    <div className="flex items-baseline justify-between pt-1 border-t">
                      <div>
                        {p.oldPrice && (
                          <div className="text-xs line-through text-muted-foreground">
                            De: {formatCurrency(p.oldPrice)}
                          </div>
                        )}
                        <div className="text-lg font-black text-foreground">
                          {formatCurrency(p.price)}
                        </div>
                        {p.installments && (
                          <span className="text-[10px] text-muted-foreground block">
                            Simulador até 21x ativo
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleQuickPrice(p)}
                          className="h-6 px-1.5 text-xs text-primary hover:text-primary gap-1"
                          title="Alterar Preço"
                        >
                          <DollarSign className="w-3 h-3" />
                          Preço
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPromo(p)}
                          className="h-6 px-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 gap-1"
                          title="Configurar Promoção"
                        >
                          <Tag className="w-3 h-3" />
                          Promoção
                        </Button>
                      </div>
                    </div>

                    {/* CONTROLE DE ESTOQUE REATIVO */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                      <span className="text-muted-foreground">Estoque:</span>
                      <div className="flex items-center gap-1.5">
                        {isSoldOut ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            ESGOTADO (0)
                          </Badge>
                        ) : isLowStock ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold">
                            Últimas {p.stock} unid.!
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
                          title={isSoldOut ? "Tornar Pronta Entrega" : "Marcar como Esgotado"}
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
                        <DropdownMenuItem onClick={() => handleOpenPromo(p)} className="gap-2">
                          <Tag className="w-4 h-4 text-amber-500" /> Configurar Promoção
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleFeaturedHero(p.id, !p.featuredHero, (p.heroOrder || 1))}
                          className="gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-primary" />
                          {p.featuredHero ? "Remover do Carrossel Hero" : "Destacar no Carrossel Hero"}
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

      {/* DIÁLOGOS E FERRAMENTAS */}
      <CatalogConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentConfig={catalog?.config}
        onSaveStoreConfig={updateConfig}
        onSaveRates={updateRates}
      />

      <CatalogHeroCarouselDialog
        open={heroDialogOpen}
        onOpenChange={setHeroDialogOpen}
        products={products}
        onSaveHeroList={setHeroList}
        onToggleHero={toggleFeaturedHero}
      />

      <CatalogPromoDialog
        open={promoDialogOpen}
        onOpenChange={setPromoDialogOpen}
        product={selectedProductForPromo}
        onSavePromo={updatePromo}
      />

      <CatalogChatTestDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        onSendMessage={(messages) => chatMutation.mutateAsync(messages)}
      />

      <CatalogCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        currentCampaign={
          catalog?.config?.campaign ||
          catalog?.events?.find((e) => e.action === "campaign")?.details ||
          null
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
