import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calcLegalCharges } from '@/lib/payrollTax';
import type { Employee } from '@/hooks/useEmployees';
import { calculateCommissionForMonth } from '@/hooks/usePayslips';
import { isContractor } from '@/lib/payrollRoles';

export interface PayrollBatch {
  id: string;
  month: number;
  year: number;
  status: 'rascunho' | 'aprovado' | 'fechado';
  total_bruto: number;
  total_liquido: number;
  total_encargos: number;
  employee_count: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function usePayrollBatches() {
  return useQuery({
    queryKey: ['payroll-batches'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payroll_batches')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollBatch[];
    },
  });
}

/**
 * Gera holerites em lote para todos os funcionários ativos usando o
 * cálculo automático (salário + comissões + adicionais - INSS - IRRF).
 * Se já existe um lote para o mês/ano, retorna erro.
 */
export function useGeneratePayrollBatch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      month,
      year,
      employees,
      dependents = 0,
    }: {
      month: number;
      year: number;
      employees: Employee[];
      dependents?: number;
    }) => {
      const { data: existing } = await (supabase as any)
        .from('payroll_batches')
        .select('id')
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      const { data: u } = await supabase.auth.getUser();
      let batch: any = existing;
      if (!batch) {
        const { data: created, error: batchErr } = await (supabase as any)
          .from('payroll_batches')
          .insert({ month, year, status: 'rascunho', created_by: u.user?.id, employee_count: employees.length })
          .select()
          .single();
        if (batchErr) throw batchErr;
        batch = created;
      }
      const { data: current } = await (supabase as any)
        .from('payslips')
        .select('id, employee_id, status')
        .eq('reference_month', month)
        .eq('reference_year', year);
      const byEmp = new Map<string, any>((current ?? []).map((p: any) => [p.employee_id, p]));

      let totalBruto = 0;
      let totalLiquido = 0;
      let totalEncargos = 0;

      for (const emp of employees) {
        // Comissão do mês (se houver profile vinculado)
        let commission = 0;
        if (emp.profile_id) {
          const c = await calculateCommissionForMonth(
            emp.profile_id,
            Number(emp.commission_rate || 0),
            month,
            year,
            Array.isArray(emp.commission_tiers) ? emp.commission_tiers : undefined,
          );
          commission = c.commission;
        }

        const contractor = isContractor(emp);
        const base = Number(emp.base_salary || 0);
        const bruto = base + commission;
        const enc = contractor
          ? { inss: 0, irrf: 0, irrfBase: 0, fgts: 0 }
          : calcLegalCharges(bruto, dependents);
        const allowances = contractor
          ? 0
          : Number(emp.transport_allowance || 0) +
            Number(emp.meal_allowance || 0) +
            Number(emp.other_allowance || 0);
        const proventos = bruto + allowances;
        const descontos = enc.inss + enc.irrf;
        const liquido = proventos - descontos;

        totalBruto += proventos;
        totalLiquido += liquido;
        totalEncargos += enc.fgts + enc.inss;

        const prev = byEmp.get(emp.id);
        if (prev && prev.status === 'pago') continue;
        const row = {
          payslip_number: `FL-${year}${String(month).padStart(2, '0')}-${emp.id.slice(0, 6).toUpperCase()}`,
          employee_id: emp.id,
          store_id: emp.store_id,
          batch_id: batch.id,
          reference_month: month,
          reference_year: year,
          base_salary: base,
          commission_amount: commission,
          bonus: 0,
          overtime: 0,
          transport_allowance: contractor ? 0 : Number(emp.transport_allowance || 0),
          meal_allowance: contractor ? 0 : Number(emp.meal_allowance || 0),
          other_allowance: contractor ? 0 : Number(emp.other_allowance || 0),
          manager_commission: 0,
          additions: [],
          inss_discount: enc.inss,
          irrf_discount: enc.irrf,
          other_discounts: 0,
          net_total: liquido,
          status: 'pendente',
          breakdown: {
            bond: contractor ? 'prestador' : 'clt',
            base,
            commission,
            proventos,
            descontos,
            inss_base: contractor ? 0 : bruto,
            inss: enc.inss,
            irrf_base: enc.irrfBase,
            irrf: enc.irrf,
            fgts: enc.fgts,
            dependents,
          },
        };
        const { error: rowErr } = prev
          ? await (supabase as any).from('payslips').update(row).eq('id', prev.id)
          : await (supabase as any).from('payslips').insert(row);
        if (rowErr) throw rowErr;
      }

      await (supabase as any)
        .from('payroll_batches')
        .update({
          total_bruto: totalBruto,
          total_liquido: totalLiquido,
          total_encargos: totalEncargos,
          employee_count: employees.length,
        })
        .eq('id', batch.id);

      return batch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-batches'] });
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast({ title: 'Folha gerada', description: 'Contracheques criados ou recalculados. Os já pagos foram mantidos.' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro ao gerar folha', description: e?.message }),
  });
}

export function useCloseBatch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('payroll_batches')
        .update({ status: 'fechado', closed_at: new Date().toISOString(), closed_by: u.user?.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-batches'] });
      toast({ title: 'Lote fechado' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      // Remove holerites do lote primeiro para evitar órfãos
      await (supabase as any).from('payslips').delete().eq('batch_id', id);
      const { error } = await (supabase as any).from('payroll_batches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-batches'] });
      qc.invalidateQueries({ queryKey: ['payslips'] });
      toast({ title: 'Lote removido' });
    },
  });
}