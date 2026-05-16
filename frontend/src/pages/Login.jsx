import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PrimeiroAcesso from './PrimeiroAcesso';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, primeiroAcesso, concluirPrimeiroAcesso } = useAuth();
  const [loginVal, setLoginVal] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (!loginVal || !senha) return toast.error('Preencha o usuario e a senha');
    setCarregando(true);
    try {
      await login(loginVal, senha);
    } catch {
      toast.error('Usuario ou senha incorretos');
    } finally {
      setCarregando(false);
    }
  };

  if (primeiroAcesso) {
    return (
      <PrimeiroAcesso
        tokenTemp={primeiroAcesso.token}
        nome={primeiroAcesso.nome}
        loginVal={loginVal}
        onConcluido={concluirPrimeiroAcesso}
      />
    );
  }

  return (
    <div className="min-h-screen bg-orange-600 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">

        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🥖</div>
          <h1 className="text-3xl font-bold text-gray-800">Padaria</h1>
          <p className="text-gray-500 mt-1">Sistema de Gestao</p>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Usuario</label>
            <input
              type="text"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-xl focus:outline-none focus:border-orange-500"
              placeholder="Digite seu usuario"
              value={loginVal}
              onChange={e => setLoginVal(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-2">Senha</label>
            <input
              type="password"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-xl focus:outline-none focus:border-orange-500"
              placeholder="Digite sua senha"
              value={senha}
              onChange={e => setSenha(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:bg-gray-300 text-white text-xl font-bold py-4 rounded-xl transition-colors mt-2"
          >
            {carregando ? 'Entrando...' : 'ENTRAR'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Dificuldade para entrar? Fale com o gerente.
        </p>
      </div>
    </div>
  );
}
