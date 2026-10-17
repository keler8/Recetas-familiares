import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, Plus, Heart, Clock, Star,
  Sparkles, ChefHat, Flame, ShieldAlert
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { saveRecipeOffline } from '../services/db';

export const RecipesPage: React.FC = () => {
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAppliance, setSelectedAppliance] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedAppliance) params.append('appliance', selectedAppliance);
      if (selectedCategory) params.append('category', selectedCategory);
      if (favoritesOnly) params.append('favorites_only', 'true');

      const data = await apiRequest(`/recipes?${params.toString()}`);
      setRecipes(data);

      // Auto-cache to IndexedDB for offline capability
      data.forEach((r: any) => saveRecipeOffline(r));
    } catch (err) {
      console.warn('Error fetching recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecipes();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedAppliance, selectedCategory, favoritesOnly]);

  const toggleFav = async (e: React.MouseEvent, recipeId: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await apiRequest(`/recipes/${recipeId}/favorite`, { method: 'POST' });
      setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, is_favorite: res.is_favorite } : r));
    } catch (err) {
      console.warn('Fav error:', err);
    }
  };

  const appliances = [
    { id: '', label: 'Todos los aparatos' },
    { id: 'Thermomix', label: 'Thermomix TM7' },
    { id: 'Airfryer', label: 'Airfryer 6L' },
    { id: 'Tradicional', label: 'Tradicional' }
  ];

  const categories = [
    'Comidas', 'Cenas', 'Platos principales', 'Entrantes', 'Postres', 'Desayunos'
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top action header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('recipes')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Biblioteca compartida de recetas familiares</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/recipes/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Receta</span>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/80 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          {appliances.map(app => (
            <button
              key={app.id}
              onClick={() => setSelectedAppliance(app.id)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border ${
                selectedAppliance === app.id
                  ? 'bg-amber-500 text-zinc-950 font-bold border-amber-500'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {app.label}
            </button>
          ))}

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1 transition-colors border ${
              favoritesOnly
                ? 'bg-rose-500 text-white font-bold border-rose-500'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-white' : ''}`} />
            <span>{t('favorites')}</span>
          </button>
        </div>
      </div>

      {/* Recipe Grid */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">Cargando recetas...</div>
      ) : recipes.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-6">
          <ChefHat className="w-12 h-12 text-zinc-600 mx-auto" />
          <p className="text-zinc-400 text-sm font-medium">No se han encontrado recetas con estos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {recipes.map(recipe => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="group flex flex-col bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-xl hover:shadow-black/50"
            >
              {/* Recipe Image */}
              <div className="aspect-[16/10] w-full bg-zinc-800 relative overflow-hidden">
                <img
                  src={recipe.main_image_url || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

                {/* Favorite Heart Button */}
                <button
                  onClick={(e) => toggleFav(e, recipe.id)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-zinc-950/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Heart className={`w-4 h-4 ${recipe.is_favorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'}`} />
                </button>

                {/* Difficulty / Rating Badges */}
                <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-900/90 backdrop-blur-sm text-[10px] font-semibold text-zinc-300">
                    {recipe.difficulty}
                  </span>
                  {recipe.average_rating && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-zinc-950 text-[10px] font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-zinc-950" />
                      {recipe.average_rating}
                    </span>
                  )}
                </div>
              </div>

              {/* Recipe Details */}
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {recipe.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {recipe.description || recipe.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{recipe.total_time_min} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {recipe.tags && recipe.tags.slice(0, 2).map((t: string, i: number) => (
                      <span key={i} className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
