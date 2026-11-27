import { useMemo, useState } from 'react';
import { AlertTriangle, CloudUpload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { toValidStoreUuid } from '@/lib/storeResolution';
import { logActivity } from '@/lib/audit';
import {
  clearUnsyncedLocalVehicles,
  getUnsyncedLocalVehicles,
  type Vehicle,
} from '@/hooks/useVehicles';

interface Props {
  remoteVehicles: Vehicle[];
}

/**
 * Exibe um alerta apenas quando houver motos presas no cache local (localStorage)
 * que nunca chegaram ao banco Supabase, permitindo enviá-las em 1 clique.
 */
export function LocalStockRecoveryBanner({ remoteVehicles }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const unsynced = useMemo(
    () => (dismissed ? [] : getUnsyncedLocalVehicles(remoteVehicles)),
    [remoteVehicles, dismissed]
  );

  if (unsynced.length === 0) return null;

  const handleSyncToDb = async () => {
    setSyncing(true);
    try {
      const session = await ensureSupabaseSession();
      if (!session) {
        toast({
          variant: 'destructive',
          title: 'Sessão desconectada',
          description: 'Faça login novamente para enviar as motos ao banco de dados.',
        });
        return;
      }

      const payloads = unsynced.map((v) => ({
        store_id: toValidStoreUuid(v.store_id),
        vehicle_type: v.vehicle_type || 'moto',
        brand: (v.brand || 'SHINERAY').trim().toUpperCase(),
        model: (v.model || 'MOTO').trim().toUpperCase(),
        year: Number(v.year) || new Date().getFullYear(),
        manufacture_year: Number(v.manufacture_year || v.year) || new Date().getFullYear(),
        color: v.color || 'Preta',
        chassis: v.chassis && !String(v.chassis).toUpperCase().includes('DEFINIR') ? v.chassis.trim().toUpperCase() : null,
        plate: v.plate || null,
        renavam: v.renavam || null,
        mileage: Number(v.mileage) || 0,
        fuel_type: v.fuel_type || 'gasolina',
        transmission: v.transmission || 'manual',
        purchase_price: v.purchase_price ?? null,
        sale_price: v.sale_price ?? null,
        status: v.status || 'disponivel',
        notes: v.notes || 'Resgatado do cache local para o banco',
        engine_cc: v.engine_cc ?? null,
        warranty_months: v.warranty_months ?? 12,
        revision_period_months: v.revision_period_months ?? 6,
        revision_period_km: v.revision_period_km ?? 1000,
      }));

      const { data: inserted, error } = await (supabase as any)
        .from('vehicles')
        .insert(payloads)
        .select('id, model');

      if (error) {
        throw new Error(error.message || 'Erro ao gravar motos no Supabase');
      }

      const count = Array.isArray(inserted) ? inserted.length : payloads.length;
      clearUnsyncedLocalVehicles();
      setDismissed(true);
      void logActivity('resgate_estoque_local', 'veiculo', null, { quantidade: count });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });

      toast({
        title: `${count} ${count === 1 ? 'moto enviada' : 'motos enviadas'} para o banco!`,
        description: 'Agora o estoque está sincronizado para todos os usuários e dispositivos.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao enviar para o banco',
        description: err?.message || 'Verifique sua conexão e tente novamente.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDiscard = () => {
    clearUnsyncedLocalVehicles();
    setDismissed(true);
    toast({
      title: 'Cache local limpo',
      description: 'O estoque exibido agora reflete 100% o banco de dados.',
    });
  };

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold text-foreground">
            {unsynced.length} {unsynced.length === 1 ? 'moto encontrada' : 'motos encontradas'} apenas neste navegador (não enviadas ao banco)
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {unsynced
              .slice(0, 5)
              .map((v) => `${v.brand} ${v.model}${v.chassis ? ` (${v.chassis})` : ''}`)
              .join(' • ')}
            {unsynced.length > 5 ? ` e mais ${unsynced.length - 5}...` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={handleSyncToDb}
          disabled={syncing}
          className="gap-1.5 rounded-xl font-bold"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          Enviar {unsynced.length} para o Banco
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDiscard}
          disabled={syncing}
          className="gap-1 rounded-xl text-xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Descartar
        </Button>
      </div>
    </div>
  );
}
