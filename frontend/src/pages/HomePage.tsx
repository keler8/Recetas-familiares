import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, ArrowRight, Calendar, Heart, Clock, ChefHat,
  SlidersHorizontal, Check, Utensils, Apple, Coffee, Sun,
  Flame, Plus, Play, RefreshCw, X
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DietaryAssistantModal } from '../components/DietaryAssistantModal';

interface WidgetsConfig {
  showTodayPlan: boolean;
  showDietAssistant: boolean;
  showRecentRecipes: boolean;
  showAppliances: boolean;
  showFunctionalAreas: boolean;
}

const DEFAULT_WIDGETS: WidgetsConfig = {
  showTodayPlan: true,
  showDietAssistant: true,
  showRecentRecipes: true,
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
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDietAssistantModal, setShowDietAssistantModal] = useState(false);

  const [todayPlan, setTodayPlan] = useState<any[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<any[]>([]);
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
          setWidgets(parsed);
          localStorage.setItem('homepage_widgets', JSON.stringify(parsed));
        } catch {}
      }
    }).catch(() => null);

    // 2. Load active meal plan for today
    const loadHomeData = async () => {
      setLoading(true);
      try {
        const [planRes, recipesRes] = await Promise.all([
          apiRequest('/meal-plans/active').catch(() => null),
          apiRequest('/recipes?limit=6').catch(() => [])
        ]);

        if (planRes && planRes.items) {
          // Filter items matching today
          const todaysItems = planRes.items.filter((item: any) =>
            item.day_of_week?.toLowerCase() === todayName.toLowerCase()
          );
          setTodayPlan(todaysItems);
        }

        if (Array.isArray(recipesRes)) {
          setRecentRecipes(recipesRes.slice(0, 4));
        }
      } catch (err) {
        console.warn('Home fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [todayName]);

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
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-8 animate-in fade-in">
      
      {/* Top Banner with Greeting & Personalization Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900/40 border border-zinc-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recetario Familiar Inteligente</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            Hola, {user?.full_name || user?.username || 'Familia'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            ¿Qué cocinamos hoy? Tu menú, despensa y asistente dietético al día.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-semibold transition-all self-start sm:self-auto shadow-sm"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>Personalizar Inicio</span>
        </button>
      </div>

      {/* Widget 1: ¿Qué tenemos planificado para hoy? */}
      {widgets.showTodayPlan && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                ¿Qué tenemos planificado para hoy ({todayName})?
              </h2>
            </div>
            <Link
              to="/planner"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
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
                  className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-zinc-800 text-amber-400">
                      {item.meal_type === 'desayuno' ? 'Desayuno' : item.meal_type === 'cena' ? 'Cena' : 'Comida'}
                    </span>
                    {item.recipe_id && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Planificado
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {item.recipe?.title || item.custom_meal_title || 'Plato del día'}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {item.recipe?.cuisine || 'Cocina casera'}
                    </p>
                  </div>

                  {item.recipe_id ? (
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
                      <Link
                        to={`/recipes/${item.recipe_id}`}
                        className="flex-1 text-center py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium transition-colors"
                      >
                        Ver receta
                      </Link>
                      <Link
                        to={`/recipes/${item.recipe_id}/cook`}
                        className="flex-1 text-center py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs text-black font-bold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Cocinar
                      </Link>
                    </div>
                  ) : (
                    <Link
                      to="/planner"
                      className="text-center py-1.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-xs text-zinc-400 font-medium transition-colors"
                    >
                      Asignar receta
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-zinc-200">Aún no has planificado las comidas para hoy ({todayName})</p>
                <p className="text-xs text-zinc-500">Añade recetas al planificador para tener la lista de la compra organizada.</p>
              </div>
              <Link
                to="/planner"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors inline-flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Planificar Hoy
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Widget 2: Asistente Dietético Familiar (Tips y Asesoría Interactiva) */}
      {widgets.showDietAssistant && (
        <section className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Asistente Dietético Familiar
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    Recomendación
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">Nutrición preventiva y optimización culinaria para tu familia</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDietAssistantModal(true)}
              className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2 self-start sm:self-auto shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Consultar Asistente Dietético</span>
            </button>
          </div>

          {/* Daily Quick Tip */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-emerald-500/20 flex items-start gap-3">
            <Flame className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <strong className="text-emerald-300">Tip saludable de hoy:</strong> Prioriza técnicas de cocción al vapor (Thermomix Varoma) o tostado con aire (Airfryer a 180°C con pulverización de AOVE) para reducir grasas saturadas conservando los aromas y vitaminas naturales.
            </div>
          </div>
        </section>
      )}

      {/* Widget 3: Últimas Recetas Añadidas */}
      {widgets.showRecentRecipes && recentRecipes.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Últimas Recetas</h2>
            </div>
            <Link
              to="/recipes"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              <span>Explorar todo el recetario</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {recentRecipes.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.id}`}
                className="group relative flex flex-col bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-xl"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-800 relative">
                  <img
                    src={recipe.main_image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {recipe.meal_type && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-amber-400 border border-white/10">
                      {recipe.meal_type === 'desayuno' ? 'Desayuno' : recipe.meal_type === 'snacks' ? 'Snack' : 'Comida/Cena'}
                    </span>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {recipe.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        {recipe.total_time_min || 30}m
                      </span>
                      <span>·</span>
                      <span>{recipe.difficulty || 'Media'}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 2).map((tg: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Widget 4: Filtro Rápido por Electrodoméstico */}
      {widgets.showAppliances && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Cocina con tu electrodoméstico favorito
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Link
              to="/recipes?appliance=Thermomix"
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 flex flex-col items-center justify-center text-center space-y-1.5 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ChefHat className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Thermomix TM7</span>
              <span className="text-[10px] text-zinc-500">Pasos y velocidad guiada</span>
            </Link>

            <Link
              to="/recipes?appliance=Airfryer"
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 flex flex-col items-center justify-center text-center space-y-1.5 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Airfryer 6L</span>
              <span className="text-[10px] text-zinc-500">Asados y frituras ligeras</span>
            </Link>

            <Link
              to="/recipes?appliance=Tradicional"
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 flex flex-col items-center justify-center text-center space-y-1.5 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Utensils className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Tradicional</span>
              <span className="text-[10px] text-zinc-500">Cazuela y fuego lento</span>
            </Link>
          </div>
        </section>
      )}

      {/* Widget 5: Seis Grandes Áreas Funcionales */}
      {widgets.showFunctionalAreas && (
        <section className="space-y-3.5">
          <h2 className="text-base sm:text-lg font-bold text-white">Accesos Directos</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 md:gap-5">
            {areas.map((area, idx) => (
              <Link
                key={idx}
                to={area.path}
                className="group relative flex flex-col bg-zinc-900/80 rounded-2xl overflow-hidden border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 hover:shadow-xl hover:shadow-black/50"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-zinc-800 relative">
                  <img
                    src={area.image}
                    alt={area.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${area.accent} to-transparent opacity-60`} />
                </div>
                <div className="p-3.5 md:p-4 flex-1 flex flex-col justify-between space-y-1.5">
                  <div>
                    <h3 className="font-bold text-sm md:text-base text-zinc-100 group-hover:text-amber-400 transition-colors">
                      {area.title}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mt-0.5">
                      {area.desc}
                    </p>
                  </div>
                  <div className="pt-2 flex items-center text-xs font-semibold text-amber-500 group-hover:translate-x-1 transition-transform">
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Personalizar Página de Inicio</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Activa o desactiva las secciones según las preferencias de tu hogar. La configuración se guarda en tu perfil:
            </p>

            <div className="space-y-3">
              {[
                { key: 'showTodayPlan', label: '¿Qué tenemos planificado para hoy? (Menú del día)' },
                { key: 'showDietAssistant', label: 'Asistente Dietético Familiar (Tips y Consulta IA)' },
                { key: 'showRecentRecipes', label: 'Últimas recetas añadidas' },
                { key: 'showAppliances', label: 'Acceso rápido por electrodomésticos (Thermomix / Airfryer)' },
                { key: 'showFunctionalAreas', label: 'Accesos a las 6 áreas funcionales' },
              ].map(item => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors"
                >
                  <span className="text-xs font-medium text-zinc-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean((widgets as any)[item.key])}
                    onChange={(e) => {
                      const updated = { ...widgets, [item.key]: e.target.checked };
                      handleSaveWidgetConfig(updated);
                    }}
                    className="w-4 h-4 rounded text-amber-500 bg-zinc-800 border-zinc-700 focus:ring-amber-500 focus:ring-offset-zinc-900"
                  />
                </label>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors"
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
