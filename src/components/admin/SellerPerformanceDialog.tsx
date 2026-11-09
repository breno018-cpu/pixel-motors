import { useState, useMemo } from 'react';
import { BarChart3, Calendar, Car, DollarSign, TrendingUp } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SellerPerformanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; full_name: string; role: string } | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function SellerPerformanceDialog({ open, onOpenChange, user }: SellerPerformanceDialogProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const { data: sellerContracts, isLoading } = useQuery({
    queryKey: ['seller-performance', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Find the reseller record for this user (if any)
      const { data: reseller } = await supabase
        .from('resellers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let query = supabase
        .from('contracts')
        .select(`
          *,
          vehicle:vehicles(id, brand, model, year, color, plate, vehicle_type),
          store:stores(id, name)
        `);

      if (reseller?.id) {
        query = query.or(`reseller_id.eq.${reseller.id},created_by.eq.${user.id}`);
      } else {
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!user,
  });

  const months = useMemo(() => {
    const m = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      m.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      });
    }
    return m;
  }, []);

  const filteredContracts = useMemo(() => {
    if (!sellerContracts) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    return sellerContracts.filter(c => {
      const d = new Date(c.created_at);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [sellerContracts, selectedMonth]);

  const stats = useMemo(() => {
    const total = filteredContracts.length;
    const concluded = filteredContracts.filter(c => c.status === 'concluido').length;
    const revenue = filteredContracts.reduce((sum, c) => sum + Number(c.sale_price), 0);
    const ticket = total > 0 ? revenue / total : 0;
    return { total, concluded, revenue, ticket };
  }, [filteredContracts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <BarChart3 className="w-5 h-5 text-primary" />
            Desempenho: {user?.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Badge variant="outline">{user?.role === 'vendedor' ? 'Vendedor' : user?.role === 'vendedor_plus' ? 'Vendedor +' : 'Revendedor'}</Badge>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px] h-9">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground">Vendas</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-xl font-bold text-foreground">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground">Concluídas</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-xl font-bold text-success">{stats.concluded}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground">Receita</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-lg font-bold text-primary">{formatCurrency(stats.revenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground">Ticket Médio</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-lg font-bold text-foreground">{formatCurrency(stats.ticket)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Vehicles sold */}
            {filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Car className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma venda neste período</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => {
                      const v = contract.vehicle as any;
                      return (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Car className="w-3.5 h-3.5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{v?.brand} {v?.model}</p>
                                <p className="text-xs text-muted-foreground">{v?.plate || v?.year}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{contract.buyer_name}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-sm text-primary">
                              {formatCurrency(Number(contract.sale_price))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              contract.status === 'concluido' ? 'bg-success/10 text-success border-success/20' :
                              contract.status === 'pendente' ? 'bg-warning/10 text-warning border-warning/20' :
                              'bg-muted text-muted-foreground'
                            }>
                              {contract.status === 'concluido' ? 'Quitado' : contract.status === 'pendente' ? 'Pendente' : contract.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
