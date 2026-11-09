import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface TabTransitionProps {
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
  skeletonType?: 'cards' | 'table' | 'dashboard' | 'form' | 'custom';
  customSkeleton?: ReactNode;
  loadingMessage?: string;
}

export function TabTransition({
  children,
  isLoading = false,
  className,
  skeletonType = 'cards',
  customSkeleton,
  loadingMessage,
}: TabTransitionProps) {
  if (isLoading) {
    return (
      <div className="relative w-full space-y-4">
        {/* Top Animated Progress Indicator */}
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-primary/10">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-full animate-[progress_1.2s_ease-in-out_infinite]" />
        </div>

        {loadingMessage && (
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground animate-pulse py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>{loadingMessage}</span>
          </div>
        )}

        {customSkeleton ? (
          <div className="animate-pulse">{customSkeleton}</div>
        ) : skeletonType === 'dashboard' ? (
          <div className="space-y-6 animate-pulse">
            {/* Top Bar Skeleton */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border/60 bg-card/40">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48 rounded-lg" />
                <Skeleton className="h-4 w-72 rounded-md" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-32 rounded-lg" />
              </div>
            </div>

            {/* Stat Cards Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/50 bg-card/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                  </div>
                  <Skeleton className="h-8 w-32 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
              ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-xl border border-border/50 bg-card/60 space-y-4">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-64 w-full rounded-lg" />
              </div>
              <div className="p-5 rounded-xl border border-border/50 bg-card/60 space-y-4">
                <Skeleton className="h-5 w-32 rounded" />
                <Skeleton className="h-64 w-full rounded-lg" />
              </div>
            </div>
          </div>
        ) : skeletonType === 'table' ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex justify-between items-center gap-4">
              <Skeleton className="h-9 w-64 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
            <div className="rounded-xl border border-border/60 overflow-hidden bg-card/40 p-2 space-y-2">
              <div className="h-10 bg-muted/40 rounded-lg flex items-center px-4 gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28 ml-auto" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 border-t border-border/30 flex items-center px-4 gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <Skeleton className="h-6 w-24 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : skeletonType === 'form' ? (
          <div className="space-y-4 p-6 rounded-xl border border-border/50 bg-card/50 animate-pulse">
            <Skeleton className="h-6 w-48 rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/50 bg-card/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-36" />
                  <div className="pt-2 border-t border-border/40 flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'animate-tab-fade-in transition-all duration-200 fill-mode-forwards',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default TabTransition;
