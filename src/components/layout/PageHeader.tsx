import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Standard page heading: red accent bar, display title, optional badge and actions. */
export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4 min-w-0', className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="h-5 sm:h-6 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/60" />
          <h1 className="font-display text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 pl-3.5 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
