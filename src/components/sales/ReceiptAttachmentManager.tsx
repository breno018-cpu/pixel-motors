import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  ExternalLink,
  Eye,
  Download,
  Plus,
  FileText,
  CheckCircle2,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  X,
  FileImage,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentReceipt {
  id: string;
  name: string;
  url: string;
  uploaded_at: string;
  size?: number;
  type?: string;
}

const STORAGE_RECEIPTS_PREFIX = 'dealflow_sale_receipts_';

export function getSaleReceipts(saleId: string): PaymentReceipt[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_RECEIPTS_PREFIX}${saleId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler comprovantes:', e);
  }
  return [];
}

export function saveSaleReceipts(saleId: string, receipts: PaymentReceipt[]): void {
  try {
    localStorage.setItem(`${STORAGE_RECEIPTS_PREFIX}${saleId}`, JSON.stringify(receipts));
  } catch (e) {
    console.error('Erro ao salvar comprovantes:', e);
  }
}

export async function addReceiptFileToSale(saleId: string, file: File): Promise<PaymentReceipt> {
  const base64Url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  try {
    const path = `receipts/${saleId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    await supabase.storage.from('contract-assets').upload(path, file, { upsert: true });
  } catch {
    // offline/fallback base64
  }

  const newReceipt: PaymentReceipt = {
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    url: base64Url,
    uploaded_at: new Date().toISOString(),
    size: file.size,
    type: file.type,
  };

  const current = getSaleReceipts(saleId);
  const updated = [...current, newReceipt];
  saveSaleReceipts(saleId, updated);
  return newReceipt;
}

interface ReceiptAttachmentManagerProps {
  saleId: string;
  saleTitle?: string;
  readOnly?: boolean;
  onReceiptsChange?: (receipts: PaymentReceipt[]) => void;
}

export function ReceiptAttachmentManager({
  saleId,
  saleTitle,
  readOnly = false,
  onReceiptsChange,
}: ReceiptAttachmentManagerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>(() => getSaleReceipts(saleId));
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Lightbox State
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);

  const activeReceipt = activeLightboxIndex !== null ? receipts[activeLightboxIndex] : null;

  // Processamento de lista de arquivos
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const newItems: PaymentReceipt[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const item = await addReceiptFileToSale(saleId, file);
        newItems.push(item);
      } catch (err) {
        console.error('Erro ao processar comprovante:', err);
      }
    }

    const updated = [...receipts, ...newItems];
    setReceipts(updated);
    saveSaleReceipts(saleId, updated);
    if (onReceiptsChange) onReceiptsChange(updated);

    // Sincroniza diretamente na tabela contracts se não for ID temporário
    if (saleId && !saleId.startsWith('sale-temp-')) {
      try {
        const { data: contract } = await supabase
          .from('contracts')
          .select('external_data')
          .eq('id', saleId)
          .maybeSingle();

        if (contract) {
          const ext = (contract.external_data as any) || {};
          await supabase
            .from('contracts')
            .update({
              external_data: {
                ...ext,
                receipts: updated,
              },
            } as any)
            .eq('id', saleId);
        }
      } catch (e) {
        console.warn('Erro ao sincronizar comprovantes no Supabase:', e);
      }
    }

    toast({
      title: `${newItems.length} comprovante(s) anexado(s)!`,
      description: 'Salvo com sucesso na venda.',
    });

    setIsUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  // Drag and Drop de arquivos na caixa
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!readOnly) setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (readOnly) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Comprovante?',
      description: 'Deseja realmente remover este comprovante de pagamento anexado?',
      confirmText: 'Excluir Comprovante',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    const updated = receipts.filter((r) => r.id !== id);
    setReceipts(updated);
    saveSaleReceipts(saleId, updated);
    if (onReceiptsChange) onReceiptsChange(updated);
    if (activeLightboxIndex !== null && receipts[activeLightboxIndex]?.id === id) {
      setActiveLightboxIndex(null);
    }

    if (saleId && !saleId.startsWith('sale-temp-')) {
      supabase
        .from('contracts')
        .select('external_data')
        .eq('id', saleId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const ext = (data.external_data as any) || {};
            supabase
              .from('contracts')
              .update({
                external_data: {
                  ...ext,
                  receipts: updated,
                },
              } as any)
              .eq('id', saleId)
              .then(() => {});
          }
        });
    }

    toast({ title: 'Comprovante removido' });
  };

  // Lightbox navigation
  const handleOpenLightbox = (index: number) => {
    setActiveLightboxIndex(index);
    setZoomLevel(1);
    setRotationDegrees(0);
  };

  const handleCloseLightbox = () => {
    setActiveLightboxIndex(null);
    setZoomLevel(1);
    setRotationDegrees(0);
  };

  const handleNext = useCallback(() => {
    if (activeLightboxIndex !== null && receipts.length > 0) {
      setActiveLightboxIndex((activeLightboxIndex + 1) % receipts.length);
      setZoomLevel(1);
      setRotationDegrees(0);
    }
  }, [activeLightboxIndex, receipts.length]);

  const handlePrev = useCallback(() => {
    if (activeLightboxIndex !== null && receipts.length > 0) {
      setActiveLightboxIndex((activeLightboxIndex - 1 + receipts.length) % receipts.length);
      setZoomLevel(1);
      setRotationDegrees(0);
    }
  }, [activeLightboxIndex, receipts.length]);

  // Keyboard navigation inside lightbox
  useEffect(() => {
    if (activeLightboxIndex === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') handleCloseLightbox();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeLightboxIndex, handleNext, handlePrev]);

  return (
    <div className="space-y-3">
      {/* Barra de Título & Ação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            Galeria de Comprovantes ({receipts.length})
          </span>
          {receipts.length > 0 && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-bold">
              {receipts.length === 1 ? '1 Anexo' : `${receipts.length} Anexos`}
            </Badge>
          )}
        </div>

        {!readOnly && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 px-2.5 gap-1.5 text-xs font-semibold bg-background hover:bg-primary/5 hover:border-primary/40"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Processando...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Adicionar Comprovantes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Dropzone & Grid de Imagens */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`transition-all rounded-2xl ${
          isDraggingOver
            ? 'border-2 border-dashed border-primary bg-primary/10 ring-2 ring-primary/20 scale-[0.99]'
            : ''
        }`}
      >
        {receipts.length === 0 ? (
          <div
            onClick={() => !readOnly && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              !readOnly
                ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 bg-muted/10'
                : 'bg-muted/10'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-foreground">
              {readOnly ? 'Nenhum comprovante anexado a esta venda.' : 'Arraste e solte fotos/recibos aqui'}
            </p>
            {!readOnly && (
              <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto">
                Ou clique para selecionar fotos de comprovantes de PIX, financiamento, TED, cartão ou canhotos. Suporta múltiplos arquivos simultaneamente.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {receipts.map((rec, idx) => {
                const isPdf = rec.type?.includes('pdf') || rec.name.toLowerCase().endsWith('.pdf');

                return (
                  <div
                    key={rec.id}
                    className="group relative rounded-xl border bg-card p-2 shadow-xs hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* Thumbnail com Zoom / Click para Lightbox */}
                    <div
                      onClick={() => handleOpenLightbox(idx)}
                      className="w-full h-28 rounded-lg bg-muted/30 overflow-hidden flex items-center justify-center cursor-pointer relative"
                    >
                      {isPdf ? (
                        <div className="flex flex-col items-center gap-1.5 text-muted-foreground p-2 text-center">
                          <FileText className="w-8 h-8 text-primary" />
                          <span className="text-[10px] font-bold line-clamp-1">{rec.name}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">PDF</Badge>
                        </div>
                      ) : (
                        <img
                          src={rec.url}
                          alt={rec.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      )}

                      {/* Overlay com ação ao passar o mouse */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                        <ZoomIn className="w-5 h-5 drop-shadow" />
                        <span className="text-[11px] font-bold">Ver Grande</span>
                      </div>

                      {/* Badge sequencial */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold backdrop-blur">
                        #{idx + 1}
                      </div>
                    </div>

                    {/* Detalhes do comprovante */}
                    <div className="pt-2 text-[10px] space-y-0.5">
                      <div className="font-semibold text-foreground truncate" title={rec.name}>
                        {rec.name}
                      </div>
                      <div className="text-muted-foreground text-[9px] flex justify-between">
                        <span>
                          {new Date(rec.uploaded_at).toLocaleDateString('pt-BR')}
                        </span>
                        {rec.size && (
                          <span>{(rec.size / 1024).toFixed(0)} KB</span>
                        )}
                      </div>
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div className="flex items-center justify-between pt-1.5 border-t mt-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenLightbox(idx)}
                        className="h-6 px-1.5 text-[10px] gap-1 text-primary hover:bg-primary/10 font-bold"
                      >
                        <Eye className="w-3 h-3" /> Abrir
                      </Button>

                      <div className="flex items-center gap-0.5">
                        <a
                          href={rec.url}
                          download={rec.name}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground p-1 rounded"
                          title="Baixar comprovante"
                        >
                          <Download className="w-3 h-3" />
                        </a>

                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDelete(rec.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            title="Remover anexo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dropzone sutil para anexar mais imagens */}
            {!readOnly && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-2 border border-dashed rounded-xl text-center text-[11px] text-muted-foreground hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Arraste mais comprovantes aqui ou clique para selecionar</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LIGHTBOX FORA DA CURVA: VISUALIZADOR DE IMAGENS EM TELA CHEIA COM CARROSSEL, ZOOM E ROTAÇÃO */}
      <Dialog open={activeLightboxIndex !== null} onOpenChange={(open) => !open && handleCloseLightbox()}>
        <DialogContent className="max-w-4xl max-h-[92vh] rounded-3xl p-4 flex flex-col bg-background/95 backdrop-blur-xl border border-border shadow-2xl overflow-hidden">
          {activeReceipt && (
            <>
              {/* Cabeçalho do Lightbox */}
              <div className="flex items-center justify-between border-b pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <FileImage className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate max-w-sm">
                      {activeReceipt.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Foto {(activeLightboxIndex ?? 0) + 1} de {receipts.length} • {saleTitle || 'Venda'}
                    </p>
                  </div>
                </div>

                {/* Controles de Zoom e Rotação */}
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                    className="h-8 px-2 text-xs gap-1"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline font-mono">{(zoomLevel * 100).toFixed(0)}%</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    className="h-8 px-2 text-xs"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRotationDegrees((r) => (r + 90) % 360)}
                    className="h-8 px-2 text-xs gap-1"
                    title="Girar Imagem (90°)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Girar</span>
                  </Button>

                  <a href={activeReceipt.url} download={activeReceipt.name} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1 font-semibold">
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Baixar</span>
                    </Button>
                  </a>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCloseLightbox}
                    className="h-8 w-8 p-0 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Área Central da Imagem com Botões de Anterior / Próximo */}
              <div className="relative flex-1 min-h-[350px] max-h-[60vh] overflow-hidden flex items-center justify-center bg-muted/20 rounded-2xl my-3 p-4 select-none">
                {/* Botão Anterior */}
                {receipts.length > 1 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur shadow-lg transition-transform hover:scale-110 z-10"
                    title="Comprovante Anterior (Seta Esquerda)"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                {/* Conteúdo (Imagem ou PDF) */}
                <div
                  className="transition-transform duration-200 flex items-center justify-center max-w-full max-h-full"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotationDegrees}deg)`,
                  }}
                >
                  {activeReceipt.type?.includes('pdf') || activeReceipt.name.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={activeReceipt.url}
                      className="w-[800px] h-[50vh] rounded-xl border bg-white"
                      title={activeReceipt.name}
                    />
                  ) : (
                    <img
                      src={activeReceipt.url}
                      alt={activeReceipt.name}
                      className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-lg"
                    />
                  )}
                </div>

                {/* Botão Próximo */}
                {receipts.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur shadow-lg transition-transform hover:scale-110 z-10"
                    title="Próximo Comprovante (Seta Direita)"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Faixa Inferior de Miniaturas (Thumbnail Strip) */}
              {receipts.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 border-t shrink-0">
                  {receipts.map((rec, i) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => handleOpenLightbox(i)}
                      className={`h-12 w-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        i === activeLightboxIndex
                          ? 'border-primary ring-2 ring-primary/40 scale-105'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      {rec.type?.includes('pdf') ? (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-[9px] font-bold">
                          PDF
                        </div>
                      ) : (
                        <img src={rec.url} alt={rec.name} className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
