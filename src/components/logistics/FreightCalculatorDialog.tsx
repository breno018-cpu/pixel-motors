import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Navigation,
  Sparkles,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import {
  TRANSPORT_LOGISTICS_METHODS,
  calculateFreightCost,
  type TransportLogisticsMethod,
  type FreightCostBreakdown,
} from '@/lib/transportLogistics';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDestinationCity?: string;
  initialKm?: number;
  customerName?: string;
  vehicleModel?: string;
}

// Cidades de referência e distâncias rodoviárias médias a partir dos hubs (Divinópolis / Montes Claros)
const PRESET_CITIES = [
  { city: 'Nova Serrana - MG', km: 45, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Itaúna - MG', km: 42, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Pará de Minas - MG', km: 58, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Bom Despacho - MG', km: 82, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Belo Horizonte - MG', km: 125, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Betim / Contagem - MG', km: 95, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Sete Lagoas - MG', km: 165, hub: 'Divinópolis (Matriz Oeste)' },
  { city: 'Bocaiúva - MG', km: 48, hub: 'Montes Claros (Polo Norte)' },
  { city: 'Janaúba - MG', km: 132, hub: 'Montes Claros (Polo Norte)' },
  { city: 'Pirapora - MG', km: 165, hub: 'Montes Claros (Polo Norte)' },
  { city: 'Salinas - MG', km: 218, hub: 'Montes Claros (Polo Norte)' },
  { city: 'Montes Claros ⇄ Divinópolis (Interlojas)', km: 475, hub: 'Corredor Corporativo BR-135' },
];

