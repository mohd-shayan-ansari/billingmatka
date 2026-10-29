import React, { useState, useMemo } from 'react';
import { Search, Download, Printer, Eye, FileText, Calendar, Lock } from 'lucide-react';
import type { Bill, City, UserRole } from '../types';
import { money, getCityColorTheme, today } from '../utils/helpers';

interface BillsPageProps {
  bills: Bill[];
  cities: City[];
  role: UserRole;
  currentCounter: string;
  onSelectBill: (bill: Bill) => void;
  onExportJson: () => void;
}

export const BillsPage: React.FC<BillsPageProps> = ({
  bills,
  cities,
  role,
  currentCounter,
  onSelectBill,
  onExportJson,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  const cityMap = useMemo(() => {
    const map: Record<string, string> = {};
    cities.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [cities]);

  // Strict role filtering: Counter staff can ONLY see receipts created by their own counter
  const visibleBills = useMemo(() => {
    if (role === 'admin') return bills;
    return bills.filter(
      (b) => b.counter?.trim().toLowerCase() === currentCounter?.trim().toLowerCase()
    );
  }, [bills, role, currentCounter]);

  const filteredBills = useMemo(() => {
    return visibleBills.filter((b) => {
      const matchSearch =
        !searchTerm ||
        b.receipt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.customer && b.customer.toLowerCase().includes(searchTerm.toLowerCase())) ||
        b.counter.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDate = !dateFilter || b.date === dateFilter;

      return matchSearch && matchDate;
    });
  }, [visibleBills, searchTerm, dateFilter]);

  const totalFilteredAmount = useMemo(
    () => filteredBills.reduce((sum, b) => sum + b.amount, 0),
    [filteredBills]
  );

  const handleExport = () => {
    if (role === 'admin') {
      onExportJson();
    } else {
      const exportPayload = {
        terminal: currentCounter,
        exportedAt: new Date().toISOString(),
        totalSales: totalFilteredAmount,
        billsCount: filteredBills.length,
        receipts: filteredBills,
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts-${currentCounter.replace(/\s+/g, '-').toLowerCase()}-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bills-page">
      {/* Search and Filters Header */}
      <div className="card filter-card">
        {role === 'counter' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            <Lock size={13} className="text-emerald" />
            <span>Showing receipts issued exclusively by <b>{currentCounter}</b></span>
          </div>
        )}

        <div className="search-filter-row">
          <div className="search-box-large">
            <Search size={16} className="text-muted" />
            <input
              type="text"
              placeholder={role === 'counter' ? `Search ${currentCounter} receipts...` : "Search receipt # or customer..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input-field"
            />
            {searchTerm && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchTerm('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="date-picker-box">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="date-input"
            />
            {dateFilter && (
              <button
                type="button"
                className="btn-clear-date"
                onClick={() => setDateFilter('')}
                title="Clear date filter"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="filter-summary-row">
          <span className="summary-count">
            {role === 'counter' ? 'Your Receipts: ' : 'Found '}
            <b>{filteredBills.length}</b> bills
          </span>
          <span className="summary-total">
            {role === 'counter' ? 'Your Sales: ' : 'Total: '}
            <b>{money(totalFilteredAmount)}</b>
          </span>
          <button
            type="button"
            className="btn-export-backup"
            onClick={handleExport}
            title={role === 'counter' ? `Export ${currentCounter} Receipts` : "Download JSON Backup"}
          >
            <Download size={13} />
            <span>{role === 'counter' ? 'Export Receipts' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      {/* Bills List */}
      <div className="card table-card">
        {filteredBills.length === 0 ? (
          <div className="empty-state">No matching bills found.</div>
        ) : (
          <div className="bills-list-items">
            {filteredBills.map((b) => (
              <div
                key={b.receipt}
                className="bill-card-item"
                onClick={() => onSelectBill(b)}
              >
                <div className="bill-item-header">
                  <div className="bill-receipt-tag">
                    <FileText size={14} className="text-blue" />
                    <b>{b.receipt}</b>
                  </div>
                  <div className="bill-amount-tag">{money(b.amount)}</div>
                </div>

                <div className="bill-meta-row">
                  <span>{b.date} · {b.timeLabel}</span>
                  <span className="dot-divider">•</span>
                  <span>{b.counter}</span>
                  {b.customer && (
                    <>
                      <span className="dot-divider">•</span>
                      <span>Cust: {b.customer}</span>
                    </>
                  )}
                </div>

                {/* Number summary pill */}
                <div className="bill-numbers-summary">
                  <div className="numbers-badge">
                    {b.items && b.items.length > 0 ? (
                      b.items.map((it, i) => {
                        const itTheme = getCityColorTheme(it.cityId, cities);
                        return (
                          <span
                            key={i}
                            className="num-pill"
                            style={{
                              backgroundColor: itTheme.light,
                              borderColor: itTheme.border,
                              color: itTheme.text,
                            }}
                          >
                            #{it.number} (×{it.units})
                          </span>
                        );
                      })
                    ) : (
                      <span className="num-pill">#{b.number} (×{b.units})</span>
                    )}
                  </div>
                  <button type="button" className="btn-reprint-hint">
                    <Printer size={13} />
                    <span>View / Print</span>
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
