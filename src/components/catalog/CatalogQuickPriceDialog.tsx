import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CatalogProduct } from "@/types/catalog";
import { maskCurrency, parseCurrency } from "@/lib/masks";
import { DollarSign, Tag, CreditCard, TrendingDown, Percent, Sparkles } from "lucide-react";

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
  const [priceMasked, setPriceMasked] = useState("");
  const [oldPriceMasked, setOldPriceMasked] = useState("");
  const [installments, setInstallments] = useState(true);
  const [keepOld, setKeepOld] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setPriceMasked(
        product.price !== null && product.price !== undefined
          ? maskCurrency(product.price)
          : ""
      );
      setOldPriceMasked(
        product.oldPrice !== null && product.oldPrice !== undefined
          ? maskCurrency(product.oldPrice)
          : ""
      );
      setInstallments(product.installments !== false);
      setKeepOld(true);
    }
  }, [open, product]);

  const numPrice = useMemo(() => {
    if (!priceMasked.trim()) return null;
    const val = parseCurrency(priceMasked);
    return val > 0 ? val : null;
  }, [priceMasked]);

  const numOldPrice = useMemo(() => {
    if (!oldPriceMasked.trim()) return null;
    const val = parseCurrency(oldPriceMasked);
    return val > 0 ? val : null;
  }, [oldPriceMasked]);

  const diffDiscount = useMemo(() => {
    if (numOldPrice && numPrice && numOldPrice > numPrice) {
      const diff = numOldPrice - numPrice;
      const pct = ((diff / numOldPrice) * 100).toFixed(1);
      return { diff, pct };
    }
    return null;
  }, [numOldPrice, numPrice]);

  const handleApplyPercentageDiscount = (pct: number) => {
    const base = numOldPrice || product?.price || 0;
    if (base <= 0) return;
    const newPrice = Math.round(base * (1 - pct / 100));
    setPriceMasked(maskCurrency(newPrice));
    if (!oldPriceMasked && product?.price) {
      setOldPriceMasked(maskCurrency(product.price));
    }
  };

  const handleSubmit = async () => {
    if (!product) return;
    let finalOldPrice = numOldPrice;

    if (finalOldPrice === null && keepOld && product.price && numPrice && numPrice < product.price) {
      finalOldPrice = product.price;
    }

    setLoading(true);
    try {
      await onSavePrice(product.id, numPrice, finalOldPrice, installments, keepOld);
      toast.success(`Preço e condições de "${product.name}" atualizados com sucesso!`);
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
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-zinc-100 text-lg font-bold">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Gestão de Preços & Condições
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-xs">
            {product?.brand} • {product?.name} ({product?.sub})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card de Preço Atual Cadastrado */}
          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Preço Atual de Venda:</span>
              <span className="font-bold text-zinc-100 font-mono text-sm">
                {product?.price ? maskCurrency(product.price) : "Sob Consulta"}
              </span>
            </div>
            {product?.oldPrice && (
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Preço Anterior ("De R$"):</span>
                <span className="line-through text-zinc-500 font-mono">
                  {maskCurrency(product.oldPrice)}
                </span>
              </div>
            )}
          </div>

          {/* 1. NOVO PREÇO À VISTA COM MÁSCARA MONETÁRIA REAL (R$) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-price" className="text-xs font-bold text-zinc-200">
                Novo Preço de Venda À Vista (R$)
              </Label>
              <span className="text-[10px] text-zinc-500 font-mono">
                {numPrice ? maskCurrency(numPrice) : "Sob Consulta"}
              </span>
            </div>
            <Input
              id="quick-price"
              type="text"
              placeholder="R$ 0,00 (ou vazio para 'Sob Consulta')"
              value={priceMasked}
              onChange={(e) => setPriceMasked(maskCurrency(e.target.value))}
              className="h-10 text-base font-bold font-mono bg-zinc-900 border-zinc-700 text-emerald-400 focus:border-emerald-500"
            />
          </div>

          {/* 2. PREÇO ANTERIOR DE/POR COM MÁSCARA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-old-price" className="text-xs font-semibold text-zinc-200">
                Preço Anterior "De R$" (Cria Badge de Desconto Automática)
              </Label>
              {diffDiscount && (
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-300 bg-amber-500/10">
                  Desconto de {maskCurrency(diffDiscount.diff)} (-{diffDiscount.pct}%)
                </Badge>
              )}
            </div>
            <Input
              id="quick-old-price"
              type="text"
              placeholder="Ex: R$ 9.490,00"
              value={oldPriceMasked}
              onChange={(e) => setOldPriceMasked(maskCurrency(e.target.value))}
              className="h-9 text-xs font-mono bg-zinc-900 border-zinc-700 text-zinc-200"
            />
          </div>

          {/* Atalhos Rápidos de Desconto Percentual */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-400 font-medium mr-1">Aplicar corte:</span>
            {[5, 10, 15].map((pct) => (
              <Button
                key={pct}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleApplyPercentageDiscount(pct)}
                className="h-6 text-[10px] font-mono px-2 rounded-lg bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/50"
              >
                -{pct}% OFF
              </Button>
            ))}
          </div>

          {/* 3. SWITCH SIMULADOR 21X */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-400" />
                Simulador de Parcelamento em até 21x
              </Label>
              <p className="text-[11px] text-zinc-400">
                Calcula parcelas automáticas de 1x a 21x na maquininha nos cards e modais.
              </p>
            </div>
            <Switch checked={installments} onCheckedChange={setInstallments} />
          </div>

          {/* 4. PRESERVAR PREÇO ANTIGO */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-400" />
                Preservar Preço Atual como "De / Por"
              </Label>
              <p className="text-[11px] text-zinc-400">
                Se o novo valor for menor, usa o preço anterior para exibir a economia ao cliente.
              </p>
            </div>
            <Switch checked={keepOld} onCheckedChange={setKeepOld} />
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-2 border-t border-zinc-800">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-100 text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
          >
            {loading ? "Salvando..." : "Atualizar Preço & Condições"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
