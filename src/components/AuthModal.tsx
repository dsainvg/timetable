import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { AUTH_PASSWORD_DEFAULT, saveAuthSession } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onAuthenticated: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      // Check password (allows default '24cs10097' or custom set password)
      const storedPass = localStorage.getItem('iitkgp_timetable_custom_pass') || AUTH_PASSWORD_DEFAULT;

      if (password.trim() === storedPass || password.trim() === AUTH_PASSWORD_DEFAULT) {
        saveAuthSession();
        onAuthenticated();
        setPassword('');
      } else {
        setError('Incorrect security password. Default is: 24cs10097');
      }
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container max-w-md w-full animate-fade-in border border-indigo-500/30">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-glow">
            <Lock className="w-8 h-8" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-100 font-outfit mb-1">
          Access Verification
        </h2>
        <p className="text-sm text-slate-400 text-center mb-6">
          Single User Timetable Portal for Roll <span className="text-indigo-400 font-mono">24CS10097</span>
        </p>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 mb-6 flex items-center gap-3 text-xs text-slate-300">
          <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            Your session will be saved in your browser local storage and won't prompt again for <strong className="text-emerald-400">10 days</strong>.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Enter Passcode
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Default: 24cs10097"
                required
                className="w-full bg-slate-950/80 border border-slate-700 focus:border-indigo-500 rounded-xl py-3 px-4 pl-11 text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
              />
              <KeyRound className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Unlock Portal (10 Days)</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500 mt-6">
          IIT Kharagpur Autumn 2026-2027 • Cloudflare D1 Secured
        </p>
      </div>
    </div>
  );
};
