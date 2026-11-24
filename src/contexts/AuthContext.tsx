import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { DataScope } from '@/lib/permissions';
import { initializeSingleSessionGuard, teardownSingleSessionGuard } from '@/lib/singleSessionGuard';
import { removeSecureCookie } from '@/lib/secureStorage';
import {
  isMasterUser,
  DEFAULT_OFFICIAL_USERS,
  isUserDeleted,
  hasUserDefinedPassword,
  getUserDefinedPassword,
  saveCustomUser,
  getCustomUsers,
  recordDeletedUser,
  getUserOverride,
  getUserOverrides,
  syncCredentialsFromSupabase,
} from '@/lib/userService';
import { isMatchingStore, STORE_DIVINOPOLIS_UUID, STORE_MONTESCLAROS_UUID } from '@/lib/storeResolution';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

type AppRole = 'admin' | 'gerente' | 'dono_loja' | 'revendedor' | 'vendedor' | 'vendedor_plus' | 'vendedor_externo' | 'coordenador_logistica' | 'motorista' | 'visualizador';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  must_change_password?: boolean;
  is_active?: boolean;
}

interface UserStore {
  id: string;
  name: string;
}

const SESSION_MAX_AGE_MS = 7 * 60 * 60 * 1000; // 7 hours
const AUTH_CACHE_KEY = 'df_auth_user_cache_v1';
const GLOBAL_FORCE_LOGOUT_KEY = 'df_force_logout_all_epoch_20261114_v1';

/**
 * Força a desconexão global de todas as sessões em todos os aparelhos/navegadores.
 * Todos os usuários terão que reinserir suas credenciais para entrar.
 */
function checkAndApplyGlobalLogout() {
  if (typeof window === 'undefined') return;
  try {
    const applied = localStorage.getItem(GLOBAL_FORCE_LOGOUT_KEY);
    if (!applied) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      sessionStorage.removeItem(AUTH_CACHE_KEY);
      localStorage.removeItem('dealflow_auth_profile');
      localStorage.removeItem('dealflow_active_role');
      localStorage.removeItem('df_active_device_session_token');
      sessionStorage.removeItem('df_active_device_session_token');
      removeSecureCookie('session_token');
      removeSecureCookie('df_fingerprint');

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.startsWith('supabase.') || k.startsWith('df_auth_'))) {
          localStorage.removeItem(k);
        }
      }

      localStorage.removeItem('df_explicit_signout');
      localStorage.setItem(GLOBAL_FORCE_LOGOUT_KEY, new Date().toISOString());

      try {
        void supabase.auth.signOut({ scope: 'local' });
      } catch {}
    }
  } catch {}
}

checkAndApplyGlobalLogout();

interface CachedUserData {
  userId: string;
  profile: Profile | null;
  roles: AppRole[];
  userStore: UserStore | null;
  permissions: string[];
  dataScope: DataScope;
  customRoleName: string | null;
  hasCustomRole: boolean;
}

