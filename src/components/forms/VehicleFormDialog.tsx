import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Bike, Car, Building2, DollarSign, Wrench, CheckCircle2, 
  Loader2, Sparkles, Lock, Hash, Calendar, Palette, ShieldCheck, RefreshCw, ScanLine, Zap, Boxes,
  ChevronDown, ChevronUp, AlertTriangle, Info, XCircle, ShieldAlert, ListChecks 
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
import { useVehicles } from '@/hooks/useVehicles';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { setVehicleInBoxNotes } from '@/lib/vehicleBoxStatus';
import { STANDARD_COLORS, formatPlate } from '@/lib/vehicleCatalog';
import { maskCurrency, parseCurrency } from '@/lib/masks';
import { 
  validateMotoRegistration, 
  validateChassisVin, 
  validateLicensePlate, 
  validateRenavamNumber, 
  validateVehicleYears 
} from '@/lib/motoValidation';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialChassis?: string;
}

export function VehicleFormDialog({ open, onOpenChange, initialChassis }: VehicleFormDialogProps) {
  const { data: stores = [] } = useStores();
  const { data: vehicles = [] } = useVehicles();
  const createVehicle = useCreateVehicle();
  const { userStore } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  // Estados dos Campos — Inicialmente todos vazios ao cadastrar nova moto
  const [storeId, setStoreId] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<'moto' | 'carro'>('moto');
  const [chassis, setChassis] = useState<string>('');
  const [isElectric, setIsElectric] = useState<boolean>(false);
  const [massQuantity, setMassQuantity] = useState<number>(1);
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
  const [isInBox, setIsInBox] = useState<boolean>(false);

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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const lastDecodedVinRef = useRef<string>('');
  const chassisDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (chassisDebounceRef.current) {
        clearTimeout(chassisDebounceRef.current);
      }
    };
  }, []);

  // Reset COMPLETO de todas as abas e campos sempre que o modal abre
  const resetForm = useCallback(() => {
    if (chassisDebounceRef.current) {
      clearTimeout(chassisDebounceRef.current);
    }
    setChassis('');
    setIsElectric(false);
    setMassQuantity(1);
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
  // Só aciona quando preenchida a parte necessária para descobrir o modelo (8+ caracteres).
  const triggerChassisRecognition = useCallback(
    async (rawVin: string) => {
      const cleanVin = (rawVin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanVin.length < 8) {
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
          if (pattern.fuel_type) {
            setFuelType(pattern.fuel_type);
            if (pattern.fuel_type.toLowerCase().includes('eletri')) {
              setIsElectric(true);
            }
          }
          if (pattern.transmission) setTransmission(pattern.transmission);
          if (pattern.warranty_months) setWarrantyMonths(String(pattern.warranty_months));
          if (pattern.default_sale_price) setSalePrice(maskCurrency(pattern.default_sale_price));
          if (pattern.default_purchase_price) setPurchasePrice(maskCurrency(pattern.default_purchase_price));

          // Resolução de Ano Modelo e Fabricação a partir do VIN
          const decodedYear = resolvedYear.year || extractYearFromVIN(cleanVin) || new Date().getFullYear();
          const decodedManufactureYear = resolvedYear.manufactureYear || decodedYear;
          setYear(String(decodedYear));
          setManufactureYear(String(decodedManufactureYear));

          // Aplica o padrão visualmente na tela com badge sem spam de notificações toast
          setPatternLocked(true);
          setChassisRecognized({
            matched: true,
            brand: pattern.brand,
            model: pattern.model,
            year: decodedYear,
          });
        } else {
          // Se não encontrou o padrão do modelo, mas conseguiu decodificar o ano (VIN >= 10 posições)
          const decodedYear = resolvedYear.year || extractYearFromVIN(cleanVin);
          if (decodedYear) {
            setYear(String(decodedYear));
            setManufactureYear(String(resolvedYear.manufactureYear || decodedYear));
          }
          setPatternLocked(false);
          setChassisRecognized(null);
        }
      } catch (err) {
        console.error('Erro na análise de chassi:', err);
      } finally {
        setIsDecodingChassis(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open && initialChassis) {
      const clean = initialChassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setChassis(clean);
      if (clean.length >= 8) {
        triggerChassisRecognition(clean);
      }
    }
  }, [open, initialChassis, triggerChassisRecognition]);

  const toggleElectric = (checked: boolean) => {
    setIsElectric(checked);
    if (checked) {
      if (!brand) setBrand('SHINERAY');
      setPatternLocked(false);
      setChassisRecognized(null);
      setFuelType('eletrico');
      setTransmission('direta');
      if (!engineCc || engineCc === '0') setEngineCc('2000');
      lastDecodedVinRef.current = '';
    } else {
      setFuelType('gasolina');
      setTransmission('manual');
      setEngineCc('125');
      setMassQuantity(1);
    }
  };

  const handleChassisChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setChassis(upper);

    if (chassisDebounceRef.current) {
      clearTimeout(chassisDebounceRef.current);
    }

    const clean = upper.replace(/[^A-Z0-9]/g, '');
    if (clean.length < 8) {
      setPatternLocked(false);
      setChassisRecognized(null);
      lastDecodedVinRef.current = '';
      return;
    }

    if (!isElectric) {
      chassisDebounceRef.current = setTimeout(() => {
        triggerChassisRecognition(upper);
      }, 400);
    }
  };

  const costNum = parseCurrency(purchasePrice);
  const saleNum = parseCurrency(salePrice);
  const profitNum = saleNum - costNum;
  const marginPct = saleNum > 0 && costNum > 0 ? ((profitNum / saleNum) * 100).toFixed(1) : null;

  // Mecanismo de Validação Completa e Real em Tempo Real (ISO 3779 / CONTRAN 282 e 996 / Mercosul)
  const validation = useMemo(() => {
    return validateMotoRegistration(
      {
        storeId,
        vehicleType,
        brand,
        model,
        year,
        manufactureYear,
        color,
        chassis,
        isElectric,
        plate,
        renavam,
        purchasePrice,
        salePrice,
        mileage,
        engineCc,
        fuelType,
        transmission,
      },
      vehicles
    );
  }, [
    storeId,
    vehicleType,
    brand,
    model,
    year,
    manufactureYear,
    color,
    chassis,
    isElectric,
    plate,
    renavam,
    purchasePrice,
    salePrice,
    mileage,
    engineCc,
    fuelType,
    transmission,
    vehicles,
  ]);

  const chassisCheck = useMemo(() => {
    return validateChassisVin(chassis, isElectric, vehicles);
  }, [chassis, isElectric, vehicles]);

  const plateCheck = useMemo(() => {
    return validateLicensePlate(plate);
  }, [plate]);

  const renavamCheck = useMemo(() => {
    return validateRenavamNumber(renavam);
  }, [renavam]);

  const yearCheck = useMemo(() => {
    const y = parseInt(year, 10) || new Date().getFullYear();
    const my = parseInt(manufactureYear, 10) || y;
    return validateVehicleYears(my, y);
  }, [year, manufactureYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validação Rigorosa e Real de Cadastro de Motos
    if (!validation.isValid) {
      const errorList = Object.values(validation.errors);
      toast({
        variant: 'destructive',
        title: 'Validação Oficial Não Atendida',
        description: errorList[0] || 'Corrija os campos com inconsistências antes de prosseguir.',
      });

      // Se houver pendência em campo avançado ou loja, expande para o usuário ver
      if (
        validation.errors.storeId ||
        validation.errors.year ||
        validation.errors.plate ||
        validation.errors.renavam ||
        validation.errors.color
      ) {
        setShowAdvanced(true);
      }
      return;
    }

    // 2. Alerta de Margem Comercial Negativa
    if (validation.warnings.pricing) {
      const proceed = await confirm({
        title: 'Atenção: Margem Comercial Negativa',
        description: `${validation.warnings.pricing} Deseja prosseguir com o cadastro da moto com margem negativa?`,
        confirmText: 'Prosseguir Mesmo Assim',
        cancelText: 'Revisar Valores',
        variant: 'destructive',
      });
      if (!proceed) return;
    }

    const cleanChassis = chassis.trim().toUpperCase();
    const finalQuantity = isElectric ? Math.max(1, massQuantity) : 1;
    const finalChassis = cleanChassis || (isElectric ? 'A DEFINIR NA VENDA' : '');

    const selectedStore = stores.find((s) => s.id === storeId);
    const storeLabel = selectedStore?.name || 'Concessionária';

    const confirmed = await confirm({
      title: finalQuantity > 1 ? `Confirmar Cadastro em Massa (${finalQuantity} Unidades)?` : 'Confirmar Cadastro no Estoque?',
      description: finalQuantity > 1
        ? `Deseja registrar ${finalQuantity} unidades idênticas de ${brand.trim().toUpperCase()} ${model.trim().toUpperCase()} (${color.trim() || 'Preta'}) no estoque da ${storeLabel}? Elas ficarão separadas no catálogo aguardando código para venda.`
        : `Deseja registrar ${brand.trim().toUpperCase()} ${model.trim().toUpperCase()} (${color.trim() || 'Preta'}) - ${
            isElectric
              ? (finalChassis === 'A DEFINIR NA VENDA' ? 'Sem chassi (será inserido na venda)' : `Nº da Moto/Motor: ${finalChassis}`)
              : `Chassi ${finalChassis}`
          } no estoque disponível da ${storeLabel}?`,
      confirmText: finalQuantity > 1 ? `Sim, Cadastrar ${finalQuantity} Unidades` : 'Sim, Cadastrar Veículo',
      cancelText: 'Revisar',
      variant: 'default',
    });

    if (!confirmed) return;

    if (finalQuantity > 1) {
      for (let i = 0; i < finalQuantity; i++) {
        await createVehicle.mutateAsync({
          store_id: storeId || 'store-divinopolis',
          vehicle_type: vehicleType,
          brand: brand.trim().toUpperCase(),
          model: model.trim().toUpperCase(),
          year: parseInt(year, 10) || new Date().getFullYear(),
          manufacture_year: parseInt(manufactureYear, 10) || new Date().getFullYear(),
          color: color.trim() || 'Preta',
          chassis: 'A DEFINIR NA VENDA',
          plate: undefined,
          renavam: undefined,
          mileage: 0,
          engine_cc: parseInt(engineCc, 10) || 2000,
          fuel_type: 'eletrico',
          transmission: 'direta',
          purchase_price: costNum > 0 ? costNum : undefined,
          sale_price: saleNum,
          warranty_months: parseInt(warrantyMonths, 10) || 12,
          notes: setVehicleInBoxNotes(
            notes.trim() || `Moto Elétrica em lote (${i + 1}/${finalQuantity}) - Aguardando código na venda.`,
            isInBox
          ) || undefined,
          status: 'disponivel',
        });
      }

      toast({
        title: 'Cadastro em Massa Concluído!',
        description: `${finalQuantity} unidades de ${brand} ${model} adicionadas ao estoque e separadas no catálogo aguardando código para a venda.`,
      });
    } else {
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
        engine_cc: isElectric ? (parseInt(engineCc, 10) || 2000) : (parseInt(engineCc, 10) || undefined),
        fuel_type: isElectric ? 'eletrico' : (fuelType || 'gasolina'),
        transmission: isElectric ? 'direta' : (transmission || 'manual'),
        purchase_price: costNum > 0 ? costNum : undefined,
        sale_price: saleNum,
        warranty_months: parseInt(warrantyMonths, 10) || 12,
        notes: setVehicleInBoxNotes(
          notes.trim() || (isElectric ? `Moto Elétrica - Número de Motor/Moto: ${finalChassis}` : null),
          isInBox
        ) || undefined,
        status: 'disponivel',
      });

      toast({
        title: 'Veículo Cadastrado com Sucesso!',
        description: `${brand} ${model} adicionado ao estoque disponível da concessionária.`,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0 rounded-2xl border bg-card shadow-2xl flex flex-col">
        {/* Topo do Diálogo */}
        <div className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                {vehicleType === 'moto' ? <Bike className="h-5 w-5" /> : <Car className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground truncate">
                  Cadastrar Veículo no Estoque
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {isElectric
                    ? 'Moto elétrica: chassi/motor é opcional e pode ser informado na venda.'
                    : 'Preencha o Chassi como 1º campo para carregar as especificações.'}
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto overflow-x-hidden flex-1">
          {/* ========================================================================= */}
          {/* PASSO 1: CHASSI (COMBUSTÃO) OU NÚMERO DA MOTO / MOTOR (ELÉTRICA)           */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5 min-w-0">
                <Hash className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">
                  {isElectric ? '1. Nº da Moto / Motor' : '1. Chassi do Veículo (VIN) *'}
                </span>
              </Label>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Botão Seletor Elétrica / Combustão */}
                <button
                  type="button"
                  onClick={() => toggleElectric(!isElectric)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    isElectric
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted/60'
                  }`}
                  title="Alternar entre moto elétrica e moto a combustão"
                >
                  <Zap className={`w-3.5 h-3.5 ${isElectric ? 'text-white' : 'text-emerald-600'}`} />
                  <span>{isElectric ? 'Elétrica Ativa' : 'Moto Elétrica?'}</span>
                </button>

                {!isElectric ? (
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
                      <span>Bipar</span>
                    </Button>
                    <span className="text-xs font-mono font-bold text-primary hidden sm:inline">
                      {chassis.length}/17
                    </span>
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/15">
                    OPCIONAL
                  </Badge>
                )}
              </div>
            </div>

            <div className="relative">
              <Input
                autoFocus
                value={chassis}
                onChange={(e) => handleChassisChange(e.target.value)}
                onBlur={() => {
                  const clean = chassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (!isElectric && clean.length >= 8) {
                    triggerChassisRecognition(clean);
                  }
                }}
                placeholder={
                  isElectric
                    ? 'Opcional: nº da moto/motor (ou deixe em branco para a venda)...'
                    : 'DIGITE O CHASSI (EX: 99HSHF250VS001288)...'
                }
                className="h-11 text-sm sm:text-base font-mono font-bold tracking-wide bg-background border-primary/40 focus-visible:ring-primary shadow-xs uppercase placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:tracking-normal"
                maxLength={isElectric ? 40 : 17}
                required={!isElectric}
              />
              {!isElectric && isDecodingChassis && (
                <div className="absolute right-3.5 top-3 flex items-center gap-1.5 text-xs text-primary font-bold">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Analisando modelo...</span>
                </div>
              )}
            </div>

            {/* FEEDBACK DE VALIDAÇÃO OFICIAL DO CHASSI EM TEMPO REAL (ISO 3779 / CONTRAN) */}
            {!isElectric && chassis.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                {/* 1. Alerta de Letras Proibidas pela Norma ISO 3779 / CONTRAN */}
                {(chassis.includes('I') || chassis.includes('O') || chassis.includes('Q')) && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      Letras Proibidas (ISO 3779 / CONTRAN): As letras <strong>I</strong>, <strong>O</strong> e <strong>Q</strong> são proibidas no mundo inteiro em chassis de veículos.
                    </span>
                  </div>
                )}

                {/* 2. Alerta de Chassi Duplicado no Estoque */}
                {chassisCheck.isDuplicate && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive text-xs">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-black uppercase tracking-wider text-[11px]">Chassi Duplicado no Sistema</p>
                      <p className="font-medium">{chassisCheck.error}</p>
                    </div>
                  </div>
                )}

                {/* 3. Indicador de Chassi Válido ou Incompleto */}
                {!chassisCheck.isDuplicate && !chassis.includes('I') && !chassis.includes('O') && !chassis.includes('Q') && (
                  chassis.length === 17 ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Chassi Oficial de 17 caracteres validado conforme a norma ISO 3779 / CONTRAN.</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Faltam <strong>{17 - chassis.length}</strong> caracteres para completar os 17 dígitos do chassi oficial.</span>
                      </div>
                      <span className="font-mono font-bold text-[11px]">{chassis.length}/17</span>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Aviso Compacto de Moto Elétrica e Controle de Massa */}
            {isElectric && (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Cadastro em Massa (Mesmo Produto)</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {massQuantity > 1
                        ? `${massQuantity} unidades ficarão separadas no catálogo aguardando o código na venda.`
                        : 'Aumente a quantidade para cadastrar várias motos idênticas de uma vez.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs font-semibold whitespace-nowrap">Qtd:</Label>
                    <div className="flex items-center rounded-lg border bg-background overflow-hidden h-8">
                      <button
                        type="button"
                        onClick={() => setMassQuantity((prev) => Math.max(1, prev - 1))}
                        className="px-2.5 py-1 text-xs font-bold hover:bg-muted text-muted-foreground hover:text-foreground h-full"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={massQuantity}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                          setMassQuantity(val);
                          if (val > 1) setChassis('');
                        }}
                        className="w-12 text-center text-xs font-bold bg-transparent border-0 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMassQuantity((prev) => Math.min(100, prev + 1));
                          setChassis('');
                        }}
                        className="px-2.5 py-1 text-xs font-bold hover:bg-muted text-muted-foreground hover:text-foreground h-full"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-muted-foreground text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    {massQuantity > 1
                      ? `As ${massQuantity} unidades serão criadas no catálogo aguardando a inserção de chassi/motor na venda.`
                      : (chassis.trim()
                          ? `Nº registrado: ${chassis.trim()}`
                          : 'Sem chassi no cadastro: o vendedor digitará o chassi ou motor na hora da venda.')}
                  </span>
                </div>
              </div>
            )}

            {/* Banner de Padrão Identificado */}
            {!isElectric && patternLocked && chassisRecognized && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="font-bold truncate">
                    Padrão Detectado: {brand} {model} {engineCc ? `(${engineCc}cc)` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                    APLICADO
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPatternLocked(false)}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-emerald-500/20"
                  >
                    Desbloquear
                  </Button>
                </div>
              </div>
            )}

            {!isElectric && !patternLocked && chassis.length >= 3 && !isDecodingChassis && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Digite os primeiros 8 a 10 dígitos do chassi (WMI + Código do Modelo) para preenchimento automático.
              </p>
            )}
          </div>

          {/* ========================================================================= */}
          {/* PASSO 2: DADOS ESSENCIAIS DO VEÍCULO (SIMPLIFICADO EM 1 LINHA LIMPA)      */}
          {/* ========================================================================= */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Modelo *</span>
                  {patternLocked && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Padrão
                    </span>
                  )}
                </Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={patternLocked}
                  placeholder="Ex: SHI 175 EFI..."
                  className={`h-10 text-xs mt-1 font-bold uppercase ${
                    patternLocked ? 'bg-muted/60 text-muted-foreground' : ''
                  } ${validation.errors.model && model.trim().length > 0 ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  required
                />
                {validation.errors.model && model.trim().length > 0 && (
                  <p className="text-[10px] text-destructive mt-1 font-medium">{validation.errors.model}</p>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-primary" />
                  Cor *
                </Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className={`h-10 text-xs mt-1 font-semibold ${validation.errors.color && color ? 'border-destructive' : ''}`}>
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
                {validation.errors.color && (
                  <p className="text-[10px] text-destructive mt-1 font-medium">{validation.errors.color}</p>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Preço de Venda (R$) *
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={salePrice}
                  onChange={(e) => setSalePrice(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  className={`h-10 text-xs mt-1 font-mono font-bold bg-primary/5 border-primary/40 text-foreground ${
                    validation.errors.salePrice && salePrice ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                  required
                />
                {validation.errors.salePrice && salePrice && (
                  <p className="text-[10px] text-destructive mt-1 font-medium">{validation.errors.salePrice}</p>
                )}
              </div>
            </div>

            {/* BOTÃO EXPANSOR DE DETALHES COMPLEMENTARES */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-dashed border-border hover:bg-muted/30 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span className="text-left">
                  {showAdvanced
                    ? 'Ocultar Detalhes Complementares'
                    : 'Detalhes Complementares (Ano, Placa, Custo, Loja, Renavam, Garantia)'}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-primary shrink-0">
                {showAdvanced ? (
                  <>Menos <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>Expandir ({year || '2026'}, {storeId ? 'Loja OK' : ''}) <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* DETALHES AVANÇADOS (EXPANSÍVEL - ZERO POLUIÇÃO VISUAL NA TELA PRINCIPAL)  */}
          {/* ========================================================================= */}
          {showAdvanced && (
            <div className="space-y-4 pt-3 border-t animate-fade-in text-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Ficha Técnica &amp; Dados Complementares
                </h4>
                {patternLocked && (
                  <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    <Lock className="w-3 h-3" />
                    PADRÃO MONTADORA
                  </Badge>
                )}
              </div>

              {/* Anos e Identificação */}
              <div className="space-y-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Ano Fabricação</Label>
                    <Input
                      type="number"
                      value={manufactureYear}
                      onChange={(e) => setManufactureYear(e.target.value)}
                      placeholder="Ex: 2026"
                      className={`h-9 text-xs mt-1 font-semibold ${validation.errors.year ? 'border-destructive' : ''}`}
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Ano Modelo</Label>
                    <Input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="Ex: 2026"
                      className={`h-9 text-xs mt-1 font-semibold ${validation.errors.year ? 'border-destructive' : ''}`}
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Placa (Opcional)</Label>
                    <Input
                      value={plate}
                      onChange={(e) => setPlate(formatPlate(e.target.value))}
                      placeholder="ABC-1D23"
                      className={`h-9 text-xs mt-1 font-mono uppercase ${validation.errors.plate ? 'border-destructive' : ''}`}
                      maxLength={8}
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Renavam (Opcional)</Label>
                    <Input
                      value={renavam}
                      onChange={(e) => setRenavam(e.target.value)}
                      placeholder="00000000000"
                      className={`h-9 text-xs mt-1 font-mono ${validation.errors.renavam ? 'border-destructive' : ''}`}
                      maxLength={11}
                    />
                  </div>
                </div>

                {/* Mensagens de erro de Anos, Placa e Renavam */}
                {validation.errors.year && (
                  <p className="text-[10px] text-destructive font-medium">{validation.errors.year}</p>
                )}
                {validation.errors.plate && plate && (
                  <p className="text-[10px] text-destructive font-medium">{validation.errors.plate}</p>
                )}
                {validation.errors.renavam && renavam && (
                  <p className="text-[10px] text-destructive font-medium">{validation.errors.renavam}</p>
                )}
              </div>

              {/* Custo e Margem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Custo de Aquisição / NF Fábrica (R$)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(maskCurrency(e.target.value))}
                    placeholder="R$ 0,00"
                    className="h-9 text-xs mt-1 font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    Concessionária / Pátio de Destino *
                  </Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger className={`h-9 text-xs mt-1 ${validation.errors.storeId ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores
                        .filter((s) => s.is_active !== false)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {validation.errors.storeId && (
                    <p className="text-[10px] text-destructive mt-1 font-medium">{validation.errors.storeId}</p>
                  )}
                </div>
              </div>

              {marginPct !== null && (
                <div className="p-2 rounded-lg border bg-muted/30 flex items-center justify-between text-xs">
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

              {/* Especificações Técnicas (Marca, Cilindrada, Transmissão, Combustível, Garantia) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
                <div>
                  <Label className="text-xs font-semibold">Marca</Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    disabled={patternLocked}
                    className={`h-9 text-xs mt-1 font-semibold uppercase ${
                      patternLocked ? 'bg-muted/70 text-muted-foreground' : ''
                    }`}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">
                    {isElectric ? 'Potência do Motor (Watts)' : 'Cilindrada (cc)'}
                  </Label>
                  <Input
                    type="number"
                    value={engineCc}
                    onChange={(e) => setEngineCc(e.target.value)}
                    disabled={patternLocked && !isElectric}
                    placeholder={isElectric ? '2000' : '125'}
                    className={`h-9 text-xs mt-1 ${
                      patternLocked && !isElectric ? 'bg-muted/70 text-muted-foreground' : ''
                    }`}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Garantia (Meses)</Label>
                  <Input
                    type="number"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(e.target.value)}
                    disabled={patternLocked}
                    placeholder="12"
                    className={`h-9 text-xs mt-1 ${
                      patternLocked ? 'bg-muted/70 text-muted-foreground' : ''
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
                  className="text-xs mt-1 min-h-[45px]"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PAINEL DE VALIDAÇÃO OFICIAL EM TEMPO REAL (CONTRAN 282 / 996 / ISO 3779)  */}
          {/* ========================================================================= */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ListChecks className={`w-4 h-4 shrink-0 ${validation.isValid ? 'text-emerald-600' : 'text-amber-500'}`} />
                <span className="text-xs font-bold text-foreground truncate">
                  Checklist de Validação Oficial (ISO 3779 / CONTRAN)
                </span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold shrink-0 ${
                  validation.isValid
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                {validation.isValid ? '100% VÁLIDO' : `${Object.keys(validation.errors).length} PENDÊNCIA(S)`}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {validation.checklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] transition-colors ${
                    item.passed
                      ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                      : item.required
                      ? 'bg-destructive/5 border-destructive/25 text-destructive'
                      : 'bg-muted/40 border-border/60 text-muted-foreground'
                  }`}
                  title={item.message}
                >
                  {item.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : item.required ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Aviso de erro prioritário */}
            {!validation.isValid && Object.keys(validation.errors).length > 0 && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <span className="font-medium">{Object.values(validation.errors)[0]}</span>
              </div>
            )}

            {/* Alerta de margem negativa */}
            {validation.warnings.pricing && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-medium">{validation.warnings.pricing}</span>
              </div>
            )}
          </div>

          {/* Indicador: Moto ainda na caixa */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Boxes className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Moto ainda na caixa</p>
                <p className="text-[11px] text-muted-foreground">Marque se a moto ainda não foi montada no pátio</p>
              </div>
            </div>
            <Switch checked={isInBox} onCheckedChange={setIsInBox} />
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
                  {isElectric && massQuantity > 1
                    ? `Cadastrar ${massQuantity} Unidades em Massa`
                    : 'Cadastrar no Estoque'}
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