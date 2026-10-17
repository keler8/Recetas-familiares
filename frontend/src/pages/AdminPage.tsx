import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings, SlidersHorizontal, Users, Palette, Mail, HardDrive,
  Sparkles, RefreshCw, HardDriveDownload, Database, Activity,
  Plus, Trash2, Edit2, Check, ExternalLink, Eye, EyeOff,
  Send, Server, Clock, Utensils, Tag, Heart, Shield,
  CheckCheck, AlertTriangle, Save, UserCheck, X
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useHousehold } from '../context/HouseholdContext';

type SettingsTab = 'general' | 'users_access' | 'home_recipes' | 'mail_notifications' | 'connectors_ai';

export const AdminPage: React.FC = () => {
  const { activeHousehold } = useHousehold();
  const [searchParams] = useSearchParams();
  
  const getTabFromParam = (tabParam: string | null): SettingsTab => {
    if (tabParam === 'users' || tabParam === 'users_access') return 'users_access';
    if (tabParam === 'recipes' || tabParam === 'home_recipes') return 'home_recipes';
    if (tabParam === 'mail' || tabParam === 'mail_notifications') return 'mail_notifications';
    if (tabParam === 'connectors' || tabParam === 'connectors_ai') return 'connectors_ai';
    return 'general';
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => getTabFromParam(searchParams.get('tab')));

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(getTabFromParam(tabParam));
    }
  }, [searchParams]);

  const [stats, setStats] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [recipeConfig, setRecipeConfig] = useState<any>({ meal_types: [], tags: [] });
  const [diners, setDiners] = useState<any[]>([]);

  // Connectors State
  const [connectors, setConnectors] = useState<any>({
    gemini: { api_key: '', model: 'gemini-3.8-flash', is_configured: false, status: '' },
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

  // Modals: Add User & Add Diner
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('family');

  const [showAddDinerModal, setShowAddDinerModal] = useState(false);
  const [dinerName, setDinerName] = useState('');
  const [dinerNotes, setDinerNotes] = useState('');
  const [dinerDietType, setDinerDietType] = useState('Todo / Normal');
  const [dinerAllergies, setDinerAllergies] = useState('');
  const [editingDinerId, setEditingDinerId] = useState<number | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [s, b, u, a, c, conn, din] = await Promise.all([
        apiRequest('/admin/stats').catch(() => null),
        apiRequest('/admin/backups').catch(() => []),
        apiRequest('/admin/users').catch(() => []),
        apiRequest('/admin/audit-logs').catch(() => []),
        apiRequest('/admin/recipe-config').catch(() => ({ meal_types: [], tags: [] })),
        apiRequest('/admin/connectors').catch(() => null),
        apiRequest('/households/diners').catch(() => [])
      ]);
      setStats(s);
      setBackups(b || []);
      setUsersList(u || []);
      setAuditLogs(a || []);
      setRecipeConfig(c || { meal_types: [], tags: [] });
      if (conn) setConnectors(conn);
      setDiners(din || []);
    } catch (err) {
      console.warn('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [activeHousehold?.id]);

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

      setStatusMessage({ provider, text: `¡Configuración guardada y aplicada con éxito!` });
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

  // Diner management (Personas del hogar)
  const handleSaveDiner = async () => {
    if (!dinerName.trim()) {
      alert('Por favor introduce el nombre de la persona');
      return;
    }
    const payload = {
      name: dinerName.trim(),
      is_active: true,
      notes: `${dinerDietType ? `Dieta: ${dinerDietType}. ` : ''}${dinerNotes}`.trim(),
      preferences: [],
      restrictions: dinerAllergies ? [{ restriction_type: 'allergy', details: dinerAllergies.trim() }] : []
    };

    try {
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
      setShowAddDinerModal(false);
      setDinerName('');
      setDinerNotes('');
      setDinerAllergies('');
      setEditingDinerId(null);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error al guardar persona: ${err.message || err}`);
    }
  };

  const handleDeleteDiner = async (id: number) => {
    if (!confirm('¿Eliminar a esta persona del hogar?')) return;
    try {
      await apiRequest(`/households/diners/${id}`, { method: 'DELETE' });
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || err}`);
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
      alert('¡Ajustes de momentos y etiquetas guardados con éxito!');
    } catch (err: any) {
      alert(`Error al guardar: ${err.message || err}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6 animate-in fade-in pb-24">
      
      {/* Header exactly like reference photo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-sm border border-sky-100 dark:border-sky-500/20">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Ajustes del Sistema
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                Configuración global de la plataforma, accesos de usuarios, correo, backups y personalización
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchAdminData}
          title="Actualizar datos"
          className="p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white self-start sm:self-auto transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs with Underline Indicator like reference photo */}
      <div className="flex items-center gap-6 overflow-x-auto pb-1 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'general'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>General</span>
        </button>

        <button
          onClick={() => setActiveTab('users_access')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'users_access'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios y Accesos</span>
        </button>

        <button
          onClick={() => setActiveTab('home_recipes')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'home_recipes'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Página de Inicio & Recetas</span>
        </button>

        <button
          onClick={() => setActiveTab('mail_notifications')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'mail_notifications'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Correo & Avisos</span>
        </button>

        <button
          onClick={() => setActiveTab('connectors_ai')}
          className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap border-b-2 -mb-px ${
            activeTab === 'connectors_ai'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Conectores e IA</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: GENERAL & SERVIDOR (Like reference card design)       */}
      {/* ============================================================ */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Main Card with top right button */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Ajustes Generales del Servidor</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Control de almacenamiento en disco Debian, limpieza y parámetros</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStorageCleanup}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar Temporales Ahora</span>
              </button>
            </div>

            {/* Disk Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Espacio Libre</span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {stats?.storage?.free_gb} GB
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Espacio Total</span>
                <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {stats?.storage?.total_gb} GB
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Uso de Disco</span>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {stats?.storage?.percent_used}%
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800/80">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">Datos Recetario</span>
                <p className="text-xl font-black text-slate-700 dark:text-zinc-200 font-mono mt-1">
                  {stats?.storage?.app_storage_mb} MB
                </p>
              </div>
            </div>
          </div>

          {/* Persistent Backups Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Copias de Seguridad Persistentes</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Respaldo con suma de verificación SHA-256 e integración local/remota</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all self-start sm:self-auto disabled:opacity-50"
              >
                {isBackingUp ? 'Creando copia...' : 'Crear Copia Ahora'}
              </button>
            </div>

            <div className="space-y-2">
              {backups.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-2">No se han registrado copias de seguridad.</p>
              ) : (
                backups.map((b, i) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white">{b.filename}</span>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">{b.size_mb} MB · {new Date(b.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                      {b.is_valid ? 'Íntegro (SHA-256)' : 'Error'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Audit Logs Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registro de Auditoría (Acceso a Datos Privados)</h3>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-2">No hay registros de auditoría recientes.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-[11px] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sky-600 dark:text-sky-400">{log.action}</span>
                      <p className="text-slate-600 dark:text-zinc-400 mt-0.5">{log.details}</p>
                    </div>
                    <span className="text-slate-400 dark:text-zinc-500 font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: USUARIOS Y ACCESOS (Personas del hogar + Usuarios)    */}
      {/* ============================================================ */}
      {activeTab === 'users_access' && (
        <div className="space-y-6">
          
          {/* Subsección 1: Personas de mi Hogar (Comensales familiares) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Personas de mi Hogar (Comensales)</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Añade a las personas que comen en casa (Papá, Mamá, Niños, etc.) con sus dietas y alergias para que la IA adapte los menús
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingDinerId(null);
                  setDinerName('');
                  setDinerNotes('');
                  setDinerAllergies('');
                  setShowAddDinerModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Añadir Persona al Hogar</span>
              </button>
            </div>

            {/* Diners List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {diners.length === 0 ? (
                <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">No has registrado a personas en tu hogar todavía</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Pulsa en "+ Añadir Persona al Hogar" para incluir a los miembros de tu familia.</p>
                </div>
              ) : (
                diners.map(d => (
                  <div key={d.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{d.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDinerId(d.id);
                            setDinerName(d.name);
                            setDinerNotes(d.notes || '');
                            setShowAddDinerModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-sky-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDiner(d.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {d.notes && (
                      <p className="text-xs text-slate-600 dark:text-zinc-400">{d.notes}</p>
                    )}
                    {d.restrictions && d.restrictions.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {d.restrictions.map((r: any, idx: number) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold">
                            ⚠️ {r.details}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Subsección 2: Cuentas de Acceso (Usuarios con Login) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Cuentas de Usuarios con Login</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Cuentas independientes con email/contraseña y 2FA obligatorio. Comparten las recetas del recetario familiar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Usuario</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
              {usersList.map(u => (
                <div key={u.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{u.full_name || u.username}</span>
                    <span className="text-slate-500 dark:text-zinc-400 ml-2 font-mono">({u.email})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      u.role === 'admin'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}>
                      {u.role === 'admin' ? 'Administrador' : 'Familiar'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">{u.mfa_enabled ? '2FA Activo' : 'Sin 2FA'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PÁGINA DE INICIO Y RECETAS                            */}
      {/* ============================================================ */}
      {activeTab === 'home_recipes' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Momentos del Día y Etiquetas del Recetario</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Personaliza los tipos de comida y las etiquetas activas</p>
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
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-amber-500" />
              Momentos del Día / Tipos de Comida Activos
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(recipeConfig.meal_types || []).map((m: any) => (
                <div key={m.id} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{m.label}</span>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{m.id}</p>
                  </div>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          {/* 2. Tags Manager */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-500" />
              Etiquetas del Recetario (Saludable, Más Usada, Favorita, Top Receta, etc.)
            </h4>

            <div className="flex flex-wrap gap-2">
              {(recipeConfig.tags || []).map((tg: any) => (
                <span
                  key={tg.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >
                  <span>{tg.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tg.id)}
                    className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm pt-2">
              <input
                type="text"
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Nueva etiqueta (ej. Alta en Proteína)..."
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                + Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: CORREO Y AVISOS                                       */}
      {/* ============================================================ */}
      {activeTab === 'mail_notifications' && (
        <div className="space-y-6">
          {/* SMTP Server Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Servidor de Correo SMTP</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Configuración para el envío automático de menús y recordatorios</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnector('smtp')}
                  disabled={testingConnector === 'smtp'}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 transition-colors"
                >
                  {testingConnector === 'smtp' ? 'Probando...' : 'Probar Envío'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('smtp')}
                  disabled={savingConnector === 'smtp'}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all"
                >
                  {savingConnector === 'smtp' ? 'Guardando...' : 'Guardar SMTP'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-800 dark:text-white">Activar envío de notificaciones por email</span>
                <input
                  type="checkbox"
                  checked={Boolean(connectors.smtp?.is_active)}
                  onChange={e => setConnectors({
                    ...connectors,
                    smtp: { ...connectors.smtp, is_active: e.target.checked }
                  })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Host SMTP</label>
                  <input
                    type="text"
                    value={connectors.smtp?.host || ''}
                    onChange={e => setConnectors({
                      ...connectors,
                      smtp: { ...connectors.smtp, host: e.target.value }
                    })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Puerto</label>
                  <input
                    type="number"
                    value={connectors.smtp?.port || 587}
                    onChange={e => setConnectors({
                      ...connectors,
                      smtp: { ...connectors.smtp, port: parseInt(e.target.value) || 587 }
                    })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Usuario / Email</label>
                  <input
                    type="text"
                    value={connectors.smtp?.user || ''}
                    onChange={e => setConnectors({
                      ...connectors,
                      smtp: { ...connectors.smtp, user: e.target.value }
                    })}
                    placeholder="tu_cuenta@gmail.com"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Contraseña de Aplicación</label>
                  <div className="relative">
                    <input
                      type={showPassword['smtp'] ? 'text' : 'password'}
                      value={connectors.smtp?.password || ''}
                      onChange={e => setConnectors({
                        ...connectors,
                        smtp: { ...connectors.smtp, password: e.target.value }
                      })}
                      placeholder="••••••••••••"
                      className="w-full px-3.5 py-2 pr-9 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowPassword('smtp')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword['smtp'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-center">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Remitente (From)</label>
                  <input
                    type="text"
                    value={connectors.smtp?.from_email || ''}
                    onChange={e => setConnectors({
                      ...connectors,
                      smtp: { ...connectors.smtp, from_email: e.target.value }
                    })}
                    placeholder="recetas@familiar.local"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={connectors.smtp?.use_tls !== false}
                      onChange={e => setConnectors({
                        ...connectors,
                        smtp: { ...connectors.smtp, use_tls: e.target.checked }
                      })}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                    />
                    <span>Usar STARTTLS (Recomendado)</span>
                  </label>
                </div>
              </div>

              {testResults['smtp'] && (
                <div className={`p-3 rounded-2xl text-xs border ${
                  testResults['smtp'].success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
                }`}>
                  {testResults['smtp'].message}
                </div>
              )}
            </div>
          </div>

          {/* Automatic Notification Rules */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Horarios y Reglas de Notificación</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Automatizaciones para avisos de cocina, compras y despensa</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveConnector('notification_rules')}
                disabled={savingConnector === 'notification_rules'}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition-all self-start sm:self-auto"
              >
                {savingConnector === 'notification_rules' ? 'Guardando...' : 'Guardar Reglas'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-white block">Recordatorio del Menú del Día</span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Hora en la que se despacha el menú matutino a la familia</p>
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
                  className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-white block">Caducidad en Despensa</span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Días de antelación para avisar de alimentos perecederos</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={connectors.notification_rules?.pantry_days_before || 3}
                    onChange={e => setConnectors({
                      ...connectors,
                      notification_rules: {
                        ...connectors.notification_rules,
                        pantry_days_before: parseInt(e.target.value) || 3
                      }
                    })}
                    className="w-20 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                  <span className="text-xs text-slate-600 dark:text-zinc-400">días antes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: CONECTORES E INTELIGENCIA ARTIFICIAL                  */}
      {/* ============================================================ */}
      {activeTab === 'connectors_ai' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Google Gemini AI */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Gemini AI</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">Extracción de recetas, variantes para robots y OCR</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectors.gemini?.is_configured
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    {connectors.gemini?.is_configured ? 'Conectado a la API' : 'Modo Heurístico Local'}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">API Key de Gemini</label>
                    <div className="relative">
                      <input
                        type={showPassword['gemini'] ? 'text' : 'password'}
                        value={connectors.gemini?.api_key || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          gemini: { ...connectors.gemini, api_key: e.target.value }
                        })}
                        placeholder="AIzaSy..."
                        className="w-full px-3.5 py-2 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword('gemini')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Modelo</label>
                    <select
                      value={connectors.gemini?.model || 'gemini-3.8-flash'}
                      onChange={e => setConnectors({
                        ...connectors,
                        gemini: { ...connectors.gemini, model: e.target.value }
                      })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                    >
                      <option value="gemini-3.8-flash">gemini-3.8-flash (Recomendado - Ultrarrápido y Multimodal)</option>
                      <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ligero y Alta velocidad)</option>
                      <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Máxima precisión y razonamiento)</option>
                    </select>
                  </div>

                  {testResults['gemini'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['gemini'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
                    }`}>
                      {testResults['gemini'].message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleTestConnector('gemini')}
                  disabled={testingConnector === 'gemini'}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 transition-colors"
                >
                  {testingConnector === 'gemini' ? 'Probando...' : 'Probar Conexión'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('gemini')}
                  disabled={savingConnector === 'gemini'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
                >
                  {savingConnector === 'gemini' ? 'Guardando...' : 'Guardar Gemini'}
                </button>
              </div>
            </div>

            {/* 2. Telegram Bot */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bot de Telegram</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">Avisos instantáneos al chat o grupo de la familia</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(connectors.telegram?.is_active)}
                    onChange={e => setConnectors({
                      ...connectors,
                      telegram: { ...connectors.telegram, is_active: e.target.checked }
                    })}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                  />
                </div>

                <div className="space-y-3 pt-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Bot Token (@BotFather)</label>
                    <div className="relative">
                      <input
                        type={showPassword['telegram'] ? 'text' : 'password'}
                        value={connectors.telegram?.bot_token || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          telegram: { ...connectors.telegram, bot_token: e.target.value }
                        })}
                        placeholder="712345678:AAH..."
                        className="w-full px-3.5 py-2 pr-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowPassword('telegram')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword['telegram'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Chat ID</label>
                    <input
                      type="text"
                      value={connectors.telegram?.chat_id || ''}
                      onChange={e => setConnectors({
                        ...connectors,
                        telegram: { ...connectors.telegram, chat_id: e.target.value }
                      })}
                      placeholder="ej: -1001234567890 o 987654321"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  {testResults['telegram'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['telegram'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
                    }`}>
                      {testResults['telegram'].message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleTestConnector('telegram')}
                  disabled={testingConnector === 'telegram'}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 transition-colors"
                >
                  {testingConnector === 'telegram' ? 'Enviando...' : 'Enviar Prueba'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('telegram')}
                  disabled={savingConnector === 'telegram'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  {savingConnector === 'telegram' ? 'Guardando...' : 'Guardar Telegram'}
                </button>
              </div>
            </div>

            {/* 3. Synology NAS */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Synology NAS</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">Segunda copia de seguridad persistente en red local</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectors.synology?.is_configured
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}>
                    {connectors.synology?.is_configured ? 'Configurado' : 'Pendiente'}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Host o IP</label>
                      <input
                        type="text"
                        value={connectors.synology?.host || '192.168.1.8'}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, host: e.target.value }
                        })}
                        placeholder="192.168.1.8"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Puerto DSM</label>
                      <input
                        type="number"
                        value={connectors.synology?.port || 5000}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, port: parseInt(e.target.value) || 5000 }
                        })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Usuario DSM</label>
                      <input
                        type="text"
                        value={connectors.synology?.user || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, user: e.target.value }
                        })}
                        placeholder="admin"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Contraseña</label>
                      <input
                        type="password"
                        value={connectors.synology?.password || ''}
                        onChange={e => setConnectors({
                          ...connectors,
                          synology: { ...connectors.synology, password: e.target.value }
                        })}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  {testResults['synology'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['synology'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
                    }`}>
                      {testResults['synology'].message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleTestConnector('synology')}
                  disabled={testingConnector === 'synology'}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 transition-colors"
                >
                  {testingConnector === 'synology' ? 'Probando...' : 'Comprobar Red NAS'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('synology')}
                  disabled={savingConnector === 'synology'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  {savingConnector === 'synology' ? 'Guardando...' : 'Guardar Synology'}
                </button>
              </div>
            </div>

            {/* 4. Google Drive */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Drive</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">Importación de recetas, PDFs y copia remota</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectors.drive?.is_configured
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}>
                    {connectors.drive?.is_configured ? 'Configurado' : 'Pendiente OAuth'}
                  </span>
                </div>

                <div className="space-y-3 pt-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Client ID</label>
                    <input
                      type="text"
                      value={connectors.drive?.client_id || ''}
                      onChange={e => setConnectors({
                        ...connectors,
                        drive: { ...connectors.drive, client_id: e.target.value }
                      })}
                      placeholder="xxxx.apps.googleusercontent.com"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Client Secret</label>
                    <input
                      type="password"
                      value={connectors.drive?.client_secret || ''}
                      onChange={e => setConnectors({
                        ...connectors,
                        drive: { ...connectors.drive, client_secret: e.target.value }
                      })}
                      placeholder="GOCSPX-..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  {testResults['drive'] && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      testResults['drive'].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'
                    }`}>
                      {testResults['drive'].message}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleTestConnector('drive')}
                  disabled={testingConnector === 'drive'}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 transition-colors"
                >
                  {testingConnector === 'drive' ? 'Validando...' : 'Validar Credenciales'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConnector('drive')}
                  disabled={savingConnector === 'drive'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  {savingConnector === 'drive' ? 'Guardando...' : 'Guardar Drive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Crear Usuario con Acceso</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-zinc-400">Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-zinc-400">Nombre de usuario</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-zinc-400">Contraseña temporal</label>
                <input
                  type="password"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-zinc-400">Rol</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  <option value="family">Familiar (Comparte recetas del hogar)</option>
                  <option value="admin">Administrador (2FA obligatorio y panel)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-sky-600 text-white"
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Diner Modal (Personas del hogar) */}
      {showAddDinerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingDinerId ? 'Editar Persona del Hogar' : 'Añadir Persona al Hogar'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Registra quién come en casa (ej. Papá, Mamá, Hijos) para que la IA adapte los menús semanales.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Nombre / Apodo</label>
                <input
                  type="text"
                  value={dinerName}
                  onChange={(e) => setDinerName(e.target.value)}
                  placeholder="ej. Mamá, Lucas, Sofía..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tipo de Dieta habitual</label>
                <select
                  value={dinerDietType}
                  onChange={(e) => setDinerDietType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  <option value="Todo / Normal">Come de todo / Dieta mediterránea</option>
                  <option value="Rápida y sencilla">Prefiere comidas rápidas y sencillas</option>
                  <option value="Alta en proteína">Alta en proteína / Deportista</option>
                  <option value="Baja en grasa">Baja en grasa / Ligera</option>
                  <option value="Vegetariano">Vegetariano</option>
                  <option value="Infantil">Menú infantil / Niños</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Alergias o Intolerancias</label>
                <input
                  type="text"
                  value={dinerAllergies}
                  onChange={(e) => setDinerAllergies(e.target.value)}
                  placeholder="ej. Gluten, Lactosa, Frutos secos..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Gustos / Alimentos a evitar</label>
                <input
                  type="text"
                  value={dinerNotes}
                  onChange={(e) => setDinerNotes(e.target.value)}
                  placeholder="ej. Le encanta el salmón, odia los champiñones..."
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddDinerModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDiner}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white"
              >
                Guardar Persona
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
