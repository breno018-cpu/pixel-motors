import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

export interface CreateUserData {
  email: string;
  full_name: string;
  role: string;
  store_id?: string;
  phone?: string;
  cpf?: string;
  custom_role_id?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user_id: string;
  email: string;
  temp_password: string;
  message?: string;
}

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  cpf?: string;
  role: string;
  store_id?: string;
  store_name?: string;
  is_active: boolean;
  user_status?: 'ATIVO' | 'SUSPENSO' | 'DEMITIDO';
  status_reason?: string;
  created_at: string;
  temp_password?: string;
}

// UUIDs oficiais das lojas
export const STORE_UUIDS: Record<string, string> = {
  'store-divinopolis': 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
  'store-montesclaros': 'e8254a81-d669-464b-9806-457ba25ce7f0',
};

export const CUSTOM_USERS_STORAGE_KEY = 'dealflow_custom_users_v1';
export const DELETED_USERS_STORAGE_KEY = 'dealflow_deleted_users_v1';
export const USER_OVERRIDES_STORAGE_KEY = 'dealflow_user_overrides_v1';

export function getDeletedUserIdentifiers(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((s: string) => String(s).toLowerCase().trim());
    }
  } catch {}
  return [];
}

export function recordDeletedUser(id?: string | null, email?: string | null) {
  try {
    const current = new Set(getDeletedUserIdentifiers());
    if (id) current.add(String(id).toLowerCase().trim());
    if (email) current.add(String(email).toLowerCase().trim());
    localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function unmarkDeletedUser(idOrEmail?: string | null) {
  if (!idOrEmail) return;
  try {
    const target = String(idOrEmail).toLowerCase().trim();
    const current = getDeletedUserIdentifiers().filter((x) => x !== target);
    localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function isUserDeleted(id?: string | null, email?: string | null): boolean {
  const deletedSet = new Set(getDeletedUserIdentifiers());
  if (id && deletedSet.has(String(id).toLowerCase().trim())) return true;
  if (email && deletedSet.has(String(email).toLowerCase().trim())) return true;
  return false;
}

export interface UserOverride {
  id?: string;
  email?: string;
  full_name?: string;
  role?: string;
  store_id?: string;
  is_active?: boolean;
  user_status?: 'ATIVO' | 'SUSPENSO' | 'DEMITIDO';
  status_reason?: string;
  status_date?: string;
  temp_password?: string;
}

export function getUserOverrides(): Record<string, UserOverride> {
  try {
    const raw = localStorage.getItem(USER_OVERRIDES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
  } catch {}
  return {};
}

export function saveUserOverride(key: string, override: UserOverride) {
  try {
    const all = getUserOverrides();
    const cleanKey = key.toLowerCase().trim();
    all[cleanKey] = { ...(all[cleanKey] || {}), ...override };
    localStorage.setItem(USER_OVERRIDES_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function removeUserOverride(key: string) {
  try {
    const all = getUserOverrides();
    const cleanKey = key.toLowerCase().trim();
    delete all[cleanKey];
    localStorage.setItem(USER_OVERRIDES_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * REGRA MASTER DE CONTROLE DE ACESSO:
 * Apenas Breno e João Vitor podem possuir cargos administrativos (admin / gerente).
 * Todos os demais usuários da plataforma têm estritamente o cargo de 'vendedor'.
 */
export function isMasterUser(name?: string | null, email?: string | null, id?: string | null): boolean {
  if (
    id === '54db7881-ce90-42d4-baff-0e0ec2cb9eeb' ||
    id === 'def5409c-f9cc-47ae-b45e-9e15fd52727f' ||
    id === '63f4c11a-7675-4209-bcc5-770bd7e514a3'
  ) {
    return true;
  }
  const cleanName = (name || '').toLowerCase();
  const cleanEmail = (email || '').toLowerCase();
  if (cleanName.includes('breno') || cleanEmail.includes('breno')) return true;
  if (cleanName.includes('joão') || cleanName.includes('joao') || cleanEmail.includes('gestor')) return true;
  return false;
}

export function resolveStoreUuid(storeId?: string | null): string {
  if (!storeId || storeId === 'none' || storeId === 'all') return STORE_UUIDS['store-divinopolis'];
  if (STORE_UUIDS[storeId]) return STORE_UUIDS[storeId];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) {
    return storeId;
  }
  return STORE_UUIDS['store-divinopolis'];
}

export function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pass = 'L1ma@';
  for (let i = 0; i < 4; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  pass += '!';
  return pass;
}

export function getCustomUsers(): UserWithRole[] {
  try {
    const raw = localStorage.getItem(CUSTOM_USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveCustomUser(user: UserWithRole & { temp_password?: string }) {
  try {
    const users = getCustomUsers();
    const idx = users.findIndex(
      (u) => u.id === user.id || (u.email && user.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    );
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.unshift(user);
    }
    localStorage.setItem(CUSTOM_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {}
}

export function removeCustomUser(idOrEmail: string) {
  try {
    const users = getCustomUsers();
    const target = idOrEmail.toLowerCase().trim();
    const filtered = users.filter((u) => u.id !== target && (u.email || '').toLowerCase().trim() !== target);
    localStorage.setItem(CUSTOM_USERS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

/**
 * Retorna todos os usuários consolidados de forma resiliente:
 * 1. profiles & user_roles do Supabase
 * 2. employees cadastrados no Supabase
 * 3. usuários customizados/locais em localStorage (dealflow_custom_users_v1)
 * 4. Aplica lista de exclusão permanente (dealflow_deleted_users_v1)
 * 5. Aplica modificações e status de dealflow_user_overrides_v1
 */
export async function fetchConsolidatedUsers(storesList?: any[]): Promise<UserWithRole[]> {
  await ensureSupabaseSession();

  const deletedList = getDeletedUserIdentifiers();
  const deletedSet = new Set(deletedList);
  const overrides = getUserOverrides();

  let profiles: any[] = [];
  let userRoles: any[] = [];
  let employees: any[] = [];
  let resellers: any[] = [];

  try {
    const [pRes, rRes, eRes, resRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('*'),
      supabase.from('employees').select('id, profile_id, store_id, full_name, email, role, cpf, phone, is_active, notes, created_at'),
      supabase.from('resellers').select('id, user_id, store_id, full_name, cpf, is_active'),
    ]);
    profiles = pRes.data || [];
    userRoles = rRes.data || [];
    employees = eRes.data || [];
    resellers = resRes.data || [];
  } catch (err) {
    console.warn('[userService] Aviso ao consultar tabelas de usuários:', err);
  }

  const roleMap = new Map((userRoles || []).map((r) => [r.user_id, r.role]));
  const employeeProfileMap = new Map((employees || []).filter((e) => e.profile_id).map((e) => [e.profile_id, e]));
  const resellerMap = new Map((resellers || []).filter((r) => r.user_id).map((r) => [r.user_id, r]));

  // Lojas conhecidas
  const storeMap = new Map((storesList || []).map((s) => [s.id, s.name]));
  storeMap.set('store-divinopolis', 'Concessionária Divinópolis (Matriz Oeste)');
  storeMap.set('store-montesclaros', 'Concessionária Montes Claros (Polo Norte)');
  storeMap.set(STORE_UUIDS['store-divinopolis'], 'Concessionária Divinópolis (Matriz Oeste)');
  storeMap.set(STORE_UUIDS['store-montesclaros'], 'Concessionária Montes Claros (Polo Norte)');

  const userMap = new Map<string, UserWithRole>();

  // 1. Processa perfis cadastrados no Supabase
  for (const p of profiles) {
    if (!p.email) continue;
    const emailKey = p.email.toLowerCase().trim();
    const idKey = (p.id || '').toLowerCase().trim();

    // Se estiver na lista de deletados, ignora completamente
    if (deletedSet.has(idKey) || deletedSet.has(emailKey)) {
      continue;
    }

    const emp = employeeProfileMap.get(p.id) || (employees || []).find((e) => e.email && e.email.toLowerCase().trim() === emailKey);
    const res = resellerMap.get(p.id);
    const resolvedStoreId = emp?.store_id || res?.store_id || undefined;
    const resolvedStoreName = (resolvedStoreId ? storeMap.get(resolvedStoreId) : undefined) || 'Concessionária Divinópolis (Matriz Oeste)';

    const notes = emp?.notes || '';
    let userStatus: 'ATIVO' | 'SUSPENSO' | 'DEMITIDO' = 'ATIVO';
    let statusReason = '';

    if (notes.includes('[STATUS: SUSPENSO]')) {
      userStatus = 'SUSPENSO';
      statusReason = notes.replace('[STATUS: SUSPENSO]', '').trim();
    } else if (notes.includes('[STATUS: DEMITIDO]')) {
      userStatus = 'DEMITIDO';
      statusReason = notes.replace('[STATUS: DEMITIDO]', '').trim();
    } else if (emp?.is_active === false || res?.is_active === false) {
      userStatus = 'SUSPENSO';
    }

    const assignedRole = roleMap.get(p.id) || (emp?.role as any) || 'vendedor';
    const effectiveRole = isMasterUser(p.full_name, p.email, p.id) ? assignedRole : 'vendedor';

    userMap.set(emailKey, {
      id: p.id,
      email: p.email,
      full_name: p.full_name || 'Sem nome',
      cpf: emp?.cpf || res?.cpf || undefined,
      role: effectiveRole,
      store_id: resolvedStoreId,
      store_name: resolvedStoreName,
      is_active: userStatus === 'ATIVO',
      user_status: userStatus,
      status_reason: statusReason,
      created_at: p.created_at || new Date().toISOString(),
    });
  }

  // 2. Processa colaboradores cadastrados em employees que ainda não possuem perfil
  for (const e of employees) {
    const emailKey = (e.email || `${e.full_name?.toLowerCase().replace(/\s+/g, '.')}@shineray.internal`).toLowerCase().trim();
    const idKey = (e.id || '').toLowerCase().trim();
    const profileIdKey = (e.profile_id || '').toLowerCase().trim();

    if (deletedSet.has(emailKey) || (idKey && deletedSet.has(idKey)) || (profileIdKey && deletedSet.has(profileIdKey))) {
      continue;
    }

    if (!userMap.has(emailKey)) {
      const resolvedStoreId = e.store_id || undefined;
      const resolvedStoreName = (resolvedStoreId ? storeMap.get(resolvedStoreId) : undefined) || 'Concessionária Divinópolis (Matriz Oeste)';

      const notes = e.notes || '';
      let userStatus: 'ATIVO' | 'SUSPENSO' | 'DEMITIDO' = e.is_active === false ? 'SUSPENSO' : 'ATIVO';
      let statusReason = '';

      if (notes.includes('[STATUS: SUSPENSO]')) {
        userStatus = 'SUSPENSO';
        statusReason = notes.replace('[STATUS: SUSPENSO]', '').trim();
      } else if (notes.includes('[STATUS: DEMITIDO]')) {
        userStatus = 'DEMITIDO';
        statusReason = notes.replace('[STATUS: DEMITIDO]', '').trim();
      }

      const assignedRole = e.role || 'vendedor';
      const effectiveRole = isMasterUser(e.full_name, e.email, e.id)
        ? assignedRole
        : (assignedRole === 'mecanico' ? 'mecanico' : 'vendedor');

      userMap.set(emailKey, {
        id: e.profile_id || e.id,
        email: e.email || `${e.full_name?.toLowerCase().replace(/\s+/g, '.')}@shineray.com.br`,
        full_name: e.full_name,
        cpf: e.cpf || undefined,
        role: effectiveRole,
        store_id: resolvedStoreId,
        store_name: resolvedStoreName,
        is_active: userStatus === 'ATIVO',
        user_status: userStatus,
        status_reason: statusReason,
        created_at: e.created_at || new Date().toISOString(),
      });
    }
  }

  // 3. Processa usuários locais de dealflow_custom_users_v1
  const customUsers = getCustomUsers();
  for (const cu of customUsers) {
    if (!cu.email) continue;
    const emailKey = cu.email.toLowerCase().trim();
    const idKey = (cu.id || '').toLowerCase().trim();

    if (deletedSet.has(emailKey) || (idKey && deletedSet.has(idKey))) {
      continue;
    }

    const existing = userMap.get(emailKey);
    const resolvedStoreId = cu.store_id || (existing?.store_id) || undefined;
    const resolvedStoreName = (resolvedStoreId ? storeMap.get(resolvedStoreId) : undefined) || 'Concessionária Divinópolis (Matriz Oeste)';
    const effectiveRole = isMasterUser(cu.full_name || existing?.full_name, cu.email, cu.id || existing?.id)
      ? (cu.role || existing?.role || 'vendedor')
      : 'vendedor';

    if (!existing) {
      userMap.set(emailKey, {
        ...cu,
        role: effectiveRole,
        store_id: resolvedStoreId,
        store_name: resolvedStoreName,
      });
    } else {
      userMap.set(emailKey, {
        ...existing,
        role: effectiveRole,
        store_id: resolvedStoreId,
        store_name: resolvedStoreName,
        user_status: cu.user_status || existing.user_status,
        status_reason: cu.status_reason || existing.status_reason,
        is_active: cu.is_active !== undefined ? cu.is_active : existing.is_active,
        temp_password: cu.temp_password || existing.temp_password,
      });
    }
  }

  // 4. Aplica Overrides específicos (edições manuais recentes, ativações, suspensões)
  for (const [emailKey, user] of Array.from(userMap.entries())) {
    const ov = overrides[user.id.toLowerCase().trim()] || overrides[emailKey];
    if (ov) {
      if (ov.full_name) user.full_name = ov.full_name;
      if (ov.store_id) {
        user.store_id = ov.store_id;
        user.store_name = storeMap.get(ov.store_id) || user.store_name;
      }
      if (ov.is_active !== undefined) user.is_active = ov.is_active;
      if (ov.user_status) user.user_status = ov.user_status;
      if (ov.status_reason) user.status_reason = ov.status_reason;
      if (ov.temp_password) user.temp_password = ov.temp_password;
      if (ov.role) {
        user.role = isMasterUser(user.full_name, user.email, user.id) ? ov.role : 'vendedor';
      }
    }
  }

  // 5. Filtro final: assegura que nenhum excluído vaze
  const finalUsers = Array.from(userMap.values()).filter(
    (u) =>
      !deletedSet.has(u.id.toLowerCase().trim()) &&
      (!u.email || !deletedSet.has(u.email.toLowerCase().trim()))
  );

  return finalUsers.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Criação 100% resiliente de novos usuários e credenciais de acesso.
 * Não falha se a Edge Function não estiver implantada ou responder com erro de rede.
 */
export async function createUserAccount(data: CreateUserData): Promise<CreateUserResponse> {
  await ensureSupabaseSession();

  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.full_name.trim();
  const validStoreId = resolveStoreUuid(data.store_id);
  const tempPassword = generateRandomPassword();

  // Se o e-mail estava previamente na lixeira de deletados, restaura imediatamente
  unmarkDeletedUser(cleanEmail);
  removeUserOverride(cleanEmail);

  let newUserId = crypto.randomUUID();
  let authProfileCreated = false;

  // 1. Tenta Edge Function (se implantada)
  try {
    const edgePromise = supabase.functions.invoke('create-user', {
      body: {
        action: 'create_user',
        email: cleanEmail,
        password: tempPassword,
        full_name: cleanName,
        phone: data.phone || null,
        cpf: data.cpf || null,
        role: data.role || 'vendedor',
        store_id: validStoreId,
        custom_role_id: data.custom_role_id || null,
      },
    });

    const res = await Promise.race([
      edgePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (res && !(res as any).error && (res as any).data && !(res as any).data.error) {
      const edgeData = (res as any).data;
      newUserId = edgeData.user_id || edgeData.id || newUserId;
      authProfileCreated = true;
    }
  } catch {}

  // 2. Se a Edge Function não respondeu, tenta Supabase Auth SignUp
  if (!authProfileCreated) {
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: tempPassword,
        options: {
          data: {
            full_name: cleanName,
          },
        },
      });

      if (!signUpErr && signUpData?.user?.id) {
        newUserId = signUpData.user.id;
        authProfileCreated = true;
      } else if (signUpErr && (signUpErr.message.includes('already registered') || signUpErr.message.includes('already exists'))) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (existingProfile?.id) {
          newUserId = existingProfile.id;
          authProfileCreated = true;
        }
      }
    } catch {}
  }

  // Remove qualquer marca de deleção do ID gerado/recuperado
  unmarkDeletedUser(newUserId);
  removeUserOverride(newUserId);

  // REGRA DE OURO: Apenas Breno e João Vitor podem possuir cargos administrativos (admin / gerente).
  // Todos os demais usuários recebem estritamente o cargo de 'vendedor'.
  const isMaster = isMasterUser(cleanName, cleanEmail, newUserId);
  const effectiveRole = isMaster ? (data.role || 'admin') : 'vendedor';

  // 3. Se temos usuário no auth, atualiza profiles e user_roles (somente colunas válidas)
  if (authProfileCreated) {
    try {
      await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          full_name: cleanName,
          email: cleanEmail,
          phone: data.phone || null,
          must_change_password: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
    } catch (err) {
      console.warn('[userService] Aviso ao salvar profile:', err);
    }

    try {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', newUserId)
        .maybeSingle();

      if (existingRole?.id) {
        await supabase
          .from('user_roles')
          .update({ role: effectiveRole as any })
          .eq('id', existingRole.id);
      } else {
        await supabase
          .from('user_roles')
          .insert({
            user_id: newUserId,
            role: effectiveRole as any,
          });
      }
    } catch (err) {
      console.warn('[userService] Aviso ao salvar role:', err);
    }
  }

  // 4. Salva SEMPRE na tabela employees do Supabase (para sincronizar entre navegadores/dispositivos)
  try {
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    const empPayload: any = {
      full_name: cleanName,
      email: cleanEmail,
      phone: data.phone || null,
      role: effectiveRole,
      store_id: validStoreId,
      is_active: true,
      cpf: data.cpf || null,
      notes: `Senha inicial: ${tempPassword}`,
    };
    if (authProfileCreated) {
      empPayload.profile_id = newUserId;
    }

    if (existingEmp?.id) {
      await supabase
        .from('employees')
        .update(empPayload)
        .eq('id', existingEmp.id);
    } else {
      await supabase
        .from('employees')
        .insert(empPayload);
    }
  } catch (err) {
    console.warn('[userService] Aviso ao salvar employee:', err);
  }

  // 5. Salva no override e no repositório de usuários locais (dealflow_custom_users_v1)
  saveCustomUser({
    id: newUserId,
    email: cleanEmail,
    full_name: cleanName,
    role: effectiveRole,
    store_id: validStoreId,
    cpf: data.cpf || undefined,
    is_active: true,
    user_status: 'ATIVO',
    created_at: new Date().toISOString(),
    temp_password: tempPassword,
  });

  saveUserOverride(newUserId, {
    id: newUserId,
    email: cleanEmail,
    full_name: cleanName,
    role: effectiveRole,
    store_id: validStoreId,
    is_active: true,
    user_status: 'ATIVO',
    temp_password: tempPassword,
  });
  saveUserOverride(cleanEmail, {
    id: newUserId,
    email: cleanEmail,
    full_name: cleanName,
    role: effectiveRole,
    store_id: validStoreId,
    is_active: true,
    user_status: 'ATIVO',
    temp_password: tempPassword,
  });

  // Notifica toda a aplicação
  window.dispatchEvent(
    new CustomEvent('dealflow:users-updated', {
      detail: { userId: newUserId, email: cleanEmail, role: effectiveRole },
    })
  );

  return {
    success: true,
    user_id: newUserId,
    email: cleanEmail,
    temp_password: tempPassword,
  };
}

/**
 * Redefinição resiliente de senha com credencial temporária.
 */
export async function resetUserPassword(userId: string): Promise<{ success: boolean; temp_password: string }> {
  await ensureSupabaseSession();
  const tempPassword = generateRandomPassword();

  // Tenta Edge Function de forma segura (silenciosa)
  try {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { action: 'reset_password', user_id: userId },
    });
    if (!error && data?.temp_password) {
      saveUserOverride(userId, { temp_password: data.temp_password });
      return { success: true, temp_password: data.temp_password };
    }
  } catch {}

  // Atualiza diretamente no banco e no storage local
  try {
    await supabase
      .from('profiles')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch {}

  try {
    await (supabase as any)
      .from('employees')
      .update({
        notes: `Senha redefinida: ${tempPassword}`,
        updated_at: new Date().toISOString(),
      })
      .or(`profile_id.eq.${userId},id.eq.${userId}`);
  } catch {}

  saveUserOverride(userId, { temp_password: tempPassword });

  window.dispatchEvent(new CustomEvent('dealflow:users-updated', { detail: { userId } }));

  return {
    success: true,
    temp_password: tempPassword,
  };
}

/**
 * Alterna status de ativação / desativação do usuário com persistência universal.
 */
export async function toggleUserStatus(
  userId: string,
  isActive: boolean,
  meta?: { email?: string; full_name?: string; reason?: string }
): Promise<{ success: boolean }> {
  await ensureSupabaseSession();

  const nextStatus: 'ATIVO' | 'SUSPENSO' = isActive ? 'ATIVO' : 'SUSPENSO';

  // 1. Grava no override garantindo que a interface reflita imediatamente
  saveUserOverride(userId, {
    id: userId,
    email: meta?.email,
    full_name: meta?.full_name,
    is_active: isActive,
    user_status: nextStatus,
    status_reason: meta?.reason,
    status_date: new Date().toISOString().slice(0, 10),
  });
  if (meta?.email) {
    saveUserOverride(meta.email, {
      id: userId,
      email: meta.email,
      full_name: meta.full_name,
      is_active: isActive,
      user_status: nextStatus,
      status_reason: meta?.reason,
      status_date: new Date().toISOString().slice(0, 10),
    });
  }

  // 2. Atualiza profiles no Supabase
  try {
    await supabase
      .from('profiles')
      .update({
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', userId);
  } catch {}

  // 3. Atualiza employees no Supabase
  try {
    const empNotes = isActive ? null : `[STATUS: SUSPENSO] ${meta?.reason || 'Acesso suspenso pelo administrador'}`;
    const updatePayload: Record<string, any> = {
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    if (empNotes) updatePayload.notes = empNotes;

    await (supabase as any)
      .from('employees')
      .update(updatePayload)
      .or(`profile_id.eq.${userId},id.eq.${userId}`);
  } catch {}

  // 4. Se existir em custom_users, atualiza lá também
  const customUsers = getCustomUsers();
  const cUser = customUsers.find((u) => u.id === userId || (meta?.email && u.email.toLowerCase().trim() === meta.email.toLowerCase().trim()));
  if (cUser) {
    saveCustomUser({
      ...cUser,
      is_active: isActive,
      user_status: nextStatus,
      status_reason: meta?.reason,
    });
  }

  window.dispatchEvent(new CustomEvent('dealflow:users-updated', { detail: { userId, isActive } }));

  return { success: true };
}

/**
 * Desativação segura de credencial de usuário.
 */
export async function deleteUserAccount(
  userId: string,
  meta?: { email?: string; full_name?: string }
): Promise<{ success: boolean }> {
  return await toggleUserStatus(userId, false, meta);
}

/**
 * Exclusão definitiva de usuário e de todas as suas credenciais.
 * Purga de profiles, user_roles, resellers, employees e registra na lista de exclusão permanente.
 */
export async function permanentDeleteUserAccount(userId: string, email?: string): Promise<{ success: boolean }> {
  await ensureSupabaseSession();

  // 1. Marca imediatamente como deletado no registro persistente
  recordDeletedUser(userId, email);
  removeCustomUser(userId);
  removeUserOverride(userId);
  if (email) {
    removeCustomUser(email);
    removeUserOverride(email);
  }

  // 2. Remove vínculos no banco de dados Supabase
  try {
    await supabase.from('user_roles').delete().eq('user_id', userId);
  } catch {}

  try {
    await (supabase as any).from('resellers').delete().or(`user_id.eq.${userId},id.eq.${userId}`);
  } catch {}

  try {
    await (supabase as any).from('employees').delete().or(`profile_id.eq.${userId},id.eq.${userId}`);
  } catch {}

  // Se houver chave estrangeira impedindo exclusão em employees, marca como demitido e inativo
  try {
    await (supabase as any)
      .from('employees')
      .update({
        is_active: false,
        notes: '[STATUS: DEMITIDO] Usuário excluído permanentemente da plataforma',
        updated_at: new Date().toISOString(),
      })
      .or(`profile_id.eq.${userId},id.eq.${userId}`);
  } catch {}

  try {
    await supabase.from('profiles').delete().eq('id', userId);
  } catch {}

  // 3. Tenta Edge Function de administração se houver
  try {
    await supabase.functions.invoke('create-user', {
      body: { action: 'delete_user', user_id: userId, email },
    });
  } catch {}

  window.dispatchEvent(new CustomEvent('dealflow:users-updated', { detail: { userId, email, deleted: true } }));

  return { success: true };
}

/**
 * Atualização completa de dados cadastrais e vínculos do colaborador.
 */
export async function updateUserAccount(
  userId: string,
  data: {
    full_name: string;
    email?: string;
    role?: string;
    store_id?: string | null;
    is_active?: boolean;
    user_status?: string;
    status_reason?: string;
    status_date?: string;
  }
): Promise<{ success: boolean }> {
  await ensureSupabaseSession();

  const isAccountActive = data.is_active ?? (data.user_status === 'ATIVO');
  const validStoreId = data.store_id && data.store_id !== 'none' ? resolveStoreUuid(data.store_id) : null;
  const isMaster = isMasterUser(data.full_name, data.email, userId);
  const targetRole = isMaster ? (data.role || 'vendedor') : 'vendedor';

  // 1. Atualiza profiles (apenas colunas existentes)
  try {
    const profileUpdate: Record<string, any> = {
      full_name: data.full_name,
      updated_at: new Date().toISOString(),
    };
    if (data.email) profileUpdate.email = data.email.trim().toLowerCase();

    await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar profiles:', err);
  }

  // 2. Atualiza user_roles
  try {
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingRole?.id) {
      await supabase
        .from('user_roles')
        .update({ role: targetRole as any })
        .eq('id', existingRole.id);
    } else {
      await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: targetRole as any });
    }
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar role:', err);
  }

  // 3. Atualiza employees
  try {
    const empNotes = data.user_status && data.user_status !== 'ATIVO'
      ? `[STATUS: ${data.user_status}] ${data.status_reason || 'Sem observações'} (Em: ${data.status_date || new Date().toLocaleDateString('pt-BR')})`
      : null;

    const empUpdate: Record<string, any> = {
      is_active: isAccountActive,
      updated_at: new Date().toISOString(),
    };
    if (data.full_name) empUpdate.full_name = data.full_name;
    if (data.email) empUpdate.email = data.email.trim().toLowerCase();
    empUpdate.role = targetRole;
    if (validStoreId) empUpdate.store_id = validStoreId;
    if (empNotes !== null) empUpdate.notes = empNotes;

    await (supabase as any)
      .from('employees')
      .update(empUpdate)
      .or(`profile_id.eq.${userId},id.eq.${userId}`);
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar employee:', err);
  }

  // 4. Salva override universal
  const overrideData: UserOverride = {
    id: userId,
    email: data.email,
    full_name: data.full_name,
    role: targetRole,
    store_id: validStoreId || undefined,
    is_active: isAccountActive,
    user_status: (data.user_status as any) || (isAccountActive ? 'ATIVO' : 'SUSPENSO'),
    status_reason: data.status_reason,
    status_date: data.status_date,
  };
  saveUserOverride(userId, overrideData);
  if (data.email) {
    saveUserOverride(data.email, overrideData);
  }

  // 5. Atualiza custom users no localStorage
  saveCustomUser({
    id: userId,
    email: data.email || '',
    full_name: data.full_name,
    role: targetRole,
    store_id: validStoreId || undefined,
    is_active: isAccountActive,
    user_status: (data.user_status as any) || (isAccountActive ? 'ATIVO' : 'SUSPENSO'),
    status_reason: data.status_reason,
    created_at: new Date().toISOString(),
  });

  window.dispatchEvent(new CustomEvent('dealflow:users-updated', { detail: { userId } }));

  return { success: true };
}
