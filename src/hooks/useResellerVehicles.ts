import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ResellerVehicleCount {
  resellerId: string;
  resellerName: string;
  vehicleCount: number;
  totalCost: number;
  totalPaid: number;
  paymentPercentage: number;
}

export function useResellerVehicleCounts() {
  return useQuery({
    queryKey: ['reseller-vehicle-counts'],
    queryFn: async () => {
      // Get all resellers
      const { data: resellers, error: resellersError } = await supabase
        .from('resellers')
        .select('id, full_name')
        .eq('is_active', true);

      if (resellersError) throw resellersError;

      // Get all vehicles assigned to resellers
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, reseller_id, purchase_price')
        .not('reseller_id', 'is', null);

      if (vehiclesError) throw vehiclesError;

      // Get consignment contracts
      const { data: consignments, error: consignmentsError } = await supabase
        .from('reseller_consignment_contracts')
        .select('*');

      if (consignmentsError) throw consignmentsError;

      // Calculate stats for each reseller
      const resellerStats: ResellerVehicleCount[] = resellers?.map(reseller => {
        const resellerVehicles = vehicles?.filter(v => v.reseller_id === reseller.id) || [];
        const resellerConsignments = consignments?.filter(c => c.reseller_id === reseller.id) || [];
        
        const vehicleCount = resellerVehicles.length;
        const totalCost = resellerConsignments.reduce((sum, c) => sum + Number(c.vehicle_cost || 0), 0);
        
        // Calculate total paid
        let totalPaid = 0;
        resellerConsignments.forEach(c => {
          if (c.payment_type === 'full' && c.upfront_paid) {
            totalPaid += Number(c.full_payment_amount || 0);
          } else if (c.payment_type === 'percentage') {
            if (c.upfront_paid) totalPaid += Number(c.upfront_amount || 0);
            if (c.remaining_paid) totalPaid += Number(c.remaining_amount || 0);
          }
        });

        const paymentPercentage = totalCost > 0 ? (totalPaid / totalCost) * 100 : 0;

        return {
          resellerId: reseller.id,
          resellerName: reseller.full_name,
          vehicleCount,
          totalCost,
          totalPaid,
          paymentPercentage,
        };
      }) || [];

      return resellerStats.filter(r => r.vehicleCount > 0 || r.totalCost > 0);
    },
  });
}

export function useResellerStock(resellerId?: string) {
  return useQuery({
    queryKey: ['reseller-stock', resellerId],
    queryFn: async () => {
      if (!resellerId) return [];
      
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('reseller_id', resellerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!resellerId,
  });
}
