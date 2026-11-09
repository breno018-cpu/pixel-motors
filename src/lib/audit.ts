import { supabase } from '@/integrations/supabase/client';

export type AuditAction =
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'transferir'
  | 'exportar'
  | 'status'
  | 'login';

export type AuditEntity =
  | 'veiculo'
  | 'venda'
  | 'contrato'
  | 'loja'
  | 'revendedor'
  | 'funcionario'
  | 'reserva'
  | 'transferencia'
  | 'folha'
  | 'anuncio'
  | 'cargo'
  | 'sistema';

/**
 * Registra uma ação no histórico imutável (activity_logs).
 * Nunca lança erro: falha de auditoria não pode quebrar a operação do usuário.
 */
export async function logActivity(
  action: AuditAction,
  entityType: AuditEntity,
  entityId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({
      user_id: auth.user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      details: (details ?? {}) as never,
    });
  } catch {
    /* silencioso */
  }
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  criar: 'Cadastro',
  editar: 'Edição',
  excluir: 'Exclusão',
  transferir: 'Transferência',
  exportar: 'Exportação',
  status: 'Mudança de status',
  login: 'Acesso',
};

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  veiculo: 'Veículo',
  venda: 'Venda',
  contrato: 'Contrato',
  loja: 'Loja',
  revendedor: 'Revendedor',
  funcionario: 'Funcionário',
  reserva: 'Reserva',
  transferencia: 'Transferência',
  folha: 'Folha de pagamento',
  anuncio: 'Anúncio',
  sistema: 'Sistema',
};
