import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  Ticket,
  Search,
  Filter,
  Layers,
  Table,
  Check,
  RotateCcw,
  Clock,
  Coins,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react';
import type { Bill, City, Result, Settings, UserRole, Winner } from '../types';
import { fmtTime, money, timeSlots, today, getCityColorTheme, getCityGradient } from '../utils/helpers';

interface ResultsPageProps {
  cities: City[];
  settings: Settings;
  bills: Bill[];
  results: Result[];
  role: UserRole;
  currentCounter: string;
  onResultDeclared: (result: Result) => void;
  onBatchResultsDeclared?: (results: Result[]) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  cities,
  settings,
  bills,
  results,
  role,
  currentCounter,
  onResultDeclared,
  onBatchResultsDeclared,
}) => {
  const enabledCities = useMemo(() => cities.filter((c) => c.enabled), [cities]);
  const slots = useMemo(() => timeSlots(settings), [settings]);

  // Selected date for declaring and viewing results
  const [selectedDate, setSelectedDate] = useState<string>(today());
  // Selected time slot for the slot-by-slot entry mode
  const [selectedSlot, setSelectedSlot] = useState<string>(slots[0] || '09:00');
  // Active view: 'slot_entry' | 'matrix' | 'winners'
  const [activeView, setActiveView] = useState<'slot_entry' | 'matrix' | 'winners'>('slot_entry');
  // Notification / success banner message
  const [statusMessage, setStatusMessage] = useState<string>('');
  // Ticket search in winners tab
  const [ticketSearch, setTicketSearch] = useState<string>('');

  // Draft inputs for each city in the active slot: cityId -> { number, type }
  const [slotDraftInputs, setSlotDraftInputs] = useState<
    Record<string, { number: string; type: 1 | 2 }>
  >({});

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Load existing declared results for the selectedDate + selectedSlot into slotDraftInputs
  useEffect(() => {
    const slotResults = results.filter(
      (r) => r.date === selectedDate && r.slot === selectedSlot
    );
    const initialInputs: Record<string, { number: string; type: 1 | 2 }> = {};

    enabledCities.forEach((c) => {
      // Look for 2D result first, fallback to 1D
      const res2D = slotResults.find((r) => r.cityId === c.id && r.type === 2);
      const res1D = slotResults.find((r) => r.cityId === c.id && r.type === 1);

      if (res2D) {
        initialInputs[c.id] = { number: res2D.number, type: 2 };
      } else if (res1D) {
        initialInputs[c.id] = { number: res1D.number, type: 1 };
      } else {
        initialInputs[c.id] = { number: '', type: 2 };
      }
    });

    setSlotDraftInputs(initialInputs);
  }, [selectedDate, selectedSlot, results, enabledCities]);

  /**
   * Calculate winning bills and prizes dynamically from bills for a specific result
   */
  const calculateResultWinners = (
    date: string,
    slot: string,
    cityId: string,
    type: 1 | 2,
    targetNumber: string,
    prizePerUnit: number
  ) => {
    const targetClean = String(targetNumber).trim();
    if (!targetClean) return { winners: [], totalPrize: 0, winCount: 0 };

    const matchingBills = bills.filter((b) => b.date === date && b.slot === slot);
    const winnersList: Winner[] = [];

    matchingBills.forEach((b) => {
      let winUnits = 0;
      if (b.items && b.items.length > 0) {
        b.items.forEach((it) => {
          if (
            it.cityId === cityId &&
            it.type === type &&
            String(it.number).trim() === targetClean
          ) {
            winUnits += it.units;
          }
        });
      } else {
        if (
          b.cityId === cityId &&
          b.type === type &&
          String(b.number).trim() === targetClean
        ) {
          winUnits += b.units || 1;
        }
      }

      if (winUnits > 0) {
        winnersList.push({
          receipt: b.receipt,
          counter: b.counter,
          amount: b.amount,
          units: winUnits,
          prize: winUnits * prizePerUnit,
          customer: b.customer,
        });
      }
    });

    const totalPrize = winnersList.reduce((sum, w) => sum + w.prize, 0);
    return { winners: winnersList, totalPrize, winCount: winnersList.length };
  };

  /**
   * Save a single city result in the selected slot
   */
  const handleSaveCityResult = (cityId: string) => {
    if (role !== 'admin') {
      alert('Only Admin can declare and save draw results.');
      return;
    }

    const input = slotDraftInputs[cityId];
    if (!input || !input.number.trim()) {
      alert(`Please enter a winning number for ${cityMap[cityId] || 'this city'}.`);
      return;
    }

    const raw = input.number.trim();
    const type = input.type;

    if (type === 2) {
      const num2D = raw.padStart(2, '0');
      if (isNaN(Number(num2D)) || Number(num2D) < 0 || Number(num2D) > 99) {
        alert('Please enter a valid 2-digit number (00-99).');
        return;
      }
      const tensDigit = num2D.charAt(0); // Tens digit rule (e.g. 35 -> 3)

      // 1. Calculate 2D winners & prize (₹950/unit)
      const winners2D = calculateResultWinners(selectedDate, selectedSlot, cityId, 2, num2D, 950);
      const res2D: Result = {
        date: selectedDate,
        slot: selectedSlot,
        cityId,
        cityName: cityMap[cityId] || 'City',
        type: 2,
        number: num2D,
        prizePerUnit: 950,
        totalPrize: winners2D.totalPrize,
        winners: winners2D.winners,
      };

      // 2. Calculate auto 1D tens digit winners & prize (₹95/unit)
      const winners1D = calculateResultWinners(selectedDate, selectedSlot, cityId, 1, tensDigit, 95);
      const res1D: Result = {
        date: selectedDate,
        slot: selectedSlot,
        cityId,
        cityName: cityMap[cityId] || 'City',
        type: 1,
        number: tensDigit,
        prizePerUnit: 95,
        totalPrize: winners1D.totalPrize,
        winners: winners1D.winners,
      };

      if (onBatchResultsDeclared) {
        onBatchResultsDeclared([res2D, res1D]);
      } else {
        onResultDeclared(res2D);
        onResultDeclared(res1D);
      }

      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {}

      const totalPayout = winners2D.totalPrize + winners1D.totalPrize;
      setStatusMessage(
        `Saved ${cityMap[cityId]}! 2D #${num2D} & Tens 1D #${tensDigit}. Total Prize: ${money(totalPayout)}`
      );
      setTimeout(() => setStatusMessage(''), 3500);
    } else {
      // 1D Single digit direct declaration
      const num1D = raw;
      if (isNaN(Number(num1D)) || Number(num1D) < 0 || Number(num1D) > 9) {
        alert('Please enter a valid single digit (0-9).');
        return;
      }

      const winners1D = calculateResultWinners(selectedDate, selectedSlot, cityId, 1, num1D, 95);
      const res1D: Result = {
        date: selectedDate,
        slot: selectedSlot,
        cityId,
        cityName: cityMap[cityId] || 'City',
        type: 1,
        number: num1D,
        prizePerUnit: 95,
        totalPrize: winners1D.totalPrize,
        winners: winners1D.winners,
      };

      onResultDeclared(res1D);

      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      } catch {}

      setStatusMessage(
        `Saved ${cityMap[cityId]} 1D #${num1D}! Winners: ${winners1D.winCount}. Total Prize: ${money(winners1D.totalPrize)}`
      );
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  /**
   * Save all cities for the current active slot in one click
   */
  const handleSaveAllCitiesInSlot = () => {
    if (role !== 'admin') {
      alert('Only Admin can declare and save draw results.');
      return;
    }

    const batchResults: Result[] = [];
    let savedCitiesCount = 0;
    let slotPrizeSum = 0;

    enabledCities.forEach((c) => {
      const input = slotDraftInputs[c.id];
      if (!input || !input.number.trim()) return;

      const raw = input.number.trim();
      const type = input.type;

      if (type === 2) {
        const num2D = raw.padStart(2, '0');
        const tensDigit = num2D.charAt(0);

        const winners2D = calculateResultWinners(selectedDate, selectedSlot, c.id, 2, num2D, 950);
        batchResults.push({
          date: selectedDate,
          slot: selectedSlot,
          cityId: c.id,
          cityName: c.name,
          type: 2,
          number: num2D,
          prizePerUnit: 950,
          totalPrize: winners2D.totalPrize,
          winners: winners2D.winners,
        });

        const winners1D = calculateResultWinners(selectedDate, selectedSlot, c.id, 1, tensDigit, 95);
        batchResults.push({
          date: selectedDate,
          slot: selectedSlot,
          cityId: c.id,
          cityName: c.name,
          type: 1,
          number: tensDigit,
          prizePerUnit: 95,
          totalPrize: winners1D.totalPrize,
          winners: winners1D.winners,
        });

        savedCitiesCount += 1;
        slotPrizeSum += winners2D.totalPrize + winners1D.totalPrize;
      } else {
        const num1D = raw;
        const winners1D = calculateResultWinners(selectedDate, selectedSlot, c.id, 1, num1D, 95);
        batchResults.push({
          date: selectedDate,
          slot: selectedSlot,
          cityId: c.id,
          cityName: c.name,
          type: 1,
          number: num1D,
          prizePerUnit: 95,
          totalPrize: winners1D.totalPrize,
          winners: winners1D.winners,
        });

        savedCitiesCount += 1;
        slotPrizeSum += winners1D.totalPrize;
      }
    });

    if (batchResults.length === 0) {
      alert('Please enter winning numbers for at least one city in this slot.');
      return;
    }

    if (onBatchResultsDeclared) {
      onBatchResultsDeclared(batchResults);
    } else {
      batchResults.forEach((r) => onResultDeclared(r));
    }

    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch {}

    setStatusMessage(
      `Saved all ${savedCitiesCount} cities for slot ${fmtTime(selectedSlot)}! Total Prize Payout: ${money(slotPrizeSum)}.`
    );
    setTimeout(() => setStatusMessage(''), 4000);
  };

  /**
   * Day overview metrics
   */
  const dayResults = useMemo(() => {
    return results.filter((r) => r.date === selectedDate);
  }, [results, selectedDate]);

  const dayTotalPrize = useMemo(() => {
    // Recalculate accurately for all day results from matching bills
    let total = 0;
    dayResults.forEach((r) => {
      const w = calculateResultWinners(
        r.date,
        r.slot,
        r.cityId,
        r.type,
        r.number,
        r.prizePerUnit || (r.type === 1 ? 95 : 950)
      );
      total += w.totalPrize;
    });
    return total;
  }, [dayResults, bills]);

  const dayTotalWinners = useMemo(() => {
    let count = 0;
    dayResults.forEach((r) => {
      const w = calculateResultWinners(
        r.date,
        r.slot,
        r.cityId,
        r.type,
        r.number,
        r.prizePerUnit || (r.type === 1 ? 95 : 950)
      );
      count += w.winCount;
    });
    return count;
  }, [dayResults, bills]);

  /**
   * All Winning Bills for the selected date
   */
  const winningBillsList = useMemo(() => {
    const list: Array<{
      result: Result;
      winner: Winner;
      cityName: string;
    }> = [];

    dayResults.forEach((r) => {
      const w = calculateResultWinners(
        r.date,
        r.slot,
        r.cityId,
        r.type,
        r.number,
        r.prizePerUnit || (r.type === 1 ? 95 : 950)
      );
      w.winners.forEach((winner) => {
        list.push({
          result: r,
          winner,
          cityName: cityMap[r.cityId] || 'City',
        });
      });
    });

    if (!ticketSearch.trim()) return list;

    const query = ticketSearch.trim().toLowerCase();
    return list.filter(
      (item) =>
        item.winner.receipt.toLowerCase().includes(query) ||
        (item.winner.customer && item.winner.customer.toLowerCase().includes(query)) ||
        item.winner.counter.toLowerCase().includes(query) ||
        item.cityName.toLowerCase().includes(query)
    );
  }, [dayResults, bills, cityMap, ticketSearch]);

  return (
    <div className="draw-hub-card">
      {/* Top Header & Date Navigation */}
      <div className="draw-top-bar">
        <div className="flex-row items-center gap-2">
          <Trophy size={20} className="text-amber" />
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Draw Results & Prize Control
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
            style={{ height: 34, fontSize: 12 }}
          />
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: 11, height: 34 }}
            onClick={() => setSelectedDate(today())}
            title="Jump to today"
          >
            Today
          </button>
        </div>
      </div>

      {/* Real-time Prize & Draw Stats */}
      <div className="draw-stats-summary">
        <div className="draw-stat-box">
          <span className="draw-stat-val" style={{ color: '#2563eb' }}>
            {dayResults.filter((r) => r.type === 2).length} / {slots.length * enabledCities.length}
          </span>
          <span className="draw-stat-label">Cities Declared</span>
        </div>

        <div className="draw-stat-box">
          <span className="draw-stat-val" style={{ color: '#059669' }}>
            {dayTotalWinners}
          </span>
          <span className="draw-stat-label">Winning Tickets</span>
        </div>

        <div className="draw-stat-box">
          <span className="draw-stat-val" style={{ color: '#d97706' }}>
            {money(dayTotalPrize)}
          </span>
          <span className="draw-stat-label">Total Prize Payout</span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="draw-view-tabs">
        <button
          type="button"
          className={`draw-tab-btn ${activeView === 'slot_entry' ? 'active' : ''}`}
          onClick={() => setActiveView('slot_entry')}
        >
          <Clock size={14} />
          <span>By Time Slot</span>
        </button>
        <button
          type="button"
          className={`draw-tab-btn ${activeView === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveView('matrix')}
        >
          <Table size={14} />
          <span>All Slots Matrix</span>
        </button>
        <button
          type="button"
          className={`draw-tab-btn ${activeView === 'winners' ? 'active' : ''}`}
          onClick={() => setActiveView('winners')}
        >
          <Coins size={14} />
          <span>Winning Tickets ({winningBillsList.length})</span>
        </button>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 12.5,
            fontWeight: 700,
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Sparkles size={16} className="text-emerald" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ==============================================================
          VIEW 1: SLOT-BY-SLOT ENTRY OF EVERY CITY (ADMIN QUICK ENTRY)
          ============================================================== */}
      {activeView === 'slot_entry' && (
        <div>
          {/* Time Slot Horizontal Chips */}
          <div className="draw-slot-strip">
            {slots.map((slot) => {
              const isActive = slot === selectedSlot;
              const slotDeclared = dayResults.filter(
                (r) => r.slot === slot && r.type === 2
              ).length;
              const isFull = slotDeclared >= enabledCities.length;

              return (
                <div
                  key={slot}
                  className={`draw-slot-chip ${isActive ? 'active' : ''} ${
                    slotDeclared > 0 ? 'has-payout' : ''
                  }`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  <span className="draw-slot-chip-time">{fmtTime(slot)}</span>
                  <span className="draw-slot-chip-status">
                    {slotDeclared}/{enabledCities.length} {isFull ? '✓' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Slot Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                Slot: <b>{fmtTime(selectedSlot)}</b> · {selectedDate}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Type numbers below for each city. Double-digit auto-derives single-digit tens!
              </span>
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: 12.5,
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 800,
              }}
              onClick={handleSaveAllCitiesInSlot}
            >
              <Save size={15} />
              <span>Save All Cities for {fmtTime(selectedSlot)}</span>
            </button>
          </div>

          {/* Grid of City Cards for the Selected Slot */}
          <div className="draw-cities-grid">
            {enabledCities.map((city) => {
              const input = slotDraftInputs[city.id] || { number: '', type: 2 };
              const cleanNum = input.number.trim();
              const theme = getCityColorTheme(city.id, cities);

              // Check if already declared in state
              const declared2D = dayResults.find(
                (r) => r.slot === selectedSlot && r.cityId === city.id && r.type === 2
              );
              const declared1D = dayResults.find(
                (r) => r.slot === selectedSlot && r.cityId === city.id && r.type === 1
              );
              const isDeclared = Boolean(declared2D || declared1D);

              // Auto-calculated Tens Digit if 2D
              const tensDigit =
                input.type === 2 && cleanNum.length > 0
                  ? cleanNum.padStart(2, '0').charAt(0)
                  : '';

              // Live winning prize calculation for this city as admin types
              const live2D =
                input.type === 2 && cleanNum
                  ? calculateResultWinners(
                      selectedDate,
                      selectedSlot,
                      city.id,
                      2,
                      cleanNum.padStart(2, '0'),
                      950
                    )
                  : { winCount: 0, totalPrize: 0 };

              const live1D =
                input.type === 2 && tensDigit
                  ? calculateResultWinners(
                      selectedDate,
                      selectedSlot,
                      city.id,
                      1,
                      tensDigit,
                      95
                    )
                  : input.type === 1 && cleanNum
                  ? calculateResultWinners(
                      selectedDate,
                      selectedSlot,
                      city.id,
                      1,
                      cleanNum,
                      95
                    )
                  : { winCount: 0, totalPrize: 0 };

              const combinedPrize = live2D.totalPrize + live1D.totalPrize;
              const combinedWins = live2D.winCount + live1D.winCount;

              return (
                <div
                  key={city.id}
                  className={`draw-city-card ${isDeclared ? 'is-declared' : ''}`}
                >
                  {/* City Header */}
                  <div className="draw-city-header">
                    <div className="draw-city-badge">
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: theme.primary,
                        }}
                      />
                      <span style={{ color: theme.primary }}>{city.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isDeclared && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#059669',
                            background: '#d1fae5',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          ✓ Declared
                        </span>
                      )}
                      <div className="type-toggle-mini" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className={`toggle-mini-btn ${input.type === 2 ? 'active' : ''}`}
                          style={{ padding: '2px 6px', fontSize: 10 }}
                          onClick={() =>
                            setSlotDraftInputs((prev) => ({
                              ...prev,
                              [city.id]: { ...(prev[city.id] || { number: '' }), type: 2 },
                            }))
                          }
                        >
                          2D
                        </button>
                        <button
                          type="button"
                          className={`toggle-mini-btn ${input.type === 1 ? 'active' : ''}`}
                          style={{ padding: '2px 6px', fontSize: 10 }}
                          onClick={() =>
                            setSlotDraftInputs((prev) => ({
                              ...prev,
                              [city.id]: { ...(prev[city.id] || { number: '' }), type: 1 },
                            }))
                          }
                        >
                          1D
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Number Input & Derived Tens Digit */}
                  <div className="draw-city-input-row">
                    <input
                      type="text"
                      className="draw-city-number-input"
                      placeholder={input.type === 2 ? '00' : '0'}
                      maxLength={input.type === 2 ? 2 : 1}
                      value={input.number}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        setSlotDraftInputs((prev) => ({
                          ...prev,
                          [city.id]: { ...(prev[city.id] || { type: 2 }), number: clean },
                        }));
                      }}
                      style={{ borderColor: theme.border }}
                    />

                    <div className="draw-city-pills-info">
                      {input.type === 2 ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
                            2D Rate: <b>₹950/unit</b>
                          </div>
                          {tensDigit ? (
                            <span className="draw-tens-pill">
                              Tens (1D): #{tensDigit} (₹95/unit)
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>
                              Tens digit auto-calculates
                            </span>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
                          1D Single Digit: <b>₹95/unit</b>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn-save-slot-city"
                      onClick={() => handleSaveCityResult(city.id)}
                      title="Save this city's result"
                    >
                      Save
                    </button>
                  </div>

                  {/* Real-time Prize Calculation for this City */}
                  <div
                    className={`draw-live-payout-box ${
                      combinedWins > 0 ? 'has-wins' : ''
                    }`}
                  >
                    <span>
                      {combinedWins > 0
                        ? `🎉 ${combinedWins} Winning Ticket(s)`
                        : 'No winning tickets yet'}
                    </span>
                    <b style={{ fontSize: 12 }}>
                      {combinedPrize > 0 ? money(combinedPrize) : '₹0'}
                    </b>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Save All Bar */}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button
              type="button"
              className="btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: 13,
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 800,
                borderRadius: 12,
              }}
              onClick={handleSaveAllCitiesInSlot}
            >
              <Save size={16} />
              <span>Save All Declared Cities for {fmtTime(selectedSlot)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ==============================================================
          VIEW 2: FULL MASTER MATRIX (ALL SLOTS × ALL CITIES TABLE)
          ============================================================== */}
      {activeView === 'matrix' && (
        <div className="draw-matrix-wrapper">
          <table className="draw-matrix-table">
            <thead>
              <tr>
                <th>Time Slot</th>
                <th>Total Prize</th>
                {enabledCities.map((c) => (
                  <th key={c.id}>{c.name}</th>
                ))}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const slotResults = dayResults.filter((r) => r.slot === slot);

                // Slot Prize calculation
                let slotPrize = 0;
                slotResults.forEach((r) => {
                  const w = calculateResultWinners(
                    r.date,
                    r.slot,
                    r.cityId,
                    r.type,
                    r.number,
                    r.prizePerUnit || (r.type === 1 ? 95 : 950)
                  );
                  slotPrize += w.totalPrize;
                });

                return (
                  <tr key={slot}>
                    <td style={{ fontWeight: 800 }}>{fmtTime(slot)}</td>
                    <td
                      style={{
                        fontWeight: 800,
                        color: slotPrize > 0 ? '#059669' : '#64748b',
                      }}
                    >
                      {slotPrize > 0 ? money(slotPrize) : '—'}
                    </td>
                    {enabledCities.map((c) => {
                      const res2D = slotResults.find((r) => r.cityId === c.id && r.type === 2);
                      const res1D = slotResults.find((r) => r.cityId === c.id && r.type === 1);

                      return (
                        <td key={c.id}>
                          {res2D ? (
                            <div>
                              <b style={{ color: '#1e293b', fontSize: 13, fontFamily: 'monospace' }}>
                                #{res2D.number}
                              </b>
                              {res1D && (
                                <span style={{ fontSize: 10, color: '#059669', display: 'block' }}>
                                  Tens: #{res1D.number}
                                </span>
                              )}
                            </div>
                          ) : res1D ? (
                            <b style={{ color: '#059669', fontSize: 13, fontFamily: 'monospace' }}>
                              #{res1D.number}
                            </b>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setActiveView('slot_entry');
                        }}
                      >
                        Enter / Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ==============================================================
          VIEW 3: WINNING TICKETS & CLAIMS SEARCH
          ============================================================== */}
      {activeView === 'winners' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div className="search-box-large" style={{ flex: 1 }}>
              <Search size={16} className="text-muted" />
              <input
                type="text"
                placeholder="Search ticket receipt #, counter, or customer..."
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
          </div>

          {winningBillsList.length === 0 ? (
            <div className="empty-state">
              No winning tickets found for {selectedDate}. Enter draw results to calculate prizes!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {winningBillsList.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #a7f3d0',
                    borderLeft: '4px solid #10b981',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Ticket size={14} className="text-blue" />
                      <b style={{ fontSize: 13 }}>{item.winner.receipt}</b>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {item.winner.counter}
                      </span>
                      {item.winner.customer && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Cust: {item.winner.customer}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Slot: <b>{fmtTime(item.result.slot)}</b> · {item.cityName} · Winning #{' '}
                      <b>{item.result.number}</b> ({item.result.type === 2 ? '2D' : '1D'}) ·{' '}
                      <b>{item.winner.units} units</b>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: '#059669',
                      }}
                    >
                      {money(item.winner.prize)}
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                      Winning Prize
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
