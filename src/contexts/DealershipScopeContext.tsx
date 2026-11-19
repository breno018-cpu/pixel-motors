import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import {
  STORE_DIVINOPOLIS_UUID,
  STORE_MONTESCLAROS_UUID,
  STORE_MONTESCLAROS_MULTIMARCAS_UUID,
  isMatchingStore,
} from '@/lib/storeResolution';
import { Building2, Store, Sparkles, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DealershipKey = 'all' | 'divinopolis' | 'montesclaros' | 'multimarcas';

export interface DealershipMeta {
  key: DealershipKey;
  id: string;
  name: string;
  fullName: string;
  shortName: string;
  tag: string;
  prefix: 'DIV' | 'MOC' | 'MLT' | 'ALL';
  city: string;
  badgeClass: string;
  borderClass: string;
  bgLightClass: string;
  textClass: string;
  indicatorColor: string;
  icon: typeof Store;
}

export const DEALERSHIPS_CONFIG: Record<DealershipKey, DealershipMeta> = {
  all: {
    key: 'all',
    id: 'all',
    name: 'Todas as Concessionárias',
    fullName: 'GRUPO L1MA MOTORS • VISÃO CONSOLIDADA',
    shortName: 'Grupo Consolidado',
    tag: 'Holding',
    prefix: 'ALL',
    city: 'Minas Gerais',
    badgeClass: 'bg-primary/10 text-primary border-primary/25',
    borderClass: 'border-primary/30',
    bgLightClass: 'bg-primary/5',
    textClass: 'text-primary',
    indicatorColor: '#3b82f6',
    icon: Layers,
  },
  divinopolis: {
    key: 'divinopolis',
    id: STORE_DIVINOPOLIS_UUID,
    name: 'Concessionária Divinópolis',
    fullName: 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS',
    shortName: 'Divinópolis',
    tag: 'Matriz',
    prefix: 'DIV',
    city: 'Divinópolis/MG',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    borderClass: 'border-emerald-500/30',
    bgLightClass: 'bg-emerald-500/[0.04]',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    indicatorColor: '#10b981',
    icon: Building2,
  },
  montesclaros: {
    key: 'montesclaros',
    id: STORE_MONTESCLAROS_UUID,
    name: 'Concessionária Montes Claros',
    fullName: 'SHINERAY GRUPO L1MA MOTORS MONTES CLAROS',
    shortName: 'Montes Claros',
    tag: 'Polo Norte',
    prefix: 'MOC',
    city: 'Montes Claros/MG',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    borderClass: 'border-blue-500/30',
    bgLightClass: 'bg-blue-500/[0.04]',
    textClass: 'text-blue-600 dark:text-blue-400',
    indicatorColor: '#2563eb',
    icon: Store,
  },
  multimarcas: {
    key: 'multimarcas',
    id: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
    name: 'L1MA MOTORS MULTIMARCAS',
    fullName: 'L1MA MOTORS MULTIMARCAS (SEMINOVOS)',
    shortName: 'Multimarcas',
    tag: 'Seminovos',
    prefix: 'MLT',
    city: 'Montes Claros/MG',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
    borderClass: 'border-purple-500/30',
    bgLightClass: 'bg-purple-500/[0.04]',
    textClass: 'text-purple-600 dark:text-purple-400',
    indicatorColor: '#a855f7',
    icon: Sparkles,
  },
};

const STORAGE_SCOPE_KEY = 'dealflow_active_dealership_scope_v1';

export function resolveStoreToKey(storeIdOrName?: string | null): 'divinopolis' | 'montesclaros' | 'multimarcas' {
  if (!storeIdOrName) return 'divinopolis';
  const clean = String(storeIdOrName).toLowerCase().trim();

  if (
    clean === STORE_MONTESCLAROS_MULTIMARCAS_UUID.toLowerCase() ||
    clean === 'store-multimarcas' ||
    clean === 'multimarcas' ||
    clean.includes('multi') ||
    clean.includes('seminovos')
  ) {
    return 'multimarcas';
  }

  if (
    clean === STORE_MONTESCLAROS_UUID.toLowerCase() ||
    clean === 'store-montesclaros' ||
    clean === 'montesclaros' ||
    clean.includes('montes') ||
    clean.includes('moc')
  ) {
    return 'montesclaros';
  }

  return 'divinopolis';
}

interface DealershipScopeContextType {
  activeScope: DealershipKey;
  activeMeta: DealershipMeta;
  setActiveScope: (scope: DealershipKey) => void;
  matchesScope: (storeIdOrName?: string | null) => boolean;
  dealershipsList: DealershipMeta[];
  resolveDealership: (storeIdOrName?: string | null) => DealershipMeta;
}

const DealershipScopeContext = createContext<DealershipScopeContextType | undefined>(undefined);

export function DealershipScopeProvider({ children }: { children: ReactNode }) {
  const [activeScope, setActiveScopeState] = useState<DealershipKey>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCOPE_KEY);
      if (saved && ['all', 'divinopolis', 'montesclaros', 'multimarcas'].includes(saved)) {
        return saved as DealershipKey;
      }
    } catch {}
    return 'all';
  });

  const setActiveScope = (newScope: DealershipKey) => {
    setActiveScopeState(newScope);
    try {
      localStorage.setItem(STORAGE_SCOPE_KEY, newScope);
      window.dispatchEvent(new CustomEvent('dealflow:dealership-scope-changed', { detail: { scope: newScope } }));
    } catch {}
  };

  useEffect(() => {
    const handleCustomChange = (e: any) => {
      if (e.detail?.scope && e.detail.scope !== activeScope) {
        setActiveScopeState(e.detail.scope);
      }
    };
    window.addEventListener('dealflow:dealership-scope-changed', handleCustomChange);
    return () => window.removeEventListener('dealflow:dealership-scope-changed', handleCustomChange);
  }, [activeScope]);

  const activeMeta = useMemo(() => DEALERSHIPS_CONFIG[activeScope], [activeScope]);

  const matchesScope = (storeIdOrName?: string | null): boolean => {
    if (activeScope === 'all') return true;
    const itemKey = resolveStoreToKey(storeIdOrName);
    return itemKey === activeScope;
  };

  const dealershipsList = useMemo(() => [
    DEALERSHIPS_CONFIG.all,
    DEALERSHIPS_CONFIG.divinopolis,
    DEALERSHIPS_CONFIG.montesclaros,
    DEALERSHIPS_CONFIG.multimarcas,
  ], []);

  const resolveDealership = (storeIdOrName?: string | null): DealershipMeta => {
    const key = resolveStoreToKey(storeIdOrName);
    return DEALERSHIPS_CONFIG[key];
  };

  return (
    <DealershipScopeContext.Provider
      value={{
        activeScope,
        activeMeta,
        setActiveScope,
        matchesScope,
        dealershipsList,
        resolveDealership,
      }}
    >
      {children}
    </DealershipScopeContext.Provider>
  );
}

