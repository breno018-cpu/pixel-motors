import { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Key, Globe, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getVehicleApiConfig,
  saveVehicleApiConfig,
  VehicleApiConfig,
} from '@/lib/plateLookup';
import { useToast } from '@/hooks/use-toast';

interface VehicleApiConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleApiConfigDialog({
  open,
  onOpenChange,
}: VehicleApiConfigDialogProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<VehicleApiConfig['provider']>('none');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');

  useEffect(() => {
    if (open) {
      const cfg = getVehicleApiConfig();
      setProvider(cfg.provider || 'none');
      setApiKey(cfg.apiKey || '');
      setCustomEndpoint(cfg.customEndpoint || '');
    }
  }, [open]);

  const handleSave = () => {
    saveVehicleApiConfig({
      provider,
      apiKey: apiKey.trim(),
      customEndpoint: customEndpoint.trim(),
    });
    toast({
      title: 'Configurações de Consulta Veicular salvas',
      description:
        provider === 'none'
          ? 'Modo seguro ativo: laudos emitidos via conferência presencial de CRLV-e.'
          : 'Provedor de API configurado com sucesso para consultas em tempo real.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                API de Consulta Veicular (DETRAN / SENATRAN)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Integração para busca automática de chassi, renavam, multas e restrições legais.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              No Brasil, dados de DETRAN/SINESP não são públicos por razões da LGPD. Para consulta automática por placa, utilize sua chave de provedor homologado ou realize a vistoria física com o CRLV-e em mãos.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Provedor de Consulta</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Vistoria Manual com CRLV-e e Canote)</SelectItem>
                <SelectItem value="infosimples">InfoSimples (Detran & Sinesp)</SelectItem>
                <SelectItem value="wdcar">WDCar / Consultas Prime</SelectItem>
                <SelectItem value="placa_fipe">PlacaFipe API</SelectItem>
                <SelectItem value="custom_webhook">API Própria / Webhook da Concessionária</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider !== 'none' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chave de API / Token de Acesso</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole sua API Key do provedor aqui..."
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>

              {provider === 'custom_webhook' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">URL do Endpoint da Concessionária</Label>
                  <Input
                    type="url"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="https://api.concessionaria.com.br/consulta-veiculo"
                    className="h-10 rounded-xl font-mono text-xs"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" className="font-bold" onClick={handleSave}>
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
