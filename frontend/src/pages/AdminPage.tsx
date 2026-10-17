import React, { useState, useEffect } from 'react';
import {
  Shield, HardDrive, Database, Users, Sparkles,
  RefreshCw, CheckCircle, AlertTriangle, Plus, FileText,
  Activity, Tag, Utensils, Trash2, Info, ExternalLink,
  Key, Check, Mail, Send, Server, Clock, Sliders,
  Eye, EyeOff, CheckCheck, Smartphone
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

type AdminTab = 'connectors' | 'notifications' | 'storage_backups' | 'users' | 'recipe_config';

export const AdminPage: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('connectors');

  const [stats, setStats] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [recipeConfig, setRecipeConfig] = useState<any>({ meal_types: [], tags: [] });

  // Connectors State
  const [connectors, setConnectors] = useState<any>({
    gemini: { api_key: '', model: 'gemini-2.5-flash', is_configured: false, status: '' },
    drive: { client_id: '', client_secret: '', redirect_uri: 'http://192.168.1.80:8500/api/drive/callback', is_configured: false, status: '' },
    synology: { host: '192.168.1.8', port: 5000, user: '', password: '', backup_path: '/volume1/Backups/Recetario', is_configured: false, status: '' },
    telegram: { is_active: false, bot_token: '', chat_id: '', is_configured: false, status: '' },
    smtp: { is_active: false, host: '', port: 587, user: '', password: '', from_email: '', use_tls: true, is_configured: false, status: '' },
    notification_rules: { daily_menu_time: '08:30', notify_pantry_expiry: true, pantry_days_before: 3, notify_storage_alert: true, storage_threshold_gb: 4.0 }
  });

  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [savingConnector, setSavingConnector] = useState<string | null>(null);
  const [testingConnector, setTestingConnector] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [statusMessage, setStatusMessage] = useState<{ provider: string; text: string; isError?: boolean } | null>(null);

  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [newTagLabel, setNewTagLabel] = useState('');

  // User modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('family');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [s, b, u, a, c, conn] = await Promise.all([
        apiRequest('/admin/stats').catch(() => null),
        apiRequest('/admin/backups').catch(() => []),
        apiRequest('/admin/users').catch(() => []),
        apiRequest('/admin/audit-logs').catch(() => []),
        apiRequest('/admin/recipe-config').catch(() => ({ meal_types: [], tags: [] })),
        apiRequest('/admin/connectors').catch(() => null)
      ]);
      setStats(s);
      setBackups(b || []);
      setUsersList(u || []);
      setAuditLogs(a || []);
      setRecipeConfig(c || { meal_types: [], tags: [] });
      if (conn) {
        setConnectors(conn);
      }
    } catch (err) {
      console.warn('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const toggleShowPassword = (fieldKey: string) => {
    setShowPassword(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSaveConnector = async (provider: string) => {
    setSavingConnector(provider);
    setStatusMessage(null);
    try {
      const payload = provider === 'notification_rules'
        ? connectors.notification_rules
        : connectors[provider];

      await apiRequest(`/admin/connectors/${provider}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setStatusMessage({ provider, text: `¡Configuración de ${provider} guardada con éxito!` });
      setTimeout(() => setStatusMessage(null), 4000);
      await fetchAdminData();
    } catch (err: any) {
      setStatusMessage({ provider, text: `Error al guardar: ${err.message || err}`, isError: true });
    } finally {
      setSavingConnector(null);
    }
  };

  const handleTestConnector = async (provider: string) => {
    setTestingConnector(provider);
    try {
      const payload = connectors[provider] || {};
      const res = await apiRequest(`/admin/connectors/${provider}/test`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          success: res.success,
          message: res.message || res.error || (res.success ? 'Conexión verificada con éxito' : 'Error en la conexión')
        }
      }));
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          success: false,
          message: err.message || 'Error al ejecutar prueba de conexión'
        }
      }));
    } finally {
      setTestingConnector(null);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      await apiRequest('/admin/backups/create', { method: 'POST' });
      alert('¡Copia de seguridad completada con éxito!');
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error al crear copia: ${err.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleStorageCleanup = async () => {
    if (!confirm('¿Deseas vaciar todos los archivos temporales de /app/data/tmp?')) return;
    try {
      const res = await apiRequest('/admin/storage/cleanup', { method: 'POST' });
      alert(res.message);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error: ${err.message || err}`);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPass.trim() || !newUserName.trim()) {
      alert('Por favor rellena todos los campos');
      return;
    }
    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUserEmail,
          username: newUserName,
          password: newUserPass,
          role: newUserRole
        })
      });
      alert('Usuario creado con éxito');
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPass('');
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error al crear usuario: ${err.message || err}`);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagLabel.trim();
    if (!trimmed) return;
    const tagId = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const currentTags = recipeConfig.tags || [];
    if (currentTags.some((t: any) => t.id === tagId)) {
      alert('Esta etiqueta ya existe');
      return;
    }
    const updated = {
      ...recipeConfig,
      tags: [...currentTags, { id: tagId, label: trimmed, color: 'blue' }]
    };
    setRecipeConfig(updated);
    setNewTagLabel('');
  };

  const handleRemoveTag = (tagId: string) => {
    const updated = {
      ...recipeConfig,
      tags: (recipeConfig.tags || []).filter((t: any) => t.id !== tagId)
    };
    setRecipeConfig(updated);
  };

  const handleSaveRecipeConfig = async () => {
    setIsSavingConfig(true);
    try {
      await apiRequest('/admin/recipe-config', {
        method: 'PUT',
        body: JSON.stringify(recipeConfig)
      });
      alert('¡Configuración de recetas y etiquetas guardada con éxito!');
    } catch (err: any) {
      alert(`Error al guardar configuración: ${err.message || err}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6 animate-in fade-in pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Panel de Control & Conectores</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Administración Global</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Configuración visual de variables externas, conectores (Gemini, Telegram, SMTP, Synology, Drive) y servidor.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          title="Actualizar datos"
          className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-zinc-800/80">
        <button
          onClick={() => setActiveTab('connectors')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'connectors'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Conectores e Integraciones
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Reglas de Notificación
        </button>
        <button
          onClick={() => setActiveTab('storage_backups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'storage_backups'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/60'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Servidor & Backups
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Usuarios & 2FA
        </button>
        <button
          onClick={() => setActiveTab('recipe_config')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'recipe_config'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/60'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Momentos & Etiquetas
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CONECTORES E INTEGRACIONES EXTERNAS                   */}
      {/* ============================================================ */}
      {activeTab === 'connectors' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Puedes configurar y probar aquí todos los conectores externos sin necesidad de editar manualmente el archivo <code className="text-amber-400 font-mono">.env</code> ni reiniciar los contenedores Docker. Las credenciales se guardan de forma persistente y se aplican en caliente.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Google Gemini AI Connector */}
            <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-zinc-950">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Google Gemini AI</h3>
                      <p className="text-[11px] text-zinc-400">Extracción inteligente, adaptación a robots y OCR</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectors.gemini?.is_configured
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {connectors.gemini?.is_configured ? 'Conectado a la API' : 'Modo Heurístico Local'}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                      API Key de Google Gemini
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword['gemini'] ? 'text' : 'password'}
                        value={connectors.gemini?.api_key || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          gemini: { ...connectors.gemini, api_key: e.target.value }
                        })}
                        placeholder="AIzaSy..."
                        className="w-full px-3.5 py-2 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword('gemini')}
                        className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPassword['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Obtén tu clave gratuita en <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-2.5 h-2.5" /></a>
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                      Modelo de Gemini
                    </label>
                    <select
                      value={connectors.gemini?.model || 'gemini-2.5-flash'}
                      onChange={e => setConnectors({
                        ...connectors,
                        gemini: { ...connectors.gemini, model: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Recomendado - Ultrarrápido y preciso)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Económico y estable)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Máxima capacidad de razonamiento)</option>
                    </select>
                  </div>

                  {testResults['gemini'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['gemini'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      {testResults['gemini'].message}
                    </div>
                  )}

                  {statusMessage?.provider === 'gemini' && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      statusMessage.isError
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {statusMessage.text}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleTestConnector('gemini')}
                  disabled={testingConnector === 'gemini'}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                >
                  {testingConnector === 'gemini' ? 'Probando...' : 'Probar Conexión'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('gemini')}
                  disabled={savingConnector === 'gemini'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {savingConnector === 'gemini' ? 'Guardando...' : 'Guardar Gemini'}
                </button>
              </div>
            </div>

            {/* 2. Telegram Bot Connector */}
            <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Bot de Telegram</h3>
                      <p className="text-[11px] text-zinc-400">Notificaciones instantáneas de cocina al chat familiar</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(connectors.telegram?.is_active)}
                      onChange={e => setConnectors({
                        ...connectors,
                        telegram: { ...connectors.telegram, is_active: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                <div className="space-y-3 pt-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                      Token del Bot (Bot Token de @BotFather)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword['telegram'] ? 'text' : 'password'}
                        value={connectors.telegram?.bot_token || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          telegram: { ...connectors.telegram, bot_token: e.target.value }
                        })}
                        placeholder="712345678:AAH..."
                        className="w-full px-3.5 py-2 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword('telegram')}
                        className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPassword['telegram'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">
                      Chat ID Familiar o Personal
                    </label>
                    <input
                      type="text"
                      value={connectors.telegram?.chat_id || ''}
                      onChange={e => setConnectors({
                        ...connectors,
                        telegram: { ...connectors.telegram, chat_id: e.target.value }
                      })}
                      placeholder="ej: -1001234567890 o 987654321"
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Puedes obtener tu Chat ID enviando un mensaje a <code className="text-zinc-400">@userinfobot</code> en Telegram.
                    </span>
                  </div>

                  {testResults['telegram'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['telegram'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      {testResults['telegram'].message}
                    </div>
                  )}

                  {statusMessage?.provider === 'telegram' && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      statusMessage.isError
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {statusMessage.text}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleTestConnector('telegram')}
                  disabled={testingConnector === 'telegram'}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                >
                  {testingConnector === 'telegram' ? 'Enviando...' : 'Enviar Prueba'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('telegram')}
                  disabled={savingConnector === 'telegram'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {savingConnector === 'telegram' ? 'Guardando...' : 'Guardar Telegram'}
                </button>
              </div>
            </div>

            {/* 3. SMTP Mail Server Connector */}
            <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Servidor de Correo SMTP</h3>
                      <p className="text-[11px] text-zinc-400">Envío de emails con menú diario y avisos de despensa</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(connectors.smtp?.is_active)}
                      onChange={e => setConnectors({
                        ...connectors,
                        smtp: { ...connectors.smtp, is_active: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Host SMTP</label>
                      <input
                        type="text"
                        value={connectors.smtp?.host || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          smtp: { ...connectors.smtp, host: e.target.value }
                        })}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Puerto</label>
                      <input
                        type="number"
                        value={connectors.smtp?.port || 587}
                        onChange={e => setConnectors({
                          ...connectors,
                          smtp: { ...connectors.smtp, port: parseInt(e.target.value) || 587 }
                        })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Usuario / Email</label>
                      <input
                        type="text"
                        value={connectors.smtp?.user || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          smtp: { ...connectors.smtp, user: e.target.value }
                        })}
                        placeholder="tu_cuenta@gmail.com"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Contraseña de Aplicación</label>
                      <div className="relative">
                        <input
                          type={showPassword['smtp'] ? 'text' : 'password'}
                          value={connectors.smtp?.password || ''}
                          onChange={e => setConnectors({
                            ...connectors,
                            smtp: { ...connectors.smtp, password: e.target.value }
                          })}
                          placeholder="••••••••••••"
                          className="w-full px-3 py-2 pr-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowPassword('smtp')}
                          className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                        >
                          {showPassword['smtp'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Remitente (From)</label>
                      <input
                        type="text"
                        value={connectors.smtp?.from_email || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          smtp: { ...connectors.smtp, from_email: e.target.value }
                        })}
                        placeholder="recetas@familiar.local"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div className="pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={connectors.smtp?.use_tls !== false}
                          onChange={e => setConnectors({
                            ...connectors,
                            smtp: { ...connectors.smtp, use_tls: e.target.checked }
                          })}
                          className="w-4 h-4 rounded text-sky-500 bg-zinc-950 border-zinc-800 focus:ring-sky-500"
                        />
                        <span>Usar STARTTLS</span>
                      </label>
                    </div>
                  </div>

                  {testResults['smtp'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['smtp'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      {testResults['smtp'].message}
                    </div>
                  )}

                  {statusMessage?.provider === 'smtp' && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      statusMessage.isError
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {statusMessage.text}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleTestConnector('smtp')}
                  disabled={testingConnector === 'smtp'}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                >
                  {testingConnector === 'smtp' ? 'Probando...' : 'Probar Envío'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('smtp')}
                  disabled={savingConnector === 'smtp'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {savingConnector === 'smtp' ? 'Guardando...' : 'Guardar SMTP'}
                </button>
              </div>
            </div>

            {/* 4. Synology NAS Connector */}
            <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Synology NAS</h3>
                      <p className="text-[11px] text-zinc-400">Segunda copia de seguridad persistente en tu red local</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectors.synology?.is_configured
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {connectors.synology?.is_configured ? 'Configurado' : 'Pendiente'}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-zinc-300 block mb-1">IP o Host Synology</label>
                      <input
                        type="text"
                        value={connectors.synology?.host || '192.168.1.8'}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, host: e.target.value }
                        })}
                        placeholder="192.168.1.8"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Puerto DSM</label>
                      <input
                        type="number"
                        value={connectors.synology?.port || 5000}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, port: parseInt(e.target.value) || 5000 }
                        })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Usuario DSM</label>
                      <input
                        type="text"
                        value={connectors.synology?.user || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, user: e.target.value }
                        })}
                        placeholder="admin_synology"
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1">Contraseña</label>
                      <div className="relative">
                        <input
                          type={showPassword['synology'] ? 'text' : 'password'}
                          value={connectors.synology?.password || ''}
                          onChange={e => setConnectors({
                            ...connectors,
                            synology: { ...connectors.synology, password: e.target.value }
                          })}
                          placeholder="••••••••••••"
                          className="w-full px-3 py-2 pr-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowPassword('synology')}
                          className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                        >
                          {showPassword['synology'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Ruta en Synology (Share Path)</label>
                    <input
                      type="text"
                      value={connectors.synology?.backup_path || '/volume1/Backups/Recetario'}
                      onChange={e => setConnectors({
                        ...connectors,
                        synology: { ...connectors.synology, backup_path: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  {testResults['synology'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['synology'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      {testResults['synology'].message}
                    </div>
                  )}

                  {statusMessage?.provider === 'synology' && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      statusMessage.isError
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {statusMessage.text}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleTestConnector('synology')}
                  disabled={testingConnector === 'synology'}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                >
                  {testingConnector === 'synology' ? 'Probando...' : 'Comprobar Red NAS'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('synology')}
                  disabled={savingConnector === 'synology'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-500 hover:bg-purple-400 text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {savingConnector === 'synology' ? 'Guardando...' : 'Guardar Synology'}
                </button>
              </div>
            </div>

            {/* 5. Google Drive Connector */}
            <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Google Drive</h3>
                      <p className="text-[11px] text-zinc-400">Importación de recetas, PDFs y copia en la nube</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectors.drive?.is_configured
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {connectors.drive?.is_configured ? 'Configurado' : 'Pendiente OAuth'}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Client ID</label>
                    <input
                      type="text"
                      value={connectors.drive?.client_id || ''}
                      onChange={e => setConnectors({
                        ...connectors,
                        drive: { ...connectors.drive, client_id: e.target.value }
                      })}
                      placeholder="xxxx.apps.googleusercontent.com"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Client Secret</label>
                    <div className="relative">
                      <input
                        type={showPassword['drive'] ? 'text' : 'password'}
                        value={connectors.drive?.client_secret || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          drive: { ...connectors.drive, client_secret: e.target.value }
                        })}
                        placeholder="GOCSPX-..."
                        className="w-full px-3 py-2 pr-9 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword('drive')}
                        className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPassword['drive'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1">Redirect URI</label>
                    <input
                      type="text"
                      value={connectors.drive?.redirect_uri || 'http://192.168.1.80:8500/api/drive/callback'}
                      onChange={e => setConnectors({
                        ...connectors,
                        drive: { ...connectors.drive, redirect_uri: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {testResults['drive'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['drive'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}>
                      {testResults['drive'].message}
                    </div>
                  )}

                  {statusMessage?.provider === 'drive' && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      statusMessage.isError
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    }`}>
                      {statusMessage.text}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleTestConnector('drive')}
                  disabled={testingConnector === 'drive'}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
                >
                  {testingConnector === 'drive' ? 'Validando...' : 'Validar Credenciales'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('drive')}
                  disabled={savingConnector === 'drive'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors disabled:opacity-50"
                >
                  {savingConnector === 'drive' ? 'Guardando...' : 'Guardar Drive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: REGLAS GLOBALES DE NOTIFICACIÓN Y HORARIOS            */}
      {/* ============================================================ */}
      {activeTab === 'notifications' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Automatización de Avisos y Horarios Familiares
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configura cuándo y cómo el sistema genera y despacha recordatorios de cocina, compras y despensa
              </p>
            </div>
            <button
              onClick={() => handleSaveConnector('notification_rules')}
              disabled={savingConnector === 'notification_rules'}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              {savingConnector === 'notification_rules' ? 'Guardando...' : 'Guardar Reglas'}
            </button>
          </div>

          {statusMessage?.provider === 'notification_rules' && (
            <div className={`p-3 rounded-xl text-xs border ${
              statusMessage.isError
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              {statusMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule 1: Daily Menu Reminder */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">Recordatorio del Menú del Día</h4>
              </div>
              <p className="text-[11px] text-zinc-400">
                Avisa a cada miembro de la familia de lo que toca desayunar, comer o cenar según el plan semanal.
              </p>
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">Hora de Envío Matutino</label>
                <input
                  type="time"
                  value={connectors.notification_rules?.daily_menu_time || '08:30'}
                  onChange={e => setConnectors({
                    ...connectors,
                    notification_rules: {
                      ...connectors.notification_rules,
                      daily_menu_time: e.target.value
                    }
                  })}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Rule 2: Pantry Expiration */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">Avisos de Caducidad de Despensa</h4>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(connectors.notification_rules?.notify_pantry_expiry)}
                  onChange={e => setConnectors({
                    ...connectors,
                    notification_rules: {
                      ...connectors.notification_rules,
                      notify_pantry_expiry: e.target.checked
                    }
                  })}
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-800 focus:ring-amber-500"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                Alerta automáticamente para cocinar recetas con ingredientes perecederos antes de que expiren.
              </p>
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">Días de Antelación</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={connectors.notification_rules?.pantry_days_before || 3}
                  onChange={e => setConnectors({
                    ...connectors,
                    notification_rules: {
                      ...connectors.notification_rules,
                      pantry_days_before: parseInt(e.target.value) || 3
                    }
                  })}
                  className="w-24 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Rule 3: Storage Alert */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-bold text-white">Alerta de Espacio en Servidor</h4>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(connectors.notification_rules?.notify_storage_alert)}
                  onChange={e => setConnectors({
                    ...connectors,
                    notification_rules: {
                      ...connectors.notification_rules,
                      notify_storage_alert: e.target.checked
                    }
                  })}
                  className="w-4 h-4 rounded text-rose-500 bg-zinc-900 border-zinc-800 focus:ring-rose-500"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                Avisa al administrador si el espacio libre en el disco Debian desciende del umbral de seguridad.
              </p>
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">Umbral Mínimo Libre (GB)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={connectors.notification_rules?.storage_threshold_gb || 4.0}
                  onChange={e => setConnectors({
                    ...connectors,
                    notification_rules: {
                      ...connectors.notification_rules,
                      storage_threshold_gb: parseFloat(e.target.value) || 4.0
                    }
                  })}
                  className="w-28 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            {/* Rule 4: Bell In-App Always Active Note */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">Campanita de la Aplicación</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Todas las notificaciones se registran siempre en la campanita superior para cada usuario. Cada miembro de la familia puede elegir en su perfil si desea recibir además copias por Email o Telegram.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: SERVIDOR Y COPIAS DE SEGURIDAD                        */}
      {/* ============================================================ */}
      {activeTab === 'storage_backups' && (
        <div className="space-y-6">
          {/* Storage Guard Banner */}
          <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Almacenamiento Servidor Host (Cero saturación)</h3>
                  <p className="text-xs text-zinc-400">Las imágenes y temporales no saturan el disco del Docker</p>
                </div>
              </div>
              <button
                onClick={handleStorageCleanup}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors self-start sm:self-auto"
              >
                Limpiar temporales ahora
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Espacio Libre</span>
                <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                  {stats?.storage?.free_gb} GB
                </p>
              </div>
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Espacio Total</span>
                <p className="text-lg font-black text-white font-mono mt-0.5">
                  {stats?.storage?.total_gb} GB
                </p>
              </div>
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Uso de Disco</span>
                <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
                  {stats?.storage?.percent_used}%
                </p>
              </div>
              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Datos Recetario</span>
                <p className="text-lg font-black text-zinc-200 font-mono mt-0.5">
                  {stats?.storage?.app_storage_mb} MB
                </p>
              </div>
            </div>
          </div>

          {/* Backups Section */}
          <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Copias de Seguridad Persistentes</h3>
                  <p className="text-xs text-zinc-400">Copia con verificación criptográfica SHA-256 e integración con Drive & Synology</p>
                </div>
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all self-start sm:self-auto"
              >
                {isBackingUp ? 'Creando copia...' : 'Crear Copia Ahora'}
              </button>
            </div>

            <div className="space-y-2">
              {backups.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No se han registrado copias de seguridad.</p>
              ) : (
                backups.map((b, i) => (
                  <div key={i} className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{b.filename}</span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{b.size_mb} MB · {new Date(b.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">
                      {b.is_valid ? 'Íntegro (SHA-256)' : 'Error'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Registro de Auditoría (Acceso a Datos Privados)</h3>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No hay registros de auditoría recientes.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800/60 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-400">{log.action}</span>
                      <p className="text-zinc-400 mt-0.5">{log.details}</p>
                    </div>
                    <span className="text-zinc-500 font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: USUARIOS Y PERMISOS                                   */}
      {/* ============================================================ */}
      {activeTab === 'users' && (
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Usuarios del Recetario</h3>
                <p className="text-xs text-zinc-400">Gestión de cuentas familiares y administradores con 2FA obligatorio</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Usuario</span>
            </button>
          </div>

          <div className="divide-y divide-zinc-800/80 bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden">
            {usersList.map(u => (
              <div key={u.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white">{u.full_name || u.username}</span>
                  <span className="text-zinc-500 ml-2 font-mono">({u.email})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                    u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {u.role}
                  </span>
                  <span className="text-[10px] text-zinc-500">{u.mfa_enabled ? '2FA Activo' : 'Sin 2FA'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: MOMENTOS DEL DÍA Y ETIQUETAS                         */}
      {/* ============================================================ */}
      {activeTab === 'recipe_config' && (
        <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Tag className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Configuración de Momentos del Día y Etiquetas</h3>
                <p className="text-xs text-zinc-400">Define los tipos de comida y las etiquetas disponibles en todo el recetario</p>
              </div>
            </div>
            <button
              onClick={handleSaveRecipeConfig}
              disabled={isSavingConfig}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all self-start sm:self-auto"
            >
              {isSavingConfig ? 'Guardando...' : 'Guardar Ajustes'}
            </button>
          </div>

          {/* 1. Meal Types */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              Momentos del Día / Tipos de Comida Activos
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(recipeConfig.meal_types || []).map((m: any) => (
                <div key={m.id} className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">{m.label}</span>
                    <p className="text-[10px] text-zinc-500 font-mono">{m.id}</p>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* 2. Tags Manager */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Etiquetas del Recetario (Saludable, Más Usada, Top Receta, etc.)
            </h4>

            <div className="flex flex-wrap gap-2">
              {(recipeConfig.tags || []).map((tg: any) => (
                <span
                  key={tg.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-200"
                >
                  <span>{tg.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tg.id)}
                    className="text-zinc-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm pt-1">
              <input
                type="text"
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Nueva etiqueta (ej. Alta en Proteína)..."
                className="flex-1 px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-colors"
              >
                + Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Nuevo Usuario</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Nombre de usuario</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Contraseña temporal</label>
                <input
                  type="password"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Rol</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                >
                  <option value="family">Familiar</option>
                  <option value="admin">Administrador (2FA obligatorio)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
