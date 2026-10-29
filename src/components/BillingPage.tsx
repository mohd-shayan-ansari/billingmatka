import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Trash2, Printer, Search, Sparkles, Check, Bluetooth } from 'lucide-react';
import type { Bill, City, PrinterConfig, Settings, UserRole } from '../types';
import { activeSlot, billingLocked, generateNextReceiptNumber, money, today, getCityColorTheme } from '../utils/helpers';
import { printBill, connectBluetoothPrinter, disconnectBluetoothPrinter, subscribePrinterStatus } from '../utils/printer';

interface BillingPageProps {
  cities: City[];
  settings: Settings;
  bills: Bill[];
  role: UserRole;
  currentCounter: string;
  printerConfig: PrinterConfig;
  onBillCreated: (bill: Bill) => void;
  onOpenReceiptModal: (bill: Bill) => void;
  onSwitchRole?: () => void;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  cities,
  settings,
  bills,
  role,
  currentCounter,
  printerConfig,
  onBillCreated,
  onOpenReceiptModal,
  onSwitchRole,
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

  // BT status subscription
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
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
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }, [now]);

  const currentSlot = useMemo(() => activeSlot(settings), [settings, now]);
  const isLocked = useMemo(() => billingLocked(settings), [settings, now]);

  const slotRemainingStr = useMemo(() => {
    if (!currentSlot || isLocked) return '';
    try {
      const [slotH, slotM] = currentSlot.split(':').map(Number);
      const slotTimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotH, slotM, 0).getTime();
      const diffMs = slotTimeMs - now.getTime();
      if (diffMs <= 0) return '0m 0s';
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      return `${mins}m ${secs}s`;
    } catch {
      return '';
    }
  }, [currentSlot, isLocked, now]);

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

  const updateQuantity = (cityId: string, type: 1 | 2, number: string, deltaOrSet: number, isDirectSet: boolean = false) => {
    const key = `${cityId}|${type}|${number}`;
    setDraftQuantities((prev) => {
      const current = prev[key] || 0;
      const nextVal = isDirectSet ? Math.max(0, deltaOrSet) : Math.max(0, current + deltaOrSet);
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
        const pricePerUnit = type === 2 ? settings.priceTwoDigit : settings.priceOneDigit;
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

  const totalUnits = useMemo(() => selectedItems.reduce((sum, x) => sum + x.units, 0), [selectedItems]);
  const totalAmount = useMemo(() => selectedItems.reduce((sum, x) => sum + x.amount, 0), [selectedItems]);

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
  const minSales = countValues.length ? Math.min(...countValues) : 0;

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
    const timeLabel = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
      {/* Sleek, Non-intrusive Top Bar replacing the big dark header */}
      <div className="mini-top-bar">
        <div className="mini-bar-left">
          <span className="mini-clock">{currentTimeStr}</span>
          <span className="mini-divider">•</span>
          <span className="mini-draw">
            Draw: <b>{currentSlot}</b>
          </span>
          <span className={`mini-status-pill ${isLocked ? 'status-locked' : 'status-open'}`}>
            {isLocked ? 'LOCKED' : `OPEN (${slotRemainingStr || 'Active'})`}
          </span>
        </div>
        <div className="mini-bar-right">
          <button
            type="button"
            className={`btn-mini-bt ${btStatus === 'connected' ? 'connected' : ''}`}
            onClick={handleToggleBT}
            title={btStatus === 'connected' ? `Connected: ${btDeviceName || 'Printer'}` : 'Connect Bluetooth Printer'}
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

      {/* ENLARGED City Selection Buttons */}
      <div className="city-selector-section">
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
                  boxShadow: isSelected
                    ? `0 6px 16px ${cTheme.primary}40`
                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
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
                  <Check size={16} className="city-btn-check" strokeWidth={3} />
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

      {/* Number Tiles Grid */}
      <div className="number-grid-container">
        <div className={`number-tiles-grid ${numberType === 1 ? 'single-digit-grid' : ''}`}>
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
                        boxShadow: `0 0 0 1.5px ${activeCityTheme.primary}`,
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
                      color: isTileSelected ? activeCityTheme.primary : activeCityTheme.text,
                      fontWeight: isTileSelected ? 800 : 700,
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
                      borderColor: isTileSelected ? activeCityTheme.border : activeCityTheme.boxBorder,
                      color: isTileSelected ? activeCityTheme.primary : '#94a3b8',
                      backgroundColor: '#ffffff',
                    }}
                    onClick={() => updateQuantity(selectedCityId, numberType, num, -1)}
                  >
                    <Minus size={11} />
                  </button>

                  <input
                    type="number"
                    min="0"
                    className={`step-input ${qty > 0 ? 'has-val' : ''}`}
                    style={{
                      borderColor: isTileSelected ? activeCityTheme.primary : activeCityTheme.boxBorder,
                      color: isTileSelected ? activeCityTheme.primary : '#1e293b',
                      fontWeight: isTileSelected ? 800 : 600,
                      backgroundColor: '#ffffff',
                    }}
                    value={qty || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateQuantity(selectedCityId, numberType, num, isNaN(val) ? 0 : val, true);
                    }}
                  />

                  <button
                    type="button"
                    className="step-btn step-plus"
                    style={{
                      backgroundColor: isTileSelected ? activeCityTheme.primary : activeCityTheme.light,
                      borderColor: isTileSelected ? activeCityTheme.primary : activeCityTheme.boxBorder,
                      color: isTileSelected ? '#ffffff' : activeCityTheme.primary,
                    }}
                    onClick={() => updateQuantity(selectedCityId, numberType, num, 1)}
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {/* Quick Add Buttons on Selected Tile */}
                {qty > 0 && (
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
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      className="quick-pill"
                      style={{
                        backgroundColor: '#ffffff',
                        borderColor: activeCityTheme.border,
                        color: activeCityTheme.primary,
                      }}
                      onClick={() => handleQuickAdd(num, 10)}
                    >
                      +10
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Persistent Bottom Checkout Bar */}
      <div className="checkout-bar">
        {selectedItems.length > 0 && (
          <div className="selected-items-preview">
            <div className="preview-header">
              <span>Current Selection ({selectedItems.length} items)</span>
              <button type="button" className="btn-text-danger" onClick={clearDraft}>
                <Trash2 size={12} />
                <span>Clear Draft</span>
              </button>
            </div>
            <div className="selected-chips-row">
              {selectedItems.map((it) => {
                const itTheme = getCityColorTheme(it.cityId, cities);
                return (
                  <div
                    key={`${it.cityId}-${it.type}-${it.number}`}
                    className="item-chip"
                    style={{
                      backgroundColor: itTheme.light,
                      borderColor: itTheme.border,
                    }}
                  >
                    <span
                      className="chip-city"
                      style={{
                        backgroundColor: itTheme.primary,
                        color: '#ffffff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      {it.cityName.slice(0, 3)}
                    </span>
                    <b
                      className="chip-num"
                      style={{ color: itTheme.primary }}
                    >
                      #{it.number}
                    </b>
                    <span
                      className="chip-qty"
                      style={{ color: itTheme.text }}
                    >
                      ×{it.units}
                    </span>
                    <span className="chip-amt">{money(it.amount)}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      style={{ color: itTheme.primary }}
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

        <div className="checkout-action-row">
          <div className="checkout-inputs">
            <input
              type="text"
              placeholder="Cust Name (opt)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="customer-input"
            />
          </div>

          <div className="checkout-summary">
            <div className="summary-units">{totalUnits} units</div>
            <div className="summary-amount">{money(totalAmount)}</div>
          </div>

          <button
            type="button"
            className="btn-create-bill"
            disabled={isLocked || selectedItems.length === 0}
            onClick={handleCreateBill}
          >
            <Printer size={18} />
            <span className="btn-label">
              {isLocked ? 'LOCKED' : 'Create & Print'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
