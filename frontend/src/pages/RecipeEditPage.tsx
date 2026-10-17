import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Sparkles, ChefHat,
  Tag, Sun, Utensils, Apple, Coffee
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
  const [imageUrl, setImageUrl] = useState('');
  const [mealType, setMealType] = useState('comida_cena');
  const [dishType, setDishType] = useState('Plato principal');
  const [cuisine, setCuisine] = useState('Mediterránea');
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(20);
  const [difficulty, setDifficulty] = useState('media');
  const [servings, setServings] = useState(4);
  const [selectedTags, setSelectedTags] = useState<string[]>(['saludable']);
  const [customTagInput, setCustomTagInput] = useState('');

  // Variant & ingredients
  const [variantType, setVariantType] = useState('traditional');
  const [ingredients, setIngredients] = useState<any[]>([
    { name: '', amount: 1, unit: 'ud' }
  ]);
  const [steps, setSteps] = useState<any[]>([
    { step_number: 1, instruction: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

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
        setDescription(data.description || '');
        setImageUrl(data.main_image_url || '');
        setMealType(data.meal_type || 'comida_cena');
        setDishType(data.dish_type || 'Plato principal');
        setCuisine(data.cuisine || 'Mediterránea');
        setPrepTime(data.prep_time_min || 15);
        setCookTime(data.cook_time_min || 20);
        setDifficulty(data.difficulty || 'media');
        setServings(data.base_servings || 4);
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

          <div>
            <label className="text-xs font-semibold text-zinc-300">URL de la fotografía principal</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
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

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 flex justify-end max-w-3xl mx-auto z-40">
          <button
            type="submit"
            disabled={isSaving}
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
