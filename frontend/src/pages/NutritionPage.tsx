import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, Sparkles, Shield, AlertCircle, Save, Check,
  Bot, Utensils, Flame, Clock, Zap, ChefHat, Users,
  ArrowRight, CheckCircle2, Sliders, ThumbsUp, ThumbsDown,
  Dumbbell, Target, Calculator, Plus, Trash2, Edit2, X, Activity, FileText,
  Calendar, RotateCw, Lightbulb, BookOpen, ChevronRight, Send, Eye, CheckSquare
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useHousehold } from '../context/HouseholdContext';
import { DietaryAssistantModal } from '../components/DietaryAssistantModal';

export const NutritionPage: React.FC = () => {
  const { t } = useLanguage();
  const { activeHousehold } = useHousehold();
  const [profile, setProfile] = useState<any>(null);
  const [diners, setDiners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);

  // Active Dietitian Report State
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [activeReportTab, setActiveReportTab] = useState<'guidelines' | 'menu' | 'recipes' | 'habits'>('guidelines');
  const [editingGuidelines, setEditingGuidelines] = useState<string[]>([]);
  const [newGuidelineInput, setNewGuidelineInput] = useState('');
  const [editingGuidelineIdx, setEditingGuidelineIdx] = useState<number | null>(null);
  const [editingGuidelineText, setEditingGuidelineText] = useState('');
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [reportSaveSuccess, setReportSaveSuccess] = useState(false);

  // Apply Report Menu to Week State
  const [targetApplyDate, setTargetApplyDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(today.setDate(diff));
    return mon.toISOString().split('T')[0];
  });
  const [applyServings, setApplyServings] = useState<number>(2);
  const [isApplyingToWeek, setIsApplyingToWeek] = useState(false);
  const [applyToWeekSuccess, setApplyToWeekSuccess] = useState<string | null>(null);

  // Form states - Dietary & Habits
  const [dietaryGoals, setDietaryGoals] = useState('Dieta mediterránea rica en verduras y AOVE');
  const [cookingHabits, setCookingHabits] = useState('Cocina diaria con Thermomix y Airfryer');
  const [availableTimeMin, setAvailableTimeMin] = useState(30);
  const [preferredFoods, setPreferredFoods] = useState('Verduras de temporada, pescado blanco, legumbres, fruta fresca');
  const [excludedFoods, setExcludedFoods] = useState('Fritos, ultraprocesados, exceso de sal');
  const [notes, setNotes] = useState('');

  // Sports & Nutrition Target Metrics
  const [physicalActivity, setPhysicalActivity] = useState<string>('moderado');
  const [dietaryGoal, setDietaryGoal] = useState<string>('mantenimiento');
  const [sex, setSex] = useState<string>('hombre');
  const [age, setAge] = useState<number | ''>(35);
  const [weightKg, setWeightKg] = useState<number | ''>(75);
  const [heightCm, setHeightCm] = useState<number | ''>(178);
  const [calorieOffset, setCalorieOffset] = useState<number>(0);

  // Computed metrics from backend
  const [calculatedBmr, setCalculatedBmr] = useState<number | null>(null);
  const [targetCalories, setTargetCalories] = useState<number | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<any>({
    desayuno: 400,
    almuerzo: 200,
    comida: 700,
    merienda: 200,
    cena: 500
  });

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

  // Diner Modal State
  const [showDinerModal, setShowDinerModal] = useState(false);
  const [editingDinerId, setEditingDinerId] = useState<number | null>(null);
  const [dinerName, setDinerName] = useState('');
  const [dinerSex, setDinerSex] = useState('hombre');
  const [dinerAge, setDinerAge] = useState<number | ''>('');
  const [dinerWeight, setDinerWeight] = useState<number | ''>('');
  const [dinerHeight, setDinerHeight] = useState<number | ''>('');
  const [dinerActivity, setDinerActivity] = useState('moderado');
  const [dinerGoal, setDinerGoal] = useState('mantenimiento');
  const [dinerTargetCals, setDinerTargetCals] = useState<number | ''>('');
  const [dinerCalOffset, setDinerCalOffset] = useState<number>(0);
  const [dinerRestrictions, setDinerRestrictions] = useState('');
  const [dinerDislikes, setDinerDislikes] = useState('');
  const [dinerNotes, setDinerNotes] = useState('');
  const [isSavingDiner, setIsSavingDiner] = useState(false);

  const fetchProfileAndHousehold = async () => {
    setLoading(true);
    try {
      const [profData, hhData, dinersData] = await Promise.all([
        apiRequest('/nutrition/profile').catch(() => null),
        apiRequest('/households/current').catch(() => null),
        apiRequest<any[]>('/households/diners').catch(() => [])
      ]);

      if (profData) {
        setProfile(profData);
        if (profData.dietary_goals) setDietaryGoals(profData.dietary_goals);
        if (profData.cooking_habits) setCookingHabits(profData.cooking_habits);
        if (profData.available_time_min) setAvailableTimeMin(profData.available_time_min);
        if (profData.preferred_foods) setPreferredFoods(profData.preferred_foods);
        if (profData.excluded_foods) setExcludedFoods(profData.excluded_foods);
        if (profData.notes) setNotes(profData.notes);

        if (profData.physical_activity) setPhysicalActivity(profData.physical_activity);
        if (profData.dietary_goal) setDietaryGoal(profData.dietary_goal);
        if (profData.sex) setSex(profData.sex);
        if (profData.age) setAge(profData.age);
        if (profData.weight_kg) setWeightKg(profData.weight_kg);
        if (profData.height_cm) setHeightCm(profData.height_cm);
        if (profData.calorie_offset !== undefined) setCalorieOffset(profData.calorie_offset);
        if (profData.calculated_bmr) setCalculatedBmr(profData.calculated_bmr);
        if (profData.target_calories) setTargetCalories(profData.target_calories);
        if (profData.daily_meal_breakdown) setDailyBreakdown(profData.daily_meal_breakdown);

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

      if (dinersData && Array.isArray(dinersData)) {
        setDiners(dinersData);
      } else if (hhData && Array.isArray(hhData.diners)) {
        setDiners(hhData.diners);
      }
    } catch (err) {
      console.warn('Error fetching nutrition profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveReport = async () => {
    setLoadingReport(true);
    try {
      const data = await apiRequest('/nutrition/active-report');
      setActiveReport(data);
      if (data && data.dietary_guidelines) {
        setEditingGuidelines(data.dietary_guidelines);
      }
      if (data && data.household_servings) {
        setApplyServings(data.household_servings);
      }
    } catch (err) {
      console.warn('Error fetching active dietitian report:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSaveGuidelines = async (newGuidelinesList: string[]) => {
    if (!activeReport) return;
    setIsSavingReport(true);
    try {
      const updated = await apiRequest(`/nutrition/reports/${activeReport.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          dietary_guidelines: newGuidelinesList
        })
      });
      setActiveReport(updated);
      setEditingGuidelines(updated.dietary_guidelines || []);
      setReportSaveSuccess(true);
      setTimeout(() => setReportSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error saving guidelines:', err);
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleAddGuideline = () => {
    if (!newGuidelineInput.trim()) return;
    const updated = [...editingGuidelines, newGuidelineInput.trim()];
    setEditingGuidelines(updated);
    setNewGuidelineInput('');
    handleSaveGuidelines(updated);
  };

  const handleDeleteGuideline = (idx: number) => {
    const updated = editingGuidelines.filter((_, i) => i !== idx);
    setEditingGuidelines(updated);
    handleSaveGuidelines(updated);
  };

  const handleStartEditGuideline = (idx: number) => {
    setEditingGuidelineIdx(idx);
    setEditingGuidelineText(editingGuidelines[idx]);
  };

  const handleSaveEditGuideline = () => {
    if (editingGuidelineIdx === null || !editingGuidelineText.trim()) return;
    const updated = [...editingGuidelines];
    updated[editingGuidelineIdx] = editingGuidelineText.trim();
    setEditingGuidelines(updated);
    setEditingGuidelineIdx(null);
    setEditingGuidelineText('');
    handleSaveGuidelines(updated);
  };

  const handleApplyReportToWeek = async () => {
    if (!activeReport) return;
    setIsApplyingToWeek(true);
    setApplyToWeekSuccess(null);
    try {
      const res = await apiRequest(`/nutrition/reports/${activeReport.id}/apply-to-week`, {
        method: 'POST',
        body: JSON.stringify({
          target_start_date: targetApplyDate,
          household_servings: Number(applyServings)
        })
      });
      setApplyToWeekSuccess(res.message || 'Menú aplicado correctamente a la semana seleccionada.');
      setTimeout(() => setApplyToWeekSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Error al aplicar el menú a la semana');
    } finally {
      setIsApplyingToWeek(false);
    }
  };

  useEffect(() => {
    fetchProfileAndHousehold();
    fetchActiveReport();
  }, [activeHousehold?.id]);

  // Recalculate local preview calories
  useEffect(() => {
    if (weightKg && heightCm && age && sex) {
      let bmr = 0;
      if (sex === 'hombre') {
        bmr = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * Number(age) + 5;
      } else {
        bmr = 10 * Number(weightKg) + 6.25 * Number(heightCm) - 5 * Number(age) - 161;
      }
      setCalculatedBmr(Math.round(bmr));

      let mult = 1.2;
      if (physicalActivity === 'intenso') mult = 1.725;
      else if (physicalActivity === 'atleta') mult = 1.9;
      else if (physicalActivity === 'moderado') mult = 1.55;
      else if (physicalActivity === 'ligero') mult = 1.375;

      let goalAdj = 0;
      if (dietaryGoal === 'deficit') goalAdj = -400;
      else if (dietaryGoal === 'superavit') goalAdj = 300;

      const total = Math.round(bmr * mult + goalAdj + (Number(calorieOffset) || 0));
      setTargetCalories(total);

      setDailyBreakdown({
        desayuno: Math.round(total * 0.20),
        almuerzo: Math.round(total * 0.10),
        comida: Math.round(total * 0.35),
        merienda: Math.round(total * 0.10),
        cena: Math.round(total * 0.25)
      });
    }
  }, [weightKg, heightCm, age, sex, physicalActivity, dietaryGoal, calorieOffset]);

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

      const updated = await apiRequest('/nutrition/profile', {
        method: 'PUT',
        body: JSON.stringify({
          dietary_goals: dietaryGoals,
          cooking_habits: `${cookingHabits}. Preferencia: ${recipeStyles.join(', ')}`,
          available_time_min: Number(availableTimeMin),
          physical_activity: physicalActivity,
          dietary_goal: dietaryGoal,
          sex,
          age: age ? Number(age) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          height_cm: heightCm ? Number(heightCm) : null,
          calorie_offset: Number(calorieOffset) || 0,
          preferred_foods: preferredFoods,
          excluded_foods: excludedFoods,
          focus_on_healthy: true,
          notes: encodedNotes
        })
      });

      if (updated) {
        setCalculatedBmr(updated.calculated_bmr);
        setTargetCalories(updated.target_calories);
        if (updated.daily_meal_breakdown) setDailyBreakdown(updated.daily_meal_breakdown);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Open modal for adding/editing a diner
  const handleOpenDinerModal = (diner?: any) => {
    if (diner) {
      setEditingDinerId(diner.id);
      setDinerName(diner.name || '');
      setDinerSex(diner.sex || 'hombre');
      setDinerAge(diner.age || '');
      setDinerWeight(diner.weight_kg || '');
      setDinerHeight(diner.height_cm || '');
      setDinerActivity(diner.activity_level || 'moderado');
      setDinerGoal(diner.dietary_goal || 'mantenimiento');
      setDinerTargetCals(diner.target_calories || '');
      setDinerCalOffset(diner.calorie_offset || 0);

      const restrs = (diner.restrictions || []).map((r: any) => r.details || r.restriction_type).join(', ');
      setDinerRestrictions(restrs);
      const dislikes = (diner.preferences || []).filter((p: any) => p.preference_type === 'dislike').map((p: any) => p.ingredient_name).join(', ');
      setDinerDislikes(dislikes);
      setDinerNotes(diner.notes || '');
    } else {
      setEditingDinerId(null);
      setDinerName('');
      setDinerSex('hombre');
      setDinerAge('');
      setDinerWeight('');
      setDinerHeight('');
      setDinerActivity('moderado');
      setDinerGoal('mantenimiento');
      setDinerTargetCals('');
      setDinerCalOffset(0);
      setDinerRestrictions('');
      setDinerDislikes('');
      setDinerNotes('');
    }
    setShowDinerModal(true);
  };

  const handleSaveDiner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dinerName.trim()) return;

    setIsSavingDiner(true);
    try {
      const restrList = dinerRestrictions
        ? dinerRestrictions.split(',').map(s => s.trim()).filter(Boolean).map(item => ({
            restriction_type: 'dietary',
            details: item
          }))
        : [];

      const prefList = dinerDislikes
        ? dinerDislikes.split(',').map(s => s.trim()).filter(Boolean).map(item => ({
            preference_type: 'dislike',
            ingredient_name: item
          }))
        : [];

      const payload = {
        name: dinerName.trim(),
        is_active: true,
        sex: dinerSex,
        age: dinerAge ? Number(dinerAge) : null,
        weight_kg: dinerWeight ? Number(dinerWeight) : null,
        height_cm: dinerHeight ? Number(dinerHeight) : null,
        activity_level: dinerActivity,
        dietary_goal: dinerGoal,
        target_calories: dinerTargetCals ? Number(dinerTargetCals) : null,
        calorie_offset: Number(dinerCalOffset) || 0,
        notes: dinerNotes,
        restrictions: restrList,
        preferences: prefList
      };

      if (editingDinerId) {
        await apiRequest(`/households/diners/${editingDinerId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest('/households/diners', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setShowDinerModal(false);
      setEditingDinerId(null);
      await fetchProfileAndHousehold();
    } catch (err: any) {
      alert(`Error al guardar comensal: ${err.message || err}`);
    } finally {
      setIsSavingDiner(false);
    }
  };

  const handleDeleteDiner = async (id: number) => {
    if (!confirm('¿Eliminar esta persona de tu hogar?')) return;
    try {
      await apiRequest(`/households/diners/${id}`, { method: 'DELETE' });
      await fetchProfileAndHousehold();
    } catch (err: any) {
      alert(`Error: ${err.message || err}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6 animate-in fade-in pb-24">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-sm">
            <Heart className="w-6 h-6 fill-emerald-500/20" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Mi Alimentación Saludable
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
              Personaliza tus hábitos, actividad física, objetivo calórico diario y personas de tu familia
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDietModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <Bot className="w-4 h-4 fill-zinc-950" />
          <span>Consultar Asistente Dietético</span>
        </button>
      </div>

      {/* Dietitian Report Section */}
      {activeReport ? (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-amber-500/30 space-y-5 shadow-sm relative overflow-hidden">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-zinc-950 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Siguiendo Actualmente
                  </span>
                  {activeReport.patient_name && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      Pauta para: {activeReport.patient_name}
                    </span>
                  )}
                  {activeReport.target_calories && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {activeReport.target_calories} kcal / día
                    </span>
                  )}
                  {activeReport.dietary_goal && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 capitalize">
                      Meta: {activeReport.dietary_goal}
                    </span>
                  )}
                </div>
                <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-1">
                  {activeReport.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Importado el {new Date(activeReport.created_at).toLocaleDateString()} · Raciones para el hogar: {activeReport.household_servings} personas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Link
                to="/planner?scan=diet"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs transition-colors"
                title="Subir un nuevo informe o actualizar el actual"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Actualizar / Subir Nuevo</span>
              </Link>
            </div>
          </div>

          {/* Subtabs Header */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-950 rounded-2xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveReportTab('guidelines')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeReportTab === 'guidelines'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Lightbulb className={`w-4 h-4 ${activeReportTab === 'guidelines' ? 'text-amber-500' : ''}`} />
              <span>Pautas y Consejos ({editingGuidelines.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('menu')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeReportTab === 'menu'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className={`w-4 h-4 ${activeReportTab === 'menu' ? 'text-emerald-500' : ''}`} />
              <span>Menú Propuesto ({activeReport.raw_plan_data?.length || 0} días)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('recipes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeReportTab === 'recipes'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ChefHat className={`w-4 h-4 ${activeReportTab === 'recipes' ? 'text-rose-500' : ''}`} />
              <span>Recetas del Informe ({activeReport.recipes?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('habits')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeReportTab === 'habits'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Target className={`w-4 h-4 ${activeReportTab === 'habits' ? 'text-blue-500' : ''}`} />
              <span>Hábitos y Objetivos</span>
            </button>
          </div>

          {/* Subtab 1: Pautas y Consejos */}
          {activeReportTab === 'guidelines' && (
            <div className="space-y-4 pt-1">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Tips activos en Inicio:</strong> Las pautas que mantengas aquí se muestran y rotan de forma inteligente o aleatoria en la página principal para que tengas siempre a la vista los consejos de tu dietista. Puedes modificarlas, añadir nuevas o eliminar las que ya no apliquen.
                </span>
              </div>

              {/* Add guideline form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGuidelineInput}
                  onChange={(e) => setNewGuidelineInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGuideline()}
                  placeholder="Ej. Beber un vaso de agua antes de cenar, priorizar fruta fresca..."
                  className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddGuideline}
                  disabled={!newGuidelineInput.trim() || isSavingReport}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Pauta</span>
                </button>
              </div>

              {/* Guidelines List */}
              <div className="space-y-2">
                {editingGuidelines.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 italic py-4 text-center">
                    No hay pautas registradas en este informe todavía. ¡Añade una arriba!
                  </p>
                ) : (
                  editingGuidelines.map((g, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 group hover:border-amber-500/40 transition-colors"
                    >
                      {editingGuidelineIdx === idx ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingGuidelineText}
                            onChange={(e) => setEditingGuidelineText(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-500 text-xs text-slate-900 dark:text-white focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditGuideline();
                              if (e.key === 'Escape') setEditingGuidelineIdx(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditGuideline}
                            className="p-1.5 rounded-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-xs font-bold"
                            title="Guardar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGuidelineIdx(null)}
                            className="p-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300 text-xs"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-slate-800 dark:text-zinc-200 font-medium leading-relaxed break-words">
                              {g}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleStartEditGuideline(idx)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
                              title="Editar pauta"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGuideline(idx)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Eliminar pauta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {reportSaveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pautas actualizadas con éxito. Ya están listas para mostrarse en la pantalla de inicio.</span>
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: Menú Propuesto */}
          {activeReportTab === 'menu' && (
            <div className="space-y-4 pt-1">
              {/* Action Bar: Apply to week */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-emerald-500" />
                    <span>Enviar este menú a una semana del planificador</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Elige la fecha de inicio (lunes) y las raciones deseadas para traspasar todo el menú propuesto a tu calendario semanal.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <span className="text-[11px] text-slate-500 font-bold">Semana:</span>
                    <input
                      type="date"
                      value={targetApplyDate}
                      onChange={(e) => setTargetApplyDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={applyServings}
                      onChange={(e) => setApplyServings(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none text-center"
                    />
                    <span className="text-[11px] text-slate-500">rac.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyReportToWeek}
                    disabled={isApplyingToWeek}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isApplyingToWeek ? 'Aplicando...' : 'Aplicar Menú a la Semana'}</span>
                  </button>
                </div>
              </div>

              {applyToWeekSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{applyToWeekSuccess}</span>
                  </div>
                  <Link
                    to={`/planner?date=${targetApplyDate}`}
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-[11px] hover:bg-emerald-400"
                  >
                    Ver en Planificador
                  </Link>
                </div>
              )}

              {/* Days List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(!activeReport.raw_plan_data || activeReport.raw_plan_data.length === 0) ? (
                  <p className="col-span-full text-xs text-slate-500 dark:text-zinc-400 italic text-center py-6">
                    No se guardó el detalle diario de comidas para este informe.
                  </p>
                ) : (
                  activeReport.raw_plan_data.map((d: any, dIdx: number) => (
                    <div
                      key={dIdx}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          {d.day_name || `Día ${dIdx + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {d.meals?.length || 0} tomas
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {d.meals?.map((m: any, mIdx: number) => (
                          <div
                            key={mIdx}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                {m.meal_type}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-zinc-200 truncate block">
                                {m.title}
                              </span>
                            </div>
                            {m.calories && (
                              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                                {m.calories} kcal
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Subtab 3: Recetas del Informe */}
          {activeReportTab === 'recipes' && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Recetas generadas o vinculadas al importar este informe nutricional.
                </p>
                <Link
                  to="/recipes"
                  className="text-xs font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                >
                  <span>Ir al Recetario Completo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {(!activeReport.recipes || activeReport.recipes.length === 0) ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-200 dark:border-zinc-800">
                  <ChefHat className="w-10 h-10 text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    No hay recetas específicas creadas para este informe. Las comidas se planificaron directamente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {activeReport.recipes.map((rec: any) => (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between gap-3 group hover:border-amber-500/40 transition-all shadow-sm"
                    >
                      <div className="space-y-1.5">
                        {rec.image_url && (
                          <img
                            src={rec.image_url}
                            alt={rec.title}
                            className="w-full h-28 object-cover rounded-xl mb-2"
                          />
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {rec.dish_type || 'Plato Dietista'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                          {rec.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          {rec.prep_time_min && <span>⏱️ {rec.prep_time_min} min</span>}
                          {rec.nutrition_calories && <span>🔥 {rec.nutrition_calories} kcal</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-zinc-800">
                        <Link
                          to={`/recipes/${rec.id}`}
                          className="flex-1 py-1.5 text-center rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-700 dark:text-zinc-300 hover:border-amber-500 transition-colors"
                        >
                          Ver Receta
                        </Link>
                        <Link
                          to={`/cook/${rec.id}`}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold transition-colors"
                          title="Modo Cocina guiado"
                        >
                          Cocinar
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subtab 4: Hábitos y Objetivos */}
          {activeReportTab === 'habits' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <span>Hábitos y Pautas de Estilo de Vida</span>
                  </span>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                    {activeReport.habits || 'No se detallaron hábitos adicionales en el informe.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ThumbsUp className="w-4 h-4 text-amber-500" />
                    <span>Alimentos Recomendados y Preferidos</span>
                  </span>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {activeReport.preferred_foods || 'Verduras frescas de temporada, legumbres, pescado blanco y azul, fruta entera.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ThumbsDown className="w-4 h-4 text-rose-500" />
                    <span>Alimentos a Limitar o Excluidos</span>
                  </span>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {activeReport.excluded_foods || 'Fritos, ultraprocesados, harinas refinadas y bebidas azucaradas.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Notas e Indicaciones Clínicas</span>
                  </span>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                    {activeReport.notes || 'Sin notas adicionales.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Callout banner if no report is active */
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                ¿Tienes un informe o pauta de tu nutricionista?
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-zinc-950 uppercase tracking-wider">
                  Nuevo con IA
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Sube la foto o PDF de tu dieta: la IA extraerá tus hábitos, consejos y calorías, guardará el informe para tenerlo siempre visible, planificará el menú semanal y mostrará tips diarios en el inicio.
              </p>
            </div>
          </div>
          <Link
            to="/planner?scan=diet"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all shrink-0 self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" />
            <span>Subir Informe de Dietista</span>
          </Link>
        </div>
      )}

      {/* Section 1: Hábitos de Deporte y Objetivo Calórico */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm">
        <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span>Nivel de Actividad Física y Objetivo Nutricional</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Define si haces deporte y tu meta actual para que la IA equilibre las calorías y nutrientes del menú
          </p>
        </div>

        {/* Physical Activity Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4 text-emerald-500" />
            <span>¿Cuánto deporte o actividad física realizas a la semana?</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'sedentario', label: 'Sedentario', sub: 'Poco o nada' },
              { id: 'ligero', label: 'Ligero', sub: '1 - 3 días/sem' },
              { id: 'moderado', label: 'Moderado', sub: '3 - 5 días/sem' },
              { id: 'intenso', label: 'Intenso', sub: '6 - 7 días/sem' },
              { id: 'atleta', label: 'Atleta', sub: 'Doble entreno' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPhysicalActivity(item.id)}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  physicalActivity === item.id
                    ? 'bg-emerald-500 text-zinc-950 font-bold border-emerald-500 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                }`}
              >
                <span className="text-xs block font-bold">{item.label}</span>
                <span className={`text-[10px] block mt-0.5 ${physicalActivity === item.id ? 'text-zinc-900' : 'text-slate-400 dark:text-zinc-500'}`}>
                  {item.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Nutritional Goal Selector */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-500" />
            <span>Objetivo Nutricional Principal</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {[
              { id: 'deficit', label: 'Pérdida de grasa / Definición', cals: '-400 kcal/día', desc: 'Déficit calórico suave y sostenible' },
              { id: 'mantenimiento', label: 'Mantenimiento normocalórico', cals: '0 kcal', desc: 'Mantener peso y composición corporal' },
              { id: 'superavit', label: 'Ganancia muscular / Volumen', cals: '+300 kcal/día', desc: 'Aporte extra para rendimiento y masa magra' },
              { id: 'saludable', label: 'Salud y longevidad', cals: 'Equilibrado', desc: 'Enfoque en densidad nutricional y micronutrientes' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDietaryGoal(item.id)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  dietaryGoal === item.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-slate-900 dark:text-white ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.cals}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Datos Antropométricos y Calculadora TDEE */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <span>Calculadora de Calorías Diarias (Fórmula Mifflin-St Jeor)</span>
            </label>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Cálculo en tiempo real</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Sexo</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="hombre">Hombre</option>
                <option value="mujer">Mujer</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Edad (años)</label>
              <input
                type="number"
                min="10"
                max="100"
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Peso (kg)</label>
              <input
                type="number"
                step="0.5"
                min="30"
                max="250"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : '')}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Altura (cm)</label>
              <input
                type="number"
                min="100"
                max="230"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : '')}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">Ajuste manual (+/- kcal)</label>
              <input
                type="number"
                step="50"
                value={calorieOffset}
                onChange={(e) => setCalorieOffset(Number(e.target.value) || 0)}
                placeholder="ej. +100 o -150"
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Calorie Results & Daily Breakdown Card */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Objetivo Calórico Diario Calculado:
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {targetCalories ? `${targetCalories.toLocaleString()} kcal / día` : 'Calculando...'}
                </span>
              </div>
              {calculatedBmr && (
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Metabolismo Basal (BMR): <strong className="text-slate-800 dark:text-zinc-200 font-mono">{calculatedBmr} kcal</strong>
                </span>
              )}
            </div>

            {/* Daily Meal Breakdown Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                Reparto sugerido por momentos del día:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-amber-500 block">☀️ Desayuno (20%)</span>
                  <span className="font-extrabold font-mono text-slate-800 dark:text-zinc-200 text-xs">
                    {dailyBreakdown.desayuno} kcal
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-sky-500 block">☕ Media Mañana (10%)</span>
                  <span className="font-extrabold font-mono text-slate-800 dark:text-zinc-200 text-xs">
                    {dailyBreakdown.almuerzo} kcal
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-emerald-500 block">🍲 Comida (35%)</span>
                  <span className="font-extrabold font-mono text-slate-800 dark:text-zinc-200 text-xs">
                    {dailyBreakdown.comida} kcal
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-purple-500 block">🥪 Merienda (10%)</span>
                  <span className="font-extrabold font-mono text-slate-800 dark:text-zinc-200 text-xs">
                    {dailyBreakdown.merienda} kcal
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-indigo-500 block">🌙 Cena (25%)</span>
                  <span className="font-extrabold font-mono text-slate-800 dark:text-zinc-200 text-xs">
                    {dailyBreakdown.cena} kcal
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Personas de mi Hogar (Comensales con Restricciones y Calorías) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Personas de mi Familia / Hogar ({diners.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Añade a tu pareja, hijos u otros miembros de la casa con su sexo, calorías y alergias individuales
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenDinerModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Persona</span>
          </button>
        </div>

        {diners.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {diners.map(diner => (
              <div
                key={diner.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-2 relative group hover:border-purple-500/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{diner.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 capitalize">
                      {diner.sex || 'Miembro'}{diner.age ? ` • ${diner.age} años` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenDinerModal(diner)}
                      className="p-1 rounded-lg hover:bg-purple-500/10 text-slate-400 hover:text-purple-600 transition-colors"
                      title="Editar comensal"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDiner(diner.id)}
                      className="p-1 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Eliminar comensal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {diner.target_calories && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                      🔥 {diner.target_calories} kcal
                    </span>
                  )}
                  {diner.activity_level && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 capitalize">
                      {diner.activity_level}
                    </span>
                  )}
                </div>

                {diner.restrictions && diner.restrictions.length > 0 ? (
                  <div className="space-y-0.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    {diner.restrictions.map((r: any, idx: number) => (
                      <div key={idx} className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                        <span>⚠️ {r.details || r.restriction_type}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 italic">Sin alergias registradas</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto" />
            <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
              Aún no has añadido a las personas de tu familia (pareja, hijos, etc.).
            </p>
            <button
              type="button"
              onClick={() => handleOpenDinerModal()}
              className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors"
            >
              + Añadir mi primera persona
            </button>
          </div>
        )}
      </div>

      {/* Section 3: Estilos de Cocina y Preferencias Rápidas */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm">
        <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <span>Estilos de Cocina y Tiempo Disponible</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Dile a la IA si prefieres recetas rápidas, sencillas o para llevar en tupper
          </p>
        </div>

        {/* Quick Style Chips */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
            Estilos favoritos para tus menús y recetas:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickStyleOptions.map(opt => {
              const selected = recipeStyles.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleStyle(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selected
                      ? 'bg-amber-500 text-zinc-950 font-bold border-amber-500 shadow-md shadow-amber-500/20'
                      : 'bg-slate-50 dark:bg-zinc-950 text-slate-700 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs block font-bold">{opt.id}</span>
                  <span className={`text-[10px] block mt-0.5 line-clamp-1 ${selected ? 'text-zinc-900' : 'text-slate-400 dark:text-zinc-500'}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time and Preferred / Excluded Foods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <div>
            <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ThumbsUp className="w-3.5 h-3.5" />
              Alimentos preferidos:
            </label>
            <textarea
              rows={2}
              value={preferredFoods}
              onChange={(e) => setPreferredFoods(e.target.value)}
              placeholder="ej. Verduras frescas, legumbres, fruta de temporada, salmón..."
              className="w-full mt-1.5 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
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
              placeholder="ej. Fritos, salsas pesadas, ultraprocesados, exceso de sal..."
              className="w-full mt-1.5 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm sticky bottom-20 md:bottom-6 z-20">
        <div className="text-xs text-slate-500 dark:text-zinc-400">
          {savedSuccess ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              ¡Preferencias y métricas calóricas guardadas con éxito!
            </span>
          ) : (
            <span>Los cambios afectarán inmediatamente a la IA y al Planificador Semanal.</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Guardando...' : 'Guardar Preferencias'}</span>
        </button>
      </div>

      {/* Modal: Add or Edit Diner / Family Member */}
      {showDinerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>{editingDinerId ? 'Editar Persona del Hogar' : 'Añadir Persona a mi Hogar'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDinerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDiner} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nombre o alias</label>
                <input
                  type="text"
                  required
                  value={dinerName}
                  onChange={(e) => setDinerName(e.target.value)}
                  placeholder="ej. Carlos, Laura, Lucas..."
                  className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Sexo</label>
                  <select
                    value={dinerSex}
                    onChange={(e) => setDinerSex(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="hombre">Hombre</option>
                    <option value="mujer">Mujer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Edad (años)</label>
                  <input
                    type="number"
                    min="1"
                    max="105"
                    value={dinerAge}
                    onChange={(e) => setDinerAge(e.target.value ? Number(e.target.value) : '')}
                    placeholder="ej. 32"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={dinerWeight}
                    onChange={(e) => setDinerWeight(e.target.value ? Number(e.target.value) : '')}
                    placeholder="ej. 68"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Altura (cm)</label>
                  <input
                    type="number"
                    value={dinerHeight}
                    onChange={(e) => setDinerHeight(e.target.value ? Number(e.target.value) : '')}
                    placeholder="ej. 172"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nivel de Deporte</label>
                  <select
                    value={dinerActivity}
                    onChange={(e) => setDinerActivity(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="sedentario">Sedentario</option>
                    <option value="ligero">Ligero (1-3 d)</option>
                    <option value="moderado">Moderado (3-5 d)</option>
                    <option value="intenso">Intenso (6-7 d)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Objetivo</label>
                  <select
                    value={dinerGoal}
                    onChange={(e) => setDinerGoal(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="deficit">Perder grasa (-400)</option>
                    <option value="mantenimiento">Mantenimiento (0)</option>
                    <option value="superavit">Ganar músculo (+300)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Calorías fijas (Opcional)</label>
                  <input
                    type="number"
                    value={dinerTargetCals}
                    onChange={(e) => setDinerTargetCals(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Auto o ej. 2100"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Compensación (+/- kcal)</label>
                  <input
                    type="number"
                    step="50"
                    value={dinerCalOffset}
                    onChange={(e) => setDinerCalOffset(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-rose-600 dark:text-rose-400">Alergias o intolerancias</label>
                <input
                  type="text"
                  value={dinerRestrictions}
                  onChange={(e) => setDinerRestrictions(e.target.value)}
                  placeholder="ej. Gluten, Lactosa, Frutos secos (separadas por comas)"
                  className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Alimentos que no le gustan</label>
                <input
                  type="text"
                  value={dinerDislikes}
                  onChange={(e) => setDinerDislikes(e.target.value)}
                  placeholder="ej. Brócoli, Cebolla, Pescado azul..."
                  className="w-full mt-1 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDinerModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDiner}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20"
                >
                  {isSavingDiner ? 'Guardando...' : 'Guardar Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dietary Assistant Modal */}
      <DietaryAssistantModal
        isOpen={showDietModal}
        onClose={() => setShowDietModal(false)}
      />
    </div>
  );
};
