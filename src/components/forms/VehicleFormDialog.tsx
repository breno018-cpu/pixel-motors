import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bike, Car, Building2, DollarSign, Wrench, CheckCircle2, 
  Loader2, Sparkles, Lock, Hash, Calendar, Palette, ShieldCheck, RefreshCw, ScanLine, Zap 
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { recognizeFromChassis, resolveModelYearFromVin, extractYearFromVIN } from '@/lib/chassisRecognition';
import { BarcodeScannerDialog } from '@/components/vehicles/BarcodeScannerDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStores } from '@/hooks/useStores';
import { useCreateVehicle } from '@/hooks/useMutations';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { STANDARD_COLORS, formatPlate } from '@/lib/vehicleCatalog';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialChassis?: string;
}

export function VehicleFormDialog({ open, onOpenChange, initialChassis }: VehicleFormDialogProps) {
  const { data: stores = [] } = useStores();
  const createVehicle = useCreateVehicle();
  const { userStore } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Estados dos Campos — Inicialmente todos vazios ao cadastrar nova moto
  const [storeId, setStoreId] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<'moto' | 'carro'>('moto');
  const [chassis, setChassis] = useState<string>('');
  const [isNoChassis, setIsNoChassis] = useState<boolean>(false);
  const [brand, setBrand] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [manufactureYear, setManufactureYear] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [plate, setPlate] = useState<string>('');
  const [renavam, setRenavam] = useState<string>('');
  const [engineCc, setEngineCc] = useState<string>('');
  const [mileage, setMileage] = useState<string>('0');
  const [fuelType, setFuelType] = useState<string>('');
  const [transmission, setTransmission] = useState<string>('');
  const [warrantyMonths, setWarrantyMonths] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Controle de Bloqueio por Padrão de Chassi
  const [patternLocked, setPatternLocked] = useState<boolean>(false);
  const [chassisRecognized, setChassisRecognized] = useState<{
    matched: boolean;
    brand?: string;
    model?: string;
    year?: number | null;
  } | null>(null);
  const [isDecodingChassis, setIsDecodingChassis] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const lastDecodedVinRef = useRef<string>('');

  // Reset COMPLETO de todas as abas e campos sempre que o modal abre
  const resetForm = useCallback(() => {
    setChassis('');
    setIsNoChassis(false);
    setBrand('');
    setModel('');
    setYear('');
    setManufactureYear('');
    setColor('');
    setPlate('');
    setRenavam('');
    setEngineCc('');
    setMileage('0');
    setFuelType('');
    setTransmission('');
    setWarrantyMonths('');
    setPurchasePrice('');
    setSalePrice('');
    setNotes('');
    setVehicleType('moto');
    setPatternLocked(false);
    setChassisRecognized(null);
    lastDecodedVinRef.current = '';

    if (userStore?.id) {
      setStoreId(userStore.id);
    } else if (stores.length > 0) {
      setStoreId(stores[0].id);
    } else {
      setStoreId('store-divinopolis');
    }
  }, [userStore?.id, stores]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // Ferramenta de Análise Automática de Modelo por Chassi (VIN)
  const triggerChassisRecognition = useCallback(
    async (rawVin: string) => {
      const cleanVin = (rawVin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanVin.length < 4) {
        setChassisRecognized(null);
        setPatternLocked(false);
        return;
      }
      if (lastDecodedVinRef.current === cleanVin) return;

      setIsDecodingChassis(true);
      try {
        const [pattern, resolvedYear] = await Promise.all([
          recognizeFromChassis(cleanVin),
          resolveModelYearFromVin(cleanVin),
        ]);

        if (pattern) {
          lastDecodedVinRef.current = cleanVin;
          setBrand(pattern.brand || 'SHINERAY');
          if (pattern.model) setModel(pattern.model);
          if (pattern.vehicle_type) setVehicleType(pattern.vehicle_type);
          if (pattern.engine_cc) setEngineCc(String(pattern.engine_cc));
          if (pattern.fuel_type) setFuelType(pattern.fuel_type);
          if (pattern.transmission) setTransmission(pattern.transmission);
          if (pattern.warranty_months) setWarrantyMonths(String(pattern.warranty_months));
          if (pattern.default_sale_price) setSalePrice(String(pattern.default_sale_price));
          if (pattern.default_purchase_price) setPurchasePrice(String(pattern.default_purchase_price));

          // Resolução de Ano Modelo e Fabricação a partir do VIN
          const decodedYear = resolvedYear.year || extractYearFromVIN(cleanVin) || new Date().getFullYear();
          const decodedManufactureYear = resolvedYear.manufactureYear || decodedYear;
          setYear(String(decodedYear));
          setManufactureYear(String(decodedManufactureYear));

          // BLOQUEIA AUTOMATICAMENTE AS ESPECIFICAÇÕES TÉCNICAS E MODELO
          setPatternLocked(true);
          setChassisRecognized({
            matched: true,
            brand: pattern.brand,
            model: pattern.model,
            year: decodedYear,
          });

          toast({
            title: 'Padrão Identificado com Sucesso!',
            description: `${pattern.brand} ${pattern.model || ''} preenchido pelo padrão. Especificações bloqueadas com segurança.`,
          });
        } else {
          // Se não encontrou o padrão do modelo, mas conseguiu decodificar o ano
          const decodedYear = resolvedYear.year || extractYearFromVIN(cleanVin);
          if (decodedYear) {
            setYear(String(decodedYear));
            setManufactureYear(String(resolvedYear.manufactureYear || decodedYear));
          }
          setPatternLocked(false);
        }
      } catch (err) {
        console.error('Erro na análise de chassi:', err);
      } finally {
        setIsDecodingChassis(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (open && initialChassis) {
      const clean = initialChassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setChassis(clean);
      if (clean.length >= 4) {
        triggerChassisRecognition(clean);
      }
    }
  }, [open, initialChassis, triggerChassisRecognition]);

  const toggleNoChassis = (checked: boolean) => {
    setIsNoChassis(checked);
    if (checked) {
      setPatternLocked(false);
      setChassisRecognized(null);
      setFuelType('eletrico');
      setTransmission('automatico');
      lastDecodedVinRef.current = '';
      if (chassis.length === 17) {
        setChassis('');
      }
    }
  };

  const handleChassisChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setChassis(upper);
    if (!isNoChassis && upper.length >= 4) {
      triggerChassisRecognition(upper);
    } else if (!isNoChassis) {
      setPatternLocked(false);
      setChassisRecognized(null);
      lastDecodedVinRef.current = '';
    }
  };

  const costNum = parseFloat(purchasePrice) || 0;
  const saleNum = parseFloat(salePrice) || 0;
  const profitNum = saleNum - costNum;
  const marginPct = saleNum > 0 && costNum > 0 ? ((profitNum / saleNum) * 100).toFixed(1) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanChassis = chassis.trim().toUpperCase();

    if (!isNoChassis && (!cleanChassis || cleanChassis.length < 5)) {
      toast({
        variant: 'destructive',
        title: 'Chassi Obrigatório',
        description: 'Digite o chassi do veículo para prosseguir com o cadastro, ou ative a opção de Bicicleta / Elétrica sem Chassi.',
      });
      return;
    }

    if (!brand.trim() || !model.trim()) {
      toast({
        variant: 'destructive',
        title: 'Marca e Modelo obrigatórios',
        description: isNoChassis
          ? 'Informe a marca e o modelo da bicicleta ou equipamento elétrico.'
          : 'Aguarde o reconhecimento do padrão pelo chassi ou informe o modelo.',
      });
      return;
    }

    if (saleNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor de Venda obrigatório',
        description: 'Informe um valor de venda válido maior que zero.',
      });
      return;
    }

    const finalChassis = isNoChassis
      ? (cleanChassis || 'DISPENSADO')
      : cleanChassis;

    const confirmed = await confirm({
      title: 'Confirmar Cadastro no Estoque?',
      description: `Deseja registrar ${brand.trim().toUpperCase()} ${model.trim().toUpperCase()} (${color.trim() || 'Preta'}) - ${
        isNoChassis
          ? (finalChassis === 'DISPENSADO' ? 'Sem Chassi (Dispensado Res. CONTRAN 996/23)' : `Nº Quadro/Série: ${finalChassis}`)
          : `Chassi ${finalChassis}`
      } no estoque disponível?`,
      confirmText: 'Sim, Cadastrar Veículo',
      cancelText: 'Revisar',
      variant: 'default',
    });

    if (!confirmed) return;

    await createVehicle.mutateAsync({
      store_id: storeId || 'store-divinopolis',
      vehicle_type: vehicleType,
      brand: brand.trim().toUpperCase(),
      model: model.trim().toUpperCase(),
      year: parseInt(year, 10) || new Date().getFullYear(),
      manufacture_year: parseInt(manufactureYear, 10) || new Date().getFullYear(),
      color: color.trim() || 'Preta',
      chassis: finalChassis,
      plate: plate.trim() ? plate.trim().toUpperCase() : undefined,
      renavam: renavam.trim() || undefined,
      mileage: parseInt(mileage, 10) || 0,
      engine_cc: vehicleType === 'moto' && !isNoChassis ? parseInt(engineCc, 10) || 125 : (parseInt(engineCc, 10) || undefined),
      fuel_type: fuelType || (isNoChassis ? 'eletrico' : 'gasolina'),
      transmission: transmission || (isNoChassis ? 'automatico' : 'manual'),
      purchase_price: costNum > 0 ? costNum : undefined,
      sale_price: saleNum,
      warranty_months: parseInt(warrantyMonths, 10) || 12,
      notes: notes.trim() || (isNoChassis ? 'Equipamento elétrico / bicicleta sem chassi VIN (Resolução CONTRAN 996/2023)' : undefined),
      status: 'disponivel',
    });

    toast({
      title: 'Veículo Cadastrado com Sucesso!',
      description: `${brand} ${model} adicionado ao estoque disponível da concessionária.`,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border bg-card shadow-2xl">
        {/* Topo do Diálogo */}
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {vehicleType === 'moto' ? <Bike className="h-5 w-5" /> : <Car className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Cadastrar Veículo no Estoque
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Preencha o Chassi como 1º campo para carregar o modelo e travar as especificações técnicas pelo padrão.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* ========================================================================= */}
          {/* SELETOR: MULTIMARCAS - BICICLETA / PATINETE / ELÉTRICA SEM CHASSI         */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-200">
                  Bicicleta / Patinete / Elétrica sem Chassi VIN
                </p>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                  Dispensa chassi de 17 dígitos (Resolução CONTRAN 996/23 Multimarcas) e usa Nº de Série do Quadro.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 hidden sm:inline">
                {isNoChassis ? 'Sem Chassi VIN' : 'Veículo com Chassi'}
              </span>
              <Switch
                checked={isNoChassis}
                onCheckedChange={toggleNoChassis}
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PASSO 1: O PRIMEIRO CAMPO A PREENCHER É O CHASSI (OU NÚMERO DO QUADRO)    */}
          {/* ========================================================================= */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-primary/40 bg-primary/5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-primary" />
                {isNoChassis
                  ? '1. Nº de Série do Quadro / Motor (Opcional)'
                  : '1. Chassi do Veículo (VIN) * — Primeiro Campo a Preencher'}
              </Label>
              <div className="flex items-center gap-2">
                {!isNoChassis ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScannerOpen(true)}
                      className="h-7 px-2 text-[11px] font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/5 shadow-2xs"
                      title="Escanear com câmera ou leitor de código de barras"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>Bipar Chassi</span>
                    </Button>
                    <span className="text-xs font-mono font-bold text-primary">
                      {chassis.length}/17 dígitos
                    </span>
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/40 bg-amber-500/10">
                    DISPENSADO / OPCIONAL
                  </Badge>
                )}
              </div>
            </div>

            <div className="relative">
              <Input
                autoFocus
                value={chassis}
                onChange={(e) => handleChassisChange(e.target.value)}
                placeholder={
                  isNoChassis
                    ? 'DIGITE O Nº DE SÉRIE DO QUADRO (OU DEIXE EM BRANCO PARA DISPENSADO)...'
                    : 'DIGITE O CHASSI (EX: 99HSHF250VS001288)...'
                }
                className="h-12 text-base sm:text-lg font-mono font-black tracking-widest bg-background border-primary/40 focus-visible:ring-primary shadow-xs uppercase placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal"
                maxLength={isNoChassis ? 40 : 17}
                required={!isNoChassis}
              />
              {!isNoChassis && isDecodingChassis && (
                <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5 text-xs text-primary font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Analisando padrão...</span>
                </div>
              )}
            </div>

            {/* Banner de Bicicleta / Elétrica sem Chassi */}
            {isNoChassis && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 animate-scale-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-black text-xs uppercase tracking-wide truncate">
                      Modo Veículo Elétrico / Bicicleta Ativo
                    </p>
                    <p className="text-[11px] opacity-90 truncate">
                      Chassi registrado como <strong>{chassis.trim() || 'DISPENSADO'}</strong>. Ficha técnica totalmente desbloqueada.
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-600 text-white font-mono text-[10px] shrink-0 ml-2">
                  RES. CONTRAN 996/23
                </Badge>
              </div>
            )}

            {/* Banner de Padrão Identificado */}
            {!isNoChassis && patternLocked && chassisRecognized && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 animate-scale-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-black text-xs uppercase tracking-wide truncate">
                      Padrão Reconhecido: {brand} {model} {engineCc ? `(${engineCc}cc)` : ''}
                    </p>
                    <p className="text-[11px] opacity-90 truncate">
                      Ficha técnica preenchida e bloqueada. Preencha apenas os campos liberados abaixo.
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono text-[10px] shrink-0 ml-2">
                  PADRÃO APLICADO
                </Badge>
              </div>
            )}

            {!isNoChassis && !patternLocked && chassis.length >= 4 && !isDecodingChassis && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Digite os primeiros 8 a 10 dígitos do chassi para o sistema identificar o modelo automaticamente.
              </p>
            )}
          </div>

          {/* ========================================================================= */}
          {/* CAMPOS DESBLOQUEADOS: CHASSI, ANO FABRICAÇÃO, ANO MODELO, COR, PLACA, VALOR */}
          {/* ========================================================================= */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                Campos Liberados para Preenchimento &amp; Edição
              </h4>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                DESBLOQUEADOS
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs font-semibold">Ano Fabricação *</Label>
                <Input
                  type="number"
                  value={manufactureYear}
                  onChange={(e) => setManufactureYear(e.target.value)}
                  placeholder="Ex: 2026"
                  className="h-10 text-xs mt-1 font-semibold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Ano Modelo *</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Ex: 2026"
                  className="h-10 text-xs mt-1 font-semibold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Palette className="w-3 h-3 text-primary" />
                  Cor *
                </Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="h-10 text-xs mt-1 font-semibold">
                    <SelectValue placeholder="Selecione a cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Placa (Opcional)</Label>
                <Input
                  value={plate}
                  onChange={(e) => setPlate(formatPlate(e.target.value))}
                  placeholder="ABC-1D23"
                  className="h-10 text-xs mt-1 font-mono uppercase"
                  maxLength={8}
                />
              </div>
            </div>

            {/* PRECIFICAÇÃO (VALOR DE VENDA E CUSTO) — DESBLOQUEADOS */}
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Valores Comerciais (Desbloqueados)
              </Label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Preço de Venda / Tabela (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-xs mt-1 font-mono font-bold bg-primary/5 border-primary/40 text-foreground"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Custo de Aquisição / NF Fábrica (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-xs mt-1 font-mono"
                  />
                </div>
              </div>

              {marginPct !== null && (
                <div className="p-2.5 rounded-lg border bg-background flex items-center justify-between text-xs">
                  <span>
                    Margem Estimada:{' '}
                    <strong className="font-mono text-foreground">
                      R$ {profitNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <Badge
                    className={
                      profitNum > 0
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-destructive/10 text-destructive border-destructive/30'
                    }
                  >
                    {marginPct}%
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAMPOS BLOQUEADOS: MARCA, MODELO, CILINDRADA, CAMBIO, COMBUSTÍVEL, GARANTIA*/}
          {/* ========================================================================= */}
          <div className="space-y-3.5 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Ficha Técnica &amp; Padrão da Montadora
              </h4>
              {patternLocked ? (
                <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  TRAVADO PELO PADRÃO
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Preenchido ao digitar o Chassi
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  Marca *
                  {patternLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={patternLocked}
                  placeholder="Preenchido pelo padrão..."
                  className={`h-10 text-xs mt-1 font-semibold uppercase ${
                    patternLocked ? 'bg-muted/70 text-muted-foreground cursor-not-allowed select-none' : ''
                  }`}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  Modelo *
                  {patternLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={patternLocked}
                  placeholder="Preenchido pelo padrão..."
                  className={`h-10 text-xs mt-1 font-semibold uppercase ${
                    patternLocked ? 'bg-muted/70 text-muted-foreground cursor-not-allowed select-none' : ''
                  }`}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  Cilindrada (cc)
                  {patternLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                <Input
                  type="number"
                  value={engineCc}
                  onChange={(e) => setEngineCc(e.target.value)}
                  disabled={patternLocked}
                  placeholder="Preenchido pelo padrão..."
                  className={`h-10 text-xs mt-1 ${
                    patternLocked ? 'bg-muted/70 text-muted-foreground cursor-not-allowed select-none' : ''
                  }`}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  Combustível
                  {patternLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                <Select value={fuelType} onValueChange={setFuelType} disabled={patternLocked}>
                  <SelectTrigger className={`h-10 text-xs mt-1 ${patternLocked ? 'bg-muted/70 cursor-not-allowed' : ''}`}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="flex">Flex</SelectItem>
                    <SelectItem value="eletrico">Elétrico</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  Câmbio / Transmissão
                  {patternLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                <Select value={transmission} onValueChange={setTransmission} disabled={patternLocked}>
                  <SelectTrigger className={`h-10 text-xs mt-1 ${patternLocked ? 'bg-muted/70 cursor-not-allowed' : ''}`}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="semi_automatico">Semi-automático</SelectItem>
                    <SelectItem value="automatico">Automático / CVT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Concessionária / Pátio de Destino *
                </Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger className="h-10 text-xs mt-1">
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  Garantia de Fábrica (Meses)
                  {patternLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                <Input
                  type="number"
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(e.target.value)}
                  disabled={patternLocked}
                  placeholder="Ex: 12"
                  className={`h-10 text-xs mt-1 ${
                    patternLocked ? 'bg-muted/70 text-muted-foreground cursor-not-allowed select-none' : ''
                  }`}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Observações / Detalhes Adicionais</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: 0km pronta entrega, acompanha manual e chave reserva..."
                className="text-xs mt-1 min-h-[50px]"
              />
            </div>
          </div>

          {/* Rodapé com Ações */}
          <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createVehicle.isPending}
              className="gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-5 shadow-sm"
            >
              {createVehicle.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Cadastrar no Estoque
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onChassisScanned={(scanned) => {
          const clean = scanned.toUpperCase().replace(/[^A-Z0-9]/g, '');
          setChassis(clean);
          triggerChassisRecognition(clean);
          setScannerOpen(false);
        }}
      />
    </Dialog>
  );
}
export default VehicleFormDialog;