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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CatalogProduct } from "@/types/catalog";
import { DollarSign, Tag } from "lucide-react";

interface CatalogQuickPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  onSavePrice: (id: string, value: number | null, keepOld: boolean) => Promise<any>;
}

export function CatalogQuickPriceDialog({
  open,
  onOpenChange,
  product,
  onSavePrice,
}: CatalogQuickPriceDialogProps) {
  const [price, setPrice] = useState("");
  const [keepOld, setKeepOld] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setPrice(product.price !== null && product.price !== undefined ? String(product.price) : "");
      setKeepOld(true);
    }
  }, [open, product]);

  const handleSubmit = async () => {
    if (!product) return;
    const numPrice = price.trim() !== "" ? parseFloat(price) : null;

    setLoading(true);
    try {
      await onSavePrice(product.id, numPrice, keepOld);
      toast.success(`Preço de "${product.name}" atualizado!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao alterar preço: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Alterar Preço: {product?.name}
          </DialogTitle>
          <DialogDescription>
            Atualiza o preço de venda imediatamente no Catálogo L1MA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço atual:</span>
              <span className="font-semibold text-foreground">
                {product?.price
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      product.price
                    )
                  : "Sob Consulta"}
              </span>
            </div>
            {product?.oldPrice && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço De (anterior):</span>
                <span className="line-through text-muted-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    product.oldPrice
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-price">Novo Preço À Vista (R$)</Label>
            <Input
              id="quick-price"
              type="number"
              step="0.01"
              placeholder="Ex: 19990.00 (ou deixe em branco para 'Sob Consulta')"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-primary" />
                Manter Preço Antigo como "De / Por"
              </Label>
              <p className="text-xs text-muted-foreground">
                Se o novo preço for menor, o catálogo gera automaticamente a etiqueta de oferta promocional.
              </p>
            </div>
            <Switch checked={keepOld} onCheckedChange={setKeepOld} />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Atualizar Preço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
