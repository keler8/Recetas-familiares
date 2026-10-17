import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Lock, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA state
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [isSetupMfa, setIsSetupMfa] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState('');

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
        // If first-time admin setup
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
      const res = await apiRequest('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({
          mfa_token: mfaToken,
          totp_code: totpCode
        })
      });

      login(res.access_token, res.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Código TOTP no válido');
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

        {!mfaToken ? (
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
        ) : (
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div className="text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Doble Factor (2FA / TOTP)</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Introduce el código de 6 dígitos de tu app de autenticación (Google Authenticator, Bitwarden, etc.)
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
                  <div className="text-left p-2 bg-slate-100 dark:bg-zinc-900 rounded-lg text-[10px] text-slate-600 dark:text-zinc-400 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-zinc-200">Códigos de recuperación:</span>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[9px] text-amber-600 dark:text-amber-300">
                      {recoveryCodes.slice(0, 4).map((c, i) => (
                        <span key={i}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

            <button
              type="submit"
              disabled={loading || !totpCode}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Verificando...' : 'Confirmar e Iniciar Sesión'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
