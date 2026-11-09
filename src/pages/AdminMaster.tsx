import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Shield, 
  Building2, 
  Car, 
  Landmark, 
  Activity, 
  Database, 
  Key, 
  Plus, 
  RefreshCw, 
  TrendingUp, 
  AlertCircle,
  Search,
  CheckCircle2,
  Lock,
  MoreVertical,
  Pencil,
  BarChart3,
  Trash2,
  XCircle,
  DollarSign
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStores } from '@/hooks/useStores';
import { maskCPF } from '@/lib/masks';
import { purgeFictitiousData } from '@/integrations/supabase/localDbFallback';

// Componentes Administrativos Integrados
import { UserManagementDialog } from '@/components/admin/UserManagementDialog';
import { UserEditDialog } from '@/components/admin/UserEditDialog';
import { TempPasswordDialog } from '@/components/admin/TempPasswordDialog';
import { SellerPerformanceDialog } from '@/components/admin/SellerPerformanceDialog';
import { RolesManager } from '@/components/admin/RolesManager';
import Stores from '@/pages/Stores';
import { UnifiedVehicleCatalog } from '@/components/admin/UnifiedVehicleCatalog';
import { ColorCatalogManager } from '@/components/admin/ColorCatalogManager';
import { ChassisYearCodeManager } from '@/components/admin/ChassisYearCodeManager';
import { MarginSettingsCard } from '@/components/admin/MarginSettingsCard';
import { FinancingBanksManager } from '@/components/admin/FinancingBanksManager';
import { BankCredentialsManager } from '@/components/admin/BankCredentialsManager';
import { ActivityLogPanel } from '@/components/admin/ActivityLogPanel';
import { StockSyncSettings } from '@/components/settings/StockSyncSettings';
import { ApiKeysManager } from '@/components/settings/ApiKeysManager';
import { ExportDialog } from '@/components/export/ExportDialog';
import { FinancialDREPanel } from '@/components/finance/FinancialDREPanel';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  cpf?: string;
  role: string;
  store_id?: string;
  store_name?: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; badge: string }> = {
  admin: { label: 'Administrador Master', badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  gerente: { label: 'Gerente Geral', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  vendedor_plus: { label: 'Vendedor Senior (Plus)', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  vendedor: { label: 'Vendedor Interno', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  vendedor_externo: { label: 'Vendedor Externo', badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  revendedor: { label: 'Revendedor Parceiro', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  visualizador: { label: 'Visualizador', badge: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' },
};

export default function AdminMaster() {
  const [params, setParams] = useSearchParams();
  const currentTab = params.get('tab') || 'usuarios';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const { data: stores } = useStores();

  // Estados de modais e ações de usuários
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [tempPasswordData, setTempPasswordData] = useState<{ password: string; name: string; email: string } | null>(null);
  const [performanceUser, setPerformanceUser] = useState<UserWithRole | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Consulta Geral de Usuários
  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-master-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const roleMap = new Map(userRoles.map((r) => [r.user_id, r.role]));
      const storeMap = new Map((stores || []).map((s) => [s.id, s.name]));

      return profiles.map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name || 'Sem nome',
        cpf: p.cpf || undefined,
        role: roleMap.get(p.id) || 'vendedor',
        store_id: p.store_id || undefined,
        store_name: p.store_id ? storeMap.get(p.store_id) || 'Loja Desconhecida' : 'Todas as Lojas / Matriz',
        is_active: p.is_active ?? true,
        created_at: p.created_at,
      })) as UserWithRole[];
    },
  });

  // Métricas Globais da Operação
  const { data: globalMetrics } = useQuery({
    queryKey: ['admin-global-metrics'],
    queryFn: async () => {
      // Total de veículos e valor de pátio
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, sale_price, status');
      
      const inStock = (vehicles || []).filter(v => v.status === 'disponivel');
      const stockTotalValue = inStock.reduce((acc, v) => acc + (Number(v.sale_price) || 0), 0);

      // Total de vendas registradas
      const { count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true });

      // Logs de auditoria nas últimas 24 horas
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentLogsCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);

      return {
        totalVehiclesInStock: inStock.length,
        stockTotalValue,
        totalSales: salesCount || 0,
        recentLogsCount: recentLogsCount || 0,
      };
    },
  });

  // Alternar ativação de usuário
  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ userId, currentState }: { userId: string; currentState: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentState })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, { currentState }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-master-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: currentState ? 'Acesso desativado' : 'Acesso reativado com sucesso',
        description: currentState ? 'O usuário não conseguirá mais entrar no sistema.' : 'O usuário agora pode acessar o sistema.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Falha ao alterar status',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Redefinir senha gerando credencial temporária
  const handleResetPassword = async (user: UserWithRole) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          action: 'reset-password',
          userId: user.id,
        },
      });
      if (error) throw error;
      if (data?.tempPassword) {
        setTempPasswordData({
          password: data.tempPassword,
          name: user.full_name,
          email: user.email,
        });
      } else {
        toast({ title: 'Senha redefinida', description: 'Instruções enviadas para o e-mail do usuário.' });
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao resetar senha',
        description: err.message || 'Verifique se a função está disponível.',
        variant: 'destructive',
      });
    }
  };

  const handleTabChange = (val: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', val);
    setParams(next, { replace: true });
  };

  // Filtragem de usuários
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.cpf && u.cpf.includes(userSearch)) ||
        (u.store_name && u.store_name.toLowerCase().includes(userSearch.toLowerCase()));
      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchSearch && matchRole;
    });
  }, [users, userSearch, userRoleFilter]);

  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="space-y-6">
      {/* Top Header Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-6 h-6 stroke-[2.2px]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Ala Administrativa Master
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Controle Executivo
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Comando centralizado de acessos, governança de cargos, filiais, precificação e integridade operacional.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              purgeFictitiousData();
              toast({
                title: 'Dados fictícios removidos',
                description: 'Todos os veículos, vendas e contratos simulados foram apagados. A Folha de Pagamento foi preservada.',
              });
              setTimeout(() => window.location.reload(), 600);
            }}
            className="text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Dados Fictícios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            className="text-xs gap-1.5"
          >
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
            Exportar Dados
          </Button>
          <Button
            size="sm"
            onClick={() => setUserModalOpen(true)}
            className="text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Usuário / Acesso
          </Button>
        </div>
      </div>

      {/* Cards de Métricas e Comando Executivo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/70 bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Usuários do Sistema
            </CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {activeCount} <span className="text-xs text-muted-foreground font-normal">/ {users.length} cadastrados</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Todos os cargos operacionais
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Lojas & Filiais
            </CardTitle>
            <Building2 className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stores?.length || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Unidades físicas ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pátio em Estoque
            </CardTitle>
            <Car className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {globalMetrics?.totalVehiclesInStock ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              R$ {(globalMetrics?.stockTotalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} em estoque
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 backdrop-blur shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Auditoria (24h)
            </CardTitle>
            <Activity className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {globalMetrics?.recentLogsCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Ações rastreadas em tempo real
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principais da Ala Master */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="h-10 bg-muted/70 p-1 w-full sm:w-auto inline-flex justify-start">
            <TabsTrigger value="usuarios" className="gap-2 text-xs font-medium">
              <Users className="w-3.5 h-3.5" />
              Usuários & Acessos
            </TabsTrigger>
            <TabsTrigger value="cargos" className="gap-2 text-xs font-medium">
              <Shield className="w-3.5 h-3.5" />
              Governança & Permissões
            </TabsTrigger>
            <TabsTrigger value="lojas" className="gap-2 text-xs font-medium">
              <Building2 className="w-3.5 h-3.5" />
              Filiais & Lojas
            </TabsTrigger>
            <TabsTrigger value="catalogo" className="gap-2 text-xs font-medium">
              <Car className="w-3.5 h-3.5" />
              Catálogo & Tabela de Preços
            </TabsTrigger>
            <TabsTrigger value="bancos" className="gap-2 text-xs font-medium">
              <Landmark className="w-3.5 h-3.5" />
              F&I & Bancos
            </TabsTrigger>
            <TabsTrigger value="dre" className="gap-2 text-xs font-medium font-semibold text-primary">
              <DollarSign className="w-3.5 h-3.5" />
              DRE & Finanças
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-2 text-xs font-medium">
              <Activity className="w-3.5 h-3.5" />
              Trilha de Auditoria
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-2 text-xs font-medium">
              <Database className="w-3.5 h-3.5" />
              Sincronização & Backup
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA 1: USUÁRIOS E ACESSOS */}
        <TabsContent value="usuarios" className="space-y-4">
          <Card className="border-border/70">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Controle de Usuários e Equipe
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gerencie quem acessa o DealFlow, redefina senhas instantaneamente, vincule a lojas e consulte desempenho.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchUsers()}
                    className="h-8 text-xs gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setUserModalOpen(true)}
                    className="h-8 text-xs gap-1 shadow-sm"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Usuário
                  </Button>
                </div>
              </div>

              {/* Filtros de Usuários */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, e-mail, CPF ou loja..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Todos os Cargos</option>
                  <option value="admin">Administrador Master</option>
                  <option value="gerente">Gerente Geral</option>
                  <option value="vendedor_plus">Vendedor Senior (Plus)</option>
                  <option value="vendedor">Vendedor Interno</option>
                  <option value="vendedor_externo">Vendedor Externo</option>
                  <option value="revendedor">Revendedor</option>
                  <option value="visualizador">Visualizador</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Colaborador / Acesso</TableHead>
                      <TableHead className="text-xs">Cargo & Função</TableHead>
                      <TableHead className="text-xs">Loja Vinculada</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Ações de Gestão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingUsers ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-8 w-44" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                          Nenhum usuário localizado com os critérios informados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => {
                        const roleInfo = ROLE_LABELS[u.role] || { label: u.role, badge: 'bg-muted text-muted-foreground' };
                        return (
                          <TableRow key={u.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="py-2.5">
                              <div className="flex flex-col">
                                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                  {u.full_name}
                                  {u.id === profile?.id && (
                                    <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                                      Você
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {u.email}
                                </span>
                                {u.cpf && (
                                  <span className="text-[10px] text-muted-foreground/70 font-mono">
                                    CPF: {maskCPF(u.cpf)}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="py-2.5">
                              <Badge variant="outline" className={`text-[11px] font-medium ${roleInfo.badge}`}>
                                {roleInfo.label}
                              </Badge>
                            </TableCell>

                            <TableCell className="py-2.5 text-xs text-foreground font-medium">
                              {u.store_name}
                            </TableCell>

                            <TableCell className="py-2.5">
                              {u.is_active ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                                  Inativo
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Ver Performance Comercial"
                                  onClick={() => setPerformanceUser(u)}
                                >
                                  <BarChart3 className="w-3.5 h-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Editar dados e loja"
                                  onClick={() => setEditUser(u)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                                  title="Gerar Senha Temporária / Resetar"
                                  onClick={() => handleResetPassword(u)}
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </Button>

                                {u.id !== profile?.id && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 ${u.is_active ? 'text-muted-foreground hover:text-red-500' : 'text-emerald-500 hover:text-emerald-600'}`}
                                    title={u.is_active ? 'Desativar Acesso' : 'Reativar Acesso'}
                                    onClick={() => toggleUserActiveMutation.mutate({ userId: u.id, currentState: u.is_active })}
                                  >
                                    {u.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                              </div>
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
        </TabsContent>

        {/* ABA 2: GOVERNANÇA DE CARGOS E PERMISSÕES */}
        <TabsContent value="cargos" className="space-y-4">
          <RolesManager />
        </TabsContent>

        {/* ABA 3: LOJAS E FILIAIS */}
        <TabsContent value="lojas" className="space-y-4">
          <Stores />
        </TabsContent>

        {/* ABA 4: CATÁLOGO, MODELOS E PREÇOS UNIFICADOS */}
        <TabsContent value="catalogo" className="space-y-6">
          <Tabs defaultValue="catalogo-mestre" className="space-y-4">
            <TabsList className="bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="catalogo-mestre" className="text-xs font-bold text-foreground flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Car className="w-3.5 h-3.5 text-primary" />
                Modelos, Tabela Mestra &amp; Padrões de Chassi
              </TabsTrigger>
              <TabsTrigger value="cores" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
                Cores de Fábrica
              </TabsTrigger>
              <TabsTrigger value="ano" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
                Ano/Modelo (VIN 10ª)
              </TabsTrigger>
              <TabsTrigger value="margens" className="text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs">
                Diretrizes de Margem
              </TabsTrigger>
            </TabsList>

            {/* ABA UNIFICADA PRINCIPAL */}
            <TabsContent value="catalogo-mestre" className="space-y-4 mt-0">
              <UnifiedVehicleCatalog />
            </TabsContent>

            <TabsContent value="cores" className="space-y-4 mt-0">
              <ColorCatalogManager />
            </TabsContent>

            <TabsContent value="ano" className="space-y-4 mt-0">
              <ChassisYearCodeManager />
            </TabsContent>

            <TabsContent value="margens" className="space-y-4 mt-0">
              <MarginSettingsCard />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ABA 5: F&I E BANCOS */}
        <TabsContent value="bancos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <FinancingBanksManager />
            </div>
            <div>
              <BankCredentialsManager />
            </div>
          </div>
        </TabsContent>

        {/* ABA: DRE E FINANÇAS */}
        <TabsContent value="dre" className="space-y-4">
          <FinancialDREPanel />
        </TabsContent>

        {/* ABA 6: TRILHA DE AUDITORIA */}
        <TabsContent value="auditoria" className="space-y-4">
          <ActivityLogPanel />
        </TabsContent>

        {/* ABA 7: SINCRONIZAÇÃO E BACKUPS */}
        <TabsContent value="seguranca" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StockSyncSettings />
            <ApiKeysManager />
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs de Ações de Usuário */}
      <UserManagementDialog
        open={userModalOpen}
        onOpenChange={(open) => {
          setUserModalOpen(open);
          if (!open) refetchUsers();
        }}
      />

      {editUser && (
        <UserEditDialog
          open={!!editUser}
          onOpenChange={(open) => {
            if (!open) {
              setEditUser(null);
              refetchUsers();
            }
          }}
          user={editUser}
        />
      )}

      {tempPasswordData && (
        <TempPasswordDialog
          open={!!tempPasswordData}
          onOpenChange={(open) => !open && setTempPasswordData(null)}
          data={tempPasswordData}
        />
      )}

      {performanceUser && (
        <SellerPerformanceDialog
          open={!!performanceUser}
          onOpenChange={(open) => !open && setPerformanceUser(null)}
          sellerId={performanceUser.id}
          sellerName={performanceUser.full_name}
        />
      )}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
