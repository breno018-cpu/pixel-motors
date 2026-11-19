import React from 'react';
import {
  useDealershipScope,
  DEALERSHIPS_CONFIG,
  DealershipKey,
  DealershipMeta,
} from '@/contexts/DealershipScopeContext';
import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';

interface DealershipSegmentedBarProps {
  value?: DealershipKey;
  activeScope?: DealershipKey; // Alias compatível
  onChange?: (scope: DealershipKey) => void;
  counts?: Partial<Record<string, number>>;
  financials?: Partial<Record<string, number>>;
  variant?: 'pills' | 'tabs' | 'header';
  className?: string;
  showAllOption?: boolean;
  showCounts?: boolean;
  showTotals?: boolean;
}

export function DealershipSegmentedBar({
  value,
  activeScope,
  onChange,
  counts,
  financials,
  variant = 'pills',
  className,
  showAllOption = true,
}: DealershipSegmentedBarProps) {
  const scopeCtx = useDealershipScope();
  const rawScope = value !== undefined ? value : (activeScope !== undefined ? activeScope : scopeCtx.activeScope);
  const currentScope = (rawScope || 'all').toLowerCase().trim();
  const setScope = onChange || scopeCtx.setActiveScope;

  const items = (scopeCtx.dealershipsList && scopeCtx.dealershipsList.length > 0
    ? scopeCtx.dealershipsList
    : Object.values(DEALERSHIPS_CONFIG)
  ).filter((item) => showAllOption || item.key !== 'all');

  const formatBrlShort = (val: number) => {
    if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(0)}k`;
    return `R$ ${val.toFixed(0)}`;
  };

  if (variant === 'header') {
    // Versão compacta para a barra de topo do sistema (Header)
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 p-1 rounded-xl bg-card/90 border border-border/80 shadow-xs backdrop-blur-md overflow-x-auto max-w-full',
          className
        )}
      >
        {items.map((item) => {
          const isSelected =
            currentScope === item.key.toLowerCase() ||
            currentScope === item.id.toLowerCase() ||
            (item.legacyKey && currentScope === item.legacyKey.toLowerCase());
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setScope(item.id !== 'all' ? item.id : 'all')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none shrink-0',
                isSelected
                  ? cn(
                      'shadow-xs font-bold',
                      item.key === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : item.legacyKey === 'divinopolis'
                        ? 'bg-emerald-600 text-white'
                        : item.legacyKey === 'montesclaros'
                        ? 'bg-blue-600 text-white'
                        : item.legacyKey === 'multimarcas'
                        ? 'bg-purple-600 text-white'
                        : 'bg-primary text-primary-foreground'
                    )
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
              title={item.fullName}
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-current' : 'opacity-70')} />
              <span className="hidden md:inline">{item.shortName}</span>
              <span className="md:hidden">{item.prefix}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Versão rica com contadores e finanças para o topo de tabelas e painéis
  return (
    <div className={cn('w-full flex items-center gap-1.5 flex-wrap', className)}>
      {items.map((item) => {
          const isSelected =
            currentScope === item.key.toLowerCase() ||
            currentScope === item.id.toLowerCase() ||
            (item.legacyKey && currentScope === item.legacyKey.toLowerCase());
          const Icon = item.icon;

          // Suporta contagem por id da loja, key ou legacyKey
          const count = counts
            ? (counts[item.key] ?? counts[item.id] ?? (item.legacyKey ? counts[item.legacyKey] : undefined))
            : undefined;
          const financial = financials
            ? (financials[item.key] ?? financials[item.id] ?? (item.legacyKey ? financials[item.legacyKey] : undefined))
            : undefined;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setScope(item.id !== 'all' ? item.id : 'all')}
              className={cn(
                'relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs select-none',
                isSelected
                  ? cn(
                      'ring-2 ring-offset-1 font-bold shadow-xs',
                      item.key === 'all'
                        ? 'bg-primary/10 text-primary border-primary/40 ring-primary/30'
                        : item.legacyKey === 'divinopolis'
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 ring-emerald-500/30'
                        : item.legacyKey === 'montesclaros'
                        ? 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/40 ring-blue-500/30'
                        : item.legacyKey === 'multimarcas'
                        ? 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/40 ring-purple-500/30'
                        : cn(item.badgeClass, item.borderClass, item.bgLightClass, 'ring-primary/30')
                    )
                  : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/80'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn('w-3.5 h-3.5 shrink-0', isSelected ? item.textClass : 'opacity-60')} />
                <span>{item.shortName}</span>
                {item.key !== 'all' && (
                  <span className="font-mono text-[9px] font-black opacity-70 px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">
                    {item.prefix}
                  </span>
                )}
              </div>

              {/* Contador de Registros da Concessionária */}
              {count !== undefined && (
                <span
                  className={cn(
                    'text-[10.5px] font-mono font-bold px-1.5 py-0.2 rounded-full',
                    isSelected
                      ? 'bg-background/80 shadow-2xs text-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}

              {/* Subtotal Financeiro */}
              {financial !== undefined && financial > 0 && (
                <span className="hidden lg:inline text-[10px] font-mono opacity-80 border-l border-border/60 pl-1.5">
                  {formatBrlShort(financial)}
                </span>
              )}
            </button>
          );
        })}
    </div>
  );
}
