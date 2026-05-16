const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { itens, forma_pagamento, valor_pago, desconto } = req.body;
    if (!itens || itens.length === 0) return res.status(400).json({ erro: 'Carrinho vazio' });

    const registrar = db.transaction(() => {
      const total = itens.reduce((s, i) => s + i.subtotal, 0);
      const totalComDesconto = total - (desconto || 0);
      const troco = (valor_pago || totalComDesconto) - totalComDesconto;

      const venda = db.prepare(
        'INSERT INTO vendas (total, desconto, forma_pagamento, valor_pago, troco) VALUES (?, ?, ?, ?, ?)'
      ).run(totalComDesconto, desconto || 0, forma_pagamento || 'dinheiro', valor_pago || totalComDesconto, Math.max(0, troco));

      const vendaId = venda.lastInsertRowid;

      for (const item of itens) {
        db.prepare(
          'INSERT INTO itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(vendaId, item.produto_id, item.nome, item.quantidade, item.preco_unitario, item.subtotal);

        db.prepare('UPDATE estoque SET quantidade = quantidade - ? WHERE produto_id = ?')
          .run(item.quantidade, item.produto_id);

        db.prepare(
          'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, observacao) VALUES (?, ?, ?, ?)'
        ).run(item.produto_id, 'saida', item.quantidade, `Venda #${vendaId}`);
      }

      return { id: vendaId, total: totalComDesconto, troco: Math.max(0, troco) };
    });

    try {
      const resultado = registrar();
      res.status(201).json({ mensagem: 'Venda registrada', ...resultado });
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  router.get('/hoje', (req, res) => {
    const vendas = db.prepare(`
      SELECT v.*, GROUP_CONCAT(iv.nome_produto || ' x' || iv.quantidade, ', ') as produtos
      FROM vendas v
      LEFT JOIN itens_venda iv ON v.id = iv.venda_id
      WHERE DATE(v.data) = DATE('now','localtime')
      GROUP BY v.id
      ORDER BY v.data DESC
    `).all();
    res.json(vendas);
  });

  router.get('/:id', (req, res) => {
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
    if (!venda) return res.status(404).json({ erro: 'Venda nao encontrada' });
    const itens = db.prepare('SELECT * FROM itens_venda WHERE venda_id = ?').all(req.params.id);
    res.json({ ...venda, itens });
  });

  return router;
};
