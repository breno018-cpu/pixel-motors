import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogIn, AlertTriangle, Monitor, Smartphone, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { onSessionTerminated, SessionTerminationReason } from '@/lib/singleSessionGuard';
import { supabase } from '@/integrations/supabase/client';

export function ConcurrentSessionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState<string>('Outro aparelho');
  const [reason, setReason] = useState<SessionTerminationReason>('CONCURRENT_DEVICE_LOGIN');

  useEffect(() => {
    const unsubscribe = onSessionTerminated(({ reason: r, newDeviceName: device }) => {
      setReason(r);
      if (device) setNewDeviceName(device);
      setIsOpen(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleReLogin = async () => {
    try {
      localStorage.setItem('df_explicit_signout', 'true');
      localStorage.removeItem('df_active_device_session_token');
      localStorage.removeItem('df_auth_user_cache_v1');
      sessionStorage.clear();
      await supabase.auth.signOut();
    } catch {
      // Ignora erro de rede
    } finally {
      window.location.href = '/auth';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-6 bg-card border-2 border-destructive/40 shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-center text-destructive">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div className="text-center space-y-1.5">
            <DialogTitle className="text-lg font-black text-foreground">
              {reason === 'CONCURRENT_DEVICE_LOGIN'
                ? 'Sessão Concorrente Detectada'
                : 'Sessão Encerrada Remotamente'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {reason === 'CONCURRENT_DEVICE_LOGIN' ? (
                <>
                  Sua conta foi acessada por outro dispositivo:
                  <div className="my-2.5 p-2.5 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-center gap-2 font-mono font-bold text-foreground text-xs">
                    <Monitor className="w-4 h-4 text-primary" />
                    <span>{newDeviceName}</span>
                  </div>
                  Por regras rigorosas de segurança contábil da concessionária,{' '}
                  <strong className="text-foreground">
                    uma conta nunca pode operar em 2 dispositivos simultaneamente
                  </strong>
                  .
                </>
              ) : (
                'Esta sessão foi desconectada por uma solicitação de encerramento remoto de segurança.'
              )}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Proteção Ativa de Dados & Cookies</span>
          </div>
          <p className="leading-snug text-[10.5px]">
            Para evitar conflitos de vendas, duplicidade de notas e invasão de credenciais, este terminal foi desautenticado de forma segura.
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 rounded-xl shadow-md gap-2"
            onClick={handleReLogin}
          >
            <LogIn className="w-4 h-4" />
            Fazer Login Novamente Neste Dispositivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
