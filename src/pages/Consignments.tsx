import { useState } from 'react';
import { 
  Search, 
  FileText, 
  Calendar,
  Store,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Car,
  Bike,
  Eye,
  CreditCard,
  Plus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStores } from '@/hooks/useStores';
import { useResellers } from '@/hooks/useResellers';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard, FilterBar, PanelCard } from '@/components/ui/stat-card';
import { RegisterConsignmentPaymentDialog } from '@/components/consignments/RegisterConsignmentPaymentDialog';
import { CreateConsignmentDialog } from '@/components/consignments/CreateConsignmentDialog';

interface ConsignmentContract {
  id: string;
  vehicle_id: string;
  reseller_id: string;
  store_id: string;
  vehicle_cost: number;
  payment_type: 'percentage' | 'full';
  upfront_percentage: number;
  upfront_amount: number;
  remaining_percentage: number;
  remaining_amount: number;
  full_payment_amount: number;
  upfront_paid: boolean;
  upfront_paid_at: string | null;
  remaining_paid: boolean;
  remaining_paid_at: string | null;
  status: string;
  terms: string | null;
  notes: string | null;
  created_at: string;
  vehicle?: {
    brand: string;
    model: string;
    year: number;
    chassis: string;
    plate: string;
    vehicle_type: string;
  };
  reseller?: {
    full_name: string;
    cpf: string;
    phone: string;
  };
  store?: {
    name: string;
  };
}

