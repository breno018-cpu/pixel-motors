import { useState, useMemo, useEffect } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import { CatalogProduct, CatalogPromo, CatalogSyncAction } from "@/types/catalog";
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
  AlertTriangle,
  History,
  Sparkles,
  Bot,
  Star,
  Building2,
  MapPin,
  Zap,
  Flame,
  ShieldCheck,
  Layers,
  LayoutGrid,
  Award,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Send,
  Table as TableIcon,
  Layers3,
  ChevronDown,
  Boxes,
  Link2,
} from "lucide-react";
import { useVehicles } from "@/hooks/useVehicles";
import {
  FALLBACK_PATTERNS,
  fetchChassisPatterns,
  calculateRealStockForProduct,
  ChassisPatternItem,
} from "@/lib/catalogStockLink";
import { CatalogRealStockLinkDialog } from "@/components/catalog/CatalogRealStockLinkDialog";
import { CatalogConfigDialog } from "@/components/catalog/CatalogConfigDialog";
import { CatalogCampaignDialog } from "@/components/catalog/CatalogCampaignDialog";
import { CatalogProductDialog } from "@/components/catalog/CatalogProductDialog";
import { CatalogImportFromStockDialog } from "@/components/catalog/CatalogImportFromStockDialog";
import { CatalogQuickPriceDialog } from "@/components/catalog/CatalogQuickPriceDialog";
import { CatalogHeroCarouselDialog } from "@/components/catalog/CatalogHeroCarouselDialog";
import { CatalogPromoDialog } from "@/components/catalog/CatalogPromoDialog";
import { CatalogChatTestDialog } from "@/components/catalog/CatalogChatTestDialog";
import { CatalogDescDialog } from "@/components/catalog/CatalogDescDialog";
import { CatalogReorderDialog } from "@/components/catalog/CatalogReorderDialog";
import { toast } from "sonner";

