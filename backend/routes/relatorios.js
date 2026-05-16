const express = require('express');

function hojeLocal() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

module.exports = function(db) {
  const router = express.Router();

  router.get('/resumo', (req, res) => {
    const { inicio, fim } = req.query;
    const dataInicio = inicio || hojeLocal();
    const dataFim = fim || dataInicio;

    const vendas = db.prepare(`
      SELECT COUNT(*) as total_vendas,
             COALESCE(SUM(total), 0) as faturamento,
             COALESCE(SUM(desconto), 0) as total_descontos
      FROM vendas
      WHERE DATE(data) BETWEEN ? AND ?
    `).get(dataInicio, dataFim);

    const ticketMedio = vendas.total_vendas > 0
      ? vendas.faturamento / vendas.total_vendas
      : 0;

    const porPagamento = db.prepare(`
      SELECT forma_pagamento, COUNT(*) as qtd, SUM(total) as valor
      FROM vendas
      WHERE DATE(data) BETWEEN ? AND ?
      GROUP BY forma_pagamento
    `).all(dataInicio, dataFim);

    const maisPedidos = db.prepare(`
      SELECT iv.nome_produto, SUM(iv.quantidade) as qtd_vendida, SUM(iv.subtotal) as total
      FROM itens_venda iv
      JOIN vendas v ON iv.venda_id = v.id
      WHERE DATE(v.data) BETWEEN ? AND ?
      GROUP BY iv.produto_id
      ORDER BY qtd_vendida DESC
      LIMIT 10
    `).all(dataInicio, dataFim);

    const vendasPorHora = db.prepare(`
      SELECT strftime('%H', data) as hora, COUNT(*) as qtd, SUM(total) as valor
      FROM vendas
      WHERE DATE(data) BETWEEN ? AND ?
      GROUP BY hora
      ORDER BY hora
    `).all(dataInicio, dataFim);

    res.json({ vendas, ticketMedio, porPagamento, maisPedidos, vendasPorHora });
  });

  router.get('/periodo', (req, res) => {
    const { inicio, fim } = req.query;
    const dataInicio = inicio || hojeLocal();
    const dataFim = fim || dataInicio;

    const porDia = db.prepare(`
      SELECT DATE(data) as dia, COUNT(*) as vendas, SUM(total) as faturamento
      FROM vendas
      WHERE DATE(data) BETWEEN ? AND ?
      GROUP BY dia
      ORDER BY dia
    `).all(dataInicio, dataFim);

    res.json(porDia);
  });

  router.get('/fechamento', (req, res) => {
    const data = req.query.data || hojeLocal();

    const totais = db.prepare(`
      SELECT
        COUNT(*) as total_vendas,
        COALESCE(SUM(total), 0) as faturamento,
        COALESCE(SUM(desconto), 0) as total_descontos
      FROM vendas
      WHERE DATE(data) = ?
    `).get(data);

    const porPagamento = db.prepare(`
      SELECT forma_pagamento, COUNT(*) as qtd, COALESCE(SUM(total), 0) as valor
      FROM vendas
      WHERE DATE(data) = ?
      GROUP BY forma_pagamento
      ORDER BY valor DESC
    `).all(data);

    const maisPedidos = db.prepare(`
      SELECT iv.nome_produto, SUM(iv.quantidade) as qtd_vendida, SUM(iv.subtotal) as total
      FROM itens_venda iv
      JOIN vendas v ON iv.venda_id = v.id
      WHERE DATE(v.data) = ?
      GROUP BY iv.produto_id
      ORDER BY qtd_vendida DESC
      LIMIT 5
    `).all(data);

    const primeiraVenda = db.prepare(`
      SELECT strftime('%H:%M', data) as hora FROM vendas WHERE DATE(data) = ? ORDER BY data ASC LIMIT 1
    `).get(data);

    const ultimaVenda = db.prepare(`
      SELECT strftime('%H:%M', data) as hora FROM vendas WHERE DATE(data) = ? ORDER BY data DESC LIMIT 1
    `).get(data);

    res.json({
      data,
      totais,
      porPagamento,
      maisPedidos,
      primeiraVenda: primeiraVenda?.hora || null,
      ultimaVenda: ultimaVenda?.hora || null,
    });
  });

  return router;
};