export function FreightCalculatorDialog({
  open,
  onOpenChange,
  initialDestinationCity = '',
  initialKm,
  customerName = '',
  vehicleModel = 'Motocicleta 0km',
}: Props) {
  const { toast } = useToast();

  const [destinationCity, setDestinationCity] = useState(initialDestinationCity || 'Nova Serrana - MG');
  const [roadKm, setRoadKm] = useState<number>(initialKm || 45);
  const [vehicleCount, setVehicleCount] = useState<number>(1);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('cegonha_coletiva');
  const [copied, setCopied] = useState(false);

  // Seleciona preset de cidade
  const handleSelectPreset = (preset: typeof PRESET_CITIES[0]) => {
    setDestinationCity(preset.city);
    setRoadKm(preset.km);
  };

  // Custo discriminado de todos os métodos
  const simulations: FreightCostBreakdown[] = useMemo(() => {
    return TRANSPORT_LOGISTICS_METHODS.map((method) =>
      calculateFreightCost(method.id, roadKm, vehicleCount)
    );
  }, [roadKm, vehicleCount]);

  const activeSimulation = useMemo(() => {
    return simulations.find((s) => s.methodId === selectedMethodId) || simulations[0];
  }, [simulations, selectedMethodId]);

  const activeMethodDef = useMemo(() => {
    return TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === selectedMethodId) || TRANSPORT_LOGISTICS_METHODS[0];
  }, [selectedMethodId]);

  // Mensagem pronta para envio ao cliente via WhatsApp
  const whatsappQuoteText = useMemo(() => {
    const custName = customerName ? `Olá, ${customerName}! ` : 'Olá! ';
    return `${custName}Segue a simulação oficial de logística e entrega da sua *${vehicleModel}* pela Pixel Motors:

*Destino:* ${destinationCity || 'Endereço Indicado'}
*Distância Rodoviária Estimada:* ${roadKm} km
*Modalidade:* ${activeMethodDef.nome}
*Prazo de Entrega:* ${activeMethodDef.prazoFormatado}
*Seguro de Carga:* ${activeMethodDef.seguroCarga} (100% Coberto)
*Rastreamento:* ${activeMethodDef.rastreamentoGps ? 'GPS Ativo em Tempo Real' : 'Acompanhamento pela Loja'}

*Valor do Frete:* ${activeSimulation.formattedTotal}
${vehicleCount > 1 ? `*Lote:* ${vehicleCount} motocicletas com desconto especial aplicado.\n` : ''}
Qualquer dúvida estamos à disposição para agendar a expedição do seu veículo!`;
  }, [customerName, vehicleModel, destinationCity, roadKm, activeMethodDef, activeSimulation, vehicleCount]);

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(whatsappQuoteText);
    setCopied(true);
    toast({
      title: 'Cotação copiada com sucesso!',
      description: 'O texto formatado está pronto para colar no WhatsApp do cliente.',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                Simulador de Frete & Logística de Entrega
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Vendedor & Frotas
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cotação instantânea de fretes rodoviários, prazos de entrega e seguro de carga para propostas comerciais.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* Seção 1: Destino, Distância e Quantidade */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
            <div className="sm:col-span-6 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Cidade de Destino / Município do Cliente
              </Label>
              <Input
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="Ex: Nova Serrana, Belo Horizonte, Itaúna..."
                className="h-9 text-xs font-medium"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                Distância (Km)
              </Label>
              <Input
                type="number"
                min={0}
                max={2500}
                value={roadKm}
                onChange={(e) => setRoadKm(Math.max(0, Number(e.target.value) || 0))}
                className="h-9 text-xs font-bold"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                Qtd. de Motos
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={vehicleCount}
                onChange={(e) => setVehicleCount(Math.max(1, Number(e.target.value) || 1))}
                className="h-9 text-xs font-bold"
              />
            </div>

            {/* Atalhos de Cidades Rápidas */}
            <div className="sm:col-span-12 pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                Atalhos Frequentes de Rotas Regionais:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CITIES.slice(0, 6).map((preset) => (
                  <button
                    key={preset.city}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                      destinationCity === preset.city
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card hover:bg-muted text-foreground/80 border-border/70'
                    )}
                  >
                    {preset.city.split(' - ')[0]} ({preset.km} km)
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Seção 2: Comparativo dos 5 Métodos de Transporte */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <Truck className="w-3.5 h-3.5 text-primary" />
                Escolha o Método de Logística
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Selecione para ver o detalhamento comercial
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {simulations.map((sim) => {
                const isSelected = sim.methodId === selectedMethodId;
                const method = TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === sim.methodId)!;

                return (
                  <div
                    key={sim.methodId}
                    onClick={() => setSelectedMethodId(sim.methodId)}
                    className={cn(
                      'p-3 rounded-2xl border transition-all cursor-pointer text-left relative flex flex-col justify-between',
                      isSelected
                        ? 'bg-card border-primary ring-2 ring-primary/20 shadow-sm'
                        : 'bg-card/60 hover:bg-card border-border/70 hover:border-border'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 font-bold', method.corBadge)}>
                          {method.destaqueBadge}
                        </Badge>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-foreground leading-snug">
                        {method.nome}
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {method.subtitulo}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-border/50 flex items-end justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {method.prazoFormatado.split(' ')[0]} {method.prazoFormatado.split(' ')[1] || ''}
                        </span>
                        <span className="text-xs font-bold text-foreground block">
                          {sim.formattedTotal}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[9px]">
                        R$ {method.tarifaBaseKm.toFixed(2)}/km
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção 3: Detalhamento Técnico & Resumo do Frete Selecionado */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                  Cotação Ativa para Negociação
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  {activeMethodDef.nome}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeMethodDef.descricao}
                </p>
              </div>
              <div className="text-right sm:shrink-0">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Total do Frete
                </span>
                <span className="text-xl font-extrabold text-primary font-display">
                  {activeSimulation.formattedTotal}
                </span>
              </div>
            </div>

            {/* Grade de Atributos Oficiais de Segurança */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block font-medium">Prazo Estimado</span>
                <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {activeMethodDef.prazoFormatado}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block font-medium">Seguro de Carga</span>
                <span className="font-bold text-foreground flex items-center gap-1 mt-0.5 truncate" title={activeMethodDef.seguroCarga}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  RCTR-C 100%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block font-medium">Rastreamento GPS</span>
                <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  {activeMethodDef.rastreamentoGps ? 'Ativo em Rota' : 'Pátio Físico'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block font-medium">Capacidade do Lote</span>
                <span className="font-bold text-foreground truncate mt-0.5 block" title={activeMethodDef.capacidadeLote}>
                  {activeMethodDef.capacidadeLote}
                </span>
              </div>
            </div>

            {/* Ações Rápidas de Fechamento para o Vendedor */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyQuote}
                className="w-full sm:w-auto gap-2 text-xs font-semibold h-9"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Cotação Copiada!' : 'Copiar Texto para WhatsApp'}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  handleCopyQuote();
                  onOpenChange(false);
                }}
                className="w-full sm:w-auto gap-2 text-xs font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Confirmar Frete na Proposta
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FreightCalculatorDialog;
