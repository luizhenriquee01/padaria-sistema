import { useState, useEffect } from 'react';
import { Plus, Phone, Calendar, CheckCircle, Clock, X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatarDataBR(s) {
  if (!s) return '';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}

function diasRestantes(dataEntrega) {
  const hoje = new Date(dataLocal() + 'T00:00:00');
  const entrega = new Date(dataEntrega + 'T00:00:00');
  return Math.round((entrega - hoje) / 86400000);
}

function labelDias(diff) {
  if (diff < 0) return `${Math.abs(diff)} dia${Math.abs(diff) > 1 ? 's' : ''} atrasada`;
  if (diff === 0) return 'Hoje!';
  if (diff === 1) return 'Amanha';
  return `Em ${diff} dias`;
}

const STATUS_CFG = {
  pendente:  { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-800',  dot: 'bg-yellow-400' },
  pronto:    { label: 'Pronto',    cor: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-500'   },
  entregue:  { label: 'Entregue', cor: 'bg-green-100 text-green-800',    dot: 'bg-green-500'  },
  cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-500',      dot: 'bg-gray-400'   },
};

const FORM_VAZIO = {
  cliente_nome: '', cliente_telefone: '', descricao: '',
  data_entrega: dataLocal(), hora_entrega: '',
  valor_total: '', valor_sinal: '', observacoes: '',
};

const FILTROS = [
  { key: 'ativas',    label: '📋 Ativas'   },
  { key: 'hoje',      label: '📅 Hoje'     },
  { key: 'semana',    label: '🗓 Semana'   },
  { key: 'entregue',  label: '✅ Entregues' },
  { key: 'todas',     label: '🔍 Todas'    },
];

export default function Encomendas() {
  const { usuario } = useAuth();
  const [encomendas, setEncomendas] = useState([]);
  const [filtro, setFiltro] = useState('ativas');
  const [modal, setModal] = useState(null); // null | 'nova' | 'editar'
  const [form, setForm] = useState(FORM_VAZIO);
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const carregar = async () => {
    try {
      const hoje = dataLocal();
      let params = '';
      if (filtro === 'ativas')   params = '?status=pendente';
      else if (filtro === 'hoje')    params = `?de=${hoje}&ate=${hoje}`;
      else if (filtro === 'semana') {
        const fim = new Date(); fim.setDate(fim.getDate() + 6);
        params = `?de=${hoje}&ate=${dataLocal(fim)}`;
      } else if (filtro === 'entregue') params = '?status=entregue';
      // 'todas' sem filtro

      const r = await api.get('/encomendas' + params);
      setEncomendas(r.data);
    } catch {
      toast.error('Erro ao carregar encomendas');
    }
  };

  useEffect(() => { carregar(); }, [filtro]);

  const abrirNova = () => {
    setForm({ ...FORM_VAZIO, data_entrega: dataLocal() });
    setEditId(null);
    setModal('nova');
  };

  const abrirEditar = (enc) => {
    setForm({
      cliente_nome: enc.cliente_nome,
      cliente_telefone: enc.cliente_telefone || '',
      descricao: enc.descricao,
      data_entrega: enc.data_entrega,
      hora_entrega: enc.hora_entrega || '',
      valor_total: enc.valor_total || '',
      valor_sinal: enc.valor_sinal || '',
      observacoes: enc.observacoes || '',
    });
    setEditId(enc.id);
    setModal('editar');
  };

  const salvar = async () => {
    if (!form.cliente_nome.trim()) return toast.error('Nome do cliente obrigatorio');
    if (!form.descricao.trim()) return toast.error('Descricao da encomenda obrigatoria');
    if (!form.data_entrega) return toast.error('Data de entrega obrigatoria');
    setSalvando(true);
    try {
      const dados = { ...form, usuario_id: usuario?.id };
      if (modal === 'nova') {
        await api.post('/encomendas', dados);
        toast.success('Encomenda registrada!');
      } else {
        await api.put(`/encomendas/${editId}`, dados);
        toast.success('Encomenda atualizada!');
      }
      setModal(null);
      carregar();
    } catch (e) {
      const msg = e.response?.data?.erro || e.message || 'Erro ao salvar';
      console.error('Erro encomenda:', e.response?.status, msg);
      if (e.response?.status === 404 || !e.response) {
        toast.error('Servidor nao encontrado. Reinicie o sistema (iniciar.bat).');
      } else if (e.response?.status === 500) {
        toast.error('Erro interno. Reinicie o sistema (iniciar.bat) e tente novamente.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSalvando(false);
    }
  };

  const mudarStatus = async (id, status) => {
    try {
      await api.patch(`/encomendas/${id}/status`, { status });
      const labels = { pronto: 'Marcado como Pronto!', entregue: 'Entregue! ✅', cancelado: 'Cancelado', pendente: 'Voltou para Pendente' };
      toast.success(labels[status] || 'Status atualizado');
      carregar();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const deletar = async (id) => {
    try {
      await api.delete(`/encomendas/${id}`);
      toast.success('Encomenda removida');
      setConfirmDelete(null);
      carregar();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const f = v => parseFloat(v) || 0;

  return (
    <div className="flex flex-col h-full">

      {/* Cabecalho */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-gray-800">Encomendas</h2>
          <button onClick={abrirNova}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm">
            <Plus size={18} /> Nova
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filtro === f.key ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {encomendas.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-gray-400 text-lg">Nenhuma encomenda aqui</p>
            <button onClick={abrirNova} className="mt-4 text-orange-600 font-bold text-base">
              + Registrar encomenda
            </button>
          </div>
        )}

        {encomendas.map(enc => {
          const diff = diasRestantes(enc.data_entrega);
          const atrasada = diff < 0 && enc.status === 'pendente';
          const hoje = diff === 0 && (enc.status === 'pendente' || enc.status === 'pronto');
          const cfg = STATUS_CFG[enc.status] || STATUS_CFG.pendente;
          const restante = f(enc.valor_total) - f(enc.valor_sinal);
          const aberto = expandido === enc.id;

          return (
            <div key={enc.id}
              className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                atrasada ? 'border-red-300' : hoje ? 'border-orange-400' : 'border-gray-100'
              }`}>

              {/* Linha principal (sempre visivel) */}
              <button
                onClick={() => setExpandido(aberto ? null : enc.id)}
                className="w-full p-4 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Nome + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800 text-base">{enc.cliente_nome}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${cfg.cor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Data e hora */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={`flex items-center gap-1 text-sm font-semibold ${
                        atrasada ? 'text-red-600' : hoje ? 'text-orange-600' : 'text-gray-500'
                      }`}>
                        <Calendar size={14} />
                        {formatarDataBR(enc.data_entrega)}
                        {enc.hora_entrega && ` as ${enc.hora_entrega}`}
                      </span>
                      {enc.status !== 'entregue' && enc.status !== 'cancelado' && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          atrasada ? 'bg-red-100 text-red-700' : hoje ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {labelDias(diff)}
                        </span>
                      )}
                    </div>

                    {/* Descricao resumida */}
                    <p className="text-gray-600 text-sm mt-1.5 line-clamp-2">{enc.descricao}</p>
                  </div>

                  {/* Valor + seta */}
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-gray-800">{fmt(enc.valor_total)}</p>
                    {f(enc.valor_sinal) > 0 && (
                      <p className="text-xs text-green-600 font-semibold">Sinal: {fmt(enc.valor_sinal)}</p>
                    )}
                    <ChevronDown size={16} className={`ml-auto mt-1 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {/* Detalhes expandidos */}
              {aberto && (
                <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">

                  {enc.cliente_telefone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={14} className="text-gray-400" />
                      <a href={`tel:${enc.cliente_telefone}`} className="text-blue-600 font-semibold">
                        {enc.cliente_telefone}
                      </a>
                    </div>
                  )}

                  {enc.observacoes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-gray-700">
                      <p className="font-semibold text-yellow-800 mb-1">Observacoes:</p>
                      <p>{enc.observacoes}</p>
                    </div>
                  )}

                  {/* Resumo financeiro */}
                  <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total da encomenda</span>
                      <span className="font-bold text-gray-800">{fmt(enc.valor_total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sinal pago</span>
                      <span className="font-bold text-green-600">{fmt(enc.valor_sinal)}</span>
                    </div>
                    {restante > 0 && (
                      <div className="flex justify-between border-t border-dashed border-gray-200 pt-1.5">
                        <span className="font-bold text-gray-700">Restante a cobrar</span>
                        <span className="font-extrabold text-orange-600 text-base">{fmt(restante)}</span>
                      </div>
                    )}
                  </div>

                  {/* Botoes de acao */}
                  <div className="flex flex-wrap gap-2">
                    {enc.status === 'pendente' && (
                      <button onClick={() => mudarStatus(enc.id, 'pronto')}
                        className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm">
                        <CheckCircle size={16} /> Marcar Pronto
                      </button>
                    )}
                    {enc.status === 'pronto' && (
                      <button onClick={() => mudarStatus(enc.id, 'entregue')}
                        className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm">
                        <CheckCircle size={16} /> Confirmar Entrega
                      </button>
                    )}
                    {(enc.status === 'pendente' || enc.status === 'pronto') && (
                      <button onClick={() => mudarStatus(enc.id, 'cancelado')}
                        className="flex items-center justify-center gap-1 border-2 border-gray-200 text-gray-500 px-3 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100">
                        <X size={15} /> Cancelar
                      </button>
                    )}
                    {enc.status === 'entregue' || enc.status === 'cancelado' ? (
                      <button onClick={() => mudarStatus(enc.id, 'pendente')}
                        className="flex items-center gap-1 border-2 border-gray-200 text-gray-500 px-3 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100">
                        <Clock size={15} /> Reabrir
                      </button>
                    ) : null}
                    <button onClick={() => abrirEditar(enc)}
                      className="flex items-center justify-center gap-1 border-2 border-orange-200 text-orange-600 px-3 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-50">
                      <Pencil size={15} /> Editar
                    </button>
                    <button onClick={() => setConfirmDelete(enc.id)}
                      className="flex items-center justify-center border-2 border-red-100 text-red-400 p-2.5 rounded-xl hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Nova / Editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '94vh' }}>

            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-gray-800">
                {modal === 'nova' ? '📦 Nova Encomenda' : '✏️ Editar Encomenda'}
              </h3>
              <button onClick={() => setModal(null)} className="p-2 rounded-xl bg-gray-100 text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nome do cliente *</label>
                <input
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                  placeholder="Ex: Maria, Joao..."
                  value={form.cliente_nome}
                  onChange={e => setForm({ ...form, cliente_nome: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Telefone</label>
                <input
                  type="tel" inputMode="tel"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                  placeholder="(00) 00000-0000"
                  value={form.cliente_telefone}
                  onChange={e => setForm({ ...form, cliente_telefone: e.target.value })}
                />
              </div>

              {/* Descricao */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">O que foi encomendado *</label>
                <textarea
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500 resize-none"
                  placeholder="Ex: 1 bolo de chocolate com morango, 50 coxinhas, 1 frango assado..."
                  rows={3}
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                />
              </div>

              {/* Data e hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Data de entrega *</label>
                  <input
                    type="date"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    value={form.data_entrega}
                    onChange={e => setForm({ ...form, data_entrega: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Horario</label>
                  <input
                    type="time"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    value={form.hora_entrega}
                    onChange={e => setForm({ ...form, hora_entrega: e.target.value })}
                  />
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Valor total (R$)</label>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder="0,00"
                    value={form.valor_total}
                    onChange={e => setForm({ ...form, valor_total: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Sinal recebido</label>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder="0,00"
                    value={form.valor_sinal}
                    onChange={e => setForm({ ...form, valor_sinal: e.target.value })}
                  />
                </div>
              </div>

              {/* Restante calculado */}
              {(f(form.valor_total) > 0) && (
                <div className="bg-orange-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-orange-700">Restante a cobrar na entrega</span>
                  <span className="font-extrabold text-orange-600 text-lg">
                    {fmt(Math.max(0, f(form.valor_total) - f(form.valor_sinal)))}
                  </span>
                </div>
              )}

              {/* Observacoes */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Observacoes</label>
                <textarea
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500 resize-none"
                  placeholder="Ex: Sem gluten, buscar na padaria, entregar em casa..."
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3 shrink-0">
              <button onClick={() => setModal(null)}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold text-base">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white py-3.5 rounded-2xl font-bold text-base">
                {salvando ? 'Salvando...' : modal === 'nova' ? 'Registrar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmacao de exclusao */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm text-center">
            <p className="text-5xl mb-4">🗑️</p>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Remover encomenda?</h3>
            <p className="text-gray-500 mb-6">Essa acao nao pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-2xl font-bold">
                Cancelar
              </button>
              <button onClick={() => deletar(confirmDelete)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-2xl font-bold">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
