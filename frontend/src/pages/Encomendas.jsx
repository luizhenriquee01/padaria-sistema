import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Phone, Calendar, CheckCircle, Clock, X, Pencil, Trash2,
  ChevronDown, Search, ChefHat, List, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
  pendente:  { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  pronto:    { label: 'Pronto',    cor: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-500'   },
  entregue:  { label: 'Entregue', cor: 'bg-green-100 text-green-800',   dot: 'bg-green-500'  },
  cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400'   },
};

const SETORES = ['Salgado', 'Bolo', 'Pao', 'Doce', 'Frango', 'Outros'];
const SETOR_EMOJI  = { Salgado: '🥟', Bolo: '🎂', Pao: '🍞', Doce: '🍬', Frango: '🍗', Outros: '📦' };
const SETOR_COR    = {
  Salgado: 'bg-orange-100 text-orange-700 border-orange-200',
  Bolo:    'bg-pink-100 text-pink-700 border-pink-200',
  Pao:     'bg-amber-100 text-amber-700 border-amber-200',
  Doce:    'bg-purple-100 text-purple-700 border-purple-200',
  Frango:  'bg-red-100 text-red-700 border-red-200',
  Outros:  'bg-gray-100 text-gray-600 border-gray-200',
};
const SETOR_PROD   = {
  Salgado: 'border-l-orange-500 bg-orange-50',
  Bolo:    'border-l-pink-500 bg-pink-50',
  Pao:     'border-l-amber-500 bg-amber-50',
  Doce:    'border-l-purple-500 bg-purple-50',
  Frango:  'border-l-red-500 bg-red-50',
  Outros:  'border-l-gray-400 bg-gray-50',
};

const FILTROS = [
  { key: 'ativas',   label: '📋 Ativas'   },
  { key: 'hoje',     label: '📅 Hoje'     },
  { key: 'semana',   label: '🗓 Semana'   },
  { key: 'entregue', label: '✅ Entregues' },
  { key: 'todas',    label: '🔍 Todas'    },
];

const FORM_VAZIO = {
  cliente_nome: '', cliente_telefone: '',
  descricao: '',
  data_entrega: dataLocal(), hora_entrega: '',
  valor_total: '', valor_sinal: '', observacoes: '',
  itens: [],
};

// ── Seletor de setor ────────────────────────────────────────────────────────
function SetorBadge({ setor, onChange, small = false }) {
  return (
    <div className={`flex gap-1 flex-wrap ${small ? '' : 'mt-1'}`}>
      {SETORES.map(s => (
        <button key={s} type="button"
          onClick={() => onChange(s === setor ? '' : s)}
          className={`border rounded-lg font-semibold transition-all ${
            small ? 'text-xs px-2 py-0.5' : 'text-xs px-2 py-1'
          } ${setor === s
            ? SETOR_COR[s] + ' border-current'
            : 'bg-white text-gray-400 border-gray-200'
          }`}>
          {SETOR_EMOJI[s]} {s}
        </button>
      ))}
    </div>
  );
}

export default function Encomendas() {
  const { usuario } = useAuth();
  const [encomendas, setEncomendas]   = useState([]);
  const [filtro, setFiltro]           = useState('ativas');
  const [setorFiltro, setSetorFiltro] = useState('todos');
  const [vista, setVista]             = useState('lista'); // 'lista' | 'producao'
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState(FORM_VAZIO);
  const [editId, setEditId]           = useState(null);
  const [salvando, setSalvando]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandido, setExpandido]     = useState(null);

  // Producao
  const [dataProducao, setDataProducao] = useState(dataLocal());
  const [producao, setProducao]         = useState([]);

  // Seletor de produtos no modal
  const [produtos, setProdutos]   = useState([]);
  const [buscaProd, setBuscaProd] = useState('');
  const [itemCustom, setItemCustom] = useState({ nome: '', quantidade: 1, setor: '', unidade: 'un' });
  const [addingCustom, setAddingCustom] = useState(false);

  // ── Carregar ─────────────────────────────────────────────────────────────
  const carregar = async () => {
    try {
      const hoje = dataLocal();
      let params = '';
      if (filtro === 'ativas')   params = '?status=pendente';
      else if (filtro === 'hoje') params = `?de=${hoje}&ate=${hoje}`;
      else if (filtro === 'semana') {
        const fim = new Date(); fim.setDate(fim.getDate() + 6);
        params = `?de=${hoje}&ate=${dataLocal(fim)}`;
      } else if (filtro === 'entregue') params = '?status=entregue';

      if (setorFiltro !== 'todos') {
        params += (params ? '&' : '?') + `setor=${setorFiltro}`;
      }

      const r = await api.get('/encomendas' + params);
      setEncomendas(r.data);
    } catch { toast.error('Erro ao carregar encomendas'); }
  };

  const carregarProducao = async () => {
    try {
      const r = await api.get(`/encomendas/producao/${dataProducao}`);
      setProducao(r.data);
    } catch { toast.error('Erro ao carregar producao'); }
  };

  useEffect(() => { carregar(); }, [filtro, setorFiltro]);
  useEffect(() => { if (vista === 'producao') carregarProducao(); }, [vista, dataProducao]);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const abrirNova = async () => {
    setForm({ ...FORM_VAZIO, data_entrega: dataLocal(), itens: [] });
    setEditId(null);
    setBuscaProd('');
    setAddingCustom(false);
    if (!produtos.length) {
      const r = await api.get('/produtos');
      setProdutos(r.data);
    }
    setModal('nova');
  };

  const abrirEditar = async (enc) => {
    setForm({
      cliente_nome: enc.cliente_nome,
      cliente_telefone: enc.cliente_telefone || '',
      descricao: enc.descricao || '',
      data_entrega: enc.data_entrega,
      hora_entrega: enc.hora_entrega || '',
      valor_total: enc.valor_total || '',
      valor_sinal: enc.valor_sinal || '',
      observacoes: enc.observacoes || '',
      itens: (enc.itens || []).map(i => ({ ...i })),
    });
    setEditId(enc.id);
    setBuscaProd('');
    setAddingCustom(false);
    if (!produtos.length) {
      const r = await api.get('/produtos');
      setProdutos(r.data);
    }
    setModal('editar');
  };

  // ── Itens ─────────────────────────────────────────────────────────────────
  const addProduto = (p) => {
    setForm(f => {
      const existe = f.itens.findIndex(i => i.produto_id === p.id);
      if (existe >= 0) {
        const itens = [...f.itens];
        itens[existe] = { ...itens[existe], quantidade: itens[existe].quantidade + 1 };
        return { ...f, itens };
      }
      return {
        ...f,
        itens: [...f.itens, {
          produto_id: p.id,
          nome: p.nome,
          quantidade: 1,
          unidade: p.unidade || 'un',
          setor: p.setor || '',
        }],
      };
    });
    setBuscaProd('');
  };

  const addItemCustom = () => {
    if (!itemCustom.nome.trim()) return toast.error('Digite o nome do item');
    setForm(f => ({
      ...f,
      itens: [...f.itens, {
        produto_id: null,
        nome: itemCustom.nome.trim(),
        quantidade: parseFloat(itemCustom.quantidade) || 1,
        unidade: itemCustom.unidade || 'un',
        setor: itemCustom.setor || '',
      }],
    }));
    setItemCustom({ nome: '', quantidade: 1, setor: '', unidade: 'un' });
    setAddingCustom(false);
  };

  const removeItem = (idx) => setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));

  const setItemQtd = (idx, val) => setForm(f => {
    const itens = [...f.itens];
    itens[idx] = { ...itens[idx], quantidade: val };
    return { ...f, itens };
  });

  const setItemSetor = (idx, setor) => setForm(f => {
    const itens = [...f.itens];
    itens[idx] = { ...itens[idx], setor };
    return { ...f, itens };
  });

  const prodsFiltrados = useMemo(() =>
    buscaProd.length < 1 ? [] :
    produtos.filter(p => norm(p.nome).includes(norm(buscaProd))).slice(0, 8),
  [buscaProd, produtos]);

  // ── Salvar ────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!form.cliente_nome.trim()) return toast.error('Nome do cliente obrigatorio');
    if (!form.data_entrega) return toast.error('Data de entrega obrigatoria');
    if (form.itens.length === 0 && !form.descricao.trim())
      return toast.error('Adicione pelo menos um item ou descreva a encomenda');

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
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const mudarStatus = async (id, status) => {
    try {
      await api.patch(`/encomendas/${id}/status`, { status });
      const labels = { pronto: 'Marcado como Pronto! 👨‍🍳', entregue: 'Entregue! ✅', cancelado: 'Cancelado', pendente: 'Voltou para Pendente' };
      toast.success(labels[status] || 'Status atualizado');
      carregar();
    } catch { toast.error('Erro ao atualizar status'); }
  };

  const deletar = async (id) => {
    try {
      await api.delete(`/encomendas/${id}`);
      toast.success('Encomenda removida');
      setConfirmDelete(null);
      carregar();
    } catch { toast.error('Erro ao remover'); }
  };

  const f = v => parseFloat(v) || 0;

  // ── Agrupar producao por setor ────────────────────────────────────────────
  const producaoPorSetor = useMemo(() => {
    const grupos = {};
    producao.forEach(item => {
      const s = item.setor || 'Outros';
      if (!grupos[s]) grupos[s] = [];
      grupos[s].push(item);
    });
    return grupos;
  }, [producao]);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full">

      {/* ── Cabecalho ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-gray-800">Encomendas</h2>
          <div className="flex gap-2">
            {/* Toggle lista / producao */}
            <button
              onClick={() => setVista(v => v === 'lista' ? 'producao' : 'lista')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                vista === 'producao'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
              {vista === 'producao' ? <List size={16} /> : <ChefHat size={16} />}
              <span className="hidden sm:inline">{vista === 'producao' ? 'Lista' : 'Producao'}</span>
            </button>
            <button onClick={abrirNova}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm">
              <Plus size={18} /> Nova
            </button>
          </div>
        </div>

        {/* Filtros de tempo (só na vista lista) */}
        {vista === 'lista' && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {FILTROS.map(fi => (
                <button key={fi.key} onClick={() => setFiltro(fi.key)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    filtro === fi.key ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {fi.label}
                </button>
              ))}
            </div>

            {/* Filtro por setor */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-2">
              <button onClick={() => setSetorFiltro('todos')}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  setorFiltro === 'todos' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                Todos setores
              </button>
              {SETORES.map(s => (
                <button key={s} onClick={() => setSetorFiltro(setorFiltro === s ? 'todos' : s)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    setorFiltro === s
                      ? SETOR_COR[s] + ' border-current'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                  {SETOR_EMOJI[s]} {s}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Seletor de data (só na vista producao) */}
        {vista === 'producao' && (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-semibold text-gray-600">Data da producao:</span>
            <input type="date" value={dataProducao}
              onChange={e => setDataProducao(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
            <span className="text-xs text-gray-400">{producao.length} tipo(s) de item</span>
          </div>
        )}
      </div>

      {/* ── VISTA LISTA ───────────────────────────────────────────────────── */}
      {vista === 'lista' && (
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
            const ehHoje = diff === 0 && (enc.status === 'pendente' || enc.status === 'pronto');
            const cfg = STATUS_CFG[enc.status] || STATUS_CFG.pendente;
            const restante = f(enc.valor_total) - f(enc.valor_sinal);
            const aberto = expandido === enc.id;
            const itens = enc.itens || [];

            return (
              <div key={enc.id}
                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                  atrasada ? 'border-red-300' : ehHoje ? 'border-orange-400' : 'border-gray-100'
                }`}>

                {/* Linha principal */}
                <button onClick={() => setExpandido(aberto ? null : enc.id)} className="w-full p-4 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-800 text-base">{enc.cliente_nome}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${cfg.cor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className={`flex items-center gap-1 text-sm font-semibold ${
                          atrasada ? 'text-red-600' : ehHoje ? 'text-orange-600' : 'text-gray-500'
                        }`}>
                          <Calendar size={14} />
                          {formatarDataBR(enc.data_entrega)}
                          {enc.hora_entrega && ` as ${enc.hora_entrega}`}
                        </span>
                        {enc.status !== 'entregue' && enc.status !== 'cancelado' && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            atrasada ? 'bg-red-100 text-red-700' : ehHoje ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {labelDias(diff)}
                          </span>
                        )}
                      </div>

                      {/* Preview dos itens ou descricao */}
                      {itens.length > 0 ? (
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {itens.slice(0, 4).map((it, i) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${
                              SETOR_COR[it.setor] || 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                              {SETOR_EMOJI[it.setor] || '📦'} {it.nome} ×{it.quantidade}
                            </span>
                          ))}
                          {itens.length > 4 && (
                            <span className="text-xs text-gray-400 self-center">+{itens.length - 4} mais</span>
                          )}
                        </div>
                      ) : enc.descricao ? (
                        <p className="text-gray-600 text-sm mt-1.5 line-clamp-2">{enc.descricao}</p>
                      ) : null}
                    </div>

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

                    {/* Lista de itens agrupada por setor */}
                    {itens.length > 0 && (
                      <div className="space-y-2">
                        {SETORES.concat(['sem setor']).map(s => {
                          const grupo = itens.filter(i => (i.setor || 'sem setor') === s);
                          if (!grupo.length) return null;
                          const label = s === 'sem setor' ? 'Outros' : s;
                          return (
                            <div key={s} className={`rounded-xl border-l-4 p-3 ${SETOR_PROD[label] || SETOR_PROD.Outros}`}>
                              <p className="text-xs font-bold text-gray-500 uppercase mb-1.5">
                                {SETOR_EMOJI[label] || '📦'} {label}
                              </p>
                              <div className="space-y-1">
                                {grupo.map((it, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{it.nome}</span>
                                    <span className="font-bold text-gray-800">{it.quantidade} {it.unidade}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {enc.descricao && (
                      <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-3">
                        {enc.descricao}
                      </p>
                    )}

                    {enc.observacoes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-gray-700">
                        <p className="font-semibold text-yellow-800 mb-1">Observacoes:</p>
                        <p>{enc.observacoes}</p>
                      </div>
                    )}

                    {/* Financeiro */}
                    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total</span>
                        <span className="font-bold text-gray-800">{fmt(enc.valor_total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sinal pago</span>
                        <span className="font-bold text-green-600">{fmt(enc.valor_sinal)}</span>
                      </div>
                      {restante > 0 && (
                        <div className="flex justify-between border-t border-dashed border-gray-200 pt-1.5">
                          <span className="font-bold text-gray-700">Restante</span>
                          <span className="font-extrabold text-orange-600 text-base">{fmt(restante)}</span>
                        </div>
                      )}
                    </div>

                    {/* Acoes */}
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
                          className="flex items-center gap-1 border-2 border-gray-200 text-gray-500 px-3 py-2.5 rounded-xl font-bold text-sm">
                          <X size={15} /> Cancelar
                        </button>
                      )}
                      {(enc.status === 'entregue' || enc.status === 'cancelado') && (
                        <button onClick={() => mudarStatus(enc.id, 'pendente')}
                          className="flex items-center gap-1 border-2 border-gray-200 text-gray-500 px-3 py-2.5 rounded-xl font-bold text-sm">
                          <Clock size={15} /> Reabrir
                        </button>
                      )}
                      <button onClick={() => abrirEditar(enc)}
                        className="flex items-center gap-1 border-2 border-orange-200 text-orange-600 px-3 py-2.5 rounded-xl font-bold text-sm">
                        <Pencil size={15} /> Editar
                      </button>
                      <button onClick={() => setConfirmDelete(enc.id)}
                        className="flex items-center border-2 border-red-100 text-red-400 p-2.5 rounded-xl">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── VISTA PRODUCAO ─────────────────────────────────────────────────── */}
      {vista === 'producao' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.keys(producaoPorSetor).length === 0 && (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">🧑‍🍳</p>
              <p className="text-gray-400 text-lg">Nenhuma producao para esta data</p>
              <p className="text-gray-400 text-sm mt-1">Verifique se ha encomendas pendentes ou prontas para {formatarDataBR(dataProducao)}</p>
            </div>
          )}

          {SETORES.map(setor => {
            const items = producaoPorSetor[setor];
            if (!items) return null;
            return (
              <div key={setor} className={`rounded-2xl border-l-4 overflow-hidden shadow-sm ${SETOR_PROD[setor]}`}>
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className="text-2xl">{SETOR_EMOJI[setor]}</span>
                  <h3 className="text-lg font-extrabold text-gray-800">{setor}</h3>
                  <span className="ml-auto text-xs bg-white/70 text-gray-600 font-bold px-2 py-0.5 rounded-full">
                    {items.length} produto(s)
                  </span>
                </div>
                <div className="bg-white/60 divide-y divide-white/80">
                  {items.map((item, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">{item.nome}</p>
                        <p className="text-xs text-gray-500">{item.num_pedidos} pedido(s) • {item.clientes}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-gray-800">{item.total}</p>
                        <p className="text-xs text-gray-500">{item.unidade || 'un'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Outros (sem setor) */}
          {producaoPorSetor['Outros'] && (
            <div className={`rounded-2xl border-l-4 overflow-hidden shadow-sm ${SETOR_PROD.Outros}`}>
              <div className="px-4 py-3 flex items-center gap-2">
                <span className="text-2xl">📦</span>
                <h3 className="text-lg font-extrabold text-gray-800">Outros</h3>
              </div>
              <div className="bg-white/60 divide-y divide-white/80">
                {producaoPorSetor['Outros'].map((item, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{item.nome}</p>
                      <p className="text-xs text-gray-500">{item.num_pedidos} pedido(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-gray-800">{item.total}</p>
                      <p className="text-xs text-gray-500">{item.unidade || 'un'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NOVA / EDITAR ────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '94vh' }}>

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
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Nome do cliente *</label>
                  <input className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder="Ex: Maria, Joao..."
                    value={form.cliente_nome}
                    onChange={e => setForm({ ...form, cliente_nome: e.target.value })}
                    autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Telefone</label>
                  <input type="tel" className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder="(00) 00000-0000"
                    value={form.cliente_telefone}
                    onChange={e => setForm({ ...form, cliente_telefone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Horario</label>
                  <input type="time" className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    value={form.hora_entrega}
                    onChange={e => setForm({ ...form, hora_entrega: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Data de entrega *</label>
                  <input type="date" className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    value={form.data_entrega}
                    onChange={e => setForm({ ...form, data_entrega: e.target.value })} />
                </div>
              </div>

              {/* ── Itens ─────────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-gray-700">Itens da encomenda</label>
                  <button type="button" onClick={() => setAddingCustom(v => !v)}
                    className="text-xs text-orange-600 font-bold flex items-center gap-1">
                    <Plus size={13} /> Item personalizado
                  </button>
                </div>

                {/* Search produtos */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input
                    className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-orange-500"
                    placeholder="Buscar produto do catalogo..."
                    value={buscaProd}
                    onChange={e => setBuscaProd(e.target.value)}
                  />
                </div>

                {/* Resultados da busca */}
                {prodsFiltrados.length > 0 && (
                  <div className="border-2 border-gray-100 rounded-xl overflow-hidden mt-1">
                    {prodsFiltrados.map(p => (
                      <button key={p.id} type="button" onClick={() => addProduto(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-orange-50 active:bg-orange-100 border-b border-gray-50 last:border-0 text-left">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{p.nome}</p>
                          {p.setor && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${SETOR_COR[p.setor] || 'bg-gray-100 text-gray-500'}`}>
                              {SETOR_EMOJI[p.setor]} {p.setor}
                            </span>
                          )}
                        </div>
                        <Plus size={16} className="text-orange-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Item personalizado */}
                {addingCustom && (
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 space-y-2 mt-1">
                    <p className="text-xs font-bold text-orange-700">Item personalizado</p>
                    <input className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                      placeholder="Nome do item"
                      value={itemCustom.nome}
                      onChange={e => setItemCustom({ ...itemCustom, nome: e.target.value })} />
                    <div className="flex gap-2">
                      <input type="number" min="0.5" step="0.5"
                        className="w-24 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                        placeholder="Qtd"
                        value={itemCustom.quantidade}
                        onChange={e => setItemCustom({ ...itemCustom, quantidade: e.target.value })} />
                      <select className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                        value={itemCustom.unidade}
                        onChange={e => setItemCustom({ ...itemCustom, unidade: e.target.value })}>
                        <option value="un">unidade</option>
                        <option value="kg">kg</option>
                        <option value="g">gramas</option>
                        <option value="L">litro</option>
                      </select>
                    </div>
                    <SetorBadge setor={itemCustom.setor} onChange={s => setItemCustom({ ...itemCustom, setor: s })} />
                    <button type="button" onClick={addItemCustom}
                      className="w-full bg-orange-600 text-white py-2 rounded-xl font-bold text-sm">
                      Adicionar
                    </button>
                  </div>
                )}

                {/* Lista de itens adicionados */}
                {form.itens.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {form.itens.map((item, idx) => (
                      <div key={idx} className={`rounded-xl border-l-4 p-3 ${SETOR_PROD[item.setor] || SETOR_PROD.Outros}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-800 text-sm flex-1">{item.nome}</p>
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400">
                            <X size={16} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <input type="number" min="0.5" step="0.5"
                            className="w-20 border-2 border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-bold"
                            value={item.quantidade}
                            onChange={e => setItemQtd(idx, e.target.value)} />
                          <span className="text-xs text-gray-500">{item.unidade}</span>
                        </div>
                        <SetorBadge setor={item.setor} onChange={s => setItemSetor(idx, s)} small />
                      </div>
                    ))}
                  </div>
                )}

                {form.itens.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    Busque produtos acima ou adicione um item personalizado
                  </p>
                )}
              </div>

              {/* Descricao livre (opcional) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Descricao / notas adicionais {form.itens.length > 0 ? '(opcional)' : '*'}
                </label>
                <textarea
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none"
                  placeholder="Detalhes extras, recheio especial, como entregar..."
                  rows={2}
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Total (R$)</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder="0,00"
                    value={form.valor_total}
                    onChange={e => setForm({ ...form, valor_total: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Sinal recebido</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder="0,00"
                    value={form.valor_sinal}
                    onChange={e => setForm({ ...form, valor_sinal: e.target.value })} />
                </div>
              </div>

              {f(form.valor_total) > 0 && (
                <div className="bg-orange-50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-orange-700">Restante na entrega</span>
                  <span className="font-extrabold text-orange-600 text-lg">
                    {fmt(Math.max(0, f(form.valor_total) - f(form.valor_sinal)))}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Observacoes</label>
                <textarea
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none"
                  placeholder="Ex: Sem gluten, entregar em casa..."
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })} />
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

      {/* ── Confirmacao exclusao ───────────────────────────────────────────── */}
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
