import { useEffect, useState } from 'react';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStores } from '@/hooks/useStores';
import { updateUserAccount } from '@/lib/userService';

const editSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(200),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'gerente', 'revendedor', 'vendedor', 'vendedor_plus', 'vendedor_externo', 'visualizador']),
  store_id: z.string().optional(),
  user_status: z.enum(['ATIVO', 'SUSPENSO', 'DEMITIDO']).default('ATIVO'),
  status_reason: z.string().optional(),
  status_date: z.string().optional(),
  suspension_return_date: z.string().optional(),
  severance_notice_type: z.enum(['INDENIZADO', 'TRABALHADO', 'DISPENSADO']).optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  store_id?: string;
  user_status?: 'ATIVO' | 'SUSPENSO' | 'DEMITIDO';
  status_reason?: string;
  status_date?: string;
}

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserData | null;
}

export function UserEditDialog({ open, onOpenChange, user }: UserEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stores } = useStores();

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'visualizador',
      store_id: '',
      user_status: 'ATIVO',
      status_reason: '',
      status_date: new Date().toISOString().slice(0, 10),
      suspension_return_date: '',
      severance_notice_type: 'INDENIZADO',
    },
  });

  const { data: customRoles = [] } = useCustomRoles();
  const [customRoleId, setCustomRoleId] = useState('none');
  const watchedStatus = form.watch('user_status');

  useEffect(() => {
    if (user && open) {
      form.reset({
        full_name: user.full_name,
        email: user.email,
        role: user.role as EditFormData['role'],
        store_id: user.store_id || '',
        user_status: user.user_status || 'ATIVO',
        status_reason: user.status_reason || '',
        status_date: user.status_date || new Date().toISOString().slice(0, 10),
        suspension_return_date: '',
        severance_notice_type: 'INDENIZADO',
      });
      (supabase as any).from('user_roles').select('custom_role_id').eq('user_id', user.id).then(({ data }: any) => {
        setCustomRoleId(data?.find((d: any) => d.custom_role_id)?.custom_role_id ?? 'none');
      });
    }
  }, [user, open, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      if (!user) throw new Error('Nenhum usuário selecionado');
      const res = await updateUserAccount(user.id, { ...data, full_name: data.full_name || user.full_name || '' });
      const cr = customRoleId && customRoleId !== 'none' ? customRoleId : null;
      try {
        await (supabase as any).from('user_roles').update({ custom_role_id: cr }).eq('user_id', user.id);
      } catch {}
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);
      toast({ 
        title: 'Status do usuário atualizado com sucesso!',
        description: `O colaborador foi configurado como ${watchedStatus}.`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Editar Usuário
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo *</FormLabel>
                <FormControl><Input {...field} className="h-9" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail *</FormLabel>
                <FormControl><Input {...field} type="email" className="h-9" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="vendedor_plus">Vendedor + (cadastra veículos)</SelectItem>
<SelectItem value="vendedor_externo">Vendedor ++</SelectItem>
                    <SelectItem value="revendedor">Revendedor</SelectItem>
                    <SelectItem value="visualizador">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo personalizado</label>
              <Select value={customRoleId} onValueChange={setCustomRoleId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (usar permissões do cargo acima)</SelectItem>
                  {customRoles.filter((r) => r.is_active).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Quando escolhido, as permissões desse cargo passam a valer.</p>
            </div>

            <FormField control={form.control} name="store_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Concessionária</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Selecionar loja" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {stores?.filter(s => s.is_active).map((store) => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* SITUAÇÃO / STATUS DO COLABORADOR */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3">
              <FormField control={form.control} name="user_status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Situação / Status da Conta
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ATIVO" className="text-emerald-600 font-semibold">
                        🟢 Ativo (Acesso Liberado & Comercial)
                      </SelectItem>
                      <SelectItem value="SUSPENSO" className="text-amber-600 font-semibold">
                        🟠 Suspenso (Afastamento / Trava de Acesso)
                      </SelectItem>
                      <SelectItem value="DEMITIDO" className="text-rose-600 font-semibold">
                        🔴 Demitido / Desligado (Rescisão Definitiva)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {watchedStatus === 'SUSPENSO' && (
                <div className="space-y-3 pt-2 border-t border-border/60 animate-in fade-in duration-200">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ <strong>Colaborador Suspenso:</strong> O acesso ao sistema será imediatamente bloqueado e novas vendas não poderão ser vinculadas durante a suspensão.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="status_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Data da Suspensão</FormLabel>
                        <FormControl><Input type="date" {...field} className="h-8 text-xs" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="suspension_return_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Previsão de Retorno</FormLabel>
                        <FormControl><Input type="date" {...field} className="h-8 text-xs" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="status_reason" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Motivo da Suspensão</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Afastamento disciplinar, licença médica, averiguação..." {...field} className="h-8 text-xs" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}

              {watchedStatus === 'DEMITIDO' && (
                <div className="space-y-3 pt-2 border-t border-border/60 animate-in fade-in duration-200">
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                    🚫 <strong>Colaborador Demitido:</strong> O acesso será cancelado definitivamente e o histórico preservado para cálculo rescisório (TRCT) e auditoria.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="status_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Data do Desligamento</FormLabel>
                        <FormControl><Input type="date" {...field} className="h-8 text-xs" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="severance_notice_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Aviso Prévio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="INDENIZADO">Indenizado</SelectItem>
                            <SelectItem value="TRABALHADO">Trabalhado</SelectItem>
                            <SelectItem value="DISPENSADO">Dispensado</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="status_reason" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Tipo e Motivo da Demissão</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Sem Justa Causa / Com Justa Causa / Pedido de Demissão..." {...field} className="h-8 text-xs" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
