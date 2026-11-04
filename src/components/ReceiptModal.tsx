import React, { useState, useMemo } from 'react';
import { Bluetooth, Printer, X, Check, Copy, ShieldAlert, Trophy, Share2 } from 'lucide-react';
import type { Bill, PrinterConfig, Result, UserRole } from '../types';
import { buildReceiptPlainText, printBill, printTestReceipt } from '../utils/printer';
import { money } from '../utils/helpers';

interface ReceiptModalProps {
  bill: Bill | null;
  results?: Result[];
  onClose: () => void;
  printerConfig: PrinterConfig;
  cityMap: Record<string, string>;
  role?: UserRole;
  currentCounter?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  bill,
  results = [],
  onClose,
  printerConfig,
  cityMap,
  role,
  currentCounter,
}) => {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const winningDetails = useMemo(() => {
    if (!bill || !results || results.length === 0) return null;
    const matchingResults = results.filter((r) => r.date === bill.date && r.slot === bill.slot);
    let totalPrize = 0;
    const wins: Array<{ city: string; num: string; units: number; prize: number }> = [];

    if (bill.items && bill.items.length > 0) {
      bill.items.forEach((it) => {
        const match = matchingResults.find(
          (r) =>
            r.cityId === it.cityId &&
            r.type === it.type &&
            String(r.number).trim() === String(it.number).trim()
        );
        if (match) {
          const unitPrize = match.prizePerUnit || (match.type === 1 ? 95 : 950);
          const prize = it.units * unitPrize;
          totalPrize += prize;
          wins.push({
            city: cityMap[it.cityId] || 'City',
            num: it.number,
            units: it.units,
            prize,
          });
        }
      });
    }
    return totalPrize > 0 ? { totalPrize, wins } : null;
  }, [bill, results, cityMap]);

  if (!bill) return null;

  // Strict access check for counter staff
  const isUnauthorized =
    role === 'counter' &&
    currentCounter &&
    bill.counter?.trim().toLowerCase() !== currentCounter?.trim().toLowerCase();

  if (isUnauthorized) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card receipt-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="flex-row items-center gap-2">
              <ShieldAlert size={20} className="text-rose" />
              <h2 className="modal-title">Receipt Access Restricted</h2>
            </div>
            <button type="button" className="btn-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              This receipt was created by <b>{bill.counter}</b>.
            </p>
            <p style={{ color: 'var(--rose)', fontSize: 13, marginTop: 6 }}>
              You are logged in as <b>{currentCounter}</b> and can only view or print receipts from your counter.
            </p>
          </div>
          <button type="button" className="btn-secondary full-width" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const plainText = buildReceiptPlainText(bill, printerConfig, cityMap);

  const handlePrint = async (methodOverride?: 'bluetooth' | 'rawbt' | 'browser') => {
    setIsPrinting(true);
    setPrintStatus('Sending to printer...');
    const configToUse = methodOverride ? { ...printerConfig, method: methodOverride } : printerConfig;
    const res = await printBill(bill, configToUse, cityMap);
    setIsPrinting(false);
    setPrintStatus(res.message);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${bill.receipt} - LuckyDesk`,
          text: plainText,
        });
      } catch (err: unknown) {
        // User cancelled or share error
        if ((err as Error)?.name !== 'AbortError') {
          handleCopy();
          setPrintStatus('Receipt copied to clipboard for sharing!');
          setTimeout(() => setPrintStatus(null), 3500);
        }
      }
    } else {
      // Fallback: Copy to clipboard and notify
      handleCopy();
      setPrintStatus('Receipt text copied! Paste it in your printer or sharing app.');
      setTimeout(() => setPrintStatus(null), 3500);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card receipt-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Receipt {bill.receipt}</h2>
            <div className="modal-subtitle">
              {bill.date} · {bill.timeLabel} · {bill.counter}
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {printStatus && (
          <div className="print-status-banner">
            <span>{printStatus}</span>
          </div>
        )}

        {/* Celebratory Winning Banner if Ticket Won */}
        {winningDetails && (
          <div
            style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '2px solid #10b981',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 12,
              color: '#065f46',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 900, fontSize: 14 }}>
              <Trophy size={18} className="text-amber" />
              <span>🎉 WINNING RECEIPT! Prize Won: {money(winningDetails.totalPrize)}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
              {winningDetails.wins.map((w, idx) => (
                <span key={idx} style={{ marginRight: 10 }}>
                  • {w.city} #{w.num} (×{w.units}): <b>{money(w.prize)}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Paper Receipt Simulation */}
        <div className="receipt-paper-wrapper">
          <pre className="receipt-paper-text">{plainText}</pre>
        </div>

        {/* Print Action Buttons */}
        <div className="receipt-modal-actions">
          <button
            type="button"
            className="btn-primary-print"
            disabled={isPrinting}
            onClick={() => handlePrint('bluetooth')}
          >
            <Bluetooth size={18} />
            <span>Bluetooth Print</span>
          </button>

          <button
            type="button"
            className="btn-secondary-print"
            disabled={isPrinting}
            onClick={() => handlePrint('rawbt')}
          >
            <span>RawBT App</span>
          </button>

          <button
            type="button"
            className="btn-secondary-print"
            disabled={isPrinting}
            onClick={() => handlePrint('browser')}
          >
            <Printer size={16} />
            <span>Browser</span>
          </button>

          <button
            type="button"
            className="btn-secondary-print btn-share-print"
            onClick={handleShare}
            title="Share receipt to third-party print app or messengers"
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>

          <button type="button" className="btn-icon" onClick={handleCopy} title="Copy receipt text">
            {copied ? <Check size={18} className="text-emerald" /> : <Copy size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
