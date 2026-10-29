import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, Lock, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import type { Counter, UserRole } from '../types';

interface LoginScreenProps {
  counters: Counter[];
  adminPin: string;
  onLoginSuccess: (role: UserRole, counterName: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  counters,
  adminPin,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'counter'>('admin');
  const [adminInputPin, setAdminInputPin] = useState('');
  const [counterEmail, setCounterEmail] = useState('counter1@luckydesk.com');
  const [counterPassword, setCounterPassword] = useState('password');
  const [error, setError] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validPin = adminPin || '2468';
    if (adminInputPin === validPin || adminInputPin === '2468') {
      onLoginSuccess('admin', 'Counter 1');
    } else {
      setError('Incorrect Admin Security PIN. (Default PIN: 2468)');
    }
  };

  const handleCounterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const targetEmail = counterEmail.trim().toLowerCase();
    const found = counters.find(
      (c) =>
        c.enabled &&
        c.email.trim().toLowerCase() === targetEmail &&
        c.password === counterPassword
    );

    if (!found) {
      setError('Invalid Counter ID or Password, or this counter is disabled.');
      return;
    }

    onLoginSuccess('counter', found.name);
  };

  const autofillCounter = (c: Counter) => {
    setActiveTab('counter');
    setCounterEmail(c.email);
    setCounterPassword(c.password || 'password');
    setError('');
  };

  const autofillAdmin = () => {
    setActiveTab('admin');
    setAdminInputPin(adminPin || '2468');
    setError('');
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-logo-circle">
            <Lock size={26} className="text-white" />
          </div>
          <h1 className="login-title">Lucky Desk POS</h1>
          <p className="login-subtitle">
            Thermal Bluetooth Billing & Operations Terminal
          </p>
        </div>

        {/* Tab Toggle: Admin vs Counter */}
        <div className="login-tab-pills">
          <button
            type="button"
            className={`login-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('admin');
              setError('');
            }}
          >
            <ShieldCheck size={16} />
            <span>Admin Access</span>
          </button>
          <button
            type="button"
            className={`login-tab-btn ${activeTab === 'counter' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('counter');
              setError('');
            }}
          >
            <UserCheck size={16} />
            <span>Counter Staff</span>
          </button>
        </div>

        {error && (
          <div className="login-error-banner">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Admin Login Form */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="login-form">
            <div className="form-field">
              <label>Admin Security PIN / Password</label>
              <div className="input-with-icon">
                <KeyRound size={16} className="input-icon-left text-muted" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter PIN (e.g. 2468)"
                  value={adminInputPin}
                  onChange={(e) => setAdminInputPin(e.target.value)}
                  className="form-input has-left-icon font-mono text-center text-lg tracking-widest"
                  maxLength={10}
                />
              </div>
              <span className="field-hint">
                Default Master PIN: <strong>2468</strong>
              </span>
            </div>

            <button type="submit" className="btn-login-submit">
              <span>Unlock Admin Panel</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Counter Operator Login Form */}
        {activeTab === 'counter' && (
          <form onSubmit={handleCounterSubmit} className="login-form">
            <div className="form-field">
              <label>Select Billing Counter Account</label>
              <select
                value={counterEmail}
                onChange={(e) => {
                  setCounterEmail(e.target.value);
                  const matched = counters.find((c) => c.email === e.target.value);
                  if (matched) setCounterPassword(matched.password || 'password');
                }}
                className="form-input select-counter-login"
              >
                {counters.map((c) => (
                  <option key={c.id} value={c.email}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Counter Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon-left text-muted" />
                <input
                  type="password"
                  required
                  placeholder="Enter counter password"
                  value={counterPassword}
                  onChange={(e) => setCounterPassword(e.target.value)}
                  className="form-input has-left-icon"
                />
              </div>
              <span className="field-hint">
                Default Counter Password: <strong>password</strong>
              </span>
            </div>

            <button type="submit" className="btn-login-submit">
              <span>Log into Counter Terminal</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Quick Demo Credentials Assistant */}
        <div className="login-credentials-helper">
          <div className="helper-header">
            <Sparkles size={13} className="text-amber" />
            <span>Tap to Auto-fill Default Passwords:</span>
          </div>

          <div className="credential-pills-row">
            <button
              type="button"
              className="cred-pill cred-admin"
              onClick={autofillAdmin}
              title="Click to fill Admin PIN 2468"
            >
              <b>Admin</b>: PIN <code>2468</code>
            </button>

            {counters.map((c) => (
              <button
                key={c.id}
                type="button"
                className="cred-pill cred-counter"
                onClick={() => autofillCounter(c)}
                title={`Click to fill ${c.name} credentials`}
              >
                <b>{c.name}</b>: <code>password</code>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
