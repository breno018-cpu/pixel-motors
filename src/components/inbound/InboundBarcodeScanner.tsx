import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { 
  Camera, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, 
  Volume2, VolumeX, Flashlight, ArrowRight, X, ShieldAlert, Sparkles, ScanLine,
  ArrowDownCircle, Copy, Check, Building2, Tag, Hash, Bike
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { InboundCargoBatch, InboundCargoItem } from '@/types/inboundCargo';
import { ScanResult } from '@/hooks/useInboundCargo';
import { playSuccessBeep, playErrorAlarm, playWarningTone } from '@/lib/audioFeedback';
import { cn } from '@/lib/utils';

/**
 * Extrai o chassi/VIN limpo de qualquer formato de QR Code ou código de barras
 */
function extractChassisFromQrCode(rawInput: string): string {
  if (!rawInput) return '';
  const text = rawInput.trim();

  // 1. Tenta parse como JSON
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      const val = parsed.chassis || parsed.chassi || parsed.vin || parsed.codigo || parsed.id;
      if (val && typeof val === 'string') {
        return val.toUpperCase().replace(/[^A-Z0-9]/g, '');
      }
    } catch {}
  }

  // 2. Tenta extrair de URL
  if (text.includes('http://') || text.includes('https://')) {
    try {
      const url = new URL(text);
      const val = url.searchParams.get('chassis') || url.searchParams.get('chassi') || url.searchParams.get('vin') || url.searchParams.get('c');
      if (val) return val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    } catch {}
  }

  // 3. Procura padrão VIN de 17 caracteres
  const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  if (vinMatch && vinMatch[1]) {
    return vinMatch[1].toUpperCase();
  }

  // 4. Se contiver delimitadores industriais (; | , : \n)
  if (/[\;\|\,\:\n\r]/.test(text)) {
    const parts = text.split(/[\;\|\,\:\n\r\t]+/);
    for (const p of parts) {
      const clean = p.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (clean.length === 17) return clean;
      if (clean.length >= 7 && (clean.startsWith('99H') || clean.startsWith('9C2') || clean.startsWith('94N'))) {
        return clean;
      }
    }
  }

  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

interface InboundBarcodeScannerProps {
  batch: InboundCargoBatch;
  onScan?: (code: string) => ScanResult;
  onConfirmUnload?: (itemId: string) => void;
  onRecordRejection?: (code: string) => void;
  onClose?: () => void;
}

type ScannedPopupData =
  | {
      type: 'belongs_to_store';
      item: InboundCargoItem;
      rawCode: string;
      extractedCode: string;
    }
  | {
      type: 'not_our_store';
      rawCode: string;
      extractedCode: string;
      message: string;
    }
  | {
      type: 'already_scanned';
      item: InboundCargoItem;
      rawCode: string;
      extractedCode: string;
    };

