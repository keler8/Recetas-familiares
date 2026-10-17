import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, Clock, Star, ChefHat, Play,
  Sparkles, Flame, Check, MessageSquare, StickyNote,
  AlertTriangle, Share2, Edit3
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { getOfflineRecipe } from '../services/db';

export const RecipeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedServings, setSelectedServings] = useState<number>(4);
  const [scaledData, setScaledData] = useState<any>(null);
  const [personalNote, setPersonalNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);

  const fetchRecipe = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/recipes/${id}`);
      setRecipe(data);
      setSelectedServings(data.base_servings || 4);
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
        setSelectedServings(offline.base_servings || 4);
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
            <button
              onClick={toggleFav}
              className="w-10 h-10 rounded-full bg-zinc-950/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:scale-105 transition-transform"
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
          </div>
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
            {[2, 4, 6, 8].map(s => (
              <button
                key={s}
                onClick={() => setSelectedServings(s)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  selectedServings === s
                    ? 'bg-zinc-800 text-white border-2 border-amber-500 shadow-sm'
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
