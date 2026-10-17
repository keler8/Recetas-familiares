import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, Calendar, ShoppingBag, Package, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const BottomNav: React.FC = () => {
  const { t } = useLanguage();

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center py-2 px-1 flex-1 transition-colors ${
      isActive ? 'text-amber-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
    }`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800/80 pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        <NavLink to="/" end className={navItemClass}>
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-none">{t('home')}</span>
        </NavLink>
        <NavLink to="/recipes" className={navItemClass}>
          <BookOpen className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-none">{t('recipes')}</span>
        </NavLink>
        <NavLink to="/planner" className={navItemClass}>
          <Calendar className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-none">{t('planner')}</span>
        </NavLink>
        <NavLink to="/shopping" className={navItemClass}>
          <ShoppingBag className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-none">Compra</span>
        </NavLink>
        <NavLink to="/pantry" className={navItemClass}>
          <Package className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-none">{t('pantry')}</span>
        </NavLink>
      </div>
    </nav>
  );
};
