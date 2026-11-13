import { useState, useMemo, useEffect } from 'react';
import { Search, Users, Phone, Store, BarChart3, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStores } from '@/hooks/useStores';
import { useContracts } from '@/hooks/useContracts';
import { useAuth } from '@/contexts/AuthContext';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { SellerPerformanceDialog } from '@/components/admin/SellerPerformanceDialog';
import { UserManagementDialog } from '@/components/admin/UserManagementDialog';
import { fetchConsolidatedUsers } from '@/lib/userService';
import { isMatchingStore } from '@/lib/storeResolution';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
}

export function isContractFromSeller(c: any, p: { id: string; profile_id?: string; full_name?: string; email?: string }): boolean {
  const pId = (p.id || '').toLowerCase().trim();
  const profileId = (p.profile_id || '').toLowerCase().trim();
  const pName = normalizeName(p.full_name);
  const pFirstName = pName.split(' ')[0];

  const cCreatedBy = (c.created_by || '').toLowerCase().trim();
  const cUserId = ((c as any).user_id || '').toLowerCase().trim();
  const cOperatorId = (c.operator?.id || '').toLowerCase().trim();

  // 1. Match por IDs
  if (pId && (cCreatedBy === pId || cUserId === pId || cOperatorId === pId)) return true;
  if (profileId && (cCreatedBy === profileId || cUserId === profileId || cOperatorId === profileId)) return true;

  // 2. Match por Nomes (Vendedor, Operador, Planilha)
  const contractSellerNames = [
    (c as any).vendedor,
    c.operator?.full_name,
    (c as any).seller_name,
    (c as any).external_data?.seller_name,
    (c as any).external_data?.vendedor,
  ].filter(Boolean).map(normalizeName);

  for (const cName of contractSellerNames) {
    if (!cName) continue;
    if (cName === pName) return true;
    if (cName.includes(pName) || pName.includes(cName)) return true;
    if (pFirstName && pFirstName.length >= 3) {
      const cParts = cName.split(' ');
      if (cParts.includes(pFirstName)) return true;
    }
  }

  // 3. Fallback no created_by quando é nome textual
  if (cCreatedBy && pFirstName && pFirstName.length >= 3 && cCreatedBy.includes(pFirstName)) {
    return true;
  }

  return false;
}

export default function Sellers({ embedded = false }: { embedded?: boolean } = {}) {
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [performanceUser, setPerformanceUser] = useState<{ id: string; full_name: string; role: string } | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const { data: stores } = useStores();
  const { data: allContracts = [] } = useContracts();
  const { hasElevatedAccess } = useAuth();
  const { isDateInPeriod, activePeriodLabel } = useDateFilter();

  useEffect(() => {
    const handleUpdate = () => refetch();
    window.addEventListener('dealflow:users-updated', handleUpdate);
    return () => window.removeEventListener('dealflow:users-updated', handleUpdate);
  }, [refetch]);

  const { data: sellersRaw, isLoading, refetch } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const allUsers = await fetchConsolidatedUsers(stores);
      return allUsers.filter((u) => {
        const r = (u.role || '').toLowerCase();
        return (
          r === 'vendedor' ||
          r === 'vendedor_plus' ||
          r === 'vendedor_externo' ||
          r === 'revendedor' ||
          r.includes('vendedor') ||
          r.includes('seller')
        );
      });
    },
  });

  const sellers = useMemo(() => {
    return (sellersRaw || []).map(p => {
      const allSellerContracts = allContracts.filter(c => isContractFromSeller(c, p));
      const periodSellerContracts = allSellerContracts.filter(c => isDateInPeriod(c.signed_at || c.created_at));

      // Se houver vendas no período selecionado, exibe do período; se não, usa as vendas totais para nunca zerar injustamente
      const displayContracts = periodSellerContracts.length > 0 ? periodSellerContracts : allSellerContracts;

      return {
        ...p,
        totalSales: allSellerContracts.length,
        monthSales: displayContracts.length,
        monthRevenue: displayContracts.reduce((s, c) => s + Number(c.sale_price || 0), 0),
        concludedMonth: displayContracts.filter(c => c.status === 'concluido' || c.status === 'assinado').length,
        pendingMonth: displayContracts.filter(c => c.status === 'pendente' || c.status === 'pre_venda').length,
      };
    });
  }, [sellersRaw, allContracts, isDateInPeriod]);

  const filtered = useMemo(() => {
    return (sellers || []).filter(s => {
      const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
      const matchStore = storeFilter === 'all' || isMatchingStore(s.store_id, storeFilter);
      return matchSearch && matchStore;
    });
  }, [sellers, search, storeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          {!embedded && (
            <>
              <h1 className="text-2xl font-display font-bold text-foreground">Vendedores</h1>
              <p className="text-muted-foreground text-sm mt-1">Acompanhe o desempenho da equipe de vendas</p>
            </>
          )}
        </div>
        {hasElevatedAccess && (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setManageOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Vendedor / Equipe
          </Button>
        )}
      </div>

      <UserManagementDialog
        open={manageOpen}
        onOpenChange={(o) => {
          setManageOpen(o);
          if (!o) refetch();
        }}
      />

      <div className="flex flex-col sm:flex-row gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores?.filter(s => s.is_active).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              {search ? 'Nenhum vendedor encontrado' : 'Nenhum vendedor cadastrado'}
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Vendedores são usuários com o cargo "Vendedor" atribuído nas configurações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="text-center">Vendas (mês)</TableHead>
                <TableHead className="text-center">Concluídas</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-right">Receita (mês)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(seller => {
                const store = stores?.find(s => s.id === seller.store_id);
                return (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-medium text-sm">
                            {seller.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{seller.full_name}</p>
                          <p className="text-xs text-muted-foreground">{seller.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {seller.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {seller.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{store?.name || '—'}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {seller.monthSales}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-mono">
                        {seller.concludedMonth}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 font-mono">
                        {seller.pendingMonth}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm text-primary">
                      {formatCurrency(seller.monthRevenue)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPerformanceUser({ id: seller.id, full_name: seller.full_name, role: 'vendedor' })}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <SellerPerformanceDialog
        open={!!performanceUser}
        onOpenChange={(open) => !open && setPerformanceUser(null)}
        user={performanceUser}
      />
    </div>
  );
}
