/**
 * Motor de Cálculo de Folha de Pagamento - CLT & Concessionária (MotoFolha Pro)
 * Tabelas oficiais vigentes de INSS progressivo, IRRF progressivo (Deduções Legais vs Simplificado),
 * FGTS, Adicionais, Comissões por Motos (Padrão & Vendedor +), Mecânico (Montagem), Gerência,
 * Catálogo de Comissões da Loja, Retorno F&I, Moto Parceiro, Verbas Indenizatórias (Art. 457 §2 CLT),
 * Férias, 13º Salário, Rescisão Trabalhista (TRCT) e Auditoria IA de Compliance.
 */

export interface FaixaComissaoMoto {
  de: number;
  ate: number;
  valorPorMoto: number;
}

export interface TipoComissaoCatalogo {
  id: string;
  nome: string;
  tipo: 'POR_UNIDADE' | 'VALOR_FIXO' | 'PERCENTUAL';
  valorPadrao: number;
  setor: 'TODOS' | 'VENDAS' | 'MECANICA' | 'GERENCIA' | 'ADMINISTRATIVO' | 'LOGISTICA';
}

export interface RegraComissaoCargo {
  id: string;
  titulo: string;
  descricaoCurta: string;
  departamento: 'VENDAS' | 'MECANICA' | 'ADMINISTRATIVO' | 'GERENCIA' | 'LOGISTICA';
  tipoContrato: 'CLT' | 'TERCEIRIZADO' | 'PJ' | 'ESTAGIO' | 'APRENDIZ';
  salarioBasePadrao: number;
  cargaHorariaPadrao: number;
  grauInsalubridadePadrao: 'NENHUM' | 'MINIMO' | 'MEDIO' | 'MAXIMO';
  periculosidadePadrao: boolean;
  descontarINSSPadrao: boolean;
  descontarIRRFPadrao: boolean;
  calcularFGTSPadrao: boolean;
  pagarDSRComissaoPadrao: boolean;
  modeloComissao: 'PADRAO' | 'PLUS' | 'PERCENTUAL';
  faixasMotos: FaixaComissaoMoto[];
  valorMarketingProprioPorMoto: number;
  aliquotaPercentualVendas: number;
  valorPorMotoMontada: number;
  valorPorRevisaoExecutada: number;
  valorPorMotoVendidaLojaGerente: number;
  metaGlobalMotosLoja: number;
  bonusMetaAtingida: number;
  comissaoRetornoPadrao: number;
  comissaoMotoParceiroPorUnidade: number;
  ajudaDeCustoIsentaPadrao: number;
  isPersonalizado?: boolean;
  ativo?: boolean; // Se false, o cargo fica oculto/desativado nas tabelas e seleções
  cidadesDiferenciadas?: Record<
    string,
    {
      salarioBase?: number;
      valorMarketingProprioPorMoto?: number;
      adicionalPorMoto?: number; // acréscimo específico para vendedores daquela cidade
      aliquotaPercentualVendas?: number;
      bonusMetaAtingida?: number;
    }
  >;
}

export interface RegrasComissoesCargos {
  vendedorPadrao: {
    salarioBaseSugerido?: number;
    faixas: FaixaComissaoMoto[];
  };
  vendedorPlus: {
    salarioBaseSugerido?: number;
    faixasMarketingLoja: FaixaComissaoMoto[];
    valorMarketingProprio: number;
  };
  mecanico: {
    salarioBaseSugerido?: number;
    valorPorMotoMontada: number;
    valorPorRevisao: number;
    comissaoOficinaAtiva: boolean;
  };
  gerente: {
    salarioBaseSugerido?: number;
    valorPorMotoVendidaLoja: number;
    bonusMetaGlobal: number;
    metaGlobalAtiva: boolean;
  };
}

export interface EmpresaFolhaConfig {
  storeId?: string | null;
  storeName?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep?: string;
  telefone?: string;
  regimeTributario: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
  textoMarcaDagua: string;
  opacidadeMarcaDagua: number;
  exibirMarcaDagua: number;
  logoUrl: string;
  salarioBaseVendedor?: number;
  salarioBaseMecanico?: number;
  salarioBaseGerente?: number;
  salarioBaseAdministrativo?: number;
  regrasComissao: FaixaComissaoMoto[];
  regrasComissaoPlus: {
    valorMarketingProprio: number;
    faixas: FaixaComissaoMoto[];
  };
  tiposComissoesLoja: TipoComissaoCatalogo[];
  regrasComissoesCargos: RegrasComissoesCargos;
  regrasPorCargo?: Record<string, RegraComissaoCargo>;
}

export interface FuncionarioFolhaMeta {
  __folha_meta?: boolean;
  matricula?: string;
  cargoId?: string;
  departamento: RegraComissaoCargo['departamento'];
  tipoContrato: 'CLT' | 'TERCEIRIZADO' | 'PJ' | 'ESTAGIO' | 'APRENDIZ';
  modeloComissaoVendedor: 'PADRAO' | 'PLUS' | 'PERCENTUAL';
  status?:
    | 'ATIVO'
    | 'SUSPENSO'
    | 'DEMITIDO'
    | 'INATIVO'
    | 'PAUSA_ADMINISTRATIVA'
    | 'AFASTADO_LICENCA'
    | 'AVISO_PREVIO';
  motivoStatus?: string;
  dataStatus?: string;
  dataRetornoPrevista?: string;
  avisoPrevio?: 'INDENIZADO' | 'TRABALHADO' | 'DISPENSADO';
  cargaHoraria: number;
  dependentes: number;
  grauInsalubridade: 'NENHUM' | 'MINIMO' | 'MEDIO' | 'MAXIMO';
  temPericulosidade: number; // 0 | 1
  optanteVT: number; // 0 | 1
  custoPassagemMensal: number;
  descontoPlanoSaude: number;
  descontoValeRefeicao: number;
  descontarINSS: number; // 0 | 1
  descontarIRRF: number; // 0 | 1
  calcularFGTS: number; // 0 | 1
  pagarDSRComissao: number; // 0 | 1
  razaoSocialPrestador: string;
  cnpjPrestador: string;
}

export interface ComissaoDetalhadaItem {
  id?: string;
  nome: string; // Descrição da atividade / serviço realizado (ex: "Consórcio Pan Grupo 45", "Seguro Proteção", "Instalação de Acessórios")
  tipo?: string;
  qtd?: number;
  valorUnitario?: number;
  valor: number;
  referencia?: string; // Data, período ou referência (ex: "15/10", "Cliente Lucas", "2 un")
  data?: string;
  observacao?: string; // Anotações do caderno (detalhes do cliente, proposta, etc.)
}

export interface VariaveisFolhaEntrada {
  motosVendidas?: number;
  motosMarketingLoja?: number;
  motosMarketingProprio?: number;
  valorMarketingProprio?: number;
  adicionalCidadePorMoto?: number; // Bônus regional por moto vendida em cidades específicas
  vendasTotalReais?: number;
  motosMontadas?: number;
  valorPorMontagem?: number;
  revisoesExecutadas?: number;
  valorPorRevisao?: number;
  bonusMetaBatida?: number;
  bonusMetas?: number;
  metaBatida?: boolean;
  comissaoServicos?: number;
  motosLojaGerente?: number;
  valorComissaoGerentePorMoto?: number;
  comissaoGeral?: number;
  descricaoComissaoGeral?: string;
  comissoesDetalhadas?: ComissaoDetalhadaItem[];
  cadernoAnotacoes?: string; // Caderno de anotações e registro de tudo o que foi feito no mês
  horas50?: number;
  horas100?: number;
  horasNoturnas?: number;
  diasUteis?: number;
  domingosEFeriados?: number;
  faltasDias?: number;
  atrasosMinutos?: number;
  custoValeTransporte?: number;
  optanteVT?: boolean;
  descontoValeRefeicao?: number;
  descontoPlanoSaude?: number;
  outrosProventos?: number;
  outrosProventosDescricao?: string;
  ajudaDeCusto?: number;
  ajudaDeCustoDescricao?: string;
  reembolsoDespesas?: number;
  reembolsoDespesasDescricao?: string;
  gastosDiversos?: number;
  gastosDiversosDescricao?: string;
  comissaoMotoParceiro?: number;
  motoParceiroQtd?: number;
  motoParceiroDescricao?: string;
  comissaoRetorno?: number;
  retornoDescricao?: string;
  comissaoTreinamento?: number;
  comissaoTreinamentoDescricao?: string;
  outrosDescontos?: number;
  outrosDescontosDescricao?: string;
  pensaoAlimenticia?: number;
}

export interface RubricaProvento {
  rubrica: string;
  tipo: 'FIXO' | 'VARIAVEL' | 'ADICIONAL' | 'INDENIZATORIO';
  valor: number;
  referencia?: string;
}

export interface RubricaDesconto {
  rubrica: string;
  tipo: 'LEGAL' | 'BENEFICIO' | 'PENALIDADE' | 'OUTROS';
  valor: number;
  aliquotaEfetiva?: number;
  aliquota?: number;
}

export interface ResultadoFolhaFuncionario {
  funcionarioId: string;
  funcionarioNome: string;
  cargo: string;
  cpf: string;
  departamento: string;
  tipoContrato: string;
  razaoSocialPrestador: string;
  cnpjPrestador: string;
  mesReferencia: string;
  salarioBase: number;
  motosVendidas: number;
  motosMarketingLoja: number;
  motosMarketingProprio: number;
  valorMarketingProprio: number;
  comissaoMarketingProprio: number;
  motosMontadas: number;
  valorPorMontagem: number;
  comissaoMotos: number;
  comissaoMontagem: number;
  revisoesExecutadas: number;
  valorPorRevisao: number;
  comissaoRevisoes: number;
  bonusMetaBatida?: number;
  comissaoServicos: number;
  comissaoGeral: number;
  comissoesDetalhadas: ComissaoDetalhadaItem[];
  cadernoAnotacoes?: string;
  totalComissoes: number;
  comissaoDSR: number;
  infoComissao: {
    motosVendidas: number;
    valorUnitarioFaixa: number;
    totalComissao: number;
    faixaAtingida: string;
  };
  infoMontagem: {
    motosMontadas: number;
    valorPorMontagem: number;
    totalComissao: number;
    descricao: string;
  };
  infoRevisao: {
    revisoesExecutadas: number;
    valorPorRevisao: number;
    totalComissao: number;
    descricao: string;
  };
  ajudaDeCusto: number;
  ajudaDeCustoDescricao: string;
  reembolsoDespesas: number;
  reembolsoDespesasDescricao: string;
  gastosDiversos: number;
  gastosDiversosDescricao: string;
  comissaoMotoParceiro: number;
  motoParceiroQtd: number;
  motoParceiroDescricao: string;
  comissaoRetorno: number;
  retornoDescricao: string;
  comissaoTreinamento: number;
  comissaoTreinamentoDescricao: string;
  totalProventos: number;
  totalDescontos: number;
  salarioLiquido: number;
  fgts: number;
  inssPatronal: number;
  custoTotalEmpresa: number;
  baseINSS: number;
  baseFGTS: number;
  baseIRRF: number;
  proventos: RubricaProvento[];
  descontos: RubricaDesconto[];
  inssDetalhe: {
    valor: number;
    aliquotaEfetiva: number;
    isento?: boolean;
    memoria?: Array<{ faixa: number; de: number; ate: number; aliquota: number; valor: number }>;
  };
  irrfDetalhe: {
    baseCalculo?: number;
    aliquota: number;
    deducaoFaixa?: number;
    valor: number;
    usouSimplificado?: boolean;
    deducaoTotal?: number;
    isento?: boolean;
  };
  geradoEm: string;
}

