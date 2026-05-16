import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingBag, DollarSign,
  CreditCard, Smartphone, BookOpen, Minus
} from 'lucide-react';
import api from '../api';

/* ─── Utilitários de data ─────────────────────────────────────── */
const fmt    = v  => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = v  => (v || 0).toLocaleString('pt-BR');

function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function somarDias(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dataLocal(d);
}

function diffDias(de, ate) {
  return Math.round((new Date(ate) - new Date(de)) / 86400000);
}

// Segunda-feira da semana atual
function inicioSemanaAtual() {
  const d = new Date();
  const dow = d.getDay(); // 0=dom
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return dataLocal(d);
}

// Primeiro dia do mês atual
function inicioMesAtual() {
  const d = new Date();
  d.setDate(1);
  return dataLocal(d);
}

// Abreviação do dia da semana + número do dia
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function labelDia(dateStr) {
  const [a, m, dia] = dateStr.split('-').map(Number);
  const d = new Date(a, m - 1, dia);
  return `${DIAS[d.getDay()]} ${dia}`;
}

// Variação percentual com seta
function Variacao({ atual, anterior, inverso = false }) {
  if (!anterior || anterior === 0) return <span className="text-xs text-gray-400">—</span>;
  const pct  = ((atual - anterior) / anterior) * 100;
  const sobe = inverso ? pct < 0 : pct > 0;
  const Icon = pct === 0 ? Minus : sobe ? TrendingUp : TrendingDown;
  const cor  = pct === 0 ? 'text-gray-400' : sobe ? 'text-green-600' : 'text-red-500';
  return (
    <span className={`flex items-center gap-0.5 text-xs font-bold ${cor}`}>
      <Icon size={12} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ─── Tooltip customizado para o gráfico ──────────────────────── */
function TooltipFmt({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─── Períodos predefinidos ───────────────────────────────────── */
const PERIODOS = [
  { key: 'semana', label: '📅 Esta Semana' },
  { key: 'mes',    label: '🗓 Este Mês'    },
  { key: 'custom', label: '✏️ Personalizado' },
];

/* ═══════════════════════════════════════════════════════════════ */
export default function Relatorios() {
  const [periodo,    setPeriodo]    = useState('semana');
  const [inicio,     setInicio]     = useState(inicioSemanaAtual());
  const [fim,        setFim]        = useState(dataLocal());
  const [resumo,     setResumo]     = useState(null);
  const [anterior,   setAnterior]   = useState(null);
  const [porDia,     setPorDia]     = useState([]);
  const [carregando, setCarregando] = useState(true);

  /* Ao trocar período predefinido, ajusta as datas */
  const selecionarPeriodo = (key) => {
    setPeriodo(key);
    const hoje = dataLocal();
    if (key === 'semana') { setInicio(inicioSemanaAtual()); setFim(hoje); }
    if (key === 'mes')    { setInicio(inicioMesAtual());    setFim(hoje); }
  };

  /* Carrega período atual + período anterior (mesmo tamanho) */
  const carregar = async () => {
    setCarregando(true);
    try {
      const dias   = diffDias(inicio, fim);
      const antFim = somarDias(inicio, -1);
      const antIni = somarDias(antFim, -dias);

      const [rResumo, rAnterior, rPorDia] = await Promise.all([
        api.get(`/relatorios/resumo?inicio=${inicio}&fim=${fim}`),
        api.get(`/relatorios/resumo?inicio=${antIni}&fim=${antFim}`),
        api.get(`/relatorios/periodo?inicio=${inicio}&fim=${fim}`),
      ]);

      setResumo(rResumo.data);
      setAnterior(rAnterior.data);
      // Formata rótulos do gráfico
      setPorDia(rPorDia.data.map(d => ({ ...d, label: labelDia(d.dia) })));
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [inicio, fim]);

  const PAG_CFG = {
    dinheiro: { label: 'Dinheiro', icon: DollarSign,  cor: 'bg-green-100 text-green-700'  },
    pix:      { label: 'PIX',      icon: Smartphone,  cor: 'bg-blue-100 text-blue-700'    },
    cartao:   { label: 'Cartão',   icon: CreditCard,  cor: 'bg-purple-100 text-purple-700'},
    fiado:    { label: 'Fiado',    icon: BookOpen,    cor: 'bg-orange-100 text-orange-700'},
  };

  const fatAtual = resumo?.vendas?.faturamento     ?? 0;
  const fatAnt   = anterior?.vendas?.faturamento   ?? 0;
  const vndAtual = resumo?.vendas?.total_vendas    ?? 0;
  const vndAnt   = anterior?.vendas?.total_vendas  ?? 0;
  const tckAtual = resumo?.ticketMedio             ?? 0;
  const tckAnt   = anterior?.ticketMedio           ?? 0;

  const labelPeriodo = periodo === 'semana' ? 'semana passada'
                     : periodo === 'mes'    ? 'mês passado'
                     : 'período anterior';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Relatórios</h2>
        <p className="text-gray-400 text-sm">Desempenho da padaria</p>
      </div>

      {/* ── Seletor de período ── */}
      <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => selecionarPeriodo(p.key)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                periodo === p.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Datas personalizadas */}
        {periodo === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date"
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              value={inicio} onChange={e => setInicio(e.target.value)} />
            <span className="text-gray-400 font-semibold">até</span>
            <input type="date"
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        )}

        {/* Resumo do período selecionado */}
        <p className="text-xs text-gray-400 font-semibold">
          {new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          {' → '}
          {new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {carregando && (
        <div className="text-center py-16 text-gray-400 text-lg">Carregando...</div>
      )}

      {!carregando && resumo && (
        <>
          {/* ── Cards de comparativo ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Faturamento', atual: fatAtual, ant: fatAnt, fmt: fmt,    icon: DollarSign  },
              { label: 'Vendas',      atual: vndAtual, ant: vndAnt, fmt: fmtNum, icon: ShoppingBag },
              { label: 'Ticket Médio',atual: tckAtual, ant: tckAnt, fmt: fmt,    icon: TrendingUp  },
            ].map(({ label, atual, ant, fmt: f, icon: Icon }) => (
              <div key={label} className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-center">
                <Icon size={18} className="text-orange-500 mx-auto mb-1" />
                <p className="text-xs text-gray-400 font-semibold uppercase truncate">{label}</p>
                <p className="font-extrabold text-gray-800 text-lg leading-tight mt-1">{f(atual)}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Variacao atual={atual} anterior={ant} />
                  <span className="text-xs text-gray-400">vs {labelPeriodo}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Gráfico de barras ── */}
          {porDia.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <h3 className="font-extrabold text-gray-700 mb-1">Faturamento por dia</h3>
              <p className="text-xs text-gray-400 mb-4">Toque na barra para ver o valor</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<TooltipFmt />} cursor={{ fill: '#fff7ed' }} />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#f97316" radius={[6,6,0,0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {resumo.vendas.total_vendas === 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-12 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-semibold text-lg">Nenhuma venda no período</p>
              <p className="text-gray-400 text-sm mt-1">Tente selecionar outro período</p>
            </div>
          )}

          {resumo.vendas.total_vendas > 0 && (
            <>
              {/* ── Por forma de pagamento ── */}
              {resumo.porPagamento.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                  <h3 className="font-extrabold text-gray-700 mb-4">Por forma de pagamento</h3>
                  <div className="space-y-3">
                    {resumo.porPagamento.map(p => {
                      const cfg = PAG_CFG[p.forma_pagamento] ?? { label: p.forma_pagamento, icon: DollarSign, cor: 'bg-gray-100 text-gray-600' };
                      const Icon = cfg.icon;
                      const pct  = fatAtual > 0 ? Math.round((p.valor / fatAtual) * 100) : 0;
                      return (
                        <div key={p.forma_pagamento}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.cor}`}>
                                <Icon size={16} />
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-sm">{cfg.label}</p>
                                <p className="text-xs text-gray-400">{p.qtd} venda{p.qtd !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-extrabold text-gray-800">{fmt(p.valor)}</p>
                              <p className="text-xs text-gray-400">{pct}%</p>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-2 bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Mais vendidos ── */}
              {resumo.maisPedidos.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                  <h3 className="font-extrabold text-gray-700 mb-4">Produtos mais vendidos</h3>
                  <div className="space-y-3">
                    {resumo.maisPedidos.map((p, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 bg-orange-100 text-orange-700 text-sm font-extrabold rounded-full flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <p className="font-semibold text-gray-800 truncate">{p.nome_produto}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-bold text-gray-800">{fmt(p.total)}</p>
                          <p className="text-xs text-gray-400">{p.qtd_vendida} un</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Vendas por hora ── */}
              {resumo.vendasPorHora.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                  <h3 className="font-extrabold text-gray-700 mb-1">Horários de pico</h3>
                  <p className="text-xs text-gray-400 mb-4">Quantidade de vendas por hora</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={resumo.vendasPorHora} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="hora" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                        tickFormatter={h => `${h}h`} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip labelFormatter={h => `${h}h`} formatter={v => [`${v} vendas`, 'Qtd']} />
                      <Line type="monotone" dataKey="qtd" stroke="#f97316" strokeWidth={2.5}
                        dot={{ fill: '#f97316', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
