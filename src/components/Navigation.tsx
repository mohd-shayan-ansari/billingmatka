import React from 'react';
import { Ticket, BarChart3, Trophy, FileText, Settings as SettingsIcon } from 'lucide-react';
import type { UserRole } from '../types';

export type TabKey = 'billing' | 'overview' | 'results' | 'bills' | 'settings';

interface NavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  role: UserRole;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, role }) => {
  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
    { key: 'billing', label: 'Billing', icon: <Ticket size={20} /> },
    { key: 'overview', label: 'Live Data', icon: <BarChart3 size={20} /> },
    { key: 'results', label: 'Draws', icon: <Trophy size={20} /> },
    { key: 'bills', label: 'Receipts', icon: <FileText size={20} /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon size={20} />, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || role === 'admin');

  return (
    <nav className="bottom-nav">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            <div className="nav-icon-wrapper">{tab.icon}</div>
            <span className="nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