const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle }> = {
  ativo: { label: 'Ativo', class: 'bg-primary/10 text-primary', icon: Clock },
  quitado: { label: 'Quitado', class: 'bg-success/10 text-success', icon: CheckCircle },
  cancelado: { label: 'Cancelado', class: 'bg-destructive/10 text-destructive', icon: AlertCircle },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export default function Consignments() {
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [resellerFilter, setResellerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContract, setSelectedContract] = useState<ConsignmentContract | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: stores } = useStores();
  const { data: resellers } = useResellers();
  const { isAdmin, hasElevatedAccess } = useAuth();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['consignment-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reseller_consignment_contracts')
        .select(`
          *,
          vehicle:vehicles(brand, model, year, chassis, plate, vehicle_type),
          reseller:resellers(full_name, cpf, phone),
          store:stores(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ConsignmentContract[];
    },
  });

  const filteredContracts = contracts?.filter(contract => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !searchLower ||
      contract.vehicle?.brand?.toLowerCase().includes(searchLower) ||
      contract.vehicle?.model?.toLowerCase().includes(searchLower) ||
      contract.vehicle?.chassis?.toLowerCase().includes(searchLower) ||
      contract.vehicle?.plate?.toLowerCase().includes(searchLower) ||
      contract.reseller?.full_name?.toLowerCase().includes(searchLower) ||
      contract.reseller?.cpf?.includes(search.replace(/\D/g, ''));

    const matchesStore = storeFilter === 'all' || contract.store_id === storeFilter;
    const matchesReseller = resellerFilter === 'all' || contract.reseller_id === resellerFilter;
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;

    return matchesSearch && matchesStore && matchesReseller && matchesStatus;
  }) || [];

  const totalValue = filteredContracts.reduce((sum, c) => sum + Number(c.vehicle_cost), 0);
  const pendingPayments = filteredContracts.filter(c => c.status === 'ativo').length;
  const completedContracts = filteredContracts.filter(c => c.status === 'quitado').length;

  const handleViewDetails = (contract: ConsignmentContract) => {
    setSelectedContract(contract);
    setDetailsOpen(true);
  };

  const handleRegisterPayment = (contract: ConsignmentContract) => {
    setSelectedContract(contract);
    setPaymentOpen(true);
  };

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Consignações"
        description="Contratos de veículos com revendedores parceiros."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Consignação
          </Button>
        }
      />
      <CreateConsignmentDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contratos" value={filteredContracts.length} icon={FileText} />
        <StatCard label="Valor total" value={formatCurrency(totalValue)} icon={DollarSign} />
        <StatCard label="Pendentes" value={pendingPayments} icon={Clock} tone="warning" />
        <StatCard label="Quitados" value={completedContracts} icon={CheckCircle} tone="success" />
      </div>


      {/* Filters */}
      <FilterBar>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por veículo, chassi, revendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={storeFilter} onValueChange={setStoreFilter} disabled={!isAdmin && !hasElevatedAccess}>
            <SelectTrigger className="h-10 w-[140px]">
              <Store className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {stores?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={resellerFilter} onValueChange={setResellerFilter}>
            <SelectTrigger className="h-10 w-[140px]">
              <User className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Revendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {resellers?.filter(r => r.is_active).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filteredContracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">Nenhum contrato encontrado</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {search || storeFilter !== 'all' || resellerFilter !== 'all' || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Contratos de consignação aparecerão aqui quando veículos forem transferidos para revendedores.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wide">Veículo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Revendedor</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Loja</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Valor</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Tipo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Pagamentos</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Data</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => {
                  const statusInfo = statusConfig[contract.status] || statusConfig.ativo;
                  const VehicleIcon = contract.vehicle?.vehicle_type === 'moto' ? Bike : Car;
                  
                  return (
                    <TableRow key={contract.id} className="group">
                      <TableCell>
                        {contract.vehicle ? (
                          <div className="flex items-center gap-2">
                            <VehicleIcon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{contract.vehicle.brand} {contract.vehicle.model}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {contract.vehicle.chassis}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{contract.reseller?.full_name || '-'}</p>
                      </TableCell>
                      <TableCell className="text-sm">{contract.store?.name || '-'}</TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{formatCurrency(Number(contract.vehicle_cost))}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {contract.payment_type === 'percentage' ? 'Porcentagem' : '100%'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {contract.payment_type === 'percentage' ? (
                            <>
                              <div className="flex items-center gap-1">
                                {contract.upfront_paid ? (
                                  <CheckCircle className="w-3 h-3 text-success" />
                                ) : (
                                  <Clock className="w-3 h-3 text-warning" />
                                )}
                                <span className="text-xs">
                                  Entrada: {contract.upfront_percentage}% ({formatCurrency(contract.upfront_amount)})
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {contract.remaining_paid ? (
                                  <CheckCircle className="w-3 h-3 text-success" />
                                ) : (
                                  <Clock className="w-3 h-3 text-warning" />
                                )}
                                <span className="text-xs">
                                  Restante: {contract.remaining_percentage}% ({formatCurrency(contract.remaining_amount)})
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              {contract.upfront_paid ? (
                                <CheckCircle className="w-3 h-3 text-success" />
                              ) : (
                                <Clock className="w-3 h-3 text-warning" />
                              )}
                              <span className="text-xs">
                                Total: {formatCurrency(contract.full_payment_amount)}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs font-medium', statusInfo.class)}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(contract.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewDetails(contract)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {contract.status === 'ativo' && hasElevatedAccess && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRegisterPayment(contract)}
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Contrato</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Veículo</p>
                  <p className="font-medium">
                    {selectedContract.vehicle?.brand} {selectedContract.vehicle?.model}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedContract.vehicle?.chassis}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Revendedor</p>
                  <p className="font-medium">{selectedContract.reseller?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedContract.reseller?.phone}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground uppercase mb-2">Valores</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Valor do veículo:</span>
                    <span className="font-semibold text-primary">{formatCurrency(selectedContract.vehicle_cost)}</span>
                  </div>
                  {selectedContract.payment_type === 'percentage' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {selectedContract.upfront_paid ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <Clock className="w-4 h-4 text-warning" />
                          )}
                          Entrada ({selectedContract.upfront_percentage}%):
                        </span>
                        <span>{formatCurrency(selectedContract.upfront_amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {selectedContract.remaining_paid ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <Clock className="w-4 h-4 text-warning" />
                          )}
                          Após venda ({selectedContract.remaining_percentage}%):
                        </span>
                        <span>{formatCurrency(selectedContract.remaining_amount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {selectedContract.upfront_paid ? (
                          <CheckCircle className="w-4 h-4 text-success" />
                        ) : (
                          <Clock className="w-4 h-4 text-warning" />
                        )}
                        Pagamento integral:
                      </span>
                      <span>{formatCurrency(selectedContract.full_payment_amount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedContract.terms && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Termos do contrato</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedContract.terms}</p>
                </div>
              )}

              {selectedContract.notes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Observações</p>
                  <p className="text-sm">{selectedContract.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {selectedContract && (
        <RegisterConsignmentPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          contract={selectedContract}
        />
      )}
    </div>
  );
}
