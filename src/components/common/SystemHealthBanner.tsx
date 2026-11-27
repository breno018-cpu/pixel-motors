import { useEffect, useState } from 'react';
import { WifiOff, ShieldAlert, RefreshCw, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { invalidateDealflowQueries } from '@/lib/supabaseAuthHelper';
import { Button } from '@/components/ui/button';

/**
 * Barra global discreta de diagnóstico (aparece SOMENTE quando há falha real):
 * 1. Dispositivo sem internet (offline)
 * 2. Sessão local sem token JWT válido no Supabase (evita telas vazias silenciosas em qualquer rota)
 */
export function SystemHealthBanner() {
  const { user, session, isLoading, signOut } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reconnecting, setReconnecting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Dá 2.5s de carência no boot inicial para o Supabase terminar de restaurar a sessão antes de alertar
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      invalidateDealflowQueries();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const isSessionDisconnected = hydrated && !isLoading && Boolean(user) && !session?.access_token;

  if (isOnline && !isSessionDisconnected) return null;

  const handleTryReconnect = async () => {
    setReconnecting(true);
    try {
      await supabase.auth.refreshSession();
      invalidateDealflowQueries();
    } catch {
      // Usuário pode clicar em Fazer Login caso o refresh token também tenha expirado
    } finally {
      setReconnecting(false);
    }
  };

  const handleRelogin = async () => {
    try {
      await signOut();
    } catch {}
    window.location.href = '/auth';
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-1.5rem)] max-w-2xl">
      {!isOnline ? (
        <div className="rounded-2xl border border-amber-500/50 bg-background/95 backdrop-blur-md shadow-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground">Sem conexão com a internet</p>
            <p className="text-[11px] text-muted-foreground">
              Os dados serão recarregados automaticamente assim que a conexão voltar. Não salve novos cadastros offline.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-destructive/50 bg-background/95 backdrop-blur-md shadow-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                Sessão desconectada do banco de dados
              </p>
              <p className="text-[11px] text-muted-foreground">
                Seu login expirou neste aparelho — por isso os dados podem aparecer vazios. Reconecte para voltar ao normal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTryReconnect}
              disabled={reconnecting}
              className="h-8 text-xs gap-1.5 rounded-xl font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
              Tentar Reconectar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRelogin}
              className="h-8 text-xs gap-1.5 rounded-xl font-semibold"
            >
              <LogIn className="w-3.5 h-3.5" />
              Fazer Login
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
