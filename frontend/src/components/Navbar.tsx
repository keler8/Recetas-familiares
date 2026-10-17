import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed, Sun, Moon, Sparkles, Shield,
  LogOut, ChevronDown, Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { NotificationBell } from './NotificationBell';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { households, activeHousehold, setActiveHouseholdId } = useHousehold();
  const { theme, toggleTheme } = useTheme();
  const [householdDropdownOpen, setHouseholdDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800/80 px-4 py-2.5 transition-colors duration-150">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-zinc-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
            <UtensilsCrossed className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-900 dark:text-white font-extrabold text-base leading-none">Recetario</span>
            <span className="text-[10px] text-amber-500 dark:text-amber-400 font-bold tracking-wider uppercase mt-0.5">Familiar Inteligente</span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-zinc-900/60 p-1 rounded-2xl border border-slate-200/80 dark:border-zinc-800/60">
          <Link to="/" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/60 transition-all">
            Inicio
          </Link>
          <Link to="/recipes" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/60 transition-all">
            Recetas
          </Link>
          <Link to="/recipes?favorites=true" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-white dark:hover:bg-zinc-800/60 transition-all flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 fill-rose-500/20" />
            Favoritos
          </Link>
          <Link to="/planner" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/60 transition-all">
            Planificador
          </Link>
          <Link to="/shopping" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/60 transition-all">
            Compra
          </Link>
          <Link to="/pantry" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/60 transition-all">
            Despensa
          </Link>
          <Link to="/imports" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/60 transition-all flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Importador
          </Link>
        </nav>

        {/* Right Actions: Household, Theme, Bell, User */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Household Selector (Desktop & Tablet) */}
          {user && households.length > 0 && (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setHouseholdDropdownOpen(!householdDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
              >
                <span className="max-w-[110px] truncate">{activeHousehold?.name || 'Hogar'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
              </button>

              {householdDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Cambiar Hogar
                  </div>
                  {households.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setActiveHouseholdId(h.id);
                        setHouseholdDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                        h.id === activeHousehold?.id
                          ? 'text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="truncate">{h.name}</span>
                      {h.id === activeHousehold?.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Theme Toggle (Sun/Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
            title="Cambiar tema claro / oscuro"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Notification Bell (Always visible on mobile & desktop) */}
          {user && <NotificationBell />}

          {/* User profile / Admin / Logout */}
          {user ? (
            <div className="flex items-center gap-1.5">
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors shadow-sm"
                  title="Ajustes y Administración"
                >
                  <Shield className="w-4 h-4" />
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors shadow-sm"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors shadow-sm"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
