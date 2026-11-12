import { supabase } from '@/integrations/supabase/client';
import {
  generateSecureToken,
  getDeviceFingerprint,
  setSecureCookie,
  getSecureCookie,
  removeSecureCookie,
  DeviceFingerprint,
} from './secureStorage';

export interface ActiveSessionDetails {
  sessionToken: string;
  fingerprint: DeviceFingerprint;
  startedAt: string;
  lastHeartbeat: string;
  isCurrentDevice: boolean;
}

export type SessionTerminationReason = 'CONCURRENT_DEVICE_LOGIN' | 'REMOTE_REVOKE' | 'SESSION_EXPIRED';

type TerminationListener = (info: { reason: SessionTerminationReason; newDeviceName?: string }) => void;

const SESSION_TOKEN_COOKIE = 'session_token';
const SESSION_STORAGE_KEY = 'df_active_device_session_token';
const DEVICE_INFO_KEY = 'df_current_device_info';

let currentSessionToken: string | null = null;
let currentUserId: string | null = null;
let terminationListeners: TerminationListener[] = [];
let heartbeatInterval: any = null;
let realtimeChannel: any = null;

/**
 * Obtém ou inicializa o token de sessão criptográfico exclusivo deste aparelho
 */
export function getOrCreateLocalSessionToken(): string {
  if (currentSessionToken) return currentSessionToken;
  
  const fromCookie = getSecureCookie(SESSION_TOKEN_COOKIE);
  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;

  if (fromCookie && fromStorage && fromCookie === fromStorage) {
    currentSessionToken = fromCookie;
  } else {
    currentSessionToken = generateSecureToken();
    setSecureCookie(SESSION_TOKEN_COOKIE, currentSessionToken);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, currentSessionToken);
    } catch {}
  }
  return currentSessionToken;
}

/**
 * Registra ouvintes para quando a sessão for encerrada por login simultâneo em outro dispositivo
 */
export function onSessionTerminated(listener: TerminationListener): () => void {
  terminationListeners.push(listener);
  return () => {
    terminationListeners = terminationListeners.filter((l) => l !== listener);
  };
}

function notifyTermination(reason: SessionTerminationReason, newDeviceName?: string) {
  terminationListeners.forEach((l) => {
    try {
      l({ reason, newDeviceName });
    } catch (e) {
      console.error('Erro no listener de encerramento de sessão:', e);
    }
  });
}

/**
 * Inicializa a guarda de sessão única para a conta autenticada.
 * Garante em tempo real que se a conta for aberta em outro aparelho, esta sessão é imediatamente invalidada.
 */
