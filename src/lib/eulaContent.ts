export const EULA_VERSION = "1.0";

export interface EulaClause {
  id: string;
  title: string;
  body: string[];
}

export const EULA_CLAUSES: EulaClause[] = [
  {
    id: "1",
    title: "1. Objeto e Aceitação",
    body: [
      "Este Contrato de Licença de Usuário Final (\"Termo\") regula o acesso e a utilização da plataforma PixelLoom — Gestão Automotiva (\"Plataforma\"), incluindo módulos de estoque, vendas, contratos, folha de pagamento, relatórios e integrações.",
      "Ao marcar a caixa de aceite e prosseguir, o usuário declara ter lido, compreendido e concordado integralmente com todas as cláusulas aqui dispostas, de forma livre, informada e inequívoca.",
      "A presente licença abrange, sem limitação, o uso das rotinas de cadastro, consulta, alteração, exportação e arquivamento de registros, bem como o uso dos módulos acessórios de conciliação, parametrização, emissão de documentos instrumentais e visualização analítica, observadas as permissões atribuídas ao perfil de cada Usuário, as políticas internas do Licenciado e as limitações técnicas inerentes ao ambiente de execução, à latência de rede, aos limites de cota de serviços integrados e às janelas de manutenção programada ou emergencial que venham a ser aplicadas.",
      "O aceite eletrônico produz efeitos plenos entre as partes desde o instante do seu registro, dispensada assinatura física, reconhecimento de firma ou qualquer formalidade adicional, ficando desde já convencionado que os metadados coletados no ato do aceite constituem elemento probatório suficiente da manifestação de vontade.",
    ],
  },
  {
    id: "2",
    title: "2. Definições",
    body: [
      "\"Licenciante\" designa a parte responsável pelo desenvolvimento, manutenção e disponibilização da Plataforma. \"Licenciado\" designa a pessoa jurídica contratante. \"Usuário\" designa a pessoa física credenciada para operar a Plataforma.",
      "\"Credenciais\" compreendem login, senha, tokens de sessão, chaves de integração e quaisquer outros elementos de autenticação.",
      "Consideram-se ainda: \"Ambiente\" como o conjunto de recursos computacionais, bases de dados, funções de borda e serviços auxiliares que sustentam a Plataforma; \"Registro\" como qualquer informação inserida, importada, calculada ou derivada; e \"Perfil\" como o conjunto de permissões associadas a um Usuário, o qual poderá ser revisto unilateralmente a qualquer tempo pelo Licenciante ou pelos administradores designados pelo Licenciado, sem que tal revisão configure alteração contratual.",
      "As definições aqui previstas prevalecem sobre acepções usuais, comerciais ou coloquiais eventualmente empregadas em comunicações informais, treinamentos, materiais de apoio, mensagens instantâneas ou registros de suporte.",
    ],
  },
  {
    id: "3",
    title: "3. Licença de Uso",
    body: [
      "É concedida licença pessoal, intransferível, não exclusiva e revogável para uso da Plataforma, restrita às finalidades operacionais do Licenciado.",
      "A licença não implica cessão, venda ou transferência de propriedade intelectual, código-fonte, arquitetura, layout ou banco de dados.",
      "A licença é concedida em caráter precário quanto à extensão do acesso e não gera exclusividade territorial, setorial ou funcional, tampouco direito de sublicenciamento, revenda, cessão, locação, comodato, disponibilização a terceiros, incorporação a produto próprio ou utilização como base para desenvolvimento de solução concorrente, ainda que parcialmente derivada.",
      "Quaisquer direitos não expressamente concedidos neste instrumento consideram-se reservados, sendo vedada interpretação extensiva ou analógica em favor do Licenciado ou do Usuário.",
    ],
  },
  {
    id: "4",
    title: "4. Contas e Credenciais",
    body: [
      "As Credenciais são pessoais e sigilosas. O Usuário responde por todos os atos praticados sob sua autenticação.",
      "É vedado compartilhar credenciais, manter sessões abertas em dispositivos de terceiros ou automatizar acessos sem autorização expressa.",
      "O Usuário obriga-se a adotar senhas robustas, a alterá-las periodicamente, a não reutilizá-las em serviços externos e a encerrar sessões ao término do expediente, respondendo civil e trabalhistamente por danos decorrentes de negligência, imprudência, imperícia ou de compartilhamento consentido de credenciais, inclusive quando praticado sob alegação de conveniência operacional, urgência comercial ou substituição temporária de colega.",
      "A Plataforma poderá encerrar sessões automaticamente após período de inatividade ou de duração máxima, sem que isso configure indisponibilidade do serviço.",
    ],
  },
  {
    id: "5",
    title: "5. Condutas Vedadas",
    body: [
      "São vedadas: engenharia reversa, descompilação, extração massiva de dados, testes de intrusão não autorizados, uso de robôs, bem como qualquer tentativa de contornar controles de permissão e auditoria.",
      "A violação autoriza a suspensão imediata do acesso, independentemente de notificação prévia.",
      "Enquadram-se igualmente como conduta vedada a raspagem de telas, a interceptação de requisições, a manipulação de identificadores, a alteração de parâmetros de consulta com o fim de acessar registros de outra loja ou perfil, a exportação de bases completas sem finalidade legítima documentada e a reprodução de layouts, fluxos, textos contratuais ou lógicas de cálculo para uso externo à Plataforma.",
      "A constatação de qualquer dessas hipóteses autoriza medidas técnicas imediatas de contenção, preservação de evidências e comunicação às autoridades competentes quando cabível.",
    ],
  },
  {
    id: "6",
    title: "6. Dados, Privacidade e LGPD",
    body: [
      "O tratamento de dados pessoais observa a Lei nº 13.709/2018 (LGPD), limitado às finalidades legítimas de gestão comercial, contratual e trabalhista.",
      "O Usuário compromete-se a não inserir dados pessoais desnecessários e a comunicar imediatamente qualquer incidente de segurança de que tenha conhecimento.",
      "O Licenciado figura como controlador dos dados pessoais inseridos, cabendo-lhe definir bases legais, prazos de retenção, atendimento a titulares e demais obrigações previstas na legislação, ao passo que o Licenciante atua como operador nos estritos limites das instruções recebidas, adotando medidas técnicas e administrativas razoáveis de proteção, sem, contudo, garantir inviolabilidade absoluta, uma vez que nenhum sistema conectado à internet é imune a incidentes.",
      "O Usuário compromete-se a tratar dados de clientes, colaboradores e parceiros com estrita observância da finalidade, adequação, necessidade, transparência, segurança, prevenção e não discriminação.",
    ],
  },
  {
    id: "7",
    title: "7. Registros e Auditoria",
    body: [
      "Todas as operações relevantes são registradas em logs imutáveis, incluindo criação, edição, exclusão lógica e exportação de informações, com data, hora e identificação do Usuário.",
      "Os registros poderão ser utilizados como meio de prova para fins administrativos, contratuais e judiciais.",
      "Os logs abrangem identificação do agente, carimbo temporal, endereço de rede, tipo de operação, entidade afetada e, quando aplicável, o estado anterior e posterior do registro, sendo mantidos de forma imutável e insuscetível de edição por qualquer perfil, inclusive administrativo, ressalvadas rotinas de expurgo legalmente admitidas e executadas de forma auditável.",
      "A tentativa de suprimir, adulterar ou obstruir a coleta de registros constitui infração grave a este Termo.",
    ],
  },
  {
    id: "8",
    title: "8. Documentos, Contratos e Assinaturas",
    body: [
      "Os documentos gerados pela Plataforma (contratos, reservas, recibos, holerites e solicitações fiscais) possuem valor meramente instrumental, cabendo ao Licenciado conferir dados, valores e enquadramentos legais antes de sua utilização.",
      "Aceites eletrônicos registrados com IP, data e agente de navegação são considerados válidos entre as partes.",
      "Os modelos de contrato, cláusulas opcionais, variáveis dinâmicas e blocos de texto disponibilizados possuem natureza de sugestão técnica, não constituindo consultoria jurídica, contábil ou tributária, de modo que a conferência final quanto à adequação legal, à correta identificação das partes, à descrição do bem, aos valores, encargos, tributos, garantias e prazos permanece integralmente a cargo do Licenciado e de seus assessores.",
      "O aceite eletrônico de documentos por terceiros será registrado com data, hora, endereço de rede e agente de navegação, considerando-se hígido salvo prova inequívoca em contrário.",
    ],
  },
  {
    id: "9",
    title: "9. Integrações de Terceiros",
    body: [
      "A Plataforma pode integrar-se a serviços externos de planilhas, bancos, mensageria e armazenamento. A disponibilidade, limites de cota e políticas desses serviços são de responsabilidade dos respectivos fornecedores.",
      "Interrupções, alterações de política, revogação de chaves, mudanças de versão de interface, limites de requisições por minuto, indisponibilidades regionais e custos cobrados por tais fornecedores não são imputáveis ao Licenciante, ainda que impactem rotinas automáticas de sincronização, envio de mensagens, geração de documentos ou consultas externas.",
      "Recomenda-se a manutenção de procedimentos manuais de contingência para operações críticas.",
    ],
  },
  {
    id: "10",
    title: "10. Disponibilidade e Manutenção",
    body: [
      "O serviço é prestado \"no estado em que se encontra\", podendo sofrer interrupções programadas ou emergenciais para manutenção, atualização e correção.",
      "Não há garantia de operação ininterrupta, ausência de erros ou compatibilidade com todo e qualquer dispositivo.",
      "Poderão ocorrer degradações temporárias de desempenho decorrentes de picos de uso, volume atípico de registros, consultas analíticas extensas, geração simultânea de documentos ou fatores externos alheios ao controle do Licenciante, tais como falhas de provedores de rede, energia, DNS, certificação digital ou serviços de terceiros.",
      "O Licenciante envidará esforços razoáveis para restabelecer a normalidade, sem obrigação de resultado, prazo fixo ou compensação.",
    ],
  },
  {
    id: "11",
    title: "11. Backups e Retenção",
    body: [
      "Rotinas de cópia de segurança podem ser mantidas em ambiente controlado. Cabe ao Licenciado manter cópias próprias dos documentos legalmente exigíveis, observados os prazos fiscais e trabalhistas aplicáveis.",
      "Cópias de segurança, quando existentes, destinam-se à recuperação de contingências do próprio Ambiente e não substituem obrigações legais de guarda documental do Licenciado, que permanece responsável pela preservação de contratos, comprovantes fiscais, documentos trabalhistas e demais elementos exigidos por lei, pelo prazo aplicável a cada espécie.",
      "A restauração de dados a partir de cópias poderá implicar perda de informações inseridas entre o último ponto de recuperação e o evento que originou a restauração.",
    ],
  },
  {
    id: "12",
    title: "12. Propriedade Intelectual",
    body: [
      "Todos os direitos sobre a Plataforma, marca, identidade visual, componentes, fluxos, modelos de contrato e automações permanecem com o Licenciante.",
      "Melhorias, sugestões e customizações incorporadas ao produto integram a base licenciada, sem geração de coautoria ou remuneração adicional.",
      "Incluem-se na proteção conferida os elementos de interface, a organização das telas, a nomenclatura adotada, os fluxos de aprovação, as fórmulas de cálculo de comissões, encargos e impostos, os modelos de documento, os scripts de automação e a modelagem do banco de dados, ainda que parcialmente customizados para atender demandas específicas do Licenciado.",
      "Nenhuma disposição deste Termo poderá ser interpretada como transferência, ainda que tácita, de titularidade sobre tais elementos.",
    ],
  },
  {
    id: "13",
    title: "13. Confidencialidade",
    body: [
      "As partes obrigam-se a manter sigilo sobre informações comerciais, cadastrais, financeiras e técnicas acessadas em razão do uso da Plataforma, mesmo após o término do vínculo, por prazo indeterminado.",
      "A obrigação de sigilo abrange informações de clientes, fornecedores, colaboradores, precificação, margens, condições de financiamento, políticas de desconto, dados de estoque, fluxos internos e quaisquer elementos não públicos acessados por força do uso da Plataforma, subsistindo integralmente após o encerramento do acesso, do contrato ou do vínculo empregatício.",
      "A violação do dever de sigilo sujeita o infrator às sanções civis, trabalhistas e penais cabíveis, independentemente de apuração de dano efetivo.",
    ],
  },
  {
    id: "14",
    title: "14. Vigência do Acesso e Vínculo Técnico Responsável",
    body: [
      "O acesso à Plataforma é concedido em caráter provisório e precário, sem data certa de revogação, permanecendo válido enquanto perdurar o vínculo empregatício do colaborador BRENO LAURENTINO TAVARES com a empresa Licenciada.",
      "Encerrado tal vínculo, por qualquer motivo e a qualquer tempo, consideram-se automaticamente revogadas e canceladas todas as credenciais e o acesso integral a toda a plataforma PixelLoom, independentemente de aviso prévio, notificação ou indenização, cessando de imediato quaisquer permissões, integrações, tokens e sessões ativas.",
      "Nessa hipótese, os dados existentes permanecerão sob sigilo, sem divulgação, transferência ou exploração comercial, observadas as obrigações legais de guarda e as demais cláusulas de confidencialidade deste Termo.",
      "Para fins de operacionalização da presente cláusula, considera-se suficiente a comunicação interna do encerramento do vínculo, dispensada formalidade específica, produzindo efeitos técnicos imediatos sobre autenticação, integrações e permissões, sem prejuízo das obrigações de sigilo, que permanecem exigíveis por prazo indeterminado.",
    ],
  },
  {
    id: "15",
    title: "15. Suspensão e Encerramento",
    body: [
      "O acesso poderá ser suspenso ou encerrado em caso de inadimplemento, violação deste Termo, uso indevido, risco à segurança ou determinação legal.",
      "A suspensão poderá ser total ou parcial, aplicada a perfis, módulos ou integrações específicas, e o encerramento poderá ser precedido, a exclusivo critério do Licenciante, de prazo para regularização, sem que a concessão eventual de tal prazo em uma oportunidade gere direito adquirido, expectativa legítima ou precedente vinculante para situações futuras.",
      "Encerrado o acesso, poderá ser disponibilizada, mediante solicitação formal e dentro de prazo razoável, extração dos registros pertencentes ao Licenciado em formato tabular padrão.",
    ],
  },
  {
    id: "16",
    title: "16. Limitação de Responsabilidade",
    body: [
      "Na máxima extensão permitida em lei, não haverá responsabilização por lucros cessantes, perda de oportunidade, danos indiretos ou decorrentes de decisões comerciais tomadas com base em relatórios da Plataforma.",
      "Eventual responsabilização, se reconhecida, limitar-se-á, em qualquer hipótese e no conjunto de todas as reclamações, ao valor efetivamente pago pelo Licenciado nos últimos meses de utilização regular do serviço, excluídos tributos, multas, encargos e valores repassados a terceiros, ficando expressamente afastadas indenizações por danos morais coletivos, reflexos, punitivos ou por perda de chance.",
      "O Licenciado permanece responsável pela conferência de seus próprios cálculos comerciais, fiscais e trabalhistas.",
    ],
  },
  {
    id: "17",
    title: "17. Suporte e Atualizações",
    body: [
      "Atualizações funcionais e correções poderão ser aplicadas sem aviso prévio, inclusive alterando telas, fluxos e nomenclaturas, desde que preservadas as funcionalidades essenciais contratadas.",
      "Atualizações poderão incluir a substituição de componentes, a reorganização de menus, a alteração de terminologias, a introdução de novos controles de permissão e a descontinuação de funcionalidades pouco utilizadas ou tecnicamente inviáveis, hipótese em que se buscará, sempre que razoável, oferecer alternativa funcionalmente equivalente.",
      "A continuidade do uso após qualquer atualização importa concordância com as modificações implementadas.",
    ],
  },
  {
    id: "18",
    title: "18. Alterações deste Termo",
    body: [
      "Este Termo poderá ser revisado. Havendo alteração material, uma nova versão será apresentada para aceite, ficando registrada a versão aceita por cada Usuário.",
      "Novas versões serão identificadas por numeração própria e apresentadas para aceite no primeiro acesso subsequente à sua publicação, permanecendo registradas, de forma individualizada, a versão aceita, a data, o horário e os metadados técnicos correspondentes a cada Usuário.",
      "A recusa em aceitar nova versão material poderá implicar a impossibilidade de continuidade do acesso.",
    ],
  },
  {
    id: "19",
    title: "19. Disposições Gerais",
    body: [
      "A tolerância quanto ao descumprimento de qualquer cláusula não constitui novação. A eventual nulidade de uma cláusula não afeta as demais.",
      "Este Termo constitui o entendimento integral entre as partes quanto ao objeto tratado, substituindo tratativas, propostas, mensagens e entendimentos anteriores, verbais ou escritos, e somente poderá ser alterado na forma aqui prevista.",
      "As comunicações consideram-se válidas quando realizadas pelos canais habituais de contato entre as partes, inclusive eletrônicos.",
    ],
  },
  {
    id: "20",
    title: "20. Foro",
    body: [
      "Fica eleito o foro da comarca da sede do Licenciado para dirimir controvérsias oriundas deste Termo, com renúncia a qualquer outro, por mais privilegiado que seja.",
      "As partes reconhecem a validade e a eficácia de documentos eletrônicos e assinaturas eletrônicas para todos os fins deste Termo, comprometendo-se a buscar solução amigável prévia por, ao menos, trinta dias corridos antes de qualquer medida judicial, salvo em hipóteses de urgência, risco iminente à segurança da informação ou necessidade de tutela específica.",
    ],
  },
];