import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, BookOpen, Calendar, Package, Menu, X,
  ShoppingBag, Sparkles, Receipt, Shield, Apple,
  ChevronRight, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';

export const BottomNav: React.FC = () => {
  const { user } = useAuth();
  const { households, activeHousehold, setActiveHouseholdId } = useHousehold();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center py-2 px-1 flex-1 transition-colors ${
      isActive
        ? 'text-amber-500 font-bold'
        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
    }`;

  const handleNavigate = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Bottom Sheet Drawer for "Más" options */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div
            className="w-full bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Menú y Accesos Rápidos</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Todas las herramientas del recetario</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of extra options */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleNavigate('/shopping')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 flex items-center gap-3 text-left hover:border-amber-500/50 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Lista Compra</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">Supermercado</span>
                </div>
              </button>


              <button
                type="button"
                onClick={() => handleNavigate('/imports')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 flex items-center gap-3 text-left hover:border-purple-500/50 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Importador IA</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">PDF, Drive, Web</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/nutrition')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 flex items-center gap-3 text-left hover:border-emerald-500/50 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Apple className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Alimentación</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">Hábitos y Dieta</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/receipts')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 flex items-center gap-3 text-left hover:border-blue-500/50 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Escanear Ticket</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">OCR supermercado</span>
                </div>
              </button>

              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleNavigate('/admin')}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 flex items-center gap-3 text-left hover:border-amber-500/50 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Ajustes Admin</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">Conectores y BD</span>
                  </div>
                </button>
              )}
            </div>

            {/* Household Switcher if user has multiple */}
            {households.length > 1 && (
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">
                  Hogar Activo
                </span>
                <div className="flex gap-2">
                  {households.map(h => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setActiveHouseholdId(h.id);
                        setMoreOpen(false);
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border text-center truncate ${
                        h.id === activeHousehold?.id
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 font-bold'
                          : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fixed Mobile Bottom Bar (5 slots with "Más" button on the right) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-zinc-800/80 pb-safe shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <NavLink to="/" end className={navItemClass}>
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">Inicio</span>
          </NavLink>
          <NavLink to="/recipes" className={navItemClass}>
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">Recetas</span>
          </NavLink>
          <NavLink to="/planner" className={navItemClass}>
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">Menú</span>
          </NavLink>
          <NavLink to="/pantry" className={navItemClass}>
            <Package className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">Despensa</span>
          </NavLink>
          
          {/* Button on the right for extra options */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center py-2 px-1 flex-1 transition-colors ${
              moreOpen
                ? 'text-amber-500 font-bold'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-none">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
};
