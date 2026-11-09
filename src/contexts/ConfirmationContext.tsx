import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert, 
  Info, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type ConfirmationVariant = 'default' | 'destructive' | 'warning' | 'success';

export interface ConfirmationOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  icon?: React.ReactNode;
}

type ConfirmFunction = (options: ConfirmationOptions | string) => Promise<boolean>;

const ConfirmationContext = createContext<ConfirmFunction | null>(null);

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions>({
    title: 'Confirmar ação?',
    description: 'Deseja realmente executar esta operação?',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFunction = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      if (typeof opts === 'string') {
        setOptions({
          title: 'Confirmar Execução',
          description: opts,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
          variant: 'default',
        });
      } else {
        setOptions({
          title: opts.title || 'Confirmar Execução',
          description: opts.description || 'Deseja realmente executar esta operação?',
          confirmText: opts.confirmText || 'Confirmar',
          cancelText: opts.cancelText || 'Cancelar',
          variant: opts.variant || 'default',
          icon: opts.icon,
        });
      }
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const renderIcon = () => {
    if (options.icon) return options.icon;

    switch (options.variant) {
      case 'destructive':
        return (
          <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
        );
      case 'success':
        return (
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <HelpCircle className="h-5 w-5" />
          </div>
        );
    }
  };

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(val) => !val && handleCancel()}>
        <AlertDialogContent className="max-w-md rounded-2xl p-6 shadow-2xl border border-border">
          <AlertDialogHeader className="space-y-3 sm:space-y-4">
            <div className="flex items-start gap-3">
              {renderIcon()}
              <div className="space-y-1 text-left flex-1">
                <AlertDialogTitle className="font-display font-bold text-base text-foreground leading-snug">
                  {options.title}
                </AlertDialogTitle>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {typeof options.description === 'string' ? (
                    <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                      {options.description}
                    </AlertDialogDescription>
                  ) : (
                    options.description
                  )}
                </div>
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2 sm:space-x-0">
            <AlertDialogCancel
              onClick={handleCancel}
              className="mt-0 h-9 px-4 text-xs font-semibold rounded-xl border-border hover:bg-muted"
            >
              {options.cancelText || 'Cancelar'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                "mt-0 h-9 px-4 text-xs font-semibold rounded-xl shadow-xs transition-all",
                options.variant === 'destructive' && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                options.variant === 'warning' && "bg-amber-600 text-white hover:bg-amber-700",
                options.variant === 'success' && "bg-emerald-600 text-white hover:bg-emerald-700",
                (!options.variant || options.variant === 'default') && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {options.confirmText || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmationContext.Provider>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return <AlertTriangle {...props} />;
}

export function useConfirm() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirm deve ser utilizado dentro de um ConfirmationProvider');
  }
  return context;
}
