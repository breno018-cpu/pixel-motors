import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { 
  Camera, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, 
  Volume2, VolumeX, Flashlight, ArrowRight, X, ShieldAlert, Sparkles, ScanLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InboundCargoBatch, InboundCargoItem } from '@/types/inboundCargo';
import { ScanResult } from '@/hooks/useInboundCargo';
import { cn } from '@/lib/utils';

interface InboundBarcodeScannerProps {
  batch: InboundCargoBatch;
  onScan: (code: string) => ScanResult;
  onClose?: () => void;
}

export function InboundBarcodeScanner({ batch, onScan, onClose }: InboundBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Última leitura
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [flashFeedback, setFlashFeedback] = useState<'success' | 'error' | 'warning' | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  // Inicia ou reinicia o leitor de vídeo
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);

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
        (result, error) => {
          if (result && !isCooldownRef.current) {
            const text = result.getText();
            if (text && text.trim().length > 3) {
              handleCodeScanned(text.trim());
            }
          }
        }
      );

      controlsRef.current = controls;
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Câmera indisponível ou permissão negada:', err);
      setCameraError(err?.message || 'Permissão de câmera negada ou câmera ocupada.');
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {}
      }
    };
  }, [startCamera]);

  // Listener para leitor físico USB / Bluetooth (bipador de mão)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input ativo
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 300) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length >= 4) {
          handleCodeScanned(buffer.trim());
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCodeScanned = (code: string) => {
    if (isCooldownRef.current) return;
    isCooldownRef.current = true;

    const res = onScan(code);
    setLastScanResult(res);

    if (res.type === 'success') {
      setFlashFeedback('success');
    } else if (res.type === 'not_found') {
      setFlashFeedback('error');
    } else {
      setFlashFeedback('warning');
    }

    // Cooldown de 1.2 segundos para evitar bipagem dupla da mesma caixa em loop de frame
    setTimeout(() => {
      setFlashFeedback(null);
      isCooldownRef.current = false;
    }, 1200);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCodeScanned(manualInput.trim());
    setManualInput('');
  };

  const progressPercent = Math.round((batch.scanned_items / Math.max(1, batch.total_items)) * 100);

  return (
    <div className="relative flex flex-col w-full max-w-2xl mx-auto rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
      {/* Top Header do Scanner */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/60 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-red-600/10 border border-red-600/20 text-red-600 flex items-center justify-center">
            <ScanLine className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-1.5">
              Scanner de Bipagem de Descarga
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Lote: <span className="font-mono font-medium text-foreground">{batch.batch_code}</span> • Destino: <span className="font-semibold text-foreground">{batch.destination_store}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Placar de Progresso em Tempo Real */}
      <div className="px-4 py-2.5 bg-background border-b border-border flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="text-muted-foreground">Caixas Descarregadas da Loja:</span>
            <span className="font-mono text-foreground font-bold">
              {batch.scanned_items} de {batch.total_items} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                progressPercent === 100 ? "bg-emerald-500" : "bg-red-600"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {batch.divergent_items > 0 && (
          <Badge variant="destructive" className="animate-pulse flex items-center gap-1 shrink-0 font-bold text-xs py-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {batch.divergent_items} Alerta{batch.divergent_items > 1 ? 's' : ''} de Rejeição
          </Badge>
        )}
      </div>

      {/* Visor de Câmera com Laser Guia */}
      <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Mira Laser e Borda de Enquadramento */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="relative w-4/5 max-w-sm h-36 border-2 border-white/60 rounded-xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
            {/* Cantos destacados */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500" />

            {/* Linha Laser vermelha animada */}
            <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-bounce my-auto mt-16" />
          </div>
        </div>

        {/* Feedback Visual Flash Overlay */}
        {flashFeedback === 'success' && (
          <div className="pointer-events-none absolute inset-0 bg-emerald-500/35 border-4 border-emerald-500 flex flex-col items-center justify-center animate-fade-in backdrop-blur-xs">
            <div className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg mb-2">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <span className="font-display font-black text-white text-lg tracking-wide uppercase drop-shadow-md">
              MOTO CONFIRMADA! PODE DESCER
            </span>
          </div>
        )}

        {flashFeedback === 'error' && (
          <div className="pointer-events-none absolute inset-0 bg-red-600/60 border-4 border-red-600 flex flex-col items-center justify-center animate-fade-in backdrop-blur-xs">
            <div className="h-16 w-16 rounded-full bg-white text-red-600 flex items-center justify-center shadow-lg mb-2 animate-bounce">
              <ShieldAlert className="w-10 h-10 stroke-[2.5]" />
            </div>
            <span className="font-display font-black text-white text-xl tracking-wide uppercase drop-shadow-md text-center px-4">
              ⛔ NÃO PERTENCE A ESTA LOJA! DEIXE NO CAMINHÃO
            </span>
          </div>
        )}

        {flashFeedback === 'warning' && (
          <div className="pointer-events-none absolute inset-0 bg-amber-500/35 border-4 border-amber-500 flex flex-col items-center justify-center animate-fade-in backdrop-blur-xs">
            <div className="h-16 w-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg mb-2">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <span className="font-display font-black text-white text-base tracking-wide uppercase drop-shadow-md text-center px-4">
              MOTO JÁ BIPADA ANTERIORMENTE
            </span>
          </div>
        )}

        {/* Mensagem se câmera falhar */}
        {cameraError && (
          <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
            <p className="text-sm font-semibold text-foreground mb-1">Câmera não iniciada</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">{cameraError}</p>
            <Button size="sm" onClick={startCamera} variant="outline" className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
            </Button>
          </div>
        )}
      </div>

      {/* Card do Último Resultado Bipado */}
      {lastScanResult && (
        <div className={cn(
          "px-4 py-3 border-b text-sm transition-colors",
          lastScanResult.type === 'success' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100",
          lastScanResult.type === 'not_found' && "bg-red-500/15 border-red-500/40 text-red-950 dark:text-red-100",
          lastScanResult.type === 'already_scanned' && "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
        )}>
          {lastScanResult.type === 'success' && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-sm font-display">
                    {lastScanResult.item.model_name || lastScanResult.item.model_code}
                  </span>
                  <Badge variant="outline" className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-600/30 font-mono text-[10px]">
                    {lastScanResult.item.group_cc}cc
                  </Badge>
                  <span className="text-xs font-semibold">
                    Cor: {lastScanResult.item.primary_color}
                    {lastScanResult.item.secondary_color && lastScanResult.item.secondary_color !== '-' && ` (${lastScanResult.item.secondary_color})`}
                  </span>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  Chassi: <strong className="text-foreground">{lastScanResult.item.chassis}</strong> • Motor: {lastScanResult.item.engine_number}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  ✓ Moto validada com 100% de precisão para {lastScanResult.item.destination_store}.
                </p>
              </div>
            </div>
          )}

          {lastScanResult.type === 'not_found' && (
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="font-extrabold text-red-600 dark:text-red-400 text-sm font-display tracking-tight">
                  ⛔ ATENÇÃO! ESTA MOTO NÃO DEVE DESCER DO CAMINHÃO!
                </p>
                <p className="text-xs text-foreground mt-0.5">
                  O código ou chassi <strong className="font-mono text-red-600">{lastScanResult.scannedCode}</strong> NÃO consta no manifesto de entrega de <strong>{batch.destination_store}</strong>.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Certifique-se de que a caixa permaneça no caminhão para a rota seguinte.
                </p>
              </div>
            </div>
          )}

          {lastScanResult.type === 'already_scanned' && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-amber-700 dark:text-amber-400 text-xs">
                  Caixa já conferida anteriormente!
                </span>
                <p className="text-xs text-muted-foreground">
                  Chassi {lastScanResult.item.chassis} ({lastScanResult.item.model_name}) já foi registrado nesta descarga.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rodapé: Entrada Manual / Bipador USB */}
      <div className="p-3 bg-card border-t border-border">
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <Input
            placeholder="Digitar chassi (ou bipar com leitor USB/Bluetooth)..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="text-xs h-9 font-mono"
          />
          <Button type="submit" size="sm" className="h-9 px-4 shrink-0 bg-red-600 hover:bg-red-700 text-white font-semibold">
            Bipar / Validar
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center justify-between">
          <span>Dica: Leitor USB ou câmera reconhecem instantaneamente o código da caixa.</span>
          <span className="font-mono font-medium">{batch.items.filter(i => !i.scanned).length} pendentes no caminhão</span>
        </p>
      </div>
    </div>
  );
}
