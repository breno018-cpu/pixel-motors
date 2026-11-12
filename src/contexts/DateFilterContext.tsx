import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useContracts } from '@/hooks/useContracts';
import { getLiveSheetRows } from '@/lib/dealershipSheetParser';

export interface AvailablePeriod {
  key: string; // e.g. "2026-10", "2026-11"
  label: string; // e.g. "Outubro / 2026"
  count: number;
  year: number;
  month: number; // 1-12
}

interface DateFilterContextType {
  periodFilter: string; // 'all' | 'month' | 'lastmonth' | 'today' | '7d' | '30d' | '90d' | '365d' | 'YYYY-MM'
  setPeriodFilter: (period: string) => void;
  availablePeriods: AvailablePeriod[];
  isDateInPeriod: (date: any) => boolean;
  activePeriodLabel: string;
  defaultMonthKey: string;
  resetToActiveMonth: () => void;
  setAllPeriods: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STORAGE_KEY = 'dealflow_active_period_filter_v1';

export function parseAnyDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Formato brasileiro DD/MM/YYYY ou DD/MM/YYYY HH:mm
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
      const parts = trimmed.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2].slice(0, 4), 10);
      const d = new Date(year, month, day, 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const { data: contracts = [] } = useContracts();
  const [sheetVersion, setSheetVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setSheetVersion((v) => v + 1);
    window.addEventListener('dealflow:sheet-updated', handleUpdate);
    window.addEventListener('dealflow:sales-updated', handleUpdate);
    return () => {
      window.removeEventListener('dealflow:sheet-updated', handleUpdate);
      window.removeEventListener('dealflow:sales-updated', handleUpdate);
    };
  }, []);

  // Detecta dinamicamente todas as competências/meses com dados registrados
  const availablePeriods = useMemo(() => {
    const monthsMap = new Map<string, { key: string; label: string; count: number; year: number; month: number }>();
    const sheetRows = getLiveSheetRows();

    // 1. Processa vendas da planilha
    sheetRows.forEach((r) => {
      let d = parseAnyDate(r.data);
      if (!d && r.month_key && r.month_key.includes('-')) {
        const [y, m] = r.month_key.split('-').map(Number);
        d = new Date(y, m - 1, 15, 12, 0, 0);
      }
      if (d) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${MONTH_NAMES[m]} / ${y}`;
        const existing = monthsMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          monthsMap.set(key, { key, label, count: 1, year: y, month: m + 1 });
        }
      }
    });

    // 2. Processa contratos do banco de dados
    contracts.forEach((c) => {
      // Ignora contratos gerados a partir da planilha para evitar contagem duplicada
      if (c.id && (c.id.startsWith('sheet-') || c.id.startsWith('row-v9-') || c.id.startsWith('venda-'))) return;
      const d = parseAnyDate(c.signed_at || c.created_at);
      if (d) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${MONTH_NAMES[m]} / ${y}`;
        const existing = monthsMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          monthsMap.set(key, { key, label, count: 1, year: y, month: m + 1 });
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [contracts, sheetVersion]);

  // Determina o mês ativo padrão (o mais recente com dados ou o mês corrente)
  const defaultMonthKey = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Se há dados no mês corrente do calendário, usa ele
    const hasCurrent = availablePeriods.some((p) => p.key === currentKey && p.count > 0);
    if (hasCurrent) return currentKey;

    // Caso contrário, se há algum mês com dados (ex: '2026-10'), usa o mais recente com vendas
    if (availablePeriods.length > 0) {
      return availablePeriods[0].key;
    }

    return currentKey;
  }, [availablePeriods]);

  // Estado do filtro ativo (persistido no localStorage)
  const [periodFilter, setPeriodFilterState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    // Padrão inicial: sempre o mês ativo com dados
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return currentKey;
  });

  // Se o filtro estava com mês vazio ou inválido, alinha com o defaultMonthKey
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved && defaultMonthKey && defaultMonthKey !== periodFilter) {
      setPeriodFilterState(defaultMonthKey);
    }
  }, [defaultMonthKey, periodFilter]);

  const setPeriodFilter = useCallback((newPeriod: string) => {
    setPeriodFilterState(newPeriod);
    try {
      localStorage.setItem(STORAGE_KEY, newPeriod);
    } catch {
      // ignore
    }
  }, []);

  const resetToActiveMonth = useCallback(() => {
    setPeriodFilter(defaultMonthKey);
  }, [defaultMonthKey, setPeriodFilter]);

  const setAllPeriods = useCallback(() => {
    setPeriodFilter('all');
  }, [setPeriodFilter]);

  // Verificador universal de pertencimento ao período ativo
  const isDateInPeriod = useCallback((dateVal: any): boolean => {
    if (periodFilter === 'all') return true;

    const d = parseAnyDate(dateVal);
    if (!d) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (periodFilter === 'month') {
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }

    if (periodFilter === 'lastmonth') {
      const lm = currentMonth === 0 ? 11 : currentMonth - 1;
      const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getFullYear() === ly && d.getMonth() === lm;
    }

    if (periodFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d >= todayStart;
    }

    if (periodFilter === '7d') {
      const cutoff = new Date(now.getTime() - 7 * 86400000);
      return d >= cutoff;
    }

    if (periodFilter === '30d') {
      const cutoff = new Date(now.getTime() - 30 * 86400000);
      return d >= cutoff;
    }

    if (periodFilter === '90d') {
      const cutoff = new Date(now.getTime() - 90 * 86400000);
      return d >= cutoff;
    }

    if (periodFilter === '365d' || periodFilter === 'year-2026') {
      return d.getFullYear() === 2026 || d.getFullYear() === currentYear;
    }

    // Filtro por chave de mês específica (Ex: '2026-10')
    if (periodFilter.includes('-')) {
      const [yStr, mStr] = periodFilter.split('-');
      const targetYear = parseInt(yStr, 10);
      const targetMonth = parseInt(mStr, 10);
      if (!isNaN(targetYear) && !isNaN(targetMonth)) {
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth - 1;
      }
    }

    return true;
  }, [periodFilter]);

  // Label amigável do período ativo
  const activePeriodLabel = useMemo(() => {
    if (periodFilter === 'all') return 'Todo o Histórico (Todos)';
    if (periodFilter === 'month') {
      const now = new Date();
      return `Este mês (${MONTH_NAMES[now.getMonth()]} / ${now.getFullYear()})`;
    }
    if (periodFilter === 'lastmonth') return 'Mês anterior';
    if (periodFilter === 'today') return 'Hoje';
    if (periodFilter === '7d') return 'Últimos 7 dias';
    if (periodFilter === '30d') return 'Últimos 30 dias';
    if (periodFilter === '90d') return 'Último Trimestre';
    if (periodFilter === '365d' || periodFilter === 'year-2026') return 'Ano de 2026';

    const matchPeriod = availablePeriods.find((p) => p.key === periodFilter);
    if (matchPeriod) return matchPeriod.label;

    if (periodFilter.includes('-')) {
      const [y, m] = periodFilter.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return `${MONTH_NAMES[m - 1]} / ${y}`;
      }
    }

    return periodFilter;
  }, [periodFilter, availablePeriods]);

  const value = useMemo(
    () => ({
      periodFilter,
      setPeriodFilter,
      availablePeriods,
      isDateInPeriod,
      activePeriodLabel,
      defaultMonthKey,
      resetToActiveMonth,
      setAllPeriods,
    }),
    [
      periodFilter,
      setPeriodFilter,
      availablePeriods,
      isDateInPeriod,
      activePeriodLabel,
      defaultMonthKey,
      resetToActiveMonth,
      setAllPeriods,
    ]
  );

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter deve ser usado dentro de um DateFilterProvider');
  }
  return context;
}
