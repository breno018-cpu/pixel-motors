import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CatalogProduct } from "@/types/catalog";
import { Sparkles, ArrowUp, ArrowDown, Eye, Check } from "lucide-react";

interface CatalogHeroCarouselDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: CatalogProduct[];
  onSaveHeroList: (items: Array<{ id: string; heroOrder: number }>) => Promise<any>;
  onToggleHero: (id: string, featured: boolean, heroOrder?: number) => Promise<any>;
}

export function CatalogHeroCarouselDialog({
  open,
  onOpenChange,
  products,
  onSaveHeroList,
  onToggleHero,
}: CatalogHeroCarouselDialogProps) {
  const [heroItems, setHeroItems] = useState<Array<{ id: string; name: string; brand: string; photo?: string; heroOrder: number }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const activeHeroes = products
        .filter((p) => p.featuredHero)
        .map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          photo: p.photos?.[0],
          heroOrder: p.heroOrder || 99,
        }))
        .sort((a, b) => a.heroOrder - b.heroOrder);

      setHeroItems(activeHeroes);
    }
  }, [open, products]);

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...heroItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Recalcula ordens 1, 2, 3...
    newItems.forEach((item, idx) => {
      item.heroOrder = idx + 1;
    });

    setHeroItems(newItems);
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const payload = heroItems.map((item, idx) => ({
        id: item.id,
        heroOrder: idx + 1,
      }));
      await onSaveHeroList(payload);
      toast.success("Ordem do carrossel Hero atualizada com sucesso!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar carrossel: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const nonHeroProducts = products.filter((p) => !p.featuredHero && p.active !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Carrossel de Destaques do Topo (Hero)
          </DialogTitle>
          <DialogDescription>
            Defina quais modelos aparecem nos slides principais do topo do catálogo e a ordem exata de exibição (1º, 2º, 3º lugar).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Slides em Destaque */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Slides Ativos no Carrossel ({heroItems.length})
            </h4>

            {heroItems.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg text-xs text-muted-foreground">
                Nenhum veículo em destaque no carrossel. Ative os modelos abaixo para adicionar aos slides de topo.
              </div>
            ) : (
              <div className="space-y-2">
                {heroItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border bg-card flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        {idx + 1}º
                      </span>

                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt={item.name}
                          className="w-12 h-8 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-8 rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                          Sem foto
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-bold text-foreground">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.brand} • ID: {item.id}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, "up")}
                        title="Subir posição"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={idx === heroItems.length - 1}
                        onClick={() => moveItem(idx, "down")}
                        title="Descer posição"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          await onToggleHero(item.id, false);
                          setHeroItems(heroItems.filter((h) => h.id !== item.id));
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar outros modelos ao carrossel */}
          {nonHeroProducts.length > 0 && (
            <div className="pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Outros Veículos Disponíveis para Destaque
              </h4>

              <div className="max-h-48 overflow-y-auto divide-y border rounded-lg">
                {nonHeroProducts.slice(0, 15).map((p) => (
                  <div key={p.id} className="p-2 flex items-center justify-between text-xs hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-muted-foreground text-[10px]">({p.brand})</span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={async () => {
                        const nextOrder = heroItems.length + 1;
                        await onToggleHero(p.id, true, nextOrder);
                        setHeroItems([
                          ...heroItems,
                          { id: p.id, name: p.name, brand: p.brand, photo: p.photos?.[0], heroOrder: nextOrder },
                        ]);
                      }}
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Destacar no Topo
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button size="sm" onClick={handleSaveOrder} disabled={saving} className="gap-1.5">
            <Check className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Ordem do Carrossel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
