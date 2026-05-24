const express = require('express');

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getItens(db, encId) {
  return db.prepare('SELECT * FROM itens_encomenda WHERE encomenda_id = ? ORDER BY setor, nome').all(encId);
}

module.exports = function(db) {
  const router = express.Router();

  // ── Vista de producao por setor em uma data ──────────────────────────────
  // Deve vir ANTES de /:id para nao ser interceptada
  router.get('/producao/:data', (req, res) => {
    const { data } = req.params;
    const itens = db.prepare(`
      SELECT ie.setor, ie.nome, ie.unidade,
             SUM(ie.quantidade) as total,
             COUNT(DISTINCT ie.encomenda_id) as num_pedidos,
             GROUP_CONCAT(e.cliente_nome, ', ') as clientes
      FROM itens_encomenda ie
      JOIN encomendas e ON ie.encomenda_id = e.id
      WHERE e.data_entrega = ? AND e.status != 'cancelado'
      GROUP BY ie.setor, ie.nome
      ORDER BY ie.setor, ie.nome
    `).all(data);
    res.json(itens);
  });

  // ── Listar encomendas ────────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const { status, de, ate, setor } = req.query;
    let sql = 'SELECT DISTINCT e.* FROM encomendas e';
    const params = [];

    // Filtro por setor exige JOIN
    if (setor && setor !== 'todos') {
      sql += ' LEFT JOIN itens_encomenda ie ON ie.encomenda_id = e.id';
      sql += ' WHERE (ie.setor = ? OR (ie.setor IS NULL AND ? = "Outros"))';
      params.push(setor, setor);
    } else {
      sql += ' WHERE 1=1';
    }

    if (status && status !== 'todas') {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (de) {
      sql += ' AND e.data_entrega >= ?';
      params.push(de);
    }
    if (ate) {
      sql += ' AND e.data_entrega <= ?';
      params.push(ate);
    }

    sql += ' ORDER BY e.data_entrega ASC, e.hora_entrega ASC';

    const encomendas = db.prepare(sql).all(...params);
    const result = encomendas.map(enc => ({ ...enc, itens: getItens(db, enc.id) }));
    res.json(result);
  });

  // ── Buscar uma encomenda ─────────────────────────────────────────────────
  router.get('/:id', (req, res) => {
    const enc = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id);
    if (!enc) return res.status(404).json({ erro: 'Encomenda nao encontrada' });
    res.json({ ...enc, itens: getItens(db, enc.id) });
  });

  // ── Criar encomenda ──────────────────────────────────────────────────────
  router.post('/', (req, res) => {
    const {
      cliente_nome, cliente_telefone, descricao,
      data_entrega, hora_entrega, valor_total, valor_sinal,
      observacoes, usuario_id, itens = []
    } = req.body;

    if (!cliente_nome || !cliente_nome.trim())
      return res.status(400).json({ erro: 'Nome do cliente obrigatorio' });
    if (!descricao || !descricao.trim())
      return res.status(400).json({ erro: 'Descreva o que foi encomendado' });
    if (!data_entrega)
      return res.status(400).json({ erro: 'Data de entrega obrigatoria' });

    const criar = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO encomendas
          (cliente_nome, cliente_telefone, descricao, data_entrega, hora_entrega,
           valor_total, valor_sinal, observacoes, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cliente_nome.trim(),
        cliente_telefone || null,
        descricao?.trim() || null,
        data_entrega,
        hora_entrega || null,
        parseFloat(valor_total) || 0,
        parseFloat(valor_sinal) || 0,
        observacoes || null,
        usuario_id || null
      );

      const encId = r.lastInsertRowid;
      itens.forEach(item => {
        db.prepare(`
          INSERT INTO itens_encomenda (encomenda_id, produto_id, nome, quantidade, unidade, setor)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          encId,
          item.produto_id || null,
          item.nome,
          parseFloat(item.quantidade) || 1,
          item.unidade || 'un',
          item.setor || null
        );
      });

      return encId;
    });

    const encId = criar();
    const enc = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(encId);
    res.status(201).json({ ...enc, itens: getItens(db, encId) });
  });

  // ── Atualizar encomenda ──────────────────────────────────────────────────
  router.put('/:id', (req, res) => {
    const enc = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id);
    if (!enc) return res.status(404).json({ erro: 'Encomenda nao encontrada' });

    const {
      cliente_nome, cliente_telefone, descricao,
      data_entrega, hora_entrega, valor_total, valor_sinal,
      status, observacoes, itens
    } = req.body;

    const atualizar = db.transaction(() => {
      db.prepare(`
        UPDATE encomendas SET
          cliente_nome = ?, cliente_telefone = ?, descricao = ?,
          data_entrega = ?, hora_entrega = ?, valor_total = ?,
          valor_sinal = ?, status = ?, observacoes = ?
        WHERE id = ?
      `).run(
        cliente_nome     ?? enc.cliente_nome,
        cliente_telefone ?? enc.cliente_telefone,
        descricao        ?? enc.descricao,
        data_entrega     ?? enc.data_entrega,
        hora_entrega     ?? enc.hora_entrega,
        parseFloat(valor_total)  || enc.valor_total,
        parseFloat(valor_sinal)  ?? enc.valor_sinal,
        status           ?? enc.status,
        observacoes      ?? enc.observacoes,
        req.params.id
      );

      // Substitui itens se enviados
      if (Array.isArray(itens)) {
        db.prepare('DELETE FROM itens_encomenda WHERE encomenda_id = ?').run(req.params.id);
        itens.forEach(item => {
          db.prepare(`
            INSERT INTO itens_encomenda (encomenda_id, produto_id, nome, quantidade, unidade, setor)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            req.params.id,
            item.produto_id || null,
            item.nome,
            parseFloat(item.quantidade) || 1,
            item.unidade || 'un',
            item.setor || null
          );
        });
      }
    });

    atualizar();
    const updated = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(req.params.id);
    res.json({ ...updated, itens: getItens(db, req.params.id) });
  });

  // ── Mudar so o status ────────────────────────────────────────────────────
  router.patch('/:id/status', (req, res) => {
    const { status } = req.body;
    const validos = ['pendente', 'pronto', 'entregue', 'cancelado'];
    if (!validos.includes(status)) return res.status(400).json({ erro: 'Status invalido' });

    const r = db.prepare('UPDATE encomendas SET status = ? WHERE id = ?').run(status, req.params.id);
    if (r.changes === 0) return res.status(404).json({ erro: 'Encomenda nao encontrada' });
    res.json({ ok: true, status });
  });

  // ── Deletar encomenda ────────────────────────────────────────────────────
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM itens_encomenda WHERE encomenda_id = ?').run(req.params.id);
    const r = db.prepare('DELETE FROM encomendas WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ erro: 'Encomenda nao encontrada' });
    res.json({ ok: true });
  });

  return router;
};
