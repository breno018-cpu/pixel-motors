import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReservationVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  plate: string | null;
  chassis: string | null;
  vehicle_type: string | null;
  status: string;
}

export interface ReservationStore {
  id: string;
  name: string;
}

export interface ReservationReseller {
  id: string;
  full_name: string;
}

export interface Reservation {
  id: string;
  reservation_number: string;
  vehicle_id: string;
  store_id: string;
  reseller_id: string | null;
  created_by: string | null;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  vehicle_price: number;
  reservation_amount: number;
  payment_method: string | null;
  reservation_date: string;
  expires_at: string | null;
  status: 'ativa' | 'convertida' | 'cancelada' | 'expirada';
  converted_contract_id: string | null;
  signed_contract_url: string | null;
  template_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: ReservationVehicle;
  store?: ReservationStore;
  reseller?: ReservationReseller | null;
}

export function useReservations() {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vehicle_reservations')
        .select(`
          *,
          vehicle:vehicles(id, brand, model, year, color, plate, chassis, vehicle_type, status),
          store:stores(id, name),
          reseller:resellers(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Reservation[];
    },
  });
}

export interface CreateReservationInput {
  vehicle_id: string;
  store_id: string;
  reseller_id?: string | null;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  buyer_address?: string | null;
  vehicle_price: number;
  reservation_amount: number;
  payment_method?: string | null;
  expires_at?: string | null;
  template_id?: string | null;
  notes?: string | null;
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateReservationInput) => {
      const { data: userResp } = await supabase.auth.getUser();
      const reservation_number = `RES-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await (supabase as any)
        .from('vehicle_reservations')
        .insert({
          ...input,
          reservation_number,
          created_by: userResp.user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      // Marcar veículo como reservado
      await supabase
        .from('vehicles')
        .update({ status: 'reservado' })
        .eq('id', input.vehicle_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Reserva criada', description: 'O veículo foi marcado como reservado.' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar reserva',
        description: err?.message || 'Tente novamente.',
      });
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, vehicle_id }: { id: string; vehicle_id: string }) => {
      const { error } = await (supabase as any)
        .from('vehicle_reservations')
        .update({ status: 'cancelada' })
        .eq('id', id);
      if (error) throw error;

      // Liberar o veículo
      await supabase
        .from('vehicles')
        .update({ status: 'disponivel' })
        .eq('id', vehicle_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Reserva cancelada' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro ao cancelar reserva' });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('vehicle_reservations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({ title: 'Reserva excluída' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro ao excluir reserva' });
    },
  });
}

export interface ConvertReservationInput {
  reservation: Reservation;
  template_id: string;
  sale_price: number;
  installments?: number;
  installment_value?: number;
  notes?: string | null;
}

export function useConvertReservationToSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ConvertReservationInput) => {
      const r = input.reservation;
      const { data: userResp } = await supabase.auth.getUser();

      const contract_number = `CT-${Date.now().toString(36).toUpperCase()}`;
      const downPayment = Number(r.reservation_amount) || 0;

      const { data: contract, error: cErr } = await supabase
        .from('contracts')
        .insert({
          contract_number,
          vehicle_id: r.vehicle_id,
          store_id: r.store_id,
          reseller_id: r.reseller_id,
          template_id: input.template_id,
          contract_type: 'venda',
          buyer_name: r.buyer_name,
          buyer_cpf: r.buyer_cpf,
          buyer_phone: r.buyer_phone,
          buyer_email: r.buyer_email,
          buyer_address: r.buyer_address,
          sale_price: input.sale_price,
          down_payment: downPayment,
          installments: input.installments ?? 1,
          installment_value: input.installment_value ?? null,
          status: 'pendente',
          notes: input.notes ?? `Convertida da reserva ${r.reservation_number}`,
          created_by: userResp.user?.id ?? null,
        })
        .select()
        .single();

      if (cErr) throw cErr;

      const { error: updErr } = await (supabase as any)
        .from('vehicle_reservations')
        .update({
          status: 'convertida',
          converted_contract_id: contract.id,
        })
        .eq('id', r.id);
      if (updErr) throw updErr;

      await supabase
        .from('vehicles')
        .update({ status: 'vendido' })
        .eq('id', r.vehicle_id);

      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Reserva convertida em venda' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao converter reserva',
        description: err?.message || 'Tente novamente.',
      });
    },
  });
}