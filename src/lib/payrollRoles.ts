/**
 * Tipos de vínculo usados na folha de pagamento.
 *
 * - `clt`: funcionário registrado — tem INSS, IRRF, FGTS, vale transporte/refeição.
 * - `prestador`: prestador de serviços (autônomo/PJ) — recibo de serviços, sem encargos CLT.
 */
export type PayrollBond = 'clt' | 'prestador';

export interface CargoConcessionariaDef {
  id: string;
  titulo: string;
  roleSistema: string;
  roleFolha: string;
  departamento: 'VENDAS' | 'MECANICA' | 'ADMINISTRATIVO' | 'GERENCIA' | 'LOGISTICA';
  tipoContrato: 'CLT' | 'TERCEIRIZADO';
  modeloComissao: 'PADRAO' | 'PLUS' | 'PERCENTUAL';
  grauInsalubridadePadrao: 'NENHUM' | 'MINIMO' | 'MEDIO' | 'MAXIMO';
  salarioBaseSugerido: number;
  escopoDados: string;
  resumoRemuneracao: string;
  podeFazer: string[];
  precisaFazer: string[];
}

export const CARGOS_CONCESSIONARIA: CargoConcessionariaDef[] = [
  {
    id: 'admin',
    titulo: 'Administrador Geral / Diretor',
    roleSistema: 'admin',
    roleFolha: 'gerente',
    departamento: 'GERENCIA',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 8000,
    escopoDados: 'Todas as lojas (Irrestrito)',
    resumoRemuneracao: 'Pró-labore / Salário Base + Participação nos Resultados',
    podeFazer: [
      'Acessar e gerenciar todas as lojas, estoques, contratos, margens de lucro e custos reais',
      'Criar, editar, bloquear e excluir usuários, cargos personalizados e permissões',
      'Configurar tabelas de comissões, impostos, marca d’água, logotipo e fechar a Folha de Pagamento',
      'Gerenciar credenciais bancárias, bancos de financiamento, chaves de API e backups na nuvem',
      'Destravar qualquer campo de chassi, editar ou cancelar vendas concluídas e emitir NFs',
    ],
    precisaFazer: [
      'Definir e revisar as metas mensais de vendas (quantidade e faturamento) por vendedor e loja',
      'Auditar e fechar a Folha de Pagamento até o dia de fechamento configurado, aprovando os pagamentos',
      'Acompanhar o DRE, margens líquidas por veículo e relatórios de comissionamento',
      'Garantir conformidade fiscal (emissão de NFs) e trabalhista (alertas de auditoria CLT/FGTS)',
    ],
  },
  {
    id: 'gerente',
    titulo: 'Gerente Geral / Comercial de Concessionária',
    roleSistema: 'gerente',
    roleFolha: 'gerente',
    departamento: 'GERENCIA',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 4500,
    escopoDados: 'Todas as lojas / Unidade gerenciada',
    resumoRemuneracao: 'Salário Fixo + Comissão por Moto Vendida na Loja (Volume Geral) + Bônus de Meta + DSR',
    podeFazer: [
      'Visualizar vendas, estoque, margens de lucro, consignações, financiamentos e contratos da concessionária',
      'Cadastrar, editar, precificar e destravar campos de veículos no estoque',
      'Aprovar, editar ou cancelar vendas e gerenciar modelos de contratos',
      'Lançar variáveis na Folha de Pagamento (montagens, horas extras, faltas, bônus) e emitir holerites',
      'Acompanhar o ranking e desempenho individual de todos os vendedores e revendedores',
    ],
    precisaFazer: [
      'Supervisionar o giro de estoque, precificação correta e entrada de motos (compra/consignação)',
      'Conferir e validar os contratos de venda, documentação de financiamento e solicitações de NF',
      'Apurar mensalmente as vendas da loja, lançar variáveis da equipe (oficina/vendas) e conferir a prévia da folha',
      'Treinar e cobrar a equipe comercial para atingimento da meta mensal da unidade',
    ],
  },
  {
    id: 'vendedor',
    titulo: 'Consultor de Vendas de Motos (Padrão)',
    roleSistema: 'vendedor',
    roleFolha: 'vendedor',
    departamento: 'VENDAS',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 2200,
    escopoDados: 'Próprias vendas + Estoque disponível da loja',
    resumoRemuneracao: 'Salário Fixo CLT + Comissão Progressiva por Faixa de Motos + Bônus de Meta + DSR',
    podeFazer: [
      'Consultar todo o estoque disponível de motocicletas e veículos (preço de venda, fotos e ficha técnica)',
      'Registrar novas vendas internas e editar suas vendas em andamento',
      'Cadastrar veículos de entrada (troca/captação) com preenchimento automático por chassi/placa',
      'Gerar contratos de compra e venda, termos de garantia, reservas e solicitar emissão de NF',
      'Acompanhar seu próprio painel de vendas, comissões e metas no Dashboard',
    ],
    precisaFazer: [
      'Atender leads gerados pelo marketing da loja (presencial, WhatsApp e redes sociais da concessionária)',
      'Preencher corretamente os dados do comprador (CPF/CNPJ válido, endereço, forma de pagamento e troca)',
      'Vincular a origem do lead (Marketing da Loja) e atualizar o status da venda até a conclusão/entrega',
      'Cumprir a meta mensal mínima de motocicletas vendidas definida para sua carteira',
    ],
  },
  {
    id: 'vendedor_plus',
    titulo: 'Consultor de Vendas de Motos + (Comissão Diferenciada)',
    roleSistema: 'vendedor_plus',
    roleFolha: 'vendedor_plus',
    departamento: 'VENDAS',
    tipoContrato: 'CLT',
    modeloComissao: 'PLUS',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 2500,
    escopoDados: 'Próprias vendas + Financiamentos + Estoque',
    resumoRemuneracao: 'Salário Fixo CLT + Faixa Mkt Loja + Valor Fixo Premium por Moto de Captação Própria + Retorno F&I + DSR',
    podeFazer: [
      'Tudo o que o Vendedor Padrão pode fazer (registrar, editar e também cancelar vendas próprias)',
      'Acessar o módulo de Financiamentos para simular, acompanhar aprovação bancária e registrar retorno',
      'Cadastrar veículos no estoque e registrar vendas diferenciando Lead da Loja vs. Captação Própria',
      'Receber comissão turbinada (ex: R$ 500/moto) em vendas originadas pelo seu próprio marketing/indicação',
    ],
    precisaFazer: [
      'Prospectar ativamente clientes por canais próprios (tráfego próprio, carteira recorrente, indicações)',
      'Classificar com exatidão a origem de cada venda (Marketing da Loja vs. Captação Própria/Externa)',
      'Conduzir o processo de financiamento junto aos bancos parceiros até a assinatura e pagamento',
      'Manter o cadastro dos veículos captados completo (fotos, KM, chassi, documentação)',
    ],
  },
  {
    id: 'vendedor_externo',
    titulo: 'Consultor de Vendas ++ (Vendas Externas & Captação)',
    roleSistema: 'vendedor_externo',
    roleFolha: 'vendedor_externo',
    departamento: 'VENDAS',
    tipoContrato: 'CLT',
    modeloComissao: 'PLUS',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 2500,
    escopoDados: 'Vendas Internas, Vendas Externas e Financiamentos',
    resumoRemuneracao: 'Salário Fixo CLT + Comissão Mkt Próprio/Externo + Bônus de Captação/Parceiro + DSR',
    podeFazer: [
      'Acessar o módulo exclusivo de Vendas Externas além de Vendas Internas, Estoque e Financiamentos',
      'Cadastrar veículos e destravar ajuste de ano/câmbio na decodificação de chassi',
      'Registrar negócios fechados fora da loja (clientes externos, parcerias e captações em campo)',
      'Acumular comissões de Marketing Próprio + Comissão de Moto de Parceiro na folha mensal',
    ],
    precisaFazer: [
      'Registrar todas as vendas externas no módulo de Vendas Externas (`sale_channel = externa`) para apuração automática na folha',
      'Validar vistoria, procedência e documentação das motos negociadas externamente antes da entrega',
      'Prestar contas de despesas de deslocamento/combustível para reembolso correto no holerite',
    ],
  },
  {
    id: 'analista_fi',
    titulo: 'Analista de F&I / Administrativo & Caixa',
    roleSistema: 'visualizador',
    roleFolha: 'administrativo',
    departamento: 'ADMINISTRATIVO',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 2600,
    escopoDados: 'Loja vinculada (Contratos, NFs e Financiamentos conforme cargo personalizado)',
    resumoRemuneracao: 'Salário Fixo CLT + Comissão de Retorno de Financiamento, Seguro e Consórcio + DSR',
    podeFazer: [
      'Acompanhar propostas de financiamento, consórcios, seguros e emissão de Notas Fiscais de motos',
      'Conferir documentação de clientes, emitir recibos/contratos e organizar dossiês de venda',
      'Ser associado a um Cargo Personalizado Administrativo com acesso a Contratos, Financiamentos e NF de Motos',
    ],
    precisaFazer: [
      'Submeter e acompanhar fichas de financiamento nos bancos parceiros e registrar o status de pagamento',
      'Emitir e controlar as Notas Fiscais de entrada/saída de motocicletas e serviços',
      'Conferir quitação de boletos, PIX, transferências e baixas de consignação antes da liberação do veículo',
      'Informar ao gerente os retornos bancários e vendas de consórcio/seguro para lançamento na folha',
    ],
  },
  {
    id: 'coordenador_logistica',
    titulo: 'Coordenador de Logística & Transporte de Frotas',
    roleSistema: 'coordenador_logistica',
    roleFolha: 'administrativo',
    departamento: 'LOGISTICA',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 3200,
    escopoDados: 'Todas as Lojas / Gestão de Rotas, Fretes, Cegonhas e Pátio',
    resumoRemuneracao: 'Salário Fixo CLT + Bônus de Pontualidade de Entrega + Premiação por Zero Sinistros em Transporte',
    podeFazer: [
      'Planejar e roteirizar viagens de entrega (Cegonha, Reboque VIP, Transferência Interlojas e Retirada Presencial)',
      'Acompanhar o mapa geográfico de rotas de venda, fretes por km e prazos de entrega em tempo real',
      'Auditar o checklist de saída e PDI de transporte para prevenção de riscos e avarias de frete',
      'Controlar manifestos de carga, romaneios de remessa e notas fiscais de transporte',
      'Negociar tabelas de frete com transportadoras parceiras e prestadores de guincho/cegonha',
    ],
    precisaFazer: [
      'Validar as condições físicas do veículo antes do embarque na cegonha ou plataforma de reboque',
      'Acompanhar a saída e chegada em cada município destino até a assinatura do termo de entrega pelo cliente',
      'Controlar custos operacionais de frete por km e zelar pela pontualidade dos prazos contratados',
      'Emitir romaneio de carga vinculado ao contrato de venda oficial e notas fiscais correspondentes',
    ],
  },
  {
    id: 'motorista',
    titulo: 'Motorista de Entrega & Transporte (Cegonha / Guincho)',
    roleSistema: 'motorista',
    roleFolha: 'motorista',
    departamento: 'LOGISTICA',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 2600,
    escopoDados: 'Rotas de Entrega, Manifestos de Carga e Termos de Recebimento',
    resumoRemuneracao: 'Salário Base CLT + Diárias de Viagem + Comissão/Bônus por Entrega Concluída sem Avarias + Adicional de Periculosidade',
    podeFazer: [
      'Executar viagens de entrega regional e interestadual via cegonha multiveículos, reboque exclusivo ou transferências interlojas',
      'Realizar a entrega técnica da motocicleta diretamente na residência do cliente ou concessionária de destino',
      'Assinar e colher assinatura do cliente no Termo de Entrega e Recebimento Definitivo com registro fotográfico no app',
      'Conferir checklist PDI de embarque e desembarque da motocicleta (nível de combustível, bateria, retrovisores, espelhos)',
      'Acessar ordens de transporte e rotas operacionais dentro do aplicativo DealFlow Hub',
    ],
    precisaFazer: [
      'Manter CNH categoria D ou E regularizada com curso de Transporte de Cargas Indivisíveis / MOPP válido',
      'Zelar pela amarração e integridade física de todas as motocicletas embarcadas no caminhão ou reboque plataforma',
      'Cumprir rigorosamente a Lei do Motorista (13.103/2015) quanto a intervalos de descanso, direção e diárias',
      'Coletar assinatura no Romaneio de Carga e recibo de entrega antes de liberar a posse do veículo ao comprador',
    ],
  },
  {
    id: 'mecanico_chefe',
    titulo: 'Mecânico de Motocicletas Chefe / Especialista',
    roleSistema: 'visualizador',
    roleFolha: 'mecanico',
    departamento: 'MECANICA',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 3000,
    escopoDados: 'Consulta de Estoque e Fichas Técnicas',
    resumoRemuneracao: 'Salário Fixo CLT + Comissão por Moto Montada + % Serviços de Oficina + DSR',
    podeFazer: [
      'Consultar estoque de motocicletas, dados técnicos (chassi, ano, modelo, cor) e status de preparação',
      'Receber comissão fixa por cada motocicleta montada/revisada (ativação 0km ou preparação de seminova)',
      'Receber percentual/comissão sobre ordens de serviço de manutenção, revisão e instalação de acessórios',
    ],
    precisaFazer: [
      'Realizar a montagem técnica, ativação de bateria, lubrificação e checklist de segurança das motos 0km e seminovas',
      'Executar revisões de entrega e atendimentos de garantia dentro do prazo acordado com o cliente',
      'Registrar a quantidade de motos montadas e serviços executados no mês para apuração na Folha de Pagamento',
      'Utilizar EPIs obrigatórios e manter a organização e controle de ferramentas da oficina',
    ],
  },
  {
    id: 'auxiliar_mecanica',
    titulo: 'Auxiliar de Mecânica / Lavador e Polidor',
    roleSistema: 'visualizador',
    roleFolha: 'mecanico',
    departamento: 'MECANICA',
    tipoContrato: 'CLT',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 1850,
    escopoDados: 'Consulta de Estoque',
    resumoRemuneracao: 'Salário Fixo CLT + Bônus de Produtividade/Lavagem + Horas Extras',
    podeFazer: [
      'Visualizar os veículos em estoque para identificação de placa, cor e prioridade de preparação estética',
      'Receber bônus por produtividade de lavagem, polimento ou apoio na montagem de motocicletas',
    ],
    precisaFazer: [
      'Executar lavagem técnica, higienização e polimento de todas as motos que entram no showroom e antes da entrega ao cliente',
      'Auxiliar os mecânicos na movimentação de pátio, organização da oficina e pré-montagem',
      'Manter as motos do showroom sempre limpas e prontas para exposição e fotos de anúncios',
    ],
  },
  {
    id: 'revendedor',
    titulo: 'Revendedor / Parceiro Comercial Externo',
    roleSistema: 'revendedor',
    roleFolha: 'prestador',
    departamento: 'VENDAS',
    tipoContrato: 'TERCEIRIZADO',
    modeloComissao: 'PERCENTUAL',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 0,
    escopoDados: 'Estoque disponível + Próprios repasses',
    resumoRemuneracao: 'Comissão por Moto Intermediada / Repasse (Sem vínculo CLT)',
    podeFazer: [
      'Consultar o estoque disponível da concessionária em tempo real para ofertar a seus clientes',
      'Intermediar vendas em parceria com a loja vinculada (`reseller_id`)',
      'Ter seu histórico de vendas e receita acompanhado no painel de Revendedores',
    ],
    precisaFazer: [
      'Apresentar compradores qualificados e encaminhar a documentação completa para formalização do contrato na loja',
      'Respeitar a tabela de preços mínimos e políticas comerciais definidas pela gerência',
    ],
  },
  {
    id: 'prestador_terceirizado',
    titulo: 'Prestador de Serviços Terceirizado (Limpeza / Apoio PJ)',
    roleSistema: 'visualizador',
    roleFolha: 'prestador',
    departamento: 'ADMINISTRATIVO',
    tipoContrato: 'TERCEIRIZADO',
    modeloComissao: 'PADRAO',
    grauInsalubridadePadrao: 'NENHUM',
    salarioBaseSugerido: 1800,
    escopoDados: 'Sem acesso administrativo (Operacional)',
    resumoRemuneracao: 'Valor Contratual / Fatura Mensal Fixa + Serviços Extras (Recibo de Prestação de Serviços sem INSS/FGTS/IRRF)',
    podeFazer: [
      'Prestar serviços autônomos ou via CNPJ (limpeza, conservação, segurança, frete/guincho, lavagem terceirizada)',
      'Receber valores adicionais por diárias extras ou reembolso de materiais/insumos utilizados',
      'Receber Recibo de Prestação de Serviços em 2 vias (Empresa / Prestador) gerado pela Folha',
    ],
    precisaFazer: [
      'Cumprir o escopo de serviços contratados (limpeza e conservação do showroom/oficina ou serviços gerais)',
      'Apresentar nota fiscal ou assinar o Recibo de Prestação de Serviços mensal na quitação da fatura',
    ],
  },
];

