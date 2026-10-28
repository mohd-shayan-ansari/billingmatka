import React, { useState, useEffect } from 'react';
import { Bluetooth, Printer, Lock, Unlock, Clock, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import type { Settings, UserRole } from '../types';
import { fmtTime, slotCountdown } from '../utils/helpers';
import { connectBluetoothPrinter, disconnectBluetoothPrinter, subscribePrinterStatus } from '../utils/printer';

interface HeaderProps {
  role: UserRole;
  currentCounter: string;
  settings: Settings;
  onSwitchRole: () => void;
  onRefreshData?: () => void;
  isCloudConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  currentCounter,
  settings,
  onSwitchRole,
  onRefreshData,
  isCloudConnected,
}) => {
  const [nowStr, setNowStr] = useState<string>('');
  const [countdown, setCountdown] = useState(slotCountdown(settings));
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePrinterStatus((s) => {
      setBtStatus(s.status);
      setBtDeviceName(s.deviceName);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setNowStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCountdown(slotCountdown(settings));
    }, 1000);
    return () => clearInterval(timer);
  }, [settings]);

  const handleBluetoothClick = async () => {
    if (btStatus === 'connected') {
      if (confirm(`Printer is connected (${btDeviceName || 'Thermal Printer'}). Disconnect?`)) {
        disconnectBluetoothPrinter();
      }
    } else {
      await connectBluetoothPrinter();
    }
  };

  return (
    <header className="header">
      <div className="header-top">
        <div className="brand">
          <div className="brand-logo">🎟️</div>
          <div>
            <h1 className="brand-title">Lucky Desk</h1>
            <div className="brand-sub">Mobile POS & Thermal Printing</div>
          </div>
        </div>

        <div className="header-actions">
          {/* Supabase Cloud Indicator */}
          <div
            className={`badge-pill ${isCloudConnected ? 'badge-cloud' : 'badge-local'}`}
            title={isCloudConnected ? 'Connected to Supabase Cloud' : 'Running in Local Storage Mode'}
          >
            <span className={`status-dot ${isCloudConnected ? 'dot-green' : 'dot-amber'}`}></span>
            <span className="badge-text">{isCloudConnected ? 'Supabase' : 'Local'}</span>
          </div>

          {/* Bluetooth Printer Button */}
          <button
            type="button"
            className={`btn-printer-status ${btStatus === 'connected' ? 'printer-connected' : ''}`}
            onClick={handleBluetoothClick}
            title={
              btStatus === 'connected'
                ? `Connected to ${btDeviceName || 'Printer'}. Tap to disconnect.`
                : 'Tap to connect Bluetooth Thermal Printer'
            }
          >
            {btStatus === 'connecting' ? (
              <RefreshCw size={14} className="spin-icon" />
            ) : (
              <Bluetooth size={14} />
            )}
            <span className="printer-btn-label">
              {btStatus === 'connected' ? 'Printer ON' : btStatus === 'connecting' ? 'Connecting' : 'Connect BT'}
            </span>
          </button>

          {/* Role badge and switch */}
          <button type="button" className="btn-role" onClick={onSwitchRole}>
            {role === 'admin' ? (
              <>
                <ShieldCheck size={14} className="text-emerald" />
                <span>Admin</span>
              </>
            ) : (
              <>
                <UserCheck size={14} className="text-blue" />
                <span className="truncate max-w-[80px]">{currentCounter}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Slot Bar */}
      <div className="slot-bar">
        <div className="slot-clock">
          <Clock size={13} />
          <span>{nowStr || 'Live'}</span>
        </div>

        <div className="slot-info">
          <span className="slot-label">Draw:</span>
          <span className="slot-time">{fmtTime(countdown.slotTime)}</span>
        </div>

        <div className={`lock-badge ${countdown.isLocked ? 'locked' : 'open'}`}>
          {countdown.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          <span>
            {countdown.isLocked
              ? 'LOCKED'
              : `OPEN (${countdown.minsToLock}m ${countdown.secsToLock}s)`}
          </span>
        </div>

        {onRefreshData && (
          <button
            type="button"
            className="btn-icon-subtle"
            onClick={onRefreshData}
            title="Refresh cloud data"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    </header>
  );
};
