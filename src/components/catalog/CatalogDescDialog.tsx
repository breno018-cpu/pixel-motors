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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, MessageSquare, AlertCircle, Save } from "lucide-react";

interface CatalogDescDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  onSave: (id: string, desc: string) => Promise<any> | void;
}

export function CatalogDescDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: CatalogDescDialogProps) {
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setDesc(product.desc || "");
    }
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(product.id, desc.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Editar Descrição Comercial
                  <Badge variant="outline" className="text-xs bg-zinc-900 border-zinc-700">
                    #{product.id}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs">
                  {product.brand} • {product.name} ({product.sub})
                </DialogDescription>
              </div>
            </div>
            {product.photos && product.photos[0] && (
              <img
                src={product.photos[0]}
                alt={product.name}
                className="h-12 w-16 object-contain rounded bg-zinc-900 p-1 border border-zinc-800"
              />
            )}
          </div>
        </DialogHeader>

        {/* Banner Informativo Obrigatório */}
        <div className="rounded-lg p-3.5 bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold text-blue-100">
              Onde esta descrição é utilizada?
            </p>
            <p className="text-blue-300">
              Este texto alimenta o <strong>card dinâmico compartilhado no WhatsApp</strong>, o{" "}
              <strong>modal de detalhes</strong>, o <strong>carrossel do topo</strong> e as{" "}
              <strong>respostas da Inteligência Artificial</strong>.
            </p>
          </div>
        </div>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Texto Comercial do Modelo
            </label>
            <span className="text-[11px] text-zinc-500">
              {desc.length} caracteres
            </span>
          </div>

          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ex: A nova Trail 200cc com injeção eletrônica de última geração, freios a disco combinados CBS e suspensão invertida de alto curso. Perfeita para asfalto e trilhas leves, com baixo consumo e 2 anos de garantia."
            rows={7}
            className="bg-zinc-900/80 border-zinc-700 focus:border-primary text-sm font-sans resize-y leading-relaxed text-zinc-100"
          />

          <p className="text-[11px] text-zinc-500">
            Dica: Destaque os principais benefícios, economia de combustível, garantia e condições de pilotagem para aumentar a conversão de leads no WhatsApp.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-zinc-800">
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
            {saving ? "Salvando..." : "Salvar Descrição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
