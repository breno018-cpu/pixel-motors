import { useState, useMemo } from 'react';
import {
  CalendarClock,
  Plus,
  Search,
  Car,
  Bike,
  Calendar,
  Store,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  MoreHorizontal,
  Trash2,
  Download,
  ArrowRightCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useReservations,
  useCancelReservation,
  useDeleteReservation,
  Reservation,
} from '@/hooks/useReservations';
import { useAuth } from '@/contexts/AuthContext';
import { CreateReservationDialog } from '@/components/reservations/CreateReservationDialog';
import { ConvertReservationDialog } from '@/components/reservations/ConvertReservationDialog';
import { downloadReservationContractPDF } from '@/lib/reservationPdf';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { maskCPF } from '@/lib/masks';

const statusConfig: Record<
  string,
  { label: string; class: string; icon: typeof CheckCircle }
> = {
  ativa: {
    label: 'Ativa',
    class: 'bg-warning/10 text-warning border-warning/20',
    icon: Clock,
  },
  convertida: {
    label: 'Convertida em venda',
    class: 'bg-success/10 text-success border-success/20',
    icon: CheckCircle,
  },
  cancelada: {
    label: 'Cancelada',
    class: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: XCircle,
  },
  expirada: {
    label: 'Expirada',
    class: 'bg-muted text-muted-foreground border-border',
    icon: AlertCircle,
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

function formatCPFDisplay(cpf: string) {
  if (cpf.includes('.') || cpf.includes('-') || cpf.includes('/')) return cpf;
  return maskCPF(cpf);
}

export function ReservationsPanel() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [convertTarget, setConvertTarget] = useState<Reservation | null>(null);
  const { toast } = useToast();

  const { data: reservations, isLoading } = useReservations();
  const cancelMutation = useCancelReservation();
  const deleteMutation = useDeleteReservation();
  const { isAdmin, canCreateSales } = useAuth();

  const handleDownloadPdf = async (r: Reservation) => {
    try {
      await downloadReservationContractPDF(r);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: err?.message || 'Reserva sem modelo de contrato.',
      });
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const sDigits = search.replace(/\D/g, '');

    return (reservations || []).filter((r) => {
      const matchSearch =
        !s ||
        (r.buyer_name || '').toLowerCase().includes(s) ||
        (r.reservation_number || '').toLowerCase().includes(s) ||
        (sDigits.length >= 3 && (r.buyer_cpf || '').replace(/\D/g, '').includes(sDigits)) ||
        (r.vehicle?.brand || '').toLowerCase().includes(s) ||
        (r.vehicle?.model || '').toLowerCase().includes(s) ||
        (r.vehicle?.chassis || '').toLowerCase().includes(s);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [reservations, search, statusFilter]);

  const stats = useMemo(() => {
    const list = reservations || [];
    const ativas = list.filter((r) => r.status === 'ativa').length;
    const convertidas = list.filter((r) => r.status === 'convertida').length;
    const totalReservado = list
      .filter((r) => r.status === 'ativa')
      .reduce((sum, r) => sum + Number(r.reservation_amount), 0);
    return { total: list.length, ativas, convertidas, totalReservado };
  }, [reservations]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Veículos reservados com sinal pago pelo cliente
        </p>
        {canCreateSales && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Reserva
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total
            </p>
            <p className="text-2xl font-semibold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Ativas
            </p>
            <p className="text-2xl font-semibold mt-1 text-warning">{stats.ativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Convertidas
            </p>
            <p className="text-2xl font-semibold mt-1 text-success">
              {stats.convertidas}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Sinal recebido (ativas)
            </p>
            <p className="text-lg font-semibold mt-1 text-primary">
              {formatCurrency(stats.totalReservado)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, CPF, número, chassi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="convertida">Convertidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
            <SelectItem value="expirada">Expiradas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <CalendarClock className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              Nenhuma reserva encontrada
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              {search || statusFilter !== 'all'
                ? 'Ajuste os filtros para ver outras reservas.'
                : 'Crie uma reserva quando um cliente pagar um sinal para reservar um veículo.'}
            </p>
            {canCreateSales && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Reserva
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wide">Reserva</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Cliente</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Veículo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Loja</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Sinal pago</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Data</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const info = statusConfig[r.status] || statusConfig.ativa;
                  const StatusIcon = info.icon;
                  const VehicleIcon = r.vehicle?.vehicle_type === 'moto' ? Bike : Car;
                  return (
                    <TableRow key={r.id} className="group">
                      <TableCell>
                        <span className="font-mono text-sm">{r.reservation_number}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{r.buyer_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCPFDisplay(r.buyer_cpf)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.vehicle ? (
                          <div className="flex items-center gap-2">
                            <VehicleIcon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm">
                                {r.vehicle.brand} {r.vehicle.model}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {r.vehicle.year}
                                {r.vehicle.chassis && ` — ${r.vehicle.chassis}`}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.store?.name || '-'}</TableCell>
                      <TableCell className="text-sm font-medium text-primary">
                        {formatCurrency(Number(r.reservation_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('flex items-center gap-1 w-fit', info.class)}>
                          <StatusIcon className="w-3 h-3" />
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(r.reservation_date)}
                        {r.expires_at && (
                          <p className="text-xs">
                            até {formatDate(r.expires_at)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-background">
                            {r.template_id && (
                              <DropdownMenuItem onClick={() => handleDownloadPdf(r)}>
                                <Download className="w-4 h-4 mr-2" />
                                Baixar contrato (PDF)
                              </DropdownMenuItem>
                            )}
                            {r.status === 'ativa' && canCreateSales && (
                              <DropdownMenuItem onClick={() => setConvertTarget(r)}>
                                <ArrowRightCircle className="w-4 h-4 mr-2" />
                                Converter em venda
                              </DropdownMenuItem>
                            )}
                            {r.status === 'ativa' && (
                              <DropdownMenuItem
                                onClick={() => setCancelTarget(r)}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancelar reserva
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <>
                                {r.status === 'ativa' && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(r)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir permanentemente
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <CreateReservationDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConvertReservationDialog
        open={!!convertTarget}
        onOpenChange={(o) => !o && setConvertTarget(null)}
        reservation={convertTarget}
      />

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              O veículo voltará a ficar disponível no estoque. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate(
                    { id: cancelTarget.id, vehicle_id: cancelTarget.vehicle_id },
                    { onSuccess: () => setCancelTarget(null) },
                  );
                }
              }}
            >
              Cancelar reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reserva permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">Atenção:</strong> esta ação remove o
              registro definitivamente. Use apenas para limpar entradas erradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id, {
                    onSuccess: () => setDeleteTarget(null),
                  });
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}