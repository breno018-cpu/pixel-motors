import React, { useState, useMemo } from 'react';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  FileCheck,
  UserCheck,
  Building2,
  Printer,
  Edit,
  Download,
  RotateCcw,
  ShieldCheck,
  Route,
  Navigation,
  Calculator,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GlassView } from '@/components/ui/GlassView';
import { getLiveSheetRows, formatCurrencyBRL } from '@/lib/dealershipSheetParser';
import { buildLogisticsDeliveries, DeliveryRecord, DeliveryStatus } from '@/lib/logisticsStorage';
import { DeliveryManageModal } from '@/components/logistics/DeliveryManageModal';
import { AuthorizedEntryDeliveryTermModal } from '@/components/logistics/AuthorizedEntryDeliveryTermModal';
import { FreightCalculatorDialog } from '@/components/logistics/FreightCalculatorDialog';
import { TRANSPORT_LOGISTICS_METHODS } from '@/lib/transportLogistics';
import { exportToXLSX } from '@/lib/export';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function Logistics() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [poloFilter, setPoloFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);
  const [calcDelivery, setCalcDelivery] = useState<DeliveryRecord | null>(null);

  // Carrega vendas reais da planilha e constrói registros operacionais
  const sheetRows = useMemo(() => getLiveSheetRows(), []);
  const [refreshKey, setRefreshKey] = useState(0);

  const deliveries = useMemo(() => {
    return buildLogisticsDeliveries(sheetRows);
  }, [sheetRows, refreshKey]);

  // Filtros combinados
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (poloFilter !== 'all' && d.poloOrigemId !== poloFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (methodFilter !== 'all' && d.metodoTransporteId !== methodFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesClient = d.cliente.toLowerCase().includes(query);
        const matchesChassis = d.chassi.toLowerCase().includes(query);
        const matchesModel = d.modelo.toLowerCase().includes(query);
        const matchesCity = d.regiao.toLowerCase().includes(query);
        const matchesDriver = (d.motoristaNome || '').toLowerCase().includes(query);
        if (!matchesClient && !matchesChassis && !matchesModel && !matchesCity && !matchesDriver) {
          return false;
        }
      }

      return true;
    });
  }, [deliveries, poloFilter, statusFilter, methodFilter, searchTerm]);

  // Métricas Consolidadas de Logística
  const metrics = useMemo(() => {
    const total = deliveries.length;
    const entregues = deliveries.filter((d) => d.status === 'entregue').length;
    const emTransporte = deliveries.filter((d) => d.status === 'em_transporte').length;
    const aguardando = deliveries.filter((d) => d.status === 'aguardando_despacho').length;
    const custoTotalFrete = deliveries.reduce((acc, d) => acc + d.custoFreteEstimado, 0);
    const taxaConclusao = total > 0 ? ((entregues / total) * 100).toFixed(1) : '0';

    return {
      total,
      entregues,
      emTransporte,
      aguardando,
      custoTotalFrete,
      taxaConclusao,
    };
  }, [deliveries]);

  const handleEditDelivery = (item: DeliveryRecord) => {
    setSelectedDelivery(item);
    setManageModalOpen(true);
  };

  const handleOpenTerm = (item: DeliveryRecord) => {
    setSelectedDelivery(item);
    setTermModalOpen(true);
  };

  const handleExportXLSX = () => {
    const exportData = filteredDeliveries.map((d) => ({
      Chassi: d.chassi,
      Cliente: d.cliente,
      Modelo: d.modelo,
      Destino: `${d.regiao} - ${d.uf}`,
      Polo: d.poloOrigemNome,
      Status:
        d.status === 'entregue'
          ? 'Entregue'
          : d.status === 'em_transporte'
          ? 'Em Transporte'
          : 'Aguardando Despacho',
      Transporte: d.metodoTransporteNome,
      Motorista: d.motoristaNome || 'Não atribuído',
      Placa: d.motoristaPlaca || '-',
      DistanciaKm: d.distanciaKm,
      FreteEstimado: d.custoFreteEstimado,
      DataVenda: d.dataVenda,
    }));

    void exportToXLSX({
      title: `Logistica_Entregas_${new Date().toISOString().slice(0, 10)}`,
      module: 'sales',
      filters: { status: statusFilter, polo: poloFilter, transporte: methodFilter },
      columns: Object.keys(exportData[0] || {}).map((key) => ({ key, label: key })),
      data: exportData,
      userName: profile?.full_name || '',
    });
    toast({
      title: 'Relatório exportado!',
      description: 'A planilha de logística e entregas foi baixada.',
    });
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'entregue':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Entregue
          </Badge>
        );
      case 'em_transporte':
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 text-[11px] font-bold">
            <Truck className="w-3 h-3 mr-1 text-sky-600" /> Em Transporte
          </Badge>
        );
      case 'aguardando_despacho':
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold">
            <Clock className="w-3 h-3 mr-1 text-amber-600" /> Aguardando Despacho
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CABEÇALHO PADRONIZADO */}
      <PageHeader
        title="Logística & Entregas"
        description="Controle de fretes, entregas aos clientes e termos de recebimento das lojas de Montes Claros e Divinópolis."
        badge={
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Montes Claros &amp; Divinópolis
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setCalcDelivery(null);
                setCalculatorOpen(true);
              }}
              className="gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Calculator className="w-3.5 h-3.5" />
              Simular Frete
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportXLSX}
              className="gap-1.5 font-medium"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              Exportar XLSX
            </Button>
          </div>
        }
      />

      {/* 2. Resumo de Entregas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <GlassView glassEffectStyle="regular" className="p-4 rounded-2xl border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total de Entregas
          </span>
          <div className="text-2xl font-black font-display text-foreground">{metrics.total}</div>
          <span className="text-[10px] text-muted-foreground">Motos para entrega</span>
        </GlassView>

        <GlassView glassEffectStyle="regular" className="p-4 rounded-2xl border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Entregas Concluídas
          </span>
          <div className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400">
            {metrics.entregues}
          </div>
          <span className="text-[10px] text-muted-foreground">{metrics.taxaConclusao}% já entregues</span>
        </GlassView>

        <GlassView glassEffectStyle="regular" className="p-4 rounded-2xl border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Em Transporte
          </span>
          <div className="text-2xl font-black font-display text-sky-600 dark:text-sky-400">
            {metrics.emTransporte}
          </div>
          <span className="text-[10px] text-muted-foreground">Em trânsito com motorista</span>
        </GlassView>

        <GlassView glassEffectStyle="regular" className="p-4 rounded-2xl border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Aguardando Despacho
          </span>
          <div className="text-2xl font-black font-display text-amber-600 dark:text-amber-400">
            {metrics.aguardando}
          </div>
          <span className="text-[10px] text-muted-foreground">Prontas no pátio / oficina PDI</span>
        </GlassView>

        <GlassView glassEffectStyle="regular" className="p-4 rounded-2xl border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Total em Fretes
          </span>
          <div className="text-2xl font-black font-display text-purple-600 dark:text-purple-400">
            {formatCurrencyBRL(metrics.custoTotalFrete)}
          </div>
          <span className="text-[10px] text-muted-foreground">Valor total estimado</span>
        </GlassView>
      </div>

      {/* 3. Barra de Filtros e Busca */}
      <GlassView glassEffectStyle="clear" className="p-3 rounded-2xl border space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, chassi, cidade, modelo ou motorista..."
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={poloFilter} onValueChange={setPoloFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs font-semibold rounded-xl">
                <Building2 className="w-3.5 h-3.5 mr-1 text-primary" />
                <SelectValue placeholder="Polo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os Polos</SelectItem>
                <SelectItem value="store-divinopolis" className="text-xs">Polo Divinópolis</SelectItem>
                <SelectItem value="store-montesclaros" className="text-xs">Polo Montes Claros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs font-semibold rounded-xl">
                <Filter className="w-3.5 h-3.5 mr-1 text-primary" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                <SelectItem value="aguardando_despacho" className="text-xs">Aguardando Despacho</SelectItem>
                <SelectItem value="em_transporte" className="text-xs">Em Transporte</SelectItem>
                <SelectItem value="entregue" className="text-xs">Entregue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs font-semibold rounded-xl">
                <Truck className="w-3.5 h-3.5 mr-1 text-primary" />
                <SelectValue placeholder="Transporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os Métodos</SelectItem>
                {TRANSPORT_LOGISTICS_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassView>

      {/* 4. Tabela Operacional de Entregas */}
      <Card className="rounded-3xl border shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" />
              Fila de Entregas
            </CardTitle>
            <CardDescription className="text-xs">
              {filteredDeliveries.length} entregas encontradas com os filtros selecionados
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-bold font-mono">
            {filteredDeliveries.length} registros
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-muted/40">
                  <TableHead className="font-bold">Veículo / Chassi</TableHead>
                  <TableHead className="font-bold">Cliente Destinatário</TableHead>
                  <TableHead className="font-bold">Cidade / Destino</TableHead>
                  <TableHead className="font-bold">Polo de Saída</TableHead>
                  <TableHead className="font-bold">Modalidade</TableHead>
                  <TableHead className="font-bold">Motorista / Placa</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="text-xs">
                {filteredDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma entrega encontrada com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeliveries.map((item) => (
                    <TableRow key={item.saleId} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="font-bold text-foreground">{item.modelo}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {item.chassi ? String(item.chassi).slice(-8) : '—'}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-bold text-foreground">{item.cliente}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Venda: {item.vendedor} • {formatCurrencyBRL(item.valor)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-bold text-foreground">
                          {item.regiao} - {item.uf}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.distanciaKm} km rodoviários
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {item.poloOrigemId === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs font-semibold text-foreground truncate max-w-[160px]" title={item.metodoTransporteNome}>
                          {item.metodoTransporteNome}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold">
                          Frete: {formatCurrencyBRL(item.custoFreteEstimado)}
                        </div>
                      </TableCell>

                      <TableCell>
                        {item.motoristaNome ? (
                          <div>
                            <strong className="text-foreground text-xs">{item.motoristaNome}</strong>
                            {item.motoristaPlaca && (
                              <div className="text-[10px] font-mono text-muted-foreground font-bold">
                                Placa: {item.motoristaPlaca}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Não atribuído</span>
                        )}
                      </TableCell>

                      <TableCell>{getStatusBadge(item.status)}</TableCell>

                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCalcDelivery(item);
                              setCalculatorOpen(true);
                            }}
                            className="h-8 text-xs font-bold gap-1 text-sky-600 hover:bg-sky-500/10 rounded-lg"
                            title="Simular e comparar cálculo de frete para este destino"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Frete</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditDelivery(item)}
                            className="h-8 text-xs font-bold gap-1 text-primary hover:bg-primary/10 rounded-lg"
                            title="Gerenciar despacho e motorista"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Despachar</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenTerm(item)}
                            className="h-8 text-xs font-bold gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-lg"
                            title="Emitir Termo de Entrada e Entrega com Assinatura GOV.BR"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden lg:inline">Termo GOV</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modais de Gestão, Termo e Simulador de Frete */}
      <DeliveryManageModal
        open={manageModalOpen}
        onOpenChange={setManageModalOpen}
        delivery={selectedDelivery}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <AuthorizedEntryDeliveryTermModal
        open={termModalOpen}
        onOpenChange={setTermModalOpen}
        delivery={selectedDelivery}
      />

      <FreightCalculatorDialog
        key={calcDelivery ? calcDelivery.saleId : 'generic-calc'}
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
        initialDestinationCity={calcDelivery ? `${calcDelivery.regiao} - ${calcDelivery.uf}` : undefined}
        initialKm={calcDelivery?.distanciaKm}
        customerName={calcDelivery?.cliente}
        vehicleModel={calcDelivery?.modelo}
      />
    </div>
  );
}
