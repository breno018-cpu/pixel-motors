import { useState, useMemo } from 'react';
import { 
  Truck, ScanLine, Upload, CheckCircle2, AlertTriangle, ShieldAlert, 
  Boxes, RefreshCw, Sparkles, Plus, Search, Check, AlertCircle, Building2, 
  ArrowRight, Clock, Trash2, FileSpreadsheet, Eye, Printer, ChevronDown
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard, PanelCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useInboundCargo } from '@/hooks/useInboundCargo';
import { InboundBarcodeScanner } from '@/components/inbound/InboundBarcodeScanner';
import { NewInboundBatchDialog } from '@/components/inbound/NewInboundBatchDialog';
import { useStores } from '@/hooks/useStores';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import { cn } from '@/lib/utils';

interface InboundCargoProps {
  embedded?: boolean;
}

export default function InboundCargo({ embedded = false }: InboundCargoProps) {
  const { 
    batches, activeBatch, activeBatchId, setActiveBatchId, 
    createBatch, deleteBatch, resetBatchScans, scanBox, commitToStock, loadSampleData 
  } = useInboundCargo();

  const { data: stores = [] } = useStores();
  const { userStore, isAdmin, isManager } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => userStore?.id || '');
  const [isCommitting, setIsCommitting] = useState(false);

  // Filtros de Tabela
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'scanned' | 'divergences'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtra itens do lote ativo
  const filteredItems = useMemo(() => {
    if (!activeBatch) return [];

    let list = activeBatch.items;

    if (statusFilter === 'pending') {
      list = list.filter((i) => !i.scanned);
    } else if (statusFilter === 'scanned') {
      list = list.filter((i) => i.scanned);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) => 
        i.chassis.toLowerCase().includes(q) ||
        i.engine_number.toLowerCase().includes(q) ||
        (i.model_name && i.model_name.toLowerCase().includes(q)) ||
        i.primary_color.toLowerCase().includes(q) ||
        i.secondary_color.toLowerCase().includes(q) ||
        i.model_code.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeBatch, statusFilter, searchQuery]);

  const scannedCount = activeBatch ? activeBatch.scanned_items : 0;
  const totalCount = activeBatch ? activeBatch.total_items : 0;
  const pendingCount = totalCount - scannedCount;
  const progressPercent = totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0;

  // Finalização e Entrada no Estoque
  const handleCommitStock = async () => {
    if (!activeBatch) return;
    if (!selectedStoreId && stores.length > 0) {
      toast({
        title: 'Selecione a loja de destino',
        description: 'Escolha para qual loja essas motos serão alocadas no estoque.',
        variant: 'destructive',
      });
      return;
    }

    const storeObj = stores.find(s => s.id === selectedStoreId);
    const confirmed = await confirm({
      title: 'Efetivar Entrada no Estoque?',
      description: `Todas as ${scannedCount} motos conferidas do lote ${activeBatch.batch_code} serão cadastradas no estoque da loja ${storeObj?.name || 'selecionada'} com status Disponível.`,
      confirmText: `Confirmar Entrada (${scannedCount} Motos)`,
      cancelText: 'Cancelar',
      variant: 'success',
    });
    if (!confirmed) return;

    setIsCommitting(true);
    try {
      await commitToStock(activeBatch.id, selectedStoreId || (userStore?.id ?? ''), storeObj?.name);
      setCommitDialogOpen(false);
    } catch (err: any) {
      toast({
        title: 'Falha na entrada',
        description: err?.message || 'Erro ao gravar no estoque.',
        variant: 'destructive',
      });
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Ações Executivas */}
      {embedded ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <Truck className="w-4 h-4" />
              </span>
              <h3 className="font-display font-bold text-sm text-foreground">
                Controle de Entrada (Caminhão & Descarga de Fábrica)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Conferência de romaneio de fábrica por imagem/planilha, leitor de bipagem no pátio e efetivação direta no estoque.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewBatchOpen(true)}
              className="gap-1.5 text-xs h-9 border-dashed"
            >
              <Upload className="w-4 h-4 text-primary" />
              <span>Nova Carga / Anexar Imagem</span>
            </Button>

            {batches.length > 0 && (
              <Button
                size="sm"
                onClick={() => setScannerOpen(!scannerOpen)}
                className={cn(
                  "gap-1.5 text-xs h-9 font-semibold",
                  scannerOpen ? "bg-muted text-foreground hover:bg-muted/80" : "bg-red-600 hover:bg-red-700 text-white"
                )}
              >
                <ScanLine className="w-4 h-4" />
                <span>{scannerOpen ? 'Fechar Scanner' : 'Ativar Scanner de Descarga'}</span>
              </Button>
            )}

            {scannedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCommitDialogOpen(true)}
                className="gap-1.5 text-xs h-9 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-semibold"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Efetivar no Estoque ({scannedCount})</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <PageHeader
          title="Controle de Entrada (Caminhão & Descarga)"
          subtitle="Conferência de romaneio de fábrica por imagem, bipagem a laser de caixas no pátio e validação de 100% das motos da loja."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewBatchOpen(true)}
                className="gap-1.5 text-xs h-9"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span>Nova Carga / Anexar Imagem</span>
              </Button>

              {batches.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setScannerOpen(!scannerOpen)}
                  className={cn(
                    "gap-1.5 text-xs h-9 font-semibold",
                    scannerOpen ? "bg-muted text-foreground hover:bg-muted/80" : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                >
                  <ScanLine className="w-4 h-4" />
                  <span>{scannerOpen ? 'Fechar Scanner' : 'Ativar Scanner de Descarga'}</span>
                </Button>
              )}

              {scannedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCommitDialogOpen(true)}
                  className="gap-1.5 text-xs h-9 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Efetivar no Estoque ({scannedCount})</span>
                </Button>
              )}
            </div>
          }
        />
      )}

      {batches.length === 0 ? (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-gradient-to-b from-card to-card/60 p-8 sm:p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-inner mb-4">
              <Truck className="h-8 w-8" />
            </div>

            <h3 className="font-display font-bold text-xl text-foreground mb-2">
              Nenhum romaneio de carga em andamento
            </h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
              Quando um caminhão da cegonha chegar à concessionária, cadastre o romaneio anexando a foto da lista de motos ou importando a planilha para iniciar a conferência com bipagem no pátio.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => setNewBatchOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold h-10 px-6 gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Romaneio / Chegada de Caminhão</span>
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Carregar Carga Demonstrativa?',
                    description: 'Deseja carregar a remessa demonstrativa com 31 motos para teste prático de bipagem e conferência?',
                    confirmText: 'Carregar Demonstração',
                    cancelText: 'Cancelar',
                    variant: 'default',
                  });
                  if (ok) loadSampleData();
                }}
                className="h-10 px-4 text-xs font-medium border-border gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Carregar Amostra Demonstrativa</span>
              </Button>
            </div>
          </div>

          {/* Cards explicativos das 3 etapas do fluxo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-border bg-card/60 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs items-center justify-center">1</span>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Anexo do Romaneio</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tire uma foto da folha do caminhão ou anexe o arquivo. A inteligência visual extrai chassis, motores, cores e modelos coluna por coluna automaticamente.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card/60 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs items-center justify-center">2</span>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Bipagem no Pátio</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Abra a câmera do celular ou conecte um leitor de código de barras físico para bipar cada caixa que desce da carreta com confirmação sonora instantânea.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card/60 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs items-center justify-center">3</span>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Bloqueio Anti-Troca</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Se uma caixa de outra filial ou destino tentar descer por engano, o alarme de segurança dispara imediatamente e impede a entrada incorreta no estoque.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Seletor de Carga / Lote Ativo */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-sm text-foreground">
                    Manifesto Ativo: Lote {activeBatch?.batch_code || '---'}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Transporte: {activeBatch?.transport_code || '---'}
                  </Badge>
                  <Badge 
                    variant={activeBatch?.status === 'concluido' ? 'default' : 'secondary'}
                    className={cn(
                      "text-[10px]",
                      activeBatch?.status === 'concluido' && "bg-emerald-600 text-white",
                      activeBatch?.status === 'divergente' && "bg-red-600 text-white animate-pulse"
                    )}
                  >
                    {activeBatch?.status === 'concluido' ? 'Descarga Concluída' : activeBatch?.status === 'divergente' ? 'Com Alertas de Rejeição' : 'Em Conferência'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Destino Oficial: <strong className="text-foreground">{activeBatch?.destination_store}</strong> • Transportador: {activeBatch?.carrier_name || 'Frota de Fábrica'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {batches.length > 1 && (
                <Select value={activeBatchId || ''} onValueChange={(v) => setActiveBatchId(v)}>
                  <SelectTrigger className="h-9 text-xs w-full sm:w-[220px]">
                    <SelectValue placeholder="Trocar Carga..." />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        Lote {b.batch_code} ({b.destination_store})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!activeBatch) return;
                  const ok = await confirm({
                    title: 'Reiniciar Conferência do Lote?',
                    description: `Deseja reiniciar a contagem de bipagem do lote ${activeBatch.batch_code}? Todos os status de bipagem voltarão a ficar pendentes de descarga.`,
                    confirmText: 'Sim, Reiniciar',
                    cancelText: 'Cancelar',
                    variant: 'warning',
                  });
                  if (ok) {
                    resetBatchScans(activeBatch.id);
                    toast({ title: 'Descarga reiniciada', description: 'Todos os status de bipagem foram resetados.' });
                  }
                }}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Reiniciar conferência"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!activeBatch) return;
                  const ok = await confirm({
                    title: 'Excluir Romaneio de Carga?',
                    description: `Tem certeza que deseja excluir o romaneio do lote ${activeBatch.batch_code}? Esta ação removerá o manifesto desta carga da tela.`,
                    confirmText: 'Sim, Excluir Lote',
                    cancelText: 'Cancelar',
                    variant: 'destructive',
                  });
                  if (ok) {
                    deleteBatch(activeBatch.id);
                    toast({ title: 'Romaneio excluído', description: 'O lote foi removido com sucesso.' });
                  }
                }}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-destructive"
                title="Excluir romaneio"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Scanner ao Vivo Integrado (quando ativado) */}
          {scannerOpen && activeBatch && (
            <div className="animate-fade-in">
              <InboundBarcodeScanner
                batch={activeBatch}
                onScan={scanBox}
                onClose={() => setScannerOpen(false)}
              />
            </div>
          )}

          {/* Cards de Métricas do Caminhão */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Total no Caminhão"
              value={totalCount}
              subtitle={`Lote ${activeBatch?.batch_code || '---'}`}
              icon={Boxes}
              variant="default"
            />
            <StatCard
              title="Conferidas / Descarregadas"
              value={scannedCount}
              subtitle={`${progressPercent}% do caminhão conferido`}
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard
              title="Pendentes no Caminhão"
              value={pendingCount}
              subtitle="Caixas ainda por descer"
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="Alertas de Rejeição"
              value={activeBatch?.divergence_logs?.length || 0}
              subtitle="Motos que não eram desta loja"
              icon={ShieldAlert}
              variant={activeBatch?.divergence_logs && activeBatch.divergence_logs.length > 0 ? 'danger' : 'default'}
            />
          </div>

        {/* Lista e Tabela de Conferência */}
      <PanelCard
        title="Romaneio Detalhado do Caminhão"
        subtitle={`Relação completa dos chassis aguardando descarga em ${activeBatch?.destination_store || 'Loja'}`}
        noPadding
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar chassi, cor, motor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card"
              />
            </div>
          </div>
        }
      >
        {/* Abas de Navegação */}
        <div className="px-5 pt-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">
                Todas ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                Pendentes no Caminhão ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="scanned" className="text-xs">
                Descarregadas ({scannedCount})
              </TabsTrigger>
              {activeBatch?.divergence_logs && activeBatch.divergence_logs.length > 0 && (
                <TabsTrigger value="divergences" className="text-xs text-red-600 font-bold">
                  Alertas ({activeBatch.divergence_logs.length})
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <span className="text-[11px] font-mono text-muted-foreground">
            {filteredItems.length} {filteredItems.length === 1 ? 'moto listada' : 'motos listadas'}
          </span>
        </div>

        {/* Visão de Divergências se selecionada */}
        {statusFilter === 'divergences' ? (
          <div className="p-5 space-y-3">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Registros de caixas bipadas que NÃO pertencem ao manifesto desta loja:</span>
            </div>

            <div className="divide-y divide-border border rounded-xl overflow-hidden">
              {activeBatch?.divergence_logs?.map((div) => (
                <div key={div.id} className="p-3.5 flex items-start justify-between gap-4 hover:bg-muted/30">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="font-mono text-[10px]">
                        REJEITADA
                      </Badge>
                      <span className="font-mono font-bold text-foreground text-xs">
                        Código lido: {div.scanned_value}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{div.message}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(div.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Tabela Principal */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 text-xs">
                  <TableHead className="w-12 text-center">Status</TableHead>
                  <TableHead>Veículo / Modelo</TableHead>
                  <TableHead>Chassi (17 Dígitos)</TableHead>
                  <TableHead>Cor Primária & Banco</TableHead>
                  <TableHead>Motor</TableHead>
                  <TableHead className="text-center">Ano Fab/Mod</TableHead>
                  <TableHead className="text-center">Cilindrada</TableHead>
                  <TableHead className="text-right">Bipagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                      Nenhuma moto encontrada com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className={cn(
                        "text-xs hover:bg-muted/40 transition-colors",
                        item.scanned ? "bg-emerald-500/[0.03]" : ""
                      )}
                    >
                      <TableCell className="text-center">
                        {item.scanned ? (
                          <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-600 font-bold" title="Caixa descarregada">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/15 text-amber-600 font-bold" title="Aguardando descarga">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground text-xs leading-tight">
                            {item.model_name || item.model_code}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            Código: {item.model_code} • {item.destination_store}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono font-bold text-foreground text-xs tracking-tight select-all">
                          {item.chassis}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] py-0 font-medium">
                            {item.primary_color}
                          </Badge>
                          {item.secondary_color && item.secondary_color !== '-' && (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              + {item.secondary_color}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-muted-foreground text-[11px]">
                        {item.engine_number || '---'}
                      </TableCell>

                      <TableCell className="text-center font-mono text-[11px]">
                        {item.manufacture_year}/{item.model_year}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono text-[10px] font-bold">
                          {item.group_cc}cc
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {item.scanned ? (
                          <div className="text-right leading-tight">
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Descarregada
                            </span>
                            {item.scanned_at && (
                              <span className="text-[9px] font-mono text-muted-foreground">
                                {new Date(item.scanned_at).toLocaleTimeString('pt-BR')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => scanBox(item.chassis)}
                            className="h-7 px-2.5 text-[11px] font-semibold gap-1 hover:border-emerald-500 hover:text-emerald-600"
                          >
                            <ScanLine className="w-3 h-3" />
                            Bipar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </PanelCard>
      </>
      )}

      {/* Modal de Criação / Importação de Novo Romaneio */}
      <NewInboundBatchDialog
        open={newBatchOpen}
        onOpenChange={setNewBatchOpen}
        onBatchCreated={(batch) => {
          createBatch(batch);
          setScannerOpen(true);
        }}
      />

      {/* Modal de Efetivação no Estoque Oficial */}
      <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-display">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Efetivar Entrada no Estoque da Loja
            </DialogTitle>
            <DialogDescription className="text-xs">
              Todas as {scannedCount} motos conferidas e descarregadas serão adicionadas ao estoque com status <strong>Disponível</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Selecione a Loja de Destino do Estoque:
              </label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a unidade..." />
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

            <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1 text-muted-foreground border">
              <p>• <strong>{scannedCount} motos</strong> prontas para entrada.</p>
              <p>• Dados cadastrados: Chassi, Motor, Cor, Banco, Ano Modelo/Fab e Preços Padrão.</p>
              <p>• Cada chassi será protegido contra duplicação no sistema.</p>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCommitDialogOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCommitStock}
              disabled={isCommitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
            >
              {isCommitting ? 'Gravando...' : `Confirmar Entrada (${scannedCount} Motos)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
