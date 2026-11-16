import { useState, useMemo } from 'react';
import {
  FileCheck2,
  Paperclip,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Store,
  Calendar,
  DollarSign,
  User,
  Bike,
  CreditCard,
  Landmark,
  Banknote,
  QrCode,
  Download,
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

interface ExecutiveSalesReceiptsAuditorProps {
  sales: ConsolidatedSaleItem[];
}

export function ExecutiveSalesReceiptsAuditor({ sales }: ExecutiveSalesReceiptsAuditorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'with_receipt' | 'missing_receipt'>('all');
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Mapeia cada venda com a contagem de comprovantes no localStorage / banco
  const salesWithReceiptStatus = useMemo(() => {
    return sales.map((sale) => {
      const receipts = getSaleReceipts(sale.id);
      return {
        ...sale,
        receiptsCount: receipts.length,
        hasReceipts: receipts.length > 0,
      };
    });
  }, [sales]);

  // Filtros combinados
  const filteredSales = useMemo(() => {
    return salesWithReceiptStatus.filter((sale) => {
      // 1. Filtro de Loja
      if (storeFilter !== 'all') {
        const storeUpper = (sale.store_name || '').toUpperCase();
        if (storeFilter === 'montesclaros' && !storeUpper.includes('MONTES CLAROS') && !storeUpper.includes('MOC')) {
          return false;
        }
        if (storeFilter === 'divinopolis' && !storeUpper.includes('DIVINOPOLIS')) {
          return false;
        }
      }

      // 2. Filtro de Comprovante
      if (receiptFilter === 'with_receipt' && !sale.hasReceipts) return false;
      if (receiptFilter === 'missing_receipt' && sale.hasReceipts) return false;

      // 3. Busca por texto
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
  }, [salesWithReceiptStatus, storeFilter, receiptFilter, searchTerm]);

  // Estatísticas de Auditoria
  const auditStats = useMemo(() => {
    const total = salesWithReceiptStatus.length;
    const withReceipts = salesWithReceiptStatus.filter((s) => s.hasReceipts).length;
    const missingReceipts = total - withReceipts;
    const complianceRate = total > 0 ? (withReceipts / total) * 100 : 0;

    return { total, withReceipts, missingReceipts, complianceRate };
  }, [salesWithReceiptStatus]);

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

  return (
    <div className="space-y-6">
      {/* Cards de Resumo da Auditoria */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Total de Vendas Auditadas</p>
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
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Com Comprovante Anexado</p>
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
              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">Sem Comprovante (Pendente)</p>
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
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Taxa de Conformidade</p>
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
                Auditoria de Comprovantes &amp; Recibos de Pagamento
              </CardTitle>
              <CardDescription className="text-xs">
                Audite em 1 clique os recibos de PIX, depósitos, cartão e faturamento de cada venda.
              </CardDescription>
            </div>

            {/* Filtros da Auditoria */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 text-xs rounded-xl"
                  placeholder="Cliente, chassi, vendedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-8 text-xs w-36 rounded-xl">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Lojas</SelectItem>
                  <SelectItem value="montesclaros">Montes Claros</SelectItem>
                  <SelectItem value="divinopolis">Divinópolis</SelectItem>
                </SelectContent>
              </Select>

              <Select value={receiptFilter} onValueChange={(v: any) => setReceiptFilter(v)}>
                <SelectTrigger className="h-8 text-xs w-44 rounded-xl">
                  <SelectValue placeholder="Status do Comprovante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="with_receipt">Com Comprovante ({auditStats.withReceipts})</SelectItem>
                  <SelectItem value="missing_receipt">Pendente de Comprovante ({auditStats.missingReceipts})</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead>Composição de Pagamento</TableHead>
                  <TableHead className="text-center">Comprovantes</TableHead>
                  <TableHead className="w-24 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-xs">
                      Nenhuma venda encontrada com os filtros selecionados.
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
                          {sale.store_name?.includes('MONTES') ? 'Montes Claros' : 'Divinópolis'}
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
                            {sale.receiptsCount} {sale.receiptsCount === 1 ? 'anexo' : 'anexos'}
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
                          <span>Ver</span>
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
