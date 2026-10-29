import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bill, City, PrinterConfig, Result, Settings, UserRole } from './types';
import {
  DEFAULT_PRINTER_CONFIG,
} from './utils/printer';
import {
  INITIAL_CITIES,
  INITIAL_SETTINGS,
  today,
} from './utils/helpers';
import {
  cloudInsertBill,
  cloudInsertResult,
  cloudSaveSettings,
  cloudUpsertCity,
  cloudUpsertCounter,
  fetchCloudData,
  getSupabase,
  initSupabaseClient,
  isSupabaseConnected,
} from './lib/supabase';

import { Navigation, type TabKey } from './components/Navigation';
import { BillingPage } from './components/BillingPage';
import { OverviewPage } from './components/OverviewPage';
import { ResultsPage } from './components/ResultsPage';
import { BillsPage } from './components/BillsPage';
import { SettingsPage } from './components/SettingsPage';
import { ReceiptModal } from './components/ReceiptModal';
import { RoleModal } from './components/RoleModal';
import { LoginScreen } from './components/LoginScreen';

const LOCAL_STORAGE_KEY = 'luckyDesk_v2_state';
const PRINTER_STORAGE_KEY = 'luckyDesk_printer_config';

export function App() {
  // Load state from localStorage fallback or initial state
  const [cities, setCities] = useState<City[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cities && parsed.cities.length) return parsed.cities;
      }
    } catch {}
    return INITIAL_CITIES;
  });

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.settings) return { ...INITIAL_SETTINGS, ...parsed.settings };
      }
    } catch {}
    return INITIAL_SETTINGS;
  });

  const [bills, setBills] = useState<Bill[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bills) return parsed.bills;
      }
    } catch {}
    return [];
  });

  const [results, setResults] = useState<Result[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.results) return parsed.results;
      }
    } catch {}
    return [];
  });

  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    try {
      const saved = localStorage.getItem(PRINTER_STORAGE_KEY);
      if (saved) return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PRINTER_CONFIG;
  });

  const [role, setRole] = useState<UserRole>(() => {
    const saved = sessionStorage.getItem('luckyDesk_role');
    return (saved as UserRole) || 'admin';
  });

  const [currentCounter, setCurrentCounter] = useState<string>(() => {
    return sessionStorage.getItem('luckyDesk_counter') || 'Counter 1';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('luckyDesk_authenticated') === 'true';
  });

  const [activeTab, setActiveTab] = useState<TabKey>('billing');
  const [modalBill, setModalBill] = useState<Bill | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [isCloudActive, setIsCloudActive] = useState<boolean>(false);

  // City map helper
  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Persist state locally
  useEffect(() => {
    const payload = { cities, settings, bills, results };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  }, [cities, settings, bills, results]);

  // Persist printer config
  const handleSavePrinterConfig = (config: PrinterConfig) => {
    setPrinterConfig(config);
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(config));
  };

  // Sync with Supabase Cloud
  const loadCloudData = useCallback(async () => {
    initSupabaseClient();
    if (!isSupabaseConnected()) {
      setIsCloudActive(false);
      return;
    }

    const cloudData = await fetchCloudData();
    if (cloudData) {
      setIsCloudActive(true);
      if (cloudData.cities.length) setCities(cloudData.cities);
      if (cloudData.settings) setSettings(cloudData.settings);
      if (cloudData.bills) setBills(cloudData.bills);
      if (cloudData.results) setResults(cloudData.results);
    } else {
      setIsCloudActive(false);
    }
  }, []);

  useEffect(() => {
    loadCloudData();

    // Setup Supabase Realtime channel if available
    const sb = getSupabase();
    if (sb) {
      const channel = sb
        .channel('luckydesk-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bills' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newB = payload.new as any;
              setBills((prev) => {
                if (prev.some((b) => b.receipt === newB.receipt)) return prev;
                const formatted: Bill = {
                  receipt: newB.receipt,
                  date: newB.date,
                  slot: newB.slot,
                  timeLabel: newB.time_label,
                  timestamp: newB.timestamp,
                  counter: newB.counter,
                  customer: newB.customer,
                  cityId: newB.city_id,
                  type: newB.type,
                  number: newB.number,
                  units: newB.units,
                  unitsTotal: newB.units_total,
                  amount: Number(newB.amount),
                  items: newB.items || [],
                };
                return [formatted, ...prev];
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'results' },
          () => {
            loadCloudData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settings' },
          () => {
            loadCloudData();
          }
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }
  }, [loadCloudData]);

  // Handlers
  const handleBillCreated = async (newBill: Bill) => {
    setBills((prev) => [newBill, ...prev]);
    // Save to cloud if connected
    if (isCloudActive) {
      await cloudInsertBill(newBill);
    }
  };

  const handleResultDeclared = async (newResult: Result) => {
    setResults((prev) => [newResult, ...prev]);
    if (isCloudActive) {
      await cloudInsertResult(newResult);
    }
  };

  const handleSaveSettings = async (updated: Settings) => {
    setSettings(updated);
    if (isCloudActive) {
      await cloudSaveSettings(updated);
    }
  };

  const handleSaveCities = async (updated: City[]) => {
    setCities(updated);
    if (isCloudActive) {
      for (const c of updated) {
        await cloudUpsertCity(c);
      }
    }
  };

  const handleSwitchToCounter = (counterName: string) => {
    setRole('counter');
    setCurrentCounter(counterName);
    sessionStorage.setItem('luckyDesk_role', 'counter');
    sessionStorage.setItem('luckyDesk_counter', counterName);
    setIsRoleModalOpen(false);
    if (activeTab === 'settings') {
      setActiveTab('billing');
    }
  };

  const handleSwitchToAdmin = () => {
    setRole('admin');
    sessionStorage.setItem('luckyDesk_role', 'admin');
    setIsRoleModalOpen(false);
  };

  const handleLoginSuccess = (newRole: UserRole, counterName: string) => {
    setRole(newRole);
    setCurrentCounter(counterName);
    setIsAuthenticated(true);
    sessionStorage.setItem('luckyDesk_authenticated', 'true');
    sessionStorage.setItem('luckyDesk_role', newRole);
    sessionStorage.setItem('luckyDesk_counter', counterName);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('luckyDesk_authenticated');
    sessionStorage.removeItem('luckyDesk_role');
    sessionStorage.removeItem('luckyDesk_counter');
    setIsRoleModalOpen(false);
  };

  const handleExportJson = () => {
    const data = {
      exportDate: new Date().toISOString(),
      cities,
      settings,
      bills,
      results,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luckydesk-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Authentication Gate: Require Login if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginScreen
        counters={settings.counters || []}
        adminPin={settings.adminPin || '2468'}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Main Tab View */}
      <main className="main-content">
        {activeTab === 'billing' && (
          <BillingPage
            cities={cities}
            settings={settings}
            bills={bills}
            role={role}
            currentCounter={currentCounter}
            printerConfig={printerConfig}
            onBillCreated={handleBillCreated}
            onOpenReceiptModal={(b) => setModalBill(b)}
            onSwitchRole={() => setIsRoleModalOpen(true)}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewPage
            cities={cities}
            settings={settings}
            bills={bills}
            results={results}
            role={role}
            currentCounter={currentCounter}
            onSelectBill={(b) => setModalBill(b)}
          />
        )}

        {activeTab === 'results' && (
          <ResultsPage
            cities={cities}
            settings={settings}
            bills={bills}
            results={results}
            role={role}
            currentCounter={currentCounter}
            onResultDeclared={handleResultDeclared}
          />
        )}

        {activeTab === 'bills' && (
          <BillsPage
            bills={bills}
            cities={cities}
            role={role}
            currentCounter={currentCounter}
            onSelectBill={(b) => setModalBill(b)}
            onExportJson={handleExportJson}
          />
        )}

        {activeTab === 'settings' && role === 'admin' && (
          <SettingsPage
            cities={cities}
            settings={settings}
            printerConfig={printerConfig}
            role={role}
            onSaveSettings={handleSaveSettings}
            onSaveCities={handleSaveCities}
            onSavePrinterConfig={handleSavePrinterConfig}
            isCloudConnected={isCloudActive}
            onSwitchRole={() => setIsRoleModalOpen(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} role={role} />

      {/* Thermal Receipt Preview Modal */}
      {modalBill && (
        <ReceiptModal
          bill={modalBill}
          onClose={() => setModalBill(null)}
          printerConfig={printerConfig}
          cityMap={cityMap}
        />
      )}

      {/* Role Switching / Counter Login Modal */}
      {isRoleModalOpen && (
        <RoleModal
          currentRole={role}
          currentCounter={currentCounter}
          counters={settings.counters || []}
          adminPin={settings.adminPin || '2468'}
          onClose={() => setIsRoleModalOpen(false)}
          onSwitchToCounter={handleSwitchToCounter}
          onSwitchToAdmin={handleSwitchToAdmin}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
