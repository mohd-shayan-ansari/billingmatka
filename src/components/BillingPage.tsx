import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  Sparkles,
  Bluetooth,
  ListPlus,
  Edit3,
  X,
  Layers,
  ArrowLeft,
  Calendar,
  Globe,
  RotateCcw,
} from 'lucide-react';
import type { Bill, City, PrinterConfig, Result, Settings, UserRole } from '../types';
import {
  activeSlot,
  billingLocked,
  generateNextReceiptNumber,
  money,
  today,
  timeSlots,
  fmtTime,
  getCityColorTheme,
  getCityGradient,
} from '../utils/helpers';
import {
  printBill,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  subscribePrinterStatus,
} from '../utils/printer';

interface BillingPageProps {
  cities: City[];
  settings: Settings;
  bills: Bill[];
  results?: Result[];
  role: UserRole;
  currentCounter: string;
  printerConfig: PrinterConfig;
  onBillCreated: (bill: Bill) => void;
  onOpenReceiptModal: (bill: Bill) => void;
  onSwitchRole?: () => void;
  onResultDeclared?: (result: Result) => void;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  cities,
  settings,
  bills,
  results = [],
  role,
  currentCounter,
  printerConfig,
  onBillCreated,
  onOpenReceiptModal,
  onSwitchRole,
  onResultDeclared,
}) => {
  const enabledCities = useMemo(() => cities.filter((c) => c.enabled), [cities]);
  const [selectedCityId, setSelectedCityId] = useState<string>(
    enabledCities[0]?.id || 'c0'
  );
  const [numberType, setNumberType] = useState<1 | 2>(2); // 2 = 00-99, 1 = 0-9
  const [searchNum, setSearchNum] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [selectedCounter, setSelectedCounter] = useState<string>(currentCounter);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Counter User Flow: 'cities' (Big City Blocks + Complete Chart) vs 'items' (Number Grid Page)
  const [screenView, setScreenView] = useState<'cities' | 'items' | 'allCities'>('cities');
  const [showRepeatModal, setShowRepeatModal] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'double' | 'single' | 'both'>('double');
  const [repeatSlot, setRepeatSlot] = useState<string>('');
  const [repeatUnits, setRepeatUnits] = useState<number>(1);
  const [chartDate, setChartDate] = useState<string>(today());
  const [showCartDrawer, setShowCartDrawer] = useState<boolean>(false);

  // BT status subscription
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
    'disconnected'
  );
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePrinterStatus((state) => {
      setBtStatus(state.status);
      setBtDeviceName(state.deviceName);
    });
    return unsub;
  }, []);

  const handleToggleBT = async () => {
    if (btStatus === 'connected') {
      disconnectBluetoothPrinter();
    } else {
      await connectBluetoothPrinter();
    }
  };

  // Clock & Slot countdown timer
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTimeStr = useMemo(() => {
    return now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, [now]);

  const currentSlot = useMemo(() => activeSlot(settings), [settings, now]);
  const isLocked = useMemo(() => billingLocked(settings), [settings, now]);

  const slotRemainingStr = useMemo(() => {
    if (!currentSlot || isLocked) return '';
    try {
      const [slotH, slotM] = currentSlot.split(':').map(Number);
      const slotTimeMs = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        slotH,
        slotM,
        0
      ).getTime();
      const diffMs = slotTimeMs - now.getTime();
      if (diffMs <= 0) return '0m 0s';
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    } catch {
      return '';
    }
  }, [currentSlot, isLocked, now]);

  // All time slots of the day
  const allSlots = useMemo(() => timeSlots(settings), [settings]);

  // Slots that have declared results today (sorted descending, latest first)
  const slotsWithResultsToday = useMemo(() => {
    const todayStr = today();
    const declaredSlots = new Set<string>();
    results.forEach((r) => {
      if (r.date === todayStr) {
        declaredSlots.add(r.slot);
      }
    });
    const list = Array.from(declaredSlots);
    return list.sort((a, b) => b.localeCompare(a));
  }, [results]);

  // Default repeatSlot to latest slot with results
  useEffect(() => {
    if (slotsWithResultsToday.length > 0 && (!repeatSlot || !slotsWithResultsToday.includes(repeatSlot))) {
      setRepeatSlot(slotsWithResultsToday[0]);
    } else if (slotsWithResultsToday.length === 0 && !repeatSlot) {
      setRepeatSlot(currentSlot);
    }
  }, [slotsWithResultsToday, currentSlot, repeatSlot]);

  // Execute repeating previous slot results
  const handleExecuteRepeatResults = () => {
    const todayStr = today();
    const targetSlot = repeatSlot || currentSlot;
    const slotResults = results.filter((r) => r.date === todayStr && r.slot === targetSlot);

    if (slotResults.length === 0) {
      alert(`No results declared yet for slot ${fmtTime(targetSlot)} today.`);
      return;
    }

    let addedCount = 0;
    setDraftQuantities((prev) => {
      const nextState = { ...prev };

      slotResults.forEach((r) => {
        const cityExists = enabledCities.some((c) => c.id === r.cityId);
        if (!cityExists) return;

        // If double or both: add 2-digit result
        if ((repeatMode === 'double' || repeatMode === 'both') && r.type === 2) {
          const num2D = String(r.number).padStart(2, '0');
          const key2D = `${r.cityId}|2|${num2D}`;
          nextState[key2D] = (nextState[key2D] || 0) + Math.max(1, repeatUnits);
          addedCount++;
        }

        // If single or both: add single digit (tens digit of 2D or native 1D)
        if (repeatMode === 'single' || repeatMode === 'both') {
          let num1D = '';
          if (r.type === 1) {
            num1D = String(r.number);
          } else if (r.type === 2) {
            // Tens digit rule: 35 -> 3, 57 -> 5
            num1D = String(r.number).padStart(2, '0').charAt(0);
          }
          if (num1D) {
            const key1D = `${r.cityId}|1|${num1D}`;
            nextState[key1D] = (nextState[key1D] || 0) + Math.max(1, repeatUnits);
            addedCount++;
          }
        }
      });

      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {}
      return nextState;
    });

    setShowRepeatModal(false);
    setStatusMessage(`Loaded ${addedCount} item(s) from ${fmtTime(targetSlot)} into cart!`);
    setTimeout(() => setStatusMessage(''), 3500);
  };


  // Current selected city theme
  const activeCityTheme = useMemo(
    () => getCityColorTheme(selectedCityId, cities),
    [selectedCityId, cities]
  );

  // Draft quantities stored as key: "cityId|type|number" => quantity
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('luckyDesk_billDraft');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  const updateQuantity = (
    cityId: string,
    type: 1 | 2,
    number: string,
    deltaOrSet: number,
    isDirectSet: boolean = false
  ) => {
    const key = `${cityId}|${type}|${number}`;
    setDraftQuantities((prev) => {
      const current = prev[key] || 0;
      const nextVal = isDirectSet
        ? Math.max(0, deltaOrSet)
        : Math.max(0, current + deltaOrSet);
      const nextState = { ...prev };
      if (nextVal > 0) {
        nextState[key] = nextVal;
      } else {
        delete nextState[key];
      }
      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {
        // ignore
      }
      return nextState;
    });
  };

  const clearDraft = () => {
    if (Object.keys(draftQuantities).length === 0) return;
    if (confirm('Clear current draft selection?')) {
      setDraftQuantities({});
      localStorage.removeItem('luckyDesk_billDraft');
      setStatusMessage('Draft cleared.');
      setTimeout(() => setStatusMessage(''), 2500);
    }
  };

  // Compute selected items list
  const selectedItems = useMemo(() => {
    return Object.entries(draftQuantities)
      .map(([key, units]) => {
        const [cityId, typeStr, number] = key.split('|');
        const type = Number(typeStr) as 1 | 2;
        const pricePerUnit =
          type === 2 ? settings.priceTwoDigit : settings.priceOneDigit;
        return {
          cityId,
          cityName: cityMap[cityId] || 'City',
          type,
          number,
          units,
          amount: units * pricePerUnit,
        };
      })
      .filter((x) => x.units > 0);
  }, [draftQuantities, settings, cityMap]);

  const totalUnits = useMemo(
    () => selectedItems.reduce((sum, x) => sum + x.units, 0),
    [selectedItems]
  );
  const totalAmount = useMemo(
    () => selectedItems.reduce((sum, x) => sum + x.amount, 0),
    [selectedItems]
  );

  // Compute sales frequency heatmap for current city and type today
  const numberSalesCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const todayStr = today();
    bills.forEach((b) => {
      if (b.date === todayStr) {
        (b.items || []).forEach((item) => {
          if (item.cityId === selectedCityId && item.type === numberType) {
            counts[item.number] = (counts[item.number] || 0) + item.units;
          }
        });
      }
    });
    return counts;
  }, [bills, selectedCityId, numberType]);

  const countValues = Object.values(numberSalesCounts);
  const maxSales = countValues.length ? Math.max(...countValues) : 0;

  // Numbers list: 00-99 or 0-9
  const numbersList = useMemo(() => {
    const count = numberType === 2 ? 100 : 10;
    return Array.from({ length: count }, (_, i) =>
      numberType === 2 ? String(i).padStart(2, '0') : String(i)
    );
  }, [numberType]);

  const filteredNumbers = useMemo(() => {
    if (!searchNum) return numbersList;
    return numbersList.filter((n) => n.includes(searchNum.trim()));
  }, [numbersList, searchNum]);

  // Quick batch add to the highlighted / searched number
  const handleQuickAdd = (num: string, amount: number) => {
    updateQuantity(selectedCityId, numberType, num, amount);
  };


  // Check if a number is drafted in all cities
  const getNumQuantityForAllCities = (num: string, type: 1 | 2) => {
    if (enabledCities.length === 0) return 0;
    // Check first city or min quantity
    const counts = enabledCities.map((c) => draftQuantities[`${c.id}|${type}|${num}`] || 0);
    return Math.min(...counts);
  };

  const updateQuantityForAllCities = (
    type: 1 | 2,
    number: string,
    deltaOrSet: number,
    isDirectSet: boolean = false
  ) => {
    setDraftQuantities((prev) => {
      const nextState = { ...prev };
      enabledCities.forEach((c) => {
        const key = `${c.id}|${type}|${number}`;
        const current = prev[key] || 0;
        const nextVal = isDirectSet
          ? Math.max(0, deltaOrSet)
          : Math.max(0, current + deltaOrSet);
        if (nextVal > 0) {
          nextState[key] = nextVal;
        } else {
          delete nextState[key];
        }
      });
      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {}
      return nextState;
    });
  };

  // Add a specific number across ALL enabled cities
  const handleAddNumberToAllCities = (
    targetNum: string,
    targetType: 1 | 2 = 2,
    unitsToAdd: number = 1
  ) => {
    const raw = (targetNum || '').trim();
    if (!raw) {
      alert('Please enter a number to add for all cities.');
      return;
    }

    const num = targetType === 2 ? raw.padStart(2, '0') : raw;
    if (targetType === 2 && (isNaN(Number(num)) || Number(num) < 0 || Number(num) > 99)) {
      alert('Please enter a valid 2-digit number (00-99).');
      return;
    }
    if (targetType === 1 && (isNaN(Number(num)) || Number(num) < 0 || Number(num) > 9)) {
      alert('Please enter a valid single-digit number (0-9).');
      return;
    }

    setDraftQuantities((prev) => {
      const nextState = { ...prev };
      enabledCities.forEach((c) => {
        const key = `${c.id}|${targetType}|${num}`;
        nextState[key] = (nextState[key] || 0) + unitsToAdd;
      });
      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {}
      return nextState;
    });

    setStatusMessage(
      `Added #${num} (${unitsToAdd} units each) to all ${enabledCities.length} cities!`
    );
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Complete Chart data: Time slots breakdown of Sales and Prize payouts for this counter
  const chartSlotsData = useMemo(() => {
    const counterToMatch = role === 'admin' ? selectedCounter : currentCounter;

    // Filter bills for the selected date & counter
    const dateBills = bills.filter((b) => {
      if (b.date !== chartDate) return false;
      if (
        counterToMatch &&
        b.counter?.trim().toLowerCase() !== counterToMatch.trim().toLowerCase()
      ) {
        return false;
      }
      return true;
    });

    return allSlots.map((slot) => {
      const slotBills = dateBills.filter((b) => b.slot === slot);
      const slotSales = slotBills.reduce((sum, b) => sum + (b.amount || 0), 0);
      const slotUnits = slotBills.reduce(
        (sum, b) => sum + (b.unitsTotal || b.units || 0),
        0
      );

      // Declared results for this slot on chartDate
      const slotResults = results.filter(
        (r) => r.date === chartDate && r.slot === slot
      );

      // Payouts for this counter's winning tickets in this slot
      let slotPrize = 0;
      let slotWinCount = 0;

      slotResults.forEach((r) => {
        const targetNum = String(r.number).trim();
        slotBills.forEach((b) => {
          let winUnits = 0;
          if (b.items && b.items.length > 0) {
            b.items.forEach((it) => {
              if (
                it.cityId === r.cityId &&
                it.type === r.type &&
                String(it.number).trim() === targetNum
              ) {
                winUnits += it.units;
              }
            });
          } else {
            if (
              b.cityId === r.cityId &&
              b.type === r.type &&
              String(b.number).trim() === targetNum
            ) {
              winUnits += b.units || 1;
            }
          }
          if (winUnits > 0) {
            const unitPrize = r.prizePerUnit || (r.type === 1 ? 95 : 950);
            slotPrize += winUnits * unitPrize;
            slotWinCount += 1;
          }
        });
      });

      // City results mapping for this slot (both 2D and derived tens-digit 1D)
      const cityResultsMap: Record<string, { num2D?: string; num1D?: string }> = {};
      slotResults.forEach((r) => {
        if (!cityResultsMap[r.cityId]) cityResultsMap[r.cityId] = {};
        if (r.type === 2) {
          const formatted = String(r.number).padStart(2, '0');
          cityResultsMap[r.cityId].num2D = formatted;
          cityResultsMap[r.cityId].num1D = formatted.charAt(0);
        } else if (r.type === 1) {
          cityResultsMap[r.cityId].num1D = String(r.number);
        }
      });

      return {
        slot,
        sales: slotSales,
        units: slotUnits,
        prize: slotPrize,
        wins: slotWinCount,
        net: slotSales - slotPrize,
        cityResults: cityResultsMap,
      };
    });
  }, [allSlots, bills, results, chartDate, role, selectedCounter, currentCounter]);

  const chartTotals = useMemo(() => {
    return chartSlotsData.reduce(
      (acc, s) => {
        acc.sales += s.sales;
        acc.units += s.units;
        acc.prize += s.prize;
        acc.wins += s.wins;
        acc.net += s.net;
        return acc;
      },
      { sales: 0, units: 0, prize: 0, wins: 0, net: 0 }
    );
  }, [chartSlotsData]);

  const handleCreateBill = async (fromEveryCityOption?: boolean | React.MouseEvent) => {
    const fromEveryCity = typeof fromEveryCityOption === 'boolean' ? fromEveryCityOption : false;
    if (isLocked) {
      alert('Billing is locked for the upcoming draw slot.');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Please select at least one number with quantity > 0.');
      return;
    }

    const billDate = new Date();
    const timeLabel = billDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateStr = today();
    const counterToUse = role === 'admin' ? selectedCounter : currentCounter;

    // Sequential receipt number per counter: Counter 1 -> A-01, Counter 2 -> B-01, etc.
    const receiptNo = generateNextReceiptNumber(counterToUse, bills, settings.counters);

    const isEveryCityBill = fromEveryCity || screenView === 'allCities';

    const newBill: Bill = {
      receipt: receiptNo,
      date: dateStr,
      timeLabel,
      timestamp: billDate.toISOString(),
      counter: counterToUse,
      customer: customerName.trim() || undefined,
      slot: currentSlot,
      cityId: selectedItems[0].cityId,
      type: selectedItems[0].type,
      number: selectedItems[0].number,
      units: selectedItems[0].units,
      unitsTotal: totalUnits,
      amount: totalAmount,
      items: selectedItems,
      isEveryCity: isEveryCityBill,
    };

    onBillCreated(newBill);

    // Automatically trigger thermal print
    const printRes = await printBill(newBill, printerConfig, cityMap);
    setStatusMessage(`Bill ${receiptNo} created! ${printRes.message}`);

    // Clear draft
    setDraftQuantities({});
    localStorage.removeItem('luckyDesk_billDraft');
    setCustomerName('');
    setSearchNum('');

    // Open receipt modal for preview/reprint
    onOpenReceiptModal(newBill);
  };

  return (
    <div className="billing-page">

      {/* REPEAT RESULT MODAL */}
      {showRepeatModal && (
        <div className="repeat-modal-overlay" onClick={() => setShowRepeatModal(false)}>
          <div className="repeat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="repeat-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#fef3c7', padding: 8, borderRadius: 10, display: 'flex' }}>
                  <RotateCcw size={20} color="#d97706" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    Repeat Slot Results
                  </h3>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Quickly add past declared results into cart for purchase
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowRepeatModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="repeat-modal-body">
              {/* Digit Type Choice: Double Digit, Single Digit, Both */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  1. Which items to repeat?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <button
                    type="button"
                    className={`repeat-type-btn ${repeatMode === 'double' ? 'active' : ''}`}
                    onClick={() => setRepeatMode('double')}
                  >
                    <b style={{ fontSize: 14 }}>2-Digit</b>
                    <span style={{ fontSize: 10, opacity: 0.85 }}>00–99 Results</span>
                  </button>

                  <button
                    type="button"
                    className={`repeat-type-btn ${repeatMode === 'single' ? 'active' : ''}`}
                    onClick={() => setRepeatMode('single')}
                  >
                    <b style={{ fontSize: 14 }}>Single Digit</b>
                    <span style={{ fontSize: 10, opacity: 0.85 }}>Tens digit (0-9)</span>
                  </button>

                  <button
                    type="button"
                    className={`repeat-type-btn ${repeatMode === 'both' ? 'active' : ''}`}
                    onClick={() => setRepeatMode('both')}
                  >
                    <b style={{ fontSize: 14 }}>Both (2D + 1D)</b>
                    <span style={{ fontSize: 10, opacity: 0.85 }}>Both digits</span>
                  </button>
                </div>
              </div>

              {/* Time Slot Selection: Defaults to latest declared */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  2. Choose Draw Time Slot
                </label>
                <select
                  value={repeatSlot}
                  onChange={(e) => setRepeatSlot(e.target.value)}
                  className="repeat-slot-select"
                >
                  {allSlots.map((slot) => {
                    const hasRes = results.some((r) => r.date === today() && r.slot === slot);
                    const isLatest = slotsWithResultsToday[0] === slot;
                    return (
                      <option key={slot} value={slot}>
                        {fmtTime(slot)} {isLatest ? '★ (Latest Declared)' : hasRes ? '✓ (Declared)' : '(No results)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Declared Results Preview for Chosen Slot */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Declared Results in {fmtTime(repeatSlot || currentSlot)}:
                </label>
                <div className="repeat-preview-grid">
                  {enabledCities.map((c) => {
                    const res2D = results.find(
                      (r) => r.date === today() && r.slot === (repeatSlot || currentSlot) && r.cityId === c.id && r.type === 2
                    );
                    const res1D = results.find(
                      (r) => r.date === today() && r.slot === (repeatSlot || currentSlot) && r.cityId === c.id && r.type === 1
                    );

                    let display2D = res2D ? String(res2D.number).padStart(2, '0') : '—';
                    let display1D = res1D ? String(res1D.number) : res2D ? String(res2D.number).padStart(2, '0').charAt(0) : '—';

                    return (
                      <div key={c.id} className="repeat-city-box">
                        <span className="repeat-city-name">{c.name}</span>
                        <div className="repeat-numbers-display">
                          {(repeatMode === 'double' || repeatMode === 'both') && (
                            <span className="repeat-pill-2d">2D: <b>#{display2D}</b></span>
                          )}
                          {(repeatMode === 'single' || repeatMode === 'both') && (
                            <span className="repeat-pill-1d">1D: <b>#{display1D}</b></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quantity / Units per item */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  3. Quantity / Units per number
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min="1"
                    value={repeatUnits}
                    onChange={(e) => setRepeatUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="repeat-qty-input"
                  />
                  {[1, 2, 5, 10].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`repeat-unit-quick ${repeatUnits === q ? 'active' : ''}`}
                      onClick={() => setRepeatUnits(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="repeat-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setShowRepeatModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1.5, padding: '10px', background: '#d97706', borderColor: '#d97706' }}
                onClick={handleExecuteRepeatResults}
              >
                <RotateCcw size={16} />
                <span>Load to Cart</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Mini Top Bar */}
      <div className="mini-top-bar">
        <div className="mini-bar-left">
          <span className="mini-clock">{currentTimeStr}</span>
          <span className="mini-divider">•</span>
          <span className="mini-draw">
            Draw: <b>{fmtTime(currentSlot)}</b>
          </span>
          <span
            className={`mini-status-pill ${
              isLocked ? 'status-locked' : 'status-open'
            }`}
          >
            {isLocked ? 'LOCKED' : `OPEN (${slotRemainingStr || 'Active'})`}
          </span>
        </div>
        <div className="mini-bar-right">
          <button
            type="button"
            className={`btn-mini-bt ${btStatus === 'connected' ? 'connected' : ''}`}
            onClick={handleToggleBT}
            title={
              btStatus === 'connected'
                ? `Connected: ${btDeviceName || 'Printer'}`
                : 'Connect Bluetooth Printer'
            }
          >
            <Bluetooth size={13} />
            <span>{btStatus === 'connected' ? 'BT On' : 'Connect BT'}</span>
          </button>
          {onSwitchRole && (
            <button
              type="button"
              className="btn-mini-role"
              onClick={onSwitchRole}
              title="Click to switch Counter / Admin"
            >
              {role === 'admin' ? 'Admin' : currentCounter}
            </button>
          )}
        </div>
      </div>

      {/* Top Banner Message */}
      {statusMessage && (
        <div className="status-toast">
          <Sparkles size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      {screenView === 'cities' ? (
        <div className="cities-hub-view">
          {/* Floating / Sticky Cart Banner if Cart has Items */}
          {selectedItems.length > 0 && (
            <div className="cart-floating-banner">
              <div className="cart-floating-info">
                <span style={{ fontWeight: 800, fontSize: 13 }}>
                  🛒 Cart: {selectedItems.length} Items ({totalUnits} Units)
                </span>
                <span style={{ color: '#34d399', fontWeight: 900, fontSize: 16 }}>
                  Total: {money(totalAmount)}
                </span>
              </div>
              <div className="cart-floating-actions">
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    background: '#10b981',
                    borderColor: '#10b981',
                    fontWeight: 800,
                  }}
                  onClick={handleCreateBill}
                  disabled={isLocked}
                >
                  <Printer size={15} />
                  <span>Finalise & Print</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    borderColor: 'rgba(255,255,255,0.2)',
                  }}
                  onClick={() => setShowCartDrawer(!showCartDrawer)}
                >
                  {showCartDrawer ? 'Hide Cart' : 'View Cart'}
                </button>
              </div>
            </div>
          )}

          {/* Expandable Cart Drawer on Cities Hub */}
          {showCartDrawer && selectedItems.length > 0 && (
            <div
              className="selected-items-preview"
              style={{
                marginBottom: 16,
                background: '#ffffff',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div className="preview-header">
                <div className="flex-row items-center gap-2">
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13 }}>
                    Current Cart Items ({selectedItems.length})
                  </span>
                </div>
                <button type="button" className="btn-text-danger" onClick={clearDraft}>
                  <Trash2 size={12} />
                  <span>Clear All</span>
                </button>
              </div>

              <div className="selected-chips-row">
                {selectedItems.map((it) => {
                  const itTheme = getCityColorTheme(it.cityId, cities);
                  return (
                    <div
                      key={`${it.cityId}-${it.type}-${it.number}`}
                      className="item-chip"
                      style={{ borderColor: itTheme.border }}
                    >
                      <span
                        className="chip-city"
                        style={{ backgroundColor: itTheme.primary, color: '#ffffff' }}
                      >
                        {it.cityName.slice(0, 3)}
                      </span>
                      <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>
                        {it.type === 2 ? '2D' : '1D'}
                      </span>
                      <b className="chip-num" style={{ color: itTheme.primary }}>
                        #{it.number}
                      </b>
                      <div className="chip-stepper">
                        <button
                          type="button"
                          className="chip-step-btn"
                          onClick={() => updateQuantity(it.cityId, it.type, it.number, -1)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          className="chip-qty-input"
                          value={it.units}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updateQuantity(it.cityId, it.type, it.number, isNaN(val) ? 0 : val, true);
                          }}
                        />
                        <button
                          type="button"
                          className="chip-step-btn"
                          onClick={() => updateQuantity(it.cityId, it.type, it.number, 1)}
                        >
                          +
                        </button>
                      </div>
                      <span className="chip-amt">{money(it.amount)}</span>
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => updateQuantity(it.cityId, it.type, it.number, 0, true)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TWO ACTION BUTTONS ABOVE CITY BLOCKS */}
          <div className="billing-quick-actions-row">
            <button
              type="button"
              className="billing-action-box btn-box-every-city"
              onClick={() => {
                setScreenView('allCities');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className="box-icon-wrap" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                <Globe size={24} color="#ffffff" />
              </div>
              <div className="box-text-wrap">
                <span className="box-main-title">🌍 Every City</span>
                <span className="box-sub-desc">Buy numbers for ALL {enabledCities.length} cities together</span>
              </div>
            </button>

            <button
              type="button"
              className="billing-action-box btn-box-repeat-result"
              onClick={() => setShowRepeatModal(true)}
            >
              <div className="box-icon-wrap" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <RotateCcw size={24} color="#ffffff" />
              </div>
              <div className="box-text-wrap">
                <span className="box-main-title">🔁 Repeat Result</span>
                <span className="box-sub-desc">Repeat past slot results (Single / 2-Digit / Both)</span>
              </div>
            </button>
          </div>

          {/* Section Heading */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  margin: 0,
                }}
              >
                Select City
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Click any city block to open number selection & purchase
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                background: '#f1f5f9',
                color: '#475569',
              }}
            >
              {enabledCities.length} Cities Active
            </div>
          </div>

          {/* THE BIG CITY BLOCKS GRID (Matches User Photo) */}
          <div className="big-city-grid">
            {enabledCities.map((c) => {
              const gradient = getCityGradient(c.id, cities);
              const itemsForCity = selectedItems.filter((it) => it.cityId === c.id);
              const unitsForCity = itemsForCity.reduce((sum, it) => sum + it.units, 0);
              const hasCart = unitsForCity > 0;

              // Latest declared result for this city today
              const todayStr = today();
              const cityRes2D = results.find(
                (r) => r.date === todayStr && r.cityId === c.id && r.type === 2
              );
              const cityRes1D = results.find(
                (r) => r.date === todayStr && r.cityId === c.id && r.type === 1
              );
              const latestResult = cityRes2D || cityRes1D;

              return (
                <div
                  key={c.id}
                  className={`big-city-card ${hasCart ? 'has-cart-items' : ''}`}
                  style={{ background: gradient }}
                  onClick={() => {
                    setSelectedCityId(c.id);
                    setScreenView('items');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title={`Click to open ${c.name} items`}
                >
                  <div style={{ width: '100%' }}>
                    <div className="big-city-title">{c.name}</div>
                    <div className="big-city-slot-pill">{fmtTime(currentSlot)}</div>
                  </div>

                  <div className="big-city-center-box">
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#ffffff',
                        letterSpacing: '1px',
                      }}
                    >
                      SELECT
                    </div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>
                      Tap to open
                    </div>
                  </div>

                  <div className="big-city-status-row">
                    <span
                      className="big-city-status-dot"
                      style={{
                        backgroundColor: hasCart ? '#10b981' : '#38bdf8',
                        boxShadow: hasCart ? '0 0 8px #10b981' : 'none',
                      }}
                    />
                    <span>
                      {hasCart
                        ? 'Cart Selected'
                        : 'Open for Billing'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* COMPLETE CHART: TIME SLOTS, SALES & PRIZES PER SLOT (As Requested) */}
          <div className="complete-chart-card">
            <div className="complete-chart-header">
              <div className="complete-chart-title-group">
                <h3>Complete Chart</h3>
                <div className="complete-chart-date">
                  {new Date(chartDate + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div className="complete-chart-badges">
                <input
                  type="date"
                  value={chartDate}
                  onChange={(e) => setChartDate(e.target.value)}
                  className="date-input"
                  style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    borderColor: '#334155',
                    height: 32,
                    fontSize: 12,
                    borderRadius: 8,
                  }}
                />
                <span className="chart-chip-live">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#34d399',
                    }}
                  />
                  Live Sync
                </span>
                <span className="chart-chip-scroll">↔ Swipe table</span>
              </div>
            </div>

            {/* Terminal Sales & Prizes KPIs for selected date */}
            <div className="complete-chart-kpis">
              <div className="chart-kpi-box">
                <span className="chart-kpi-label">
                  {role === 'counter' ? `${currentCounter} Sales` : 'Total Sales'}
                </span>
                <span className="chart-kpi-val" style={{ color: '#38bdf8' }}>
                  {money(chartTotals.sales)}
                </span>
                <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>
                  {chartTotals.units} units
                </span>
              </div>

              <div className="chart-kpi-box">
                <span className="chart-kpi-label">
                  {role === 'counter' ? `${currentCounter} Prizes` : 'Total Prizes'}
                </span>
                <span className="chart-kpi-val" style={{ color: '#f59e0b' }}>
                  {money(chartTotals.prize)}
                </span>
                <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>
                  {chartTotals.wins} winning claims
                </span>
              </div>

              <div className="chart-kpi-box">
                <span className="chart-kpi-label">Net Balance</span>
                <span
                  className="chart-kpi-val"
                  style={{ color: chartTotals.net >= 0 ? '#34d399' : '#f87171' }}
                >
                  {chartTotals.net >= 0 ? `+${money(chartTotals.net)}` : money(chartTotals.net)}
                </span>
                <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>
                  {chartTotals.net >= 0 ? 'Surplus' : 'Deficit'}
                </span>
              </div>
            </div>

            {/* Time Slot Table */}
            <div className="complete-chart-table-wrap">
              <table className="complete-chart-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>
                      {role === 'counter' ? `${currentCounter} Sales` : 'Sales'}
                    </th>
                    <th>
                      {role === 'counter' ? `${currentCounter} Prize` : 'Prize'}
                    </th>
                    <th>Net</th>
                    {enabledCities.map((c) => {
                      const cTheme = getCityColorTheme(c.id, cities);
                      return (
                        <th key={c.id} style={{ color: cTheme.border }}>
                          {c.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {chartSlotsData.map((s) => {
                    const isActive = s.slot === currentSlot;
                    return (
                      <tr key={s.slot} className={isActive ? 'row-active' : ''}>
                        <td style={{ fontWeight: 800 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            }}
                          >
                            {isActive && (
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: '#3b82f6',
                                }}
                              />
                            )}
                            <span>{fmtTime(s.slot)}</span>
                          </div>
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: s.sales > 0 ? '#38bdf8' : '#64748b',
                          }}
                        >
                          {s.sales > 0 ? `${money(s.sales)} (${s.units}u)` : '—'}
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: s.prize > 0 ? '#f59e0b' : '#64748b',
                          }}
                        >
                          {s.prize > 0 ? `${money(s.prize)} (${s.wins}w)` : '—'}
                        </td>
                        <td
                          style={{
                            fontWeight: 800,
                            color:
                              s.sales > 0 || s.prize > 0
                                ? s.net >= 0
                                  ? '#34d399'
                                  : '#f87171'
                                : '#64748b',
                          }}
                        >
                          {s.sales > 0 || s.prize > 0
                            ? s.net >= 0
                              ? `+${money(s.net)}`
                              : money(s.net)
                            : '—'}
                        </td>
                        {enabledCities.map((c) => {
                          const res = s.cityResults[c.id];
                          return (
                            <td key={c.id}>
                              {res && res.num2D ? (
                                <div className="chart-res-cell">
                                  <span className="chart-res-2d">#{res.num2D}</span>
                                  {res.num1D && (
                                    <span className="chart-res-tens">T: {res.num1D}</span>
                                  )}
                                </div>
                              ) : res && res.num1D ? (
                                <span className="chart-res-2d" style={{ color: '#a7f3d0' }}>
                                  #{res.num1D}
                                </span>
                              ) : (
                                <span style={{ color: '#475569' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* FLOATING CHECKOUT BAR ON CITY SCREEN IF CART HAS ITEMS */}
          {selectedItems.length > 0 && (
            <div className="city-floating-checkout-bar">
              <div className="city-floating-info">
                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}>
                  Cart: {selectedItems.length} Items ({totalUnits} units)
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#16a34a' }}>
                  {money(totalAmount)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn-continue-cities"
                  style={{ padding: '8px 12px', minHeight: 40, fontSize: 12 }}
                  onClick={() => {
                    const firstCityWithItems = selectedItems[0]?.cityId || selectedCityId;
                    setSelectedCityId(firstCityWithItems);
                    setScreenView('items');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title="Open items grid to edit numbers"
                >
                  <span>Edit Cart</span>
                </button>

                <button
                  type="button"
                  className="btn-finalise-receipt"
                  style={{ padding: '8px 14px', minHeight: 40, fontSize: 13 }}
                  disabled={isLocked || selectedItems.length === 0}
                  onClick={handleCreateBill}
                  title="Finalise and print thermal receipt"
                >
                  <Printer size={16} />
                  <span>{isLocked ? 'LOCKED' : 'Finalise'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

      ) : screenView === 'allCities' ? (
        /* SCREEN VIEW: EVERY CITY ITEM PAGE */
        <div className="item-view-container">
          {/* Top Bar: Back to Cities button, Every City title & badge, Draw time */}
          <div className="item-page-top-bar" style={{ borderColor: '#3b82f6', background: 'linear-gradient(90deg, #eff6ff 0%, #ffffff 100%)' }}>
            <button
              type="button"
              className="btn-back-cities"
              onClick={() => {
                setScreenView('cities');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </button>

            <div className="item-page-city-badge">
              <Globe size={18} color="#2563eb" />
              <span className="item-page-city-name" style={{ color: '#1d4ed8', fontWeight: 800 }}>
                EVERY CITY ({enabledCities.length} Cities)
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#dbeafe',
                  color: '#1e40af',
                  fontWeight: 700,
                }}
              >
                {money((numberType === 2 ? settings.priceTwoDigit : settings.priceOneDigit) * enabledCities.length)}/unit for all
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Draw: <b>{fmtTime(currentSlot)}</b>
              </span>
            </div>
          </div>

          {/* Type & Filter Toolbar */}
          <div className="billing-toolbar">
            <div className="type-toggle-pills">
              <button
                type="button"
                className={`pill-btn ${numberType === 2 ? 'active' : ''}`}
                onClick={() => setNumberType(2)}
              >
                00–99 ({money(settings.priceTwoDigit)}/unit/city)
              </button>
              <button
                type="button"
                className={`pill-btn ${numberType === 1 ? 'active' : ''}`}
                onClick={() => setNumberType(1)}
              >
                0–9 ({money(settings.priceOneDigit)}/unit/city)
              </button>
            </div>

            {/* Quick Search */}
            <div className="search-box">
              <Search size={14} className="text-muted" />
              <input
                type="text"
                placeholder="Jump to #..."
                value={searchNum}
                onChange={(e) => setSearchNum(e.target.value)}
                className="search-input"
                maxLength={2}
              />
              {searchNum && (
                <button
                  type="button"
                  className="btn-clear-search"
                  onClick={() => setSearchNum('')}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* ENLARGED NUMBER TILES GRID WITH ALL CITIES WATERMARK */}
          <div className="number-grid-container">
            <div className="city-watermark-bg" aria-hidden="true">
              <span>ALL CITIES</span>
            </div>

            <div
              className={`number-tiles-grid ${
                numberType === 1 ? 'single-digit-grid' : ''
              }`}
            >
              {filteredNumbers.map((num) => {
                const qtyAll = getNumQuantityForAllCities(num, numberType);
                const isTileSelected = qtyAll > 0;

                return (
                  <div
                    key={num}
                    className={`number-tile ${isTileSelected ? 'tile-selected' : ''}`}
                    style={
                      isTileSelected
                        ? {
                            backgroundColor: '#eff6ff',
                            borderColor: '#3b82f6',
                            boxShadow: '0 0 0 2px #3b82f6',
                          }
                        : {
                            backgroundColor: '#ffffff',
                            borderColor: '#e2e8f0',
                          }
                    }
                  >
                    <span className="tile-city-watermark" aria-hidden="true">
                      ALL
                    </span>

                    {/* Tile Header & Big Number */}
                    <button
                      type="button"
                      className="tile-main-btn"
                      onClick={() => updateQuantityForAllCities(numberType, num, 1)}
                      title={`Add 1 unit of #${num} to ALL ${enabledCities.length} cities`}
                    >
                      <span
                        className="tile-number"
                        style={{
                          color: isTileSelected ? '#2563eb' : '#0f172a',
                        }}
                      >
                        {num}
                      </span>
                      {isTileSelected && (
                        <span className="tile-sales-count" style={{ color: '#2563eb' }}>
                          {qtyAll} in all {enabledCities.length}c
                        </span>
                      )}
                    </button>

                    {/* Quantity Controls */}
                    <div className="tile-stepper">
                      <button
                        type="button"
                        className="step-btn step-minus"
                        disabled={qtyAll <= 0}
                        style={{
                          borderColor: isTileSelected ? '#93c5fd' : '#e2e8f0',
                          color: isTileSelected ? '#2563eb' : '#94a3b8',
                          backgroundColor: '#ffffff',
                        }}
                        onClick={() => updateQuantityForAllCities(numberType, num, -1)}
                      >
                        <Minus size={12} />
                      </button>

                      <input
                        type="number"
                        min="0"
                        className={`step-input ${qtyAll > 0 ? 'has-val' : ''}`}
                        style={{
                          borderColor: isTileSelected ? '#3b82f6' : '#e2e8f0',
                          color: isTileSelected ? '#2563eb' : '#1e293b',
                          backgroundColor: '#ffffff',
                        }}
                        value={qtyAll || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateQuantityForAllCities(
                            numberType,
                            num,
                            isNaN(val) ? 0 : val,
                            true
                          );
                        }}
                      />

                      <button
                        type="button"
                        className="step-btn step-plus"
                        style={{
                          backgroundColor: isTileSelected ? '#2563eb' : '#eff6ff',
                          borderColor: isTileSelected ? '#2563eb' : '#bfdbfe',
                          color: isTileSelected ? '#ffffff' : '#2563eb',
                        }}
                        onClick={() => updateQuantityForAllCities(numberType, num, 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Quick Add Buttons */}
                    <div className="tile-quick-addons">
                      <button
                        type="button"
                        className="quick-pill"
                        style={{
                          backgroundColor: '#ffffff',
                          borderColor: '#bfdbfe',
                          color: '#2563eb',
                        }}
                        onClick={() => updateQuantityForAllCities(numberType, num, 5)}
                        title="Add 5 units across all cities"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        className="quick-pill"
                        style={{
                          backgroundColor: '#2563eb',
                          borderColor: '#2563eb',
                          color: '#ffffff',
                        }}
                        onClick={() => updateQuantityForAllCities(numberType, num, 10)}
                        title="Add 10 units across all cities"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STICKY BOTTOM ACTION BAR ON EVERY CITY PAGE */}
          <div className="item-page-action-bar">
            {selectedItems.length > 0 && (
              <div className="selected-items-preview" style={{ padding: '6px 8px', marginBottom: 2 }}>
                <div className="preview-header" style={{ marginBottom: 4 }}>
                  <div className="flex-row items-center gap-2">
                    <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}>
                      Selected Items ({selectedItems.length})
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      Editable Cart
                    </span>
                  </div>
                  <button type="button" className="btn-text-danger" onClick={clearDraft} style={{ fontSize: 11 }}>
                    <Trash2 size={12} />
                    <span>Clear All</span>
                  </button>
                </div>

                <div className="selected-chips-row">
                  {selectedItems.map((it) => {
                    const itTheme = getCityColorTheme(it.cityId, cities);
                    return (
                      <div
                        key={`${it.cityId}-${it.type}-${it.number}`}
                        className="item-chip"
                        style={{ borderColor: itTheme.border }}
                      >
                        <span
                          className="chip-city"
                          style={{ backgroundColor: itTheme.primary, color: '#ffffff' }}
                        >
                          {it.cityName.slice(0, 3)}
                        </span>

                        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>
                          {it.type === 2 ? '2D' : '1D'}
                        </span>

                        <b className="chip-num" style={{ color: itTheme.primary }}>
                          #{it.number}
                        </b>

                        <div className="chip-stepper">
                          <button
                            type="button"
                            className="chip-step-btn"
                            onClick={() => updateQuantity(it.cityId, it.type, it.number, -1)}
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min="1"
                            className="chip-qty-input"
                            value={it.units}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              updateQuantity(
                                it.cityId,
                                it.type,
                                it.number,
                                isNaN(val) ? 0 : val,
                                true
                              );
                            }}
                          />

                          <button
                            type="button"
                            className="chip-step-btn"
                            onClick={() => updateQuantity(it.cityId, it.type, it.number, 1)}
                          >
                            +
                          </button>
                        </div>

                        <span className="chip-amt">{money(it.amount)}</span>

                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => updateQuantity(it.cityId, it.type, it.number, 0, true)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customer input & Totals row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div className="checkout-inputs" style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Customer Name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="customer-input"
                  style={{ width: '100%', height: 34, fontSize: 12 }}
                />
              </div>

              <div className="checkout-summary" style={{ textAlign: 'right' }}>
                <div className="summary-units" style={{ fontSize: 12 }}>{totalUnits} units</div>
                <div className="summary-amount" style={{ fontSize: 16 }}>{money(totalAmount)}</div>
              </div>
            </div>

            {/* Action Buttons: Continue (Back to Home) vs Finalise & Generate Receipt */}
            <div className="item-action-row">
              <button
                type="button"
                className="btn-continue-cities"
                onClick={() => {
                  setScreenView('cities');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title="Keep existing cart and return to home page"
              >
                <Layers size={16} />
                <span>Continue (Home with Cart)</span>
              </button>

              <button
                type="button"
                className="btn-finalise-receipt"
                disabled={isLocked || selectedItems.length === 0}
                onClick={() => handleCreateBill(true)}
                title="Finalise bill and print thermal receipt"
              >
                <Printer size={18} />
                <span>{isLocked ? 'LOCKED' : 'Finalise & Generate Receipt'}</span>
              </button>
            </div>
          </div>
        </div>

      ) : (
        /* SCREEN VIEW 2: CITY ITEM PAGE (When user clicked a city block) */
        <div className="item-view-container">
          {/* Top Bar: Back to Cities button, City title & badge, Draw time */}
          <div className="item-page-top-bar">
            <button
              type="button"
              className="btn-back-cities"
              onClick={() => {
                setScreenView('cities');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Cities</span>
            </button>

            <div className="item-page-city-badge">
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: activeCityTheme.primary,
                  boxShadow: `0 0 8px ${activeCityTheme.primary}`,
                }}
              />
              <span className="item-page-city-name" style={{ color: activeCityTheme.primary }}>
                {cityMap[selectedCityId] || 'City'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: activeCityTheme.light,
                  color: activeCityTheme.text,
                  fontWeight: 700,
                }}
              >
                {money(numberType === 2 ? settings.priceTwoDigit : settings.priceOneDigit)}/unit
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Draw: <b>{fmtTime(currentSlot)}</b>
              </span>
            </div>
          </div>

      {/* Type & Filter Toolbar */}
      <div className="billing-toolbar">
        <div className="type-toggle-pills">
          <button
            type="button"
            className={`pill-btn ${numberType === 2 ? 'active' : ''}`}
            onClick={() => setNumberType(2)}
          >
            00–99 ({money(settings.priceTwoDigit)}/unit)
          </button>
          <button
            type="button"
            className={`pill-btn ${numberType === 1 ? 'active' : ''}`}
            onClick={() => setNumberType(1)}
          >
            0–9 ({money(settings.priceOneDigit)}/unit)
          </button>
        </div>

        {/* Quick Search */}
        <div className="search-box">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            placeholder="Jump to #..."
            value={searchNum}
            onChange={(e) => setSearchNum(e.target.value)}
            className="search-input"
            maxLength={2}
          />
          {searchNum && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchNum('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Admin Counter Selector */}
      {role === 'admin' && (
        <div className="admin-counter-select-row">
          <label>Billing Counter (Admin Override):</label>
          <select
            value={selectedCounter}
            onChange={(e) => setSelectedCounter(e.target.value)}
            className="select-counter"
          >
            {(settings.counters || []).map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} {c.enabled ? '' : '(Disabled)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ENLARGED NUMBER TILES GRID WITH CITY WATERMARK */}
      <div className="number-grid-container">
        {/* City Watermark behind item boxes */}
        <div className="city-watermark-bg" aria-hidden="true">
          <span>{cityMap[selectedCityId] || 'CITY'}</span>
        </div>

        <div
          className={`number-tiles-grid ${
            numberType === 1 ? 'single-digit-grid' : ''
          }`}
        >
          {filteredNumbers.map((num) => {
            const key = `${selectedCityId}|${numberType}|${num}`;
            const qty = draftQuantities[key] || 0;
            const salesCount = numberSalesCounts[num] || 0;
            const isTileSelected = qty > 0;

            let heatClass = '';
            if (isTileSelected) {
              heatClass = 'tile-selected';
            } else if (salesCount > 0 && salesCount === maxSales && maxSales > 1) {
              heatClass = 'tile-hot';
            }

            return (
              <div
                key={num}
                className={`number-tile ${heatClass}`}
                style={
                  isTileSelected
                    ? {
                        backgroundColor: activeCityTheme.light,
                        borderColor: activeCityTheme.primary,
                        boxShadow: `0 0 0 2px ${activeCityTheme.primary}`,
                      }
                    : {
                        backgroundColor: activeCityTheme.boxBg,
                        borderColor: activeCityTheme.boxBorder,
                      }
                }
              >
                {/* Subtle City Watermark inside item box */}
                <span className="tile-city-watermark" aria-hidden="true">
                  {cityMap[selectedCityId] || ''}
                </span>

                {/* Tile Header & Big Number */}
                <button
                  type="button"
                  className="tile-main-btn"
                  onClick={() => updateQuantity(selectedCityId, numberType, num, 1)}
                  title={`Tap to add 1 unit to #${num}`}
                >
                  <span
                    className="tile-number"
                    style={{
                      color: isTileSelected
                        ? activeCityTheme.primary
                        : activeCityTheme.text,
                    }}
                  >
                    {num}
                  </span>
                  {salesCount > 0 && (
                    <span className="tile-sales-count">{salesCount} sold</span>
                  )}
                </button>

                {/* Quantity Controls */}
                <div className="tile-stepper">
                  <button
                    type="button"
                    className="step-btn step-minus"
                    disabled={qty <= 0}
                    style={{
                      borderColor: isTileSelected
                        ? activeCityTheme.border
                        : activeCityTheme.boxBorder,
                      color: isTileSelected ? activeCityTheme.primary : '#94a3b8',
                      backgroundColor: '#ffffff',
                    }}
                    onClick={() => updateQuantity(selectedCityId, numberType, num, -1)}
                  >
                    <Minus size={12} />
                  </button>

                  <input
                    type="number"
                    min="0"
                    className={`step-input ${qty > 0 ? 'has-val' : ''}`}
                    style={{
                      borderColor: isTileSelected
                        ? activeCityTheme.primary
                        : activeCityTheme.boxBorder,
                      color: isTileSelected ? activeCityTheme.primary : '#1e293b',
                      backgroundColor: '#ffffff',
                    }}
                    value={qty || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateQuantity(
                        selectedCityId,
                        numberType,
                        num,
                        isNaN(val) ? 0 : val,
                        true
                      );
                    }}
                  />

                  <button
                    type="button"
                    className="step-btn step-plus"
                    style={{
                      backgroundColor: isTileSelected
                        ? activeCityTheme.primary
                        : activeCityTheme.light,
                      borderColor: isTileSelected
                        ? activeCityTheme.primary
                        : activeCityTheme.boxBorder,
                      color: isTileSelected ? '#ffffff' : activeCityTheme.primary,
                    }}
                    onClick={() => updateQuantity(selectedCityId, numberType, num, 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Quick Add Buttons & All Cities Trigger on Tile */}
                <div className="tile-quick-addons">
                  <button
                    type="button"
                    className="quick-pill"
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: activeCityTheme.border,
                      color: activeCityTheme.primary,
                    }}
                    onClick={() => handleQuickAdd(num, 5)}
                    title="Add 5 units to this city"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    className="quick-pill"
                    style={{
                      backgroundColor: activeCityTheme.primary,
                      borderColor: activeCityTheme.primary,
                      color: '#ffffff',
                    }}
                    onClick={() => handleAddNumberToAllCities(num, numberType, 1)}
                    title={`Buy #${num} in ALL cities`}
                  >
                    All
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR ON ITEM PAGE (With Continue vs Finalise as requested) */}
      <div className="item-page-action-bar">
        {selectedItems.length > 0 && (
          <div className="selected-items-preview" style={{ padding: '6px 8px', marginBottom: 2 }}>
            <div className="preview-header" style={{ marginBottom: 4 }}>
              <div className="flex-row items-center gap-2">
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}>
                  Selected Items ({selectedItems.length})
                </span>
                <span
                  style={{
                    fontSize: 10,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  Editable Cart
                </span>
              </div>
              <button type="button" className="btn-text-danger" onClick={clearDraft} style={{ fontSize: 11 }}>
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            </div>

            {/* Editable chips row with steppers & direct unit editing */}
            <div className="selected-chips-row">
              {selectedItems.map((it) => {
                const itTheme = getCityColorTheme(it.cityId, cities);
                return (
                  <div
                    key={`${it.cityId}-${it.type}-${it.number}`}
                    className="item-chip"
                    style={{ borderColor: itTheme.border }}
                  >
                    <span
                      className="chip-city"
                      style={{ backgroundColor: itTheme.primary, color: '#ffffff' }}
                    >
                      {it.cityName.slice(0, 3)}
                    </span>

                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>
                      {it.type === 2 ? '2D' : '1D'}
                    </span>

                    <b className="chip-num" style={{ color: itTheme.primary }}>
                      #{it.number}
                    </b>

                    <div className="chip-stepper">
                      <button
                        type="button"
                        className="chip-step-btn"
                        onClick={() => updateQuantity(it.cityId, it.type, it.number, -1)}
                        title="Decrease units"
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min="1"
                        className="chip-qty-input"
                        value={it.units}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateQuantity(
                            it.cityId,
                            it.type,
                            it.number,
                            isNaN(val) ? 0 : val,
                            true
                          );
                        }}
                        title="Type to change units directly"
                      />

                      <button
                        type="button"
                        className="chip-step-btn"
                        onClick={() => updateQuantity(it.cityId, it.type, it.number, 1)}
                        title="Increase units"
                      >
                        +
                      </button>
                    </div>

                    <span className="chip-amt">{money(it.amount)}</span>

                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => updateQuantity(it.cityId, it.type, it.number, 0, true)}
                      title="Remove this item"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Customer input & Totals row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div className="checkout-inputs" style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Customer Name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="customer-input"
              style={{ width: '100%', height: 34, fontSize: 12 }}
            />
          </div>

          <div className="checkout-summary" style={{ textAlign: 'right' }}>
            <div className="summary-units" style={{ fontSize: 12 }}>{totalUnits} units</div>
            <div className="summary-amount" style={{ fontSize: 16 }}>{money(totalAmount)}</div>
          </div>
        </div>

        {/* Action Buttons: Continue (Add More Cities) vs Finalise & Generate Receipt */}
        <div className="item-action-row">
          <button
            type="button"
            className="btn-continue-cities"
            onClick={() => {
              setScreenView('cities');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title="Keep items in cart and select another city"
          >
            <Layers size={16} />
            <span>Continue (Add More Cities)</span>
          </button>

          <button
            type="button"
            className="btn-finalise-receipt"
            disabled={isLocked || selectedItems.length === 0}
            onClick={handleCreateBill}
            title="Finalise bill and print thermal receipt"
          >
            <Printer size={18} />
            <span>{isLocked ? 'LOCKED' : 'Finalise & Generate Receipt'}</span>
          </button>
        </div>
      </div>
    </div>
  )}
</div>
  );
};
