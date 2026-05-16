import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PDV from './pages/PDV';
import Produtos from './pages/Produtos';
import Estoque from './pages/Estoque';
import Relatorios from './pages/Relatorios';
import Clientes from './pages/Clientes';
import Usuarios from './pages/Usuarios';
import Fechamento from './pages/Fechamento';
import Encomendas from './pages/Encomendas';

function Privado({ children, somenteGerente = false }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <div className="flex h-screen items-center justify-center"><p className="text-gray-400 text-xl">Carregando...</p></div>;
  if (!usuario) return <Navigate to="/login" />;
  if (somenteGerente && usuario.perfil !== 'gerente') return <Navigate to="/" />;
  return children;
}

// Tela inicial: Dashboard para gerente, Caixa para atendente
function Home() {
  const { usuario } = useAuth();
  if (usuario?.perfil === 'gerente') return <Dashboard />;
  return <PDV />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { fontSize: '16px', fontWeight: 'bold' } }} />
        <Routes>
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/*" element={
            <Privado>
              <Layout>
                <Routes>
                  <Route path="/"           element={<Home />} />
                  <Route path="/caixa"      element={<PDV />} />
                  <Route path="/encomendas" element={<Encomendas />} />
                  <Route path="/fechamento" element={<Privado somenteGerente><Fechamento /></Privado>} />
                  <Route path="/clientes"   element={<Clientes />} />
                  <Route path="/fiado"      element={<Navigate to="/clientes" />} />
                  <Route path="/produtos"   element={<Privado somenteGerente><Produtos /></Privado>} />
                  <Route path="/estoque"    element={<Privado somenteGerente><Estoque /></Privado>} />
                  <Route path="/relatorios" element={<Privado somenteGerente><Relatorios /></Privado>} />
                  <Route path="/usuarios"   element={<Privado somenteGerente><Usuarios /></Privado>} />
                </Routes>
              </Layout>
            </Privado>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginGuard() {
  const { usuario } = useAuth();
  if (usuario) return <Navigate to="/" />;
  return <Login />;
}

export default App;
