import { useState, useEffect } from 'react';
import { Plus, Minus, Search, ChevronRight, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Fiado() {
  const { usuario } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [clienteSel, setClienteSel] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [modal, setModal] = useState(null); // 'debito' | 'pagamento' | 'novo_cliente'
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '' });
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const carregar = () => api.get('/clientes').then(r => setClientes(r.data));
  useEffect(() => { carregar(); }, []);

  const abrirCliente = async (c) => {
    setClienteSel(c);
    const r = await api.get(`/fiado/cliente/${c.id}`);
    setDetalhe(r.data);
  };

  const lancar = async () => {
    if (!valor || parseFloat(valor) <= 0) return toast.error('Digite um valor valido');
    try {
      await api.post('/fiado/lancar', {
        cliente_id: clienteSel.id,
        valor: parseFloat(valor),
        tipo: modal,
        descricao: descricao || (modal === 'debito' ? 'Fiado' : 'Pagamento'),
        usuario_id: usuario.id,
      });
      toast.success(modal === 'debito' ? 'Fiado lancado!' : 'Pagamento registrado!');
      setModal(null); setValor(''); setDescricao('');
      const r = await api.get(`/fiado/cliente/${clienteSel.id}`);
      setDetalhe(r.data);
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao registrar');
    }
  };

  const cadastrarCliente = async () => {
    if (!novoCliente.nome.trim()) return toast.error('Digite o nome do cliente');
    setSalvandoCliente(true);
    try {
      const r = await api.post('/clientes', novoCliente);
      toast.success('Cliente cadastrado!');
      await carregar();
      // Abre direto no cliente recem cadastrado
      const clienteNovo = { id: r.data.id, nome: novoCliente.nome, telefone: novoCliente.telefone };
      setNovoCliente({ nome: '', telefone: '' });
      setModal(null);
      const det = await api.get(`/fiado/cliente/${r.data.id}`);
      setClienteSel(clienteNovo);
      setDetalhe(det.data);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao cadastrar');
    } finally {
      setSalvandoCliente(false);
    }
  };

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  // --- Tela de detalhe do cliente ---
  if (clienteSel && detalhe) {
    return (
      <div className="p-6">
        <button onClick={() => { setClienteSel(null); setDetalhe(null); }} className="text-orange-600 font-bold mb-4 flex items-center gap-1 text-base">
          &larr; Voltar para clientes
        </button>

        <div className="bg-white rounded-2xl border-2 border-gray-100 p-6 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{detalhe.cliente.nome}</h2>
          {detalhe.cliente.telefone && <p className="text-gray-500">{detalhe.cliente.telefone}</p>}
          <div className={`mt-4 rounded-2xl p-4 text-center ${detalhe.saldo > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-gray-600 font-semibold">Saldo em aberto</p>
            <p className={`text-4xl font-extrabold mt-1 ${detalhe.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fmt(detalhe.saldo)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <button onClick={() => setModal('debito')} className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-lg">
            <Plus size={22} /> Lancar Fiado
          </button>
          <button onClick={() => setModal('pagamento')} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-lg">
            <Minus size={22} /> Registrar Pagamento
          </button>
        </div>

        <h3 className="font-bold text-gray-700 mb-3 text-lg">Historico</h3>
        <div className="space-y-2">
          {detalhe.movimentos.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{m.descricao || (m.tipo === 'debito' ? 'Fiado' : 'Pagamento')}</p>
                <p className="text-gray-400 text-sm">{m.data}</p>
              </div>
              <p className={`font-extrabold text-xl ${m.tipo === 'debito' ? 'text-red-600' : 'text-green-600'}`}>
                {m.tipo === 'debito' ? '+' : '-'}{fmt(m.valor)}
              </p>
            </div>
          ))}
          {detalhe.movimentos.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum lancamento ainda</p>}
        </div>

        {/* Modal lancar/pagar */}
        {(modal === 'debito' || modal === 'pagamento') && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
              <h3 className="text-xl font-bold text-gray-800 mb-1">
                {modal === 'debito' ? 'Lancar Fiado' : 'Registrar Pagamento'}
              </h3>
              <p className="text-gray-500 mb-5">{clienteSel.nome}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Valor (R$) *</label>
                  <input type="number" min="0.01" step="0.01"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-2xl font-bold text-center focus:outline-none focus:border-orange-500"
                    placeholder="0,00"
                    value={valor} onChange={e => setValor(e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Descricao</label>
                  <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder={modal === 'debito' ? 'Ex: Pao, cafe...' : 'Ex: Pagou em dinheiro'}
                    value={descricao} onChange={e => setDescricao(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setModal(null); setValor(''); setDescricao(''); }}
                  className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-base">Cancelar</button>
                <button onClick={lancar}
                  className={`flex-1 text-white py-3 rounded-xl font-bold text-base ${modal === 'debito' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
                  {modal === 'debito' ? 'Confirmar Fiado' : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Tela de lista de clientes ---
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Fiado</h2>
        <button
          onClick={() => { setNovoCliente({ nome: '', telefone: '' }); setModal('novo_cliente'); }}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-xl font-bold text-base"
        >
          <UserPlus size={20} /> Novo Cliente
        </button>
      </div>

      <input
        className="w-full mb-4 border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
        placeholder="Buscar cliente pelo nome..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />

      <div className="space-y-3">
        {filtrados.map(c => (
          <button key={c.id} onClick={() => abrirCliente(c)}
            className="w-full bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-center justify-between hover:border-orange-300 transition-colors">
            <div className="text-left">
              <p className="font-bold text-gray-800 text-base">{c.nome}</p>
              {c.saldo_fiado > 0
                ? <p className="text-red-600 font-semibold">Deve: {fmt(c.saldo_fiado)}</p>
                : <p className="text-green-600 text-sm">Sem fiado</p>
              }
            </div>
            <ChevronRight size={22} className="text-gray-400" />
          </button>
        ))}
        {filtrados.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">Nenhum cliente encontrado</p>
            <button
              onClick={() => { setNovoCliente({ nome: busca, telefone: '' }); setModal('novo_cliente'); }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold text-base mx-auto"
            >
              <UserPlus size={20} /> Cadastrar "{busca || 'novo cliente'}"
            </button>
          </div>
        )}
      </div>

      {/* Modal novo cliente */}
      {modal === 'novo_cliente' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7">
            <h3 className="text-xl font-bold text-gray-800 mb-5">Cadastrar Cliente</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Nome *</label>
                <input
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-orange-500"
                  placeholder="Nome do cliente"
                  value={novoCliente.nome}
                  onChange={e => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Telefone</label>
                <input
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-orange-500"
                  placeholder="(00) 00000-0000"
                  value={novoCliente.telefone}
                  onChange={e => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-base">
                Cancelar
              </button>
              <button onClick={cadastrarCliente} disabled={salvandoCliente}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-base">
                {salvandoCliente ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
