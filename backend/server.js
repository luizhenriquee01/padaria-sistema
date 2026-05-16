const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const createDb = require('./db/database');

process.env.LANG = 'pt_BR.UTF-8';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

createDb().then(db => {
  const authRouter = require('./routes/auth');
  const { autenticar } = authRouter;

  app.use('/api/auth', authRouter(db));
  app.use('/api/produtos', autenticar, require('./routes/produtos')(db));
  app.use('/api/estoque', autenticar, require('./routes/estoque')(db));
  app.use('/api/vendas', autenticar, require('./routes/vendas')(db));
  app.use('/api/relatorios', autenticar, require('./routes/relatorios')(db));
  app.use('/api/clientes', autenticar, require('./routes/clientes')(db));
  app.use('/api/fiado', autenticar, require('./routes/fiado')(db));
  app.use('/api/encomendas', autenticar, require('./routes/encomendas')(db));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', sistema: 'Padaria' }));

  // Em produção, serve o frontend buildado (React)
  const distPath = path.join(__dirname, '../frontend/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Catch-all: qualquer rota não-API devolve o index.html (React Router)
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  // Backup do banco de dados
  app.get('/api/backup', autenticar, (req, res) => {
    const dbPath = path.join(__dirname, 'db', 'padaria.db');
    if (!fs.existsSync(dbPath)) return res.status(404).json({ erro: 'Banco nao encontrado' });
    const hoje = new Date();
    const nome = `backup_padaria_${hoje.getFullYear()}${String(hoje.getMonth()+1).padStart(2,'0')}${String(hoje.getDate()).padStart(2,'0')}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(dbPath);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log('Login inicial: gerente / 1234  |  atendente / 1234');
  });
}).catch(err => {
  console.error('Erro ao iniciar banco:', err);
  process.exit(1);
});