// Definição das 4 Partes Oficiais do Catálogo L1MA Motors
const CATALOG_PARTS = [
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
    shortName: "Off-road",
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
    setCarouselList,
    setProductOrder,
    reorderProducts,
    updateDescription,
    updateCategory,
    updateStore,
    updateCampaign,
    updateConfig,
    updateRates,
    upsertProduct,
    removeProduct,
    batchSync,
    apiSettings,
  } = useCatalog();

  // Controle de Parte no Catálogo (shineray, ele, off, semi ou all)
  const [selectedCat, setSelectedCat] = useState<string>("all"); // 'all' | 'shineray' | 'ele' | 'off' | 'semi'
  const [selectedSub, setSelectedSub] = useState<string>("all"); // Subcategoria
  const [selectedStore, setSelectedStore] = useState<string>("all"); // Filtro de concessionária opcional
  const [viewGrouping, setViewGrouping] = useState<"sections" | "tabs">("sections"); // 'sections' (como no site) | 'tabs'
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("cards"); // 'cards' | 'table'
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "soldout" | "promo" | "hero">("all");
  const [showLiveStream, setShowLiveStream] = useState(false);

  // Fila de Envio em Lote (Batch Sync Queue)
  const [batchMode, setBatchMode] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<Array<{ action: CatalogSyncAction; label: string }>>([]);
  const [isSendingBatch, setIsSendingBatch] = useState(false);

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
  const [descDialogOpen, setDescDialogOpen] = useState(false);
  const [selectedProductForDesc, setSelectedProductForDesc] = useState<CatalogProduct | null>(null);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);

  // Atrelamento ao Estoque Real (DealFlow Hub)
  const { data: vehicles = [] } = useVehicles();
  const [chassisPatternsList, setChassisPatternsList] = useState<ChassisPatternItem[]>(FALLBACK_PATTERNS);
  const [stockLinkDialogOpen, setStockLinkDialogOpen] = useState(false);
  const [selectedProductForStockLink, setSelectedProductForStockLink] = useState<CatalogProduct | null>(null);
  const [isBulkSyncingStock, setIsBulkSyncingStock] = useState(false);

  // Carregar padrões de chassi do banco de dados (chassis_patterns)
  useEffect(() => {
    fetchChassisPatterns().then((pts) => {
      if (pts && pts.length > 0) setChassisPatternsList(pts);
    });
  }, []);

  // Dialog de Exclusão
  const [deleteProduct, setDeleteProduct] = useState<CatalogProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Produtos do catálogo
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const lowStockLimit = catalog?.config?.lowStockThreshold ?? 2;

  // Set de IDs existentes para importar
  const existingIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  // Contadores por Parte no Catálogo (Categorias Oficiais)
  const countShineray = useMemo(() => products.filter((p) => p.cat === "shineray").length, [products]);
  const countEle = useMemo(() => products.filter((p) => p.cat === "ele").length, [products]);
  const countOff = useMemo(() => products.filter((p) => p.cat === "off").length, [products]);
  const countSemi = useMemo(() => products.filter((p) => p.cat === "semi").length, [products]);

  // Contadores e KPIs Gerais
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.active !== false).length;
  const hiddenCount = products.filter((p) => p.active === false).length;
  const soldOutCount = products.filter((p) => p.stock === 0).length;
  const promoCount = products.filter(
    (p) => (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price)
  ).length;
  const heroCount = products.filter((p) => p.featuredHero).length;

  // Filtragem Geral (Parte no Catálogo + Subcategoria + Status + Busca)
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

      // Parte no Catálogo (shineray, ele, off, semi)
      if (selectedCat !== "all" && p.cat !== selectedCat) {
        return false;
      }

      // Subcategoria (se filtrada)
      if (selectedSub !== "all" && selectedSub !== "Todas") {
        if ((p.sub || "").toLowerCase() !== selectedSub.toLowerCase()) {
          return false;
        }
      }

      // Filtro de Loja (se selecionada)
      if (selectedStore !== "all") {
        const pStore = p.store_id || "all";
        if (pStore !== "all" && pStore !== selectedStore) {
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
  }, [products, search, selectedCat, selectedSub, selectedStore, statusFilter]);

  // Lista de Subcategorias disponíveis para a parte do catálogo selecionada
  const currentAvailableSubs = useMemo(() => {
    if (selectedCat === "all") {
      const set = new Set<string>();
      products.forEach((p) => {
        if (p.sub) set.add(p.sub.trim());
      });
      return ["Todas", ...Array.from(set).sort()];
    }
    const grp = CATALOG_PARTS.find((g) => g.id === selectedCat);
    return grp ? grp.defaultSubs : ["Todas"];
  }, [selectedCat, products]);

  // Helper de Despacho Direto ou Enfileiramento em Lote
  const dispatchOrQueue = async (action: CatalogSyncAction, label: string) => {
    if (batchMode) {
      setPendingBatch((prev) => [...prev, { action, label }]);
      toast.info(`Adicionado ao lote pendente: ${label}`);
      return;
    }
    try {
      await batchSync([action]);
    } catch (e: any) {
      // Toast já tratado no hook useCatalog
    }
  };

  // Enviar Lote Atômico Completo
  const handleSendBatch = async () => {
    if (pendingBatch.length === 0) return;
    setIsSendingBatch(true);
    try {
      const actions = pendingBatch.map((item) => item.action);
      await batchSync(actions);
      toast.success(`${pendingBatch.length} operações enviadas e aplicadas em lote com sucesso!`);
      setPendingBatch([]);
    } catch (e: any) {
      toast.error(`Falha no envio em lote: ${e.message}`);
    } finally {
      setIsSendingBatch(false);
    }
  };

  const handleClearBatch = () => {
    setPendingBatch([]);
    toast.info("Fila de lote descartada.");
  };

  // MUDAR PARTE NO CATÁLOGO (Shineray, Elétricas, Off-Road, Semi-novos)
  const handleMoveCategory = (p: CatalogProduct, newCat: "shineray" | "ele" | "off" | "semi") => {
    const catLabels: Record<string, string> = {
      shineray: "🟢 Concessionária Shineray",
      ele: "⚡ Elétricas Multimarcas",
      off: "🏁 Off-Road & Quadriciclos",
      semi: "🔄 Semi-Novos Selecionados",
    };
    const action: CatalogSyncAction = {
      action: "create",
      ...p,
      cat: newCat,
    };
    dispatchOrQueue(action, `Mover "${p.name}" para ${catLabels[newCat]}`);
  };

  // Handlers de Operações
  const handleToggleActive = (p: CatalogProduct) => {
    const nextActive = p.active === false;
    const action: CatalogSyncAction = { action: "active", id: p.id, value: nextActive };
    dispatchOrQueue(action, `${nextActive ? "Ativar" : "Ocultar"} ${p.name}`);
  };

  const handleDirectStockChange = (p: CatalogProduct, newStock: number | null) => {
    const action: CatalogSyncAction = {
      action: "stock",
      id: p.id,
      stock: newStock,
      value: newStock,
      readyDelivery: newStock !== 0,
    };
    dispatchOrQueue(action, `Estoque ${p.name} = ${newStock !== null ? newStock : "Pronta Entrega"}`);
  };

  const handleZeroStock = (p: CatalogProduct) => {
    const action: CatalogSyncAction = {
      action: "stock",
      id: p.id,
      stock: 0,
      value: 0,
      readyDelivery: false,
    };
    dispatchOrQueue(action, `Zerar estoque (Esgotado) ${p.name}`);
  };

  const handleRestock = (p: CatalogProduct, addQty: number) => {
    const current = typeof p.stock === "number" ? p.stock : 0;
    const nextStock = current + addQty;
    const action: CatalogSyncAction = {
      action: "stock",
      id: p.id,
      stock: nextStock,
      value: nextStock,
      readyDelivery: true,
    };
    dispatchOrQueue(action, `Repor +${addQty} unid. em ${p.name}`);
  };

  const handleToggleReadyDelivery = (p: CatalogProduct) => {
    const nextReady = !p.readyDelivery;
    const action: CatalogSyncAction = {
      action: "stock",
      id: p.id,
      stock: p.stock,
      readyDelivery: nextReady,
    };
    dispatchOrQueue(action, `Pronta entrega ${nextReady ? "Sim" : "Não"} em ${p.name}`);
  };

  const handleToggleHero = (p: CatalogProduct) => {
    const nextHero = !p.featuredHero;
    const nextOrder = p.heroOrder || 1;
    const action: CatalogSyncAction = {
      action: "carousel",
      id: p.id,
      featured: nextHero,
      order: nextOrder,
    };
    dispatchOrQueue(action, `${nextHero ? "Destacar" : "Remover"} no Carrossel: ${p.name}`);
  };

  const handleMoveProduct = (p: CatalogProduct, direction: "up" | "down") => {
    const index = filteredProducts.findIndex((item) => item.id === p.id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredProducts.length) return;

    const copy = [...filteredProducts];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const ids = copy.map((item) => item.id);
    const action: CatalogSyncAction = { action: "reorder", ids };
    dispatchOrQueue(action, `Mover ${p.name} para posição #${targetIndex + 1}`);
  };

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

  const handleOpenDesc = (prod: CatalogProduct) => {
    setSelectedProductForDesc(prod);
    setDescDialogOpen(true);
  };

  const handleOpenStockLink = (prod: CatalogProduct) => {
    setSelectedProductForStockLink(prod);
    setStockLinkDialogOpen(true);
  };

  const handleSaveStockLink = async (
    productId: string,
    patternCode: string,
    realStockQty: number,
    autoSync: boolean
  ) => {
    const stockAction: CatalogSyncAction = {
      action: "stock",
      id: productId,
      stock: realStockQty,
      readyDelivery: realStockQty > 0,
    };
    await dispatchOrQueue(stockAction, `Estoque físico (${realStockQty} un.) para ${productId}`);

    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const updateAction: CatalogSyncAction = {
        action: "create",
        ...prod,
        stock: realStockQty,
        readyDelivery: realStockQty > 0,
        patternCode,
        autoSyncStock: autoSync,
      };
      await dispatchOrQueue(updateAction, `Atrelar código ${patternCode} em ${prod.name}`);
    }
  };

  const handleBulkSyncRealStock = async () => {
    if (!products || products.length === 0) {
      toast.error("Nenhum produto cadastrado no catálogo para sincronizar.");
      return;
    }

    setIsBulkSyncingStock(true);
    try {
      const syncActions: CatalogSyncAction[] = [];
      let updatedCount = 0;

      for (const p of products) {
        const stockRes = calculateRealStockForProduct(p, vehicles, chassisPatternsList);
        const realQty = stockRes.totalCount;
        if (p.stock !== realQty) {
          syncActions.push({
            action: "stock",
            id: p.id,
            stock: realQty,
            readyDelivery: realQty > 0,
          });
          updatedCount++;
        }
      }

      if (syncActions.length === 0) {
        toast.info("Todos os modelos já estão alinhados com o estoque físico em pátio!");
        return;
      }

      await batchSync(syncActions);
      toast.success(
        `Sincronização concluída! ${updatedCount} modelos atualizados com a contagem real de motos em estoque no pátio.`
      );
    } catch (err: any) {
      toast.error(`Falha ao sincronizar estoque em lote: ${err.message}`);
    } finally {
      setIsBulkSyncingStock(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      const action: CatalogSyncAction = { action: "remove", id: deleteProduct.id };
      await dispatchOrQueue(action, `Excluir ${deleteProduct.name}`);
      setDeleteProduct(null);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "Sob Consulta";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Auditoria
  const allEvents = useMemo(() => {
    const list = [...liveEvents, ...events];
    const unique = new Map<string, any>();
    list.forEach((e) => {
      const key = `${e.timestamp}-${e.action}-${e.productId || ""}`;
      if (!unique.has(key)) unique.set(key, e);
    });
    return Array.from(unique.values()).slice(0, 60);
  }, [liveEvents, events]);

  // Card Individual
  const renderProductCard = (p: CatalogProduct, index: number) => {
    const hasPromo = (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price);
    const isSoldOut = p.stock === 0;
    const isLowStock = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= lowStockLimit;
    const isUnlimited = p.stock === null || p.stock === undefined;
    const mainPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : "";
    const realStock = calculateRealStockForProduct(p, vehicles, chassisPatternsList);

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

            {/* Posição Numérica & Ordem */}
            <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
              <Badge className="bg-black/80 backdrop-blur-sm text-white font-mono text-xs font-bold shadow-xs">
                #{index + 1}
              </Badge>
              <div className="flex bg-black/70 backdrop-blur-sm rounded overflow-hidden">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveProduct(p, "up")}
                  className="px-1.5 py-0.5 text-white/90 hover:text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                  title="Subir posição"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === filteredProducts.length - 1}
                  onClick={() => handleMoveProduct(p, "down")}
                  className="px-1.5 py-0.5 text-white/90 hover:text-white hover:bg-white/20 disabled:opacity-30 transition-colors"
                  title="Descer posição"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Carimbo de ESGOTADO com botão Avise-me */}
            {isSoldOut && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5">
                <span className="px-3 py-1 bg-destructive text-destructive-foreground font-black text-xs uppercase tracking-widest rounded shadow-md">
                  ESGOTADO
                </span>
                <span className="text-[10px] text-white/90">WhatsApp: "Avise-me quando chegar"</span>
              </div>
            )}

            {/* Badges Flutuantes Superiores Direitos */}
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
              {p.featuredHero && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold gap-1 shadow-xs">
                  <Star className="w-3 h-3 fill-white" /> HERO {p.heroOrder ? `#${p.heroOrder}` : ""}
                </Badge>
              )}

              {p.readyDelivery && (
                <Badge className="bg-emerald-600 text-white text-[10px] shadow-xs font-semibold">
                  Pronta Entrega
                </Badge>
              )}
            </div>

            {/* CONTROLE INSTANTÂNEO DE PARTE NO CATÁLOGO NO PRÓPRIO CARD */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2 font-bold rounded-lg border bg-background/95 backdrop-blur-sm hover:bg-background shadow-xs text-foreground"
                    title="Clique para mudar a parte deste veículo no catálogo (Shineray, Elétricas, Off-Road, Semi-novos)"
                  >
                    <span>
                      {p.cat === "shineray"
                        ? "🟢 Shineray"
                        : p.cat === "ele"
                        ? "⚡ Elétricas"
                        : p.cat === "semi"
                        ? "🔄 Semi-novos"
                        : "🏁 Off-Road"}
                    </span>
                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs w-52 z-30">
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                    Mover para Parte do Catálogo:
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => handleMoveCategory(p, "shineray")}
                    className="gap-2 text-xs font-semibold cursor-pointer text-emerald-600 dark:text-emerald-400"
                  >
                    🟢 Concessionária Shineray
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMoveCategory(p, "ele")}
                    className="gap-2 text-xs font-semibold cursor-pointer text-cyan-600 dark:text-cyan-400"
                  >
                    ⚡ Elétricas Multimarcas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMoveCategory(p, "off")}
                    className="gap-2 text-xs font-semibold cursor-pointer text-amber-600 dark:text-amber-400"
                  >
                    🏁 Off-Road & Quadriciclos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMoveCategory(p, "semi")}
                    className="gap-2 text-xs font-semibold cursor-pointer text-purple-600 dark:text-purple-400"
                  >
                    🔄 Semi-Novos Selecionados
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {p.sub && (
                <Badge
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm text-[9px] font-semibold border-border text-muted-foreground"
                >
                  {p.sub}
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
                {p.promo && p.promo.active !== false && (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {p.promo.discount && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10">
                        Economia: {formatCurrency(p.promo.discount)}
                      </Badge>
                    )}
                    {p.promo.reason && (
                      <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3 inline" />
                        {p.promo.reason}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuickPrice(p)}
                  className="h-6 px-1.5 text-xs text-primary hover:text-primary gap-1 font-semibold"
                  title="Alterar Preço e Parcelas 21x"
                >
                  <DollarSign className="w-3 h-3" />
                  Preço
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenPromo(p)}
                  className="h-6 px-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 gap-1 font-semibold"
                  title="Configurar Promoção e Validade"
                >
                  <Tag className="w-3 h-3" />
                  Promoção
                </Button>
              </div>
            </div>

            {/* GESTÃO DE ESTOQUE REATIVO COM BOTÕES RÁPIDOS DE 1 CLIQUE */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Estoque:</span>
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
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold">
                      Pronta Entrega
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {p.stock} unid.
                    </Badge>
                  )}
                </div>
              </div>

              {/* Atrelamento ao Pátio Real (DealFlow Hub) */}
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/80 border border-border/50">
                <div className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Pátio Real:</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold ${
                      realStock.totalCount > 0
                        ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                        : "text-zinc-500 border-zinc-700"
                    }`}
                  >
                    {realStock.totalCount} {realStock.totalCount === 1 ? "física" : "físicas"}
                  </Badge>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenStockLink(p)}
                  className="h-6 px-1.5 text-[10px] gap-1 text-primary hover:text-primary font-bold"
                  title="Atrelar ou sincronizar com o código de verificação automática"
                >
                  <Link2 className="w-3 h-3" />
                  {p.patternCode ? p.patternCode : "Atrelar"}
                </Button>
              </div>

              {/* Botões rápidos de 1 clique: Zerar Estoque, +1, +5 e Pronta Entrega */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleZeroStock(p)}
                  className="h-6 text-[10px] px-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                  title="Marcar como ESGOTADO (0 unidades)"
                >
                  Zerar (0)
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestock(p, 1)}
                    className="h-6 text-[10px] px-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    title="Adicionar +1 unidade"
                  >
                    +1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestock(p, 5)}
                    className="h-6 text-[10px] px-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    title="Adicionar +5 unidades"
                  >
                    +5
                  </Button>
                </div>
                <div className="flex items-center gap-1 pl-1">
                  <span className="text-[10px] text-muted-foreground">Pronta:</span>
                  <Switch
                    checked={!!p.readyDelivery}
                    onCheckedChange={() => handleToggleReadyDelivery(p)}
                    className="scale-75"
                    title="Alternar selo de pronta entrega"
                  />
                </div>
              </div>
            </div>

            {/* Descrição Comercial (Botão Direto) */}
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDesc(p)}
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground justify-between border border-dashed border-border/70 rounded-lg"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{p.desc ? p.desc.slice(0, 36) + "..." : "Adicionar descrição comercial..."}</span>
                </span>
                <span className="text-[10px] text-primary shrink-0 font-medium">Editar →</span>
              </Button>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO CARD COM AÇÕES E VISIBILIDADE */}
        <div className="p-3 bg-muted/20 border-t flex items-center justify-between gap-2">
          {/* Switch de Visibilidade Pública Instantânea */}
          <div className="flex items-center gap-1.5">
            <Switch
              checked={p.active !== false}
              onCheckedChange={() => handleToggleActive(p)}
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Ações do Modelo</DropdownMenuLabel>
                
                {/* Mudar Parte no Catálogo no Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 text-xs font-semibold">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Mudar Parte no Catálogo
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="text-xs w-52">
                    <DropdownMenuItem
                      onClick={() => handleMoveCategory(p, "shineray")}
                      className="gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      🟢 Concessionária Shineray
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMoveCategory(p, "ele")}
                      className="gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400"
                    >
                      ⚡ Elétricas Multimarcas
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMoveCategory(p, "off")}
                      className="gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400"
                    >
                      🏁 Off-Road & Quadriciclos
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMoveCategory(p, "semi")}
                      className="gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400"
                    >
                      🔄 Semi-Novos Selecionados
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem onClick={() => handleOpenStockLink(p)} className="gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Boxes className="w-3.5 h-3.5" />
                  Atrelar ao Estoque Real (Chassi)
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleOpenDesc(p)} className="gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Editar Descrição (WhatsApp/IA)
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleToggleHero(p)} className="gap-2 text-xs">
                  <Star className={`w-3.5 h-3.5 ${p.featuredHero ? "fill-amber-500 text-amber-500" : ""}`} />
                  {p.featuredHero ? "Remover do Carrossel Hero" : "Destacar no Carrossel Hero"}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleOpenPromo(p)} className="gap-2 text-xs">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  Configurar Promoção
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleQuickPrice(p)} className="gap-2 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  Alterar Preço & Parcelas 21x
                </DropdownMenuItem>

                <DropdownMenuSeparator />

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

  // Linha da Tabela Desktop
  const renderProductTableRow = (p: CatalogProduct, index: number) => {
    const hasPromo = (p.promo && p.promo.active !== false) || (p.oldPrice && p.price && p.oldPrice > p.price);
    const isSoldOut = p.stock === 0;
    const isLowStock = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= lowStockLimit;
    const mainPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : "";
    const realStock = calculateRealStockForProduct(p, vehicles, chassisPatternsList);

    return (
      <tr
        key={p.id}
        className={`border-b border-border hover:bg-muted/30 transition-colors ${
          !p.active ? "opacity-60 bg-muted/10" : ""
        }`}
      >
        {/* Posição / Reordenação */}
        <td className="p-3 text-center">
          <div className="flex items-center gap-1 justify-center">
            <span className="font-mono text-xs font-bold text-muted-foreground w-6 text-right">
              #{index + 1}
            </span>
            <div className="flex flex-col">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => handleMoveProduct(p, "up")}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                title="Subir"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={index === filteredProducts.length - 1}
                onClick={() => handleMoveProduct(p, "down")}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                title="Descer"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </td>

        {/* Foto & Veículo */}
        <td className="p-3">
          <div className="flex items-center gap-3">
            {mainPhoto ? (
              <img
                src={mainPhoto}
                alt={p.name}
                className={`w-12 h-10 object-contain rounded bg-muted/40 p-0.5 border ${
                  isSoldOut ? "grayscale" : ""
                }`}
              />
            ) : (
              <div className="w-12 h-10 rounded bg-muted/40 border flex items-center justify-center text-[10px] text-muted-foreground">
                Sem Foto
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-foreground">{p.name}</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {p.brand}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{p.sub}</span>
                <span>•</span>
                <span className="font-mono text-[10px]">{p.id}</span>
              </div>
            </div>
          </div>
        </td>

        {/* PARTE NO CATÁLOGO (DROPDOWN DIRETO NA LINHA) */}
        <td className="p-3 text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 px-2 font-bold rounded-lg border w-full justify-between"
              >
                <span>
                  {p.cat === "shineray"
                    ? "🟢 Shineray"
                    : p.cat === "ele"
                    ? "⚡ Elétricas"
                    : p.cat === "semi"
                    ? "🔄 Semi-novos"
                    : "🏁 Off-Road"}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="text-xs w-52">
              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                Mudar Parte no Catálogo
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleMoveCategory(p, "shineray")}
                className="gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                🟢 Concessionária Shineray
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMoveCategory(p, "ele")}
                className="gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400"
              >
                ⚡ Elétricas Multimarcas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMoveCategory(p, "off")}
                className="gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                🏁 Off-Road & Quadriciclos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMoveCategory(p, "semi")}
                className="gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400"
              >
                🔄 Semi-Novos Selecionados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>

        {/* Visibilidade */}
        <td className="p-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Switch
              checked={p.active !== false}
              onCheckedChange={() => handleToggleActive(p)}
              className="scale-85"
            />
            <span className="text-[11px] font-medium text-muted-foreground">
              {p.active !== false ? "Ativo" : "Oculto"}
            </span>
          </div>
        </td>

        {/* Preço & Parcelas 21x */}
        <td className="p-3">
          <div className="space-y-0.5">
            {p.oldPrice && (
              <div className="text-[11px] line-through text-muted-foreground">
                De: {formatCurrency(p.oldPrice)}
              </div>
            )}
            <div className="font-bold text-sm text-foreground">{formatCurrency(p.price)}</div>
            {p.installments && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                Até 21x cartão
              </span>
            )}
          </div>
        </td>

        {/* Estoque & Pronta Entrega */}
        <td className="p-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-16">
                <Input
                  type="number"
                  min={0}
                  value={p.stock !== null && p.stock !== undefined ? p.stock : ""}
                  placeholder="∞"
                  onChange={(e) => {
                    const val = e.target.value.trim() !== "" ? parseInt(e.target.value, 10) : null;
                    handleDirectStockChange(p, isNaN(val as number) ? null : val);
                  }}
                  className="h-7 text-xs font-mono text-center p-1"
                  title="Digitar quantidade em estoque (0 = Esgotado)"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZeroStock(p)}
                className="h-7 px-1.5 text-[10px] text-destructive hover:bg-destructive/10 border-destructive/30"
                title="Zerar estoque imediatamente"
              >
                Zerar (0)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestock(p, 1)}
                className="h-7 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                title="Adicionar +1"
              >
                +1
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestock(p, 5)}
                className="h-7 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                title="Adicionar +5"
              >
                +5
              </Button>
            </div>

            <div className="flex items-center justify-between gap-1 text-[10px] px-1.5 bg-muted/40 rounded border border-border/40 py-0.5">
              <span className="text-muted-foreground flex items-center gap-1">
                <Boxes className="w-3 h-3 text-emerald-500" />
                Pátio: <strong className="font-mono text-emerald-500">{realStock.totalCount}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenStockLink(p)}
                className="h-5 px-1 text-[10px] text-primary hover:text-primary gap-0.5 font-bold"
                title="Atrelar código de verificação automática"
              >
                <Link2 className="w-2.5 h-2.5" />
                {p.patternCode || "Atrelar"}
              </Button>
            </div>
          </div>
        </td>

        {/* Desconto */}
        <td className="p-3 text-center">
          {hasPromo && p.promo?.discount ? (
            <div
              onClick={() => handleOpenPromo(p)}
              className="cursor-pointer flex flex-col items-center gap-0.5"
            >
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                -{formatCurrency(p.promo.discount)}
              </span>
              {p.promo?.reason && (
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px]">
                  {p.promo.reason}
                </span>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenPromo(p)}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
            >
              + Desconto
            </Button>
          )}
        </td>

        {/* Carrossel Hero */}
        <td className="p-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleHero(p)}
            className={`h-7 px-2 text-xs gap-1 font-semibold ${
              p.featuredHero ? "text-amber-500" : "text-muted-foreground"
            }`}
            title="Alternar presença no carrossel de topo"
          >
            <Star className={`w-3.5 h-3.5 ${p.featuredHero ? "fill-amber-500 text-amber-500" : ""}`} />
            {p.featuredHero ? `#${p.heroOrder || 1}` : "Hero"}
          </Button>
        </td>

        {/* Descrição */}
        <td className="p-3 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDesc(p)}
            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary font-medium"
            title="Editar descrição comercial compartilhada no WhatsApp"
          >
            <FileText className="w-3.5 h-3.5" />
            Texto
          </Button>
        </td>

        {/* Ações */}
        <td className="p-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenStockLink(p)}
              className="h-7 w-7 p-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
              title="Atrelar ao Estoque Real (Chassi)"
            >
              <Boxes className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditProduct(p)}
              className="h-7 text-xs"
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteProduct(p)}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              title="Excluir do catálogo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. CABEÇALHO EXECUTIVO COM STATUS SSE E AÇÕES GLOBAIS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Store className="w-6 h-6 text-primary" />
              Painel de Controle e Gestão do Catálogo L1MA Motors
            </h1>

            {/* Status da Conexão SSE (<50ms) */}
            <div className="flex items-center gap-1.5 ml-2">
              {streamStatus === "connected" ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 py-0.5 text-xs font-semibold"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Conectado via SSE (v{catalog?.version || 1})
                </Badge>
              ) : streamStatus === "connecting" ? (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1.5 py-0.5 text-xs font-semibold"
                >
                  <Radio className="w-3 h-3 animate-pulse" /> Conectando API...
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1.5 py-0.5 text-xs font-semibold"
                >
                  <WifiOff className="w-3 h-3" /> Desconectado (Reconectando...)
                </Badge>
              )}

              <Badge variant="secondary" className="text-xs font-mono">
                {products.length} Modelos Cadastrados
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Controle direto de em qual parte do catálogo cada veículo é exibido (Shineray, Elétricas, Off-Road, Semi-novos), estoque, preços, promoções e sincronização em tempo real.
          </p>
        </div>

        {/* Botões de Ações Rápidas do Cabeçalho */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="gap-1.5 font-medium"
            title="Recarregar dados do catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            Recarregar Dados
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReorderDialogOpen(true)}
            className="gap-1.5 font-medium"
            title="Reordenar modelos por Drag-and-Drop ou posição numérica"
          >
            <ArrowUpDown className="w-4 h-4 text-primary" />
            Reordenar Motos
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setHeroDialogOpen(true)}
            className="gap-1.5 font-medium"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Carrossel Topo ({heroCount})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCampaignOpen(true)}
            className="gap-1.5 font-medium"
          >
            <Megaphone className="w-4 h-4 text-primary" />
            Campanha
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setChatDialogOpen(true)}
            className="gap-1.5 font-medium"
          >
            <Bot className="w-4 h-4 text-blue-500" />
            Testar IA
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkSyncRealStock}
            disabled={isBulkSyncingStock}
            className="gap-1.5 font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            title="Sincronizar em 1 clique o estoque do catálogo com as motos físicas no pátio"
          >
            <Boxes className={`w-4 h-4 ${isBulkSyncingStock ? "animate-spin" : ""}`} />
            Sincronizar com Pátio Real
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
            className="gap-1.5 font-medium"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            Importar Estoque
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
            className="gap-1.5 font-medium"
          >
            <Settings className="w-4 h-4" />
            Taxas & Loja
          </Button>

          <Button size="sm" onClick={handleNewProduct} className="gap-1.5 font-semibold">
            <Plus className="w-4 h-4" />
            Novo Veículo
          </Button>
        </div>
      </div>

      {/* 2. SELETOR PRINCIPAL: PARTE NO CATÁLOGO (SHINERAY, ELÉTRICAS, OFF-ROAD, SEMI-NOVOS) */}
      <div className="p-3.5 rounded-2xl border bg-card/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Seletor de Parte no Catálogo */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span>Parte no Catálogo:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={selectedCat === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCat("all");
                setSelectedSub("all");
              }}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold"
            >
              🌟 Todo o Catálogo ({totalCount})
            </Button>

            <Button
              variant={selectedCat === "shineray" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCat("shineray");
                setSelectedSub("all");
              }}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold text-emerald-600 dark:text-emerald-400"
            >
              🟢 Shineray ({countShineray})
            </Button>

            <Button
              variant={selectedCat === "ele" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCat("ele");
                setSelectedSub("all");
              }}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold text-cyan-600 dark:text-cyan-400"
            >
              ⚡ Elétricas ({countEle})
            </Button>

            <Button
              variant={selectedCat === "off" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCat("off");
                setSelectedSub("all");
              }}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold text-amber-600 dark:text-amber-400"
            >
              🏁 Off-road ({countOff})
            </Button>

            <Button
              variant={selectedCat === "semi" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCat("semi");
                setSelectedSub("all");
              }}
              className="h-8 text-xs gap-1.5 rounded-xl font-bold text-purple-600 dark:text-purple-400"
            >
              🔄 Semi-novos ({countSemi})
            </Button>
          </div>
        </div>

        {/* Controles de Lote e Visualização */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Toggle Modo Lote (Batch Sync) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border border-border">
            <Layers3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Modo Fila em Lote:</span>
            <Switch
              checked={batchMode}
              onCheckedChange={setBatchMode}
              className="scale-85"
              id="batch-mode-toggle"
            />
            {batchMode && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-bold">
                {pendingBatch.length} na fila
              </Badge>
            )}
          </div>

          {/* Alternador de Layout: Cards vs Tabela */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-muted/40 border border-border">
            <Button
              variant={viewLayout === "cards" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewLayout("cards")}
              className="h-7 text-xs px-2 gap-1 font-semibold rounded-lg"
              title="Exibir como cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </Button>
            <Button
              variant={viewLayout === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewLayout("table")}
              className="h-7 text-xs px-2 gap-1 font-semibold rounded-lg"
              title="Exibir como tabela"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Tabela
            </Button>
          </div>
        </div>
      </div>

      {/* 3. KPIS DE RESUMO */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Modelos</span>
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cadastrados</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ativos</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{activeCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Visíveis no catálogo</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ocultos</span>
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-muted-foreground">{hiddenCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Sem exclusão</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Esgotados</span>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold text-destructive">{soldOutCount}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Selo WhatsApp ativo</p>
        </div>

        <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ofertas</span>
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
          <p className="text-[10px] text-muted-foreground mt-0.5">Slides principais</p>
        </div>
      </div>

      {/* 4. FILTROS RÁPIDOS DE STATUS & BUSCA */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Os 6 Filtros Rápidos por Pílula (Pills) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Todas ({totalCount})
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-500" /> Ativas ({activeCount})
            </Button>
            <Button
              variant={statusFilter === "hidden" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("hidden")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Ocultas ({hiddenCount})
            </Button>
            <Button
              variant={statusFilter === "promo" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("promo")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <Tag className="w-3.5 h-3.5 text-amber-500" /> Em Promoção ({promoCount})
            </Button>
            <Button
              variant={statusFilter === "soldout" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("soldout")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Esgotadas ({soldOutCount})
            </Button>
            <Button
              variant={statusFilter === "hero" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("hero")}
              className="h-8 text-xs gap-1 font-semibold rounded-xl"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> No Carrossel ({heroCount})
            </Button>
          </div>
        </div>

        {/* Pílulas de Subcategorias (Estilos Comerciais) */}
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
              placeholder="Buscar instantaneamente por nome do modelo, marca, estilo (Trail, Scooter, Street...) ou ID único..."
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

      {/* 5. LISTAGEM EM GRADE (CARDS) OU TABELA (DESKTOP) */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p>Carregando modelos do catálogo público...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center border rounded-2xl bg-card space-y-3">
          <Store className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-lg font-semibold text-foreground">Nenhum veículo encontrado nesta parte do catálogo</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {search || selectedCat !== "all" || statusFilter !== "all"
              ? "Tente selecionar outra parte no catálogo ou limpar a busca."
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
      ) : viewLayout === "table" ? (
        // VISUALIZAÇÃO EM TABELA COMPACTA (DESKTOP)
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="p-3 text-center w-16">Posição</th>
                  <th className="p-3">Veículo</th>
                  <th className="p-3 text-center w-36">Parte no Catálogo</th>
                  <th className="p-3 text-center w-28">Visibilidade</th>
                  <th className="p-3 w-36">Preço / 21x</th>
                  <th className="p-3 w-56">Estoque & Ações</th>
                  <th className="p-3 text-center w-28">Promoção</th>
                  <th className="p-3 text-center w-24">Carrossel</th>
                  <th className="p-3 text-center w-24">Descrição</th>
                  <th className="p-3 text-right w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((prod, idx) => renderProductTableRow(prod, idx))}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewGrouping === "sections" && selectedCat === "all" ? (
        // VISUALIZAÇÃO DIVIDIDA POR PARTE DO CATÁLOGO (SEÇÕES COMO NO SITE PÚBLICO)
        <div className="space-y-8">
          {CATALOG_PARTS.map((group) => {
            const groupProducts = filteredProducts.filter((p) => p.cat === group.id);
            if (groupProducts.length === 0) return null;

            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="space-y-4">
                {/* CABEÇALHO DA PARTE DO CATÁLOGO */}
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
                      {groupProducts.length} {groupProducts.length === 1 ? "modelo" : "modelos"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCat(group.id);
                        setSelectedSub("all");
                      }}
                      className="text-xs h-7 px-2 font-medium"
                    >
                      Ver apenas {group.shortName} →
                    </Button>
                  </div>
                </div>

                {/* GRID DE CARDS DO GRUPO */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupProducts.map((p, idx) => renderProductCard(p, idx))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // VISUALIZAÇÃO EM GRADE FILTRADA
        <div className="space-y-4">
          {selectedCat !== "all" && (
            <div className="p-3.5 rounded-2xl border bg-muted/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Parte no Catálogo: {CATALOG_PARTS.find((g) => g.id === selectedCat)?.name || selectedCat}
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
                ← Ver todo o catálogo
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p, idx) => renderProductCard(p, idx))}
          </div>
        </div>
      )}

      {/* 6. BANNER FLUTUANTE DA FILA DE LOTE (BATCH SYNC DRAWER) */}
      {pendingBatch.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl bg-zinc-950/95 backdrop-blur-md border border-primary/40 text-zinc-100 p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Layers3 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Fila de Alterações em Lote</span>
                <Badge className="bg-primary text-primary-foreground font-mono font-bold text-xs">
                  {pendingBatch.length} {pendingBatch.length === 1 ? "ação pendente" : "ações pendentes"}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">
                Serão despachadas atomicamente em um único POST /api/sync.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearBatch}
              disabled={isSendingBatch}
              className="text-zinc-400 hover:text-zinc-100 text-xs"
            >
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendBatch}
              disabled={isSendingBatch}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              {isSendingBatch ? "Enviando Lote..." : "Enviar Lote Atômico"}
            </Button>
          </div>
        </div>
      )}

      {/* 7. TODOS OS MODAIS DO SISTEMA DO CATÁLOGO (100% COBERTURA) */}
      {/* 1. Modal de Reordenação das Motos */}
      <CatalogReorderDialog
        open={reorderDialogOpen}
        onOpenChange={setReorderDialogOpen}
        products={filteredProducts}
        category={selectedCat}
        onSaveReorder={(ids) => dispatchOrQueue({ action: "reorder", ids }, `Reordenar ${ids.length} veículos`)}
        onSetOrder={(id, order) => dispatchOrQueue({ action: "order", id, order }, `Posição #${order} para ${id}`)}
      />

      {/* 2. Modal de Edição da Descrição Comercial (desc) */}
      <CatalogDescDialog
        open={descDialogOpen}
        onOpenChange={setDescDialogOpen}
        product={selectedProductForDesc}
        onSave={(id, desc) => dispatchOrQueue({ action: "desc", id, desc }, `Descrição de ${id}`)}
      />

      {/* 3. Modal de Configurações da Loja e Taxas */}
      <CatalogConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentConfig={catalog?.config || {}}
        onSaveStoreConfig={(config) => dispatchOrQueue({ action: "config", config }, "Configurações da Loja")}
        onSaveRates={(debitRate, installmentRates, installmentNote) =>
          dispatchOrQueue({ action: "rates", debitRate, installmentRates, installmentNote }, "Taxas de Parcelamento")
        }
      />

      {/* 4. Modal de Campanha Sazonal */}
      <CatalogCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        campaign={catalog?.config?.campaign}
        onSaveCampaign={(campaign) => dispatchOrQueue({ action: "campaign", campaign }, "Campanha Sazonal")}
      />

      {/* 5. Modal do Carrossel Hero */}
      <CatalogHeroCarouselDialog
        open={heroDialogOpen}
        onOpenChange={setHeroDialogOpen}
        products={products}
        onSaveHeroList={(items) => dispatchOrQueue({ action: "hero_list", items }, "Ordem do Carrossel Hero")}
        onToggleHero={(id, featured, heroOrder) =>
          dispatchOrQueue({ action: "carousel", id, featured, order: heroOrder }, `Hero ${id}`)
        }
      />

      {/* 6. Sandbox do Chatbot com IA */}
      <CatalogChatTestDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        onSendMessage={(messages) => chatMutation.mutateAsync(messages)}
        isSending={chatMutation.isPending}
      />

      {/* 7. Modal de Cadastro e Edição Completa de Veículo */}
      <CatalogProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProductForEdit}
        onSaveProduct={(prod) => dispatchOrQueue({ action: "create", ...prod }, `Salvar ${prod.name}`)}
      />

      {/* 8. Modal de Importação do Estoque Físico */}
      <CatalogImportFromStockDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingCatalogProductIds={existingIds}
        onBatchSync={batchSync}
      />

      {/* 9. Modal de Alteração Rápida de Preço e Parcelas 21x */}
      <CatalogQuickPriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        product={selectedProductForPrice}
        onSavePrice={(id, price, oldPrice, installments) =>
          dispatchOrQueue(
            { action: "price", id, price, oldPrice, installments, value: price },
            `Preço de ${id}`
          )
        }
      />

      {/* 10. Modal de Configuração de Oferta / Promoção */}
      <CatalogPromoDialog
        open={promoDialogOpen}
        onOpenChange={setPromoDialogOpen}
        product={selectedProductForPromo}
        onSavePromo={(id, promo) =>
          dispatchOrQueue(
            promo
              ? {
                  action: "promo",
                  id,
                  active: promo.active,
                  label: promo.label,
                  discount: promo.discount,
                  until: promo.until,
                  reason: promo.reason,
                  description: promo.description,
                  promo,
                }
              : { action: "promo", id, active: false, label: "", discount: 0, until: "", reason: "", description: "", promo: null },
            `Promoção de ${id}`
          )
        }
      />

      {/* 11. Modal de Atrelamento com Estoque Real (Chassi / DealFlow Hub) */}
      <CatalogRealStockLinkDialog
        open={stockLinkDialogOpen}
        onOpenChange={setStockLinkDialogOpen}
        product={selectedProductForStockLink}
        vehicles={vehicles}
        patterns={chassisPatternsList}
        onSaveStockLink={handleSaveStockLink}
      />

      {/* 12. Dialog de Confirmação de Exclusão Definitiva */}
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
            >
              {deleting ? "Excluindo..." : "Sim, Excluir do Catálogo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
