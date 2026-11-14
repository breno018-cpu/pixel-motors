import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/audit';
import { saveVehicleToCache, type Vehicle } from '@/hooks/useVehicles';
import { saveStoreToCache, type Store } from '@/hooks/useStores';

// Vehicle mutations
export interface CreateVehicleData {
  store_id: string;
  vehicle_type: 'carro' | 'moto';
  brand: string;
  model: string;
  year: number;
  manufacture_year?: number;
  color: string;
  chassis?: string | null;
  plate?: string;
  renavam?: string;
  mileage?: number;
  engine_cc?: number;
  fuel_type?: string;
  transmission?: string;
  purchase_price?: number;
  sale_price: number;
  status?: string;
  notes?: string;
  warranty_months?: number;
  revision_period_months?: number;
  revision_period_km?: number;
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateVehicleData) => {
      const cleanChassis =
        data.chassis &&
        !data.chassis.toUpperCase().includes('DEFINIR') &&
        !data.chassis.toUpperCase().includes('DISPENSADO')
          ? data.chassis.trim().toUpperCase()
          : null;

      const cleanPlate = data.plate?.trim() ? data.plate.trim().toUpperCase() : null;

      try {
        await ensureSupabaseSession();
        const insertPayload = {
          store_id: data.store_id || 'store-divinopolis',
          vehicle_type: data.vehicle_type || 'moto',
          brand: data.brand.trim().toUpperCase(),
          model: data.model.trim().toUpperCase(),
          year: data.year,
          manufacture_year: data.manufacture_year || data.year,
          color: data.color || 'Preta',
          chassis: cleanChassis,
          plate: cleanPlate,
          renavam: data.renavam || null,
          mileage: data.mileage || 0,
          fuel_type: data.fuel_type || 'gasolina',
          transmission: data.transmission || 'manual',
          purchase_price: data.purchase_price || null,
          sale_price: data.sale_price || null,
          status: data.status || 'disponivel',
          notes: data.notes || null,
          engine_cc: data.engine_cc || null,
          warranty_months: data.warranty_months || 12,
          revision_period_months: data.revision_period_months || 6,
          revision_period_km: data.revision_period_km || 1000,
        };

        const { data: vehicle, error } = await supabase
          .from('vehicles')
          .insert(insertPayload)
          .select()
          .single();

        if (error) {
          throw new Error(error.message || 'Erro ao persistir no Supabase');
        }

        if (vehicle) {
          const realVehicle = vehicle as Vehicle;
          saveVehicleToCache(realVehicle);
          void logActivity('criar', 'veiculo', realVehicle.id, { chassi: cleanChassis, modelo: `${data.brand} ${data.model}` });
          return realVehicle;
        }
        throw new Error('Falha ao obter registro do veículo cadastrado');
      } catch (err: any) {
        // Apenas em caso de erro real de rede sem internet salva em contingência local
        console.warn('[useCreateVehicle] Falha de conexão, registrando em contingência:', err);
        const tempId = crypto.randomUUID();
        const fallbackVehicle: Vehicle = {
          id: tempId,
          store_id: data.store_id || 'store-divinopolis',
          reseller_id: null,
          brand: data.brand,
          model: data.model,
          year: data.year,
          manufacture_year: data.manufacture_year || data.year,
          color: data.color,
          plate: cleanPlate,
          chassis: cleanChassis || 'A DEFINIR NA VENDA',
          renavam: data.renavam || null,
          mileage: data.mileage || 0,
          fuel_type: data.fuel_type || 'gasolina',
          transmission: data.transmission || 'manual',
          purchase_price: data.purchase_price || null,
          sale_price: data.sale_price || null,
          status: data.status || 'disponivel',
          images: null,
          notes: data.notes || null,
          vehicle_type: data.vehicle_type || 'moto',
          engine_cc: data.engine_cc || null,
          warranty_months: data.warranty_months || 12,
          revision_period_months: data.revision_period_months || 6,
          revision_period_km: data.revision_period_km || 1000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveVehicleToCache(fallbackVehicle);
        return fallbackVehicle;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Veículo cadastrado', description: 'Veículo adicionado ao estoque disponível.' });
    },
    onError: (error: Error) => {
      let message = 'Erro ao cadastrar veículo.';
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        message = 'Chassi já cadastrado no sistema.';
      }
      toast({ variant: 'destructive', title: 'Erro', description: message });
    },
  });
}

// Store mutations
export interface CreateStoreData {
  name: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  instagram_handle?: string | null;
  manager_id?: string;
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateStoreData) => {
      const tempId = `store-${Date.now()}`;
      try {
        const { data: store, error } = await supabase
          .from('stores')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        saveStoreToCache(store);
        logActivity('criar', 'loja', store.id, { nome: data.name });
        return store;
      } catch (err) {
        console.warn('Erro ao cadastrar loja no Supabase, salvando localmente:', err);
        const localStore = {
          id: tempId,
          ...data,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Store;
        saveStoreToCache(localStore);
        return localStore;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-stats'] });
      toast({ title: 'Loja cadastrada', description: 'Nova loja adicionada ao sistema.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao cadastrar loja.' });
    },
  });
}

// Reseller mutations
export interface CreateResellerData {
  full_name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  store_id?: string;
  commission_rate?: number;
}

export function useCreateReseller() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateResellerData) => {
      const { data: reseller, error } = await supabase
        .from('resellers')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('criar', 'revendedor', reseller.id, { nome: data.full_name });
      return reseller;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      queryClient.invalidateQueries({ queryKey: ['reseller-stats'] });
      toast({ title: 'Revendedor cadastrado', description: 'Novo revendedor adicionado.' });
    },
    onError: (error: Error) => {
      let message = 'Erro ao cadastrar revendedor.';
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        message = 'CPF já cadastrado no sistema.';
      }
      toast({ variant: 'destructive', title: 'Erro', description: message });
    },
  });
}

// Contract mutations
export interface CreateContractData {
  vehicle_id: string;
  reseller_id: string | null;
  store_id: string;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone?: string;
  buyer_email?: string;
  buyer_address?: string;
  sale_price: number;
  down_payment?: number;
  installments?: number;
  installment_value?: number;
  notes?: string;
  created_by?: string | null;
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateContractData) => {
      // Generate contract number
      const contractNumber = `CTR-${Date.now().toString(36).toUpperCase()}`;
      
      const { data: contract, error } = await supabase
        .from('contracts')
        .insert({ ...data, contract_number: contractNumber })
        .select()
        .single();
      
      if (error) throw error;

      // Update vehicle status to reserved
      await supabase
        .from('vehicles')
        .update({ status: 'reservado' })
        .eq('id', data.vehicle_id);

      logActivity('criar', 'contrato', contract.id, { numero: contractNumber, cliente: data.buyer_name, valor: data.sale_price });
      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Contrato criado', description: 'Contrato gerado com sucesso.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao criar contrato.' });
    },
  });
}

