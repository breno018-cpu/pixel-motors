export type DataScope = 'own' | 'store' | 'all';

export type PermissionDef = { key: string; label: string; hint?: string };
export type PermissionGroup = { key: string; label: string; items: PermissionDef[] };

export const PAGE_PERMISSIONS: Record<string, string> = {
  '/': 'page.dashboard',
  '/vehicles': 'page.vehicles',
  '/inbound-cargo': 'page.inbound_cargo',
  '/sales': 'page.sales',
  '/external-sales': 'page.external_sales',
  '/financing': 'page.financing',
  '/contracts': 'page.contracts',
  '/consignments': 'page.consignments',
  '/moto-invoices': 'page.moto_invoices',
  '/organization': 'page.organization',
  '/payroll': 'page.payroll',
  '/ads': 'page.ads',
  '/reports': 'page.reports',
  '/spreadsheets': 'page.spreadsheets',
  '/inspections': 'page.inspections',
  '/admin': 'page.admin',
  '/settings': 'page.settings',
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'pages',
    label: 'Telas que acessa',
    items: [
      { key: 'page.dashboard', label: 'Dashboard' },
      { key: 'page.vehicles', label: 'Estoque' },
      { key: 'page.inbound_cargo', label: 'Controle de Entrada (Caminhão)' },
      { key: 'page.sales', label: 'Vendas' },
      { key: 'page.external_sales', label: 'Vendas Externas' },
      { key: 'page.financing', label: 'Financiamentos' },
      { key: 'page.contracts', label: 'Contratos' },
      { key: 'page.consignments', label: 'Consignações' },
      { key: 'page.moto_invoices', label: 'NF de Motos' },
      { key: 'page.organization', label: 'Organização' },
      { key: 'page.payroll', label: 'Folha de Pagamento' },
      { key: 'page.ads', label: 'Anúncios' },
      { key: 'page.reports', label: 'Relatórios e Metas' },
      { key: 'page.spreadsheets', label: 'Planilhas Customizadas' },
      { key: 'page.inspections', label: 'Laudo Cautelar & Procedência' },
      { key: 'page.admin', label: 'Ala Administrativa Master' },
      { key: 'page.settings', label: 'Configurações' },
    ],
  },
  {
    key: 'sales',
    label: 'Vendas',
    items: [
      { key: 'sales.create', label: 'Registrar vendas' },
      { key: 'sales.edit', label: 'Editar vendas' },
      { key: 'sales.delete', label: 'Cancelar/excluir vendas' },
    ],
  },
  {
    key: 'vehicles',
    label: 'Veículos',
    items: [
      { key: 'vehicles.create', label: 'Cadastrar veículos' },
      { key: 'vehicles.edit', label: 'Editar veículos' },
      { key: 'vehicles.delete', label: 'Excluir veículos' },
      { key: 'vehicles.unlock_all', label: 'Destravar todos os campos do chassi' },
      { key: 'vehicles.unlock_year', label: 'Ajustar só ano e câmbio' },
    ],
  },
  {
    key: 'management',
    label: 'Gestão',
    items: [
      { key: 'finance.view_margins', label: 'Ver margens e custos' },
      { key: 'data.export', label: 'Exportar dados' },
      { key: 'contracts.manage', label: 'Gerenciar modelos de contrato' },
      { key: 'payroll.manage', label: 'Gerenciar folha' },
      { key: 'users.manage', label: 'Gerenciar usuários' },
      { key: 'access.elevated', label: 'Acesso de gestão completo', hint: 'Mesmo nível de um gerente em todo o sistema' },
    ],
  },
  {
    key: 'logistics',
    label: 'Logística & Transporte',
    items: [
      { key: 'logistics.view_routes', label: 'Ver rotas e simular custos de frete' },
      { key: 'logistics.manage_methods', label: 'Gerenciar métodos e tarifas de transporte' },
      { key: 'logistics.dispatch', label: 'Autorizar despacho e romaneio de carga' },
      { key: 'logistics.fleet_audit', label: 'Auditoria de sinistros e checklist de cegonha' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const SCOPE_OPTIONS: { value: DataScope; label: string; desc: string }[] = [
  { value: 'own', label: 'Só as próprias', desc: 'Vê apenas as vendas que registrou' },
  { value: 'store', label: 'Da loja dele', desc: 'Vê as vendas da loja vinculada' },
  { value: 'all', label: 'Todas as lojas', desc: 'Vê as vendas de todas as lojas' },
];

export const ROLE_COLORS: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  success: 'bg-success/10 text-success border-success/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};
