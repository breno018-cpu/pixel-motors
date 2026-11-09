import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Car,
  Bike,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useStockTransfers,
  useUpdateStockTransfer,
  useDeleteStockTransfer,
  TRANSFER_TYPE_LABEL,
} from '@/hooks/useStockTransfers';
import { StockTransferDialog } from '@/components/vehicles/StockTransferDialog';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; class: string }> = {
  pendente: { label: 'Pendente', class: 'bg-warning/10 text-warning border-warning/20' },
  concluida: { label: 'Concluída', class: 'bg-success/10 text-success border-success/20' },
  cancelada: { label: 'Cancelada', class: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

export function TransfersPanel() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: transfers, isLoading } = useStockTransfers();
  const updateTransfer = useUpdateStockTransfer();
  const deleteTransfer = useDeleteStockTransfer();
  const { hasElevatedAccess, isAdmin } = useAuth();

  const filtered = useMemo(() => {
    return (transfers || []).filter((t) => {
      const s = search.toLowerCase();
      const dest = t.to_store?.name || t.to_reseller?.full_name || t.partner_name || '';
      const matchSearch =
        !s ||
        dest.toLowerCase().includes(s) ||
        t.vehicle?.brand?.toLowerCase().includes(s) ||
        t.vehicle?.model?.toLowerCase().includes(s) ||
        t.vehicle?.chassis?.toLowerCase().includes(s);
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [transfers, search, statusFilter]);

  const stats = useMemo(() => {
    const list = transfers || [];
    return {
      total: list.length,
      pendentes: list.filter((t) => t.status === 'pendente').length,
      concluidas: list.filter((t) => t.status === 'concluida').length,
      recebido: list
        .filter((t) => t.status === 'concluida')
        .reduce((s, t) => s + Number(t.received_amount || 0), 0),
    };
  }, [transfers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Veículos enviados para revendedores, outras lojas ou lojas parceiras
        </p>
        {hasElevatedAccess && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova transferência
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pendentes" value={stats.pendentes} tone="text-warning" />
        <StatCard label="Concluídas" value={stats.concluidas} tone="text-success" />
        <StatCard label="Recebido" value={fmt(stats.recebido)} tone="text-primary" small />
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar destino, modelo ou chassi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
          <CardContent className="flex flex-col items-center justify-center py-14">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <ArrowLeftRight className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">Nenhuma transferência registrada</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Registre quando uma moto sair do estoque para um revendedor ou loja parceira.
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
                  <TableHead className="text-xs uppercase tracking-wide">Tipo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Destino</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Acordado</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Recebido</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Situação</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Data</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const info = statusConfig[t.status] || statusConfig.pendente;
                  const VehicleIcon = t.vehicle?.vehicle_type === 'moto' ? Bike : Car;
                  const dest =
                    t.to_store?.name || t.to_reseller?.full_name || t.partner_name || '—';
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <VehicleIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm truncate">
                              {t.vehicle ? `${t.vehicle.brand} ${t.vehicle.model}` : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {t.vehicle?.year}
                              {t.vehicle?.color ? ` — ${t.vehicle.color}` : ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {TRANSFER_TYPE_LABEL[t.transfer_type]}
                      </TableCell>
                      <TableCell className="text-sm">{dest}</TableCell>
                      <TableCell className="text-sm">{fmt(Number(t.agreed_amount))}</TableCell>
                      <TableCell className="text-sm font-medium text-primary">
                        {fmt(Number(t.received_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('w-fit', info.class)}>
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(t.transfer_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {hasElevatedAccess && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-background">
                              {t.status !== 'concluida' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateTransfer.mutate({ id: t.id, status: 'concluida' })
                                  }
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Marcar como concluída
                                </DropdownMenuItem>
                              )}
                              {t.status === 'pendente' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateTransfer.mutate({ id: t.id, status: 'cancelada' })
                                  }
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancelar transferência
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <DropdownMenuItem
                                  onClick={() => deleteTransfer.mutate(t.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir registro
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <StockTransferDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: number | string;
  tone?: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('font-semibold mt-1', small ? 'text-lg' : 'text-2xl', tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}