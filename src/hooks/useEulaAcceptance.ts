import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EULA_VERSION } from '@/lib/eulaContent';

export function useEulaAcceptance() {
  const { user } = useAuth();
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setNeedsAcceptance(false);
      setIsChecking(false);
      return;
    }

    // 1. Verificação imediata no localStorage do navegador
    // Se o usuário já aceitou os termos nesta versão, NUNCA mais exibir novamente!
    const userKey = `eula_accepted_${EULA_VERSION}_${user.id}`;
    const globalKey = `eula_accepted_v${EULA_VERSION}`;

    const isLocallyAccepted = 
      localStorage.getItem(userKey) === 'true' || 
      localStorage.getItem(globalKey) === 'true' ||
      sessionStorage.getItem(userKey) === 'true';

    if (isLocallyAccepted) {
      setNeedsAcceptance(false);
      setIsChecking(false);
      return;
    }

    // Se o user.id não for um UUID padrão (ex: 'dev-master-admin' ou credencial local)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (!isUuid) {
      // Para usuários locais/dev, verifica se já foi aceito globalmente
      if (localStorage.getItem(globalKey) === 'true') {
        setNeedsAcceptance(false);
      } else {
        setNeedsAcceptance(true);
      }
      setIsChecking(false);
      return;
    }

    // 2. Consulta no Supabase apenas se não tiver registro local
    setIsChecking(true);
    const timer = setTimeout(() => {
      if (active) setIsChecking(false);
    }, 1000);

    supabase
      .from('eula_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('version', EULA_VERSION)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        clearTimeout(timer);

        if (data && !error) {
          // Salva no localStorage para as próximas visitas serem instantâneas
          try {
            localStorage.setItem(userKey, 'true');
            localStorage.setItem(globalKey, 'true');
          } catch {}
          setNeedsAcceptance(false);
        } else if (error) {
          // Se deu erro de conexão, RLS ou tabela no banco, não bloqueia o usuário
          console.warn('Erro ao consultar aceite de EULA no banco (liberando acesso):', error.message);
          setNeedsAcceptance(false);
        } else {
          // Só exige se realmente nunca aceitou localmente nem no banco
          setNeedsAcceptance(true);
        }
        setIsChecking(false);
      })
      .catch(() => {
        if (!active) return;
        clearTimeout(timer);
        setIsChecking(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user?.id]);

  const markAccepted = useCallback(() => {
    if (user?.id) {
      try {
        localStorage.setItem(`eula_accepted_${EULA_VERSION}_${user.id}`, 'true');
      } catch {}
    }
    try {
      localStorage.setItem(`eula_accepted_v${EULA_VERSION}`, 'true');
      localStorage.setItem(`eula_accepted_at_${EULA_VERSION}`, new Date().toISOString());
    } catch {}
    setNeedsAcceptance(false);
  }, [user?.id]);

  return { needsAcceptance, isChecking, markAccepted };
}
