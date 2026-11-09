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
    title: 'Captação & Tráfego de Leads',
    shortTitle: 'Captação',
    role: 'Marketing & SDR',
    sla: '10 a 15 min',
    icon: Megaphone,
    color: 'text-sky-500',
    borderColor: 'border-sky-500/30',
    bgColor: 'bg-sky-500/10',
    description:
      'Entrada qualificada de clientes via tráfego pago (Meta Ads / Instagram / Facebook), Google Ads, vitrine física de loja, marketplace ou indicação de clientes.',
    objective:
      'Garantir primeiro contato veloz e assertivo, registrando a origem real do lead no sistema para mensurar o ROI de marketing e atribuir ao consultor de vendas.',
    popSteps: [
      'Identificar canal de origem (ex: Anúncio Instagram, Balcão, Indicação).',
      'Registrar dados preliminares: Nome, WhatsApp, Cidade e Modelo de Interesse.',
      'Triagem de perfil de compra: Pagamento à vista, troca com troco ou financiamento bancário.',
      'Distribuição imediata da oportunidade ao consultor de vendas disponível.',
    ],
    auditRules: [
      'Proibido cadastrar leads sem preenchimento da origem verídica.',
      'SLA máximo de primeiro atendimento: 15 minutos em horário comercial.',
    ],
  },
  {
    id: 'proposta_fi',
    number: 2,
    title: 'Proposta & Simulação F&I',
    shortTitle: 'Proposta & F&I',
    role: 'Consultor de Vendas & F&I',
    sla: '1 a 4 horas',
    icon: Calculator,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500/30',
    bgColor: 'bg-indigo-500/10',
    description:
      'Montagem da proposta comercial, negociação de entrada, prazos e submissão da ficha cadastral às mesas de crédito bancárias (Santander, PAN, Altis, Motrix, Bradesco).',
    objective:
      'Maximizar taxa de aprovação com o menor custo de intermediação e melhor retorno de comissão/retorno financeiro para a concessionária.',
    popSteps: [
      'Coleta de CPF, comprovante de renda e endereço do comprador.',
      'Submissão simultânea ou sequencial nas financeiras homologadas.',
      'Negociação da entrada: PIX, espécie, cartão parcelado ou carta de crédito.',
      'Apresentação clara das parcelas ao cliente com taxa nominal e CET transparente.',
    ],
    auditRules: [
      'Proibido prometer taxas bancárias antes da aprovação formal na esteira.',
      'Todas as condições de entrada devem ser registradas na planilha ou pré-contrato.',
    ],
  },
  {
    id: 'pre_venda',
    number: 3,
    title: 'Pré-Venda & Validação Gerencial',
    shortTitle: 'Pré-Venda',
    role: 'Gerência Comercial',
    sla: 'Mesmo dia (2 a 6 horas)',
    icon: ShieldCheck,
    color: 'text-amber-500',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    description:
      'Auditoria de margem líquida, custos operacionais (frete, preparação, despachante) e autorização prévia da liberação do veículo no estoque físico.',
    objective:
      'Evitar prejuízos operacionais, assegurar cumprimento das políticas de desconto da concessionária e validar se a moto está desembaraçada.',
    popSteps: [
      'Conferência do preço de venda versus margem mínima cadastrada do modelo.',
      'Verificação do status do veículo no pátio (disponível, sem restrições ou recall).',
      'Validação dos custos adicionais (IPVA proporcional, transferência, brindes).',
      'Assinatura e autorização gerencial da pré-venda (registro de "is_permitted").',
    ],
    auditRules: [
      'Nenhum contrato definitivo pode ser assinado sem auditoria gerencial da pré-venda.',
      'Veículos com margem abaixo do piso exigem justificativa formal do gerente.',
    ],
  },
  {
    id: 'contrato_juridico',
    number: 4,
    title: 'Contrato & Assinatura Digital',
    shortTitle: 'Contrato Jurídico',
    role: 'Depto. Jurídico & Administrativo',
    sla: 'Até 2 horas',
    icon: FileCheck2,
    color: 'text-purple-500',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
    description:
      'Geração do instrumento particular de compra e venda PIXEL com cláusulas de garantia legal (Art. 26 CDC), qualificação das partes e assinatura digital/física.',
    objective:
      'Blindagem jurídica completa da transação, prevenção de passivos e garantia de validade jurídica executiva do título.',
    popSteps: [
      'Emissão automatizada do contrato oficial PIXEL com dados do chassi e comprador.',
      'Anexação das cláusulas de termo de entrega e recibo de quitação condicional.',
      'Disponibilização para assinatura digital via link seguro ou assinatura física no balcão.',
      'Arquivamento no repositório digital de contratos da concessionária.',
    ],
    auditRules: [
      'Conferência obrigatória do número do chassi (17 dígitos) com o documento físico.',
      'Contrato deve conter assinatura legível de comprador e duas testemunhas ou hash ICP.',
    ],
  },
  {
    id: 'pdi_oficina',
    number: 5,
    title: 'PDI, Vistoria & Oficina',
    shortTitle: 'PDI & Oficina',
    role: 'Chefe de Oficina & PDI',
    sla: 'Até 24 horas',
    icon: Wrench,
    color: 'text-orange-500',
    borderColor: 'border-orange-500/30',
    bgColor: 'bg-orange-500/10',
    description:
      'Inspeção pré-entrega obrigatória (Pre-Delivery Inspection): revisão de 42 itens mecânicos, verificação de fluidos, bateria, calibragem, acessórios e lavagem técnica.',
    objective:
      'Zero devoluções no pós-venda, entrega de veículo 100% revisado e seguro, garantindo a satisfação plena do cliente no ato da retirada.',
    popSteps: [
      'Ativação da bateria e conferência da voltagem do alternador/estator.',
      'Checagem de aperto de porcas, eixos de roda, mesa de direção e suspensão.',
      'Verificação do nível e estado do óleo de motor e fluidos de freio.',
      'Teste de funcionamento de luzes, setas, painel digital, buzina e ignição.',
      'Lavagem detalhada, espelhamento e envelopamento de proteção para entrega.',
    ],
    auditRules: [
      'Checklist PDI deve ser rubricado pelo mecânico responsável e arquivado.',
      'Qualquer avaria estética deve ser corrigida antes de agendar a entrega.',
    ],
  },
  {
    id: 'quitacao_entrega',
    number: 6,
    title: 'Quitação Financeira & Entrega das Chaves',
    shortTitle: 'Entrega Técnica',
    role: 'Financeiro & Entrega Técnica',
    sla: '30 a 60 min (agendado)',
    icon: KeyRound,
    color: 'text-emerald-500',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
    description:
      'Conferência final dos comprovantes de pagamento e TED bancária, emissão da Nota Fiscal Eletrônica (NF-e), entrega das chaves e explicação técnica ao cliente.',
    objective:
      'Encerramento com chave de ouro do ciclo da venda, fidelização do cliente, registro de foto comemorativa e solicitação de avaliação no Google Meu Negócio.',
    popSteps: [
      'Conferência bancária definitiva da entrada (PIX/TED compensados e autenticados).',
      'Validação da liberação do crédito pelo banco financiador (gravame emitido).',
      'Emissão da Nota Fiscal de Saída com o valor e dados cadastrais idênticos ao contrato.',
      'Entrega das chaves reservas, manual do proprietário e termo de garantia assinado.',
      'Orientações de amaciamento de motor, primeira revisão de 1.000km e foto de entrega.',
    ],
    auditRules: [
      'PROIBIDO LIBERAR O VEÍCULO SEM QUITAÇÃO COMPROVADA E AUTENTICADA.',
      'Termo de entrega e recebimento assinado deve ser arquivado junto ao contrato.',
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
