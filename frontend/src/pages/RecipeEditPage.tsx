import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Sparkles, ChefHat,
  Tag, Sun, Utensils, Apple, Coffee, ExternalLink,
  Image as ImageIcon, Camera, Link as LinkIcon, Wand2, Search, Check, RefreshCw,
  Lock, Globe, Lightbulb
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const RecipeEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [mealType, setMealType] = useState('comida_cena');
  const [dishType, setDishType] = useState('Plato principal');
  const [cuisine, setCuisine] = useState('Mediterránea');
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(20);
  const [difficulty, setDifficulty] = useState('media');
  const [servings, setServings] = useState(4);
  const [selectedTags, setSelectedTags] = useState<string[]>(['saludable']);
  const [customTagInput, setCustomTagInput] = useState('');

  // Tips & culinary notes state
  const [chefNotes, setChefNotes] = useState('');
  const [preservationTips, setPreservationTips] = useState('');
  const [freezingTips, setFreezingTips] = useState('');
  const [reheatingTips, setReheatingTips] = useState('');
  const [isSuggestingTips, setIsSuggestingTips] = useState(false);

  // Nutrition state
  const [nutritionCalories, setNutritionCalories] = useState<number | string>('');
  const [nutritionProtein, setNutritionProtein] = useState<number | string>('');
  const [nutritionCarbs, setNutritionCarbs] = useState<number | string>('');
  const [nutritionFat, setNutritionFat] = useState<number | string>('');
  const [isEstimatingNutrition, setIsEstimatingNutrition] = useState(false);

  const handleEstimateNutrition = async () => {
    if (!title.trim() && ingredients.filter(i => i.name.trim()).length === 0) {
      alert('Introduce al menos el título o algunos ingredientes para estimar las calorías.');
      return;
    }
    setIsEstimatingNutrition(true);
    try {
      const res = await apiRequest('/recipes/estimate-nutrition', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || 'Receta',
          ingredients: ingredients.filter(i => i.name.trim()),
          base_servings: Number(servings || 4),
          dish_type: dishType
        })
      });
      if (res) {
        if (res.calories !== undefined) setNutritionCalories(res.calories);
        if (res.protein !== undefined) setNutritionProtein(res.protein);
        if (res.carbs !== undefined) setNutritionCarbs(res.carbs);
        if (res.fat !== undefined) setNutritionFat(res.fat);
      }
    } catch (err: any) {
      alert(`Error al estimar nutrición con IA: ${err.message || err}`);
    } finally {
      setIsEstimatingNutrition(false);
    }
  };

  const handleSuggestTips = async () => {
    if (!title.trim()) {
      alert('Introduce el título de la receta antes de solicitar consejos a la IA.');
      return;
    }
    setIsSuggestingTips(true);
    try {
      const res = await apiRequest('/recipes/suggest-tips', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          ingredients: ingredients.map(i => i.name).filter(Boolean),
          dish_type: dishType
        })
      });
      if (res) {
        if (res.chef_notes) setChefNotes(res.chef_notes);
        if (res.preservation_tips) setPreservationTips(res.preservation_tips);
        if (res.freezing_tips) setFreezingTips(res.freezing_tips);
        if (res.reheating_tips) setReheatingTips(res.reheating_tips);
      }
    } catch (err: any) {
      alert(`Error al sugerir consejos: ${err.message || err}`);
    } finally {
      setIsSuggestingTips(false);
    }
  };

  // Image selection state
  const [showImageSuggestions, setShowImageSuggestions] = useState(false);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [imageSearchInput, setImageSearchInput] = useState('');
  const [suggestedImages, setSuggestedImages] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadImageSuggestions = async (searchTerm?: string) => {
    const q = searchTerm !== undefined ? searchTerm : (imageSearchInput || title);
    if (!q || !q.trim()) {
      alert('Introduce un título o término para buscar imágenes');
      return;
    }
    setLoadingSuggestions(true);
    try {
      const endpoint = id
        ? `/recipes/${id}/suggest-images?query=${encodeURIComponent(q.trim())}`
        : `/recipes/suggest-images?query=${encodeURIComponent(q.trim())}&dish_type=${encodeURIComponent(dishType || '')}`;
      const data = await apiRequest<{ candidates: string[] }>(endpoint);
      setSuggestedImages(data?.candidates || []);
      setShowImageSuggestions(true);
    } catch (err: any) {
      console.warn('Could not load image suggestions:', err);
      alert(`Error al buscar imágenes: ${err.message || err}`);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearchImagesOnline = async (searchQuery?: string) => {
    const q = searchQuery !== undefined ? searchQuery : imageSearchInput;
    if (!q || !q.trim()) return;
    setIsSearchingImages(true);
    try {
      const endpoint = id
        ? `/recipes/${id}/suggest-images?query=${encodeURIComponent(q.trim())}`
        : `/recipes/suggest-images?query=${encodeURIComponent(q.trim())}&dish_type=${encodeURIComponent(dishType || '')}`;
      const data = await apiRequest<{ candidates: string[] }>(endpoint);
      setSuggestedImages(data?.candidates || []);
      setShowImageSuggestions(true);
    } catch (err: any) {
      console.warn('Could not search images online:', err);
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleSelectSuggestedImage = (imgUrl: string) => {
    setImageUrl(imgUrl);
  };

  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = id ? `/recipes/${id}/upload-image` : `/recipes/upload-image`;
      const res = await apiRequest<{ image_url: string }>(endpoint, {
        method: 'POST',
        body: formData
      });
      if (res && res.image_url) {
        setImageUrl(res.image_url);
      }
    } catch (err: any) {
      alert(`Error al subir la imagen: ${err.message || err}`);
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleApplyCustomImageUrl = () => {
    if (!customImageUrlInput.trim()) return;
    setImageUrl(customImageUrlInput.trim());
    setShowCustomUrlInput(false);
    setCustomImageUrlInput('');
  };

  // Variant & ingredients
  const [variantType, setVariantType] = useState('traditional');
  const [ingredients, setIngredients] = useState<any[]>([
    { name: '', amount: 1, unit: 'ud' }
  ]);
  const [steps, setSteps] = useState<any[]>([
    { step_number: 1, instruction: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteRecipe = async () => {
    if (!id) return;
    const ok = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la receta "${title}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setIsDeleting(true);
    try {
      await apiRequest(`/recipes/${id}`, { method: 'DELETE' });
      navigate('/recipes');
    } catch (err: any) {
      alert(`Error al eliminar receta: ${err.message || err}`);
      setIsDeleting(false);
    }
  };

  const availableTags = [
    { id: 'saludable', label: 'Saludable', color: 'emerald' },
    { id: 'mas_usada', label: 'Más usada', color: 'blue' },
    { id: 'top_receta', label: 'Top receta ⭐', color: 'amber' },
    { id: 'rapida', label: 'Rápida (<25m)', color: 'cyan' },
    { id: 'facil', label: 'Fácil', color: 'green' },
    { id: 'sin_gluten', label: 'Sin gluten', color: 'yellow' },
    { id: 'sin_lactosa', label: 'Sin lactosa', color: 'indigo' },
    { id: 'batch_cooking', label: 'Batch Cooking', color: 'teal' }
  ];

  const mealTypeOptions = [
    { id: 'desayuno', label: 'Desayuno', icon: Sun },
    { id: 'almuerzo_merienda', label: 'Almuerzo / Merienda', icon: Coffee },
    { id: 'comida_cena', label: 'Comida / Cena', icon: Utensils },
    { id: 'snacks', label: 'Snacks / Picoteo', icon: Apple }
  ];

  useEffect(() => {
    if (isEditing && id) {
      apiRequest(`/recipes/${id}`).then(data => {
        setTitle(data.title);
        setImageSearchInput(data.title || '');
        setDescription(data.description || '');
        setSourceUrl(data.source_url || '');
        setImageUrl(data.main_image_url || '');
        setMealType(data.meal_type || 'comida_cena');
        setDishType(data.dish_type || 'Plato principal');
        setCuisine(data.cuisine || 'Mediterránea');
        setPrepTime(data.prep_time_min || 15);
        setCookTime(data.cook_time_min || 20);
        setDifficulty(data.difficulty || 'media');
        setServings(data.base_servings || 4);
        setIsPrivate(Boolean(data.is_private));
        setChefNotes(data.chef_notes || '');
        setPreservationTips(data.preservation_tips || '');
        setFreezingTips(data.freezing_tips || '');
        setReheatingTips(data.reheating_tips || '');
        setNutritionCalories(data.nutrition_calories !== null && data.nutrition_calories !== undefined ? data.nutrition_calories : '');
        setNutritionProtein(data.nutrition_protein !== null && data.nutrition_protein !== undefined ? data.nutrition_protein : '');
        setNutritionCarbs(data.nutrition_carbs !== null && data.nutrition_carbs !== undefined ? data.nutrition_carbs : '');
        setNutritionFat(data.nutrition_fat !== null && data.nutrition_fat !== undefined ? data.nutrition_fat : '');
        if (Array.isArray(data.tags)) {
          setSelectedTags(data.tags);
        }

        if (data.variants && data.variants.length > 0) {
          const v = data.variants[0];
          setVariantType(v.variant_type);
          if (v.ingredients?.length > 0) setIngredients(v.ingredients);
          if (v.steps?.length > 0) setSteps(v.steps);
        }
      }).catch(err => console.warn('Fetch edit error:', err));
    }
  }, [id, isEditing]);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(t => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setCustomTagInput('');
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: 1, unit: 'ud' }]);
  };

  const updateIngredient = (index: number, field: string, val: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: val };
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, instruction: '' }]);
  };

  const updateStep = (index: number, val: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], instruction: val };
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index).map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setSteps(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    const recipePayload = {
      title,
      description,
      summary: description.slice(0, 150),
      source_url: sourceUrl.trim() || null,
      main_image_url: imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80',
      meal_type: mealType,
      tags: selectedTags,
      dish_type: dishType,
      cuisine,
      prep_time_min: prepTime,
      cook_time_min: cookTime,
      total_time_min: prepTime + cookTime,
      difficulty,
      base_servings: servings,
      is_private: isPrivate,
      chef_notes: chefNotes.trim() || null,
      preservation_tips: preservationTips.trim() || null,
      freezing_tips: freezingTips.trim() || null,
      reheating_tips: reheatingTips.trim() || null,
      nutrition_calories: nutritionCalories !== '' && nutritionCalories !== null ? Number(nutritionCalories) : null,
      nutrition_protein: nutritionProtein !== '' && nutritionProtein !== null ? Number(nutritionProtein) : null,
      nutrition_carbs: nutritionCarbs !== '' && nutritionCarbs !== null ? Number(nutritionCarbs) : null,
      nutrition_fat: nutritionFat !== '' && nutritionFat !== null ? Number(nutritionFat) : null,
      variants: [
        {
          variant_type: variantType,
          title: variantType === 'thermomix' ? 'Thermomix TM7' : variantType === 'airfryer' ? 'Airfryer 6L' : 'Tradicional',
          is_default: true,
          ingredients: ingredients.filter(i => i.name.trim()),
          steps: steps.filter(s => s.instruction.trim())
        }
      ]
    };

    try {
      if (isEditing) {
        await apiRequest(`/recipes/${id}`, {
          method: 'PUT',
          body: JSON.stringify(recipePayload)
        });
        navigate(`/recipes/${id}`);
      } else {
        const created = await apiRequest('/recipes', {
          method: 'POST',
          body: JSON.stringify(recipePayload)
        });
        navigate(`/recipes/${created.id}`);
      }
    } catch (err: any) {
      alert(`Error al guardar receta: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24 animate-in fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isEditing ? 'Editar Receta' : 'Nueva Receta'}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Ficha estructurada en la biblioteca compartida</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Basic Fields */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Datos Básicos</h3>

          <div>
            <label className="text-xs font-semibold text-zinc-300">Título de la receta</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ej. Salmón a la plancha con verduras"
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300">Descripción o notas del plato</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve resumen de sabores, texturas y ocasión..."
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Visibilidad: Familiar vs Cajón Privado */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                {isPrivate ? <Lock className="w-4 h-4 text-purple-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
                Visibilidad y Cajón Personal
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isPrivate ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isPrivate ? '🔒 Solo para mí (Privada)' : '👥 Familiar (Compartida)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  !isPrivate
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${!isPrivate ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    Receta Familiar / Pública
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Visible para toda la familia en la biblioteca común y disponible en el planificador semanal.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  isPrivate
                    ? 'bg-purple-500/10 border-purple-500/50 text-white shadow-sm ring-1 ring-purple-500/30'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isPrivate ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    Mi Cajón Privado 🔒
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Guardada solo para ti en tu cajón personal. Ningún otro usuario podrá verla ni buscarla.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-blue-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                <span>Documento original (Google Drive / Enlace)</span>
              </label>
              {sourceUrl && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                  title="Abrir documento original en una pestaña nueva"
                >
                  <span>Abrir en Google Drive</span>
                  <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              Enlace directo al documento de Google Docs, archivo de Drive o página web desde el que se importó o redactó la receta.
            </p>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/... o https://drive.google.com/..."
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-blue-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Image Customization Card */}
          <div className="space-y-3 bg-zinc-950 p-3.5 sm:p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                Fotografía del plato
              </span>
              <span className="text-[10px] text-zinc-400">
                {imageUrl ? 'Imagen asignada' : 'Sin imagen'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Photo Preview */}
              <div className="relative w-full sm:w-48 h-44 sm:h-36 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 shadow-inner group">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title || 'Foto de la receta'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-1">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[10px]">Sin fotografía</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Actions for Photo */}
              <div className="flex-1 w-full space-y-2.5">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Elige una fotografía de alta calidad sugerida por la IA, sube una foto desde tu móvil o pega un enlace web.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!showImageSuggestions && suggestedImages.length === 0) {
                        handleLoadImageSuggestions();
                      } else {
                        setShowImageSuggestions(!showImageSuggestions);
                      }
                    }}
                    disabled={loadingSuggestions}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                      showImageSuggestions
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                    }`}
                  >
                    {loadingSuggestions ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Buscando sugerencias...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{showImageSuggestions ? 'Ocultar opciones IA' : 'Buscar opciones con IA'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    {isUploadingImage ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Subir foto propia</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImageFile}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Pegar URL</span>
                  </button>
                </div>

                {/* Custom URL Input Field */}
                {showCustomUrlInput && (
                  <div className="flex gap-2 pt-1 animate-fade-in">
                    <input
                      type="url"
                      value={customImageUrlInput}
                      onChange={(e) => setCustomImageUrlInput(e.target.value)}
                      placeholder="https://ejemplo.com/foto-receta.jpg"
                      className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomImageUrl}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Suggested Images Gallery Grid */}
            {showImageSuggestions && (
              <div className="pt-3 border-t border-zinc-800/80 space-y-3 animate-fade-in">
                {/* Live Online Image Search Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchImagesOnline();
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={imageSearchInput}
                      onChange={(e) => setImageSearchInput(e.target.value)}
                      placeholder="Buscar fotos de este plato en internet (ej: Salmón al horno, Coulant...)"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingImages || !imageSearchInput.trim()}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                  >
                    {isSearchingImages ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>Buscar</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Quick Search Chips */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-400">
                  <span className="text-[10px] text-zinc-500">Búsquedas sugeridas:</span>
                  {title && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageSearchInput(title);
                        handleSearchImagesOnline(title);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700/60 transition-colors"
                    >
                      "{title}"
                    </button>
                  )}
                  {dishType && (
                    <button
                      type="button"
                      onClick={() => {
                        const term = `${title || ''} ${dishType}`.trim();
                        setImageSearchInput(term);
                        handleSearchImagesOnline(term);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors"
                    >
                      + {dishType}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-zinc-300">
                    {suggestedImages.length > 0 ? `${suggestedImages.length} fotos encontradas para elegir:` : 'No se encontraron fotos'}
                  </span>
                  {(loadingSuggestions || isSearchingImages) && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-400">
                      <div className="w-2.5 h-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span>Buscando fotos con IA y en alta calidad...</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {suggestedImages.map((imgUrl, i) => {
                    const isSelected = imageUrl === imgUrl;
                    return (
                      <div
                        key={i}
                        onClick={() => handleSelectSuggestedImage(imgUrl)}
                        className={`relative h-24 rounded-xl overflow-hidden cursor-pointer border-2 transition-all group bg-zinc-900 ${
                          isSelected
                            ? 'border-amber-500 ring-2 ring-amber-500/30 scale-102'
                            : 'border-zinc-800 hover:border-zinc-600 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Opción ${i + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                          loading="lazy"
                          onError={() => {
                            setSuggestedImages(prev => prev.filter(u => u !== imgUrl));
                          }}
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Meal Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Momento del día / Tipo de comida</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mealTypeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = mealType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMealType(opt.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-semibold ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Etiquetas de la receta (Saludable, Top, Rápida, etc.)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tg) => {
                const isSelected = selectedTags.includes(tg.id);
                return (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => toggleTag(tg.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {tg.label}
                  </button>
                );
              })}
            </div>

            {/* Custom tag add */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                placeholder="Añadir otra etiqueta personalizada..."
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
              >
                + Añadir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300">Tiempo prep. (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300">Tiempo cocción (min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300">Dificultad</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              >
                <option value="facil">Fácil</option>
                <option value="media">Media</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300">Raciones base</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>
        </div>

        {/* Nutrition Information & AI Estimation */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>🔥 Información Nutricional</span>
                <span className="text-xs text-zinc-400 font-normal lowercase">(por ración)</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Calorías y macronutrientes estimados de la receta</p>
            </div>
            <button
              type="button"
              onClick={handleEstimateNutrition}
              disabled={isEstimatingNutrition}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isEstimatingNutrition ? 'animate-spin' : ''}`} />
              <span>{isEstimatingNutrition ? 'Calculando con IA...' : 'Estimar con IA'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-amber-400">Calorías (kcal)</label>
              <input
                type="number"
                step="any"
                value={nutritionCalories}
                onChange={(e) => setNutritionCalories(e.target.value)}
                placeholder="ej. 450"
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300">Proteínas (g)</label>
              <input
                type="number"
                step="any"
                value={nutritionProtein}
                onChange={(e) => setNutritionProtein(e.target.value)}
                placeholder="ej. 32"
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300">Carbohidratos (g)</label>
              <input
                type="number"
                step="any"
                value={nutritionCarbs}
                onChange={(e) => setNutritionCarbs(e.target.value)}
                placeholder="ej. 45"
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300">Grasas (g)</label>
              <input
                type="number"
                step="any"
                value={nutritionFat}
                onChange={(e) => setNutritionFat(e.target.value)}
                placeholder="ej. 14"
                className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Appliance Variant Selector */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Modo de cocina principal</h3>
            <span className="text-xs text-amber-400">Podrás generar variantes con IA después</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'traditional', label: 'Tradicional' },
              { id: 'thermomix', label: 'Thermomix TM7' },
              { id: 'airfryer', label: 'Airfryer 6L' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setVariantType(m.id)}
                className={`p-3 rounded-xl border text-xs font-bold transition-colors ${
                  variantType === m.id
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Ingredientes</h3>
            <button
              type="button"
              onClick={addIngredient}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>

          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nombre ingrediente"
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Cant."
                  value={ing.amount}
                  onChange={(e) => updateIngredient(idx, 'amount', Number(e.target.value))}
                  className="w-16 px-2.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 text-center"
                />
                <input
                  type="text"
                  placeholder="Unidad (g, ml...)"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                  className="w-20 px-2.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 text-center"
                />
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="p-2 text-zinc-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pasos de Elaboración</h3>
            <button
              type="button"
              onClick={addStep}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir paso</span>
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((st, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-2">
                  {idx + 1}
                </span>
                <textarea
                  rows={2}
                  placeholder={`Instrucción del paso ${idx + 1}...`}
                  value={st.instruction}
                  onChange={(e) => updateStep(idx, e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="p-2 text-zinc-500 hover:text-rose-400 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Consejos, Trucos y Conservación */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Consejos, Trucos y Conservación
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Recomendaciones del chef, trucos de punto, conservación en nevera y congelado.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSuggestTips}
              disabled={isSuggestingTips}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto disabled:opacity-50 shadow-sm"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isSuggestingTips ? 'animate-spin' : ''}`} />
              <span>{isSuggestingTips ? 'Generando con IA...' : 'Sugerir consejos con IA'}</span>
            </button>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-zinc-300">
                👨‍🍳 Consejos del Chef / Trucos culinarios
              </label>
              <textarea
                rows={2}
                value={chefNotes}
                onChange={(e) => setChefNotes(e.target.value)}
                placeholder="Trucos para potenciar sabor, secreto de la salsa, punto perfecto o sustituciones..."
                className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300">
                  🧊 Conservación (Nevera)
                </label>
                <textarea
                  rows={2}
                  value={preservationTips}
                  onChange={(e) => setPreservationTips(e.target.value)}
                  placeholder="En recipiente hermético de cristal 3-4 días..."
                  className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">
                  ❄️ Congelación
                </label>
                <textarea
                  rows={2}
                  value={freezingTips}
                  onChange={(e) => setFreezingTips(e.target.value)}
                  placeholder="Apto para congelar en porciones individuales..."
                  className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">
                  ♨️ Recalentado
                </label>
                <textarea
                  rows={2}
                  value={reheatingTips}
                  onChange={(e) => setReheatingTips(e.target.value)}
                  placeholder="Calentar a fuego suave con unas gotas de agua o aceite..."
                  className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit & Delete Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 flex items-center justify-between max-w-3xl mx-auto z-40">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDeleteRecipe}
              disabled={isDeleting || isSaving}
              className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="Eliminar receta permanentemente"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{isDeleting ? 'Eliminando...' : 'Eliminar Receta'}</span>
            </button>
          ) : <div />}

          <button
            type="submit"
            disabled={isSaving || isDeleting}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Receta'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
