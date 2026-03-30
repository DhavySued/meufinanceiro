const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'banco.db');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

let db;

// ── Salvar banco no disco ──────────────────────────────────
function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Inicializar ────────────────────────────────────────────
async function startServer() {
  const SQL = await initSqlJs();

  // Carregar banco existente ou criar novo
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Criar tabelas
  db.run(`
    CREATE TABLE IF NOT EXISTS cartoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL DEFAULT '',
      exibirMesAMes INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS responsaveis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      perfil TEXT NOT NULL DEFAULT 'Administrador',
      fluxoCaixa INTEGER NOT NULL DEFAULT 0,
      ganhos TEXT NOT NULL DEFAULT '[]',
      despesasFixas TEXT NOT NULL DEFAULT '[]',
      orcamentos TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL DEFAULT '',
      "desc" TEXT NOT NULL DEFAULT '',
      cat TEXT NOT NULL DEFAULT '',
      cartaoId INTEGER,
      cartaoNome TEXT NOT NULL DEFAULT '',
      responsavelId INTEGER,
      valor REAL NOT NULL DEFAULT 0,
      isDividido INTEGER NOT NULL DEFAULT 0,
      splits TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL DEFAULT 'Despesa',
      cor TEXT NOT NULL DEFAULT '#4361ee'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS caixinhas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL DEFAULT '',
      meta REAL NOT NULL DEFAULT 0,
      lancamentos TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS despesas_manuais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesIdx INTEGER NOT NULL DEFAULT 0,
      respId INTEGER NOT NULL DEFAULT 0,
      quinzena INTEGER NOT NULL DEFAULT 1,
      "desc" TEXT NOT NULL DEFAULT '',
      valor REAL NOT NULL DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS metas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catNome TEXT NOT NULL DEFAULT '',
      limite REAL NOT NULL DEFAULT 0
    )
  `);

  saveDB();

  // ── Helpers ──────────────────────────────────────────────
  const JSON_FIELDS = {
    responsaveis: ['ganhos', 'despesasFixas', 'orcamentos'],
    caixinhas: ['lancamentos'],
    lancamentos: ['splits'],
  };

  function queryAll(sql) {
    const stmt = db.prepare(sql);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  function queryOne(sql, params) {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  }

  function parseRow(table, row) {
    if (!row) return row;
    const out = { ...row };
    const fields = JSON_FIELDS[table] || [];
    fields.forEach(f => {
      if (typeof out[f] === 'string') {
        try { out[f] = JSON.parse(out[f]); } catch { out[f] = []; }
      }
    });
    if ('exibirMesAMes' in out) out.exibirMesAMes = !!out.exibirMesAMes;
    if ('fluxoCaixa' in out) out.fluxoCaixa = !!out.fluxoCaixa;
    if ('isDividido' in out) out.isDividido = !!out.isDividido;
    return out;
  }

  function prepareBody(table, body) {
    const out = { ...body };
    delete out.id;
    const fields = JSON_FIELDS[table] || [];
    fields.forEach(f => {
      if (f in out && typeof out[f] !== 'string') out[f] = JSON.stringify(out[f]);
    });
    if ('exibirMesAMes' in out) out.exibirMesAMes = out.exibirMesAMes ? 1 : 0;
    if ('fluxoCaixa' in out) out.fluxoCaixa = out.fluxoCaixa ? 1 : 0;
    if ('isDividido' in out) out.isDividido = out.isDividido ? 1 : 0;
    return out;
  }

  // ── CRUD genérico ────────────────────────────────────────
  function createCRUD(table, orderBy) {
    const router = express.Router();

    router.get('/', (req, res) => {
      const rows = queryAll(`SELECT * FROM "${table}" ORDER BY ${orderBy || 'id'}`);
      res.json(rows.map(r => parseRow(table, r)));
    });

    router.post('/', (req, res) => {
      try {
        const body = prepareBody(table, req.body);
        const cols = Object.keys(body);
        if (!cols.length) return res.status(400).json({ error: 'Corpo vazio' });
        const quotedCols = cols.map(c => `"${c}"`).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        db.run(`INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`, cols.map(c => body[c]));
        const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
        saveDB();
        const row = queryOne(`SELECT * FROM "${table}" WHERE id = ?`, [lastId]);
        res.json(parseRow(table, row));
      } catch (err) {
        console.error(`Erro INSERT ${table}:`, err.message);
        res.status(500).json({ error: err.message });
      }
    });

    router.put('/:id', (req, res) => {
      try {
        const body = prepareBody(table, req.body);
        const cols = Object.keys(body);
        if (!cols.length) return res.status(400).json({ error: 'Corpo vazio' });
        const sets = cols.map(c => `"${c}" = ?`).join(', ');
        db.run(`UPDATE "${table}" SET ${sets} WHERE id = ?`, [...cols.map(c => body[c]), parseInt(req.params.id)]);
        saveDB();
        const row = queryOne(`SELECT * FROM "${table}" WHERE id = ?`, [parseInt(req.params.id)]);
        res.json(parseRow(table, row));
      } catch (err) {
        console.error(`Erro UPDATE ${table}:`, err.message);
        res.status(500).json({ error: err.message });
      }
    });

    router.delete('/:id', (req, res) => {
      try {
        db.run(`DELETE FROM "${table}" WHERE id = ?`, [parseInt(req.params.id)]);
        saveDB();
        res.json({ ok: true });
      } catch (err) {
        console.error(`Erro DELETE ${table}:`, err.message);
        res.status(500).json({ error: err.message });
      }
    });

    return router;
  }

  // ── Rotas ────────────────────────────────────────────────
  app.use('/api/cartoes',          createCRUD('cartoes'));
  app.use('/api/responsaveis',     createCRUD('responsaveis'));
  app.use('/api/lancamentos',      createCRUD('lancamentos', '"data" DESC'));
  app.use('/api/categorias',       createCRUD('categorias'));
  app.use('/api/caixinhas',        createCRUD('caixinhas'));
  app.use('/api/despesas_manuais', createCRUD('despesas_manuais'));
  app.use('/api/metas',            createCRUD('metas'));

  app.post('/api/resetar', (req, res) => {
    db.run('DELETE FROM lancamentos');
    db.run('DELETE FROM caixinhas');
    db.run('DELETE FROM despesas_manuais');
    db.run('DELETE FROM metas');
    saveDB();
    res.json({ ok: true });
  });

  // ── Iniciar ──────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n  ✅ Meu Financeiro rodando em http://localhost:${PORT}\n`);
    console.log(`  📁 Banco de dados: ${DB_PATH}\n`);
  });
}

startServer().catch(err => {
  console.error('Erro ao iniciar servidor:', err);
  process.exit(1);
});