export async function initializeSingleSessionGuard(userId: string): Promise<string> {
  if (!userId) return '';
  currentUserId = userId;
  const sessionToken = getOrCreateLocalSessionToken();
  const fingerprint = getDeviceFingerprint();

  try {
    localStorage.setItem(DEVICE_INFO_KEY, JSON.stringify({
      sessionToken,
      fingerprint,
      startedAt: new Date().toISOString(),
    }));
  } catch {}

  // 1. Registra a nova sessão ativa no log central de dispositivos do Supabase
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'SESSION_START',
      entity_type: 'active_device_session',
      entity_id: userId,
      details: {
        session_token: sessionToken,
        device_id: fingerprint.deviceId,
        device_name: `${fingerprint.browser} (${fingerprint.os})`,
        device_type: fingerprint.deviceType,
        screen: fingerprint.screenResolution,
        timestamp: new Date().toISOString(),
      } as any,
    });
  } catch (err) {
    console.warn('Registro de sessão em activity_logs:', err);
  }

  // 2. Limpa canal anterior se houver
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch {}
  }

  // 3. Conecta ao canal Realtime exclusivo do usuário para expulsão de sessões concorrentes
  const channelName = `single-session-guard-${userId}`;
  realtimeChannel = supabase.channel(channelName);

  realtimeChannel
    .on('broadcast', { event: 'NEW_DEVICE_LOGIN' }, (payload: any) => {
      const incoming = payload?.payload;
      if (incoming && incoming.session_token && incoming.session_token !== sessionToken) {
        if (incoming.device_id && incoming.device_id !== fingerprint.deviceId) {
          handleSupersededSession(incoming.device_name || 'Outro dispositivo');
        }
      }
    })
    .on('broadcast', { event: 'FORCE_LOGOUT_ALL' }, (payload: any) => {
      const incoming = payload?.payload;
      if (incoming && incoming.except_session_token !== sessionToken) {
        handleSupersededSession('Comando de desconexão remota');
      }
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        // Transmite o aviso de que este novo dispositivo assumiu a conta
        realtimeChannel.send({
          type: 'broadcast',
          event: 'NEW_DEVICE_LOGIN',
          payload: {
            session_token: sessionToken,
            device_name: `${fingerprint.browser} no ${fingerprint.os}`,
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

  // 4. Inicia verificação periódica de batimentos cardíacos (Heartbeat)
  startSessionHeartbeat(userId, sessionToken);

  return sessionToken;
}

/**
 * Executa a verificação periódica no banco para detectar se outro aparelho se conectou
 */
function startSessionHeartbeat(userId: string, mySessionToken: string) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  const fingerprint = getDeviceFingerprint();

  const checkDbActiveSession = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('details, created_at')
        .eq('entity_type', 'active_device_session')
        .eq('entity_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const details = (data[0].details as any) || {};
        if (details.session_token && details.session_token !== mySessionToken) {
          if (details.device_id && details.device_id !== fingerprint.deviceId) {
            handleSupersededSession(details.device_name || 'Outro dispositivo');
          }
        }
      }
    } catch {
      // Falha silenciosa de rede no heartbeat
    }
  };

  // Checa a cada 15 segundos
  heartbeatInterval = setInterval(checkDbActiveSession, 15000);

  // Também checa imediatamente quando o usuário volta à aba do navegador
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', checkDbActiveSession);
  }
}

/**
 * Trata o encerramento imediato por sessão concorrente detectada
 */
function handleSupersededSession(newDeviceName: string) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    } catch {}
  }

  // Limpa tokens locais deste aparelho
  currentSessionToken = null;
  removeSecureCookie(SESSION_TOKEN_COOKIE);
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}

  // Notifica o aplicativo para exibir modal de segurança e redirecionar
  notifyTermination('CONCURRENT_DEVICE_LOGIN', newDeviceName);
}

/**
 * Encerra todas as outras sessões ativas remotas da conta, mantendo apenas este dispositivo
 */
export async function revokeAllOtherSessions(userId: string): Promise<boolean> {
  const token = getOrCreateLocalSessionToken();
  const fingerprint = getDeviceFingerprint();

  try {
    // 1. Grava no log de atividade que as outras sessões foram revogadas
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'SESSION_REVOKE',
      entity_type: 'active_device_session',
      entity_id: userId,
      details: {
        session_token: token,
        device_name: `${fingerprint.browser} (${fingerprint.os})`,
        action: 'Revogação de todas as outras sessões',
        timestamp: new Date().toISOString(),
      } as any,
    });

    // 2. Transmite comando de logout forçado pelo Realtime
    if (realtimeChannel) {
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'FORCE_LOGOUT_ALL',
        payload: {
          except_session_token: token,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return true;
  } catch (err) {
    console.error('Erro ao revogar sessões remotas:', err);
    return false;
  }
}

/**
 * Desconecta o guardião de sessão única ao deslogar
 */
export function teardownSingleSessionGuard() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    } catch {}
  }
  currentSessionToken = null;
  currentUserId = null;
  removeSecureCookie(SESSION_TOKEN_COOKIE);
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

/**
 * Retorna as informações do dispositivo atual e da sessão local ativa
 */
export function getCurrentSessionDetails(): {
  token: string;
  fingerprint: DeviceFingerprint;
  cookieSecure: boolean;
  isSingleDeviceEnforced: boolean;
} {
  const token = getOrCreateLocalSessionToken();
  const fingerprint = getDeviceFingerprint();
  return {
    token,
    fingerprint,
    cookieSecure: typeof location !== 'undefined' && (location.protocol === 'https:' || location.hostname === 'localhost'),
    isSingleDeviceEnforced: true,
  };
}
