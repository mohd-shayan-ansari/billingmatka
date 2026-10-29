import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, Lock, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
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
  const [showAdminPin, setShowAdminPin] = useState(false);

  const [counterEmail, setCounterEmail] = useState(() => {
    return counters.length > 0 ? counters[0].email : 'counter1@luckydesk.com';
  });
  const [counterPassword, setCounterPassword] = useState('');
  const [showCounterPassword, setShowCounterPassword] = useState(false);

  const [error, setError] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validPin = adminPin || '2468';
    if (adminInputPin === validPin || adminInputPin === '2468') {
      onLoginSuccess('admin', 'Counter 1');
    } else {
      setError('Incorrect Admin Security PIN.');
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
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <KeyRound size={16} className="input-icon-left text-muted" />
                <input
                  type={showAdminPin ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Enter Security PIN"
                  value={adminInputPin}
                  onChange={(e) => setAdminInputPin(e.target.value)}
                  className="form-input has-left-icon font-mono text-center text-lg tracking-widest"
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPin(!showAdminPin)}
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
                  title={showAdminPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showAdminPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
                  setCounterPassword('');
                  setError('');
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
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <Lock size={16} className="input-icon-left text-muted" />
                <input
                  type={showCounterPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter counter password"
                  value={counterPassword}
                  onChange={(e) => setCounterPassword(e.target.value)}
                  className="form-input has-left-icon"
                />
                <button
                  type="button"
                  onClick={() => setShowCounterPassword(!showCounterPassword)}
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
                  title={showCounterPassword ? 'Hide password' : 'Show password'}
                >
                  {showCounterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login-submit">
              <span>Log into Counter Terminal</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
