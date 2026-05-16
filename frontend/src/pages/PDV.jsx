import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Minus, X, ShoppingBag, Printer, CheckCircle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CAT = {
  Paes:     { emoji: '🥖', bg: 'bg-amber-100',  border: 'border-amber-300',  texto: 'text-amber-900',  preco: 'text-amber-700'  },
  Bolos:    { emoji: '🎂', bg: 'bg-pink-100',   border: 'border-pink-300',   texto: 'text-pink-900',   preco: 'text-pink-700'   },
  Salgados: { emoji: '🥐', bg: 'bg-orange-100', border: 'border-orange-300', texto: 'text-orange-900', preco: 'text-orange-700' },
  Bebidas:  { emoji: '🥤', bg: 'bg-blue-100',   border: 'border-blue-300',   texto: 'text-blue-900',   preco: 'text-blue-700'   },
  Doces:    { emoji: '🍬', bg: 'bg-purple-100', border: 'border-purple-300', texto: 'text-purple-900', preco: 'text-purple-700' },
  Outros:   { emoji: '🛒', bg: 'bg-gray-100',   border: 'border-gray-300',   texto: 'text-gray-800',   preco: 'text-gray-600'   },
};
const getCat = (nome) => CAT[nome] ?? CAT.Outros;

// Normaliza texto: minusculo + sem acento — permite buscar "pao" e achar "Pão"
const norm = str => (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ─── Painel do carrinho definido FORA do PDV para nao recriar a cada render ───
function PainelCarrinho({ carrinho, clientes, clienteId, setClienteId, formaPagamento, setFormaPagamento,
  fiado, setFiado, valorPago, setValorPago, total, valorPagoNum, troco, qtdItens,
  alterarQtd, finalizar, finalizando, fechar }) {

  return (
    <div className="flex flex-col h-full">
      {/* Cabecalho */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <ShoppingBag className="text-orange-600" size={22} />
        <span className="font-bold text-gray-800 text-lg">Carrinho</span>
        <span className="ml-auto bg-orange-100 text-orange-700 text-sm font-bold px-2 py-0.5 rounded-full">{qtdItens}</span>
        {fechar && (
          <button onClick={fechar} className="p-2 rounded-xl bg-gray-100 ml-2">
            <ChevronDown size={20} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Itens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {carrinho.length === 0 && (
          <div className="text-center mt-10">
            <p className="text-5xl mb-3">🛒</p>
            <p className="text-gray-400">Adicione produtos ao carrinho</p>
          </div>
        )}
        {carrinho.map(item => {
          const cid = item.cart_id || item.produto_id;
          return (
            <div key={cid} className={`border rounded-xl p-3 ${item.por_peso ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-bold text-gray-800 flex-1 leading-tight">{item.nome}</p>
                <button onClick={() => alterarQtd(cid, -item.quantidade)} className="text-gray-400 hover:text-red-500 p-0.5">
                  <X size={15} />
                </button>
              </div>
              {item.por_peso ? (
                // Item pesado: mostra kg e preco/kg, sem botoes +/-
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-blue-600 font-semibold">
                    ⚖ {(item.quantidade * 1000).toFixed(0)}g × {fmt(item.preco_unitario)}/kg
                  </span>
                  <span className="font-extrabold text-blue-700">{fmt(item.subtotal)}</span>
                </div>
              ) : (
                // Item normal: botoes +/-
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => alterarQtd(cid, -1)}
                      className="w-9 h-9 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center hover:border-orange-400 font-bold active:scale-95">
                      <Minus size={16} />
                    </button>
                    <span className="text-base font-extrabold w-7 text-center">{item.quantidade}</span>
                    <button onClick={() => alterarQtd(cid, 1)}
                      className="w-9 h-9 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center hover:border-orange-400 font-bold active:scale-95">
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="font-extrabold text-orange-600">{fmt(item.subtotal)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rodape */}
      <div className="p-4 border-t border-gray-100 space-y-3 shrink-0">
        {/* Cliente */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Cliente (opcional)</label>
          <select
            className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
          >
            <option value="">Sem cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        {/* Total */}
        <div className="flex justify-between font-extrabold text-2xl border-t-2 border-dashed border-gray-200 pt-2">
          <span>TOTAL</span>
          <span className="text-orange-600">{fmt(total)}</span>
        </div>

        {/* Pagamento */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Pagamento</label>
          <div className="grid grid-cols-2 gap-2">
            {[['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartao'], ['pix', '📱 PIX']].map(([v, l]) => (
              <button key={v}
                onClick={() => { setFormaPagamento(v); setFiado(false); }}
                className={`py-3 text-sm rounded-xl font-bold transition-colors active:scale-95 ${
                  !fiado && formaPagamento === v ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                {l}
              </button>
            ))}
            {clienteId && (
              <button
                onClick={() => setFiado(!fiado)}
                className={`py-3 text-sm rounded-xl font-bold transition-colors active:scale-95 ${
                  fiado ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                📒 Fiado
              </button>
            )}
          </div>
        </div>

        {/* Valor recebido */}
        {!fiado && formaPagamento === 'dinheiro' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase block">Valor recebido</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-2xl font-extrabold text-center focus:outline-none focus:border-orange-500 tracking-wide"
              placeholder="0,00"
              value={valorPago}
              onChange={e => setValorPago(e.target.value.replace(/[^0-9.,]/g, ''))}
            />
          </div>
        )}

        {/* Troco */}
        {!fiado && formaPagamento === 'dinheiro' && valorPagoNum > 0 && (
          <div className="bg-green-50 rounded-xl p-4 flex justify-between font-extrabold text-xl text-green-700">
            <span>Troco</span>
            <span>{fmt(troco)}</span>
          </div>
        )}

        {/* Finalizar */}
        <button
          onClick={finalizar}
          disabled={finalizando || carrinho.length === 0}
          className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xl py-4 rounded-2xl transition-colors"
        >
          {finalizando ? 'Processando...' : 'FINALIZAR VENDA'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PDV() {
  const { usuario } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [valorPago, setValorPago] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [fiado, setFiado] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [produtoSel, setProdutoSel] = useState(null);
  const [qtdSel, setQtdSel] = useState(1);
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [pesagemSel, setPesagemSel]   = useState(null); // produto sendo pesado
  const [pesoDigitado, setPesoDigitado] = useState(''); // gramas digitadas
  const cupomRef = useRef();

  useEffect(() => {
    api.get('/produtos').then(r => setProdutos(r.data)).catch(() => toast.error('Erro ao carregar produtos'));
    api.get('/clientes').then(r => setClientes(r.data)).catch(() => {});
  }, []);

  // Categorias disponíveis para os botões de filtro
  const categoriasDisponiveis = [...new Set(produtos.map(p => p.categoria_nome).filter(Boolean))];

  const produtosFiltrados = produtos.filter(p => {
    const matchBusca = !busca || norm(p.nome).includes(norm(busca));
    const matchCat   = !categoriaFiltro || p.categoria_nome === categoriaFiltro;
    return matchBusca && matchCat;
  });

  // "Mais Pedidos": top 8 mais vendidos — só aparece sem filtro ativo
  const maisVendidos = (busca || categoriaFiltro)
    ? []
    : produtosFiltrados.filter(p => (p.total_vendido || 0) > 0).slice(0, 8);

  const todosProdutos = produtosFiltrados;

  // Produto é "por peso" se tiver o flag OR se a unidade for kg
  const ePorPeso = (p) => !!(p.por_peso || p.unidade === 'kg');

  const handleProduto = (produto) => {
    if (ePorPeso(produto)) {
      // Sempre abre o teclado de peso, em qualquer tamanho de tela
      setPesagemSel(produto);
      setPesoDigitado('');
    } else if (window.innerWidth < 768) {
      setProdutoSel(produto);
      setQtdSel(1);
    } else {
      adicionarAoCarrinho(produto, 1);
    }
  };

  const adicionarAoCarrinho = (produto, qtd = 1) => {
    setCarrinho(prev => {
      const existente = prev.find(i => i.produto_id === produto.id && !i.por_peso);
      if (existente) {
        const novaQtd = existente.quantidade + qtd;
        return prev.map(i => (i.produto_id === produto.id && !i.por_peso)
          ? { ...i, quantidade: novaQtd, subtotal: novaQtd * i.preco_unitario }
          : i
        );
      }
      return [...prev, {
        cart_id: produto.id,          // itens normais usam produto_id como cart_id
        produto_id: produto.id,
        nome: produto.nome,
        preco_unitario: produto.preco_venda,
        quantidade: qtd,
        subtotal: produto.preco_venda * qtd,
        por_peso: false,
      }];
    });
    if (navigator.vibrate) navigator.vibrate(40);
  };

  // Adiciona produto pesado na balança ao carrinho
  const adicionarPorPeso = () => {
    const gramas = parseInt(pesoDigitado);
    if (!gramas || gramas <= 0) return toast.error('Digite o peso em gramas');
    const kg = gramas / 1000;
    const subtotal = Number((pesagemSel.preco_venda * kg).toFixed(2));
    setCarrinho(prev => [...prev, {
      cart_id: `${pesagemSel.id}_${Date.now()}`,  // único por pesagem
      produto_id: pesagemSel.id,
      nome: `${pesagemSel.nome} (${gramas}g)`,
      preco_unitario: pesagemSel.preco_venda,
      quantidade: kg,
      subtotal,
      por_peso: true,
    }]);
    if (navigator.vibrate) navigator.vibrate(40);
    setPesagemSel(null);
    setPesoDigitado('');
  };

  const confirmarAdicao = () => {
    adicionarAoCarrinho(produtoSel, qtdSel);
    setProdutoSel(null);
  };

  const alterarQtd = (cartId, delta) => {
    setCarrinho(prev => prev
      .map(i => (i.cart_id || i.produto_id) === cartId
        ? { ...i, quantidade: i.quantidade + delta, subtotal: (i.quantidade + delta) * i.preco_unitario }
        : i)
      .filter(i => i.quantidade > 0)
    );
  };

  const total = carrinho.reduce((s, i) => s + i.subtotal, 0);
  const valorPagoNum = parseFloat(String(valorPago).replace(',', '.')) || 0;
  const troco = Math.max(0, valorPagoNum - total);
  const qtdItens = carrinho.reduce((s, i) => s + (i.por_peso ? 1 : i.quantidade), 0);

  const finalizar = async () => {
    if (carrinho.length === 0) return toast.error('Adicione produtos ao carrinho');
    if (formaPagamento === 'dinheiro' && !fiado && valorPagoNum < total) return toast.error('Valor pago insuficiente');
    if (fiado && !clienteId) return toast.error('Selecione o cliente para fiado');

    setFinalizando(true);
    try {
      const res = await api.post('/vendas', {
        itens: carrinho,
        forma_pagamento: fiado ? 'fiado' : formaPagamento,
        valor_pago: fiado ? 0 : (valorPagoNum || total),
        desconto: 0,
        cliente_id: clienteId || null,
        usuario_id: usuario.id,
      });

      if (fiado && clienteId) {
        await api.post('/fiado/lancar', {
          cliente_id: parseInt(clienteId),
          valor: total,
          tipo: 'debito',
          descricao: `Venda #${res.data.id}`,
          usuario_id: usuario.id,
          venda_id: res.data.id,
        });
      }

      const clienteNome = clienteId ? clientes.find(c => c.id === parseInt(clienteId))?.nome : null;
      setVendaFinalizada({ ...res.data, troco, itens: carrinho, total, forma: fiado ? 'fiado' : formaPagamento, clienteNome });
      setCarrinhoAberto(false);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao finalizar venda');
    } finally {
      setFinalizando(false);
    }
  };

  const novaVenda = () => {
    setCarrinho([]); setValorPago(''); setFormaPagamento('dinheiro');
    setClienteId(''); setFiado(false); setVendaFinalizada(null); setCarrinhoAberto(false);
  };

  const imprimirCupom = () => {
    const conteudo = cupomRef.current.innerHTML;
    const janela = window.open('', '_blank', 'width=400,height=600');
    janela.document.write(`
      <html><head><title>Cupom</title>
      <style>
        body{font-family:monospace;font-size:13px;width:300px;margin:0 auto;padding:10px}
        .centro{text-align:center}.linha{border-top:1px dashed #000;margin:8px 0}
        .row{display:flex;justify-content:space-between;margin:3px 0}
        .negrito{font-weight:bold}.grande{font-size:18px;font-weight:bold}
      </style></head>
      <body onload="window.print();window.close();">${conteudo}</body></html>
    `);
    janela.document.close();
  };

  // Props compartilhadas para o painel do carrinho
  const painelProps = {
    carrinho, clientes, clienteId, setClienteId,
    formaPagamento, setFormaPagamento,
    fiado, setFiado,
    valorPago, setValorPago,
    total, valorPagoNum, troco, qtdItens,
    alterarQtd, finalizar, finalizando,
  };

  // ── Tela venda finalizada ──────────────────────────────────────────
  if (vendaFinalizada) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-green-50">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-8 text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={72} />
          <h2 className="text-3xl font-extrabold text-gray-800 mb-1">VENDA FEITA!</h2>
          <p className="text-gray-500 mb-6">Venda #{vendaFinalizada.id}</p>

          <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-left">
            {vendaFinalizada.itens.map(i => (
              <div key={i.cart_id || i.produto_id} className="flex justify-between text-sm py-1">
                <span>{i.nome}{!i.por_peso ? ` x${i.quantidade}` : ''}</span>
                <span className="font-semibold">{fmt(i.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-gray-300 mt-2 pt-2 flex justify-between font-extrabold text-xl">
              <span>TOTAL</span><span className="text-orange-600">{fmt(vendaFinalizada.total)}</span>
            </div>
          </div>

          {vendaFinalizada.forma === 'dinheiro' && vendaFinalizada.troco > 0 && (
            <div className="bg-green-100 rounded-2xl p-4 mb-4">
              <p className="text-green-700 font-semibold">Troco</p>
              <p className="text-green-700 text-4xl font-extrabold">{fmt(vendaFinalizada.troco)}</p>
            </div>
          )}

          {vendaFinalizada.forma === 'fiado' && (
            <div className="bg-orange-100 rounded-2xl p-4 mb-4">
              <p className="text-orange-700 font-semibold">Lancado no fiado</p>
              <p className="text-orange-700 font-bold">{vendaFinalizada.clienteNome}</p>
            </div>
          )}

          <div ref={cupomRef} style={{ display: 'none' }}>
            <div className="centro negrito grande">PADARIA</div>
            <div className="centro">Cupom nao fiscal</div>
            <div className="linha" />
            {vendaFinalizada.itens.map(i => (
              <div key={i.cart_id || i.produto_id} className="row">
                <span>{i.nome}{!i.por_peso ? ` x${i.quantidade}` : ''}</span><span>{fmt(i.subtotal)}</span>
              </div>
            ))}
            <div className="linha" />
            <div className="row negrito grande"><span>TOTAL</span><span>{fmt(vendaFinalizada.total)}</span></div>
            {vendaFinalizada.forma === 'dinheiro' && <div className="row"><span>Troco</span><span>{fmt(vendaFinalizada.troco)}</span></div>}
            {vendaFinalizada.forma === 'fiado' && <div className="centro negrito">FIADO - {vendaFinalizada.clienteNome}</div>}
            <div className="linha" />
            <div className="centro">Obrigado pela preferencia!</div>
          </div>

          <div className="flex gap-3">
            <button onClick={imprimirCupom} className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50">
              <Printer size={20} /> Imprimir
            </button>
            <button onClick={novaVenda} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl font-bold">
              Nova Venda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Layout principal ───────────────────────────────────────────────
  return (
    <div className="flex h-full relative">

      {/* Produtos */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Busca + filtros de categoria */}
        <div className="bg-white border-b border-gray-100 shrink-0">
          {/* Campo de busca */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                className="w-full pl-10 pr-10 py-3 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-orange-500"
                placeholder="Buscar produto..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setCategoriaFiltro(''); }}
              />
              {busca && (
                <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Botões de categoria */}
          <div className="flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-hide">
            {/* Todos */}
            <button
              onClick={() => { setCategoriaFiltro(''); setBusca(''); }}
              className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                !categoriaFiltro && !busca
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              Todos
            </button>

            {/* Uma categoria por botão */}
            {categoriasDisponiveis.map(cat => {
              const cfg = getCat(cat);
              const ativo = categoriaFiltro === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setCategoriaFiltro(ativo ? '' : cat); setBusca(''); }}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-colors ${
                    ativo
                      ? `${cfg.bg} ${cfg.border} ${cfg.texto}`
                      : 'bg-gray-100 border-transparent text-gray-600 active:bg-gray-200'
                  }`}
                >
                  {cfg.emoji} {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade de produtos */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">

          {todosProdutos.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-lg">Nenhum produto encontrado</p>
          )}

          {/* ── Mais Pedidos ── */}
          {maisVendidos.length > 0 && (
            <div>
              <p className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mb-2 px-1">
                ⭐ Mais Pedidos
              </p>
              <div className="grid grid-cols-2 gap-3">
                {maisVendidos.map(p => {
                  const cat = getCat(p.categoria_nome);
                  return (
                    <button key={`mv-${p.id}`} onClick={() => handleProduto(p)}
                      className={`${cat.bg} border-2 ${cat.border} rounded-2xl p-4 text-left active:scale-95 active:brightness-90 transition-all select-none shadow-sm`}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-3xl">{cat.emoji}</span>
                        <span className="text-xs font-bold bg-white/70 text-gray-500 px-1.5 py-0.5 rounded-full">
                          {p.total_vendido}x
                        </span>
                      </div>
                      <p className={`font-extrabold text-base leading-tight ${cat.texto}`}>{p.nome}</p>
                      <p className={`font-extrabold text-xl mt-1 ${cat.preco}`}>
                        {fmt(p.preco_venda)}{ePorPeso(p) ? <span className="text-sm font-bold">/kg</span> : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{ePorPeso(p) ? '⚖ balança' : p.unidade}</p>
                      {(p.quantidade ?? 0) <= (p.quantidade_minima ?? 0) && (
                        <span className="text-xs text-red-500 font-semibold block mt-1">⚠ Estoque baixo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Todos os Produtos ── */}
          {todosProdutos.length > 0 && (
            <div>
              {!busca && (
                <p className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mb-2 px-1">
                  📦 Todos os Produtos
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {todosProdutos.map(p => {
                  const cat = getCat(p.categoria_nome);
                  return (
                    <button key={p.id} onClick={() => handleProduto(p)}
                      className={`${cat.bg} border-2 ${cat.border} rounded-2xl p-3 text-left active:scale-95 active:brightness-90 transition-all select-none shadow-sm`}>
                      <div className="text-2xl mb-1.5">{cat.emoji}</div>
                      <p className={`font-extrabold text-base leading-tight line-clamp-2 ${cat.texto}`}>{p.nome}</p>
                      <p className={`font-extrabold text-lg mt-1 ${cat.preco}`}>
                        {fmt(p.preco_venda)}{ePorPeso(p) ? <span className="text-xs font-bold">/kg</span> : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{ePorPeso(p) ? '⚖ balança' : p.unidade}</p>
                      {(p.quantidade ?? 0) <= (p.quantidade_minima ?? 0) && (
                        <span className="text-xs text-red-500 font-semibold block mt-1">⚠ Estoque baixo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Barra carrinho mobile */}
        <div className="md:hidden px-3 pb-3 pt-2 bg-white border-t border-gray-100 shrink-0">
          <button
            onClick={() => setCarrinhoAberto(true)}
            disabled={carrinho.length === 0}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-bold text-white text-base transition-colors ${carrinho.length > 0 ? 'bg-orange-600 active:bg-orange-700' : 'bg-gray-300'}`}
          >
            <div className="flex items-center gap-3">
              <ShoppingBag size={22} />
              <span>{qtdItens > 0 ? `${qtdItens} item${qtdItens > 1 ? 's' : ''}` : 'Carrinho vazio'}</span>
            </div>
            {total > 0 && <span className="text-lg font-extrabold">{fmt(total)}</span>}
          </button>
        </div>
      </div>

      {/* Carrinho desktop */}
      <div className="hidden md:flex w-80 bg-white border-l-2 border-gray-100 flex-col shadow-lg">
        <PainelCarrinho {...painelProps} fechar={null} />
      </div>

      {/* Carrinho mobile (bottom sheet) */}
      {carrinhoAberto && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCarrinhoAberto(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <PainelCarrinho {...painelProps} fechar={() => setCarrinhoAberto(false)} />
          </div>
        </div>
      )}

      {/* ═══ TECLADO DE PESO (balança manual) ══════════════════════════════════ */}
      {pesagemSel && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPesagemSel(null)} />
          <div className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl md:w-96 w-full">

            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Info do produto */}
            <div className="px-6 pt-4 pb-4 border-b border-gray-100 flex items-center gap-4">
              <span className="text-4xl">{getCat(pesagemSel.categoria_nome).emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-gray-800 text-lg leading-tight truncate">{pesagemSel.nome}</p>
                <p className="text-blue-600 font-bold text-base mt-0.5">
                  {fmt(pesagemSel.preco_venda)}<span className="text-sm font-semibold text-blue-500">/kg</span>
                </p>
              </div>
            </div>

            {/* Display do peso */}
            <div className="px-6 py-4 text-center">
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                👀 Olhe a balança e digite o peso em gramas
              </p>
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl py-4 px-6">
                <p className="text-6xl font-extrabold text-gray-800 tracking-wider">
                  {pesoDigitado || '0'}
                  <span className="text-2xl text-gray-400 ml-2">g</span>
                </p>
                {pesoDigitado && parseInt(pesoDigitado) > 0 && (
                  <p className="text-2xl font-extrabold text-blue-600 mt-2">
                    = {fmt(Number((pesagemSel.preco_venda * parseInt(pesoDigitado) / 1000).toFixed(2)))}
                  </p>
                )}
              </div>
            </div>

            {/* Teclado numerico */}
            <div className="px-4 pb-5">
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
                  <button key={n}
                    onClick={() => setPesoDigitado(p => p.length < 5 ? p + String(n) : p)}
                    className="py-5 rounded-2xl bg-gray-100 text-3xl font-extrabold text-gray-800 active:bg-gray-200 active:scale-95 transition-all">
                    {n}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button onClick={() => setPesoDigitado('')}
                  className="py-5 rounded-2xl bg-red-100 text-xl font-extrabold text-red-600 active:bg-red-200 active:scale-95 transition-all">
                  C
                </button>
                <button onClick={() => setPesoDigitado(p => p.length < 5 ? p + '0' : p)}
                  className="py-5 rounded-2xl bg-gray-100 text-3xl font-extrabold text-gray-800 active:bg-gray-200 active:scale-95 transition-all">
                  0
                </button>
                <button onClick={() => setPesoDigitado(p => p.slice(0, -1))}
                  className="py-5 rounded-2xl bg-gray-100 text-2xl font-extrabold text-gray-600 active:bg-gray-200 active:scale-95 transition-all">
                  ⌫
                </button>
              </div>

              <button
                onClick={adicionarPorPeso}
                disabled={!pesoDigitado || parseInt(pesoDigitado) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-2xl py-5 rounded-2xl transition-colors"
              >
                ✓ CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmacao de adicao (mobile) */}
      {produtoSel && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProdutoSel(null)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-5xl">{getCat(produtoSel.categoria_nome).emoji}</div>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-lg leading-tight">{produtoSel.nome}</p>
                <p className="text-orange-600 font-extrabold text-2xl mt-0.5">{fmt(produtoSel.preco_venda)}</p>
                <p className="text-xs text-gray-400">{produtoSel.unidade}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 mb-6">
              <button onClick={() => setQtdSel(q => Math.max(1, q - 1))}
                className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center active:bg-gray-200">
                <Minus size={24} className="text-gray-700" />
              </button>
              <span className="text-4xl font-extrabold text-gray-800 w-12 text-center">{qtdSel}</span>
              <button onClick={() => setQtdSel(q => q + 1)}
                className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center active:bg-orange-200">
                <Plus size={24} className="text-orange-600" />
              </button>
            </div>
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-gray-500 font-semibold">Total</span>
              <span className="text-2xl font-extrabold text-orange-600">{fmt(produtoSel.preco_venda * qtdSel)}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setProdutoSel(null)}
                className="w-14 border-2 border-gray-200 text-gray-500 rounded-2xl flex items-center justify-center active:bg-gray-50">
                <X size={22} />
              </button>
              <button onClick={confirmarAdicao}
                className="flex-1 bg-orange-600 active:bg-orange-800 text-white font-extrabold text-lg py-4 rounded-2xl flex items-center justify-center gap-2">
                <ShoppingBag size={22} /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
