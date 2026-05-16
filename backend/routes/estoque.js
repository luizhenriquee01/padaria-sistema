const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const itens = db.prepare(`
      SELECT p.id, p.nome, p.unidade, c.nome as categoria,
             e.quantidade, e.quantidade_minima,
             CASE WHEN e.quantidade <= e.quantidade_minima THEN 1 ELSE 0 END as alerta
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN estoque e ON p.id = e.produto_id
      WHERE p.ativo = 1
      ORDER BY alerta DESC, p.nome
    `).all();
    res.json(itens);
  });

  router.get('/movimentacoes', (req, res) => {
    const movs = db.prepare(`
      SELECT m.*, p.nome as produto_nome
      FROM movimentacoes_estoque m
      JOIN produtos p ON m.produto_id = p.id
      ORDER BY m.data DESC
      LIMIT 100
    `).all();
    res.json(movs);
  });

  router.post('/movimentar', (req, res) => {
    const { produto_id, tipo, quantidade, observacao } = req.body;
    if (!produto_id || !tipo || !quantidade) return res.status(400).json({ erro: 'Dados incompletos' });

    const mover = db.transaction(() => {
      const estoque = db.prepare('SELECT quantidade FROM estoque WHERE produto_id = ?').get(produto_id);
      if (!estoque) throw new Error('Produto sem estoque cadastrado');

      const novaQtd = tipo === 'entrada'
        ? estoque.quantidade + Number(quantidade)
        : estoque.quantidade - Number(quantidade);

      if (novaQtd < 0) throw new Error('Estoque insuficiente');

      db.prepare('UPDATE estoque SET quantidade = ? WHERE produto_id = ?').run(novaQtd, produto_id);
      db.prepare(
        'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, observacao) VALUES (?, ?, ?, ?)'
      ).run(produto_id, tipo, quantidade, observacao || null);

      return novaQtd;
    });

    try {
      const novaQtd = mover();
      res.json({ mensagem: 'Movimentacao registrada', quantidade: novaQtd });
    } catch (e) {
      res.status(400).json({ erro: e.message });
    }
  });

  router.put('/minimo/:produto_id', (req, res) => {
    const { quantidade_minima } = req.body;
    db.prepare('UPDATE estoque SET quantidade_minima = ? WHERE produto_id = ?')
      .run(quantidade_minima, req.params.produto_id);
    res.json({ mensagem: 'Quantidade minima atualizada' });
  });

  return router;
};
