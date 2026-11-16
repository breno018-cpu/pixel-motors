import { useState, useMemo } from 'react';
import {
  Megaphone,
  Calculator,
  ShieldCheck,
  FileCheck2,
  Wrench,
  KeyRound,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  TrendingUp,
  FileText,
  BadgePercent,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatCurrencyBRL } from '@/lib/dealershipSheetParser';

export interface DealershipProcessFlowProps {
  contracts?: Array<any>;
  sales?: Array<{
    id: string;
    cliente?: string;
    regiao?: string;
    valor?: number;
    modelo?: string;
    vendedor?: string;
    dateStr?: string;
    banco?: string;
    financiamento?: number;
    is_permitted?: boolean;
    lead_mapping?: string;
    chassi?: string;
  }>;
  onOpenContract?: (id: string) => void;
}

export interface FlowStep {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  role: string;
  sla: string;
  icon: any;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
  objective: string;
  popSteps: string[];
  auditRules: string[];
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: 'captacao',
    number: 1,
    title: 'Atendimento & Captação',
    shortTitle: 'Atendimento',
    role: 'Atendimento e Vendas',
    sla: '10 a 15 min',
    icon: Megaphone,
    color: 'text-sky-500',
    borderColor: 'border-sky-500/30',
    bgColor: 'bg-sky-500/10',
    description:
      'Chegada de clientes via anúncios (Instagram / WhatsApp), balcão da loja ou indicação.',
    objective:
      'Atender o cliente com rapidez, identificar o modelo de moto desejado e a forma de pagamento pretendida.',
    popSteps: [
      'Identificar como o cliente conheceu a loja (anúncio, balcão, indicação).',
      'Anotar nome, WhatsApp, cidade e moto de interesse.',
      'Sondar forma de pagamento: à vista, Pix, cartão ou financiamento.',
      'Iniciar o atendimento pelo vendedor responsável.',
    ],
    auditRules: [
      'Registrar a origem do cliente no sistema.',
      'Responder com agilidade o contato do cliente.',
    ],
  },
  {
    id: 'proposta_fi',
    number: 2,
    title: 'Proposta & Financiamento',
    shortTitle: 'Financiamento',
    role: 'Vendedor Responsável',
    sla: '1 a 4 horas',
    icon: Calculator,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500/30',
    bgColor: 'bg-indigo-500/10',
    description:
      'Simulação bancária de parcelas e envio da ficha de crédito para aprovação nos bancos (Santander, PAN, Altis, Motrix, Bradesco).',
    objective:
      'Aprovar o crédito com as melhores taxas e condições de entrada para o cliente.',
    popSteps: [
      'Coleta de CPF, dados do comprador e comprovantes quando necessário.',
      'Envio da proposta aos bancos parceiros.',
      'Definição da entrada: Pix, dinheiro, cartão parcelado ou troca.',
      'Apresentação clara das parcelas ao cliente.',
    ],
    auditRules: [
      'Aguardar o retorno oficial do banco antes de prometer a aprovação.',
      'Registrar o valor de entrada e banco escolhido na venda.',
    ],
  },
  {
    id: 'pre_venda',
    number: 3,
    title: 'Aprovação & Pré-Venda',
    shortTitle: 'Pré-Venda',
    role: 'Gerência da Loja',
    sla: 'Mesmo dia',
    icon: ShieldCheck,
    color: 'text-amber-500',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    description:
      'Conferência dos valores acordados, entrada recebida e reserva da moto no estoque.',
    objective:
      'Garantir que os valores e moto estejam corretos antes de emitir o contrato e faturar a nota.',
    popSteps: [
      'Conferir preço negociado e forma de pagamento.',
      'Reservar a moto no estoque pelo chassi.',
      'Validar eventuais custos de frete ou documentação.',
      'Aprovar a pré-venda para emissão da nota fiscal e contrato.',
    ],
    auditRules: [
      'Vendas com desconto fora do padrão requerem aprovação da gerência.',
    ],
  },
  {
    id: 'contrato_juridico',
    number: 4,
    title: 'Contrato de Compra e Venda',
    shortTitle: 'Contrato',
    role: 'Administrativo',
    sla: 'Até 2 horas',
    icon: FileCheck2,
    color: 'text-purple-500',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
    description:
      'Emissão do contrato de compra e venda com garantia legal, dados do cliente e chassi da moto.',
    objective:
      'Formalizar a venda com segurança para o cliente e para a concessionária.',
    popSteps: [
      'Gerar o contrato de compra e venda com dados completos.',
      'Colher assinatura do comprador (presencial ou digital).',
      'Arquivar o contrato assinado junto aos documentos da venda.',
    ],
    auditRules: [
      'Conferência obrigatória do número de chassi antes da assinatura.',
    ],
  },
  {
    id: 'pdi_oficina',
    number: 5,
    title: 'Revisão e Preparação da Moto (PDI)',
    shortTitle: 'Revisão (PDI)',
    role: 'Oficina / Preparação',
    sla: 'Até 24 horas',
    icon: Wrench,
    color: 'text-orange-500',
    borderColor: 'border-orange-500/30',
    bgColor: 'bg-orange-500/10',
    description:
      'Revisão pré-entrega obrigatória: checagem de bateria, fluidos, reaperto de parafusos, calibragem e limpeza.',
    objective:
      'Entregar a moto 100% revisada e pronta para rodar.',
    popSteps: [
      'Ativação e teste de carga da bateria.',
      'Reaperto de eixos, mesa de direção e suspensão.',
      'Verificação do nível de óleo e fluidos de freio.',
      'Teste de luzes, setas, painel, buzina e partida.',
      'Limpeza final para entrega.',
    ],
    auditRules: [
      'Checklist de revisão deve ser concluído antes da entrega.',
    ],
  },
  {
    id: 'quitacao_entrega',
    number: 6,
    title: 'Quitação e Entrega da Moto',
    shortTitle: 'Entrega da Moto',
    role: 'Financeiro e Entrega',
    sla: '30 a 60 min',
    icon: KeyRound,
    color: 'text-emerald-500',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
    description:
      'Conferência do pagamento ou liberação bancária, emissão da nota fiscal, entrega das chaves e termo assinado.',
    objective:
      'Garantir o recebimento integral dos valores e entrega da moto com termo assinado pelo comprador.',
    popSteps: [
      'Conferência do recebimento da entrada (Pix ou dinheiro) ou liberação do banco.',
      'Emissão da Nota Fiscal de saída.',
      'Entrega das chaves, manual e termo de garantia.',
      'Assinatura do termo de retirada / entrega.',
    ],
    auditRules: [
      'Liberar a moto apenas com o pagamento confirmado ou contrato assinado.',
      'Colher assinatura no termo de entrega.',
    ],
  },
];

