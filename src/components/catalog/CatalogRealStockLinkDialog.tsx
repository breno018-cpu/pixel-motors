import { useState, useMemo } from "react";
import { CatalogProduct } from "@/types/catalog";
import { Vehicle } from "@/hooks/useVehicles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChassisPatternItem,
  calculateRealStockForProduct,
  suggestPatternForProduct,
} from "@/lib/catalogStockLink";
import {
  Link2,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Copy,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface CatalogRealStockLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CatalogProduct | null;
  vehicles: Vehicle[];
  patterns: ChassisPatternItem[];
  onSaveStockLink: (
    productId: string,
    patternCode: string,
    realStockQty: number,
    autoSync: boolean
  ) => Promise<any> | void;
}

export function CatalogRealStockLinkDialog({
  open,
  onOpenChange,
  product,
  vehicles = [],
  patterns = [],
  onSaveStockLink,
}: CatalogRealStockLinkDialogProps) {
  const [selectedPatternCode, setSelectedPatternCode] = useState<string>("");
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Sugestão automática ao abrir
  const defaultSuggested = useMemo(() => {
    if (!product) return null;
    return suggestPatternForProduct(product, patterns);
  }, [product, patterns]);

  const effectivePatternCode = selectedPatternCode || product?.patternCode || defaultSuggested?.code || "";

  // Cálculo do estoque real com base no padrão selecionado
  const stockResult = useMemo(() => {
    if (!product) return null;
    const tempProd: CatalogProduct = {
      ...product,
      patternCode: effectivePatternCode,
    };
    return calculateRealStockForProduct(tempProd, vehicles, patterns);
  }, [product, effectivePatternCode, vehicles, patterns]);

  if (!product) return null;

  const handleCopyChassis = (chassis: string) => {
    navigator.clipboard.writeText(chassis);
    toast.success(`Chassi ${chassis} copiado!`);
  };

  const handleApplySync = async () => {
    setSyncing(true);
    try {
      const realQty = stockResult ? stockResult.totalCount : 0;
      await onSaveStockLink(
        product.id,
        effectivePatternCode,
        realQty,
        autoSync
      );
      toast.success(
        `Estoque de "${product.name}" atrelado com sucesso! Catálogo atualizado para ${realQty} unidades físicas.`
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao atrelar estoque: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const catalogCurrentStock = product.stock ?? "Ilimitado / Pronta Entrega";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  Atrelamento com Estoque Real
                  <Badge variant="outline" className="text-xs bg-zinc-900 border-zinc-700">
                    #{product.id}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-xs">
                  Vincule este modelo do catálogo ao código de verificação automática de chassi cadastrado no pátio físico.
                </DialogDescription>
              </div>
            </div>
            {product.photos?.[0] && (
              <img
                src={product.photos[0]}
                alt={product.name}
                className="h-12 w-16 object-contain rounded bg-zinc-900 border border-zinc-800 p-1"
              />
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* COMPARATIVO: ESTOQUE NO CATÁLOGO VS ESTOQUE REAL NO PÁTIO */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                Estoque Atual no Catálogo
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black font-mono text-zinc-100">
                  {product.stock !== null && product.stock !== undefined ? product.stock : "Pronta Entrega"}
                </span>
                {product.stock === 0 && (
                  <Badge variant="destructive" className="text-[10px] font-bold">
                    ESGOTADO
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">Valor exibido para os clientes no site</p>
            </div>

            <div className="space-y-1 border-l border-zinc-800 pl-3">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5" />
                Estoque Real no Pátio (DealFlow Hub)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {stockResult ? stockResult.totalCount : 0} {stockResult?.totalCount === 1 ? "moto física" : "motos físicas"}
                </span>
                {stockResult && stockResult.totalCount > 0 ? (
                  <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                    DISPONÍVEL
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px] font-bold">
                    SEM UNIDADES FÍSICAS
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Motos físicas com status "disponível" no banco de dados
              </p>
            </div>
          </div>

          {/* 1. SELETOR DE CÓDIGO DE VERIFICAÇÃO AUTOMÁTICA DE CHASSI */}
          <div className="space-y-2 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Código de Verificação Automática (Padrão de Chassi)
              </Label>
              {defaultSuggested && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Sugerido: {defaultSuggested.code}
                </Badge>
              )}
            </div>

            <Select
              value={effectivePatternCode}
              onValueChange={(val) => setSelectedPatternCode(val)}
            >
              <SelectTrigger className="h-10 text-xs bg-zinc-900 border-zinc-700 text-zinc-100 font-mono">
                <SelectValue placeholder="Selecione o código de verificação automática..." />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-zinc-950 border-zinc-800 text-zinc-100">
                {patterns.map((pat) => (
                  <SelectItem
                    key={pat.code}
                    value={pat.code}
                    className="text-xs font-mono focus:bg-zinc-900 focus:text-primary cursor-pointer"
                  >
                    {pat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-[11px] text-zinc-400">
              Este é o mesmo padrão (WMI + Código de Modelo) que o sistema reconhece automaticamente ao escanear ou cadastrar o chassi de uma moto nova que chega na concessionária.
            </p>
          </div>

          {/* 2. LISTA DE MOTOS FÍSICAS ENCONTRADAS NO PÁTIO (CHASSIS) */}
          <div className="space-y-2 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-500" />
                Chassis Físicos Encontrados no Pátio ({stockResult?.availableVehicles.length || 0})
              </span>
              <span className="text-[10px] text-zinc-500">Clique para copiar o chassi</span>
            </div>

            {stockResult && stockResult.availableVehicles.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {stockResult.availableVehicles.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleCopyChassis(v.chassis || "")}
                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer text-xs"
                    title="Clique para copiar número de chassi"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {v.chassis || "SEM CHASSI"}
                      </span>
                      {v.color && (
                        <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400">
                          {v.color}
                        </Badge>
                      )}
                      {v.year && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {v.year}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300">
                      <Copy className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center rounded-lg bg-zinc-900/30 border border-dashed border-zinc-800 text-xs text-zinc-500 space-y-1">
                <AlertTriangle className="w-5 h-5 mx-auto text-amber-500/60" />
                <p>Nenhuma moto física com este padrão está cadastrada com status "disponível" no estoque.</p>
                <p className="text-[10px] text-zinc-600">
                  Ao cadastrar uma nova moto com este chassi, ela será computada aqui automaticamente.
                </p>
              </div>
            )}
          </div>

          {/* 3. SWITCH DE ATUALIZAÇÃO AUTOMÁTICA EM TEMPO REAL */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-primary" />
                Atualizar Catálogo Automaticamente em Tempo Real
              </Label>
              <p className="text-[11px] text-zinc-400">
                Quando uma moto é vendida ou cadastrada no DealFlow, atualiza instantaneamente a quantidade no catálogo digital. Se o pátio zerar, marca o modelo como "ESGOTADO" automaticamente.
              </p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-zinc-800 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-100 text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleApplySync}
            disabled={syncing}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            {syncing
              ? "Sincronizando..."
              : `Atrelar e Sincronizar Estoque (${stockResult?.totalCount || 0} un.)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
