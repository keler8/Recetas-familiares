import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, ArrowRight, Calendar, Heart, Clock, ChefHat,
  SlidersHorizontal, Check, Utensils, Apple, Coffee, Sun,
  Flame, Plus, Play, RefreshCw, X, Bot, Lightbulb, RotateCw, FileText
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DietaryAssistantModal } from '../components/DietaryAssistantModal';

interface WidgetsConfig {
  showTodayPlan: boolean;
  showDietAssistant: boolean;
  showRecentRecipes: boolean;
  showFavorites: boolean;
  showAppliances: boolean;
  showFunctionalAreas: boolean;
}

const DEFAULT_WIDGETS: WidgetsConfig = {
  showTodayPlan: true,
  showDietAssistant: true,
  showRecentRecipes: true,
  showFavorites: true,
  showAppliances: true,
  showFunctionalAreas: true
};

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [widgets, setWidgets] = useState<WidgetsConfig>(() => {
    try {
      const saved = localStorage.getItem('homepage_widgets');
      return saved ? { ...DEFAULT_WIDGETS, ...JSON.parse(saved) } : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDietAssistantModal, setShowDietAssistantModal] = useState(false);

  const [todayPlan, setTodayPlan] = useState<any[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<any[]>([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState<any[]>([]);
  const [nutritionProfile, setNutritionProfile] = useState<any>(null);
  const [dailyTip, setDailyTip] = useState<any>(null);
  const [tipIndex, setTipIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Day name in Spanish
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayName = daysOfWeek[new Date().getDay()];

  useEffect(() => {
    // 1. Fetch user saved preferences from server
    apiRequest('/auth/preferences').then(prefs => {
      if (prefs && prefs.widgets_config) {
        try {
          const parsed = JSON.parse(prefs.widgets_config);
          setWidgets({ ...DEFAULT_WIDGETS, ...parsed });
          localStorage.setItem('homepage_widgets', JSON.stringify(parsed));
        } catch {}
      }
    }).catch(() => null);

    // 2. Load active meal plan for today, latest recipes, favorites, nutrition profile and daily tip
    const loadHomeData = async () => {
      setLoading(true);
      try {
        const [planRes, recipesRes, favsRes, profRes, tipRes] = await Promise.all([
          apiRequest('/meal-plans/active').catch(() => null),
          apiRequest('/recipes?limit=4').catch(() => []),
          apiRequest('/recipes?favorites_only=true&limit=4').catch(() => []),
          apiRequest('/nutrition/profile').catch(() => null),
          apiRequest('/nutrition/daily-tip').catch(() => null)
        ]);

        if (planRes && planRes.items) {
          const todaysItems = planRes.items.filter((item: any) =>
            item.day_of_week?.toLowerCase() === todayName.toLowerCase()
          );
          setTodayPlan(todaysItems);
        }

        if (Array.isArray(recipesRes)) {
          setRecentRecipes(recipesRes);
        }

        if (Array.isArray(favsRes)) {
          setFavoriteRecipes(favsRes);
        }

        if (profRes) {
          setNutritionProfile(profRes);
        }

        if (tipRes) {
          setDailyTip(tipRes);
          setTipIndex(tipRes.index || 0);
        }
      } catch (err) {
        console.warn('Home fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [todayName]);

  const handleRotateTip = () => {
    if (!dailyTip || !dailyTip.all_tips || dailyTip.all_tips.length <= 1) return;
    const nextIdx = (tipIndex + 1) % dailyTip.all_tips.length;
    setTipIndex(nextIdx);
  };

  const toggleFav = async (e: React.MouseEvent, recipeId: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await apiRequest(`/recipes/${recipeId}/favorite`, { method: 'POST' });
      setRecentRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, is_favorite: res.is_favorite } : r));
      setFavoriteRecipes(prev => {
        if (res.is_favorite) {
          if (!prev.some(r => r.id === recipeId)) {
            const item = recentRecipes.find(r => r.id === recipeId);
            return item ? [{ ...item, is_favorite: true }, ...prev] : prev;
          }
          return prev.map(r => r.id === recipeId ? { ...r, is_favorite: true } : r);
        } else {
          return prev.filter(r => r.id !== recipeId);
        }
      });
    } catch (err) {
      console.warn('Favorite toggle error:', err);
    }
  };

  const handleSaveWidgetConfig = async (newConfig: WidgetsConfig) => {
    setWidgets(newConfig);
    localStorage.setItem('homepage_widgets', JSON.stringify(newConfig));
    try {
      await apiRequest('/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          widgets_config: JSON.stringify(newConfig)
        })
      });
    } catch (err) {
      console.warn('Failed saving widget preferences to server:', err);
    }
  };

  const areas = [
    {
      title: "Recetario",
      desc: "Biblioteca compartida, versiones, fotografías y cocina guiada.",
      path: "/recipes",
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
      accent: "from-amber-500/20 to-orange-500/20"
    },
    {
      title: "Planificador",
      desc: "Menús personales, familiares, saludables y generados con IA.",
      path: "/planner",
      image: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80",
      accent: "from-blue-500/20 to-indigo-500/20"
    },
    {
      title: "Compra y despensa",
      desc: "Listas, existencias, tickets, precios y presupuestos.",
      path: "/shopping",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
      accent: "from-emerald-500/20 to-teal-500/20"
    },
    {
      title: "Asistente Dietético",
      desc: "Objetivos, hábitos, orientación nutricional y propuestas saludables.",
      path: "/nutrition",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
      accent: "from-rose-500/20 to-pink-500/20"
    },
    {
      title: "Importador inteligente",
      desc: "Drive, PDF, Instagram, vídeos, fotografías y extracción con IA.",
      path: "/imports",
      image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80",
      accent: "from-purple-500/20 to-violet-500/20"
    },
    {
      title: "Administración",
      desc: "Usuarios, permisos, IA, integraciones, almacenamiento y backups.",
      path: "/admin",
      image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      accent: "from-amber-600/20 to-yellow-500/20"
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-8 animate-in fade-in pb-20">
      
      {/* Top Banner with Greeting & Personalization Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recetario Familiar Inteligente</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Hola, {user?.full_name || user?.username || 'Familia'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
            ¿Qué cocinamos hoy? Tu menú del día, recetas favoritas y recomendaciones al instante.
          </p>
        </div>

        <Link
          to="/profile?tab=preferences#homepage"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-zinc-700 text-xs font-semibold transition-all self-start sm:self-auto shadow-sm hover:shadow"
          title="Configurar la pantalla de inicio en Ajustes de Usuario"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
          <span>Personalizar Inicio</span>
        </Link>
      </div>

      {/* Widget 1: Tips de mi Alimentación & Consejos del Dietista */}
      {widgets.showDietAssistant && (
        <section className={`p-5 sm:p-6 rounded-3xl border space-y-4 shadow-sm transition-all ${
          dailyTip?.has_dietitian_report
            ? 'bg-gradient-to-br from-amber-500/10 via-white dark:via-zinc-900 to-amber-500/5 dark:to-zinc-900 border-amber-500/30'
            : 'bg-gradient-to-br from-emerald-500/10 via-white dark:via-zinc-900 to-emerald-500/5 dark:to-zinc-900 border-emerald-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                dailyTip?.has_dietitian_report
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                {dailyTip?.has_dietitian_report ? (
                  <Lightbulb className="w-5 h-5 fill-amber-500/20" />
                ) : (
                  <Heart className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  {dailyTip?.has_dietitian_report ? (
                    <>
                      <span>Pautas de tu Dietista</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Informe Activo
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Tips de mi Alimentación</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Asistente Dietético
                      </span>
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {dailyTip?.has_dietitian_report ? (
                    <span>
                      Siguiendo: <strong>{dailyTip.report_title}</strong> {dailyTip.patient_name ? `(${dailyTip.patient_name})` : ''}
                    </span>
                  ) : (
                    nutritionProfile?.dietary_goals
                      ? `Enfoque activo: ${nutritionProfile.dietary_goals}`
                      : 'Nutrición preventiva, hábitos saludables y adaptación de tus platos'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              <Link
                to="/nutrition"
                className="px-3 py-2 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>{dailyTip?.has_dietitian_report ? 'Ver Informe Completo' : 'Mi Alimentación'}</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowDietAssistantModal(true)}
                className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                <span>Consultar Asistente</span>
              </button>
            </div>
          </div>

          {/* Daily Quick Tip Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <strong className={dailyTip?.has_dietitian_report ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                    {dailyTip?.has_dietitian_report ? 'Pauta del día:' : 'Consejo de hoy:'}
                  </strong>
                  {dailyTip?.all_tips && dailyTip.all_tips.length > 1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                      Pauta {tipIndex + 1} de {dailyTip.all_tips.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-800 dark:text-zinc-200 font-medium italic">
                  «{dailyTip?.all_tips?.[tipIndex] || dailyTip?.tip || 'Mantén una hidratación constante y prioriza vegetales frescos en cada comida.'}»
                </p>
              </div>
            </div>

            {/* Rotating / Change tip button */}
            {dailyTip?.all_tips && dailyTip.all_tips.length > 1 && (
              <button
                type="button"
                onClick={handleRotateTip}
                className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border border-slate-200 dark:border-zinc-800"
                title="Mostrar otra pauta del informe"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-500" />
                <span>Otro consejo</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Widget 2: ¿Qué tenemos planificado para hoy? */}
      {widgets.showTodayPlan && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                ¿Qué tenemos planificado para hoy ({todayName})?
              </h2>
            </div>
            <Link
              to="/planner"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Ver semana completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {todayPlan.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {todayPlan.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 flex flex-col justify-between space-y-3 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      {item.meal_type === 'desayuno' ? 'Desayuno' : item.meal_type === 'cena' ? 'Cena' : 'Comida'}
                    </span>
                    {item.recipe_id && (
                      <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Planificado
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.recipe?.title || item.custom_meal_title || 'Plato del día'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                      {item.recipe?.cuisine || 'Cocina casera'}
                    </p>
                  </div>

                  {item.recipe_id ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <Link
                        to={`/recipes/${item.recipe_id}`}
                        className="flex-1 text-center py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs text-slate-700 dark:text-zinc-200 font-medium transition-colors"
                      >
                        Ver receta
                      </Link>
                      <Link
                        to={`/recipes/${item.recipe_id}/cook`}
                        className="flex-1 text-center py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs text-black font-bold flex items-center justify-center gap-1 transition-colors shadow-sm"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Cocinar
                      </Link>
                    </div>
                  ) : (
                    <Link
                      to="/planner"
                      className="text-center py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs text-slate-600 dark:text-zinc-400 font-medium transition-colors"
                    >
                      Asignar receta
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-dashed border-slate-300 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-sm">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Aún no has planificado las comidas para hoy ({todayName})</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Añade recetas al planificador para tener la lista de la compra organizada.</p>
              </div>
              <Link
                to="/planner"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 shadow-md shadow-amber-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Planificar Hoy
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Widget 3: Últimas Recetas Añadidas */}
      {widgets.showRecentRecipes && recentRecipes.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-500" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Últimas Recetas Añadidas</h2>
            </div>
            <Link
              to="/recipes"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Explorar todo el recetario</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {recentRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all hover:shadow-lg shadow-sm"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 relative">
                  <Link to={`/recipes/${recipe.id}`} className="block w-full h-full">
                    <img
                      src={recipe.main_image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
                      alt={recipe.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>

                  {/* Meal type pill */}
                  {recipe.meal_type && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-amber-400 border border-white/10 pointer-events-none">
                      {recipe.meal_type === 'desayuno' ? 'Desayuno' : recipe.meal_type === 'snacks' ? 'Snack' : 'Comida/Cena'}
                    </span>
                  )}

                  {/* 1-click Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFav(e, recipe.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform shadow"
                    title={recipe.is_favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${recipe.is_favorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-200'}`} />
                  </button>
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <Link to={`/recipes/${recipe.id}`}>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-amber-500 transition-colors">
                      {recipe.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        {recipe.total_time_min || 30}m
                      </span>
                      <span>·</span>
                      <span>{recipe.difficulty || 'Media'}</span>
                      {recipe.nutrition_calories && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            🔥 {Math.round(recipe.nutrition_calories)} kcal
                          </span>
                        </>
                      )}
                    </div>
                  </Link>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 2).map((tg: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-medium">
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Widget 4: Mis Recetas Favoritas y Más Utilizadas */}
      {widgets.showFavorites && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Mis Recetas Favoritas y Más Utilizadas
              </h2>
            </div>
            <Link
              to="/recipes?favorites=true"
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Ver todas mis favoritas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {favoriteRecipes.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {favoriteRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900/50 transition-all hover:shadow-lg shadow-sm"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 relative">
                    <Link to={`/recipes/${recipe.id}`} className="block w-full h-full">
                      <img
                        src={recipe.main_image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
                        alt={recipe.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>

                    {/* Favorite Heart Toggle */}
                    <button
                      type="button"
                      onClick={(e) => toggleFav(e, recipe.id)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform shadow"
                    >
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    </button>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                    <Link to={`/recipes/${recipe.id}`}>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-rose-500 transition-colors">
                        {recipe.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          {recipe.total_time_min || 30}m
                        </span>
                        <span>·</span>
                        <span>{recipe.difficulty || 'Fácil'}</span>
                        {recipe.nutrition_calories && (
                          <>
                            <span>·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              🔥 {Math.round(recipe.nutrition_calories)} kcal
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-dashed border-slate-300 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-sm">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  Aún no tienes recetas marcadas como favoritas.
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Pulsa el icono de corazón en cualquier receta para tenerla siempre a mano aquí.
                </p>
              </div>
              <Link
                to="/recipes"
                className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow shrink-0"
              >
                Explorar Recetas
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Widget 5: Filtro Rápido por Electrodoméstico */}
      {widgets.showAppliances && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Cocina con tu electrodoméstico favorito
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Link
              to="/recipes?appliance=Thermomix"
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 flex flex-col items-center justify-center text-center space-y-1.5 transition-all group shadow-sm hover:shadow"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ChefHat className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Thermomix TM7</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">Pasos y velocidad guiada</span>
            </Link>

            <Link
              to="/recipes?appliance=Airfryer"
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-orange-500/50 flex flex-col items-center justify-center text-center space-y-1.5 transition-all group shadow-sm hover:shadow"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Airfryer 6L</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">Asados y frituras ligeras</span>
            </Link>

            <Link
              to="/recipes?appliance=Tradicional"
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-emerald-500/50 flex flex-col items-center justify-center text-center space-y-1.5 transition-all group shadow-sm hover:shadow"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Utensils className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Tradicional</span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400">Cazuela y fuego lento</span>
            </Link>
          </div>
        </section>
      )}

      {/* Widget 6: Seis Grandes Áreas Funcionales */}
      {widgets.showFunctionalAreas && (
        <section className="space-y-3.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Accesos Directos</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-5">
            {areas.map((area, idx) => (
              <Link
                key={idx}
                to={area.path}
                className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-300 hover:shadow-xl shadow-sm"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 relative">
                  <img
                    src={area.image}
                    alt={area.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${area.accent} to-transparent opacity-60`} />
                </div>
                <div className="p-3.5 md:p-4 flex-1 flex flex-col justify-between space-y-1.5">
                  <div>
                    <h3 className="font-bold text-sm md:text-base text-slate-900 dark:text-zinc-100 group-hover:text-amber-500 transition-colors">
                      {area.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mt-0.5">
                      {area.desc}
                    </p>
                  </div>
                  <div className="pt-2 flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
                    <span>Acceder</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Personalize Homepage Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Personalizar Página de Inicio</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Activa o desactiva las secciones según las preferencias de tu hogar. La configuración se guarda en tu perfil:
            </p>

            <div className="space-y-3">
              {[
                { key: 'showDietAssistant', label: 'Tips de mi alimentación (Asistente Dietético IA)' },
                { key: 'showTodayPlan', label: '¿Qué tenemos planificado para hoy? (Menú del día)' },
                { key: 'showRecentRecipes', label: 'Últimas recetas añadidas' },
                { key: 'showFavorites', label: 'Mis Recetas Favoritas y Más Utilizadas' },
                { key: 'showAppliances', label: 'Acceso rápido por electrodomésticos (Thermomix / Airfryer)' },
                { key: 'showFunctionalAreas', label: 'Accesos a las 6 áreas funcionales' },
              ].map(item => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean((widgets as any)[item.key])}
                    onChange={(e) => {
                      const updated = { ...widgets, [item.key]: e.target.checked };
                      handleSaveWidgetConfig(updated);
                    }}
                    className="w-4 h-4 rounded text-amber-500 bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 focus:ring-amber-500"
                  />
                </label>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Link
                to="/profile?tab=preferences#homepage"
                onClick={() => setShowConfigModal(false)}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <span>Abrir en Ajustes de Usuario</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors shadow-md"
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Dietary Assistant Modal */}
      <DietaryAssistantModal
        isOpen={showDietAssistantModal}
        onClose={() => setShowDietAssistantModal(false)}
      />

    </div>
  );
};
