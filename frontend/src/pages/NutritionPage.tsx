import React, { useState, useEffect } from 'react';
import {
  Heart, Sparkles, Shield, AlertCircle, Save, Check,
  Bot, Utensils, Flame
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { DietaryAssistantModal } from '../components/DietaryAssistantModal';

export const NutritionPage: React.FC = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(true);
  const [goals, setGoals] = useState('');
  const [habits, setHabits] = useState('');
  const [timeMin, setTimeMin] = useState(45);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isAskingAdvice, setIsAskingAdvice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/nutrition/profile');
      setProfile(data);
      setHasConsent(data.has_ai_consent ?? true);
      setGoals(data.dietary_goals || 'Dieta mediterránea rica en verduras y AOVE');
      setHabits(data.cooking_habits || 'Cocina diaria con Thermomix y Airfryer');
      setTimeMin(data.available_time_min || 45);
    } catch (err) {
      console.warn('Error fetching nutrition profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await apiRequest('/nutrition/profile', {
        method: 'PUT',
        body: JSON.stringify({
          dietary_goals: goals,
          cooking_habits: habits,
          available_time_min: timeMin,
          focus_on_healthy: true
        })
      });
      alert('Perfil nutricional guardado correctamente.');
    } catch (err) {
      console.warn('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-zinc-500 text-sm">Cargando perfil dietético...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Asistente Dietético y Nutrición</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Espacio familiar de orientación dietética, hábitos saludables y adaptación de platos</p>
        </div>
        <button
          onClick={() => setShowDietModal(true)}
          className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-emerald-500/10 transition-all"
        >
          <Bot className="w-4 h-4" />
          <span>Consultar Asistente Dietético</span>
        </button>
      </div>

      {/* Legal & Medical Disclaimer Banner */}
      <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300 leading-relaxed">
          {t('disclaimer_nutrition')}
        </p>
      </div>

      {/* Profile Form */}
      <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" />
          Objetivos Dietéticos del Hogar
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-zinc-300">Enfoque dietético principal</label>
            <input
              type="text"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="ej. Dieta mediterránea, antiinflamatoria, baja en sal, celiaquía..."
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300">Hábitos de cocina del hogar</label>
            <input
              type="text"
              value={habits}
              onChange={(e) => setHabits(e.target.value)}
              placeholder="ej. Cocinar a diario con Thermomix y Airfryer, cenas ligeras"
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300">Tiempo máximo habitual disponible (minutos)</label>
            <input
              type="number"
              value={timeMin}
              onChange={(e) => setTimeMin(Number(e.target.value))}
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Perfil'}</span>
          </button>
        </div>
      </div>

      {/* AI Dietary Assistant Card */}
      <div className="p-5 rounded-3xl bg-zinc-900 border border-emerald-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Asistente Dietético Activo</h3>
          </div>
          <button
            onClick={() => setShowDietModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs transition-colors"
          >
            Abrir Diálogo con el Asistente
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          El Asistente Dietético analiza el perfil de tu hogar y tus recetas para sugerirte sustituciones saludables (ej. cambio de natas por leche de coco ligera, reducción de aceites mediante vapor o Airfryer, harinas integrales o sin gluten) y generar nuevas propuestas saludables con 1 clic.
        </p>
      </div>

      {/* Dietary Assistant Modal */}
      <DietaryAssistantModal
        isOpen={showDietModal}
        onClose={() => setShowDietModal(false)}
      />

    </div>
  );
};