// Tabela de INSS Progressiva (Vigência 2024 / 2025 / 2026)
export const TABELA_INSS = [
  { ate: 1412.0, aliquota: 0.075, deducao: 0 },
  { ate: 2666.68, aliquota: 0.09, deducao: 21.18 },
  { ate: 4000.03, aliquota: 0.12, deducao: 101.18 },
  { ate: 7786.02, aliquota: 0.14, deducao: 181.18 },
];
export const TETO_INSS = 908.86;

// Tabela de IRRF Progressiva com dedução legal e desconto simplificado
export const DEDUCAO_DEPENDENTE_IRRF = 189.59;
export const DESCONTO_SIMPLIFICADO_IRRF = 564.8;
export const TABELA_IRRF = [
  { ate: 2259.2, aliquota: 0.0, deducao: 0.0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.0 },
];

export const SALARIO_MINIMO = 1412.0;

export const DEFAULT_FAIXAS_MOTOS: FaixaComissaoMoto[] = [
  { de: 1, ate: 5, valorPorMoto: 50 },
  { de: 6, ate: 10, valorPorMoto: 75 },
  { de: 11, ate: 20, valorPorMoto: 100 },
  { de: 21, ate: 60, valorPorMoto: 150 },
  { de: 61, ate: 9999, valorPorMoto: 200 },
];

export const DEFAULT_FAIXAS_MOTOS_PLUS: FaixaComissaoMoto[] = [
  { de: 1, ate: 10, valorPorMoto: 100 },
  { de: 11, ate: 20, valorPorMoto: 150 },
  { de: 21, ate: 60, valorPorMoto: 200 },
  { de: 61, ate: 9999, valorPorMoto: 250 },
];

export const DEFAULT_CATALOGO_COMISSOES: TipoComissaoCatalogo[] = [
  { id: 'c1', nome: 'Consórcio / Financiamento Bancário', tipo: 'VALOR_FIXO', valorPadrao: 150, setor: 'VENDAS' },
  { id: 'c2', nome: 'Capacete & Acessórios de Moto', tipo: 'POR_UNIDADE', valorPadrao: 25, setor: 'VENDAS' },
  { id: 'c3', nome: 'Seguro Proteção / Garantia Estendida', tipo: 'POR_UNIDADE', valorPadrao: 80, setor: 'VENDAS' },
  { id: 'c4', nome: 'Revisão Técnica & Serviços da Oficina', tipo: 'POR_UNIDADE', valorPadrao: 45, setor: 'MECANICA' },
  { id: 'c5', nome: 'Premiação por Atingimento de Metas', tipo: 'VALOR_FIXO', valorPadrao: 500, setor: 'TODOS' },
];

export const DEFAULT_REGRAS_POR_CARGO: Record<string, RegraComissaoCargo> = {
  vendedor: {
    id: 'vendedor',
    titulo: 'Consultor de Vendas de Motos (Padrão)',
    descricaoCurta: 'Vendas internas com comissão progressiva por faixa de motos vendidas + bônus de meta + DSR',
    departamento: 'VENDAS',
    tipoContrato: 'CLT',
    salarioBasePadrao: 2200,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 1.5,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 10,
    bonusMetaAtingida: 400,
    comissaoRetornoPadrao: 50,
    comissaoMotoParceiroPorUnidade: 100,
    ajudaDeCustoIsentaPadrao: 0,
  },
  vendedor_plus: {
    id: 'vendedor_plus',
    titulo: 'Consultor de Vendas de Motos + (Comissão Diferenciada)',
    descricaoCurta: 'Faixas progressivas em leads da loja + valor fixo premium em vendas de captação própria + F&I',
    departamento: 'VENDAS',
    tipoContrato: 'CLT',
    salarioBasePadrao: 2500,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PLUS',
    faixasMotos: DEFAULT_FAIXAS_MOTOS_PLUS,
    valorMarketingProprioPorMoto: 500,
    aliquotaPercentualVendas: 1.5,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 10,
    bonusMetaAtingida: 600,
    comissaoRetornoPadrao: 80,
    comissaoMotoParceiroPorUnidade: 150,
    ajudaDeCustoIsentaPadrao: 0,
  },
  vendedor_externo: {
    id: 'vendedor_externo',
    titulo: 'Consultor de Vendas ++ (Vendas Externas & Captação)',
    descricaoCurta: 'Captação regional e vendas externas com comissão premium por moto + parceria multimarcas + ajuda de custo',
    departamento: 'VENDAS',
    tipoContrato: 'CLT',
    salarioBasePadrao: 2500,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PLUS',
    faixasMotos: DEFAULT_FAIXAS_MOTOS_PLUS,
    valorMarketingProprioPorMoto: 550,
    aliquotaPercentualVendas: 2.0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 8,
    bonusMetaAtingida: 600,
    comissaoRetornoPadrao: 80,
    comissaoMotoParceiroPorUnidade: 200,
    ajudaDeCustoIsentaPadrao: 300,
  },
  gerente: {
    id: 'gerente',
    titulo: 'Gerente Geral / Comercial de Concessionária',
    descricaoCurta: 'Salário base + comissão sobre todas as motos vendidas pela unidade + bônus de meta global',
    departamento: 'GERENCIA',
    tipoContrato: 'CLT',
    salarioBasePadrao: 4500,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 20,
    metaGlobalMotosLoja: 20,
    bonusMetaAtingida: 600,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 0,
  },
  admin: {
    id: 'admin',
    titulo: 'Administrador Geral / Diretor',
    descricaoCurta: 'Diretoria executiva — Pró-labore / Salário base + participação por volume e metas da rede',
    departamento: 'GERENCIA',
    tipoContrato: 'CLT',
    salarioBasePadrao: 8000,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: false,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 30,
    metaGlobalMotosLoja: 30,
    bonusMetaAtingida: 1500,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 0,
  },
  mecanico_chefe: {
    id: 'mecanico_chefe',
    titulo: 'Mecânico de Motocicletas Chefe / Especialista',
    descricaoCurta: 'Salário base + comissão por moto 0km montada + comissão por revisão + O.S.',
    departamento: 'MECANICA',
    tipoContrato: 'CLT',
    salarioBasePadrao: 3000,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 40,
    valorPorRevisaoExecutada: 25,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 0,
    bonusMetaAtingida: 300,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 0,
  },
  auxiliar_mecanica: {
    id: 'auxiliar_mecanica',
    titulo: 'Auxiliar de Mecânica / Lavador e Polidor',
    descricaoCurta: 'Salário base + bônus por moto preparada/lavada e apoio em revisões',
    departamento: 'MECANICA',
    tipoContrato: 'CLT',
    salarioBasePadrao: 1850,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 15,
    valorPorRevisaoExecutada: 10,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 0,
    bonusMetaAtingida: 150,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 0,
  },
  analista_fi: {
    id: 'analista_fi',
    titulo: 'Analista de F&I / Administrativo & Caixa',
    descricaoCurta: 'Salário base + comissão de retorno bancário (F&I), consórcios, seguros e metas administrativas',
    departamento: 'ADMINISTRATIVO',
    tipoContrato: 'CLT',
    salarioBasePadrao: 2600,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 0,
    bonusMetaAtingida: 300,
    comissaoRetornoPadrao: 60,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 0,
  },
  coordenador_logistica: {
    id: 'coordenador_logistica',
    titulo: 'Coordenador de Logística & Transporte de Frotas',
    descricaoCurta: 'Salário base + bônus de pontualidade de despacho + premiação de rota e zero sinistros em fretes',
    departamento: 'LOGISTICA',
    tipoContrato: 'CLT',
    salarioBasePadrao: 3200,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 15,
    bonusMetaAtingida: 450,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 200,
  },
  motorista: {
    id: 'motorista',
    titulo: 'Motorista de Entrega & Transporte (Cegonha / Guincho)',
    descricaoCurta: 'Piso salarial CLT + Adicional de periculosidade rodoviária + diárias de viagem + comissão por entrega concluída',
    departamento: 'LOGISTICA',
    tipoContrato: 'CLT',
    salarioBasePadrao: 2600,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: true,
    descontarINSSPadrao: true,
    descontarIRRFPadrao: true,
    calcularFGTSPadrao: true,
    pagarDSRComissaoPadrao: true,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 20,
    bonusMetaAtingida: 500,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 350,
  },
  prestador_terceirizado: {
    id: 'prestador_terceirizado',
    titulo: 'Prestador de Serviços Terceirizado (PJ / Autônomo)',
    descricaoCurta: 'Fatura mensal contratada + serviços extras (Recibo de Prestação de Serviços isento de INSS/FGTS)',
    departamento: 'ADMINISTRATIVO',
    tipoContrato: 'TERCEIRIZADO',
    salarioBasePadrao: 1800,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: false,
    descontarIRRFPadrao: false,
    calcularFGTSPadrao: false,
    pagarDSRComissaoPadrao: false,
    modeloComissao: 'PADRAO',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 0,
    aliquotaPercentualVendas: 0,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 0,
    bonusMetaAtingida: 0,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 0,
    ajudaDeCustoIsentaPadrao: 0,
  },
  revendedor: {
    id: 'revendedor',
    titulo: 'Revendedor / Parceiro Comercial Externo',
    descricaoCurta: 'Parceiro externo com comissão percentual ou valor fixo por moto repassada/intermediada (Sem vínculo CLT)',
    departamento: 'VENDAS',
    tipoContrato: 'TERCEIRIZADO',
    salarioBasePadrao: 0,
    cargaHorariaPadrao: 220,
    grauInsalubridadePadrao: 'NENHUM',
    periculosidadePadrao: false,
    descontarINSSPadrao: false,
    descontarIRRFPadrao: false,
    calcularFGTSPadrao: false,
    pagarDSRComissaoPadrao: false,
    modeloComissao: 'PERCENTUAL',
    faixasMotos: DEFAULT_FAIXAS_MOTOS,
    valorMarketingProprioPorMoto: 400,
    aliquotaPercentualVendas: 4.5,
    valorPorMotoMontada: 0,
    valorPorRevisaoExecutada: 0,
    valorPorMotoVendidaLojaGerente: 0,
    metaGlobalMotosLoja: 0,
    bonusMetaAtingida: 0,
    comissaoRetornoPadrao: 0,
    comissaoMotoParceiroPorUnidade: 300,
    ajudaDeCustoIsentaPadrao: 0,
  },
};

