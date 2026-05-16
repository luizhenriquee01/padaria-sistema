import { useState, useEffect } from 'react';
import { Plus, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const VAZIO = { nome: '', login: '', senha: '', perfil: 'atendente' };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [modalSenha, setModalSenha] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');

  const carregar = () => api.get('/auth/usuarios').then(r => setUsuarios(r.data));
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!form.nome || !form.login || !form.senha) return toast.error('Preencha todos os campos');
    try {
      await api.post('/auth/usuarios', form);
      toast.success('Usuario criado com sucesso');
      setModal(false); setForm(VAZIO); carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao criar usuario');
    }
  };

  const alterarAtivo = async (u) => {
    await api.put(`/auth/usuarios/${u.id}/ativo`, { ativo: !u.ativo });
    toast.success(u.ativo ? 'Usuario desativado' : 'Usuario ativado');
    carregar();
  };

  const alterarSenha = async () => {
    if (!novaSenha || novaSenha.length < 4) return toast.error('Senha deve ter pelo menos 4 caracteres');
    try {
      await api.put(`/auth/usuarios/${modalSenha}/senha`, { nova_senha: novaSenha });
      toast.success('Senha alterada');
      setModalSenha(null); setNovaSenha('');
    } catch (e) {
      toast.error('Erro ao alterar senha');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Usuarios</h2>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-xl font-bold text-base">
          <Plus size={20} /> Novo Usuario
        </button>
      </div>

      <div className="space-y-3">
        {usuarios.map(u => (
          <div key={u.id} className="bg-white rounded-2xl border-2 border-gray-100 p-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800 text-lg">{u.nome}</p>
              <p className="text-gray-500">@{u.login} &bull; <span className="capitalize">{u.perfil}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setModalSenha(u.id); setNovaSenha(''); }}
                className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-xl font-semibold text-sm">
                <KeyRound size={16} /> Senha
              </button>
              <button onClick={() => alterarAtivo(u)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl font-semibold text-sm ${u.ativo ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                {u.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {u.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
            <h3 className="text-xl font-bold text-gray-800 mb-5">Novo Usuario</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Nome *</label>
                <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                  placeholder="Nome do funcionario"
                  value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Login *</label>
                <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                  placeholder="Ex: maria"
                  value={form.login} onChange={e => setForm({ ...form, login: e.target.value.toLowerCase() })} />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Senha *</label>
                <input type="password" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                  placeholder="Minimo 4 caracteres"
                  value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Perfil</label>
                <div className="grid grid-cols-2 gap-2">
                  {['atendente', 'gerente'].map(p => (
                    <button key={p} onClick={() => setForm({ ...form, perfil: p })}
                      className={`py-3 rounded-xl font-bold capitalize text-base transition-colors ${form.perfil === p ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Gerente ve tudo. Atendente so ve caixa, clientes e fiado.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold">Cancelar</button>
              <button onClick={salvar} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold">Criar</button>
            </div>
          </div>
        </div>
      )}

      {modalSenha && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
            <h3 className="text-xl font-bold text-gray-800 mb-5">Alterar Senha</h3>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">Nova Senha *</label>
              <input type="password" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                placeholder="Minimo 4 caracteres"
                value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalSenha(null)} className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold">Cancelar</button>
              <button onClick={alterarSenha} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold">Alterar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