export function InboundBarcodeScanner({ 
  batch, 
  onScan, 
  onConfirmUnload, 
  onRecordRejection, 
  onClose 
}: InboundBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  
  // Última leitura
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [flashFeedback, setFlashFeedback] = useState<'success' | 'error' | 'warning' | null>(null);
  const [popupData, setPopupData] = useState<ScannedPopupData | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  const checkTorchSupport = useCallback(() => {
    try {
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (track && typeof (track as any).getCapabilities === 'function') {
        const capabilities = (track as any).getCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setTorchAvailable(true);
        }
      }
    } catch {}
  }, []);

  const toggleTorch = useCallback(async () => {
    try {
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (!track) return;
      const next = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }]
      });
      setTorchOn(next);
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  }, [torchOn]);

  // Avalia o QR Code escaneado e abre o popup de decisão
  const handleCodeScanned = useCallback((code: string) => {
    if (isCooldownRef.current || popupData) return;
    isCooldownRef.current = true;

    const cleanInput = extractChassisFromQrCode(code);
    if (!cleanInput || cleanInput.length < 3) {
      isCooldownRef.current = false;
      return;
    }

    // Procura se a moto pertence ao romaneio desta loja
    const matched = batch.items.find((item) => {
      const cleanChassis = item.chassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanEngine = item.engine_number.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanModel = item.model_code.toUpperCase().replace(/[^A-Z0-9]/g, '');

      return (
        cleanChassis === cleanInput ||
        cleanInput.includes(cleanChassis) ||
        cleanChassis.includes(cleanInput) ||
        cleanEngine === cleanInput ||
        cleanModel === cleanInput
      );
    });

    if (matched) {
      if (matched.scanned) {
        // Já conferida anteriormente
        if (soundEnabled) playWarningTone();
        setPopupData({
          type: 'already_scanned',
          item: matched,
          rawCode: code,
          extractedCode: cleanInput,
        });
      } else {
        // MOTO DA NOSSA LOJA! AUTORIZADA PARA DESCER
        if (soundEnabled) playSuccessBeep();
        setPopupData({
          type: 'belongs_to_store',
          item: matched,
          rawCode: code,
          extractedCode: cleanInput,
        });
      }
    } else {
      // NÃO É NOSSO! MOTO DE OUTRA LOJA/DESTINO
      if (soundEnabled) playErrorAlarm();
      if (onRecordRejection) {
        onRecordRejection(cleanInput);
      }
      setPopupData({
        type: 'not_our_store',
        rawCode: code,
        extractedCode: cleanInput,
        message: `Este chassi NÃO pertence à loja ${batch.destination_store}!`,
      });
    }
  }, [batch, soundEnabled, popupData, onRecordRejection]);

  // Inicia ou reinicia o leitor de vídeo com fallback resiliente
  const startCamera = useCallback(async (retryCount = 0) => {
    if (!videoRef.current) {
      if (retryCount < 8) {
        setTimeout(() => startCamera(retryCount + 1), 120);
      }
      return;
    }
    setCameraError(null);

    try {
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
        controlsRef.current = null;
      }

      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      const onScanCallback = (result: any) => {
        if (result && !isCooldownRef.current) {
          const text = result.getText?.();
          if (text && text.trim().length > 3) {
            handleCodeScanned(text.trim());
          }
        }
      };

      let controls: IScannerControls;
      try {
        controls = await readerRef.current.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          onScanCallback
        );
      } catch {
        controls = await readerRef.current.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          onScanCallback
        );
      }

      controlsRef.current = controls;
      setCameraActive(true);
      setTimeout(checkTorchSupport, 500);
    } catch (err: any) {
      console.warn('Câmera indisponível ou permissão negada:', err);
      setCameraError(err?.message || 'Permissão de câmera negada ou câmera ocupada.');
      setCameraActive(false);
    }
  }, [checkTorchSupport, handleCodeScanned]);

  useEffect(() => {
    startCamera();
    return () => {
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {}
      }
      setTorchOn(false);
      setTorchAvailable(false);
    };
  }, [startCamera]);

  // Listener para leitor físico USB / Bluetooth (bipador de mão)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input ativo ou se o popup já estiver aberto
      if (popupData || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
  }, [handleCodeScanned, popupData]);

  // Ação de confirmar a descida da moto (botão verde)
  const handleConfirmDescida = useCallback(() => {
    if (!popupData || popupData.type !== 'belongs_to_store') return;

    if (onConfirmUnload) {
      onConfirmUnload(popupData.item.id);
    } else if (onScan) {
      onScan(popupData.item.chassis);
    }

    if (soundEnabled) playSuccessBeep();

    setLastScanResult({
      type: 'success',
      item: { ...popupData.item, scanned: true },
      message: 'Descida confirmada com sucesso!',
    });
    setFlashFeedback('success');

    // Fecha o popup e libera imediatamente para ler a próxima caixa
    setPopupData(null);
    setTimeout(() => {
      setFlashFeedback(null);
      isCooldownRef.current = false;
    }, 600);
  }, [popupData, onConfirmUnload, onScan, soundEnabled]);

  // Fechamento do popup
  const handleClosePopup = useCallback(() => {
    setPopupData(null);
    setTimeout(() => {
      isCooldownRef.current = false;
    }, 400);
  }, []);

  // Atalhos de teclado no Popup (Enter / Espaço / Esc)
  useEffect(() => {
    if (!popupData) return;

    const handlePopupKeys = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (popupData.type === 'belongs_to_store') {
          handleConfirmDescida();
        } else {
          handleClosePopup();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClosePopup();
      }
    };

    window.addEventListener('keydown', handlePopupKeys);
    return () => window.removeEventListener('keydown', handlePopupKeys);
  }, [popupData, handleConfirmDescida, handleClosePopup]);

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
          {torchAvailable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTorch}
              className={cn(
                "h-8 px-2.5 text-xs gap-1.5 transition-colors",
                torchOn ? "bg-amber-500/20 text-amber-600 border-amber-500/50" : "text-muted-foreground"
              )}
              title={torchOn ? 'Desligar lanterna' : 'Ligar lanterna da câmera'}
            >
              <Flashlight className={cn("w-3.5 h-3.5", torchOn && "text-amber-500 animate-pulse")} />
              <span>{torchOn ? 'Lanterna On' : 'Lanterna'}</span>
            </Button>
          )}

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

      {/* POPUP DE CONFIRMAÇÃO DE DESCIDA OU ALERTA ANTI-TROCA */}
      <Dialog open={!!popupData} onOpenChange={(open) => { if (!open) handleClosePopup(); }}>
        <DialogContent className={cn(
          "max-w-lg p-0 overflow-hidden rounded-2xl border-2 shadow-2xl transition-all duration-200",
          popupData?.type === 'belongs_to_store' && "border-emerald-500 bg-card",
          popupData?.type === 'not_our_store' && "border-red-600 bg-card",
          popupData?.type === 'already_scanned' && "border-amber-500 bg-card"
        )}>
          {popupData?.type === 'belongs_to_store' && (
            <div className="flex flex-col">
              {/* Header Verde de Aprovação */}
              <div className="bg-emerald-500/15 border-b border-emerald-500/30 p-5 flex items-center gap-3.5">
                <div className="h-14 w-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/30">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px] font-black uppercase tracking-wider mb-1">
                    ✓ MOTO DESTA LOJA CONFIRMADA
                  </div>
                  <h3 className="font-display font-black text-xl text-foreground tracking-tight leading-tight">
                    AUTORIZADA PARA DESCER!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Destino: <strong className="text-foreground">{batch.destination_store}</strong> • Lote: <span className="font-mono">{batch.batch_code}</span>
                  </p>
                </div>
              </div>

              {/* Ficha da Moto */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Modelo Identificado</span>
                    <h2 className="text-2xl font-black font-display text-foreground tracking-tight">
                      {popupData.item.model_name || popupData.item.model_code}
                    </h2>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold">
                    {popupData.item.group_cc}cc
                  </Badge>
                </div>

                {/* Box de Chassi em Destaque Máximo */}
                <div className="space-y-1.5">
                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-primary" /> Número do Chassi (VIN)
                  </span>
                  <div className="p-3.5 rounded-xl bg-muted/80 border border-border flex items-center justify-between gap-3">
                    <span className="font-mono font-black text-lg sm:text-xl text-foreground tracking-wider select-all">
                      {popupData.item.chassis}
                    </span>
                    <Badge variant="secondary" className="font-bold text-[10px]">
                      {popupData.item.primary_color}
                      {popupData.item.secondary_color && popupData.item.secondary_color !== '-' && ` (${popupData.item.secondary_color})`}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-xl border border-border/50">
                  <div>
                    <span className="text-muted-foreground block text-[10.5px]">Nº do Motor:</span>
                    <span className="font-mono font-bold text-foreground">{popupData.item.engine_number || '---'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10.5px]">Ano Modelo:</span>
                    <span className="font-mono font-bold text-foreground">{popupData.item.manufacture_year}/{popupData.item.model_year}</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="p-5 pt-0 space-y-2">
                <Button
                  size="lg"
                  onClick={handleConfirmDescida}
                  className="w-full h-14 text-base font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 gap-2.5 rounded-xl uppercase tracking-wider"
                >
                  <ArrowDownCircle className="w-6 h-6 stroke-[2.5]" />
                  <span>Confirmar Descida da Caixa (Enter)</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClosePopup}
                  className="w-full text-xs text-muted-foreground hover:text-foreground h-9"
                >
                  Cancelar / Manter no Caminhão por enquanto
                </Button>
              </div>
            </div>
          )}

          {popupData?.type === 'not_our_store' && (
            <div className="flex flex-col">
              {/* Header Vermelho de Alerta */}
              <div className="bg-red-600/15 border-b border-red-600/30 p-5 flex items-center gap-3.5">
                <div className="h-14 w-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/30 animate-pulse">
                  <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600 text-white font-mono text-[10px] font-black uppercase tracking-wider mb-1">
                    ⛔ BLOQUEIO DE SEGURANÇA
                  </div>
                  <h3 className="font-display font-black text-xl text-red-600 dark:text-red-400 tracking-tight leading-tight">
                    ESTA MOTO NÃO É DESTA LOJA!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    NÃO descarregue do caminhão — deixe na carreta!
                  </p>
                </div>
              </div>

              {/* Corpo de Alerta */}
              <div className="p-5 space-y-3.5">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                  <p className="text-xs text-red-950 dark:text-red-200 leading-relaxed">
                    O QR Code / Chassi lido <strong>NÃO consta no romaneio</strong> oficial de entrega de <strong>{batch.destination_store}</strong>.
                  </p>
                  <div className="p-3 bg-background/90 rounded-lg border border-red-500/20 text-center font-mono font-black text-lg text-red-600 dark:text-red-400 select-all">
                    {popupData.extractedCode}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Esta caixa pertence a outra filial ou cliente da rota. Mantenha no caminhão para evitar troca de carga.
                  </p>
                </div>
              </div>

              {/* Botão de Fechamento */}
              <div className="p-5 pt-0">
                <Button
                  size="lg"
                  onClick={handleClosePopup}
                  className="w-full h-13 text-sm font-black bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 gap-2 rounded-xl uppercase tracking-wider"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                  <span>Entendido — Deixar no Caminhão (Enter)</span>
                </Button>
              </div>
            </div>
          )}

          {popupData?.type === 'already_scanned' && (
            <div className="flex flex-col">
              <div className="bg-amber-500/15 border-b border-amber-500/30 p-5 flex items-center gap-3.5">
                <div className="h-14 w-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-600 text-white font-mono text-[10px] font-black uppercase tracking-wider mb-1">
                    ⚠️ MOTO JÁ CONFERIDA
                  </div>
                  <h3 className="font-display font-black text-xl text-foreground tracking-tight leading-tight">
                    Caixa Já Descarregada
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Esta moto já foi bipada e registrada anteriormente.
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div className="p-3 bg-muted/60 rounded-xl space-y-1">
                  <p className="font-bold text-foreground text-sm font-display">
                    {popupData.item.model_name || popupData.item.model_code}
                  </p>
                  <p className="font-mono text-muted-foreground">
                    Chassi: <strong>{popupData.item.chassis}</strong>
                  </p>
                  {popupData.item.scanned_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Descarregada em: {new Date(popupData.item.scanned_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-5 pt-0">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleClosePopup}
                  className="w-full h-12 text-sm font-bold border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl"
                >
                  Entendido / Bipar Próxima Caixa (Enter)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
