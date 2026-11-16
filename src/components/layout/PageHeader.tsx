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
    <div className={cn('flex flex-row items-center justify-between gap-2.5 xl:gap-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-5 sm:h-6 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/60" />
          <h1 className="font-display text-base sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground truncate">{title}</h1>
        </div>
        {description && (
          <p className="mt-0.5 pl-3.5 text-xs sm:text-sm text-muted-foreground leading-normal line-clamp-1 sm:line-clamp-2 max-w-2xl hidden sm:block">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
