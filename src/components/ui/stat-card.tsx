import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** Accent used for the icon tile and the bottom accent line */
  tone?: 'primary' | 'success' | 'warning' | 'neutral' | string;
  className?: string;
  small?: boolean;
}

const tones: Record<string, { bar: string; icon: string }> = {
  primary: { bar: 'bg-primary/80', icon: 'bg-primary/10 text-primary ring-primary/20' },
  success: { bar: 'bg-emerald-500/80', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20' },
  warning: { bar: 'bg-amber-500/80', icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20' },
  neutral: { bar: 'bg-border', icon: 'bg-muted text-muted-foreground ring-border/20' },
  'text-warning': { bar: 'bg-amber-500/80', icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20' },
  'text-success': { bar: 'bg-emerald-500/80', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20' },
  'text-primary': { bar: 'bg-primary/80', icon: 'bg-primary/10 text-primary ring-primary/20' },
};

/** Metric tile used across every page: quiet surface, tinted icon, thin accent line, clean vertical hierarchy. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'primary', className, small }: StatCardProps) {
  const t = tones[tone] || tones.primary;
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 sm:p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md min-w-0',
        small && 'p-3 sm:p-3.5',
        className,
      )}
    >
      {/* Linha superior de destaque sutil */}
      <div className={cn('absolute top-0 left-0 right-0 h-1', t.bar)} />

      {/* Cabeçalho do Card: Rótulo e Ícone alinhados */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </p>
        {Icon && (
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-2 transition-transform duration-300 group-hover:scale-105', t.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Valor Numérico Principal: Espaço próprio sem sobreposição */}
      <div className="my-2 min-w-0">
        <p className={cn(
          'truncate font-display font-black tracking-tight text-foreground',
          small ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
        )}>
          {value}
        </p>
      </div>

      {/* Rodapé / Subtexto (Hint): linha completa dedicada */}
      {hint ? (
        <div className="pt-2 border-t border-border/40 min-w-0">
          <p className="truncate text-[11px] font-medium text-muted-foreground" title={hint}>
            {hint}
          </p>
        </div>
      ) : (
        <div className="h-1" />
      )}
    </div>
  );
}

/** Rounded panel with a quiet header, matching the list layout. */
export function PanelCard({
  title,
  description,
  aside,
  children,
  className,
}: {
  title?: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]',
        className,
      )}
    >
      {(title || aside) && (
        <div className="flex flex-col gap-2 border-b border-border/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="font-display text-base font-semibold tracking-tight text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

/** Filter row wrapper: card surface, stacks on mobile. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] lg:flex-row lg:items-center',
        className,
      )}
    >
      {children}
    </div>
  );
}
