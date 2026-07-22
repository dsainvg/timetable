import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, AlertCircle, Clock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { verifyAuthPasscode } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onAuthenticated: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');

    const res = await verifyAuthPasscode(password.trim());

    if (res.success) {
      onAuthenticated();
      setPassword('');
    } else {
      setError(res.message || 'Incorrect security password.');
    }

    setIsLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(3,7,18,0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(30,27,75,0.92) 100%)',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: 24,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 30px rgba(99,102,241,0.15)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'fadeIn 0.25s ease-out',
      }}>
        {/* Glow backdrop blob */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', filter: 'blur(50px)', pointerEvents: 'none' }} />

        {/* Lock Icon Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(124,58,237,0.15))',
            border: '1px solid rgba(99,102,241,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            boxShadow: '0 0 20px rgba(99,102,241,0.2)',
          }}>
            <Lock size={28} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            <Sparkles size={12} style={{ color: '#4ade80' }} /> Protected Timetable Portal
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
            Access Verification
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Single User Security Check · Roll <strong style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>24CS10097</strong>
          </p>
        </div>

        {/* 10 Days Info Badge */}
        <div style={{
          background: 'rgba(3,7,18,0.6)',
          border: '1px solid rgba(51,65,85,0.6)',
          borderRadius: 14,
          padding: '10px 14px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 11,
          color: '#94a3b8',
        }}>
          <Clock size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
          <span>
            Authenticate once to stay logged in on this device for <strong style={{ color: '#4ade80' }}>10 days</strong>.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Security Passcode
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ color: '#475569', position: 'absolute', left: 14, top: 14, pointerEvents: 'none' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password…"
                required
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(3,7,18,0.8)',
                  border: '1px solid rgba(51,65,85,0.8)',
                  borderRadius: 12,
                  padding: '12px 42px 12px 40px',
                  color: '#f1f5f9',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(99,102,241,0.6)';
                  e.target.style.boxShadow = '0 0 12px rgba(99,102,241,0.2)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(51,65,85,0.8)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#475569',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 800,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
              border: '1px solid rgba(99,102,241,0.5)',
              color: '#ffffff',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <span style={{
                width: 16, height: 16, border: '2px solid #fff',
                borderTopColor: 'transparent', borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Verify & Unlock (10 Days)</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, color: '#334155', fontWeight: 600 }}>
          IIT Kharagpur Autumn 2026-2027 · Cloudflare D1 & Worker Secured
        </div>
      </div>
    </div>
  );
};
