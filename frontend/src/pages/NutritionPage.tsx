import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, Sparkles, Shield, AlertCircle, Save, Check,
  Bot, Utensils, Flame, Clock, Zap, ChefHat, Users,
  ArrowRight, CheckCircle2, Sliders, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { DietaryAssistantModal } from '../components/DietaryAssistantModal';

export const NutritionPage: React.FC = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [diners, setDiners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);

  // Form states
  const [dietaryGoals, setDietaryGoals] = useState('Dieta mediterránea rica en verduras y AOVE');
  const [cookingHabits, setCookingHabits] = useState('Cocina diaria con Thermomix y Airfryer');
  const [availableTimeMin, setAvailableTimeMin] = useState(30);
  const [preferredFoods, setPreferredFoods] = useState('Verduras de temporada, pescado blanco, legumbres, fruta fresca');
  const [excludedFoods, setExcludedFoods] = useState('Fritos, ultraprocesados, exceso de sal');
  const [notes, setNotes] = useState('');

  // Selected quick habit chips
  const [recipeStyles, setRecipeStyles] = useState<string[]>([
    'Rápidas (<20 min)',
    'Sencillas (pocos ingredientes)',
    'Aptas para tupper'
  ]);

  const quickStyleOptions = [
    { id: 'Rápidas (<20 min)', desc: 'Platos express de menos de 20 minutos' },
    { id: 'Sencillas (pocos ingredientes)', desc: 'Elaboraciones fáciles y sin complicaciones' },
    { id: 'Aptas para tupper', desc: 'Se conservan y recalientan perfectamente' },
    { id: 'Batch cooking de finde', desc: 'Cocinar en bloque para toda la semana' },
    { id: 'Cenas ligeras', desc: 'Digestión fácil, bajas en carbohidratos refinados' },
    { id: 'Gusta a toda la familia', desc: 'Recetas apetecibles para niños y mayores' },
    { id: 'Ricas en proteína', desc: 'Aportes limpios de legumbres, huevos y pescados' },
    { id: 'Antiinflamatoria', desc: 'AOVE, cúrcuma, semillas y vegetales de colores' }
  ];

  const fetchProfileAndHousehold = async () => {
    setLoading(true);
    try {
      const [profData, hhData] = await Promise.all([
        apiRequest('/nutrition/profile').catch(() => null),
        apiRequest('/households/current').catch(() => null)
      ]);

      if (profData) {
        setProfile(profData);
        if (profData.dietary_goals) setDietaryGoals(profData.dietary_goals);
        if (profData.cooking_habits) setCookingHabits(profData.cooking_habits);
        if (profData.available_time_min) setAvailableTimeMin(profData.available_time_min);
        if (profData.preferred_foods) setPreferredFoods(profData.preferred_foods);
        if (profData.excluded_foods) setExcludedFoods(profData.excluded_foods);
        if (profData.notes) setNotes(profData.notes);

        if (profData.notes && profData.notes.includes('Estilos:')) {
          try {
            const match = profData.notes.match(/Estilos:\s*\[(.*?)\]/);
            if (match && match[1]) {
              const styles = match[1].split(',').map((s: string) => s.trim().replace(/^"|"$/g, ''));
              setRecipeStyles(styles);
            }
          } catch {}
        }
      }

      if (hhData && hhData.diners) {
        setDiners(hhData.diners);
      }
    } catch (err) {
      console.warn('Error fetching nutrition profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndHousehold();
  }, []);

  const toggleStyle = (styleId: string) => {
    setRecipeStyles(prev =>
      prev.includes(styleId) ? prev.filter(s => s !== styleId) : [...prev, styleId]
    );
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      const encodedNotes = `${notes ? notes + '\n' : ''}Estilos: [${recipeStyles.map(s => `"${s}"`).join(', ')}]`;

      await apiRequest('/nutrition/profile', {
        method: 'PUT',
        body: JSON.stringify({
          dietary_goals: dietaryGoals,
          cooking_habits: `${cookingHabits}. Preferencia: ${recipeStyles.join(', ')}`,
          available_time_min: Number(availableTimeMin),
          preferred_foods: preferredFoods,
          excluded_foods: excludedFoods,
          focus_on_healthy: true,
          notes: encodedNotes
        })
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 dark:text-zinc-500 text-sm">
        Cargando perfil de alimentación...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6 pb-24 animate-in fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
            <Heart className="w-3.5 h-3.5" />
            <span>Nutrición y Hábitos Familiares</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Mi Alimentación y Asistente Dietético
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Configura tus preferencias, hábitos, recetas deseadas y restricciones para que la IA personalice tus menús y recomendaciones culinarias.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDietModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-auto shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Consultar Asistente Dietético</span>
        </button>
      </div>

      {/* Legal & Medical Disclaimer Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          {t('disclaimer_nutrition') || 'La información ofrecida por el Asistente Dietético tiene carácter orientativo y culinario. Para diagnósticos clínicos o prescripciones médicas, consulta siempre a un profesional sanitario colegiado.'}
        </p>
      </div>

      {/* Section 1: Estilo de Recetas y Hábitos de Cocina */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                ¿Cómo quieres que sean tus recetas habituales?
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                La IA priorizará estas pautas al proponerte recetas y diseñar el menú semanal
              </p>
            </div>
          </div>
        </div>

        {/* Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {quickStyleOptions.map(opt => {
            const isSelected = recipeStyles.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleStyle(opt.id)}
                className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 dark:text-white ring-1 ring-amber-500/30'
                    : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? 'bg-amber-500 border-amber-500 text-black'
                    : 'border-slate-300 dark:border-zinc-700'
                }`}>
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">{opt.id}</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Time Slider */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              Tiempo máximo que quieres dedicar a cocinar entre semana:
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-sm">
              {availableTimeMin} minutos
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={availableTimeMin}
            onChange={(e) => setAvailableTimeMin(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500">
            <span>10 min (Express)</span>
            <span>30 min (Media habitual)</span>
            <span>60+ min (Elaborada)</span>
          </div>
        </div>
      </div>

      {/* Section 2: Objetivos Dietéticos y Preferencias de Ingredientes */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Enfoque y Preferencias Nutricionales
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Personaliza el tipo de dieta y los alimentos que más o menos os gustan
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Objetivo dietético principal del hogar:
            </label>
            <input
              type="text"
              value={dietaryGoals}
              onChange={(e) => setDietaryGoals(e.target.value)}
              placeholder="ej. Dieta mediterránea tradicional, antiinflamatoria, baja en sal, celiaquía..."
              className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Electrodomésticos y hábitos del día a día:
            </label>
            <input
              type="text"
              value={cookingHabits}
              onChange={(e) => setCookingHabits(e.target.value)}
              placeholder="ej. Uso a diario de Thermomix TM7 y Airfryer, cenas en 15 minutos, comida para tuppers..."
              className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" />
                Alimentos favoritos / deseados:
              </label>
              <textarea
                rows={2}
                value={preferredFoods}
                onChange={(e) => setPreferredFoods(e.target.value)}
                placeholder="ej. Salmón, calabacín, legumbres, arroz integral, frutos secos..."
                className="w-full mt-1.5 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ThumbsDown className="w-3.5 h-3.5" />
                Alimentos a excluir o evitar:
              </label>
              <textarea
                rows={2}
                value={excludedFoods}
                onChange={(e) => setExcludedFoods(e.target.value)}
                placeholder="ej. Fritos, salsas pesadas, picante intenso, ultraprocesados..."
                className="w-full mt-1.5 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Personas de mi Hogar (Comensales con Restricciones) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Personas de mi Hogar ({diners.length} comensales)
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Alergias e intolerancias individuales que la IA tiene en cuenta para cada plato
              </p>
            </div>
          </div>

          <Link
            to="/admin?tab=users"
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            <span>Gestionar en Ajustes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {diners.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {diners.map(diner => (
              <div
                key={diner.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{diner.name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    {diner.dietary_preference || 'Sin restricción'}
                  </span>
                </div>
                {diner.restrictions && diner.restrictions.length > 0 ? (
                  <div className="space-y-1">
                    {diner.restrictions.map((r: any, idx: number) => (
                      <div key={idx} className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                        <span>⚠️ {r.restriction_type || 'Alergia'}: {r.details || 'Registrada'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">Sin alergias registradas</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Aún no has agregado los comensales de tu casa (Papá, Mamá, niños...).
            </span>
            <Link
              to="/admin?tab=users"
              className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors"
            >
              + Añadir personas
            </Link>
          </div>
        )}
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="text-xs text-slate-500 dark:text-zinc-400">
          {savedSuccess ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              ¡Preferencias de alimentación guardadas con éxito!
            </span>
          ) : (
            <span>Los cambios afectarán inmediatamente al Planificador y al Asistente IA.</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Guardando...' : 'Guardar Preferencias'}</span>
        </button>
      </div>

      {/* Dietary Assistant Modal */}
      <DietaryAssistantModal
        isOpen={showDietModal}
        onClose={() => setShowDietModal(false)}
      />

    </div>
  );
};
