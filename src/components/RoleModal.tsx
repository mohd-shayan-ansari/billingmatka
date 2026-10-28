import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, KeyRound } from 'lucide-react';
import type { Counter, UserRole } from '../types';

interface RoleModalProps {
  currentRole: UserRole;
  currentCounter: string;
  counters: Counter[];
  adminPin: string;
  onClose: () => void;
  onSwitchToCounter: (counterName: string) => void;
  onSwitchToAdmin: () => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({
  currentRole,
  currentCounter,
  counters,
  adminPin,
  onClose,
  onSwitchToCounter,
  onSwitchToAdmin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
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
    if (pin === adminPin || pin === '2468') {
      onSwitchToAdmin();
    } else {
      setError('Incorrect Admin PIN. (Default demo PIN: 2468)');
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
              <label>Password</label>
              <input
                type="password"
                required
                placeholder="Enter counter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
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
              <label>Admin PIN (Default: 2468)</label>
              <input
                type="password"
                required
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="form-input font-mono text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>

            <button type="submit" className="btn-primary full-width">
              Unlock Admin Access
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
