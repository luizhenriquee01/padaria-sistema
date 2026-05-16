import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Smartphone, BookOpen, ShoppingBag, Clock, TrendingUp, Download, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../api';

const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

const ICONES_PAG = {
  dinheiro: { icon: DollarSign, cor: 'bg-green-100 text-green-700', label: 'Dinheiro' },
  pix:      { icon: Smartphone, cor: 'bg-blue-100 text-blue-700',   label: 'PIX'     },
  cartao:   { icon: CreditCard, cor: 'bg-purple-100 text-purple-700', label: 'Cartao' },
  fiado:    { icon: BookOpen,   cor: 'bg-orange-100 text-orange-700', label: 'Fiado'  },
};

export default function Fechamento() {
  const [data, setData] = useState(dataLocal());
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [baixandoBackup, setBaixandoBackup] = useState(false);

  const carregar = async (d) => {
    setCarregando(true);
    setErro(false);
    try {
      const r = await api.get(`/relatorios/fechamento?data=${d}`);
      setResumo(r.data);
    } catch (e) {
      console.error('Erro fechamento:', e);
      setResumo(null);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(data); }, [data]);

  const baixarBackup = async () => {
    setBaixandoBackup(true);
    try {
      const r = await api.get('/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_padaria_${dataLocal().replace(/-/g, '')}.db`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar backup. Verifique se o sistema esta rodando.');
    } finally {
      setBaixandoBackup(false);
    }
  };

  const semVendas = resumo && resumo.totais.total_vendas === 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">

      {/* Cabecalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Fechamento de Caixa</h2>
          <p className="text-gray-400 text-sm">Resumo do dia</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            value={data}
            onChange={e => setData(e.target.value)}
          />
          <button
            onClick={baixarBackup}
            disabled={baixandoBackup}
            className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={16} />
            {baixandoBackup ? 'Salvando...' : 'Backup'}
          </button>
          <button
            onClick={() => carregar(data)}
            className="flex items-center gap-1 border-2 border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-sm hover:bg-gray-50"
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Carregando */}
      {carregando && (
        <div className="text-center py-16 text-gray-400 text-lg">Carregando...</div>
      )}

      {/* Erro de conexao */}
      {!carregando && erro && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="text-red-400 mx-auto mb-3" size={40} />
          <p className="font-bold text-red-700 text-lg mb-1">Nao foi possivel carregar</p>
          <p className="text-red-500 text-sm mb-4">Verifique se o backend esta rodando e tente novamente.</p>
          <button
            onClick={() => carregar(data)}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Sem vendas no dia */}
      {!carregando && !erro && semVendas && (
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-12 text-center">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-gray-500 text-lg font-semibold">Nenhuma venda em {formatarData(data)}</p>
          <p className="text-gray-400 text-sm mt-1">Tente selecionar outra data</p>
        </div>
      )}

      {/* Dados do fechamento */}
      {!carregando && !erro && resumo && !semVendas && (
        <>
          {/* Total do dia — destaque */}
          <div className="bg-orange-600 rounded-2xl p-6 text-white text-center shadow-lg">
            <p className="text-orange-200 font-semibold text-sm uppercase tracking-wide mb-1">
              Total do dia — {formatarData(data)}
            </p>
            <p className="text-5xl font-extrabold">{fmt(resumo.totais.faturamento)}</p>
            <div className="flex justify-center gap-6 mt-4 text-orange-100 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <ShoppingBag size={16} />
                <span>{resumo.totais.total_vendas} venda{resumo.totais.total_vendas !== 1 ? 's' : ''}</span>
              </div>
              {resumo.primeiraVenda && (
                <div className="flex items-center gap-1">
                  <Clock size={16} />
                  <span>{resumo.primeiraVenda} — {resumo.ultimaVenda}</span>
                </div>
              )}
            </div>
          </div>

          {/* Por forma de pagamento */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 mb-4 text-base">Por forma de pagamento</h3>
            <div className="space-y-4">
              {resumo.porPagamento.map(p => {
                const cfg = ICONES_PAG[p.forma_pagamento] || { icon: DollarSign, cor: 'bg-gray-100 text-gray-700', label: p.forma_pagamento };
                const IconComp = cfg.icon;
                const pct = resumo.totais.faturamento > 0
                  ? Math.round((p.valor / resumo.totais.faturamento) * 100)
                  : 0;
                return (
                  <div key={p.forma_pagamento}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.cor}`}>
                          <IconComp size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{cfg.label}</p>
                          <p className="text-xs text-gray-400">{p.qtd} venda{p.qtd !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-gray-800 text-xl">{fmt(p.valor)}</p>
                        <p className="text-xs text-gray-400">{pct}%</p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2.5 bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cards: ticket medio e descontos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-center">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Ticket Medio</p>
              <p className="text-xl font-extrabold text-gray-800 mt-1">
                {fmt(resumo.totais.total_vendas > 0 ? resumo.totais.faturamento / resumo.totais.total_vendas : 0)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-center">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <ShoppingBag size={20} className="text-purple-600" />
              </div>
              <p className="text-xs text-gray-400 font-semibold uppercase">Descontos</p>
              <p className="text-xl font-extrabold text-gray-800 mt-1">{fmt(resumo.totais.total_descontos)}</p>
            </div>
          </div>

          {/* Mais vendidos */}
          {resumo.maisPedidos.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <h3 className="font-bold text-gray-700 mb-4 text-base">Mais vendidos hoje</h3>
              <div className="space-y-3">
                {resumo.maisPedidos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-orange-100 text-orange-700 text-sm font-extrabold rounded-full flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="font-semibold text-gray-800">{p.nome_produto}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-800">{fmt(p.total)}</p>
                      <p className="text-xs text-gray-400">{p.qtd_vendida} un</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
