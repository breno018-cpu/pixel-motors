import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ApprovalRequest {
  id: string;
  seller_id: string;
  seller_name: string;
  store_id?: string | null;
  store_name?: string | null;
  vehicle_id: string;
  vehicle_label: string;
  original_price: number;
  requested_price: number;
  discount_amount: number;
  discount_percent: number;
  purchase_price?: number | null;
  projected_profit?: number | null;
  margin_percent?: number | null;
  reason: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'expirado';
  reviewed_by?: string | null;
  reviewer_name?: string | null;
  review_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

const LOCAL_STORAGE_KEY = 'dealflow_approvals_cache_v1';

function getLocalApprovals(): ApprovalRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalApprovals(list: ApprovalRequest[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // silent
  }
}

export function useApprovalRequests() {
  const { user, profile, isAdmin, isManager, isSeller } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasManagementAccess = isAdmin || isManager;

  const query = useQuery<ApprovalRequest[]>({
    queryKey: ['approval-requests'],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('approval_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          saveLocalApprovals(data);
          return data as ApprovalRequest[];
        }
      } catch {
        // fallback to local
      }
      return getLocalApprovals();
    },
    refetchInterval: 10_000, // Atualiza a cada 10s para alertas rápidos
  });

  const list = query.data || [];

  // Filtragem conforme perfil
  const visibleApprovals = hasManagementAccess
    ? list
    : list.filter((a) => a.seller_id === user?.id);

  const pendingApprovals = visibleApprovals.filter((a) => a.status === 'pendente');

  // Criar solicitação de desconto
  const createMutation = useMutation({
    mutationFn: async (payload: Omit<ApprovalRequest, 'id' | 'created_at' | 'status'>) => {
      const newApproval: ApprovalRequest = {
        ...payload,
        id: crypto.randomUUID ? crypto.randomUUID() : `app-${Date.now()}`,
        status: 'pendente',
        created_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await (supabase as any)
          .from('approval_requests')
          .insert(newApproval)
          .select()
          .single();

        if (!error && data) {
          return data as ApprovalRequest;
        }
      } catch {
        // fallback
      }

      // Fallback local
      const current = getLocalApprovals();
      const updated = [newApproval, ...current];
      saveLocalApprovals(updated);
      return newApproval;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      toast({
        title: 'Solicitação enviada à gerência',
        description: 'Assim que o gestor avaliar, a venda será liberada para fechamento.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao enviar solicitação',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Aprovar solicitação (Apenas Gerentes / Admins)
  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const updateData = {
        status: 'aprovado',
        reviewed_by: user?.id,
        reviewer_name: profile?.full_name || 'Gerente',
        review_note: note || 'Aprovado pela gerência',
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const { error } = await (supabase as any)
          .from('approval_requests')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
      } catch {
        // fallback local
        const current = getLocalApprovals();
        const updated = current.map((a) => (a.id === id ? { ...a, ...updateData } : a));
        saveLocalApprovals(updated as ApprovalRequest[]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      toast({
        title: 'Alçada aprovada com sucesso!',
        description: 'O desconto foi autorizado e a venda pode ser concluída.',
      });
    },
  });

  // Rejeitar solicitação (Apenas Gerentes / Admins)
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const updateData = {
        status: 'rejeitado',
        reviewed_by: user?.id,
        reviewer_name: profile?.full_name || 'Gerente',
        review_note: reason,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const { error } = await (supabase as any)
          .from('approval_requests')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
      } catch {
        // fallback local
        const current = getLocalApprovals();
        const updated = current.map((a) => (a.id === id ? { ...a, ...updateData } : a));
        saveLocalApprovals(updated as ApprovalRequest[]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-requests'] });
      toast({
        title: 'Proposta recusada',
        description: 'O vendedor foi notificado sobre a contraproposta ou recusa.',
      });
    },
  });

  // Checa se existe uma aprovação já concedida para um veículo e vendedor
  const checkActiveApproval = (vehicleId: string, requestedPrice: number) => {
    return list.find(
      (a) =>
        a.vehicle_id === vehicleId &&
        a.status === 'aprovado' &&
        a.requested_price <= requestedPrice + 1 && // Margem de tolerância de arredondamento
        (!isSeller || a.seller_id === user?.id)
    );
  };

  return {
    approvals: visibleApprovals,
    pendingApprovals,
    pendingCount: pendingApprovals.length,
    isLoading: query.isLoading,
    requestApproval: createMutation.mutateAsync,
    isSubmitting: createMutation.isPending,
    approveRequest: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectRequest: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    checkActiveApproval,
  };
}
