import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ContractTemplateType = 'venda_carro' | 'venda_moto' | 'repasse' | 'generico' | 'reserva';

export type ClauseVariableType = 'text' | 'number' | 'currency' | 'date';

export interface ClauseVariable {
  key: string;              // ex: VALOR_EMPLACAMENTO
  label: string;            // ex: Valor do emplacamento
  type: ClauseVariableType;
  required?: boolean;
  default?: string;         // valor default (string; formatado por type ao renderizar)
}

export type ClauseConditionField = 'payment_method' | 'vehicle_type' | 'has_plate' | 'has_financing';
export type ClauseConditionOp = 'eq' | 'neq' | 'in';

export interface ClauseCondition {
  field: ClauseConditionField;
  op: ClauseConditionOp;
  value: string | string[] | boolean;
}

export interface OptionalClause {
  id: string;
  label: string;
  body_bbcode: string;
  enabled_by_default: boolean;
  vehicle_types: Array<'carro' | 'moto'>;
  category?: string;
  variables?: ClauseVariable[];
  condition?: ClauseCondition | null;
}

export interface ContractTemplate {
  id: string;
  name: string;
  template_type: ContractTemplateType;
  is_active: boolean;
  version: number;
  header_content: string | null;
  body_content: string;
  clauses_content: string | null;
  signature_content: string | null;
  fixed_clauses: string[];
  optional_clauses: OptionalClause[];
  vehicle_types: Array<'carro' | 'moto'>;
  clause_categories?: string[];
  store_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  logo_url?: string | null;
  watermark_url?: string | null;
  signature_url?: string | null;
  watermark_opacity?: number | null;
}

export interface CreateTemplateData {
  name: string;
  template_type: ContractTemplateType;
  is_active?: boolean;
  header_content?: string;
  body_content: string;
  clauses_content?: string;
  signature_content?: string;
  fixed_clauses?: string[];
  optional_clauses?: OptionalClause[];
  vehicle_types?: Array<'carro' | 'moto'>;
  store_id?: string;
  logo_url?: string | null;
  watermark_url?: string | null;
  signature_url?: string | null;
  watermark_opacity?: number | null;
}

export function useContractTemplates() {
  return useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return (data as unknown) as ContractTemplate[];
    },
  });
}

export function useActiveTemplates() {
  return useQuery({
    queryKey: ['contract-templates', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data as unknown) as ContractTemplate[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: template, error } = await supabase
        .from('contract_templates')
        .insert({
          ...data,
          created_by: user.user?.id,
          updated_by: user.user?.id,
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      toast({
        title: 'Modelo criado',
        description: 'O modelo de contrato foi criado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar modelo',
        description: error.message || 'Ocorreu um erro ao criar o modelo.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ContractTemplate> & { id: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: template, error } = await supabase
        .from('contract_templates')
        .update({
          ...data,
          updated_by: user.user?.id,
          version: data.version ? data.version + 1 : undefined,
        } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      toast({
        title: 'Modelo atualizado',
        description: 'O modelo de contrato foi atualizado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar modelo',
        description: error.message || 'Ocorreu um erro ao atualizar o modelo.',
        variant: 'destructive',
      });
    },
  });
}

export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: ContractTemplate) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: newTemplate, error } = await supabase
        .from('contract_templates')
        .insert({
          name: `${template.name} (Cópia)`,
          template_type: template.template_type,
          is_active: false,
          header_content: template.header_content,
          body_content: template.body_content,
          clauses_content: template.clauses_content,
          signature_content: template.signature_content,
          fixed_clauses: template.fixed_clauses,
          store_id: template.store_id,
          created_by: user.user?.id,
          updated_by: user.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      toast({
        title: 'Modelo duplicado',
        description: 'Uma cópia do modelo foi criada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao duplicar modelo',
        description: error.message || 'Ocorreu um erro ao duplicar o modelo.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      toast({
        title: 'Modelo excluído',
        description: 'O modelo de contrato foi excluído com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir modelo',
        description: error.message || 'Ocorreu um erro ao excluir o modelo.',
        variant: 'destructive',
      });
    },
  });
}
