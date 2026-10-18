import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UtensilsCrossed, Lock, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google OAuth state
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; client_id: string } | null>(null);
  const [isProcessingGoogle, setIsProcessingGoogle] = useState(false);

  // Check Google login config & process callback redirect params
  useEffect(() => {
    apiRequest<{ enabled: boolean; client_id: string }>('/auth/google/config')
      .then(cfg => setGoogleConfig(cfg))
      .catch(() => setGoogleConfig({ enabled: false, client_id: '' }));

    const googleToken = searchParams.get('google_token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setSearchParams({}, { replace: true });
    } else if (googleToken) {
      setIsProcessingGoogle(true);
      setError(null);
      localStorage.setItem('token', googleToken);
      apiRequest<any>('/auth/me')
        .then(userData => {
          login(googleToken, userData);
          navigate('/', { replace: true });
        })
        .catch(err => {
          localStorage.removeItem('token');
          setError(err.message || 'Error al autenticar con Google');
          setIsProcessingGoogle(false);
          setSearchParams({}, { replace: true });
        });
    }
  }, [searchParams]);

  // MFA state
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [isSetupMfa, setIsSetupMfa] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username_or_email: usernameOrEmail,
          password: password
        })
      });

      if (res.mfa_required) {
        setMfaToken(res.mfa_token);
        setTotpCode('');
        setRecoveryCodeInput('');
        setUseRecoveryCode(false);

        // ONLY initiate QR setup if this is first-time initial setup
        if (res.mfa_setup_required) {
          const setup = await apiRequest('/auth/mfa/setup', {
            method: 'POST',
            headers: { Authorization: `Bearer ${res.mfa_token}` }
          }).catch(() => null);

          if (setup && setup.qr_code_base64) {
            setIsSetupMfa(true);
            setMfaQrCode(setup.qr_code_base64);
            setRecoveryCodes(setup.recovery_codes || []);
          }
        } else {
          // Regular login: never show QR code!
          setIsSetupMfa(false);
          setMfaQrCode(null);
          setRecoveryCodes([]);
        }
      } else {
        login(res.access_token, res.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);

    try {
      const payload: any = { mfa_token: mfaToken };
      if (useRecoveryCode) {
        payload.recovery_code = recoveryCodeInput.trim();
      } else {
        payload.totp_code = totpCode.trim();
      }

      const res = await apiRequest('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      login(res.access_token, res.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Código de verificación no válido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-zinc-950 mx-auto shadow-lg shadow-amber-500/20">
            <UtensilsCrossed className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Recetario Familiar</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Inicia sesión para acceder a tu hogar</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isProcessingGoogle ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              Iniciando sesión con Google...
            </p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Validando tu cuenta familiar
            </p>
          </div>
        ) : !mfaToken ? (
          <div className="space-y-4">
            {googleConfig?.enabled ? (
              <>
                <a
                  href="/api/auth/google/login"
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-3 shadow-sm transition-all active:scale-[0.98]"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continuar con Google</span>
                </a>

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
                  <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] uppercase font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                    o con tu contraseña
                  </span>
                  <div className="border-t border-slate-200 dark:border-zinc-800 w-full" />
                </div>
              </>
            ) : (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[11px]">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google Sign-In disponible</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                  Para iniciar sesión con Google, activa el conector en <strong>Ajustes &gt; Conectores e IA</strong>.
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Usuario o Email</label>
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="admin o tu email familiar"
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Contraseña</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full mt-1 px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
              >
                {loading ? 'Comprobando...' : 'Entrar al Recetario'}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div className="text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isSetupMfa ? 'Configurar Doble Factor (2FA)' : 'Verificación Doble Factor (2FA)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {isSetupMfa
                  ? 'Escanea el código QR con tu aplicación una única vez y confirma con el código de 6 dígitos.'
                  : useRecoveryCode
                    ? 'Introduce uno de tus códigos de recuperación de 8 caracteres.'
                    : 'Introduce el código de 6 dígitos de tu aplicación de autenticación (Google Authenticator, Bitwarden, etc.)'}
              </p>
            </div>

            {/* If initial setup, show QR code */}
            {isSetupMfa && mfaQrCode && (
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center space-y-3">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                  Escanea con tu aplicación de 2FA:
                </span>
                <img src={mfaQrCode} alt="TOTP QR" className="w-36 h-36 mx-auto rounded-lg bg-white p-1" />
                {recoveryCodes.length > 0 && (
                  <div className="text-left p-2.5 bg-slate-100 dark:bg-zinc-900 rounded-lg text-[10px] text-slate-600 dark:text-zinc-400 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-zinc-200">Guarda tus códigos de recuperación:</span>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[9px] text-amber-600 dark:text-amber-300">
                      {recoveryCodes.slice(0, 4).map((c, i) => (
                        <span key={i}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!useRecoveryCode ? (
              <div>
                <input
                  type="text"
                  autoFocus
                  maxLength={8}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-3.5 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  autoFocus
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value)}
                  placeholder="Código de recuperación (ej: a1b2c3d4)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-center text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!totpCode && !recoveryCodeInput)}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Verificando...' : 'Confirmar e Iniciar Sesión'}
            </button>

            <div className="flex items-center justify-between pt-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setMfaToken(null);
                  setIsSetupMfa(false);
                  setTotpCode('');
                  setError(null);
                }}
                className="text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 underline"
              >
                ← Volver a contraseña
              </button>

              {!isSetupMfa && (
                <button
                  type="button"
                  onClick={() => setUseRecoveryCode(!useRecoveryCode)}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  {useRecoveryCode ? 'Usar código app' : 'Usar recuperación'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
