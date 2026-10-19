import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  User, Lock, Bell, Palette, Key, Shield, ShieldCheck,
  Save, Check, AlertCircle, RefreshCw, Send, CheckCircle2,
  Smartphone, Mail, MessageSquare, Sun, Moon, Eye, EyeOff,
  HelpCircle, SlidersHorizontal, Calendar, Heart, ChefHat,
  Flame, Zap, LayoutDashboard, ArrowRight
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ConnectorInfoModal } from '../components/ConnectorInfoModal';

type ProfileTab = 'account' | 'security' | 'notifications' | 'preferences';

export interface WidgetsConfig {
  showTodayPlan: boolean;
  showDietAssistant: boolean;
  showRecentRecipes: boolean;
  showFavorites: boolean;
  showAppliances: boolean;
  showFunctionalAreas: boolean;
}

export const DEFAULT_WIDGETS: WidgetsConfig = {
  showTodayPlan: true,
  showDietAssistant: true,
  showRecentRecipes: true,
  showFavorites: true,
  showAppliances: true,
  showFunctionalAreas: true
};

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const getTabFromParam = (tab: string | null): ProfileTab => {
    if (tab === 'security' || tab === 'password') return 'security';
    if (tab === 'notifications') return 'notifications';
    if (tab === 'preferences' || tab === 'homepage' || tab === 'inicio') return 'preferences';
    return 'account';
  };

  const [activeTab, setActiveTab] = useState<ProfileTab>(() => getTabFromParam(searchParams.get('tab')));

  // Profile data
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password data
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ success: boolean; message: string } | null>(null);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfa_enabled || false);
  const [mfaSetupData, setMfaSetupData] = useState<{ qr_code_base64: string; secret: string; recovery_codes: string[] } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [mfaStatusMsg, setMfaStatusMsg] = useState<{ isError: boolean; text: string } | null>(null);

  // Preferences & Notifications
  const [servings, setServings] = useState(4);
  const [notificationChannels, setNotificationChannels] = useState<{
    in_app: boolean;
    email: boolean;
    push: boolean;
    telegram: boolean;
    telegram_chat_id: string;
  }>({
    in_app: true,
    email: true,
    push: false,
    telegram: false,
    telegram_chat_id: ''
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);

  // Homepage Customization Widgets state
  const [widgets, setWidgets] = useState<WidgetsConfig>(() => {
    try {
      const saved = localStorage.getItem('homepage_widgets');
      return saved ? { ...DEFAULT_WIDGETS, ...JSON.parse(saved) } : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(getTabFromParam(tab));
  }, [searchParams]);

  useEffect(() => {
    apiRequest('/auth/me').then(u => {
      if (u) {
        setFullName(u.full_name || '');
        setEmail(u.email || '');
        setMfaEnabled(u.mfa_enabled);
      }
    }).catch(err => console.warn('Me fetch error:', err));

    apiRequest('/auth/preferences').then(prefs => {
      if (prefs) {
        if (prefs.default_servings) {
          setServings(prefs.default_servings);
          try {
            localStorage.setItem('user_default_servings', String(prefs.default_servings));
          } catch {}
        }
        if (prefs.notification_channels) {
          try {
            const parsed = typeof prefs.notification_channels === 'string'
              ? JSON.parse(prefs.notification_channels)
              : prefs.notification_channels;
            setNotificationChannels(prev => ({ ...prev, ...parsed }));
          } catch {}
        }
        if (prefs.widgets_config) {
          try {
            const parsed = typeof prefs.widgets_config === 'string'
              ? JSON.parse(prefs.widgets_config)
              : prefs.widgets_config;
            setWidgets(prev => ({ ...DEFAULT_WIDGETS, ...parsed }));
            localStorage.setItem('homepage_widgets', JSON.stringify(parsed));
          } catch {}
        }
      }
    }).catch(err => console.warn('Preferences fetch error:', err));
  }, []);

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaved(false);
    try {
      await apiRequest('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          email: email
        })
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      alert(`Error al guardar perfil: ${err.message || err}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ success: false, message: 'Las nuevas contraseñas no coinciden' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ success: false, message: 'La nueva contraseña debe tener mínimo 6 caracteres' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      setPasswordStatus({ success: true, message: '¡Contraseña cambiada con éxito!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(null), 4000);
    } catch (err: any) {
      setPasswordStatus({ success: false, message: err.message || 'Error al cambiar contraseña' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaStatusMsg(null);
    try {
      const data = await apiRequest('/auth/mfa/setup', { method: 'POST' });
      setMfaSetupData(data);
    } catch (err: any) {
      setMfaStatusMsg({ isError: true, text: err.message || 'Error al iniciar 2FA' });
    }
  };

  const handleConfirmMfa = async () => {
    if (!totpVerifyCode.trim()) return;
    setMfaStatusMsg(null);
    try {
      await apiRequest(`/auth/mfa/confirm?totp_code=${encodeURIComponent(totpVerifyCode.trim())}`, {
        method: 'POST'
      });
      setMfaEnabled(true);
      setMfaSetupData(null);
      setTotpVerifyCode('');
      setMfaStatusMsg({ isError: false, text: '¡Doble factor (TOTP) verificado y activado con éxito!' });
      setTimeout(() => setMfaStatusMsg(null), 4000);
    } catch (err: any) {
      setMfaStatusMsg({ isError: true, text: err.message || 'Código TOTP incorrecto' });
    }
  };

  const handleDisableMfa = async () => {
    const code = prompt('Introduce un código de tu app de autenticación para confirmar la desactivación del 2FA:');
    if (!code) return;
    try {
      await apiRequest(`/auth/mfa/disable?totp_code=${encodeURIComponent(code.trim())}`, {
        method: 'POST'
      });
      setMfaEnabled(false);
      setMfaStatusMsg({ isError: false, text: '2FA desactivado correctamente' });
      setTimeout(() => setMfaStatusMsg(null), 3000);
    } catch (err: any) {
      alert(`Error: ${err.message || err}`);
    }
  };

  const handleToggleWidget = (key: keyof WidgetsConfig) => {
    setWidgets(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('homepage_widgets', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSetAllWidgets = (value: boolean) => {
    const updated: WidgetsConfig = {
      showTodayPlan: value,
      showDietAssistant: value,
      showRecentRecipes: value,
      showFavorites: value,
      showAppliances: value,
      showFunctionalAreas: value
    };
    setWidgets(updated);
    localStorage.setItem('homepage_widgets', JSON.stringify(updated));
  };

  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    setPrefsSaved(false);
    try {
      localStorage.setItem('homepage_widgets', JSON.stringify(widgets));
      localStorage.setItem('user_default_servings', String(servings));
      await apiRequest('/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          theme,
          language: 'es',
          default_servings: servings,
          widgets_config: JSON.stringify(widgets),
          notification_channels: JSON.stringify(notificationChannels)
        })
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (err: any) {
      alert(`Error al guardar preferencias: ${err.message || err}`);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6 animate-in fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/20">
            {user?.username ? user.username.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Ajustes de mi Cuenta
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Gestiona tu información personal, contraseña, doble factor y canales de aviso
            </p>
          </div>
        </div>
      </div>

      {/* Tabs with Underline Indicator */}
      <div className="flex items-center gap-6 overflow-x-auto pb-1 border-b border-slate-200 dark:border-zinc-800 scrollbar-none">
        <button
          onClick={() => handleTabChange('account')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'account'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Mi Cuenta</span>
        </button>

        <button
          onClick={() => handleTabChange('security')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'security'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Seguridad y Contraseña</span>
        </button>

        <button
          onClick={() => handleTabChange('notifications')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'notifications'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Mis Notificaciones</span>
        </button>

        <button
          onClick={() => handleTabChange('preferences')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'preferences'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Preferencias e Inicio</span>
        </button>
      </div>

      {/* Tab 1: Account */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Datos de Usuario</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Información básica visible para los miembros de tu hogar</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nombre de usuario</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-500 dark:text-zinc-400 font-mono cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">El identificador único de cuenta no puede modificarse.</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Rol asignado</label>
                <div className="mt-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-700 dark:text-zinc-300 font-semibold flex items-center justify-between">
                  <span className="capitalize">{user?.role === 'admin' ? 'Administrador del Sistema' : 'Familiar / Miembro'}</span>
                  {user?.role === 'admin' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      ADMIN
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nombre completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre y apellidos"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
              {profileSaved ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Datos de perfil guardados!
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingProfile ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Password Change Card */}
          <form onSubmit={handleChangePassword} className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Cambiar mi Contraseña</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Actualiza periódicamente tu contraseña para proteger tu recetario</p>
            </div>

            <div className="space-y-3.5 max-w-md">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Contraseña actual</label>
                <div className="relative mt-1">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nueva contraseña</label>
                <div className="relative mt-1">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                  className="w-full mt-1 pl-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {passwordStatus && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                passwordStatus.success
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}>
                {passwordStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{passwordStatus.message}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>{isChangingPassword ? 'Actualizando...' : 'Cambiar Contraseña'}</span>
              </button>
            </div>
          </form>

          {/* 2FA / TOTP Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  <span>Doble Factor de Autenticación (2FA / TOTP)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Compatible con Bitwarden, Vaultwarden, Google Authenticator y 1Password</p>
              </div>

              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                mfaEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}>
                {mfaEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
              </span>
            </div>

            {mfaStatusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                mfaStatusMsg.isError
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}>
                {mfaStatusMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{mfaStatusMsg.text}</span>
              </div>
            )}

            {!mfaEnabled && !mfaSetupData && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Protege tu cuenta solicitando un código temporal de 6 dígitos cada vez que inicies sesión.
                </p>
                <button
                  type="button"
                  onClick={handleStartMfaSetup}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                >
                  <Key className="w-4 h-4" />
                  <span>Configurar Doble Factor</span>
                </button>
              </div>
            )}

            {mfaSetupData && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-4">
                <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                  1. Escanea este código QR con tu app de autenticación (Vaultwarden/Bitwarden, Authenticator):
                </p>
                <div className="flex justify-center p-3 bg-white rounded-xl border border-slate-200 w-fit mx-auto">
                  <img
                    src={`data:image/png;base64,${mfaSetupData.qr_code_base64}`}
                    alt="QR 2FA"
                    className="w-48 h-48"
                  />
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">O introduce la clave manualmente:</span>
                  <code className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 select-all">{mfaSetupData.secret}</code>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    2. Introduce el código de 6 dígitos generado por tu app para confirmar:
                  </label>
                  <div className="flex gap-2 max-w-xs">
                    <input
                      type="text"
                      maxLength={6}
                      value={totpVerifyCode}
                      onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-center text-sm font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmMfa}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold whitespace-nowrap"
                    >
                      Activar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mfaEnabled && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Tu cuenta está asegurada con doble factor.
                </p>
                <button
                  type="button"
                  onClick={handleDisableMfa}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  Desactivar 2FA
                </button>
              </div>
            )}
          </div>

          {/* Card: Google Sign-in & Connectors */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Acceso con Google (OAuth 2.0)</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Inicio de sesión rápido para ti y los miembros del hogar</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {user?.google_id ? 'VINCULADO' : 'CORREO GOOGLE'}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {user?.google_id ? (
                  <span>Tu cuenta de usuario está vinculada directamente con tu perfil de Google (ID: <code className="font-mono text-[11px] bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">{user.google_id}</code>). Puedes entrar siempre con el botón <strong>Continuar con Google</strong>.</span>
                ) : (
                  <span>Si tu correo (<strong>{user?.email}</strong>) coincide con tu cuenta de Google, puedes iniciar sesión pulsando directamente en <strong>Continuar con Google</strong> en la pantalla de bienvenida.</span>
                )}
              </p>

              {user?.role === 'admin' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Configuración de Conectores (Admin)</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Gestiona Client ID, Secret, Telegram, Drive y Gemini en el panel de administración.
                    </span>
                  </div>
                  <Link
                    to="/admin?tab=connectors_ai"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-sm transition-colors whitespace-nowrap self-start sm:self-center"
                  >
                    <span>Abrir Conectores</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <span>Mis Canales de Notificación</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Elige por dónde deseas recibir avisos de tu recetario (la campanita superior siempre mostrará todas tus notificaciones)
              </p>
            </div>

            <div className="space-y-3.5">
              {/* Channel: In-App Bell */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Campanita en la Aplicación</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">Avisos y alertas directas al abrir la web o la app</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Siempre Activa
                </span>
              </div>

              {/* Channel: Email */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Correo Electrónico ({email || user?.email})</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">Recibir resúmenes semanales y recordatorios por email</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationChannels.email}
                    onChange={(e) => setNotificationChannels(prev => ({ ...prev, email: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>

              {/* Channel: Push Mobile */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">Notificaciones Push Móvil (PWA)</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">Alertas instantáneas en tu dispositivo móvil al instalar la app</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationChannels.push}
                    onChange={(e) => setNotificationChannels(prev => ({ ...prev, push: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>

              {/* Channel: Telegram */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">Telegram Personal (Opcional)</span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">Recibe avisos directos en tu chat personal con el Bot</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationChannels.telegram}
                      onChange={(e) => setNotificationChannels(prev => ({ ...prev, telegram: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                  </label>
                </div>

                {notificationChannels.telegram && (
                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                        Tu Chat ID de Telegram:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowTelegramGuide(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>¿Cómo obtener mi Chat ID?</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={notificationChannels.telegram_chat_id}
                      onChange={(e) => setNotificationChannels(prev => ({ ...prev, telegram_chat_id: e.target.value }))}
                      placeholder="ej. 123456789"
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
              {prefsSaved ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Preferencias de notificación guardadas!
                </span>
              ) : <div />}

              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPrefs ? 'Guardando...' : 'Guardar Canales'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          {/* Card 1: Theme & Servings */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Preferencias de Interfaz</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Personaliza la apariencia y el comportamiento por defecto de la aplicación</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Theme Selector */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Tema Visual</span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Selecciona el modo de visualización preferido</p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      theme === 'dark'
                        ? 'bg-zinc-900 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Oscuro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (theme !== 'light') toggleTheme(); }}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      theme === 'light'
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Claro</span>
                  </button>
                </div>
              </div>

              {/* Default Servings */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Raciones Predeterminadas</span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Número de comensales base al abrir recetas o planificar</p>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setServings(num)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all border ${
                        servings === num
                          ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
              {prefsSaved ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Preferencias guardadas!
                </span>
              ) : <div />}

              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPrefs ? 'Guardando...' : 'Guardar Preferencias'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Homepage Customization */}
          <div id="homepage" className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5 shadow-sm scroll-mt-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Personalización de la Pantalla de Inicio
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Ajustes de Usuario
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Elige qué secciones y widgets deseas ver al entrar a la aplicación en tu pantalla principal
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleSetAllWidgets(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Activar todas
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllWidgets(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Ocultar todas
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: 'showDietAssistant' as keyof WidgetsConfig,
                  title: 'Tips de mi Alimentación (Asistente Dietético IA)',
                  badge: 'Nutrición IA',
                  desc: 'Pautas nutricionales preventivas, objetivos calóricos personalizados y adaptación inteligente de platos para tu familia.',
                  icon: Heart,
                  colorBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                },
                {
                  key: 'showTodayPlan' as keyof WidgetsConfig,
                  title: '¿Qué tenemos planificado para hoy? (Menú del día)',
                  badge: 'Planificador',
                  desc: 'Visualización rápida de los platos asignados para hoy (desayuno, almuerzo, comida, merienda, cena) y botón de cocinado guiado.',
                  icon: Calendar,
                  colorBg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                },
                {
                  key: 'showRecentRecipes' as keyof WidgetsConfig,
                  title: 'Últimas recetas añadidas',
                  badge: 'Recetario',
                  desc: 'Carrusel con los platos más nuevos incorporados a la colección familiar.',
                  icon: ChefHat,
                  colorBg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                },
                {
                  key: 'showFavorites' as keyof WidgetsConfig,
                  title: 'Mis Recetas Favoritas y Más Utilizadas',
                  badge: 'Favoritas',
                  desc: 'Acceso directo a las recetas marcadas con corazón por los miembros del hogar.',
                  icon: Flame,
                  colorBg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                },
                {
                  key: 'showAppliances' as keyof WidgetsConfig,
                  title: 'Acceso rápido por electrodomésticos',
                  badge: 'Equipamiento',
                  desc: 'Filtros rápidos con 1 clic para recetas adaptadas a Thermomix (TM7/TM6) y Freidora de aire (Airfryer).',
                  icon: Zap,
                  colorBg: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                },
                {
                  key: 'showFunctionalAreas' as keyof WidgetsConfig,
                  title: 'Accesos directos a las 6 áreas funcionales',
                  badge: 'Navegación',
                  desc: 'Mosaico de accesos rápidos a Recetario, Planificador semanal, Compra y despensa, Nutrición, Importador y Administración.',
                  icon: SlidersHorizontal,
                  colorBg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                }
              ].map(item => {
                const isEnabled = Boolean(widgets[item.key]);
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.key}
                    className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all ${
                      isEnabled
                        ? 'bg-slate-50/80 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800/80 shadow-xs'
                        : 'bg-slate-100/40 dark:bg-zinc-950/40 border-slate-200/50 dark:border-zinc-800/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-9 h-9 rounded-xl ${item.colorBg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggleWidget(item.key)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span>Ver pantalla de inicio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {prefsSaved && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    ¡Guardado en tu perfil!
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPrefs ? 'Guardando...' : 'Guardar Preferencias de Inicio'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Guide Modal */}
      <ConnectorInfoModal
        isOpen={showTelegramGuide}
        onClose={() => setShowTelegramGuide(false)}
        initialConnector="telegram"
      />
    </div>
  );
};
