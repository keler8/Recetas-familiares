import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Sparkles, Plus, Clock,
  ChevronLeft, ChevronRight, CheckCircle, Utensils,
  Package, Trash2, ArrowRight, Flame, Search, X, Apple, Coffee, Sun, Moon, ShoppingBag
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const MEAL_TYPES = [
  { id: 'desayuno', label: 'Desayuno', icon: Sun, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { id: 'almuerzo', label: 'Media Mañana', icon: Coffee, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  { id: 'comida', label: 'Comida', icon: Utensils, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'merienda', label: 'Merienda', icon: Apple, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { id: 'cena', label: 'Cena', icon: Moon, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { id: 'snacks', label: 'Snacks / Fruta', icon: Apple, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' }
];

export const PlannerPage: React.FC = () => {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [leftovers, setLeftovers] = useState<any[]>([]);
  const [recipesList, setRecipesList] = useState<any[]>([]);
  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [isGenerating, setIsGenerating] = useState(false);

  // Week offset state
  const [weekOffset, setWeekOffset] = useState(0);

  // Add Item / Recipe Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalDate, setModalDate] = useState<string>('');
  const [modalMealType, setModalMealType] = useState<string>('comida');
  const [modalTab, setModalTab] = useState<'recipe' | 'custom'>('recipe');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState<number | ''>('');
  const [servings, setServings] = useState(4);
  const [isSavingItem, setIsSavingItem] = useState(false);

  // Leftover Modal State
  const [showLeftoverModal, setShowLeftoverModal] = useState(false);
  const [newLeftoverName, setNewLeftoverName] = useState('');
  const [newLeftoverPortions, setNewLeftoverPortions] = useState(2);

  // Calculate current week days (Monday to Sunday) based on weekOffset
  const getWeekDays = () => {
    const now = new Date();
    // Monday of current week
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + (weekOffset * 7));

    const days = [];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      days.push({
        name: dayNames[i],
        date: d,
        isoDate,
        displayDate: `${d.getDate()}/${d.getMonth() + 1}`
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  const fetchPlans = async () => {
    try {
      const data = await apiRequest('/meal-plans');
      setPlans(data);
      if (data.length > 0) {
        setActivePlan(data[0]);
      }
    } catch (err) {
      console.warn('Error fetching plans:', err);
    }
  };

  const fetchLeftovers = async () => {
    try {
      const data = await apiRequest('/meal-plans/leftovers');
      setLeftovers(data);
    } catch (err) {
      console.warn('Error fetching leftovers:', err);
    }
  };

  const fetchRecipesAndProfile = async () => {
    try {
      const [recs, nutProfile] = await Promise.all([
        apiRequest('/recipes?limit=100').catch(() => []),
        apiRequest('/nutrition/profile').catch(() => null)
      ]);
      setRecipesList(recs);
      if (nutProfile && nutProfile.target_calories) {
        setTargetCalories(nutProfile.target_calories);
      }
    } catch (err) {
      console.warn('Error fetching recipes or profile:', err);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchLeftovers();
    fetchRecipesAndProfile();
  }, []);

  const handleGenerateAiMenu = async () => {
    setIsGenerating(true);
    try {
      const startDate = weekDays[0].isoDate;
      const endDate = weekDays[6].isoDate;

      await apiRequest('/meal-plans/generate-ai', {
        method: 'POST',
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          focus_healthy: true,
          quick_meals_only: false,
          use_pantry_items: true,
          appliances: ['Thermomix', 'Airfryer', 'Tradicional']
        })
      });
      await fetchPlans();
      alert('¡Menú semanal sugerido con éxito cubriendo desayunos, almuerzos, comidas, meriendas y cenas!');
    } catch (err: any) {
      alert(`Error al generar menú: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenAddModal = (isoDate: string, mealType: string) => {
    setModalDate(isoDate);
    setModalMealType(mealType);
    setSelectedRecipeId(null);
    setCustomName('');
    setCustomCalories('');
    setServings(4);
    setRecipeSearch('');
    setShowAddModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan) {
      alert('Primero crea o genera un plan de menú para esta semana.');
      return;
    }

    setIsSavingItem(true);
    try {
      if (modalTab === 'recipe') {
        if (!selectedRecipeId) {
          alert('Selecciona una receta de la lista.');
          setIsSavingItem(false);
          return;
        }
        await apiRequest(`/meal-plans/${activePlan.id}/add-recipe`, {
          method: 'POST',
          body: JSON.stringify({
            slot_date: modalDate,
            meal_type: modalMealType,
            recipe_id: selectedRecipeId,
            servings: servings
          })
        });
      } else {
        if (!customName.trim()) {
          alert('Escribe el nombre del alimento o producto.');
          setIsSavingItem(false);
          return;
        }
        await apiRequest(`/meal-plans/${activePlan.id}/add-recipe`, {
          method: 'POST',
          body: JSON.stringify({
            slot_date: modalDate,
            meal_type: modalMealType,
            custom_recipe_name: customName.trim(),
            custom_calories: customCalories ? Number(customCalories) : null,
            servings: servings
          })
        });
      }

      setShowAddModal(false);
      await fetchPlans();
    } catch (err: any) {
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeletePlanned = async (plannedId: number) => {
    if (!confirm('¿Eliminar este elemento del menú?')) return;
    try {
      await apiRequest(`/meal-plans/planned-recipes/${plannedId}`, {
        method: 'DELETE'
      });
      await fetchPlans();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || err}`);
    }
  };

  const handleCreateLeftover = async () => {
    if (!newLeftoverName.trim()) return;
    try {
      await apiRequest('/meal-plans/leftovers', {
        method: 'POST',
        body: JSON.stringify({
          name: newLeftoverName,
          portions: newLeftoverPortions,
          location: 'nevera'
        })
      });
      setNewLeftoverName('');
      setShowLeftoverModal(false);
      await fetchLeftovers();
    } catch (err) {
      console.warn('Error adding leftover:', err);
    }
  };

  const handleConsumeLeftover = async (id: number) => {
    try {
      await apiRequest(`/meal-plans/leftovers/${id}/consume`, { method: 'PUT' });
      await fetchLeftovers();
    } catch (err) {
      console.warn('Error consuming leftover:', err);
    }
  };

  // Helper to extract items for a given date and meal_type from active plan
  const getSlotItems = (isoDate: string, mealType: string) => {
    if (!activePlan || !activePlan.slots) return [];
    const slot = activePlan.slots.find(
      (s: any) => s.slot_date === isoDate && s.meal_type === mealType
    );
    return slot ? slot.planned_recipes || [] : [];
  };

  // Helper to compute total calories for an entire day
  const getDayTotalCalories = (isoDate: string) => {
    if (!activePlan || !activePlan.slots) return 0;
    const daySlots = activePlan.slots.filter((s: any) => s.slot_date === isoDate);
    let total = 0;
    for (const s of daySlots) {
      for (const p of s.planned_recipes || []) {
        if (p.calories) total += p.calories;
      }
    }
    return Math.round(total);
  };

  const filteredRecipes = recipesList.filter(r =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    (r.dish_type && r.dish_type.toLowerCase().includes(recipeSearch.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6 pb-24 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('planner')} Semanal Inteligente
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Planifica desayunos, almuerzos, comidas, meriendas y cenas con conteo calórico en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAiMenu}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" />
            <span>{isGenerating ? 'Generando menú completo...' : 'Sugerir Semana con IA'}</span>
          </button>
        </div>
      </div>

      {/* Week Navigator & Leftovers Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 text-slate-700 dark:text-zinc-300 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-900 dark:text-white px-2">
            Semana {weekDays[0].displayDate} - {weekDays[6].displayDate}
            {weekOffset === 0 && <span className="text-[10px] text-amber-500 font-semibold ml-1.5">(Actual)</span>}
          </span>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 text-slate-700 dark:text-zinc-300 transition-colors"
            title="Semana siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline ml-1"
            >
              Volver a hoy
            </button>
          )}
        </div>

        {/* Leftovers shortcut */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
            <Package className="w-4 h-4 text-emerald-500" />
            <span>Sobras en nevera: <strong>{leftovers.length}</strong></span>
          </div>
          <button
            onClick={() => setShowLeftoverModal(true)}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Sobra</span>
          </button>
        </div>
      </div>

      {/* Days of the Week Grid */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {weekDays.map(day => {
            const dayCalories = getDayTotalCalories(day.isoDate);
            const calPercent = targetCalories > 0 ? Math.min(100, Math.round((dayCalories / targetCalories) * 100)) : 0;
            const isToday = new Date().toISOString().split('T')[0] === day.isoDate;

            return (
              <div
                key={day.isoDate}
                className={`flex flex-col rounded-3xl bg-white dark:bg-zinc-900 border transition-all shadow-sm overflow-hidden ${
                  isToday
                    ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-zinc-800'
                }`}
              >
                {/* Day Header with Total Calories */}
                <div className={`p-4 border-b ${
                  isToday
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-100 dark:border-zinc-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white">
                          {day.name}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950">
                            Hoy
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">{day.displayDate}</span>
                    </div>

                    {/* Calorie Indicator */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                        <span className="text-xs font-black font-mono text-slate-800 dark:text-zinc-100">
                          {dayCalories > 0 ? `${dayCalories} kcal` : '0 kcal'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                        Obj: {targetCalories} kcal ({calPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Daily Calorie Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        calPercent > 105
                          ? 'bg-rose-500'
                          : calPercent >= 85
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, calPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Slots List */}
                <div className="p-3.5 space-y-2.5 flex-1">
                  {MEAL_TYPES.map(meal => {
                    const items = getSlotItems(day.isoDate, meal.id);
                    const MealIcon = meal.icon;

                    return (
                      <div
                        key={meal.id}
                        className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 ${meal.color}`}>
                              <MealIcon className="w-3 h-3" />
                              <span>{meal.label}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(day.isoDate, meal.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                            title={`Añadir plato o alimento a ${meal.label}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Items in Slot */}
                        {items.length > 0 ? (
                          <div className="space-y-1 pt-0.5">
                            {items.map((it: any) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs shadow-2xs group"
                              >
                                <div className="pr-2 flex-1 min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block truncate">
                                    {it.recipe_title || it.custom_recipe_name}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {it.calories && (
                                      <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                                        🔥 {it.calories} kcal
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                                      ({it.servings} rac.)
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePlanned(it.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar del menú"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(day.isoDate, meal.id)}
                            className="w-full py-1.5 text-center text-[11px] text-slate-400 dark:text-zinc-600 hover:text-amber-500 hover:bg-amber-500/5 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800/80 transition-colors"
                          >
                            + Añadir alimento / receta
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leftovers Details Drawer / Cards */}
      {leftovers.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-500" />
              <span>Aprovechamiento de Sobras Guardadas ({leftovers.length})</span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {leftovers.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs"
              >
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{l.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">({l.portions} rac.)</span>
                <button
                  type="button"
                  onClick={() => handleConsumeLeftover(l.id)}
                  className="text-slate-400 hover:text-emerald-500 transition-colors"
                  title="Marcar como consumida"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Recipe or Custom Food Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                  Añadir a {MEAL_TYPES.find(m => m.id === modalMealType)?.label || modalMealType}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Fecha: {modalDate}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs: Receta existente vs Producto rápido */}
            <div className="flex rounded-2xl bg-slate-100 dark:bg-zinc-950 p-1 border border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setModalTab('recipe')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTab === 'recipe'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Receta del Recetario
              </button>
              <button
                type="button"
                onClick={() => setModalTab('custom')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modalTab === 'custom'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Producto / Alimento Rápido
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {modalTab === 'recipe' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      placeholder="Buscar receta en la biblioteca..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1 border border-slate-100 dark:border-zinc-800 rounded-xl p-1.5">
                    {filteredRecipes.slice(0, 15).map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRecipeId(r.id)}
                        className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                          selectedRecipeId === r.id
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className="truncate">{r.title}</span>
                        {r.nutrition_calories && (
                          <span className={`text-[10px] font-mono shrink-0 ml-2 ${
                            selectedRecipeId === r.id ? 'text-zinc-950' : 'text-amber-500'
                          }`}>
                            {r.nutrition_calories} kcal
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredRecipes.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">No se encontraron recetas</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Alimento o producto sencillo
                    </label>
                    <input
                      type="text"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="ej. 1 Manzana Fuji con nueces, Yogur griego, Café con leche..."
                      className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Calorías estimadas (kcal)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="3000"
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value ? Number(e.target.value) : '')}
                      placeholder="ej. 160"
                      className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Raciones / Comensales
                </label>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 4, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setServings(num)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        servings === num
                          ? 'bg-amber-500 text-zinc-950 border-amber-500'
                          : 'bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                      }`}
                    >
                      {num} {num === 1 ? 'ración' : 'raciones'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  {isSavingItem ? 'Añadiendo...' : 'Añadir al Menú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Leftover */}
      {showLeftoverModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Guardar Sobras</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nombre del plato o preparación</label>
                <input
                  type="text"
                  value={newLeftoverName}
                  onChange={(e) => setNewLeftoverName(e.target.value)}
                  placeholder="ej. Arroz con verduras restante"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Raciones disponibles</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newLeftoverPortions}
                  onChange={(e) => setNewLeftoverPortions(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLeftoverModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateLeftover}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
