import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Plus, Phone, Mail, Car, Bike, Store } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useResellers } from '@/hooks/useResellers';
import { useStores } from '@/hooks/useStores';
import { useVehicles } from '@/hooks/useVehicles';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResellerFormDialog } from '@/components/forms/ResellerFormDialog';
import { ResellerActionsMenu } from '@/components/actions/ResellerActionsMenu';
import { useAuth } from '@/contexts/AuthContext';

export default function Resellers({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(searchParams.get('store') || 'all');
  const [formOpen, setFormOpen] = useState(false);
  const { data: resellers, isLoading } = useResellers();
  const { data: stores } = useStores();
  const { data: vehicles } = useVehicles();
  const { isAdmin, hasElevatedAccess } = useAuth();

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setFormOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // useResellers já retorna apenas parceiros externos (partner_type <> 'interno')
  const actualResellers = resellers || [];

  const filteredResellers = actualResellers.filter(reseller => {
    const matchesSearch = 
      reseller.full_name.toLowerCase().includes(search.toLowerCase()) ||
      reseller.email?.toLowerCase().includes(search.toLowerCase()) ||
      reseller.cpf?.includes(search);
    
    const matchesStore = storeFilter === 'all' || reseller.store_id === storeFilter;
    
    return matchesSearch && matchesStore;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          {!embedded && (
            <>
              <h1 className="text-2xl font-display font-bold text-foreground">Revendedores</h1>
              <p className="text-muted-foreground text-sm mt-1">Gerencie seus parceiros</p>
            </>
          )}
        </div>
        {hasElevatedAccess && (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Revendedor
          </Button>
        )}
      </div>
      <ResellerFormDialog open={formOpen} onOpenChange={setFormOpen} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        {/* Store Filter */}
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={storeFilter} 
            onValueChange={setStoreFilter}
            disabled={!isAdmin && !hasElevatedAccess}
          >
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">Todas as lojas</SelectItem>
              {stores?.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resellers Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredResellers.length === 0 ? (
        <Card className="animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              {search || storeFilter !== 'all' ? 'Nenhum revendedor encontrado' : 'Nenhum revendedor cadastrado'}
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              {search || storeFilter !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Adicione revendedores para gerenciar seus parceiros.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Revendedor</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResellers.map((reseller) => {
                const store = stores?.find(s => s.id === reseller.store_id);
                const resellerVehicles = vehicles?.filter(v => v.reseller_id === reseller.id && v.status !== 'vendido') || [];
                const motos = resellerVehicles.filter(v => v.vehicle_type === 'moto').length;
                const carros = resellerVehicles.filter(v => v.vehicle_type === 'carro').length;
                
                return (
                  <TableRow key={reseller.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-medium text-sm">
                            {reseller.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{reseller.full_name}</p>
                          {reseller.cpf && (
                            <p className="text-xs text-muted-foreground font-mono">{reseller.cpf}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {reseller.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {reseller.phone}
                          </div>
                        )}
                        {reseller.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{reseller.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {store ? (
                        <span className="text-sm text-muted-foreground">{store.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {resellerVehicles.length > 0 ? (
                        <div className="flex items-center gap-2">
                          {motos > 0 && (
                            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                              <Bike className="w-3 h-3 mr-1" />
                              {motos}
                            </Badge>
                          )}
                          {carros > 0 && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                              <Car className="w-3 h-3 mr-1" />
                              {carros}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">Nenhum veículo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={reseller.is_active ? 'default' : 'secondary'} className="text-xs">
                        {reseller.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ResellerActionsMenu reseller={reseller} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
