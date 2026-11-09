import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PayrollSettings {
  id: string;
  closing_day: number;
  reminder_days_before: number;
  auto_reminder_enabled: boolean;
  default_dependents: number;
}

export const DEFAULT_PAYROLL_SETTINGS: Omit<PayrollSettings, 'id'> = {
  closing_day: 30,
  reminder_days_before: 5,
  auto_reminder_enabled: true,
  default_dependents: 0,
};

export function usePayrollSettings() {
  return useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payroll_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as PayrollSettings | null) ?? null;
    },
  });
}

export function useSavePayrollSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (values: Partial<PayrollSettings> & { id?: string }) => {
      if (values.id) {
        const { error } = await (supabase as any)
          .from('payroll_settings').update(values).eq('id', values.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('payroll_settings').insert({ ...DEFAULT_PAYROLL_SETTINGS, ...values });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-settings'] });
      toast({ title: 'Configurações salvas' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

/** Dias restantes até o fechamento da folha do mês corrente. */
export function daysUntilClosing(closingDay: number, today = new Date()) {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const day = Math.min(closingDay, daysInMonth);
  const closing = new Date(today.getFullYear(), today.getMonth(), day);
  return Math.ceil((closing.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
}
