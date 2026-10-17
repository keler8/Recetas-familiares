import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, Plus, Heart, Clock, Star,
  Sparkles, ChefHat, Flame, ShieldAlert, Tag,
  Utensils, Sun, Coffee, Apple
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { saveRecipeOffline } from '../services/db';

export const RecipesPage: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAppliance, setSelectedAppliance] = useState<string>(searchParams.get('appliance') || '');
  const [selectedMealType, setSelectedMealType] = useState<string>(searchParams.get('meal_type') || '');
  const [selectedTag, setSelectedTag] = useState<string>(searchParams.get('tag') || '');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(
    searchParams.get('favorites') === 'true' || searchParams.get('favorites_only') === 'true'
  );
  const [config, setConfig] = useState<any>({ meal_types: [], tags: [] });

  useEffect(() => {
    const fav = searchParams.get('favorites') === 'true' || searchParams.get('favorites_only') === 'true';
    if (fav !== favoritesOnly) setFavoritesOnly(fav);
    const app = searchParams.get('appliance');
    if (app !== null && app !== selectedAppliance) setSelectedAppliance(app);
    const mt = searchParams.get('meal_type');
    if (mt !== null && mt !== selectedMealType) setSelectedMealType(mt);
    const tg = searchParams.get('tag');
    if (tg !== null && tg !== selectedTag) setSelectedTag(tg);
  }, [searchParams]);

  useEffect(() => {
    apiRequest('/recipes/config').then(data => {
      if (data) setConfig(data);
    }).catch(err => console.warn('Config fetch error:', err));
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedAppliance) params.append('appliance', selectedAppliance);
      if (selectedMealType) params.append('meal_type', selectedMealType);
      if (selectedTag) params.append('tag', selectedTag);
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
  }, [search, selectedAppliance, selectedMealType, selectedTag, favoritesOnly]);

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

  const mealTypes = config.meal_types?.length > 0 ? config.meal_types : [
    { id: '', label: 'Cualquier momento' },
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'almuerzo_merienda', label: 'Almuerzo / Merienda' },
    { id: 'comida_cena', label: 'Comida / Cena' },
    { id: 'snacks', label: 'Snacks / Picoteo' }
  ];

  const tags = config.tags?.length > 0 ? config.tags : [
    { id: 'saludable', label: 'Saludable' },
    { id: 'mas_usada', label: 'Más usada' },
    { id: 'top_receta', label: 'Top receta ⭐' },
    { id: 'rapida', label: 'Rápida (<25m)' },
    { id: 'facil', label: 'Fácil' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
      {/* Top action header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('recipes')}</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Biblioteca compartida con filtros por momento del día, electrodoméstico y etiquetas</p>
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/80 transition-colors shadow-sm"
          />
        </div>

        {/* Appliance & Favorite Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          {appliances.map(app => (
            <button
              key={app.id}
              onClick={() => setSelectedAppliance(app.id)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border ${
                selectedAppliance === app.id
                  ? 'bg-amber-500 text-zinc-950 font-bold border-amber-500 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              {app.label}
            </button>
          ))}

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3.5 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors border ${
              favoritesOnly
                ? 'bg-rose-500 text-white font-bold border-rose-500 shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-white' : 'text-rose-500'}`} />
            <span>{t('favorites')}</span>
          </button>
        </div>

        {/* Meal Type Pills (Desayuno, Comida/Cena, Almuerzo/Merienda, Snacks) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            onClick={() => setSelectedMealType('')}
            className={`px-2.5 py-1 rounded-xl whitespace-nowrap text-[11px] transition-colors border ${
              selectedMealType === ''
                ? 'bg-slate-800 dark:bg-zinc-800 text-white font-bold border-slate-700 dark:border-zinc-700'
                : 'bg-slate-100 dark:bg-zinc-950 text-slate-600 dark:text-zinc-500 border-slate-200 dark:border-zinc-800/80 hover:text-slate-900 dark:hover:text-zinc-300'
            }`}
          >
            Todos los momentos
          </button>
          {mealTypes.filter((m: any) => m.id).map((m: any) => (
            <button
              key={m.id}
              onClick={() => setSelectedMealType(selectedMealType === m.id ? '' : m.id)}
              className={`px-2.5 py-1 rounded-xl whitespace-nowrap text-[11px] transition-colors border ${
                selectedMealType === m.id
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border-amber-500/50'
                  : 'bg-slate-100 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Tags Pills (Saludable, Más usada, Top Receta, Rápida, Fácil) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-semibold shrink-0 flex items-center gap-1 pl-1">
            <Tag className="w-3 h-3" />
            Etiquetas:
          </span>
          {tags.map((tg: any) => (
            <button
              key={tg.id}
              onClick={() => setSelectedTag(selectedTag === tg.id ? '' : tg.id)}
              className={`px-2.5 py-0.5 rounded-lg whitespace-nowrap text-[11px] transition-all border ${
                selectedTag === tg.id
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border-emerald-500/50 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {tg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 dark:text-zinc-500 text-sm">Cargando recetas...</div>
      ) : recipes.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800/60 p-6 shadow-sm">
          <ChefHat className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto" />
          <p className="text-slate-600 dark:text-zinc-400 text-sm font-medium">No se han encontrado recetas con estos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {recipes.map(recipe => (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all hover:shadow-xl shadow-sm"
            >
              {/* Recipe Image */}
              <div className="aspect-[16/10] w-full bg-slate-100 dark:bg-zinc-800 relative overflow-hidden">
                <img
                  src={recipe.main_image_url || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80'}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                {/* Meal Type Tag Badge */}
                {recipe.meal_type && (
                  <span className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-md text-amber-400 border border-white/10">
                    {recipe.meal_type === 'desayuno' ? 'Desayuno' : recipe.meal_type === 'snacks' ? 'Snack' : recipe.meal_type === 'almuerzo_merienda' ? 'Almuerzo' : 'Comida/Cena'}
                  </span>
                )}

                {/* Favorite Heart Button */}
                <button
                  onClick={(e) => toggleFav(e, recipe.id)}
                  className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform"
                >
                  <Heart className={`w-4 h-4 ${recipe.is_favorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'}`} />
                </button>

                {/* Difficulty / Rating Badges */}
                <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-zinc-200">
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
              <div className="p-4 flex flex-col flex-1 justify-between space-y-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors line-clamp-1">
                    {recipe.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {recipe.description || recipe.summary}
                  </p>
                </div>

                {/* Tags badges */}
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.map((t: string, i: number) => {
                      const isHealthy = t.toLowerCase().includes('saludable');
                      const isTop = t.toLowerCase().includes('top');
                      return (
                        <span
                          key={i}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            isHealthy
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                              : isTop
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{recipe.total_time_min} min</span>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {recipe.variants?.length || 1} {recipe.variants?.length === 1 ? 'modo' : 'modos de cocina'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
