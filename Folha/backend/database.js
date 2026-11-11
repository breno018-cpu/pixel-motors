import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sqlitePath = path.join(__dirname, 'folha_pagamento.sqlite');

// Em ambientes serverless (Vercel Lambda), o sistema de arquivos da pasta da aplicação é READ-ONLY.
// Devemos utilizar a pasta /tmp para leitura e escrita do SQLite.
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const tmpPath = path.join('/tmp', 'folha_pagamento.sqlite');
  if (!fs.existsSync(tmpPath)) {
    try {
      if (fs.existsSync(sqlitePath)) {
        fs.copyFileSync(sqlitePath, tmpPath);
      }
    } catch (err) {
      console.warn('Aviso: Não foi possível copiar banco para /tmp, criando novo:', err);
    }
  }
  sqlitePath = tmpPath;
}

let db;
try {
  db = new Database(sqlitePath);
  try {
    db.pragma('journal_mode = WAL');
  } catch (e) {
    db.pragma('journal_mode = DELETE');
  }
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.error('Falha ao abrir better-sqlite3:', err);
  // Fallback em memória caso o arquivo falhe
  db = new Database(':memory:');
}

export function initDatabase() {
  if (!db) return;
  try {
    // 1. Tabela de Configurações da Empresa
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

    // 2. Tabela de Funcionários
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
        descontarINSS INTEGER DEFAULT 1,
        descontarIRRF INTEGER DEFAULT 1,
        calcularFGTS INTEGER DEFAULT 1,
        pagarDSRComissao INTEGER DEFAULT 1,
        modeloComissaoVendedor TEXT DEFAULT 'PADRAO',
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

    try { db.exec("ALTER TABLE funcionarios ADD COLUMN descontarINSS INTEGER DEFAULT 1"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN descontarIRRF INTEGER DEFAULT 1"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN calcularFGTS INTEGER DEFAULT 1"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN pagarDSRComissao INTEGER DEFAULT 1"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN modeloComissaoVendedor TEXT DEFAULT 'PADRAO'"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN regrasComissaoCustomJSON TEXT DEFAULT ''"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN comissaoMontagemFixa REAL DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE funcionarios ADD COLUMN bonificacaoFixaMensal REAL DEFAULT 0"); } catch (e) {}

    // 3. Tabela de Folhas Mensais
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
  } catch (e) {
    console.error('Erro na inicialização do banco SQLite:', e);
  }
}

export default db;
