const express = require('express');

// Parser simples de linha CSV (respeita campos entre aspas)
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

module.exports = function(db) {
  const router = express.Router();

  // ── Listar produtos ──────────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const produtos = db.prepare(`
      SELECT p.*, c.nome as categoria_nome, e.quantidade, e.quantidade_minima,
             COALESCE(SUM(iv.quantidade), 0) as total_vendido
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN estoque e ON p.id = e.produto_id
      LEFT JOIN itens_venda iv ON p.id = iv.produto_id
      WHERE p.ativo = 1
      GROUP BY p.id
      ORDER BY total_vendido DESC, p.nome ASC
    `).all();
    res.json(produtos);
  });

  // ── Listar categorias ────────────────────────────────────────────────────
  router.get('/categorias', (req, res) => {
    res.json(db.prepare('SELECT * FROM categorias ORDER BY nome').all());
  });

  // ── Importar CSV ─────────────────────────────────────────────────────────
  // Formato esperado (cabecalho obrigatorio):
  //   nome,categoria,preco_venda,preco_custo,unidade,estoque_inicial,estoque_minimo
  router.post('/importar-csv', (req, res) => {
    const { csv } = req.body;
    if (!csv || !csv.trim()) return res.status(400).json({ erro: 'Nenhum CSV recebido' });

    // Divide linhas, remove vazias e carriage-return do Windows (\r)
    const linhas = csv.split('\n')
      .map(l => l.replace(/\r/g, '').trim())
      .filter(l => l.length > 0);

    if (linhas.length < 2) {
      return res.status(400).json({ erro: 'Arquivo vazio ou sem dados (apenas cabecalho)' });
    }

    // Carrega categorias existentes para lookup rapido (case-insensitive)
    const catRows = db.prepare('SELECT * FROM categorias').all();
    const catPorNome = {};
    catRows.forEach(c => { catPorNome[c.nome.toLowerCase()] = c.id; });

    // ── Fase 1: validar todas as linhas ──────────────────────────────────
    const validos  = [];
    const erros    = [];

    linhas.slice(1).forEach((linha, idx) => {
      const nLinha = idx + 2; // +2 = 1 (base 1) + 1 (cabecalho)
      try {
        const cols = parseCsvLine(linha);
        const [
          nomeRaw      = '',
          categoriaRaw = '',
          precoVendaRaw= '',
          precoCustoRaw= '',
          unidadeRaw   = 'un',
          estIniRaw    = '0',
          estMinRaw    = '5',
        ] = cols;

        const nome = nomeRaw.trim();
        if (!nome) throw new Error('Nome em branco');

        const preco = parseFloat(precoVendaRaw.replace(',', '.'));
        if (isNaN(preco) || preco <= 0) throw new Error('Preco de venda invalido (use ponto ou virgula, ex: 4.50)');

        const custo        = parseFloat(precoCustoRaw.replace(',', '.'))  || 0;
        const unidade      = unidadeRaw.trim()                            || 'un';
        const estInicial   = parseFloat(estIniRaw.replace(',', '.'))      || 0;
        const estMinimo    = parseFloat(estMinRaw.replace(',', '.'))       || 5;
        const categoria    = categoriaRaw.trim();

        validos.push({ nome, categoria, preco, custo, unidade, estInicial, estMinimo, nLinha });
      } catch (e) {
        erros.push({ linha: nLinha, erro: e.message, conteudo: linha.substring(0, 80) });
      }
    });

    // ── Fase 2: upsert — atualiza se ja existe, cria se nao existe ───────
    let importados  = 0;
    let atualizados = 0;

    if (validos.length > 0) {
      const upsertTodos = db.transaction(() => {
        validos.forEach(item => {
          // Encontra ou cria categoria
          let catId = null;
          if (item.categoria) {
            const catKey = item.categoria.toLowerCase();
            catId = catPorNome[catKey];
            if (!catId) {
              const r = db.prepare('INSERT INTO categorias (nome) VALUES (?)').run(item.categoria);
              catId = r.lastInsertRowid;
              catPorNome[catKey] = catId;
            }
          }

          // Verifica se produto ja existe pelo nome (case-insensitive)
          const existente = db.prepare(
            "SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?) AND ativo = 1"
          ).get(item.nome);

          if (existente) {
            // ── ATUALIZA produto existente ──
            db.prepare(
              'UPDATE produtos SET categoria_id=?, preco_venda=?, preco_custo=?, unidade=? WHERE id=?'
            ).run(catId, item.preco, item.custo, item.unidade, existente.id);

            // Atualiza estoque minimo sempre
            db.prepare(
              'UPDATE estoque SET quantidade_minima=? WHERE produto_id=?'
            ).run(item.estMinimo, existente.id);

            // So atualiza quantidade se a coluna vier preenchida (> 0)
            if (item.estInicial > 0) {
              db.prepare(
                'UPDATE estoque SET quantidade=? WHERE produto_id=?'
              ).run(item.estInicial, existente.id);
            }

            atualizados++;
          } else {
            // ── INSERE produto novo ──
            const prod = db.prepare(
              'INSERT INTO produtos (nome, categoria_id, preco_venda, preco_custo, unidade) VALUES (?, ?, ?, ?, ?)'
            ).run(item.nome, catId, item.preco, item.custo, item.unidade);

            db.prepare(
              'INSERT INTO estoque (produto_id, quantidade, quantidade_minima) VALUES (?, ?, ?)'
            ).run(prod.lastInsertRowid, item.estInicial, item.estMinimo);

            if (item.estInicial > 0) {
              db.prepare(
                'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, observacao) VALUES (?, ?, ?, ?)'
              ).run(prod.lastInsertRowid, 'entrada', item.estInicial, 'Importacao CSV');
            }

            importados++;
          }
        });
      });

      upsertTodos();
    }

    res.json({ importados, atualizados, erros, total: linhas.length - 1 });
  });

  // ── Cadastrar produto ────────────────────────────────────────────────────
  router.post('/', (req, res) => {
    const { nome, categoria_id, preco_venda, preco_custo, unidade, codigo_barras, quantidade_inicial, quantidade_minima } = req.body;
    if (!nome || !preco_venda) return res.status(400).json({ erro: 'Nome e preco sao obrigatorios' });

    const { por_peso, setor } = req.body;
    const inserir = db.transaction(() => {
      const prod = db.prepare(
        'INSERT INTO produtos (nome, categoria_id, preco_venda, preco_custo, unidade, codigo_barras, por_peso, setor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(nome, categoria_id || null, preco_venda, preco_custo || 0, unidade || 'un', codigo_barras || null, por_peso ? 1 : 0, setor || null);

      db.prepare(
        'INSERT INTO estoque (produto_id, quantidade, quantidade_minima) VALUES (?, ?, ?)'
      ).run(prod.lastInsertRowid, quantidade_inicial || 0, quantidade_minima || 5);

      if ((quantidade_inicial || 0) > 0) {
        db.prepare(
          'INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, observacao) VALUES (?, ?, ?, ?)'
        ).run(prod.lastInsertRowid, 'entrada', quantidade_inicial, 'Estoque inicial');
      }

      return prod.lastInsertRowid;
    });

    try {
      const id = inserir();
      res.status(201).json({ id, mensagem: 'Produto cadastrado com sucesso' });
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  // ── Atualizar produto ────────────────────────────────────────────────────
  router.put('/:id', (req, res) => {
    const { nome, categoria_id, preco_venda, preco_custo, unidade, codigo_barras, por_peso, setor } = req.body;
    db.prepare(
      'UPDATE produtos SET nome=?, categoria_id=?, preco_venda=?, preco_custo=?, unidade=?, codigo_barras=?, por_peso=?, setor=? WHERE id=?'
    ).run(nome, categoria_id || null, preco_venda, preco_custo || 0, unidade || 'un', codigo_barras || null, por_peso ? 1 : 0, setor || null, req.params.id);
    res.json({ mensagem: 'Produto atualizado' });
  });

  // ── Excluir produto (soft delete) ────────────────────────────────────────
  router.delete('/:id', (req, res) => {
    db.prepare('UPDATE produtos SET ativo = 0 WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Produto removido' });
  });

  return router;
};
