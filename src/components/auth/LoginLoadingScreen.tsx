import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoginLoadingScreenProps {
  message?: string;
  submessage?: string;
  compact?: boolean;
}

export function LoginLoadingScreen({
  message = 'Carregando...',
  compact = false,
}: LoginLoadingScreenProps) {
  return (
    <div
      className={cn(
        'flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground',
        compact && 'min-h-[240px]',
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs font-medium">{message}</span>
      </div>
    </div>
  );
}