export const DEFAULT_EMPRESA_FOLHA_CONFIG: EmpresaFolhaConfig = {
  razaoSocial: 'Concessionária MotoLider Ltda',
  cnpj: '12.345.678/0001-90',
  endereco: 'Av. Brasil, 1500 - Distrito Industrial',
  cidade: 'São Paulo',
  uf: 'SP',
  regimeTributario: 'LUCRO_PRESUMIDO',
  textoMarcaDagua: 'DOCUMENTO OFICIAL',
  opacidadeMarcaDagua: 0.06,
  exibirMarcaDagua: 1,
  logoUrl: '',
  salarioBaseVendedor: 1650,
  salarioBaseMecanico: 2100,
  salarioBaseGerente: 4500,
  salarioBaseAdministrativo: 1800,
  regrasComissao: DEFAULT_FAIXAS_MOTOS,
  regrasComissaoPlus: {
    valorMarketingProprio: 500,
    faixas: DEFAULT_FAIXAS_MOTOS_PLUS,
  },
  tiposComissoesLoja: DEFAULT_CATALOGO_COMISSOES,
  regrasComissoesCargos: {
    vendedorPadrao: {
      salarioBaseSugerido: 1650,
      faixas: DEFAULT_FAIXAS_MOTOS,
    },
    vendedorPlus: {
      salarioBaseSugerido: 1650,
      faixasMarketingLoja: DEFAULT_FAIXAS_MOTOS_PLUS,
      valorMarketingProprio: 500,
    },
    mecanico: {
      salarioBaseSugerido: 2100,
      valorPorMotoMontada: 40,
      valorPorRevisao: 25,
      comissaoOficinaAtiva: true,
    },
    gerente: {
      salarioBaseSugerido: 4500,
      valorPorMotoVendidaLoja: 20,
      bonusMetaGlobal: 600,
      metaGlobalAtiva: true,
    },
  },
  regrasPorCargo: DEFAULT_REGRAS_POR_CARGO,
};

/**
 * Cálculo de INSS Progressivo Faixa a Faixa
 */
export function calcularINSS(baseINSS: number) {
  if (baseINSS <= 0) return { valor: 0, aliquotaEfetiva: 0, memoria: [] };

  const salarioCalculo = Math.min(baseINSS, 7786.02);
  let totalINSS = 0;
  const memoria: Array<{ faixa: number; de: number; ate: number; aliquota: number; valor: number }> = [];

  let faixaAnterior = 0;
  for (let i = 0; i < TABELA_INSS.length; i++) {
    const faixa = TABELA_INSS[i];
    if (salarioCalculo > faixaAnterior) {
      const baseFaixa = Math.min(salarioCalculo, faixa.ate) - faixaAnterior;
      const valorFaixa = +(baseFaixa * faixa.aliquota).toFixed(2);
      totalINSS += valorFaixa;
      memoria.push({
        faixa: i + 1,
        de: faixaAnterior,
        ate: Math.min(salarioCalculo, faixa.ate),
        aliquota: faixa.aliquota * 100,
        valor: valorFaixa,
      });
      faixaAnterior = faixa.ate;
    }
  }

  totalINSS = Math.min(+totalINSS.toFixed(2), TETO_INSS);
  const aliquotaEfetiva = +((totalINSS / baseINSS) * 100).toFixed(2);

  return { valor: totalINSS, aliquotaEfetiva, memoria };
}

/**
 * Cálculo de IRRF considerando a regra mais vantajosa (Deduções Legais vs Simplificado)
 */
export function calcularIRRF(
  baseBruta: number,
  inssPago: number,
  dependentes = 0,
  pensaoAlimenticia = 0,
  outrasDeducoes = 0,
) {
  const deducaoDependentesTotal = dependentes * DEDUCAO_DEPENDENTE_IRRF;
  const deducaoLegal = inssPago + deducaoDependentesTotal + pensaoAlimenticia + outrasDeducoes;

  const baseCalculoLegal = Math.max(0, baseBruta - deducaoLegal);
  const baseCalculoSimplificado = Math.max(0, baseBruta - DESCONTO_SIMPLIFICADO_IRRF);

  const usarSimplificado = baseCalculoSimplificado < baseCalculoLegal;
  const baseCalculo = usarSimplificado ? baseCalculoSimplificado : baseCalculoLegal;

  let aliquota = 0;
  let deducaoFaixa = 0;

  for (const faixa of TABELA_IRRF) {
    if (baseCalculo <= faixa.ate) {
      aliquota = faixa.aliquota;
      deducaoFaixa = faixa.deducao;
      break;
    }
  }

  let valorIRRF = +(baseCalculo * aliquota - deducaoFaixa).toFixed(2);
  if (valorIRRF < 0 || valorIRRF < 10) {
    valorIRRF = 0;
  }

  return {
    baseCalculo: +baseCalculo.toFixed(2),
    aliquota: aliquota * 100,
    deducaoFaixa,
    valor: valorIRRF,
    usouSimplificado: usarSimplificado,
    deducaoTotal: +(usarSimplificado ? DESCONTO_SIMPLIFICADO_IRRF : deducaoLegal).toFixed(2),
  };
}

/**
 * Cálculo de FGTS (Obrigação do Empregador - não desconta do salário)
 */
export function calcularFGTS(baseFGTS: number, tipoContrato = 'CLT') {
  const taxa = tipoContrato === 'APRENDIZ' ? 0.02 : 0.08;
  return +(baseFGTS * taxa).toFixed(2);
}

/**
 * Cálculo de Horas Extras
 */
export function calcularHorasExtras(
  salarioBase: number,
  cargaHorariaMensal = 220,
  horas50 = 0,
  horas100 = 0,
  percentualCustom = 0,
  qtdCustom = 0,
) {
  const valorHoraNormal = salarioBase / (cargaHorariaMensal || 220);

  const total50 = +(horas50 * (valorHoraNormal * 1.5)).toFixed(2);
  const total100 = +(horas100 * (valorHoraNormal * 2.0)).toFixed(2);
  const totalCustom = +(qtdCustom * (valorHoraNormal * (1 + percentualCustom / 100))).toFixed(2);

  return {
    valorHora: +valorHoraNormal.toFixed(2),
    total50,
    total100,
    totalCustom,
    totalHorasExtras: +(total50 + total100 + totalCustom).toFixed(2),
  };
}

/**
 * Cálculo de DSR (Descanso Semanal Remunerado) sobre Horas Extras, Comissões e Adicional Noturno
 * Lei 605/49 e Súmula 27 do TST
 */
export function calcularDSR(totalVariaveis: number, diasUteis = 25, domingosEFeriados = 5) {
  if (diasUteis <= 0 || totalVariaveis <= 0) return 0;
  return +((totalVariaveis / diasUteis) * domingosEFeriados).toFixed(2);
}

/**
 * Adicional Noturno (20% CLT no mínimo sobre a hora noturna de 52min30s)
 */
export function calcularAdicionalNoturno(
  salarioBase: number,
  cargaHorariaMensal = 220,
  horasNoturnas = 0,
  percentual = 20,
) {
  const valorHora = salarioBase / (cargaHorariaMensal || 220);
  const fatorReducao = 60 / 52.5;
  const horasNoturnasComputadas = horasNoturnas * fatorReducao;
  const valorTotal = +(horasNoturnasComputadas * valorHora * (percentual / 100)).toFixed(2);
  return {
    horasComputadas: +horasNoturnasComputadas.toFixed(2),
    valorTotal,
  };
}

/**
 * Adicional de Insalubridade (Grau Mínimo 10%, Médio 20%, Máximo 40% sobre Salário Mínimo)
 */
export function calcularInsalubridade(grau = 'NENHUM', basePersonalizada: number | null = null) {
  const base = basePersonalizada || SALARIO_MINIMO;
  let perc = 0;
  if (grau === 'MINIMO') perc = 0.1;
  if (grau === 'MEDIO') perc = 0.2;
  if (grau === 'MAXIMO') perc = 0.4;
  return +(base * perc).toFixed(2);
}

/**
 * Adicional de Periculosidade (30% sobre o Salário Base do empregado)
 */
export function calcularPericulosidade(salarioBase: number, ativo = false) {
  if (!ativo) return 0;
  return +(salarioBase * 0.3).toFixed(2);
}

/**
 * Desconto de Vale Transporte (Até 6% do salário base, limitado ao custo real fornecido)
 */
export function calcularValeTransporte(salarioBase: number, custoRealVT = 0, optante = true) {
  if (!optante || custoRealVT <= 0) return 0;
  const tetoLegal = +(salarioBase * 0.06).toFixed(2);
  return Math.min(tetoLegal, custoRealVT);
}

/**
 * CÁLCULO DE COMISSÃO DE VENDEDOR DE MOTOS POR QUANTIDADE
 */
export function calcularComissaoMotos(
  motosVendidas = 0,
  regrasComissao?: FaixaComissaoMoto[] | null,
) {
  const qtd = Math.max(0, parseInt(String(motosVendidas), 10) || 0);
  if (qtd <= 0) {
    return {
      motosVendidas: 0,
      valorUnitarioFaixa: 0,
      totalComissao: 0,
      faixaAtingida: 'Nenhuma',
    };
  }

  const regras =
    regrasComissao && regrasComissao.length > 0 ? regrasComissao : DEFAULT_FAIXAS_MOTOS;

  let faixaEncontrada = regras.find((r) => qtd >= r.de && qtd <= r.ate);
  if (!faixaEncontrada) {
    faixaEncontrada = regras[regras.length - 1];
  }

  const valorUnitarioFaixa = Number(faixaEncontrada?.valorPorMoto) || 0;
  const totalComissao = +(qtd * valorUnitarioFaixa).toFixed(2);

  return {
    motosVendidas: qtd,
    valorUnitarioFaixa,
    totalComissao,
    faixaAtingida: `${faixaEncontrada.de} a ${
      faixaEncontrada.ate >= 9999 ? '+' : faixaEncontrada.ate
    } motos (R$ ${valorUnitarioFaixa}/moto)`,
  };
}

