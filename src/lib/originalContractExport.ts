import { supabase } from '@/integrations/supabase/client';
import { normalizePickup } from '@/lib/pickupAuthorization';
import { getStoreFromDatabase } from '@/lib/storeResolution';
import { generateContractFromTemplate, loadTemplateAssets } from '@/lib/templatePdf';
import { downloadContractPDF, CLASSIC_SALE_TEMPLATE, CLASSIC_REPASSE_TEMPLATE } from '@/lib/contractPdf';

/**
 * Emite o CONTRATO ORIGINAL EXATAMENTE COMO DESDE O INÍCIO DO SISTEMA
 * Utiliza os templates cadastrados (contract_templates) ou o layout padrão original.
 */
export async function downloadOriginalContract(sale: any): Promise<void> {
  // 1. Nome do Operador/Vendedor
  let operatorName: string | undefined;
  if (sale.created_by) {
    const { data: opProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', sale.created_by)
      .maybeSingle();
    operatorName = opProfile?.full_name || undefined;
  }
  if (!operatorName && (sale.external_data as any)?.completed_by) {
    operatorName = (sale.external_data as any).completed_by;
  }

  // 2. Concessionária / Filial da venda
  const storeTargetId = sale.store_id || sale.store?.id || (sale.vehicle as any)?.store_id;
  const { data: storesList } = await supabase.from('stores').select('*');
  const dbStore = (storesList || []).find((s: any) => s.id === storeTargetId);
  const resolvedStore = getStoreFromDatabase(storeTargetId || sale.store?.name, [dbStore].filter(Boolean));

  // 3. Busca o template vinculado ou específico da loja
  const { data: freshContract } = await supabase
    .from('contracts')
    .select('template_id, contract_type')
    .eq('id', sale.id)
    .maybeSingle();

  const contractRecord = { ...(sale as any), ...(freshContract || {}) };
  let templateData: any = null;

  if (contractRecord.template_id) {
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', contractRecord.template_id)
      .maybeSingle();
    templateData = data;
  }

  const vehItem = sale.vehicle || {};
  const isMotoItem = (vehItem.vehicle_type || (sale as any).tipo || '').toLowerCase() === 'moto';
  const isRepasseItem = (sale as any).contract_type === 'repasse';
  const preferredType = isRepasseItem ? 'repasse' : (isMotoItem ? 'venda_moto' : 'venda_carro');

  // Se não houver template específico vinculado, busca primeiro o template ativo DA LOJA
  if (!templateData && storeTargetId) {
    const { data: storeTyped } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('store_id', storeTargetId)
      .eq('template_type', preferredType)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (storeTyped) {
      templateData = storeTyped;
    } else {
      const { data: storeAny } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('store_id', storeTargetId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (storeAny) templateData = storeAny;
    }
  }

  // Se a loja não tiver template próprio ativo, busca o template geral ativo
  if (!templateData) {
    const { data: globalTyped } = await supabase
      .from('contract_templates')
      .select('*')
      .is('store_id', null)
      .eq('template_type', preferredType)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (globalTyped) {
      templateData = globalTyped;
    } else {
      const { data: anyActive } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      templateData = anyActive;
    }
  }

  // 4. Revendedor
  let resellerData: any = null;
  if (sale.reseller_id) {
    const { data } = await supabase.from('resellers').select('*').eq('id', sale.reseller_id).maybeSingle();
    resellerData = data;
  }

  // 5. Veículos
  let groupVehicles: any[] = [];
  let groupTotal = Number(sale.sale_price) || 0;
  try {
    const { fetchSaleGroup } = await import('@/lib/saleGroup');
    const group = await fetchSaleGroup(sale.id);
    if (group?.vehicles?.length) {
      groupVehicles = group.vehicles;
      groupTotal = group.vehicles.length > 1 ? group.total : Number(sale.sale_price);
    }
  } catch {}

  const ext = (sale.external_data || {}) as any;
  const veh = sale.vehicle || {};
  const vehicleBrand = veh.brand || ext.marca || 'SHINERAY';
  const vehicleModel = veh.model || ext.vehicle_model_custom || ext.modelo || 'Moto';
  const vehicleYear = Number(veh.year || ext.ano || 2026);
  const vehicleColor = veh.color || ext.cor || undefined;
  const vehicleChassis = veh.chassis || ext.chassi || ext.vehicle_chassis_custom || undefined;
  const vehiclePlate = veh.plate || ext.placa || undefined;

  // 6. Geração do Contrato Original
  const isRepasse = (sale as any).contract_type === 'repasse';
  const defaultTemplate = isRepasse ? CLASSIC_REPASSE_TEMPLATE : CLASSIC_SALE_TEMPLATE;

  if (templateData) {
    const assets = await loadTemplateAssets(templateData);

    const header_content = templateData.header_content || defaultTemplate.header_content;
    const body_content = templateData.body_content || defaultTemplate.body_content;
    const clauses_content = templateData.clauses_content || defaultTemplate.clauses_content;
    const signature_content = templateData.signature_content || defaultTemplate.signature_content;

    const data = {
      template: {
        header_content,
        body_content,
        clauses_content,
        signature_content,
        fixed_clauses: templateData.fixed_clauses || [],
        optional_clauses: templateData.optional_clauses || [],
        logo_data_url: assets.logo_data_url || null,
        watermark_data_url: assets.watermark_data_url || null,
        watermark_opacity: templateData.watermark_opacity ?? 0.10,
        signature_data_url: assets.signature_data_url || null,
      },
      client: {
        name: sale.buyer_name ? sale.buyer_name.toUpperCase() : 'COMPRADOR',
        cpf: sale.buyer_cpf,
        address: sale.buyer_address || ext.buyer_address || undefined,
        phone: sale.buyer_phone || ext.buyer_phone || undefined,
        email: sale.buyer_email || undefined,
      },
      vehicle: {
        brand: vehicleBrand ? vehicleBrand.toUpperCase() : 'SHINERAY',
        model: vehicleModel ? vehicleModel.toUpperCase() : 'MOTO',
        year: vehicleYear,
        color: vehicleColor,
        chassis: vehicleChassis,
        plate: vehiclePlate,
      },
      store: {
        name: resolvedStore.storeName ? resolvedStore.storeName.toUpperCase() : 'CONCESSIONÁRIA',
        cnpj: resolvedStore.cnpj,
        address: resolvedStore.address,
        city: resolvedStore.city ? `${resolvedStore.city.toUpperCase()}/${(resolvedStore.state || 'MG').toUpperCase()}` : 'MONTES CLAROS/MG',
        phone: resolvedStore.phone,
        email: resolvedStore.email,
      },
      reseller: {
        name: resellerData?.full_name || sale.reseller?.full_name || undefined,
        cpf: resellerData?.cpf || undefined,
        email: resellerData?.email || undefined,
        phone: resellerData?.phone || undefined,
        commission: resellerData?.commission_rate ? Number(resellerData.commission_rate) : undefined,
      },
      vehicles: groupVehicles,
      payment: {
        total: groupTotal,
        downPayment: sale.down_payment ? Number(sale.down_payment) : undefined,
        method: sale.payment_method || 'À Vista',
        installments: sale.installments || 1,
        installmentValue: sale.installment_value ? Number(sale.installment_value) : undefined,
      },
      contractNumber: sale.contract_number,
      pickup: normalizePickup(ext?.pickup),
      contractDate: new Date(sale.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    };

    const doc = generateContractFromTemplate(data);
    doc.save(`contrato_${sale.contract_number}.pdf`);
  } else {
    // Fallback para o layout original hardcoded de contrato
    downloadContractPDF({
      contractNumber: sale.contract_number,
      pickup: normalizePickup(ext?.pickup),
      contractType: (sale as any).contract_type === 'repasse' ? 'repasse' : 'venda',
      createdAt: sale.created_at,
      storeName: resolvedStore.storeName,
      storeCnpj: resolvedStore.cnpj,
      storeAddress: resolvedStore.address,
      storePhone: resolvedStore.phone,
      storeEmail: resolvedStore.email,
      buyerName: sale.buyer_name,
      buyerCpf: sale.buyer_cpf,
      buyerPhone: sale.buyer_phone || ext.buyer_phone || undefined,
      buyerEmail: sale.buyer_email || undefined,
      buyerAddress: sale.buyer_address || ext.buyer_address || undefined,
      vehicleBrand,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehicleChassis,
      vehiclePlate,
      vehicles: groupVehicles,
      salePrice: groupTotal,
      downPayment: sale.down_payment ? Number(sale.down_payment) : undefined,
      installments: sale.installments || undefined,
      installmentValue: sale.installment_value ? Number(sale.installment_value) : undefined,
      resellerName: sale.reseller?.full_name || undefined,
      operatorName,
      notes: sale.notes || undefined,
      signedAt: (sale as any).signed_at || undefined,
      status: sale.status,
    });
  }
}
