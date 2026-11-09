import {
  Car,
  LayoutDashboard,
  Store,
  Users,
  FileText,
  FileCheck,
  Settings,
  ShoppingCart,
  Wallet,
  Bike,
  Landmark,
  BarChart3,
  Building2,
  Megaphone,
  Route,
  ShieldCheck,
  FileSpreadsheet,
  Truck,
  Boxes,
} from 'lucide-react';

export type SidebarGroup = 'operacao' | 'documentos' | 'gestao' | 'sistema';

export const SIDEBAR_GROUPS: { key: SidebarGroup; label: string }[] = [
  { key: 'operacao', label: 'Operação' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'sistema', label: 'Sistema' },
];

export type SidebarMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  roles?: string[];
  group: SidebarGroup;
};

export const ALL_MENU_ITEMS: SidebarMenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', group: 'operacao' },
  { icon: Car, label: 'Estoque', path: '/vehicles', group: 'operacao' },
  { icon: ShieldCheck, label: 'Investigação & Laudos', path: '/inspections', group: 'operacao' },
  { icon: ShoppingCart, label: 'Vendas', path: '/sales', group: 'operacao' },
  { icon: Truck, label: 'Logística & Entregas', path: '/logistics', group: 'operacao' },
  { icon: Route, label: 'Vendas Externas', path: '/external-sales', roles: ['admin', 'gerente', 'vendedor_externo'], group: 'operacao' },
  { icon: Landmark, label: 'Financiamentos', path: '/financing', roles: ['admin', 'gerente', 'vendedor', 'vendedor_plus', 'vendedor_externo'], group: 'operacao' },
  { icon: FileText, label: 'Contratos', path: '/contracts', roles: ['admin', 'gerente'], group: 'documentos' },
  { icon: FileText, label: 'Consignações', path: '/consignments', roles: ['admin', 'gerente'], group: 'documentos' },
  { icon: Bike, label: 'NF de Motos', path: '/moto-invoices', roles: ['admin', 'gerente'], group: 'documentos' },
  { icon: Building2, label: 'Organização', path: '/organization', roles: ['admin', 'gerente'], group: 'gestao' },
  { icon: Wallet, label: 'Folha de Pagamento', path: '/payroll', roles: ['admin', 'gerente'], group: 'gestao' },
  { icon: Megaphone, label: 'Anúncios', path: '/ads', roles: ['admin', 'gerente'], group: 'gestao' },
  { icon: BarChart3, label: 'Relatórios e Metas', path: '/reports', roles: ['admin', 'gerente'], group: 'gestao' },
  { icon: FileSpreadsheet, label: 'Planilhas', path: '/spreadsheets', group: 'gestao' },
  { icon: ShieldCheck, label: 'Ala Master', path: '/admin', roles: ['admin', 'gerente'], group: 'gestao' },
  { icon: Settings, label: 'Configurações', path: '/settings', group: 'sistema' },
];
