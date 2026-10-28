import React, { useState } from 'react';
import { Bluetooth, Printer, X, Check, Copy } from 'lucide-react';
import type { Bill, PrinterConfig } from '../types';
import { buildReceiptPlainText, printBill, printTestReceipt } from '../utils/printer';

interface ReceiptModalProps {
  bill: Bill | null;
  onClose: () => void;
  printerConfig: PrinterConfig;
  cityMap: Record<string, string>;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  bill,
  onClose,
  printerConfig,
  cityMap,
}) => {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!bill) return null;

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
