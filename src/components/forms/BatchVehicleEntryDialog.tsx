import { useState } from 'react';
import { 
  Boxes, 
  Plus, 
  Trash2, 
  Car, 
  Bike, 
  Sparkles, 
  Check, 
  Loader2, 
  DollarSign, 
  Building2 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStores } from '@/hooks/useStores';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { saveVehiclesToCache, type Vehicle } from '@/hooks/useVehicles';
import { 
  SHINERAY_OFFICIAL_LINEUP, 
  MULTIBRAND_MOTOS, 
  SHINERAY_FACTORY_COLORS 
} from '@/lib/dealershipCatalog';
import { maskCurrency, parseCurrency } from '@/lib/masks';

interface BatchVehicleEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatchVehicleEntryDialog({ open, onOpenChange }: BatchVehicleEntryDialogProps) {
  const { data: stores } = useStores();
  const { userStore, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [brand, setBrand] = useState('SHINERAY');
  const [model, setModel] = useState(SHINERAY_OFFICIAL_LINEUP[0].model);
  const [vehicleType, setVehicleType] = useState<'moto' | 'carro'>('moto');
  const [year, setYear] = useState(new Date().getFullYear());
  const [color, setColor] = useState('Preto Fosco');
  const [storeId, setStoreId] = useState(userStore?.id || '');
  const [costPrice, setCostPrice] = useState('R$ 8.200,00');
  const [salePrice, setSalePrice] = useState('R$ 9.490,00');
  const [chassisListRaw, setChassisListRaw] = useState('');
  const [electricQtyWithoutChassis, setElectricQtyWithoutChassis] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detecta se o modelo selecionado é elétrico
  const isElectricModel =
    model.toUpperCase().includes('ELÉTRIC') ||
    model.toUpperCase().includes('ELETRIC') ||
    model.toUpperCase().includes('SCOOTER') ||
    model.toUpperCase().includes('SHE S');

  // Lista de chassis/números de moto parseada da caixa de texto
  const parsedChassisList = chassisListRaw
    .split(/[\n,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length >= (isElectricModel ? 3 : 5));

  // Lista efetiva: se informado texto de chassis, usa o texto; se elétrica e quantidade definida sem chassi, gera placeholders
  const effectiveChassisList =
    parsedChassisList.length > 0
      ? parsedChassisList
      : isElectricModel && electricQtyWithoutChassis > 0
      ? Array.from({ length: electricQtyWithoutChassis }, () => 'A DEFINIR NA VENDA')
      : [];

  const handleModelSelect = (selectedModel: string) => {
    setModel(selectedModel);
    const found = SHINERAY_OFFICIAL_LINEUP.find((m) => m.model === selectedModel);
    if (found?.suggested_price) {
      setSalePrice(maskCurrency(String(found.suggested_price * 100)));
    }
  };

  const handleSubmit = async () => {
    if (!storeId && !userStore?.id) {
      alert('Selecione a loja de destino.');
      return;
    }
    if (effectiveChassisList.length === 0) {
      alert(
        isElectricModel
          ? 'Informe a quantidade de motos elétricas sem chassi ou cole os números de moto/motor.'
          : 'Informe ou cole ao menos um número de chassi válido.'
      );
      return;
    }

    setIsSubmitting(true);
    const cost = parseCurrency(costPrice);
    const sale = parseCurrency(salePrice);
    const finalStoreId = storeId || userStore?.id;

    try {
      const inserts = effectiveChassisList.map((chassis) => ({
        brand: brand.toUpperCase(),
        model: model.toUpperCase(),
        vehicle_type: vehicleType,
        year: Number(year),
        manufacture_year: Number(year),
        color: color.toUpperCase(),
        chassis: chassis,
        fuel_type: isElectricModel ? 'eletrico' : 'gasolina',
        transmission: isElectricModel ? 'automatico' : 'manual',
        engine_cc: isElectricModel ? 0 : 125,
        cost_price: cost > 0 ? cost : null,
        purchase_price: cost > 0 ? cost : null,
        sale_price: sale > 0 ? sale : null,
        status: 'disponivel',
        store_id: finalStoreId,
        condition: 'novo',
        notes: isElectricModel
          ? `Entrada em lote moto elétrica (${brand}) - Nº da Moto/Motor: ${chassis}`
          : `Entrada em lote concessionária (${brand}) - NF Remessa Fábrica.`,
      }));

      // Cache imediato para visualização garantida em todas as sessões
      const cachedVehicles: Vehicle[] = inserts.map((ins) => ({
        id: crypto.randomUUID(),
        store_id: ins.store_id || 'store-divinopolis',
        reseller_id: null,
        brand: ins.brand,
        model: ins.model,
        year: ins.year,
        manufacture_year: ins.year,
        color: ins.color,
        plate: null,
        chassis: ins.chassis,
        renavam: null,
        mileage: 0,
        fuel_type: 'gasolina',
        transmission: 'manual',
        purchase_price: ins.purchase_price,
        sale_price: ins.sale_price,
        status: 'disponivel',
        images: null,
        notes: ins.notes,
        vehicle_type: ins.vehicle_type,
        engine_cc: 125,
        warranty_months: 12,
        revision_period_months: 6,
        revision_period_km: 1000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      saveVehiclesToCache(cachedVehicles);

      try {
        const { error } = await supabase.from('vehicles').insert(inserts as any);
        if (error) {
          console.warn('Persistência remota do lote falhou, salvo localmente:', error.message);
        }
      } catch (e) {
        console.warn('Erro ao inserir lote no Supabase:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-global-metrics'] });

      toast({
        title: 'Lote de estoque cadastrado com sucesso!',
        description: `${inserts.length} unidades de ${brand} ${model} foram inseridas no estoque.`,
      });

      setChassisListRaw('');
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar lote',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Entrada de Lote de Estoque (Concessionária)
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">
                  Múltiplos Chassis
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cadastre remessas de fábrica e lotes de várias motos/veículos idênticos colando os números de chassi.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Seletor Rápido de Marca */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/40 border border-border/60">
            <Button
              type="button"
              size="sm"
              variant={brand === 'SHINERAY' ? 'default' : 'ghost'}
              onClick={() => {
                setBrand('SHINERAY');
                setVehicleType('moto');
                setModel(SHINERAY_OFFICIAL_LINEUP[0].model);
              }}
              className="text-xs flex-1 gap-1.5 h-8 font-semibold"
            >
              <Bike className="w-3.5 h-3.5" />
              Shineray Oficial
            </Button>

            <Button
              type="button"
              size="sm"
              variant={brand === 'HONDA' ? 'default' : 'ghost'}
              onClick={() => {
                setBrand('HONDA');
                setVehicleType('moto');
                setModel(MULTIBRAND_MOTOS[0].model);
              }}
              className="text-xs flex-1 gap-1.5 h-8 font-semibold"
            >
              <Bike className="w-3.5 h-3.5" />
              Honda Motos
            </Button>

            <Button
              type="button"
              size="sm"
              variant={brand === 'MULTIMARCAS' ? 'default' : 'ghost'}
              onClick={() => {
                setBrand('MULTIMARCAS');
              }}
              className="text-xs flex-1 gap-1.5 h-8 font-semibold"
            >
              <Car className="w-3.5 h-3.5" />
              Multimarcas Geral
            </Button>
          </div>

          {/* Dados do Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Modelo da Moto/Veículo *</Label>
              {brand === 'SHINERAY' ? (
                <Select value={model} onValueChange={handleModelSelect}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHINERAY_OFFICIAL_LINEUP.map((m) => (
                      <SelectItem key={m.model} value={m.model} className="text-xs">
                        {m.model} ({m.engine_cc ? `${m.engine_cc}cc` : 'Elétrica'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value.toUpperCase())}
                  placeholder="Ex: CG 160 FAN"
                  className="h-8 text-xs"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Cor de Fábrica *</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHINERAY_FACTORY_COLORS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ano Fabricação/Modelo *</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Loja e Valores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Loja / Filial de Entrada *</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores?.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Custo Unitário (R$)</Label>
              <Input
                value={costPrice}
                onChange={(e) => setCostPrice(maskCurrency(e.target.value))}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Preço de Venda Unitário (R$)</Label>
              <Input
                value={salePrice}
                onChange={(e) => setSalePrice(maskCurrency(e.target.value))}
                className="h-8 text-xs font-bold text-primary"
              />
            </div>
          </div>

          {/* Opção Rápida para Elétricas Sem Chassi */}
          {isElectricModel && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Cadastrar Elétricas Sem Chassi
                </p>
                <p className="text-[11px] text-muted-foreground">
                  O chassi ou motor será inserido pelo vendedor no momento da venda de cada unidade.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Label className="text-xs font-semibold whitespace-nowrap">Qtd de motos:</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={electricQtyWithoutChassis || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setElectricQtyWithoutChassis(val);
                    if (val > 0) setChassisListRaw('');
                  }}
                  className="h-8 w-20 text-xs font-bold text-center bg-background"
                />
              </div>
            </div>
          )}

          {/* Lista de Chassis ou Números de Moto em Massa */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                {isElectricModel
                  ? 'Ou cole os Números da Moto / Motor (1 por linha ou separados por vírgula):'
                  : 'Lista de Números de Chassi (Cole da NF ou digite 1 por linha) *'}
              </Label>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {effectiveChassisList.length} {isElectricModel ? 'moto(s) elétrica(s)' : `chassi${effectiveChassisList.length > 1 ? 's' : ''}`}
              </Badge>
            </div>
            <Textarea
              placeholder={
                isElectricModel
                  ? `Opcional. Se tiver os números agora, cole aqui (ex: QS60V2000W001). Caso contrário, use o campo de quantidade acima para cadastrar sem chassi e preencher na venda.`
                  : `Cole aqui os números de chassi, por exemplo:\n9F2W125A0P000101\n9F2W125A0P000102\n9F2W125A0P000103\n...`
              }
              value={chassisListRaw}
              onChange={(e) => {
                setChassisListRaw(e.target.value);
                if (e.target.value.trim().length > 0) {
                  setElectricQtyWithoutChassis(0);
                }
              }}
              className="font-mono text-xs h-28 resize-none bg-background uppercase"
            />
            <p className="text-[10px] text-muted-foreground">
              {isElectricModel
                ? `Total a ser cadastrado: ${effectiveChassisList.length} unidade(s). ${effectiveChassisList.some(c => c.includes('DEFINIR')) ? 'As unidades sem chassi serão identificadas para preenchimento na venda.' : ''}`
                : `Você pode separar por linha, vírgula ou espaço. O sistema criará ${effectiveChassisList.length || 0} veículos idênticos no estoque de uma só vez.`}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting || effectiveChassisList.length === 0}
            onClick={handleSubmit}
            className="text-xs gap-1.5 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Cadastrando Lote...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Cadastrar {effectiveChassisList.length} Unidades
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
