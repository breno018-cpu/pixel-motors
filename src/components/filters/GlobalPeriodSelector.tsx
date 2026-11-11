import React from 'react';
import { Calendar, Filter, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDateFilter } from '@/contexts/DateFilterContext';

interface GlobalPeriodSelectorProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export function GlobalPeriodSelector({ className = '', variant = 'compact' }: GlobalPeriodSelectorProps) {
  const {
    periodFilter,
    setPeriodFilter,
    availablePeriods,
    activePeriodLabel,
  } = useDateFilter();

  const isAll = periodFilter === 'all';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Select value={periodFilter} onValueChange={setPeriodFilter}>
        <SelectTrigger
          className={`h-8 sm:h-9 text-xs font-semibold rounded-xl border transition-all ${
            isAll
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-card/90 border-border/80 text-foreground hover:bg-card shadow-xs'
          } ${variant === 'compact' ? 'max-w-[170px] sm:max-w-[210px]' : 'w-full'}`}
          title="Filtro de Competência e Período Global"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Calendar
              className={`w-3.5 h-3.5 shrink-0 ${
                isAll ? 'text-amber-500' : 'text-primary'
              }`}
            />
            <span className="truncate">{activePeriodLabel}</span>
          </div>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[240px] max-h-[360px]">
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1">
              Visão Ampla
            </SelectLabel>
            <SelectItem value="all" className="font-semibold text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Todo o Histórico (Todos)
              </span>
            </SelectItem>
          </SelectGroup>

          {availablePeriods.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1">
                  Competências / Meses com Vendas
                </SelectLabel>
                {availablePeriods.map((p) => (
                  <SelectItem key={p.key} value={p.key} className="font-medium">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{p.label}</span>
                      <span className="text-[11px] text-muted-foreground ml-auto px-1.5 py-0.5 rounded-full bg-muted">
                        {p.count} {p.count === 1 ? 'venda' : 'vendas'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}

          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1">
              Filtros Rápidos
            </SelectLabel>
            <SelectItem value="month">Este Mês (Calendário)</SelectItem>
            <SelectItem value="lastmonth">Mês Anterior</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Último Trimestre</SelectItem>
            <SelectItem value="year-2026">Ano de 2026</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
