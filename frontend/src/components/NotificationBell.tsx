import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, BellRing, Check, CheckCheck, Trash2, Settings,
  Mail, Send, Smartphone, Info, Calendar, Package, HardDrive,
  X, RefreshCw
} from 'lucide-react';
import { apiRequest } from '../services/api';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  in_app: boolean;
  email: boolean;
  telegram: boolean;
  push: boolean;
  daily_menu: boolean;
  pantry_expiry: boolean;
  storage_alerts: boolean;
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    in_app: true,
    email: true,
    telegram: false,
    push: true,
    daily_menu: true,
    pantry_expiry: true,
    storage_alerts: true,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  // Close modal when pressing Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPrefsModal(false);
      }
    };
    if (showPrefsModal) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPrefsModal]);

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest<{ unread_count: number; notifications: NotificationItem[] }>('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  };

  const fetchPreferences = async () => {
    try {
      const data = await apiRequest<NotificationPreferences>('/notifications/preferences');
      setPreferences(data);
    } catch (err) {
      console.warn('Failed to load notification preferences:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();

    // Polling every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOpen = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/notifications/${id}`, { method: 'DELETE' });
      const target = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsMessage(null);
    try {
      await apiRequest('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });
      setPrefsMessage('¡Preferencias guardadas con éxito!');
      setTimeout(() => {
        setPrefsMessage(null);
        setShowPrefsModal(false);
      }, 1500);
    } catch (err: any) {
      setPrefsMessage(`Error al guardar: ${err.message || 'Error desconocido'}`);
    } finally {
      setSavingPrefs(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pantry':
        return <Package className="w-4 h-4 text-emerald-500" />;
      case 'meal_plan':
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'storage':
        return <HardDrive className="w-4 h-4 text-rose-500" />;
      default:
        return <Info className="w-4 h-4 text-sky-500" />;
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHour = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHour / 24);

      if (diffMin < 1) return 'Ahora mismo';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHour < 24) return `Hace ${diffHour} h`;
      if (diffDays === 1) return 'Ayer';
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        title={unreadCount > 0 ? `${unreadCount} notificaciones pendientes` : 'Notificaciones'}
        className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
          unreadCount > 0
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700'
        }`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4 h-4 animate-bounce" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-md ring-2 ring-white dark:ring-zinc-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/60 dark:bg-zinc-950/40">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Marcar todas como leídas"
                  className="px-2 py-1 rounded-lg text-xs text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Leídas</span>
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowPrefsModal(true);
                }}
                title="Configurar canales de notificación"
                className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feed List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-slate-100 dark:bg-zinc-800/60 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">¡Todo al día!</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">No tienes notificaciones pendientes.</p>
              </div>
            ) : (
              notifications.map(item => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors flex gap-3 text-left relative group ${
                    item.is_read
                      ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                      : 'bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10 dark:hover:bg-amber-500/15'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800/80 flex items-center justify-center border border-slate-200 dark:border-zinc-700/50">
                      {getCategoryIcon(item.category)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className={`text-xs font-bold truncate ${item.is_read ? 'text-slate-700 dark:text-zinc-300' : 'text-slate-900 dark:text-zinc-100'}`}>
                        {item.title}
                      </p>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug line-clamp-3">
                      {item.message}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block font-medium">
                      {formatTimestamp(item.created_at)}
                    </span>
                  </div>

                  {/* Actions on hover / always tapable */}
                  <div className="absolute right-2 top-2 flex flex-col gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.is_read && (
                      <button
                        onClick={e => handleMarkAsRead(item.id, e)}
                        title="Marcar como leída"
                        className="p-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-zinc-700 shadow-sm"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={e => handleDelete(item.id, e)}
                      title="Eliminar notificación"
                      className="p-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-zinc-700 shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Avisos de cocina y despensa</span>
            <button
              onClick={() => {
                setIsOpen(false);
                setShowPrefsModal(true);
              }}
              className="text-amber-600 dark:text-amber-400 hover:underline font-bold"
            >
              Configurar canales &rarr;
            </button>
          </div>
        </div>
      )}

      {/* User Preferences Modal */}
      {showPrefsModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={e => {
              if (e.target === e.currentTarget) setShowPrefsModal(false);
            }}
          >
            <div className="w-full max-w-md my-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[min(90vh,calc(100dvh-2rem))] animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/60 dark:bg-zinc-950/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Canales de Notificación</h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Personaliza cómo y dónde recibir alertas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrefsModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
                {prefsMessage && (
                  <div
                    className={`p-3 rounded-2xl text-xs font-semibold border ${
                      prefsMessage.includes('Error')
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    {prefsMessage}
                  </div>
                )}

                {/* Delivery Channels */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Canales de Entrega
                  </h4>

                  {/* In-app Bell (Always ON) */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/40">
                    <div className="flex items-center gap-2.5">
                      <Bell className="w-4 h-4 text-amber-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">Campanita en App</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">Panel superior en la web y móvil</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                      Siempre activa
                    </span>
                  </div>

                  {/* Email (SMTP) */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/40">
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-sky-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">Correo Electrónico (Email)</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">Recibir avisos en tu dirección de usuario</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.email}
                        onChange={e => setPreferences({ ...preferences, email: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Telegram Bot */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/40">
                    <div className="flex items-center gap-2.5">
                      <Send className="w-4 h-4 text-cyan-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">Bot de Telegram</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">Alertas instantáneas al chat familiar</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.telegram}
                        onChange={e => setPreferences({ ...preferences, telegram: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Web / Push */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/40">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-emerald-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">Mensajes Web / Push</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">Notificaciones en móvil en modo App (PWA)</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.push}
                        onChange={e => setPreferences({ ...preferences, push: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>

                {/* Alert Types */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Tipos de Alerta
                  </h4>

                  <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Menú diario planificado</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">Recordatorio matutino de qué toca cocinar hoy</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.daily_menu}
                      onChange={e => setPreferences({ ...preferences, daily_menu: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Caducidad en despensa</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">Aviso preventivo 3 días antes de expirar</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.pantry_expiry}
                      onChange={e => setPreferences({ ...preferences, pantry_expiry: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">Alertas de almacenamiento</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">Avisos si el espacio en disco baja del límite seguro</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.storage_alerts}
                      onChange={e => setPreferences({ ...preferences, storage_alerts: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPrefsModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingPrefs && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Guardar Preferencias
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
