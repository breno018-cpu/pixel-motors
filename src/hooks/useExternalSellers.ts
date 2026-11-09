import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { CommissionTier } from '@/hooks/useEmployees';

export type CommissionType = 'percentage' | 'tiered' | 'fixed_value';

export interface CommissionConfig {
  commission_type: CommissionType;
  commission_rate: number;
  commission_tiers: CommissionTier[];
  base_salary: number;
}

export interface CommissionResult {
  commission: number;
  label: string;
  isManual: boolean;
}

const SALE_STATUSES = ['quitado', 'pendente', 'concluido'];

/** Comissão do vendedor externo — modelo configurado individualmente no cadastro. */
export function calcCommission(
  config: CommissionConfig | null,
  salesTotal: number,
  salesCount: number,
): CommissionResult {
  if (!config) return { commission: 0, label: 'Sem configuração', isManual: false };

  if (config.commission_type === 'fixed_value') {
    return { commission: 0, label: 'Valor definido manualmente', isManual: true };
  }

  if (config.commission_type === 'tiered') {
    const tiers = Array.isArray(config.commission_tiers) ? config.commission_tiers : [];
    const matching = [...tiers]
      .sort((a, b) => a.min_qty - b.min_qty)
      .filter((t) => salesCount >= t.min_qty && (t.max_qty == null || salesCount <= t.max_qty))
      .pop();
    const perSale = matching ? Number(matching.value_per_sale) : 0;
    return {
      commission: perSale * salesCount,
      label: matching
        ? `Faixa ${matching.min_qty}${matching.max_qty ? `-${matching.max_qty}` : '+'} por venda`
        : 'Faixas por quantidade',
      isManual: false,
    };
  }

  const rate = Number(config.commission_rate || 0);
  return {
    commission: salesTotal * (rate / 100),
    label: `${rate}% sobre o valor vendido`,
    isManual: false,
  };
}

function monthRange(year: number, month: number) {
  return {
    start: new Date(year, month - 1, 1).toISOString(),
    end: new Date(year, month, 1).toISOString(),
  };
}

/** Lista de vendedores externos com desempenho e comissão do mês (admin/gerente). */
export function useExternalSellers(month: number, year: number) {
  const { hasElevatedAccess } = useAuth();

  return useQuery({
    queryKey: ['external-sellers', month, year],
    enabled: hasElevatedAccess,
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'vendedor_externo' as any);

      const ids = (roleRows || []).map((r) => r.user_id);
      if (!ids.length) return [];

      const { start, end } = monthRange(year, month);

      const [{ data: profiles }, { data: employees }, { data: contracts }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, phone').in('id', ids),
        (supabase as any)
          .from('employees')
          .select('id, profile_id, store_id, base_salary, commission_rate, commission_type, commission_tiers, is_active, store:stores(id, name)')
          .in('profile_id', ids),
        supabase
          .from('contracts')
          .select('id, created_by, sale_price, status, created_at')
          .in('created_by', ids)
          .eq('sale_channel', 'externa')
          .gte('created_at', start)
          .lt('created_at', end),
      ]);

      return (profiles || []).map((p) => {
        const emp = (employees || []).find((e: any) => e.profile_id === p.id) || null;
        const own = (contracts || []).filter(
          (c: any) => c.created_by === p.id && SALE_STATUSES.includes(c.status),
        );
        const salesTotal = own.reduce((s, c: any) => s + Number(c.sale_price || 0), 0);
        const config: CommissionConfig | null = emp
          ? {
              commission_type: (emp.commission_type as CommissionType) || 'percentage',
              commission_rate: Number(emp.commission_rate || 0),
              commission_tiers: Array.isArray(emp.commission_tiers) ? emp.commission_tiers : [],
              base_salary: Number(emp.base_salary || 0),
            }
          : null;
        const result = calcCommission(config, salesTotal, own.length);

        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          store_name: (emp?.store as any)?.name ?? null,
          config,
          salesCount: own.length,
          salesTotal,
          commission: result.commission,
          commissionLabel: result.label,
          commissionIsManual: result.isManual,
        };
      });
    },
  });
}

/** Painel do próprio vendedor externo: vendas, comissão, meta e estoque disponível. */
export function useMyExternalPanel(month: number, year: number) {
  const { user, isExternalSeller } = useAuth();

  return useQuery({
    queryKey: ['my-external-panel', user?.id, month, year],
    enabled: !!user?.id && isExternalSeller,
    queryFn: async () => {
      const uid = user?.id;
      if (!uid) throw new Error('Usuário não autenticado.');
      const { start, end } = monthRange(year, month);
      const historyStart = new Date(year, month - 6, 1).toISOString();

      const { data: emp } = await (supabase as any)
        .from('employees')
        .select('id, store_id, base_salary, commission_rate, commission_type, commission_tiers, store:stores(id, name)')
        .eq('profile_id', uid)
        .maybeSingle();

      const config: CommissionConfig | null = emp
        ? {
            commission_type: (emp.commission_type as CommissionType) || 'percentage',
            commission_rate: Number(emp.commission_rate || 0),
            commission_tiers: Array.isArray(emp.commission_tiers) ? emp.commission_tiers : [],
            base_salary: Number(emp.base_salary || 0),
          }
        : null;

      const { data: allContracts } = await supabase
        .from('contracts')
        .select('id, contract_number, buyer_name, sale_price, status, created_at, lead_source, campaign_name, vehicle:vehicles(brand, model, year, plate, vehicle_type)')
        .eq('created_by', uid)
        .eq('sale_channel', 'externa')
        .gte('created_at', historyStart)
        .order('created_at', { ascending: false });

      const rows = (allContracts || []).filter((c: any) => SALE_STATUSES.includes(c.status));
      const monthSales = rows.filter((c: any) => c.created_at >= start && c.created_at < end);
      const monthTotal = monthSales.reduce((s, c: any) => s + Number(c.sale_price || 0), 0);
      const current = calcCommission(config, monthTotal, monthSales.length);

      // Histórico dos últimos 6 meses
      const history: Array<{ label: string; month: number; year: number; count: number; total: number; commission: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const r = monthRange(y, m);
        const inMonth = rows.filter((c: any) => c.created_at >= r.start && c.created_at < r.end);
        const total = inMonth.reduce((s, c: any) => s + Number(c.sale_price || 0), 0);
        history.push({
          label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          month: m,
          year: y,
          count: inMonth.length,
          total,
          commission: calcCommission(config, total, inMonth.length).commission,
        });
      }

      const { data: targets } = await supabase
        .from('sales_targets')
        .select('target_qty, target_value, bonus_on_target')
        .eq('user_id', uid)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      const { data: stock } = await supabase
        .from('vehicles')
        .select('id, brand, model, year, color, plate, sale_price, vehicle_type, mileage, status')
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false })
        .limit(60);

      return {
        storeName: (emp?.store as any)?.name ?? null,
        config,
        commission: current,
        monthSales,
        monthTotal,
        recentSales: rows.slice(0, 20),
        history,
        target: targets
          ? {
              qty: Number(targets.target_qty || 0),
              value: Number(targets.target_value || 0),
              bonus: Number(targets.bonus_on_target || 0),
            }
          : null,
        stock: stock || [],
      };
    },
  });
}
