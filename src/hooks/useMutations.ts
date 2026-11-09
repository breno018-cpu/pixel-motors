import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/audit';

// Vehicle mutations
export interface CreateVehicleData {
  store_id: string;
  vehicle_type: 'carro' | 'moto';
  brand: string;
  model: string;
  year: number;
  manufacture_year?: number;
  color: string;
  chassis: string;
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
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('criar', 'veiculo', vehicle.id, { chassi: data.chassis, modelo: `${data.brand} ${data.model}` });
      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Veículo cadastrado', description: 'Veículo adicionado ao estoque.' });
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
      const { data: store, error } = await supabase
        .from('stores')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('criar', 'loja', store.id, { nome: data.name });
      return store;
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

