const bcrypt = require('bcryptjs');
const createDb = require('../db/database');

createDb().then(db => {
  const hash1 = bcrypt.hashSync('1234', 10);
  const hash2 = bcrypt.hashSync('1234', 10);

  const gerente = db.prepare("SELECT id FROM usuarios WHERE login = 'gerente'").get();
  const atendente = db.prepare("SELECT id FROM usuarios WHERE login = 'atendente'").get();

  if (gerente) {
    db.prepare("UPDATE usuarios SET senha_hash = ?, primeiro_acesso = 1 WHERE login = 'gerente'").run(hash1);
    console.log('Senha do gerente resetada');
  } else {
    db.prepare("INSERT INTO usuarios (nome, login, senha_hash, perfil, primeiro_acesso) VALUES (?, ?, ?, ?, 1)").run('Gerente', 'gerente', hash1, 'gerente');
    console.log('Usuario gerente criado');
  }

  if (atendente) {
    db.prepare("UPDATE usuarios SET senha_hash = ?, primeiro_acesso = 1 WHERE login = 'atendente'").run(hash2);
    console.log('Senha do atendente resetada');
  } else {
    db.prepare("INSERT INTO usuarios (nome, login, senha_hash, perfil, primeiro_acesso) VALUES (?, ?, ?, ?, 1)").run('Atendente', 'atendente', hash2, 'atendente');
    console.log('Usuario atendente criado');
  }

  process.exit(0);
}).catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
