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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CatalogProduct, CatalogPromo } from "@/types/catalog";
import { maskCurrency, parseCurrency } from "@/lib/masks";
import {
  Tag,
  Trash2,
  Calendar,
  Sparkles,
  Percent,
  HelpCircle,
  TrendingDown,
  Info,
} from "lucide-react";

interface CatalogPromoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  onSavePromo: (id: string, promo: CatalogPromo | null) => Promise<any> | void;
}

// Motivos e Finalidades Comerciais pré-configuradas para o desconto
const DISCOUNT_REASONS = [
  {
    id: "bonus_fabrica",
    label: "Bônus de Fábrica",
    desc: "Subsídio direto da montadora / concessionária para alavancar vendas.",
    suggestedTag: "BÔNUS DE FÁBRICA",
  },
  {
    id: "queima_estoque",
    label: "Queima de Estoque",
    desc: "Giro rápido de pátio para liberação de espaço e renovação de frota.",
    suggestedTag: "QUEIMA DE ESTOQUE",
  },
  {
    id: "desconto_a_vista",
    label: "Desconto À Vista / PIX",
    desc: "Abatimento imediato sem custos de intermediação financeira ou taxas de cartão.",
    suggestedTag: "DESCONTO À VISTA",
  },
  {
    id: "taxa_zero",
    label: "Taxa Zero no Cartão",
    desc: "A loja absorve o custo do parcelamento para facilitar o fechamento.",
    suggestedTag: "TAXA ZERO",
  },
  {
    id: "bonus_troca",
    label: "Supervalorização na Troca",
    desc: "Bônus aplicado ao aceitar a moto usada do cliente na negociação.",
    suggestedTag: "BÔNUS NA TROCA",
  },
  {
    id: "campanha_sazonal",
    label: "Campanha Sazonal / Especial",
    desc: "Oferta comemorativa (Inauguração, Black Friday, Semana do Cliente).",
    suggestedTag: "OFERTA ESPECIAL",
  },
];

