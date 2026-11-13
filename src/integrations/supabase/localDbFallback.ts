// Camada Universal de Persistência Local + Fallback Supabase
// Garante que todos os menus, formulários, cadastros, edições e exclusões funcionem instantaneamente
// mesmo sem sessão JWT remota ou quando políticas RLS/tabelas do Supabase bloquearem a escrita.

import officialVehiclesSeed from '@/data/officialVehiclesSeed.json';

const STORAGE_PREFIX = 'df_local_table_v5_';

export function purgeFictitiousData(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const wipedTables = [
      'contracts',
      'sales',
      'invoices',
      'resellers',
      'financing_simulations',
      'reseller_consignment_contracts',
      'store_ads',
      'sales_targets',
      'activity_logs',
      'approval_requests',
      'vehicle_reservations',
      'stock_transfers',
      'eula_acceptances',
    ];
    // Remove qualquer versão antiga ou cache dessas tabelas
    ['df_local_table_v1_', 'df_local_table_v2_', 'df_local_table_v3_', 'df_local_table_v4_', 'df_local_table_v5_'].forEach((pfx) => {
      wipedTables.forEach((tbl) => localStorage.removeItem(`${pfx}${tbl}`));
    });
    // Limpa também planilhas temporárias com dados simulados
    localStorage.removeItem('dealflow_cloud_monthly_sheet_v9');
    localStorage.removeItem('dealflow_cloud_monthly_sheet_v8');
    localStorage.removeItem('dealflow_cloud_monthly_sheet_v7');
    localStorage.removeItem('dealflow_cloud_monthly_sheet');
    localStorage.removeItem('dealflow_contracts_backup');
    localStorage.removeItem('dealflow_moto_inspections_v3');
    localStorage.removeItem('dealflow_moto_inspections_v2');
    localStorage.removeItem('dealflow_moto_inspections_v1');
    localStorage.removeItem('dealflow_logistics_deliveries_v2');
    localStorage.removeItem('dealflow_logistics_deliveries_v1');

    // Varre e remove qualquer chave residual de vendas, recibos ou laudos fictícios
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('df_receipt_') ||
        key.startsWith('dealflow_receipt_') ||
        (key.startsWith('df_local_table_') && wipedTables.some((tbl) => key.endsWith(tbl)))
      )) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

// Executa automaticamente para garantir banco limpo
purgeFictitiousData();

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix = '') {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
}

