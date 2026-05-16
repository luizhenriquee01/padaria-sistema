import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [primeiroAcesso, setPrimeiroAcesso] = useState(null); // { token, nome }

  useEffect(() => {
    const token = localStorage.getItem('token');
    const u = localStorage.getItem('usuario');
    if (token && u) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUsuario(JSON.parse(u));
    }
    setCarregando(false);
  }, []);

  const login = async (loginVal, senha) => {
    const res = await api.post('/auth/login', { login: loginVal, senha });
    const { token, usuario: u, primeiro_acesso } = res.data;

    if (primeiro_acesso) {
      setPrimeiroAcesso({ token, nome: u.nome });
      return { primeiro_acesso: true };
    }

    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(u));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUsuario(u);
    return { primeiro_acesso: false };
  };

  const concluirPrimeiroAcesso = async (loginVal, novaSenha) => {
    const res = await api.post('/auth/login', { login: loginVal, senha: novaSenha });
    const { token, usuario: u } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(u));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUsuario(u);
    setPrimeiroAcesso(null);
  };

  const sair = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    delete api.defaults.headers.common['Authorization'];
    setUsuario(null);
    setPrimeiroAcesso(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, login, sair, carregando, primeiroAcesso, concluirPrimeiroAcesso }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
