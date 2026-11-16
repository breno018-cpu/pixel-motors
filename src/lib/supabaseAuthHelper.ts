import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';

let sessionPromise: Promise<any> | null = null;

/**
 * Invalida todas as queries principais do sistema para recarregar do Supabase autenticado.
 */
export function invalidateDealflowQueries() {
  queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
  queryClient.invalidateQueries({ queryKey: ['vehicle-models'] });
  queryClient.invalidateQueries({ queryKey: ['contracts'] });
  queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
  queryClient.invalidateQueries({ queryKey: ['stores'] });
  queryClient.invalidateQueries({ queryKey: ['resellers'] });
  queryClient.invalidateQueries({ queryKey: ['employees'] });
}

/**
 * Garante que a requisição ao Supabase utilize uma sessão JWT válida quando disponível.
 */
export async function ensureSupabaseSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    return null;
  } catch {
    return null;
  }
}
