import React, { useState, useEffect } from 'react';
import {
  Shield, HardDrive, Database, Users, Sparkles,
  RefreshCw, CheckCircle, AlertTriangle, Plus, FileText,
  Activity, ArrowDownToLine, Tag, Utensils, Trash2,
  Info, ExternalLink, Key, Check
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export const AdminPage: React.FC = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [integrations, setIntegrations] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [recipeConfig, setRecipeConfig] = useState<any>({ meal_types: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('family');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [s, i, b, u, a, c] = await Promise.all([
        apiRequest('/admin/stats').catch(() => null),
        apiRequest('/admin/integrations').catch(() => null),
        apiRequest('/admin/backups').catch(() => []),
        apiRequest('/admin/users').catch(() => []),
        apiRequest('/admin/audit-logs').catch(() => []),
        apiRequest('/admin/recipe-config').catch(() => ({ meal_types: [], tags: [] }))
      ]);
      setStats(s);
      setIntegrations(i);
      setBackups(b || []);
      setUsersList(u || []);
      setAuditLogs(a || []);
      setRecipeConfig(c || { meal_types: [], tags: [] });
    } catch (err) {
      console.warn('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

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
    if (!confirm('¿Deseas vaciar todos los archivos y streams temporales de /app/data/tmp?')) return;
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
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-8 animate-in fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Panel de Control del Servidor</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Administración Global</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Gestión de usuarios, integraciones con Google & Synology, políticas de almacenamiento y etiquetas.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

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

      {/* Recipe Moments and Tags Customization */}
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

      {/* Integrations Status & Setup Guide */}
      <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Estado de Conexiones e IA
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            El sistema opera con motores heurísticos inteligentes locales y está preparado para conectarse con las APIs externas
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {integrations && Object.entries(integrations).map(([key, val]: [string, any]) => (
            <div key={key} className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{val.name}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  val.is_configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {val.is_configured ? 'Conectado a la nube' : 'Modo Local Heurístico'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">{val.status}</p>
            </div>
          ))}
        </div>

        {/* Integration Instructions Accordion / Guide */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase">
            <Info className="w-3.5 h-3.5" />
            ¿Qué hace falta para conectar cada servicio externo?
          </h4>
          <div className="space-y-2 text-xs text-zinc-300 leading-relaxed">
            <p>
              • <strong className="text-white">Google Gemini AI:</strong> Introducir tu clave de API en el archivo <code className="text-amber-400">.env</code> (<code className="text-zinc-400">GEMINI_API_KEY=AIzaSy...</code>). Actualmente la aplicación funciona al 100% mediante el motor heurístico culinario local.
            </p>
            <p>
              • <strong className="text-white">Google Drive:</strong> Colocar el fichero de credenciales OAuth de Google Cloud en <code className="text-amber-400">backend/credentials/client_secret.json</code> y pulsar en "Conectar" desde el Centro de Importación.
            </p>
            <p>
              • <strong className="text-white">Synology NAS:</strong> Configurado para duplicar los backups en el recurso compartido <code className="text-zinc-300">192.168.1.8/recetas_backup</code> sin consumir espacio en el disco Debian.
            </p>
            <p>
              • <strong className="text-white">Notificaciones Móvil & Correo:</strong> Soporte nativo para Web Push (al instalar la PWA en el teléfono) y SMTP estándar para alertas de menú diario.
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

      {/* User Management */}
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
