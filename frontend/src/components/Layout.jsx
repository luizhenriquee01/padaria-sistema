import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Package, BarChart2, Box, Users,
  Settings, LogOut, ClipboardList, CalendarCheck, MoreHorizontal, X,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navGerente = [
  { to: '/',           label: 'Inicio',     icon: LayoutDashboard },
  { to: '/caixa',      label: 'Caixa',      icon: ShoppingCart    },
  { to: '/encomendas', label: 'Encomendar', icon: CalendarCheck   },
  { to: '/clientes',   label: 'Clientes',   icon: Users           },
  { to: '/fechamento', label: 'Fechamento', icon: ClipboardList   },
  { to: '/relatorios', label: 'Relatorios', icon: BarChart2       },
  { to: '/produtos',   label: 'Produtos',   icon: Package         },
  { to: '/estoque',    label: 'Estoque',    icon: Box             },
  { to: '/usuarios',   label: 'Usuarios',   icon: Settings        },
];

const navAtendente = [
  { to: '/',           label: 'Caixa',      icon: ShoppingCart  },
  { to: '/encomendas', label: 'Encomendar', icon: CalendarCheck },
  { to: '/clientes',   label: 'Clientes',   icon: Users         },
];

// Quantos itens aparecem direto na barra inferior (o resto vai no "Mais")
const NAV_VISIVEIS = 4;

export default function Layout({ children }) {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const [maisAberto, setMaisAberto] = useState(false);

  const nav = usuario?.perfil === 'gerente' ? navGerente : navAtendente;
  const navPrincipal = nav.slice(0, NAV_VISIVEIS);
  const navExtras    = nav.slice(NAV_VISIVEIS);
  const temExtras    = navExtras.length > 0;

  const irPara = (to) => {
    navigate(to);
    setMaisAberto(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 md:flex-row">

      {/* ===== SIDEBAR DESKTOP ===== */}
      <aside className="hidden md:flex w-56 bg-orange-700 text-white flex-col shadow-lg shrink-0">
        <div className="p-5 border-b border-orange-600">
          <div className="text-3xl mb-1">🥖</div>
          <h1 className="text-xl font-bold">Padaria</h1>
          <p className="text-orange-200 text-xs mt-1">Sistema de Gestao</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? 'bg-white text-orange-700' : 'text-orange-100 hover:bg-orange-600'
                }`
              }
            >
              <Icon size={20} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-orange-600">
          <p className="text-white font-semibold text-sm truncate">{usuario?.nome}</p>
          <p className="text-orange-300 text-xs capitalize mb-3">{usuario?.perfil}</p>
          <button onClick={sair}
            className="w-full flex items-center justify-center gap-2 bg-orange-800 hover:bg-orange-900 text-white text-sm font-semibold py-2 rounded-lg">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* ===== CONTEUDO PRINCIPAL ===== */}
      <main className="flex-1 flex flex-col overflow-hidden md:overflow-auto">

        {/* Header mobile */}
        <div className="md:hidden bg-orange-700 text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥖</span>
            <span className="font-bold text-lg">Padaria</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-orange-200 text-sm">{usuario?.nome}</span>
            <button onClick={sair} className="bg-orange-800 p-2 rounded-lg">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Conteudo da pagina */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>

        {/* Espacador para o nav fixo */}
        <div className="md:hidden shrink-0 h-16" />

      </main>

      {/* ===== MENU INFERIOR MOBILE ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t-2 border-gray-100 shadow-2xl z-40">
        <div className="flex items-center h-full">

          {/* Itens principais */}
          {navPrincipal.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                  isActive ? 'text-orange-600' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl mb-0.5 ${isActive ? 'bg-orange-100' : ''}`}>
                    <Icon size={22} />
                  </div>
                  <span className="text-xs font-semibold leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Botao "Mais" — aparece quando tem extras */}
          {temExtras && (
            <button
              onClick={() => setMaisAberto(true)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-gray-400 active:text-orange-600"
            >
              <div className="p-1.5 rounded-xl mb-0.5">
                <MoreHorizontal size={22} />
              </div>
              <span className="text-xs font-semibold leading-none">Mais</span>
            </button>
          )}

        </div>
      </nav>

      {/* ===== DRAWER "MAIS" (mobile) ===== */}
      {maisAberto && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Fundo escuro */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMaisAberto(false)} />

          {/* Painel */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl pb-safe">
            {/* Alca */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Cabecalho do drawer */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
              <span className="font-bold text-gray-700 text-base">Menu</span>
              <button onClick={() => setMaisAberto(false)} className="p-2 rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {/* Itens extras em grade */}
            <div className="grid grid-cols-3 gap-3 p-4">
              {navExtras.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  onClick={() => irPara(to)}
                  className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-4 gap-2 active:bg-orange-50 active:text-orange-600"
                >
                  <Icon size={26} className="text-gray-600" />
                  <span className="text-xs font-bold text-gray-700 text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>

            {/* Sair */}
            <div className="px-4 pb-6">
              <button
                onClick={() => { sair(); setMaisAberto(false); }}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3.5 rounded-2xl font-bold text-sm"
              >
                <LogOut size={18} /> Sair do sistema
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
