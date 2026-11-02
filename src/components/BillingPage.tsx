import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  Sparkles,
  Check,
  Bluetooth,
  Globe,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  History,
  ListPlus,
  Edit3,
  X,
  Trophy,
  Layers,
  ArrowLeft,
  Calendar,
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
  const [screenView, setScreenView] = useState<'cities' | 'items'>('cities');
  const [chartDate, setChartDate] = useState<string>(today());
  const [showCartDrawer, setShowCartDrawer] = useState<boolean>(false);

  // All Cities Quick-Addition State
  const [allCityNumber, setAllCityNumber] = useState<string>('');
  const [allCityType, setAllCityType] = useState<1 | 2>(2);
  const [allCityUnits, setAllCityUnits] = useState<number>(1);

  // Previous Slots Results & Repeat Tool State
  const [showPrevResultsPanel, setShowPrevResultsPanel] = useState<boolean>(false);
  const [manualResultMode, setManualResultMode] = useState<boolean>(false);
  const [repeatUnits, setRepeatUnits] = useState<number>(1);
  const [repeatScope, setRepeatScope] = useState<'both' | 'double' | 'single'>('both');
  const [manualSlotResults, setManualSlotResults] = useState<
    Record<string, { number: string; type: 1 | 2 }>
  >({});

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

  // All time slots & previous time slots of the day
  const allSlots = useMemo(() => timeSlots(settings), [settings]);
  const previousSlots = useMemo(() => {
    if (!currentSlot) return allSlots;
    const [curH, curM] = currentSlot.split(':').map(Number);
    const curMins = curH * 60 + curM;
    const prev = allSlots.filter((s) => {
      const [sh, sm] = s.split(':').map(Number);
      return sh * 60 + sm < curMins;
    });
    return prev.length > 0 ? prev : allSlots;
  }, [allSlots, currentSlot]);

  const [selectedPrevSlot, setSelectedPrevSlot] = useState<string>(() => {
    return previousSlots.length > 0
      ? previousSlots[previousSlots.length - 1]
      : allSlots[0] || '09:00';
  });

  // Keep selectedPrevSlot in sync if previous slots change
  useEffect(() => {
    if (previousSlots.length > 0 && !previousSlots.includes(selectedPrevSlot)) {
      setSelectedPrevSlot(previousSlots[previousSlots.length - 1]);
    }
  }, [previousSlots, selectedPrevSlot]);

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

  // Add a specific number across ALL enabled cities
  const handleAddNumberToAllCities = (
    targetNum?: string,
    targetType?: 1 | 2,
    unitsToAdd?: number
  ) => {
    const raw = (targetNum !== undefined ? targetNum : allCityNumber).trim();
    const type = targetType !== undefined ? targetType : allCityType;
    const units = unitsToAdd !== undefined ? unitsToAdd : allCityUnits;

    if (!raw) {
      alert('Please enter a number to add for all cities.');
      return;
    }

    const num = type === 2 ? raw.padStart(2, '0') : raw;
    if (type === 2 && (isNaN(Number(num)) || Number(num) < 0 || Number(num) > 99)) {
      alert('Please enter a valid 2-digit number (00-99).');
      return;
    }
    if (type === 1 && (isNaN(Number(num)) || Number(num) < 0 || Number(num) > 9)) {
      alert('Please enter a valid single-digit number (0-9).');
      return;
    }

    setDraftQuantities((prev) => {
      const nextState = { ...prev };
      enabledCities.forEach((c) => {
        const key = `${c.id}|${type}|${num}`;
        nextState[key] = (nextState[key] || 0) + units;
      });
      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {}
      return nextState;
    });

    setStatusMessage(
      `Added #${num} (${units} units each) to all ${enabledCities.length} cities!`
    );
    setTimeout(() => setStatusMessage(''), 3000);
    setAllCityNumber('');
  };

  // Declared results for the selected previous slot on today's date
  const slotDeclaredResults = useMemo(() => {
    if (!results) return [];
    const todayStr = today();
    return results.filter((r) => r.date === todayStr && r.slot === selectedPrevSlot);
  }, [results, selectedPrevSlot]);

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

  // Repeat declared results of selected slot to current bill draft (with Tens-Digit rule and Double/Single/Both selector)
  const handleRepeatSlotResults = (
    unitsToBuy: number = 1,
    scope: 'both' | 'double' | 'single' = repeatScope
  ) => {
    if (slotDeclaredResults.length === 0) {
      alert('No declared results found for this slot.');
      return;
    }

    setDraftQuantities((prev) => {
      const nextState = { ...prev };
      slotDeclaredResults.forEach((r) => {
        const num = String(r.number).trim();
        if (r.type === 2) {
          const doubleNum = num.padStart(2, '0');
          const singleNum = doubleNum.charAt(0); // Tens digit rule: 35 -> 3, 57 -> 5

          if (scope === 'both' || scope === 'double') {
            const key2D = `${r.cityId}|2|${doubleNum}`;
            nextState[key2D] = (nextState[key2D] || 0) + unitsToBuy;
          }
          if (scope === 'both' || scope === 'single') {
            const key1D = `${r.cityId}|1|${singleNum}`;
            nextState[key1D] = (nextState[key1D] || 0) + unitsToBuy;
          }
        } else {
          if (scope === 'both' || scope === 'single') {
            const key1D = `${r.cityId}|1|${num}`;
            nextState[key1D] = (nextState[key1D] || 0) + unitsToBuy;
          }
        }
      });
      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {}
      return nextState;
    });

    const scopeLabel =
      scope === 'both'
        ? 'Both (2D & 1D Tens)'
        : scope === 'double'
        ? 'Double Only (2D)'
        : 'Single Only (1D)';
    setStatusMessage(
      `Loaded ${scopeLabel} from slot ${fmtTime(selectedPrevSlot)} into cart (${unitsToBuy} unit each)!`
    );
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Load manual results into cart (and optionally save as declared result)
  const handleLoadManualResultsToCart = (
    unitsToBuy: number = 1,
    saveAsResult: boolean = false,
    scope: 'both' | 'double' | 'single' = repeatScope
  ) => {
    const entries = Object.entries(manualSlotResults).filter(
      ([_, val]) => val && val.number && val.number.trim()
    );

    if (entries.length === 0) {
      alert('Please enter at least one winning number for a city.');
      return;
    }

    setDraftQuantities((prev) => {
      const nextState = { ...prev };
      entries.forEach(([cityId, val]) => {
        const num = val.number.trim();
        if (val.type === 2) {
          const doubleNum = num.padStart(2, '0');
          const singleNum = doubleNum.charAt(0); // Tens digit rule: 35 -> 3, 57 -> 5

          if (scope === 'both' || scope === 'double') {
            const key2D = `${cityId}|2|${doubleNum}`;
            nextState[key2D] = (nextState[key2D] || 0) + unitsToBuy;
          }
          if (scope === 'both' || scope === 'single') {
            const key1D = `${cityId}|1|${singleNum}`;
            nextState[key1D] = (nextState[key1D] || 0) + unitsToBuy;
          }
        } else {
          if (scope === 'both' || scope === 'single') {
            const key1D = `${cityId}|1|${num}`;
            nextState[key1D] = (nextState[key1D] || 0) + unitsToBuy;
          }
        }
      });
      try {
        localStorage.setItem('luckyDesk_billDraft', JSON.stringify(nextState));
      } catch {}
      return nextState;
    });

    if (saveAsResult && onResultDeclared) {
      const todayStr = today();
      entries.forEach(([cityId, val]) => {
        const num = val.number.trim();
        if (val.type === 2) {
          const doubleNum = num.padStart(2, '0');
          const singleNum = doubleNum.charAt(0);

          // Declare 2D result (₹950/unit)
          const newRes2D: Result = {
            date: todayStr,
            slot: selectedPrevSlot,
            cityId,
            cityName: cityMap[cityId] || 'City',
            type: 2,
            number: doubleNum,
            prizePerUnit: 950,
            totalPrize: 0,
            winners: [],
          };
          onResultDeclared(newRes2D);

          // Auto declare 1D result with tens digit (₹95/unit)
          const newRes1D: Result = {
            date: todayStr,
            slot: selectedPrevSlot,
            cityId,
            cityName: cityMap[cityId] || 'City',
            type: 1,
            number: singleNum,
            prizePerUnit: 95,
            totalPrize: 0,
            winners: [],
          };
          onResultDeclared(newRes1D);
        } else {
          const newRes: Result = {
            date: todayStr,
            slot: selectedPrevSlot,
            cityId,
            cityName: cityMap[cityId] || 'City',
            type: 1,
            number: num,
            prizePerUnit: 95,
            totalPrize: 0,
            winners: [],
          };
          onResultDeclared(newRes);
        }
      });
    }

    const scopeLabel =
      scope === 'both'
        ? 'Both (2D & 1D)'
        : scope === 'double'
        ? 'Double Only (2D)'
        : 'Single Only (1D)';
    setStatusMessage(
      `Loaded ${scopeLabel} from slot ${fmtTime(selectedPrevSlot)} into cart!`
    );
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleCreateBill = async () => {
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
                    {hasCart ? (
                      <>
                        <div className="big-city-num-text" style={{ color: '#fbbf24' }}>
                          {itemsForCity.length === 1
                            ? `#${itemsForCity[0].number}`
                            : `${itemsForCity.length} Nos`}
                        </div>
                        <div className="big-city-cart-badge">{unitsForCity} Units Selected</div>
                      </>
                    ) : latestResult ? (
                      <>
                        <div className="big-city-num-text">
                          {String(latestResult.number).padStart(latestResult.type === 2 ? 2 : 1, '0')}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#a7f3d0', fontWeight: 700 }}>
                          {latestResult.type === 2 ? '2-Digit' : '1-Digit'}
                        </div>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  <div className="big-city-status-row">
                    <span
                      className="big-city-status-dot"
                      style={{
                        backgroundColor: hasCart ? '#10b981' : latestResult ? '#ffffff' : '#38bdf8',
                        boxShadow: hasCart ? '0 0 8px #10b981' : 'none',
                      }}
                    />
                    <span>
                      {hasCart
                        ? `${unitsForCity} Units in Cart`
                        : latestResult
                        ? 'Published'
                        : 'Open for Billing'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

      {/* FEATURE 1: ALL CITIES QUICK-ENTRY BAR */}
      <div className="all-cities-bar">
        <div className="all-cities-header">
          <div className="flex-row items-center gap-2">
            <Globe size={16} className="text-blue" />
            <b style={{ fontSize: 13, color: '#1e3a8a' }}>
              Buy for ALL {enabledCities.length} Cities
            </b>
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Instant receipt entry for every city
          </span>
        </div>

        <div className="all-cities-controls">
          <div className="type-toggle-mini" style={{ margin: 0 }}>
            <button
              type="button"
              className={`toggle-mini-btn ${allCityType === 2 ? 'active' : ''}`}
              onClick={() => setAllCityType(2)}
            >
              00–99
            </button>
            <button
              type="button"
              className={`toggle-mini-btn ${allCityType === 1 ? 'active' : ''}`}
              onClick={() => setAllCityType(1)}
            >
              0–9
            </button>
          </div>

          <div className="all-cities-input-group">
            <input
              type="text"
              placeholder={allCityType === 2 ? '00-99' : '0-9'}
              maxLength={allCityType === 2 ? 2 : 1}
              value={allCityNumber}
              onChange={(e) => setAllCityNumber(e.target.value.replace(/\D/g, ''))}
              className="all-cities-num-input"
              title="Enter number to buy in all cities"
            />

            <div className="all-cities-units-group">
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                Units:
              </span>
              <input
                type="number"
                min="1"
                value={allCityUnits}
                onChange={(e) =>
                  setAllCityUnits(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="all-cities-units-input"
              />
              <div className="quick-unit-chips">
                {[1, 5, 10, 20].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`quick-unit-chip ${allCityUnits === u ? 'active' : ''}`}
                    onClick={() => setAllCityUnits(u)}
                  >
                    ×{u}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-add-all-cities"
              onClick={() => handleAddNumberToAllCities()}
            >
              <Sparkles size={14} />
              <span>
                Add {allCityNumber ? `#${allCityNumber} ` : ''}to All {enabledCities.length} Cities
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* FEATURE 2: PREVIOUS TIME SLOTS RESULTS & QUICK REPEAT TOOL */}
      <div className="prev-results-card">
        <div
          className="prev-results-header"
          onClick={() => setShowPrevResultsPanel(!showPrevResultsPanel)}
        >
          <div className="flex-row items-center gap-2">
            <History size={16} className="text-amber" />
            <b style={{ fontSize: 13, color: '#92400e' }}>
              Previous Slot Results & Repeat Purchase
            </b>
            <span
              style={{
                fontSize: 10,
                background: '#fef3c7',
                color: '#b45309',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              Customer Repeat Tool
            </span>
          </div>
          <div className="flex-row items-center gap-1 text-muted" style={{ fontSize: 12 }}>
            <span>{showPrevResultsPanel ? 'Hide' : 'Open Results'}</span>
            {showPrevResultsPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {showPrevResultsPanel && (
          <div className="prev-results-body">
            {/* Slot selector chips */}
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: 4,
                }}
              >
                Select Previous Time Slot:
              </div>
              <div className="prev-slots-chips">
                {previousSlots.map((slot) => {
                  const isSel = slot === selectedPrevSlot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`prev-slot-btn ${isSel ? 'active' : ''}`}
                      onClick={() => setSelectedPrevSlot(slot)}
                    >
                      {fmtTime(slot)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle between Declared Slot Repeat and Manual Entry */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '8px 0',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                Slot: <b>{fmtTime(selectedPrevSlot)}</b>
              </span>
              <button
                type="button"
                className="btn-text-primary"
                style={{ fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', color: '#2563eb' }}
                onClick={() => setManualResultMode(!manualResultMode)}
              >
                {manualResultMode
                  ? '← Show Declared Results'
                  : '✍️ Enter Results Manually'}
              </button>
            </div>

            {/* Declared Results View */}
            {!manualResultMode ? (
              <div>
                {slotDeclaredResults.length > 0 ? (
                  <>
                    <div className="prev-results-grid">
                      {slotDeclaredResults.map((r, i) => {
                        const cTheme = getCityColorTheme(r.cityId, cities);
                        const is2D = r.type === 2;
                        const doubleNum = String(r.number).trim().padStart(2, '0');
                        const tensDigit = doubleNum.charAt(0);

                        return (
                          <div
                            key={i}
                            className="prev-result-item"
                            style={{
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 2,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                width: '100%',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: cTheme.primary,
                                }}
                              >
                                {cityMap[r.cityId] || r.cityName}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {is2D ? '2D & Tens' : '1D'}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: 14,
                                  color: '#1e293b',
                                }}
                              >
                                #{r.number}
                              </span>
                              {is2D && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: '#059669',
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    fontWeight: 700,
                                  }}
                                >
                                  Tens (1D): #{tensDigit}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Scope Selector: Double, Single, or Both */}
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-main)',
                        }}
                      >
                        Repeat Selection:
                      </span>
                      <div className="type-toggle-mini" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className={`toggle-mini-btn ${
                            repeatScope === 'both' ? 'active' : ''
                          }`}
                          style={{ padding: '3px 9px', fontSize: 11 }}
                          onClick={() => setRepeatScope('both')}
                        >
                          Both (2D + Tens 1D)
                        </button>
                        <button
                          type="button"
                          className={`toggle-mini-btn ${
                            repeatScope === 'double' ? 'active' : ''
                          }`}
                          style={{ padding: '3px 9px', fontSize: 11 }}
                          onClick={() => setRepeatScope('double')}
                        >
                          Double Only (2D)
                        </button>
                        <button
                          type="button"
                          className={`toggle-mini-btn ${
                            repeatScope === 'single' ? 'active' : ''
                          }`}
                          style={{ padding: '3px 9px', fontSize: 11 }}
                          onClick={() => setRepeatScope('single')}
                        >
                          Single Only (1D)
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Units:</span>
                      <input
                        type="number"
                        min="1"
                        value={repeatUnits}
                        onChange={(e) =>
                          setRepeatUnits(
                            Math.max(1, parseInt(e.target.value, 10) || 1)
                          )
                        }
                        style={{
                          width: 48,
                          height: 32,
                          textAlign: 'center',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          fontWeight: 700,
                        }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => handleRepeatSlotResults(repeatUnits, repeatScope)}
                      >
                        <RotateCcw size={14} />
                        <span>
                          Repeat {slotDeclaredResults.length} Results (
                          {repeatScope === 'both'
                            ? 'Both 2D & 1D'
                            : repeatScope === 'double'
                            ? '2D Only'
                            : '1D Tens Only'}
                          )
                        </span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      background: '#fffbeb',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#92400e',
                    }}
                  >
                    No official draw result was declared yet for{' '}
                    <b>{fmtTime(selectedPrevSlot)}</b>.{' '}
                    <button
                      type="button"
                      style={{
                        color: '#2563eb',
                        fontWeight: 700,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      onClick={() => setManualResultMode(true)}
                    >
                      Click here to enter results manually
                    </button>{' '}
                    to repeat.
                  </div>
                )}
              </div>
            ) : (
              /* Manual Result Entry View */
              <div
                style={{
                  background: '#f8fafc',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#64748b',
                    marginBottom: 8,
                  }}
                >
                  Type the winning numbers for slot <b>{fmtTime(selectedPrevSlot)}</b>{' '}
                  to load into cart for customer purchase:
                </div>

                <div className="prev-manual-grid">
                  {enabledCities.map((c) => {
                    const val = manualSlotResults[c.id] || { number: '', type: 2 };
                    const cTheme = getCityColorTheme(c.id, cities);
                    const clean = (val.number || '').trim();
                    const tens =
                      val.type === 2 && clean.length > 0
                        ? clean.padStart(2, '0').charAt(0)
                        : '';

                    return (
                      <div key={c.id} className="prev-manual-city-field">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <b style={{ fontSize: 11, color: cTheme.primary }}>
                            {c.name}
                          </b>
                          <div className="type-toggle-mini" style={{ margin: 0 }}>
                            <button
                              type="button"
                              className={`toggle-mini-btn ${
                                val.type === 2 ? 'active' : ''
                              }`}
                              style={{ padding: '1px 5px', fontSize: 9 }}
                              onClick={() =>
                                setManualSlotResults((prev) => ({
                                  ...prev,
                                  [c.id]: { ...(prev[c.id] || { number: '' }), type: 2 },
                                }))
                              }
                            >
                              2D
                            </button>
                            <button
                              type="button"
                              className={`toggle-mini-btn ${
                                val.type === 1 ? 'active' : ''
                              }`}
                              style={{ padding: '1px 5px', fontSize: 9 }}
                              onClick={() =>
                                setManualSlotResults((prev) => ({
                                  ...prev,
                                  [c.id]: { ...(prev[c.id] || { number: '' }), type: 1 },
                                }))
                              }
                            >
                              1D
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder={val.type === 2 ? '00-99' : '0-9'}
                          maxLength={val.type === 2 ? 2 : 1}
                          value={val.number}
                          onChange={(e) => {
                            const cleanInput = e.target.value.replace(/\D/g, '');
                            setManualSlotResults((prev) => ({
                              ...prev,
                              [c.id]: { ...(prev[c.id] || { type: 2 }), number: cleanInput },
                            }));
                          }}
                          className="prev-manual-city-input"
                          style={{ borderColor: cTheme.border }}
                        />

                        {val.type === 2 && tens && (
                          <div
                            style={{
                              fontSize: 10,
                              color: '#059669',
                              fontWeight: 700,
                              marginTop: 2,
                              textAlign: 'center',
                            }}
                          >
                            Tens (1D): #{tens}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Scope selector for Manual Load: Both, Double, or Single */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-main)',
                    }}
                  >
                    Items to Load:
                  </span>
                  <div className="type-toggle-mini" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className={`toggle-mini-btn ${
                        repeatScope === 'both' ? 'active' : ''
                      }`}
                      style={{ padding: '3px 9px', fontSize: 11 }}
                      onClick={() => setRepeatScope('both')}
                    >
                      Both (2D + Tens 1D)
                    </button>
                    <button
                      type="button"
                      className={`toggle-mini-btn ${
                        repeatScope === 'double' ? 'active' : ''
                      }`}
                      style={{ padding: '3px 9px', fontSize: 11 }}
                      onClick={() => setRepeatScope('double')}
                    >
                      Double Only (2D)
                    </button>
                    <button
                      type="button"
                      className={`toggle-mini-btn ${
                        repeatScope === 'single' ? 'active' : ''
                      }`}
                      style={{ padding: '3px 9px', fontSize: 11 }}
                      onClick={() => setRepeatScope('single')}
                    >
                      Single Only (1D)
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Units:</span>
                  <input
                    type="number"
                    min="1"
                    value={repeatUnits}
                    onChange={(e) =>
                      setRepeatUnits(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    style={{
                      width: 48,
                      height: 32,
                      textAlign: 'center',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() =>
                      handleLoadManualResultsToCart(repeatUnits, false, repeatScope)
                    }
                  >
                    <Plus size={14} />
                    <span>
                      Load into Cart (
                      {repeatScope === 'both'
                        ? '2D & 1D'
                        : repeatScope === 'double'
                        ? '2D Only'
                        : '1D Only'}
                      )
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() =>
                      handleLoadManualResultsToCart(repeatUnits, true, repeatScope)
                    }
                    title="Also records this as the official result in the system (2D & 1D tens digit)"
                  >
                    <Trophy size={14} className="text-amber" />
                    <span>Save Result & Load to Cart</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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

          {/* Quick City Switcher Pills if user wants to change city without leaving item view */}
          <div className="city-selector-section" style={{ marginBottom: 10 }}>
            <div className="city-chips-scroll">
              {enabledCities.map((c) => {
                const isSelected = c.id === selectedCityId;
                const cTheme = getCityColorTheme(c.id, cities);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`city-btn-large ${isSelected ? 'active' : ''}`}
                    style={{
                      backgroundColor: isSelected ? cTheme.primary : '#ffffff',
                      borderColor: isSelected ? cTheme.primary : cTheme.border,
                      color: isSelected ? '#ffffff' : cTheme.text,
                      padding: '6px 14px',
                      minHeight: 38,
                      fontSize: 13,
                    }}
                    onClick={() => setSelectedCityId(c.id)}
                  >
                    <span
                      className="city-btn-dot"
                      style={{
                        backgroundColor: isSelected ? '#ffffff' : cTheme.primary,
                      }}
                    />
                    <span className="city-btn-name">{c.name}</span>
                    {isSelected && (
                      <Check size={14} className="city-btn-check" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
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

      {/* ENLARGED NUMBER TILES GRID */}
      <div className="number-grid-container">
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
