import React, { useState, useEffect } from 'react';
import {
  Sparkles, X, Send, Bot, Heart, Flame, ShieldCheck,
  CheckCircle, ArrowRight, ChefHat, BookOpen, AlertCircle
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface DietaryAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecipeId?: number;
}

export const DietaryAssistantModal: React.FC<DietaryAssistantModalProps> = ({
  isOpen,
  onClose,
  initialRecipeId
}) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [dietaryGoal, setDietaryGoal] = useState('Dieta mediterránea equilibrada');
  const [customGoal, setCustomGoal] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | undefined>(initialRecipeId);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load current nutrition profile and recipes list
      apiRequest('/nutrition/profile').then(data => {
        setProfile(data);
        if (data.dietary_goals) {
          setDietaryGoal(data.dietary_goals);
        }
      }).catch(err => console.warn('Profile fetch error:', err));

      apiRequest('/recipes').then(data => {
        setRecipes(data);
      }).catch(err => console.warn('Recipes fetch error:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const popularDiets = [
    { id: 'Dieta mediterránea rica en verduras y AOVE', label: 'Mediterránea' },
    { id: 'Dieta antiinflamatoria (omega-3, cúrcuma, sin ultraprocesados)', label: 'Antiinflamatoria' },
    { id: 'Baja en sal (DASH para hipertensión arterial)', label: 'Baja en sal' },
    { id: 'Cenas ligeras y bajas en carbohidratos refinados', label: 'Cenas ligeras' },
    { id: 'Apta para celíacos y sin gluten', label: 'Sin gluten' },
    { id: 'Alta en proteína vegetal y legumbres', label: 'Proteica / Vegetariana' }
  ];

  const handleAskAssistant = async (customPrompt?: string) => {
    const promptToSend = customPrompt || query;
    if (!promptToSend.trim() && !selectedRecipeId) return;

    setLoading(true);
    setResponse(null);

    try {
      // Save current goal preference to profile in background
      const activeGoal = customGoal.trim() ? `${dietaryGoal}. Notas: ${customGoal.trim()}` : dietaryGoal;
      await apiRequest('/nutrition/profile', {
        method: 'PUT',
        body: JSON.stringify({ dietary_goals: activeGoal })
      }).catch(() => null);

      const res = await apiRequest('/nutrition/advice', {
        method: 'POST',
        body: JSON.stringify({
          query: promptToSend || 'Recomienda adaptaciones saludables para la receta seleccionada.',
          target_recipe_id: selectedRecipeId || null
        })
      });

      setResponse(res);
      setQuery('');
    } catch (err: any) {
      alert(`Error en el asistente: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHealthyRecipe = async (variant: any) => {
    if (!variant) return;
    setIsSavingRecipe(true);
    try {
      const created = await apiRequest('/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: variant.title,
          description: variant.description || 'Receta saludable adaptada por el Asistente Dietético.',
          tags: ['saludable', 'top_receta'],
          meal_type: 'comida_cena',
          prep_time_min: variant.prep_time_min || 15,
          cook_time_min: variant.cook_time_min || 20,
          total_time_min: (variant.prep_time_min || 15) + (variant.cook_time_min || 20),
          base_servings: 4,
          variants: [
            {
              variant_type: 'traditional',
              title: 'Preparación saludable',
              is_default: true,
              ingredients: variant.ingredients || [],
              steps: variant.steps || []
            }
          ]
        })
      });

      alert('¡Receta saludable guardada con éxito en tu recetario!');
      onClose();
      navigate(`/recipes/${created.id}`);
    } catch (err: any) {
      alert(`Error al guardar receta: ${err.message || err}`);
    } finally {
      setIsSavingRecipe(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Asistente Dietético Familiar
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">IA Saludable</span>
              </h2>
              <p className="text-xs text-zinc-400">Nutrición preventiva, sustituciones saludables y adaptación culinaria</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Section 1: Diet Goal Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              1. Enfoque o Tipo de Dieta Familiar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {popularDiets.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDietaryGoal(d.id)}
                  className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    dietaryGoal === d.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-semibold shadow-sm'
                      : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="Añadir notas particulares (ej. 'Mi hijo no toma lactosa y queremos cenar sin fritos')..."
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Section 2: Recipe target (optional) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5 text-amber-400" />
              2. ¿Deseas adaptar una receta existente? (Opcional)
            </label>
            <select
              value={selectedRecipeId || ''}
              onChange={(e) => setSelectedRecipeId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">-- Ninguna (Consulta general o pedir nueva recomendación) --</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.base_servings} raciones · {r.total_time_min} min)
                </option>
              ))}
            </select>
          </div>

          {/* Assistant Response Card */}
          {response && (
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-emerald-500/30 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Diagnóstico y Consejo Dietético
              </div>

              <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-800/80">
                {response.advice}
              </div>

              {response.suggested_modifications?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                    <Flame className="w-3.5 h-3.5" />
                    Sustituciones Saludables Propuestas:
                  </h4>
                  <ul className="space-y-1.5">
                    {response.suggested_modifications.map((mod: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{mod}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {response.healthy_recipe_variant && (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{response.healthy_recipe_variant.title}</h4>
                      <p className="text-xs text-zinc-400">{response.healthy_recipe_variant.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isSavingRecipe}
                      onClick={() => handleSaveHealthyRecipe(response.healthy_recipe_variant)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      {isSavingRecipe ? 'Guardando...' : 'Guardar en Recetario'}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 flex items-center gap-1 italic">
                <AlertCircle className="w-3 h-3 text-zinc-600 shrink-0" />
                {response.disclaimer}
              </p>
            </div>
          )}

          {/* Quick Prompts */}
          {!response && !loading && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400 font-medium">Sugerencias rápidas:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAskAssistant('¿Qué puedo cenar hoy ligero y saludable con verduras y proteína?')}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition-colors"
                >
                  💡 Cena ligera y saludable para hoy
                </button>
                <button
                  type="button"
                  onClick={() => handleAskAssistant('Cómo reducir las calorías de mis platos habituales sin perder sabor')}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition-colors"
                >
                  🔥 Reducir calorías manteniendo sabor
                </button>
                <button
                  type="button"
                  onClick={() => handleAskAssistant('Ideas para incorporar más legumbres y fibra en la dieta familiar')}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs transition-colors"
                >
                  🥗 Aumentar legumbres y fibra
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Input */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()}
            placeholder="Escribe tu consulta dietética o pide una receta saludable..."
            className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAskAssistant()}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors shrink-0"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Consultar</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
