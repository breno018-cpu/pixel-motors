import { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Check,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Bike,
  BatteryCharging,
  Droplets,
  Zap,
  Gauge,
  Sparkles,
  FileCheck,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PdiItem {
  id: string;
  category: 'bateria' | 'fluidos' | 'torque' | 'eletrica' | 'pneus' | 'estetica' | 'teste';
  label: string;
  hint: string;
  checked: boolean;
}

const DEFAULT_PDI_ITEMS: PdiItem[] = [
  // Bateria
  { id: 'bat_1', category: 'bateria', label: 'Ativação & Carga Inicial da Bateria', hint: 'Solução ativada, selada e teste de voltagem mínima 12.6V', checked: true },
  { id: 'bat_2', category: 'bateria', label: 'Aperto Firme dos Terminais (+) e (-)', hint: 'Sem folga nos bornes e graxa protetora aplicada', checked: true },
  // Fluidos
  { id: 'flu_1', category: 'fluidos', label: 'Nível e Viscosidade do Óleo de Motor', hint: 'Conferência na vareta/visor com moto em nível plano', checked: true },
  { id: 'flu_2', category: 'fluidos', label: 'Nível do Fluido de Freio Hidráulico (DOT 4)', hint: 'Reservatórios dianteiro e traseiro checados', checked: true },
  // Torque e Aperto
  { id: 'tor_1', category: 'torque', label: 'Torque dos Eixos de Roda Dianteiro e Traseiro', hint: 'Aperto conforme especificação do manual de serviço', checked: true },
  { id: 'tor_2', category: 'torque', label: 'Mesa de Direção & Parafusos do Guidão', hint: 'Sem folga no rolamento cônico da coluna e fixação 100%', checked: true },
  { id: 'tor_3', category: 'torque', label: 'Suportes de Motor & Fixação do Escapamento', hint: 'Reaperto preventivo de fábrica contra vibração', checked: true },
  // Elétrica
  { id: 'ele_1', category: 'eletrica', label: 'Iluminação Completa (Farol, Setas, Lanterna e Freio)', hint: 'Lâmpadas/LEDs testados em funcionamento', checked: true },
  { id: 'ele_2', category: 'eletrica', label: 'Painel Digital / LCD, Marcador de Marcha e Velocímetro', hint: 'Hodômetro zerado e luzes-espia operantes', checked: true },
  { id: 'ele_3', category: 'eletrica', label: 'Buzina, Interruptor de Neutro e Sensor de Cavalete', hint: 'Corte de ignição de segurança funcional', checked: true },
  // Pneus e Rodas
  { id: 'pne_1', category: 'pneus', label: 'Calibragem de Pneus Conforme Manual', hint: 'Dianteiro (28 PSI) / Traseiro (32 PSI)', checked: true },
  { id: 'pne_2', category: 'pneus', label: 'Alinhamento da Roda Traseira & Tensão da Corrente', hint: 'Folga da relação entre 20mm e 30mm lubrificada', checked: true },
  // Estética e Transporte
  { id: 'est_1', category: 'estetica', label: 'Inspeção de Pintura e Carenagens (Sem Riscos de Cegonha)', hint: 'Verificação estética minuciosa contra avarias de frete', checked: true },
  { id: 'est_2', category: 'estetica', label: 'Kit de Ferramentas de Bordo & Par de Espelhos Retrovisores', hint: 'Retrovisores instalados e regulados', checked: true },
  // Teste Dinâmico
  { id: 'din_1', category: 'teste', label: 'Teste de Partida Elétrica e Pedal', hint: 'Acionamento instantâneo a frio e a quente', checked: true },
  { id: 'din_2', category: 'teste', label: 'Funcionamento da Marcha Lenta & Resposta do Acelerador', hint: 'Sem engasgos, marcha lenta estável a 1.400 RPM', checked: true },
  { id: 'din_3', category: 'teste', label: 'Eficiência de Frenagem Dianteira e Traseira', hint: 'Manetes e pedal firmes, sem ar no circuito', checked: true },
];

export function PdiInspectionPanel() {
  const { toast } = useToast();
  const [model, setModel] = useState('SHINERAY SHI 175');
  const [chassis, setChassis] = useState('');
  const [color, setColor] = useState('Preto Fosco');
  const [mechanicName, setMechanicName] = useState('Chefe de PDI & Oficina');
  const [items, setItems] = useState<PdiItem[]>(DEFAULT_PDI_ITEMS);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const progressPct = Math.round((checkedCount / items.length) * 100);

  const handlePrintPdi = () => {
    window.print();
  };

  const handleSavePdi = () => {
    if (!chassis.trim()) {
      toast({
        title: 'Informe o chassi da moto',
        description: 'Digite o número de chassi de 17 caracteres para vincular este laudo de PDI.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Laudo PDI Aprovado e Emitido!',
      description: `Moto ${model} (Chassi: ${chassis}) liberada para o showroom com 100% dos itens verificados.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header do PDI */}
      <Card className="rounded-3xl border shadow-sm bg-gradient-to-r from-card via-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-xs uppercase px-2.5 py-0.5">
                  Vistoria Técnica de Fábrica
                </Badge>
                <Badge variant="secondary" className="font-semibold text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  PDI - Pre-Delivery Inspection
                </Badge>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <Wrench className="w-6 h-6 text-primary" />
                Checklist Oficial de Entrega & Oficina (PDI)
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Inspeção minuciosa dos 17 pontos vitais obrigatórios antes de qualquer veículo 0km entrar no showroom ou ser entregue ao cliente final. Evite retrabalhos, garanta segurança mecânica e proteja a garantia de fábrica.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-center">
              <div className="bg-card border rounded-2xl p-3 text-right shadow-sm">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                  Conformidade PDI
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {progressPct}%
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {checkedCount} de {items.length} itens conformes
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário do Veículo em PDI */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Bike className="w-4 h-4 text-primary" />
            Dados do Veículo 0km Inspecionado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Modelo da Moto</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: SHI 175 EFI"
                className="h-10 text-xs font-semibold rounded-xl bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Número do Chassi (VIN)</label>
              <Input
                value={chassis}
                onChange={(e) => setChassis(e.target.value.toUpperCase())}
                placeholder="Ex: 99HSHF175TS001234"
                className="h-10 text-xs font-mono font-bold uppercase rounded-xl bg-background"
                maxLength={17}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Cor do Veículo</label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Ex: Preto Fosco"
                className="h-10 text-xs font-semibold rounded-xl bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">Mecânico Responsável</label>
              <Input
                value={mechanicName}
                onChange={(e) => setMechanicName(e.target.value)}
                placeholder="Nome do mecânico"
                className="h-10 text-xs font-semibold rounded-xl bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Interativo dos Itens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Itens de Vistoria Obrigatória
          </h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setItems((prev) => prev.map((i) => ({ ...i, checked: true })))}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Marcar Todos
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setItems((prev) => prev.map((i) => ({ ...i, checked: false })))}
              className="h-8 text-xs font-semibold rounded-xl"
            >
              Desmarcar Todos
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={cn(
                'p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none',
                item.checked
                  ? 'bg-card border-emerald-500/40 hover:border-emerald-500/60 shadow-xs'
                  : 'bg-muted/20 border-border/70 hover:bg-card hover:border-primary/30'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-colors',
                  item.checked
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'border-2 border-muted-foreground/40 text-transparent'
                )}
              >
                {item.checked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </div>
              <div className="space-y-0.5 flex-1">
                <span className={cn('text-xs font-bold block', item.checked ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.label}
                </span>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {item.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações de Emissão */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t">
        <Button
          variant="outline"
          onClick={handlePrintPdi}
          className="h-10 gap-2 font-bold text-xs rounded-xl"
        >
          <Printer className="w-4 h-4 text-primary" />
          Imprimir Certificado de PDI
        </Button>
        <Button
          onClick={handleSavePdi}
          className="h-10 gap-2 font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md shadow-primary/20"
        >
          <CheckCircle2 className="w-4 h-4" />
          Aprovar PDI & Liberar para Showroom
        </Button>
      </div>
    </div>
  );
}
