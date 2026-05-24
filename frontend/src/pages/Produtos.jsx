import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Upload, Download, CheckCircle, XCircle, FileSpreadsheet, X, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const fmt = (v) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const norm = str => (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SETORES_PROD = ['Salgado', 'Bolo', 'Pao', 'Doce', 'Frango', 'Outros'];
const SETOR_EMOJI_P = { Salgado: '🥟', Bolo: '🎂', Pao: '🍞', Doce: '🍬', Frango: '🍗', Outros: '📦' };

const VAZIO = {
  nome: '', categoria_id: '', preco_venda: '', preco_custo: '',
  unidade: 'un', codigo_barras: '', quantidade_inicial: '', quantidade_minima: '5',
  por_peso: 0, setor: '',
};

// Modelo CSV para download
const CSV_MODELO = [
  'nome,categoria,preco_venda,preco_custo,unidade,estoque_inicial,estoque_minimo',
  'Pão Francês,Paes,0.75,0.30,un,100,20',
  'Coca-Cola 2L,Bebidas,8.50,6.00,un,20,5',
  'Coxinha,Salgados,4.00,1.50,un,50,10',
  'Bolo de Chocolate,Bolos,35.00,18.00,un,5,2',
  'Pão de Queijo,Paes,2.00,0.80,un,80,15',
  'Suco de Laranja,Bebidas,5.00,2.50,un,30,8',
].join('\n');

// Colunas do cabecalho para exibir preview
const COLUNAS_CSV = [
  { key: 0, label: 'Nome'        },
  { key: 1, label: 'Categoria'   },
  { key: 2, label: 'Preco Venda' },
  { key: 3, label: 'Preco Custo' },
  { key: 4, label: 'Unidade'     },
  { key: 5, label: 'Est. Inicial'},
  { key: 6, label: 'Est. Minimo' },
];

export default function Produtos() {
  const [produtos, setProdutos]       = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [busca, setBusca]             = useState('');
  const [modal, setModal]             = useState(false);
  const [editando, setEditando]       = useState(null);
  const [form, setForm]               = useState(VAZIO);

  // CSV import
  const [modalImport, setModalImport] = useState(false);
  const [csvTexto, setCsvTexto]       = useState('');
  const [csvPreview, setCsvPreview]   = useState([]);
  const [importando, setImportando]   = useState(false);
  const [resultado, setResultado]     = useState(null); // { importados, erros, total }
  const fileInputRef                  = useRef(null);

  const carregar = () => {
    api.get('/produtos').then(r => setProdutos(r.data));
    api.get('/produtos/categorias').then(r => setCategorias(r.data));
  };

  useEffect(() => { carregar(); }, []);

  /* ── Produto individual ── */
  const abrirNovo = () => { setForm(VAZIO); setEditando(null); setModal(true); };
  const abrirEditar = (p) => {
    setForm({
      nome: p.nome, categoria_id: p.categoria_id || '', preco_venda: p.preco_venda,
      preco_custo: p.preco_custo || '', unidade: p.unidade, codigo_barras: p.codigo_barras || '',
      quantidade_inicial: '', quantidade_minima: p.quantidade_minima || '5',
      por_peso: p.por_peso || 0, setor: p.setor || '',
    });
    setEditando(p.id);
    setModal(true);
  };

  const salvar = async () => {
    if (!form.nome || !form.preco_venda) return toast.error('Nome e preco sao obrigatorios');
    try {
      if (editando) {
        await api.put(`/produtos/${editando}`, form);
        toast.success('Produto atualizado');
      } else {
        await api.post('/produtos', form);
        toast.success('Produto cadastrado');
      }
      setModal(false);
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const excluir = async (id, nome) => {
    if (!confirm(`Remover "${nome}"?`)) return;
    await api.delete(`/produtos/${id}`);
    toast.success('Produto removido');
    carregar();
  };

  /* ── Importação CSV ── */

  const exportarCSV = () => {
    if (produtos.length === 0) return toast.error('Nenhum produto para exportar');

    const escapar = (v) => {
      const s = String(v ?? '');
      // Se tiver virgula, aspas ou quebra de linha, envolve em aspas
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const linhas = [
      'nome,categoria,preco_venda,preco_custo,unidade,estoque_inicial,estoque_minimo',
      ...produtos.map(p => [
        escapar(p.nome),
        escapar(p.categoria_nome || ''),
        escapar((p.preco_venda || 0).toFixed(2).replace('.', ',')),
        escapar((p.preco_custo  || 0).toFixed(2).replace('.', ',')),
        escapar(p.unidade || 'un'),
        escapar(p.quantidade  ?? 0),
        escapar(p.quantidade_minima ?? 5),
      ].join(','))
    ].join('\n');

    const bom  = '﻿'; // BOM UTF-8 para Excel abrir com acentos certos
    const blob = new Blob([bom + linhas], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const hoje = new Date();
    const data = `${hoje.getFullYear()}${String(hoje.getMonth()+1).padStart(2,'0')}${String(hoje.getDate()).padStart(2,'0')}`;
    a.download = `produtos_padaria_${data}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${produtos.length} produtos exportados!`);
  };

  const baixarModelo = () => {
    const bom  = '﻿'; // BOM UTF-8 para Excel abrir certo
    const blob = new Blob([bom + CSV_MODELO], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'modelo_produtos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };

  const lerArquivo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const texto = ev.target.result.replace(/\r/g, '');
      setCsvTexto(texto);
      setResultado(null);

      const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      // Preview: pula cabecalho, mostra até 5 linhas
      const preview = linhas.slice(1, 6).map(l => parseCsvLine(l));
      setCsvPreview(preview);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const abrirImport = () => {
    setCsvTexto('');
    setCsvPreview([]);
    setResultado(null);
    setModalImport(true);
  };

  const importarCSV = async () => {
    if (!csvTexto.trim()) return toast.error('Selecione um arquivo CSV primeiro');
    setImportando(true);
    try {
      const r = await api.post('/produtos/importar-csv', { csv: csvTexto });
      setResultado(r.data);
      if (r.data.importados > 0) {
        carregar();
        toast.success(`${r.data.importados} produto${r.data.importados > 1 ? 's' : ''} importado${r.data.importados > 1 ? 's' : ''}!`);
      }
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao importar');
    } finally {
      setImportando(false);
    }
  };

  const filtrados = produtos.filter(p =>
    norm(p.nome).includes(norm(busca)) ||
    norm(p.categoria_nome).includes(norm(busca))
  );

  /* ── Render ── */
  return (
    <div className="p-4 md:p-6">

      {/* Cabecalho */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Produtos</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 border-2 border-green-300 text-green-700 bg-green-50 hover:bg-green-100 px-4 py-2 rounded-xl font-semibold text-sm"
          >
            <FileDown size={16} /> Exportar
          </button>
          <button
            onClick={abrirImport}
            className="flex items-center gap-2 border-2 border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl font-semibold text-sm"
          >
            <Upload size={16} /> Importar CSV
          </button>
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-semibold text-sm"
          >
            <Plus size={18} /> Novo Produto
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-orange-500 text-sm"
          placeholder="Buscar produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Produto</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Un.</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Custo</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Venda</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Estoque</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.categoria_nome || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {p.por_peso ? <span className="text-blue-600 font-semibold">⚖ kg</span> : p.unidade}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">{fmt(p.preco_custo)}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(p.preco_venda)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${(p.quantidade ?? 0) <= (p.quantidade_minima ?? 0) ? 'text-red-600' : 'text-green-600'}`}>
                      {p.quantidade ?? 0} {p.unidade}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => abrirEditar(p)} className="text-gray-400 hover:text-blue-600 p-1">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => excluir(p.id, p.nome)} className="text-gray-400 hover:text-red-600 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL PRODUTO INDIVIDUAL ===== */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {editando ? 'Editar Produto' : 'Novo Produto'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nome *</label>
                <input className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                  value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Categoria</label>
                  <select className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                    value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                    <option value="">Selecione</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Unidade</label>
                  <select className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                    value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })}>
                    <option value="un">Unidade</option>
                    <option value="kg">Kg</option>
                    <option value="g">Gramas</option>
                    <option value="pct">Pacote</option>
                  </select>
                </div>
              </div>
              {/* Setor de producao */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Setor de producao (para encomendas)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {SETORES_PROD.map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm(f => ({ ...f, setor: f.setor === s ? '' : s }))}
                      className={`text-xs px-3 py-1.5 rounded-xl border-2 font-semibold transition-colors ${
                        form.setor === s
                          ? 'bg-orange-100 border-orange-400 text-orange-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                      {SETOR_EMOJI_P[s]} {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle: Vendido por Peso */}
              <div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, por_peso: f.por_peso ? 0 : 1, unidade: f.por_peso ? 'un' : 'kg' }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-colors ${
                    form.por_peso ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚖</span>
                    <span>Vendido por Peso (balança)</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.por_peso ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.por_peso ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>
                {!!form.por_peso && (
                  <p className="text-xs text-blue-600 mt-1 pl-1">
                    Preço por KG. Na venda, o sistema pede o peso em gramas e calcula o valor automaticamente.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Preco de Custo</label>
                  <input type="number" min="0" step="0.01" className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                    value={form.preco_custo} onChange={e => setForm({ ...form, preco_custo: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {form.por_peso ? 'Preco por KG *' : 'Preco de Venda *'}
                  </label>
                  <input type="number" min="0" step="0.01" className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                    value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value })} />
                </div>
              </div>
              {!editando && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Estoque inicial</label>
                    <input type="number" min="0" className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                      value={form.quantidade_inicial} onChange={e => setForm({ ...form, quantidade_inicial: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Estoque minimo</label>
                    <input type="number" min="0" className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                      value={form.quantidade_minima} onChange={e => setForm({ ...form, quantidade_minima: e.target.value })} />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Codigo de barras</label>
                <input className="w-full mt-1 border-2 border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500"
                  value={form.codigo_barras} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvar}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-semibold">
                {editando ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL IMPORTAÇÃO CSV ===== */}
      {modalImport && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh' }}>

            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Cabecalho do modal */}
            <div className="px-6 pt-4 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet size={22} className="text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Importar Planilha</h3>
                  <p className="text-xs text-gray-400">Cadastro em massa via arquivo CSV</p>
                </div>
              </div>
              <button onClick={() => setModalImport(false)}
                className="p-2 bg-gray-100 rounded-xl text-gray-500">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Passo 1: Baixar modelo */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-blue-800 mb-1">① Baixe o modelo de planilha</p>
                    <p className="text-sm text-blue-700">
                      Abra no Excel ou Google Sheets, preencha seus produtos e salve como <strong>.csv</strong>
                    </p>
                    <div className="mt-2 text-xs text-blue-600 space-y-0.5">
                      <p>• Colunas: <code className="bg-blue-100 px-1 rounded">nome, categoria, preco_venda, preco_custo, unidade, estoque_inicial, estoque_minimo</code></p>
                      <p>• Use ponto ou virgula para decimais: <code className="bg-blue-100 px-1 rounded">4.50</code> ou <code className="bg-blue-100 px-1 rounded">4,50</code></p>
                      <p>• Categorias: Paes, Bolos, Salgados, Bebidas, Doces, Outros</p>
                    </div>
                  </div>
                  <button
                    onClick={baixarModelo}
                    className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap"
                  >
                    <Download size={16} /> Modelo
                  </button>
                </div>
              </div>

              {/* Passo 2: Selecionar arquivo */}
              <div>
                <p className="font-bold text-gray-700 mb-2">② Selecione o arquivo .csv</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => lerArquivo(e.target.files[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                    csvTexto
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                  }`}
                >
                  <Upload size={28} className={`mx-auto mb-2 ${csvTexto ? 'text-orange-500' : 'text-gray-400'}`} />
                  <p className={`font-semibold text-sm ${csvTexto ? 'text-orange-700' : 'text-gray-500'}`}>
                    {csvTexto ? 'Arquivo carregado! Clique para trocar' : 'Clique aqui para escolher o arquivo'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Formato: .csv</p>
                </button>
              </div>

              {/* Preview das primeiras linhas */}
              {csvPreview.length > 0 && !resultado && (
                <div>
                  <p className="font-bold text-gray-700 mb-2">
                    Prévia ({csvPreview.length} linha{csvPreview.length > 1 ? 's' : ''} de amostra)
                  </p>
                  <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {COLUNAS_CSV.map(c => (
                              <th key={c.key} className="px-3 py-2 text-left font-bold text-gray-600 whitespace-nowrap">
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {csvPreview.map((cols, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {COLUNAS_CSV.map(c => (
                                <td key={c.key} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[120px] truncate">
                                  {cols[c.key] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">
                    Mostrando as primeiras {csvPreview.length} linhas de amostra
                  </p>
                </div>
              )}

              {/* Resultado da importação */}
              {resultado && (
                <div className="space-y-3">
                  {/* Novos + Atualizados */}
                  <div className={`rounded-2xl p-4 border-2 ${
                    (resultado.importados + resultado.atualizados) > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle size={26} className={(resultado.importados + resultado.atualizados) > 0 ? 'text-green-600 shrink-0' : 'text-gray-400 shrink-0'} />
                      <p className={`font-extrabold text-base ${(resultado.importados + resultado.atualizados) > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                        {resultado.importados + resultado.atualizados} de {resultado.total} linha{resultado.total !== 1 ? 's' : ''} processada{resultado.total !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white rounded-xl p-3 text-center border border-green-200">
                        <p className="text-2xl font-extrabold text-green-700">{resultado.importados}</p>
                        <p className="text-xs text-green-600 font-semibold mt-0.5">✨ Novo{resultado.importados !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 text-center border border-blue-200">
                        <p className="text-2xl font-extrabold text-blue-700">{resultado.atualizados}</p>
                        <p className="text-xs text-blue-600 font-semibold mt-0.5">🔄 Atualizado{resultado.atualizados !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>

                  {/* Erros */}
                  {resultado.erros.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle size={20} className="text-red-600 shrink-0" />
                        <p className="font-bold text-red-700">
                          {resultado.erros.length} linha{resultado.erros.length !== 1 ? 's' : ''} com erro
                        </p>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {resultado.erros.map((e, i) => (
                          <div key={i} className="text-sm bg-white rounded-xl p-3 border border-red-100">
                            <p className="font-bold text-red-600">Linha {e.linha}: {e.erro}</p>
                            {e.conteudo && (
                              <p className="text-gray-400 text-xs mt-0.5 truncate">{e.conteudo}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodape */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                onClick={() => setModalImport(false)}
                className="flex-1 border-2 border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold"
              >
                {resultado ? 'Fechar' : 'Cancelar'}
              </button>
              {!resultado && (
                <button
                  onClick={importarCSV}
                  disabled={!csvTexto || importando}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  {importando ? (
                    <>Importando...</>
                  ) : (
                    <><Upload size={18} /> Importar Agora</>
                  )}
                </button>
              )}
              {resultado && resultado.erros.length > 0 && (
                <button
                  onClick={() => { setResultado(null); setCsvTexto(''); setCsvPreview([]); }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl font-bold"
                >
                  Tentar Novamente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
