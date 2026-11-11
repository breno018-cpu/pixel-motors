import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Standard page heading: red accent bar, display title, optional actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-6 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/60" />
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{title}</h1>
        </div>
        {description && (
          <p className="mt-0.5 pl-[14px] text-xs sm:text-sm text-muted-foreground line-clamp-1 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
