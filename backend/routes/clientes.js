const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const lista = db.prepare(`
      SELECT c.*,
        COALESCE((SELECT SUM(CASE WHEN tipo='debito' THEN valor ELSE -valor END) FROM fiados WHERE cliente_id = c.id), 0) as saldo_fiado
      FROM clientes c
      WHERE c.ativo = 1
      ORDER BY c.nome
    `).all();
    res.json(lista);
  });

  router.post('/', (req, res) => {
    const { nome, telefone, observacao } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
    const r = db.prepare('INSERT INTO clientes (nome, telefone, observacao) VALUES (?, ?, ?)').run(nome, telefone || null, observacao || null);
    res.status(201).json({ id: r.lastInsertRowid, mensagem: 'Cliente cadastrado' });
  });

  router.put('/:id', (req, res) => {
    const { nome, telefone, observacao } = req.body;
    db.prepare('UPDATE clientes SET nome=?, telefone=?, observacao=? WHERE id=?').run(nome, telefone || null, observacao || null, req.params.id);
    res.json({ mensagem: 'Cliente atualizado' });
  });

  router.delete('/:id', (req, res) => {
    db.prepare('UPDATE clientes SET ativo = 0 WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Cliente removido' });
  });

  return router;
};
