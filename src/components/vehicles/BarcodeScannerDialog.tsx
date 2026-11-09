import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { 
  Camera, Check, Loader2, X, AlertCircle, Pause, ScanLine, 
  Sparkles, Package, Building2, Palette, Hash, ArrowRight, 
  AlertTriangle, CheckCircle2, ShieldCheck, RefreshCw, Volume2, VolumeX, Eye
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStores } from '@/hooks/useStores';
import { useQueryClient } from '@tanstack/react-query';
import { recognizeFromChassis, resolveModelYearFromVin } from '@/lib/chassisRecognition';
import { playSuccessBeep, playErrorAlarm, playWarningTone } from '@/lib/audioFeedback';
import { STANDARD_COLORS } from '@/lib/vehicleCatalog';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { cn } from '@/lib/utils';

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChassisScanned?: (chassis: string) => void;
  onOpenFullForm?: (chassis: string) => void;
}

type CameraStatus = 'initializing' | 'scanning' | 'paused' | 'permission-denied' | 'error' | 'captured';

export function BarcodeScannerDialog({ 
  open, 
  onOpenChange, 
  onChassisScanned, 
  onOpenFullForm 
}: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  const { toast } = useToast();
  const { userStore } = useAuth();
  const { data: stores = [] } = useStores();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('initializing');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Dados do Chassi Detectado e Padrão Reconhecido
  const [scannedChassis, setScannedChassis] = useState<string | null>(null);
  const [recognizedPattern, setRecognizedPattern] = useState<any | null>(null);
  const [resolvedYears, setResolvedYears] = useState<{ model_year: number | null; manufacture_year: number | null } | null>(null);
  const [existingVehicle, setExistingVehicle] = useState<any | null>(null);

  // Campos para cadastro rápido
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('Branco');
  const [engineNumber, setEngineNumber] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  // Inicializa a loja padrão
  useEffect(() => {
    if (userStore?.id) {
      setSelectedStoreId(userStore.id);
    } else if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [userStore?.id, stores]);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      video!.srcObject = null;
    }
  }, []);

  const resetScan = useCallback(() => {
    setScannedChassis(null);
    setRecognizedPattern(null);
    setResolvedYears(null);
    setExistingVehicle(null);
    setEngineNumber('');
    setManualInput('');
    setIsSearching(false);
    setIsRegistering(false);
    isCooldownRef.current = false;
  }, []);

  // Processa o código do Chassi e busca padrão técnico
  const handleProcessCode = useCallback(async (rawCode: string) => {
    if (!rawCode || isCooldownRef.current) return;
    const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 5) return;

    // Se chamado em modo seletor para formulário
    if (onChassisScanned) {
      if (soundEnabled) playSuccessBeep();
      onChassisScanned(clean);
      onOpenChange(false);
      return;
    }

    isCooldownRef.current = true;
    setIsSearching(true);
    setScannedChassis(clean);

    try {
      // 1. Verifica se já existe no estoque
      const { data: existing } = await supabase
        .from('vehicles')
        .select('id, chassis, brand, model, color, status, store_id, stores(name)')
        .eq('chassis', clean)
        .maybeSingle();

      if (existing) {
        if (soundEnabled) playWarningTone();
        setExistingVehicle(existing);
        setRecognizedPattern(null);
        toast({
          title: 'Veículo já cadastrado',
          description: `Chassi já existente no estoque da loja ${existing.stores?.name || 'Matriz'}.`,
          variant: 'destructive',
        });
        setIsSearching(false);
        return;
      }

      setExistingVehicle(null);

      // 2. Busca padrão técnico da montadora
      const [pattern, resolvedYear] = await Promise.all([
        recognizeFromChassis(clean),
        resolveModelYearFromVin(clean, 'SHINERAY'),
      ]);

      if (soundEnabled) playSuccessBeep();

      setRecognizedPattern(pattern);
      setResolvedYears({
        model_year: resolvedYear.year || 2027,
        manufacture_year: resolvedYear.year ? resolvedYear.year - 1 : 2026,
      });

      toast({
        title: pattern ? `Padrão: ${pattern.brand} ${pattern.model}` : 'Chassi Lido com Sucesso',
        description: pattern ? 'Ficha técnica da fábrica preenchida automaticamente.' : 'Chassi pronto para cadastro.',
      });
    } catch (err: any) {
      console.error('Erro ao buscar padrão do chassi:', err);
      if (soundEnabled) playErrorAlarm();
    } finally {
      setIsSearching(false);
    }
  }, [onChassisScanned, onOpenChange, soundEnabled, toast]);

  // Inicia a câmera
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    setCameraStatus('initializing');

    try {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }

      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      const controls = await readerRef.current.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          if (result && !isCooldownRef.current) {
            const text = result.getText();
            if (text && text.trim().length >= 5) {
              handleProcessCode(text.trim());
            }
          }
        }
      );

      controlsRef.current = controls;
      setCameraStatus('scanning');
    } catch (err: any) {
      console.warn('Câmera indisponível:', err);
      const isPermission = /permission|denied|not allowed/i.test(err?.message || '');
      setCameraStatus(isPermission ? 'permission-denied' : 'error');
      setCameraError(isPermission ? 'Acesso à câmera bloqueado no navegador.' : 'Câmera não encontrada ou ocupada.');
    }
  }, [handleProcessCode]);

  useEffect(() => {
    if (open) {
      resetScan();
      startCamera();
    } else {
      stopCamera();
      resetScan();
    }
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera, resetScan]);

  // Listener para leitor físico de código de barras USB / Bluetooth (bipador de mão)
  useEffect(() => {
    if (!open) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em campos de input text
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length >= 5) {
          e.preventDefault();
          handleProcessCode(buffer.trim());
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleProcessCode]);

  // Efetiva o cadastro rápido com 1 clique direto no estoque
  const handleQuickRegister = async () => {
    if (!scannedChassis) return;

    const storeIdToUse = selectedStoreId || userStore?.id || stores[0]?.id;
    if (!storeIdToUse) {
      toast({
        title: 'Selecione uma loja',
        description: 'Informe em qual loja a moto será alocada.',
        variant: 'destructive',
      });
      return;
    }

    const storeObj = stores.find(s => s.id === storeIdToUse);
    const confirmed = await confirm({
      title: 'Confirmar Entrada no Estoque?',
      description: `Deseja cadastrar ${recognizedPattern?.brand || 'SHINERAY'} ${recognizedPattern?.model || 'Modelo Homologado'} (${selectedColor}) no estoque da loja ${storeObj?.name || 'Matriz'}?`,
      confirmText: 'Confirmar Entrada',
      cancelText: 'Cancelar',
      variant: 'success',
    });
    if (!confirmed) return;

    setIsRegistering(true);
    try {
      const payload = {
        chassis: scannedChassis,
        brand: recognizedPattern?.brand || 'SHINERAY',
        model: recognizedPattern?.model || 'A Definir',
        vehicle_type: recognizedPattern?.vehicle_type || 'moto',
        engine_cc: recognizedPattern?.engine_cc || null,
        fuel_type: recognizedPattern?.fuel_type || 'gasolina',
        transmission: recognizedPattern?.transmission || null,
        warranty_months: recognizedPattern?.warranty_months ?? 12,
        revision_period_months: recognizedPattern?.revision_period_months ?? null,
        revision_period_km: recognizedPattern?.revision_period_km ?? null,
        year: resolvedYears?.model_year || new Date().getFullYear(),
        manufacture_year: resolvedYears?.manufacture_year || new Date().getFullYear() - 1,
        color: selectedColor || 'Branco',
        store_id: storeIdToUse,
        status: 'disponivel' as const,
        mileage: 0,
        purchase_price: recognizedPattern?.default_purchase_price || null,
        sale_price: recognizedPattern?.default_sale_price || null,
        notes: engineNumber ? `Motor: ${engineNumber}` : null,
      };

      const { error: insErr } = await supabase.from('vehicles').insert(payload);
      if (insErr) throw insErr;

      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });

      if (soundEnabled) playSuccessBeep();

      toast({
        title: '✅ Moto Cadastrada com Sucesso!',
        description: `${payload.brand} ${payload.model} (${payload.color}) adicionada ao estoque.`,
      });

      // Reseta e prepara imediatamente para a próxima bipagem sem fechar
      resetScan();
      isCooldownRef.current = false;
    } catch (err: any) {
      console.error('Erro ao cadastrar moto:', err);
      toast({
        title: 'Falha no cadastro',
        description: err?.message || 'Erro ao registrar no estoque.',
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              <ScanLine className="w-5 h-5 text-primary" />
              Leitor de Código de Barras do Estoque
            </DialogTitle>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-8 px-2 text-xs text-muted-foreground"
              title={soundEnabled ? 'Silenciar bip sonoro' : 'Ativar bip sonoro'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </Button>
          </div>
          <DialogDescription className="text-xs">
            Bipe a etiqueta com o leitor físico ou use a câmera do celular. O sistema busca o padrão de fábrica automaticamente para acelerar o cadastro de todas as motos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Câmera / Área de Bipagem */}
          {!scannedChassis && (
            <div className="space-y-3">
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border shadow-inner">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                
                {/* Retículo Laser de Bipagem */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-20 border-2 border-primary/80 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                </div>

                {cameraStatus === 'initializing' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-2">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <span className="text-xs font-medium">Ativando câmera do leitor...</span>
                  </div>
                )}

                {cameraStatus === 'scanning' && (
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 text-white text-[11px] font-medium backdrop-blur-xs">
                    <ScanLine className="w-3 h-3 text-red-500 animate-pulse" />
                    <span>Aponte para o código de barras ou use leitor USB</span>
                  </div>
                )}

                {(cameraStatus === 'permission-denied' || cameraStatus === 'error') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-5 text-center gap-2">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                    <p className="text-xs font-semibold">{cameraError || 'Câmera não acessível'}</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs">
                      Você pode usar um leitor de código de barras físico USB/Bluetooth ou digitar o código abaixo.
                    </p>
                    <Button variant="secondary" size="sm" onClick={startCamera} className="mt-1 text-xs h-8">
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Tentar novamente
                    </Button>
                  </div>
                )}
              </div>

              {/* Entrada Manual ou por Bipador Externo */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Bipe com o leitor ou digite o chassi..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualInput.trim()) {
                        handleProcessCode(manualInput.trim());
                      }
                    }}
                    className="pl-8 h-9 text-xs font-mono uppercase"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => manualInput.trim() && handleProcessCode(manualInput.trim())}
                  disabled={!manualInput.trim()}
                  className="h-9 text-xs gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Buscar Padrão
                </Button>
              </div>
            </div>
          )}

          {/* Estado de Carregamento de Análise */}
          {isSearching && (
            <div className="p-6 rounded-xl border bg-card text-center space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto" />
              <p className="text-xs font-semibold text-foreground">Decodificando chassi e consultando banco de dados...</p>
            </div>
          )}

          {/* ALERTA: Veículo já existente no estoque */}
          {existingVehicle && !isSearching && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3 animate-scale-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-amber-900 dark:text-amber-200">
                    Veículo Já Cadastrado no Estoque!
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    O chassi <strong>{existingVehicle.chassis}</strong> já está ativo no sistema:
                  </p>
                  <div className="p-2.5 rounded-lg bg-background/80 border text-xs space-y-0.5 font-medium">
                    <p>• Modelo: <strong>{existingVehicle.brand} {existingVehicle.model}</strong></p>
                    <p>• Cor: <strong>{existingVehicle.color}</strong> • Status: <strong>{existingVehicle.status}</strong></p>
                    <p>• Loja Atual: <strong>{existingVehicle.stores?.name || 'Matriz'}</strong></p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={resetScan} className="text-xs h-8">
                  Escanear Próxima
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {/* SUCESSO: Padrão Identificado e Pronto para Entrada */}
          {scannedChassis && !existingVehicle && !isSearching && (
            <div className="space-y-4 animate-scale-in">
              {/* Card de Ficha Técnica do Padrão */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                        PADRÃO LOCALIZADO
                      </Badge>
                      <span className="font-mono font-bold text-xs text-foreground">
                        {scannedChassis}
                      </span>
                    </div>
                    <h3 className="font-display font-black text-base text-emerald-700 dark:text-emerald-400">
                      {recognizedPattern?.brand || 'SHINERAY'} {recognizedPattern?.model || 'Modelo Homologado'}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Preço Sugerido:</span>
                    <span className="text-sm font-black font-mono text-foreground">
                      {recognizedPattern?.default_sale_price 
                        ? `R$ ${Number(recognizedPattern.default_sale_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'Sob Consulta'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] border-t border-emerald-500/20">
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] uppercase">Ano Fab/Mod</span>
                    <strong className="font-mono text-foreground">
                      {resolvedYears?.manufacture_year || 2026} / {resolvedYears?.model_year || 2027}
                    </strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] uppercase">Cilindrada</span>
                    <strong className="text-foreground">{recognizedPattern?.engine_cc ? `${recognizedPattern.engine_cc} cc` : 'N/D'}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] uppercase">Câmbio</span>
                    <strong className="text-foreground capitalize">{recognizedPattern?.transmission || 'Manual'}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background/60 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] uppercase">Garantia</span>
                    <strong className="text-foreground">{recognizedPattern?.warranty_months ? `${recognizedPattern.warranty_months} meses` : '12 meses'}</strong>
                  </div>
                </div>
              </div>

              {/* Ajustes Rápidos de Cadastro: Loja e Cor */}
              <div className="p-4 rounded-xl border bg-card space-y-3 shadow-2xs">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  Dados de Entrada no Pátio
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Loja de Entrada:
                    </Label>
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione a loja..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.city || 'Matriz'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Cor da Moto:
                    </Label>
                    <Select value={selectedColor} onValueChange={setSelectedColor}>
                      <SelectTrigger className="h-8 text-xs font-semibold">
                        <SelectValue placeholder="Cor..." />
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
                    <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Nº Motor (Opcional):
                    </Label>
                    <Input
                      placeholder="Ex: WY152FMH..."
                      value={engineNumber}
                      onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                      className="h-8 text-xs font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Ações Finais: Cadastro com 1 Clique ou Formulário Completo */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetScan}
                  disabled={isRegistering}
                  className="w-full sm:w-auto text-xs h-9"
                >
                  Cancelar / Próximo
                </Button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {onOpenFullForm && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenFullForm(scannedChassis);
                        onOpenChange(false);
                      }}
                      disabled={isRegistering}
                      className="text-xs h-9 gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Completar no Formulário
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleQuickRegister}
                    disabled={isRegistering}
                    className="w-full sm:w-auto text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Gravando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar Entrada no Estoque
                      </>
                    )}
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