/**
 * CÁLCULO DE COMISSÃO DE MECÂNICO POR MONTAGEM DE MOTOS (VALOR FIXO POR MOTO)
 */
export function calcularComissaoMontagem(motosMontadas = 0, valorPorMontagem = 0) {
  const qtd = Math.max(0, parseInt(String(motosMontadas), 10) || 0);
  const valorUnit = Math.max(0, Number(valorPorMontagem) || 0);
  const total = +(qtd * valorUnit).toFixed(2);
  return {
    motosMontadas: qtd,
    valorPorMontagem: valorUnit,
    totalComissao: total,
    descricao: qtd > 0 ? `${qtd} montagens x R$ ${valorUnit.toFixed(2)}` : 'Nenhuma montagem',
  };
}

/**
 * CÁLCULO DE COMISSÃO DE MECÂNICO POR REVISÕES PERIÓDICAS (VALOR FIXO POR REVISÃO)
 */
export function calcularComissaoRevisao(revisoesExecutadas = 0, valorPorRevisao = 0) {
  const qtd = Math.max(0, parseInt(String(revisoesExecutadas), 10) || 0);
  const valorUnit = Math.max(0, Number(valorPorRevisao) || 0);
  const total = +(qtd * valorUnit).toFixed(2);
  return {
    revisoesExecutadas: qtd,
    valorPorRevisao: valorUnit,
    totalComissao: total,
    descricao: qtd > 0 ? `${qtd} revisões x R$ ${valorUnit.toFixed(2)}` : 'Nenhuma revisão',
  };
}

/**
 * Cálculo Completo da Folha Mensal Individual
 */
