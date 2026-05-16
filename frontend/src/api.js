import axios from 'axios';

// Em desenvolvimento (Vite na porta 5173) aponta para o backend em :3001
// Em produção o backend serve o frontend, então /api é relativo (mesmo servidor)
const backendUrl = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:3001/api`
  : '/api';

const api = axios.create({
  baseURL: backendUrl,
});

// Interceptor: se qualquer requisicao retornar 401 (token expirado/invalido),
// limpa a sessao e redireciona para o login automaticamente
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      delete api.defaults.headers.common['Authorization'];
      // Redireciona para o login sem usar React Router (funciona de qualquer lugar)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/';
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
