import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, TrendingUp, DollarSign, Smartphone, CreditCard,
  AlertTriangle, Package, CalendarCheck, RefreshCw, Clock, ChevronRight
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dataExtenso() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const STATUS_CFG = {
  pendente:  { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-800' },
  pronto:    { label: 'Pronto',    cor: 'bg-blue-100 text-blue-800'     },
  entregue:  { label: 'Entregue', cor: 'bg-green-100 text-green-800'   },
  cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-500'    },
};

export default function Dashboard() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();

  const [vendas,      setVendas]      = useState(null);
  const [estoque,     setEstoque]     = useState([]);
  const [encomendas,  setEncomendas]  = useState([]);
  const [carregando,  setCarregando]  = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    const hoje = dataLocal();
    try {
      const [rVendas, rEstoque, rEncomendas] = await Promise.all([
        api.get(`/relatorios/fechamento?data=${hoje}`),
        api.get('/estoque'),
        api.get(`/encomendas?de=${hoje}&ate=${hoje}`),
      ]);
      setVendas(rVendas.data);
      setEstoque(rEstoque.data.filter(i => i.alerta));
      setEncomendas(rEncomendas.data.filter(e => e.status !== 'cancelado' && e.status !== 'entregue'));
      setAtualizadoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // silencioso — pode estar iniciando
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const totais       = vendas?.totais        ?? {};
  const porPagamento = vendas?.porPagamento  ?? [];
  const ticketMedio  = totais.total_vendas > 0 ? totais.faturamento / totais.total_vendas : 0;

  const getPag = (forma) => porPagamento.find(p => p.forma_pagamento === forma);
  const dinheiro = getPag('dinheiro');
  const pix      = getPag('pix');
  const cartao   = getPag('cartao');

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-orange-600 text-white px-5 pt-6 pb-8 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-orange-200 text-sm font-semibold capitalize">{dataExtenso()}</p>
            <h1 className="text-2xl font-extrabold mt-0.5">
              {saudacao()}, {usuario?.nome?.split(' ')[0]}! 👋
            </h1>
            <p className="text-orange-200 text-sm mt-1">Resumo do dia da padaria</p>
          </div>
          <button onClick={carregar} disabled={carregando}
            className="bg-orange-500 hover:bg-orange-400 p-2.5 rounded-xl mt-1">
            <RefreshCw size={18} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Faturamento destaque */}
        <div className="mt-5 bg-orange-500/50 rounded-2xl p-4">
          <p className="text-orange-200 text-xs font-bold uppercase tracking-wide">Faturamento hoje</p>
          <p className="text-4xl font-extrabold mt-1">
            {carregando ? '...' : fmt(totais.faturamento)}
          </p>
          <div className="flex gap-4 mt-2 text-orange-100 text-sm">
            <span className="flex items-center gap-1">
              <ShoppingCart size={14} />
              {totais.total_vendas ?? 0} venda{totais.total_vendas !== 1 ? 's' : ''}
            </span>
            {totais.total_vendas > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp size={14} />
                Ticket: {fmt(ticketMedio)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4 pb-6">

        {/* ── Formas de pagamento ── */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-3">Por pagamento</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { dados: dinheiro, icon: DollarSign, label: 'Dinheiro', cor: 'bg-green-100 text-green-700'  },
              { dados: pix,      icon: Smartphone, label: 'PIX',      cor: 'bg-blue-100 text-blue-700'    },
              { dados: cartao,   icon: CreditCard, label: 'Cartão',   cor: 'bg-purple-100 text-purple-700'},
            ].map(({ dados, icon: Icon, label, cor }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${cor}`}>
                <Icon size={20} className="mx-auto mb-1 opacity-80" />
                <p className="font-extrabold text-base">{fmt(dados?.valor)}</p>
                <p className="text-xs font-semibold opacity-70">{label}</p>
                <p className="text-xs opacity-60">{dados?.qtd ?? 0}x</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ir para o Caixa ── */}
        <button
          onClick={() => navigate('/caixa')}
          className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-2xl p-4 flex items-center justify-between font-extrabold text-lg shadow-md"
        >
          <div className="flex items-center gap-3">
            <ShoppingCart size={24} />
            <span>Abrir Caixa</span>
          </div>
          <ChevronRight size={22} />
        </button>

        {/* ── Encomendas de hoje ── */}
        {encomendas.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-orange-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck size={18} className="text-orange-600" />
                <p className="font-extrabold text-gray-800">
                  Encomendas para hoje
                </p>
              </div>
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {encomendas.length}
              </span>
            </div>
            <div className="space-y-2">
              {encomendas.map(enc => {
                const cfg = STATUS_CFG[enc.status] ?? STATUS_CFG.pendente;
                return (
                  <div key={enc.id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl p-3 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 truncate">{enc.cliente_nome}</p>
                      <p className="text-xs text-gray-500 truncate">{enc.descricao}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.cor}`}>
                        {cfg.label}
                      </span>
                      {enc.hora_entrega && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-end gap-0.5">
                          <Clock size={10} /> {enc.hora_entrega}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => navigate('/encomendas')}
              className="w-full mt-3 text-orange-600 font-bold text-sm py-2 border-2 border-orange-200 rounded-xl hover:bg-orange-50"
            >
              Ver todas as encomendas
            </button>
          </div>
        )}

        {/* ── Estoque baixo ── */}
        {estoque.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-red-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-red-500" />
              <p className="font-extrabold text-gray-800">Estoque baixo</p>
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                {estoque.length} produto{estoque.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {estoque.slice(0, 5).map(item => (
                <div key={item.id}
                  className="flex items-center justify-between bg-red-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package size={14} className="text-red-400 shrink-0" />
                    <p className="font-semibold text-gray-800 text-sm truncate">{item.nome}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-extrabold text-red-600 text-sm">{item.quantidade ?? 0}</span>
                    <span className="text-xs text-gray-400 ml-1">{item.unidade}</span>
                  </div>
                </div>
              ))}
              {estoque.length > 5 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{estoque.length - 5} mais com estoque baixo
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/estoque')}
              className="w-full mt-3 text-red-600 font-bold text-sm py-2 border-2 border-red-200 rounded-xl hover:bg-red-50"
            >
              Repor estoque
            </button>
          </div>
        )}

        {/* ── Sem movimento no dia ── */}
        {!carregando && (totais.total_vendas ?? 0) === 0 && encomendas.length === 0 && estoque.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-8 text-center">
            <p className="text-4xl mb-3">☕</p>
            <p className="font-bold text-gray-600">Nenhuma movimentação ainda hoje</p>
            <p className="text-gray-400 text-sm mt-1">As vendas aparecerão aqui conforme forem registradas</p>
          </div>
        )}

        {/* Atualizado em */}
        {atualizadoEm && (
          <p className="text-center text-xs text-gray-400 pb-2">
            Atualizado às {atualizadoEm} · toque em 🔄 para atualizar
          </p>
        )}
      </div>
    </div>
  );
}
