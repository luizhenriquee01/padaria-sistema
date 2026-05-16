const express = require('express');

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

module.exports = function(db) {
  const router = express.Router();

  // Listar encomendas
  router.get('/', (req, res) => {
    const { status, de, ate } = req.query;
    let sql = 'SELECT * FROM encomendas WHERE 1=1';
    const params = [];

    if (status && status !== 'todas') {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (de) {
      sql += ' AND data_entrega >= ?';
      params.push(de);
    }
    if (ate) {
      sql += ' AND data_entrega <= ?';
      params.push(ate);
    }

    sql += ' ORDER BY data_entrega ASC, hora_entrega ASC';

    const encomendas = db.prepare(sql).all(...params);
    res.json(encomendas);
  });

  // Buscar uma encomenda
  router.get('/:id', (req, res) => {
    const enc = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id);
    if (!enc) return res.status(404).json({ erro: 'Encomenda nao encontrada' });
    res.json(enc);
  });

  // Criar encomenda
  router.post('/', (req, res) => {
    const { cliente_nome, cliente_telefone, descricao, data_entrega, hora_entrega, valor_total, valor_sinal, observacoes, usuario_id } = req.body;

    if (!cliente_nome || !cliente_nome.trim()) return res.status(400).json({ erro: 'Nome do cliente obrigatorio' });
    if (!descricao || !descricao.trim()) return res.status(400).json({ erro: 'Descricao da encomenda obrigatoria' });
    if (!data_entrega) return res.status(400).json({ erro: 'Data de entrega obrigatoria' });

    const r = db.prepare(`
      INSERT INTO encomendas (cliente_nome, cliente_telefone, descricao, data_entrega, hora_entrega, valor_total, valor_sinal, observacoes, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cliente_nome.trim(),
      cliente_telefone || null,
      descricao.trim(),
      data_entrega,
      hora_entrega || null,
      parseFloat(valor_total) || 0,
      parseFloat(valor_sinal) || 0,
      observacoes || null,
      usuario_id || null
    );

    const enc = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json(enc);
  });

  // Atualizar encomenda
  router.put('/:id', (req, res) => {
    const enc = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id);
    if (!enc) return res.status(404).json({ erro: 'Encomenda nao encontrada' });

    const { cliente_nome, cliente_telefone, descricao, data_entrega, hora_entrega, valor_total, valor_sinal, status, observacoes } = req.body;

    db.prepare(`
      UPDATE encomendas SET
        cliente_nome = ?,
        cliente_telefone = ?,
        descricao = ?,
        data_entrega = ?,
        hora_entrega = ?,
        valor_total = ?,
        valor_sinal = ?,
        status = ?,
        observacoes = ?
      WHERE id = ?
    `).run(
      cliente_nome ?? enc.cliente_nome,
      cliente_telefone ?? enc.cliente_telefone,
      descricao ?? enc.descricao,
      data_entrega ?? enc.data_entrega,
      hora_entrega ?? enc.hora_entrega,
      parseFloat(valor_total) ?? enc.valor_total,
      parseFloat(valor_sinal) ?? enc.valor_sinal,
      status ?? enc.status,
      observacoes ?? enc.observacoes,
      req.params.id
    );

    res.json(db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id));
  });

  // Mudar so o status (atalho rapido)
  router.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    const validos = ['pendente', 'pronto', 'entregue', 'cancelado'];
    if (!validos.includes(status)) return res.status(400).json({ erro: 'Status invalido' });

    const r = db.prepare('UPDATE encomendas SET status = ? WHERE id = ?').run(status, req.params.id);
    if (r.changes === 0) return res.status(404).json({ erro: 'Encomenda nao encontrada' });

    res.json({ ok: true, status });
  });

  // Deletar encomenda
  router.delete('/:id', (req, res) => {
    const r = db.prepare('DELETE FROM encomendas WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ erro: 'Encomenda nao encontrada' });
    res.json({ ok: true });
  });

  return router;
};
