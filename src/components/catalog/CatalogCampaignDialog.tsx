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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CatalogCampaign } from "@/types/catalog";
import { Megaphone, Trash2 } from "lucide-react";

interface CatalogCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCampaign?: CatalogCampaign | null;
  onSaveCampaign: (campaign: CatalogCampaign | null) => Promise<any>;
}

export function CatalogCampaignDialog({
  open,
  onOpenChange,
  currentCampaign,
  onSaveCampaign,
}: CatalogCampaignDialogProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [until, setUntil] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (currentCampaign) {
        setTitle(currentCampaign.title || "");
        setText(currentCampaign.text || "");
        setUntil(currentCampaign.until ? currentCampaign.until.slice(0, 16) : "");
      } else {
        setTitle("");
        setText("");
        setUntil("");
      }
    }
  }, [open, currentCampaign]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("O título da campanha é obrigatório");
      return;
    }

    setLoading(true);
    try {
      await onSaveCampaign({
        title: title.trim(),
        text: text.trim(),
        until: until ? new Date(until).toISOString() : undefined,
      });
      toast.success("Campanha aplicada no catálogo com sucesso!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao aplicar campanha: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await onSaveCampaign(null);
      toast.success("Campanha removida do topo do catálogo.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao remover campanha: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" />
            Campanha no Topo do Catálogo
          </DialogTitle>
          <DialogDescription>
            Exibe um banner promocional de destaque com contagem regressiva para todos os visitantes do catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="camp-title">Título da Campanha</Label>
            <Input
              id="camp-title"
              placeholder="Ex: Mega Feirão de Inauguração"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="camp-text">Texto / Condição Especial</Label>
            <Textarea
              id="camp-text"
              placeholder="Ex: Até R$ 2.000 de bônus na sua moto usada ou taxa zero em 24x!"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="camp-until">Válido Até (Data e Hora limite)</Label>
            <Input
              id="camp-until"
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Define o relógio de contagem regressiva no catálogo público.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          {currentCampaign ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={loading}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Remover Banner
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Publicar Campanha"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
