export interface City {
  id: string;
  name: string;
  enabled: boolean;
  sort_order?: number;
}

export interface Counter {
  id: string;
  name: string;
  email: string;
  password?: string;
  enabled: boolean;
}

export interface Settings {
  start: string; // e.g. "09:00"
  end: string;   // e.g. "19:00"
  interval: number; // minutes e.g. 40
  lockMins: number; // minutes before slot e.g. 1
  counterCount: number;
  manualLock: boolean;
  priceTwoDigit: number; // e.g. 10
  priceOneDigit: number; // e.g. 10
  counters: Counter[];
  adminPin?: string;
}

export interface BillItem {
  cityId: string;
  cityName?: string;
  type: 1 | 2; // 1 = 0-9, 2 = 00-99
  number: string;
  units: number;
  amount: number;
}

export interface Bill {
  id?: string;
  receipt: string;
  date: string; // YYYY-MM-DD
  timeLabel: string; // e.g. 10:30 AM
  timestamp: string; // ISO string
  counter: string;
  customer?: string;
  slot: string; // e.g. 10:40
  cityId: string;
  type: 1 | 2;
  number: string;
  units: number;
  unitsTotal: number;
  amount: number;
  amountPerUnit?: number;
  items: BillItem[];
}

export interface Winner {
  receipt: string;
  counter: string;
  amount: number;
  units: number;
  prize: number;
  customer?: string;
}

export interface Result {
  id?: string;
  date: string; // YYYY-MM-DD
  slot: string; // e.g. "10:40"
  cityId: string;
  cityName?: string;
  type: 1 | 2;
  number: string;
  prizePerUnit: number;
  totalPrize: number;
  winners: Winner[];
}

export type PrintMethod = 'bluetooth' | 'rawbt' | 'browser';
export type PrinterWidth = '58mm' | '80mm';

export interface PrinterConfig {
  method: PrintMethod;
  width: PrinterWidth;
  paperFeedLines: number;
  autoCut: boolean;
  storeName: string;
  footerText: string;
}

export type UserRole = 'admin' | 'counter';
