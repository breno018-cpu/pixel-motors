import { useState, useMemo } from 'react';
import {
  ReceiptText,
  ArrowDownLeft,
  ArrowUpRight,
  XCircle,
  CheckCircle2,
  Calendar,
  Building2,
  DollarSign,
  Download,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  Truck,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useStores } from '@/hooks/useStores';
import { exportToXLSX } from '@/lib/export';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';

interface CombinedFiscalRecord {
  id: string;
  invoice_number: string;
  fiscal_type: 'entrada' | 'emissao' | 'cancelamento';
  store_id: string;
  store_name: string;
  party_name: string;
  issue_date: string;
  event_date: string; // Data da entrada ou data do cancelamento
  total_value: number;
  status: string;
  cancellation_reason?: string;
  cancellation_type?: 'estorno' | 'credito' | 'devolucao';
  sefaz_protocol?: string;
  notes?: string;
}

export function OwnerFiscalInvoicesPanel() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: stores = [] } = useStores();

  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'last_month' | 'all'>('this_month');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Recupera registros fiscais armazenados localmente e mescla com invoices remotas
  const allFiscalRecords = useMemo(() => {
    let localRecords: any[] = [];
    try {
      const raw = localStorage.getItem('dealflow_store_fiscal_invoices_v1');
      if (raw) localRecords = JSON.parse(raw);
    } catch {}

    const map = new Map<string, CombinedFiscalRecord>();

    // 1. Invoices do Supabase
    invoices.forEach((inv) => {
      const isEntrada = inv.invoice_type === 'entrada';
      const isCancelada = inv.status === 'cancelada' || inv.invoice_type === 'cancelamento';
      const storeName = inv.store?.name || (inv.store_id?.includes('montes') ? 'Montes Claros' : 'Divinópolis');

      const fType: 'entrada' | 'emissao' | 'cancelamento' = isEntrada
        ? 'entrada'
        : isCancelada
        ? 'cancelamento'
        : 'emissao';

      // Data relevante do evento fiscal
      const eventDate = isCancelada
        ? (inv.cancellation_date || inv.issue_date || inv.created_at?.slice(0, 10))
        : (inv.issue_date || inv.created_at?.slice(0, 10));

      const rec: CombinedFiscalRecord = {
        id: inv.id,
        invoice_number: inv.invoice_number,
        fiscal_type: fType,
        store_id: inv.store_id || '',
        store_name: storeName,
        party_name: inv.customer_name || (isEntrada ? 'Shineray do Brasil S.A.' : 'Consumidor'),
        issue_date: inv.issue_date || inv.created_at?.slice(0, 10) || '',
        event_date: eventDate || '',
        total_value: Number(inv.total) || 0,
        status: inv.status || 'emitida',
        cancellation_reason: inv.cancellation_reason || inv.notes || '',
        cancellation_type: inv.cancellation_type || 'estorno',
        sefaz_protocol: inv.sefaz_protocol || '',
        notes: inv.notes || '',
      };
      map.set(inv.invoice_number, rec);
    });

    // 2. Registros do painel fiscal local
    localRecords.forEach((loc: any) => {
      const storeName = stores.find((s) => s.id === loc.store_id)?.name || (loc.store_id?.includes('montes') ? 'Montes Claros' : 'Divinópolis');
      const isEntrada = loc.fiscal_type === 'entrada';
      const isCancel = loc.fiscal_type === 'cancelamento' || loc.status === 'cancelada';

      const fType: 'entrada' | 'emissao' | 'cancelamento' = isEntrada
        ? 'entrada'
        : isCancel
        ? 'cancelamento'
        : 'emissao';

      const eventDate = loc.entry_or_cancel_date || loc.issue_date || loc.created_at?.slice(0, 10) || '';

      const existing = map.get(loc.invoice_number);
      if (!existing) {
        map.set(loc.invoice_number, {
          id: loc.id || `loc-${loc.invoice_number}`,
          invoice_number: loc.invoice_number,
          fiscal_type: fType,
          store_id: loc.store_id || '',
          store_name: storeName,
          party_name: loc.party_name || (isEntrada ? 'Shineray do Brasil S.A.' : 'Consumidor'),
          issue_date: loc.issue_date || '',
          event_date: eventDate,
          total_value: Number(loc.total_value) || 0,
          status: loc.status || (isCancel ? 'cancelada' : 'conferido'),
          cancellation_reason: loc.cancellation_reason || loc.notes || '',
          cancellation_type: loc.cancellation_type || 'estorno',
          sefaz_protocol: loc.sefaz_protocol || '',
          notes: loc.notes || '',
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.event_date || b.issue_date).getTime() - new Date(a.event_date || a.issue_date).getTime()
    );
  }, [invoices, stores]);

  // Filtragem inteligente por Período, Mês, Semana e Loja
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 a 11

    return allFiscalRecords.filter((rec) => {
      // 1. Filtro de Loja
      if (storeFilter !== 'all') {
        const matchesStore =
          rec.store_id === storeFilter ||
          (storeFilter === 'store-montesclaros' && rec.store_name.toLowerCase().includes('montes')) ||
          (storeFilter === 'store-divinopolis' && rec.store_name.toLowerCase().includes('divin'));
        if (!matchesStore) return false;
      }

      // 2. Filtro de Tipo
      if (typeFilter !== 'all' && rec.fiscal_type !== typeFilter) {
        return false;
      }

      // 3. Filtro de Mês e Competência (baseado na data do evento: data do cancelamento ou data de emissão/entrada)
      const dStr = rec.event_date || rec.issue_date;
      if (!dStr) return true;
      const recDate = new Date(dStr);
      if (isNaN(recDate.getTime())) return true;

      if (periodFilter === 'this_month') {
        if (recDate.getFullYear() !== currentYear || recDate.getMonth() !== currentMonth) {
          return false;
        }
      } else if (periodFilter === 'last_month') {
        const lastMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        if (recDate.getFullYear() !== lastMonthYear || recDate.getMonth() !== lastMonthIndex) {
          return false;
        }
      }

      // 4. Filtro de Semana
      if (weekFilter !== 'all') {
        const dayOfMonth = recDate.getDate();
        if (weekFilter === 'last_7_days') {
          const diffDays = (now.getTime() - recDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays < 0 || diffDays > 7) return false;
        } else if (weekFilter === 'sem_1' && !(dayOfMonth >= 1 && dayOfMonth <= 7)) {
          return false;
        } else if (weekFilter === 'sem_2' && !(dayOfMonth >= 8 && dayOfMonth <= 14)) {
          return false;
        } else if (weekFilter === 'sem_3' && !(dayOfMonth >= 15 && dayOfMonth <= 21)) {
          return false;
        } else if (weekFilter === 'sem_4' && !(dayOfMonth >= 22 && dayOfMonth <= 28)) {
          return false;
        } else if (weekFilter === 'sem_5' && !(dayOfMonth >= 29)) {
          return false;
        }
      }

      return true;
    });
  }, [allFiscalRecords, storeFilter, periodFilter, weekFilter, typeFilter]);

  // Métricas do Dono calculadas exatamente sobre o período e semana selecionados
  const metrics = useMemo(() => {
    let entradasCount = 0;
    let entradasValue = 0;
    let emissoesCount = 0;
    let emissoesValue = 0;
    let cancelamentosCount = 0;
    let cancelamentosValue = 0;
    let estornosValue = 0;
    let creditosValue = 0;

    filteredRecords.forEach((r) => {
      if (r.fiscal_type === 'entrada') {
        entradasCount++;
        entradasValue += r.total_value;
      } else if (r.fiscal_type === 'cancelamento') {
        cancelamentosCount++;
        cancelamentosValue += r.total_value;
        if (r.cancellation_type === 'credito') {
          creditosValue += r.total_value;
        } else {
          estornosValue += r.total_value;
        }
      } else {
        emissoesCount++;
        emissoesValue += r.total_value;
      }
    });

    return {
      entradasCount,
      entradasValue,
      emissoesCount,
      emissoesValue,
      cancelamentosCount,
      cancelamentosValue,
      estornosValue,
      creditosValue,
    };
  }, [filteredRecords]);

  // Exportar relatório em XLSX
  const handleExportXLSX = () => {
    const exportData = filteredRecords.map((r) => ({
      Numero_NF: r.invoice_number,
      Tipo_Evento:
        r.fiscal_type === 'entrada'
          ? 'Entrada de Fábrica (Remessa)'
          : r.fiscal_type === 'cancelamento'
          ? 'Cancelamento SEFAZ'
          : 'Emissão de Venda',
      Loja: r.store_name,
      Data_Evento: r.event_date ? new Date(r.event_date).toLocaleDateString('pt-BR') : '—',
      Data_Emissao_Original: r.issue_date ? new Date(r.issue_date).toLocaleDateString('pt-BR') : '—',
      Cliente_Fornecedor: r.party_name,
      Valor_Total: r.total_value,
      Tratamento_Financeiro:
        r.fiscal_type === 'cancelamento'
          ? r.cancellation_type === 'credito'
            ? 'Crédito na Fábrica'
            : 'Estorno Financeiro'
          : 'Normal',
      Protocolo_SEFAZ: r.sefaz_protocol || '—',
      Justificativa_Motivo: r.cancellation_reason || r.notes || '—',
      Status: r.status,
    }));

    void exportToXLSX({
      title: `Controle_NFs_Dono_${new Date().toISOString().slice(0, 10)}`,
      module: 'sales',
      filters: { loja: storeFilter, mes: periodFilter, semana: weekFilter },
      columns: Object.keys(exportData[0] || {}).map((k) => ({ key: k, label: k })),
      data: exportData,
      userName: 'Diretoria / Dono',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Explicação Executiva para a Diretoria */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ReceiptText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight text-foreground">
              Controle de Notas Fiscais das Lojas (Entradas &amp; Cancelamentos)
            </h3>
            <p className="text-xs text-muted-foreground">
              Acompanhamento semanal e mensal de NFs que entraram da fábrica, faturamentos e cancelamentos com controle de estornos a receber ou créditos fiscais.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportXLSX}
          className="gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-emerald-500" />
          Exportar Relatório Fiscal (XLSX)
        </Button>
      </div>

      {/* 2. Barra de Filtros: Mês, Semana e Loja */}
      <Card className="rounded-2xl border bg-card/60">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro de Mês / Competência */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Mês de Competência</label>
              <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">Mês Atual (Novembro / 2026)</SelectItem>
                  <SelectItem value="last_month">Mês Anterior (Outubro / 2026)</SelectItem>
                  <SelectItem value="all">Todo o Histórico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Semana (A Regra Crucial: NFs de uma semana canceladas em outra) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Semana do Mês</label>
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Semanas do Mês</SelectItem>
                  <SelectItem value="last_7_days">Últimos 7 Dias (Semana Atual)</SelectItem>
                  <SelectItem value="sem_1">Semana 1 (Dias 1 a 7)</SelectItem>
                  <SelectItem value="sem_2">Semana 2 (Dias 8 a 14)</SelectItem>
                  <SelectItem value="sem_3">Semana 3 (Dias 15 a 21)</SelectItem>
                  <SelectItem value="sem_4">Semana 4 (Dias 22 a 28)</SelectItem>
                  <SelectItem value="sem_5">Semana 5 (Dias 29 a 31)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Loja */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Concessionária</label>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Concessionária" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas (Montes Claros &amp; Divinópolis)</SelectItem>
                  <SelectItem value="store-montesclaros">Concessionária Montes Claros</SelectItem>
                  <SelectItem value="store-divinopolis">Concessionária Divinópolis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Tipo de Evento */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Tipo de Operação</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Operações ({filteredRecords.length})</SelectItem>
                  <SelectItem value="entrada">Entradas de Fábrica (Remessas)</SelectItem>
                  <SelectItem value="emissao">NFs Faturadas (Vendas)</SelectItem>
                  <SelectItem value="cancelamento">NFs Canceladas (Estornos/Crédito)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Cards com Resumo Financeiro da Semana / Mês para o Dono */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NFs de Entrada */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Entradas de Fábrica
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {formatCurrencyBRL(metrics.entradasValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-emerald-600 dark:text-emerald-400">{metrics.entradasCount} NFs</strong> recebidas no período
            </p>
          </CardContent>
        </Card>

        {/* NFs Emitidas (Vendas) */}
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                NFs Faturadas (Vendas)
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {formatCurrencyBRL(metrics.emissoesValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-blue-600 dark:text-blue-400">{metrics.emissoesCount} NFs</strong> emitidas no período
            </p>
          </CardContent>
        </Card>

        {/* NFs Canceladas no Período */}
        <Card className="rounded-2xl border shadow-xs bg-card border-destructive/30">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                NFs Canceladas
              </span>
              <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-destructive">
              {formatCurrencyBRL(metrics.cancelamentosValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-destructive">{metrics.cancelamentosCount} NFs</strong> canceladas no período
            </p>
          </CardContent>
        </Card>

        {/* Estornos e Créditos */}
        <Card className="rounded-2xl border shadow-xs bg-card border-amber-500/30">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Estornos &amp; Crédito
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
              {formatCurrencyBRL(metrics.estornosValue + metrics.creditosValue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {metrics.estornosValue > 0 && (
                <span>Estorno: {formatCurrencyBRL(metrics.estornosValue)} • </span>
              )}
              <span>Crédito Fábrica: {formatCurrencyBRL(metrics.creditosValue)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Tabela Executiva Detalhada */}
      <Card className="rounded-2xl border shadow-xs bg-card">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">
                Extrato Fiscal de Operações
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {filteredRecords.length} operações registradas no período selecionado (Semana / Mês)
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold">
              {weekFilter === 'all' ? 'Mês Completo' : weekFilter.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Operação</TableHead>
                  <TableHead className="text-xs">Número da NF</TableHead>
                  <TableHead className="text-xs">Data do Evento</TableHead>
                  <TableHead className="text-xs">Emissão Original</TableHead>
                  <TableHead className="text-xs">Loja</TableHead>
                  <TableHead className="text-xs">Destinatário / Fornecedor</TableHead>
                  <TableHead className="text-xs text-right">Valor Total</TableHead>
                  <TableHead className="text-xs">Tratamento Financeiro</TableHead>
                  <TableHead className="text-xs">Protocolo / Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
                      Carregando dados fiscais...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-xs text-muted-foreground">
                      Nenhuma operação de NF encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => {
                    const isEntrada = r.fiscal_type === 'entrada';
                    const isCancel = r.fiscal_type === 'cancelamento';

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/40">
                        {/* Tipo de Operação */}
                        <TableCell>
                          <Badge
                            className={`text-[10px] font-bold ${
                              isEntrada
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : isCancel
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {isEntrada ? 'ENTRADA FÁBRICA' : isCancel ? 'CANCELADA' : 'FATURADA'}
                          </Badge>
                        </TableCell>

                        {/* Número da NF */}
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {r.invoice_number}
                        </TableCell>

                        {/* Data do Evento */}
                        <TableCell className="text-xs">
                          <span className="font-semibold text-foreground">
                            {r.event_date ? new Date(r.event_date).toLocaleDateString('pt-BR') : '—'}
                          </span>
                        </TableCell>

                        {/* Emissão Original */}
                        <TableCell className="text-xs text-muted-foreground">
                          {r.issue_date ? new Date(r.issue_date).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>

                        {/* Loja */}
                        <TableCell className="text-xs font-medium">
                          {r.store_name}
                        </TableCell>

                        {/* Destinatário */}
                        <TableCell className="text-xs max-w-[180px] truncate text-foreground font-medium">
                          {r.party_name}
                        </TableCell>

                        {/* Valor Total */}
                        <TableCell className="text-xs text-right font-bold font-mono">
                          <span className={isCancel ? 'text-destructive' : 'text-foreground'}>
                            {formatCurrencyBRL(r.total_value)}
                          </span>
                        </TableCell>

                        {/* Tratamento Financeiro */}
                        <TableCell className="text-xs">
                          {isCancel ? (
                            r.cancellation_type === 'credito' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" /> Crédito na Fábrica
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                                <RotateCcw className="w-3 h-3" /> Estorno Financeiro
                              </span>
                            )
                          ) : isEntrada ? (
                            <span className="text-muted-foreground text-[11px]">Carga Recebida</span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Receita de Venda</span>
                          )}
                        </TableCell>

                        {/* Protocolo / Motivo */}
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {r.sefaz_protocol ? (
                            <span className="font-mono text-[10px] text-foreground font-semibold">
                              Prot: {r.sefaz_protocol}
                            </span>
                          ) : (
                            r.cancellation_reason || r.notes || '—'
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
    </div>
  );
}
