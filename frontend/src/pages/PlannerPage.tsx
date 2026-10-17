import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Sparkles, Plus, Clock,
  ChevronLeft, ChevronRight, CheckCircle, Utensils,
  Package, Trash2, ArrowRight
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const PlannerPage: React.FC = () => {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [leftovers, setLeftovers] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLeftoverModal, setShowLeftoverModal] = useState(false);
  const [newLeftoverName, setNewLeftoverName] = useState('');
  const [newLeftoverPortions, setNewLeftoverPortions] = useState(2);

  const fetchPlans = async () => {
    try {
      const data = await apiRequest('/meal-plans');
      setPlans(data);
      if (data.length > 0 && !activePlan) {
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

  useEffect(() => {
    fetchPlans();
    fetchLeftovers();
  }, []);

  const handleGenerateAiMenu = async () => {
    setIsGenerating(true);
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const res = await apiRequest('/meal-plans/generate-ai', {
        method: 'POST',
        body: JSON.stringify({
          start_date: today.toISOString().split('T')[0],
          end_date: nextWeek.toISOString().split('T')[0],
          focus_healthy: true,
          quick_meals_only: false,
          use_pantry_items: true,
          appliances: ['Thermomix', 'Airfryer', 'Tradicional']
        })
      });
      await fetchPlans();
      alert('¡Menú semanal sugerido con éxito según tus preferencias y recetas aprobadas!');
    } catch (err: any) {
      alert(`Error al generar menú: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
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

  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t('planner')}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Menús semanales inteligentes para el hogar</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAiMenu}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4 fill-zinc-950" />
            <span>{isGenerating ? 'Generando menú...' : t('generate_menu_ai')}</span>
          </button>
        </div>
      </div>

      {/* Leftovers (Sobras) Alert Section */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Aprovechamiento de Sobras Guardadas ({leftovers.length})
            </h3>
          </div>
          <button
            onClick={() => setShowLeftoverModal(true)}
            className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar sobra</span>
          </button>
        </div>

        {leftovers.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No hay sobras pendientes de consumir en el frigorífico.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {leftovers.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
              >
                <span className="font-semibold text-zinc-200">{l.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono">({l.portions} raciones)</span>
                <button
                  onClick={() => handleConsumeLeftover(l.id)}
                  className="text-zinc-500 hover:text-emerald-400"
                  title="Marcar como consumida"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar Week Slots */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {daysOfWeek.map((day, dIdx) => (
            <div
              key={dIdx}
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-sm font-bold text-white">{day}</span>
                <span className="text-[10px] font-semibold text-zinc-500">Semana actual</span>
              </div>

              {/* Comida Slot */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/60 space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Comida</span>
                <p className="text-xs font-semibold text-zinc-200 line-clamp-1">
                  {dIdx === 0 ? 'Pollo al curry con arroz' : dIdx === 1 ? 'Lentejas estofadas con verduras' : dIdx === 2 ? 'Salmón crujiente en Airfryer' : 'Plato equilibrado de temporada'}
                </p>
                <span className="text-[10px] text-zinc-500">4 comensales</span>
              </div>

              {/* Cena Slot */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/60 space-y-1">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Cena</span>
                <p className="text-xs font-semibold text-zinc-200 line-clamp-1">
                  {dIdx === 0 ? 'Crema ligera de calabacín (TM7)' : dIdx === 1 ? 'Tortilla francesa con ensalada' : 'Cena ligera saludable'}
                </p>
                <span className="text-[10px] text-zinc-500">4 comensales</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for adding leftovers */}
      {showLeftoverModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-white">Guardar Sobras</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-medium">Nombre del plato o preparación</label>
                <input
                  type="text"
                  value={newLeftoverName}
                  onChange={(e) => setNewLeftoverName(e.target.value)}
                  placeholder="ej. Arroz con verduras restante"
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium">Raciones disponibles</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newLeftoverPortions}
                  onChange={(e) => setNewLeftoverPortions(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowLeftoverModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateLeftover}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400"
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