export function useDealershipScope() {
  const ctx = useContext(DealershipScopeContext);
  if (!ctx) {
    // Fallback gracioso se usado fora do Provider
    const fallbackMeta = DEALERSHIPS_CONFIG.all;
    return {
      activeScope: 'all' as DealershipKey,
      activeMeta: fallbackMeta,
      setActiveScope: () => {},
      matchesScope: () => true,
      dealershipsList: [
        DEALERSHIPS_CONFIG.all,
        DEALERSHIPS_CONFIG.divinopolis,
        DEALERSHIPS_CONFIG.montesclaros,
        DEALERSHIPS_CONFIG.multimarcas,
      ],
      resolveDealership: (storeIdOrName?: string | null) => {
        const key = resolveStoreToKey(storeIdOrName);
        return DEALERSHIPS_CONFIG[key];
      },
    };
  }
  return ctx;
}

/**
 * Componente Visual Reutilizável: Badge Oficial da Concessionária
 */
export function DealershipBadge({
  storeIdOrName,
  className,
  showPrefix = true,
}: {
  storeIdOrName?: string | null;
  className?: string;
  showPrefix?: boolean;
}) {
  const key = resolveStoreToKey(storeIdOrName);
  const meta = DEALERSHIPS_CONFIG[key];
  const Icon = meta.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap shadow-xs transition-colors',
        meta.badgeClass,
        className
      )}
      title={`${meta.fullName} • Código Contrato: ${meta.prefix}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{meta.shortName}</span>
      {showPrefix && (
        <span className="font-mono text-[9px] opacity-75 font-black ml-0.5">({meta.prefix})</span>
      )}
    </Badge>
  );
}
