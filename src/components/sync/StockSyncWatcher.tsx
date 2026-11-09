import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Espelha o estoque na planilha em segundo plano.
 * - Dispara 1x ao abrir o app (`verify`)
 * - Reagenda a cada 5 min enquanto o app estiver aberto (`push`)
 * O throttle é aplicado no edge (mínimo 5 min entre execuções), então
 * chamadas extras são absorvidas sem estourar a cota do Google Sheets.
 */
export function StockSyncWatcher() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const kick = (action: 'verify' | 'push') =>
      supabase.functions
        .invoke('sync-stock-sheet', { body: { action } })
        .catch(() => { /* silent */ });

    kick('verify');
    const interval = window.setInterval(() => kick('push'), 5 * 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return null;
}