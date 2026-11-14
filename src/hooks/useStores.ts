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

export const STORE_DIVINOPOLIS_UUID = 'ccf8e097-09d7-4305-8077-5c16fc8b5634';
export const STORE_MONTESCLAROS_UUID = 'e8254a81-d669-464b-9806-457ba25ce7f0';

export const STORES_LOCAL_CACHE_KEY = 'dealflow_custom_stores_v1';

export const DEFAULT_DEALERSHIP_STORES: Store[] = [
  {
    id: STORE_DIVINOPOLIS_UUID,
    name: 'Concessionária Divinópolis',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
    phone: '(37) 3222-1000',
    email: 'divinopolis@pixelmotors.com.br',
    instagram_handle: '@concessionaria.divinopolis',
    manager_id: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: STORE_MONTESCLAROS_UUID,
    name: 'Concessionária Montes Claros',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
    phone: '(38) 3221-2000',
    email: 'montesclaros@pixelmotors.com.br',
    instagram_handle: '@concessionaria.moc',
    manager_id: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
];

export function getCustomStoresCache(): Store[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORES_LOCAL_CACHE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoreToCache(storeUpdate: Partial<Store> & { id: string }) {
  try {
    if (typeof window === 'undefined') return;
    const list = getCustomStoresCache();
    const isMoc =
      storeUpdate.id === STORE_MONTESCLAROS_UUID ||
      storeUpdate.id === 'store-montesclaros' ||
      (storeUpdate.city && storeUpdate.city.toLowerCase().includes('montes'));
    const isDiv =
      storeUpdate.id === STORE_DIVINOPOLIS_UUID ||
      storeUpdate.id === 'store-divinopolis' ||
      (storeUpdate.city && storeUpdate.city.toLowerCase().includes('divin'));

    let found = false;
    const updated = list.map((s) => {
      const matchExact = s.id === storeUpdate.id;
      const matchMoc = isMoc && (s.id === STORE_MONTESCLAROS_UUID || s.id === 'store-montesclaros');
      const matchDiv = isDiv && (s.id === STORE_DIVINOPOLIS_UUID || s.id === 'store-divinopolis');

      if (matchExact || matchMoc || matchDiv) {
        found = true;
        return { ...s, ...storeUpdate, updated_at: new Date().toISOString() };
      }
      return s;
    });

    if (!found) {
      updated.push({
        id: storeUpdate.id,
        name: storeUpdate.name || 'Nova Concessionária',
        cnpj: storeUpdate.cnpj || null,
        address: storeUpdate.address || null,
        city: storeUpdate.city || null,
        state: storeUpdate.state || 'MG',
        phone: storeUpdate.phone || null,
        email: storeUpdate.email || null,
        instagram_handle: storeUpdate.instagram_handle || null,
        manager_id: storeUpdate.manager_id || null,
        is_active: storeUpdate.is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...storeUpdate,
      } as Store);
    }

    localStorage.setItem(STORES_LOCAL_CACHE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Erro ao salvar loja no cache local:', err);
  }
}

export function deleteStoreFromCache(id: string) {
  try {
    if (typeof window === 'undefined') return;
    const list = getCustomStoresCache();
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem(STORES_LOCAL_CACHE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Erro ao remover loja do cache local:', err);
  }
}

export function deduplicateStores(storesList: Store[]): Store[] {
  const result: Store[] = [];
  const seenKeys = new Set<string>();

  for (const store of storesList) {
    if (!store || !store.id) continue;
    let key = store.id.toLowerCase();
    if (key === STORE_DIVINOPOLIS_UUID || key === 'store-divinopolis') {
      key = 'canonical-divinopolis';
    } else if (key === STORE_MONTESCLAROS_UUID || key === 'store-montesclaros') {
      key = 'canonical-montesclaros';
    } else if (store.cnpj && store.cnpj.trim().length >= 11) {
      key = `cnpj-${store.cnpj.replace(/\D/g, '')}`;
    }

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(store);
    }
  }

  return result;
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      await ensureSupabaseSession();
      let rawData: Store[] = [];
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .order('name');
        if (!error && data && data.length > 0) {
          rawData = data as Store[];
        }
      } catch (err) {
        console.warn('Falha na consulta remota de stores:', err);
      }

      // Mescla com cache local e padrões
      const localCustom = getCustomStoresCache();
      let baseList = rawData.length > 0 ? [...rawData] : [...DEFAULT_DEALERSHIP_STORES];

      // Se houver lojas salvas ou renomeadas localmente pelo usuário, aplica os dados prioritários
      if (localCustom.length > 0) {
        const localMap = new Map<string, Store>();
        for (const loc of localCustom) {
          localMap.set(loc.id, loc);
          if (loc.id === STORE_DIVINOPOLIS_UUID || loc.id === 'store-divinopolis') {
            localMap.set('store-divinopolis', loc);
            localMap.set(STORE_DIVINOPOLIS_UUID, loc);
          }
          if (loc.id === STORE_MONTESCLAROS_UUID || loc.id === 'store-montesclaros') {
            localMap.set('store-montesclaros', loc);
            localMap.set(STORE_MONTESCLAROS_UUID, loc);
          }
        }

        baseList = baseList.map((item) => {
          const custom = localMap.get(item.id);
          return custom ? { ...item, ...custom } : item;
        });

        // Adiciona lojas criadas localmente que ainda não constam na lista
        for (const loc of localCustom) {
          const exists = baseList.some(
            (b) =>
              b.id === loc.id ||
              (loc.cnpj && b.cnpj && loc.cnpj.replace(/\D/g, '') === b.cnpj.replace(/\D/g, '')) ||
              (b.name.trim().toLowerCase() === loc.name.trim().toLowerCase())
          );
          if (!exists) {
            baseList.push(loc);
          }
        }
      }

      const deduplicated = deduplicateStores(baseList);
      return deduplicated;
    },
  });
}

export function useStoreStats() {
  const { data: stores = [] } = useStores();
  return useQuery({
    queryKey: ['store-stats', stores.length],
    queryFn: async () => {
      const total = stores.length;
      const active = stores.filter((s) => s.is_active).length;
      return { total, active };
    },
  });
}
