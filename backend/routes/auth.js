const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'padaria-secreta-2024';

module.exports = function(db) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { login, senha } = req.body;
    if (!login || !senha) return res.status(400).json({ erro: 'Login e senha obrigatorios' });

    const usuario = db.prepare('SELECT * FROM usuarios WHERE login = ? AND ativo = 1').get(login);
    if (!usuario) return res.status(401).json({ erro: 'Usuario ou senha incorretos' });

    const senhaOk = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaOk) return res.status(401).json({ erro: 'Usuario ou senha incorretos' });

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
      primeiro_acesso: usuario.primeiro_acesso === 1,
    });
  });

  router.post('/trocar-senha-primeiro-acesso', (req, res) => {
    const { token_temp, nova_senha } = req.body;
    if (!nova_senha || nova_senha.length < 4) return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 numeros' });

    let payload;
    try { payload = jwt.verify(token_temp, JWT_SECRET); } catch { return res.status(401).json({ erro: 'Sessao invalida' }); }

    const hash = bcrypt.hashSync(nova_senha, 10);
    db.prepare('UPDATE usuarios SET senha_hash = ?, primeiro_acesso = 0 WHERE id = ?').run(hash, payload.id);
    res.json({ mensagem: 'Senha criada com sucesso' });
  });

  router.get('/me', autenticar, (req, res) => {
    res.json(req.usuario);
  });

  router.get('/usuarios', autenticar, somenteGerente, (req, res) => {
    const lista = db.prepare("SELECT id, nome, login, perfil, ativo, criado_em FROM usuarios ORDER BY nome").all();
    res.json(lista);
  });

  router.post('/usuarios', autenticar, somenteGerente, (req, res) => {
    const { nome, login, senha, perfil } = req.body;
    if (!nome || !login || !senha) return res.status(400).json({ erro: 'Nome, login e senha obrigatorios' });

    const existe = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login);
    if (existe) return res.status(400).json({ erro: 'Este login ja esta em uso' });

    const hash = bcrypt.hashSync(senha, 10);
    const r = db.prepare("INSERT INTO usuarios (nome, login, senha_hash, perfil, primeiro_acesso) VALUES (?, ?, ?, ?, 1)").run(nome, login, hash, perfil || 'atendente');
    res.status(201).json({ id: r.lastInsertRowid, mensagem: 'Usuario criado' });
  });

  router.put('/usuarios/:id/senha', autenticar, (req, res) => {
    const { senha_atual, nova_senha } = req.body;
    const alvo = req.usuario.perfil === 'gerente' ? req.params.id : req.usuario.id;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(alvo);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    if (req.usuario.perfil !== 'gerente') {
      if (!bcrypt.compareSync(senha_atual, usuario.senha_hash)) {
        return res.status(401).json({ erro: 'Senha atual incorreta' });
      }
    }

    const hash = bcrypt.hashSync(nova_senha, 10);
    db.prepare('UPDATE usuarios SET senha_hash = ?, primeiro_acesso = 0 WHERE id = ?').run(hash, alvo);
    res.json({ mensagem: 'Senha alterada com sucesso' });
  });

  router.put('/usuarios/:id/ativo', autenticar, somenteGerente, (req, res) => {
    db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(req.body.ativo ? 1 : 0, req.params.id);
    res.json({ mensagem: 'Usuario atualizado' });
  });

  return router;
};

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ erro: 'Sem autorizacao' });
  const token = auth.replace('Bearer ', '');
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token invalido ou expirado' });
  }
}

function somenteGerente(req, res, next) {
  if (req.usuario.perfil !== 'gerente') return res.status(403).json({ erro: 'Somente o gerente pode fazer isso' });
  next();
}

module.exports.autenticar = autenticar;
module.exports.somenteGerente = somenteGerente;
