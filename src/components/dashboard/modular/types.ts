export type WidgetColSpan = 'full' | 'two-thirds' | 'half' | 'third';

export type WidgetCategory =
  | 'kpis'
  | 'finance'
  | 'sales'
  | 'team'
  | 'stock'
  | 'logistics'
  | 'geo'
  | 'flow';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultColSpan: WidgetColSpan;
  allowedColSpans: WidgetColSpan[];
  icon: string; // nome do ícone
  badge?: string;
}

export interface DashboardBlockConfig {
  id: string;
  widgetId: string;
  colSpan: WidgetColSpan;
  visible: boolean;
  order: number;
  customTitle?: string;
}

export interface DashboardPreset {
  id: string;
  name: string;
  description: string;
  blocks: DashboardBlockConfig[];
}

export function getColSpanClass(colSpan: WidgetColSpan): string {
  switch (colSpan) {
    case 'full':
      return 'lg:col-span-12 md:col-span-2 col-span-1';
    case 'two-thirds':
      return 'lg:col-span-8 md:col-span-2 col-span-1';
    case 'half':
      return 'lg:col-span-6 md:col-span-1 col-span-1';
    case 'third':
      return 'lg:col-span-4 md:col-span-1 col-span-1';
    default:
      return 'lg:col-span-6 md:col-span-1 col-span-1';
  }
}