export const EMPLOYEE_ROLES: Array<{ value: string; label: string; bond: PayrollBond }> = [
  { value: 'vendedor', label: 'Vendedor (Padrão)', bond: 'clt' },
  { value: 'vendedor_plus', label: 'Vendedor + (Mkt Loja vs Próprio)', bond: 'clt' },
  { value: 'vendedor_externo', label: 'Vendedor ++ (Vendas Externas)', bond: 'clt' },
  { value: 'gerente', label: 'Gerente Geral / Comercial', bond: 'clt' },
  { value: 'coordenador_logistica', label: 'Coordenador de Logística & Transporte', bond: 'clt' },
  { value: 'motorista', label: 'Motorista / Cegonheiro / Entregador', bond: 'clt' },
  { value: 'administrativo', label: 'Administrativo / F&I / Caixa', bond: 'clt' },
  { value: 'mecanico', label: 'Mecânico / Preparação / Oficina', bond: 'clt' },
  { value: 'funcionario', label: 'Auxiliar / Apoio Interno', bond: 'clt' },
  { value: 'prestador', label: 'Prestador de Serviços (Terceirizado / PJ)', bond: 'prestador' },
];

export function roleLabel(role?: string | null) {
  return EMPLOYEE_ROLES.find((r) => r.value === role)?.label || role || '—';
}

