import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DataScope } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';

export type RoleOperationalStatus =
  | 'ativo'
  | 'pausa_administrativa'
  | 'demitido'
  | 'suspenso'
  | 'afastado';

export type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  data_scope: DataScope;
  system_key: string | null;
  base_role: string;
  is_active: boolean;
  operational_status: RoleOperationalStatus;
  permissions: string[];
  user_count: number;
};

const db = supabase as any;

function parseRoleStatus(desc: string | null, isActive: boolean): { status: RoleOperationalStatus; cleanDesc: string } {
  if (!desc) return { status: isActive ? 'ativo' : 'demitido', cleanDesc: '' };
  const match = desc.match(/^\[STATUS:(ativo|pausa_administrativa|demitido|suspenso|afastado)\]\s*(.*)$/i);
  if (match) {
    return {
      status: match[1].toLowerCase() as RoleOperationalStatus,
      cleanDesc: match[2] || '',
    };
  }
  return { status: isActive ? 'ativo' : 'demitido', cleanDesc: desc };
}

export function useCustomRoles() {
  return useQuery({
    queryKey: ['custom-roles'],
    queryFn: async (): Promise<CustomRole[]> => {
      const [{ data: roles, error }, { data: perms }, { data: links }] = await Promise.all([
        db.from('custom_roles').select('*').order('created_at'),
        db.from('role_permissions').select('role_id, permission'),
        db.from('user_roles').select('custom_role_id'),
      ]);
      if (error) throw error;
      return (roles ?? []).map((r: any) => {
        const { status, cleanDesc } = parseRoleStatus(r.description, r.is_active);
        return {
          ...r,
          description: cleanDesc,
          operational_status: status,
          permissions: (perms ?? []).filter((p: any) => p.role_id === r.id).map((p: any) => p.permission),
          user_count: (links ?? []).filter((l: any) => l.custom_role_id === r.id).length,
        };
      });
    },
  });
}

export type RoleInput = {
  id?: string;
  name: string;
  description: string;
  color: string;
  data_scope: DataScope;
  base_role: string;
  is_active: boolean;
  operational_status?: RoleOperationalStatus;
  permissions: string[];
};

export function useSaveCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RoleInput) => {
      const opStatus = input.operational_status || (input.is_active ? 'ativo' : 'demitido');
      const encodedDesc = opStatus !== 'ativo'
        ? `[STATUS:${opStatus}] ${input.description.trim()}`
        : input.description.trim();

      const row = {
        name: input.name.trim(),
        description: encodedDesc || null,
        color: input.color,
        data_scope: input.data_scope,
        base_role: input.base_role,
        is_active: opStatus === 'ativo',
      };
      let id = input.id;
      if (id) {
        const { error } = await db.from('custom_roles').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from('custom_roles').insert(row).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      const { error: delErr } = await db.from('role_permissions').delete().eq('role_id', id);
      if (delErr) throw delErr;
      if (input.permissions.length) {
        const { error: insErr } = await db
          .from('role_permissions')
          .insert(input.permissions.map((permission) => ({ role_id: id, permission })));
        if (insErr) throw insErr;
      }
      await logActivity(input.id ? 'editar' : 'criar', 'cargo', id!, { name: row.name, permissions: input.permissions, scope: row.data_scope });
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-roles'] }),
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (role: CustomRole) => {
      if (role.user_count > 0) throw new Error('Cargo com usuários vinculados — desative em vez de excluir.');
      if (role.system_key) throw new Error('Cargos padrão não podem ser excluídos, apenas desativados.');
      const { error } = await db.from('custom_roles').delete().eq('id', role.id);
      if (error) throw error;
      await logActivity('excluir', 'cargo', role.id, { name: role.name });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-roles'] }),
  });
}
