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
    <div className={cn('flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between', className)}>
      <div className="min-w-0 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-6 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/60" />
          <h1 className="font-display text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        {description && (
          <p className="mt-0.5 pl-4 text-xs sm:text-sm text-muted-foreground leading-normal line-clamp-2 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 xl:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
