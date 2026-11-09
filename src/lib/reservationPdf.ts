import { generateContractFromTemplate, loadTemplateAssets } from '@/lib/templatePdf';
import { supabase } from '@/integrations/supabase/client';
import { getStoreFromDatabase } from '@/lib/storeResolution';
import type { Reservation } from '@/hooks/useReservations';

export async function downloadReservationContractPDF(reservation: Reservation) {
  if (!reservation.template_id) {
    throw new Error('Esta reserva não possui modelo de contrato vinculado.');
  }

  const { data: template, error: tErr } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('id', reservation.template_id)
    .single();
  if (tErr || !template) throw tErr || new Error('Modelo não encontrado.');

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', reservation.store_id)
    .maybeSingle();

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', reservation.vehicle_id)
    .maybeSingle();

  const resolvedStore = getStoreFromDatabase(reservation.store_id || (vehicle as any)?.store_id, [store].filter(Boolean));
  const assets = await loadTemplateAssets(template as any);
  const doc = generateContractFromTemplate({
    template: {
      header_content: template.header_content,
      body_content: template.body_content,
      clauses_content: template.clauses_content,
      signature_content: template.signature_content,
      fixed_clauses: template.fixed_clauses || [],
      ...assets,
    },
    client: {
      name: reservation.buyer_name,
      cpf: reservation.buyer_cpf,
      address: reservation.buyer_address || '',
      phone: reservation.buyer_phone || '',
      email: reservation.buyer_email || '',
    },
    vehicle: {
      brand: vehicle?.brand || reservation.vehicle?.brand || '',
      model: vehicle?.model || reservation.vehicle?.model || '',
      year: vehicle?.year || reservation.vehicle?.year || 0,
      color: vehicle?.color || reservation.vehicle?.color || '',
      chassis: vehicle?.chassis || reservation.vehicle?.chassis || '',
      plate: vehicle?.plate || reservation.vehicle?.plate || '',
      renavam: vehicle?.renavam || '',
    },
    store: {
      name: resolvedStore.storeName,
      cnpj: resolvedStore.cnpj || '',
      address: resolvedStore.address || '',
      city: resolvedStore.city || '',
      phone: resolvedStore.phone || '',
      email: resolvedStore.email || '',
    },
    payment: {
      total: Number(reservation.vehicle_price) || 0,
      downPayment: Number(reservation.reservation_amount) || 0,
      method: reservation.payment_method || 'Sinal de reserva',
      installments: 1,
    },
    contractNumber: reservation.reservation_number,
    contractDate: new Date(reservation.reservation_date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  });

  doc.save(`reserva_${reservation.reservation_number}.pdf`);
}