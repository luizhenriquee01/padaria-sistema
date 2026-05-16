const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const fiados = db.prepare(`
      SELECT f.*, c.nome as cliente_nome
      FROM fiados f
      JOIN clientes c ON f.cliente_id = c.id
      ORDER BY f.data DESC
      LIMIT 200
    `).all();
    res.json(fiados);
  });

  router.get('/cliente/:id', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado' });

    const movimentos = db.prepare(`
      SELECT * FROM fiados WHERE cliente_id = ? ORDER BY data DESC
    `).all(req.params.id);

    const saldo = movimentos.reduce((s, m) => m.tipo === 'debito' ? s + m.valor : s - m.valor, 0);

    res.json({ cliente, movimentos, saldo });
  });

  router.post('/lancar', (req, res) => {
    const { cliente_id, valor, tipo, descricao, usuario_id } = req.body;
    if (!cliente_id || !valor || !tipo) return res.status(400).json({ erro: 'Dados incompletos' });

    db.prepare(
      'INSERT INTO fiados (cliente_id, valor, tipo, descricao, usuario_id) VALUES (?, ?, ?, ?, ?)'
    ).run(cliente_id, valor, tipo, descricao || null, usuario_id || null);

    const saldo = db.prepare(
      "SELECT COALESCE(SUM(CASE WHEN tipo='debito' THEN valor ELSE -valor END), 0) as s FROM fiados WHERE cliente_id = ?"
    ).get(cliente_id).s;

    res.status(201).json({ mensagem: 'Lancamento registrado', saldo });
  });

  return router;
};
