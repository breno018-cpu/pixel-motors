import { useState, useRef } from 'react';
import { 
  Shield, Download, Eye, Sparkles, Check, Copy, Palette, 
  Layers, CircleDot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PixelAutomotiveEmblem, PixelMotorsLogo } from './PixelLoomLogo';

export function BrandLogoShowcase() {
  const { toast } = useToast();
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [activePreviewBg, setActivePreviewBg] = useState<'dark' | 'light' | 'slate' | 'white'>('dark');
  const [isExporting, setIsExporting] = useState(false);
  const emblemSvgRef = useRef<HTMLDivElement>(null);
  const whiteEmblemSvgRef = useRef<HTMLDivElement>(null);

  const brandColors = [
    { name: 'Vermelho Racing Performance', hex: '#DC2626', role: 'Lâmina de Aceleração & Identidade', textLight: true },
    { name: 'Titânio Escovado', hex: '#CBD5E1', role: 'Aerofólio Superior & Curva Dinâmica', textLight: false },
    { name: 'Prata Cromada Pura', hex: '#FFFFFF', role: 'Pilar Inclinado a 18° & Monograma', textLight: false },
    { name: 'Grafite Chassis', hex: '#1E293B', role: 'Linha de Base & Sombra Metálica', textLight: true },
    { name: 'Preto Ônix Profundo', hex: '#0F172A', role: 'Fundo Corporativo de Alto Contraste', textLight: true },
  ];

  const handleCopyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    toast({
      title: 'Cor copiada!',
      description: `${hex} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const handleDownloadSvg = (variantType: 'chrome' | 'white' = 'chrome') => {
    try {
      const container = variantType === 'white' ? whiteEmblemSvgRef.current : emblemSvgRef.current;
      const svgElement = container?.querySelector('svg');
      if (!svgElement) return;

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = variantType === 'white' ? 'pixel-motors-vetor-branco-puro.svg' : 'pixel-motors-emblem-chrome.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Concluído!',
        description: variantType === 'white'
          ? 'Vetor SVG Branco Puro (sem partes pretas) baixado com sucesso!'
          : 'Vetor SVG Cromado / Platina baixado com sucesso!',
      });
    } catch {
      toast({
        title: 'Erro ao baixar SVG',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPng = async (multiplier = 16) => {
    setIsExporting(true);
    try {
      const svgElement = emblemSvgRef.current?.querySelector('svg');
      if (!svgElement) return;

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL;
      const blobURL = URLObj.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100 * multiplier;
        canvas.height = 100 * multiplier;
        const context = canvas.getContext('2d');
        if (context) {
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `pixel-motors-emblem-${canvas.width}x${canvas.height}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URLObj.revokeObjectURL(blobURL);
        }
        setIsExporting(false);
        toast({
          title: 'PNG em Alta Resolução Exportado!',
          description: `Dimensões: ${100 * multiplier}x${100 * multiplier}px com transparência.`,
        });
      };
      image.src = blobURL;
    } catch {
      setIsExporting(false);
      toast({
        title: 'Falha ao exportar PNG',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal com Apresentação da Marca Sóbria */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#0B0F17] via-[#111827] to-[#070B10] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-8 bottom-4 opacity-15 pointer-events-none hidden md:block">
          <PixelAutomotiveEmblem size={140} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <Badge className="bg-red-950/80 text-red-400 border-red-800/60 text-xs font-semibold px-3 py-1">
                DESIGN PROJETADO DO ZERO
              </Badge>
              <Badge variant="outline" className="text-zinc-300 border-white/20 text-xs">
                Aero Blade de Alta Performance
              </Badge>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white flex items-center gap-3">
              PIXEL <span className="text-red-500 font-bold">MOTORS</span>
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              Totalmente reconstruída do absoluto zero: silhueta monolítica em lâminas chanfradas a 18°, pilar estrutural em titânio e defletor inferior em <strong>Vermelho Racing de Performance</strong>. Zero círculos, zero miras, sem ruídos e com presença imponente de marca automotiva.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            <Button
              onClick={() => handleDownloadSvg('white')}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold shadow-md gap-2 h-10 border border-white"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Baixar Vetor Branco (SVG)
            </Button>
            <Button
              onClick={() => handleDownloadSvg('chrome')}
              variant="outline"
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold gap-2 h-10"
            >
              <Download className="w-4 h-4 text-slate-200" />
              Vetor Cromado (SVG)
            </Button>
            <Button
              onClick={() => handleDownloadPng(16)}
              disabled={isExporting}
              variant="outline"
              className="border-white/20 bg-white/5 hover:bg-white/10 text-white gap-2 h-10"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              {isExporting ? 'Renderizando...' : 'PNG Ultra-HD (1600px)'}
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de Visualização e Teste */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Painel Esquerdo: Visualizador */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2 truncate">
                  <Eye className="w-4 h-4 text-emerald-500 shrink-0" />
                  Visualizador do Emblema &amp; Tipografia
                </CardTitle>
                <CardDescription className="text-xs">
                  Aferição de contraste sobre fundo escuro nobre, fundo claro ou neutro
                </CardDescription>
              </div>

              {/* Seletor de Fundo do Preview */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-border bg-muted/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePreviewBg('dark')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    activePreviewBg === 'dark'
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dark Ônix
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewBg('white')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    activePreviewBg === 'white'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Vetor Branco
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewBg('light')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    activePreviewBg === 'light'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pure Light
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewBg('slate')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    activePreviewBg === 'slate'
                      ? 'bg-slate-800 text-slate-100 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Titânio Slate
                </button>
              </div>
            </CardHeader>

            <CardContent>
              <div
                className={`min-h-[290px] rounded-xl flex flex-col items-center justify-center p-8 transition-colors duration-200 border ${
                  activePreviewBg === 'dark'
                    ? 'bg-[#0B0F17] border-slate-800 text-white'
                    : activePreviewBg === 'white'
                    ? 'bg-slate-950 border-slate-800 text-white'
                    : activePreviewBg === 'light'
                    ? 'bg-gradient-to-b from-slate-50 to-white border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-white'
                }`}
              >
                {/* Referências para exportação SVG */}
                <div ref={emblemSvgRef} className="hidden">
                  <PixelAutomotiveEmblem size={400} variant="default" />
                </div>
                <div ref={whiteEmblemSvgRef} className="hidden">
                  <PixelAutomotiveEmblem size={400} variant="white" />
                </div>

                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="p-3 rounded-full bg-black/30 border border-white/10 shadow-lg">
                    <PixelAutomotiveEmblem size={96} variant={activePreviewBg === 'white' ? 'white' : 'default'} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`font-display font-bold text-3xl sm:text-4xl tracking-tight ${
                          activePreviewBg === 'light' ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        PIXEL
                      </span>
                      <span className={`font-display font-medium text-3xl sm:text-4xl tracking-[0.12em] ${
                        activePreviewBg === 'white' ? 'text-white' : 'text-[#059669] dark:text-[#10B981]'
                      }`}>
                        MOTORS
                      </span>
                    </div>

                    <p
                      className={`text-[10px] font-semibold tracking-[0.24em] uppercase ${
                        activePreviewBg === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      SISTEMA DE CONCESSIONÁRIAS
                    </p>
                  </div>
                </div>
              </div>

              {/* Formatos e Aplicações */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                <div className="p-3 rounded-lg border border-border bg-card/60 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center border border-white/10 shrink-0">
                    <PixelAutomotiveEmblem size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Favicon / App</p>
                    <p className="text-[10px] text-muted-foreground">32px a 64px</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card/60 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center border border-white/10 shrink-0">
                    <PixelAutomotiveEmblem size={28} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Sidebar &amp; Topo</p>
                    <p className="text-[10px] text-muted-foreground">Discreto e limpo</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card/60 flex items-center gap-3 col-span-2 sm:col-span-1">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center border border-white/10 shrink-0">
                    <PixelAutomotiveEmblem size={30} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Contratos e NFs</p>
                    <p className="text-[10px] text-muted-foreground">Vetor oficial</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Paleta de Cores e Guia */}
        <div className="lg:col-span-5 space-y-4">
          
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-500" />
                Paleta Sóbria da Marca
              </CardTitle>
              <CardDescription className="text-xs">
                Cores clássicas de montadora nobre (clique para copiar)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {brandColors.map((c) => (
                <div
                  key={c.hex}
                  onClick={() => handleCopyColor(c.hex)}
                  className="group flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/30 hover:bg-muted/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full border border-black/20 shadow-inner shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-xs font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                      {c.hex}
                    </span>
                    {copiedColor === c.hex ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-emerald-500" />
                Conceito de Montadora Alemã
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                <p className="font-semibold text-foreground">1. Anel Circular em Metal Escovado</p>
                <p className="mt-1">
                  Simetria clássica que confere autoridade, estabilidade e elegância atemporal, como as maiores marcas automotivas mundiais.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <p className="font-semibold text-foreground text-emerald-600 dark:text-emerald-400">
                  2. Verde Esmeralda Nobre &amp; Preto Ônix
                </p>
                <p className="mt-1">
                  Tom sóbrio e aristocrático de corrida clássica (British Racing Green / Deep Emerald), transmitindo solidez sem qualquer elemento chamativo ou infantil.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
export default BrandLogoShowcase;
