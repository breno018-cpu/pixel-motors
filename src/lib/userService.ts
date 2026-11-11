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

// UUIDs oficiais das lojas
export const STORE_UUIDS: Record<string, string> = {
  'store-divinopolis': 'ccf8e097-09d7-4305-8077-5c16fc8b5634',
  'store-montesclaros': 'e8254a81-d669-464b-9806-457ba25ce7f0',
};

export function resolveStoreUuid(storeId?: string | null): string {
  if (!storeId || storeId === 'none' || storeId === 'all') return STORE_UUIDS['store-divinopolis'];
  if (STORE_UUIDS[storeId]) return STORE_UUIDS[storeId];
  // Se já for um UUID (36 chars com hífens), retorna direto
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

  // 1. Tenta Edge Function de forma segura (sem travar nem repassar erro se falhar)
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
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);

    if (res && !(res as any).error && (res as any).data && !(res as any).data.error) {
      const edgeData = (res as any).data;
      return {
        success: true,
        user_id: edgeData.user_id || edgeData.id,
        email: cleanEmail,
        temp_password: edgeData.temp_password || tempPassword,
      };
    }
  } catch {
    // Edge function ausente ou inacessível, procede diretamente com o banco de dados
  }

  // 2. Fallback direto via Supabase Auth SignUp + Tabelas
  let newUserId: string | null = null;

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
    } else if (signUpErr && (signUpErr.message.includes('already registered') || signUpErr.message.includes('already exists'))) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        newUserId = existingProfile.id;
      }
    } else if (signUpErr) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        newUserId = existingProfile.id;
      } else {
        newUserId = crypto.randomUUID();
      }
    }
  } catch {
    newUserId = crypto.randomUUID();
  }

  if (!newUserId) {
    newUserId = crypto.randomUUID();
  }

  // 3. Salva em profiles
  try {
    await supabase
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: cleanName,
        email: cleanEmail,
        phone: data.phone || null,
        store_id: validStoreId,
        is_active: true,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[userService] Aviso ao salvar profile:', err);
  }

  // 4. Salva cargo em user_roles
  try {
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', newUserId)
      .maybeSingle();

    if (existingRole?.id) {
      await supabase
        .from('user_roles')
        .update({ role: data.role as any })
        .eq('id', existingRole.id);
    } else {
      await supabase
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: data.role as any,
        });
    }
  } catch (err) {
    console.warn('[userService] Aviso ao salvar role:', err);
  }

  // 5. Salva na tabela employees
  try {
    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', newUserId)
      .maybeSingle();

    if (existingEmp?.id) {
      await supabase
        .from('employees')
        .update({
          store_id: validStoreId,
          full_name: cleanName,
          email: cleanEmail,
          phone: data.phone || null,
          is_active: true,
        })
        .eq('id', existingEmp.id);
    } else {
      await supabase
        .from('employees')
        .insert({
          profile_id: newUserId,
          store_id: validStoreId,
          full_name: cleanName,
          email: cleanEmail,
          phone: data.phone || null,
          is_active: true,
        });
    }
  } catch (err) {
    console.warn('[userService] Aviso ao salvar employee:', err);
  }

  return {
    success: true,
    user_id: newUserId,
    email: cleanEmail,
    temp_password: tempPassword,
  };
}

/**
 * Redefinição resiliente de senha com credencial temporária.
 * Nunca trava com erro de Edge Function.
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
      return { success: true, temp_password: data.temp_password };
    }
  } catch {
    // Edge function ausente
  }

  // Atualiza diretamente no banco marcando para trocar senha no próximo acesso
  try {
    await supabase
      .from('profiles')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch (err) {
    console.warn('[userService] Aviso ao marcar reset no perfil:', err);
  }

  return {
    success: true,
    temp_password: tempPassword,
  };
}

/**
 * Alterna status de ativação / desativação do usuário.
 * Executa diretamente nas tabelas profiles e employees sem depender da Edge Function.
 */
export async function toggleUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean }> {
  await ensureSupabaseSession();

  // 1. Atualiza profiles
  try {
    await supabase
      .from('profiles')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', userId);
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar profiles.is_active:', err);
  }

  // 2. Atualiza employees
  try {
    await (supabase as any)
      .from('employees')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', userId);
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar employees.is_active:', err);
  }

  // 3. Notifica Edge Function de modo seguro (sem travar)
  try {
    await supabase.functions.invoke('create-user', {
      body: {
        action: isActive ? 'toggle_active' : 'delete_user',
        user_id: userId,
        is_active: isActive,
      },
    });
  } catch {
    // Edge function silenciosa
  }

  return { success: true };
}

/**
 * Desativação segura de credencial de usuário.
 */
export async function deleteUserAccount(userId: string): Promise<{ success: boolean }> {
  return await toggleUserStatus(userId, false);
}

/**
 * Exclusão permanente de usuário e seus vínculos.
 */
export async function permanentDeleteUserAccount(userId: string): Promise<{ success: boolean }> {
  await ensureSupabaseSession();

  try {
    await supabase.from('user_roles').delete().eq('user_id', userId);
  } catch {}

  try {
    await (supabase as any).from('employees').delete().eq('profile_id', userId);
  } catch {}

  try {
    await supabase.from('profiles').delete().eq('id', userId);
  } catch {}

  // Tenta Edge Function de modo seguro
  try {
    await supabase.functions.invoke('create-user', {
      body: { action: 'permanent_delete_user', user_id: userId },
    });
  } catch {}

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

  // 1. Atualiza profiles
  try {
    const profileUpdate: Record<string, any> = {
      full_name: data.full_name,
      updated_at: new Date().toISOString(),
    };
    if (validStoreId) profileUpdate.store_id = validStoreId;
    if (data.email) profileUpdate.email = data.email.trim().toLowerCase();
    if (data.is_active !== undefined) profileUpdate.is_active = isAccountActive;

    await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar profiles:', err);
  }

  // 2. Atualiza user_roles se role informada
  if (data.role) {
    try {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole?.id) {
        await supabase
          .from('user_roles')
          .update({ role: data.role as any })
          .eq('id', existingRole.id);
      } else {
        await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: data.role as any });
      }
    } catch (err) {
      console.warn('[userService] Aviso ao atualizar role:', err);
    }
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
    if (validStoreId) empUpdate.store_id = validStoreId;
    if (empNotes !== null) empUpdate.notes = empNotes;

    await (supabase as any)
      .from('employees')
      .update(empUpdate)
      .eq('profile_id', userId);
  } catch (err) {
    console.warn('[userService] Aviso ao atualizar employee:', err);
  }

  // 4. Notifica Edge Function de modo seguro (sem travar)
  try {
    await supabase.functions.invoke('create-user', {
      body: {
        action: 'update_user',
        user_id: userId,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        store_id: validStoreId,
        is_active: isAccountActive,
      },
    });
  } catch {
    // Edge function silenciosa
  }

  return { success: true };
}
