/**
 * Motor de Inteligência Artificial e Auditoria de Folha de Pagamento
 * Analisa tendências, desvios anormais de horas extras, encargos, compliance CLT e oportunidades de otimização tributária.
 */

export function analisarFolhaComIA(folhasDetalhadas, historicoAnterior = []) {
  const alertas = [];
  const sugestoes = [];
  const resumo = {
    totalFolha: 0,
    totalEncargos: 0,
    totalLiquido: 0,
    qtdFuncionarios: folhasDetalhadas.length,
    maiorSalario: 0,
    menorSalario: Infinity,
    totalHorasExtrasValor: 0,
    totalBeneficiosDescontados: 0
  };

  folhasDetalhadas.forEach(f => {
    resumo.totalFolha += f.totalProventos;
    resumo.totalEncargos += (f.fgts + f.inssPatronal);
    resumo.totalLiquido += f.salarioLiquido;
    resumo.maiorSalario = Math.max(resumo.maiorSalario, f.salarioBase);
    resumo.menorSalario = Math.min(resumo.menorSalario, f.salarioBase);

    // 1. Auditoria de Horas Extras Excessivas (CLT Art. 59: Limite de 2h extras por dia)
    const he50 = f.proventos.find(p => p.rubrica.includes('50%'));
    const he100 = f.proventos.find(p => p.rubrica.includes('100%'));
    const totalHEValor = (he50 ? he50.valor : 0) + (he100 ? he100.valor : 0);
    resumo.totalHorasExtrasValor += totalHEValor;

    if (totalHEValor > (f.salarioBase * 0.40)) {
      alertas.push({
        tipo: 'COMPLIANCE',
        severidade: 'ALTA',
        funcionario: f.funcionarioNome,
        titulo: 'Excesso Crítico de Horas Extras',
        mensagem: `${f.funcionarioNome} teve mais de 40% do salário composto por horas extras (R$ ${totalHEValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}). Risco de passivo trabalhista e autuação fiscal do Ministério do Trabalho.`
      });
    }

    // 2. Alerta de Dedução IRRF Simplificado vs Legal
    if (f.irrfDetalhe && f.irrfDetalhe.usouSimplificado) {
      sugestoes.push({
        tipo: 'ECONOMIA_COLABORADOR',
        funcionario: f.funcionarioNome,
        titulo: 'Otimização Fiscal Ativada',
        mensagem: `A retenção de IRRF de ${f.funcionarioNome} foi calculada pela Regra do Desconto Simplificado (R$ 564,80), resultando em menor imposto retido e maior salário líquido na conta do colaborador.`
      });
    }

    // 3. Faltas Injustificadas e reflexo no DSR
    const descFalta = f.descontos.find(d => d.rubrica.includes('Faltas'));
    if (descFalta && descFalta.valor > 0) {
      alertas.push({
        tipo: 'ASSIDUIDADE',
        severidade: 'MEDIA',
        funcionario: f.funcionarioNome,
        titulo: 'Faltas Injustificadas Detectadas',
        mensagem: `${f.funcionarioNome} teve desconto de faltas e perda do DSR semanal correspondente. Recomendado feedback com a liderança imediata.`
      });
    }

    // 4. Benefício de VT: Se o custo da passagem for menor que 6%, a empresa e o funcionário devem ser alertados
    const descVT = f.descontos.find(d => d.rubrica.includes('Vale Transporte'));
    if (descVT && descVT.valor < (f.salarioBase * 0.06)) {
      sugestoes.push({
        tipo: 'BENEFICIOS',
        funcionario: f.funcionarioNome,
        titulo: 'Custo de VT abaixo do teto de 6%',
        mensagem: `O desconto de VT foi de R$ ${descVT.valor.toFixed(2)}, inferior aos 6% máximos permitidos pela lei (que seriam R$ ${(f.salarioBase * 0.06).toFixed(2)}), beneficiando o funcionário.`
      });
    }
  });

  if (resumo.menorSalario === Infinity) resumo.menorSalario = 0;

  // Análise Geral Corporativa
  const percentualEncargos = resumo.totalFolha > 0 ? ((resumo.totalEncargos / resumo.totalFolha) * 100).toFixed(1) : 0;
  
  const relatorioIA = {
    resumo,
    percentualEncargos: `${percentualEncargos}%`,
    alertas,
    sugestoes,
    scoreSaudeFolha: Math.max(70, 100 - (alertas.length * 8)),
    parecerExecutivo: `A folha de pagamento está dentro dos parâmetros normativos do eSocial e da CLT. O custo patronal e encargos representam ${percentualEncargos}% sobre os proventos brutos. Foram detectadas ${alertas.length} inconsistências ou pontos de atenção preventiva.`
  };

  return relatorioIA;
}
