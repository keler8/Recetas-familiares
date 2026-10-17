import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw,
  Volume2, VolumeX, CheckCircle, Clock, Sparkles
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { getOfflineRecipe } from '../services/db';

export const CookingModePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const variantIdParam = searchParams.get('variant');
  const servingsParam = searchParams.get('servings') || '4';

  const [recipe, setRecipe] = useState<any>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [voiceActive, setVoiceActive] = useState(false);

  // Load recipe
  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiRequest(`/recipes/${id}`);
        setRecipe(data);
      } catch {
        const off = await getOfflineRecipe(Number(id));
        setRecipe(off);
      }
    };
    load();
  }, [id]);

  // Request WakeLock to prevent screen from turning off while cooking
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          setWakeLock(lock);
        } catch (err) {
          console.warn('WakeLock error:', err);
        }
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const variant = recipe?.variants?.find((v: any) => String(v.id) === variantIdParam) || recipe?.variants?.[0];
  const steps = variant?.steps || [];
  const currentStep = steps[currentStepIndex];

  // Initialize timer for current step if present
  useEffect(() => {
    if (currentStep?.timer_seconds) {
      setTimerSeconds(currentStep.timer_seconds);
      setIsTimerRunning(false);
    } else {
      setTimerSeconds(null);
      setIsTimerRunning(false);
    }

    // Voice narration if enabled
    if (voiceActive && currentStep && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentStep.instruction);
      utterance.lang = 'es-ES';
      window.speechSynthesis.speak(utterance);
    }
  }, [currentStepIndex, currentStep, voiceActive]);

  // Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev && prev > 1) return prev - 1;
          setIsTimerRunning(false);
          // Play beep sound using Web Audio API
          playBeep();
          return 0;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch {
      // AudioContext not allowed or unsupported
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!recipe || steps.length === 0) {
    return <div className="py-24 text-center text-zinc-500">Cargando modo cocina...</div>;
  }

  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-white flex flex-col justify-between p-4 md:p-8 select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white line-clamp-1">{recipe.title}</h2>
            <p className="text-[11px] text-zinc-400 font-medium capitalize">
              {variant?.title || variant?.variant_type} · {servingsParam} raciones
            </p>
          </div>
        </div>

        {/* Voice Speech Toggle */}
        <button
          onClick={() => setVoiceActive(!voiceActive)}
          className={`p-2.5 rounded-xl border transition-colors ${
            voiceActive
              ? 'bg-amber-500 text-zinc-950 border-amber-500 font-bold'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
          title="Lectura por voz de instrucciones"
        >
          {voiceActive ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="py-2">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-bold mb-1.5">
          <span>{t('step')} {currentStepIndex + 1} {t('of')} {steps.length}</span>
          <span className="text-amber-400">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Step Instruction Card */}
      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full my-auto py-6 space-y-6 text-center">
        {/* Step Badge */}
        <div className="inline-flex items-center justify-center mx-auto w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 text-amber-400 font-black text-2xl shadow-lg">
          {currentStep.step_number}
        </div>

        {/* Big Instruction Text */}
        <p className="text-xl md:text-3xl font-extrabold text-zinc-100 leading-snug tracking-tight px-2">
          {currentStep.instruction}
        </p>

        {/* Step Appliance Settings */}
        {(currentStep.temperature || currentStep.speed || currentStep.accessory) && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {currentStep.temperature && (
              <span className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 font-mono text-sm font-bold">
                🌡️ {currentStep.temperature}
              </span>
            )}
            {currentStep.speed && (
              <span className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-sm font-bold">
                ⚙️ {currentStep.speed}
              </span>
            )}
            {currentStep.accessory && (
              <span className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium">
                🥄 {currentStep.accessory}
              </span>
            )}
          </div>
        )}

        {/* Integrated Step Timer */}
        {timerSeconds !== null && (
          <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 max-w-sm mx-auto w-full space-y-3">
            <div className="text-4xl md:text-5xl font-mono font-black text-amber-400 tracking-wider">
              {formatTimer(timerSeconds)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5"
              >
                {isTimerRunning ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950" />}
                <span>{isTimerRunning ? t('pause') : t('start')}</span>
              </button>
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(currentStep.timer_seconds || 0);
                }}
                className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
                title={t('reset')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep.tip && (
          <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80 text-xs text-amber-300 max-w-lg mx-auto">
            💡 {currentStep.tip}
          </div>
        )}
      </div>

      {/* Bottom Large Tactile Navigation Buttons */}
      <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto w-full pt-4 border-t border-zinc-800">
        <button
          onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
          disabled={currentStepIndex === 0}
          className={`flex-1 py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all ${
            currentStepIndex === 0
              ? 'bg-zinc-900/50 text-zinc-600 border border-zinc-800/50 cursor-not-allowed'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 active:scale-[0.98]'
          }`}
        >
          <ChevronLeft className="w-6 h-6" />
          <span>{t('previous')}</span>
        </button>

        {currentStepIndex < steps.length - 1 ? (
          <button
            onClick={() => setCurrentStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
            className="flex-1 py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
          >
            <span>{t('next')}</span>
            <ChevronRight className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={() => navigate(`/recipes/${recipe.id}`)}
            className="flex-1 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
          >
            <CheckCircle className="w-6 h-6" />
            <span>{t('finish')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
