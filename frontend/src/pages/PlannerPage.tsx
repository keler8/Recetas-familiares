import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Sparkles, Plus, Clock,
  ChevronLeft, ChevronRight, CheckCircle, Utensils,
  Package, Trash2, ArrowRight, Flame, Search, X, Apple, Coffee, Sun, Moon, ShoppingBag,
  Camera, UploadCloud, FileText, Check, AlertCircle, RefreshCw, ChefHat, BookOpen,
  User, Users, Target, Heart, Sliders, Activity,
  GripVertical, BookmarkPlus, BookmarkCheck, Copy, ArrowRightLeft, Layers
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
  const location = useLocation();
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [leftovers, setLeftovers] = useState<any[]>([]);
  const [recipesList, setRecipesList] = useState<any[]>([]);
  const [dinersList, setDinersList] = useState<any[]>([]);
  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [isGenerating, setIsGenerating] = useState(false);

  // Week offset state
  const [weekOffset, setWeekOffset] = useState(0);

  // Photo Scan Nutrition Plan / Dietitian Report State
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [parsedPlan, setParsedPlan] = useState<any | null>(null);
  const [createMissingRecipes, setCreateMissingRecipes] = useState(true);
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Dietitian report specific states: patient habits & household servings
  const [targetDinerId, setTargetDinerId] = useState<number | null>(null);
  const [householdServings, setHouseholdServings] = useState<number>(2);
  const [updateDinerProfile, setUpdateDinerProfile] = useState<boolean>(true);
  const [patientName, setPatientName] = useState<string>('');
  const [patientCalories, setPatientCalories] = useState<number | ''>('');
  const [patientGoal, setPatientGoal] = useState<string>('mantenimiento');
  const [patientHabits, setPatientHabits] = useState<string>('');

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

  // Drag and Drop & Quick Move States
  const [draggedItem, setDraggedItem] = useState<{ id: number; name: string } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; mealType: string } | null>(null);
  const [isMovingItem, setIsMovingItem] = useState(false);

  const [movingItem, setMovingItem] = useState<{
    id: number;
    title: string;
    currentDate: string;
    currentMealType: string;
  } | null>(null);
  const [moveTargetDate, setMoveTargetDate] = useState<string>('');
  const [moveTargetMealType, setMoveTargetMealType] = useState<string>('comida');

  // Templates & Copy Week States
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

  const [showCopyWeekModal, setShowCopyWeekModal] = useState(false);
  const [copyTargetWeekOffset, setCopyTargetWeekOffset] = useState<number>(1);
  const [copyMode, setCopyMode] = useState<'replace' | 'merge'>('replace');
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);

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
      setPlans(data || []);
      if (data && data.length > 0) {
        const weekStart = weekDays[0].isoDate;
        const weekEnd = weekDays[6].isoDate;
        const matchingPlan = data.find((p: any) => p.start_date <= weekEnd && p.end_date >= weekStart) || data[0];
        setActivePlan(matchingPlan);
      } else {
        setActivePlan(null);
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
      const [recs, nutProfile, diners] = await Promise.all([
        apiRequest('/recipes?limit=100').catch(() => []),
        apiRequest('/nutrition/profile').catch(() => null),
        apiRequest<any[]>('/households/diners').catch(() => [])
      ]);
      setRecipesList(recs || []);
      setDinersList(diners || []);
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

  // Listen to URL query params to auto-open diet scan modal (e.g. from /nutrition or /imports)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('scan') === 'diet' || params.get('scan') === 'true') {
      setShowScanModal(true);
      setParsedPlan(null);
      setScanFile(null);
      setScanPreview(null);
    }
  }, [location.search]);

  // Update active plan when week navigation changes
  useEffect(() => {
    if (plans.length > 0) {
      const weekStart = weekDays[0].isoDate;
      const weekEnd = weekDays[6].isoDate;
      const matchingPlan = plans.find((p: any) => p.start_date <= weekEnd && p.end_date >= weekStart);
      setActivePlan(matchingPlan || null);
    }
  }, [weekOffset, plans]);

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
    setIsSavingItem(true);
    try {
      // Find or auto-create a meal plan for this date/week
      let targetPlanId = plans.find((p: any) => p.start_date <= modalDate && p.end_date >= modalDate)?.id;

      if (!targetPlanId) {
        if (activePlan && activePlan.start_date <= modalDate && activePlan.end_date >= modalDate) {
          targetPlanId = activePlan.id;
        } else {
          // Auto-create plan for the viewed week on the fly
          const weekStart = weekDays[0].isoDate;
          const weekEnd = weekDays[6].isoDate;
          const newPlan = await apiRequest('/meal-plans', {
            method: 'POST',
            body: JSON.stringify({
              title: `Menú (${weekDays[0].displayDate} - ${weekDays[6].displayDate})`,
              start_date: weekStart,
              end_date: weekEnd,
              is_template: false
            })
          });
          targetPlanId = newPlan.id;
          setActivePlan(newPlan);
        }
      }

      if (modalTab === 'recipe') {
        if (!selectedRecipeId) {
          alert('Selecciona una receta de la lista.');
          setIsSavingItem(false);
          return;
        }
        await apiRequest(`/meal-plans/${targetPlanId}/add-recipe`, {
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
        await apiRequest(`/meal-plans/${targetPlanId}/add-recipe`, {
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

  // Drag and Drop & Move Handlers
  const handleDragStart = (e: React.DragEvent, item: any, sourceDate: string, sourceMealType: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      plannedId: item.id,
      sourceDate,
      sourceMealType,
      title: item.recipe_title || item.custom_recipe_name
    }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ id: item.id, name: item.recipe_title || item.custom_recipe_name });
  };

  const handleDropItem = async (e: React.DragEvent, targetDate: string, targetMealType: string) => {
    e.preventDefault();
    setDragOverSlot(null);
    setDraggedItem(null);

    const rawData = e.dataTransfer.getData('text/plain');
    if (!rawData) return;
    try {
      const data = JSON.parse(rawData);
      if (!data.plannedId) return;
      if (data.sourceDate === targetDate && data.sourceMealType === targetMealType) {
        return; // Mismo slot, no hace falta mover
      }
      await executeMove(data.plannedId, targetDate, targetMealType);
    } catch (err) {
      console.warn('Error parsing drop data:', err);
    }
  };

  const executeMove = async (plannedId: number, targetDate: string, targetMealType: string) => {
    setIsMovingItem(true);
    try {
      await apiRequest('/meal-plans/move-item', {
        method: 'POST',
        body: JSON.stringify({
          planned_recipe_id: plannedId,
          target_date: targetDate,
          target_meal_type: targetMealType
        })
      });
      await fetchPlans();
    } catch (err: any) {
      alert(`Error al mover alimento/receta: ${err.message || err}`);
    } finally {
      setIsMovingItem(false);
    }
  };

  const handleOpenQuickMove = (item: any, currentDate: string, currentMealType: string) => {
    setMovingItem({
      id: item.id,
      title: item.recipe_title || item.custom_recipe_name,
      currentDate,
      currentMealType
    });
    setMoveTargetDate(currentDate);
    setMoveTargetMealType(currentMealType);
  };

  const handleExecuteQuickMove = async () => {
    if (!movingItem) return;
    if (movingItem.currentDate === moveTargetDate && movingItem.currentMealType === moveTargetMealType) {
      setMovingItem(null);
      return;
    }
    await executeMove(movingItem.id, moveTargetDate, moveTargetMealType);
    setMovingItem(null);
  };

  // Templates & Copy Handlers
  const handleOpenSaveTemplate = () => {
    setTemplateTitle(`Menú Semana ${weekDays[0].displayDate} - ${weekDays[6].displayDate}`);
    setShowSaveTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim()) {
      alert('Por favor introduce un nombre para la plantilla');
      return;
    }
    setIsSavingTemplate(true);
    try {
      await apiRequest('/meal-plans/save-template', {
        method: 'POST',
        body: JSON.stringify({
          source_start_date: weekDays[0].isoDate,
          title: templateTitle.trim()
        })
      });
      alert('¡Semana guardada como plantilla con éxito! Puedes reutilizarla cuando quieras.');
      setShowSaveTemplateModal(false);
    } catch (err: any) {
      alert(`Error al guardar plantilla: ${err.message || err}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const fetchTemplatesList = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await apiRequest('/meal-plans/templates');
      setTemplatesList(data || []);
    } catch (err: any) {
      console.warn('Error fetching templates:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleOpenTemplatesModal = async () => {
    setShowTemplatesModal(true);
    await fetchTemplatesList();
  };

  const handleApplyTemplate = async (templateId: number, mode: 'replace' | 'merge' = 'replace') => {
    if (mode === 'replace' && !confirm('¿Deseas sustituir el menú de esta semana por la plantilla seleccionada?')) {
      return;
    }
    setIsApplyingTemplate(true);
    try {
      await apiRequest('/meal-plans/apply-template', {
        method: 'POST',
        body: JSON.stringify({
          template_id: templateId,
          target_start_date: weekDays[0].isoDate,
          mode
        })
      });
      alert('¡Plantilla aplicada a esta semana con éxito!');
      setShowTemplatesModal(false);
      await fetchPlans();
    } catch (err: any) {
      alert(`Error al aplicar plantilla: ${err.message || err}`);
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('¿Seguro que deseas eliminar esta plantilla guardada?')) return;
    try {
      await apiRequest(`/meal-plans/templates/${templateId}`, { method: 'DELETE' });
      setTemplatesList(prev => prev.filter(t => t.id !== templateId));
    } catch (err: any) {
      alert(`Error al eliminar plantilla: ${err.message || err}`);
    }
  };

  const handleOpenCopyWeek = () => {
    setCopyTargetWeekOffset(1);
    setCopyMode('replace');
    setShowCopyWeekModal(true);
  };

  const handleExecuteCopyWeek = async () => {
    setIsCopyingWeek(true);
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const targetMonday = new Date(now);
      targetMonday.setDate(now.getDate() + diffToMonday + ((weekOffset + copyTargetWeekOffset) * 7));
      const targetStartDate = targetMonday.toISOString().split('T')[0];

      await apiRequest('/meal-plans/copy-week', {
        method: 'POST',
        body: JSON.stringify({
          source_start_date: weekDays[0].isoDate,
          target_start_date: targetStartDate,
          mode: copyMode
        })
      });
      alert('¡Semana copiada con éxito! Navega a la semana destino para verla o modificarla.');
      setShowCopyWeekModal(false);
      await fetchPlans();
    } catch (err: any) {
      alert(`Error al copiar semana: ${err.message || err}`);
    } finally {
      setIsCopyingWeek(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScanFile(file);
      setScanError(null);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setScanPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setScanPreview(null);
      }
    }
  };

  const handleScanNutritionPlan = async () => {
    if (!scanFile) {
      setScanError('Por favor selecciona una foto o documento de tu plan nutricional.');
      return;
    }
    setIsScanning(true);
    setScanError(null);
    try {
      const formData = new FormData();
      formData.append('file', scanFile);
      formData.append('start_date', weekDays[0].isoDate);
      const data = await apiRequest('/meal-plans/import-nutrition-image', {
        method: 'POST',
        body: formData
      });
      setParsedPlan(data);
      if (data.patient_name) setPatientName(data.patient_name);
      if (data.target_calories) setPatientCalories(data.target_calories);
      if (data.dietary_goal) setPatientGoal(data.dietary_goal);
      if (data.habits) setPatientHabits(data.habits);
    } catch (err: any) {
      setScanError(err.message || 'Error al analizar la imagen con IA');
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyNutritionPlan = async () => {
    if (!parsedPlan) return;
    setIsApplyingPlan(true);
    try {
      const res = await apiRequest('/meal-plans/apply-imported-nutrition-plan', {
        method: 'POST',
        body: JSON.stringify({
          start_date: weekDays[0].isoDate,
          create_missing_recipes: createMissingRecipes,
          plan_title: parsedPlan.plan_title,
          household_servings: householdServings,
          target_diner_id: targetDinerId,
          update_diner_profile: updateDinerProfile,
          patient_name: patientName || null,
          target_calories: patientCalories ? Number(patientCalories) : null,
          dietary_goal: patientGoal,
          habits: patientHabits || null,
          dietary_guidelines: parsedPlan.dietary_guidelines || [],
          preferred_foods: parsedPlan.preferred_foods || null,
          excluded_foods: parsedPlan.excluded_foods || null,
          notes: parsedPlan.notes,
          days: parsedPlan.days
        })
      });
      setScanSuccessMessage(
        res.recipes_created > 0
          ? `¡Plan nutricional aplicado! Se adaptaron las comidas para ${householdServings} raciones y se crearon ${res.recipes_created} nuevas recetas en tu recetario.`
          : `¡Plan semanal aplicado con éxito para ${householdServings} raciones!`
      );
      await fetchPlans();
      await fetchRecipesAndProfile();
      setTimeout(() => {
        setShowScanModal(false);
        setParsedPlan(null);
        setScanFile(null);
        setScanPreview(null);
        setScanSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      setScanError(err.message || 'Error al aplicar el plan semanal');
    } finally {
      setIsApplyingPlan(false);
    }
  };

  const handleUpdateParsedMeal = (dayIdx: number, mealIdx: number, field: string, value: any) => {
    if (!parsedPlan) return;
    const updatedDays = [...parsedPlan.days];
    const updatedMeals = [...updatedDays[dayIdx].meals];
    updatedMeals[mealIdx] = { ...updatedMeals[mealIdx], [field]: value };
    updatedDays[dayIdx] = { ...updatedDays[dayIdx], meals: updatedMeals };
    setParsedPlan({ ...parsedPlan, days: updatedDays });
  };

  const handleDeleteParsedMeal = (dayIdx: number, mealIdx: number) => {
    if (!parsedPlan) return;
    const updatedDays = [...parsedPlan.days];
    updatedDays[dayIdx].meals = updatedDays[dayIdx].meals.filter((_: any, i: number) => i !== mealIdx);
    setParsedPlan({ ...parsedPlan, days: updatedDays });
  };

  // Helper to extract items for a given date and meal_type
  const getSlotItems = (isoDate: string, mealType: string) => {
    if (activePlan?.slots) {
      const slot = activePlan.slots.find(
        (s: any) => s.slot_date === isoDate && s.meal_type === mealType
      );
      if (slot && slot.planned_recipes && slot.planned_recipes.length > 0) {
        return slot.planned_recipes;
      }
    }
    // Search across any other loaded plans that might contain this slot date
    for (const plan of plans) {
      if (plan.id === activePlan?.id) continue;
      const slot = plan.slots?.find(
        (s: any) => s.slot_date === isoDate && s.meal_type === mealType
      );
      if (slot && slot.planned_recipes && slot.planned_recipes.length > 0) {
        return slot.planned_recipes;
      }
    }
    return [];
  };

  // Helper to compute total calories for an entire day
  const getDayTotalCalories = (isoDate: string) => {
    let total = 0;
    const countedSlotIds = new Set<number>();
    for (const plan of plans) {
      const daySlots = plan.slots?.filter((s: any) => s.slot_date === isoDate) || [];
      for (const s of daySlots) {
        if (countedSlotIds.has(s.id)) continue;
        countedSlotIds.add(s.id);
        for (const p of s.planned_recipes || []) {
          if (p.calories) total += p.calories;
        }
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowScanModal(true);
              setParsedPlan(null);
              setScanFile(null);
              setScanPreview(null);
              setScanError(null);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 text-slate-800 dark:text-zinc-200 font-bold text-xs shadow-sm hover:shadow transition-all"
          >
            <FileText className="w-4 h-4 text-amber-500" />
            <span>📋 Subir Informe de Dietista con IA</span>
          </button>

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

      {/* Week Navigator & Actions Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
          {/* Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
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

          {/* Plantillas, Copiar Semana y Sobras */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            <button
              type="button"
              onClick={handleOpenSaveTemplate}
              title="Guardar esta semana como plantilla reutilizable"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>Guardar Plantilla</span>
            </button>

            <button
              type="button"
              onClick={handleOpenTemplatesModal}
              title="Cargar una plantilla guardada a esta semana"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-sky-500/50 hover:bg-sky-500/5 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-sky-500" />
              <span>Plantillas Guardadas</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCopyWeek}
              title="Copiar todas las comidas de esta semana a otra semana"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/5 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-purple-500" />
              <span>Copiar Semana</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 hidden sm:block" />

            {/* Leftovers shortcut */}
            <div className="flex items-center gap-2 pl-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
                <Package className="w-3.5 h-3.5 text-emerald-500" />
                <span>Sobras: <strong>{leftovers.length}</strong></span>
              </div>
              <button
                onClick={() => setShowLeftoverModal(true)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Registrar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tip bar for Drag and Drop */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-1.5">
            <span className="font-bold">✨ Arrastrar y soltar:</span>
            <span>Arrastra cualquier comida o receta entre días y horas, o pulsa <ArrowRightLeft className="w-3 h-3 inline mx-0.5" /> para moverla.</span>
          </div>
          {isMovingItem && (
            <span className="font-bold animate-pulse text-amber-600 dark:text-amber-400">Moviendo plato...</span>
          )}
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
                    const isOver = dragOverSlot?.date === day.isoDate && dragOverSlot?.mealType === meal.id;

                    return (
                      <div
                        key={meal.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDragOverSlot({ date: day.isoDate, mealType: meal.id });
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          if (dragOverSlot?.date === day.isoDate && dragOverSlot?.mealType === meal.id) {
                            setDragOverSlot(null);
                          }
                        }}
                        onDrop={(e) => handleDropItem(e, day.isoDate, meal.id)}
                        className={`p-2.5 rounded-2xl transition-all space-y-1.5 ${
                          isOver
                            ? 'bg-amber-500/15 border-2 border-amber-500 ring-4 ring-amber-500/20 scale-[1.01]'
                            : 'bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-100 dark:border-zinc-800/80'
                        }`}
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
                            {items.map((it: any) => {
                              const isThisDragged = draggedItem?.id === it.id;
                              return (
                                <div
                                  key={it.id}
                                  draggable={true}
                                  onDragStart={(e) => handleDragStart(e, it, day.isoDate, meal.id)}
                                  onDragEnd={() => {
                                    setDraggedItem(null);
                                    setDragOverSlot(null);
                                  }}
                                  className={`flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border text-xs shadow-2xs group cursor-grab active:cursor-grabbing transition-all select-none ${
                                    isThisDragged
                                      ? 'opacity-30 scale-95 border-amber-500 ring-2 ring-amber-500/30'
                                      : 'border-slate-200/80 dark:border-zinc-800 hover:border-amber-400/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 pr-2 flex-1 min-w-0">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-amber-500 shrink-0 cursor-grab" />
                                    <div className="min-w-0 flex-1">
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
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickMove(it, day.isoDate, meal.id)}
                                      className="p-1 text-slate-400 hover:text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity"
                                      title="Mover a otro día u hora"
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlanned(it.id)}
                                      className="p-1 text-slate-400 hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity"
                                      title="Eliminar del menú"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAddModal(day.isoDate, meal.id)}
                            className={`w-full py-1.5 text-center text-[11px] rounded-xl border border-dashed transition-all ${
                              isOver
                                ? 'text-amber-600 dark:text-amber-400 border-amber-500 font-bold bg-amber-500/10'
                                : 'text-slate-400 dark:text-zinc-600 hover:text-amber-500 hover:bg-amber-500/5 border-slate-200 dark:border-zinc-800/80'
                            }`}
                          >
                            {isOver ? 'Soltar aquí para mover' : '+ Añadir alimento / receta'}
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

      {/* Modal: Scan Nutrition Plan / Dietitian Report */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 md:p-6 max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Informe de Dietista & Plan Nutricional con IA
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 uppercase tracking-wider">
                      Gemini Vision
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Sube una foto o PDF de la pauta de tu nutricionista para extraer hábitos, recetas y adaptar las raciones para el hogar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowScanModal(false);
                  setParsedPlan(null);
                  setScanFile(null);
                  setScanPreview(null);
                  setScanError(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Notification */}
            {scanSuccessMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-3 text-xs font-bold animate-in fade-in">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{scanSuccessMessage}</span>
              </div>
            )}

            {/* Error Notification */}
            {scanError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2.5 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Step 1: Upload & Options */}
            {!parsedPlan && !scanSuccessMessage && (
              <div className="space-y-4 py-2 overflow-y-auto">
                {/* File Dropzone & Selectors */}
                <div className="border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-amber-500/50 rounded-3xl p-6 text-center transition-colors bg-slate-50/50 dark:bg-zinc-950/50">
                  {scanFile ? (
                    <div className="space-y-3">
                      <div className="relative inline-block max-w-xs rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-md">
                        {scanPreview ? (
                          <img src={scanPreview} alt="Vista previa del informe" className="w-full max-h-56 object-cover rounded-xl" />
                        ) : (
                          <div className="py-6 px-8 flex flex-col items-center gap-2 text-rose-500">
                            <FileText className="w-14 h-14" />
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                              Documento PDF
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setScanFile(null); setScanPreview(null); }}
                          className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 text-white hover:bg-rose-600 transition-colors"
                          title="Quitar archivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        {scanFile.name} ({(scanFile.size / 1024).toFixed(1)} KB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-2">
                      <div className="w-14 h-14 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="text-xs md:text-sm font-bold text-slate-900 dark:text-white block">
                          Sube tu informe de dietista o menú pautado
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                          Elige si prefieres seleccionar un archivo PDF, elegir de tu galería o tomar una foto
                        </span>
                      </div>

                      {/* Action buttons: Files/PDF/Gallery vs Camera */}
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        {/* Option 1: File / PDF / Gallery */}
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-amber-500 text-slate-800 dark:text-zinc-200 font-bold text-xs shadow-sm hover:shadow transition-all">
                          <FileText className="w-4 h-4 text-rose-500" />
                          <span>Elegir PDF o Galería</span>
                          <input
                            type="file"
                            accept="application/pdf,image/*,.pdf"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>

                        {/* Option 2: Direct Camera */}
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs shadow-sm hover:shadow transition-all">
                          <Camera className="w-4 h-4" />
                          <span>Hacer foto con la cámara</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Patient & Household Servings Setup */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60">
                  {/* Assigned Person */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-amber-500" />
                      <span>¿A quién pertenece este informe?</span>
                    </label>
                    <select
                      value={targetDinerId || ''}
                      onChange={(e) => setTargetDinerId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200"
                    >
                      <option value="">👤 Mi perfil personal principal</option>
                      {dinersList.map(d => (
                        <option key={d.id} value={d.id}>
                          👥 {d.name} {d.dietary_goal ? `(${d.dietary_goal})` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-1">
                      Se actualizarán sus calorías diarias y notas con las pautas de la consulta.
                    </span>
                  </div>

                  {/* Servings for Household */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <span>Raciones a cocinar en el hogar</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={householdServings}
                        onChange={(e) => setHouseholdServings(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200"
                      >
                        <option value="1">1 Ración (Solo para el paciente)</option>
                        <option value="2">2 Raciones (Paciente + Pareja / Conviviente) ⭐</option>
                        <option value="3">3 Raciones (3 personas en casa)</option>
                        <option value="4">4 Raciones (Familia estándar)</option>
                        <option value="5">5 Raciones</option>
                        <option value="6">6 Raciones</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-1 leading-snug">
                      La dieta prescribe para 1 persona. Al elegir más raciones, se escalan las cantidades manteniendo el cálculo calórico por persona.
                    </span>
                  </div>
                </div>

                {/* Target Week & Preferences */}
                <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-zinc-300">Semana a planificar:</span>
                    <span className="font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-zinc-700">
                      Semana {weekDays[0].displayDate} al {weekDays[6].displayDate}
                    </span>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={createMissingRecipes}
                      onChange={(e) => setCreateMissingRecipes(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-zinc-700 focus:ring-amber-500 accent-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Añadir automáticamente las recetas nuevas a mi recetario
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5 leading-relaxed">
                        Si el plan contiene platos cocinados (guisos, pescados, tortillas, verduras al horno), la IA creará su ficha completa con los ingredientes escalados a {householdServings} raciones para que podáis volver a cocinarlos.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Modal Footer Step 1 */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowScanModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleScanNutritionPlan}
                    disabled={!scanFile || isScanning}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Extrayendo informe y dieta con Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-zinc-950" />
                        <span>Analizar Informe de Dietista con IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Interactive Review */}
            {parsedPlan && !scanSuccessMessage && (
              <div className="space-y-4 py-1 overflow-y-auto flex-1 pr-1">
                {/* Patient Profile & Dietitian Habits Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Perfil & Hábitos Prescritos por la Dietista
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-zinc-950">
                      Detectado por IA
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Patient Name */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Paciente / Comensal
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Nombre del paciente"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* Target Calories */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Calorías Diarias Objetivo
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-amber-500" />
                        <input
                          type="number"
                          value={patientCalories}
                          onChange={(e) => setPatientCalories(e.target.value ? Number(e.target.value) : '')}
                          placeholder="ej. 1600"
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white text-center"
                        />
                        <span className="text-xs text-slate-500 font-semibold">kcal/día</span>
                      </div>
                    </div>

                    {/* Dietary Goal */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                        Objetivo Clínico
                      </label>
                      <select
                        value={patientGoal}
                        onChange={(e) => setPatientGoal(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="deficit">Déficit (Pérdida de peso/grasa)</option>
                        <option value="mantenimiento">Mantenimiento saludable</option>
                        <option value="superavit">Superávit (Ganancia muscular)</option>
                        <option value="saludable">Saludable / Equilibrada</option>
                        <option value="antiinflamatorio">Pauta Antiinflamatoria</option>
                      </select>
                    </div>
                  </div>

                  {/* Habits & Guidelines */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                      Pautas generales de hidratación, hábitos y estilo de vida
                    </label>
                    <textarea
                      rows={2}
                      value={patientHabits}
                      onChange={(e) => setPatientHabits(e.target.value)}
                      placeholder="Pautas prescritas: 2L agua, evitar procesados, cocciones al vapor..."
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-200 resize-none"
                    />
                  </div>

                  {/* Dietary Guidelines Chips if extracted */}
                  {parsedPlan.dietary_guidelines && parsedPlan.dietary_guidelines.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {parsedPlan.dietary_guidelines.map((g: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-white dark:bg-zinc-900 border border-amber-500/20 text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                          ✓ {g}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Update Diner Profile Toggle & Servings Selection */}
                  <div className="pt-2 border-t border-amber-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={updateDinerProfile}
                        onChange={(e) => setUpdateDinerProfile(e.target.checked)}
                        className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-zinc-700 focus:ring-amber-500 accent-amber-500"
                      />
                      <span>Actualizar mi perfil nutricional con estas pautas y calorías</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-600 dark:text-zinc-400">Raciones para cocinar:</span>
                      <select
                        value={householdServings}
                        onChange={(e) => setHouseholdServings(Number(e.target.value))}
                        className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="1">1 Ración</option>
                        <option value="2">2 Raciones (Pareja / Conviviente) ⭐</option>
                        <option value="3">3 Raciones</option>
                        <option value="4">4 Raciones (Familia)</option>
                        <option value="6">6 Raciones</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Plan Title & Notes Header */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-0.5">
                        Título del Plan Nutricional
                      </label>
                      <input
                        type="text"
                        value={parsedPlan.plan_title}
                        onChange={(e) => setParsedPlan({ ...parsedPlan, plan_title: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-3 sm:pt-0">
                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                        {parsedPlan.days?.length || 0} Días detectados
                      </span>
                    </div>
                  </div>

                  {parsedPlan.notes && (
                    <div className="text-[11px] text-slate-600 dark:text-zinc-300 bg-amber-500/5 p-2 rounded-xl border border-amber-500/15">
                      <span className="font-bold text-amber-600 dark:text-amber-400">📌 Observaciones: </span>
                      {parsedPlan.notes}
                    </div>
                  )}
                </div>

                {/* Days and Meals List */}
                <div className="space-y-3">
                  {parsedPlan.days?.map((day: any, dayIdx: number) => (
                    <div key={dayIdx} className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-amber-500" />
                          {day.day_name} ({day.date ? new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : `Día ${dayIdx + 1}`})
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {day.meals?.length || 0} comidas
                        </span>
                      </div>

                      <div className="space-y-2">
                        {day.meals?.map((meal: any, mealIdx: number) => (
                          <div
                            key={mealIdx}
                            className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {/* Meal Type badge */}
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex-shrink-0">
                                {meal.meal_type}
                              </span>

                              {/* Title input */}
                              <input
                                type="text"
                                value={meal.title}
                                onChange={(e) => handleUpdateParsedMeal(dayIdx, mealIdx, 'title', e.target.value)}
                                className="flex-1 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-white font-medium"
                              />
                            </div>

                            <div className="flex items-center gap-2 justify-between md:justify-end">
                              {/* Calories input */}
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 flex-shrink-0">
                                <Flame className="w-3.5 h-3.5 text-amber-500" />
                                <input
                                  type="number"
                                  value={meal.calories || ''}
                                  onChange={(e) => handleUpdateParsedMeal(dayIdx, mealIdx, 'calories', e.target.value ? Number(e.target.value) : null)}
                                  placeholder="kcal"
                                  className="w-14 px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-white text-center font-bold"
                                />
                                <span className="text-[10px]">kcal</span>
                              </div>

                              {/* Status Badge */}
                              {meal.is_existing ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap" title="Se vinculará a la receta existente de tu recetario">
                                  ✓ En recetario
                                </span>
                              ) : meal.is_recipe ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap" title={`Se creará receta adaptada para ${householdServings} raciones`}>
                                  ✨ Nueva ({householdServings} rac.)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                  ⚡ Alimento directo
                                </span>
                              )}

                              {/* Toggle Recipe vs Direct Food */}
                              {!meal.is_existing && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateParsedMeal(dayIdx, mealIdx, 'is_recipe', !meal.is_recipe)}
                                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500"
                                  title={meal.is_recipe ? 'Cambiar a alimento directo sin receta' : 'Cambiar a receta completa'}
                                >
                                  {meal.is_recipe ? <ChefHat className="w-3.5 h-3.5 text-blue-500" /> : <Apple className="w-3.5 h-3.5 text-amber-500" />}
                                </button>
                              )}

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteParsedMeal(dayIdx, mealIdx)}
                                className="p-1 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                                title="Quitar del plan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confirm Options & Footer Step 2 */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={createMissingRecipes}
                      onChange={(e) => setCreateMissingRecipes(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-zinc-700 focus:ring-amber-500 accent-amber-500"
                    />
                    <span>Guardar nuevas recetas en el recetario ({householdServings} raciones)</span>
                  </label>

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setParsedPlan(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      ← Subir otro informe
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyNutritionPlan}
                      disabled={isApplyingPlan}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all"
                    >
                      {isApplyingPlan ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Aplicando plan y escalando recetas...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Confirmar y Aplicar al Planificador</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Guardar Semana como Plantilla</h3>
              </div>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Guarda el menú de esta semana ({weekDays[0].displayDate} - {weekDays[6].displayDate}) como una plantilla reutilizable para aplicarla cuando quieras a cualquier otra semana.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nombre de la Plantilla</label>
              <input
                type="text"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="Ej: Menú Mediterráneo Equilibrado"
                className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>{isSavingTemplate ? 'Guardando...' : 'Guardar Plantilla'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List & Apply Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-sky-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Plantillas de Menú Semanal</h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Aplica una plantilla a la semana visible ({weekDays[0].displayDate} - {weekDays[6].displayDate})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingTemplates ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Cargando plantillas...</span>
                </div>
              ) : templatesList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <BookmarkPlus className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto" />
                  <p className="font-semibold text-sm">No tienes plantillas guardadas todavía.</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Diseña o genera un menú semanal que te guste y pulsa en "Guardar Plantilla" para poder reutilizarlo cuando quieras.
                  </p>
                </div>
              ) : (
                templatesList.map(tpl => {
                  const totalMeals = tpl.slots?.reduce((acc: number, s: any) => acc + (s.planned_recipes?.length || 0), 0) || 0;
                  return (
                    <div
                      key={tpl.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm block">
                          {tpl.title}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
                          <span>{totalMeals} platos programados</span>
                          <span>•</span>
                          <span>{new Date(tpl.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tpl.id, 'replace')}
                          disabled={isApplyingTemplate}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
                        >
                          Aplicar a esta semana
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Week Modal */}
      {showCopyWeekModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-purple-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Copiar Menú Semanal</h3>
              </div>
              <button
                onClick={() => setShowCopyWeekModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Copia todas las comidas programadas de esta semana ({weekDays[0].displayDate} - {weekDays[6].displayDate}) directamente a otra semana futura.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Semana de Destino</label>
                <select
                  value={copyTargetWeekOffset}
                  onChange={(e) => setCopyTargetWeekOffset(Number(e.target.value))}
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                >
                  <option value={1}>Semana siguiente (+1 semana)</option>
                  <option value={2}>Dentro de 2 semanas (+2 semanas)</option>
                  <option value={3}>Dentro de 3 semanas (+3 semanas)</option>
                  <option value={4}>Dentro de 4 semanas (+4 semanas)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Modo de Copia</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setCopyMode('replace')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      copyMode === 'replace'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold ring-1 ring-purple-500'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="block font-bold">Sustituir destino</span>
                    <span className="text-[10px] font-normal opacity-70 block mt-0.5">Limpia la semana destino y coloca estas comidas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyMode('merge')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      copyMode === 'merge'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold ring-1 ring-purple-500'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="block font-bold">Añadir a destino</span>
                    <span className="text-[10px] font-normal opacity-70 block mt-0.5">Conserva lo existente y añade estas comidas</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCopyWeekModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteCopyWeek}
                disabled={isCopyingWeek}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isCopyingWeek ? 'Copiando...' : 'Copiar Menú'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Move Item Modal */}
      {movingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Mover Comida</h3>
              </div>
              <button
                onClick={() => setMovingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Mover <span className="font-bold text-slate-900 dark:text-white">"{movingItem.title}"</span> a otro día u horario:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Día de Destino</label>
                <select
                  value={moveTargetDate}
                  onChange={(e) => setMoveTargetDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  {weekDays.map(d => (
                    <option key={d.isoDate} value={d.isoDate}>
                      {d.name} ({d.displayDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Momento / Horario</label>
                <select
                  value={moveTargetMealType}
                  onChange={(e) => setMoveTargetMealType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  {MEAL_TYPES.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMovingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickMove}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Mover Plato</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
