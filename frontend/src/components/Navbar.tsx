import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed, Sun, Moon, Languages, Home, BookOpen,
  Calendar, ShoppingBag, Package, Heart, Sparkles, Shield,
  LogOut, User as UserIcon, Menu, X, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { NotificationBell } from './NotificationBell';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { households, activeHousehold, setActiveHouseholdId } = useHousehold();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [householdDropdownOpen, setHouseholdDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-zinc-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-base leading-none">Recetario</span>
            <span className="text-[10px] text-amber-400 font-medium tracking-wider uppercase mt-0.5">Familiar Inteligente</span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/60">
          <Link to="/" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors">
            {t('home')}
          </Link>
          <Link to="/recipes" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors">
            {t('recipes')}
          </Link>
          <Link to="/planner" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors">
            {t('planner')}
          </Link>
          <Link to="/shopping" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors">
            {t('shopping')}
          </Link>
          <Link to="/pantry" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors">
            {t('pantry')}
          </Link>
          <Link to="/imports" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {t('importer')}
          </Link>
        </nav>

        {/* Right Actions: Household, Lang, Theme, User */}
        <div className="flex items-center gap-2">
          {/* Household Selector */}
          {user && households.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setHouseholdDropdownOpen(!householdDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700"
              >
                <span className="max-w-[100px] truncate">{activeHousehold?.name || 'Hogar'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {householdDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-1 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Cambiar Hogar
                  </div>
                  {households.map(h => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setActiveHouseholdId(h.id);
                        setHouseholdDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                        h.id === activeHousehold?.id ? 'text-amber-400 font-semibold bg-zinc-800/50' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="truncate">{h.name}</span>
                      {h.id === activeHousehold?.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'es' ? 'eu' : 'es')}
            title="Cambiar idioma (Castellano / Euskera)"
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            {language.toUpperCase()}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notification Bell */}
          {user && <NotificationBell />}

          {/* User profile / Logout */}
          {user ? (
            <div className="flex items-center gap-1.5">
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/20"
                  title="Panel de Administración"
                >
                  <Shield className="w-4 h-4" />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:border-red-900/50"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              {t('login')}
            </Link>
          )}

          {/* Mobile menu hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden pt-3 pb-2 border-t border-zinc-800 mt-3 space-y-1">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <Home className="w-4 h-4 text-amber-400" />
            {t('home')}
          </Link>
          <Link
            to="/recipes"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            {t('recipes')}
          </Link>
          <Link
            to="/planner"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            {t('planner')}
          </Link>
          <Link
            to="/shopping"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            {t('shopping')}
          </Link>
          <Link
            to="/pantry"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <Package className="w-4 h-4 text-amber-400" />
            {t('pantry')}
          </Link>
          <Link
            to="/imports"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            {t('importer')}
          </Link>
          <Link
            to="/nutrition"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <Heart className="w-4 h-4 text-emerald-400" />
            {t('nutrition')}
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
            >
              <Shield className="w-4 h-4 text-amber-400" />
              {t('admin')}
            </Link>
          )}
        </div>
      )}
    </header>
  );
};