export function calcularFolhaFuncionario(dados: {
  funcionario: any;
  mesReferencia: string;
  regrasComissao?: FaixaComissaoMoto[] | null;
} & VariaveisFolhaEntrada): ResultadoFolhaFuncionario {
  const {
    funcionario,
    mesReferencia,
    motosVendidas = 0,
    motosMarketingLoja = 0,
    motosMarketingProprio = 0,
    valorMarketingProprio = 500,
    adicionalCidadePorMoto = 0,
    regrasComissao = null,
    motosMontadas = 0,
    valorPorMontagem = 0,
    revisoesExecutadas = 0,
    valorPorRevisao = 0,
    bonusMetaBatida = 0,
    bonusMetas = 0,
    metaBatida = false,
    comissaoServicos = 0,
    motosLojaGerente = 0,
    valorComissaoGerentePorMoto = 0,
    comissaoGeral = 0,
    descricaoComissaoGeral = '',
    comissoesDetalhadas = [],
    horas50 = 0,
    horas100 = 0,
    horasNoturnas = 0,
    diasUteis = 25,
    domingosEFeriados = 5,
    faltasDias = 0,
    atrasosMinutos = 0,
    custoValeTransporte = 0,
    optanteVT = true,
    descontoValeRefeicao = 0,
    descontoPlanoSaude = 0,
    outrosProventos = 0,
    outrosProventosDescricao = '',
    ajudaDeCusto = 0,
    ajudaDeCustoDescricao = '',
    reembolsoDespesas = 0,
    reembolsoDespesasDescricao = '',
    gastosDiversos = 0,
    gastosDiversosDescricao = '',
    comissaoMotoParceiro = 0,
    motoParceiroQtd = 0,
    motoParceiroDescricao = '',
    comissaoRetorno = 0,
    retornoDescricao = '',
    outrosDescontos = 0,
    outrosDescontosDescricao = '',
    pensaoAlimenticia = 0,
    comissaoTreinamento = 0,
    comissaoTreinamentoDescricao = '',
    vendasTotalReais = 0,
    cadernoAnotacoes = '',
  } = dados;

  const salarioBase = Number(funcionario.salarioBase ?? funcionario.base_salary) || 0;
  const cargaHoraria = Number(funcionario.cargaHoraria) || 220;

  // 1. Proventos Fixos e Adicionais
  const insalubridade = calcularInsalubridade(funcionario.grauInsalubridade || 'NENHUM');
  const periculosidade = calcularPericulosidade(salarioBase, !!funcionario.temPericulosidade);

  // 2. Comissões da Concessionária
  const qtdMktLoja = Number(motosMarketingLoja) || 0;
  const qtdMktProprio = Number(motosMarketingProprio) || 0;
  const valorUnitProprio = Number(valorMarketingProprio) || 500;

  const qtdMotosGerais =
    qtdMktLoja > 0 || qtdMktProprio > 0
      ? qtdMktLoja + qtdMktProprio
      : Number(motosVendidas) || 0;

  const isModeloPercentual =
    funcionario.modeloComissaoVendedor === 'PERCENTUAL' &&
    Number(funcionario.commissionRate || funcionario.commission_rate) > 0;
  const taxaPercentual = Number(funcionario.commissionRate ?? funcionario.commission_rate) || 0;

  const motosBaseNormal =
    qtdMktLoja > 0 || qtdMktProprio > 0 ? qtdMktLoja : qtdMotosGerais;
  const infoComissaoVenda = isModeloPercentual
    ? {
        motosVendidas: qtdMotosGerais,
        valorUnitarioFaixa: 0,
        totalComissao: +((Number(vendasTotalReais) || 0) * (taxaPercentual / 100)).toFixed(2),
        faixaAtingida: `${taxaPercentual}% sobre R$ ${(Number(vendasTotalReais) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      }
    : calcularComissaoMotos(motosBaseNormal, regrasComissao);
  const comissaoMotosValor = infoComissaoVenda.totalComissao;

  // Bônus adicional específico de cidade/unidade por moto vendida
  const extraCidadeTotal =
    Number(adicionalCidadePorMoto) > 0 && qtdMotosGerais > 0
      ? +(qtdMotosGerais * Number(adicionalCidadePorMoto)).toFixed(2)
      : 0;

  const comissaoMarketingProprioValor = isModeloPercentual
    ? 0
    : +(qtdMktProprio * valorUnitProprio).toFixed(2);

  const infoMontagem = calcularComissaoMontagem(motosMontadas, valorPorMontagem);
  const comissaoMontagemValor = infoMontagem.totalComissao;

  const infoRevisao = calcularComissaoRevisao(revisoesExecutadas, valorPorRevisao);
  const comissaoRevisoesValor = infoRevisao.totalComissao;

  const bonusMetaValor = Number(bonusMetaBatida || bonusMetas) || 0;

  const comissaoServicosValor = Number(comissaoServicos) || 0;

  // Comissão de Gerência por volume da loja (sem duplicar caso comissaoGeral já tenha sido preenchida igual)
  const qtdMotosGerente = Math.max(0, parseInt(String(motosLojaGerente || 0), 10) || 0);
  const valorUnitGerente = Math.max(0, Number(valorComissaoGerentePorMoto) || 0);
  const comissaoVolumeLojaGerente = +(qtdMotosGerente * valorUnitGerente).toFixed(2);
  const rawComissaoGeral = Number(comissaoGeral) || 0;
  // Se rawComissaoGeral for exatamente igual a comissaoVolumeLojaGerente (legado do modal), não soma duplicado
  const comissaoGeralExtra =
    comissaoVolumeLojaGerente > 0 && Math.abs(rawComissaoGeral - comissaoVolumeLojaGerente) < 0.01
      ? 0
      : rawComissaoGeral;
  const comissaoGeralValor = +(comissaoVolumeLojaGerente + comissaoGeralExtra).toFixed(2);

  const listaComissoesCustom: ComissaoDetalhadaItem[] = Array.isArray(comissoesDetalhadas)
    ? comissoesDetalhadas
    : [];
  const comissoesCustomTotal = +listaComissoesCustom
    .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
    .toFixed(2);

  const comissaoMotoParceiroValor = +(Number(comissaoMotoParceiro) || 0).toFixed(2);
  const comissaoRetornoValor = +(Number(comissaoRetorno) || 0).toFixed(2);
  const comissaoTreinamentoValor = +(Number(comissaoTreinamento) || 0).toFixed(2);

  const totalTodasComissoes = +(
    comissaoMotosValor +
    extraCidadeTotal +
    comissaoMarketingProprioValor +
    comissaoMontagemValor +
    comissaoRevisoesValor +
    comissaoServicosValor +
    comissaoGeralValor +
    bonusMetaValor +
    comissoesCustomTotal +
    comissaoMotoParceiroValor +
    comissaoRetornoValor +
    comissaoTreinamentoValor
  ).toFixed(2);

  const isTerceirizado =
    funcionario.tipoContrato === 'TERCEIRIZADO' || funcionario.tipoContrato === 'PJ';

  const devePagarDSRComissao = isTerceirizado
    ? false
    : funcionario.pagarDSRComissao !== undefined
      ? Number(funcionario.pagarDSRComissao) === 1
      : true;
  const dsrComissao = devePagarDSRComissao
    ? calcularDSR(totalTodasComissoes, diasUteis, domingosEFeriados)
    : 0;

  // 3. Horas Extras e Noturno
  const he = calcularHorasExtras(salarioBase, cargaHoraria, horas50, horas100);
  const adicNoturno = calcularAdicionalNoturno(salarioBase, cargaHoraria, horasNoturnas);

  const totalHorasVariaveis = he.totalHorasExtras + adicNoturno.valorTotal;
  const dsrHoras = isTerceirizado
    ? 0
    : calcularDSR(totalHorasVariaveis, diasUteis, domingosEFeriados);

  // 4. Faltas e Atrasos
  const valorDia = salarioBase / 30;
  const valorHora = salarioBase / cargaHoraria;
  const valorFaltas = +(faltasDias * valorDia).toFixed(2);
  const valorAtrasos = +((atrasosMinutos / 60) * valorHora).toFixed(2);
  const dsrPerdidoFaltas =
    faltasDias > 0 && !isTerceirizado ? +(Math.ceil(faltasDias / 6) * valorDia).toFixed(2) : 0;

  // Ajuda de Custo, Reembolsos e Gastos com a Loja (Art. 457, § 2º CLT - Indenizatório / Isento de INSS/FGTS)
  const ajudaDeCustoValor = +(Number(ajudaDeCusto) || 0).toFixed(2);
  const reembolsoDespesasValor = +(Number(reembolsoDespesas) || 0).toFixed(2);
  const gastosDiversosValor = +(Number(gastosDiversos) || 0).toFixed(2);

  // 5. Total de Proventos Brutos
  const totalProventos = +(
    salarioBase +
    comissaoMotosValor +
    comissaoMarketingProprioValor +
    comissaoMontagemValor +
    comissaoRevisoesValor +
    comissaoServicosValor +
    comissaoGeralValor +
    bonusMetaValor +
    comissoesCustomTotal +
    comissaoMotoParceiroValor +
    comissaoRetornoValor +
    comissaoTreinamentoValor +
    dsrComissao +
    he.totalHorasExtras +
    adicNoturno.valorTotal +
    dsrHoras +
    insalubridade +
    periculosidade +
    Number(outrosProventos) +
    ajudaDeCustoValor +
    reembolsoDespesasValor +
    gastosDiversosValor
  ).toFixed(2);

  // Base de Cálculo INSS
  const baseINSS = isTerceirizado
    ? 0
    : Math.max(
        0,
        +(
          totalProventos -
          ajudaDeCustoValor -
          reembolsoDespesasValor -
          gastosDiversosValor -
          valorFaltas -
          valorAtrasos -
          dsrPerdidoFaltas
        ).toFixed(2),
      );

  const deveCobrarINSS = isTerceirizado
    ? false
    : funcionario.descontarINSS !== undefined
      ? Number(funcionario.descontarINSS) === 1
      : true;
  const deveCobrarIRRF = isTerceirizado
    ? false
    : funcionario.descontarIRRF !== undefined
      ? Number(funcionario.descontarIRRF) === 1
      : true;
  const deveCalcularFGTS = isTerceirizado
    ? false
    : funcionario.calcularFGTS !== undefined
      ? Number(funcionario.calcularFGTS) === 1
      : true;

  const inss = deveCobrarINSS
    ? calcularINSS(baseINSS)
    : { valor: 0, aliquotaEfetiva: 0, isento: true };

  const dependentes = Number(funcionario.dependentes) || 0;
  const irrf = deveCobrarIRRF
    ? calcularIRRF(baseINSS, inss.valor, dependentes, pensaoAlimenticia)
    : { valor: 0, aliquota: 0, baseCalculo: 0, isento: true };

  const baseFGTS = baseINSS;
  const fgts = deveCalcularFGTS
    ? calcularFGTS(baseFGTS, funcionario.tipoContrato || 'CLT')
    : 0;

  // 6. Descontos do Colaborador
  const descontoVT = isTerceirizado
    ? 0
    : calcularValeTransporte(salarioBase, custoValeTransporte, optanteVT);

  const listaDescontos: RubricaDesconto[] = [
    ...(deveCobrarINSS && inss.valor > 0
      ? [
          {
            rubrica: 'INSS',
            tipo: 'LEGAL' as const,
            valor: inss.valor,
            aliquotaEfetiva: inss.aliquotaEfetiva,
          },
        ]
      : []),
    ...(deveCobrarIRRF && irrf.valor > 0
      ? [{ rubrica: 'IRRF', tipo: 'LEGAL' as const, valor: irrf.valor, aliquota: irrf.aliquota }]
      : []),
    ...(isTerceirizado
      ? []
      : [{ rubrica: 'Vale Transporte (6% teto)', tipo: 'BENEFICIO' as const, valor: descontoVT }]),
    {
      rubrica: 'Vale Refeição / Alimentação',
      tipo: 'BENEFICIO' as const,
      valor: +Number(descontoValeRefeicao).toFixed(2),
    },
    {
      rubrica: 'Plano de Saúde / Odonto',
      tipo: 'BENEFICIO' as const,
      valor: +Number(descontoPlanoSaude).toFixed(2),
    },
    { rubrica: 'Faltas Injustificadas', tipo: 'PENALIDADE' as const, valor: valorFaltas },
    { rubrica: 'Atrasos / Saídas Antecipadas', tipo: 'PENALIDADE' as const, valor: valorAtrasos },
    { rubrica: 'DSR sobre Faltas', tipo: 'PENALIDADE' as const, valor: dsrPerdidoFaltas },
    {
      rubrica: 'Pensão Alimentícia Judicial',
      tipo: 'LEGAL' as const,
      valor: +Number(pensaoAlimenticia).toFixed(2),
    },
    {
      rubrica: outrosDescontosDescricao
        ? `Outro Gasto / Desconto: ${outrosDescontosDescricao}`
        : 'Outros Descontos / Gastos',
      tipo: 'OUTROS' as const,
      valor: +Number(outrosDescontos).toFixed(2),
    },
  ].filter((d) => d.valor > 0);

  const totalDescontos = +listaDescontos.reduce((acc, curr) => acc + curr.valor, 0).toFixed(2);

  // 7. Proventos Detalhados
  const listaProventos: RubricaProvento[] = [
    {
      rubrica: isTerceirizado ? 'Prestação de Serviços (Terceirizado)' : 'Salário Base',
      tipo: 'FIXO' as const,
      valor: salarioBase,
      referencia: isTerceirizado ? 'Serviços Prestados' : '30 dias',
    },
    {
      rubrica:
        qtdMktProprio > 0
          ? 'Comissão Vendas (Marketing Loja)'
          : 'Comissão de Vendas de Motos',
      tipo: 'VARIAVEL' as const,
      valor: comissaoMotosValor,
      referencia: `${infoComissaoVenda.motosVendidas} motos (R$ ${infoComissaoVenda.valorUnitarioFaixa}/un)`,
    },
    ...(extraCidadeTotal > 0
      ? [
          {
            rubrica: 'Adicional Diferenciado de Cidade / Região',
            tipo: 'VARIAVEL' as const,
            valor: extraCidadeTotal,
            referencia: `+R$ ${Number(adicionalCidadePorMoto).toFixed(2)}/moto (${qtdMotosGerais} un)`,
          },
        ]
      : []),
    ...(qtdMktProprio > 0
      ? [
          {
            rubrica: 'Comissão Vendas (Próprio Marketing / Captação)',
            tipo: 'VARIAVEL' as const,
            valor: comissaoMarketingProprioValor,
            referencia: `${qtdMktProprio} motos (R$ ${valorUnitProprio.toFixed(2)}/un)`,
          },
        ]
      : []),
    {
      rubrica: 'Comissão Montagem de Motos (Mecânico)',
      tipo: 'VARIAVEL' as const,
      valor: comissaoMontagemValor,
      referencia: `${infoMontagem.motosMontadas} montagens (R$ ${infoMontagem.valorPorMontagem.toFixed(2)}/un)`,
    },
    ...(comissaoRevisoesValor > 0 || infoRevisao.revisoesExecutadas > 0
      ? [
          {
            rubrica: 'Comissão Revisões Periódicas (Mecânico)',
            tipo: 'VARIAVEL' as const,
            valor: comissaoRevisoesValor,
            referencia: `${infoRevisao.revisoesExecutadas} revisões (R$ ${infoRevisao.valorPorRevisao.toFixed(2)}/un)`,
          },
        ]
      : []),
    {
      rubrica: 'Comissão de Oficina / Mecânica / Peças',
      tipo: 'VARIAVEL' as const,
      valor: comissaoServicosValor,
      referencia: 'Serviços',
    },
    {
      rubrica: descricaoComissaoGeral
        ? descricaoComissaoGeral.trim()
        : 'Metas / Desempenho Loja',
      tipo: 'VARIAVEL' as const,
      valor: comissaoGeralValor,
      referencia: 'Metas',
    },
    ...(bonusMetaValor > 0
      ? [
          {
            rubrica: 'Bônus por Atingimento de Meta da Loja',
            tipo: 'VARIAVEL' as const,
            valor: bonusMetaValor,
            referencia: 'Meta Batida',
          },
        ]
      : []),
    ...listaComissoesCustom.map((c) => ({
      rubrica: c.nome ? c.nome.trim() : 'Atividade / Serviço Realizado',
      tipo: 'VARIAVEL' as const,
      valor: Number(c.valor) || 0,
      referencia: c.referencia || (c.qtd ? `${c.qtd} un` : ''),
    })),
    {
      rubrica: 'DSR sobre Comissões (Súm. 27 TST)',
      tipo: 'VARIAVEL' as const,
      valor: dsrComissao,
      referencia: `${domingosEFeriados} dom/fer`,
    },
    {
      rubrica: 'Horas Extras 50%',
      tipo: 'VARIAVEL' as const,
      valor: he.total50,
      referencia: `${horas50}h`,
    },
    {
      rubrica: 'Horas Extras 100%',
      tipo: 'VARIAVEL' as const,
      valor: he.total100,
      referencia: `${horas100}h`,
    },
    {
      rubrica: 'Adicional Noturno (20%)',
      tipo: 'VARIAVEL' as const,
      valor: adicNoturno.valorTotal,
      referencia: `${horasNoturnas}h`,
    },
    {
      rubrica: 'DSR sobre Horas Extras / Noturno',
      tipo: 'VARIAVEL' as const,
      valor: dsrHoras,
      referencia: `${domingosEFeriados} dom/fer`,
    },
    {
      rubrica: 'Adicional de Insalubridade',
      tipo: 'ADICIONAL' as const,
      valor: insalubridade,
      referencia: funcionario.grauInsalubridade,
    },
    {
      rubrica: 'Adicional de Periculosidade (30%)',
      tipo: 'ADICIONAL' as const,
      valor: periculosidade,
      referencia: '30%',
    },
    {
      rubrica: ajudaDeCustoDescricao
        ? `Ajuda de Custo: ${ajudaDeCustoDescricao}`
        : 'Ajuda de Custo',
      tipo: 'INDENIZATORIO' as const,
      valor: ajudaDeCustoValor,
      referencia: 'Isento Encargos',
    },
    {
      rubrica: reembolsoDespesasDescricao
        ? `Reembolso de Gastos: ${reembolsoDespesasDescricao}`
        : 'Reembolso de Despesas / Gastos',
      tipo: 'INDENIZATORIO' as const,
      valor: reembolsoDespesasValor,
      referencia: 'Reembolso',
    },
    {
      rubrica: gastosDiversosDescricao
        ? `Gastos com a Loja: ${gastosDiversosDescricao}`
        : 'Gastos Diversos com a Loja',
      tipo: 'INDENIZATORIO' as const,
      valor: gastosDiversosValor,
      referencia: 'Operacional',
    },
    {
      rubrica: motoParceiroDescricao
        ? motoParceiroDescricao.trim()
        : 'Moto Parceiro',
      tipo: 'VARIAVEL' as const,
      valor: comissaoMotoParceiroValor,
      referencia: motoParceiroQtd > 0 ? `${motoParceiroQtd} un` : 'Parceiro',
    },
    {
      rubrica: retornoDescricao
        ? retornoDescricao.trim()
        : 'Retorno Financeiro (F&I)',
      tipo: 'VARIAVEL' as const,
      valor: comissaoRetornoValor,
      referencia: 'Retorno F&I',
    },
    {
      rubrica: comissaoTreinamentoDescricao
        ? comissaoTreinamentoDescricao.trim()
        : 'Treinamento de Equipe',
      tipo: 'VARIAVEL' as const,
      valor: comissaoTreinamentoValor,
      referencia: 'Treinamento',
    },
    {
      rubrica: outrosProventosDescricao
        ? `Outro Ganho: ${outrosProventosDescricao}`
        : 'Outros Proventos / Gratificações',
      tipo: 'VARIAVEL' as const,
      valor: +Number(outrosProventos).toFixed(2),
      referencia: '',
    },
  ].filter((p) => p.valor > 0);

  const salarioLiquido = +(totalProventos - totalDescontos).toFixed(2);

  const aliquotaPatronal = funcionario.regimeEmpresa === 'SIMPLES_NACIONAL' ? 0 : 0.288;
  const inssPatronal = +(baseINSS * aliquotaPatronal).toFixed(2);
  const custoTotalEmpresa = +(totalProventos + fgts + inssPatronal).toFixed(2);

  return {
    funcionarioId: funcionario.id,
    funcionarioNome: funcionario.nome || funcionario.full_name || '',
    cargo: funcionario.cargo || funcionario.position || funcionario.role || '',
    cpf: funcionario.cpf || '',
    departamento: funcionario.departamento || 'VENDAS',
    tipoContrato: funcionario.tipoContrato || 'CLT',
    razaoSocialPrestador: funcionario.razaoSocialPrestador || '',
    cnpjPrestador: funcionario.cnpjPrestador || '',
    mesReferencia,
    salarioBase,
    motosVendidas: qtdMotosGerais,
    motosMarketingLoja: qtdMktLoja,
    motosMarketingProprio: qtdMktProprio,
    valorMarketingProprio: valorUnitProprio,
    comissaoMarketingProprio: comissaoMarketingProprioValor,
    motosMontadas: infoMontagem.motosMontadas,
    valorPorMontagem: infoMontagem.valorPorMontagem,
    comissaoMotos: comissaoMotosValor,
    comissaoMontagem: comissaoMontagemValor,
    revisoesExecutadas: infoRevisao.revisoesExecutadas,
    valorPorRevisao: infoRevisao.valorPorRevisao,
    comissaoRevisoes: comissaoRevisoesValor,
    bonusMetaBatida: bonusMetaValor,
    comissaoServicos: comissaoServicosValor,
    comissaoGeral: comissaoGeralValor,
    comissoesDetalhadas: listaComissoesCustom,
    cadernoAnotacoes: dados.cadernoAnotacoes || cadernoAnotacoes || '',
    totalComissoes: totalTodasComissoes,
    comissaoDSR: dsrComissao,
    infoComissao: infoComissaoVenda,
    infoMontagem,
    infoRevisao,
    ajudaDeCusto: ajudaDeCustoValor,
    ajudaDeCustoDescricao,
    reembolsoDespesas: reembolsoDespesasValor,
    reembolsoDespesasDescricao,
    gastosDiversos: gastosDiversosValor,
    gastosDiversosDescricao,
    comissaoMotoParceiro: comissaoMotoParceiroValor,
    motoParceiroQtd,
    motoParceiroDescricao,
    comissaoRetorno: comissaoRetornoValor,
    retornoDescricao,
    comissaoTreinamento: comissaoTreinamentoValor,
    comissaoTreinamentoDescricao,
    totalProventos,
    totalDescontos,
    salarioLiquido,
    fgts,
    inssPatronal,
    custoTotalEmpresa,
    baseINSS,
    baseFGTS,
    baseIRRF: irrf.baseCalculo || 0,
    proventos: listaProventos,
    descontos: listaDescontos,
    inssDetalhe: inss,
    irrfDetalhe: irrf,
    geradoEm: new Date().toISOString(),
  };
}

/**
 * Sanitiza e normaliza qualquer objeto de resultado de folha (especialmente os vindos de JSON/banco de dados)
 * garantindo que arrays, totais e objetos detalhados existam para prevenir crashes e telas brancas.
 */
export function sanitizarResultadoFolha(
  raw: any,
  fallbackFuncionario?: any,
): ResultadoFolhaFuncionario {
  if (!raw || typeof raw !== 'object') {
    const salario = Number(fallbackFuncionario?.salarioBase) || 0;
    return {
      funcionarioId: fallbackFuncionario?.id || '',
      funcionarioNome: fallbackFuncionario?.nome || fallbackFuncionario?.full_name || 'Colaborador',
      cargo: fallbackFuncionario?.cargo || fallbackFuncionario?.position || 'Colaborador',
      cpf: fallbackFuncionario?.cpf || '',
      departamento: fallbackFuncionario?.departamento || 'VENDAS',
      tipoContrato: fallbackFuncionario?.tipoContrato || 'CLT',
      razaoSocialPrestador: fallbackFuncionario?.razaoSocialPrestador || '',
      cnpjPrestador: fallbackFuncionario?.cnpjPrestador || '',
      mesReferencia: new Date().toISOString().slice(0, 7),
      salarioBase: salario,
      motosVendidas: 0,
      motosMarketingLoja: 0,
      motosMarketingProprio: 0,
      valorMarketingProprio: 0,
      comissaoMarketingProprio: 0,
      motosMontadas: 0,
      valorPorMontagem: 0,
      comissaoMotos: 0,
      comissaoMontagem: 0,
      revisoesExecutadas: 0,
      valorPorRevisao: 0,
      comissaoRevisoes: 0,
      bonusMetaBatida: 0,
      comissaoServicos: 0,
      comissaoGeral: 0,
      comissoesDetalhadas: [],
      cadernoAnotacoes: '',
      totalComissoes: 0,
      comissaoDSR: 0,
      infoComissao: { motosVendidas: 0, valorUnitarioFaixa: 0, totalComissao: 0, faixaAtingida: "" },
      infoMontagem: { motosMontadas: 0, valorPorMontagem: 0, totalComissao: 0, descricao: "" },
      infoRevisao: { revisoesExecutadas: 0, valorPorRevisao: 0, totalComissao: 0, descricao: "" },
      ajudaDeCusto: 0,
      ajudaDeCustoDescricao: '',
      reembolsoDespesas: 0,
      reembolsoDespesasDescricao: '',
      gastosDiversos: 0,
      gastosDiversosDescricao: '',
      comissaoMotoParceiro: 0,
      motoParceiroQtd: 0,
      motoParceiroDescricao: '',
      comissaoRetorno: 0,
      retornoDescricao: '',
      comissaoTreinamento: 0,
      comissaoTreinamentoDescricao: '',
      totalProventos: salario,
      totalDescontos: 0,
      salarioLiquido: salario,
      fgts: +(salario * 0.08).toFixed(2),
      inssPatronal: 0,
      custoTotalEmpresa: salario,
      baseINSS: salario,
      baseFGTS: salario,
      baseIRRF: 0,
      proventos: salario > 0 ? [{ rubrica: 'Salário Base', tipo: 'FIXO', valor: salario, referencia: '30 dias' }] : [],
      descontos: [],
      inssDetalhe: { aliquotaEfetiva: 0, valor: 0, memoria: [] },
      irrfDetalhe: { baseCalculo: 0, aliquota: 0, deducaoFaixa: 0, valor: 0, usouSimplificado: false },
      geradoEm: new Date().toISOString(),
    };
  }

  const proventosArray = Array.isArray(raw.proventos)
    ? raw.proventos
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any) => ({
          rubrica: String(p.rubrica || 'Provento'),
          tipo: p.tipo || 'VARIAVEL',
          valor: Number(p.valor) || 0,
          referencia: p.referencia ? String(p.referencia) : undefined,
        }))
    : [];

  const descontosArray = Array.isArray(raw.descontos)
    ? raw.descontos
        .filter((d: any) => d && typeof d === 'object')
        .map((d: any) => ({
          rubrica: String(d.rubrica || 'Desconto'),
          tipo: d.tipo || 'LEGAL',
          valor: Number(d.valor) || 0,
          aliquota: d.aliquota !== undefined ? Number(d.aliquota) : undefined,
          aliquotaEfetiva: d.aliquotaEfetiva !== undefined ? Number(d.aliquotaEfetiva) : undefined,
        }))
    : [];

  const inssSafe =
    raw.inssDetalhe && typeof raw.inssDetalhe === 'object'
      ? {
          faixa: Number(raw.inssDetalhe.faixa) || 0,
          aliquotaEfetiva: Number(raw.inssDetalhe.aliquotaEfetiva) || 0,
          valor: Number(raw.inssDetalhe.valor) || 0,
          faixasDetalhadas: Array.isArray(raw.inssDetalhe.faixasDetalhadas)
            ? raw.inssDetalhe.faixasDetalhadas
            : [],
        }
      : { faixa: 0, aliquotaEfetiva: 0, valor: 0, faixasDetalhadas: [] };

  const irrfSafe =
    raw.irrfDetalhe && typeof raw.irrfDetalhe === 'object'
      ? {
          baseCalculo: Number(raw.irrfDetalhe.baseCalculo) || 0,
          faixa: Number(raw.irrfDetalhe.faixa) || 0,
          aliquota: Number(raw.irrfDetalhe.aliquota) || 0,
          deducao: Number(raw.irrfDetalhe.deducao) || 0,
          valor: Number(raw.irrfDetalhe.valor) || 0,
          usouSimplificado: Boolean(raw.irrfDetalhe.usouSimplificado),
        }
      : { baseCalculo: 0, faixa: 0, aliquota: 0, deducao: 0, valor: 0, usouSimplificado: false };

  const totalProventosCalc =
    raw.totalProventos !== undefined
      ? Number(raw.totalProventos) || 0
      : proventosArray.reduce((acc: number, p: any) => acc + (p.valor || 0), 0);

  const totalDescontosCalc =
    raw.totalDescontos !== undefined
      ? Number(raw.totalDescontos) || 0
      : descontosArray.reduce((acc: number, d: any) => acc + (d.valor || 0), 0);

  const salarioLiquidoCalc =
    raw.salarioLiquido !== undefined
      ? Number(raw.salarioLiquido) || 0
      : +(totalProventosCalc - totalDescontosCalc).toFixed(2);

  return {
    funcionarioId: raw.funcionarioId || fallbackFuncionario?.id || '',
    funcionarioNome: raw.funcionarioNome || fallbackFuncionario?.nome || fallbackFuncionario?.full_name || 'Colaborador',
    cargo: raw.cargo || fallbackFuncionario?.cargo || fallbackFuncionario?.position || 'Colaborador',
    cpf: raw.cpf || fallbackFuncionario?.cpf || '',
    departamento: raw.departamento || fallbackFuncionario?.departamento || 'VENDAS',
    tipoContrato: raw.tipoContrato || fallbackFuncionario?.tipoContrato || 'CLT',
    razaoSocialPrestador: raw.razaoSocialPrestador || fallbackFuncionario?.razaoSocialPrestador || '',
    cnpjPrestador: raw.cnpjPrestador || fallbackFuncionario?.cnpjPrestador || '',
    mesReferencia: raw.mesReferencia || new Date().toISOString().slice(0, 7),
    salarioBase: Number(raw.salarioBase ?? fallbackFuncionario?.salarioBase) || 0,
    motosVendidas: Number(raw.motosVendidas) || 0,
    motosMarketingLoja: Number(raw.motosMarketingLoja) || 0,
    motosMarketingProprio: Number(raw.motosMarketingProprio) || 0,
    valorMarketingProprio: Number(raw.valorMarketingProprio) || 0,
    comissaoMarketingProprio: Number(raw.comissaoMarketingProprio) || 0,
    motosMontadas: Number(raw.motosMontadas) || 0,
    valorPorMontagem: Number(raw.valorPorMontagem) || 0,
    comissaoMotos: Number(raw.comissaoMotos) || 0,
    comissaoMontagem: Number(raw.comissaoMontagem) || 0,
    revisoesExecutadas: Number(raw.revisoesExecutadas) || 0,
    valorPorRevisao: Number(raw.valorPorRevisao) || 0,
    comissaoRevisoes: Number(raw.comissaoRevisoes) || 0,
    bonusMetaBatida: Number(raw.bonusMetaBatida) || 0,
    comissaoServicos: Number(raw.comissaoServicos) || 0,
    comissaoGeral: Number(raw.comissaoGeral) || 0,
    comissoesDetalhadas: Array.isArray(raw.comissoesDetalhadas) ? raw.comissoesDetalhadas : [],
    cadernoAnotacoes: raw.cadernoAnotacoes || '',
    totalComissoes: Number(raw.totalComissoes) || 0,
    comissaoDSR: Number(raw.comissaoDSR) || 0,
    infoComissao: raw.infoComissao || { motosVendidas: 0, faixaDe: 0, faixaAte: 0, valorUnitarioFaixa: 0, valorTotalSemDSR: 0 },
    infoMontagem: raw.infoMontagem || { motosMontadas: 0, valorPorMontagem: 0, total: 0 },
    infoRevisao: raw.infoRevisao || { revisoesExecutadas: 0, valorPorRevisao: 0, total: 0 },
    ajudaDeCusto: Number(raw.ajudaDeCusto) || 0,
    ajudaDeCustoDescricao: raw.ajudaDeCustoDescricao || '',
    reembolsoDespesas: Number(raw.reembolsoDespesas) || 0,
    reembolsoDespesasDescricao: raw.reembolsoDespesasDescricao || '',
    gastosDiversos: Number(raw.gastosDiversos) || 0,
    gastosDiversosDescricao: raw.gastosDiversosDescricao || '',
    comissaoMotoParceiro: Number(raw.comissaoMotoParceiro) || 0,
    motoParceiroQtd: Number(raw.motoParceiroQtd) || 0,
    motoParceiroDescricao: raw.motoParceiroDescricao || '',
    comissaoRetorno: Number(raw.comissaoRetorno) || 0,
    retornoDescricao: raw.retornoDescricao || '',
    comissaoTreinamento: Number(raw.comissaoTreinamento) || 0,
    comissaoTreinamentoDescricao: raw.comissaoTreinamentoDescricao || '',
    totalProventos: totalProventosCalc,
    totalDescontos: totalDescontosCalc,
    salarioLiquido: salarioLiquidoCalc,
    fgts: Number(raw.fgts) || 0,
    inssPatronal: Number(raw.inssPatronal) || 0,
    custoTotalEmpresa: Number(raw.custoTotalEmpresa) || totalProventosCalc,
    baseINSS: Number(raw.baseINSS) || 0,
    baseFGTS: Number(raw.baseFGTS) || 0,
    baseIRRF: Number(raw.baseIRRF) || 0,
    proventos: proventosArray,
    descontos: descontosArray,
    inssDetalhe: inssSafe,
    irrfDetalhe: irrfSafe,
    geradoEm: raw.geradoEm || new Date().toISOString(),
  };
}

/**
 * Cálculo de Férias CLT (com 1/3 Constitucional, Abono Pecuniário opcional e Média de Comissões CLT Art. 142)
 */
export function calcularFerias(
  salarioBase: number,
  diasGozo = 30,
  vendeu10Dias = false,
  adiantarDecimoTerceiro = false,
  dependentes = 0,
  mediaComissoes = 0,
) {
  const baseRemuneracao = +(Number(salarioBase || 0) + Number(mediaComissoes || 0)).toFixed(2);
  const valorDia = baseRemuneracao / 30;
  const diasEfetivosGozo = vendeu10Dias ? 20 : diasGozo;

  const valorGozo = +(diasEfetivosGozo * valorDia).toFixed(2);
  const tercoConstitucional = +(valorGozo / 3).toFixed(2);

  const abonoPecuniario = vendeu10Dias ? +(10 * valorDia).toFixed(2) : 0;
  const tercoAbono = vendeu10Dias ? +(abonoPecuniario / 3).toFixed(2) : 0;

  const baseINSSFerias = +(valorGozo + tercoConstitucional).toFixed(2);
  const inss = calcularINSS(baseINSSFerias);
  const irrf = calcularIRRF(baseINSSFerias, inss.valor, dependentes);

  const adiantamento13 = adiantarDecimoTerceiro ? +(baseRemuneracao / 2).toFixed(2) : 0;

  const totalBruto = +(
    valorGozo +
    tercoConstitucional +
    abonoPecuniario +
    tercoAbono +
    adiantamento13
  ).toFixed(2);
  const totalDescontos = +(inss.valor + irrf.valor).toFixed(2);
  const liquidoFerias = +(totalBruto - totalDescontos).toFixed(2);

  return {
    diasGozo: diasEfetivosGozo,
    vendeu10Dias,
    baseRemuneracao,
    mediaComissoes: +(Number(mediaComissoes) || 0).toFixed(2),
    valorGozo,
    tercoConstitucional,
    abonoPecuniario,
    tercoAbono,
    adiantamento13,
    totalBruto,
    inss,
    irrf,
    totalDescontos,
    liquidoFerias,
  };
}

/**
 * Cálculo de 13º Salário (1ª e 2ª Parcelas + Reflexo de Média de Comissões)
 */
export function calcularDecimoTerceiro(
  salarioBase: number,
  mesesTrabalhados = 12,
  parcela: 'PRIMEIRA' | 'SEGUNDA' = 'PRIMEIRA',
  dependentes = 0,
  mediaComissoes = 0,
) {
  const baseRemuneracao = +(Number(salarioBase || 0) + Number(mediaComissoes || 0)).toFixed(2);
  const avos = Math.min(12, Math.max(1, mesesTrabalhados));
  const valorIntegralProporcional = +((baseRemuneracao / 12) * avos).toFixed(2);

  if (parcela === 'PRIMEIRA') {
    const valorPrimeira = +(valorIntegralProporcional / 2).toFixed(2);
    return {
      parcela: '1ª Parcela',
      mesesTrabalhados: avos,
      baseRemuneracao,
      mediaComissoes: +(Number(mediaComissoes) || 0).toFixed(2),
      valorBruto: valorPrimeira,
      valorIntegral: valorIntegralProporcional,
      adiantamentoJaPago: 0,
      inss: { valor: 0 },
      irrf: { valor: 0 },
      totalDescontos: 0,
      valorLiquido: valorPrimeira,
    };
  } else {
    const adiantamentoJaPago = +(valorIntegralProporcional / 2).toFixed(2);
    const inss = calcularINSS(valorIntegralProporcional);
    const irrf = calcularIRRF(valorIntegralProporcional, inss.valor, dependentes);

    const totalDescontos = +(inss.valor + irrf.valor).toFixed(2);
    const valorLiquido = +(
      valorIntegralProporcional -
      adiantamentoJaPago -
      totalDescontos
    ).toFixed(2);

    return {
      parcela: '2ª Parcela',
      mesesTrabalhados: avos,
      baseRemuneracao,
      mediaComissoes: +(Number(mediaComissoes) || 0).toFixed(2),
      valorBruto: valorIntegralProporcional,
      valorIntegral: valorIntegralProporcional,
      adiantamentoJaPago,
      inss,
      irrf,
      totalDescontos,
      valorLiquido,
    };
  }
}

/**
 * Cálculo Rescisório Trabalhista CLT
 */
export function calcularRescisao({
  salarioBase,
  mediaComissoes = 0,
  dataAdmissao,
  dataDemissao,
  motivo,
  avisoPrevioIndenizado = true,
  saldoSalarioDias = 0,
  feriasVencidas = false,
  saldoFGTSAtual = 0,
}: {
  salarioBase: number;
  mediaComissoes?: number;
  dataAdmissao: string;
  dataDemissao: string;
  motivo: 'SEM_JUSTA_CAUSA' | 'PEDIDO_DEMISSAO' | 'ACORDO_MUTUO' | 'COM_JUSTA_CAUSA';
  avisoPrevioIndenizado?: boolean;
  saldoSalarioDias?: number;
  feriasVencidas?: boolean;
  saldoFGTSAtual?: number;
}) {
  const baseRemuneracao = +(Number(salarioBase || 0) + Number(mediaComissoes || 0)).toFixed(2);
  const dAdm = new Date(`${dataAdmissao}T12:00:00`);
  const dDem = new Date(`${dataDemissao}T12:00:00`);
  const diffMs = Math.max(0, dDem.getTime() - dAdm.getTime());
  const anosCompletos = Math.max(0, Math.floor(diffMs / (365.25 * 24 * 3600 * 1000)));

  const diasAvisoPrevio = Math.min(90, 30 + anosCompletos * 3);
  const valorAvisoPrevio = avisoPrevioIndenizado
    ? +((baseRemuneracao / 30) * diasAvisoPrevio).toFixed(2)
    : 0;
  const saldoSalario = +((baseRemuneracao / 30) * saldoSalarioDias).toFixed(2);

  const mesDemissao = dDem.getMonth() + 1;
  let avos13 = dDem.getDate() >= 15 ? mesDemissao : Math.max(0, mesDemissao - 1);
  if (dAdm.getFullYear() === dDem.getFullYear()) {
    const mesInicio = dAdm.getDate() <= 15 ? dAdm.getMonth() + 1 : dAdm.getMonth() + 2;
    const mesFim = dDem.getDate() >= 15 ? mesDemissao : mesDemissao - 1;
    avos13 = Math.max(0, Math.min(12, mesFim - mesInicio + 1));
  } else if (dDem < dAdm) {
    avos13 = 0;
  }
  const avosFerias = Math.min(12, Math.max(0, avos13));

  let decimoTerceiroProp = 0;
  let feriasProporcionais = 0;
  let feriasVencidasValor = 0;
  let tercoFerias = 0;
  let multaFGTS = 0;
  let saqueFGTSLiberado = false;

  const valorAvos13 = +((baseRemuneracao / 12) * avos13).toFixed(2);
  const valorAvosFerias = +((baseRemuneracao / 12) * avosFerias).toFixed(2);

  if (motivo === 'SEM_JUSTA_CAUSA') {
    decimoTerceiroProp = valorAvos13;
    feriasProporcionais = valorAvosFerias;
    if (feriasVencidas) feriasVencidasValor = baseRemuneracao;
    tercoFerias = +((feriasProporcionais + feriasVencidasValor) / 3).toFixed(2);
    multaFGTS = +(saldoFGTSAtual * 0.4).toFixed(2);
    saqueFGTSLiberado = true;
  } else if (motivo === 'PEDIDO_DEMISSAO') {
    decimoTerceiroProp = valorAvos13;
    feriasProporcionais = valorAvosFerias;
    if (feriasVencidas) feriasVencidasValor = baseRemuneracao;
    tercoFerias = +((feriasProporcionais + feriasVencidasValor) / 3).toFixed(2);
    multaFGTS = 0;
    saqueFGTSLiberado = false;
  } else if (motivo === 'ACORDO_MUTUO') {
    decimoTerceiroProp = valorAvos13;
    feriasProporcionais = valorAvosFerias;
    if (feriasVencidas) feriasVencidasValor = baseRemuneracao;
    tercoFerias = +((feriasProporcionais + feriasVencidasValor) / 3).toFixed(2);
    multaFGTS = +(saldoFGTSAtual * 0.2).toFixed(2);
    saqueFGTSLiberado = true;
  } else if (motivo === 'COM_JUSTA_CAUSA') {
    if (feriasVencidas) {
      feriasVencidasValor = baseRemuneracao;
      tercoFerias = +(feriasVencidasValor / 3).toFixed(2);
    }
  }

  const inssSaldo = calcularINSS(saldoSalario);
  const inss13 = calcularINSS(decimoTerceiroProp);
  const totalINSS = +(inssSaldo.valor + inss13.valor).toFixed(2);

  const totalBruto = +(
    saldoSalario +
    (motivo === 'SEM_JUSTA_CAUSA' && avisoPrevioIndenizado ? valorAvisoPrevio : 0) +
    decimoTerceiroProp +
    feriasProporcionais +
    feriasVencidasValor +
    tercoFerias
  ).toFixed(2);

  const liquidoRescisao = +(totalBruto - totalINSS).toFixed(2);

  return {
    motivo,
    anosTrabalhados: anosCompletos,
    diasAvisoPrevio,
    valorAvisoPrevio,
    saldoSalario,
    decimoTerceiroProp,
    feriasProporcionais,
    feriasVencidasValor,
    tercoFerias,
    multaFGTS,
    saqueFGTSLiberado,
    totalBruto,
    totalINSS,
    liquidoRescisao,
  };
}

/**
 * Motor de Inteligência Artificial e Auditoria de Folha de Pagamento
 */
export interface AlertaAuditoriaIA {
  tipo: string;
  severidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  funcionario: string;
  titulo: string;
  mensagem: string;
}

export interface SugestaoAuditoriaIA {
  tipo: string;
  funcionario: string;
  titulo: string;
  mensagem: string;
}

export interface RelatorioAuditoriaIA {
  resumo: {
    totalFolha: number;
    totalEncargos: number;
    totalLiquido: number;
    qtdFuncionarios: number;
    maiorSalario: number;
    menorSalario: number;
    totalHorasExtrasValor: number;
    totalBeneficiosDescontados: number;
  };
  percentualEncargos: string;
  alertas: AlertaAuditoriaIA[];
  sugestoes: SugestaoAuditoriaIA[];
  scoreSaudeFolha: number;
  parecerExecutivo: string;
}

export function analisarFolhaComIA(
  folhasDetalhadas: ResultadoFolhaFuncionario[],
): RelatorioAuditoriaIA {
  const alertas: AlertaAuditoriaIA[] = [];
  const sugestoes: SugestaoAuditoriaIA[] = [];
  const listaValida = (Array.isArray(folhasDetalhadas) ? folhasDetalhadas : [])
    .filter(Boolean)
    .map((f) => sanitizarResultadoFolha(f));

  const resumo = {
    totalFolha: 0,
    totalEncargos: 0,
    totalLiquido: 0,
    qtdFuncionarios: listaValida.length,
    maiorSalario: 0,
    menorSalario: Infinity,
    totalHorasExtrasValor: 0,
    totalBeneficiosDescontados: 0,
  };

  listaValida.forEach((f) => {
    resumo.totalFolha += Number(f.totalProventos) || 0;
    resumo.totalEncargos += (Number(f.fgts) || 0) + (Number(f.inssPatronal) || 0);
    resumo.totalLiquido += Number(f.salarioLiquido) || 0;
    resumo.maiorSalario = Math.max(resumo.maiorSalario, Number(f.salarioBase) || 0);
    resumo.menorSalario = Math.min(resumo.menorSalario, Number(f.salarioBase) || 0);

    const provs = Array.isArray(f.proventos) ? f.proventos : [];
    const descs = Array.isArray(f.descontos) ? f.descontos : [];

    // 1. Auditoria de Horas Extras Excessivas (CLT Art. 59)
    const he50 = provs.find((p) => p?.rubrica && p.rubrica.includes('50%'));
    const he100 = provs.find((p) => p?.rubrica && p.rubrica.includes('100%'));
    const totalHEValor = (he50 ? Number(he50.valor) || 0 : 0) + (he100 ? Number(he100.valor) || 0 : 0);
    resumo.totalHorasExtrasValor += totalHEValor;

    if (f.salarioBase > 0 && totalHEValor > f.salarioBase * 0.4) {
      alertas.push({
        tipo: 'COMPLIANCE',
        severidade: 'ALTA',
        funcionario: f.funcionarioNome || 'Colaborador',
        titulo: 'Excesso Crítico de Horas Extras',
        mensagem: `${f.funcionarioNome || 'Colaborador'} teve mais de 40% do salário composto por horas extras (R$ ${totalHEValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Risco de passivo trabalhista e autuação fiscal do Ministério do Trabalho.`,
      });
    }

    // 2. Alerta de Dedução IRRF Simplificado vs Legal
    if (f.irrfDetalhe && f.irrfDetalhe.usouSimplificado && (f.irrfDetalhe.valor || 0) > 0) {
      sugestoes.push({
        tipo: 'ECONOMIA_COLABORADOR',
        funcionario: f.funcionarioNome || 'Colaborador',
        titulo: 'Otimização Fiscal Ativada',
        mensagem: `A retenção de IRRF de ${f.funcionarioNome || 'Colaborador'} foi calculada pela Regra do Desconto Simplificado (R$ 564,80), resultando em menor imposto retido e maior salário líquido na conta do colaborador.`,
      });
    }

    // 3. Faltas Injustificadas e reflexo no DSR
    const descFalta = descs.find((d) => d?.rubrica && d.rubrica.includes('Faltas'));
    if (descFalta && (descFalta.valor || 0) > 0) {
      alertas.push({
        tipo: 'ASSIDUIDADE',
        severidade: 'MEDIA',
        funcionario: f.funcionarioNome || 'Colaborador',
        titulo: 'Faltas Injustificadas Detectadas',
        mensagem: `${f.funcionarioNome || 'Colaborador'} teve desconto de faltas e perda do DSR semanal correspondente. Recomendado feedback com a liderança imediata.`,
      });
    }

    // 4. Benefício de VT abaixo de 6%
    const descVT = descs.find((d) => d?.rubrica && d.rubrica.includes('Vale Transporte'));
    if (descVT && (descVT.valor || 0) > 0 && descVT.valor < f.salarioBase * 0.06) {
      sugestoes.push({
        tipo: 'BENEFICIOS',
        funcionario: f.funcionarioNome || 'Colaborador',
        titulo: 'Custo de VT abaixo do teto de 6%',
        mensagem: `O desconto de VT foi de R$ ${descVT.valor.toFixed(2)}, inferior aos 6% máximos permitidos pela lei (que seriam R$ ${(f.salarioBase * 0.06).toFixed(2)}), beneficiando o funcionário.`,
      });
    }
  });

  if (resumo.menorSalario === Infinity) resumo.menorSalario = 0;

  const percentualEncargos =
    resumo.totalFolha > 0 ? ((resumo.totalEncargos / resumo.totalFolha) * 100).toFixed(1) : '0.0';

  return {
    resumo,
    percentualEncargos: `${percentualEncargos}%`,
    alertas,
    sugestoes,
    scoreSaudeFolha: Math.max(70, 100 - alertas.length * 8),
    parecerExecutivo: `A folha de pagamento está dentro dos parâmetros normativos do eSocial e da CLT. O custo patronal e encargos representam ${percentualEncargos}% sobre os proventos brutos. Foram detectadas ${alertas.length} inconsistências ou pontos de atenção preventiva.`,
  };
}
