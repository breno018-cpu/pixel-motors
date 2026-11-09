import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CloudMonthlySpreadsheet } from '@/components/sheets/CloudMonthlySpreadsheet';
import { CustomSpreadsheetManager } from '@/components/sheets/CustomSpreadsheetManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Cloud,
  FileSpreadsheet,
  Settings2,
  ExternalLink,
  Globe,
  CheckCircle2,
  Sparkles,
  Copy,
  Download,
  Check,
  ClipboardPaste,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { exportDealershipWorksheetMultiStore } from '@/lib/export';
import {
  parseBackupCsv,
  ONEDRIVE_DEFAULT_URL,
  getLiveSheetRows,
  serializeRowsToTsv,
  SHEET_STORAGE_KEY_V9,
  formatCurrencyBRL,
  SheetRowV9,
} from '@/lib/dealershipSheetParser';

const ONEDRIVE_URL_STORAGE_KEY = 'dealflow_onedrive_url_v1';

export default function Spreadsheets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'mensal' | 'excel_web' | 'livre'>('mensal');
  const [cloudUrl, setCloudUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(ONEDRIVE_URL_STORAGE_KEY) || ONEDRIVE_DEFAULT_URL;
    } catch {
      return ONEDRIVE_DEFAULT_URL;
    }
  });
  const [editingUrl, setEditingUrl] = useState(false);
  const [tempUrl, setTempUrl] = useState(cloudUrl);
  const [copied, setCopied] = useState(false);
  const [pasteBoxText, setPasteBoxText] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; colKey: keyof SheetRowV9; colLetter: string }>({
    rowIdx: 0,
    colKey: 'cliente',
    colLetter: 'G',
  });
  const [quickDraft, setQuickDraft] = useState({
    vendedor: 'Geibriel',
    data: new Date().toLocaleDateString('pt-BR'),
    chassi: '99HSHF250VS009919',
    modelo: 'SHI 250 EFI',
    cliente: '',
    regiao: 'DIVINOPOLIS',
    valor: '23330',
    financiamento: '15330',
    banco: 'ALTIS',
    dinheiro: '0',
    pix: '8000',
    observacoes: 'Venda lançada no Excel Online Web',
  });

  const { data: liveRows = [] } = useQuery<SheetRowV9[]>({
    queryKey: ['cloud-monthly-sheet-v9'],
    queryFn: async () => getLiveSheetRows(),
    staleTime: 10_000,
  });

  const updateLiveRows = (nextRows: SheetRowV9[]) => {
    localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(nextRows));
    queryClient.setQueryData(['cloud-monthly-sheet-v9'], nextRows);
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
  };

  const handleCellChangeInExcelWeb = (rowId: string, field: keyof SheetRowV9, rawValue: string) => {
    const numericFields: (keyof SheetRowV9)[] = [
      'valor',
      'financiamento',
      'dinheiro',
      'pix',
      'carta_credito',
      'cartao',
      'boleto',
      'custos',
      'total',
    ];
    const nextRows = liveRows.map((r) => {
      if (r.id !== rowId) return r;
      const copy: SheetRowV9 = { ...r };
      if (numericFields.includes(field)) {
        const cleaned = rawValue.replace(/[^\d.,-]/g, '').replace(',', '.');
        (copy as any)[field] = parseFloat(cleaned) || 0;
        if (field !== 'total') {
          const sum =
            (copy.financiamento || 0) +
            (copy.dinheiro || 0) +
            (copy.pix || 0) +
            (copy.carta_credito || 0) +
            (copy.cartao || 0) +
            (copy.boleto || 0);
          copy.total = sum > 0 ? sum : copy.valor;
        }
      } else {
        (copy as any)[field] = rawValue;
      }
      return copy;
    });
    updateLiveRows(nextRows);
  };

  const handleRunExcelFillTest = () => {
    const currentRows = liveRows.length > 0 ? liveRows : getLiveSheetRows();
    const nextQt = String(currentRows.length + 1).padStart(2, '0');
    const valorNum = Number(quickDraft.valor) || 23330;
    const finNum = Number(quickDraft.financiamento) || 15330;
    const pixNum = Number(quickDraft.pix) || 8000;
    const dinNum = Number(quickDraft.dinheiro) || 0;
    const totalNum = finNum + pixNum + dinNum || valorNum;

    const newTestRow: SheetRowV9 = {
      id: `row-v9-2026-10-${nextQt}-${Date.now()}`,
      month_key: '2026-10',
      qt: nextQt,
      lead_mapping: 'TESTE EXCEL ONLINE WEB',
      data: quickDraft.data || '26/10/2026',
      vendedor: quickDraft.vendedor || 'Geibriel',
      chassi: (quickDraft.chassi || `99HSHF250VS00${nextQt}99`).toUpperCase(),
      modelo: (quickDraft.modelo || 'SHI 250 EFI').toUpperCase(),
      cliente: (quickDraft.cliente.trim() || `HENRIQUE ALMEIDA PRADO (TESTE #${nextQt})`).toUpperCase(),
      regiao: (quickDraft.regiao || 'DIVINOPOLIS').toUpperCase(),
      valor: valorNum,
      financiamento: finNum,
      banco: (quickDraft.banco || 'ALTIS').toUpperCase(),
      dinheiro: dinNum,
      pix: pixNum,
      carta_credito: 0,
      cartao: 0,
      comp: 'Imagem',
      boleto: 0,
      custos: 0,
      total: totalNum,
      observacoes: quickDraft.observacoes || 'Preenchimento de teste validado no Excel Online (ALTIS + PIX)',
      tipo_registro: 'venda',
      is_permitted: true,
    };

    const updated = [...currentRows, newTestRow];
    updateLiveRows(updated);
    setQuickDraft((prev) => ({ ...prev, cliente: '' }));
    toast({
      title: `✅ Linha #${nextQt} preenchida no Excel Online!`,
      description: `${newTestRow.cliente} (${newTestRow.modelo} — ${formatCurrencyBRL(newTestRow.valor)}) adicionada e sincronizada.`,
    });
  };

  const handleSaveUrl = () => {
    const clean = tempUrl.trim() || ONEDRIVE_DEFAULT_URL;
    setCloudUrl(clean);
    setEditingUrl(false);
    try {
      localStorage.setItem(ONEDRIVE_URL_STORAGE_KEY, clean);
    } catch {
      // ignore
    }
    toast({
      title: 'Link do Excel Online salvo!',
      description: 'O endereço da sua planilha no OneDrive foi atualizado.',
    });
  };

  const handleCopyToExcel = () => {
    try {
      const rowsToCopy = liveRows.length > 0 ? liveRows : getLiveSheetRows();
      const tsv = serializeRowsToTsv(rowsToCopy);
      navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      toast({
        title: 'Lançamentos Copiados para o Excel!',
        description: `${rowsToCopy.length} vendas atualizadas estão na sua área de transferência. Basta colar (Ctrl + V) no Excel Online.`,
      });
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar para a área de transferência.',
        variant: 'destructive',
      });
    }
  };

  const handlePasteFromExcelWeb = () => {
    if (!pasteBoxText.trim()) {
      toast({
        title: 'Área de colagem vazia',
        description: 'Copie as linhas do Excel Online (Ctrl+C) e cole (Ctrl+V) na caixa abaixo antes de sincronizar.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const { rows: parsedRows } = parseBackupCsv(pasteBoxText, '2026-10');
      if (parsedRows.length === 0) {
        toast({
          title: 'Nenhuma linha identificada',
          description: 'Selecione as linhas da planilha começando pela coluna QT (01, 02...) no Excel Online.',
          variant: 'destructive',
        });
        return;
      }
      localStorage.setItem(SHEET_STORAGE_KEY_V9, JSON.stringify(parsedRows));
      queryClient.setQueryData(['cloud-monthly-sheet-v9'], parsedRows);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      setPasteBoxText('');
      toast({
        title: 'Sincronizado do Excel Online!',
        description: `${parsedRows.length} lançamentos foram importados e atualizados em todo o sistema.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erro ao importar dados do Excel',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const handleDownloadXlsx = () => {
    try {
      const rowsToExport = liveRows.length > 0 ? liveRows : getLiveSheetRows();
      exportDealershipWorksheetMultiStore({
        rows: rowsToExport,
        monthKey: '2026-10',
        userName: 'Administrador',
      });
      toast({
        title: 'Arquivo Excel (.XLSX) Baixado!',
        description: `Planilha multi-abas com ${rowsToExport.length} lançamentos salva no seu dispositivo.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erro no download',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const totalVolume = liveRows.reduce((acc, r) => acc + (r.valor || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Planilha de Vendas em Nuvem v9.0"
        description="Controle operacional e financeiro completo com todas as colunas da concessionária, placar de vendedores, divisão mensal e integração com Excel Online (OneDrive)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyToExcel}
              className="h-9 gap-2 font-bold bg-card border-border shadow-xs"
              title="Copiar todas as linhas vivas para colar (Ctrl+V) no Excel Online"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-emerald-600" />}
              Copiar p/ Excel (Ctrl+V)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadXlsx}
              className="h-9 gap-2 font-bold bg-card border-border shadow-xs"
              title="Baixar arquivo nativo formatado do Excel com todas as abas de lojas"
            >
              <Download className="w-4 h-4 text-primary" />
              Baixar .XLSX ({liveRows.length})
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="bg-muted/70 h-10 p-1 flex flex-wrap gap-1">
          <TabsTrigger value="mensal" className="text-xs gap-2 font-medium">
            <Cloud className="w-3.5 h-3.5 text-primary" />
            Planilha de Vendas DealFlow (Nuvem Ativa)
          </TabsTrigger>
          <TabsTrigger value="excel_web" className="text-xs gap-2 font-medium">
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            Excel Online / OneDrive (Web)
          </TabsTrigger>
          <TabsTrigger value="livre" className="text-xs gap-2 font-medium">
            <Settings2 className="w-3.5 h-3.5" />
            Editor Livre de Colunas Customizadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="space-y-4">
          <CloudMonthlySpreadsheet onedriveUrl={cloudUrl} />
        </TabsContent>

        <TabsContent value="excel_web" className="space-y-4">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      Planilha de Vendas Shineray (Microsoft 365 / OneDrive Web)
                    </CardTitle>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                      {liveRows.length} Lançamentos Sincronizados ({formatCurrencyBRL(totalVolume)})
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Integração bidirecional com o Excel Online (OneDrive). Copie linhas do sistema para o Excel Web ou cole do Excel Web de volta para o DealFlow.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <a href={cloudUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                      <ExternalLink className="w-4 h-4" />
                      Abrir em Nova Aba (Excel Web)
                    </Button>
                  </a>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Barra de URL do OneDrive Editável */}
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="bg-muted/40 px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-medium text-muted-foreground flex-1 min-w-0">
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="shrink-0">URL OneDrive:</span>
                    {editingUrl ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={tempUrl}
                          onChange={(e) => setTempUrl(e.target.value)}
                          placeholder="Cole o link compartilhado do OneDrive / Excel Online..."
                          className="h-8 text-xs font-mono bg-background"
                        />
                        <Button size="sm" onClick={handleSaveUrl} className="h-8 px-3 text-xs gap-1 font-bold">
                          <Save className="w-3.5 h-3.5" /> Salvar
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-foreground text-[11px] truncate max-w-md">{cloudUrl}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!editingUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-semibold"
                        onClick={() => {
                          setTempUrl(cloudUrl);
                          setEditingUrl(true);
                        }}
                      >
                        Alterar Link OneDrive
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700"
                      onClick={() => {
                        navigator.clipboard.writeText(cloudUrl);
                        toast({
                          title: 'Link do OneDrive copiado!',
                          description: 'URL copiada para a área de transferência.',
                        });
                      }}
                    >
                      Copiar Link
                    </Button>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* Coluna 1: Enviar do Sistema para o Excel Online */}
                  <div className="p-5 rounded-2xl border bg-emerald-500/5 border-emerald-500/20 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                        <Copy className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          1. Enviar Dados do DealFlow para o Excel Online
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Copia todas as <strong>{liveRows.length} vendas atuais</strong> formatadas com tabulação nativa do Excel.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <Button
                        onClick={handleCopyToExcel}
                        className="h-10 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2 text-xs"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                        Copiar {liveRows.length} Linhas (Ctrl+V no Excel)
                      </Button>

                      <a href={cloudUrl} target="_blank" rel="noopener noreferrer">
                        <Button className="h-10 px-4 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2 text-xs">
                          <ExternalLink className="w-4 h-4" />
                          Abrir Excel Online
                        </Button>
                      </a>

                      <Button
                        variant="outline"
                        onClick={handleDownloadXlsx}
                        className="h-10 px-4 font-bold gap-2 text-xs"
                      >
                        <Download className="w-4 h-4 text-primary" />
                        Baixar .XLSX
                      </Button>
                    </div>
                  </div>

                  {/* Coluna 2: Trazer do Excel Online para o Sistema */}
                  <div className="p-5 rounded-2xl border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <ClipboardPaste className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            2. Colar Direto do Excel Online (Ctrl+V)
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Selecione as células no Excel na Web, copie (Ctrl+C) e cole abaixo para atualizar o sistema.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Textarea
                      rows={3}
                      value={pasteBoxText}
                      onChange={(e) => setPasteBoxText(e.target.value)}
                      placeholder="Cole aqui (Ctrl+V) as linhas copiadas direto do Excel Online (aceita Tab ou ponto-e-vírgula)..."
                      className="font-mono text-[11px] bg-background"
                    />

                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={handlePasteFromExcelWeb}
                        className="font-bold gap-1.5 text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Sincronizar Colagem com o Sistema
                      </Button>
                    </div>
                  </div>
                </div>

                {/* GRADE EXCEL ONLINE INTERATIVA AO VIVO (VROUT26) */}
                <div className="border-t bg-background">
                  {/* Barra Superior Estilo Microsoft Excel Web */}
                  <div className="bg-[#107c41] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="text-xs font-bold tracking-wide">
                        Planilha de Vendas Divinopolis.xlsx — Aba VROUT26 (Edição Ao Vivo)
                      </span>
                      <Badge className="bg-white/20 text-white border-none text-[10px] font-semibold">
                        Salvo automaticamente
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleRunExcelFillTest}
                        className="h-7 px-3 text-xs font-bold bg-white text-[#107c41] hover:bg-white/90 shadow-xs gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Testar Preenchimento Rápido (+ Linha #{String(liveRows.length + 1).padStart(2, '0')})
                      </Button>
                    </div>
                  </div>

                  {/* Barra de Fórmulas fx do Excel */}
                  <div className="bg-muted/50 px-3 py-1.5 border-b flex items-center gap-2 text-xs">
                    <div className="w-16 h-6 rounded border bg-background flex items-center justify-center font-mono font-bold text-[11px] text-foreground shrink-0">
                      {selectedCell.colLetter}
                      {selectedCell.rowIdx + 2}
                    </div>
                    <span className="font-serif italic font-bold text-muted-foreground px-1">fx</span>
                    <Input
                      value={
                        liveRows[selectedCell.rowIdx]
                          ? String((liveRows[selectedCell.rowIdx] as any)[selectedCell.colKey] ?? '')
                          : ''
                      }
                      onChange={(e) => {
                        const targetRow = liveRows[selectedCell.rowIdx];
                        if (targetRow) {
                          handleCellChangeInExcelWeb(targetRow.id, selectedCell.colKey, e.target.value);
                        }
                      }}
                      placeholder="Selecione qualquer célula abaixo para editar o valor na barra de fórmulas..."
                      className="h-6 text-xs font-mono bg-background border-border"
                    />
                  </div>

                  {/* Grade Estilo Planilha Excel (A..M) */}
                  <div className="overflow-x-auto max-h-[520px] relative">
                    <table className="w-full border-collapse text-[11px] font-sans">
                      <thead className="sticky top-0 z-20 shadow-xs">
                        <tr className="bg-zinc-900 text-muted-foreground border-b">
                          <th className="w-8 border-r bg-zinc-900 py-1 text-center font-mono text-[10px]"></th>
                          {[
                            { letter: 'A', label: 'QT', width: 'w-12' },
                            { letter: 'B', label: 'MAPEAMENTO DE LEAD', width: 'min-w-[160px]' },
                            { letter: 'C', label: 'DATA', width: 'w-24' },
                            { letter: 'D', label: 'VENDEDOR', width: 'w-24' },
                            { letter: 'E', label: 'CHASSI', width: 'min-w-[145px]' },
                            { letter: 'F', label: 'MODELO', width: 'min-w-[130px]' },
                            { letter: 'G', label: 'CLIENTE', width: 'min-w-[190px]' },
                            { letter: 'H', label: 'REGIÃO', width: 'min-w-[130px]' },
                            { letter: 'I', label: 'VALOR', width: 'w-28' },
                            { letter: 'J', label: 'FINANCIAMENTO', width: 'w-28' },
                            { letter: 'K', label: 'BANCO', width: 'w-24' },
                            { letter: 'L', label: 'DINHEIRO', width: 'w-24' },
                            { letter: 'M', label: 'PIX', width: 'w-24' },
                          ].map((col) => (
                            <th
                              key={col.letter}
                              className={`border-r bg-zinc-900 py-1 text-center font-mono text-[10px] font-semibold text-muted-foreground ${col.width}`}
                            >
                              {col.letter}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-[#2e6b12] text-white font-bold border-b">
                          <th className="border-r border-white/20 bg-zinc-900 text-muted-foreground text-center font-mono text-[10px] py-1.5">
                            1
                          </th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-center">QT</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-left">MAPEAMENTO DE LEAD</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-center">DATA</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-center">VENDEDOR</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-left">CHASSI</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-left">MODELO</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-left">CLIENTE</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-left">REGIÃO</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-right">VALOR</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-right">FINANCIAMENTO</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-center">BANCO</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-right">DINHEIRO</th>
                          <th className="border-r border-white/20 px-2 py-1.5 text-right">PIX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveRows.map((row, rIdx) => {
                          const sellerBg =
                            row.vendedor === 'Geibriel'
                              ? 'bg-purple-600 text-white font-bold'
                              : row.vendedor === 'Lilian'
                              ? 'bg-lime-500 text-black font-bold'
                              : row.vendedor === 'Daniel'
                              ? 'bg-sky-700 text-white font-bold'
                              : 'bg-amber-500 text-black font-bold';

                          const cells: { key: keyof SheetRowV9; letter: string; align?: string; isSeller?: boolean }[] = [
                            { key: 'qt', letter: 'A', align: 'text-center font-bold' },
                            { key: 'lead_mapping', letter: 'B' },
                            { key: 'data', letter: 'C', align: 'text-center' },
                            { key: 'vendedor', letter: 'D', align: 'text-center', isSeller: true },
                            { key: 'chassi', letter: 'E', align: 'font-mono text-[10px]' },
                            { key: 'modelo', letter: 'F', align: 'font-semibold' },
                            { key: 'cliente', letter: 'G' },
                            { key: 'regiao', letter: 'H' },
                            { key: 'valor', letter: 'I', align: 'text-right font-mono' },
                            { key: 'financiamento', letter: 'J', align: 'text-right font-mono' },
                            { key: 'banco', letter: 'K', align: 'text-center font-bold' },
                            { key: 'dinheiro', letter: 'L', align: 'text-right font-mono' },
                            { key: 'pix', letter: 'M', align: 'text-right font-mono' },
                          ];

                          return (
                            <tr key={row.id} className="border-b hover:bg-emerald-500/5">
                              <td className="border-r bg-muted/60 text-center font-mono text-[10px] text-muted-foreground py-1">
                                {rIdx + 2}
                              </td>
                              {cells.map((c) => {
                                const isSel =
                                  selectedCell.rowIdx === rIdx && selectedCell.colKey === c.key;
                                const val = (row as any)[c.key];
                                const isCurrency =
                                  c.key === 'valor' ||
                                  c.key === 'financiamento' ||
                                  c.key === 'dinheiro' ||
                                  c.key === 'pix';

                                return (
                                  <td
                                    key={c.letter}
                                    onClick={() =>
                                      setSelectedCell({ rowIdx: rIdx, colKey: c.key, colLetter: c.letter })
                                    }
                                    className={`border-r px-1.5 py-0.5 cursor-cell ${
                                      c.isSeller ? sellerBg : ''
                                    } ${
                                      isSel ? 'ring-2 ring-[#107c41] z-10 relative' : ''
                                    } ${c.align || ''}`}
                                  >
                                    <input
                                      value={
                                        isCurrency && !isSel
                                          ? val > 0
                                            ? formatCurrencyBRL(val)
                                            : ''
                                          : String(val ?? '')
                                      }
                                      onFocus={() =>
                                        setSelectedCell({ rowIdx: rIdx, colKey: c.key, colLetter: c.letter })
                                      }
                                      onChange={(e) =>
                                        handleCellChangeInExcelWeb(row.id, c.key, e.target.value)
                                      }
                                      className={`w-full bg-transparent outline-hidden text-[11px] ${
                                        c.align || ''
                                      }`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Linha de Novo Preenchimento Direto no Rodapé da Planilha */}
                        <tr className="bg-emerald-500/10 border-t-2 border-[#107c41]/40">
                          <td className="border-r bg-emerald-600 text-white text-center font-mono text-[10px] font-bold py-1.5">
                            +
                          </td>
                          <td className="border-r px-1.5 py-1 text-center font-bold text-emerald-700 dark:text-emerald-400">
                            {String(liveRows.length + 1).padStart(2, '0')}
                          </td>
                          <td className="border-r px-1.5 py-1 text-[10px] text-muted-foreground">
                            NOVO LANÇAMENTO
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.data}
                              onChange={(e) => setQuickDraft({ ...quickDraft, data: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-center text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.vendedor}
                              onChange={(e) => setQuickDraft({ ...quickDraft, vendedor: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-center font-bold text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.chassi}
                              onChange={(e) => setQuickDraft({ ...quickDraft, chassi: e.target.value })}
                              placeholder="Chassi..."
                              className="w-full bg-background/80 rounded px-1 py-0.5 font-mono text-[10px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.modelo}
                              onChange={(e) => setQuickDraft({ ...quickDraft, modelo: e.target.value })}
                              placeholder="Modelo..."
                              className="w-full bg-background/80 rounded px-1 py-0.5 font-bold text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.cliente}
                              onChange={(e) => setQuickDraft({ ...quickDraft, cliente: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRunExcelFillTest();
                              }}
                              placeholder="Digite o Cliente e tecle Enter..."
                              className="w-full bg-background rounded px-1.5 py-0.5 font-semibold text-[11px] border border-[#107c41]"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.regiao}
                              onChange={(e) => setQuickDraft({ ...quickDraft, regiao: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.valor}
                              onChange={(e) => setQuickDraft({ ...quickDraft, valor: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-right font-mono text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.financiamento}
                              onChange={(e) => setQuickDraft({ ...quickDraft, financiamento: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-right font-mono text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.banco}
                              onChange={(e) => setQuickDraft({ ...quickDraft, banco: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-center font-bold text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <input
                              value={quickDraft.dinheiro}
                              onChange={(e) => setQuickDraft({ ...quickDraft, dinheiro: e.target.value })}
                              className="w-full bg-background/80 rounded px-1 py-0.5 text-right font-mono text-[11px] border"
                            />
                          </td>
                          <td className="border-r px-1 py-1">
                            <Button
                              size="sm"
                              onClick={handleRunExcelFillTest}
                              className="h-6 w-full text-[10px] font-bold bg-[#107c41] hover:bg-[#0c5e31] text-white px-2"
                            >
                              + Gravar
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="livre" className="space-y-4">
          <CustomSpreadsheetManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
