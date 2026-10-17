import React, { useState, useEffect } from 'react';
import {
  Heart, Sparkles, Shield, AlertCircle, Save, Check
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const NutritionPage: React.FC = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);
  const [goals, setGoals] = useState('');
  const [habits, setHabits] = useState('');
  const [timeMin, setTimeMin] = useState(45);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isAskingAdvice, setIsAskingAdvice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/nutrition/profile');
      setProfile(data);
      setHasConsent(data.has_ai_consent);
      setGoals(data.dietary_goals || 'Aumentar verduras y reducir ultraprocesados');
      setHabits(data.cooking_habits || 'Cocina diaria y batch cooking los domingos');
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

  const handleConsentToggle = async () => {
    const nextConsent = !hasConsent;
    try {
      await apiRequest('/nutrition/consent', {
        method: 'POST',
        body: JSON.stringify({ consent: nextConsent })
      });
      setHasConsent(nextConsent);
    } catch (err) {
      console.warn('Error toggling consent:', err);
    }
  };

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

  const handleGetAdvice = async () => {
    if (!hasConsent) {
      alert('Debes activar el consentimiento de IA para recibir sugerencias saludables.');
      return;
    }
    setIsAskingAdvice(true);
    try {
      const res = await apiRequest('/nutrition/advice', {
        method: 'POST',
        body: JSON.stringify({ query: 'Recomendaciones semanales saludables' })
      });
      setAdvice(res.advice);
    } catch (err: any) {
      alert(`Error al solicitar orientación: ${err.message || err}`);
    } finally {
      setIsAskingAdvice(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-zinc-500 text-sm">Cargando perfil nutricional...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">{t('nutrition')}</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Espacio privado de orientación culinaria y hábitos saludables</p>
      </div>

      {/* Legal & Medical Disclaimer Banner */}
      <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300 leading-relaxed">
          {t('disclaimer_nutrition')}
        </p>
      </div>

      {/* AI Consent Card */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">{t('privacy_consent')}</h3>
          </div>
          <button
            onClick={handleConsentToggle}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              hasConsent
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {hasConsent ? t('consent_active') : t('consent_inactive')}
          </button>
        </div>
        <p className="text-xs text-zinc-400 leading-normal">
          {t('consent_desc')} Puedes revocar este consentimiento en cualquier momento.
        </p>
      </div>

      {/* Profile Form */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white">Preferencias y Metas de Cocina Saludable</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-zinc-300">Objetivos alimentarios principales</label>
            <input
              type="text"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="ej. Más verduras, reducir sal y frituras"
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300">Hábitos de cocina del hogar</label>
            <input
              type="text"
              value={habits}
              onChange={(e) => setHabits(e.target.value)}
              placeholder="ej. Cocinar a diario con Thermomix y Airfryer"
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300">Tiempo máximo habitual disponible (minutos)</label>
            <input
              type="number"
              value={timeMin}
              onChange={(e) => setTimeMin(Number(e.target.value))}
              className="w-full mt-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Perfil'}</span>
          </button>
        </div>
      </div>

      {/* AI Healthy Advice Assistant */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Asistente Culinario Saludable</h3>
          </div>
          <button
            onClick={handleGetAdvice}
            disabled={isAskingAdvice || !hasConsent}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold text-xs disabled:opacity-50"
          >
            {isAskingAdvice ? 'Analizando...' : 'Consultar Ideas Saludables'}
          </button>
        </div>

        {advice && (
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
            {advice}
          </div>
        )}
      </div>
    </div>
  );
};
