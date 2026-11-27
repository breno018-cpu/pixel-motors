import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocxLivePreviewFrameProps {
  blob: Blob | null;
  loading?: boolean;
  emptyMessage?: string;
  heightClassName?: string;
  onIframeReady?: (iframe: HTMLIFrameElement | null) => void;
}

/**
 * Renderiza um arquivo Word (.docx) dentro de um <iframe> 100% isolado do CSS do Tailwind,
 * preservando integralmente bordas de tabelas, linhas tracejadas, fontes, margens, cabeçalhos,
 * rodapés e imagens/logos exatamente nas posições originais do documento.
 */
export function DocxLivePreviewFrame({
  blob,
  loading = false,
  emptyMessage = 'Importe um modelo Word (.docx) para visualizar a renderização fiel.',
  heightClassName = 'h-[620px]',
  onIframeReady,
}: DocxLivePreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | '100'>('fit');
  const [computedScale, setComputedScale] = useState<number>(1);

  useEffect(() => {
    onIframeReady?.(iframeRef.current);
    return () => onIframeReady?.(null);
  }, [onIframeReady]);

  const applyScaleToIframe = (iframe: HTMLIFrameElement, mode: 'fit' | '100') => {
    const doc = iframe.contentDocument;
    if (!doc) return;
    const wrapper = doc.querySelector('.docx-wrapper') as HTMLElement | null;
    const firstPage = doc.querySelector('.docx-wrapper > section.docx') as HTMLElement | null;
    if (!wrapper || !firstPage) return;

    if (mode === '100') {
      wrapper.style.transform = 'none';
      wrapper.style.transformOrigin = 'top center';
      wrapper.style.width = '';
      setComputedScale(1);
      return;
    }

    const availW = Math.max(320, iframe.clientWidth - 28);
    const pageW = firstPage.offsetWidth || 794;
    const scale = Math.min(1, availW / pageW);
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.width = `${pageW + 24}px`;
    setComputedScale(scale);
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (!blob) {
      const doc = iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:system-ui,sans-serif;font-size:12px;color:#71717a;background:#f4f4f5;">${emptyMessage}</body></html>`);
        doc.close();
      }
      return;
    }

    let cancelled = false;
    setRendering(true);
    setRenderError(null);

    (async () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #e4e4e7;
      min-height: 100%;
    }
    #docx-host {
      padding: 12px;
      box-sizing: border-box;
    }
    .docx-wrapper {
      background: transparent !important;
      padding: 0 !important;
      align-items: flex-start !important;
    }
    .docx-wrapper > section.docx {
      background: #ffffff !important;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16) !important;
      margin-bottom: 16px !important;
    }
    @media print {
      @page { size: A4; margin: 0; }
      html, body { background: #ffffff !important; }
      #docx-host { padding: 0 !important; }
      .docx-wrapper {
        transform: none !important;
        width: auto !important;
        padding: 0 !important;
      }
      .docx-wrapper > section.docx {
        box-shadow: none !important;
        margin: 0 auto !important;
      }
    }
  </style>
</head>
<body>
  <div id="docx-host"></div>
</body>
</html>`);
        doc.close();

        const host = doc.getElementById('docx-host');
        if (!host || cancelled) return;

        await renderAsync(blob, host, doc.head, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        if (cancelled) return;
        requestAnimationFrame(() => {
          if (!cancelled && iframeRef.current) {
            applyScaleToIframe(iframeRef.current, zoomMode);
          }
        });
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Falha ao renderizar arquivo .docx');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, emptyMessage]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    applyScaleToIframe(iframe, zoomMode);

    const onResize = () => {
      if (iframeRef.current) applyScaleToIframe(iframeRef.current, zoomMode);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [zoomMode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Zoom: {Math.round(computedScale * 100)}% {zoomMode === 'fit' ? '(Ajustado à largura)' : '(Tamanho real A4)'}
        </span>
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={zoomMode === 'fit' ? 'secondary' : 'ghost'}
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setZoomMode('fit')}
          >
            <Maximize2 className="w-3 h-3" />
            Ajustar
          </Button>
          <Button
            type="button"
            size="sm"
            variant={zoomMode === '100' ? 'secondary' : 'ghost'}
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setZoomMode('100')}
          >
            {zoomMode === '100' ? <ZoomOut className="w-3 h-3" /> : <ZoomIn className="w-3 h-3" />}
            100%
          </Button>
        </div>
      </div>

      <div className={`relative rounded-lg border overflow-hidden bg-zinc-200 dark:bg-zinc-900 ${heightClassName}`}>
        {(loading || rendering) && (
          <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex items-center justify-center text-xs font-medium">
            Renderizando documento Word com formatação original...
          </div>
        )}
        {renderError && (
          <div className="absolute inset-0 z-20 bg-background/95 p-4 flex items-center justify-center text-xs text-destructive text-center">
            Erro ao renderizar .docx: {renderError}
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="Prévia Fiel do Documento Word"
          className="w-full h-full border-0 bg-zinc-200"
        />
      </div>
    </div>
  );
}