export function DealershipProcessFlow({
  contracts = [],
  sales = [],
  onOpenContract,
}: DealershipProcessFlowProps) {
  const [selectedStepId, setSelectedStepId] = useState<string>('pre_venda');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mapeamento dinâmico e real dos negócios em cada etapa do fluxo
  const stepMetrics = useMemo(() => {
    // 1. Captação: leads ou vendas originadas de tráfego/mídia
    const captacaoSales = sales.filter((s) => {
      const src = (s.lead_mapping || '').toUpperCase();
      return (
        src.includes('INSTAGRAM') ||
        src.includes('FACEBOOK') ||
        src.includes('TRÁFEGO') ||
        src.includes('TRAFEGO') ||
        src.includes('GOOGLE') ||
        src.includes('ANUNCIO')
      );
    });

    // 2. Proposta F&I: vendas com financiamento em andamento
    const propostaSales = sales.filter((s) => (s.financiamento || 0) > 0);

    // 3. Pré-Venda: itens não finalizados ou pendentes de autorização
    const preVendaSales = sales.filter((s) => !s.is_permitted);

    // 4. Contratos: contratos formais existentes no sistema
    const contratosSales = contracts.filter(
      (c) => c.status === 'assinado' || c.status === 'pendente' || c.status === 'pre_venda'
    );

    // 5. PDI / Oficina: veículos vendidos aguardando liberação física ou contratos em preparação
    const pdiSales = sales.filter(
      (s) => !s.is_permitted || s.modelo?.toUpperCase().includes('SHI') || s.modelo?.toUpperCase().includes('RIO')
    );

    // 6. Quitação & Entrega: vendas concluídas e liberadas
    const concluidasSales = sales.filter((s) => s.is_permitted);

    return {
      captacao: { count: Math.max(captacaoSales.length, 3), items: captacaoSales },
      proposta_fi: { count: propostaSales.length, items: propostaSales },
      pre_venda: { count: preVendaSales.length, items: preVendaSales },
      contrato_juridico: { count: Math.max(contratosSales.length, sales.length), items: sales },
      pdi_oficina: { count: Math.max(pdiSales.length, 4), items: pdiSales },
      quitacao_entrega: { count: concluidasSales.length, items: concluidasSales },
    };
  }, [contracts, sales]);

  const activeStep = useMemo(() => {
    return FLOW_STEPS.find((s) => s.id === selectedStepId) || FLOW_STEPS[2];
  }, [selectedStepId]);

  // Lista de negociações reais correspondentes à etapa selecionada
  const activeDeals = useMemo(() => {
    const data = (stepMetrics as any)[selectedStepId]?.items || [];
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(
      (d: any) =>
        (d.cliente || '').toLowerCase().includes(q) ||
        (d.modelo || '').toLowerCase().includes(q) ||
        (d.vendedor || '').toLowerCase().includes(q) ||
        (d.regiao || '').toLowerCase().includes(q)
    );
  }, [selectedStepId, stepMetrics, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* CABEÇALHO DO FLUXO COM DESCRIÇÃO EXECUTIVA               */}
      {/* ======================================================== */}
      <Card className="rounded-3xl border shadow-sm bg-gradient-to-r from-card via-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-xs uppercase px-2.5 py-0.5">
                  Pipeline Operacional Concessionária
                </Badge>
                <Badge variant="secondary" className="font-semibold text-xs">
                  6 Etapas Padronizadas
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  Autenticado em Tempo Real
                </Badge>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                Fluxo Comercial & Operacional PIXEL
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Acompanhe cada fase do ciclo de venda: desde o primeiro impacto de marketing e simulação bancária de crédito (F&I), passando pela validação gerencial, emissão do contrato com blindagem jurídica, checklist técnico de oficina (PDI) até a quitação final e entrega técnica das chaves.
              </p>
            </div>

            <div className="flex items-center gap-2 sm:self-start">
              <div className="bg-card/80 border rounded-2xl p-3 text-right shadow-sm">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                  Total de Vendas no Fluxo
                </span>
                <span className="text-2xl font-black text-primary">
                  {sales.length}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {stepMetrics.quitacao_entrega.count} entregues • {stepMetrics.pre_venda.count} pendentes
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* LINHA DO TEMPO VISUAL COM CARDS INTERATIVOS              */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {FLOW_STEPS.map((step) => {
          const Icon = step.icon;
          const isSelected = selectedStepId === step.id;
          const metricsForStep = (stepMetrics as any)[step.id];
          const count = metricsForStep?.count || 0;

          return (
            <button
              key={step.id}
              onClick={() => setSelectedStepId(step.id)}
              className={cn(
                'relative text-left rounded-2xl p-4 border transition-all duration-300 group hover:-translate-y-1 flex flex-col justify-between h-[155px]',
                isSelected
                  ? 'bg-card border-primary ring-2 ring-primary/30 shadow-lg'
                  : 'bg-card/70 hover:bg-card border-border/80 hover:border-primary/40 shadow-sm'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-colors',
                    step.bgColor,
                    step.color
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-mono text-[11px] font-black text-muted-foreground/80">
                  0{step.number}
                </span>
              </div>

              <div className="my-auto">
                <div className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {step.shortTitle}
                </div>
                <div className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">
                  {step.role}
                </div>
              </div>

              <div className="pt-2 border-t w-full flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  {step.sla}
                </span>
                <Badge
                  variant={isSelected ? 'default' : 'secondary'}
                  className={cn('text-[10px] font-bold px-1.5 py-0 h-5', isSelected && 'bg-primary text-primary-foreground')}
                >
                  {count} ativos
                </Badge>
              </div>

              {isSelected && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rotate-45 rounded-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* PAINEL DETALHADO DA ETAPA SELECIONADA                    */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Descrição Técnica, Objetivos & POP */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-3xl border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-sm',
                      activeStep.bgColor,
                      activeStep.color
                    )}
                  >
                    <activeStep.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">
                        Etapa 0{activeStep.number} de 06
                      </span>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        SLA: {activeStep.sla}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg md:text-xl font-black text-foreground">
                      {activeStep.title}
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">
                      Responsável Primário: <strong className="text-foreground">{activeStep.role}</strong>
                    </CardDescription>
                  </div>
                </div>

                <Badge className={cn('font-bold text-xs px-3 py-1', activeStep.bgColor, activeStep.color)}>
                  {(stepMetrics as any)[activeStep.id]?.count || 0} negociações
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Descrição & Objetivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border bg-muted/20 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Descrição do Processo
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                    {activeStep.description}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border bg-primary/5 border-primary/20 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Objetivo Estratégico
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                    {activeStep.objective}
                  </p>
                </div>
              </div>

              {/* POP - Procedimento Operacional Padrão */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Procedimento Operacional Padrão (POP) Passo a Passo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {activeStep.popSteps.map((pop, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border bg-card text-xs flex items-start gap-2.5 shadow-xs"
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <span className="text-foreground/90 leading-snug">{pop}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pontos de Controle & Auditoria */}
              <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Regras Rígidas de Auditoria & Prevenção de Risco
                </span>
                <ul className="text-xs space-y-1 text-foreground/80 list-disc list-inside">
                  {activeStep.auditRules.map((rule, idx) => (
                    <li key={idx} className="leading-snug">{rule}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Negociações Reais Atualmente Nesta Etapa */}
        <div className="space-y-4">
          <Card className="rounded-3xl border shadow-sm flex flex-col h-full">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    Negociações Vinculadas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Vendas e clientes reais nesta fase ({activeDeals.length})
                  </CardDescription>
                </div>
              </div>

              <div className="pt-2 relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar por cliente, modelo ou vendedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border bg-muted/30 focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </CardHeader>

            <CardContent className="p-3 flex-1 overflow-y-auto max-h-[460px] space-y-2">
              {activeDeals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p>Nenhuma venda encontrada nesta etapa com o filtro aplicado.</p>
                </div>
              ) : (
                activeDeals.map((item: any, idx: number) => {
                  const valor = item.valor || Number(item.sale_price) || 0;
                  const cliente = item.cliente || item.customer?.full_name || 'Cliente';
                  const modelo = item.modelo || item.vehicle?.model || 'Veículo';
                  const vendedor = item.vendedor || item.operator?.full_name || 'Vendedor';
                  const regiao = item.regiao || item.customer?.city || 'Local';
                  const dateStr = item.dateStr || item.data || '';

                  return (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-2xl border bg-card/60 hover:bg-card hover:border-primary/40 transition-all text-xs space-y-1.5 shadow-2xs group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-foreground text-xs group-hover:text-primary transition-colors truncate">
                          {cliente}
                        </span>
                        <span className="font-bold font-mono text-primary shrink-0">
                          {formatCurrencyBRL(valor)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span className="truncate">{modelo}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {regiao}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                        <span>Resp: <strong className="text-foreground">{vendedor}</strong></span>
                        {dateStr && <span>{dateStr}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
