import { useState, useEffect } from 'react';
import { AlertTriangle, Search, X, ChevronRight, ArrowUp, ArrowDown, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const QTDS_RAPIDAS = [1, 5, 10, 20, 50];

const norm = str => (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Estoque() {
  const [estoque, setEstoque]           = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [aba, setAba]                   = useState('entrada');
  const [busca, setBusca]               = useState('');
  const [produtoSel, setProdutoSel]     = useState(null);
  const [quantidade, setQuantidade]     = useState(0);
  const [tipoMov, setTipoMov]           = useState('entrada');
  const [salvando, setSalvando]         = useState(false);

  const carregar = () => {
    api.get('/estoque').then(r => setEstoque(r.data)).catch(() => {});
    api.get('/estoque/movimentacoes').then(r => setMovimentacoes(r.data)).catch(() => {});
  };

  useEffect(() => { carregar(); }, []);

  /* ---------- helpers ---------- */

  const produtosFiltrados = estoque.filter(p =>
    !busca ||
    norm(p.nome).includes(norm(busca)) ||
    norm(p.categoria).includes(norm(busca))
  );

  const selecionarProduto = (p) => {
    setProdutoSel(p);
    setQuantidade(0);
    setTipoMov('entrada');
  };

  const fecharPainel = () => { setProdutoSel(null); setQuantidade(0); };

  const adicionarQtd = (n) => setQuantidade(q => q + n);

  const confirmar = async () => {
    if (quantidade <= 0) return toast.error('Adicione uma quantidade primeiro');
    setSalvando(true);
    try {
      await api.post('/estoque/movimentar', {
        produto_id: produtoSel.id,
        tipo: tipoMov,
        quantidade,
      });
      const label = tipoMov === 'entrada'
        ? `+${quantidade} ${produtoSel.unidade} adicionado!`
        : `-${quantidade} ${produtoSel.unidade} retirado`;
      toast.success(label);
      fecharPainel();
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao registrar');
    } finally {
      setSalvando(false);
    }
  };

  const alertas = estoque.filter(i => i.alerta);

  /* ---------- render ---------- */

  return (
    <div className="flex flex-col h-full">

      {/* ===== HEADER + TABS ===== */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0 shrink-0">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Estoque</h2>
        <div className="flex gap-1">
          {[
            ['entrada',   '📦 Entrada'],
            ['atual',     '📋 Atual'],
            ['historico', '🕐 Histórico'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setAba(v)}
              className={`px-4 py-2.5 rounded-t-xl font-semibold text-sm transition-colors ${
                aba === v
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ===== ABA: ENTRADA DE MERCADORIA ===== */}
      {aba === 'entrada' && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* Busca */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-10 pr-10 py-3.5 border-2 border-gray-200 rounded-2xl text-base focus:outline-none focus:border-orange-500 bg-white"
                placeholder="Buscar produto..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
                  <X size={18} />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Toque no produto para registrar entrada ou saída
            </p>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {produtosFiltrados.length === 0 && (
              <div className="text-center py-16">
                <Package size={48} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-lg">Nenhum produto encontrado</p>
              </div>
            )}

            {produtosFiltrados.map(p => (
              <button
                key={p.id}
                onClick={() => selecionarProduto(p)}
                className="w-full flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 p-4 active:border-orange-400 active:bg-orange-50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-800 text-base truncate">{p.nome}</p>
                  <p className="text-sm text-gray-400">{p.categoria || 'Sem categoria'}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-right">
                    <p className={`font-extrabold text-xl leading-none ${p.alerta ? 'text-red-600' : 'text-gray-800'}`}>
                      {p.quantidade ?? 0}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.unidade}</p>
                  </div>
                  {p.alerta && <AlertTriangle size={18} className="text-red-400 shrink-0" />}
                  <ChevronRight size={20} className="text-gray-300 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== ABA: ESTOQUE ATUAL ===== */}
      {aba === 'atual' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {alertas.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-bold text-red-700">
                  Estoque baixo em {alertas.length} produto{alertas.length > 1 ? 's' : ''}
                </p>
                <p className="text-red-600 text-sm mt-1">{alertas.map(a => a.nome).join(', ')}</p>
              </div>
            </div>
          )}

          {estoque.map(item => (
            <div key={item.id}
              className={`bg-white rounded-2xl border-2 p-4 flex items-center justify-between ${
                item.alerta ? 'border-red-200' : 'border-gray-100'
              }`}>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-800 truncate">{item.nome}</p>
                <p className="text-sm text-gray-400">{item.categoria || 'Sem categoria'}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Mínimo: {item.quantidade_minima} {item.unidade}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className={`text-3xl font-extrabold leading-none ${item.alerta ? 'text-red-600' : 'text-gray-800'}`}>
                  {item.quantidade ?? 0}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{item.unidade}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${
                  item.alerta
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {item.alerta ? 'Baixo' : 'OK'}
                </span>
              </div>
            </div>
          ))}

          {estoque.length === 0 && (
            <div className="text-center py-16 text-gray-400">Nenhum produto cadastrado</div>
          )}
        </div>
      )}

      {/* ===== ABA: HISTÓRICO ===== */}
      {aba === 'historico' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {movimentacoes.length === 0 && (
            <div className="text-center py-16 text-gray-400">Nenhuma movimentação registrada</div>
          )}
          {movimentacoes.map(m => (
            <div key={m.id}
              className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                m.tipo === 'entrada' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {m.tipo === 'entrada'
                  ? <ArrowUp size={22} className="text-green-600" />
                  : <ArrowDown size={22} className="text-red-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 truncate">{m.produto_nome}</p>
                <p className="text-xs text-gray-400">{m.data}</p>
                {m.observacao && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{m.observacao}</p>
                )}
              </div>
              <p className={`font-extrabold text-xl shrink-0 ${
                m.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'
              }`}>
                {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ===== PAINEL DE QUANTIDADE (bottom sheet) ===== */}
      {produtoSel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end md:items-center md:justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-sm md:rounded-3xl rounded-t-3xl shadow-2xl">

            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Info do produto */}
            <div className="px-5 pt-4 pb-3 flex items-start justify-between">
              <div>
                <p className="text-xl font-extrabold text-gray-800 leading-tight">{produtoSel.nome}</p>
                <p className="text-sm text-gray-400">{produtoSel.categoria || 'Sem categoria'}</p>
                <p className="text-sm text-gray-600 mt-1.5">
                  Estoque atual:{' '}
                  <span className={`font-extrabold ${produtoSel.alerta ? 'text-red-600' : 'text-gray-800'}`}>
                    {produtoSel.quantidade ?? 0} {produtoSel.unidade}
                  </span>
                  {produtoSel.alerta && (
                    <span className="ml-2 text-xs text-red-500 font-semibold">⚠️ Baixo</span>
                  )}
                </p>
              </div>
              <button onClick={fecharPainel}
                className="p-2 bg-gray-100 rounded-xl text-gray-500 shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Toggle Entrada / Saída */}
            <div className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTipoMov('entrada')}
                  className={`py-3 rounded-2xl font-bold text-base transition-colors ${
                    tipoMov === 'entrada'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  ⬆️ Entrada
                </button>
                <button
                  onClick={() => setTipoMov('saida')}
                  className={`py-3 rounded-2xl font-bold text-base transition-colors ${
                    tipoMov === 'saida'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  ⬇️ Saída
                </button>
              </div>
            </div>

            {/* Display da quantidade */}
            <div className="px-5 pb-4">
              <div className={`rounded-2xl p-5 text-center transition-colors ${
                tipoMov === 'entrada' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
                  Quantidade a {tipoMov === 'entrada' ? 'adicionar' : 'retirar'}
                </p>
                <p className={`text-6xl font-extrabold leading-none ${
                  tipoMov === 'entrada' ? 'text-green-700' : 'text-red-600'
                }`}>
                  {quantidade}
                </p>
                <p className="text-sm text-gray-400 mt-1">{produtoSel.unidade}</p>
              </div>
            </div>

            {/* Botões rápidos */}
            <div className="px-5 pb-2">
              <div className="flex gap-2">
                {QTDS_RAPIDAS.map(n => (
                  <button
                    key={n}
                    onClick={() => adicionarQtd(n)}
                    className="flex-1 bg-orange-100 active:bg-orange-200 text-orange-700 font-extrabold py-4 rounded-2xl text-lg transition-colors"
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            {/* Zerar */}
            <div className="px-5 pb-3 text-center">
              <button
                onClick={() => setQuantidade(0)}
                className="text-gray-400 text-sm font-semibold py-1 px-4"
              >
                Zerar
              </button>
            </div>

            {/* Botão confirmar */}
            <div className="px-5 pb-7">
              <button
                onClick={confirmar}
                disabled={quantidade <= 0 || salvando}
                className={`w-full py-5 rounded-2xl font-extrabold text-xl transition-colors disabled:opacity-40 ${
                  tipoMov === 'entrada'
                    ? 'bg-green-600 active:bg-green-700 text-white'
                    : 'bg-red-500 active:bg-red-600 text-white'
                }`}
              >
                {salvando
                  ? 'Salvando...'
                  : tipoMov === 'entrada'
                    ? '✅  CONFIRMAR ENTRADA'
                    : '❌  CONFIRMAR SAÍDA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
