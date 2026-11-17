import React, { useState, useMemo, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  Car,
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
  Fuel,
  Utensils,
  Moon,
  Coffee,
  AlertTriangle,
  Users,
} from 'lucide-react';
import {
  TRANSPORT_LOGISTICS_METHODS,
  calculateFreightCost,
  type TransportLogisticsMethod,
  type FreightCostBreakdown,
} from '@/lib/transportLogistics';
import {
  FleetVehicle,
  FleetTrailer,
  getFleetVehicles,
  getFleetTrailers,
  getTravelExpenseSettings,
  calculateFleetTrip,
  type FleetTripCalculation,
} from '@/lib/fleetLogistics';
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
  { city: 'Nova Serrana - MG', km: 45, hub: 'Divinópolis' },
  { city: 'Itaúna - MG', km: 42, hub: 'Divinópolis' },
  { city: 'Pará de Minas - MG', km: 58, hub: 'Divinópolis' },
  { city: 'Bom Despacho - MG', km: 82, hub: 'Divinópolis' },
  { city: 'Belo Horizonte - MG', km: 125, hub: 'Divinópolis' },
  { city: 'Betim / Contagem - MG', km: 95, hub: 'Divinópolis' },
  { city: 'Sete Lagoas - MG', km: 165, hub: 'Divinópolis' },
  { city: 'Bocaiúva - MG', km: 48, hub: 'Montes Claros' },
  { city: 'Janaúba - MG', km: 132, hub: 'Montes Claros' },
  { city: 'Pirapora - MG', km: 165, hub: 'Montes Claros' },
  { city: 'Salinas - MG', km: 218, hub: 'Montes Claros' },
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

  // Modo: 'frota_propria' (Recomendado/Padrão da loja) ou 'transportadora'
  const [calcMode, setCalcMode] = useState<'frota_propria' | 'transportadora'>('frota_propria');

  const [destinationCity, setDestinationCity] = useState(initialDestinationCity || 'Nova Serrana - MG');
  const [roadKm, setRoadKm] = useState<number>(initialKm || 45);
  const [vehicleCount, setVehicleCount] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  // Estados de Frota Própria
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [fleetTrailers, setFleetTrailers] = useState<FleetTrailer[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedTrailerId, setSelectedTrailerId] = useState<string>('carretinha_3');
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(true);
  const [crewMembers, setCrewMembers] = useState<number>(1); // 1 motorista ou 2 (motorista + ajudante)
  const [profitMargin, setProfitMargin] = useState<number>(20); // 20% de margem comercial

  // Estados de Transportadora Terceira
  const [selectedMethodId, setSelectedMethodId] = useState<string>('cegonha_coletiva');

  // Carrega frotas
  useEffect(() => {
    if (open) {
      const vList = getFleetVehicles();
      const tList = getFleetTrailers();
      setFleetVehicles(vList);
      setFleetTrailers(tList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }

      if (initialDestinationCity) {
        setDestinationCity(initialDestinationCity);
      }
      if (typeof initialKm === 'number' && !isNaN(initialKm)) {
        setRoadKm(initialKm);
      }
      setVehicleCount(1);
    }
  }, [open, initialDestinationCity, initialKm]);

  // Seleciona preset de cidade
  const handleSelectPreset = (preset: typeof PRESET_CITIES[0]) => {
    setDestinationCity(preset.city);
    setRoadKm(preset.km);
  };

  // Cálculo da Frota Própria
  const fleetTripCalculation: FleetTripCalculation | null = useMemo(() => {
    if (!fleetVehicles.length) return null;
    const vId = selectedVehicleId || fleetVehicles[0].id;

    return calculateFleetTrip({
      vehicleId: vId,
      trailerId: selectedTrailerId,
      distanciaIdaKm: roadKm,
      idaEVolta: isRoundTrip,
      quantidadeMotos: vehicleCount,
      membrosEquipe: crewMembers,
      margemLucroPercentual: profitMargin,
    });
  }, [
    fleetVehicles,
    selectedVehicleId,
    selectedTrailerId,
    roadKm,
    isRoundTrip,
    vehicleCount,
    crewMembers,
    profitMargin,
  ]);

  // Cálculo de Transportadoras Terceiras
  const carrierSimulations: FreightCostBreakdown[] = useMemo(() => {
    return TRANSPORT_LOGISTICS_METHODS.map((method) =>
      calculateFreightCost(method.id, roadKm, vehicleCount)
    );
  }, [roadKm, vehicleCount]);

  const activeCarrierSim = useMemo(() => {
    return carrierSimulations.find((s) => s.methodId === selectedMethodId) || carrierSimulations[0];
  }, [carrierSimulations, selectedMethodId]);

  const activeCarrierDef = useMemo(() => {
    return TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === selectedMethodId) || TRANSPORT_LOGISTICS_METHODS[0];
  }, [selectedMethodId]);

  // Mensagem pronta para envio ao cliente via WhatsApp
  const whatsappQuoteText = useMemo(() => {
    const custName = customerName ? `Olá, ${customerName}! ` : 'Olá! ';

    if (calcMode === 'frota_propria' && fleetTripCalculation) {
      const ft = fleetTripCalculation;
      const configTransporte = ft.trailer
        ? `${ft.vehicle.nome} + ${ft.trailer.nome} (Até ${ft.capacidadeMaximaTotal} motos)`
        : `${ft.vehicle.nome} (Caçamba - Até 2 motos)`;

      return `${custName}Segue a simulação oficial de entrega da sua *${vehicleModel}* pela logística própria da Pixel Motors / Shineray:

*Destino:* ${destinationCity || 'Endereço Indicado'}
*Distância:* ${roadKm} km (${ft.idaEVolta ? 'Trajeto Ida e Volta Oficial' : 'Ida Direta'})
*Tempo Estimado de Viagem:* ${ft.tempoViagemFormatado}
*Veículo da Loja:* ${configTransporte}
*Equipe:* ${ft.membrosEquipe > 1 ? 'Motorista + Ajudante para Descarregamento' : 'Motorista Especializado'}
*Seguro & Vistoria:* 100% Coberto com PDI Técnico Presencial

*Valor do Frete:* ${ft.formatados.precoSugeridoPorMoto} por moto
${ft.quantidadeMotos > 1 ? `*Lote Total (${ft.quantidadeMotos} motos):* ${ft.formatados.precoSugeridoTotal}\n` : ''}
Qualquer dúvida estamos à disposição para agendar a data e horário da entrega!`;
    }

    return `${custName}Segue a simulação oficial de logística e entrega da sua *${vehicleModel}* pela Pixel Motors:

*Destino:* ${destinationCity || 'Endereço Indicado'}
*Distância Rodoviária Estimada:* ${roadKm} km
*Modalidade:* ${activeCarrierDef.nome}
*Prazo de Entrega:* ${activeCarrierDef.prazoFormatado}
*Seguro de Carga:* ${activeCarrierDef.seguroCarga} (100% Coberto)
*Rastreamento:* ${activeCarrierDef.rastreamentoGps ? 'GPS Ativo em Tempo Real' : 'Acompanhamento pela Loja'}

*Valor do Frete:* ${activeCarrierSim.formattedTotal}
${vehicleCount > 1 ? `*Lote:* ${vehicleCount} motocicletas com desconto especial aplicado.\n` : ''}
Qualquer dúvida estamos à disposição para agendar a expedição do seu veículo!`;
  }, [
    customerName,
    vehicleModel,
    destinationCity,
    roadKm,
    calcMode,
    fleetTripCalculation,
    activeCarrierDef,
    activeCarrierSim,
    vehicleCount,
  ]);

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
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                Simulador de Frete & Logística da Loja
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Carros &amp; Carretinhas
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cálculo de frete em carros da loja com carretinhas (3 ou 6 motos), consumo km/L e paradas para alimentação e pernoite.
              </DialogDescription>
              {(customerName || (vehicleModel && vehicleModel !== 'Motocicleta 0km')) && (
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border/50">
                  {customerName && (
                    <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      Cliente: <strong>{customerName}</strong>
                    </span>
                  )}
                  {vehicleModel && (
                    <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                      Modelo: <strong>{vehicleModel}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* SELETOR DE MODO: FROTA PRÓPRIA (CARROS DA LOJA) VS TRANSPORTADORAS */}
          <div className="flex items-center justify-center p-1 rounded-xl bg-muted/70 border border-border/60">
            <button
              type="button"
              onClick={() => setCalcMode('frota_propria')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2',
                calcMode === 'frota_propria'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Car className="w-4 h-4" />
              Frete Próprio da Loja (Carro + Carretinhas)
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 py-0">
                Padrão da Loja
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setCalcMode('transportadora')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2',
                calcMode === 'transportadora'
                  ? 'bg-card text-primary shadow-sm border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Truck className="w-4 h-4" />
              Transportadoras Externas (Cegonha / Guincho VIP)
            </button>
          </div>

          {/* DADOS GERAIS: DESTINO, DISTÂNCIA E QUANTIDADE DE MOTOS */}
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
                className="h-8 text-xs font-medium"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                Distância de Ida (Km)
              </Label>
              <Input
                type="number"
                min={0}
                max={2500}
                value={roadKm}
                onChange={(e) => setRoadKm(Math.max(0, Number(e.target.value) || 0))}
                className="h-8 text-xs font-bold"
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
                className="h-8 text-xs font-bold"
              />
            </div>

            {/* Atalhos de Cidades Rápidas */}
            <div className="sm:col-span-12 pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                Atalhos Frequentes de Rotas:
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

          {/* ======================================================== */}
          {/* MODO 1: FRETE PRÓPRIO DA LOJA (CARROS, CARRETINHAS E DIÁRIAS) */}
          {/* ======================================================== */}
          {calcMode === 'frota_propria' && fleetTripCalculation && (
            <div className="space-y-4">
              {/* Configuração do Veículo da Loja e Reboque */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs">
                {/* 1. Escolha do Carro */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-emerald-600" />
                    Carro da Loja (Frota)
                  </Label>
                  <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <SelectValue placeholder="Selecione o carro" />
                    </SelectTrigger>
                    <SelectContent>
                      {fleetVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.nome} ({v.placa})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground block">
                    {fleetTripCalculation.vehicle.tipoCombustivel.toUpperCase()} a R$ {fleetTripCalculation.precoLitroCombustivel.toFixed(2)}/L
                  </span>
                </div>

                {/* 2. Reboque / Carretinha */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-primary" />
                    Reboque / Carretinha
                  </Label>
                  <Select value={selectedTrailerId} onValueChange={setSelectedTrailerId}>
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <SelectValue placeholder="Selecione o reboque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma" className="text-xs">
                        🚗 Apenas Carro (Leva 2 motos)
                      </SelectItem>
                      {fleetTrailers.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          🚗➕ {t.nome} (Total: {2 + t.capacidadeMotos} motos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground block">
                    Capacidade total: <strong>{fleetTripCalculation.capacidadeMaximaTotal} motos</strong> (2 carro {fleetTripCalculation.trailer ? `+ ${fleetTripCalculation.trailer.capacidadeMotos} carreta` : ''})
                  </span>
                </div>

                {/* 3. Trajeto (Ida e Volta vs Só Ida) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                    Trajeto do Carro
                  </Label>
                  <Select
                    value={isRoundTrip ? 'ida_e_volta' : 'so_ida'}
                    onValueChange={(v) => setIsRoundTrip(v === 'ida_e_volta')}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ida_e_volta" className="text-xs">
                        🔁 Ida e Volta ({roadKm * 2} km reais)
                      </SelectItem>
                      <SelectItem value="so_ida" className="text-xs">
                        ➡️ Apenas Ida ({roadKm} km)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                    {fleetTripCalculation.tempoViagemFormatado} estimado de estrada
                  </span>
                </div>

                {/* 4. Equipe de Entrega */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    Equipe da Viagem
                  </Label>
                  <Select
                    value={String(crewMembers)}
                    onValueChange={(v) => setCrewMembers(Number(v) || 1)}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">
                        👤 1 Motorista
                      </SelectItem>
                      <SelectItem value="2" className="text-xs">
                        👥 Motorista + Ajudante
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground block">
                    Diárias multiplicadas por integrante
                  </span>
                </div>
              </div>

              {/* Alerta de Capacidade se Exceder */}
              {fleetTripCalculation.capacidadeExcedida && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-2.5 text-xs text-destructive font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div>
                    <strong>Capacidade da Composição Excedida:</strong> Você precisa transportar {fleetTripCalculation.quantidadeMotos} motos, mas esta configuração suporta no máximo {fleetTripCalculation.capacidadeMaximaTotal} motos (2 na caçamba {fleetTripCalculation.trailer ? `+ ${fleetTripCalculation.trailer.capacidadeMotos} na carretinha` : ''}). Troque para a <strong>Carretinha de 6 Motos</strong> ou agende duas viagens.
                  </div>
                </div>
              )}

              {/* Detalhamento de Custos Operacionais e Paradas */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Cálculo de Custos Reais da Viagem
                    </span>
                    <h3 className="text-sm font-bold text-foreground">
                      {fleetTripCalculation.vehicle.nome} {fleetTripCalculation.trailer ? `+ ${fleetTripCalculation.trailer.nome}` : '(Caçamba)'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {fleetTripCalculation.distanciaTotalKm} km totais rodados | Tempo aproximado de viagem: {fleetTripCalculation.tempoViagemFormatado}
                    </p>
                  </div>

                  <div className="text-right sm:shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Frete Cobrado por Moto
                    </span>
                    <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-display">
                      {fleetTripCalculation.formatados.precoSugeridoPorMoto}
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      Total da Viagem: {fleetTripCalculation.formatados.precoSugeridoTotal} ({fleetTripCalculation.quantidadeMotos} moto{fleetTripCalculation.quantidadeMotos > 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                {/* Grade de Discriminação de Custos (Combustível, Alimentação, Hotel e Desgaste) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* Combustível */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-1.5 text-amber-600 font-bold mb-1">
                      <Fuel className="w-3.5 h-3.5" />
                      <span>Combustível</span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground block">
                      {fleetTripCalculation.formatados.combustivel}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {fleetTripCalculation.litrosCombustivelTotal}L a {fleetTripCalculation.consumoMedioKmPorLitro.toFixed(1)} km/L
                    </span>
                  </div>

                  {/* Refeições e Alimentação */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold mb-1">
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Refeições</span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground block">
                      {fleetTripCalculation.formatados.refeicoes}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {fleetTripCalculation.paradas.cafeManha.necessarias && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">Café</Badge>
                      )}
                      {fleetTripCalculation.paradas.almoco.necessarias && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1 text-emerald-700 bg-emerald-500/10">Almoço</Badge>
                      )}
                      {fleetTripCalculation.paradas.janta.necessarias && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1 text-orange-700 bg-orange-500/10">Janta</Badge>
                      )}
                      {!fleetTripCalculation.paradas.almoco.necessarias && !fleetTripCalculation.paradas.janta.necessarias && (
                        <span className="text-[10px] text-muted-foreground">Sem paradas</span>
                      )}
                    </div>
                  </div>

                  {/* Pernoite / Parada para Dormir */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-1.5 text-purple-600 font-bold mb-1">
                      <Moon className="w-3.5 h-3.5" />
                      <span>Parada Dormir / Hotel</span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground block">
                      {fleetTripCalculation.formatados.hotel}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {fleetTripCalculation.paradas.hotel.necessarias
                        ? `${fleetTripCalculation.paradas.hotel.quantidade} diária(s) hotel`
                        : 'Bate-e-volta (Sem hotel)'}
                    </span>
                  </div>

                  {/* Manutenção & Pedágio */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-1.5 text-blue-600 font-bold mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Desgaste &amp; Pedágio</span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground block">
                      {fleetTripCalculation.formatados.manutencaoEPedagio}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Pneus, óleo e rodovias
                    </span>
                  </div>
                </div>

                {/* Resumo da Memória de Cálculo Operacional */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <strong>Custo Operacional Líquido:</strong> {fleetTripCalculation.formatados.totalOperacional} ({fleetTripCalculation.formatados.custoPorMoto}/moto) | Margem comercial aplicada: <strong>{profitMargin}%</strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]">Ajustar Margem:</span>
                    {[0, 15, 20, 30].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setProfitMargin(m)}
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors',
                          profitMargin === m
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border/60 hover:bg-muted'
                        )}
                      >
                        {m}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ações de Fechamento Comercial */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyQuote}
                    className="w-full sm:w-auto gap-2 text-xs font-semibold h-9"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Cotação Copiada!' : 'Copiar Cotação da Frota p/ WhatsApp'}
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
          )}

          {/* ======================================================== */}
          {/* MODO 2: TRANSPORTADORAS EXTERNAS (CEGONHA / GUINCHO VIP) */}
          {/* ======================================================== */}
          {calcMode === 'transportadora' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {carrierSimulations.map((sim) => {
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

              {/* Detalhe da transportadora ativa */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                      Modalidade Terceirizada
                    </span>
                    <h3 className="text-sm font-bold text-foreground">
                      {activeCarrierDef.nome}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {activeCarrierDef.descricao}
                    </p>
                  </div>
                  <div className="text-right sm:shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Total do Frete
                    </span>
                    <span className="text-xl font-extrabold text-primary font-display">
                      {activeCarrierSim.formattedTotal}
                    </span>
                  </div>
                </div>

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
                    className="w-full sm:w-auto gap-2 text-xs font-bold h-9 bg-primary text-primary-foreground shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Confirmar Frete na Proposta
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
