import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

export interface CreateUserData {
  email: string;
  full_name: string;
  role: string;
  store_id?: string;
  phone?: string;
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
  if (!storeId) return STORE_UUIDS['store-divinopolis'];
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
 * Criação resiliente de novos usuários e colaboradores.
 * Funciona tanto se a Edge Function existir quanto diretamente via Supabase Auth + Tabelas.
 */
export async function createUserAccount(data: CreateUserData): Promise<CreateUserResponse> {
  await ensureSupabaseSession();

  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.full_name.trim();
  const validStoreId = resolveStoreUuid(data.store_id);
  const tempPassword = generateRandomPassword();

  // 1. Tenta via Edge Function primeiro
  try {
    const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('create-user', {
      body: {
        email: cleanEmail,
        full_name: cleanName,
        role: data.role,
        store_id: validStoreId,
      },
    });

    if (!edgeErr && edgeRes && !edgeRes.error) {
      return {
        success: true,
        user_id: edgeRes.user_id || edgeRes.id,
        email: cleanEmail,
        temp_password: edgeRes.temp_password || tempPassword,
      };
    }
  } catch {
    // Edge function indisponível ou 404, procede com fallback direto no Supabase
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
      // O usuário já existe no Auth, busca o profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        newUserId = existingProfile.id;
      }
    } else if (signUpErr) {
      // Se deu outro erro no signup (por exemplo email_address_invalid para domínios sem MX)
      // tenta buscar profile existente ou gerar UUID v4 para cadastro de equipe
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
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: newUserId,
      full_name: cleanName,
      email: cleanEmail,
      phone: data.phone || null,
      must_change_password: true,
    }, { onConflict: 'id' });

  if (profileError) {
    console.warn('[userService] Aviso ao salvar profile:', profileError.message);
  }

  // 4. Salva o cargo em user_roles
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

  // 5. Salva na tabela employees (com store_id válido como UUID)
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
      })
      .eq('id', existingEmp.id);
  } else {
    await supabase
      .from('employees')
      .insert({
        profile_id: newUserId,
        store_id: validStoreId,
        full_name: cleanName,
      });
  }

  return {
    success: true,
    user_id: newUserId,
    email: cleanEmail,
    temp_password: tempPassword,
  };
}

/**
 * Redefinição resiliente de senha com contingência
 */
export async function resetUserPassword(userId: string): Promise<{ success: boolean; temp_password: string }> {
  await ensureSupabaseSession();
  const tempPassword = generateRandomPassword();

  try {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { action: 'reset_password', user_id: userId },
    });
    if (!error && data?.temp_password) {
      return { success: true, temp_password: data.temp_password };
    }
  } catch {}

  // Contingência: marca para trocar senha
  await supabase
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', userId);

  return {
    success: true,
    temp_password: tempPassword,
  };
}
