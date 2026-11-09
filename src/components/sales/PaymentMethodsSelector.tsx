import React, { useMemo } from 'react';
import {
  QrCode,
  Banknote,
  CreditCard,
  Building2,
  Bike,
  FileCheck2,
  Receipt,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  Calculator,
  Zap,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { maskCurrency, parseCurrency } from '@/lib/masks';
import { cn } from '@/lib/utils';

export type PaymentMethodKey =
  | 'pix'
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'financiamento'
  | 'troca'
  | 'consorcio'
  | 'boleto';

export interface TradeInDetails {
  enabled: boolean;
  brand: string;
  model: string;
  year: string;
  plate: string;
  evaluated_value: string;
  suggested_sale_price?: string;
  auto_register_stock?: boolean;
}

export interface FinancingDetails {
  bank: string;
  installments: number;
  installmentValue: string;
}

export interface ConsorcioDetails {
  admin: string;
  groupQuota: string;
}

export interface BoletoDetails {
  installments: number;
  firstDueDate: string;
}

export interface PaymentMethodsData {
  payPix: string;
  payCash: string;
  payCreditCard: string;
  creditCardInstallments: number;
  payDebitCard: string;
  payFinanced: string;
  financing: FinancingDetails;
  tradeIn: TradeInDetails;
  payConsorcio: string;
  consorcio: ConsorcioDetails;
  payBoleto: string;
  boleto: BoletoDetails;
}

interface PaymentMethodsSelectorProps {
  totalSalePrice: number;
  data: PaymentMethodsData;
  onChange: (data: PaymentMethodsData) => void;
  financingBanks?: Array<{ id: string; name: string }>;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_BANKS = [
  'BANCO PAN',
  'SANTANDER',
  'BV FINANCEIRA',
  'BRADESCO',
  'SAFRA',
  'ALTIS FINANCEIRA',
  'MOTRIX',
  'ITAU',
  'BANCO DO BRASIL',
];

const AVAILABLE_METHODS: Array<{
  key: PaymentMethodKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  accentColor: string;
  bgLight: string;
}> = [
  {
    key: 'pix',
    label: 'PIX / Instantâneo',
    shortLabel: 'PIX',
    icon: QrCode,
    description: 'Transferência imediata sem tarifas',
    accentColor: 'text-emerald-500 border-emerald-500/40',
    bgLight: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'dinheiro',
    label: 'Espécie / Dinheiro',
    shortLabel: 'Dinheiro',
    icon: Banknote,
    description: 'Pagamento em cédulas no caixa da concessionária',
    accentColor: 'text-green-600 border-green-600/40',
    bgLight: 'bg-green-600/10 text-green-700 dark:text-green-300',
  },
  {
    key: 'cartao_credito',
    label: 'Cartão de Crédito',
    shortLabel: 'Cartão Crédito',
    icon: CreditCard,
    description: 'Parcelamento na maquininha em até 24x',
    accentColor: 'text-blue-500 border-blue-500/40',
    bgLight: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    key: 'cartao_debito',
    label: 'Cartão de Débito',
    shortLabel: 'Cartão Débito',
    icon: CreditCard,
    description: 'Débito à vista na maquininha',
    accentColor: 'text-cyan-500 border-cyan-500/40',
    bgLight: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  {
    key: 'financiamento',
    label: 'Financiamento Bancário',
    shortLabel: 'Financiamento',
    icon: Building2,
    description: 'Crédito aprovado via banco ou financeira parceira',
    accentColor: 'text-indigo-500 border-indigo-500/40',
    bgLight: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    key: 'troca',
    label: 'Veículo na Troca (Trade-in)',
    shortLabel: 'Troca / Usado',
    icon: Bike,
    description: 'Moto ou carro usado recebido como parte do pagamento',
    accentColor: 'text-amber-500 border-amber-500/40',
    bgLight: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    key: 'consorcio',
    label: 'Consórcio / Carta Contemplada',
    shortLabel: 'Consórcio',
    icon: FileCheck2,
    description: 'Carta de crédito contemplada por sorteio ou lance',
    accentColor: 'text-violet-500 border-violet-500/40',
    bgLight: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    key: 'boleto',
    label: 'Boleto / Crediário da Loja',
    shortLabel: 'Boleto / Carnê',
    icon: Receipt,
    description: 'Parcelamento direto ou notas promissórias da loja',
    accentColor: 'text-rose-500 border-rose-500/40',
    bgLight: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
];

function fmt(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function PaymentMethodsSelector({
  totalSalePrice,
  data,
  onChange,
  financingBanks = [],
  disabled = false,
  className,
}: PaymentMethodsSelectorProps) {
  // Valores numéricos individuais
  const valPix = parseCurrency(data.payPix) || 0;
  const valCash = parseCurrency(data.payCash) || 0;
  const valCredit = parseCurrency(data.payCreditCard) || 0;
  const valDebit = parseCurrency(data.payDebitCard) || 0;
  const valFinanced = parseCurrency(data.payFinanced) || 0;
  const valTradeIn = data.tradeIn.enabled
    ? parseCurrency(data.tradeIn.evaluated_value) || 0
    : 0;
  const valConsorcio = parseCurrency(data.payConsorcio) || 0;
  const valBoleto = parseCurrency(data.payBoleto) || 0;

  // Total acumulado em todas as formas
  const totalAllocated = useMemo(() => {
    return +(
      valPix +
      valCash +
      valCredit +
      valDebit +
      valFinanced +
      valTradeIn +
      valConsorcio +
      valBoleto
    ).toFixed(2);
  }, [
    valPix,
    valCash,
    valCredit,
    valDebit,
    valFinanced,
    valTradeIn,
    valConsorcio,
    valBoleto,
  ]);

  const remainingBalance = +(totalSalePrice - totalAllocated).toFixed(2);
  const isBalanced = Math.abs(remainingBalance) < 0.05 && totalSalePrice > 0;
  const isOverallocated = remainingBalance < -0.05;
  const isUnderallocated = remainingBalance > 0.05;

  // Identifica quais formas estão ativas
  const activeMethods = useMemo<Record<PaymentMethodKey, boolean>>(() => {
    return {
      pix: valPix > 0 || data.payPix !== '',
      dinheiro: valCash > 0 || data.payCash !== '',
      cartao_credito: valCredit > 0 || data.payCreditCard !== '',
      cartao_debito: valDebit > 0 || data.payDebitCard !== '',
      financiamento: valFinanced > 0 || data.payFinanced !== '',
      troca: data.tradeIn.enabled,
      consorcio: valConsorcio > 0 || data.payConsorcio !== '',
      boleto: valBoleto > 0 || data.payBoleto !== '',
    };
  }, [
    valPix,
    data.payPix,
    valCash,
    data.payCash,
    valCredit,
    data.payCreditCard,
    valDebit,
    data.payDebitCard,
    valFinanced,
    data.payFinanced,
    data.tradeIn.enabled,
    valConsorcio,
    data.payConsorcio,
    valBoleto,
    data.payBoleto,
  ]);

  // Função para ativar ou desativar uma forma de pagamento
  const toggleMethod = (key: PaymentMethodKey) => {
    if (disabled) return;
    const isActive = activeMethods[key];

    if (isActive) {
      // Desativa e zera a forma
      removeMethod(key);
    } else {
      // Ativa e, se houver saldo restante positivo, já pré-preenche
      const amountToAssign = remainingBalance > 0 ? remainingBalance : 0;
      const formattedAmount = amountToAssign > 0 ? maskCurrency(amountToAssign) : '';

      switch (key) {
        case 'pix':
          onChange({ ...data, payPix: formattedAmount });
          break;
        case 'dinheiro':
          onChange({ ...data, payCash: formattedAmount });
          break;
        case 'cartao_credito':
          onChange({
            ...data,
            payCreditCard: formattedAmount,
            creditCardInstallments: data.creditCardInstallments || 1,
          });
          break;
        case 'cartao_debito':
          onChange({ ...data, payDebitCard: formattedAmount });
          break;
        case 'financiamento':
          onChange({
            ...data,
            payFinanced: formattedAmount,
            financing: {
              ...data.financing,
              installments: data.financing.installments || 48,
              bank: data.financing.bank || 'BANCO PAN',
            },
          });
          break;
        case 'troca':
          onChange({
            ...data,
            tradeIn: {
              ...data.tradeIn,
              enabled: true,
              evaluated_value: formattedAmount,
            },
          });
          break;
        case 'consorcio':
          onChange({ ...data, payConsorcio: formattedAmount });
          break;
        case 'boleto':
          onChange({
            ...data,
            payBoleto: formattedAmount,
            boleto: {
              ...data.boleto,
              installments: data.boleto.installments || 12,
            },
          });
          break;
      }
    }
  };

  // Remove uma forma específica
  const removeMethod = (key: PaymentMethodKey) => {
    switch (key) {
      case 'pix':
        onChange({ ...data, payPix: '' });
        break;
      case 'dinheiro':
        onChange({ ...data, payCash: '' });
        break;
      case 'cartao_credito':
        onChange({ ...data, payCreditCard: '', creditCardInstallments: 1 });
        break;
      case 'cartao_debito':
        onChange({ ...data, payDebitCard: '' });
        break;
      case 'financiamento':
        onChange({
          ...data,
          payFinanced: '',
          financing: { ...data.financing, bank: '', installmentValue: '' },
        });
        break;
      case 'troca':
        onChange({
          ...data,
          tradeIn: { ...data.tradeIn, enabled: false, evaluated_value: '' },
        });
        break;
      case 'consorcio':
        onChange({ ...data, payConsorcio: '', consorcio: { admin: '', groupQuota: '' } });
        break;
      case 'boleto':
        onChange({ ...data, payBoleto: '', boleto: { ...data.boleto, installments: 1 } });
        break;
    }
  };

  // Atribui o saldo restante à forma selecionada
  const fillBalanceToMethod = (key: PaymentMethodKey) => {
    const currentMethodVal = (() => {
      switch (key) {
        case 'pix':
          return valPix;
        case 'dinheiro':
          return valCash;
        case 'cartao_credito':
          return valCredit;
        case 'cartao_debito':
          return valDebit;
        case 'financiamento':
          return valFinanced;
        case 'troca':
          return valTradeIn;
        case 'consorcio':
          return valConsorcio;
        case 'boleto':
          return valBoleto;
      }
    })();

    const newTarget = +(currentMethodVal + remainingBalance).toFixed(2);
    if (newTarget < 0) return;
    const formatted = maskCurrency(newTarget);

    switch (key) {
      case 'pix':
        onChange({ ...data, payPix: formatted });
        break;
      case 'dinheiro':
        onChange({ ...data, payCash: formatted });
        break;
      case 'cartao_credito':
        onChange({ ...data, payCreditCard: formatted });
        break;
      case 'cartao_debito':
        onChange({ ...data, payDebitCard: formatted });
        break;
      case 'financiamento':
        onChange({ ...data, payFinanced: formatted });
        break;
      case 'troca':
        onChange({
          ...data,
          tradeIn: { ...data.tradeIn, enabled: true, evaluated_value: formatted },
        });
        break;
      case 'consorcio':
        onChange({ ...data, payConsorcio: formatted });
        break;
      case 'boleto':
        onChange({ ...data, payBoleto: formatted });
        break;
    }
  };

  // Lista de bancos consolidados
  const bankOptions = useMemo(() => {
    const fromProps = financingBanks.map((b) => b.name.toUpperCase());
    const combined = Array.from(new Set([...fromProps, ...DEFAULT_BANKS]));
    return combined;
  }, [financingBanks]);

  const activeCount = Object.values(activeMethods).filter(Boolean).length;

  // Aplicação de modelos rápidos de 1 clique
  const applyPreset = (preset: 'pix_100' | 'cash_100' | 'card_100' | 'fin_100' | 'fin_down' | 'clear') => {
    if (disabled) return;
    const total = totalSalePrice > 0 ? totalSalePrice : 0;
    const formattedTotal = total > 0 ? maskCurrency(total) : '';

    const emptyData: PaymentMethodsData = {
      payPix: '',
      payCash: '',
      payCreditCard: '',
      creditCardInstallments: 1,
      payDebitCard: '',
      payFinanced: '',
      financing: {
        bank: '',
        installments: 48,
        installmentValue: '',
      },
      tradeIn: {
        enabled: false,
        brand: '',
        model: '',
        year: '',
        plate: '',
        evaluated_value: '',
      },
      payConsorcio: '',
      consorcio: { admin: '', groupQuota: '' },
      payBoleto: '',
      boleto: { installments: 12, firstDueDate: '' },
    };

    switch (preset) {
      case 'pix_100':
        onChange({ ...emptyData, payPix: formattedTotal });
        break;
      case 'cash_100':
        onChange({ ...emptyData, payCash: formattedTotal });
        break;
      case 'card_100':
        onChange({ ...emptyData, payCreditCard: formattedTotal, creditCardInstallments: 1 });
        break;
      case 'fin_100':
        onChange({
          ...emptyData,
          payFinanced: formattedTotal,
          financing: { bank: 'BANCO PAN', installments: 48, installmentValue: '' },
        });
        break;
      case 'fin_down': {
        const financedVal = +(total * 0.7).toFixed(2);
        const downVal = +(total * 0.3).toFixed(2);
        onChange({
          ...emptyData,
          payFinanced: financedVal > 0 ? maskCurrency(financedVal) : '',
          payPix: downVal > 0 ? maskCurrency(downVal) : '',
          financing: { bank: 'BANCO PAN', installments: 48, installmentValue: '' },
        });
        break;
      }
      case 'clear':
        onChange(emptyData);
        break;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 0. ATALHOS RÁPIDOS DE 1 CLIQUE */}
      <div className="p-3 bg-muted/40 rounded-2xl border border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Atalhos Rápidos de Fechamento (1 Clique)
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => applyPreset('clear')}
              className="text-[11px] font-semibold text-muted-foreground hover:text-destructive underline decoration-dotted transition-colors"
            >
              Limpar todas as formas
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset('pix_100')}
            className={cn(
              'h-7 text-xs px-2.5 rounded-lg border font-semibold transition-all',
              activeMethods.pix && activeCount === 1
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 ring-1 ring-emerald-500/30'
                : 'hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30'
            )}
          >
            ⚡ 100% À Vista (PIX)
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset('cash_100')}
            className={cn(
              'h-7 text-xs px-2.5 rounded-lg border font-semibold transition-all',
              activeMethods.dinheiro && activeCount === 1
                ? 'bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/40 ring-1 ring-green-600/30'
                : 'hover:bg-green-600/10 hover:text-green-700 hover:border-green-600/30'
            )}
          >
            💵 100% Dinheiro
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset('fin_down')}
            className={cn(
              'h-7 text-xs px-2.5 rounded-lg border font-semibold transition-all',
              activeMethods.financiamento && activeMethods.pix
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/40 ring-1 ring-indigo-500/30'
                : 'hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'
            )}
          >
            🏦 Financiamento + Entrada (70/30)
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset('fin_100')}
            className={cn(
              'h-7 text-xs px-2.5 rounded-lg border font-semibold transition-all',
              activeMethods.financiamento && activeCount === 1
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/40 ring-1 ring-indigo-500/30'
                : 'hover:bg-indigo-500/10 hover:text-indigo-600 hover:border-indigo-500/30'
            )}
          >
            🏦 Financiamento 100%
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset('card_100')}
            className={cn(
              'h-7 text-xs px-2.5 rounded-lg border font-semibold transition-all',
              activeMethods.cartao_credito && activeCount === 1
                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40 ring-1 ring-blue-500/30'
                : 'hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30'
            )}
          >
            💳 100% Cartão
          </Button>
        </div>
      </div>

      {/* 1. SELETOR DE FORMAS DE PAGAMENTO: PILLS INTERATIVAS */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Selecione as Formas de Pagamento Desta Venda
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Clique para ativar ou desativar os métodos utilizados pelo cliente
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono">
            {activeCount === 0
              ? 'Nenhuma forma selecionada'
              : `${activeCount} ${activeCount === 1 ? 'forma ativa' : 'formas ativas'}`}
          </Badge>
        </div>

        {/* Grade de Botões / Tags para Seleção Rápida */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AVAILABLE_METHODS.map((method) => {
            const Icon = method.icon;
            const isActive = activeMethods[method.key];

            return (
              <button
                key={method.key}
                type="button"
                disabled={disabled}
                onClick={() => toggleMethod(method.key)}
                className={cn(
                  'flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all duration-200 select-none cursor-pointer',
                  isActive
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                    : 'border-border/70 bg-card hover:bg-muted/40 hover:border-border text-muted-foreground hover:text-foreground',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span
                      className={cn(
                        'text-xs font-semibold block truncate',
                        isActive ? 'text-foreground' : 'text-foreground/80',
                      )}
                    >
                      {method.shortLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {isActive ? 'Ativo' : '+ Adicionar'}
                    </span>
                  </div>
                </div>

                {isActive ? (
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-border/80 flex items-center justify-center shrink-0 text-muted-foreground">
                    <Plus className="w-3 h-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BARRA DE STATUS FINANCEIRO & CONCILIAÇÃO DE VALORES */}
      <div
        className={cn(
          'p-3 rounded-xl border transition-all flex flex-wrap items-center justify-between gap-3 text-xs',
          isBalanced
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : isOverallocated
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-amber-500/10 border-amber-500/30',
        )}
      >
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <span className="text-[11px] text-muted-foreground block">Total da Venda</span>
            <span className="font-bold text-foreground text-sm">{fmt(totalSalePrice)}</span>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">Distribuído</span>
            <span
              className={cn(
                'font-bold text-sm',
                isBalanced
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isOverallocated
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {fmt(totalAllocated)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">Saldo Pendente</span>
            <span
              className={cn(
                'font-bold text-sm',
                isBalanced
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isOverallocated
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {isBalanced ? 'R$ 0,00 (100% Coberto)' : fmt(remainingBalance)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isBalanced && (
            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold text-xs py-1">
              <Check className="w-3.5 h-3.5" />
              Valores 100% Conciliados
            </Badge>
          )}

          {isUnderallocated && (
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-medium text-xs py-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Faltam {fmt(remainingBalance)}
            </Badge>
          )}

          {isOverallocated && (
            <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 font-medium text-xs py-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Excede em {fmt(Math.abs(remainingBalance))}
            </Badge>
          )}
        </div>
      </div>

      {/* 3. CARDS DAS FORMAS DE PAGAMENTO ATIVAS */}
      {activeCount === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-border/80 text-center space-y-2 bg-muted/10">
          <Calculator className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <h4 className="text-xs font-semibold text-foreground">
            Nenhuma forma de pagamento selecionada ainda
          </h4>
          <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
            Clique nos botões acima (ex: <strong>PIX</strong>, <strong>Cartão de Crédito</strong>, <strong>Financiamento</strong> ou <strong>Veículo na Troca</strong>) para adicionar e preencher os valores.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* CARD: PIX */}
          {activeMethods.pix && (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Pagamento via PIX</span>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('pix')}
                      className="h-7 text-[11px] px-2 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('pix')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover PIX"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor em PIX (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payPix}
                    onChange={(e) => onChange({ ...data, payPix: maskCurrency(e.target.value) })}
                    className="h-9 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-background mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-[11px] text-muted-foreground pb-2">
                    O comprovante do PIX poderá ser anexado na seção de comprovantes ao lado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CARD: DINHEIRO / ESPÉCIE */}
          {activeMethods.dinheiro && (
            <div className="p-3.5 rounded-xl border border-green-600/30 bg-green-600/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-green-600/20 text-green-700 flex items-center justify-center">
                    <Banknote className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Espécie / Dinheiro Físico</span>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('dinheiro')}
                      className="h-7 text-[11px] px-2 text-green-700 border-green-600/30 hover:bg-green-600/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('dinheiro')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover Dinheiro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor em Espécie (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payCash}
                    onChange={(e) => onChange({ ...data, payCash: maskCurrency(e.target.value) })}
                    className="h-9 text-xs font-bold text-green-700 dark:text-green-300 bg-background mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-[11px] text-muted-foreground pb-2">
                    Recebimento de cédulas no caixa. Gera recibo físico automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CARD: CARTÃO DE CRÉDITO */}
          {activeMethods.cartao_credito && (
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-600 flex items-center justify-center">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Cartão de Crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('cartao_credito')}
                      className="h-7 text-[11px] px-2 text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('cartao_credito')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover Cartão de Crédito"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Valor no Cartão (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payCreditCard}
                    onChange={(e) =>
                      onChange({ ...data, payCreditCard: maskCurrency(e.target.value) })
                    }
                    className="h-9 text-xs font-bold text-blue-600 dark:text-blue-400 bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Parcelamento</Label>
                  <Select
                    value={String(data.creditCardInstallments || 1)}
                    onValueChange={(v) =>
                      onChange({ ...data, creditCardInstallments: parseInt(v, 10) })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-background mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => {
                        const parcela = valCredit > 0 ? (valCredit / n).toFixed(2) : '0';
                        return (
                          <SelectItem key={n} value={String(n)} className="text-xs">
                            {n}x {valCredit > 0 ? `de ${fmt(Number(parcela))}` : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* CARD: CARTÃO DE DÉBITO */}
          {activeMethods.cartao_debito && (
            <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-600 flex items-center justify-center">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Cartão de Débito</span>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('cartao_debito')}
                      className="h-7 text-[11px] px-2 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('cartao_debito')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover Débito"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor no Débito (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payDebitCard}
                    onChange={(e) =>
                      onChange({ ...data, payDebitCard: maskCurrency(e.target.value) })
                    }
                    className="h-9 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-background mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-[11px] text-muted-foreground pb-2">
                    Débito direto à vista no POS da concessionária.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CARD: FINANCIAMENTO BANCÁRIO */}
          {activeMethods.financiamento && (
            <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Financiamento Bancário (CDC)
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Instituição financeira parceira e parcelas
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('financiamento')}
                      className="h-7 text-[11px] px-2 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMethod('financiamento')}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1 font-semibold border border-destructive/20 rounded-lg px-2"
                    title="Remover Financiamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ✕ Fechar Financiamento
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor Financiado (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payFinanced}
                    onChange={(e) =>
                      onChange({ ...data, payFinanced: maskCurrency(e.target.value) })
                    }
                    className="h-9 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-background mt-1"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">Banco / Financeira *</Label>
                  <Select
                    value={data.financing.bank}
                    onValueChange={(banco) =>
                      onChange({
                        ...data,
                        financing: { ...data.financing, bank: banco },
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-background mt-1">
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankOptions.map((b) => (
                        <SelectItem key={b} value={b} className="text-xs">
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">Prazo (Meses)</Label>
                  <Select
                    value={String(data.financing.installments || 48)}
                    onValueChange={(p) =>
                      onChange({
                        ...data,
                        financing: { ...data.financing, installments: parseInt(p, 10) },
                      })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs bg-background mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[12, 18, 24, 30, 36, 42, 48, 60].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n}x parcelas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor da Parcela (R$)</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.financing.installmentValue}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        financing: {
                          ...data.financing,
                          installmentValue: maskCurrency(e.target.value),
                        },
                      })
                    }
                    className="h-9 text-xs bg-background mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CARD: VEÍCULO NA TROCA (TRADE-IN) */}
          {activeMethods.troca && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-600 flex items-center justify-center">
                    <Bike className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Veículo Recebido na Troca (Trade-in)
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Abate no valor total e entrada no pátio
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('troca')}
                      className="h-7 text-[11px] px-2 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('troca')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover Troca"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Marca *</Label>
                  <Input
                    placeholder="HONDA"
                    value={data.tradeIn.brand}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        tradeIn: { ...data.tradeIn, brand: e.target.value.toUpperCase() },
                      })
                    }
                    className="h-8 text-xs bg-background mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Modelo *</Label>
                  <Input
                    placeholder="CG 160 FAN"
                    value={data.tradeIn.model}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        tradeIn: { ...data.tradeIn, model: e.target.value.toUpperCase() },
                      })
                    }
                    className="h-8 text-xs bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Ano / Placa</Label>
                  <div className="flex gap-1 mt-1">
                    <Input
                      placeholder="2022"
                      value={data.tradeIn.year}
                      onChange={(e) =>
                        onChange({
                          ...data,
                          tradeIn: {
                            ...data.tradeIn,
                            year: e.target.value.replace(/\D/g, '').slice(0, 4),
                          },
                        })
                      }
                      className="h-8 w-14 text-xs bg-background px-1 text-center"
                    />
                    <Input
                      placeholder="Placa"
                      value={data.tradeIn.plate}
                      onChange={(e) =>
                        onChange({
                          ...data,
                          tradeIn: { ...data.tradeIn, plate: e.target.value.toUpperCase() },
                        })
                      }
                      maxLength={8}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Avaliação (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.tradeIn.evaluated_value}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        tradeIn: {
                          ...data.tradeIn,
                          evaluated_value: maskCurrency(e.target.value),
                        },
                      })
                    }
                    className="h-8 text-xs font-bold text-amber-600 dark:text-amber-400 bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Revenda Estimada</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.tradeIn.suggested_sale_price || ''}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        tradeIn: {
                          ...data.tradeIn,
                          suggested_sale_price: maskCurrency(e.target.value),
                        },
                      })
                    }
                    className="h-8 text-xs bg-background mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="trade-in-stock-check"
                  checked={Boolean(data.tradeIn.auto_register_stock)}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...data,
                      tradeIn: {
                        ...data.tradeIn,
                        auto_register_stock: Boolean(checked),
                      },
                    })
                  }
                />
                <label
                  htmlFor="trade-in-stock-check"
                  className="text-xs text-muted-foreground cursor-pointer select-none"
                >
                  Cadastrar veículo usado automaticamente no estoque como entrada
                </label>
              </div>
            </div>
          )}

          {/* CARD: CONSÓRCIO / CARTA DE CRÉDITO */}
          {activeMethods.consorcio && (
            <div className="p-3.5 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-violet-500/20 text-violet-600 flex items-center justify-center">
                    <FileCheck2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Consórcio / Carta Contemplada</span>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('consorcio')}
                      className="h-7 text-[11px] px-2 text-violet-600 border-violet-500/30 hover:bg-violet-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('consorcio')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover Consórcio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor da Carta (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payConsorcio}
                    onChange={(e) =>
                      onChange({ ...data, payConsorcio: maskCurrency(e.target.value) })
                    }
                    className="h-9 text-xs font-bold text-violet-600 dark:text-violet-400 bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Administradora</Label>
                  <Input
                    placeholder="Ex: Honda, Rodobens, Porto"
                    value={data.consorcio.admin}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        consorcio: { ...data.consorcio, admin: e.target.value.toUpperCase() },
                      })
                    }
                    className="h-9 text-xs bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Grupo e Cota</Label>
                  <Input
                    placeholder="Ex: Gr. 1024 / Cota 58"
                    value={data.consorcio.groupQuota}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        consorcio: { ...data.consorcio, groupQuota: e.target.value },
                      })
                    }
                    className="h-9 text-xs bg-background mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CARD: BOLETO / CARNÊ */}
          {activeMethods.boleto && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-600 flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Boleto Bancário / Carnê Próprio</span>
                </div>
                <div className="flex items-center gap-2">
                  {remainingBalance > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => fillBalanceToMethod('boleto')}
                      className="h-7 text-[11px] px-2 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                    >
                      + Preencher Restante ({fmt(remainingBalance)})
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMethod('boleto')}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover Boleto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Valor Parcelado em Boleto (R$) *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={data.payBoleto}
                    onChange={(e) =>
                      onChange({ ...data, payBoleto: maskCurrency(e.target.value) })
                    }
                    className="h-9 text-xs font-bold text-rose-600 dark:text-rose-400 bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Nº de Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={data.boleto.installments || 1}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        boleto: {
                          ...data.boleto,
                          installments: parseInt(e.target.value, 10) || 1,
                        },
                      })
                    }
                    className="h-9 text-xs bg-background mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">1º Vencimento</Label>
                  <Input
                    type="date"
                    value={data.boleto.firstDueDate}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        boleto: { ...data.boleto, firstDueDate: e.target.value },
                      })
                    }
                    className="h-9 text-xs bg-background mt-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
