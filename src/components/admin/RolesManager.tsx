import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Lock,
  PauseCircle,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/contexts/ConfirmationContext';
import {
  useCustomRoles,
  useSaveCustomRole,
  useDeleteCustomRole,
  type CustomRole,
  type RoleInput,
  type RoleOperationalStatus,
} from '@/hooks/useCustomRoles';
import { PERMISSION_GROUPS, SCOPE_OPTIONS, ROLE_COLORS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const EMPTY: RoleInput = {
  name: '',
  description: '',
  color: 'primary',
  data_scope: 'own',
  base_role: 'visualizador',
  is_active: true,
  operational_status: 'ativo',
  permissions: ['page.dashboard', 'page.settings'],
};

export function RolesManager() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: roles = [], isLoading } = useCustomRoles();
  const save = useSaveCustomRole();
  const del = useDeleteCustomRole();

  const [form, setForm] = useState<RoleInput | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RoleOperationalStatus>('all');

  const open = (r?: CustomRole, duplicate = false) => {
    if (!r) return setForm({ ...EMPTY });
    setForm({
      id: duplicate ? undefined : r.id,
      name: duplicate ? `${r.name} (cópia)` : r.name,
      description: r.description ?? '',
      color: r.color,
      data_scope: r.data_scope,
      base_role: r.base_role,
      is_active: r.is_active,
      operational_status: r.operational_status || (r.is_active ? 'ativo' : 'demitido'),
      permissions: [...r.permissions],
    });
  };

  const toggle = (key: string) =>
    form &&
    setForm({
      ...form,
      permissions: form.permissions.includes(key)
        ? form.permissions.filter((p) => p !== key)
        : [...form.permissions, key],
    });

  const submit = async () => {
    if (!form || form.name.trim().length < 2) {
      return toast({ variant: 'destructive', title: 'Informe o nome do cargo' });
    }
    try {
      await save.mutateAsync(form);
      toast({ title: 'Cargo salvo com sucesso!' });
      setForm(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e.message });
    }
  };

  const remove = async (r: CustomRole) => {
    const ok = await confirm({
      title: 'Excluir Cargo?',
      description: `Deseja realmente excluir o cargo "${r.name}"? Usuários vinculados a este cargo perderão as permissões associadas.`,
      confirmText: 'Excluir Cargo',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(r);
      toast({ title: 'Cargo excluído' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível excluir', description: e.message });
    }
  };

  // Ações Rápidas de Alteração de Situação do Cargo
  const handleSetQuickStatus = async (role: CustomRole, newStatus: RoleOperationalStatus) => {
    try {
      await save.mutateAsync({
        id: role.id,
        name: role.name,
        description: role.description || '',
        color: role.color,
        data_scope: role.data_scope,
        base_role: role.base_role,
        is_active: newStatus === 'ativo',
        operational_status: newStatus,
        permissions: role.permissions,
      });

      const label =
        newStatus === 'pausa_administrativa'
          ? 'Cargo colocado em Pausa Administrativa'
          : newStatus === 'demitido'
          ? 'Cargo marcado como Demitido / Desligado'
          : 'Cargo reativado';

      toast({ title: label });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao alterar status', description: e.message });
    }
  };

  // Contadores
  const ativosCount = roles.filter((r) => (r.operational_status || (r.is_active ? 'ativo' : 'demitido')) === 'ativo').length;
  const pausaCount = roles.filter((r) => r.operational_status === 'pausa_administrativa').length;
  const demitidosCount = roles.filter((r) => r.operational_status === 'demitido' || (!r.is_active && r.operational_status !== 'pausa_administrativa')).length;
  const suspensosCount = roles.filter((r) => r.operational_status === 'suspenso').length;

  const filteredRoles = useMemo(() => {
    if (statusFilter === 'all') return roles;
    return roles.filter((r) => {
      const st = r.operational_status || (r.is_active ? 'ativo' : 'demitido');
      return st === statusFilter;
    });
  }, [roles, statusFilter]);

  const renderStatusBadge = (status: RoleOperationalStatus, isActive: boolean) => {
    if (status === 'ativo' && isActive) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Ativo
        </Badge>
      );
    }
    if (status === 'pausa_administrativa') {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold">
          <PauseCircle className="w-3 h-3" />
          Pausa Administrativa
        </Badge>
      );
    }
    if (status === 'demitido' || !isActive) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold">
          <UserX className="w-3 h-3" />
          Demitido / Desligado
        </Badge>
      );
    }
    if (status === 'suspenso') {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400 font-bold">
          <AlertTriangle className="w-3 h-3" />
          Suspenso
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 border-b">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Gestão de Cargos, Permissões & Situações
          </CardTitle>
          <CardDescription className="text-xs">
            Gerencie cargos, permissões de tela e controle estados operacionais: Ativo, Pausa Administrativa, Demitido e Suspensão.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl font-bold" onClick={() => open()}>
          <Plus className="w-4 h-4" /> Novo cargo
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Filtros por Situação Operacional */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border text-xs">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
            className="h-7 text-xs rounded-lg font-semibold"
            onClick={() => setStatusFilter('all')}
          >
            Todos ({roles.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'ativo' ? 'secondary' : 'ghost'}
            className="h-7 text-xs rounded-lg font-semibold text-emerald-600 dark:text-emerald-400"
            onClick={() => setStatusFilter('ativo')}
          >
            Ativos ({ativosCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'pausa_administrativa' ? 'secondary' : 'ghost'}
            className="h-7 text-xs rounded-lg font-semibold text-amber-600 dark:text-amber-400"
            onClick={() => setStatusFilter('pausa_administrativa')}
          >
            Pausa Administrativa ({pausaCount})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'demitido' ? 'secondary' : 'ghost'}
            className="h-7 text-xs rounded-lg font-semibold text-rose-600 dark:text-rose-400"
            onClick={() => setStatusFilter('demitido')}
          >
            Demitidos / Desligados ({demitidosCount})
          </Button>
          {suspensosCount > 0 && (
            <Button
              size="sm"
              variant={statusFilter === 'suspenso' ? 'secondary' : 'ghost'}
              className="h-7 text-xs rounded-lg font-semibold text-purple-600"
              onClick={() => setStatusFilter('suspenso')}
            >
              Suspensos ({suspensosCount})
            </Button>
          )}
        </div>

        {/* Cargo Fixo: Administrador */}
        {statusFilter === 'all' || statusFilter === 'ativo' ? (
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Lock className="w-3.5 h-3.5 text-primary" /> Administrador Master
                </p>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-bold">
                  Ativo Permanente
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acesso irrestrito a todas as lojas, relatórios, configurações e folha de pagamento.
              </p>
            </div>
          </div>
        ) : null}

        {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando cargos…</p>}
        {!isLoading && filteredRoles.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center border-2 border-dashed rounded-xl">
            Nenhum cargo encontrado para o filtro selecionado.
          </p>
        )}

        {/* Lista de Cargos */}
        {filteredRoles.map((r) => {
          const currentStatus = r.operational_status || (r.is_active ? 'ativo' : 'demitido');

          return (
            <div
              key={r.id}
              className={cn(
                'p-3.5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                currentStatus === 'pausa_administrativa'
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : currentStatus === 'demitido'
                  ? 'bg-rose-500/5 border-rose-500/30 opacity-80'
                  : 'bg-card hover:border-primary/40'
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn('border font-bold text-xs', ROLE_COLORS[r.color] ?? ROLE_COLORS.neutral)}>
                    {r.name}
                  </Badge>
                  {renderStatusBadge(currentStatus, r.is_active)}
                  <span className="text-xs text-muted-foreground font-medium">
                    {r.permissions.length} permissões · {r.user_count} usuário(s) · {SCOPE_OPTIONS.find((s) => s.value === r.data_scope)?.label}
                  </span>
                </div>
                {r.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-xl">
                    {r.description}
                  </p>
                )}
              </div>

              {/* Ações Rápidas de Situação do Cargo */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {currentStatus === 'ativo' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium rounded-xl"
                      onClick={() => handleSetQuickStatus(r, 'pausa_administrativa')}
                      title="Pausar acessos temporariamente para auditoria"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      Pausa Admin
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-medium rounded-xl"
                      onClick={() => handleSetQuickStatus(r, 'demitido')}
                      title="Marcar como Demitido / Desligado"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Demitido
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-xl"
                    onClick={() => handleSetQuickStatus(r, 'ativo')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Reativar Cargo
                  </Button>
                )}

                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(r)} className="h-8 w-8">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Duplicar" onClick={() => open(r, true)} className="h-8 w-8">
                  <Copy className="w-4 h-4" />
                </Button>
                {!r.system_key && (
                  <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(r)} className="h-8 w-8 hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Modal de Edição / Criação de Cargo */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {form?.id ? 'Editar Cargo & Situação' : 'Novo Cargo & Situação'}
            </DialogTitle>
          </DialogHeader>

          {form && (
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Nome do Cargo *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Consultor de Vendas Plus"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ex: Atendimento a clientes, propostas F&I e contratos"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* SELETOR DE SITUAÇÃO OPERACIONAL DO CARGO */}
              <div className="space-y-2 p-3.5 rounded-2xl border bg-muted/20">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  Situação Operacional do Cargo
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, operational_status: 'ativo', is_active: true })
                    }
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all text-xs font-semibold',
                      form.operational_status === 'ativo'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                        : 'bg-card hover:bg-card/80 border-border/70'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Ativo
                    </div>
                    <span className="text-[10px] text-muted-foreground block font-normal leading-tight">
                      Acesso pleno e emissão autorizada
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, operational_status: 'pausa_administrativa', is_active: false })
                    }
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all text-xs font-semibold',
                      form.operational_status === 'pausa_administrativa'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30'
                        : 'bg-card hover:bg-card/80 border-border/70'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                      Pausa Admin
                    </div>
                    <span className="text-[10px] text-muted-foreground block font-normal leading-tight">
                      Congelamento para auditoria
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, operational_status: 'demitido', is_active: false })
                    }
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all text-xs font-semibold',
                      form.operational_status === 'demitido'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/30'
                        : 'bg-card hover:bg-card/80 border-border/70'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <UserX className="w-3.5 h-3.5 text-rose-500" />
                      Demitido
                    </div>
                    <span className="text-[10px] text-muted-foreground block font-normal leading-tight">
                      Rescisão / Acesso revogado
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, operational_status: 'suspenso', is_active: false })
                    }
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all text-xs font-semibold',
                      form.operational_status === 'suspenso'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/30'
                        : 'bg-card hover:bg-card/80 border-border/70'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-purple-500" />
                      Suspenso
                    </div>
                    <span className="text-[10px] text-muted-foreground block font-normal leading-tight">
                      Advertência disciplinar
                    </span>
                  </button>
                </div>
              </div>

              {/* Cores do Cargo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cor Visual da Badge</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(ROLE_COLORS).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={cn(
                        'px-3 h-8 rounded-xl border text-xs font-bold',
                        ROLE_COLORS[c],
                        form.color === c && 'ring-2 ring-primary ring-offset-1'
                      )}
                    >
                      {form.name || 'Cargo'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alcance dos Dados */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Alcance dos Dados (Visibilidade)</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, data_scope: s.value })}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-colors',
                        form.data_scope === s.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'bg-muted/20 text-foreground'
                      )}
                    >
                      <p className="text-xs font-bold">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grupos de Permissões de Telas e Ações */}
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.key} className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {g.items.map((i) => (
                      <label
                        key={i.key}
                        className="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer hover:bg-muted/30 text-xs"
                      >
                        <Checkbox
                          checked={form.permissions.includes(i.key)}
                          onCheckedChange={() => toggle(i.key)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-semibold text-foreground">{i.label}</span>
                          {i.hint && <span className="block text-[10px] text-muted-foreground">{i.hint}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setForm(null)} className="h-9 text-xs">
              Cancelar
            </Button>
            <Button onClick={submit} disabled={save.isPending} className="h-9 text-xs font-bold">
              {save.isPending ? 'Salvando…' : 'Salvar cargo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
