import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

export interface Store {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  instagram_handle: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_DEALERSHIP_STORES: Store[] = [
  {
    id: 'store-divinopolis',
    name: 'Concessionária Divinópolis (Matriz Oeste)',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
    phone: '(37) 3222-1000',
    email: 'divinopolis@pixelmotors.com.br',
    instagram_handle: '@concessionaria.divinopolis',
    manager_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'store-montesclaros',
    name: 'Concessionária Montes Claros (Polo Norte)',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
    phone: '(38) 3221-2000',
    email: 'montesclaros@pixelmotors.com.br',
    instagram_handle: '@concessionaria.moc',
    manager_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      
      if (error) {
        console.warn('Erro ao consultar stores no Supabase, usando lojas padrão:', error);
        return DEFAULT_DEALERSHIP_STORES;
      }
      if (!data || data.length === 0) {
        return DEFAULT_DEALERSHIP_STORES;
      }
      return data as Store[];
    },
  });
}

export function useStoreStats() {
  return useQuery({
    queryKey: ['store-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('is_active');
      
      if (error) throw error;
      
      const total = data.length;
      const active = data.filter(s => s.is_active).length;
      
      return { total, active };
    },
  });
}
