import express from 'express';
import cors from 'cors';
import db, { initDatabase } from './database.js';
import {
  calcularFolhaFuncionario,
  calcularComissaoMotos,
  calcularFerias,
  calcularDecimoTerceiro,
  calcularRescisao,
  calcularINSS,
  calcularIRRF,
  calcularFGTS,
  calcularHorasExtras,
  calcularDSR
} from './calculosCLT.js';
import { analisarFolhaComIA } from './auditoriaIA.js';

initDatabase();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const PORT = process.env.PORT || 5000;

// ==========================================
// 1. EMPRESA E CONFIGURAÇÕES DA CONCESSIONÁRIA
// ==========================================
app.get('/api/empresa', (req, res) => {
  try {
    const empresa = db.prepare('SELECT * FROM empresa ORDER BY id DESC LIMIT 1').get();
    if (empresa) {
      if (empresa.regrasComissaoJSON) {
        try {
          empresa.regrasComissao = JSON.parse(empresa.regrasComissaoJSON);
        } catch (e) {
          empresa.regrasComissao = [];
        }
      }
      if (empresa.regrasComissoesCargosJSON) {
        try {
          empresa.regrasComissoesCargos = JSON.parse(empresa.regrasComissoesCargosJSON);
        } catch (e) {
          empresa.regrasComissoesCargos = null;
        }
      }
      if (empresa.tiposComissoesLojaJSON) {
        try {
          empresa.tiposComissoesLoja = JSON.parse(empresa.tiposComissoesLojaJSON);
        } catch (e) {
          empresa.tiposComissoesLoja = [];
        }
      } else {
        empresa.tiposComissoesLoja = [];
      }
      if (empresa.regrasComissaoPlusJSON) {
        try {
          empresa.regrasComissaoPlus = JSON.parse(empresa.regrasComissaoPlusJSON);
        } catch (e) {
          empresa.regrasComissaoPlus = [];
        }
      } else {
        empresa.regrasComissaoPlus = [
          { de: 1, ate: 5, valorPorMoto: 70 },
          { de: 6, ate: 10, valorPorMoto: 120 },
          { de: 11, ate: 15, valorPorMoto: 180 },
          { de: 16, ate: 9999, valorPorMoto: 250 }
        ];
      }
    }
    res.json(empresa || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/empresa', (req, res) => {
  try {
    const {
      razaoSocial, cnpj, endereco, cidade, uf, regimeTributario, aliquotaRAT, fap,
      regrasComissao, tipoAplicacaoComissao,
      textoMarcaDagua, opacidadeMarcaDagua, exibirMarcaDagua, logoUrl,
      regrasComissoesCargos, tiposComissoesLoja, regrasComissaoPlus
    } = req.body;
    const regrasJSON = regrasComissao ? JSON.stringify(regrasComissao) : undefined;
    const regrasCargosJSON = regrasComissoesCargos ? JSON.stringify(regrasComissoesCargos) : undefined;
    const tiposComissoesJSON = tiposComissoesLoja ? JSON.stringify(tiposComissoesLoja) : undefined;
    const regrasPlusJSON = regrasComissaoPlus ? JSON.stringify(regrasComissaoPlus) : undefined;

    db.prepare(`
      UPDATE empresa 
      SET razaoSocial = COALESCE(?, razaoSocial),
          cnpj = COALESCE(?, cnpj),
          endereco = COALESCE(?, endereco),
          cidade = COALESCE(?, cidade),
          uf = COALESCE(?, uf),
          regimeTributario = COALESCE(?, regimeTributario),
          aliquotaRAT = COALESCE(?, aliquotaRAT),
          fap = COALESCE(?, fap),
          regrasComissaoJSON = COALESCE(?, regrasComissaoJSON),
          tipoAplicacaoComissao = COALESCE(?, tipoAplicacaoComissao),
          textoMarcaDagua = COALESCE(?, textoMarcaDagua),
          opacidadeMarcaDagua = COALESCE(?, opacidadeMarcaDagua),
          exibirMarcaDagua = COALESCE(?, exibirMarcaDagua),
          logoUrl = COALESCE(?, logoUrl),
          regrasComissoesCargosJSON = COALESCE(?, regrasComissoesCargosJSON),
          tiposComissoesLojaJSON = COALESCE(?, tiposComissoesLojaJSON),
          regrasComissaoPlusJSON = COALESCE(?, regrasComissaoPlusJSON)
      WHERE id = (SELECT id FROM empresa ORDER BY id DESC LIMIT 1)
    `).run(
      razaoSocial, cnpj, endereco, cidade, uf, regimeTributario, aliquotaRAT, fap,
      regrasJSON, tipoAplicacaoComissao,
      textoMarcaDagua, opacidadeMarcaDagua, exibirMarcaDagua !== undefined ? (exibirMarcaDagua ? 1 : 0) : null, logoUrl,
      regrasCargosJSON, tiposComissoesJSON, regrasPlusJSON
    );
    res.json({ success: true, message: 'Dados da Concessionária, comissões e configurações salvas com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. GESTÃO DE FUNCIONÁRIOS
// ==========================================
app.get('/api/funcionarios', (req, res) => {
  try {
    const { ativo } = req.query;
    let query = 'SELECT * FROM funcionarios';
    if (ativo !== undefined) {
      query += ` WHERE ativo = ${ativo === 'true' || ativo === '1' ? 1 : 0}`;
    }
    query += ' ORDER BY nome ASC';
    const lista = db.prepare(query).all();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/funcionarios/:id', (req, res) => {
  try {
    const func = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(req.params.id);
    if (!func) return res.status(404).json({ error: 'Funcionário não encontrado.' });
    res.json(func);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/funcionarios', (req, res) => {
  try {
    const f = req.body;
    const stmt = db.prepare(`
      INSERT INTO funcionarios (
        nome, cpf, cargo, departamento, salarioBase, cargaHoraria, dataAdmissao, dependentes,
        tipoContrato, descontarINSS, descontarIRRF, calcularFGTS, pagarDSRComissao,
        modeloComissaoVendedor, regrasComissaoCustomJSON,
        grauInsalubridade, temPericulosidade, optanteVT, custoValeTransporte,
        descontoValeRefeicao, descontoPlanoSaude, chavePix, bancoConta,
        razaoSocialPrestador, cnpjPrestador, ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      f.nome,
      f.cpf,
      f.cargo,
      f.departamento,
      f.salarioBase || 0,
      f.cargaHoraria || 220,
      f.dataAdmissao || new Date().toISOString().split('T')[0],
      f.dependentes || 0,
      f.tipoContrato || 'CLT',
      f.descontarINSS !== undefined ? (f.descontarINSS ? 1 : 0) : 1,
      f.descontarIRRF !== undefined ? (f.descontarIRRF ? 1 : 0) : 1,
      f.calcularFGTS !== undefined ? (f.calcularFGTS ? 1 : 0) : 1,
      f.pagarDSRComissao !== undefined ? (f.pagarDSRComissao ? 1 : 0) : 1,
      f.modeloComissaoVendedor || 'PADRAO',
      f.regrasComissaoCustomJSON || '',
      f.grauInsalubridade || 'NENHUM',
      f.temPericulosidade ? 1 : 0,
      f.optanteVT ? 1 : 0,
      f.custoValeTransporte || 0,
      f.descontoValeRefeicao || 0,
      f.descontoPlanoSaude || 0,
      f.chavePix || '',
      f.bancoConta || '',
      f.razaoSocialPrestador || '',
      f.cnpjPrestador || '',
      1
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Funcionário cadastrado com sucesso!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/funcionarios/:id', (req, res) => {
  try {
    const f = req.body;
    db.prepare(`
      UPDATE funcionarios SET
        nome = ?, cpf = ?, cargo = ?, departamento = ?, salarioBase = ?, cargaHoraria = ?,
        dataAdmissao = ?, dependentes = ?, tipoContrato = ?,
        descontarINSS = ?, descontarIRRF = ?, calcularFGTS = ?, pagarDSRComissao = ?,
        modeloComissaoVendedor = ?, regrasComissaoCustomJSON = ?,
        grauInsalubridade = ?, temPericulosidade = ?, optanteVT = ?, custoValeTransporte = ?,
        descontoValeRefeicao = ?, descontoPlanoSaude = ?, chavePix = ?, bancoConta = ?,
        razaoSocialPrestador = ?, cnpjPrestador = ?, ativo = ?
      WHERE id = ?
    `).run(
      f.nome, f.cpf, f.cargo, f.departamento, f.salarioBase, f.cargaHoraria || 220,
      f.dataAdmissao, f.dependentes, f.tipoContrato || 'CLT',
      f.descontarINSS !== undefined ? (f.descontarINSS ? 1 : 0) : 1,
      f.descontarIRRF !== undefined ? (f.descontarIRRF ? 1 : 0) : 1,
      f.calcularFGTS !== undefined ? (f.calcularFGTS ? 1 : 0) : 1,
      f.pagarDSRComissao !== undefined ? (f.pagarDSRComissao ? 1 : 0) : 1,
      f.modeloComissaoVendedor || 'PADRAO',
      f.regrasComissaoCustomJSON || '',
      f.grauInsalubridade, f.temPericulosidade ? 1 : 0, f.optanteVT ? 1 : 0, f.custoValeTransporte,
      f.descontoValeRefeicao, f.descontoPlanoSaude, f.chavePix, f.bancoConta,
      f.razaoSocialPrestador || '', f.cnpjPrestador || '',
      f.ativo !== undefined ? (f.ativo ? 1 : 0) : 1,
      req.params.id
    );

    res.json({ success: true, message: 'Funcionário atualizado com sucesso!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/funcionarios/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM funcionarios WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Funcionário removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. PROCESSAMENTO E AUDITORIA DA FOLHA MENSAL
// ==========================================

// Retorna a folha calculada de todos os colaboradores para o mês
app.get('/api/folha/calcular-mes', (req, res) => {
  try {
    const mesReferencia = req.query.mes || new Date().toISOString().slice(0, 7);
    const empresa = db.prepare('SELECT * FROM empresa ORDER BY id DESC LIMIT 1').get() || {};
    
    let regrasComissaoPadrao = null;
    if (empresa.regrasComissaoJSON) {
      try {
        regrasComissaoPadrao = JSON.parse(empresa.regrasComissaoJSON);
      } catch (e) {
        regrasComissaoPadrao = null;
      }
    }
    empresa.regrasComissao = regrasComissaoPadrao;

    let regrasComissaoPlus = null;
    if (empresa.regrasComissaoPlusJSON) {
      try {
        regrasComissaoPlus = JSON.parse(empresa.regrasComissaoPlusJSON);
      } catch (e) {
        regrasComissaoPlus = null;
      }
    }
    empresa.regrasComissaoPlus = regrasComissaoPlus;

    const funcionarios = db.prepare('SELECT * FROM funcionarios WHERE ativo = 1').all();

    // Busca lançamentos salvos no banco para este mês
    const lancamentosSalvos = db.prepare('SELECT * FROM folhas_mensais WHERE mesReferencia = ?').all(mesReferencia);
    const mapSalvos = new Map(lancamentosSalvos.map(l => [l.funcionarioId, l]));

    const folhaCalculada = funcionarios.map(func => {
      const salvo = mapSalvos.get(func.id);

      let comissoesDetalhadas = [];
      if (salvo && salvo.comissoesDetalhadasJSON) {
        try {
          comissoesDetalhadas = JSON.parse(salvo.comissoesDetalhadasJSON);
        } catch (e) {
          comissoesDetalhadas = [];
        }
      }

      // Escolhe a tabela de comissões adequada para o vendedor (Padrão, Vendedor + ou Personalizada)
      let regrasParaColaborador = regrasComissaoPadrao;
      const cargoLower = (func.cargo || '').toLowerCase();
      const isVendedorPlus = func.modeloComissaoVendedor === 'VENDEDOR_PLUS' || cargoLower.includes('+') || cargoLower.includes('plus') || cargoLower.includes('senior') || cargoLower.includes('sênior');

      if (func.modeloComissaoVendedor === 'PERSONALIZADO' && func.regrasComissaoCustomJSON) {
        try {
          regrasParaColaborador = JSON.parse(func.regrasComissaoCustomJSON);
        } catch (e) {
          regrasParaColaborador = isVendedorPlus ? (regrasComissaoPlus || regrasComissaoPadrao) : regrasComissaoPadrao;
        }
      } else if (isVendedorPlus) {
        regrasParaColaborador = regrasComissaoPlus || regrasComissaoPadrao;
      }

      const dadosEntrada = {
        funcionario: { ...func, regimeEmpresa: empresa.regimeTributario },
        mesReferencia,
        motosVendidas: salvo ? salvo.motosVendidas : 0,
        motosMarketingLoja: salvo ? salvo.motosMarketingLoja : 0,
        motosMarketingProprio: salvo ? salvo.motosMarketingProprio : 0,
        valorMarketingProprio: salvo ? (salvo.valorMarketingProprio || 500) : 500,
        regrasComissao: regrasParaColaborador,
        motosMontadas: salvo ? salvo.motosMontadas : 0,
        valorPorMontagem: salvo ? salvo.valorPorMontagem : (empresa.regrasComissoesCargos?.valorPorMontagemMecanico || 40),
        comissaoServicos: salvo ? salvo.comissaoServicos : 0,
        comissaoGeral: salvo ? salvo.comissaoGeral : 0,
        comissoesDetalhadas,
        horas50: salvo ? salvo.horas50 : 0,
        horas100: salvo ? salvo.horas100 : 0,
        horasNoturnas: salvo ? salvo.horasNoturnas : 0,
        diasUteis: salvo ? salvo.diasUteis : 25,
        domingosEFeriados: salvo ? salvo.domingosEFeriados : 5,
        faltasDias: salvo ? salvo.faltasDias : 0,
        atrasosMinutos: salvo ? salvo.atrasosMinutos : 0,
        custoValeTransporte: func.custoValeTransporte,
        optanteVT: !!func.optanteVT,
        descontoValeRefeicao: func.descontoValeRefeicao,
        descontoPlanoSaude: func.descontoPlanoSaude,
        outrosProventos: salvo ? salvo.outrosProventos : 0,
        outrosProventosDescricao: salvo ? salvo.outrosProventosDescricao : '',
        ajudaDeCusto: salvo ? (salvo.ajudaDeCusto || 0) : 0,
        ajudaDeCustoDescricao: salvo ? (salvo.ajudaDeCustoDescricao || '') : '',
        reembolsoDespesas: salvo ? (salvo.reembolsoDespesas || 0) : 0,
        reembolsoDespesasDescricao: salvo ? (salvo.reembolsoDespesasDescricao || '') : '',
        gastosDiversos: salvo ? (salvo.gastosDiversos || 0) : 0,
        gastosDiversosDescricao: salvo ? (salvo.gastosDiversosDescricao || '') : '',
        comissaoMotoParceiro: salvo ? (salvo.comissaoMotoParceiro || 0) : 0,
        motoParceiroQtd: salvo ? (salvo.motoParceiroQtd || 0) : 0,
        motoParceiroDescricao: salvo ? (salvo.motoParceiroDescricao || '') : '',
        comissaoRetorno: salvo ? (salvo.comissaoRetorno || 0) : 0,
        retornoDescricao: salvo ? (salvo.retornoDescricao || '') : '',
        outrosDescontos: salvo ? salvo.outrosDescontos : 0,
        outrosDescontosDescricao: salvo ? salvo.outrosDescontosDescricao : '',
        pensaoAlimenticia: salvo ? salvo.pensaoAlimenticia : 0,
        motosLojaGerente: salvo ? (salvo.motosLojaGerente || 0) : 0,
        valorComissaoGerentePorMoto: salvo ? (salvo.valorComissaoGerentePorMoto || 0) : (empresa.regrasComissoesCargos?.valorComissaoGerentePorMoto || 30),
        comissaoTreinamento: salvo ? (salvo.comissaoTreinamento || 0) : 0,
        comissaoTreinamentoDescricao: salvo ? (salvo.comissaoTreinamentoDescricao || '') : ''
      };

      const resultado = calcularFolhaFuncionario(dadosEntrada);
      return {
        ...resultado,
        salvoNoBanco: !!salvo,
        status: salvo ? salvo.status : 'SIMULADO',
        lancamentoId: salvo ? salvo.id : null,
        variaveisEntrada: dadosEntrada
      };
    });

    const auditoria = analisarFolhaComIA(folhaCalculada);

    res.json({
      mesReferencia,
      empresa,
      colaboradores: folhaCalculada,
      auditoria
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvar / Lançar variáveis da Folha Mensal (Motos Vendidas, Montagem Mecânicos, Comissões Custom, Horas Extras, Outros Gastos)
app.post('/api/folha/salvar-item', (req, res) => {
  try {
    const {
      funcionarioId,
      mesReferencia,
      motosVendidas,
      motosMarketingLoja,
      motosMarketingProprio,
      valorMarketingProprio,
      motosMontadas,
      valorPorMontagem,
      comissaoServicos,
      comissaoGeral,
      descricaoComissaoGeral,
      comissoesDetalhadas,
      horas50,
      horas100,
      horasNoturnas,
      diasUteis,
      domingosEFeriados,
      faltasDias,
      atrasosMinutos,
      outrosProventos,
      outrosProventosDescricao,
      ajudaDeCusto,
      ajudaDeCustoDescricao,
      reembolsoDespesas,
      reembolsoDespesasDescricao,
      gastosDiversos,
      gastosDiversosDescricao,
      comissaoMotoParceiro,
      motoParceiroQtd,
      motoParceiroDescricao,
      comissaoRetorno,
      retornoDescricao,
      outrosDescontos,
      outrosDescontosDescricao,
      pensaoAlimenticia,
      motosLojaGerente,
      valorComissaoGerentePorMoto,
      comissaoTreinamento,
      comissaoTreinamentoDescricao,
      status
    } = req.body;

    const func = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioId);
    if (!func) return res.status(404).json({ error: 'Funcionário não encontrado.' });

    const empresa = db.prepare('SELECT * FROM empresa ORDER BY id DESC LIMIT 1').get() || {};
    let regrasComissaoPadrao = null;
    if (empresa.regrasComissaoJSON) {
      try {
        regrasComissaoPadrao = JSON.parse(empresa.regrasComissaoJSON);
      } catch (e) {}
    }
    let regrasComissaoPlus = null;
    if (empresa.regrasComissaoPlusJSON) {
      try {
        regrasComissaoPlus = JSON.parse(empresa.regrasComissaoPlusJSON);
      } catch (e) {}
    }

    let regrasParaColaborador = regrasComissaoPadrao;
    const cargoLower = (func.cargo || '').toLowerCase();
    const isVendedorPlus = func.modeloComissaoVendedor === 'VENDEDOR_PLUS' || cargoLower.includes('+') || cargoLower.includes('plus') || cargoLower.includes('senior') || cargoLower.includes('sênior');

    if (func.modeloComissaoVendedor === 'PERSONALIZADO' && func.regrasComissaoCustomJSON) {
      try {
        regrasParaColaborador = JSON.parse(func.regrasComissaoCustomJSON);
      } catch (e) {
        regrasParaColaborador = isVendedorPlus ? (regrasComissaoPlus || regrasComissaoPadrao) : regrasComissaoPadrao;
      }
    } else if (isVendedorPlus) {
      regrasParaColaborador = regrasComissaoPlus || regrasComissaoPadrao;
    }

    const listaComissoes = Array.isArray(comissoesDetalhadas) ? comissoesDetalhadas : [];

    const dadosEntrada = {
      funcionario: { ...func, regimeEmpresa: empresa.regimeTributario },
      mesReferencia,
      motosVendidas: Number(motosVendidas) || 0,
      motosMarketingLoja: Number(motosMarketingLoja) || 0,
      motosMarketingProprio: Number(motosMarketingProprio) || 0,
      valorMarketingProprio: Number(valorMarketingProprio) || 500,
      regrasComissao: regrasParaColaborador,
      motosMontadas: Number(motosMontadas) || 0,
      valorPorMontagem: Number(valorPorMontagem) || 0,
      comissaoServicos: Number(comissaoServicos) || 0,
      comissaoGeral: Number(comissaoGeral) || 0,
      descricaoComissaoGeral: descricaoComissaoGeral || '',
      comissoesDetalhadas: listaComissoes,
      horas50: Number(horas50) || 0,
      horas100: Number(horas100) || 0,
      horasNoturnas: Number(horasNoturnas) || 0,
      diasUteis: Number(diasUteis) || 25,
      domingosEFeriados: Number(domingosEFeriados) || 5,
      faltasDias: Number(faltasDias) || 0,
      atrasosMinutos: Number(atrasosMinutos) || 0,
      custoValeTransporte: func.custoValeTransporte,
      optanteVT: !!func.optanteVT,
      descontoValeRefeicao: func.descontoValeRefeicao,
      descontoPlanoSaude: func.descontoPlanoSaude,
      outrosProventos: Number(outrosProventos) || 0,
      outrosProventosDescricao: outrosProventosDescricao || '',
      ajudaDeCusto: Number(ajudaDeCusto) || 0,
      ajudaDeCustoDescricao: ajudaDeCustoDescricao || '',
      reembolsoDespesas: Number(reembolsoDespesas) || 0,
      reembolsoDespesasDescricao: reembolsoDespesasDescricao || '',
      gastosDiversos: Number(gastosDiversos) || 0,
      gastosDiversosDescricao: gastosDiversosDescricao || '',
      comissaoMotoParceiro: Number(comissaoMotoParceiro) || 0,
      motoParceiroQtd: Number(motoParceiroQtd) || 0,
      motoParceiroDescricao: motoParceiroDescricao || '',
      comissaoRetorno: Number(comissaoRetorno) || 0,
      retornoDescricao: retornoDescricao || '',
      outrosDescontos: Number(outrosDescontos) || 0,
      outrosDescontosDescricao: outrosDescontosDescricao || '',
      pensaoAlimenticia: Number(pensaoAlimenticia) || 0,
      motosLojaGerente: Number(motosLojaGerente) || 0,
      valorComissaoGerentePorMoto: Number(valorComissaoGerentePorMoto) || 0,
      comissaoTreinamento: Number(comissaoTreinamento) || 0,
      comissaoTreinamentoDescricao: comissaoTreinamentoDescricao || ''
    };

    const resultado = calcularFolhaFuncionario(dadosEntrada);

    const upsertStmt = db.prepare(`
      INSERT INTO folhas_mensais (
        funcionarioId, mesReferencia, motosVendidas,
        motosMarketingLoja, motosMarketingProprio, valorMarketingProprio, comissaoMarketingProprio,
        motosMontadas, valorPorMontagem,
        comissaoMotos, comissaoServicos, comissaoGeral, comissoesDetalhadasJSON, comissaoDSR,
        horas50, horas100, horasNoturnas, diasUteis, domingosEFeriados,
        faltasDias, atrasosMinutos, outrosProventos, outrosProventosDescricao,
        ajudaDeCusto, ajudaDeCustoDescricao, reembolsoDespesas, reembolsoDespesasDescricao,
        gastosDiversos, gastosDiversosDescricao,
        comissaoMotoParceiro, motoParceiroQtd, motoParceiroDescricao,
        comissaoRetorno, retornoDescricao,
        outrosDescontos, outrosDescontosDescricao,
        pensaoAlimenticia, totalProventos, totalDescontos, salarioLiquido,
        fgts, inssPatronal, custoTotalEmpresa, dadosCompletosJSON, status,
        motosLojaGerente, valorComissaoGerentePorMoto,
        comissaoTreinamento, comissaoTreinamentoDescricao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(funcionarioId, mesReferencia) DO UPDATE SET
        motosVendidas = excluded.motosVendidas,
        motosMarketingLoja = excluded.motosMarketingLoja,
        motosMarketingProprio = excluded.motosMarketingProprio,
        valorMarketingProprio = excluded.valorMarketingProprio,
        comissaoMarketingProprio = excluded.comissaoMarketingProprio,
        motosMontadas = excluded.motosMontadas,
        valorPorMontagem = excluded.valorPorMontagem,
        comissaoMotos = excluded.comissaoMotos,
        comissaoServicos = excluded.comissaoServicos,
        comissaoGeral = excluded.comissaoGeral,
        comissoesDetalhadasJSON = excluded.comissoesDetalhadasJSON,
        comissaoDSR = excluded.comissaoDSR,
        horas50 = excluded.horas50,
        horas100 = excluded.horas100,
        horasNoturnas = excluded.horasNoturnas,
        diasUteis = excluded.diasUteis,
        domingosEFeriados = excluded.domingosEFeriados,
        faltasDias = excluded.faltasDias,
        atrasosMinutos = excluded.atrasosMinutos,
        outrosProventos = excluded.outrosProventos,
        outrosProventosDescricao = excluded.outrosProventosDescricao,
        ajudaDeCusto = excluded.ajudaDeCusto,
        ajudaDeCustoDescricao = excluded.ajudaDeCustoDescricao,
        reembolsoDespesas = excluded.reembolsoDespesas,
        reembolsoDespesasDescricao = excluded.reembolsoDespesasDescricao,
        gastosDiversos = excluded.gastosDiversos,
        gastosDiversosDescricao = excluded.gastosDiversosDescricao,
        comissaoMotoParceiro = excluded.comissaoMotoParceiro,
        motoParceiroQtd = excluded.motoParceiroQtd,
        motoParceiroDescricao = excluded.motoParceiroDescricao,
        comissaoRetorno = excluded.comissaoRetorno,
        retornoDescricao = excluded.retornoDescricao,
        outrosDescontos = excluded.outrosDescontos,
        outrosDescontosDescricao = excluded.outrosDescontosDescricao,
        pensaoAlimenticia = excluded.pensaoAlimenticia,
        totalProventos = excluded.totalProventos,
        totalDescontos = excluded.totalDescontos,
        salarioLiquido = excluded.salarioLiquido,
        fgts = excluded.fgts,
        inssPatronal = excluded.inssPatronal,
        custoTotalEmpresa = excluded.custoTotalEmpresa,
        dadosCompletosJSON = excluded.dadosCompletosJSON,
        status = excluded.status,
        motosLojaGerente = excluded.motosLojaGerente,
        valorComissaoGerentePorMoto = excluded.valorComissaoGerentePorMoto,
        comissaoTreinamento = excluded.comissaoTreinamento,
        comissaoTreinamentoDescricao = excluded.comissaoTreinamentoDescricao,
        calculadoEm = CURRENT_TIMESTAMP
    `);

    upsertStmt.run(
      funcionarioId,
      mesReferencia,
      resultado.motosVendidas,
      dadosEntrada.motosMarketingLoja,
      dadosEntrada.motosMarketingProprio,
      dadosEntrada.valorMarketingProprio,
      resultado.comissaoMarketingProprio,
      dadosEntrada.motosMontadas,
      dadosEntrada.valorPorMontagem,
      resultado.comissaoMotos,
      dadosEntrada.comissaoServicos,
      dadosEntrada.comissaoGeral,
      JSON.stringify(listaComissoes),
      resultado.comissaoDSR,
      dadosEntrada.horas50,
      dadosEntrada.horas100,
      dadosEntrada.horasNoturnas,
      dadosEntrada.diasUteis,
      dadosEntrada.domingosEFeriados,
      dadosEntrada.faltasDias,
      dadosEntrada.atrasosMinutos,
      dadosEntrada.outrosProventos,
      dadosEntrada.outrosProventosDescricao,
      dadosEntrada.ajudaDeCusto,
      dadosEntrada.ajudaDeCustoDescricao,
      dadosEntrada.reembolsoDespesas,
      dadosEntrada.reembolsoDespesasDescricao,
      dadosEntrada.gastosDiversos,
      dadosEntrada.gastosDiversosDescricao,
      dadosEntrada.comissaoMotoParceiro,
      dadosEntrada.motoParceiroQtd,
      dadosEntrada.motoParceiroDescricao,
      dadosEntrada.comissaoRetorno,
      dadosEntrada.retornoDescricao,
      dadosEntrada.outrosDescontos,
      dadosEntrada.outrosDescontosDescricao,
      dadosEntrada.pensaoAlimenticia,
      resultado.totalProventos,
      resultado.totalDescontos,
      resultado.salarioLiquido,
      resultado.fgts,
      resultado.inssPatronal,
      resultado.custoTotalEmpresa,
      JSON.stringify(resultado),
      status || 'FECHADA',
      dadosEntrada.motosLojaGerente,
      dadosEntrada.valorComissaoGerentePorMoto,
      dadosEntrada.comissaoTreinamento,
      dadosEntrada.comissaoTreinamentoDescricao
    );

    res.json({ success: true, resultado });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 4. SIMULADORES E MÓDULOS ESPECIAIS (FÉRIAS, 13º, RESCISÃO)
// ==========================================

// Simulador interativo avulso
app.post('/api/simulador/calculo-avulso', (req, res) => {
  try {
    const { salarioBase, motosVendidas, dependentes, pensaoAlimenticia, horas50, horas100, horasNoturnas, temInsalubridade, grauInsalubridade, temPericulosidade } = req.body;
    
    const fakeFunc = {
      id: 9999,
      nome: 'Simulação',
      salarioBase: Number(salarioBase) || 0,
      cargaHoraria: 220,
      dependentes: Number(dependentes) || 0,
      grauInsalubridade: temInsalubridade ? grauInsalubridade : 'NENHUM',
      temPericulosidade: !!temPericulosidade,
      regimeEmpresa: 'SIMPLES_NACIONAL'
    };

    const resultado = calcularFolhaFuncionario({
      funcionario: fakeFunc,
      mesReferencia: 'SIMULACAO',
      motosVendidas: Number(motosVendidas) || 0,
      horas50: Number(horas50) || 0,
      horas100: Number(horas100) || 0,
      horasNoturnas: Number(horasNoturnas) || 0,
      pensaoAlimenticia: Number(pensaoAlimenticia) || 0
    });

    res.json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Férias
app.post('/api/operacoes/ferias', (req, res) => {
  try {
    const { salarioBase, diasGozo, vendeu10Dias, adiantarDecimoTerceiro, dependentes } = req.body;
    const calculo = calcularFerias(Number(salarioBase), Number(diasGozo), !!vendeu10Dias, !!adiantarDecimoTerceiro, Number(dependentes));
    res.json(calculo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 13º Salário
app.post('/api/operacoes/decimo-terceiro', (req, res) => {
  try {
    const { salarioBase, mesesTrabalhados, parcela, dependentes } = req.body;
    const calculo = calcularDecimoTerceiro(Number(salarioBase), Number(mesesTrabalhados), parcela, Number(dependentes));
    res.json(calculo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rescisão Contratual
app.post('/api/operacoes/rescisao', (req, res) => {
  try {
    const dados = req.body;
    const calculo = calcularRescisao({
      salarioBase: Number(dados.salarioBase),
      dataAdmissao: dados.dataAdmissao,
      dataDemissao: dados.dataDemissao,
      motivo: dados.motivo,
      avisoPrevioIndenizado: !!dados.avisoPrevioIndenizado,
      saldoSalarioDias: Number(dados.saldoSalarioDias) || 0,
      feriasVencidas: !!dados.feriasVencidas,
      saldoFGTSAtual: Number(dados.saldoFGTSAtual) || 0
    });
    res.json(calculo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Consulta de Holerite Específico
app.get('/api/folha/holerite/:funcionarioId/:mes', (req, res) => {
  try {
    const { funcionarioId, mes } = req.params;
    const lancamento = db.prepare('SELECT * FROM folhas_mensais WHERE funcionarioId = ? AND mesReferencia = ?').get(funcionarioId, mes);
    const empresa = db.prepare('SELECT * FROM empresa ORDER BY id DESC LIMIT 1').get();
    const funcionario = db.prepare('SELECT * FROM funcionarios WHERE id = ?').get(funcionarioId);

    if (!funcionario) return res.status(404).json({ error: 'Colaborador não encontrado' });

    let dadosFolha;
    if (lancamento) {
      dadosFolha = JSON.parse(lancamento.dadosCompletosJSON);
    } else {
      let regrasComissao = null;
      if (empresa.regrasComissaoJSON) {
        try { regrasComissao = JSON.parse(empresa.regrasComissaoJSON); } catch (e) {}
      }
      dadosFolha = calcularFolhaFuncionario({
        funcionario: { ...funcionario, regimeEmpresa: empresa.regimeTributario },
        mesReferencia: mes,
        regrasComissao
      });
    }

    res.json({
      empresa,
      funcionario,
      folha: dadosFolha
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Folha de Pagamento Inteligente rodando na porta ${PORT}`);
});
