import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShoppingBag,
  Unlock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { logActivity } from '@/lib/audit';
import { saveVehicleToCache, type Vehicle } from '@/hooks/useVehicles';
import {
  UNAVAILABILITY_REASONS,
  UnavailabilityTask,
  parseVehicleUnavailability,
  serializeVehicleUnavailability,
  stripUnavailabilityBlock,
  getUnavailabilityProgress,
} from '@/lib/vehicleUnavailability';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface VehicleUnavailabilityDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleUnavailabilityDialog({
  vehicle,
  open,
  onOpenChange,
}: VehicleUnavailabilityDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState<string>(UNAVAILABILITY_REASONS[0]);
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<UnavailabilityTask[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const existingMeta = vehicle ? parseVehicleUnavailability(vehicle.notes) : null;
  const isCurrentlyUnavailable = Boolean(existingMeta?.active && vehicle?.status !== 'vendido');

  useEffect(() => {
    if (!open || !vehicle) return;
    const meta = parseVehicleUnavailability(vehicle.notes);
    if (meta) {
      setReason(meta.reason || UNAVAILABILITY_REASONS[0]);
      setDescription(meta.description || '');
      setTasks(meta.tasks || []);
    } else {
      setReason(UNAVAILABILITY_REASONS[0]);
      setDescription('');
      setTasks([]);
    }
    setNewTaskLabel('');
  }, [open, vehicle]);

  const progress = getUnavailabilityProgress({
    active: true,
    reason,
    description,
    tasks,
    updatedAt: '',
  });

  const handleAddTask = () => {
    const clean = newTaskLabel.trim();
    if (!clean) return;
    setTasks((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: clean,
        done: false,
      },
    ]);
    setNewTaskLabel('');
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveUnavailable = async () => {
    if (!vehicle) return;
    if (!reason.trim()) {
      toast({ variant: 'destructive', title: 'Informe o motivo da indisponibilidade.' });
      return;
    }

    setIsSaving(true);
    try {
      const session = await ensureSupabaseSession();
      if (!session) {
        throw new Error('Sessão desconectada do banco de dados. Faça login novamente.');
      }

      const nextNotes = serializeVehicleUnavailability(vehicle.notes, {
        active: true,
        reason: reason.trim(),
        description: description.trim(),
        tasks,
        updatedAt: new Date().toISOString(),
      });

      const { data: updated, error } = await supabase
        .from('vehicles')
        .update({
          status: 'reservado',
          notes: nextNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Falha ao salvar no banco de dados.');

      if (updated) saveVehicleToCache(updated as Vehicle);
      void logActivity('editar', 'veiculo', vehicle.id, {
        acao: 'marcar_indisponivel_temporario',
        chassi: vehicle.chassis,
        modelo: `${vehicle.brand} ${vehicle.model}`.trim(),
        motivo: reason.trim(),
        tarefas_total: tasks.length,
        tarefas_concluidas: tasks.filter((t) => t.done).length,
      });

      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });

      toast({
        title: 'Moto marcada como temporariamente indisponível',
        description:
          tasks.length > 0
            ? `${progress.done}/${progress.total} tarefas concluídas. Venda bloqueada até liberação.`
            : 'Venda bloqueada até finalizar e liberar a moto.',
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar indisponibilidade',
        description: err?.message || 'Não foi possível atualizar o veículo.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReleaseForSale = async () => {
    if (!vehicle) return;
    setIsSaving(true);
    try {
      const session = await ensureSupabaseSession();
      if (!session) {
        throw new Error('Sessão desconectada do banco de dados. Faça login novamente.');
      }

      const cleanNotes = stripUnavailabilityBlock(vehicle.notes);

      const { data: updated, error } = await supabase
        .from('vehicles')
        .update({
          status: 'disponivel',
          notes: cleanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Falha ao liberar moto no banco.');

      if (updated) saveVehicleToCache(updated as Vehicle);
      void logActivity('editar', 'veiculo', vehicle.id, {
        acao: 'liberar_para_venda',
        chassi: vehicle.chassis,
        modelo: `${vehicle.brand} ${vehicle.model}`.trim(),
      });

      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });

      toast({
        title: 'Moto liberada para venda!',
        description: `${vehicle.brand} ${vehicle.model} voltou ao status Disponível no estoque.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao liberar moto',
        description: err?.message || 'Não foi possível liberar o veículo.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl shadow-xl border">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b shrink-0 pr-12 text-left">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Wrench className="w-5 h-5 shrink-0" />
            Moto Temporariamente Indisponível
          </DialogTitle>
          <DialogDescription className="text-xs">
            <strong className="text-foreground">
              {vehicle.brand} {vehicle.model}
            </strong>{' '}
            {vehicle.color ? `• ${vehicle.color}` : ''} {vehicle.chassis ? `• Chassi ${vehicle.chassis}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Motivo rápido */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Motivo da Indisponibilidade *</Label>
            <div className="flex flex-wrap gap-1.5">
              {UNAVAILABILITY_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={cn(
                    'text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium',
                    reason === preset
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/60'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ou digite um motivo personalizado..."
              className="h-9 text-xs rounded-xl"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Descrição / Detalhes (opcional)
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ex: Chegou da fábrica sem retrovisor direito e seta traseira..."
              className="text-xs rounded-xl resize-none"
            />
          </div>

          {/* Checklist de peças / tarefas para finalizar montagem */}
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-foreground">
                  Checklist de Peças / Montagem
                </span>
              </div>
              {tasks.length > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10.5px] font-mono font-bold',
                    progress.done === progress.total
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  )}
                >
                  {progress.done}/{progress.total} ({progress.percent}%)
                </Badge>
              )}
            </div>

            {/* Barra de progresso visual */}
            {tasks.length > 0 && (
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    progress.done === progress.total ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}

            {/* Input para adicionar tarefa/peça */}
            <div className="flex items-center gap-2">
              <Input
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
                placeholder="Ex: Comprar retrovisor direito, instalar bateria..."
                className="h-8.5 text-xs rounded-xl bg-background"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddTask}
                disabled={!newTaskLabel.trim()}
                className="h-8.5 px-3 rounded-xl gap-1 text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>

            {/* Lista de tarefas */}
            {tasks.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-2">
                Adicione as peças a comprar ou etapas de montagem para acompanhar até liberar para venda.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors',
                      task.done
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-muted-foreground'
                        : 'bg-background border-border/70 text-foreground'
                    )}
                  >
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0">
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={() => handleToggleTask(task.id)}
                      />
                      <span className={cn('truncate', task.done && 'line-through')}>
                        {task.label}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(task.id)}
                      className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                      title="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tasks.length > 0 && progress.done === progress.total && (
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2.5 py-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Todas as peças/tarefas concluídas! Você já pode clicar em &ldquo;Liberar para Venda&rdquo;.</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-xl p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Enquanto marcada como indisponível, a moto fica bloqueada para venda (status reservado) até ser liberada.
            </span>
          </div>
        </div>

        <DialogFooter className="px-5 sm:px-6 py-3.5 border-t bg-muted/20 shrink-0 gap-2 sm:gap-2 flex-wrap">
          {isCurrentlyUnavailable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReleaseForSale}
              disabled={isSaving}
              className="rounded-xl gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 mr-auto font-bold"
            >
              <Unlock className="w-3.5 h-3.5" />
              Liberar para Venda
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl"
          >
            Fechar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveUnavailable}
            disabled={isSaving}
            className="font-bold rounded-xl gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Wrench className="w-3.5 h-3.5" />
                Salvar Pendências
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
