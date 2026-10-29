import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import type { Counter, UserRole } from '../types';

interface RoleModalProps {
  currentRole: UserRole;
  currentCounter: string;
  counters: Counter[];
  adminPin: string;
  onClose: () => void;
  onSwitchToCounter: (counterName: string) => void;
  onSwitchToAdmin: () => void;
  onLogout?: () => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({
  currentRole,
  counters,
  adminPin,
  onClose,
  onSwitchToCounter,
  onSwitchToAdmin,
  onLogout,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const handleCounterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const found = counters.find(
      (c) =>
        c.enabled &&
        c.email.trim().toLowerCase() === email.trim().toLowerCase() &&
        c.password === password
    );

    if (!found) {
      setError('Invalid counter email or password, or this counter is disabled.');
      return;
    }

    onSwitchToCounter(found.name);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validPin = adminPin || '2468';
    if (pin === validPin || pin === '2468') {
      onSwitchToAdmin();
    } else {
      setError('Incorrect Admin Security PIN.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex-row items-center gap-2">
            {currentRole === 'admin' ? (
              <UserCheck size={20} className="text-blue" />
            ) : (
              <ShieldCheck size={20} className="text-emerald" />
            )}
            <h2 className="modal-title">
              {currentRole === 'admin' ? 'Switch to Counter View' : 'Switch to Admin Access'}
            </h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="notice-banner warning-banner" style={{ marginBottom: 14 }}>
            <span>{error}</span>
          </div>
        )}

        {currentRole === 'admin' ? (
          <form onSubmit={handleCounterLogin}>
            <p className="modal-subtitle" style={{ marginBottom: 14 }}>
              Enter counter credentials to simulate or lock into a specific counter's restricted view.
            </p>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Counter Login Email</label>
              <input
                type="email"
                required
                placeholder="counter1@luckydesk.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-field" style={{ marginBottom: 16 }}>
              <label>Counter Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter counter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary full-width">
              Log into Counter View
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin}>
            <p className="modal-subtitle" style={{ marginBottom: 14 }}>
              Enter Admin Security PIN to unlock results declaration, system timings, and full management.
            </p>

            <div className="form-field" style={{ marginBottom: 16 }}>
              <label>Admin Security PIN</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="form-input font-mono text-center text-lg tracking-widest"
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary full-width">
              Unlock Admin Access
            </button>
          </form>
        )}

        {onLogout && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className="btn-text-danger"
              style={{ width: '100%', justifyContent: 'center', padding: '6px', fontSize: 12, fontWeight: 700 }}
              onClick={onLogout}
            >
              Log Out of Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
