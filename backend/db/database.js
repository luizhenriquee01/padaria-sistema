const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'padaria.db');

class Statement {
  constructor(wrapper, sql) {
    this._wrapper = wrapper;
    this._sql = sql;
  }

  run(...args) {
    this._wrapper._db.run(this._sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
    const lastId = this._wrapper._db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] ?? null;
    const changes = this._wrapper._db.exec('SELECT changes()')[0]?.values[0]?.[0] ?? 0;
    if (!this._wrapper._inTransaction) this._wrapper._save();
    return { lastInsertRowid: lastId, changes };
  }

  get(...args) {
    const result = this._wrapper._db.exec(this._sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
    if (!result.length || !result[0].values.length) return undefined;
    const cols = result[0].columns;
    const row = result[0].values[0];
    return Object.fromEntries(cols.map((c, i) => [c, row[i]]));
  }

  all(...args) {
    const result = this._wrapper._db.exec(this._sql, args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  }
}

class DbWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
    this._inTransaction = false;
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  exec(sql) {
    this._db.run(sql);
    if (!this._inTransaction) this._save();
    return this;
  }

  pragma(str) {
    this._db.run(`PRAGMA ${str}`);
    return this;
  }

  transaction(fn) {
    return (...outerArgs) => {
      this._db.run('BEGIN');
      this._inTransaction = true;
      try {
        const result = fn(...outerArgs);
        this._db.run('COMMIT');
        this._inTransaction = false;
        this._save();
        return result;
      } catch (e) {
        this._db.run('ROLLBACK');
        this._inTransaction = false;
        throw e;
      }
    };
  }

  _save() {
    const data = this._db.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

async function createDb() {
  const SQL = await initSqlJs();
  let sqlJsDb;

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  const db = new DbWrapper(sqlJsDb);

  db._db.run('PRAGMA foreign_keys = ON');

  db._db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    )
  `);
  db._db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      categoria_id INTEGER,
      preco_venda REAL NOT NULL,
      preco_custo REAL DEFAULT 0,
      unidade TEXT DEFAULT 'un',
      codigo_barras TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )
  `);
  db._db.run(`
    CREATE TABLE IF NOT EXISTS estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL UNIQUE,
      quantidade REAL DEFAULT 0,
      quantidade_minima REAL DEFAULT 5,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);
  db._db.run(`
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      quantidade REAL NOT NULL,
      observacao TEXT,
      data TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);
  db._db.run(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL,
      desconto REAL DEFAULT 0,
      forma_pagamento TEXT DEFAULT 'dinheiro',
      valor_pago REAL,
      troco REAL DEFAULT 0,
      data TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  db._db.run(`
    CREATE TABLE IF NOT EXISTS itens_venda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venda_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      nome_produto TEXT NOT NULL,
      quantidade REAL NOT NULL,
      preco_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (venda_id) REFERENCES vendas(id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  db._db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'atendente',
      ativo INTEGER DEFAULT 1,
      primeiro_acesso INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db._db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      observacao TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db._db.run(`
    CREATE TABLE IF NOT EXISTS fiados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      descricao TEXT,
      valor REAL NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'debito',
      venda_id INTEGER,
      usuario_id INTEGER,
      data TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    )
  `);

  db._db.run(`
    CREATE TABLE IF NOT EXISTS encomendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_nome TEXT NOT NULL,
      cliente_telefone TEXT,
      descricao TEXT NOT NULL,
      data_entrega TEXT NOT NULL,
      hora_entrega TEXT,
      valor_total REAL NOT NULL DEFAULT 0,
      valor_sinal REAL DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      observacoes TEXT,
      usuario_id INTEGER,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  try { db._db.run('ALTER TABLE vendas ADD COLUMN cliente_id INTEGER'); } catch {}
  try { db._db.run('ALTER TABLE vendas ADD COLUMN usuario_id INTEGER'); } catch {}
  try { db._db.run('ALTER TABLE produtos ADD COLUMN por_peso INTEGER DEFAULT 0'); } catch {}

  db._save();

  const totalCategorias = db.prepare('SELECT COUNT(*) as c FROM categorias').get().c;
  if (totalCategorias === 0) {
    const insert = db.prepare('INSERT INTO categorias (nome) VALUES (?)');
    ['Paes', 'Bolos', 'Salgados', 'Bebidas', 'Doces', 'Outros'].forEach(n => insert.run(n));
  }

  const totalUsuarios = db.prepare('SELECT COUNT(*) as c FROM usuarios').get().c;
  if (totalUsuarios === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('1234', 10);
    db.prepare("INSERT INTO usuarios (nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?)").run('Gerente', 'gerente', hash, 'gerente');
    const hash2 = bcrypt.hashSync('1234', 10);
    db.prepare("INSERT INTO usuarios (nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?)").run('Atendente', 'atendente', hash2, 'atendente');
  }

  return db;
}

module.exports = createDb;
