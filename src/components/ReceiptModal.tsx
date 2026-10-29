import React, { useState } from 'react';
import { Bluetooth, Printer, X, Check, Copy, ShieldAlert } from 'lucide-react';
import type { Bill, PrinterConfig, UserRole } from '../types';
import { buildReceiptPlainText, printBill, printTestReceipt } from '../utils/printer';

interface ReceiptModalProps {
  bill: Bill | null;
  onClose: () => void;
  printerConfig: PrinterConfig;
  cityMap: Record<string, string>;
  role?: UserRole;
  currentCounter?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  bill,
  onClose,
  printerConfig,
  cityMap,
  role,
  currentCounter,
}) => {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

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
            <span>Browser Print</span>
          </button>

          <button type="button" className="btn-icon" onClick={handleCopy} title="Copy receipt text">
            {copied ? <Check size={18} className="text-emerald" /> : <Copy size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
