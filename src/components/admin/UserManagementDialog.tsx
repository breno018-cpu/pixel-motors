import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Trash2, Key, Store, Shield, X, BarChart3, Pencil, XCircle, UserX, UserCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStores } from '@/hooks/useStores';
import { maskCPF } from '@/lib/masks';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TempPasswordDialog } from '@/components/admin/TempPasswordDialog';
import { SellerPerformanceDialog } from '@/components/admin/SellerPerformanceDialog';
import { UserEditDialog } from '@/components/admin/UserEditDialog';
import { createUserAccount, resetUserPassword, deleteUserAccount, permanentDeleteUserAccount, STORE_UUIDS, fetchConsolidatedUsers, isMasterUser } from '@/lib/userService';

const userSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(200),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'gerente', 'revendedor', 'vendedor', 'vendedor_plus', 'vendedor_externo', 'visualizador']),
  store_id: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  cpf?: string;
  role: string;
  store_id?: string;
  store_name?: string;
  is_active: boolean;
  user_status?: 'ATIVO' | 'SUSPENSO' | 'DEMITIDO';
  status_reason?: string;
  created_at: string;
}

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserManagementDialog({ open, onOpenChange }: UserManagementDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [permanentDeleteUser, setPermanentDeleteUser] = useState<UserWithRole | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRole | null>(null);
  const [tempPasswordData, setTempPasswordData] = useState<{ password: string; name: string; email: string } | null>(null);
  const [performanceUser, setPerformanceUser] = useState<UserWithRole | null>(null);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stores } = useStores();

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-master-users'] });
      queryClient.invalidateQueries({ queryKey: ['sellers-list'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    };
    window.addEventListener('dealflow:users-updated', handleUpdate);
    return () => window.removeEventListener('dealflow:users-updated', handleUpdate);
  }, [queryClient]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      return await fetchConsolidatedUsers(stores);
    },
    enabled: open,
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { full_name: '', email: '', role: 'vendedor', store_id: STORE_UUIDS['store-divinopolis'] },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return await createUserAccount({
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        store_id: data.store_id || STORE_UUIDS['store-divinopolis'],
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-master-users'] });
      queryClient.invalidateQueries({ queryKey: ['sellers-list'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsCreating(false);
      form.reset({ full_name: '', email: '', role: 'vendedor', store_id: STORE_UUIDS['store-divinopolis'] });
      setTempPasswordData({ password: data.temp_password, name: data.email, email: data.email });
      toast({ title: 'Usuário criado com sucesso', description: 'Credencial de acesso temporária gerada.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível criar o usuário.' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data: existingRole } = await supabase
        .from('user_roles').select('id').eq('user_id', userId).single();
      
      if (existingRole) {
        const { error } = await supabase
          .from('user_roles').update({ role: role as any }).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles').insert({ user_id: userId, role: role as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Permissão atualizada' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao atualizar permissão.' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await resetUserPassword(userId);
    },
    onSuccess: (data) => {
      const user = resetPasswordUser;
      setResetPasswordUser(null);
      setTempPasswordData({ 
        password: data.temp_password, 
        name: user?.full_name || '', 
        email: user?.email || '' 
      });
      toast({ title: 'Senha redefinida', description: 'Nova credencial temporária gerada com sucesso.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível resetar a senha.' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, nextActive, email, full_name }: { userId: string; nextActive: boolean; email?: string; full_name?: string }) => {
      return await toggleUserStatus(userId, nextActive, { email, full_name });
    },
    onSuccess: (_, { nextActive }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-master-users'] });
      queryClient.invalidateQueries({ queryKey: ['sellers-list'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDeleteUser(null);
      toast({
        title: nextActive ? 'Acesso reativado com sucesso' : 'Acesso suspenso com sucesso',
      });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível alterar o status do usuário.' });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email?: string }) => {
      return await permanentDeleteUserAccount(userId, email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-master-users'] });
      queryClient.invalidateQueries({ queryKey: ['sellers-list'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      setPermanentDeleteUser(null);
      toast({ title: 'Usuário excluído permanentemente com sucesso' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Falha ao excluir usuário.' });
    },
  });

  const roleLabels: Record<string, { label: string; class: string }> = {
    admin: { label: 'Administrador', class: 'bg-destructive/10 text-destructive border-destructive/20' },
    gerente: { label: 'Gerente', class: 'bg-primary/10 text-primary border-primary/20' },
    revendedor: { label: 'Revendedor', class: 'bg-warning/10 text-warning border-warning/20' },
    vendedor: { label: 'Vendedor', class: 'bg-accent/60 text-accent-foreground border-accent' },
    vendedor_plus: { label: 'Vendedor +', class: 'bg-primary/10 text-primary border-primary/20' },
    vendedor_externo: { label: 'Vendedor ++', class: 'bg-warning/10 text-warning border-warning/20' },
    visualizador: { label: 'Visualizador', class: 'bg-muted text-muted-foreground border-border' },
  };

  const handleSubmit = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <Shield className="w-5 h-5 text-primary" />
            Gerenciamento de Usuários
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{users?.length || 0} usuários cadastrados</p>
          <Button onClick={() => setIsCreating(true)} className="bg-primary hover:bg-primary/90" size="sm">
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Create User Form */}
        {isCreating && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Novo Usuário</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>Preencha os dados para criar uma nova conta</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl><Input {...field} placeholder="Nome do usuário" className="h-9" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail *</FormLabel>
                        <FormControl><Input {...field} type="email" placeholder="email@exemplo.com" className="h-9" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Selecionar cargo" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="vendedor">Vendedor (Padrão)</SelectItem>
                            <SelectItem value="gerente">Gerente (Apenas João Vitor)</SelectItem>
                            <SelectItem value="admin">Administrador Master (Apenas Breno)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="store_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loja</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Selecionar loja" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {stores?.filter(s => s.is_active).map((store) => (
                              <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Users Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{user.full_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">{user.cpf ? maskCPF(user.cpf) : '-'}</span>
                    </TableCell>
                    <TableCell>
                      {isMasterUser(user.full_name, user.email, user.id) ? (
                        <Select value={user.role} onValueChange={(value) => updateRoleMutation.mutate({ userId: user.id, role: value })}>
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <Badge variant="outline" className={roleLabels[user.role]?.class || roleLabels.visualizador.class}>
                              {roleLabels[user.role]?.label || user.role}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="vendedor">Vendedor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={roleLabels.vendedor.class}>
                          Vendedor
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Store className="w-3.5 h-3.5" />
                        {user.store_name || 'Sem loja'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.user_status === 'ATIVO' ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-semibold">
                          🟢 Ativo
                        </Badge>
                      ) : user.user_status === 'SUSPENSO' ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px] font-semibold" title={user.status_reason || 'Suspensão temporária'}>
                          🟠 Suspenso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[11px] font-semibold" title={user.status_reason || 'Desligado / Rescisão'}>
                          🔴 Demitido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar usuário"
                          onClick={() => setEditUser(user)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {(user.role === 'vendedor' || user.role === 'vendedor_plus' || user.role === 'vendedor_externo' || user.role === 'revendedor') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver desempenho"
                            onClick={() => setPerformanceUser(user)}>
                            <BarChart3 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Resetar senha"
                          onClick={() => setResetPasswordUser(user)}>
                          <Key className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className={`h-7 w-7 ${user.is_active ? 'text-amber-500 hover:text-amber-600' : 'text-emerald-500 hover:text-emerald-600'}`}
                          onClick={() => toggleStatusMutation.mutate({ userId: user.id, nextActive: !user.is_active, email: user.email, full_name: user.full_name })}
                          title={user.is_active ? "Suspender Acesso" : "Reativar Acesso"}>
                          {user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setPermanentDeleteUser(user)} title="Excluir Usuário Permanentemente">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Permanent Delete Confirmation */}
        <AlertDialog open={!!permanentDeleteUser} onOpenChange={() => setPermanentDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5 text-destructive" />
                Excluir usuário permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-semibold text-destructive">ATENÇÃO: Esta ação é irreversível!</span><br />
                O usuário <strong>{permanentDeleteUser?.full_name}</strong> ({permanentDeleteUser?.email}) será completamente removido do sistema, 
                incluindo todos os dados de perfil, cargo e credenciais de acesso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={permanentDeleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => permanentDeleteUser && permanentDeleteMutation.mutate({ userId: permanentDeleteUser.id, email: permanentDeleteUser.email })}
                disabled={permanentDeleteMutation.isPending}>
                {permanentDeleteMutation.isPending ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!resetPasswordUser} onOpenChange={() => setResetPasswordUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resetar senha?</AlertDialogTitle>
              <AlertDialogDescription>
                Uma nova senha temporária será gerada para {resetPasswordUser?.full_name}.
                O usuário deverá trocá-la no próximo login.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => resetPasswordUser && resetPasswordMutation.mutate(resetPasswordUser.id)}
                disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? 'Resetando...' : 'Resetar Senha'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Temp Password Dialog */}
        <TempPasswordDialog
          open={!!tempPasswordData}
          onOpenChange={() => setTempPasswordData(null)}
          tempPassword={tempPasswordData?.password || ''}
          userName={tempPasswordData?.name || ''}
          userEmail={tempPasswordData?.email || ''}
        />

        {/* Seller Performance Dialog */}
        <SellerPerformanceDialog
          open={!!performanceUser}
          onOpenChange={() => setPerformanceUser(null)}
          user={performanceUser}
        />

        {/* Edit User Dialog */}
        <UserEditDialog
          open={!!editUser}
          onOpenChange={() => setEditUser(null)}
          user={editUser}
        />
      </DialogContent>
    </Dialog>
  );
}
