import React, { useState, useMemo } from 'react';
import { TrendingUp, Receipt, Trophy, Clock, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import type { Bill, City, Result, Settings, UserRole } from '../types';
import { activeSlot, billingLocked, fmtTime, money, today } from '../utils/helpers';

interface OverviewPageProps {
  cities: City[];
  settings: Settings;
  bills: Bill[];
  results: Result[];
  role: UserRole;
  currentCounter: string;
  onSelectBill: (bill: Bill) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  cities,
  settings,
  bills,
  results,
  role,
  currentCounter,
  onSelectBill,
}) => {
  const [selectedCityId, setSelectedCityId] = useState<string>(cities[0]?.id || 'c0');
  const [viewType, setViewType] = useState<1 | 2>(2);

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Role filtering
  const visibleBills = useMemo(() => {
    if (role === 'admin') return bills;
    return bills.filter((b) => b.counter === currentCounter);
  }, [bills, role, currentCounter]);

  const todayBills = useMemo(() => {
    const todayStr = today();
    return visibleBills.filter((b) => b.date === todayStr);
  }, [visibleBills]);

  const todaySales = useMemo(() => todayBills.reduce((sum, b) => sum + b.amount, 0), [todayBills]);

  const visibleResults = useMemo(() => {
    if (role === 'admin') return results;
    return results
      .map((r) => {
        const counterWinners = (r.winners || []).filter((w) => w.counter === currentCounter);
        const counterPrize = counterWinners.reduce((s, w) => s + (w.prize || 0), 0);
        return {
          ...r,
          winners: counterWinners,
          totalPrize: counterPrize,
        };
      })
      .filter((r) => r.winners.length > 0);
  }, [results, role, currentCounter]);

  const todayPrizes = useMemo(() => {
    const todayStr = today();
    return visibleResults
      .filter((r) => r.date === todayStr)
      .reduce((sum, r) => sum + r.totalPrize, 0);
  }, [visibleResults]);

  const currentSlot = activeSlot(settings);
  const isLocked = billingLocked(settings);

  // Compute sold counts for the selected city and type
  const numberStats = useMemo(() => {
    const count = viewType === 2 ? 100 : 10;
    const stats: Array<{ number: string; count: number }> = [];

    const frequencyMap: Record<string, number> = {};
    todayBills.forEach((b) => {
      (b.items || []).forEach((item) => {
        if (item.cityId === selectedCityId && item.type === viewType) {
          frequencyMap[item.number] = (frequencyMap[item.number] || 0) + item.units;
        }
      });
    });

    for (let i = 0; i < count; i++) {
      const numStr = viewType === 2 ? String(i).padStart(2, '0') : String(i);
      stats.push({
        number: numStr,
        count: frequencyMap[numStr] || 0,
      });
    }

    return stats;
  }, [todayBills, selectedCityId, viewType]);

  const countsList = numberStats.map((s) => s.count);
  const maxCount = Math.max(0, ...countsList);
  const minPositive = Math.min(
    ...countsList.filter((c) => c > 0).concat([Infinity])
  );

  return (
    <div className="overview-page">
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card sales-kpi">
          <div className="kpi-header">
            <TrendingUp size={16} className="text-emerald" />
            <span className="kpi-label">Today's Sales</span>
          </div>
          <div className="kpi-value text-emerald">{money(todaySales)}</div>
          <div className="kpi-footer">{todayBills.length} bills generated</div>
        </div>

        <div className="kpi-card bills-kpi">
          <div className="kpi-header">
            <Receipt size={16} className="text-blue" />
            <span className="kpi-label">Total Bills</span>
          </div>
          <div className="kpi-value">{todayBills.length}</div>
          <div className="kpi-footer">
            {role === 'admin' ? 'Across all counters' : currentCounter}
          </div>
        </div>

        <div className="kpi-card prize-kpi">
          <div className="kpi-header">
            <Trophy size={16} className="text-amber" />
            <span className="kpi-label">Winning Prizes</span>
          </div>
          <div className="kpi-value text-amber">{money(todayPrizes)}</div>
          <div className="kpi-footer">
            {visibleResults.length} declared draws
          </div>
        </div>

        <div className="kpi-card slot-kpi">
          <div className="kpi-header">
            <Clock size={16} className="text-indigo" />
            <span className="kpi-label">Active Slot</span>
          </div>
          <div className="kpi-value text-indigo">{fmtTime(currentSlot)}</div>
          <div className="kpi-footer">
            <span className={`status-pill ${isLocked ? 'pill-locked' : 'pill-open'}`}>
              {isLocked ? 'Billing Locked' : 'Billing Open'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Number Matrix Section */}
      <div className="card matrix-card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">Live Number Volume Matrix</h2>
            <div className="card-subtitle">Real-time units booked today</div>
          </div>
          <div className="live-indicator-badge">
            <span className="dot-pulse"></span>
            <span>LIVE SYNC</span>
          </div>
        </div>

        {/* Matrix Controls */}
        <div className="matrix-toolbar">
          <div className="city-chips-compact">
            {cities.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`matrix-city-chip ${selectedCityId === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCityId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="type-toggle-mini">
            <button
              type="button"
              className={`toggle-mini-btn ${viewType === 2 ? 'active' : ''}`}
              onClick={() => setViewType(2)}
            >
              00–99
            </button>
            <button
              type="button"
              className={`toggle-mini-btn ${viewType === 1 ? 'active' : ''}`}
              onClick={() => setViewType(1)}
            >
              0–9
            </button>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className={`matrix-grid ${viewType === 1 ? 'matrix-single-grid' : ''}`}>
          {numberStats.map(({ number, count }) => {
            let heatClass = 'matrix-tile-normal';
            if (count > 0 && count === maxCount && maxCount > 1) {
              heatClass = 'matrix-tile-hot';
            } else if (count === 0 || count === minPositive) {
              heatClass = 'matrix-tile-cool';
            }

            return (
              <div key={number} className={`matrix-tile ${heatClass}`}>
                <div className="matrix-num">{number}</div>
                <div className="matrix-count">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Bills List */}
      <div className="card table-card">
        <div className="card-header-row">
          <h2 className="card-title">Recent Bills</h2>
          <span className="badge-count">{todayBills.length}</span>
        </div>

        {todayBills.length === 0 ? (
          <div className="empty-state">No bills recorded today yet.</div>
        ) : (
          <div className="mobile-table-list">
            {todayBills.slice(0, 8).map((b) => (
              <div
                key={b.receipt}
                className="mobile-table-row"
                onClick={() => onSelectBill(b)}
              >
                <div className="table-row-left">
                  <div className="row-receipt">{b.receipt}</div>
                  <div className="row-meta">
                    {b.timeLabel} · {b.counter} · {b.unitsTotal} units
                  </div>
                </div>
                <div className="table-row-right">
                  <div className="row-amount">{money(b.amount)}</div>
                  <button type="button" className="btn-view-receipt">
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest Draw Results */}
      <div className="card table-card">
        <div className="card-header-row">
          <h2 className="card-title">Latest Draw Results</h2>
          <span className="badge-count">{visibleResults.length}</span>
        </div>

        {visibleResults.length === 0 ? (
          <div className="empty-state">No results declared yet.</div>
        ) : (
          <div className="mobile-table-list">
            {visibleResults.slice(0, 6).map((r, i) => (
              <div key={r.id || `${r.date}-${r.slot}-${r.cityId}-${i}`} className="mobile-table-row">
                <div className="table-row-left">
                  <div className="row-winner-badge">
                    Winner: <b>#{r.number}</b> ({r.type === 2 ? '00-99' : '0-9'})
                  </div>
                  <div className="row-meta">
                    {fmtTime(r.slot)} · {cityMap[r.cityId] || r.cityName} · {r.winners.length} winner(s)
                  </div>
                </div>
                <div className="table-row-right">
                  <div className="row-prize">{money(r.totalPrize)}</div>
                  <div className="row-prize-sub">{money(r.prizePerUnit)}/unit</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
