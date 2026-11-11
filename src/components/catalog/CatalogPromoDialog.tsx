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
import { CatalogProduct, CatalogPromo } from "@/types/catalog";
import { Tag, Trash2, Calendar, DollarSign, Sparkles } from "lucide-react";

interface CatalogPromoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  onSavePromo: (id: string, promo: CatalogPromo | null) => Promise<any>;
}

export function CatalogPromoDialog({
  open,
  onOpenChange,
  product,
  onSavePromo,
}: CatalogPromoDialogProps) {
  const [active, setActive] = useState(true);
  const [label, setLabel] = useState("");
  const [discount, setDiscount] = useState<string>("");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && product) {
      if (product.promo) {
        setActive(product.promo.active !== false);
        setLabel(product.promo.label || "R$ 1.000 OFF");
        setDiscount(product.promo.discount ? String(product.promo.discount) : "");
        setUntil(product.promo.until ? product.promo.until.slice(0, 10) : "");
      } else {
        setActive(true);
        setLabel("R$ 1.000 OFF");
        setDiscount("1000");
        // Padrão: 30 dias à frente
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        setUntil(nextMonth.toISOString().slice(0, 10));
      }
    }
  }, [open, product]);

  const handleSave = async () => {
    if (!product) return;
    if (!label.trim()) {
      toast.error("O rótulo da promoção é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload: CatalogPromo = {
        active,
        label: label.trim(),
        discount: discount.trim() ? parseFloat(discount) : undefined,
        until: until.trim() || undefined,
      };

      await onSavePromo(product.id, payload);
      toast.success(`Promoção de "${product.name}" atualizada no catálogo!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar promoção: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePromo = async () => {
    if (!product) return;
    setSaving(true);
    try {
      await onSavePromo(product.id, null);
      toast.success(`Promoção removida de "${product.name}".`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao remover promoção: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="w-5 h-5 text-amber-500" />
            Configurar Promoção: {product?.name}
          </DialogTitle>
          <DialogDescription>
            Exibe selos de oferta chamativos, valores promocionais e data limite nos cards e na página do veículo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Ativo */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Promoção Ativa</Label>
              <p className="text-xs text-muted-foreground">Exibir selo de oferta público</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {/* Nome do Selo */}
          <div className="space-y-1.5">
            <Label htmlFor="promo-label">Nome do Selo / Etiqueta</Label>
            <Input
              id="promo-label"
              placeholder="Ex: R$ 1.000 OFF, Queima de Estoque, Taxa Zero"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <div className="flex gap-1.5 pt-1">
              {["R$ 1.000 OFF", "R$ 500 OFF", "Taxa Zero", "Queima de Estoque"].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setLabel(sug)}
                  className="text-[10px] px-2 py-0.5 rounded border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Valor do Desconto */}
          <div className="space-y-1.5">
            <Label htmlFor="promo-discount" className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Valor do Desconto em Reais (R$)
            </Label>
            <Input
              id="promo-discount"
              type="number"
              step="10"
              placeholder="Ex: 1000.00"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>

          {/* Data Limite ("Até Quando") */}
          <div className="space-y-1.5">
            <Label htmlFor="promo-until" className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              Válido Até Quando (Data Limite)
            </Label>
            <Input
              id="promo-until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Aparece em destaque no carrossel e no modal do veículo alertando o cliente sobre o fim da oferta.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t">
          {product?.promo ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemovePromo}
              disabled={saving}
              className="gap-1 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Encerrar Oferta
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : "Aplicar Promoção"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
