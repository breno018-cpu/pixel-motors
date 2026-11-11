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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Building2,
  MapPin,
  Zap,
  Flame,
  ShieldCheck,
  Layers,
  LayoutGrid,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { CatalogConfigDialog } from "@/components/catalog/CatalogConfigDialog";
import { CatalogCampaignDialog } from "@/components/catalog/CatalogCampaignDialog";
import { CatalogProductDialog } from "@/components/catalog/CatalogProductDialog";
import { CatalogImportFromStockDialog } from "@/components/catalog/CatalogImportFromStockDialog";
import { CatalogQuickPriceDialog } from "@/components/catalog/CatalogQuickPriceDialog";
import { CatalogHeroCarouselDialog } from "@/components/catalog/CatalogHeroCarouselDialog";
import { CatalogPromoDialog } from "@/components/catalog/CatalogPromoDialog";
import { CatalogChatTestDialog } from "@/components/catalog/CatalogChatTestDialog";

// Definição dos 4 Grupos Oficiais do Catálogo L1MA Motors (idêntico ao site público)
const OFFICIAL_GROUPS = [
  {
    id: "shineray",
    name: "Concessionária Shineray",
    shortName: "Shineray",
    tagline: "Concessionária Autorizada Exclusiva Shineray do Brasil",
    badge: "Autorizada Oficial",
    borderTheme: "border-emerald-500/30",
    bgTheme: "bg-emerald-500/5",
    badgeTheme: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: ShieldCheck,
    defaultSubs: ["Todas", "Street", "Trail", "Scooter", "Ciclomotor", "Custom", "Esportiva"],
  },
  {
    id: "ele",
    name: "Elétricas Multimarcas",
    shortName: "Elétricas",
    tagline: "Mobilidade Urbana Sustentável, Scooters e Ciclomotores Elétricos",
    badge: "100% Elétrica",
    borderTheme: "border-cyan-500/30",
    bgTheme: "bg-cyan-500/5",
    badgeTheme: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    icon: Zap,
    defaultSubs: ["Todas", "Scooter", "Ciclomotor", "Patinete", "Street"],
  },
  {
    id: "off",
    name: "Off-Road & Quadriciclos",
    shortName: "Off-Road",
    tagline: "Quadriciclos 4x4, ATVs, UTVs e Motocross Multimarcas",
    badge: "Fora de Estrada",
    borderTheme: "border-amber-500/30",
    bgTheme: "bg-amber-500/5",
    badgeTheme: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Flame,
    defaultSubs: ["Todas", "Quadriciclo", "ATV", "Off-Road", "Trilha", "Pit Bike"],
  },
  {
    id: "semi",
    name: "Semi-Novos Selecionados",
    shortName: "Semi-novos",
    tagline: "Motos e Scooters Revisadas com Laudo Cautelar e Garantia",
    badge: "Garantia & Procedência",
    borderTheme: "border-purple-500/30",
    bgTheme: "bg-purple-500/5",
    badgeTheme: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    icon: Award,
    defaultSubs: ["Todas", "Street", "Trail", "Scooter", "Custom"],
  },
];

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
    updateStore,
    updateCampaign,
    updateConfig,
    updateRates,
    upsertProduct,
    removeProduct,
    batchSync,
    apiSettings,
  } = useCatalog();

  // Filtros por Loja & por Grupo
  const [selectedStore, setSelectedStore] = useState<string>("all"); // 'all' | 'store-divinopolis' | 'store-montesclaros'
  const [selectedCat, setSelectedCat] = useState<string>("all"); // 'all' | 'shineray' | 'ele' | 'off' | 'semi'
  const [selectedSub, setSelectedSub] = useState<string>("all"); // Subcategoria
  const [viewGrouping, setViewGrouping] = useState<"sections" | "tabs">("sections"); // 'sections' (como no site) | 'tabs'
  const [search, setSearch] = useState("");
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

  // Contadores por Concessionária / Loja
  const countDivinopolis = useMemo(() => {
    return products.filter((p) => !p.store_id || p.store_id === "all" || p.store_id === "store-divinopolis").length;
  }, [products]);

  const countMontesClaros = useMemo(() => {
    return products.filter((p) => !p.store_id || p.store_id === "all" || p.store_id === "store-montesclaros").length;
  }, [products]);

  // Produtos Filtrados Inicialmente pela Concessionária Selecionada
  const storeProducts = useMemo(() => {
    if (selectedStore === "all") return products;
    return products.filter((p) => {
      const pStore = p.store_id || "all";
      return pStore === "all" || pStore === selectedStore;
    });
  }, [products, selectedStore]);

  // Contadores e KPIs no Escopo da Loja Selecionada
  const totalCount = storeProducts.length;
  const activeCount = storeProducts.filter((p) => p.active !== false).length;
  const soldOutCount = storeProducts.filter((p) => p.stock === 0).length;
  const promoCount = storeProducts.filter(
    (p) => (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price)
  ).length;
  const heroCount = storeProducts.filter((p) => p.featuredHero).length;

  // Filtragem Geral (Loja + Grupo + Subcategoria + Status + Busca)
  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) => {
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

      // Grupo / Categoria
      if (selectedCat !== "all" && p.cat !== selectedCat) {
        return false;
      }

      // Subcategoria (se filtrada)
      if (selectedSub !== "all" && selectedSub !== "Todas") {
        if ((p.sub || "").toLowerCase() !== selectedSub.toLowerCase()) {
          return false;
        }
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
  }, [storeProducts, search, selectedCat, selectedSub, statusFilter]);

  // Lista de Subcategorias disponíveis para o grupo selecionado
  const currentAvailableSubs = useMemo(() => {
    if (selectedCat === "all") {
      const set = new Set<string>();
      storeProducts.forEach((p) => {
        if (p.sub) set.add(p.sub.trim());
      });
      return ["Todas", ...Array.from(set).sort()];
    }
    const grp = OFFICIAL_GROUPS.find((g) => g.id === selectedCat);
    return grp ? grp.defaultSubs : ["Todas"];
  }, [selectedCat, storeProducts]);

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

  // Renderizador de Card Individual de Veículo
  const renderProductCard = (p: CatalogProduct) => {
    const hasPromo = (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price);
    const isSoldOut = p.stock === 0;
    const isLowStock = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= lowStockLimit;
    const isUnlimited = p.stock === null || p.stock === undefined;
    const mainPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : "";
    const storeLabel =
      p.store_id === "store-divinopolis"
        ? "Divinópolis"
        : p.store_id === "store-montesclaros"
        ? "Montes Claros"
        : "Todas as Lojas";

    return (
      <div
        key={p.id}
        className={`rounded-2xl border bg-card overflow-hidden shadow-2xs transition-all hover:shadow-md flex flex-col justify-between ${
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
                <span className="text-[10px] text-white/90">WhatsApp: "Avise-me quando chegar"</span>
              </div>
            )}

            {/* Badges Flutuantes Superiores: Grupo & Subgrupo & Loja */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
              <Badge
                variant="secondary"
                className="bg-background/90 backdrop-blur-sm text-[10px] font-bold uppercase shadow-xs"
              >
                {p.cat === "shineray"
                  ? "🟢 Shineray"
                  : p.cat === "ele"
                  ? "⚡ Elétrica"
                  : p.cat === "semi"
                  ? "🔄 Semi-novo"
                  : "🏁 Off-Road"}
              </Badge>

              {p.sub && (
                <Badge
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm text-[9px] font-semibold border-border"
                >
                  {p.sub}
                </Badge>
              )}

              {/* Badge da Loja / Concessionária */}
              <Badge
                variant="outline"
                className={`text-[9px] font-semibold backdrop-blur-sm ${
                  p.store_id === "store-divinopolis"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                    : p.store_id === "store-montesclaros"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                    : "bg-muted/80 text-foreground border-border"
                }`}
              >
                <MapPin className="w-2.5 h-2.5 mr-0.5 inline" />
                {storeLabel}
              </Badge>
            </div>

            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
              {p.featuredHero && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                  <Star className="w-3 h-3 fill-white" /> HERO {p.heroOrder ? `#${p.heroOrder}` : ""}
                </Badge>
              )}

              {hasPromo && (
                <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold gap-1 shadow-xs animate-pulse">
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
                <span className="text-xs font-semibold text-muted-foreground uppercase">{p.brand}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{p.id}</span>
              </div>
              <h3 className="font-bold text-base text-foreground truncate mt-0.5" title={p.name}>
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

                {/* Alterar Rápido de Estoque */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground">
                      <Edit className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuLabel>Ajuste Rápido de Estoque</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => updateStock(p.id, 0)}>
                      Marcar como Esgotado (0)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStock(p.id, 1)}>
                      Última unidade (1)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStock(p.id, 2)}>
                      2 unidades
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStock(p.id, 5)}>
                      Estoque normal (5)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStock(p.id, null)}>
                      Pronta Entrega (Sem limite)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO CARD COM AÇÕES E VISIBILIDADE */}
        <div className="p-3 bg-muted/20 border-t flex items-center justify-between gap-2">
          {/* Switch de Visibilidade Pública Instantânea */}
          <div className="flex items-center gap-1.5">
            <Switch
              checked={p.active !== false}
              onCheckedChange={(val) => toggleActive(p.id, val)}
              id={`switch-${p.id}`}
              className="scale-90"
            />
            <label
              htmlFor={`switch-${p.id}`}
              className="text-xs cursor-pointer select-none text-muted-foreground hover:text-foreground font-medium"
            >
              {p.active !== false ? "Visível" : "Oculto"}
            </label>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditProduct(p)}
              className="h-8 text-xs gap-1"
            >
              <Edit className="w-3.5 h-3.5" />
              Editar
            </Button>

            {/* Menu com Opções Avançadas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Ações do Veículo</DropdownMenuLabel>
                
                {/* Atribuição de Concessionária / Loja */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    Atribuir à Loja
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="text-xs">
                    <DropdownMenuItem onClick={() => updateStore(p.id, "all", "Todas as Lojas")}>
                      🏢 Todas as Lojas (Rede)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStore(p.id, "store-divinopolis", "Divinópolis")}>
                      📍 Divinópolis (Matriz Oeste)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStore(p.id, "store-montesclaros", "Montes Claros")}>
                      📍 Montes Claros (Polo Norte)
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem onClick={() => handleOpenPromo(p)} className="gap-2 text-xs">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  Configurar Promoção
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toggleFeaturedHero(p.id, !p.featuredHero, p.heroOrder || 1)}
                  className="gap-2 text-xs"
                >
                  <Star className={`w-3.5 h-3.5 ${p.featuredHero ? "fill-amber-500 text-amber-500" : ""}`} />
                  {p.featuredHero ? "Remover do Carrossel Hero" : "Destacar no Carrossel Hero"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQuickPrice(p)} className="gap-2 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  Alterar Preço
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEditProduct(p)} className="gap-2 text-xs">
                  <Edit className="w-3.5 h-3.5" />
                  Editar Completo (Fotos, Specs)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteProduct(p)}
                  className="gap-2 text-xs text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir do Catálogo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CABEÇALHO EXECUTIVO */}
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
                {products.length} Modelos • v{catalog?.version || 1}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Central de comando e sincronização em tempo real (produtos, estoque por loja, grupos comerciais, preços, promoções e mídias).
          </p>
        </div>

        {/* Botões de Ações Rápidas */}
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

      {/* 2. DIVISÃO POR LOJA (SELETOR DE CONCESSIONÁRIA E MODO DE VISUALIZAÇÃO) */}
      <div className="p-3.5 rounded-2xl border bg-card/70 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span>Concessionária:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={selectedStore === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStore("all")}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold"
            >
              <Store className="w-3.5 h-3.5" />
              Todas as Lojas / Rede ({products.length})
            </Button>

            <Button
              variant={selectedStore === "store-divinopolis" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStore("store-divinopolis")}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold"
            >
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              Divinópolis ({countDivinopolis})
            </Button>

            <Button
              variant={selectedStore === "store-montesclaros" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStore("store-montesclaros")}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              Montes Claros ({countMontesClaros})
            </Button>
          </div>
        </div>

        {/* Alternador de Modo de Visualização: Em Seções por Grupo vs Em Abas */}
        <div className="flex items-center gap-1.5 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">Exibição:</span>
          <Button
            variant={viewGrouping === "sections" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewGrouping("sections")}
            className="h-8 text-xs gap-1.5 font-bold rounded-xl"
            title="Exibir dividido por seções de grupos (idêntico ao site público)"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
            Por Grupo (Como no Site)
          </Button>

          <Button
            variant={viewGrouping === "tabs" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewGrouping("tabs")}
            className="h-8 text-xs gap-1.5 font-bold rounded-xl"
            title="Exibir em abas individuais"
          >
            <Layers className="w-3.5 h-3.5" />
            Em Abas
          </Button>
        </div>
      </div>

      {/* 3. KPIS DE RESUMO DA LOJA SELECIONADA */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Modelos na Loja</span>
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {selectedStore === "all" ? "Toda a rede L1MA" : selectedStore === "store-divinopolis" ? "Unidade Divinópolis" : "Unidade Montes Claros"}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ativos / Visíveis</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{activeCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Visíveis no catálogo</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Esgotados</span>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold text-destructive">{soldOutCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Carimbo WhatsApp ativo</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Em Oferta</span>
            <Tag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">{promoCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Com desconto ativo</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Carrossel Topo</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-500">{heroCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Destaques do banner</p>
        </div>
      </div>

      {/* 4. DIVISÃO POR GRUPO (ABAS OFICIAIS COMO NO SITE PÚBLICO) */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Abas dos 4 Grandes Grupos */}
          <Tabs
            value={selectedCat}
            onValueChange={(val) => {
              setSelectedCat(val);
              setSelectedSub("all");
            }}
            className="w-full lg:w-auto"
          >
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full lg:w-auto h-auto p-1 bg-muted/60">
              <TabsTrigger value="all" className="text-xs py-2 font-bold">
                🌟 Todos ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="shineray" className="text-xs py-2 font-bold gap-1 text-emerald-600 dark:text-emerald-400">
                🟢 Shineray ({storeProducts.filter((p) => p.cat === "shineray").length})
              </TabsTrigger>
              <TabsTrigger value="ele" className="text-xs py-2 font-bold gap-1 text-cyan-600 dark:text-cyan-400">
                ⚡ Elétricas ({storeProducts.filter((p) => p.cat === "ele").length})
              </TabsTrigger>
              <TabsTrigger value="off" className="text-xs py-2 font-bold gap-1 text-amber-600 dark:text-amber-400">
                🏁 Off-Road ({storeProducts.filter((p) => p.cat === "off").length})
              </TabsTrigger>
              <TabsTrigger value="semi" className="text-xs py-2 font-bold gap-1 text-purple-600 dark:text-purple-400">
                🔄 Semi-novos ({storeProducts.filter((p) => p.cat === "semi").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filtros Rápidos de Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-500" /> Ativos
            </Button>
            <Button
              variant={statusFilter === "hidden" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("hidden")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Ocultos
            </Button>
            <Button
              variant={statusFilter === "soldout" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("soldout")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Esgotados
            </Button>
            <Button
              variant={statusFilter === "promo" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("promo")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <Tag className="w-3.5 h-3.5 text-amber-500" /> Ofertas
            </Button>
            <Button
              variant={statusFilter === "hero" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("hero")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Carrossel
            </Button>
          </div>
        </div>

        {/* Pílulas de Subcategorias (Estilos Comerciais do Grupo) */}
        {currentAvailableSubs.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
              Estilo / Subgrupo:
            </span>
            {currentAvailableSubs.map((subName) => (
              <Button
                key={subName}
                variant={selectedSub === subName ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSub(subName)}
                className="h-7 text-xs px-2.5 rounded-full shrink-0 font-medium"
              >
                {subName}
              </Button>
            ))}
          </div>
        )}

        {/* Campo de Busca & Alternador do Histórico de Auditoria */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do modelo, marca, estilo (Trail, Scooter, Street...) ou ID único..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLiveStream(!showLiveStream)}
            className="h-9 text-xs gap-1.5 rounded-xl shrink-0"
          >
            <History className="w-4 h-4 text-primary" />
            {showLiveStream ? "Ocultar Auditoria" : `Auditoria (${allEvents.length})`}
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

      {/* 5. LISTAGEM DIVIDIDA POR GRUPO (COMO NO SITE) OU EM GRADE */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p>Carregando modelos do catálogo público...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center border rounded-2xl bg-card space-y-3">
          <Store className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-lg font-semibold text-foreground">Nenhum veículo encontrado para este filtro</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {search || selectedStore !== "all" || selectedCat !== "all" || statusFilter !== "all"
              ? "Tente ajustar os filtros de concessionária, grupo ou busca acima."
              : "Seu catálogo público ainda não possui modelos cadastrados."}
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
      ) : viewGrouping === "sections" && selectedCat === "all" ? (
        // VISUALIZAÇÃO DIVIDIDA POR GRUPO (SEÇÕES COMO NO SITE PÚBLICO)
        <div className="space-y-8">
          {OFFICIAL_GROUPS.map((group) => {
            const groupProducts = filteredProducts.filter((p) => p.cat === group.id);
            if (groupProducts.length === 0) return null;

            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="space-y-4">
                {/* CABEÇALHO DO GRUPO (IDÊNTICO AO SITE PÚBLICO) */}
                <div className={`p-4 rounded-2xl border ${group.borderTheme} ${group.bgTheme} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-card border flex items-center justify-center shrink-0 shadow-xs">
                      <GroupIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black tracking-tight text-foreground">
                          {group.name}
                        </h2>
                        <Badge className={`${group.badgeTheme} text-[10px] font-bold`}>
                          {group.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Badge variant="outline" className="font-mono text-xs bg-card/80">
                      {groupProducts.length} {groupProducts.length === 1 ? "modelo" : "modelos"} nesta loja
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCat(group.id);
                        setSelectedSub("all");
                      }}
                      className="text-xs h-7 px-2"
                    >
                      Ver apenas este grupo →
                    </Button>
                  </div>
                </div>

                {/* GRID DE CARDS DO GRUPO */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupProducts.map(renderProductCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // VISUALIZAÇÃO EM GRADE FILTRADA (OU ABA ESPECÍFICA)
        <div className="space-y-4">
          {selectedCat !== "all" && (
            <div className="p-3.5 rounded-2xl border bg-muted/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Exibindo grupo: {OFFICIAL_GROUPS.find((g) => g.id === selectedCat)?.name || selectedCat}
                </span>
                <span className="text-xs text-muted-foreground">({filteredProducts.length} modelos)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCat("all");
                  setSelectedSub("all");
                }}
                className="text-xs h-7"
              >
                ← Ver todos os grupos
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(renderProductCard)}
          </div>
        </div>
      )}

      {/* 6. MODAIS DO SISTEMA DO CATÁLOGO */}
      {/* Modal de Configurações da Loja e Taxas */}
      <CatalogConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={catalog?.config || {}}
        onSaveConfig={updateConfig}
        onSaveRates={updateRates}
      />

      {/* Modal de Campanha Sazonal */}
      <CatalogCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        campaign={catalog?.config?.campaign}
        onSaveCampaign={updateCampaign}
      />

      {/* Modal do Carrossel Hero */}
      <CatalogHeroCarouselDialog
        open={heroDialogOpen}
        onOpenChange={setHeroDialogOpen}
        products={products}
        onSaveHeroList={setHeroList}
      />

      {/* Sandbox do Chatbot com IA */}
      <CatalogChatTestDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        onSendMessage={(messages) => chatMutation.mutateAsync(messages)}
        isSending={chatMutation.isPending}
      />

      {/* Modal de Produto Completo */}
      <CatalogProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProductForEdit}
        onSaveProduct={upsertProduct}
      />

      {/* Modal de Importação do Estoque Físico */}
      <CatalogImportFromStockDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingCatalogProductIds={existingIds}
        onBatchSync={batchSync}
      />

      {/* Modal de Alteração Rápida de Preço */}
      <CatalogQuickPriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        product={selectedProductForPrice}
        onSavePrice={updatePrice}
      />

      {/* Modal de Configuração de Oferta / Promoção */}
      <CatalogPromoDialog
        open={promoDialogOpen}
        onOpenChange={setPromoDialogOpen}
        product={selectedProductForPromo}
        onSavePromo={updatePromo}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Veículo do Catálogo Público?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação enviará uma requisição de exclusão permanente para o Catálogo L1MA Motors
              do veículo <strong>"{deleteProduct?.name}"</strong> ({deleteProduct?.id}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Sim, Excluir do Catálogo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
