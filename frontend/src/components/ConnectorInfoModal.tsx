import React, { useState, useEffect } from 'react';
import {
  X, HelpCircle, ExternalLink, Copy, Check, Sparkles,
  Send, HardDrive, Server, Mail, AlertTriangle, CheckCircle2,
  Info, ArrowRight, ShieldCheck, Terminal
} from 'lucide-react';

export type ConnectorType = 'gemini' | 'telegram' | 'drive' | 'synology' | 'smtp' | 'google_auth';

interface ConnectorInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConnector?: ConnectorType;
  redirectUri?: string;
}

interface ConnectorMeta {
  id: ConnectorType;
  name: string;
  badge: string;
  shortDesc: string;
  color: string;
  icon: React.FC<{ className?: string }>;
}

const CONNECTORS: ConnectorMeta[] = [
  {
    id: 'google_auth',
    name: 'Inicio con Google',
    badge: 'OAuth 2.0 SSO',
    shortDesc: 'Permite a los miembros iniciar sesión con su cuenta de Google',
    color: 'blue',
    icon: ShieldCheck
  },
  {
    id: 'drive',
    name: 'Google Drive',
    badge: 'OAuth 2.0',
    shortDesc: 'Copias en la nube e importación de recetas y PDFs',
    color: 'emerald',
    icon: HardDrive
  },
  {
    id: 'telegram',
    name: 'Bot de Telegram',
    badge: 'Notificaciones',
    shortDesc: 'Avisos al móvil o grupo familiar en tiempo real',
    color: 'cyan',
    icon: Send
  },
  {
    id: 'gemini',
    name: 'Google Gemini AI',
    badge: 'IA & OCR',
    shortDesc: 'Extracción inteligente de recetas y tickets de compra',
    color: 'amber',
    icon: Sparkles
  },
  {
    id: 'synology',
    name: 'Synology NAS',
    badge: 'Red Local (LAN)',
    shortDesc: 'Copia de seguridad secundaria en tu propio NAS',
    color: 'purple',
    icon: Server
  },
  {
    id: 'smtp',
    name: 'Correo SMTP',
    badge: 'Email',
    shortDesc: 'Envío de menús diarios y alertas por correo',
    color: 'sky',
    icon: Mail
  }
];

