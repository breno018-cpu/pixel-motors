import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useVehicles } from "@/hooks/useVehicles";
import { useVehicleModels } from "@/hooks/useVehicleModels";
import { useStores } from "@/hooks/useStores";
import { isMatchingStore } from "@/lib/storeResolution";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogProduct, CatalogSyncAction } from "@/types/catalog";
import { Download, Search, CheckSquare, Square, PackageCheck } from "lucide-react";

interface CatalogImportFromStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCatalogProductIds: Set<string>;
  onBatchSync: (actions: CatalogSyncAction[]) => Promise<any>;
}

export function CatalogImportFromStockDialog({
  open,
  onOpenChange,
  existingCatalogProductIds,
  onBatchSync,
}: CatalogImportFromStockDialogProps) {
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: models = [], isLoading: loadingModels } = useVehicleModels();
  const { data: stores = [] } = useStores();
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Agrupa veículos por marca + modelo para consolidar estoque físico
  const consolidatedItems = useMemo(() => {
    // Mapa baseado em modelos cadastrados ou modelos inferidos
    const map = new Map<string, {
      key: string;
      brand: string;
      modelName: string;
      stockQty: number;
      price: number | null;
      photos: string[];
      fuelType: string | null;
      engineCc: number | null;
      isAlreadyInCatalog: boolean;
    }>();

    // 1. Modelos de tabela
    for (const m of models) {
      const key = `${m.brand.toLowerCase()}-${m.model.toLowerCase()}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      map.set(key, {
        key,
        brand: m.brand,
        modelName: m.model,
        stockQty: 0,
        price: m.default_sale_price || m.promo_price || null,
        photos: [],
        fuelType: m.fuel_type,
        engineCc: m.engine_cc,
        isAlreadyInCatalog: existingCatalogProductIds.has(key),
      });
    }

    // 2. Veículos físicos em estoque
    for (const v of vehicles) {
      const key = `${v.brand.toLowerCase()}-${v.model.toLowerCase()}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const existing = map.get(key) || {
        key,
        brand: v.brand,
        modelName: v.model,
        stockQty: 0,
        price: v.sale_price || null,
        photos: [],
        fuelType: v.fuel_type,
        engineCc: v.engine_cc,
        isAlreadyInCatalog: existingCatalogProductIds.has(key),
      };

      if (v.status === "disponivel" && (storeFilter === "all" || isMatchingStore(v.store_id, storeFilter))) {
        existing.stockQty += 1;
      }
      if (!existing.price && v.sale_price) {
        existing.price = v.sale_price;
      }
      if (v.images && v.images.length > 0) {
        for (const img of v.images) {
          if (!existing.photos.includes(img)) {
            existing.photos.push(img);
          }
        }
      }

      map.set(key, existing);
    }

    return Array.from(map.values());
  }, [vehicles, models, existingCatalogProductIds]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return consolidatedItems;
    const term = search.toLowerCase();
    return consolidatedItems.filter(
      (item) =>
        item.brand.toLowerCase().includes(term) ||
        item.modelName.toLowerCase().includes(term) ||
        item.key.includes(term)
    );
  }, [consolidatedItems, search]);

  const toggleSelect = (key: string) => {
    const next = new Set(selectedIds);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.key)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Selecione pelo menos um modelo para importar.");
      return;
    }

    const itemsToImport = consolidatedItems.filter((i) => selectedIds.has(i.key));
    const actions: CatalogSyncAction[] = itemsToImport.map((item) => {
      // Determina categoria
      let cat: "ele" | "semi" | "off" | "shineray" = "shineray";
      const bLower = item.brand.toLowerCase();
      const fuelLower = (item.fuelType || "").toLowerCase();

      if (fuelLower.includes("elétr") || fuelLower.includes("eletric")) {
        cat = "ele";
      } else if (bLower.includes("shineray")) {
        cat = "shineray";
      } else {
        cat = "semi";
      }

      const selectedStoreObj = stores.find((s) => s.id === storeFilter);
      const resolvedStoreName =
        storeFilter === "all"
          ? "Todas as Lojas"
          : selectedStoreObj?.name || storeFilter;

      const product: CatalogProduct = {
        id: item.key,
        active: true,
        cat,
        sub: "Street",
        brand: item.brand,
        name: item.modelName,
        price: item.price,
        installments: true,
        readyDelivery: item.stockQty > 0,
        store_id: storeFilter !== "all" ? storeFilter : undefined,
        store_name: resolvedStoreName,
        stock: item.stockQty > 0 ? item.stockQty : null,
        desc: `${item.brand} ${item.modelName} com excelente custo-benefício, pronto para entrega na L1MA Motors.`,
        photos:
          item.photos.length > 0
            ? item.photos
            : ["https://placehold.co/600x400/png?text=L1MA+Motors"],
        specs: [
          [item.engineCc ? `${item.engineCc} cc` : "Padrão", "Cilindrada"],
          [item.fuelType || "Gasolina", "Combustível"],
        ],
        feat: ["Garantia de procedência", "Melhor avaliação no seu usado", "Financiamento facilitado"],
      };

      return {
        action: "upsert",
        product,
      };
    });

    setImporting(true);
    try {
      await onBatchSync(actions);
      toast.success(`${actions.length} veículos sincronizados com o Catálogo L1MA!`);
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao sincronizar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Importar Veículos do Estoque Local para o Catálogo
          </DialogTitle>
          <DialogDescription>
            Selecione modelos e quantidades em estoque do sistema DealFlow Hub para publicar ou atualizar no catálogo público com um clique.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 my-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por marca, modelo ou ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs">
              <SelectValue placeholder="Filtrar por Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas (Rede)</SelectItem>
              {stores
                .filter((s) => s.is_active !== false)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="gap-1.5 shrink-0"
          >
            {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
              <>
                <CheckSquare className="w-4 h-4 text-primary" /> Desmarcar Todos
              </>
            ) : (
              <>
                <Square className="w-4 h-4" /> Selecionar Todos ({filteredItems.length})
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-[300px] max-h-[450px]">
          {loadingVehicles || loadingModels ? (
            <div className="p-8 text-center text-muted-foreground">Carregando estoque local...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum veículo encontrado no estoque.</div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.key);
              return (
                <div
                  key={item.key}
                  onClick={() => toggleSelect(item.key)}
                  className={`p-3 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {item.brand} {item.modelName}
                        </span>
                        {item.isAlreadyInCatalog && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            Já no Catálogo
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">ID: {item.key}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-xs font-medium text-foreground">
                        {item.price
                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                              item.price
                            )
                          : "Sob Consulta"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Estoque Físico:{" "}
                        <span className={item.stockQty > 0 ? "text-emerald-400 font-semibold" : "text-amber-500"}>
                          {item.stockQty} unid.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? "modelo selecionado" : "modelos selecionados"}
          </span>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || selectedIds.size === 0}
              className="gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              {importing ? "Enviando..." : `Enviar ${selectedIds.size} para o Catálogo`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
