import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  Award,
  Users,
  Search,
  Calendar,
  Filter,
  Sparkles,
  Ticket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Bill, City, Result, Settings, UserRole, Winner } from '../types';
import { fmtTime, money, timeSlots, today, getCityColorTheme } from '../utils/helpers';

interface ResultsPageProps {
  cities: City[];
  settings: Settings;
  bills: Bill[];
  results: Result[];
  role: UserRole;
  currentCounter: string;
  onResultDeclared: (result: Result) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  cities,
  settings,
  bills,
  results,
  role,
  currentCounter,
  onResultDeclared,
}) => {
  const slots = useMemo(() => timeSlots(settings), [settings]);
  const [selectedSlot, setSelectedSlot] = useState<string>(slots[0] || '09:00');
  const [selectedCityId, setSelectedCityId] = useState<string>(cities[0]?.id || 'c0');
  const [resultType, setResultType] = useState<1 | 2>(2);
  const [winningNumber, setWinningNumber] = useState<string>('00');
  const [prizePerUnit, setPrizePerUnit] = useState<number>(950);
  const [message, setMessage] = useState<string>('');

  // Filters for viewing history
  const [filterDate, setFilterDate] = useState<string>(today());
  const [filterCityId, setFilterCityId] = useState<string>('all');
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [viewScope, setViewScope] = useState<'all' | 'winning_only'>('all');

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Number options for admin declare: 00-99 or 0-9
  const numbers = useMemo(() => {
    const count = resultType === 2 ? 100 : 10;
    return Array.from({ length: count }, (_, i) =>
      resultType === 2 ? String(i).padStart(2, '0') : String(i)
    );
  }, [resultType]);

  const handleTypeChange = (type: 1 | 2) => {
    setResultType(type);
    setWinningNumber(type === 2 ? '00' : '0');
    setPrizePerUnit(type === 2 ? 950 : 95);
  };

  /**
   * Dynamically and reliably compute winning tickets for a draw result.
   * Scans `bills` directly so no winning bill is ever missed, even if cloud sync was delayed.
   */
  const getWinnersForResult = (r: Result, targetCounter?: string): Winner[] => {
    const matchingBills = bills.filter((b) => {
      if (
        targetCounter &&
        b.counter?.trim().toLowerCase() !== targetCounter.trim().toLowerCase()
      ) {
        return false;
      }
      if (b.date !== r.date || b.slot !== r.slot) return false;
      return true;
    });

    const winnersList: Winner[] = [];

    matchingBills.forEach((b) => {
      let winUnits = 0;
      const targetNum = String(r.number).trim();

      if (b.items && b.items.length > 0) {
        b.items.forEach((it) => {
          const matchCity = it.cityId === r.cityId;
          const matchType = it.type === r.type;
          const matchNum = String(it.number).trim() === targetNum;
          if (matchCity && matchType && matchNum) {
            winUnits += it.units;
          }
        });
      } else {
        const matchCity = b.cityId === r.cityId;
        const matchType = b.type === r.type;
        const matchNum = String(b.number).trim() === targetNum;
        if (matchCity && matchType && matchNum) {
          winUnits += b.units || 1;
        }
      }

      if (winUnits > 0) {
        const unitPrize = r.prizePerUnit || (r.type === 1 ? 95 : 950);
        winnersList.push({
          receipt: b.receipt,
          counter: b.counter,
          amount: b.amount,
          units: winUnits,
          prize: winUnits * unitPrize,
          customer: b.customer,
        });
      }
    });

    return winnersList;
  };

  const handleDeclareResult = () => {
    if (role !== 'admin') {
      alert('Only Admin can declare draw results.');
      return;
    }

    const todayStr = today();
    // Check if result already declared
    const alreadyDeclared = results.some(
      (r) =>
        r.date === todayStr &&
        r.slot === selectedSlot &&
        r.cityId === selectedCityId &&
        r.type === resultType
    );

    if (alreadyDeclared) {
      alert('A result for this City, Slot, and Type has already been declared today.');
      return;
    }

    const tempResult: Result = {
      date: todayStr,
      slot: selectedSlot,
      cityId: selectedCityId,
      cityName: cityMap[selectedCityId] || 'City',
      type: resultType,
      number: winningNumber,
      prizePerUnit,
      totalPrize: 0,
      winners: [],
    };

    const winners = getWinnersForResult(tempResult);
    const totalPrize = winners.reduce((s, w) => s + w.prize, 0);

    const newResult: Result = {
      ...tempResult,
      totalPrize,
      winners,
    };

    onResultDeclared(newResult);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    setMessage(
      `Result declared! Winning #: ${winningNumber}. Matching bills: ${winners.length}. Total prize: ${money(totalPrize)}.`
    );
  };

  // Filtered & processed draw results with dynamic winner detection
  const processedResults = useMemo(() => {
    return results.map((r) => {
      const winners = getWinnersForResult(
        r,
        role === 'counter' ? currentCounter : undefined
      );
      const totalPrize = winners.reduce((s, w) => s + w.prize, 0);
      return {
        ...r,
        winners,
        totalPrize,
      };
    });
  }, [results, bills, role, currentCounter]);

  // Aggregate stats specifically for counter terminal
  const counterTotalPayout = useMemo(() => {
    return processedResults
      .filter((r) => !filterDate || r.date === filterDate)
      .reduce((sum, r) => sum + r.totalPrize, 0);
  }, [processedResults, filterDate]);

  const counterWinningBillsTotal = useMemo(() => {
    return processedResults
      .filter((r) => !filterDate || r.date === filterDate)
      .reduce((sum, r) => sum + (r.winners?.length || 0), 0);
  }, [processedResults, filterDate]);

  // Results filtered by user controls (date, city, search, scope)
  const displayedResults = useMemo(() => {
    return processedResults.filter((r) => {
      // Date filter
      if (filterDate && r.date !== filterDate) return false;

      // City filter
      if (filterCityId !== 'all' && r.cityId !== filterCityId) return false;

      // Scope filter for counter staff
      if (role === 'counter' && viewScope === 'winning_only' && r.winners.length === 0) {
        return false;
      }

      // Ticket search filter
      if (ticketSearch.trim()) {
        const query = ticketSearch.trim().toLowerCase();
        const matchesWinningBill = r.winners.some(
          (w) =>
            w.receipt.toLowerCase().includes(query) ||
            (w.customer && w.customer.toLowerCase().includes(query))
        );
        const matchesDraw =
          r.number.includes(query) ||
          (cityMap[r.cityId] && cityMap[r.cityId].toLowerCase().includes(query)) ||
          r.slot.includes(query);

        if (!matchesWinningBill && !matchesDraw) return false;
      }

      return true;
    });
  }, [processedResults, filterDate, filterCityId, viewScope, ticketSearch, role, cityMap]);

  // Instant Ticket Checker status
  const ticketCheckMatch = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    if (!q || q.length < 2) return null;

    const matchedWinningBills: Array<{ result: Result; winner: Winner }> = [];
    processedResults.forEach((r) => {
      r.winners.forEach((w) => {
        if (
          w.receipt.toLowerCase() === q ||
          w.receipt.toLowerCase().includes(q)
        ) {
          matchedWinningBills.push({ result: r, winner: w });
        }
      });
    });

    return matchedWinningBills;
  }, [ticketSearch, processedResults]);

  return (
    <div className="results-page">
      {/* Admin Declaration Card */}
      {role === 'admin' ? (
        <div className="card declare-card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">Declare Draw Result</h2>
              <div className="card-subtitle">Select slot, city & winning number</div>
            </div>
            <Trophy size={22} className="text-amber" />
          </div>

          {message && (
            <div className="status-toast" style={{ marginBottom: 14 }}>
              <CheckCircle2 size={16} />
              <span>{message}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label>Time Slot</label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                className="form-select"
              >
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {fmtTime(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>City</label>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="form-select"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Winning Type</label>
              <div className="type-toggle-mini">
                <button
                  type="button"
                  className={`toggle-mini-btn ${resultType === 2 ? 'active' : ''}`}
                  onClick={() => handleTypeChange(2)}
                >
                  00–99
                </button>
                <button
                  type="button"
                  className={`toggle-mini-btn ${resultType === 1 ? 'active' : ''}`}
                  onClick={() => handleTypeChange(1)}
                >
                  0–9
                </button>
              </div>
            </div>

            <div className="form-field">
              <label>Winning Number</label>
              <select
                value={winningNumber}
                onChange={(e) => setWinningNumber(e.target.value)}
                className="form-select text-bold font-mono text-center text-lg"
              >
                {numbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field full-width">
              <label>Prize Payout per Winning Unit (₹) — Default {resultType === 2 ? '₹950' : '₹95'}</label>
              <input
                type="number"
                min="0"
                value={prizePerUnit}
                onChange={(e) => setPrizePerUnit(Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>
          </div>

          <button
            type="button"
            className="btn-primary full-width"
            onClick={handleDeclareResult}
            style={{ marginTop: 14 }}
          >
            <Award size={18} />
            <span>Save Result & Calculate Prizes</span>
          </button>
        </div>
      ) : (
        /* Counter Staff Summary Banner */
        <div className="card info-banner-card" style={{ marginBottom: 14 }}>
          <div className="card-header-row">
            <div className="flex-row items-center gap-2">
              <Trophy size={20} className="text-amber" />
              <div>
                <h2 className="card-title">Draw Results & Winning Payouts</h2>
                <div className="card-subtitle">
                  Terminal: <b>{currentCounter}</b> · Only your winning payouts calculated
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block">Your Total Payouts:</span>
              <b className="text-xl text-emerald font-mono">{money(counterTotalPayout)}</b>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 12,
            }}
          >
            <div className="flex-row items-center gap-2 text-muted">
              <Ticket size={14} className="text-blue" />
              <span>
                Winning Tickets: <b>{counterWinningBillsTotal}</b>
              </span>
            </div>
            <div className="badge-open" style={{ fontSize: 11, padding: '2px 8px' }}>
              ● Verified for {currentCounter}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar for Both Roles */}
      <div className="card filter-card" style={{ marginBottom: 14 }}>
        <div className="search-filter-row">
          <div className="search-box-large">
            <Search size={16} className="text-muted" />
            <input
              type="text"
              placeholder={
                role === 'counter'
                  ? `Verify Receipt # (e.g. A-01) or customer...`
                  : 'Search receipt, number or city...'
              }
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              className="search-input-field"
            />
            {ticketSearch && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setTicketSearch('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="date-picker-box">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="date-input"
            />
            {filterDate && (
              <button
                type="button"
                className="btn-clear-date"
                onClick={() => setFilterDate('')}
                title="Show all dates"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* City Filter Chips */}
        <div className="city-chips-compact" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`matrix-city-chip ${filterCityId === 'all' ? 'active' : ''}`}
            onClick={() => setFilterCityId('all')}
          >
            All Cities
          </button>
          {cities.map((c) => {
            const isSelected = filterCityId === c.id;
            const cTheme = getCityColorTheme(c.id, cities);
            return (
              <button
                key={c.id}
                type="button"
                className={`matrix-city-chip ${isSelected ? 'active' : ''}`}
                style={
                  isSelected
                    ? {
                        backgroundColor: cTheme.primary,
                        borderColor: cTheme.primary,
                        color: '#ffffff',
                      }
                    : { borderColor: cTheme.border, color: cTheme.text }
                }
                onClick={() => setFilterCityId(c.id)}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Scope Toggle for Counter Users */}
        {role === 'counter' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Showing {displayedResults.length} draws
            </span>
            <div className="type-toggle-mini">
              <button
                type="button"
                className={`toggle-mini-btn ${viewScope === 'all' ? 'active' : ''}`}
                onClick={() => setViewScope('all')}
              >
                All Numbers Declared
              </button>
              <button
                type="button"
                className={`toggle-mini-btn ${viewScope === 'winning_only' ? 'active' : ''}`}
                onClick={() => setViewScope('winning_only')}
              >
                My Winning Claims ({counterWinningBillsTotal})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Verification Instant Banner */}
      {ticketCheckMatch && ticketCheckMatch.length > 0 && (
        <div
          className="notice-banner info-banner"
          style={{
            marginBottom: 14,
            background: '#ecfdf5',
            borderColor: '#a7f3d0',
            color: '#065f46',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div className="flex-row items-center gap-2">
            <Sparkles size={16} className="text-emerald" />
            <b>TICKET WIN VERIFIED!</b>
          </div>
          {ticketCheckMatch.map(({ result: r, winner: w }, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              Receipt <b>{w.receipt}</b> matched winning <b>#{r.number}</b> in{' '}
              <b>{cityMap[r.cityId] || r.cityName}</b> ({fmtTime(r.slot)} · {r.date}).{' '}
              Payout Amount:{' '}
              <b style={{ color: '#047857', fontSize: 14 }}>{money(w.prize)}</b>{' '}
              ({w.units} unit(s)).
            </div>
          ))}
        </div>
      )}

      {/* Declared Results History List */}
      <div className="card table-card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">
              {role === 'counter'
                ? viewScope === 'winning_only'
                  ? `Your Winning Claims (${currentCounter})`
                  : `Declared Winning Numbers (${filterDate || 'All Days'})`
                : 'Declared Draw Results History'}
            </h2>
            <div className="card-subtitle">
              {role === 'counter'
                ? 'Check winning numbers and payouts for tickets issued at your counter'
                : 'Official draw results and store-wide winners'}
            </div>
          </div>
          <span className="badge-count">{displayedResults.length}</span>
        </div>

        {displayedResults.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 16px', textAlign: 'center' }}>
            <AlertCircle size={28} className="text-muted" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 14 }}>
              {role === 'counter' && viewScope === 'winning_only'
                ? `No winning tickets recorded for ${currentCounter} on ${filterDate || 'this filter'}.`
                : 'No draw results declared for this date and filter.'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {role === 'counter' && viewScope === 'winning_only' ? (
                <button
                  type="button"
                  className="btn-text-primary"
                  onClick={() => setViewScope('all')}
                  style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: '#2563eb' }}
                >
                  Switch to "All Numbers Declared" to see winning numbers.
                </button>
              ) : (
                'Results will appear here as soon as they are declared.'
              )}
            </p>
          </div>
        ) : (
          <div className="results-list">
            {displayedResults.map((r, idx) => {
              const hasMyWinners = r.winners.length > 0;
              const cTheme = getCityColorTheme(r.cityId, cities);

              return (
                <div
                  key={r.id || `${r.date}-${r.slot}-${r.cityId}-${idx}`}
                  className="result-card-item"
                  style={
                    hasMyWinners && role === 'counter'
                      ? {
                          border: '1.5px solid #10b981',
                          background: '#f0fdf4',
                        }
                      : {}
                  }
                >
                  <div className="result-item-header">
                    <div className="result-main-badge">
                      <span
                        className="result-num-circle"
                        style={{
                          backgroundColor: cTheme.primary,
                          color: '#ffffff',
                        }}
                      >
                        #{r.number}
                      </span>
                      <div>
                        <div className="result-city-name" style={{ color: cTheme.text }}>
                          {cityMap[r.cityId] || r.cityName}
                        </div>
                        <div className="result-time-slot">
                          {fmtTime(r.slot)} · {r.date} · {r.type === 2 ? '00–99' : '0-9'}
                        </div>
                      </div>
                    </div>

                    <div className="result-prize-box">
                      {role === 'counter' ? (
                        <>
                          <div
                            className="result-total-prize"
                            style={{
                              color: hasMyWinners ? '#16a34a' : 'var(--text-dim)',
                            }}
                          >
                            {money(r.totalPrize)}
                          </div>
                          <div className="result-rate">
                            {hasMyWinners ? 'Your Payout' : '0 wins here'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="result-total-prize">{money(r.totalPrize)}</div>
                          <div className="result-rate">
                            {money(r.prizePerUnit || (r.type === 1 ? 95 : 950))}/unit
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Winners Breakdown */}
                  {hasMyWinners ? (
                    <div className="result-winners-box" style={{ marginTop: 8 }}>
                      <div
                        className="winners-title"
                        style={{
                          color: role === 'counter' ? '#047857' : 'var(--text-dim)',
                          fontWeight: 700,
                        }}
                      >
                        <Trophy size={13} className="text-amber" />
                        <span>
                          {role === 'counter'
                            ? `🎉 ${r.winners.length} Winning Ticket(s) from ${currentCounter}:`
                            : `${r.winners.length} Winning Bill(s):`}
                        </span>
                      </div>
                      <div className="winners-chips">
                        {r.winners.map((w, wIdx) => (
                          <div
                            key={wIdx}
                            className="winner-chip"
                            style={
                              role === 'counter'
                                ? {
                                    borderColor: '#a7f3d0',
                                    background: '#ffffff',
                                    padding: '3px 8px',
                                  }
                                : {}
                            }
                          >
                            <span className="winner-receipt font-mono font-bold">
                              {w.receipt}
                            </span>
                            {role === 'admin' && (
                              <span className="winner-counter">({w.counter})</span>
                            )}
                            {w.customer && (
                              <span className="text-muted" style={{ fontSize: 10 }}>
                                {w.customer}
                              </span>
                            )}
                            <span className="winner-units">×{w.units}</span>
                            <b className="winner-prize" style={{ color: '#059669' }}>
                              {money(w.prize)}
                            </b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : role === 'counter' ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: 'var(--text-dim)',
                        fontStyle: 'italic',
                      }}
                    >
                      Rate: {money(r.prizePerUnit || (r.type === 1 ? 95 : 950))}/unit · No winning tickets from {currentCounter}
                    </div>
                  ) : (
                    <div className="no-winners-text">
                      No matching winning bills for this draw.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
