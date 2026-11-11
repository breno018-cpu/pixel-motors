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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getCatalogApiSettings, saveCatalogApiSettings } from "@/lib/catalogApi";
import { CatalogConfig } from "@/types/catalog";
import { Settings, Server, Store, CheckCircle, RefreshCw, CreditCard, Percent } from "lucide-react";

interface CatalogConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig?: CatalogConfig;
  onSaveStoreConfig: (config: CatalogConfig) => Promise<any>;
  onSaveRates?: (debitRate: number, installmentRates: number[], installmentNote?: string) => Promise<any>;
}

export function CatalogConfigDialog({
  open,
  onOpenChange,
  currentConfig,
  onSaveStoreConfig,
  onSaveRates,
}: CatalogConfigDialogProps) {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Store config
  const [storeName, setStoreName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [maxInstallments, setMaxInstallments] = useState(21);
  const [lowStockThreshold, setLowStockThreshold] = useState(2);
  const [isSavingStore, setIsSavingStore] = useState(false);

  // Taxas Maquininha
  const [debitRate, setDebitRate] = useState<string>("1.10");
  const [rates, setRates] = useState<string[]>(
    Array.from({ length: 21 }, (_, i) => (2.5 + i * 0.75).toFixed(2))
  );
  const [installmentNote, setInstallmentNote] = useState(
    "Valores aproximados para simulação em cartão de crédito. Condições sujeitas a análise e aprovação."
  );
  const [isSavingRates, setIsSavingRates] = useState(false);

  useEffect(() => {
    if (open) {
      const settings = getCatalogApiSettings();
      setApiUrl(settings.url);
      setToken(settings.token);
      setTestResult(null);

      if (currentConfig) {
        setStoreName(currentConfig.storeName || "");
        setWhatsapp(currentConfig.whatsapp || "");
        setMaxInstallments(currentConfig.maxInstallments || 21);
        setLowStockThreshold(currentConfig.lowStockThreshold || 2);

        if (currentConfig.debitRate !== undefined) {
          setDebitRate(String(currentConfig.debitRate));
        }

        if (Array.isArray(currentConfig.installmentRates) && currentConfig.installmentRates.length > 0) {
          setRates(
            Array.from({ length: 21 }, (_, i) =>
              currentConfig.installmentRates?.[i] !== undefined
                ? String(currentConfig.installmentRates[i])
                : (2.5 + i * 0.75).toFixed(2)
            )
          );
        }

        if (currentConfig.installmentNote) {
          setInstallmentNote(currentConfig.installmentNote);
        }
      }
    }
  }, [open, currentConfig]);

  const handleSaveApiSettings = () => {
    saveCatalogApiSettings(apiUrl, token);
    toast.success("Parâmetros de conexão salvos!");
    window.location.reload();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const cleanUrl = apiUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanUrl}/api/catalog`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          ok: true,
          message: `Conexão bem-sucedida! Catálogo v${data.version || 1} respondendo com ${data.products?.length || 0} modelos sincronizados.`,
        });
      } else {
        setTestResult({
          ok: false,
          message: `O servidor respondeu com status ${res.status}: ${res.statusText}`,
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: `Não foi possível conectar ao servidor: ${e.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveStore = async () => {
    setIsSavingStore(true);
    try {
      await onSaveStoreConfig({
        ...currentConfig,
        storeName: storeName.trim(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        maxInstallments: Number(maxInstallments) || 21,
        lowStockThreshold: Number(lowStockThreshold) || 2,
      });
      toast.success("Configurações da loja sincronizadas com o catálogo!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message}`);
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleSaveRatesTable = async () => {
    setIsSavingRates(true);
    try {
      const numDebit = parseFloat(debitRate) || 1.10;
      const numRates = rates.map((r, i) => parseFloat(r) || (2.5 + i * 0.75));

      if (onSaveRates) {
        await onSaveRates(numDebit, numRates, installmentNote.trim());
      } else {
        await onSaveStoreConfig({
          ...currentConfig,
          debitRate: numDebit,
          installmentRates: numRates,
          installmentNote: installmentNote.trim(),
        });
      }

      toast.success("Taxas e simulador financeiro 21x atualizados no catálogo!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar taxas: ${e.message}`);
    } finally {
      setIsSavingRates(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            Configurações do Catálogo L1MA Motors
          </DialogTitle>
          <DialogDescription>
            Controle de endpoint da API, parâmetros comerciais da loja e taxas do simulador de 1x a 21x.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="connection" className="flex-1 overflow-y-auto mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="connection" className="text-xs flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" /> Conexão API
            </TabsTrigger>
            <TabsTrigger value="store" className="text-xs flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" /> Dados da Loja
            </TabsTrigger>
            <TabsTrigger value="rates" className="text-xs flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Simulador 21x
            </TabsTrigger>
          </TabsList>

          {/* ABA CONEXÃO */}
          <TabsContent value="connection" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="catalog-url">URL da API do Catálogo (CATALOG_API_URL)</Label>
              <Input
                id="catalog-url"
                placeholder="http://localhost:5173 ou https://catalogo.l1mamotors.com.br"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Serviço Node.js independente que serve o catálogo público e os canais REST/SSE.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-token">Token Bearer de Sincronização (CATALOG_SYNC_TOKEN)</Label>
              <Input
                id="catalog-token"
                type="password"
                placeholder="Ex: l1ma-dev-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Chave de autorização enviada no cabeçalho <code>Authorization: Bearer</code> das operações POST /api/sync.
              </p>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-md text-xs border ${
                  testResult.ok
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}
              >
                {testResult.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing || !apiUrl}
                className="gap-2"
              >
                {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Testar Conexão
              </Button>
              <Button onClick={handleSaveApiSettings} size="sm">
                Salvar & Reconectar
              </Button>
            </div>
          </TabsContent>

          {/* ABA DADOS DA LOJA */}
          <TabsContent value="store" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="store-name">Nome Fantasia da Loja</Label>
              <Input
                id="store-name"
                placeholder="Ex: L1MA Motors Concessionária"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-whatsapp">WhatsApp Oficial de Vendas (DDI + DDD + Número)</Label>
              <Input
                id="store-whatsapp"
                placeholder="Ex: 5537999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Para onde os botões "Cote pelo WhatsApp" e "Avise-me quando chegar" enviarão os clientes com mensagem pré-formatada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-inst">Máximo de Parcelas no Cartão</Label>
                <Input
                  id="max-inst"
                  type="number"
                  min={1}
                  max={24}
                  value={maxInstallments}
                  onChange={(e) => setMaxInstallments(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="low-stock">Limite de "Últimas Unidades"</Label>
                <Input
                  id="low-stock"
                  type="number"
                  min={1}
                  max={10}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                />
                <p className="text-[11px] text-muted-foreground">
                  Estoque igual ou abaixo deste número ganha o selo "Últimas unidades!".
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveStore} disabled={isSavingStore} size="sm">
                {isSavingStore ? "Sincronizando..." : "Sincronizar Dados da Loja"}
              </Button>
            </div>
          </TabsContent>

          {/* ABA SIMULADOR E TAXAS 1x a 21x */}
          <TabsContent value="rates" className="space-y-4 pt-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-500" />
                  Taxa no Débito (%)
                </Label>
                <p className="text-xs text-muted-foreground">Taxa da maquininha para pagamento à vista no débito.</p>
              </div>
              <Input
                type="number"
                step="0.01"
                className="w-24 text-right font-mono"
                value={debitRate}
                onChange={(e) => setDebitRate(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Label className="text-sm font-semibold">Tabela de Taxas Reais (1x a 21x)</Label>
                  <p className="text-xs text-muted-foreground">
                    Ao salvar, o catálogo recalcula instantaneamente as parcelas de todos os 79 modelos.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 max-h-56 overflow-y-auto p-2 border rounded-lg bg-card">
                {rates.map((rateVal, idx) => (
                  <div key={idx} className="p-1.5 rounded border bg-muted/10 text-center">
                    <span className="text-[10px] font-bold text-muted-foreground block">{idx + 1}x</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-7 text-xs text-center font-mono p-1 mt-0.5"
                      value={rateVal}
                      onChange={(e) => {
                        const next = [...rates];
                        next[idx] = e.target.value;
                        setRates(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inst-note">Aviso Legal do Simulador de Parcelas</Label>
              <Textarea
                id="inst-note"
                rows={2}
                value={installmentNote}
                onChange={(e) => setInstallmentNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveRatesTable} disabled={isSavingRates} size="sm">
                {isSavingRates ? "Atualizando..." : "Sincronizar Taxas com o Catálogo"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
