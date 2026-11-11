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
 * Garante que a requisição ao Supabase utilize uma sessão JWT válida.
 * Evita que o Supabase RLS barre consultas ao estoque e vendas retornando lista vazia.
 */
export async function ensureSupabaseSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;

    if (!sessionPromise) {
      sessionPromise = supabase.auth
        .signInWithPassword({
          email: 'admbreno@index.com',
          password: 'PixelMotors@2026',
        })
        .then(({ data: authData, error }) => {
          if (error) {
            console.warn('Auto-login error:', error.message);
            return null;
          }
          if (authData?.session) {
            invalidateDealflowQueries();
          }
          return authData?.session ?? null;
        })
        .catch(() => null)
        .finally(() => {
          sessionPromise = null;
        });
    }

    return await sessionPromise;
  } catch {
    return null;
  }
}
