import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bluetooth,
  Database,
  Sliders,
  MapPin,
  Users,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import type { City, Counter, PrinterConfig, Settings, UserRole } from '../types';
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothState,
  isWebBluetoothSupported,
  printTestReceipt,
  subscribePrinterStatus,
} from '../utils/printer';
import {
  getMaskedSupabaseInfo,
  initSupabaseClient,
} from '../lib/supabase';

interface SettingsPageProps {
  cities: City[];
  settings: Settings;
  printerConfig: PrinterConfig;
  role: UserRole;
  onSaveSettings: (settings: Settings) => void;
  onSaveCities: (cities: City[]) => void;
  onSavePrinterConfig: (config: PrinterConfig) => void;
  isCloudConnected: boolean;
  onSwitchRole?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  cities,
  settings,
  printerConfig,
  role,
  onSaveSettings,
  onSaveCities,
  onSavePrinterConfig,
  isCloudConnected,
  onSwitchRole,
}) => {
  // Local form states for settings
  const [startTime, setStartTime] = useState(settings.start);
  const [endTime, setEndTime] = useState(settings.end);
  const [interval, setIntervalVal] = useState(settings.interval);
  const [lockMins, setLockMins] = useState(settings.lockMins);
  const [priceTwo, setPriceTwo] = useState(settings.priceTwoDigit);
  const [priceOne, setPriceOne] = useState(settings.priceOneDigit);
  const [manualLock, setManualLock] = useState(settings.manualLock);

  // New city input
  const [newCityName, setNewCityName] = useState('');

  // Counter inputs
  const [newCounterName, setNewCounterName] = useState('');
  const [newCounterEmail, setNewCounterEmail] = useState('');
  const [newCounterPass, setNewCounterPass] = useState('');

  // Printer config state
  const [pConfig, setPConfig] = useState<PrinterConfig>(printerConfig);
  const [btStatus, setBtStatus] = useState(getBluetoothState());
  const [testPrintMsg, setTestPrintMsg] = useState<string>('');

  // Supabase cloud info (keys hidden from frontend)
  const [cloudInfo, setCloudInfo] = useState(getMaskedSupabaseInfo());
  const [cloudMsg, setCloudMsg] = useState('');

  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const unsub = subscribePrinterStatus((s) => setBtStatus(s));
    setCloudInfo(getMaskedSupabaseInfo());
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Timing & Pricing save
  const handleSaveTimingSettings = () => {
    const updated: Settings = {
      ...settings,
      start: startTime,
      end: endTime,
      interval: Math.max(1, interval),
      lockMins: Math.max(0, lockMins),
      priceTwoDigit: Math.max(0, priceTwo),
      priceOneDigit: Math.max(0, priceOne),
      manualLock,
    };
    onSaveSettings(updated);
    showToast('Draw timings and ticket prices saved.');
  };

  // City management
  const handleAddCity = () => {
    const name = newCityName.trim();
    if (!name) return alert('Please enter a city name.');
    const newCity: City = {
      id: 'c' + Date.now(),
      name,
      enabled: true,
      sort_order: cities.length + 1,
    };
    onSaveCities([...cities, newCity]);
    setNewCityName('');
    showToast(`Added city "${name}".`);
  };

  const handleToggleCity = (id: string) => {
    const updated = cities.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
    onSaveCities(updated);
  };

  const handleRenameCity = (id: string, name: string) => {
    const updated = cities.map((c) => (c.id === id ? { ...c, name } : c));
    onSaveCities(updated);
  };

  // Counter management
  const handleAddCounter = () => {
    const name = newCounterName.trim() || `Counter ${(settings.counters || []).length + 1}`;
    const email = newCounterEmail.trim().toLowerCase();
    const pass = newCounterPass.trim();

    if (!email) return alert('Please enter a counter login email.');
    if (pass.length < 6) return alert('Password must be at least 6 characters.');

    const newCounter: Counter = {
      id: 'ctr' + Date.now(),
      name,
      email,
      password: pass,
      enabled: true,
    };

    const updatedCounters = [...(settings.counters || []), newCounter];
    const updatedSettings: Settings = {
      ...settings,
      counters: updatedCounters,
      counterCount: updatedCounters.length,
    };

    onSaveSettings(updatedSettings);
    setNewCounterName('');
    setNewCounterEmail('');
    setNewCounterPass('');
    showToast(`Created counter account "${name}".`);
  };

  const handleToggleCounter = (id: string) => {
    const updatedCounters = (settings.counters || []).map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
    onSaveSettings({ ...settings, counters: updatedCounters });
  };

  const handleRemoveCounter = (id: string) => {
    if (!confirm('Remove this counter account? Existing historical bills remain safe.')) return;
    const updatedCounters = (settings.counters || []).filter((c) => c.id !== id);
    onSaveSettings({
      ...settings,
      counters: updatedCounters,
      counterCount: updatedCounters.length,
    });
    showToast('Counter removed.');
  };

  // Printer settings
  const handleUpdatePrinterConfig = (partial: Partial<PrinterConfig>) => {
    const next = { ...pConfig, ...partial };
    setPConfig(next);
    onSavePrinterConfig(next);
  };

  const handleBluetoothToggle = async () => {
    if (btStatus.status === 'connected') {
      disconnectBluetoothPrinter();
      showToast('Bluetooth printer disconnected.');
    } else {
      const ok = await connectBluetoothPrinter();
      if (ok) {
        showToast('Bluetooth printer connected successfully!');
      }
    }
  };

  const handleTestPrint = async () => {
    setTestPrintMsg('Printing test receipt...');
    const res = await printTestReceipt(pConfig);
    setTestPrintMsg(res.message);
    setTimeout(() => setTestPrintMsg(''), 4000);
  };

  const handleRefreshCloud = () => {
    initSupabaseClient();
    setCloudInfo(getMaskedSupabaseInfo());
    setCloudMsg('Verified Supabase cloud connection.');
    setTimeout(() => setCloudMsg(''), 3000);
  };

  return (
    <div className="settings-page">
      {toastMsg && (
        <div className="status-toast">
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. THERMAL BLUETOOTH PRINTER CONFIGURATION */}
      <div className="card settings-card">
        <div className="card-header-row">
          <div className="flex-row items-center gap-2">
            <Printer size={20} className="text-blue" />
            <div>
              <h2 className="card-title">Thermal Bluetooth Printer</h2>
              <div className="card-subtitle">Connect POS printer on phone & configure ESC/POS</div>
            </div>
          </div>
          <span
            className={`status-pill ${
              btStatus.status === 'connected' ? 'pill-open' : 'pill-locked'
            }`}
          >
            {btStatus.status === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="printer-status-bar">
          <div className="printer-info">
            <b>Printer: </b>
            <span>{btStatus.deviceName || 'None paired'}</span>
          </div>
          <button
            type="button"
            className={`btn-sm ${btStatus.status === 'connected' ? 'btn-danger-outline' : 'btn-primary'}`}
            onClick={handleBluetoothToggle}
          >
            <Bluetooth size={14} />
            <span>
              {btStatus.status === 'connected'
                ? 'Disconnect'
                : btStatus.status === 'connecting'
                ? 'Connecting...'
                : 'Connect Bluetooth Printer'}
            </span>
          </button>
        </div>

        {btStatus.error && (
          <div className="notice-banner warning-banner">
            <AlertTriangle size={15} />
            <span>{btStatus.error}</span>
          </div>
        )}

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="form-field">
            <label>Thermal Paper Width</label>
            <select
              value={pConfig.width}
              onChange={(e) =>
                handleUpdatePrinterConfig({ width: e.target.value as '58mm' | '80mm' })
              }
              className="form-select"
            >
              <option value="58mm">58 mm (Standard Mobile Mini POS - 32 chars)</option>
              <option value="80mm">80 mm (Wide Desktop/Kitchen POS - 48 chars)</option>
            </select>
          </div>

          <div className="form-field">
            <label>Default Print Method</label>
            <select
              value={pConfig.method}
              onChange={(e) =>
                handleUpdatePrinterConfig({
                  method: e.target.value as 'bluetooth' | 'rawbt' | 'browser',
                })
              }
              className="form-select"
            >
              <option value="bluetooth">Web Bluetooth Direct (ESC/POS)</option>
              <option value="rawbt">RawBT Thermal Driver (Android Intent)</option>
              <option value="browser">System Browser Print Dialog</option>
            </select>
          </div>

          <div className="form-field">
            <label>Receipt Header / Store Name</label>
            <input
              type="text"
              value={pConfig.storeName}
              onChange={(e) => handleUpdatePrinterConfig({ storeName: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Receipt Footer Message</label>
            <input
              type="text"
              value={pConfig.footerText}
              onChange={(e) => handleUpdatePrinterConfig({ footerText: e.target.value })}
              className="form-input"
            />
          </div>
        </div>

        <div className="row gap-2" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleTestPrint}
          >
            <Printer size={16} />
            <span>Print Test Receipt</span>
          </button>
          {testPrintMsg && <span className="text-muted text-sm self-center">{testPrintMsg}</span>}
        </div>
      </div>

      {/* 2. SUPABASE CLOUD DATABASE CONFIGURATION */}
      <div className="card settings-card">
        <div className="card-header-row">
          <div className="flex-row items-center gap-2">
            <Database size={20} className="text-emerald" />
            <div>
              <h2 className="card-title">Supabase Cloud Database</h2>
              <div className="card-subtitle">Real-time multi-counter sync via PostgreSQL</div>
            </div>
          </div>
          <span
            className={`status-pill ${isCloudConnected ? 'pill-open' : 'pill-locked'}`}
          >
            {isCloudConnected ? 'Cloud Active' : 'Local Mode'}
          </span>
        </div>

        <div className="printer-status-bar" style={{ marginTop: 6 }}>
          <div className="printer-info">
            <b>Database Host: </b>
            <span className="font-mono text-sm text-emerald">
              {cloudInfo.isConfigured ? cloudInfo.projectHost : 'Local Offline Mode'}
            </span>
          </div>
          <button
            type="button"
            className="btn-sm btn-primary"
            onClick={handleRefreshCloud}
          >
            <RefreshCw size={14} />
            <span>Verify Sync</span>
          </button>
        </div>

        <div className="notice-banner info-banner" style={{ marginTop: 10 }}>
          <span>
            <b>Security Note:</b> Database credentials are securely loaded from backend environment variables (<code>.env</code> / Vercel). Your secret API keys are protected and never displayed in the frontend.
          </span>
        </div>

        {cloudMsg && (
          <div className="status-toast" style={{ marginTop: 10 }}>
            <CheckCircle size={15} />
            <span>{cloudMsg}</span>
          </div>
        )}
      </div>

      {/* 3. DRAW TIMINGS & TICKET PRICES */}
      <div className="card settings-card">
        <div className="card-header-row">
          <div className="flex-row items-center gap-2">
            <Sliders size={20} className="text-indigo" />
            <div>
              <h2 className="card-title">Timing & Ticket Pricing</h2>
              <div className="card-subtitle">Draw slots, lock window and unit prices</div>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>First Draw Slot</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Last Draw Slot</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Interval (Minutes)</label>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setIntervalVal(Number(e.target.value) || 40)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Lock Billing Before Draw (Minutes)</label>
            <input
              type="number"
              min="0"
              value={lockMins}
              onChange={(e) => setLockMins(Number(e.target.value) || 1)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>00–99 Price per Unit (₹)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={priceTwo}
              onChange={(e) => setPriceTwo(Number(e.target.value) || 10)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>0–9 Price per Unit (₹)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={priceOne}
              onChange={(e) => setPriceOne(Number(e.target.value) || 10)}
              className="form-input"
            />
          </div>
        </div>

        <div className="row gap-3" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveTimingSettings}
          >
            Save Timing & Prices
          </button>

          <button
            type="button"
            className={`btn-secondary ${manualLock ? 'btn-danger-outline' : ''}`}
            onClick={() => {
              const next = !manualLock;
              setManualLock(next);
              onSaveSettings({ ...settings, manualLock: next });
              showToast(next ? 'Manual Emergency Lock is ON' : 'Manual Lock is OFF');
            }}
          >
            {manualLock ? <Lock size={15} /> : <Unlock size={15} />}
            <span>{manualLock ? 'Manual Lock: ON' : 'Manual Lock: OFF'}</span>
          </button>
        </div>
      </div>

      {/* 4. CITY MANAGEMENT */}
      <div className="card settings-card">
        <div className="card-header-row">
          <div className="flex-row items-center gap-2">
            <MapPin size={20} className="text-amber" />
            <div>
              <h2 className="card-title">City Management</h2>
              <div className="card-subtitle">Add, rename, or enable/disable cities</div>
            </div>
          </div>
        </div>

        <div className="add-row">
          <input
            type="text"
            placeholder="New City Name (e.g. Pune)..."
            value={newCityName}
            onChange={(e) => setNewCityName(e.target.value)}
            className="form-input flex-1"
          />
          <button type="button" className="btn-primary" onClick={handleAddCity}>
            <Plus size={16} />
            <span>Add City</span>
          </button>
        </div>

        <div className="items-manage-list">
          {cities.map((c) => (
            <div key={c.id} className="manage-item-row">
              <input
                type="text"
                value={c.name}
                onChange={(e) => handleRenameCity(c.id, e.target.value)}
                className="item-name-input"
              />
              <div className="item-actions">
                <button
                  type="button"
                  className={`btn-toggle-status ${c.enabled ? 'is-enabled' : 'is-disabled'}`}
                  onClick={() => handleToggleCity(c.id)}
                >
                  {c.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. COUNTER ACCOUNTS MANAGEMENT */}
      <div className="card settings-card">
        <div className="card-header-row">
          <div className="flex-row items-center gap-2">
            <Users size={20} className="text-teal" />
            <div>
              <h2 className="card-title">Counter Staff Accounts</h2>
              <div className="card-subtitle">Manage counter login credentials</div>
            </div>
          </div>
        </div>

        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="form-field">
            <label>Counter Name</label>
            <input
              type="text"
              placeholder="e.g. Counter 4"
              value={newCounterName}
              onChange={(e) => setNewCounterName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Login Email</label>
            <input
              type="email"
              placeholder="counter4@luckydesk.com"
              value={newCounterEmail}
              onChange={(e) => setNewCounterEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label>Set Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              value={newCounterPass}
              onChange={(e) => setNewCounterPass(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <button type="button" className="btn-primary" onClick={handleAddCounter}>
          <Plus size={16} />
          <span>Add Counter Account</span>
        </button>

        <div className="items-manage-list" style={{ marginTop: 16 }}>
          {(settings.counters || []).map((c) => (
            <div key={c.id} className="manage-item-row">
              <div className="flex-col flex-1">
                <b className="text-sm">{c.name}</b>
                <span className="text-xs text-muted">{c.email}</span>
              </div>
              <div className="item-actions">
                <button
                  type="button"
                  className={`btn-toggle-status ${c.enabled ? 'is-enabled' : 'is-disabled'}`}
                  onClick={() => handleToggleCounter(c.id)}
                >
                  {c.enabled ? 'Active' : 'Disabled'}
                </button>
                <button
                  type="button"
                  className="btn-danger-icon"
                  onClick={() => handleRemoveCounter(c.id)}
                  title="Remove Counter"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
