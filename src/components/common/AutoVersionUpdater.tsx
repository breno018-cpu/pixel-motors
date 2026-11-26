import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CHECK_INTERVAL_MS = 60_000;
const RELOADED_KEY = 'dealflow_auto_reloaded_build_id';

function isUserActivelyEditing(): boolean {
  if (typeof document === 'undefined') return false;
  // Se houver modal/dialog aberto, não recarrega no meio do preenchimento
  if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
    return true;
  }
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

async function hardReloadForNewVersion(newBuildId: string) {
  try {
    sessionStorage.setItem(RELOADED_KEY, newBuildId);
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  window.location.reload();
}

/**
 * Monitora `/version.json` em segundo plano (sem cache).
 * Quando detecta um novo deploy na Vercel:
 * - Se o usuário estiver livre (sem modal aberto nem digitando), atualiza a página automaticamente.
 * - Se o usuário estiver digitando ou com modal aberto, mostra um banner discreto para atualizar com 1 clique.
 */
export function AutoVersionUpdater() {
  const [pendingBuildId, setPendingBuildId] = useState<string | null>(null);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';
    if (!currentBuildId) return;

    const checkVersion = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const remoteBuildId = String(data?.buildId || '').trim();
        if (!remoteBuildId || remoteBuildId === currentBuildId) return;

        // Proteção anti-loop: não recarrega repetidamente para o mesmo buildId
        if (sessionStorage.getItem(RELOADED_KEY) === remoteBuildId) return;

        setPendingBuildId(remoteBuildId);
        setDismissed(false);

        if (!isUserActivelyEditing()) {
          setAutoUpdating(true);
          setTimeout(() => {
            void hardReloadForNewVersion(remoteBuildId);
          }, 1200);
        }
      } catch {
        // Ignora falhas momentâneas de rede
      } finally {
        checkingRef.current = false;
      }
    };

    const interval = window.setInterval(checkVersion, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };
    const onFocus = () => void checkVersion();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    // Primeira checagem após 10s
    const initialTimer = window.setTimeout(checkVersion, 10_000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!pendingBuildId || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] max-w-sm rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-xl p-3.5 flex items-center gap-3 animate-fade-in">
      <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        {autoUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground">
          {autoUpdating ? 'Atualizando sistema...' : 'Nova atualização disponível'}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          {autoUpdating
            ? 'Carregando a versão mais recente automaticamente.'
            : 'Clique para aplicar as novidades sem perder seu trabalho.'}
        </p>
      </div>
      {!autoUpdating && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            onClick={() => {
              setAutoUpdating(true);
              void hardReloadForNewVersion(pendingBuildId);
            }}
            className="h-8 text-xs font-bold rounded-xl px-3 gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