const DEFAULT_ACTIVE_ADMIN: CachedUserData = {
  userId: '54db7881-ce90-42d4-baff-0e0ec2cb9eeb',
  profile: {
    id: '54db7881-ce90-42d4-baff-0e0ec2cb9eeb',
    full_name: 'Breno',
    email: 'admbreno@index.com',
    phone: '(37) 99999-0000',
    avatar_url: null,
    must_change_password: false,
  },
  roles: ['admin'],
  userStore: { id: 'ccf8e097-09d7-4305-8077-5c16fc8b5634', name: 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS' },
  permissions: ['*'],
  dataScope: 'all',
  customRoleName: null,
  hasCustomRole: false,
};

const LEGACY: Record<string, string[]> = {
  admin: ['*'],
  gerente: ['*'],
  vendedor: ['page.dashboard','page.vehicles','page.inspections','page.sales','page.logistics','page.settings','sales.create','sales.edit','sales.delete','vehicles.create','vehicles.edit','logistics.calculate_freight'],
  vendedor_plus: ['page.dashboard','page.vehicles','page.inspections','page.sales','page.logistics','page.settings','sales.create','sales.edit','sales.delete','vehicles.create','vehicles.edit','logistics.calculate_freight'],
  vendedor_externo: ['page.dashboard','page.vehicles','page.inspections','page.sales','page.logistics','page.settings','sales.create','sales.edit','sales.delete','vehicles.create','vehicles.edit','logistics.calculate_freight'],
  coordenador_logistica: ['page.dashboard','page.vehicles','page.sales','page.inspections','page.logistics','page.settings','logistics.view_routes','logistics.manage_methods','logistics.dispatch','logistics.fleet_audit','logistics.calculate_freight'],
  motorista: ['page.dashboard','page.vehicles','page.inspections','page.logistics','page.settings','logistics.view_routes','logistics.driver_orders','logistics.delivery_checklist','logistics.calculate_freight'],
  revendedor: ['page.dashboard','page.vehicles','page.inspections','page.settings'],
  visualizador: ['page.dashboard','page.vehicles','page.inspections','page.settings'],
  dono_loja: ['page.dashboard','page.owner_dashboard','page.vehicles','page.sales','page.settings','sales.create','sales.edit','vehicles.create','vehicles.edit','logistics.calculate_freight'],
};

function readAuthCache(): CachedUserData | null {
  try {
    if (!localStorage.getItem(GLOBAL_FORCE_LOGOUT_KEY)) {
      checkAndApplyGlobalLogout();
      return null;
    }
    if (localStorage.getItem('df_explicit_signout') === 'true') {
      return null;
    }
    const raw = localStorage.getItem(AUTH_CACHE_KEY) || sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserData;
    if (!parsed || !parsed.userId) return null;
    if (parsed.userId === 'dev-master-admin') {
      return null;
    }

    // Se o usuário foi excluído, invalida o cache imediatamente
    if (isUserDeleted(parsed.userId, parsed.profile?.email)) {
      return null;
    }

    // Sanitização de segurança: Se o usuário em cache não for Breno ou João Vitor nem possuir cargo elevado, restringe ao escopo adequado
    const isMaster = isMasterUser(parsed.profile?.full_name, parsed.profile?.email, parsed.userId);
    const hasAdminOrManager = (parsed.roles || []).some((r) => r === 'admin' || r === 'gerente');
    const hasGroupOwner = (parsed.roles || []).includes('dono_loja');

    if (!isMaster && !hasAdminOrManager && hasGroupOwner) {
      parsed.roles = ['dono_loja'];
      parsed.dataScope = 'all';
      parsed.userStore = null;
      parsed.permissions = [...LEGACY.dono_loja];
      parsed.hasCustomRole = false;
      parsed.customRoleName = null;
    } else if (!isMaster && !hasAdminOrManager) {
      if (!parsed.roles || parsed.roles.length === 0) {
        parsed.roles = ['vendedor'];
      }
      parsed.dataScope = 'own';
      parsed.permissions = [
        'page.dashboard',
        'page.vehicles',
        'page.inspections',
        'page.sales',
        'page.logistics',
        'page.settings',
        'sales.create',
        'sales.edit',
        'sales.delete',
        'vehicles.create',
        'logistics.calculate_freight',
      ];
      parsed.hasCustomRole = false;
      parsed.customRoleName = null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeAuthCache(data: CachedUserData | null) {
  try {
    if (!data) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    } else {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data));
      sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    // ignore storage errors
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  userStore: UserStore | null;
  isLoading: boolean;
  isDataReady: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSeller: boolean;
  isSellerPlus: boolean;
  isStoreOwner: boolean;
  isExternalSeller: boolean;
  isLogistics: boolean;
  isDriver: boolean;
  canRegisterVehicles: boolean;
  hasElevatedAccess: boolean;
  canCreateSales: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  dataScope: DataScope;
  customRoleName: string | null;
  hasCustomRole: boolean;
  can: (permission: string) => boolean;
  canViewMargins: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMasterKey: (masterKey: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearMustChangePassword: () => void;
}

// Keep a single context instance across hot reloads so providers and consumers always match.
const g = globalThis as unknown as { __authContext?: React.Context<AuthContextType | undefined> };
const AuthContext = g.__authContext ?? (g.__authContext = createContext<AuthContextType | undefined>(undefined));

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialCache = useRef<CachedUserData | null>(readAuthCache());

  const [user, setUser] = useState<User | null>(
    () =>
      initialCache.current?.userId
        ? ({
            id: initialCache.current.userId,
            email: initialCache.current.profile?.email || 'usuario@concessionaria.com.br',
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: { full_name: initialCache.current.profile?.full_name },
          } as unknown as User)
        : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(initialCache.current?.profile ?? null);
  const [roles, setRoles] = useState<AppRole[]>(initialCache.current?.roles ?? []);
  const [userStore, setUserStore] = useState<UserStore | null>(initialCache.current?.userStore ?? null);
  const [isLoading, setIsLoading] = useState(!Boolean(initialCache.current));
  const [mustChangePassword, setMustChangePassword] = useState(
    () => Boolean(initialCache.current?.profile?.must_change_password && !hasUserDefinedPassword(initialCache.current?.profile?.email || ''))
  );
  const [isDataReady, setIsDataReady] = useState(Boolean(initialCache.current));
  const [permissions, setPermissions] = useState<string[]>(initialCache.current?.permissions ?? []);
  const [dataScope, setDataScope] = useState<DataScope>(initialCache.current?.dataScope ?? 'all');
  const [customRoleName, setCustomRoleName] = useState<string | null>(initialCache.current?.customRoleName ?? null);
  const [hasCustomRole, setHasCustomRole] = useState(initialCache.current?.hasCustomRole ?? false);

  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUserIdRef = useRef<string | null>(initialCache.current?.userId ?? null);
  const hasLoadedUserDataRef = useRef<boolean>(Boolean(initialCache.current));
  const inFlightUserIdRef = useRef<string | null>(null);

  const startSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
    }, SESSION_MAX_AGE_MS);
  }, []);

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  }, []);

  const fetchUserData = useCallback(async (userId: string) => {
    if (inFlightUserIdRef.current === userId) return;
    inFlightUserIdRef.current = userId;

    try {
      const [{ data: profileData }, { data: rolesData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        (supabase as any).from('user_roles').select('role, custom_role_id').eq('user_id', userId),
      ]);

      let nextProfile: Profile | null = null;
      if (profileData) {
        nextProfile = profileData as Profile;
        setProfile(nextProfile);
        setMustChangePassword(Boolean(profileData.must_change_password));
      } else {
        // Tenta buscar no storage local de custom_users
        let foundCustom: any = null;
        try {
          const raw = localStorage.getItem('dealflow_custom_users_v1');
          if (raw) {
            const list = JSON.parse(raw);
            foundCustom = list.find((u: any) => u.id === userId || (user?.email && u.email?.toLowerCase().trim() === user.email.toLowerCase().trim()));
          }
        } catch {}

        nextProfile = {
          id: userId,
          full_name: foundCustom?.full_name || user?.user_metadata?.full_name || 'Vendedor',
          email: foundCustom?.email || user?.email || 'vendedor@concessionaria.com.br',
          phone: null,
          avatar_url: null,
          must_change_password: false,
          is_active: true,
        };
        setProfile(nextProfile);
      }

      let userRoles: AppRole[] = (rolesData ?? []).map((r: any) => r.role as AppRole);

      // REGRA MASTER: Apenas Breno e João Vitor podem possuir cargos administrativos (admin / gerente).
      // Qualquer usuário pode possuir o cargo 'dono_loja' (Dono do Grupo — todas as lojas).
      const isMaster = isMasterUser(nextProfile?.full_name, nextProfile?.email, userId);

      if (!isMaster) {
        const cleanEmailForRole = (nextProfile?.email || '').toLowerCase().trim();
        const ovRole = getUserOverride(userId)?.role || (cleanEmailForRole ? getUserOverride(cleanEmailForRole)?.role : undefined);
        const nonMasterRoles = userRoles.filter((r) => r !== 'admin' && r !== 'gerente');
        if (ovRole === 'dono_loja' || nonMasterRoles.includes('dono_loja')) {
          userRoles = ['dono_loja'];
        } else {
          userRoles = nonMasterRoles.length > 0 ? nonMasterRoles : ['vendedor'];
        }
      } else if (!userRoles || userRoles.length === 0) {
        const cleanEmail = (nextProfile?.email || '').toLowerCase();
        const cleanName = (nextProfile?.full_name || '').toLowerCase();
        userRoles = cleanEmail.includes('gestor') || cleanName.includes('joão') || cleanName.includes('joao')
          ? ['gerente']
          : ['admin', 'gerente'];
      }

      setRoles(userRoles);

      let nextHasCustomRole = false;
      let nextCustomRoleName: string | null = null;
      let nextDataScope: DataScope =
        userRoles.includes('admin') || userRoles.includes('gerente') || userRoles.includes('dono_loja') ? 'all' : 'own';
      let nextPermissions: string[] =
        userRoles.includes('admin') || userRoles.includes('gerente')
          ? ['*']
          : userRoles.includes('dono_loja')
          ? [...LEGACY.dono_loja]
          : [];

      const customIds: string[] = (rolesData ?? [])
        .map((r: any) => r.custom_role_id)
        .filter(Boolean);

      const cleanEmail = (nextProfile?.email || '').toLowerCase().trim();
      const storePromise = !userRoles.includes('admin')
        ? Promise.all([
            supabase
              .from('resellers')
              .select('store_id, stores(id, name)')
              .or(`user_id.eq.${userId}${cleanEmail ? `,email.ilike.${cleanEmail}` : ''}`)
              .maybeSingle(),
            supabase
              .from('employees')
              .select('id, profile_id, store_id, stores(id, name)')
              .or(`profile_id.eq.${userId}${cleanEmail ? `,email.ilike.${cleanEmail}` : ''}`)
              .maybeSingle(),
            supabase.from('stores').select('id, name').eq('manager_id', userId).maybeSingle(),
          ])
        : Promise.resolve([null, null, null] as const);

      const customRolePromise =
        customIds.length && !userRoles.includes('admin')
          ? Promise.all([
              (supabase as any)
                .from('custom_roles')
                .select('id, name, data_scope, is_active')
                .in('id', customIds),
              (supabase as any)
                .from('role_permissions')
                .select('permission')
                .in('role_id', customIds),
            ])
          : Promise.resolve(null);

      const [[resellerRes, empRes, storeRes], customRoleRes] = await Promise.all([
        storePromise,
        customRolePromise,
      ]);

      if (customRoleRes) {
        const [{ data: crs }, { data: perms }] = customRoleRes;
        const active = (crs ?? []).filter((c: any) => c.is_active);
        const rank = { own: 1, store: 2, all: 3 } as const;
        const scope = active.reduce(
          (acc: DataScope, c: any): DataScope =>
            rank[c.data_scope as DataScope] > rank[acc] ? c.data_scope : acc,
          'own',
        );
        const activeIds = new Set(active.map((c: any) => c.id));
        nextHasCustomRole = true;
        nextCustomRoleName = active[0]?.name ?? null;
        nextDataScope = scope;
        nextPermissions = activeIds.size
          ? Array.from(new Set((perms ?? []).map((p: any) => p.permission as string)))
          : [];
      }

      setHasCustomRole(nextHasCustomRole);
      setCustomRoleName(nextCustomRoleName);
      setDataScope(nextDataScope);
      setPermissions(nextPermissions);

      let nextStore: UserStore | null = null;
      if (!userRoles.includes('admin') && !userRoles.includes('dono_loja')) {
        const storeData = (empRes?.data as any)?.stores || (resellerRes?.data as any)?.stores || storeRes?.data;
        const explicitStoreId = empRes?.data?.store_id || resellerRes?.data?.store_id || (storeRes?.data as any)?.id;

        // Se encontrou o vínculo de empregado por e-mail mas faltava profile_id, atualiza no Supabase
        if (empRes?.data?.id && !empRes.data.profile_id) {
          void (supabase as any)
            .from('employees')
            .update({ profile_id: userId })
            .eq('id', empRes.data.id);
        }

        if (storeData && typeof storeData === 'object' && !Array.isArray(storeData) && (storeData as any).id) {
          nextStore = storeData as unknown as UserStore;
        } else if (explicitStoreId) {
          if (isMatchingStore(explicitStoreId, STORE_MONTESCLAROS_UUID)) {
            nextStore = {
              id: STORE_MONTESCLAROS_UUID,
              name: 'Concessionária Montes Claros',
            };
          } else {
            nextStore = {
              id: STORE_DIVINOPOLIS_UUID,
              name: 'Concessionária Divinópolis',
            };
          }
        }

        // Se ainda não achou, consulta overrides salvos localmente
        if (!nextStore) {
          const ov = getUserOverride(userId) || (cleanEmail ? getUserOverride(cleanEmail) : null);
          if (ov?.store_id) {
            if (isMatchingStore(ov.store_id, STORE_MONTESCLAROS_UUID)) {
              nextStore = {
                id: STORE_MONTESCLAROS_UUID,
                name: 'Concessionária Montes Claros',
              };
            } else {
              nextStore = {
                id: STORE_DIVINOPOLIS_UUID,
                name: 'Concessionária Divinópolis',
              };
            }
          }
        }

        // Fallback final apenas se NENHUMA loja estiver associada ao colaborador
        if (!nextStore) {
          const cleanName = (nextProfile?.full_name || '').toLowerCase().trim();
          const isMoc =
            cleanEmail.includes('moc') ||
            cleanEmail.includes('montesclaros') ||
            cleanName.includes('mariana') ||
            cleanName.includes('halana') ||
            cleanName.includes('sabrina') ||
            cleanName.includes('natan');

          nextStore = isMoc
            ? { id: STORE_MONTESCLAROS_UUID, name: 'Concessionária Montes Claros' }
            : { id: STORE_DIVINOPOLIS_UUID, name: 'Concessionária Divinópolis' };
        }

        setUserStore(nextStore);
      } else {
        setUserStore(null);
        // Ensure seller system roles have 'vehicles.create' in DB role_permissions for RLS
        void (async () => {
          try {
            const { data: sellerRoles } = await (supabase as any)
              .from('custom_roles')
              .select('id')
              .in('system_key', ['vendedor', 'vendedor_plus', 'vendedor_externo']);
            if (sellerRoles?.length) {
              const rows = sellerRoles.map((r: any) => ({
                role_id: r.id,
                permission: 'vehicles.create',
              }));
              await (supabase as any)
                .from('role_permissions')
                .upsert(rows, { onConflict: 'role_id,permission', ignoreDuplicates: true });
            }
          } catch {
            // silent
          }
        })();
      }

      writeAuthCache({
        userId,
        profile: nextProfile,
        roles: userRoles,
        userStore: nextStore,
        permissions: nextPermissions,
        dataScope: nextDataScope,
        customRoleName: nextCustomRoleName,
        hasCustomRole: nextHasCustomRole,
      });
    } finally {
      inFlightUserIdRef.current = null;
      activeUserIdRef.current = userId;
      hasLoadedUserDataRef.current = true;
      setIsDataReady(true);
    }
  }, []);

  useEffect(() => {
    const handleSession = (nextSession: Session | null) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;

      // Verifica quem está autenticado no aplicativo (cache da sessão do usuário)
      const cached = readAuthCache();
      const isCachedMaster = cached && isMasterUser(cached.profile?.full_name, cached.profile?.email, cached.userId);
      const isCachedSeller = cached && !isCachedMaster;

      // Se um usuário não-master (vendedor ou dono do grupo) está ativo no DealFlow e o Supabase usa a credencial técnica de dados (admbreno),
      // MANTÉM estritamente a identidade e permissões do usuário em cache!
      if (isCachedSeller && (nextUser?.email === 'admbreno@index.com' || nextUser?.id !== cached.userId)) {
        const cachedIsGroupOwner = (cached.roles || []).includes('dono_loja');
        const defaultUser = {
          id: cached.userId,
          email: cached.profile?.email || 'vendedor@concessionaria.com.br',
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: { full_name: cached.profile?.full_name },
        } as unknown as User;
        setUser(defaultUser);
        setProfile(cached.profile);
        setRoles(cachedIsGroupOwner ? ['dono_loja'] : ['vendedor']);
        setUserStore(cachedIsGroupOwner ? null : cached.userStore);
        setPermissions(cachedIsGroupOwner ? [...LEGACY.dono_loja] : cached.permissions);
        setDataScope(cachedIsGroupOwner ? 'all' : 'own');
        setCustomRoleName(null);
        setHasCustomRole(false);
        setIsDataReady(true);
        setIsLoading(false);
        return;
      }

      if (nextUser) {
        setUser(nextUser);
        startSessionTimer();
        void initializeSingleSessionGuard(nextUser.id);
        const isSameCachedUser =
          activeUserIdRef.current === nextUser.id && hasLoadedUserDataRef.current;

        if (!isSameCachedUser) {
          setIsDataReady(false);
        } else {
          setIsDataReady(true);
        }
        fetchUserData(nextUser.id);
      } else {
        if (cached && localStorage.getItem('df_explicit_signout') !== 'true') {
          const defaultUser = {
            id: cached.userId,
            email: cached.profile?.email || 'usuario@concessionaria.com.br',
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: { full_name: cached.profile?.full_name },
          } as unknown as User;
          setUser(defaultUser);
          setProfile(cached.profile);
          setRoles(cached.roles);
          setUserStore(cached.userStore);
          setPermissions(cached.permissions);
          setDataScope(cached.dataScope);
          setCustomRoleName(cached.customRoleName);
          setHasCustomRole(cached.hasCustomRole);
          setIsDataReady(true);
          void initializeSingleSessionGuard(cached.userId);
        } else {
          clearSessionTimer();
          activeUserIdRef.current = null;
          hasLoadedUserDataRef.current = false;
          inFlightUserIdRef.current = null;
          setUser(null);
          writeAuthCache(null);
          setIsDataReady(true);
          setProfile(null);
          setRoles([]);
          setUserStore(null);
          setMustChangePassword(false);
          setPermissions([]);
          setHasCustomRole(false);
          setCustomRoleName(null);
        }
      }

      setIsLoading(false);
    };

    void syncCredentialsFromSupabase();

    const initTimer = setTimeout(() => {
      setIsLoading(false);
      setIsDataReady(true);
    }, 1200);

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      clearTimeout(initTimer);
      if (currentSession) {
        handleSession(currentSession);
      } else {
        const cached = readAuthCache();
        if (cached && localStorage.getItem('df_explicit_signout') !== 'true') {
          handleSession(null);
        } else {
          handleSession(null);
        }
      }
    }).catch(() => {
      clearTimeout(initTimer);
      setIsLoading(false);
      setIsDataReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Avoid resetting loading states on background token refreshes for the same user
      if (
        event === 'TOKEN_REFRESHED' &&
        nextSession?.user?.id &&
        activeUserIdRef.current === nextSession.user.id
      ) {
        setSession(nextSession);
        setUser(nextSession.user);
        return;
      }
      handleSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
      clearSessionTimer();
    };
  }, [clearSessionTimer, fetchUserData, startSessionTimer]);

  const signIn = async (email: string, password?: string) => {
    try {
      localStorage.removeItem('df_explicit_signout');
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = (password || '').trim();

      // Sincroniza credenciais universais do Supabase para suportar qualquer dispositivo
      try {
        await syncCredentialsFromSupabase();
      } catch {}

      // 0. BLOQUEIO ABSOLUTO: Usuários excluídos NUNCA podem fazer login
      if (isUserDeleted(null, cleanEmail)) {
        return {
          error: new Error('Esta conta de usuário foi desativada ou excluída da plataforma.'),
        };
      }

      // 0.1 SENHA É ESTRITAMENTE OBRIGATÓRIA (Validação Total)
      if (!cleanPass) {
        return {
          error: new Error('A senha é obrigatória. Digite sua senha corporativa para entrar.'),
        };
      }

      const SELLER_DEFAULT_PERMS = [
        'page.dashboard',
        'page.vehicles',
        'page.inspections',
        'page.sales',
        'page.logistics',
        'page.settings',
        'page.moto_invoices',
        'sales.create',
        'sales.edit',
        'sales.delete',
        'vehicles.create',
        'vehicles.edit',
        'logistics.calculate_freight',
      ];

      const userAlreadyHasDefinedPassword = hasUserDefinedPassword(cleanEmail);
      const isMaster = isMasterUser(cleanEmail, cleanEmail, null);
      const isMasterPasswordValid =
        cleanPass === 'PixelMotors@2026' ||
        cleanPass === 'L1ma@2026' ||
        cleanPass === 'L1ma@wLdL!' ||
        cleanPass === 'PIXEL-2026' ||
        cleanPass === 'Pixel@2026';

      // 1. Tenta autenticação oficial no Supabase Auth (se senha foi informada)
      if (cleanPass) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPass });
          if (!error && data?.user) {
            setUser(data.user);
            const fullName = data.user.user_metadata?.full_name;
            const userEmail = data.user.email || cleanEmail;
            const isMasterSupabase = isMasterUser(fullName, userEmail, data.user.id);
            const initialRoles: AppRole[] = isMasterSupabase ? ['admin', 'gerente'] : ['vendedor'];
            const initialScope: DataScope = isMasterSupabase ? 'all' : 'own';
            const initialPerms = isMasterSupabase ? ['*'] : SELLER_DEFAULT_PERMS;

            setRoles(initialRoles);
            setPermissions(initialPerms);
            setDataScope(initialScope);
            setIsLoading(false);
            setIsDataReady(true);
            const cleanEmailLogin = userEmail.toLowerCase().trim();
            const cleanFullNameLogin = (fullName || '').toLowerCase().trim();
            const ovLogin = getUserOverride(data.user.id) || getUserOverride(cleanEmailLogin);

            let initialStore: UserStore;
            if (ovLogin?.store_id) {
              const isMocOv = isMatchingStore(ovLogin.store_id, STORE_MONTESCLAROS_UUID);
              initialStore = isMocOv
                ? { id: STORE_MONTESCLAROS_UUID, name: 'Concessionária Montes Claros' }
                : { id: STORE_DIVINOPOLIS_UUID, name: 'Concessionária Divinópolis' };
            } else {
              const isMocLogin =
                cleanEmailLogin.includes('moc') ||
                cleanEmailLogin.includes('montesclaros') ||
                cleanFullNameLogin.includes('mariana') ||
                cleanFullNameLogin.includes('halana') ||
                cleanFullNameLogin.includes('sabrina') ||
                cleanFullNameLogin.includes('natan');

              initialStore = isMocLogin
                ? { id: STORE_MONTESCLAROS_UUID, name: 'Concessionária Montes Claros' }
                : { id: STORE_DIVINOPOLIS_UUID, name: 'Concessionária Divinópolis' };
            }

            const mustDefine = !userAlreadyHasDefinedPassword && !isMasterSupabase;
            setMustChangePassword(mustDefine);

            writeAuthCache({
              userId: data.user.id,
              profile: {
                id: data.user.id,
                full_name: fullName || (isMasterSupabase ? 'Administrador' : 'Vendedor'),
                email: userEmail,
                phone: null,
                avatar_url: null,
                must_change_password: mustDefine,
              },
              roles: initialRoles,
              userStore: initialStore,
              permissions: initialPerms,
              dataScope: initialScope,
              customRoleName: null,
              hasCustomRole: false,
            });
            localStorage.removeItem('df_explicit_signout');
            sessionStorage.removeItem('df_explicit_signout');
            localStorage.setItem(GLOBAL_FORCE_LOGOUT_KEY, new Date().toISOString());
            await fetchUserData(data.user.id);

            return { error: null };
          }
        } catch {}
      }

      // 2. Busca nos custom users locais (dealflow_custom_users_v1)
      let matchedUser: any = null;
      try {
        const customList = getCustomUsers();
        matchedUser = customList.find(
          (u: any) => u.email && u.email.toLowerCase().trim() === cleanEmail
        );
      } catch {}

      // 3. Busca nos user overrides locais (dealflow_user_overrides_v1)
      if (!matchedUser) {
        try {
          const rawOverrides = localStorage.getItem('dealflow_user_overrides_v1');
          if (rawOverrides) {
            const overrides = JSON.parse(rawOverrides);
            const ov = overrides[cleanEmail];
            if (ov && !isUserDeleted(ov.id, ov.email)) {
              matchedUser = {
                id: ov.id || `custom-${Date.now()}`,
                email: ov.email || cleanEmail,
                full_name: ov.full_name || 'Colaborador',
                role: ov.role || 'vendedor',
                store_id: ov.store_id || 'store-divinopolis',
                temp_password: ov.temp_password,
              };
            }
          }
        } catch {}
      }

      // 4. Busca remota no Supabase (tabela employees e profiles)
      if (!matchedUser) {
        try {
          await ensureSupabaseSession();
          const { data: empList } = await supabase
            .from('employees')
            .select('*');

          const empData = (empList || []).find((e: any) => {
            const eEmail = (e.email || '').toLowerCase().trim();
            const eName = (e.full_name || '').toLowerCase().trim();
            return (
              eEmail === cleanEmail ||
              cleanEmail.includes(eEmail) ||
              eEmail.startsWith(cleanEmail) ||
              eName === cleanEmail
            );
          });

          if (empData) {
            const empNotes = empData.notes || '';
            if (empNotes.includes('[STATUS: DEMITIDO]') || (empData.is_active === false && empNotes.toLowerCase().includes('excluído'))) {
              recordDeletedUser(empData.id || empData.profile_id, empData.email);
              return { error: new Error('Esta conta de colaborador foi desativada ou excluída da plataforma.') };
            }

            let extractedPass = '';
            const matchDefined = empNotes.match(/\[PASS(?:_DEFINED)?:([^\]]+)\]/);
            const matchHash = empNotes.match(/\[PASS_HASH:([^\]]+)\]/);
            const matchInitial = empNotes.match(/Senha inicial:\s*([^\s\n\r]+)/);
            const matchReset = empNotes.match(/Senha redefinida:\s*([^\s\n\r]+)/);

            if (matchDefined) {
              extractedPass = matchDefined[1].trim();
            } else if (matchHash) {
              try { extractedPass = atob(matchHash[1].trim()); } catch {}
            } else if (matchReset) {
              extractedPass = matchReset[1].trim();
            } else if (matchInitial) {
              extractedPass = matchInitial[1].trim();
            }

            matchedUser = {
              id: empData.id || empData.profile_id || `emp-${Date.now()}`,
              email: empData.email,
              full_name: empData.full_name,
              role: empData.role || 'vendedor',
              store_id: empData.store_id || 'store-divinopolis',
              temp_password: extractedPass || '',
            };
          }
        } catch {}
      }

      // 4.1 Busca em profiles caso esteja cadastrado no auth/profiles
      if (!matchedUser) {
        try {
          await ensureSupabaseSession();
          const { data: profList } = await supabase
            .from('profiles')
            .select('*');

          const profData = (profList || []).find((p: any) => {
            const pEmail = (p.email || '').toLowerCase().trim();
            const pName = (p.full_name || '').toLowerCase().trim();
            return (
              pEmail === cleanEmail ||
              cleanEmail.includes(pEmail) ||
              pEmail.startsWith(cleanEmail) ||
              pName === cleanEmail
            );
          });

          if (profData && !isUserDeleted(profData.id, profData.email)) {
            const isMocUser =
              (profData.store_id && (
                profData.store_id.toLowerCase().includes('montes') ||
                profData.store_id === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
                profData.store_id === '6b3afc94-86b2-41b0-9427-6f58ae8dbf21' ||
                profData.store_id === 'store-montesclaros'
              )) ||
              (profData.email || '').toLowerCase().includes('moc') ||
              (profData.email || '').toLowerCase().includes('montes') ||
              (profData.full_name || '').toLowerCase().includes('mariana') ||
              (profData.full_name || '').toLowerCase().includes('halana') ||
              (profData.full_name || '').toLowerCase().includes('natan') ||
              (profData.full_name || '').toLowerCase().includes('sabrina');

            let resolvedProfRole: AppRole = isMasterUser(profData.full_name, profData.email, profData.id) ? 'admin' : 'vendedor';
            try {
              const { data: urData } = await (supabase as any)
                .from('user_roles')
                .select('role')
                .eq('user_id', profData.id)
                .maybeSingle();
              if (urData?.role === 'dono_loja') {
                resolvedProfRole = 'dono_loja';
              }
            } catch {}
            const ovProf = getUserOverride(profData.id) || getUserOverride(profData.email);
            if (ovProf?.role === 'dono_loja') {
              resolvedProfRole = 'dono_loja';
            }

            matchedUser = {
              id: profData.id,
              email: profData.email,
              full_name: profData.full_name,
              role: resolvedProfRole,
              store_id: resolvedProfRole === 'dono_loja'
                ? undefined
                : (isMocUser ? 'e8254a81-d669-464b-9806-457ba25ce7f0' : 'ccf8e097-09d7-4305-8077-5c16fc8b5634'),
              temp_password: '',
            };
          }
        } catch {}
      }

      // 4.2 Busca na base oficial de administradores e colaboradores (DEFAULT_OFFICIAL_USERS)
      if (!matchedUser) {
        const emailPrefix = cleanEmail.split('@')[0].toLowerCase().trim();
        const found = DEFAULT_OFFICIAL_USERS.find((u) => {
          const uEmail = (u.email || '').toLowerCase().trim();
          const uName = (u.full_name || '').toLowerCase().trim();
          const uPrefix = uEmail.split('@')[0].toLowerCase().trim();
          const uAliases = (u.aliases || []).map((a) => a.toLowerCase().trim());

          if (uEmail === cleanEmail || uAliases.includes(cleanEmail)) return true;
          if (uPrefix === emailPrefix || uAliases.includes(emailPrefix)) return true;
          if (u.id.toLowerCase() === cleanEmail) return true;
          if (uName === cleanEmail || uName.split(' ')[0].toLowerCase() === cleanEmail) return true;

          return (
            (cleanEmail === 'admin' && (uEmail.includes('admbreno') || uEmail.includes('breno'))) ||
            (cleanEmail === 'dono' && (uEmail.includes('admbreno') || uEmail.includes('breno'))) ||
            (cleanEmail === 'breno' && uEmail.includes('breno')) ||
            (cleanEmail === 'joao' && uEmail.includes('joao')) ||
            (cleanEmail === 'gestor' && (uEmail.includes('gestor') || uEmail.includes('joao'))) ||
            (cleanEmail === 'mariana' && (uName.includes('mariana') || uEmail.includes('shineraymoc@'))) ||
            (cleanEmail === 'natan' && (uName.includes('natan') || uEmail.includes('shineraymocn'))) ||
            (cleanEmail === 'lilian' && (uName.includes('lilian') || uEmail.includes('shineraydivl'))) ||
            (cleanEmail === 'geibriel' && (uName.includes('geibriel') || uEmail.includes('shineraydivg'))) ||
            (cleanEmail === 'daniel' && (uName.includes('daniel') || uEmail.includes('shineraydivd'))) ||
            (cleanEmail === 'sabrina' && (uName.includes('sabrina') || uEmail.includes('shineraymocs'))) ||
            (cleanEmail === 'halana' && (uName.includes('halana') || uEmail.includes('shineraymoch'))) ||
            (cleanEmail === 'elias' && (uName.includes('elias') || uEmail.includes('shineraydive')))
          );
        });
        if (found && !isUserDeleted(found.id, found.email)) {
          matchedUser = { ...found };
        }
      }

      // 4.3 Fallback Direto para Administradores / Dono (Breno & João)
      if (!matchedUser && (isMasterUser(cleanEmail, cleanEmail, null) || cleanEmail === 'admin' || cleanEmail === 'dono')) {
        matchedUser = {
          id: '54db7881-ce90-42d4-baff-0e0ec2cb9eeb',
          email: cleanEmail.includes('@') ? cleanEmail : 'admbreno@index.com',
          full_name: 'Breno Lima',
          role: 'admin',
          store_id: 'store-divinopolis',
          temp_password: 'PixelMotors@2026',
        };
      }

      // Se o usuário não foi localizado em nenhuma base autorizada
      if (!matchedUser) {
        return { error: new Error('Usuário ou e-mail não encontrado no sistema. Verifique os dados digitados.') };
      }

      // Validação de Exclusão Permanente
      if (isUserDeleted(matchedUser.id, matchedUser.email)) {
        return { error: new Error('Esta conta de usuário foi desativada ou excluída da plataforma.') };
      }

      // 4.4 Conferência Rigorosa de Senha (Validação Total)
      const userPersonalPass =
        getUserDefinedPassword(matchedUser.email) ||
        getUserDefinedPassword(cleanEmail) ||
        getUserDefinedPassword(matchedUser.id);
      const userAssignedPass = matchedUser.temp_password || '';
      const isMasterPass =
        cleanPass === 'PixelMotors@2026' ||
        cleanPass === 'L1ma@2026' ||
        cleanPass === 'L1ma@wLdL!' ||
        cleanPass === 'PIXEL-2026' ||
        cleanPass === 'Pixel@2026';

      const isPasswordValid =
        (userPersonalPass && cleanPass === userPersonalPass) ||
        (userAssignedPass && cleanPass === userAssignedPass) ||
        isMasterPass;

      if (!isPasswordValid) {
        return {
          error: new Error('Senha incorreta. Verifique a senha digitada e tente novamente.'),
        };
      }

      // 5. Autentica e inicia a sessão
      const isMasterUserFlag = isMasterUser(matchedUser.full_name, matchedUser.email, matchedUser.id);
      const roleName: AppRole = (matchedUser.role as AppRole) || (isMasterUserFlag ? 'admin' : 'vendedor');
      const isElevated = isMasterUserFlag || roleName === 'admin' || roleName === 'gerente';
      const isGroupOwner = !isElevated && roleName === 'dono_loja';
      const currentScope: DataScope = (isElevated || isGroupOwner) ? 'all' : 'own';
      const currentPerms = isElevated ? ['*'] : isGroupOwner ? [...LEGACY.dono_loja] : SELLER_DEFAULT_PERMS;

      const sId = (matchedUser.store_id || '').toLowerCase().trim();
      const cleanEmailMatched = (matchedUser.email || '').toLowerCase().trim();
      const cleanNameMatched = (matchedUser.full_name || '').toLowerCase().trim();

      const isMoc =
        sId === 'store-montesclaros' ||
        sId === STORE_MONTESCLAROS_UUID ||
        sId.includes('montes') ||
        sId.includes('moc') ||
        cleanEmailMatched.includes('moc') ||
        cleanEmailMatched.includes('montesclaros') ||
        cleanNameMatched.includes('mariana') ||
        cleanNameMatched.includes('halana') ||
        cleanNameMatched.includes('sabrina') ||
        cleanNameMatched.includes('natan');

      const storeObj: UserStore | null = isGroupOwner
        ? null
        : {
            id: isMoc ? STORE_MONTESCLAROS_UUID : STORE_DIVINOPOLIS_UUID,
            name: isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis',
          };

      const customUser = {
        id: matchedUser.id,
        email: matchedUser.email,
        app_metadata: {},
        user_metadata: { full_name: matchedUser.full_name },
        aud: 'authenticated',
        created_at: matchedUser.created_at || new Date().toISOString(),
      } as unknown as User;

      activeUserIdRef.current = matchedUser.id;
      hasLoadedUserDataRef.current = true;
      inFlightUserIdRef.current = null;

      // Se ainda não cadastrou senha pessoal e não usou a senha mestre de admin, deve cadastrar hoje 1x
      const hasAnyPass = userAlreadyHasDefinedPassword || Boolean(matchedUser.temp_password);
      const mustDefinePassword = !hasAnyPass && !(isMasterUserFlag && isMasterPasswordValid);

      setUser(customUser);
      setProfile({
        id: matchedUser.id,
        full_name: matchedUser.full_name,
        email: matchedUser.email,
        phone: null,
        avatar_url: null,
        must_change_password: mustDefinePassword,
      });
      setRoles([roleName]);
      setUserStore(storeObj);
      setPermissions(currentPerms);
      setDataScope(currentScope);
      setMustChangePassword(mustDefinePassword);
      setIsDataReady(true);
      setIsLoading(false);

      writeAuthCache({
        userId: matchedUser.id,
        profile: {
          id: matchedUser.id,
          full_name: matchedUser.full_name,
          email: matchedUser.email,
          phone: null,
          avatar_url: null,
          must_change_password: mustDefinePassword,
        },
        roles: [roleName],
        userStore: storeObj,
        permissions: currentPerms,
        dataScope: currentScope,
        customRoleName: null,
        hasCustomRole: false,
      });

      localStorage.removeItem('df_explicit_signout');
      sessionStorage.removeItem('df_explicit_signout');
      localStorage.setItem(GLOBAL_FORCE_LOGOUT_KEY, new Date().toISOString());

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const signInWithMasterKey = async (rawKey: string): Promise<{ error: Error | null }> => {
    try {
      const normalized = rawKey.trim().toUpperCase().replace(/\s+/g, '');
      const validMasterKeys = [
        'PIXEL-2026',
        'PIXEL2026',
        'PIXEL-MASTER-2026',
        'PX-MASTER-2026',
        'ADMIN2026',
        'MASTER2026',
        'DEALFLOW2026',
      ];

      const isValid =
        validMasterKeys.includes(normalized) ||
        validMasterKeys.some((k) => k.replace(/-/g, '') === normalized.replace(/-/g, ''));

      if (!isValid) {
        return {
          error: new Error('Chave Mestra inválida. Verifique o código corporativo de contingência.'),
        };
      }

      localStorage.removeItem('df_explicit_signout');

      const masterUser = {
        id: '54db7881-ce90-42d4-baff-0e0ec2cb9eeb',
        email: 'admbreno@index.com',
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        app_metadata: { role: 'admin' },
        user_metadata: { full_name: 'Diretoria Executiva (Acesso Master)' },
      } as unknown as User;

      setUser(masterUser);
      setProfile(DEFAULT_ACTIVE_ADMIN.profile);
      setRoles(['admin']);
      setUserStore(DEFAULT_ACTIVE_ADMIN.userStore);
      setPermissions(['*']);
      setDataScope('all');
      setIsLoading(false);
      setIsDataReady(true);
      writeAuthCache(DEFAULT_ACTIVE_ADMIN);

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const signOut = async () => {
    clearSessionTimer();
    teardownSingleSessionGuard();
    removeSecureCookie('session_token');
    removeSecureCookie('df_fingerprint');
    try {
      localStorage.removeItem('df_explicit_signout');
      localStorage.removeItem(AUTH_CACHE_KEY);
      sessionStorage.removeItem(AUTH_CACHE_KEY);
      localStorage.removeItem('dealflow_active_role');
    } catch {}
    writeAuthCache(null);
    try {
      await supabase.auth.signOut();
    } catch {}
    activeUserIdRef.current = null;
    hasLoadedUserDataRef.current = false;
    inFlightUserIdRef.current = null;
    setUser(null);
    setProfile(null);
    setRoles([]);
    setUserStore(null);
    setMustChangePassword(false);
    setPermissions([]);
    setDataScope('own');
    setCustomRoleName(null);
    setHasCustomRole(false);
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
    if (profile) {
      const updatedProfile = { ...profile, must_change_password: false };
      setProfile(updatedProfile);
      const cached = readAuthCache();
      if (cached) {
        cached.profile = updatedProfile;
        writeAuthCache(cached);
      }
    }
  };

  const cleanName = (profile?.full_name || user?.user_metadata?.full_name || '').toLowerCase();
  const cleanEmail = (profile?.email || user?.email || '').toLowerCase();
  const isMaster = isMasterUser(cleanName, cleanEmail, user?.id || profile?.id);
  const isVendedor = !isMaster;

  const isBreno = isMaster && (
    cleanName.includes('breno') ||
    cleanEmail.includes('breno') ||
    user?.id === '54db7881-ce90-42d4-baff-0e0ec2cb9eeb' ||
    user?.id === 'def5409c-f9cc-47ae-b45e-9e15fd52727f'
  );

  const isJoao = isMaster && (
    cleanName.includes('joão') ||
    cleanName.includes('joao') ||
    cleanEmail.includes('gestor') ||
    user?.id === '63f4c11a-7675-4209-bcc5-770bd7e514a3'
  );

  const isAdmin = Boolean(isBreno);
  const isManager = Boolean(isJoao);
  const hasElevatedAccess = Boolean(isBreno || isJoao);
  const isStoreOwner = !hasElevatedAccess && roles.includes('dono_loja');
  const isSellerPlus = !hasElevatedAccess && roles.includes('vendedor_plus');
  const isExternalSeller = !hasElevatedAccess && roles.includes('vendedor_externo');
  const isDriver = !hasElevatedAccess && roles.includes('motorista');
  const isLogistics = !hasElevatedAccess && (roles.includes('coordenador_logistica') || isDriver);
  const isSeller = !hasElevatedAccess && !isStoreOwner;
  const usePerms = hasCustomRole && !hasElevatedAccess;
  const can = (permission: string) => {
    if (hasElevatedAccess) return true;
    if (isStoreOwner) {
      return usePerms ? permissions.includes(permission) : legacyCan(roles, permission);
    }
    if (permission === 'page.inspections' || permission === 'page.sales' || permission === 'page.logistics') return true;
    if (permission.startsWith('logistics.calculate')) return true;
    if (isSeller && (
      permission === 'sales.create' ||
      permission === 'sales.edit' ||
      permission === 'sales.delete' ||
      permission === 'vehicles.create' ||
      permission === 'vehicles.edit' ||
      permission === 'page.vehicles'
    )) return true;
    if (isLogistics && permission.startsWith('logistics.')) return true;
    return usePerms ? permissions.includes(permission) : legacyCan(roles, permission);
  };
  const canCreateSales = hasElevatedAccess || isStoreOwner || isSeller || can('sales.create');
  const canRegisterVehicles = hasElevatedAccess || isStoreOwner || isSeller || can('vehicles.create');
  const canViewMargins = hasElevatedAccess || isStoreOwner;

  return (
    <AuthContext.Provider
      value={{
        user, session, profile, roles, userStore, isLoading, isDataReady,
        isAdmin, isManager, isSeller, isSellerPlus, isStoreOwner, isExternalSeller, isLogistics, isDriver, hasElevatedAccess, canCreateSales, canRegisterVehicles, mustChangePassword,
        permissions, dataScope, customRoleName, hasCustomRole, can, canViewMargins,
        signIn, signInWithMasterKey, signOut, clearMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function legacyCan(roles: string[], permission: string) {
  return roles.some((r) => {
    const list = LEGACY[r] ?? [];
    return list.includes('*') || list.includes(permission);
  });
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
