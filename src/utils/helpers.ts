import type { Settings, City, Counter, Bill } from '../types';

/**
 * Maps counter name to a letter prefix:
 * Counter 1 -> A
 * Counter 2 -> B
 * Counter 3 -> C
 * Counter 4 -> D
 * and so on.
 */
export function getCounterPrefix(counterName: string, counters?: Counter[]): string {
  const numMatch = counterName.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (num >= 1 && num <= 26) {
      return String.fromCharCode(65 + num - 1);
    }
  }

  if (counters && counters.length > 0) {
    const idx = counters.findIndex(
      (c) => c.name.trim().toLowerCase() === counterName.trim().toLowerCase()
    );
    if (idx >= 0 && idx < 26) {
      return String.fromCharCode(65 + idx);
    }
  }

  return 'A';
}

/**
 * Generates next sequential receipt number per counter:
 * Counter 1 -> A-01, A-02, ...
 * Counter 2 -> B-01, B-02, ...
 * Counter 3 -> C-01, C-02, ...
 */
export function generateNextReceiptNumber(
  counterName: string,
  existingBills: Bill[],
  counters?: Counter[]
): string {
  const prefix = getCounterPrefix(counterName, counters);
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

  let maxSeq = 0;
  for (const b of existingBills) {
    if (b.receipt) {
      const match = b.receipt.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(2, '0')}`;
}

export interface CityColorTheme {
  primary: string;
  light: string;
  border: string;
  text: string;
  badgeBg: string;
}

export const CITY_PALETTES: CityColorTheme[] = [
  { primary: '#2563eb', light: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badgeBg: '#dbeafe' }, // Blue (Hyderabad/Rahul)
  { primary: '#059669', light: '#ecfdf5', border: '#a7f3d0', text: '#047857', badgeBg: '#d1fae5' }, // Emerald (Delhi/Gelhi)
  { primary: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', badgeBg: '#ede9fe' }, // Purple (Mumbai)
  { primary: '#d97706', light: '#fffbeb', border: '#fde68a', text: '#b45309', badgeBg: '#fef3c7' }, // Amber (Kolkata)
  { primary: '#e11d48', light: '#fff1f2', border: '#fecdd3', text: '#be123c', badgeBg: '#ffe4e6' }, // Rose (Chennai)
  { primary: '#0d9488', light: '#f0fdfa', border: '#99f6e4', text: '#0f766e', badgeBg: '#ccfbf1' }, // Teal (Bengaluru)
  { primary: '#4f46e5', light: '#eef2ff', border: '#c7d2fe', text: '#4338ca', badgeBg: '#e0e7ff' }, // Indigo
  { primary: '#c026d3', light: '#fdf4ff', border: '#f5d0fe', text: '#a21caf', badgeBg: '#fae8ff' }, // Fuchsia
  { primary: '#0284c7', light: '#f0f9ff', border: '#bae6fd', text: '#0369a1', badgeBg: '#e0f2fe' }, // Sky
];

export function getCityColorTheme(cityIdOrIndex: string | number, cities?: City[]): CityColorTheme {
  let idx = 0;
  if (typeof cityIdOrIndex === 'number') {
    idx = cityIdOrIndex;
  } else if (cities && cities.length > 0) {
    const foundIdx = cities.findIndex((c) => c.id === cityIdOrIndex);
    if (foundIdx >= 0) {
      idx = foundIdx;
    } else {
      const match = String(cityIdOrIndex).match(/\d+/);
      if (match) idx = parseInt(match[0], 10);
    }
  } else {
    const match = String(cityIdOrIndex).match(/\d+/);
    if (match) idx = parseInt(match[0], 10);
  }
  return CITY_PALETTES[Math.abs(idx) % CITY_PALETTES.length];
}


export const INITIAL_CITIES: City[] = [
  'Hyderabad',
  'Delhi',
  'Mumbai',
  'Kolkata',
  'Chennai',
  'Bengaluru',
].map((name, i) => ({
  id: 'c' + i,
  name,
  enabled: true,
  sort_order: i + 1,
}));

export const INITIAL_COUNTERS: Counter[] = [
  { id: 'ctr1', name: 'Counter 1', email: 'counter1@luckydesk.com', password: 'password', enabled: true },
  { id: 'ctr2', name: 'Counter 2', email: 'counter2@luckydesk.com', password: 'password', enabled: true },
  { id: 'ctr3', name: 'Counter 3', email: 'counter3@luckydesk.com', password: 'password', enabled: true },
];

export const INITIAL_SETTINGS: Settings = {
  start: '09:00',
  end: '19:00',
  interval: 40,
  lockMins: 1,
  counterCount: 3,
  manualLock: false,
  priceTwoDigit: 10,
  priceOneDigit: 10,
  counters: INITIAL_COUNTERS,
  adminPin: '2468',
};

export function money(n: number | undefined | null): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function today(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function timeSlots(settings: Settings): string[] {
  if (!settings.start || !settings.end) return [];
  const [sh, sm] = settings.start.split(':').map(Number);
  const [eh, em] = settings.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const arr: string[] = [];
  if (end < start) return arr;
  const interval = Math.max(1, Number(settings.interval) || 40);

  for (let t = start; t <= end; t += interval) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    arr.push(`${h}:${m}`);
  }

  if (arr[arr.length - 1] !== settings.end) {
    arr.push(settings.end);
  }
  return [...new Set(arr)];
}

export function fmtTime(t: string | undefined): string {
  if (!t || !t.includes(':')) return '—';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function activeSlot(settings: Settings): string {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const slots = timeSlots(settings);
  const future = slots.find((s) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m >= mins;
  });
  return future || slots[slots.length - 1] || '—';
}

export function billingLocked(settings: Settings): boolean {
  if (settings.manualLock) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const slots = timeSlots(settings);

  for (const s of slots) {
    const [h, m] = s.split(':').map(Number);
    const sm = h * 60 + m;
    const lockAt = sm - (Number(settings.lockMins) || 0);
    if (mins >= lockAt && mins < sm) {
      return true;
    }
  }
  return false;
}

export function slotCountdown(settings: Settings): {
  isLocked: boolean;
  minsToSlot: number;
  secsToSlot: number;
  minsToLock: number;
  secsToLock: number;
  slotTime: string;
} {
  const isLocked = billingLocked(settings);
  const now = new Date();
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const slot = activeSlot(settings);
  if (!slot || slot === '—') {
    return { isLocked, minsToSlot: 0, secsToSlot: 0, minsToLock: 0, secsToLock: 0, slotTime: slot };
  }

  const [sh, sm] = slot.split(':').map(Number);
  const slotSeconds = sh * 3600 + sm * 60;
  const lockSeconds = slotSeconds - (Number(settings.lockMins) || 1) * 60;

  const diffToSlot = Math.max(0, slotSeconds - nowSeconds);
  const diffToLock = Math.max(0, lockSeconds - nowSeconds);

  return {
    isLocked,
    minsToSlot: Math.floor(diffToSlot / 60),
    secsToSlot: diffToSlot % 60,
    minsToLock: Math.floor(diffToLock / 60),
    secsToLock: diffToLock % 60,
    slotTime: slot,
  };
}
