import React, { useState, useEffect } from 'react';
import {
  Shield, HardDrive, Database, Users, Sparkles,
  RefreshCw, CheckCircle, AlertTriangle, Plus, FileText,
  Activity, ArrowDownToLine
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
  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('family');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [s, i, b, u, a] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest('/admin/integrations'),
        apiRequest('/admin/backups'),
        apiRequest('/admin/users'),
        apiRequest('/admin/audit-logs')
      ]);
      setStats(s);
      setIntegrations(i);
      setBackups(b);
      setUsersList(u);
      setAuditLogs(a);
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
    try {
      const res = await apiRequest('/admin/storage/cleanup', { method: 'POST' });
      alert(res.message);
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error en limpieza: ${err.message || err}`);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPass) return;
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
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPass('');
      await fetchAdminData();
    } catch (err: any) {
      alert(`Error creando usuario: ${err.message || err}`);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-zinc-500 text-sm">Cargando panel de administración...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-400" />
            <span>{t('admin')}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Control de infraestructura, seguridad, usuarios y almacenamiento</p>
        </div>

        <button
          onClick={fetchAdminData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar estado</span>
        </button>
      </div>

      {/* Storage Guard Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Almacenamiento Servidor Debian (Crítico)</h3>
          </div>
          <button
            onClick={handleStorageCleanup}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
          >
            Limpiar temporales ahora
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Espacio Libre</span>
            <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
              {stats?.storage?.free_gb} GB
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Espacio Total</span>
            <p className="text-lg font-black text-white font-mono mt-0.5">
              {stats?.storage?.total_gb} GB
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Uso de Disco</span>
            <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
              {stats?.storage?.percent_used}%
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Datos Recetario</span>
            <p className="text-lg font-black text-zinc-200 font-mono mt-0.5">
              {stats?.storage?.app_storage_mb} MB
            </p>
          </div>
        </div>
      </div>

      {/* Integrations Status */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Estado de Integraciones
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {integrations && Object.entries(integrations).map(([key, val]: [string, any]) => (
            <div key={key} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{val.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  val.is_configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {val.is_configured ? 'Conectado' : 'Pendiente'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">{val.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Backups Section */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Copias de Seguridad (Drive & Synology)</h3>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
          >
            {isBackingUp ? 'Creando copia...' : 'Crear Copia Ahora'}
          </button>
        </div>

        <div className="space-y-2">
          {backups.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">No se han registrado copias de seguridad.</p>
          ) : (
            backups.map((b, i) => (
              <div key={i} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white">{b.filename}</span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{b.size_mb} MB · {new Date(b.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                    {b.is_valid ? 'Íntegro' : 'Error'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Management */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Usuarios del Recetario</h3>
          </div>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Usuario</span>
          </button>
        </div>

        <div className="divide-y divide-zinc-800/80 bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-hidden">
          {usersList.map(u => (
            <div key={u.id} className="p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white">{u.full_name || u.username}</span>
                <span className="text-zinc-500 ml-2 font-mono">({u.email})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
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
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Registro de Auditoría (Acceso a Datos Privados)</h3>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">No hay registros de auditoría recientes.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/60 text-[11px] flex items-center justify-between">
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4">
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
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950"
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
