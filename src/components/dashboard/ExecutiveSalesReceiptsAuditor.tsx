import { useState, useMemo } from 'react';
import {
  FileCheck2,
  Paperclip,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  Store,
  DollarSign,
  User,
  Bike,
  CreditCard,
  Landmark,
  QrCode,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SaleReceiptsModal } from '@/components/sales/SaleReceiptsModal';
import { getSaleReceipts } from '@/components/sales/ReceiptAttachmentManager';
import { ConsolidatedSaleItem } from '@/hooks/useConsolidatedSales';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { isMontesClarosStore, getStoreDisplayName } from '@/lib/storeResolution';

interface ExecutiveSalesReceiptsAuditorProps {
  sales: ConsolidatedSaleItem[];
}

const MONTHS_LABELS: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

export function ExecutiveSalesReceiptsAuditor({ sales }: ExecutiveSalesReceiptsAuditorProps) {
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'with_receipt' | 'missing_receipt'>('all');
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Lista de meses disponíveis nas vendas
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);
    set.add('2026-10');
    sales.forEach((s) => {
      const d = new Date(s.date);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        set.add(key);
      }
    });
    return Array.from(set).sort().reverse();
  }, [sales, currentMonthKey]);

  // Mapeia cada venda verificando APENAS comprovantes REAIS anexados (com URL ou arquivo válido)
  const salesWithReceiptStatus = useMemo(() => {
    return sales.map((sale) => {
      const rawReceipts = getSaleReceipts(sale.id);
      // Filtra estritamente comprovantes reais com URL/base64 de imagem ou PDF válido
      const realReceipts = rawReceipts.filter(
        (r) =>
          r &&
          r.url &&
          (r.url.startsWith('data:') ||
            r.url.startsWith('http') ||
            r.url.startsWith('blob:') ||
            r.url.startsWith('/'))
      );

      return {
        ...sale,
        receiptsCount: realReceipts.length,
        hasReceipts: realReceipts.length > 0,
      };
    });
  }, [sales]);

  // Filtros combinados com isolamento estrito por Mês Selecionado
  const filteredSales = useMemo(() => {
    return salesWithReceiptStatus.filter((sale) => {
      // 1. Filtro Obrigatório de Mês de Competência
      if (selectedMonth !== 'all') {
        const d = new Date(sale.date);
        const saleMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (saleMonth !== selectedMonth) return false;
      }

      // 2. Filtro de Loja
      if (storeFilter !== 'all') {
        const isMoc = isMontesClarosStore(sale);
        if (storeFilter === 'montesclaros' && !isMoc) {
          return false;
        }
        if (storeFilter === 'divinopolis' && isMoc) {
          return false;
        }
      }

      // 3. Filtro de Comprovante (Real)
      if (receiptFilter === 'with_receipt' && !sale.hasReceipts) return false;
      if (receiptFilter === 'missing_receipt' && sale.hasReceipts) return false;

      // 4. Busca por texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matches =
          (sale.cliente || '').toLowerCase().includes(q) ||
          (sale.chassi || '').toLowerCase().includes(q) ||
          (sale.modelo || '').toLowerCase().includes(q) ||
          (sale.vendedor || '').toLowerCase().includes(q) ||
          (sale.contract_number || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [salesWithReceiptStatus, selectedMonth, storeFilter, receiptFilter, searchTerm]);

  // Estatísticas de Auditoria do Mês Selecionado
  const monthAuditedSales = useMemo(() => {
    return salesWithReceiptStatus.filter((sale) => {
      if (selectedMonth === 'all') return true;
      const d = new Date(sale.date);
      const saleMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return saleMonth === selectedMonth;
    });
  }, [salesWithReceiptStatus, selectedMonth]);

  const auditStats = useMemo(() => {
    const total = monthAuditedSales.length;
    const withReceipts = monthAuditedSales.filter((s) => s.hasReceipts).length;
    const missingReceipts = total - withReceipts;
    const complianceRate = total > 0 ? (withReceipts / total) * 100 : 0;

    return { total, withReceipts, missingReceipts, complianceRate };
  }, [monthAuditedSales]);

  const handleOpenReceiptModal = (sale: any) => {
    setSelectedSaleForModal({
      id: sale.id,
      contract_number: sale.contract_number,
      buyer_name: sale.cliente,
      buyer_cpf: sale.lead_mapping || '',
      sale_price: sale.valor,
      status: sale.is_permitted ? 'concluido' : 'pendente',
      vehicle: {
        brand: 'SHINERAY',
        model: sale.modelo,
        year: 2026,
        chassis: sale.chassi,
      },
      external_data: {
        vehicle_model_custom: sale.modelo,
      },
    });
    setModalOpen(true);
  };

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'Todos os Períodos';
    const [y, m] = selectedMonth.split('-');
    return `${MONTHS_LABELS[m] || m} de ${y}`;
  }, [selectedMonth]);

  return (
    <div className="space-y-6">
      {/* 4 Cards de Resumo da Auditoria do Mês */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Vendas em {selectedMonthLabel}</p>
              <h3 className="text-2xl font-black text-foreground mt-0.5">{auditStats.total}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 shadow-xs bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Com Comprovante Real</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{auditStats.withReceipts}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-rose-500/20 shadow-xs bg-rose-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">Pendente de Comprovante</p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{auditStats.missingReceipts}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Conformidade do Mês</p>
              <h3 className="text-2xl font-black text-primary mt-0.5">{auditStats.complianceRate.toFixed(1)}%</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Paperclip className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Vendas e Comprovantes */}
      <Card className="rounded-2xl border shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                Auditoria de Comprovantes • {selectedMonthLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                Audite em 1 clique os recibos reais de PIX, depósitos e faturamento de cada venda deste mês.
              </CardDescription>
            </div>

            {/* Filtros da Auditoria com Seletor de Mês */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Seletor de Mês de Competência */}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-8 text-xs w-44 rounded-xl font-bold bg-background">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Meses</SelectItem>
                    {availableMonths.map((mKey) => {
                      const [y, m] = mKey.split('-');
                      return (
                        <SelectItem key={mKey} value={mKey}>
                          {MONTHS_LABELS[m] || m} de {y}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Loja */}
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-8 text-xs w-36 rounded-xl bg-background">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas</SelectItem>
                  <SelectItem value="montesclaros">Montes Claros</SelectItem>
                  <SelectItem value="divinopolis">Divinópolis</SelectItem>
                </SelectContent>
              </Select>

              {/* Status do Comprovante */}
              <Select value={receiptFilter} onValueChange={(v: any) => setReceiptFilter(v)}>
                <SelectTrigger className="h-8 text-xs w-44 rounded-xl bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="with_receipt">Com Comprovante Real ({auditStats.withReceipts})</SelectItem>
                  <SelectItem value="missing_receipt">Pendente ({auditStats.missingReceipts})</SelectItem>
                </SelectContent>
              </Select>

              {/* Busca por texto */}
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs rounded-xl bg-background"
                  placeholder="Cliente, chassi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motocicleta &amp; Chassi</TableHead>
                  <TableHead>Loja / Vendedor</TableHead>
                  <TableHead className="text-right">Valor da Venda</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="text-center">Comprovante</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                      Nenhuma venda encontrada para {selectedMonthLabel} com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {sale.dateStr || new Date(sale.date).toLocaleDateString('pt-BR')}
                      </TableCell>

                      <TableCell>
                        <div className="font-bold text-xs text-foreground">{sale.cliente}</div>
                        {sale.contract_number && (
                          <div className="text-[10px] text-muted-foreground font-mono">{sale.contract_number}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-xs text-foreground">{sale.modelo}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {sale.chassi ? `Chassi: ${sale.chassi}` : 'Chassi não informado'}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-semibold text-foreground">
                          {getStoreDisplayName(sale)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Vend.: {sale.vendedor || '—'}</div>
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs text-primary whitespace-nowrap">
                        {formatCurrencyBRL(sale.valor)}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {(sale.dinheiro > 0 || sale.pix > 0) && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 px-1.5 py-0">
                              <QrCode className="w-2.5 h-2.5" />
                              PIX/Dinheiro: {formatCurrencyBRL(sale.dinheiro + sale.pix)}
                            </Badge>
                          )}
                          {sale.financiamento > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 px-1.5 py-0">
                              <Landmark className="w-2.5 h-2.5" />
                              {sale.banco || 'Financ.'}: {formatCurrencyBRL(sale.financiamento)}
                            </Badge>
                          )}
                          {sale.cartao > 0 && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 px-1.5 py-0">
                              <CreditCard className="w-2.5 h-2.5" />
                              Cartão: {formatCurrencyBRL(sale.cartao)}
                            </Badge>
                          )}
                          {sale.carta_credito > 0 && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 gap-1 px-1.5 py-0">
                              Consórcio: {formatCurrencyBRL(sale.carta_credito)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        {sale.hasReceipts ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold gap-1 px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            {sale.receiptsCount} {sale.receiptsCount === 1 ? 'real' : 'reais'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-[10px] font-bold gap-1 px-2 py-0.5">
                            <AlertCircle className="w-3 h-3" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={sale.hasReceipts ? 'default' : 'outline'}
                          className="h-7 text-[11px] font-semibold gap-1 px-2.5 rounded-lg"
                          onClick={() => handleOpenReceiptModal(sale)}
                        >
                          <Eye className="w-3 h-3" />
                          <span>{sale.hasReceipts ? 'Ver' : 'Anexar'}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Comprovantes */}
      {selectedSaleForModal && (
        <SaleReceiptsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          sale={selectedSaleForModal}
          vehicleName={selectedSaleForModal.external_data?.vehicle_model_custom}
        />
      )}
    </div>
  );
}
