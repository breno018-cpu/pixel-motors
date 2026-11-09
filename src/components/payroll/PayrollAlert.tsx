import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { usePayrollSettings, DEFAULT_PAYROLL_SETTINGS, daysUntilClosing } from '@/hooks/usePayrollSettings';
import { usePayrollBatches } from '@/hooks/usePayrollBatches';
import { usePayslips } from '@/hooks/usePayslips';
import { useEmployees } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';

/**
 * Aviso nativo de fechamento da folha: mostra quantos dias faltam,
 * se o lote do mês já existe e quais funcionários estão com dados incompletos.
 */
export function PayrollAlert() {
  const { data: settings } = usePayrollSettings();
  const { data: batches } = usePayrollBatches();
  const { data: employees } = useEmployees();

  const cfg = settings ?? DEFAULT_PAYROLL_SETTINGS;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { data: monthPayslips } = usePayslips(month, year);
  const remaining = daysUntilClosing(cfg.closing_day, now);
  const hasBatch =
    (batches || []).some((b) => b.month === month && b.year === year) ||
    (monthPayslips || []).length > 0;

  const incomplete = (employees || []).filter(
    (e) => e.is_active && (!e.store_id || !e.cpf || Number(e.base_salary || 0) <= 0),
  );

  if (!cfg.auto_reminder_enabled) return null;

  const dueSoon = remaining >= 0 && remaining <= cfg.reminder_days_before;
  const overdue = remaining < 0 && !hasBatch;

  if (hasBatch && incomplete.length === 0 && !dueSoon) return null;

  const tone = overdue
    ? 'border-destructive/30 bg-destructive/5'
    : dueSoon && !hasBatch
      ? 'border-warning/30 bg-warning/5'
      : 'border-border bg-muted/40';

  return (
    <div className={cn('rounded-lg border p-3 space-y-1.5', tone)}>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {hasBatch ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : overdue ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <CalendarClock className="w-4 h-4 text-warning" />
        )}
        {hasBatch
          ? `Folha de ${String(month).padStart(2, '0')}/${year} já gerada`
          : overdue
            ? `Fechamento de ${String(month).padStart(2, '0')}/${year} vencido há ${Math.abs(remaining)} dia(s)`
            : `Fechamento em ${remaining} dia(s) — folha de ${String(month).padStart(2, '0')}/${year} ainda não gerada`}
      </div>
      {incomplete.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {incomplete.length} funcionário(s) com cadastro incompleto (loja, CPF ou salário base):{' '}
          {incomplete.slice(0, 4).map((e) => e.full_name).join(', ')}
          {incomplete.length > 4 ? '…' : ''}
        </p>
      )}
    </div>
  );
}