/** Detecta prestador de serviços pelo cargo interno ou pela função escrita. */
export function isContractor(
  source?: { role?: string | null; position?: string | null } | null,
): boolean {
  if (!source) return false;
  if (source.role === 'prestador') return true;
  const pos = (source.position || '').toLowerCase();
  return (
    pos.includes('prestador') ||
    pos.includes('terceirizad') ||
    pos.includes('autônomo') ||
    pos.includes('autonomo')
  );
}

export function bondOf(source?: { role?: string | null; position?: string | null } | null): PayrollBond {
  return isContractor(source) ? 'prestador' : 'clt';
}

export function bondLabel(bond: PayrollBond) {
  return bond === 'prestador' ? 'Prestador de serviços' : 'Funcionário (CLT)';
}

export type CargoStatus =
  | 'ATIVO'
  | 'PAUSA_ADMINISTRATIVA'
  | 'DEMITIDO'
  | 'SUSPENSO'
  | 'AFASTADO_LICENCA'
  | 'AVISO_PREVIO'
  | 'INATIVO';

export interface CargoStatusOption {
  value: CargoStatus;
  label: string;
  description: string;
  badgeClass: string;
  dotColor: string;
  canAccessSystem: boolean;
  canReceiveCommissions: boolean;
}

export const CARGO_STATUS_OPTIONS: CargoStatusOption[] = [
  {
    value: 'ATIVO',
    label: 'Ativo / Em Operação',
    description: 'Acesso pleno ao sistema, geração de contratos e recebimento normal de comissões.',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    canAccessSystem: true,
    canReceiveCommissions: true,
  },
  {
    value: 'PAUSA_ADMINISTRATIVA',
    label: 'Pausa Administrativa',
    description: 'Acesso congelado temporariamente para auditoria interna, transição ou reestruturação.',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    canAccessSystem: false,
    canReceiveCommissions: false,
  },
  {
    value: 'DEMITIDO',
    label: 'Demitido / Desligado',
    description: 'Rescisão de contrato de trabalho. Acesso revogado imediatamente e histórico arquivado.',
    badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    dotColor: 'bg-rose-500',
    canAccessSystem: false,
    canReceiveCommissions: false,
  },
  {
    value: 'SUSPENSO',
    label: 'Suspensão Disciplinar',
    description: 'Suspensão de 1 a 30 dias por advertência/infração interna. Proibido emitir novos contratos.',
    badgeClass: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
    dotColor: 'bg-purple-500',
    canAccessSystem: false,
    canReceiveCommissions: false,
  },
  {
    value: 'AFASTADO_LICENCA',
    label: 'Afastado (Licença / INSS)',
    description: 'Contrato suspenso por auxílio-doença, acidente de trabalho ou licença maternidade.',
    badgeClass: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    dotColor: 'bg-sky-500',
    canAccessSystem: false,
    canReceiveCommissions: false,
  },
  {
    value: 'AVISO_PREVIO',
    label: 'Aviso Prévio',
    description: 'Em período de aviso prévio trabalhado ou indenizado. Permissões restritas.',
    badgeClass: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    dotColor: 'bg-orange-500',
    canAccessSystem: true,
    canReceiveCommissions: true,
  },
  {
    value: 'INATIVO',
    label: 'Inativo / Arquivado',
    description: 'Cadastro desativado e arquivado no histórico da concessionária.',
    badgeClass: 'border-muted text-muted-foreground bg-muted/30',
    dotColor: 'bg-muted-foreground',
    canAccessSystem: false,
    canReceiveCommissions: false,
  },
];

export function getCargoStatusOption(status?: string | null): CargoStatusOption {
  if (!status) return CARGO_STATUS_OPTIONS[0];
  const found = CARGO_STATUS_OPTIONS.find((s) => s.value === status);
  if (found) return found;
  // Fallbacks comuns
  if (status.toUpperCase() === 'PAUSA' || status.toUpperCase().includes('PAUSA')) return CARGO_STATUS_OPTIONS[1];
  if (status.toUpperCase() === 'DEMITIDO' || status.toUpperCase().includes('DEMISSAO')) return CARGO_STATUS_OPTIONS[2];
  if (status.toUpperCase() === 'SUSPENSO') return CARGO_STATUS_OPTIONS[3];
  if (status.toUpperCase().includes('LICENCA') || status.toUpperCase().includes('AFASTADO')) return CARGO_STATUS_OPTIONS[4];
  return CARGO_STATUS_OPTIONS[0];
}


