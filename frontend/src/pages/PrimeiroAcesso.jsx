import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

export default function PrimeiroAcesso({ tokenTemp, nome, loginVal, onConcluido }) {
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    if (nova.length < 4) return toast.error('A senha precisa ter pelo menos 4 numeros');
    if (nova !== confirma) return toast.error('As senhas nao sao iguais');

    setSalvando(true);
    try {
      await api.post('/auth/trocar-senha-primeiro-acesso', { token_temp: tokenTemp, nova_senha: nova });
      toast.success('Senha criada! Entrando no sistema...');
      await onConcluido(loginVal, nova);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar senha');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-600 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">

        <div className="text-center mb-6">
          <ShieldCheck className="text-orange-500 mx-auto mb-3" size={56} />
          <h1 className="text-2xl font-bold text-gray-800">Crie sua senha</h1>
          <p className="text-gray-500 mt-2">
            Ola, <strong>{nome}</strong>! Por seguranca, escolha uma senha so sua antes de entrar.
          </p>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Nova senha
            </label>
            <input
              type="password"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-orange-500"
              placeholder="Minimo 4 numeros"
              value={nova}
              onChange={e => setNova(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Repita a senha
            </label>
            <input
              type="password"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-orange-500"
              placeholder="Digite a mesma senha"
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
            />
          </div>

          {nova.length > 0 && confirma.length > 0 && (
            <p className={`text-sm font-semibold text-center ${nova === confirma ? 'text-green-600' : 'text-red-500'}`}>
              {nova === confirma ? 'Senhas combinam!' : 'As senhas sao diferentes'}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white text-xl font-bold py-4 rounded-xl transition-colors mt-2"
          >
            {salvando ? 'Salvando...' : 'SALVAR E ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
