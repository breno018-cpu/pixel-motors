import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Search,
  Building2,
  Store,
  Bike,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RotateCcw,
  Tag,
  DollarSign,
  Truck,
  Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  StockExchangeRecord,
  getStockExchangeRecords,
  saveStockExchangeRecords,
  type ExchangeDirection,
} from '@/lib/stockTransfersManager';
import { ExternalStoreMotoEntryDialog } from './ExternalStoreMotoEntryDialog';
import { StockTransferDialog } from '@/components/vehicles/StockTransferDialog';
import { cn } from '@/lib/utils';

export function ExecutiveStockExchangePanel() {
  const { toast } = useToast();

  const [records, setRecords] = useState<StockExchangeRecord[]>([]);
  const [filterDirection, setFilterDirection] = useState<'all' | 'saida' | 'entrada' | 'sem_app'>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedChassis, setCopiedChassis] = useState<string | null>(null);

  // Modais
  const [externalEntryOpen, setExternalEntryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const loadData = () => {
    const list = getStockExchangeRecords();
    setRecords(list);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('dealflow:vehicle-status-updated', handleUpdate);
    window.addEventListener('dealflow:sales-updated', handleUpdate);
    return () => {
      window.removeEventListener('dealflow:vehicle-status-updated', handleUpdate);
      window.removeEventListener('dealflow:sales-updated', handleUpdate);
    };
  }, []);

  const handleCopyChassis = (chassis: string) => {
    navigator.clipboard.writeText(chassis);
    setCopiedChassis(chassis);
    toast({
      title: 'Chassi Copiado!',
      description: `${chassis} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedChassis(null), 2000);
  };

  const handleConfirmArrival = (recordId: string) => {
    const updated = records.map((r) =>
      r.id === recordId ? { ...r, status: 'concluida' as const } : r
    );
    saveStockExchangeRecords(updated);
    setRecords(updated);
    toast({
      title: 'Recebimento Confirmado!',
      description: 'A motocicleta foi confirmada e está disponível no pátio.',
    });
  };

  // Métricas
  const stats = useMemo(() => {
    const total = records.length;
    const saidas = records.filter((r) => r.direction === 'saida').length;
    const entradas = records.filter((r) => r.direction === 'entrada').length;
    const semApp = records.filter((r) => r.is_external_store).length;
    const valorTotal = records.reduce((acc, r) => acc + (Number(r.agreed_amount) || 0), 0);

    return { total, saidas, entradas, semApp, valorTotal };
  }, [records]);

  // Lista Filtrada
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Filtro de Direção
      if (filterDirection === 'saida' && r.direction !== 'saida') return false;
      if (filterDirection === 'entrada' && r.direction !== 'entrada') return false;
      if (filterDirection === 'sem_app' && !r.is_external_store) return false;

      // Filtro de Loja
      if (selectedStore !== 'all') {
        const matchesOrigin = r.from_store_id === selectedStore || r.from_store_name?.includes(selectedStore);
        const matchesDest = r.to_store_id === selectedStore || r.to_store_name?.includes(selectedStore);
        if (!matchesOrigin && !matchesDest) return false;
      }

      // Busca
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchChassis = r.chassis?.toLowerCase().includes(s);
        const matchModel = r.model?.toLowerCase().includes(s);
        const matchFrom = r.from_store_name?.toLowerCase().includes(s);
        const matchTo = r.to_store_name?.toLowerCase().includes(s);
        const matchExt = r.external_store_name?.toLowerCase().includes(s);
        const matchNf = r.invoice_number?.toLowerCase().includes(s);
        return matchChassis || matchModel || matchFrom || matchTo || matchExt || matchNf;
      }

      return true;
    });
  }, [records, filterDirection, selectedStore, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER EXECUTIVO COM BOTÕES DE AÇÃO */}
      <Card className="border-border/70 bg-gradient-to-r from-card to-muted/20 shadow-xs">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold font-display text-foreground flex items-center gap-2">
                  Controle de Troca de Estoque &amp; Transferências Interlojas
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Diretoria
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Acompanhamento executivo de motos remetidas para cada filial, motos que chegam de outras lojas e módulo de entrada de motos vindas de lojas parceiras sem o app.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransferOpen(true)}
                className="h-8 text-xs gap-1.5"
                title="Transferir moto do nosso estoque para outra loja"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Transferência Entre Lojas
              </Button>

              <Button
                size="sm"
                onClick={() => setExternalEntryOpen(true)}
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-bold"
                title="Adicionar moto vinda de loja externa que não usa o app"
              >
                <Plus className="w-3.5 h-3.5" />
                <Store className="w-3.5 h-3.5" />
                Entrada (Loja Sem App)
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 2. CARDS DE KPIS DA DIRETORIA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground block">
            Total Movimentado
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-extrabold text-foreground font-display">
              {stats.total} <span className="text-xs font-normal text-muted-foreground">motos</span>
            </span>
            <Badge variant="secondary" className="text-[10px]">
              R$ {stats.valorTotal.toLocaleString('pt-BR')}
            </Badge>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground block flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
            Motos Enviadas (Saídas)
          </span>
          <span className="text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-display block">
            {stats.saidas} <span className="text-xs font-normal text-muted-foreground">unidades</span>
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground block flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            Motos Recebidas (Entradas)
          </span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-display block">
            {stats.entradas} <span className="text-xs font-normal text-muted-foreground">unidades</span>
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-card border border-border/70 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground block flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-purple-500" />
            De Lojas Externas (Sem App)
          </span>
          <span className="text-xl sm:text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-display block">
            {stats.semApp} <span className="text-xs font-normal text-muted-foreground">unidades</span>
          </span>
        </div>
      </div>

      {/* 3. FILTROS E PESQUISA */}
      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Seletor de Direção / Origem */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterDirection('all')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
              filterDirection === 'all'
                ? 'bg-card text-foreground border-border shadow-xs'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            )}
          >
            Todas ({records.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterDirection('saida')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1',
              filterDirection === 'saida'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-xs'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            )}
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Motos que Saem ({stats.saidas})
          </button>

          <button
            type="button"
            onClick={() => setFilterDirection('entrada')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1',
              filterDirection === 'entrada'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-xs'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            )}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> Motos que Vêm ({stats.entradas})
          </button>

          <button
            type="button"
            onClick={() => setFilterDirection('sem_app')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1',
              filterDirection === 'sem_app'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 shadow-xs'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            )}
          >
            <Store className="w-3.5 h-3.5" /> Loja Sem App ({stats.semApp})
          </button>
        </div>

        {/* Busca e Loja */}
        <div className="flex items-center gap-2">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="h-8 text-xs font-medium w-40">
              <SelectValue placeholder="Filtrar Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              <SelectItem value="store-divinopolis">Divinópolis</SelectItem>
              <SelectItem value="store-montesclaros">Montes Claros</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar chassi, modelo ou loja..."
              className="h-8 text-xs pl-8 w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* 4. TABELA DE TROCA DE ESTOQUE */}
      <Card className="border-border/70 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-bold">Data</TableHead>
                  <TableHead className="text-xs font-bold">Fluxo / Lojas</TableHead>
                  <TableHead className="text-xs font-bold">Motocicleta</TableHead>
                  <TableHead className="text-xs font-bold">Chassi</TableHead>
                  <TableHead className="text-xs font-bold">Origem Especial</TableHead>
                  <TableHead className="text-xs font-bold">NF-e / Guia</TableHead>
                  <TableHead className="text-xs font-bold">Valor Repasse</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      Nenhuma movimentação de troca de estoque encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => {
                    const isSaida = r.direction === 'saida';

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/20">
                        {/* Data */}
                        <TableCell className="py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {r.transfer_date ? new Date(r.transfer_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </TableCell>

                        {/* Fluxo / Lojas */}
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              {isSaida ? (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30 font-bold">
                                  ↗ Saída
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">
                                  ↙ Entrada
                                </Badge>
                              )}
                              <span>{isSaida ? `Para: ${r.to_store_name}` : `De: ${r.from_store_name}`}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground pl-1 mt-0.5">
                              {isSaida ? `Origem: ${r.from_store_name}` : `Destino: ${r.to_store_name}`}
                            </span>
                          </div>
                        </TableCell>

                        {/* Modelo e Cor */}
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                              <Bike className="w-3.5 h-3.5 text-primary" />
                              {r.model}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {r.color} ({r.year})
                            </span>
                          </div>
                        </TableCell>

                        {/* Chassi */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1 font-mono text-xs font-bold">
                            <span className="text-foreground">{r.chassis}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyChassis(r.chassis)}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              title="Copiar chassi"
                            >
                              {copiedChassis === r.chassis ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Origem Especial (Sem App) */}
                        <TableCell className="py-3">
                          {r.is_external_store ? (
                            <div className="flex flex-col">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold bg-purple-500/10 text-purple-600 border-purple-500/30">
                                Loja Externa (Sem App)
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                {r.external_store_name} ({r.external_store_city})
                              </span>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                              Rede Oficial
                            </Badge>
                          )}
                        </TableCell>

                        {/* NF-e */}
                        <TableCell className="py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {r.invoice_number || '-'}
                        </TableCell>

                        {/* Valor Repasse */}
                        <TableCell className="py-3 text-xs font-bold text-foreground whitespace-nowrap">
                          {Number(r.agreed_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3 whitespace-nowrap">
                          {r.status === 'concluida' && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> No Pátio
                            </Badge>
                          )}
                          {r.status === 'em_transito' && (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold flex items-center gap-1 w-fit">
                              <Clock className="w-3 h-3" /> Em Trânsito
                            </Badge>
                          )}
                          {r.status === 'cancelada' && (
                            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 font-bold">
                              Cancelada
                            </Badge>
                          )}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="py-3 text-right">
                          {r.status === 'em_transito' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmArrival(r.id)}
                              className="h-7 text-[11px] gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-semibold"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Confirmar Chegada
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: ENTRADA DE MOTO DE LOJA EXTERNA (SEM APP) */}
      <ExternalStoreMotoEntryDialog
        open={externalEntryOpen}
        onOpenChange={setExternalEntryOpen}
        onSuccess={loadData}
      />

      {/* MODAL 2: TRANSFERÊNCIA ENTRE LOJAS DA REDE */}
      <StockTransferDialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) loadData();
        }}
        defaultType="loja_para_loja"
      />
    </div>
  );
}
