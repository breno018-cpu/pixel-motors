import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** Accent used for the icon tile and the bottom accent line */
  tone?: 'primary' | 'success' | 'warning' | 'neutral';
  className?: string;
}

const tones = {
  primary: { bar: 'bg-primary/70', icon: 'bg-primary/10 text-primary ring-primary/5' },
  success: { bar: 'bg-success/70', icon: 'bg-success/10 text-success ring-success/5' },
  warning: { bar: 'bg-warning/70', icon: 'bg-warning/10 text-warning ring-warning/5' },
  neutral: { bar: 'bg-border', icon: 'bg-muted text-muted-foreground ring-border/20' },
};

/** Metric tile used across every page: quiet surface, tinted icon, thin accent line. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'primary', className }: StatCardProps) {
  const t = tones[tone];
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_12px_28px_-18px_hsl(var(--foreground)/0.22)]',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4 transition-transform duration-300 group-hover:scale-105', t.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate font-display text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        {hint && (
          <span className="shrink-0 self-start rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
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
