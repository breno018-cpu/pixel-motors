import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import {
  STORE_DIVINOPOLIS_UUID,
  STORE_MONTESCLAROS_UUID,
  STORE_MONTESCLAROS_MULTIMARCAS_UUID,
  isMatchingStore,
  formatStoreShortName,
  getContractPrefix,
} from '@/lib/storeResolution';
import { useStores, DEFAULT_DEALERSHIP_STORES } from '@/hooks/useStores';
import { Building2, Store, Sparkles, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DealershipKey = string;

export interface DealershipMeta {
  key: string;
  id: string;
  name: string;
  fullName: string;
  shortName: string;
  tag: string;
  prefix: string;
  city: string;
  badgeClass: string;
  borderClass: string;
  bgLightClass: string;
  textClass: string;
  indicatorColor: string;
  icon: typeof Store;
  legacyKey?: 'all' | 'divinopolis' | 'montesclaros' | 'multimarcas';
}

export const DEALERSHIPS_CONFIG: Record<string, DealershipMeta> = {
  all: {
    key: 'all',
    id: 'all',
    legacyKey: 'all',
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
    legacyKey: 'divinopolis',
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
    legacyKey: 'montesclaros',
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
    legacyKey: 'multimarcas',
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

export function resolveStoreToKey(storeIdOrName?: string | null): string {
  if (!storeIdOrName || storeIdOrName === 'all') return 'all';
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

  if (
    clean === STORE_DIVINOPOLIS_UUID.toLowerCase() ||
    clean === 'store-divinopolis' ||
    clean === 'divinopolis' ||
    clean.includes('divin') ||
    clean.includes('matriz')
  ) {
    return 'divinopolis';
  }

  // Consulta se é UUID ou nome de outra loja no cache local
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('dealflow_custom_stores_v1') : null;
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const found = list.find((s) => s.id?.toLowerCase() === clean || s.name?.toLowerCase() === clean);
        if (found) return found.id;
      }
    }
  } catch {}

  return clean;
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
  const { data: stores = [] } = useStores();

  const [activeScope, setActiveScopeState] = useState<DealershipKey>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCOPE_KEY);
      if (saved) return saved;
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

  // Lista dinâmica e 100% atualizada de todas as concessionárias
  const dealershipsList = useMemo(() => {
    const list: DealershipMeta[] = [
      {
        key: 'all',
        id: 'all',
        legacyKey: 'all',
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
    ];

    const dynamicPalette = [
      {
        badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        borderClass: 'border-amber-500/30',
        bgLightClass: 'bg-amber-500/[0.04]',
        textClass: 'text-amber-600 dark:text-amber-400',
        indicatorColor: '#f59e0b',
        icon: Building2,
      },
      {
        badgeClass: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
        borderClass: 'border-teal-500/30',
        bgLightClass: 'bg-teal-500/[0.04]',
        textClass: 'text-teal-600 dark:text-teal-400',
        indicatorColor: '#14b8a6',
        icon: Store,
      },
      {
        badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
        borderClass: 'border-rose-500/30',
        bgLightClass: 'bg-rose-500/[0.04]',
        textClass: 'text-rose-600 dark:text-rose-400',
        indicatorColor: '#f43f5e',
        icon: Building2,
      },
      {
        badgeClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
        borderClass: 'border-cyan-500/30',
        bgLightClass: 'bg-cyan-500/[0.04]',
        textClass: 'text-cyan-600 dark:text-cyan-400',
        indicatorColor: '#06b6d4',
        icon: Store,
      },
      {
        badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
        borderClass: 'border-indigo-500/30',
        bgLightClass: 'bg-indigo-500/[0.04]',
        textClass: 'text-indigo-600 dark:text-indigo-400',
        indicatorColor: '#6366f1',
        icon: Building2,
      },
    ];

    let customIndex = 0;
    const activeStores = (stores || []).filter((s) => s.is_active !== false);
    const effectiveStores = activeStores.length > 0 ? activeStores : DEFAULT_DEALERSHIP_STORES;

    for (const store of effectiveStores) {
      const sId = (store.id || '').toLowerCase();
      const sName = (store.name || '').toLowerCase();
      const sCity = (store.city || '').toLowerCase();

      // Divinópolis
      if (
        sId === STORE_DIVINOPOLIS_UUID.toLowerCase() ||
        sId === 'store-divinopolis' ||
        sCity.includes('divin') ||
        sName.includes('divin')
      ) {
        list.push({
          key: store.id,
          id: store.id,
          legacyKey: 'divinopolis',
          name: store.name,
          fullName: store.name || 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS',
          shortName: formatStoreShortName(store.name || 'Divinópolis'),
          tag: 'Matriz',
          prefix: 'DIV',
          city: store.city ? `${store.city}/${store.state || 'MG'}` : 'Divinópolis/MG',
          badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
          borderClass: 'border-emerald-500/30',
          bgLightClass: 'bg-emerald-500/[0.04]',
          textClass: 'text-emerald-600 dark:text-emerald-400',
          indicatorColor: '#10b981',
          icon: Building2,
        });
        continue;
      }

      // Montes Claros
      if (
        (sId === STORE_MONTESCLAROS_UUID.toLowerCase() ||
          sId === 'store-montesclaros' ||
          sCity.includes('montes') ||
          sName.includes('montes') ||
          sName.includes('moc')) &&
        !sName.includes('multimarcas') &&
        !sName.includes('seminovos')
      ) {
        list.push({
          key: store.id,
          id: store.id,
          legacyKey: 'montesclaros',
          name: store.name,
          fullName: store.name || 'SHINERAY GRUPO L1MA MOTORS MONTES CLAROS',
          shortName: formatStoreShortName(store.name || 'Montes Claros'),
          tag: 'Polo Norte',
          prefix: 'MOC',
          city: store.city ? `${store.city}/${store.state || 'MG'}` : 'Montes Claros/MG',
          badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
          borderClass: 'border-blue-500/30',
          bgLightClass: 'bg-blue-500/[0.04]',
          textClass: 'text-blue-600 dark:text-blue-400',
          indicatorColor: '#2563eb',
          icon: Store,
        });
        continue;
      }

      // Multimarcas
      if (
        sId === STORE_MONTESCLAROS_MULTIMARCAS_UUID.toLowerCase() ||
        sId === 'store-multimarcas' ||
        sName.includes('multimarcas') ||
        sName.includes('seminovos')
      ) {
        list.push({
          key: store.id,
          id: store.id,
          legacyKey: 'multimarcas',
          name: store.name,
          fullName: store.name || 'L1MA MOTORS MULTIMARCAS',
          shortName: formatStoreShortName(store.name || 'Multimarcas'),
          tag: 'Seminovos',
          prefix: 'MLT',
          city: store.city ? `${store.city}/${store.state || 'MG'}` : 'Montes Claros/MG',
          badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
          borderClass: 'border-purple-500/30',
          bgLightClass: 'bg-purple-500/[0.04]',
          textClass: 'text-purple-600 dark:text-purple-400',
          indicatorColor: '#a855f7',
          icon: Sparkles,
        });
        continue;
      }

      // Concessionária Adicionada Dinamicamente (ex: Patos de Minas)
      const theme = dynamicPalette[customIndex % dynamicPalette.length];
      customIndex++;

      list.push({
        key: store.id,
        id: store.id,
        name: store.name,
        fullName: store.name,
        shortName: formatStoreShortName(store.name || store.city || 'Filial'),
        tag: store.city || 'Filial',
        prefix: getContractPrefix(store.id, store.name),
        city: store.city ? `${store.city}/${store.state || 'MG'}` : 'Minas Gerais',
        badgeClass: theme.badgeClass,
        borderClass: theme.borderClass,
        bgLightClass: theme.bgLightClass,
        textClass: theme.textClass,
        indicatorColor: theme.indicatorColor,
        icon: theme.icon,
      });
    }

    return list;
  }, [stores]);

  const activeMeta = useMemo(() => {
    const cleanScope = (activeScope || '').toLowerCase().trim();
    const found = dealershipsList.find(
      (d) =>
        d.key.toLowerCase() === cleanScope ||
        d.id.toLowerCase() === cleanScope ||
        (d.legacyKey && d.legacyKey.toLowerCase() === cleanScope)
    );
    return found || dealershipsList[0];
  }, [dealershipsList, activeScope]);

  const matchesScope = (storeIdOrName?: string | null): boolean => {
    if (activeScope === 'all') return true;
    if (!storeIdOrName) return false;

    const cleanScope = activeScope.toLowerCase().trim();
    const cleanItem = String(storeIdOrName).toLowerCase().trim();

    if (cleanItem === cleanScope) return true;

    // Busca o meta correspondente ao escopo ativo
    const targetMeta = dealershipsList.find(
      (d) =>
        d.key.toLowerCase() === cleanScope ||
        d.id.toLowerCase() === cleanScope ||
        (d.legacyKey && d.legacyKey.toLowerCase() === cleanScope)
    );
    if (!targetMeta) return false;

    return (
      isMatchingStore(cleanItem, targetMeta.id) ||
      isMatchingStore(cleanItem, targetMeta.key) ||
      (targetMeta.legacyKey ? isMatchingStore(cleanItem, targetMeta.legacyKey) : false)
    );
  };

  const resolveDealership = (storeIdOrName?: string | null): DealershipMeta => {
    if (!storeIdOrName || storeIdOrName === 'all') return dealershipsList[0];
    const clean = String(storeIdOrName).toLowerCase().trim();

    const found = dealershipsList.find((d) => {
      if (d.key === 'all') return false;
      return (
        d.id.toLowerCase() === clean ||
        d.key.toLowerCase() === clean ||
        (d.legacyKey && d.legacyKey.toLowerCase() === clean) ||
        d.name.toLowerCase() === clean ||
        d.shortName.toLowerCase() === clean ||
        (clean.length >= 3 && d.name.toLowerCase().includes(clean))
      );
    });

    if (found) return found;

    // Fallback dinâmico para loja desconhecida
    return {
      key: clean,
      id: clean,
      name: formatStoreShortName(clean),
      fullName: clean,
      shortName: formatStoreShortName(clean),
      tag: 'Filial',
      prefix: getContractPrefix(clean, clean),
      city: 'Minas Gerais',
      badgeClass: 'bg-primary/10 text-primary border-primary/25',
      borderClass: 'border-primary/30',
      bgLightClass: 'bg-primary/5',
      textClass: 'text-primary',
      indicatorColor: '#3b82f6',
      icon: Store,
    };
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
      dealershipsList: Object.values(DEALERSHIPS_CONFIG),
      resolveDealership: (storeIdOrName?: string | null) => {
        const key = resolveStoreToKey(storeIdOrName);
        return DEALERSHIPS_CONFIG[key] || fallbackMeta;
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
  const scopeCtx = useDealershipScope();
  const meta = storeIdOrName ? scopeCtx.resolveDealership(storeIdOrName) : scopeCtx.activeMeta;
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