export const ConnectorInfoModal: React.FC<ConnectorInfoModalProps> = ({
  isOpen,
  onClose,
  initialConnector = 'drive',
  redirectUri
}) => {
  const [activeConnector, setActiveConnector] = useState<ConnectorType>(initialConnector);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialConnector) {
      setActiveConnector(initialConnector);
    }
  }, [initialConnector, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentRedirectUri =
    redirectUri ||
    (typeof window !== 'undefined' ? `${window.location.origin}/api/drive/callback` : 'https://recetas.danesti.es/api/drive/callback');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const currentMeta = CONNECTORS.find(c => c.id === activeConnector) || CONNECTORS[0];
  const IconComponent = currentMeta.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              currentMeta.id === 'drive' ? 'bg-emerald-500/10 text-emerald-500' :
              currentMeta.id === 'telegram' ? 'bg-cyan-500/10 text-cyan-500' :
              currentMeta.id === 'gemini' ? 'bg-amber-500/10 text-amber-500' :
              currentMeta.id === 'synology' ? 'bg-purple-500/10 text-purple-500' :
              'bg-sky-500/10 text-sky-500'
            }`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Guía de Configuración: {currentMeta.name}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {currentMeta.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {currentMeta.shortDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connector Selector Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
            Conectores:
          </span>
          {CONNECTORS.map(conn => {
            const isSelected = conn.id === activeConnector;
            const ItemIcon = conn.icon;
            return (
              <button
                key={conn.id}
                type="button"
                onClick={() => setActiveConnector(conn.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <ItemIcon className="w-3.5 h-3.5" />
                <span>{conn.name}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 dark:text-zinc-300 text-xs sm:text-sm">
          {/* ======================================================== */}
          {/* GUIDE 1: GOOGLE DRIVE                                    */}
          {/* ======================================================== */}
          {activeConnector === 'drive' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>¿Por qué conectar Google Drive?</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  Permite sincronizar copias de seguridad de la base de datos directamente a tu Google Drive, importar recetas desde archivos PDF o Word guardados en tu nube, y mantener los datos a salvo fuera del servidor local.
                </p>
              </div>

              {/* Requirements & Link Box */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Portal de Desarrolladores de Google</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">Todo el proceso se realiza de forma gratuita desde Google Cloud Console</span>
                </div>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  <span>Abrir Google Cloud Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Pasos para obtener tu Client ID y Client Secret:</span>
                </h3>

                {/* Step 1 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px]">1</span>
                    <span>Crear un Proyecto en Google Cloud</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    Entra en <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">Google Cloud Console</a>. En la barra superior, haz clic en el selector de proyectos y pulsa <strong>"Proyecto nuevo"</strong> (por ejemplo: <code className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">Recetario Familiar</code>).
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px]">2</span>
                    <span>Habilitar la API de Google Drive</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    En el menú lateral izquierdo, ve a <strong>APIs y servicios &gt; Biblioteca</strong>. Busca <strong className="text-slate-800 dark:text-zinc-200">Google Drive API</strong> y haz clic en el botón azul <strong>Habilitar</strong>.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px]">3</span>
                    <span>Configurar la Pantalla de Consentimiento OAuth</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-2">
                    <p>
                      En el menú lateral, ve a <strong>APIs y servicios &gt; Pantalla de consentimiento de OAuth</strong>:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Selecciona <strong>Externo</strong> y pulsa <em>Crear</em>.</li>
                      <li>Introduce un nombre (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Recetario Familiar</code>) y tu correo en "Correo de asistencia" y "Datos de contacto del desarrollador".</li>
                      <li>Pulsa <em>Guardar y continuar</em> hasta la sección <strong>Usuarios de prueba (Test users)</strong>.</li>
                    </ul>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                      <strong>⚠️ ¡Paso Crucial!</strong> Añade tu dirección de Gmail en <em>Usuarios de prueba</em>. Si no lo haces, Google bloqueará el inicio de sesión con el error <em>"Acceso bloqueado / App no verificada"</em>.
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px]">4</span>
                    <span>Crear las Credenciales OAuth y URI de Redireccionamiento</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-2">
                    <p>
                      Ve a <strong>APIs y servicios &gt; Credenciales</strong>. Pulsa en <strong>+ Crear credenciales &gt; ID de cliente de OAuth</strong>:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Tipo de aplicación: <strong>Aplicación web</strong>.</li>
                      <li>Nombre: <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Recetario Web</code>.</li>
                      <li>
                        En <strong>URIs de redireccionamiento autorizados</strong>, debes pegar exactamente esta dirección URL:
                      </li>
                    </ul>

                    {/* Copyable Callback Box */}
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-black font-mono text-xs flex items-center justify-between gap-2 border border-slate-800">
                      <span className="truncate">{currentRedirectUri}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(currentRedirectUri, 'redirect_uri')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-[11px] shrink-0 transition-colors"
                      >
                        {copiedKey === 'redirect_uri' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar URI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px]">5</span>
                    <span>Guardar y Validar en el Recetario</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    Copia el <strong>ID de cliente</strong> (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">xxxx.apps.googleusercontent.com</code>) y el <strong>Secreto de cliente</strong> (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">GOCSPX-xxxx</code>) generados por Google y pégalos en la tarjeta de Google Drive. Pulsa en <strong>Guardar Drive</strong> y luego en <strong>Validar Credenciales</strong> para iniciar sesión y autorizar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* GUIDE 2: TELEGRAM BOT                                    */}
          {/* ======================================================== */}
          {activeConnector === 'telegram' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-900 dark:text-cyan-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Send className="w-4 h-4 text-cyan-500" />
                  <span>Notificaciones Familiares al Instante</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  El bot de Telegram envía cada mañana el menú que toca cocinar, avisa si faltan pocos días para que caduque un producto de la despensa y permite coordinar la lista de la compra directamente en tu teléfono o en el grupo de toda la familia.
                </p>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Pasos para crear y conectar el Bot:</span>
                </h3>

                {/* Step 1 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[11px]">1</span>
                      <span>Crear el Bot con @BotFather en Telegram</span>
                    </div>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      <span>Abrir @BotFather</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-2">
                    <p>
                      Abre Telegram en tu teléfono o PC y busca el bot oficial <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 font-bold">@BotFather</a> (tiene una marca de verificación azul):
                    </p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>
                        Envía el comando:
                        <div className="inline-flex items-center gap-2 my-1 ml-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                          <span>/newbot</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('/newbot', 'newbot_cmd')}
                            className="text-slate-400 hover:text-cyan-500"
                            title="Copiar comando"
                          >
                            {copiedKey === 'newbot_cmd' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </li>
                      <li>Escribe un nombre amigable para el bot (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Chef Familiar</code>).</li>
                      <li>Escribe un nombre de usuario que termine obligatoriamente en <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">bot</code> (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">mi_recetario_casa_bot</code>).</li>
                      <li>BotFather te entregará un <strong>HTTP API Token</strong> similar a: <code className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-[11px]">712345678:AAHAbcdefgh...</code></li>
                    </ol>
                    <p>
                      Copia ese token y pégalo en el campo <strong>Bot Token (@BotFather)</strong> en el panel.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[11px]">2</span>
                    <span>Obtener el Chat ID (¿A dónde enviar los avisos?)</span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Personal Chat */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                        <span className="font-bold text-slate-900 dark:text-white block text-xs">
                          Opción A: Chat Personal Privado
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          1. Busca tu bot en Telegram y pulsa <strong>Iniciar (/start)</strong>. <em>(¡Obligatorio para que Telegram permita enviarte mensajes!)</em>.
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          2. Abre el bot auxiliar <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 font-bold underline">@userinfobot</a> y pulsa Iniciar. Te responderá con tu <strong>Id</strong> numérico (ej. <code className="font-mono">123456789</code>).
                        </p>
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200">
                          Ese número es tu Chat ID.
                        </p>
                      </div>

                      {/* Group Chat */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                        <span className="font-bold text-slate-900 dark:text-white block text-xs">
                          Opción B: Grupo con toda la Familia
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          1. Crea un grupo en Telegram o usa el grupo familiar actual.
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          2. Añade a tu bot como miembro del grupo.
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          3. Añade al bot auxiliar <a href="https://t.me/RawDataBot" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 font-bold underline">@RawDataBot</a> al grupo. Mostrará el <code className="font-mono">chat.id</code> (en grupos siempre es negativo, ej: <code className="font-mono">-1001234567890</code>). Copia el número entero con el signo menos y luego expulsa al bot auxiliar.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[11px]">3</span>
                    <span>Guardar y Probar</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-1">
                    <p>
                      1. Asegúrate de marcar la casilla de verificación <strong>"Activar Bot de Telegram"</strong> en la tarjeta.
                    </p>
                    <p>
                      2. Haz clic en <strong>Guardar Telegram</strong>.
                    </p>
                    <p>
                      3. Pulsa en <strong>Enviar Prueba</strong>. Si los datos son correctos, recibirás un mensaje de saludo al instante en tu Telegram.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* GUIDE 3: GOOGLE GEMINI AI                                */}
          {/* ======================================================== */}
          {activeConnector === 'gemini' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Cerebro Inteligente Multimodal</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  Gemini analiza fotos de recetas manuscritas o de libros de cocina, lee automáticamente tickets de compra del supermercado con visión OCR para actualizar la despensa, y recalcula cantidades e instrucciones adaptadas a robots como Thermomix, Cecotec o Monsieur Cuisine.
                </p>
              </div>

              {/* Requirements & Link Box */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Google AI Studio</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">Puedes generar tu API Key gratuita en menos de 1 minuto</span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-sm transition-colors"
                >
                  <span>Obtener API Key en AI Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Pasos para activar Gemini AI:</span>
                </h3>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[11px]">1</span>
                    <span>Crear la clave de API</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    Entra en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 font-semibold underline">Google AI Studio</a> con tu cuenta de Google. Haz clic en el botón azul <strong>"Create API key"</strong> y copia la clave que empieza por <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">AIzaSy...</code>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[11px]">2</span>
                    <span>Elegir el modelo</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-1.5">
                    <p>Recomendamos mantener el modelo seleccionado por defecto:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong className="text-slate-900 dark:text-white">gemini-3.8-flash (Recomendado):</strong> Excelente capacidad visual para OCR de fotos, balance perfecto entre velocidad ultrarrápida y precisión.
                      </li>
                      <li>
                        <strong className="text-slate-900 dark:text-white">gemini-3.5-flash-lite:</strong> Para mínima latencia en dispositivos ligeros.
                      </li>
                      <li>
                        <strong className="text-slate-900 dark:text-white">gemini-3.1-pro-preview:</strong> Mayor capacidad de deducción lógica culinaria para recetas complejas.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[11px]">3</span>
                    <span>Probar y Guardar</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    Pega tu clave en el campo <strong>API Key de Gemini</strong>, pulsa <strong>Guardar Gemini</strong> y luego <strong>Probar Conexión</strong>. La prueba realizará una consulta mínima para confirmar que la cuota y la clave son totalmente válidas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* GUIDE 4: SYNOLOGY NAS                                    */}
          {/* ======================================================== */}
          {activeConnector === 'synology' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Server className="w-4 h-4 text-purple-500" />
                  <span>Respaldo en Red Local (LAN)</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  Guarda automáticamente copias de seguridad de las recetas, fotografías y base de datos directamente en tu propio NAS doméstico Synology DSM, garantizando soberanía digital y privacidad sin coste en la nube.
                </p>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Pasos para conectar con Synology DSM:</span>
                </h3>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[11px]">1</span>
                    <span>Crear Carpeta Compartida en DSM</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    Accede al panel web de tu Synology (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">http://192.168.1.8:5000</code>). Ve a <strong>Panel de Control &gt; Carpeta compartida</strong> y crea una carpeta dedicada para las copias (por ejemplo, <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">/volume1/Backups/Recetario</code>).
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[11px]">2</span>
                    <span>Crear un usuario de servicio (Recomendado)</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7">
                    En <strong>Panel de Control &gt; Usuario y grupo</strong>, crea un usuario específico (ej. <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">recetario_user</code>) con contraseña segura y asígnale permisos de <strong>Lectura y Escritura</strong> exclusivamente sobre la carpeta de copias compartida creada en el paso 1.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[11px]">3</span>
                    <span>Rellenar formulario y Comprobar Red</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed pl-7 space-y-1">
                    <p>Introduce la IP fija de tu NAS en tu red local (ej. <code className="font-mono">192.168.1.8</code>), el puerto DSM (por defecto <code className="font-mono">5000</code> para HTTP o <code className="font-mono">5001</code> para HTTPS) y las credenciales.</p>
                    <p>Pulsa en <strong>Comprobar Red NAS</strong> para verificar la comunicación directa por socket antes de guardar.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* GUIDE 5: CORREO SMTP                                     */}
          {/* ======================================================== */}
          {activeConnector === 'smtp' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-900 dark:text-sky-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Mail className="w-4 h-4 text-sky-500" />
                  <span>Notificaciones y Resúmenes por Correo</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  Permite el envío del menú semanal planificado a los miembros de la casa, recordatorios de alimentos que van a caducar y alertas de seguridad del sistema.
                </p>
              </div>

              {/* Step by step */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Configuración con Gmail (Recomendada):</span>
                </h3>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Generar una Contraseña de Aplicación en Google
                    </span>
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      <span>Abrir Contraseñas de Aplicaciones</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed space-y-2">
                    <p>
                      Por seguridad, Google no permite usar la contraseña habitual de tu cuenta de correo. Debes crear una contraseña de aplicación:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>
                        Asegúrate de tener la <strong>Verificación en dos pasos (2FA)</strong> activada en tu cuenta de Google.
                      </li>
                      <li>
                        Entra en <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 font-semibold underline">Contraseñas de aplicaciones</a>.
                      </li>
                      <li>Escribe el nombre de la app (ej: <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Recetario Familiar</code>) y haz clic en <strong>Crear</strong>.</li>
                      <li>Google te mostrará un código de 16 caracteres (ejemplo: <code className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono font-bold text-slate-900 dark:text-white">abcd efgh ijkl mnop</code>). Cópialo sin espacios.</li>
                    </ol>

                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between"><span className="text-slate-500">Host SMTP:</span> <span className="font-bold text-slate-800 dark:text-zinc-200">smtp.gmail.com</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Puerto:</span> <span className="font-bold text-slate-800 dark:text-zinc-200">587</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Usuario:</span> <span className="text-slate-700 dark:text-zinc-300">tu_correo@gmail.com</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Contraseña:</span> <span className="text-slate-700 dark:text-zinc-300">Tu clave de 16 letras</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">STARTTLS:</span> <span className="font-bold text-emerald-600">Activado</span></div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block">Otros proveedores (Outlook / Hotmail / Servidor Propio):</span>
                  <p>• <strong>Outlook/Hotmail:</strong> Host <code className="font-mono">smtp-mail.outlook.com</code>, Puerto <code className="font-mono">587</code>, STARTTLS activado.</p>
                  <p>• <strong>Servidor propio o Synology MailPlus:</strong> Introduce la IP o dominio de tu servidor y puerto 587 o 465.</p>
                </div>
              </div>
            </div>
          )}

          {/* 6. GOOGLE AUTH SSO GUIDE */}
          {activeConnector === 'google_auth' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-300 leading-relaxed flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-blue-900 dark:text-blue-200 mb-1">
                    Inicio de Sesión con Google (Google Sign-In / SSO)
                  </p>
                  <p>
                    Permite que los miembros de tu familia inicien sesión de forma instantánea y segura con su cuenta de Google ("Continuar con Google"), sin tener que recordar contraseñas ni configurar claves adicionales.
                  </p>
                </div>
              </div>

              {/* Step by Step */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">1</span>
                  <span>Accede a Google Cloud Console</span>
                </h4>
                <div className="pl-8 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
                  <p>
                    Inicia sesión con tu cuenta de Google en la consola oficial de desarrolladores:
                  </p>
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30 transition-colors"
                  >
                    <span>Abrir Google Cloud Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <p>
                    En el selector superior de proyectos, selecciona tu proyecto existente (ej. el de Google Drive o Gemini) o pulsa <strong>"Proyecto nuevo"</strong> y ponle por ejemplo <code className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">Recetario Familiar</code>.
                  </p>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pt-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">2</span>
                  <span>Pantalla de Consentimiento de OAuth</span>
                </h4>
                <div className="pl-8 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
                  <p>
                    En el menú lateral izquierdo ve a <strong>APIs y servicios</strong> &gt; <strong>Pantalla de consentimiento de OAuth</strong>:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Selecciona tipo de usuario <strong>Externo</strong> (o Interno si tienes Google Workspace familiar) y pulsa <strong>Crear</strong>.</li>
                    <li><strong>Nombre de la aplicación:</strong> <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">Recetario Familiar</code>.</li>
                    <li><strong>Correo de asistencia y de desarrollador:</strong> Tu dirección de email.</li>
                    <li>En la sección <strong>Permisos (Scopes)</strong>, pulsa <strong>Añadir o quitar permisos</strong> y activa:
                      <div className="mt-1 flex flex-wrap gap-1 font-mono text-[11px]">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-slate-800 dark:text-zinc-200">.../auth/userinfo.email</span>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-slate-800 dark:text-zinc-200">.../auth/userinfo.profile</span>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-slate-800 dark:text-zinc-200">openid</span>
                      </div>
                    </li>
                    <li>
                      En la pestaña <strong>Usuarios de prueba (Test users)</strong>: añade los correos de Google de los miembros de tu familia que accederán a la aplicación (o pasa el proyecto a estado "Publicado" para permitir cualquier cuenta).
                    </li>
                  </ul>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pt-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">3</span>
                  <span>Crear Credenciales OAuth 2.0 (Aplicación Web)</span>
                </h4>
                <div className="pl-8 text-xs text-slate-600 dark:text-zinc-400 space-y-3">
                  <p>
                    En el menú izquierdo ve a <strong>Credenciales</strong> &gt; <strong>Crear credenciales</strong> &gt; <strong>ID de cliente de OAuth</strong>:
                  </p>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Tipo de aplicación:</span>
                      <p className="text-slate-600 dark:text-zinc-400">Selecciona <strong>Aplicación web</strong> y ponle de nombre <code className="font-mono">Recetario Web Login</code>.</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block mb-1">Orígenes autorizados de JavaScript:</span>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">
                        Añade tu dominio público y los orígenes locales que uses:
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
                          <span className="font-bold text-blue-600 dark:text-blue-400">https://recetas.danesti.es</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('https://recetas.danesti.es', 'js_origin_domain')}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-sans text-xs font-semibold"
                          >
                            {copiedKey === 'js_origin_domain' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
                          <span>http://192.168.1.80:8500</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('http://192.168.1.80:8500', 'js_origin_ip')}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-sans text-xs font-semibold"
                          >
                            {copiedKey === 'js_origin_ip' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
                          <span>http://localhost:8500</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('http://localhost:8500', 'js_origin_local')}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-sans text-xs font-semibold"
                          >
                            {copiedKey === 'js_origin_local' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block mb-1">URIs de redirección autorizados:</span>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">
                        Pega aquí exactamente las URIs de callback autorizadas:
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
                          <span className="font-bold text-blue-600 dark:text-blue-400">https://recetas.danesti.es/api/auth/google/callback</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('https://recetas.danesti.es/api/auth/google/callback', 'google_cb_domain')}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-sans text-xs font-semibold"
                          >
                            {copiedKey === 'google_cb_domain' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
                          <span>http://192.168.1.80:8500/api/auth/google/callback</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('http://192.168.1.80:8500/api/auth/google/callback', 'google_cb_ip')}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-sans text-xs font-semibold"
                          >
                            {copiedKey === 'google_cb_ip' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px]">
                          <span>http://localhost:8500/api/auth/google/callback</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('http://localhost:8500/api/auth/google/callback', 'google_cb_local')}
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-sans text-xs font-semibold"
                          >
                            {copiedKey === 'google_cb_local' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pt-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">4</span>
                  <span>Guardar y Activar en el Recetario</span>
                </h4>
                <div className="pl-8 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
                  <p>
                    1. Copia el <strong>ID de cliente (Client ID)</strong> y el <strong>Secreto de cliente (Client Secret)</strong> generados por Google.
                  </p>
                  <p>
                    2. Pégalos en la tarjeta <strong>"Inicio de Sesión con Google"</strong> en la pestaña Conectores.
                  </p>
                  <p>
                    3. Marca la casilla <strong>"Activar inicio de sesión con Google"</strong>.
                  </p>
                  <p>
                    4. Pulsa <strong>"Guardar Configuración"</strong> y luego <strong>"Probar Conexión"</strong>. Inmediatamente aparecerá el botón <em>Continuar con Google</em> en la pantalla de login.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <Info className="w-3.5 h-3.5 text-sky-500" />
            <span>Todos los datos se guardan cifrados localmente en tu base de datos</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs transition-colors shadow-sm"
          >
            Entendido, volver a la configuración
          </button>
        </div>
      </div>
    </div>
  );
};
