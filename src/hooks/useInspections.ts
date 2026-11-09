import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsedMotoInspectionData } from '@/types/inspection';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'dealflow_moto_inspections_v3';

const INITIAL_MOCK_MOTO_INSPECTIONS: UsedMotoInspectionData[] = [];

export function useInspections() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery<UsedMotoInspectionData[]>({
    queryKey: ['used-moto-inspections'],
    queryFn: async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error('Erro ao ler laudos de moto:', e);
      }
      return [];
    },
    staleTime: 60_000,
  });

  const clearAllInspections = useMutation({
    mutationFn: async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    },
    onSuccess: () => {
      queryClient.setQueryData(['used-moto-inspections'], []);
      toast({
        title: 'Histórico limpo com sucesso',
        description: 'Todos os laudos de teste e demonstração foram removidos.',
      });
    },
  });

  const saveInspection = useMutation({
    mutationFn: async (data: Omit<UsedMotoInspectionData, 'id' | 'code' | 'created_at' | 'updated_at'> & { id?: string }) => {
      const current = query.data || [];
      const now = new Date().toISOString();
      let updated: UsedMotoInspectionData[];

      if (data.id) {
        updated = current.map((item) =>
          item.id === data.id
            ? { ...item, ...data, updated_at: now }
            : item
        );
      } else {
        const nextNum = current.length + 1;
        const code = `LAU-MOTO-${String(nextNum).padStart(4, '0')}`;
        const newRecord: UsedMotoInspectionData = {
          ...data,
          id: `insp-moto-${Date.now()}`,
          code,
          created_at: now,
          updated_at: now,
        };
        updated = [newRecord, ...current];
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['used-moto-inspections'], updated);
      toast({
        title: 'Laudo de Moto Usada salvo',
        description: 'Vistoria rápida e avaliação de troca registradas.',
      });
    },
  });

  const deleteInspection = useMutation({
    mutationFn: async (id: string) => {
      const current = query.data || [];
      const updated = current.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['used-moto-inspections'], updated);
      toast({
        title: 'Laudo removido',
        description: 'O registro foi excluído do sistema.',
      });
    },
  });

  return {
    inspections: query.data || [],
    isLoading: query.isLoading,
    saveInspection: saveInspection.mutateAsync,
    isSaving: saveInspection.isPending,
    deleteInspection: deleteInspection.mutateAsync,
    clearAllInspections: clearAllInspections.mutateAsync,
  };
}
