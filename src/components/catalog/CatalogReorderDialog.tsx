import { useState, useEffect } from "react";
import { CatalogProduct } from "@/types/catalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, ArrowUpDown, Save, Check } from "lucide-react";
import { toast } from "sonner";

interface CatalogReorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: CatalogProduct[];
  category: string;
  onSaveReorder: (ids: string[]) => Promise<any> | void;
  onSetOrder?: (id: string, order: number) => Promise<any> | void;
}

export function CatalogReorderDialog({
  open,
  onOpenChange,
  products,
  category,
  onSaveReorder,
  onSetOrder,
}: CatalogReorderDialogProps) {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const filtered =
        category === "all"
          ? [...products]
          : products.filter((p) => p.cat === category);
      setItems(filtered);
    }
  }, [open, products, category]);

  const move = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;

    const copy = [...items];
    const temp = copy[fromIndex];
    copy[fromIndex] = copy[toIndex];
    copy[toIndex] = temp;
    setItems(copy);
  };

  const setManualPosition = (fromIndex: number, newPosStr: string) => {
    const targetPos = parseInt(newPosStr, 10);
    if (isNaN(targetPos) || targetPos < 1 || targetPos > items.length) return;
    const toIndex = targetPos - 1;
    if (toIndex === fromIndex) return;

    const copy = [...items];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    setItems(copy);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ids = items.map((p) => p.id);
      await onSaveReorder(ids);
      toast.success("Ordem dos veículos salva com sucesso!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar ordem: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <ArrowUpDown className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Reordenação das Motos (Ordem de Exibição)
              </DialogTitle>
              <DialogDescription className="text-zinc-400 text-xs">
                Ajuste a ordem em que os veículos aparecem para os clientes no catálogo digital.
                Use os botões ▲ e ▼ ou digite a posição desejada (#1, #2, #3...).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2 py-2">
          {items.map((prod, index) => {
            const photo = prod.photos?.[0] || "";
            return (
              <div
                key={prod.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Posição Numérica */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-mono text-zinc-500 w-5 text-right">#</span>
                    <Input
                      type="number"
                      min={1}
                      max={items.length}
                      value={index + 1}
                      onChange={(e) => setManualPosition(index, e.target.value)}
                      className="w-14 h-8 text-center text-xs font-bold font-mono bg-zinc-950 border-zinc-700 p-0 text-primary"
                    />
                  </div>

                  {/* Foto Miniatura */}
                  {photo ? (
                    <img
                      src={photo}
                      alt={prod.name}
                      className="w-12 h-10 object-contain rounded bg-zinc-950 border border-zinc-800 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-10 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 shrink-0">
                      Sem Foto
                    </div>
                  )}

                  {/* Informações do Veículo */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate text-zinc-100">
                        {prod.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase border-zinc-700 bg-zinc-800 text-zinc-300">
                        {prod.brand}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                        {prod.sub}
                      </Badge>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500 block truncate">
                      {prod.id}
                    </span>
                  </div>
                </div>

                {/* Controles de Subir / Descer */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, "up")}
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                    title="Subir posição"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === items.length - 1}
                    onClick={() => move(index, "down")}
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                    title="Descer posição"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Total: <strong>{items.length}</strong> veículos nesta categoria
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Ordem"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
