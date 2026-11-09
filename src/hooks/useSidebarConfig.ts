import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_MENU_ITEMS, SidebarMenuItem } from '@/lib/sidebarMenu';
import { PAGE_PERMISSIONS } from '@/lib/permissions';

export type SidebarConfig = {
  order: string[]; // paths in display order
  hidden: string[]; // paths the user chose to hide
};

const STORAGE_PREFIX = 'sidebar-config:';
const EVENT = 'sidebar-config-changed';

const defaultConfig = (): SidebarConfig => ({
  order: ALL_MENU_ITEMS.map((i) => i.path),
  hidden: [],
});

function load(key: string): SidebarConfig {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as SidebarConfig;
    const known = new Set(ALL_MENU_ITEMS.map((i) => i.path));
    const order = parsed.order?.filter((p) => known.has(p)) ?? [];
    // append any new items not yet in stored order
    for (const item of ALL_MENU_ITEMS) {
      if (!order.includes(item.path)) order.push(item.path);
    }
    return {
      order,
      hidden: parsed.hidden?.filter((p) => known.has(p)) ?? [],
    };
  } catch {
    return defaultConfig();
  }
}

export function useSidebarConfig() {
  const { profile, can } = useAuth();
  const key = `${STORAGE_PREFIX}${profile?.id ?? 'anon'}`;
  const [config, setConfig] = useState<SidebarConfig>(() => load(key));

  useEffect(() => {
    setConfig(load(key));
  }, [key]);

  useEffect(() => {
    const handler = () => setConfig(load(key));
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, [key]);

  const persist = useCallback(
    (next: SidebarConfig) => {
      localStorage.setItem(key, JSON.stringify(next));
      setConfig(next);
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  const move = useCallback(
    (path: string, delta: number) => {
      const order = [...config.order];
      const idx = order.indexOf(path);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= order.length) return;
      [order[idx], order[target]] = [order[target], order[idx]];
      persist({ ...config, order });
    },
    [config, persist],
  );

  const toggleHidden = useCallback(
    (path: string) => {
      const hidden = config.hidden.includes(path)
        ? config.hidden.filter((p) => p !== path)
        : [...config.hidden, path];
      persist({ ...config, hidden });
    },
    [config, persist],
  );

  const reset = useCallback(() => persist(defaultConfig()), [persist]);

  // Items the current user is allowed to see (role filter)
  const allowedItems: SidebarMenuItem[] = ALL_MENU_ITEMS.filter((item) => {
    const perm = PAGE_PERMISSIONS[item.path];
    return perm ? can(perm) : true;
  });

  const allowedPaths = new Set(allowedItems.map((i) => i.path));

  // Items rendered in the sidebar (filtered + ordered + hidden removed)
  const visibleItems: SidebarMenuItem[] = config.order
    .filter((p) => allowedPaths.has(p) && !config.hidden.includes(p))
    .map((p) => allowedItems.find((i) => i.path === p)!)
    .filter(Boolean);

  // Items shown in the customizer (everything the user is allowed to see)
  const configurableItems: SidebarMenuItem[] = config.order
    .filter((p) => allowedPaths.has(p))
    .map((p) => allowedItems.find((i) => i.path === p)!)
    .filter(Boolean);

  return {
    config,
    visibleItems,
    configurableItems,
    move,
    toggleHidden,
    reset,
  };
}