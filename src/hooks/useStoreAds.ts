import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/audit';

export type AdPlatform = 'instagram' | 'facebook' | 'ambos';
export type AdStatus = 'ativo' | 'pausado' | 'encerrado';

export interface StoreAd {
  id: string;
  store_id: string;
  campaign_name: string;
  title: string;
  platform: AdPlatform;
  image_url: string | null;
  caption: string | null;
  ad_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  budget_spent: number;
  status: AdStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const AD_BUCKET = 'ad-creatives';

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
};

export const AD_PLATFORM_LABEL: Record<AdPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  ambos: 'Instagram + Facebook',
};

export function useStoreAds(storeId?: string | null) {
  return useQuery({
    queryKey: ['store-ads', storeId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('store_ads').select('*').order('created_at', { ascending: false });
      if (storeId) q = q.eq('store_id', storeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as StoreAd[];
    },
  });
}

/** URL assinada (1h) para a foto guardada no armazenamento privado. */
export function useAdImageUrl(path?: string | null) {
  return useQuery({
    queryKey: ['ad-image', path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      const { data, error } = await supabase.storage.from(AD_BUCKET).createSignedUrl(path, 3600);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

export async function uploadAdImage(storeId: string, file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(AD_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export interface StoreAdInput {
  store_id: string;
  campaign_name: string;
  title: string;
  platform: AdPlatform;
  image_url?: string | null;
  caption?: string | null;
  ad_url?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  budget_spent?: number;
  status?: AdStatus;
  notes?: string | null;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['store-ads'] });
}

export function useCreateStoreAd() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: StoreAdInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('store_ads')
        .insert({ ...input, created_by: userData.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      logActivity('criar', 'anuncio', data.id, { titulo: input.title, campanha: input.campaign_name });
      return data as StoreAd;
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: 'Anúncio cadastrado' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar o anúncio.' }),
  });
}

export function useUpdateStoreAd() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<StoreAdInput> & { id: string }) => {
      const { error } = await supabase.from('store_ads').update(input).eq('id', id);
      if (error) throw error;
      logActivity('editar', 'anuncio', id, input as Record<string, unknown>);
    },
    onSuccess: () => {
      invalidate(qc);
      toast({ title: 'Anúncio atualizado' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o anúncio.' }),
  });
}

export function useDeleteStoreAd() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (ad: StoreAd) => {
      const { error } = await supabase.from('store_ads').delete().eq('id', ad.id);
      if (error) throw error;
      if (ad.image_url && !/^https?:\/\//i.test(ad.image_url)) {
        await supabase.storage.from(AD_BUCKET).remove([ad.image_url]);
      }
      logActivity('excluir', 'anuncio', ad.id, { titulo: ad.title });
    },
    onSuccess: () => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Anúncio excluído' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o anúncio.' }),
  });
}

/** Vendas ligadas a anúncios/campanhas (para relatórios). */
export interface AdSaleRow {
  id: string;
  store_id: string;
  ad_id: string | null;
  campaign_name: string | null;
  lead_source: string | null;
  sale_price: number;
  status: string;
  created_at: string;
}

export function useAdSales() {
  return useQuery({
    queryKey: ['ad-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, store_id, ad_id, campaign_name, lead_source, sale_price, status, created_at')
        .neq('status', 'cancelado')
        .or('ad_id.not.is.null,campaign_name.not.is.null,lead_source.like.ANUNCIO_%');
      if (error) throw error;
      return (data || []) as AdSaleRow[];
    },
  });
}
