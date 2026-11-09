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
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/60" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">{title}</h1>
        </div>
        {description && <p className="mt-1.5 pl-[18px] text-sm font-medium text-muted-foreground break-words leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
