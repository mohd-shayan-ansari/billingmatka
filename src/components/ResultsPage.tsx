import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle2, AlertCircle, Award, Users, DollarSign } from 'lucide-react';
import type { Bill, City, Result, Settings, UserRole, Winner } from '../types';
import { fmtTime, money, timeSlots, today } from '../utils/helpers';

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
  const [prizePerUnit, setPrizePerUnit] = useState<number>(90);
  const [message, setMessage] = useState<string>('');

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Number options: 00-99 or 0-9
  const numbers = useMemo(() => {
    const count = resultType === 2 ? 100 : 10;
    return Array.from({ length: count }, (_, i) =>
      resultType === 2 ? String(i).padStart(2, '0') : String(i)
    );
  }, [resultType]);

  const handleTypeChange = (type: 1 | 2) => {
    setResultType(type);
    setWinningNumber(type === 2 ? '00' : '0');
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

    // Find all matching bills
    const matchingBills = bills.filter((b) => {
      if (b.date !== todayStr || b.slot !== selectedSlot) return false;
      return (b.items || []).some(
        (it) => it.cityId === selectedCityId && it.type === resultType && it.number === winningNumber
      );
    });

    const winners: Winner[] = [];
    matchingBills.forEach((b) => {
      const winningItems = (b.items || []).filter(
        (it) => it.cityId === selectedCityId && it.type === resultType && it.number === winningNumber
      );
      const units = winningItems.reduce((s, it) => s + it.units, 0);
      const prize = units * prizePerUnit;
      if (units > 0) {
        winners.push({
          receipt: b.receipt,
          counter: b.counter,
          amount: b.amount,
          units,
          prize,
          customer: b.customer,
        });
      }
    });

    const totalPrize = winners.reduce((s, w) => s + w.prize, 0);

    const newResult: Result = {
      date: todayStr,
      slot: selectedSlot,
      cityId: selectedCityId,
      cityName: cityMap[selectedCityId] || 'City',
      type: resultType,
      number: winningNumber,
      prizePerUnit,
      totalPrize,
      winners,
    };

    onResultDeclared(newResult);

    // Launch celebratory confetti!
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

  // Filter results for counter role: only show winners and prizes belonging to current counter
  const displayResults = useMemo(() => {
    if (role === 'admin') return results;
    return results.map((r) => {
      const counterWinners = (r.winners || []).filter(
        (w) => w.counter?.trim().toLowerCase() === currentCounter?.trim().toLowerCase()
      );
      return {
        ...r,
        winners: counterWinners,
        totalPrize: counterWinners.reduce((s, w) => s + w.prize, 0),
      };
    });
  }, [results, role, currentCounter]);

  // Aggregate total winning prize for counter
  const counterTotalPrize = useMemo(() => {
    return displayResults.reduce((s, r) => s + (r.totalPrize || 0), 0);
  }, [displayResults]);

  const counterWinningBillsCount = useMemo(() => {
    return displayResults.reduce((s, r) => s + (r.winners?.length || 0), 0);
  }, [displayResults]);

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
                className="form-select text-bold"
              >
                {numbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field full-width">
              <label>Prize Payout per Winning Unit (₹)</label>
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
        <div className="card info-banner-card" style={{ marginBottom: 14 }}>
          <div className="card-header-row">
            <div className="flex-row items-center gap-2">
              <Trophy size={20} className="text-amber" />
              <div>
                <h2 className="card-title">Draw Results & Winning Prizes</h2>
                <div className="card-subtitle">
                  Showing winning prizes strictly for <b>{currentCounter}</b>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted block">Your Total Payouts:</span>
              <b className="text-lg text-amber">{money(counterTotalPrize)}</b>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>🏆 Winning Bills: <b>{counterWinningBillsCount}</b></span>
            <span>•</span>
            <span>Terminal: <b>{currentCounter}</b></span>
          </div>
        </div>
      )}

      {/* Declared Results History */}
      <div className="card table-card">
        <div className="card-header-row">
          <h2 className="card-title">
            {role === 'counter' ? `Winning Draws for ${currentCounter}` : 'Declared Results History'}
          </h2>
          <span className="badge-count">{displayResults.length}</span>
        </div>

        {displayResults.length === 0 ? (
          <div className="empty-state">No draw results recorded yet.</div>
        ) : (
          <div className="results-list">
            {displayResults.map((r, idx) => (
              <div key={r.id || `${r.date}-${r.slot}-${r.cityId}-${idx}`} className="result-card-item">
                <div className="result-item-header">
                  <div className="result-main-badge">
                    <span className="result-num-circle">#{r.number}</span>
                    <div>
                      <div className="result-city-name">{cityMap[r.cityId] || r.cityName}</div>
                      <div className="result-time-slot">
                        {fmtTime(r.slot)} · {r.date} · {r.type === 2 ? '00-99' : '0-9'}
                      </div>
                    </div>
                  </div>
                  <div className="result-prize-box">
                    <div className="result-total-prize">{money(r.totalPrize)}</div>
                    <div className="result-rate">
                      {role === 'counter' ? 'Your Prize' : `${money(r.prizePerUnit)}/unit`}
                    </div>
                  </div>
                </div>

                {/* Winners Breakdown */}
                {r.winners && r.winners.length > 0 ? (
                  <div className="result-winners-box">
                    <div className="winners-title">
                      <Users size={12} />
                      <span>
                        {role === 'counter'
                          ? `${r.winners.length} Winning Bill(s) from ${currentCounter}:`
                          : `${r.winners.length} Winning Bill(s):`}
                      </span>
                    </div>
                    <div className="winners-chips">
                      {r.winners.map((w, wIdx) => (
                        <div key={wIdx} className="winner-chip">
                          <span className="winner-receipt">{w.receipt}</span>
                          {role === 'admin' && <span className="winner-counter">({w.counter})</span>}
                          <span className="winner-units">{w.units} unit(s)</span>
                          <b className="winner-prize">{money(w.prize)}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="no-winners-text">
                    {role === 'counter'
                      ? `No winning tickets from ${currentCounter} for this draw.`
                      : 'No matching winning bills for this draw.'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
