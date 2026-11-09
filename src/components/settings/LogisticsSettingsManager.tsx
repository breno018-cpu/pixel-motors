import { useState } from 'react';
import {
  Truck,
  ShieldCheck,
  MapPin,
  Clock,
  DollarSign,
  PackageCheck,
  Navigation,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Route,
  UserCheck,
  Building2,
  Boxes,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  TRANSPORT_LOGISTICS_METHODS,
  calculateFreightCost,
  type TransportLogisticsMethod,
} from '@/lib/transportLogistics';

export function LogisticsSettingsManager() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<TransportLogisticsMethod[]>(TRANSPORT_LOGISTICS_METHODS);
  const [testKm, setTestKm] = useState<number>(180);
  const [testVehicles, setTestVehicles] = useState<number>(1);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('cegonha_coletiva');

  const selectedMethod = methods.find((m) => m.id === selectedMethodId) || methods[0];
  const testSimulation = calculateFreightCost(selectedMethodId, testKm, testVehicles);

  const handleUpdateTariff = (id: string, newRate: number) => {
    setMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, tarifaBaseKm: Math.max(0, newRate) } : m))
    );
    toast({
      title: 'Tarifa atualizada!',
      description: `Tarifa ajustada para R$ ${newRate.toFixed(2)}/km na modalidade.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. BANNER DO CARGO: COORDENADOR DE LOGÍSTICA & TRANSPORTE */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card rounded-3xl shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-primary/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold shadow-xs shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 flex-wrap">
                  Gestão Central de Logística, Frotas & Transporte
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                    Operação Integrada
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Controle de métodos de transporte, carretas cegonha, guinchos dedicados e rotas interlojas.
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary py-1 px-2.5">
              Hubs: Divinópolis ⇄ Montes Claros
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Cartão de Identificação do Cargo Oficial */}
          <div className="p-4 rounded-2xl bg-muted/40 border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-foreground">
                  Cargo Oficial: Coordenador de Logística & Transporte de Frotas
                </span>
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  CLT • CBO 4141-10
                </Badge>
              </div>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                Salário Base Sugerido: R$ 3.200,00 + Bônus de Entrega
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="space-y-1">
                <strong className="text-foreground block flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Atribuições e O que Pode Fazer:
                </strong>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                  <li>Planejar, roteirizar e autorizar saídas de caminhão cegonha e reboques dedicados</li>
                  <li>Simular custos rodoviários por quilômetro e emitir romaneios de frete</li>
                  <li>Controlar notas fiscais de remessa de motos e manifestos de carga oficial</li>
                  <li>Auditar o checklist PDI de saída para prevenir avarias e riscos de frete</li>
                </ul>
              </div>

              <div className="space-y-1">
                <strong className="text-foreground block flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Blindagem Operacional e Metas de Entrega:
                </strong>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                  <li>Meta de Zero Sinistros em Transporte e preservação 100% da integridade da carga</li>
                  <li>Acompanhamento de rotas em tempo real até a assinatura do termo de entrega pelo cliente</li>
                  <li>Manutenção de prazos em até 24h para frete VIP e até 7 dias para cegonha coletiva</li>
                  <li>Homologação contínua de guinchos e transportadoras credenciadas</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. SIMULADOR INSTANTÂNEO DE FRETE */}
      <Card className="rounded-3xl border shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            Simulador de Custos e Prazos por Modalidade
          </CardTitle>
          <CardDescription className="text-xs">
            Teste a fórmula de frete da concessionária calculando distância e volume de motocicletas.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Distância Rodoviária (km)</Label>
              <Input
                type="number"
                min="0"
                max="3000"
                value={testKm}
                onChange={(e) => setTestKm(Number(e.target.value))}
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Quantidade de Veículos (Lote)</Label>
              <Input
                type="number"
                min="1"
                max="25"
                value={testVehicles}
                onChange={(e) => setTestVehicles(Math.max(1, Number(e.target.value)))}
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Modalidade Selecionada</Label>
              <select
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                className="w-full h-8 text-xs font-semibold rounded-md border border-input bg-background px-2.5"
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome.split(' (')[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resultado da Simulação */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className={selectedMethod.corBadge}>{selectedMethod.destaqueBadge}</Badge>
                <span className="font-bold text-sm text-foreground">{testSimulation.methodName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Distância: <strong className="text-foreground">{testSimulation.roadKm} km</strong> • Prazo:{' '}
                <strong className="text-foreground">{testSimulation.prazoEstimado}</strong>
                {testSimulation.descontoLote > 0 && (
                  <span className="text-emerald-600 font-semibold ml-1.5">
                    (Desconto de Lote: -R$ {testSimulation.descontoLote.toFixed(2)})
                  </span>
                )}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold block">
                Valor Total Estimado
              </span>
              <span className="font-mono text-2xl font-black text-primary">
                {testSimulation.formattedTotal}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. LISTA DOS MÉTODOS DE TRANSPORTE HOMOLOGADOS */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <Boxes className="w-4 h-4 text-primary" />
          Métodos de Logística e Frete Homologados ({methods.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((method) => {
            const isSelected = selectedMethodId === method.id;

            return (
              <Card
                key={method.id}
                className={`rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  isSelected ? 'border-primary shadow-md bg-card' : 'border-border/80 bg-card hover:border-primary/40'
                }`}
              >
                <CardHeader className="pb-3 border-b bg-muted/15">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] font-bold ${method.corBadge}`}>
                          {method.destaqueBadge}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          ID: {method.id}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-sm text-foreground">{method.nome}</h4>
                      <p className="text-[11px] text-muted-foreground">{method.subtitulo}</p>
                    </div>

                    <Button
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedMethodId(method.id)}
                      className="h-7 text-xs font-semibold rounded-xl"
                    >
                      {isSelected ? 'Simulando' : 'Testar'}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-3.5 space-y-3 text-xs flex-1">
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {method.descricao}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
                    <div className="p-2 rounded-xl bg-muted/30 border">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Tarifa Base / km
                      </span>
                      <strong className="font-mono text-sm text-foreground">
                        {method.tarifaBaseKm > 0 ? `R$ ${method.tarifaBaseKm.toFixed(2)}/km` : 'Grátis (R$ 0,00)'}
                      </strong>
                    </div>

                    <div className="p-2 rounded-xl bg-muted/30 border">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Prazo Médio
                      </span>
                      <strong className="text-foreground">{method.prazoFormatado}</strong>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Capacidade de Carga:</span>
                      <strong className="text-foreground">{method.capacidadeLote}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Apólice de Seguro:</span>
                      <strong className="text-foreground truncate max-w-[180px]">{method.seguroCarga}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rastreamento GPS em Trânsito:</span>
                      <strong className={method.rastreamentoGps ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}>
                        {method.rastreamentoGps ? 'Ativo 24/7' : 'Não se aplica'}
                      </strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export default LogisticsSettingsManager;
