import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'folha_pagamento.sqlite'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 1. Tabela de Configurações da Empresa (Concessionária de Motos com Logo e Marca d'água)
  db.exec(`
    CREATE TABLE IF NOT EXISTS empresa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razaoSocial TEXT NOT NULL DEFAULT 'Moto Show Concessionária e Serviços Ltda',
      cnpj TEXT NOT NULL DEFAULT '',
      endereco TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      uf TEXT DEFAULT '',
      regimeTributario TEXT DEFAULT 'SIMPLES_NACIONAL',
      aliquotaRAT REAL DEFAULT 2.0,
      fap REAL DEFAULT 1.0,
      regrasComissaoJSON TEXT DEFAULT '[{"de":1,"ate":5,"valorPorMoto":50},{"de":6,"ate":10,"valorPorMoto":75},{"de":11,"ate":15,"valorPorMoto":100},{"de":16,"ate":9999,"valorPorMoto":150}]',
      tipoAplicacaoComissao TEXT DEFAULT 'POR_FAIXA',
      textoMarcaDagua TEXT DEFAULT 'MOTO SHOW CONCESSIONÁRIA',
      opacidadeMarcaDagua REAL DEFAULT 0.05,
      exibirMarcaDagua INTEGER DEFAULT 1,
      logoUrl TEXT DEFAULT '',
      criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Se a tabela já existia sem as novas colunas de marca d'água / logo, adiciona de forma segura
  try { db.exec("ALTER TABLE empresa ADD COLUMN textoMarcaDagua TEXT DEFAULT 'MOTO SHOW CONCESSIONÁRIA'"); } catch (e) {}
  try { db.exec("ALTER TABLE empresa ADD COLUMN opacidadeMarcaDagua REAL DEFAULT 0.05"); } catch (e) {}
  try { db.exec("ALTER TABLE empresa ADD COLUMN exibirMarcaDagua INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE empresa ADD COLUMN logoUrl TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE empresa ADD COLUMN regrasComissoesCargosJSON TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE empresa ADD COLUMN tiposComissoesLojaJSON TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE empresa ADD COLUMN regrasComissaoPlusJSON TEXT DEFAULT '[{\"de\":1,\"ate\":5,\"valorPorMoto\":70},{\"de\":6,\"ate\":10,\"valorPorMoto\":120},{\"de\":11,\"ate\":15,\"valorPorMoto\":180},{\"de\":16,\"ate\":9999,\"valorPorMoto\":250}]'"); } catch (e) {}

  const temEmpresa = db.prepare('SELECT id FROM empresa LIMIT 1').get();
  if (!temEmpresa) {
    db.prepare(`
      INSERT INTO empresa (razaoSocial, cnpj, endereco, cidade, uf, regimeTributario)
      VALUES ('Moto Show Concessionária e Serviços Ltda', '', '', '', '', 'SIMPLES_NACIONAL')
    `).run();
  }

  // 2. Tabela de Funcionários com chaves seletivas de impostos (INSS, IRRF, FGTS) e modelo de comissão
  db.exec(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      cargo TEXT NOT NULL,
      departamento TEXT NOT NULL,
      salarioBase REAL NOT NULL,
      cargaHoraria INTEGER DEFAULT 220,
      dataAdmissao DATE NOT NULL,
      dependentes INTEGER DEFAULT 0,
      tipoContrato TEXT DEFAULT 'CLT',
      descontarINSS INTEGER DEFAULT 1, -- 1 = SIM, 0 = ISENTO/NÃO COBRAR
      descontarIRRF INTEGER DEFAULT 1, -- 1 = SIM, 0 = ISENTO/NÃO COBRAR
      calcularFGTS INTEGER DEFAULT 1,  -- 1 = SIM, 0 = ISENTO/NÃO COBRAR
      pagarDSRComissao INTEGER DEFAULT 1, -- 1 = SIM, 0 = NÃO (DESATIVAR DSR SOBRE COMISSÃO)
      modeloComissaoVendedor TEXT DEFAULT 'PADRAO', -- 'PADRAO', 'VENDEDOR_PLUS', 'PERSONALIZADO'
      regrasComissaoCustomJSON TEXT DEFAULT '',
      grauInsalubridade TEXT DEFAULT 'NENHUM',
      temPericulosidade INTEGER DEFAULT 0,
      optanteVT INTEGER DEFAULT 1,
      custoValeTransporte REAL DEFAULT 0,
      descontoValeRefeicao REAL DEFAULT 0,
      descontoPlanoSaude REAL DEFAULT 0,
      chavePix TEXT,
      bancoConta TEXT,
      ativo INTEGER DEFAULT 1,
      criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrações dinâmicas para tabelas já existentes
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN descontarINSS INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN descontarIRRF INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN calcularFGTS INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN pagarDSRComissao INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN modeloComissaoVendedor TEXT DEFAULT 'PADRAO'"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN regrasComissaoCustomJSON TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN razaoSocialPrestador TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE funcionarios ADD COLUMN cnpjPrestador TEXT DEFAULT ''"); } catch (e) {}

  // 3. Tabela de Lançamentos de Folha
  db.exec(`
    CREATE TABLE IF NOT EXISTS folhas_mensais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcionarioId INTEGER NOT NULL,
      mesReferencia TEXT NOT NULL,
      motosVendidas INTEGER DEFAULT 0,
      motosMontadas INTEGER DEFAULT 0,
      valorPorMontagem REAL DEFAULT 0,
      comissaoMotos REAL DEFAULT 0,
      comissaoServicos REAL DEFAULT 0,
      comissaoGeral REAL DEFAULT 0,
      comissaoDSR REAL DEFAULT 0,
      horas50 REAL DEFAULT 0,
      horas100 REAL DEFAULT 0,
      horasNoturnas REAL DEFAULT 0,
      diasUteis INTEGER DEFAULT 25,
      domingosEFeriados INTEGER DEFAULT 5,
      faltasDias INTEGER DEFAULT 0,
      atrasosMinutos INTEGER DEFAULT 0,
      outrosProventos REAL DEFAULT 0,
      outrosProventosDescricao TEXT DEFAULT '',
      outrosDescontos REAL DEFAULT 0,
      outrosDescontosDescricao TEXT DEFAULT '',
      pensaoAlimenticia REAL DEFAULT 0,
      totalProventos REAL NOT NULL,
      totalDescontos REAL NOT NULL,
      salarioLiquido REAL NOT NULL,
      fgts REAL NOT NULL,
      inssPatronal REAL NOT NULL,
      custoTotalEmpresa REAL NOT NULL,
      dadosCompletosJSON TEXT NOT NULL,
      status TEXT DEFAULT 'FECHADA',
      calculadoEm DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (funcionarioId) REFERENCES funcionarios (id) ON DELETE CASCADE,
      UNIQUE(funcionarioId, mesReferencia)
    );
  `);

  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN motosMontadas INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN valorPorMontagem REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN motosMarketingLoja INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN motosMarketingProprio INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN valorMarketingProprio REAL DEFAULT 500"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoMarketingProprio REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoServicos REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoGeral REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN outrosProventosDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN outrosDescontosDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN ajudaDeCusto REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN ajudaDeCustoDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN reembolsoDespesas REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN reembolsoDespesasDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoMotoParceiro REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN motoParceiroQtd INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN motoParceiroDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoRetorno REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN retornoDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissoesDetalhadasJSON TEXT DEFAULT '[]'"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN gastosDiversos REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN gastosDiversosDescricao TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN motosLojaGerente INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN valorComissaoGerentePorMoto REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoTreinamento REAL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE folhas_mensais ADD COLUMN comissaoTreinamentoDescricao TEXT DEFAULT ''"); } catch (e) {}

  // 4. Operações Especiais
  db.exec(`
    CREATE TABLE IF NOT EXISTS operacoes_especiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcionarioId INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      dataEvento DATE NOT NULL,
      detalhesJSON TEXT NOT NULL,
      valorTotal REAL NOT NULL,
      registradoEm DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (funcionarioId) REFERENCES funcionarios (id) ON DELETE CASCADE
    );
  `);

  // 5. Auditoria de IA
  db.exec(`
    CREATE TABLE IF NOT EXISTS auditoria_ia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesReferencia TEXT NOT NULL,
      tipoAlerta TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      sugestaoAcao TEXT,
      resolvido INTEGER DEFAULT 0,
      criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export default db;
