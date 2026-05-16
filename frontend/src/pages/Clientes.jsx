import { useState, useEffect } from 'react';
import {
  Search, ChevronRight, ArrowLeft, Phone,
  MessageCircle, Pencil, UserPlus, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt  = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const VAZIO = { nome: '', telefone: '', observacao: '' };

export default function Clientes() {
  const { usuario } = useAuth();

  /* ── Lista ─────────────────────────────────────────────────── */
  const [clientes, setClientes]   = useState([]);
  const [busca, setBusca]         = useState('');
  const [filtro, setFiltro]       = useState('todos'); // 'todos' | 'devendo'

  /* ── Ficha ─────────────────────────────────────────────────── */
  const [vista, setVista]               = useState('lista'); // 'lista' | 'ficha'
  const [clienteSel, setClienteSel]     = useState(null);
  const [detalhe, setDetalhe]           = useState(null);   // { cliente, saldo, movimentos }
  const [carregandoFicha, setCarregandoFicha] = useState(false);

  /* ── Modais ─────────────────────────────────────────────────── */
  const [modal, setModal]       = useState(null); // null | 'pendurar' | 'pagar' | 'novo' | 'editar'
  const [valorModal, setValorModal] = useState('');
  const [descModal, setDescModal]   = useState('');
  const [formCliente, setFormCliente] = useState(VAZIO);
  const [salvando, setSalvando]       = useState(false);

  /* ── Carregamento ───────────────────────────────────────────── */
  const carregar = () => api.get('/clientes').then(r => setClientes(r.data));
  useEffect(() => { carregar(); }, []);

  /* ── Abrir ficha ────────────────────────────────────────────── */
  const abrirFicha = async (c) => {
    setClienteSel(c);
    setVista('ficha');
    setDetalhe(null);
    setCarregandoFicha(true);
    try {
      const r = await api.get(`/fiado/cliente/${c.id}`);
      setDetalhe(r.data);
    } catch {
      toast.error('Erro ao carregar ficha');
    } finally {
      setCarregandoFicha(false);
    }
  };

  const voltarLista = () => {
    setVista('lista');
    setClienteSel(null);
    setDetalhe(null);
    setModal(null);
  };

  /* ── Teclado de valor ───────────────────────────────────────── */
  const teclaValor = (t) => {
    if (t === 'C')  { setValorModal(''); return; }
    if (t === '⌫') { setValorModal(p => p.slice(0, -1)); return; }
    if (t === ',') {
      if (valorModal.includes(',')) return;
      setValorModal(p => (p || '0') + ',');
      return;
    }
    if (valorModal.includes(',')) {
      const dec = valorModal.split(',')[1] || '';
      if (dec.length >= 2) return;
    }
    if (valorModal.replace(',', '').length >= 8) return;
    setValorModal(p => (p === '0' ? t : p + t));
  };

  /* ── Lançar fiado / pagamento ───────────────────────────────── */
  const confirmarModal = async () => {
    const valor = parseFloat((valorModal || '').replace(',', '.'));
    if (!valor || valor <= 0) return toast.error('Digite um valor válido');
    setSalvando(true);
    try {
      await api.post('/fiado/lancar', {
        cliente_id: clienteSel.id,
        valor,
        tipo: modal === 'pendurar' ? 'debito' : 'pagamento',
        descricao: descModal || (modal === 'pendurar' ? 'Fiado' : 'Pagamento'),
        usuario_id: usuario?.id,
      });
      toast.success(modal === 'pendurar' ? 'Fiado lançado!' : 'Pagamento registrado!');
      setModal(null); setValorModal(''); setDescModal('');
      const r = await api.get(`/fiado/cliente/${clienteSel.id}`);
      setDetalhe(r.data);
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao registrar');
    } finally {
      setSalvando(false);
    }
  };

  /* ── Pagar tudo de uma vez ──────────────────────────────────── */
  const pagarTudo = async () => {
    const saldo = detalhe?.saldo || 0;
    if (saldo <= 0) return;
    setSalvando(true);
    try {
      await api.post('/fiado/lancar', {
        cliente_id: clienteSel.id,
        valor: saldo,
        tipo: 'pagamento',
        descricao: 'Pagamento total',
        usuario_id: usuario?.id,
      });
      toast.success('Dívida quitada!');
      setModal(null);
      const r = await api.get(`/fiado/cliente/${clienteSel.id}`);
      setDetalhe(r.data);
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro');
    } finally {
      setSalvando(false);
    }
  };

  /* ── Salvar cliente (novo ou editar) ────────────────────────── */
  const salvarCliente = async () => {
    if (!formCliente.nome.trim()) return toast.error('O nome é obrigatório');
    setSalvando(true);
    try {
      if (modal === 'editar') {
        await api.put(`/clientes/${clienteSel.id}`, formCliente);
        toast.success('Cliente atualizado');
        setClienteSel(prev => ({ ...prev, ...formCliente }));
        setModal(null);
        carregar();
      } else {
        const r = await api.post('/clientes', formCliente);
        toast.success('Cliente cadastrado!');
        setModal(null);
        await carregar();
        abrirFicha({ id: r.data.id, ...formCliente, saldo_fiado: 0 });
      }
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  /* ── WhatsApp ────────────────────────────────────────────────── */
  const abrirWhatsApp = (c, saldo) => {
    if (!c.telefone) return;
    const num = c.telefone.replace(/\D/g, '');
    const completo = num.startsWith('55') ? num : `55${num}`;
    const msg = saldo > 0
      ? `Olá ${c.nome}! Tudo bem? Seu saldo na padaria é de ${fmt(saldo)}. Podemos combinar o pagamento? 😊`
      : `Olá ${c.nome}! Tudo bem? Você está em dia na padaria. Obrigado pela preferência! 🙏`;
    window.open(`https://wa.me/${completo}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* ── Filtros da lista ────────────────────────────────────────── */
  const qtdDevendo    = clientes.filter(c => (c.saldo_fiado || 0) > 0).length;
  const clientesFiltrados = clientes.filter(c => {
    const matchBusca  = norm(c.nome).includes(norm(busca));
    const matchFiltro = filtro === 'todos' || (c.saldo_fiado || 0) > 0;
    return matchBusca && matchFiltro;
  });

  /* ══════════════════════════════════════════════════════════════
     FICHA DO CLIENTE
  ══════════════════════════════════════════════════════════════ */
  if (vista === 'ficha' && clienteSel) {
    const saldo      = detalhe?.saldo     ?? 0;
    const movimentos = detalhe?.movimentos ?? [];

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-gray-50">

        {/* Topo */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={voltarLista}
            className="flex items-center gap-1 text-orange-600 font-bold text-base">
            <ArrowLeft size={20} /> Clientes
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800 flex-1 truncate">{clienteSel.nome}</span>
          <button
            onClick={() => {
              setFormCliente({ nome: clienteSel.nome, telefone: clienteSel.telefone || '', observacao: clienteSel.observacao || '' });
              setModal('editar');
            }}
            className="p-2 text-gray-400 hover:text-orange-600">
            <Pencil size={18} />
          </button>
        </div>

        <div className="flex-1 p-4 space-y-4 pb-8">

          {/* Contato + Saldo (lado a lado no desktop, empilhados no mobile) */}
          <div className="flex flex-col md:flex-row gap-4">

            {/* ── Dados de contato ── */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 md:w-60 shrink-0">
              <p className="font-extrabold text-gray-800 text-xl mb-1 leading-tight">{clienteSel.nome}</p>
              {clienteSel.telefone
                ? <p className="text-gray-500 flex items-center gap-1.5 text-base"><Phone size={15} />{clienteSel.telefone}</p>
                : <p className="text-gray-400 text-sm italic">Sem telefone</p>
              }
              {clienteSel.observacao && (
                <p className="text-gray-400 text-sm mt-2 italic">{clienteSel.observacao}</p>
              )}
              {clienteSel.telefone && (
                <button
                  onClick={() => abrirWhatsApp(clienteSel, saldo)}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3.5 rounded-2xl text-base"
                >
                  <MessageCircle size={20} /> WhatsApp
                </button>
              )}
            </div>

            {/* ── Ficha do fiado ── */}
            <div className="flex-1 bg-white rounded-2xl border-2 border-gray-100 p-5">
              {carregandoFicha ? (
                <p className="text-center text-gray-400 py-8 text-lg">Carregando...</p>
              ) : (
                <>
                  <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2">
                    Saldo Devedor
                  </p>
                  <p className={`text-5xl font-extrabold mb-6 ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmt(saldo)}
                  </p>

                  <div className="space-y-3">
                    {/* + PENDURAR NOVO */}
                    <button
                      onClick={() => { setValorModal(''); setDescModal(''); setModal('pendurar'); }}
                      className="w-full flex items-center justify-center gap-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-extrabold text-xl py-5 rounded-2xl shadow-sm"
                    >
                      <Plus size={26} /> PENDURAR NOVO
                    </button>

                    {/* 💵 PAGAR / DAR BAIXA — só aparece quando tem saldo */}
                    {saldo > 0 && (
                      <button
                        onClick={() => { setValorModal(''); setDescModal(''); setModal('pagar'); }}
                        className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-extrabold text-xl py-5 rounded-2xl shadow-sm"
                      >
                        💵 PAGAR / DAR BAIXA
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Histórico ── */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
            <p className="font-extrabold text-gray-700 text-base mb-3">📋 Histórico</p>
            {movimentos.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Nenhum lançamento ainda</p>
            ) : (
              <div className="space-y-2">
                {movimentos.map(m => (
                  <div key={m.id}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${m.tipo === 'debito' ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {m.descricao || (m.tipo === 'debito' ? 'Fiado' : 'Pagamento')}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">{m.data}</p>
                    </div>
                    <p className={`font-extrabold text-lg ${m.tipo === 'debito' ? 'text-red-600' : 'text-green-600'}`}>
                      {m.tipo === 'debito' ? '+' : '-'}{fmt(m.valor)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ Modal: PENDURAR / PAGAR ══════════════════════════════════ */}
        {(modal === 'pendurar' || modal === 'pagar') && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setModal(null)} />
            <div className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl md:w-96 w-full">

              {/* Handle mobile */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Cabeçalho */}
              <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                <p className="font-extrabold text-gray-800 text-xl">
                  {modal === 'pendurar' ? '📌 Pendurar Fiado' : '💵 Registrar Pagamento'}
                </p>
                <p className="text-gray-500 text-sm mt-0.5">{clienteSel.nome}</p>
                {modal === 'pagar' && saldo > 0 && (
                  <p className="text-red-600 font-bold text-sm mt-1">
                    Deve atualmente: {fmt(saldo)}
                  </p>
                )}
              </div>

              <div className="px-5 py-4">
                {/* Display do valor */}
                <div className={`rounded-2xl py-4 px-6 text-center mb-3 border-2 ${
                  modal === 'pendurar' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <p className={`text-5xl font-extrabold tracking-wide ${
                    modal === 'pendurar' ? 'text-red-700' : 'text-green-700'
                  }`}>
                    R$ {valorModal || '0'}
                  </p>
                </div>

                {/* Pagar Tudo — atalho rápido */}
                {modal === 'pagar' && saldo > 0 && (
                  <button
                    onClick={pagarTudo}
                    disabled={salvando}
                    className="w-full mb-3 bg-green-100 border-2 border-green-300 text-green-800 font-extrabold py-3.5 rounded-2xl text-lg active:bg-green-200"
                  >
                    ✓ Pagar Tudo — {fmt(saldo)}
                  </button>
                )}

                {/* Teclado numérico */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
                    <button key={n}
                      onClick={() => teclaValor(String(n))}
                      className="py-4 rounded-2xl bg-gray-100 text-2xl font-extrabold text-gray-800 active:bg-gray-200 active:scale-95 transition-all">
                      {n}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button onClick={() => teclaValor(',')}
                    className="py-4 rounded-2xl bg-gray-100 text-2xl font-extrabold text-gray-600 active:bg-gray-200">
                    ,
                  </button>
                  <button onClick={() => teclaValor('0')}
                    className="py-4 rounded-2xl bg-gray-100 text-2xl font-extrabold text-gray-800 active:bg-gray-200">
                    0
                  </button>
                  <button onClick={() => teclaValor('⌫')}
                    className="py-4 rounded-2xl bg-gray-100 text-2xl font-extrabold text-gray-600 active:bg-gray-200">
                    ⌫
                  </button>
                </div>

                {/* C + Confirmar */}
                <div className="flex gap-2">
                  <button onClick={() => teclaValor('C')}
                    className="w-16 py-4 rounded-2xl bg-red-100 text-red-600 font-extrabold text-lg active:bg-red-200">
                    C
                  </button>
                  <button
                    onClick={confirmarModal}
                    disabled={!valorModal || salvando}
                    className={`flex-1 py-4 rounded-2xl font-extrabold text-xl text-white disabled:bg-gray-200 disabled:text-gray-400 transition-colors ${
                      modal === 'pendurar'
                        ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
                    }`}
                  >
                    {salvando ? '...' : '✓ CONFIRMAR'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Modal: Editar cliente ══════════════════════════════════════ */}
        {modal === 'editar' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-5">Editar Cliente</h3>
              <div className="space-y-3">
                {[
                  { label: 'Nome *',     key: 'nome',       placeholder: 'Nome completo'     },
                  { label: 'Telefone',   key: 'telefone',   placeholder: '(00) 00000-0000'   },
                  { label: 'Observação', key: 'observacao', placeholder: 'Ex: mora na rua...' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-sm font-semibold text-gray-700">{f.label}</label>
                    <input
                      className="w-full mt-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                      placeholder={f.placeholder}
                      value={formCliente[f.key]}
                      onChange={e => setFormCliente(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setModal(null)}
                  className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold">
                  Cancelar
                </button>
                <button onClick={salvarCliente} disabled={salvando}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     LISTA DE CLIENTES
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Topo fixo */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-extrabold text-gray-800">Clientes</h2>
          <button
            onClick={() => { setFormCliente(VAZIO); setModal('novo'); }}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm"
          >
            <UserPlus size={18} /> Novo
          </button>
        </div>

        {/* Busca */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-orange-500"
            placeholder="Buscar pelo nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2">
          <button
            onClick={() => setFiltro('todos')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              filtro === 'todos' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Todos ({clientes.length})
          </button>
          <button
            onClick={() => setFiltro('devendo')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              filtro === 'devendo' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            🔴 Devendo ({qtdDevendo})
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {clientesFiltrados.map(c => {
          const saldo = c.saldo_fiado || 0;
          return (
            <button key={c.id} onClick={() => abrirFicha(c)}
              className="w-full bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-center gap-4 active:bg-gray-50 transition-colors text-left">

              {/* Inicial */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-extrabold ${
                saldo > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {c.nome.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-gray-800 text-base truncate">{c.nome}</p>
                {c.telefone && <p className="text-gray-400 text-sm truncate">{c.telefone}</p>}
              </div>

              <div className="text-right shrink-0">
                {saldo > 0 ? (
                  <>
                    <p className="text-xs font-bold text-red-500 uppercase leading-none">Deve</p>
                    <p className="text-red-600 font-extrabold text-lg">{fmt(saldo)}</p>
                  </>
                ) : (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    ✓ Em dia
                  </span>
                )}
              </div>

              <ChevronRight size={20} className="text-gray-300 shrink-0" />
            </button>
          );
        })}

        {clientesFiltrados.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">
              {filtro === 'devendo' ? '🎉' : '👥'}
            </p>
            <p className="text-gray-500 font-semibold text-lg">
              {filtro === 'devendo' ? 'Ninguém devendo!' : 'Nenhum cliente encontrado'}
            </p>
            {filtro === 'devendo' && (
              <p className="text-gray-400 text-sm mt-1">Tudo em dia por aqui!</p>
            )}
          </div>
        )}
      </div>

      {/* ══ Modal: Novo cliente ══════════════════════════════════════════ */}
      {modal === 'novo' && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white w-full md:max-w-sm md:rounded-3xl rounded-t-3xl shadow-2xl p-6">
            <div className="flex justify-center mb-4 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-5">Novo Cliente</h3>
            <div className="space-y-3">
              {[
                { label: 'Nome *',     key: 'nome',       placeholder: 'Nome completo'     },
                { label: 'Telefone',   key: 'telefone',   placeholder: '(00) 00000-0000'   },
                { label: 'Observação', key: 'observacao', placeholder: 'Ex: mora na rua...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm font-semibold text-gray-700">{f.label}</label>
                  <input
                    className="w-full mt-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-500"
                    placeholder={f.placeholder}
                    value={formCliente[f.key]}
                    onChange={e => setFormCliente(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-bold">
                Cancelar
              </button>
              <button onClick={salvarCliente} disabled={salvando}
                className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold">
                {salvando ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
