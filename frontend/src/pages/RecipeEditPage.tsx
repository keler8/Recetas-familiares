import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, Sparkles, ChefHat
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
  const [dishType, setDishType] = useState('Plato principal');
  const [cuisine, setCuisine] = useState('Mediterránea');
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(20);
  const [difficulty, setDifficulty] = useState('media');
  const [servings, setServings] = useState(4);

  // Variant & ingredients
  const [variantType, setVariantType] = useState('traditional');
  const [ingredients, setIngredients] = useState<any[]>([
    { name: '', amount: 1, unit: 'ud' }
  ]);
  const [steps, setSteps] = useState<any[]>([
    { step_number: 1, instruction: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      apiRequest(`/recipes/${id}`).then(data => {
        setTitle(data.title);
        setDescription(data.description || '');
        setImageUrl(data.main_image_url || '');
        setDishType(data.dish_type || 'Plato principal');
        setCuisine(data.cuisine || 'Mediterránea');
        setPrepTime(data.prep_time_min || 15);
        setCookTime(data.cook_time_min || 20);
        setDifficulty(data.difficulty || 'media');
        setServings(data.base_servings || 4);

        if (data.variants && data.variants.length > 0) {
          const v = data.variants[0];
          setVariantType(v.variant_type);
          if (v.ingredients?.length > 0) setIngredients(v.ingredients);
          if (v.steps?.length > 0) setSteps(v.steps);
        }
      }).catch(err => console.warn('Fetch edit error:', err));
    }
  }, [id, isEditing]);

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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24">
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
              placeholder="ej. Pollo al curry con arroz"
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

        {/* Ingredients Section */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('ingredients')}</h3>
            <button
              type="button"
              onClick={addIngredient}
              className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir ingrediente</span>
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
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Cant."
                  value={ing.amount}
                  onChange={(e) => updateIngredient(idx, 'amount', Number(e.target.value))}
                  className="w-20 px-2 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white text-center"
                />
                <input
                  type="text"
                  placeholder="Unidad (g, ml, ud)"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                  className="w-24 px-2 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="p-2 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preparation Steps Section */}
        <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('preparation')}</h3>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir paso</span>
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((st, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-2">
                  {idx + 1}
                </span>
                <textarea
                  rows={2}
                  placeholder={`Instrucciones del paso ${idx + 1}...`}
                  value={st.instruction}
                  onChange={(e) => updateStep(idx, e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="p-2 text-zinc-500 hover:text-rose-400 mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar y Publicar Receta'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
