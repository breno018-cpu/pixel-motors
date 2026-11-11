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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getCatalogApiSettings, saveCatalogApiSettings } from "@/lib/catalogApi";
import { CatalogConfig } from "@/types/catalog";
import { Settings, Server, Store, CheckCircle, RefreshCw } from "lucide-react";

interface CatalogConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig?: CatalogConfig;
  onSaveStoreConfig: (config: CatalogConfig) => Promise<any>;
}

export function CatalogConfigDialog({
  open,
  onOpenChange,
  currentConfig,
  onSaveStoreConfig,
}: CatalogConfigDialogProps) {
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Store config
  const [storeName, setStoreName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [maxInstallments, setMaxInstallments] = useState(21);
  const [isSavingStore, setIsSavingStore] = useState(false);

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
      }
    }
  }, [open, currentConfig]);

  const handleSaveApiSettings = () => {
    saveCatalogApiSettings(apiUrl, token);
    toast.success("Parâmetros de conexão salvos!");
    window.location.reload(); // Recarrega para reconectar com a nova URL/Token
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
          message: `Conexão bem-sucedida! Catálogo v${data.version || 1} respondendo com ${data.products?.length || 0} produtos.`,
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
      });
      toast.success("Configurações da loja sincronizadas com o catálogo!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message}`);
    } finally {
      setIsSavingStore(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações do Catálogo L1MA
          </DialogTitle>
          <DialogDescription>
            Configure o endpoint da API externa e os dados comerciais da loja exibidos aos clientes.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="connection" className="w-full mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="connection" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Conexão com a API
            </TabsTrigger>
            <TabsTrigger value="store" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Parâmetros da Loja
            </TabsTrigger>
          </TabsList>

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
                Endereço onde a API REST / SSE do catálogo público está rodando.
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

          <TabsContent value="store" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="store-name">Nome da Loja no Catálogo</Label>
              <Input
                id="store-name"
                placeholder="Ex: L1MA Motors Concessionária"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-whatsapp">WhatsApp Comercial (com DDD e DDI)</Label>
              <Input
                id="store-whatsapp"
                placeholder="Ex: 5537999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número para onde os botões de cotação e proposta no catálogo irão direcionar o cliente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-installments">Parcelamento Máximo no Cartão (Vezes)</Label>
              <Input
                id="max-installments"
                type="number"
                min={1}
                max={36}
                value={maxInstallments}
                onChange={(e) => setMaxInstallments(Number(e.target.value))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveStore} disabled={isSavingStore}>
                {isSavingStore ? "Sincronizando..." : "Sincronizar com o Catálogo"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
