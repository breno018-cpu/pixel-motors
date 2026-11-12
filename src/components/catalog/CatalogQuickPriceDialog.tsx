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
import { DollarSign, Tag, CreditCard } from "lucide-react";

interface CatalogQuickPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  onSavePrice: (
    id: string,
    value: number | null,
    oldPrice?: number | null,
    installments?: boolean,
    keepOld?: boolean
  ) => Promise<any> | void;
}

export function CatalogQuickPriceDialog({
  open,
  onOpenChange,
  product,
  onSavePrice,
}: CatalogQuickPriceDialogProps) {
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [installments, setInstallments] = useState(true);
  const [keepOld, setKeepOld] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setPrice(product.price !== null && product.price !== undefined ? String(product.price) : "");
      setOldPrice(product.oldPrice !== null && product.oldPrice !== undefined ? String(product.oldPrice) : "");
      setInstallments(product.installments !== false);
      setKeepOld(true);
    }
  }, [open, product]);

  const handleSubmit = async () => {
    if (!product) return;
    const numPrice = price.trim() !== "" ? parseFloat(price) : null;
    let numOldPrice: number | null | undefined = oldPrice.trim() !== "" ? parseFloat(oldPrice) : undefined;

    if (numOldPrice === undefined && keepOld && product.price && numPrice && numPrice < product.price) {
      numOldPrice = product.price;
    }

    setLoading(true);
    try {
      await onSavePrice(product.id, numPrice, numOldPrice, installments, keepOld);
      toast.success(`Preço e condições de "${product.name}" atualizados!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao alterar preço: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Gestão de Preços: {product?.name}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Ajuste o valor à vista, preço anterior (De/Por) e parcelamento em 21x.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Preço atual:</span>
              <span className="font-semibold text-zinc-100">
                {product?.price
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      product.price
                    )
                  : "Sob Consulta"}
              </span>
            </div>
            {product?.oldPrice && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Preço De (anterior):</span>
                <span className="line-through text-zinc-500">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    product.oldPrice
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-price" className="text-xs font-semibold text-zinc-200">
              Novo Preço À Vista (R$)
            </Label>
            <Input
              id="quick-price"
              type="number"
              step="0.01"
              placeholder="Ex: 8490 (ou vazio para 'Sob Consulta')"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-old-price" className="text-xs font-semibold text-zinc-200">
              Preço Anterior "De R$" (Opcional para Badge de Desconto)
            </Label>
            <Input
              id="quick-old-price"
              type="number"
              step="0.01"
              placeholder="Ex: 9490 (aparece como De R$ 9.490 por R$ 8.490)"
              value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-400" />
                Habilitar Parcelamento em até 21x
              </Label>
              <p className="text-[11px] text-zinc-400">
                Ativa o simulador financeiro no modal e cards do catálogo.
              </p>
            </div>
            <Switch checked={installments} onCheckedChange={setInstallments} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-400" />
                Preservar Preço Antigo como "De / Por"
              </Label>
              <p className="text-[11px] text-zinc-400">
                Se o novo valor for menor e nenhum "De R$" for digitado, usa o preço atual como De/Por.
              </p>
            </div>
            <Switch checked={keepOld} onCheckedChange={setKeepOld} />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400 hover:text-zinc-100">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
            {loading ? "Salvando..." : "Atualizar Preço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
