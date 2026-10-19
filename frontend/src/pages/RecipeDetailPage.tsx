import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Heart, Clock, Star, ChefHat, Play,
  Sparkles, Flame, Check, MessageSquare, StickyNote,
  AlertTriangle, Share2, Edit3, ExternalLink, Trash2, Lock, Lightbulb, Unlock, Users
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { getOfflineRecipe } from '../services/db';

export const RecipeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedServings, setSelectedServings] = useState<number>(() => {
    const queryServings = searchParams.get('servings');
    if (queryServings && Number(queryServings) > 0) {
      return Number(queryServings);
    }
    try {
      const saved = localStorage.getItem('user_default_servings');
      return saved ? Number(saved) : 4;
    } catch {
      return 4;
    }
  });
  const [scaledData, setScaledData] = useState<any>(null);
  const [personalNote, setPersonalNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);
  const [isRecalculatingNutrition, setIsRecalculatingNutrition] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);

  const handleTogglePrivacy = async () => {
    if (!recipe) return;
    setIsTogglingPrivacy(true);
    try {
      const res = await apiRequest(`/recipes/${recipe.id}/toggle-privacy`, { method: 'POST' });
      setRecipe({ ...recipe, is_private: res.is_private });
    } catch (err: any) {
      alert(`Error al cambiar privacidad: ${err.message || err}`);
    } finally {
      setIsTogglingPrivacy(false);
    }
  };

  const handleAiReview = async () => {
    if (!recipe) return;
    setIsAiReviewing(true);
    try {
      const updated = await apiRequest(`/recipes/${recipe.id}/ai-review`, { method: 'POST' });
      setRecipe(updated);
    } catch (err: any) {
      alert(`Error en el vistazo IA: ${err.message || err}`);
    } finally {
      setIsAiReviewing(false);
    }
  };

  const handleRecalculateNutrition = async () => {
    if (!recipe) return;
    setIsRecalculatingNutrition(true);
    try {
      const updated = await apiRequest(`/recipes/${recipe.id}/recalculate-nutrition`, {
        method: 'POST'
      });
      setRecipe(updated);
    } catch (err: any) {
      alert(`Error al estimar calorías: ${err.message || err}`);
    } finally {
      setIsRecalculatingNutrition(false);
    }
  };

  const [isGeneratingTips, setIsGeneratingTips] = useState(false);
  const handleGenerateTips = async () => {
    if (!recipe) return;
    setIsGeneratingTips(true);
    try {
      const updated = await apiRequest(`/recipes/${recipe.id}/suggest-tips`, {
        method: 'POST'
      });
      setRecipe(updated);
    } catch (err: any) {
      alert(`Error al generar consejos con IA: ${err.message || err}`);
    } finally {
      setIsGeneratingTips(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!recipe) return;
    const ok = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la receta "${recipe.title}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setIsDeleting(true);
    try {
      await apiRequest(`/recipes/${recipe.id}`, { method: 'DELETE' });
      navigate('/recipes');
    } catch (err: any) {
      alert(`Error al eliminar receta: ${err.message || err}`);
      setIsDeleting(false);
    }
  };

  const fetchRecipe = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/recipes/${id}`);
      setRecipe(data);

      const queryServings = searchParams.get('servings');
      if (queryServings && Number(queryServings) > 0) {
        setSelectedServings(Number(queryServings));
      } else {
        const userSaved = (() => {
          try {
            const s = localStorage.getItem('user_default_servings');
            return s ? Number(s) : null;
          } catch {
            return null;
          }
        })();
        setSelectedServings(userSaved || data.base_servings || 4);
      }

      setPersonalNote(data.personal_notes || '');

      // Set default variant
      if (data.variants && data.variants.length > 0) {
        const def = data.variants.find((v: any) => v.is_default) || data.variants[0];
        setSelectedVariantId(def.id);
      }
    } catch (err) {
      console.warn('Network fetch failed, attempting offline IndexedDB load:', err);
      const offline = await getOfflineRecipe(Number(id));
      if (offline) {
        setRecipe(offline);
        const queryServings = searchParams.get('servings');
        if (queryServings && Number(queryServings) > 0) {
          setSelectedServings(Number(queryServings));
        } else {
          const userSaved = (() => {
            try {
              const s = localStorage.getItem('user_default_servings');
              return s ? Number(s) : null;
            } catch {
              return null;
            }
          })();
          setSelectedServings(userSaved || offline.base_servings || 4);
        }
        if (offline.variants && offline.variants.length > 0) {
          setSelectedVariantId(offline.variants[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipe();
  }, [id]);

  // Handle scaling when servings change
  useEffect(() => {
    if (!recipe) return;
    const scale = async () => {
      try {
        const res = await apiRequest(`/recipes/${id}/scale?target_servings=${selectedServings}&variant_id=${selectedVariantId || ''}`, {
          method: 'POST'
        });
        setScaledData(res);
      } catch (err) {
        console.warn('Scaling error:', err);
      }
    };
    scale();
  }, [selectedServings, selectedVariantId, recipe]);

  const toggleFav = async () => {
    if (!recipe) return;
    try {
      const res = await apiRequest(`/recipes/${recipe.id}/favorite`, { method: 'POST' });
      setRecipe({ ...recipe, is_favorite: res.is_favorite });
    } catch (err) {
      console.warn('Fav error:', err);
    }
  };

  const saveNote = async () => {
    if (!recipe) return;
    setIsSavingNote(true);
    try {
      await apiRequest(`/recipes/${recipe.id}/note`, {
        method: 'PUT',
        body: JSON.stringify({ notes: personalNote })
      });
    } catch (err) {
      console.warn('Note save error:', err);
    } finally {
      setIsSavingNote(false);
    }
  };

  const generateVariant = async (appliance: string) => {
    if (!recipe) return;
    setIsGeneratingVariant(true);
    try {
      await apiRequest(`/recipes/${recipe.id}/generate-variant?target_appliance=${appliance}`, {
        method: 'POST'
      });
      await fetchRecipe();
    } catch (err) {
      alert(`Error generando variante: ${err}`);
    } finally {
      setIsGeneratingVariant(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-zinc-500 text-sm">Cargando receta...</div>;
  }

  if (!recipe) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-zinc-400">Receta no encontrada</p>
        <Link to="/recipes" className="text-amber-400 text-sm font-semibold">Volver a recetas</Link>
      </div>
    );
  }

  const currentVariant = recipe.variants?.find((v: any) => v.id === selectedVariantId) || recipe.variants?.[0];
  const displayedIngredients = scaledData?.scaled_ingredients || currentVariant?.ingredients || [];

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-12 bg-zinc-950 min-h-screen">
      {/* Top Hero Image with Back Button */}
      <div className="relative aspect-[16/11] w-full bg-zinc-900 overflow-hidden">
        <img
          src={recipe.main_image_url || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80'}
          alt={recipe.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

        {/* Back and Action buttons */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <Link
              to={`/recipes/${recipe.id}/edit`}
              className="w-10 h-10 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800/80 hover:scale-105 transition-all shadow-sm"
              title="Editar receta"
            >
              <Edit3 className="w-4 h-4" />
            </Link>

            <button
              onClick={handleDeleteRecipe}
              disabled={isDeleting}
              className="w-10 h-10 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 hover:scale-105 transition-all shadow-sm disabled:opacity-50"
              title="Eliminar receta"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFav}
              className="w-10 h-10 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:scale-105 transition-transform"
              title="Añadir a favoritos"
            >
              <Heart className={`w-5 h-5 ${recipe.is_favorite ? 'text-rose-500 fill-rose-500' : 'text-zinc-200'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 -mt-6 relative z-10 space-y-6">
        {/* Title and Metadata matching Screenshot 3 */}
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
            {recipe.title}
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            {recipe.dish_type} · {recipe.total_time_min} minutos · {recipe.difficulty === 'facil' ? 'Fácil' : recipe.difficulty}
          </p>

          {/* Badges: Thermomix, Tradicional, Sin Gluten, etc. */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {recipe.is_private && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-500/25 border border-purple-500/40 text-purple-300 flex items-center gap-1.5 shadow-sm">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>Receta Privada</span>
              </span>
            )}
            {recipe.variants?.map((v: any) => (
              <span
                key={v.id}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 capitalize"
              >
                {v.variant_type}
              </span>
            ))}
            {recipe.tags?.map((t: string, i: number) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-400"
              >
                {t}
              </span>
            ))}
            {recipe.source_url && (recipe.source_url.startsWith('http://') || recipe.source_url.startsWith('https://')) && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 transition-colors flex items-center gap-1.5"
                title="Abrir documento original"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                <span>{recipe.source_url.includes('google.com') ? 'Google Drive' : 'Fuente'}</span>
              </a>
            )}
          </div>

          {/* Privacy status & action banner */}
          <div className="mt-4 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs">
              {recipe.is_private ? (
                <>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-purple-300 block">Receta Privada (Cajón personal)</span>
                    <span className="text-zinc-400 text-[11px]">Solo tú puedes verla en tu cuenta.</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-blue-300 block">Receta Familiar</span>
                    <span className="text-zinc-400 text-[11px]">Visible en el recetario común de toda la familia.</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTogglePrivacy}
                disabled={isTogglingPrivacy}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 ${
                  recipe.is_private
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
                title={recipe.is_private ? "Compartir con el recetario familiar" : "Hacer privada"}
              >
                {recipe.is_private ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Pasar a Familiar</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Mover a Privada</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleAiReview}
                disabled={isAiReviewing}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                title="Buscar foto con IA y generar trucos + calorías"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiReviewing ? 'animate-spin' : ''}`} />
                <span>{isAiReviewing ? 'Revisando...' : 'Vistazo IA'}</span>
              </button>
            </div>
          </div>

          {/* Nutritional Info Banner */}
          {recipe.nutrition_calories ? (
            <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 fill-amber-500/30 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-400">
                    {Math.round(recipe.nutrition_calories)} kcal <span className="text-[11px] text-zinc-400 font-normal">/ ración</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 flex-wrap">
                    {recipe.nutrition_protein && <span>🥩 Prot: <strong className="text-zinc-200">{Math.round(recipe.nutrition_protein)}g</strong></span>}
                    {recipe.nutrition_carbs && <span>🌾 Carbs: <strong className="text-zinc-200">{Math.round(recipe.nutrition_carbs)}g</strong></span>}
                    {recipe.nutrition_fat && <span>🥑 Grasas: <strong className="text-zinc-200">{Math.round(recipe.nutrition_fat)}g</strong></span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRecalculateNutrition}
                disabled={isRecalculatingNutrition}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 transition-all shrink-0 flex items-center gap-1.5 shadow"
                title="Recalcular calorías y macros con Gemini IA"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isRecalculatingNutrition ? 'animate-spin' : ''}`} />
                <span>{isRecalculatingNutrition ? 'Calculando...' : 'Re-estimar'}</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400">🔥 Calorías no estimadas aún</span>
              <button
                type="button"
                onClick={handleRecalculateNutrition}
                disabled={isRecalculatingNutrition}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 transition-all shadow"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRecalculatingNutrition ? 'animate-spin' : ''}`} />
                <span>{isRecalculatingNutrition ? 'Calculando con IA...' : 'Calcular calorías con IA'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modo de preparación Selector matching Screenshot 3 */}
        {recipe.variants && recipe.variants.length > 1 && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {t('prep_mode')}
            </label>
            <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-800">
              {recipe.variants.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize ${
                    v.id === selectedVariantId
                      ? 'bg-zinc-800 text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {v.title || v.variant_type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Raciones Pills matching Screenshot 3 */}
        <div className="flex items-center justify-between py-2 border-y border-zinc-800/80">
          <span className="text-sm font-bold text-white">{t('servings')}</span>
          <div className="flex items-center gap-2">
            {Array.from(new Set([1, 2, selectedServings, 4, 6, 8]))
              .filter(s => s > 0)
              .sort((a, b) => a - b)
              .map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedServings(s)}
                  className={`min-w-9 h-9 px-2 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    selectedServings === s
                      ? 'bg-amber-500 text-zinc-950 font-black border-2 border-amber-400 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {s}
                </button>
              ))}
          </div>
        </div>

        {/* Scaling warnings if any */}
        {scaledData?.culinary_warnings?.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Ajustes culinarios automáticos:</span>
            </div>
            {scaledData.culinary_warnings.map((w: string, i: number) => (
              <p key={i} className="text-zinc-300 text-[11px]">• {w}</p>
            ))}
          </div>
        )}

        {/* Ingredientes matching Screenshot 3 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">{t('ingredients')}</h2>
            <span className="text-xs text-zinc-400">Para {selectedServings} raciones</span>
          </div>
          <div className="bg-zinc-900/60 rounded-xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
            {displayedIngredients.map((ing: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-zinc-200 font-medium">{ing.name}</span>
                <span className="text-zinc-400 font-semibold text-xs">
                  {ing.scaled_amount !== undefined ? ing.scaled_amount : ing.amount} {ing.unit || ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Preparación Paso a Paso matching Screenshot 3 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">{t('preparation')}</h2>
            {currentVariant?.appliance_settings && (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {currentVariant.variant_type.toUpperCase()}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {currentVariant?.steps?.map((step: any, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-zinc-900 rounded-xl border border-zinc-800/80 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {step.step_number}
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-sm text-zinc-200 leading-relaxed">
                      {step.instruction}
                    </p>

                    {/* Step Appliance Badges (Speed, Temp, Accessory) */}
                    {(step.temperature || step.speed || step.accessory || step.timer_seconds) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                        {step.temperature && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-[11px] font-bold">
                            🌡️ {step.temperature}
                          </span>
                        )}
                        {step.speed && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                            ⚙️ {step.speed}
                          </span>
                        )}
                        {step.accessory && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                            🥄 {step.accessory}
                          </span>
                        )}
                        {step.timer_seconds && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[11px] font-bold">
                            ⏱️ {Math.round(step.timer_seconds / 60)} min
                          </span>
                        )}
                      </div>
                    )}

                    {step.tip && (
                      <p className="text-xs text-amber-300/80 italic pt-1">
                        💡 {step.tip}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consejos, Trucos y Conservación */}
        <div className="p-4 md:p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>Consejos y Trucos de la Receta</span>
            </h3>

            {(!recipe.chef_notes && !recipe.preservation_tips && !recipe.freezing_tips && !recipe.reheating_tips) && (
              <button
                type="button"
                onClick={handleGenerateTips}
                disabled={isGeneratingTips}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-sm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingTips ? 'animate-spin' : ''}`} />
                <span>{isGeneratingTips ? 'Generando...' : 'Obtener trucos con IA'}</span>
              </button>
            )}
          </div>

          {(recipe.chef_notes || recipe.preservation_tips || recipe.freezing_tips || recipe.reheating_tips) ? (
            <div className="space-y-3">
              {recipe.chef_notes && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span>👨‍🍳 Secreto del Chef</span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed">
                    {recipe.chef_notes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {recipe.preservation_tips && (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1 text-xs">
                    <span className="font-bold text-zinc-300 block">🧊 Conservación</span>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">{recipe.preservation_tips}</p>
                  </div>
                )}
                {recipe.freezing_tips && (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1 text-xs">
                    <span className="font-bold text-zinc-300 block">❄️ Congelación</span>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">{recipe.freezing_tips}</p>
                  </div>
                )}
                {recipe.reheating_tips && (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1 text-xs">
                    <span className="font-bold text-zinc-300 block">♨️ Recalentado</span>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">{recipe.reheating_tips}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
              <span>Aún no hay trucos guardados para esta receta.</span>
              <button
                type="button"
                onClick={handleGenerateTips}
                disabled={isGeneratingTips}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline"
              >
                Generar con IA
              </button>
            </div>
          )}
        </div>

        {/* Generate AI Variant Button */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Generar nueva variante con IA</span>
          </div>
          <p className="text-xs text-zinc-400">
            Adapta automáticamente las temperaturas, accesorios y velocidades sin modificar esta ficha base.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => generateVariant('thermomix')}
              disabled={isGeneratingVariant}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
            >
              Versión Thermomix TM7
            </button>
            <button
              onClick={() => generateVariant('airfryer')}
              disabled={isGeneratingVariant}
              className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
            >
              Versión Airfryer 6L
            </button>
          </div>
        </div>

        {/* Original Document / Provenance */}
        {recipe.source_url && (recipe.source_url.startsWith('http://') || recipe.source_url.startsWith('https://')) && (
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {recipe.source_url.includes('google.com') ? 'Documento original en Google Drive' : 'Fuente original de la receta'}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {recipe.source_url.includes('docs.google.com/document') ? 'Google Doc editable original' : 'Archivo original importado'}
                </p>
              </div>
            </div>
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>Abrir archivo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Private Personal Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-amber-400" />
              <span>Mis notas personales (privadas)</span>
            </label>
            <button
              onClick={saveNote}
              disabled={isSavingNote}
              className="text-xs font-bold text-amber-400 hover:underline"
            >
              {isSavingNote ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="Añade tus observaciones, cambios de ingredientes o trucos personales..."
            rows={2}
            className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Sticky Bottom Action: Cocina Guiada */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 p-3 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800/80 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            to={`/recipes/${recipe.id}/cook?variant=${selectedVariantId || ''}&servings=${selectedServings}`}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-transform active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-zinc-950" />
            <span>{t('start_cooking')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