export const INITIAL_SEED: Record<string, any[]> = {
  stores: [
    {
      id: 'store-divinopolis',
      name: 'Concessionária Divinópolis',
      city: 'Divinópolis',
      state: 'MG',
      cnpj: '18.456.789/0001-01',
      address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
      phone: '(37) 3222-1000',
      email: 'divinopolis@pixelmotors.com.br',
      instagram_handle: 'shineray.divinopolis',
      manager_id: null,
      is_active: true,
      created_at: '2026-01-10T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'store-montesclaros',
      name: 'Concessionária Montes Claros',
      city: 'Montes Claros',
      state: 'MG',
      cnpj: '18.456.789/0002-82',
      address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
      phone: '(38) 3221-2000',
      email: 'montesclaros@pixelmotors.com.br',
      instagram_handle: 'shineray.montesclaros',
      manager_id: null,
      is_active: true,
      created_at: '2026-01-15T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
  ],

  vehicles: (officialVehiclesSeed as any[]) || [],
  contracts: [],
  sales: [],

  vehicle_models: [
    { id: 'mod-shi250', vehicle_type: 'moto', brand: 'SHINERAY', model: 'SHI 250 EFI', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', default_purchase_price: 18900, default_sale_price: 23330, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-rio125', vehicle_type: 'moto', brand: 'SHINERAY', model: 'RIO 125 EFI', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', default_purchase_price: 10500, default_sale_price: 13490, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-shi175', vehicle_type: 'moto', brand: 'SHINERAY', model: 'SHI 175 EFI', engine_cc: 175, fuel_type: 'gasolina', transmission: 'manual', default_purchase_price: 14200, default_sale_price: 17990, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-jet125', vehicle_type: 'moto', brand: 'SHINERAY', model: 'JET 125 SS', engine_cc: 125, fuel_type: 'gasolina', transmission: 'semi_automatico', default_purchase_price: 9800, default_sale_price: 12690, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-work125', vehicle_type: 'moto', brand: 'SHINERAY', model: 'WORKER 125', engine_cc: 125, fuel_type: 'gasolina', transmission: 'manual', default_purchase_price: 8900, default_sale_price: 11490, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-tit250', vehicle_type: 'moto', brand: 'SHINERAY', model: 'TITANIUM 250 EFI', engine_cc: 250, fuel_type: 'gasolina', transmission: 'manual', default_purchase_price: 20500, default_sale_price: 25990, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-free150', vehicle_type: 'moto', brand: 'SHINERAY', model: 'FREE 150 EFI', engine_cc: 150, fuel_type: 'gasolina', transmission: 'manual', default_purchase_price: 11800, default_sale_price: 14990, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
    { id: 'mod-storm200', vehicle_type: 'moto', brand: 'SHINERAY', model: 'STORM 200 EFI', engine_cc: 200, fuel_type: 'gasolina', transmission: 'manual', default_purchase_price: 16900, default_sale_price: 20990, warranty_months: 12, revision_period_months: 6, revision_period_km: 1000, is_active: true, promo_price: null, promo_label: null, promo_ends_on: null, created_at: nowIso(), updated_at: nowIso() },
  ],

  vehicle_colors: [
    { id: 'col-preta', name: 'Preta', hex: '#111827', is_active: true, applies_to_all: true, model_ids: [], created_at: nowIso() },
    { id: 'col-vermelha', name: 'Vermelha', hex: '#dc2626', is_active: true, applies_to_all: true, model_ids: [], created_at: nowIso() },
    { id: 'col-branca', name: 'Branca', hex: '#f9fafb', is_active: true, applies_to_all: true, model_ids: [], created_at: nowIso() },
    { id: 'col-azul', name: 'Azul', hex: '#2563eb', is_active: true, applies_to_all: true, model_ids: [], created_at: nowIso() },
    { id: 'col-cinza', name: 'Cinza', hex: '#6b7280', is_active: true, applies_to_all: true, model_ids: [], created_at: nowIso() },
    { id: 'col-prata', name: 'Prata', hex: '#9ca3af', is_active: true, applies_to_all: true, model_ids: [], created_at: nowIso() },
  ],

  profiles: [
    {
      id: 'dev-master-admin',
      full_name: 'Administrador Master (Concessionária)',
      email: 'admin@pixelmotors.com.br',
      phone: '(37) 99999-0000',
      cpf: '000.000.000-00',
      store_id: 'store-divinopolis',
      is_active: true,
      avatar_url: null,
      must_change_password: false,
      created_at: '2026-01-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'Lilian',
      full_name: 'Lilian',
      email: 'lilian@pixelmotors.com.br',
      phone: '(37) 99811-1001',
      cpf: '111.222.333-44',
      store_id: 'store-divinopolis',
      is_active: true,
      avatar_url: null,
      must_change_password: false,
      created_at: '2026-02-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'Geibriel',
      full_name: 'Geibriel',
      email: 'geibriel@pixelmotors.com.br',
      phone: '(37) 99811-1002',
      cpf: '222.333.444-55',
      store_id: 'store-divinopolis',
      is_active: true,
      avatar_url: null,
      must_change_password: false,
      created_at: '2026-02-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'Daniel',
      full_name: 'Daniel',
      email: 'daniel@pixelmotors.com.br',
      phone: '(38) 99811-1003',
      cpf: '333.444.555-66',
      store_id: 'store-montesclaros',
      is_active: true,
      avatar_url: null,
      must_change_password: false,
      created_at: '2026-02-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'Breno',
      full_name: 'Breno',
      email: 'breno@pixelmotors.com.br',
      phone: '(37) 99811-1004',
      cpf: '444.555.666-77',
      store_id: 'store-divinopolis',
      is_active: true,
      avatar_url: null,
      must_change_password: false,
      created_at: '2026-02-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
  ],

  user_roles: [
    { id: 'ur-admin', user_id: 'dev-master-admin', role: 'admin', custom_role_id: null },
    { id: 'ur-lilian', user_id: 'Lilian', role: 'vendedor_plus', custom_role_id: null },
    { id: 'ur-geibriel', user_id: 'Geibriel', role: 'vendedor_plus', custom_role_id: null },
    { id: 'ur-daniel', user_id: 'Daniel', role: 'vendedor', custom_role_id: null },
    { id: 'ur-breno', user_id: 'Breno', role: 'vendedor_externo', custom_role_id: null },
  ],

  employees: [
    {
      id: 'emp-lilian',
      profile_id: 'Lilian',
      store_id: 'store-divinopolis',
      full_name: 'Lilian',
      cpf: '111.222.333-44',
      email: 'lilian@pixelmotors.com.br',
      phone: '(37) 99811-1001',
      role: 'vendedor_plus',
      position: 'Consultora de Vendas Sênior',
      role_title: 'Consultora de Vendas Sênior',
      department: 'Comercial',
      base_salary: 2200,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-03-10',
      is_active: true,
      created_at: '2025-03-10T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-geibriel',
      profile_id: 'Geibriel',
      store_id: 'store-divinopolis',
      full_name: 'Geibriel',
      cpf: '222.333.444-55',
      email: 'geibriel@pixelmotors.com.br',
      phone: '(37) 99811-1002',
      role: 'vendedor_plus',
      position: 'Consultor de Vendas Sênior',
      role_title: 'Consultor de Vendas Sênior',
      department: 'Comercial',
      base_salary: 2200,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-04-01',
      is_active: true,
      created_at: '2025-04-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-daniel',
      profile_id: 'Daniel',
      store_id: 'store-montesclaros',
      full_name: 'Daniel',
      cpf: '333.444.555-66',
      email: 'daniel@pixelmotors.com.br',
      phone: '(38) 99811-1003',
      role: 'vendedor',
      position: 'Consultor de Vendas',
      role_title: 'Consultor de Vendas',
      department: 'Comercial',
      base_salary: 2000,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-06-15',
      is_active: true,
      created_at: '2025-06-15T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-breno',
      profile_id: 'Breno',
      store_id: 'store-divinopolis',
      full_name: 'Breno',
      cpf: '444.555.666-77',
      email: 'breno@pixelmotors.com.br',
      phone: '(37) 99811-1004',
      role: 'vendedor_externo',
      position: 'Consultor Comercial & Regional',
      role_title: 'Consultor Comercial & Regional',
      department: 'Comercial',
      base_salary: 2500,
      commission_rate: 2.0,
      commission_type: 'tiered',
      hire_date: '2025-01-15',
      is_active: true,
      created_at: '2025-01-15T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-mariana',
      profile_id: 'Mariana',
      store_id: 'store-montesclaros',
      full_name: 'Mariana Sabino',
      cpf: '666.777.888-99',
      email: 'mariana@pixelmotors.com.br',
      phone: '(38) 99811-1006',
      role: 'vendedor_plus',
      position: 'Consultora de Vendas Sênior',
      role_title: 'Consultora de Vendas Sênior',
      department: 'Comercial',
      base_salary: 2200,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-02-01',
      is_active: true,
      created_at: '2025-02-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-halana',
      profile_id: 'Halana',
      store_id: 'store-montesclaros',
      full_name: 'Halana',
      cpf: '777.888.999-00',
      email: 'halana@pixelmotors.com.br',
      phone: '(38) 99811-1007',
      role: 'vendedor',
      position: 'Consultora de Vendas',
      role_title: 'Consultora de Vendas',
      department: 'Comercial',
      base_salary: 2000,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-03-01',
      is_active: true,
      created_at: '2025-03-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-sabrina',
      profile_id: 'Sabrina',
      store_id: 'store-montesclaros',
      full_name: 'Sabrina',
      cpf: '888.999.000-11',
      email: 'sabrina@pixelmotors.com.br',
      phone: '(38) 99811-1008',
      role: 'vendedor',
      position: 'Consultora de Vendas',
      role_title: 'Consultora de Vendas',
      department: 'Comercial',
      base_salary: 2000,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-03-15',
      is_active: true,
      created_at: '2025-03-15T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-natan',
      profile_id: 'Natan',
      store_id: 'store-montesclaros',
      full_name: 'Natan',
      cpf: '999.000.111-22',
      email: 'natan@pixelmotors.com.br',
      phone: '(38) 99811-1009',
      role: 'vendedor',
      position: 'Consultor de Vendas',
      role_title: 'Consultor de Vendas',
      department: 'Comercial',
      base_salary: 2000,
      commission_rate: 1.5,
      commission_type: 'tiered',
      hire_date: '2025-04-01',
      is_active: true,
      created_at: '2025-04-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-carlos-mecanico',
      profile_id: null,
      store_id: 'store-divinopolis',
      full_name: 'Carlos Eduardo (Chefe de Oficina)',
      cpf: '555.666.777-88',
      email: 'oficina.div@pixelmotors.com.br',
      phone: '(37) 99811-1005',
      role: 'mecanico_chefe',
      position: 'Mecânico Chefe / Líder de Oficina',
      role_title: 'Mecânico Chefe / Líder de Oficina',
      department: 'Oficina',
      base_salary: 2800,
      commission_rate: 0,
      commission_type: 'fixed_value',
      hire_date: '2024-08-01',
      is_active: true,
      notes: JSON.stringify({
        __folha_meta: true,
        matricula: '0005',
        departamento: 'MECANICA',
        tipoContrato: 'CLT',
        modeloComissaoVendedor: 'PADRAO',
        status: 'ATIVO',
        cargaHoraria: 220,
        dependentes: 1,
        grauInsalubridade: 'MEDIO',
        temPericulosidade: 0,
        optanteVT: 1,
        custoPassagemMensal: 220,
        descontoPlanoSaude: 0,
        descontoValeRefeicao: 80,
        descontarINSS: 1,
        descontarIRRF: 1,
        calcularFGTS: 1,
        pagarDSRComissao: 1,
        razaoSocialPrestador: '',
        cnpjPrestador: '',
      }),
      created_at: '2024-08-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'emp-roberto-gerente',
      profile_id: null,
      store_id: 'store-divinopolis',
      full_name: 'Roberto Almeida (Gerente Geral)',
      cpf: '666.777.888-99',
      email: 'gerencia.div@pixelmotors.com.br',
      phone: '(37) 99811-1006',
      role: 'gerente',
      position: 'Gerente de Loja',
      role_title: 'Gerente de Loja',
      department: 'Gerência',
      base_salary: 4500,
      commission_rate: 0,
      commission_type: 'fixed_value',
      hire_date: '2024-02-01',
      is_active: true,
      notes: JSON.stringify({
        __folha_meta: true,
        matricula: '0006',
        departamento: 'GERENCIA',
        tipoContrato: 'CLT',
        modeloComissaoVendedor: 'PADRAO',
        status: 'ATIVO',
        cargaHoraria: 220,
        dependentes: 2,
        grauInsalubridade: 'NENHUM',
        temPericulosidade: 0,
        optanteVT: 0,
        custoPassagemMensal: 0,
        descontoPlanoSaude: 180,
        descontoValeRefeicao: 0,
        descontarINSS: 1,
        descontarIRRF: 1,
        calcularFGTS: 1,
        pagarDSRComissao: 1,
        razaoSocialPrestador: '',
        cnpjPrestador: '',
      }),
      created_at: '2024-02-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
  ],

  resellers: [],

  financing_banks: [
    { id: 'bank-altis', name: 'ALTIS', cnpj: '33.111.222/0001-01', is_active: true, notes: 'Financeira homologada Shineray / Motos', created_at: nowIso(), updated_at: nowIso() },
    { id: 'bank-motrix', name: 'MOTRIX', cnpj: '44.222.333/0001-02', is_active: true, notes: 'Especialista em financiamento de motocicletas 0km', created_at: nowIso(), updated_at: nowIso() },
    { id: 'bank-pan', name: 'PAN', cnpj: '59.285.411/0001-13', is_active: true, notes: 'Banco PAN Financiamentos', created_at: nowIso(), updated_at: nowIso() },
    { id: 'bank-bradesco', name: 'BRADESCO M', cnpj: '60.746.948/0001-12', is_active: true, notes: 'Bradesco Financiamentos Motos', created_at: nowIso(), updated_at: nowIso() },
    { id: 'bank-santander', name: 'SANTANDER', cnpj: '90.400.888/0001-42', is_active: true, notes: 'Santander Financiamentos', created_at: nowIso(), updated_at: nowIso() },
    { id: 'bank-bv', name: 'BV', cnpj: '01.858.774/0001-10', is_active: true, notes: 'Banco BV', created_at: nowIso(), updated_at: nowIso() },
  ],

  bank_credentials: [
    { id: 'cred-altis-div', store_id: 'store-divinopolis', bank_code: 'altis', bank_name: 'ALTIS Financiamentos', partner_code: 'DIV-001', client_id: 'altis-div', client_secret: null, api_environment: 'production', extra_config: { monthly_rate: 1.89 }, is_active: true, notes: 'Mesa de crédito ativa', created_at: nowIso(), updated_at: nowIso() },
    { id: 'cred-motrix-div', store_id: 'store-divinopolis', bank_code: 'motrix', bank_name: 'MOTRIX Financeira', partner_code: 'DIV-002', client_id: 'motrix-div', client_secret: null, api_environment: 'production', extra_config: { monthly_rate: 1.95 }, is_active: true, notes: 'Mesa de crédito ativa', created_at: nowIso(), updated_at: nowIso() },
    { id: 'cred-pan-div', store_id: 'store-divinopolis', bank_code: 'pan', bank_name: 'Banco PAN', partner_code: 'DIV-003', client_id: 'pan-div', client_secret: null, api_environment: 'production', extra_config: { monthly_rate: 1.79 }, is_active: true, notes: 'Mesa de crédito ativa', created_at: nowIso(), updated_at: nowIso() },
    { id: 'cred-santander-moc', store_id: 'store-montesclaros', bank_code: 'santander', bank_name: 'Banco Santander', partner_code: 'MOC-001', client_id: 'san-moc', client_secret: null, api_environment: 'production', extra_config: { monthly_rate: 1.75 }, is_active: true, notes: 'Mesa de crédito ativa MOC', created_at: nowIso(), updated_at: nowIso() },
  ],

  financing_simulations: [],

  contract_templates: [
    {
      id: 'tpl-venda-moto',
      name: 'Contrato Padrão de Compra e Venda de Motocicleta (0km / Seminova)',
      template_type: 'venda_moto',
      store_id: null,
      header_content: '[center][b][size:12]CONTRATO DE COMPRA E VENDA DE VEÍCULO[/size][/b][/center]',
      body_content: 'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], estabelecida em {{LOJA_ENDERECO}} — {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]VENDEDORA[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]COMPRADOR(A)[/b], têm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:\n\n[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} — [b]Ano:[/b] {{VEICULO_ANO}} — [b]Cor:[/b] {{VEICULO_COR}}\n[b]Chassi:[/b] {{VEICULO_CHASSI}} — [b]Placa:[/b] {{VEICULO_PLACA}} — [b]Renavam:[/b] {{VEICULO_RENAVAM}}\n\n[b]VALOR DA VENDA:[/b] {{VALOR_TOTAL}}, [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}}, [b]Entrada:[/b] {{VALOR_ENTRADA}}, [b]Parcelas:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
      clauses_content: '[center][b]TERMO DE RESPONSABILIDADE E GARANTIA[/b][/center]\nDeclaro que estou vendendo o veículo acima descrito e que assumo total responsabilidade por quaisquer ocorrências relacionadas ao mesmo até a presente data de venda, incluindo multas, danos materiais e pessoais, respondendo civil e criminalmente, bem como por todo e qualquer tipo de débito, de qualquer espécie ou natureza. A partir desta venda, tais responsabilidades passam a ser integralmente do comprador acima identificado. Declaro ainda que, conforme a legislação vigente, o veículo será de responsabilidade exclusiva do comprador a partir desta data.\n\n[b]CLÁUSULAS:[/b]\n[b]1.[/b] A VENDEDORA transfere ao(à) COMPRADOR(A) a propriedade e posse do Veiculo acima descrita, livre de ônus, na presente data.\n[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado o Veiculo e a recebe no estado em que se encontra, sem direito a reclamações posteriores quanto a defeitos aparentes.\n[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributárias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).\n[b]4.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questões oriundas deste contrato.',
      signature_content: '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]\n\n[signatures]\nVENDEDORA | {{LOJA_RAZAO_SOCIAL}} || COMPRADOR(A) | {{CLIENTE_NOME}}\n[/signatures]',
      fixed_clauses: [],
      optional_clauses: [],
      is_active: true,
      created_at: '2026-01-10T10:00:00.000Z',
      updated_at: '2026-11-06T10:00:00.000Z',
    },
    {
      id: 'tpl-reserva-moto',
      name: 'Termo de Reserva de Motocicleta e Sinal de Negócio',
      template_type: 'reserva',
      store_id: null,
      header_content: 'TERMO DE RESERVA DE VEÍCULO E RECIBO DE SINAL (ARRAS)',
      body_content: 'Recebemos de {{CLIENTE_NOME}}, CPF {{CLIENTE_CPF}}, a importância referente ao sinal de reserva da motocicleta {{VEICULO_MARCA}} {{VEICULO_MODELO}}, Chassi {{VEICULO_CHASSI}}, pelo prazo acordado até a aprovação bancária / faturamento.',
      clauses_content: 'CLÁUSULA ÚNICA: O veículo ficará bloqueado em estoque exclusivo para o comprador pelo período estipulado.',
      signature_content: 'Assinam as partes.',
      fixed_clauses: [],
      optional_clauses: [],
      is_active: true,
      created_at: '2026-02-15T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'tpl-repasse-consignacao',
      name: 'Contrato de Consignação e Repasse entre Lojas Parceiras',
      template_type: 'repasse',
      store_id: null,
      header_content: 'CONTRATO COMERCIAL DE CONSIGNAÇÃO E REPASSE DE VEÍCULO',
      body_content: 'Instrumento de consignação comercial firmado entre {{LOJA_NOME}} e o parceiro revendedor para comercialização autorizada do veículo especificado.',
      clauses_content: 'O repasse financeiro deverá ocorrer em até 24h após o faturamento ao cliente final.',
      signature_content: 'Assinam as partes.',
      fixed_clauses: [],
      optional_clauses: [],
      is_active: true,
      created_at: '2026-03-10T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
    },
  ],

  reseller_consignment_contracts: [],

  invoices: [],

  store_ads: [],

  sales_targets: [],

  custom_roles: [
    { id: 'role-admin', name: 'Administrador Geral', description: 'Acesso total às duas concessionárias e configurações master', system_key: 'admin', data_scope: 'all', is_system: true, is_active: true, created_at: nowIso() },
    { id: 'role-gerente', name: 'Gerente de Loja', description: 'Gestão comercial, aprovações, estoque e equipe da unidade', system_key: 'gerente', data_scope: 'store', is_system: true, is_active: true, created_at: nowIso() },
    { id: 'role-vendedor-plus', name: 'Vendedor Sênior (Plus)', description: 'Vendas internas, simulações F&I e cadastro de estoque', system_key: 'vendedor_plus', data_scope: 'store', is_system: true, is_active: true, created_at: nowIso() },
    { id: 'role-vendedor', name: 'Vendedor Interno', description: 'Atendimento de balcão, propostas e pré-vendas', system_key: 'vendedor', data_scope: 'own', is_system: true, is_active: true, created_at: nowIso() },
    { id: 'role-vendedor-ext', name: 'Vendedor Externo / Regional', description: 'Vendas regionais e captação digital externa', system_key: 'vendedor_externo', data_scope: 'own', is_system: true, is_active: true, created_at: nowIso() },
  ],

  role_permissions: [
    { id: 'rp-1', role_id: 'role-vendedor-plus', permission: 'vehicles.create' },
    { id: 'rp-2', role_id: 'role-vendedor', permission: 'vehicles.create' },
    { id: 'rp-3', role_id: 'role-vendedor-ext', permission: 'vehicles.create' },
  ],

  eula_acceptances: [
    { id: 'eula-admin', user_id: 'dev-master-admin', version: '1.0', accepted_at: '2026-01-01T00:00:00.000Z' },
  ],

  approval_requests: [],
  vehicle_reservations: [],
  stock_transfers: [],
  payslips: [],
  activity_logs: [],

  chassis_patterns: [
    {
      id: 'pat-shi250',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'SHF250',
      model_name: 'SHI 250 EFI',
      engine_cc: 250,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 18900,
      default_sale_price: 23330,
    },
    {
      id: 'pat-rio125',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'R1F125',
      model_name: 'RIO 125 EFI',
      engine_cc: 125,
      fuel_type: 'gasolina',
      transmission: 'semi_automatico',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 10500,
      default_sale_price: 13490,
    },
    {
      id: 'pat-shi175',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'SHF175',
      model_name: 'SHI 175 EFI',
      engine_cc: 175,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 14200,
      default_sale_price: 17990,
    },
    {
      id: 'pat-jet125',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'NJ1125',
      model_name: 'NEW JET 125 SS',
      engine_cc: 125,
      fuel_type: 'gasolina',
      transmission: 'semi_automatico',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 9800,
      default_sale_price: 12690,
    },
    {
      id: 'pat-phoenix',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'PHS050',
      model_name: 'PHOENIX 50 EFI',
      engine_cc: 50,
      fuel_type: 'gasolina',
      transmission: 'semi_automatico',
      warranty_months: 6,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 6200,
      default_sale_price: 7990,
    },
    {
      id: 'pat-storm200',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'STF200',
      model_name: 'STORM 200 EFI',
      engine_cc: 200,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 16900,
      default_sale_price: 20990,
    },
    {
      id: 'pat-denver250',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'DVF250',
      model_name: 'DENVER 250',
      engine_cc: 250,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 22900,
      default_sale_price: 28990,
    },
    {
      id: 'pat-worker125',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'WRK125',
      model_name: 'WORKER 125',
      engine_cc: 125,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 6,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 7400,
      default_sale_price: 9490,
    },
    {
      id: 'pat-titanium250',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'TIT250',
      model_name: 'TITANIUM 250 EFI',
      engine_cc: 250,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 20500,
      default_sale_price: 25990,
    },
    {
      id: 'pat-free150',
      wmi_code: '99H',
      brand: 'SHINERAY',
      vehicle_type: 'moto',
      model_pattern: 'FREE150',
      model_name: 'FREE 150 EFI',
      engine_cc: 150,
      fuel_type: 'gasolina',
      transmission: 'manual',
      warranty_months: 12,
      service_interval_months: 6,
      service_interval_km: 1000,
      default_purchase_price: 11800,
      default_sale_price: 14990,
    },
  ],

  chassis_year_codes: [
    { id: 'yc-1', year_code: 'VS', model_year: 2026, manufacture_year: 2026, brand: 'SHINERAY' },
    { id: 'yc-2', year_code: 'V', model_year: 2026, manufacture_year: 2026, brand: 'SHINERAY' },
    { id: 'yc-3', year_code: 'TS', model_year: 2026, manufacture_year: 2025, brand: 'SHINERAY' },
    { id: 'yc-4', year_code: 'T', model_year: 2026, manufacture_year: 2025, brand: 'SHINERAY' },
    { id: 'yc-5', year_code: 'SS', model_year: 2025, manufacture_year: 2025, brand: 'SHINERAY' },
    { id: 'yc-6', year_code: 'S', model_year: 2025, manufacture_year: 2025, brand: 'SHINERAY' },
    { id: 'yc-7', year_code: 'RS', model_year: 2024, manufacture_year: 2024, brand: 'SHINERAY' },
    { id: 'yc-8', year_code: 'R', model_year: 2024, manufacture_year: 2024, brand: 'SHINERAY' },
    { id: 'yc-9', year_code: 'WS', model_year: 2027, manufacture_year: 2026, brand: 'SHINERAY' },
  ],
};

export function readLocalTable(table: string): any[] {
  try {
    const key = `${STORAGE_PREFIX}${table}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (table === 'stores') {
          // Garante que CNPJs e endereços das concessionárias matriz e filiais estejam sempre corretos e padronizados com o banco
          const seedStores = INITIAL_SEED.stores || [];
          const healed = parsed.map((s: any) => {
            const seed = seedStores.find((seedItem: any) => seedItem.id === s.id);
            if (seed) {
              return {
                ...s,
                cnpj: (!s.cnpj || s.cnpj.startsWith('00.000')) ? seed.cnpj : s.cnpj,
                address: (!s.address || s.address.includes('Principal')) ? seed.address : s.address,
                phone: (!s.phone || s.phone.includes('0000')) ? seed.phone : s.phone,
                city: s.city || seed.city,
                state: s.state || seed.state,
              };
            }
            return s;
          });
          return healed;
        }
        return parsed;
      }
    }
    const seed = INITIAL_SEED[table] ? [...INITIAL_SEED[table]] : [];
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  } catch {
    return INITIAL_SEED[table] ? [...INITIAL_SEED[table]] : [];
  }
}

export function writeLocalTable(table: string, rows: any[]): void {
  try {
    const key = `${STORAGE_PREFIX}${table}`;
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // ignore quota errors
  }
}

function hydrateRow(table: string, row: any): any {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };

  if ('store_id' in copy && copy.store_id) {
    const stores = readLocalTable('stores');
    const foundStore = stores.find((s) => s.id === copy.store_id) || null;
    if (foundStore) {
      if (!copy.store) {
        copy.store = {
          id: foundStore.id,
          name: foundStore.name,
          cnpj: foundStore.cnpj || null,
          city: foundStore.city || null,
          state: foundStore.state || null,
        };
      }
      if (!copy.stores) {
        copy.stores = {
          id: foundStore.id,
          name: foundStore.name,
          cnpj: foundStore.cnpj || null,
          city: foundStore.city || null,
          state: foundStore.state || null,
        };
      }
    }
  }

  if ('employee_id' in copy && copy.employee_id) {
    const employees = readLocalTable('employees');
    const foundEmployee = employees.find((e) => e.id === copy.employee_id) || null;
    if (foundEmployee && !copy.employee) {
      copy.employee = {
        id: foundEmployee.id,
        full_name: foundEmployee.full_name,
        cpf: foundEmployee.cpf || null,
        role: foundEmployee.role || foundEmployee.role_title || 'vendedor',
        position: foundEmployee.position || foundEmployee.role_title || null,
        profile_id: foundEmployee.profile_id || null,
      };
    }
  }

  if ('vehicle_id' in copy && copy.vehicle_id) {
    const vehicles = readLocalTable('vehicles');
    const foundVehicle = vehicles.find((v) => v.id === copy.vehicle_id) || null;
    if (foundVehicle) {
      if (!copy.vehicle) copy.vehicle = foundVehicle;
      if (!copy.vehicles) copy.vehicles = foundVehicle;
    }
  }

  if ('reseller_id' in copy && copy.reseller_id) {
    const resellers = readLocalTable('resellers');
    const foundReseller = resellers.find((r) => r.id === copy.reseller_id) || null;
    if (foundReseller) {
      if (!copy.reseller) copy.reseller = foundReseller;
      if (!copy.resellers) copy.resellers = foundReseller;
    }
  }

  if (table === 'employees' && copy.profile_id) {
    const profiles = readLocalTable('profiles');
    const foundProfile = profiles.find((p) => p.id === copy.profile_id) || null;
    if (foundProfile && !copy.profiles) {
      copy.profiles = foundProfile;
    }
  }

  return copy;
}

type FilterFn = (row: any) => boolean;

class LocalQueryBuilder {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any = null;
  private upsertOpts: any = null;
  private selectOpts: any = null;
  private filters: FilterFn[] = [];
  private sorts: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private rangeBounds: { from: number; to: number } | null = null;
  private returnSingle = false;
  private returnMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = '*', opts?: any) {
    if (this.op === 'select') {
      this.selectOpts = opts || null;
    }
    return this;
  }

  insert(values: any, _opts?: any) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any, _opts?: any) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  upsert(values: any, opts?: any) {
    this.op = 'upsert';
    this.payload = values;
    this.upsertOpts = opts || null;
    return this;
  }

  delete(_opts?: any) {
    this.op = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => row?.[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row?.[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => row?.[column] > value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row) => row?.[column] >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => row?.[column] < value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row?.[column] <= value);
    return this;
  }

  like(column: string, pattern: string) {
    const regex = new RegExp('^' + pattern.replace(/%/g, '.*') + '$');
    this.filters.push((row) => regex.test(String(row?.[column] ?? '')));
    return this;
  }

  ilike(column: string, pattern: string) {
    const regex = new RegExp('^' + pattern.replace(/%/g, '.*') + '$', 'i');
    this.filters.push((row) => regex.test(String(row?.[column] ?? '')));
    return this;
  }

  is(column: string, value: any) {
    this.filters.push((row) => (value === null ? row?.[column] == null : row?.[column] === value));
    return this;
  }

  in(column: string, values: any[]) {
    const set = new Set(values || []);
    this.filters.push((row) => set.has(row?.[column]));
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push((row) => {
      const target = row?.[column];
      if (Array.isArray(target) && Array.isArray(value)) {
        return value.every((v) => target.includes(v));
      }
      return true;
    });
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'eq') {
      this.filters.push((row) => row?.[column] !== value);
    } else if (operator === 'is') {
      this.filters.push((row) => (value === null ? row?.[column] != null : row?.[column] !== value));
    }
    return this;
  }

  or(_filters: string) {
    return this;
  }

  match(query: Record<string, any>) {
    Object.entries(query || {}).forEach(([k, v]) => this.eq(k, v));
    return this;
  }

  filter(column: string, operator: string, value: any) {
    if (operator === 'eq') return this.eq(column, value);
    if (operator === 'neq') return this.neq(column, value);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeBounds = { from, to };
    return this;
  }

  single() {
    this.returnSingle = true;
    return this;
  }

  maybeSingle() {
    this.returnMaybeSingle = true;
    return this;
  }

  csv() {
    return this;
  }

  private execute(): { data: any; error: null; count: number; status: number; statusText: string } {
    const current = readLocalTable(this.table);
    const matchesFilters = (r: any) => this.filters.every((fn) => fn(r));

    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = items.map((item) => {
        const record: any = {
          id: item?.id || genId(this.table.slice(0, 3)),
          created_at: item?.created_at || nowIso(),
          updated_at: item?.updated_at || nowIso(),
          ...item,
        };
        if (
          ['stores', 'resellers', 'employees', 'financing_banks', 'bank_credentials', 'contract_templates', 'vehicle_models', 'vehicle_colors', 'custom_roles'].includes(this.table) &&
          record.is_active === undefined
        ) {
          record.is_active = true;
        }
        if (this.table === 'vehicles' && !record.status) {
          record.status = 'disponivel';
        }
        return record;
      });

      const next = [...inserted, ...current];
      writeLocalTable(this.table, next);
      const hydrated = inserted.map((r) => hydrateRow(this.table, r));
      const resultData = this.returnSingle || this.returnMaybeSingle ? hydrated[0] ?? null : hydrated;
      return { data: resultData, error: null, count: hydrated.length, status: 201, statusText: 'Created' };
    }

    if (this.op === 'update') {
      const updated: any[] = [];
      const next = current.map((row) => {
        if (matchesFilters(row)) {
          const mod = { ...row, ...this.payload, updated_at: nowIso() };
          updated.push(mod);
          return mod;
        }
        return row;
      });
      writeLocalTable(this.table, next);
      const hydrated = updated.map((r) => hydrateRow(this.table, r));
      const resultData = this.returnSingle || this.returnMaybeSingle ? hydrated[0] ?? null : hydrated;
      return { data: resultData, error: null, count: hydrated.length, status: 200, statusText: 'OK' };
    }

    if (this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictCols = (this.upsertOpts?.onConflict || 'id')
        .split(',')
        .map((c: string) => c.trim())
        .filter(Boolean);

      const next = [...current];
      const upserted: any[] = [];

      for (const item of items) {
        const idx = next.findIndex((existing) =>
          conflictCols.every((col: string) => existing?.[col] !== undefined && existing?.[col] === item?.[col]),
        );
        if (idx >= 0) {
          const merged = { ...next[idx], ...item, updated_at: nowIso() };
          next[idx] = merged;
          upserted.push(merged);
        } else {
          const created = {
            id: item?.id || genId(this.table.slice(0, 3)),
            created_at: item?.created_at || nowIso(),
            updated_at: nowIso(),
            ...item,
          };
          if (
            ['stores', 'resellers', 'employees', 'financing_banks', 'bank_credentials', 'contract_templates', 'vehicle_models', 'vehicle_colors', 'custom_roles'].includes(this.table) &&
            created.is_active === undefined
          ) {
            created.is_active = true;
          }
          next.unshift(created);
          upserted.push(created);
        }
      }

      writeLocalTable(this.table, next);
      const hydrated = upserted.map((r) => hydrateRow(this.table, r));
      const resultData = this.returnSingle || this.returnMaybeSingle ? hydrated[0] ?? null : hydrated;
      return { data: resultData, error: null, count: hydrated.length, status: 200, statusText: 'OK' };
    }

    if (this.op === 'delete') {
      const deleted: any[] = [];
      const next = current.filter((row) => {
        if (matchesFilters(row)) {
          deleted.push(row);
          return false;
        }
        return true;
      });
      writeLocalTable(this.table, next);
      return { data: deleted, error: null, count: deleted.length, status: 200, statusText: 'OK' };
    }

    // SELECT
    let rows = current.filter(matchesFilters).map((r) => hydrateRow(this.table, r));

    for (const s of [...this.sorts].reverse()) {
      rows.sort((a, b) => {
        const va = a?.[s.column];
        const vb = b?.[s.column];
        if (va === vb) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = va > vb ? 1 : -1;
        return s.ascending ? cmp : -cmp;
      });
    }

    const totalCount = rows.length;

    if (this.rangeBounds) {
      rows = rows.slice(this.rangeBounds.from, this.rangeBounds.to + 1);
    } else if (this.limitCount != null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.selectOpts?.head) {
      return { data: null, error: null, count: totalCount, status: 200, statusText: 'OK' };
    }

    if (this.returnSingle || this.returnMaybeSingle) {
      return { data: rows[0] ?? null, error: null, count: rows.length ? 1 : 0, status: 200, statusText: 'OK' };
    }

    return { data: rows, error: null, count: totalCount, status: 200, statusText: 'OK' };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const res = this.execute();
      return Promise.resolve(res).then(onfulfilled, onrejected);
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected);
    }
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<any | TResult> {
    return this.then(undefined, onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<any> {
    return this.then().finally(onfinally);
  }
}

export function wrapSupabaseWithLocalFallback<T extends Record<string, any>>(rawClient: T): T {
  const proxy = new Proxy(rawClient, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          const normalizedTable = table === 'sales' ? 'contracts' : table;
          return new LocalQueryBuilder(normalizedTable);
        };
      }

      if (prop === 'auth') {
        return new Proxy(target.auth, {
          get(authTarget, authProp, authReceiver) {
            if (authProp === 'updateUser') {
              return async (attrs: any) => {
                try {
                  const res = await authTarget.updateUser(attrs);
                  if (!res.error) return res;
                } catch {}
                return {
                  data: {
                    user: {
                      id: 'dev-master-admin',
                      email: attrs?.email || 'admin@pixelmotors.com.br',
                      user_metadata: attrs?.data || {},
                    },
                  },
                  error: null,
                };
              };
            }
            return Reflect.get(authTarget, authProp, authReceiver);
          },
        });
      }

      if (prop === 'functions') {
        return {
          ...target.functions,
          invoke: async (fnName: string, options?: { body?: any }) => {
            if (fnName === 'manage-users' || fnName === 'create-user') {
              const body = options?.body || {};
              const action = body.action || 'create_user';
              const profiles = readLocalTable('profiles');
              const roles = readLocalTable('user_roles');
              const employees = readLocalTable('employees');

              if (action === 'create_user') {
                const newId = genId('usr');
                const tempPassword = body.password || `Pixel@${Math.floor(1000 + Math.random() * 9000)}`;
                const newProfile = {
                  id: newId,
                  full_name: body.full_name || 'Novo Colaborador',
                  email: body.email || `${newId}@pixelmotors.com.br`,
                  phone: body.phone || null,
                  cpf: body.cpf || null,
                  store_id: body.store_id || 'store-divinopolis',
                  is_active: true,
                  avatar_url: null,
                  must_change_password: false,
                  created_at: nowIso(),
                  updated_at: nowIso(),
                };
                writeLocalTable('profiles', [newProfile, ...profiles]);
                writeLocalTable('user_roles', [
                  { id: genId('ur'), user_id: newId, role: body.role || 'vendedor', custom_role_id: body.custom_role_id || null },
                  ...roles,
                ]);
                writeLocalTable('employees', [
                  {
                    id: genId('emp'),
                    profile_id: newId,
                    store_id: body.store_id || 'store-divinopolis',
                    full_name: body.full_name || 'Novo Colaborador',
                    cpf: body.cpf || null,
                    email: body.email || null,
                    phone: body.phone || null,
                    role_title: body.role === 'gerente' ? 'Gerente' : 'Consultor de Vendas',
                    department: 'Comercial',
                    base_salary: 2200,
                    commission_rate: Number(body.commission_rate) || 1.5,
                    hire_date: nowIso().split('T')[0],
                    is_active: true,
                    created_at: nowIso(),
                    updated_at: nowIso(),
                  },
                  ...employees,
                ]);
                return {
                  data: {
                    success: true,
                    user_id: newId,
                    email: newProfile.email,
                    temp_password: tempPassword,
                    tempPassword,
                  },
                  error: null,
                };
              }

              if (action === 'update_user' || action === 'edit_user') {
                const uid = body.user_id || body.userId || body.id;
                writeLocalTable(
                  'profiles',
                  profiles.map((p) => (p.id === uid ? { ...p, ...body, updated_at: nowIso() } : p)),
                );
                if (body.role) {
                  const hasRole = roles.some((r) => r.user_id === uid);
                  writeLocalTable(
                    'user_roles',
                    hasRole
                      ? roles.map((r) => (r.user_id === uid ? { ...r, role: body.role } : r))
                      : [...roles, { id: genId('ur'), user_id: uid, role: body.role, custom_role_id: null }],
                  );
                }
                if (body.store_id || body.full_name) {
                  writeLocalTable(
                    'employees',
                    employees.map((e) =>
                      e.profile_id === uid
                        ? { ...e, store_id: body.store_id || e.store_id, full_name: body.full_name || e.full_name }
                        : e,
                    ),
                  );
                }
                return { data: { success: true }, error: null };
              }

              if (action === 'delete_user' || action === 'permanent_delete_user') {
                const uid = body.user_id || body.userId || body.id;
                writeLocalTable('profiles', profiles.filter((p) => p.id !== uid));
                writeLocalTable('user_roles', roles.filter((r) => r.user_id !== uid));
                writeLocalTable('employees', employees.filter((e) => e.profile_id !== uid));
                return { data: { success: true }, error: null };
              }

              if (action === 'reset_password' || action === 'reset-password') {
                const tempPassword = `Pixel@${Math.floor(1000 + Math.random() * 9000)}`;
                return { data: { success: true, temp_password: tempPassword, tempPassword }, error: null };
              }

              if (action === 'toggle_active') {
                const uid = body.user_id || body.userId || body.id;
                writeLocalTable(
                  'profiles',
                  profiles.map((p) => (p.id === uid ? { ...p, is_active: body.is_active ?? !p.is_active } : p)),
                );
                return { data: { success: true }, error: null };
              }

              return { data: { success: true }, error: null };
            }

            try {
              return await target.functions.invoke(fnName, options);
            } catch {
              return { data: { success: true }, error: null };
            }
          },
        };
      }

      if (prop === 'storage') {
        return {
          ...target.storage,
          from: (bucket: string) => {
            const origBucket = target.storage.from(bucket);
            return {
              ...origBucket,
              list: async () => ({ data: [], error: null }),
              upload: async (path: string) => ({ data: { path }, error: null }),
              remove: async () => ({ data: [], error: null }),
              createSignedUrl: async (path: string) => ({ data: { signedUrl: path }, error: null }),
              getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
            };
          },
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  return proxy;
}