export function CatalogPromoDialog({
  open,
  onOpenChange,
  product,
  onSavePromo,
}: CatalogPromoDialogProps) {
  const [active, setActive] = useState(true);
  const [label, setLabel] = useState("");
  const [discountMasked, setDiscountMasked] = useState("R$ 1.000,00");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("Bônus de Fábrica");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && product) {
      if (product.promo) {
        setActive(product.promo.active !== false);
        setLabel(product.promo.label || "R$ 1.000 OFF");
        setDiscountMasked(
          product.promo.discount
            ? maskCurrency(product.promo.discount)
            : "R$ 1.000,00"
        );
        setUntil(product.promo.until ? product.promo.until.slice(0, 10) : "");
        setReason(product.promo.reason || "Bônus de Fábrica");
        setDescription(product.promo.description || "");
      } else {
        setActive(true);
        setLabel("R$ 1.000 OFF");
        setDiscountMasked("R$ 1.000,00");
        setReason("Bônus de Fábrica");
        setDescription("Condição promocional exclusiva válida por tempo limitado.");

        // Padrão: 30 dias à frente
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        setUntil(nextMonth.toISOString().slice(0, 10));
      }
    }
  }, [open, product]);

  const discountValue = useMemo(() => {
    return parseCurrency(discountMasked);
  }, [discountMasked]);

  const originalPrice = product?.price || 0;
  const finalPrice = Math.max(0, originalPrice - discountValue);
  const discountPercent =
    originalPrice > 0 ? ((discountValue / originalPrice) * 100).toFixed(1) : "0";

  const handleSelectReason = (r: (typeof DISCOUNT_REASONS)[0]) => {
    setReason(r.label);
    if (!label || label === "R$ 1.000 OFF" || DISCOUNT_REASONS.some((dr) => dr.suggestedTag === label)) {
      setLabel(r.suggestedTag);
    }
    if (!description || description === "Condição promocional exclusiva válida por tempo limitado.") {
      setDescription(r.desc);
    }
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskCurrency(raw);
    setDiscountMasked(masked);

    // Sugere etiqueta automática proporcional se for tipo OFF
    const num = parseCurrency(masked);
    if (num > 0 && (!label || label.includes("OFF"))) {
      setLabel(`${masked} OFF`);
    }
  };

  const handleSetQuickDiscount = (amount: number) => {
    const masked = maskCurrency(amount);
    setDiscountMasked(masked);
    setLabel(`${masked} OFF`);
  };

  const handleSave = async () => {
    if (!product) return;
    if (!label.trim()) {
      toast.error("O rótulo / nome do selo promocional é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      const payload: CatalogPromo = {
        active,
        label: label.trim(),
        discount: discountValue > 0 ? discountValue : undefined,
        until: until.trim() || undefined,
        reason: reason.trim() || undefined,
        description: description.trim() || undefined,
      };

      await onSavePromo(product.id, payload);
      toast.success(`Promoção de "${product.name}" configurada com sucesso!`);
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
      toast.success(`Promoção encerrada para "${product.name}".`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao remover promoção: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-100">
                  Gestão e Finalidade do Desconto
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs">
                  {product?.brand} • {product?.name} ({product?.sub})
                </DialogDescription>
              </div>
            </div>
            {product?.photos?.[0] && (
              <img
                src={product.photos[0]}
                alt={product.name}
                className="h-12 w-16 object-contain rounded bg-zinc-900 border border-zinc-800 p-1"
              />
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Ativo / Inativo */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-zinc-200">
                Oferta / Desconto Ativo
              </Label>
              <p className="text-[11px] text-zinc-400">
                Exibir selos promocionais e condições diferenciadas no catálogo público.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {/* 1. CONTROLE DE VALOR DO DESCONTO COM MÁSCARA MONETÁRIA REAL (R$) */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="promo-discount-masked" className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                Valor do Desconto em Reais (R$)
              </Label>
              {originalPrice > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                  Economia de {discountPercent}%
                </Badge>
              )}
            </div>

            <div className="relative">
              <Input
                id="promo-discount-masked"
                type="text"
                value={discountMasked}
                onChange={handleDiscountChange}
                placeholder="R$ 1.000,00"
                className="h-11 text-lg font-black font-mono text-emerald-400 bg-zinc-900 border-zinc-700 pl-3 focus:border-emerald-500"
              />
            </div>

            {/* Botões Rápidos de Valor de Desconto */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-zinc-400 font-medium mr-1">Atalhos rápidos:</span>
              {[300, 500, 1000, 1500, 2000].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetQuickDiscount(amt)}
                  className="h-6 text-[10px] font-mono px-2 rounded-lg bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/50"
                >
                  {maskCurrency(amt)}
                </Button>
              ))}
            </div>

            {/* Simulação Matemática Clara */}
            {originalPrice > 0 && (
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase">Preço Tabela</span>
                  <span className="font-semibold text-zinc-300 font-mono">
                    {maskCurrency(originalPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-500 block uppercase">Desconto</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    - {maskCurrency(discountValue)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-primary block uppercase">Preço Final</span>
                  <span className="font-black text-primary font-mono">
                    {maskCurrency(finalPrice)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. CONTROLE DA FINALIDADE / MOTIVO DO DESCONTO ("PRA QUE SERVE CADA DESCONTO") */}
          <div className="space-y-2.5 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-primary" />
                Para que serve este desconto? (Motivo / Finalidade Comercial)
              </Label>
              <span className="text-[10px] text-zinc-500">Selecione ou digite abaixo</span>
            </div>

            {/* Pílulas de Seleção Rápida da Finalidade */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {DISCOUNT_REASONS.map((r) => {
                const isSelected = reason === r.label;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectReason(r)}
                    className={`p-2 rounded-lg border text-left text-xs transition-colors flex flex-col justify-between ${
                      isSelected
                        ? "bg-primary/20 border-primary text-primary-foreground"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className="font-semibold text-[11px] leading-tight block truncate">
                      {r.label}
                    </span>
                    <span className="text-[9px] text-zinc-500 line-clamp-1 mt-0.5">
                      {r.suggestedTag}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1 pt-1">
              <Label htmlFor="promo-reason" className="text-[11px] text-zinc-400 font-medium">
                Finalidade Personalizada:
              </Label>
              <Input
                id="promo-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Bônus de Fábrica, Queima de Estoque, Desconto Especial para Produtor Rural..."
                className="h-8 text-xs bg-zinc-900 border-zinc-700 text-zinc-100"
              />
            </div>

            <div className="space-y-1 pt-1">
              <Label htmlFor="promo-description" className="text-[11px] text-zinc-400 font-medium">
                Explicação detalhada da condição para o cliente (WhatsApp / Vendedor):
              </Label>
              <Textarea
                id="promo-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Desconto de R$ 1.000 concedido diretamente pela fábrica para unidades a pronta entrega até o final do mês."
                className="text-xs bg-zinc-900 border-zinc-700 text-zinc-100 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* 3. NOME DO SELO PÚBLICO & DATA LIMITE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-label" className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                Texto do Selo no Card
              </Label>
              <Input
                id="promo-label"
                placeholder="Ex: R$ 1.000 OFF"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-9 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 font-bold"
              />
              <p className="text-[10px] text-zinc-500">
                Aparece no topo do card e nos banners.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promo-until" className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Validade da Oferta (Até Quando)
              </Label>
              <Input
                id="promo-until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="h-9 text-xs bg-zinc-900 border-zinc-700 text-zinc-100"
              />
              <p className="text-[10px] text-zinc-500">
                Alerta de urgência e contagem regressiva.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t border-zinc-800 gap-2">
          {product?.promo ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemovePromo}
              disabled={saving}
              className="gap-1.5 text-xs font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Encerrar Oferta
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {saving ? "Salvando..." : "Aplicar Desconto e Selo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
