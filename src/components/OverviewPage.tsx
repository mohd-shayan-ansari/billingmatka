import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Trophy,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Users,
  Eye,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Flame,
  Radio,
  ArrowRight,
} from 'lucide-react';
import type { Bill, City, Result, Settings, UserRole } from '../types';
import {
  activeSlot,
  billingLocked,
  fmtTime,
  money,
  today,
  timeSlots,
  getCityColorTheme,
} from '../utils/helpers';

interface OverviewPageProps {
  cities: City[];
  settings: Settings;
  bills: Bill[];
  results: Result[];
  role: UserRole;
  currentCounter: string;
  onSelectBill: (bill: Bill) => void;
}

function shiftDateString(dateStr: string, days: number): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return (
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0')
    );
  } catch {
    return dateStr;
  }
}

function formatDateDisplay(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today';
  const yesterday = shiftDateString(todayStr, -1);
  if (dateStr === yesterday) return 'Yesterday';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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
  // Real-time clock ticker updating every second
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => today(), [now]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Scope bills by user role: Counter staff can ONLY see sales & receipts from their own counter
  const scopedBills = useMemo(() => {
    if (role === 'admin') return bills;
    return bills.filter(
      (b) => b.counter?.trim().toLowerCase() === currentCounter?.trim().toLowerCase()
    );
  }, [bills, role, currentCounter]);

  // Master list of visible counters: For counter role, only their own counter is listed
  const countersList = useMemo(() => {
    if (role === 'counter') return [currentCounter];
    const set = new Set<string>();
    (settings.counters || []).forEach((c) => set.add(c.name));
    bills.forEach((b) => {
      if (b.counter) set.add(b.counter);
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['Counter 1', 'Counter 2', 'Counter 3'];
  }, [settings.counters, bills, role, currentCounter]);

  // Slots for the settings
  const allSlots = useMemo(() => timeSlots(settings), [settings]);
  const liveSlot = useMemo(() => activeSlot(settings), [settings, now]);
  const isLocked = useMemo(() => billingLocked(settings), [settings, now]);

  // Selected time slot (defaults to live slot)
  const [selectedSlot, setSelectedSlot] = useState<string>(liveSlot || allSlots[0] || '19:00');
  const [isFollowingLiveSlot, setIsFollowingLiveSlot] = useState<boolean>(true);

  // Keep synced with live slot if user is following live slot on today's date
  useEffect(() => {
    if (selectedDate === todayStr && isFollowingLiveSlot && liveSlot) {
      setSelectedSlot(liveSlot);
    }
  }, [liveSlot, selectedDate, todayStr, isFollowingLiveSlot]);

  // Countdown timer to active slot
  const slotCountdownStr = useMemo(() => {
    if (!liveSlot || isLocked) return '';
    try {
      const [slotH, slotM] = liveSlot.split(':').map(Number);
      const slotTimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotH, slotM, 0).getTime();
      const diffMs = slotTimeMs - now.getTime();
      if (diffMs <= 0) return 'Closing';
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    } catch {
      return '';
    }
  }, [liveSlot, isLocked, now]);

  // Bills filtered by selectedDate from scopedBills
  const dateBills = useMemo(() => {
    return scopedBills.filter((b) => b.date === selectedDate);
  }, [scopedBills, selectedDate]);

  // Bills filtered by selectedSlot
  const slotBills = useMemo(() => {
    return dateBills.filter((b) => b.slot === selectedSlot);
  }, [dateBills, selectedSlot]);

  // Stats for the selected slot per counter
  const slotStats = useMemo(() => {
    const totalSlotSales = slotBills.reduce((s, b) => s + b.amount, 0);
    const totalSlotUnits = slotBills.reduce((s, b) => s + (b.unitsTotal || b.units || 0), 0);

    const counterBreakdown = countersList.map((cName) => {
      const cBills = slotBills.filter((b) => b.counter === cName);
      const sales = cBills.reduce((s, b) => s + b.amount, 0);
      const units = cBills.reduce((s, b) => s + (b.unitsTotal || b.units || 0), 0);
      const billsCount = cBills.length;
      const sharePct = totalSlotSales > 0 ? (sales / totalSlotSales) * 100 : 0;
      return {
        counter: cName,
        sales,
        units,
        billsCount,
        sharePct,
        avgTicket: billsCount > 0 ? sales / billsCount : 0,
      };
    });

    return {
      totalSales: totalSlotSales,
      totalUnits: totalSlotUnits,
      totalBills: slotBills.length,
      counters: counterBreakdown,
    };
  }, [slotBills, countersList]);

  // Full day slot-by-slot table data
  const fullDaySlotData = useMemo(() => {
    return allSlots.map((slot) => {
      const sBills = dateBills.filter((b) => b.slot === slot);
      const slotTotal = sBills.reduce((s, b) => s + b.amount, 0);
      const slotUnits = sBills.reduce((s, b) => s + (b.unitsTotal || b.units || 0), 0);
      const billsCount = sBills.length;

      const perCounter: Record<string, number> = {};
      countersList.forEach((c) => {
        perCounter[c] = sBills
          .filter((b) => b.counter === c)
          .reduce((sum, b) => sum + b.amount, 0);
      });

      let status: 'live' | 'completed' | 'upcoming' = 'completed';
      if (selectedDate === todayStr) {
        if (slot === liveSlot) {
          status = 'live';
        } else {
          const [sh, sm] = slot.split(':').map(Number);
          const [lh, lm] = (liveSlot || '00:00').split(':').map(Number);
          if (sh * 60 + sm > lh * 60 + lm) {
            status = 'upcoming';
          }
        }
      } else if (selectedDate > todayStr) {
        status = 'upcoming';
      }

      return {
        slot,
        slotTotal,
        slotUnits,
        billsCount,
        perCounter,
        status,
      };
    });
  }, [allSlots, dateBills, countersList, selectedDate, todayStr, liveSlot]);

  // Daily totals across all counters
  const dailyTotals = useMemo(() => {
    const totalSales = dateBills.reduce((s, b) => s + b.amount, 0);
    const totalUnits = dateBills.reduce((s, b) => s + (b.unitsTotal || b.units || 0), 0);
    const totalBills = dateBills.length;

    const perCounterTotals: Record<string, number> = {};
    countersList.forEach((c) => {
      perCounterTotals[c] = dateBills
        .filter((b) => b.counter === c)
        .reduce((sum, b) => sum + b.amount, 0);
    });

    return {
      totalSales,
      totalUnits,
      totalBills,
      perCounterTotals,
    };
  }, [dateBills, countersList]);

  // Results declared for selected slot (scoped to current counter winners if counter role)
  const slotDeclaredResult = useMemo(() => {
    const res = results.find((r) => r.date === selectedDate && r.slot === selectedSlot);
    if (!res) return null;
    if (role === 'admin') return res;
    const myWinners = (res.winners || []).filter(
      (w) => w.counter?.trim().toLowerCase() === currentCounter?.trim().toLowerCase()
    );
    return {
      ...res,
      winners: myWinners,
      totalPrize: myWinners.reduce((sum, w) => sum + (w.prize || 0), 0),
    };
  }, [results, selectedDate, selectedSlot, role, currentCounter]);

  // Day total prize payouts (scoped to counter tickets if counter role)
  const dayPrizes = useMemo(() => {
    return results
      .filter((r) => r.date === selectedDate)
      .reduce((sum, r) => {
        if (role === 'admin') return sum + (r.totalPrize || 0);
        const myWinners = (r.winners || []).filter(
          (w) => w.counter?.trim().toLowerCase() === currentCounter?.trim().toLowerCase()
        );
        return sum + myWinners.reduce((wSum, w) => wSum + (w.prize || 0), 0);
      }, 0);
  }, [results, selectedDate, role, currentCounter]);

  // Matrix view controls (This slot vs All day)
  const [matrixScope, setMatrixScope] = useState<'slot' | 'day'>('slot');
  const [selectedCityId, setSelectedCityId] = useState<string>(cities[0]?.id || 'c0');
  const [viewType, setViewType] = useState<1 | 2>(2);

  // Compute sold counts for the matrix
  const matrixBills = matrixScope === 'slot' ? slotBills : dateBills;
  const numberStats = useMemo(() => {
    const count = viewType === 2 ? 100 : 10;
    const stats: Array<{ number: string; count: number }> = [];
    const frequencyMap: Record<string, number> = {};

    matrixBills.forEach((b) => {
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
  }, [matrixBills, selectedCityId, viewType]);

  const countsList = numberStats.map((s) => s.count);
  const maxCount = Math.max(0, ...countsList);

  // Date navigation handlers
  const handlePrevDay = () => {
    const prev = shiftDateString(selectedDate, -1);
    setSelectedDate(prev);
    setIsFollowingLiveSlot(false);
  };

  const handleNextDay = () => {
    if (selectedDate >= todayStr) return;
    const next = shiftDateString(selectedDate, 1);
    setSelectedDate(next);
    if (next === todayStr) setIsFollowingLiveSlot(true);
  };

  const handleJumpToToday = () => {
    setSelectedDate(todayStr);
    setSelectedSlot(liveSlot);
    setIsFollowingLiveSlot(true);
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    if (selectedDate === todayStr && slot === liveSlot) {
      setIsFollowingLiveSlot(true);
    } else {
      setIsFollowingLiveSlot(false);
    }
  };

  const handlePrevSlot = () => {
    const curIdx = allSlots.indexOf(selectedSlot);
    if (curIdx > 0) {
      handleSelectSlot(allSlots[curIdx - 1]);
    }
  };

  const handleNextSlot = () => {
    const curIdx = allSlots.indexOf(selectedSlot);
    if (curIdx >= 0 && curIdx < allSlots.length - 1) {
      handleSelectSlot(allSlots[curIdx + 1]);
    }
  };

  const isCurrentLiveSlot = selectedDate === todayStr && selectedSlot === liveSlot;

  return (
    <div className="overview-page">
      {/* 1. Real-time Live Status Bar */}
      <div className="live-telemetry-header">
        <div className="telemetry-left">
          <div className="live-indicator-badge">
            <span className="dot-pulse"></span>
            <span className="pulse-text">LIVE SYNC</span>
          </div>
          <span className="telemetry-clock">
            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
          {isCurrentLiveSlot && (
            <span className="telemetry-slot-status">
              {isLocked ? (
                <span className="badge-locked">LOCKED FOR DRAW</span>
              ) : (
                <span className="badge-open">OPEN ({slotCountdownStr || 'Active'})</span>
              )}
            </span>
          )}
        </div>

        <div className="telemetry-right">
          {(!isCurrentLiveSlot || selectedDate !== todayStr) && (
            <button
              type="button"
              className="btn-jump-live"
              onClick={handleJumpToToday}
              title="Return to Live Current Slot"
            >
              <Radio size={12} className="text-red-500 animate-pulse" />
              <span>Jump to Live Slot</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Date Navigation Bar */}
      <div className="date-navigator-card">
        <button
          type="button"
          className="date-nav-btn"
          onClick={handlePrevDay}
          title="Go to Previous Day"
        >
          <ChevronLeft size={16} />
          <span>Prev Day</span>
        </button>

        <div className="date-display-center">
          <Calendar size={15} className="text-blue" />
          <span className="date-label">
            <b>{formatDateDisplay(selectedDate, todayStr)}</b>
            <span className="date-iso-sub">({selectedDate})</span>
          </span>
          <input
            type="date"
            max={todayStr}
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(e.target.value);
                if (e.target.value === todayStr) setIsFollowingLiveSlot(true);
                else setIsFollowingLiveSlot(false);
              }
            }}
            className="hidden-date-picker"
            title="Pick a specific date"
          />
        </div>

        <button
          type="button"
          className="date-nav-btn"
          disabled={selectedDate >= todayStr}
          onClick={handleNextDay}
          title="Go to Next Day"
        >
          <span>Next Day</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 3. Time Slot Navigator */}
      <div className="slot-navigator-card">
        <div className="slot-nav-header">
          <div className="flex-row items-center gap-2">
            <Clock size={16} className="text-indigo" />
            <span className="slot-nav-title">Time Slots on {formatDateDisplay(selectedDate, todayStr)}</span>
          </div>
          <div className="slot-stepper-btns">
            <button
              type="button"
              className="btn-slot-step"
              disabled={allSlots.indexOf(selectedSlot) <= 0}
              onClick={handlePrevSlot}
              title="Previous time slot"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="slot-stepper-label">
              {allSlots.indexOf(selectedSlot) + 1} of {allSlots.length}
            </span>
            <button
              type="button"
              className="btn-slot-step"
              disabled={allSlots.indexOf(selectedSlot) >= allSlots.length - 1}
              onClick={handleNextSlot}
              title="Next time slot"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable Slots Row */}
        <div className="slots-scroll-track">
          {allSlots.map((slot) => {
            const isSelected = slot === selectedSlot;
            const isLive = selectedDate === todayStr && slot === liveSlot;
            const slotData = fullDaySlotData.find((d) => d.slot === slot);
            const slotAmt = slotData ? slotData.slotTotal : 0;

            return (
              <button
                key={slot}
                type="button"
                className={`slot-chip-btn ${isSelected ? 'active' : ''} ${isLive ? 'is-live' : ''}`}
                onClick={() => handleSelectSlot(slot)}
              >
                <div className="slot-chip-top">
                  <span className="slot-chip-time">{fmtTime(slot)}</span>
                  {isLive && <span className="chip-live-badge">LIVE</span>}
                </div>
                <div className="slot-chip-amount">
                  {slotAmt > 0 ? money(slotAmt) : '₹0'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. HERO SECTION: Per-Counter Sales for Selected Time Slot */}
      <div className="card slot-spotlight-card">
        <div className="slot-spotlight-header">
          <div>
            <div className="spotlight-badge">
              <BarChart3 size={14} />
              <span>{role === 'counter' ? `YOUR SALES PERFORMANCE (${currentCounter})` : 'PER-COUNTER SALE BREAKDOWN'}</span>
            </div>
            <h2 className="spotlight-title">
              Draw Slot: <b>{fmtTime(selectedSlot)}</b>
            </h2>
            <div className="spotlight-date-sub">
              {formatDateDisplay(selectedDate, todayStr)} ({selectedDate})
              {isCurrentLiveSlot && <span className="spotlight-live-tag">● Currently Active Slot</span>}
            </div>
          </div>

          <div className="spotlight-metrics-total">
            <span className="total-label">{role === 'counter' ? 'Your Slot Revenue' : 'Slot Revenue'}</span>
            <b className="total-val">{money(slotStats.totalSales)}</b>
            <span className="total-sub">
              {slotStats.totalBills} bills · {slotStats.totalUnits} units
            </span>
          </div>
        </div>

        {/* Per-Counter Cards Grid */}
        <div className="counters-breakdown-grid">
          {slotStats.counters.map((c) => {
            const isTopSeller = slotStats.totalSales > 0 && c.sharePct >= 50;
            return (
              <div
                key={c.counter}
                className={`counter-perf-card ${isTopSeller ? 'top-seller' : ''}`}
              >
                <div className="counter-card-head">
                  <div className="counter-identity">
                    <div className="counter-icon-box">
                      <Users size={14} />
                    </div>
                    <b className="counter-name">{c.counter}</b>
                  </div>
                  {role === 'admin' && (
                    <span className="counter-share-pill">
                      {c.sharePct.toFixed(1)}% Share
                    </span>
                  )}
                </div>

                <div className="counter-amount-hero">
                  {money(c.sales)}
                </div>

                {/* Visual Share Bar */}
                {role === 'admin' && (
                  <div className="counter-progress-track">
                    <div
                      className="counter-progress-fill"
                      style={{ width: `${Math.max(2, c.sharePct)}%` }}
                    />
                  </div>
                )}

                <div className="counter-stats-footer">
                  <span>{c.billsCount} bills</span>
                  <span className="dot-divider">•</span>
                  <span>{c.units} units</span>
                  <span className="dot-divider">•</span>
                  <span>Avg {money(c.avgTicket)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {slotStats.totalBills === 0 && (
          <div className="empty-slot-state">
            <AlertCircle size={18} className="text-muted" />
            <span>
              {role === 'counter'
                ? `No sales recorded by ${currentCounter} for slot ${fmtTime(selectedSlot)} on this date.`
                : `No sales recorded yet for slot ${fmtTime(selectedSlot)} on this date.`}
            </span>
          </div>
        )}

        {/* Result & Winner info for this slot if declared */}
        {slotDeclaredResult && (
          <div className="slot-result-banner">
            <div className="flex-row items-center gap-2">
              <Trophy size={18} className="text-amber" />
              <div>
                <b className="text-amber">
                  Declared Winner: #{slotDeclaredResult.number} ({slotDeclaredResult.type === 2 ? '00–99' : '0–9'})
                </b>
                <div className="text-xs text-muted">
                  City: {cityMap[slotDeclaredResult.cityId] || slotDeclaredResult.cityName} ·{' '}
                  {role === 'counter' ? 'Your Customer Prizes: ' : 'Total Prizes: '}
                  <b>{money(slotDeclaredResult.totalPrize)}</b>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted">{role === 'counter' ? 'Your Net Balance:' : 'Net Slot Margin:'}</span>
              <b
                className={`block text-sm ${
                  slotStats.totalSales - slotDeclaredResult.totalPrize >= 0 ? 'text-emerald' : 'text-rose'
                }`}
              >
                {money(slotStats.totalSales - slotDeclaredResult.totalPrize)}
              </b>
            </div>
          </div>
        )}
      </div>

      {/* 5. Comprehensive Full-Day Slot Summary Table */}
      <div className="card slot-table-card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">
              {role === 'counter' ? `Slot Sales Summary for ${currentCounter}` : 'Full Day Slot vs Counter Matrix'}
            </h2>
            <div className="card-subtitle">
              {role === 'counter'
                ? `Your sales and ticket volume across each draw slot`
                : 'Click any time slot row to inspect its live counter breakdown'}
            </div>
          </div>
          <span className="badge-count">{allSlots.length} Slots</span>
        </div>

        <div className="table-responsive-container">
          <table className="slot-matrix-table">
            <thead>
              <tr>
                <th>Time Slot</th>
                {role === 'admin' ? (
                  <>
                    {countersList.map((c) => (
                      <th key={c} className="text-right">{c}</th>
                    ))}
                    <th className="text-right">Total Slot</th>
                  </>
                ) : (
                  <>
                    <th className="text-right">Your Sales ({currentCounter})</th>
                    <th className="text-right">Your Units</th>
                  </>
                )}
                <th className="text-center">Bills</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {fullDaySlotData.map((row) => {
                const isSelected = row.slot === selectedSlot;
                const isLive = row.status === 'live';

                return (
                  <tr
                    key={row.slot}
                    className={`slot-row ${isSelected ? 'row-selected' : ''} ${isLive ? 'row-live' : ''}`}
                    onClick={() => handleSelectSlot(row.slot)}
                    title="Click to view details for this slot"
                  >
                    <td className="cell-slot-time">
                      <div className="slot-time-flex">
                        <b>{fmtTime(row.slot)}</b>
                        {isLive && <span className="live-dot-mini" />}
                      </div>
                    </td>
                    {role === 'admin' ? (
                      <>
                        {countersList.map((c) => {
                          const amt = row.perCounter[c] || 0;
                          return (
                            <td key={c} className="text-right cell-counter-val">
                              {amt > 0 ? money(amt) : <span className="text-muted">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-right cell-total-amt">
                          <b>{row.slotTotal > 0 ? money(row.slotTotal) : '—'}</b>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-right cell-total-amt font-bold text-emerald">
                          {row.slotTotal > 0 ? money(row.slotTotal) : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-right cell-counter-val">
                          {row.slotUnits > 0 ? row.slotUnits : <span className="text-muted">—</span>}
                        </td>
                      </>
                    )}
                    <td className="text-center cell-bills-count">
                      {row.billsCount > 0 ? row.billsCount : '—'}
                    </td>
                    <td className="text-center">
                      <span className={`slot-status-pill status-${row.status}`}>
                        {row.status === 'live' ? 'LIVE' : row.status === 'completed' ? 'Done' : 'Upcoming'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="table-total-row">
                <td><b>Grand Total</b></td>
                {role === 'admin' ? (
                  <>
                    {countersList.map((c) => (
                      <td key={c} className="text-right font-bold">
                        {money(dailyTotals.perCounterTotals[c] || 0)}
                      </td>
                    ))}
                    <td className="text-right font-bold text-emerald">
                      {money(dailyTotals.totalSales)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="text-right font-bold text-emerald">
                      {money(dailyTotals.totalSales)}
                    </td>
                    <td className="text-right font-bold">
                      {dailyTotals.totalUnits}
                    </td>
                  </>
                )}
                <td className="text-center font-bold">
                  {dailyTotals.totalBills}
                </td>
                <td className="text-center font-bold text-xs text-muted">
                  Daily
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 6. Daily KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card sales-kpi">
          <div className="kpi-header">
            <TrendingUp size={16} className="text-emerald" />
            <span className="kpi-label">
              {role === 'counter'
                ? `Your ${formatDateDisplay(selectedDate, todayStr)} Sales`
                : `${formatDateDisplay(selectedDate, todayStr)} Sales`}
            </span>
          </div>
          <div className="kpi-value text-emerald">{money(dailyTotals.totalSales)}</div>
          <div className="kpi-footer">
            {dailyTotals.totalBills} {role === 'counter' ? 'bills issued by you' : 'total bills generated'}
          </div>
        </div>

        <div className="kpi-card bills-kpi">
          <div className="kpi-header">
            <Receipt size={16} className="text-blue" />
            <span className="kpi-label">{role === 'counter' ? 'Your Tickets / Units' : 'Tickets / Units'}</span>
          </div>
          <div className="kpi-value">{dailyTotals.totalUnits}</div>
          <div className="kpi-footer">
            {role === 'counter' ? `Terminal: ${currentCounter}` : `Across ${countersList.length} billing counters`}
          </div>
        </div>

        <div className="kpi-card prize-kpi">
          <div className="kpi-header">
            <Trophy size={16} className="text-amber" />
            <span className="kpi-label">{role === 'counter' ? 'Your Winning Payouts' : 'Winning Payouts'}</span>
          </div>
          <div className="kpi-value text-amber">{money(dayPrizes)}</div>
          <div className="kpi-footer">
            {role === 'counter'
              ? 'For tickets issued at your counter'
              : `Net: ${money(dailyTotals.totalSales - dayPrizes)}`}
          </div>
        </div>

        <div className="kpi-card slot-kpi">
          <div className="kpi-header">
            <Clock size={16} className="text-indigo" />
            <span className="kpi-label">Current Active Slot</span>
          </div>
          <div className="kpi-value text-indigo">{fmtTime(liveSlot)}</div>
          <div className="kpi-footer">
            <span className={`status-pill ${isLocked ? 'pill-locked' : 'pill-open'}`}>
              {isLocked ? 'Billing Locked' : 'Billing Open'}
            </span>
          </div>
        </div>
      </div>

      {/* 7. Live Number Volume Matrix */}
      <div className="card matrix-card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">Live Number Volume Matrix</h2>
            <div className="card-subtitle">
              Booked units for {matrixScope === 'slot' ? `Slot ${fmtTime(selectedSlot)}` : `All Day (${formatDateDisplay(selectedDate, todayStr)})`}
            </div>
          </div>
          <div className="matrix-scope-toggle">
            <button
              type="button"
              className={`pill-btn ${matrixScope === 'slot' ? 'active' : ''}`}
              onClick={() => setMatrixScope('slot')}
            >
              Slot {fmtTime(selectedSlot)}
            </button>
            <button
              type="button"
              className={`pill-btn ${matrixScope === 'day' ? 'active' : ''}`}
              onClick={() => setMatrixScope('day')}
            >
              Full Day
            </button>
          </div>
        </div>

        {/* Matrix Controls */}
        <div className="matrix-toolbar">
          <div className="city-chips-compact">
            {cities.map((c) => {
              const isSelected = selectedCityId === c.id;
              const cTheme = getCityColorTheme(c.id, cities);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`matrix-city-chip ${isSelected ? 'active' : ''}`}
                  style={
                    isSelected
                      ? { backgroundColor: cTheme.primary, borderColor: cTheme.primary, color: '#ffffff' }
                      : { borderColor: cTheme.border, color: cTheme.text }
                  }
                  onClick={() => setSelectedCityId(c.id)}
                >
                  {c.name}
                </button>
              );
            })}
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
            const hasSales = count > 0;
            const isMax = count > 0 && count === maxCount && maxCount > 1;

            return (
              <div
                key={number}
                className={`matrix-tile ${isMax ? 'matrix-tile-hot' : hasSales ? 'matrix-tile-active' : ''}`}
              >
                <div className="matrix-num">{number}</div>
                <div className="matrix-count">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. Slot Bills List */}
      <div className="card table-card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">
              {role === 'counter' ? `Your Receipts for Slot ${fmtTime(selectedSlot)}` : `Bills for Slot ${fmtTime(selectedSlot)}`}
            </h2>
            <div className="card-subtitle">
              {role === 'counter' ? `Receipts issued by ${currentCounter} in this slot` : `${slotBills.length} bills in this time slot`}
            </div>
          </div>
          <span className="badge-count">{slotBills.length}</span>
        </div>

        {slotBills.length === 0 ? (
          <div className="empty-state">No bills recorded for this time slot.</div>
        ) : (
          <div className="mobile-table-list">
            {slotBills.slice(0, 10).map((b) => (
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
    </div>
  );
};
