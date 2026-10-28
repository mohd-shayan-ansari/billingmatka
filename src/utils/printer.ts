import type { Bill, PrinterConfig } from '../types';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  method: 'bluetooth',
  width: '58mm',
  paperFeedLines: 4,
  autoCut: true,
  storeName: 'LUCKY DESK',
  footerText: 'THANK YOU · GOOD LUCK',
};

// BLE UUIDs used by common 58mm / 80mm thermal printers
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000af00-0000-1000-8000-00805f9b34fb',
];

interface BluetoothState {
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
  characteristic: BluetoothRemoteGATTCharacteristic | null;
  status: 'disconnected' | 'connecting' | 'connected';
  deviceName: string | null;
  error: string | null;
}

const btState: BluetoothState = {
  device: null,
  server: null,
  characteristic: null,
  status: 'disconnected',
  deviceName: null,
  error: null,
};

let statusListeners: Array<(state: BluetoothState) => void> = [];

export function subscribePrinterStatus(listener: (state: BluetoothState) => void) {
  statusListeners.push(listener);
  listener({ ...btState });
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function notifyStatus() {
  statusListeners.forEach((l) => l({ ...btState }));
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function connectBluetoothPrinter(): Promise<boolean> {
  if (!isWebBluetoothSupported()) {
    btState.error = 'Web Bluetooth is not supported in this browser. Use Chrome on Android or desktop.';
    notifyStatus();
    return false;
  }

  try {
    btState.status = 'connecting';
    btState.error = null;
    notifyStatus();

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });

    btState.device = device;
    btState.deviceName = device.name || 'Thermal Printer';

    device.addEventListener('gattserverdisconnected', onDisconnected);

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Could not connect to GATT Server');
    btState.server = server;

    // Search for a writable characteristic in any supported service
    let writableChar: BluetoothRemoteGATTCharacteristic | null = null;

    for (const serviceUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writableChar = char;
            break;
          }
        }
        if (writableChar) break;
      } catch {
        // service not present on this printer model, continue search
      }
    }

    // Fallback: search all available services if primary search didn't find one
    if (!writableChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writableChar = char;
              break;
            }
          }
          if (writableChar) break;
        }
      } catch {
        // failed fallback search
      }
    }

    if (!writableChar) {
      throw new Error('Connected to Bluetooth device, but no writable print service characteristic was found.');
    }

    btState.characteristic = writableChar;
    btState.status = 'connected';
    notifyStatus();
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (!errorMsg.includes('User cancelled')) {
      btState.error = errorMsg;
    }
    btState.status = 'disconnected';
    notifyStatus();
    return false;
  }
}

function onDisconnected() {
  btState.status = 'disconnected';
  btState.server = null;
  btState.characteristic = null;
  notifyStatus();
}

export function disconnectBluetoothPrinter() {
  if (btState.device?.gatt?.connected) {
    btState.device.gatt.disconnect();
  }
  btState.device = null;
  btState.server = null;
  btState.characteristic = null;
  btState.status = 'disconnected';
  btState.deviceName = null;
  notifyStatus();
}

export function getBluetoothState(): BluetoothState {
  return { ...btState };
}

// ESC/POS Command Byte Constants
const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private buffer: number[] = [];
  private cols: number;

  constructor(width: '58mm' | '80mm' = '58mm') {
    this.cols = width === '80mm' ? 48 : 32;
    this.init();
  }

  init() {
    this.buffer.push(ESC, 0x40); // ESC @ Initialize printer
    return this;
  }

  alignCenter() {
    this.buffer.push(ESC, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(ESC, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(ESC, 0x61, 0x02);
    return this;
  }

  bold(enable: boolean = true) {
    this.buffer.push(ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  doubleSize(enable: boolean = true) {
    this.buffer.push(GS, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  doubleHeight(enable: boolean = true) {
    this.buffer.push(GS, 0x21, enable ? 0x01 : 0x00);
    return this;
  }

  lineFeed(lines: number = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  text(str: string) {
    // Convert string to bytes (ASCII / Latin1 fallback for clean thermal print)
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // Replace rupee symbol ₹ with Rs. for standard ESC/POS compatibility
      if (str[i] === '₹') {
        this.buffer.push(...[0x52, 0x73, 0x2e, 0x20]); // 'Rs. '
      } else if (code < 128) {
        this.buffer.push(code);
      } else {
        this.buffer.push(0x20); // space fallback
      }
    }
    return this;
  }

  textLine(str: string) {
    this.text(str);
    this.lineFeed(1);
    return this;
  }

  separator(char: string = '-') {
    const line = char.repeat(this.cols);
    this.textLine(line);
    return this;
  }

  doubleSeparator() {
    return this.separator('=');
  }

  twoColumnRow(left: string, right: string) {
    const space = this.cols - left.length - right.length;
    if (space > 0) {
      this.textLine(left + ' '.repeat(space) + right);
    } else {
      this.textLine(left);
      this.alignRight();
      this.textLine(right);
      this.alignLeft();
    }
    return this;
  }

  threeColumnRow(col1: string, col2: string, col3: string) {
    // e.g. "14" (4 chars), "x 5" (8 chars), "Rs 50.00" (rest)
    const c1Width = 8;
    const c2Width = 10;
    const c1 = col1.padEnd(c1Width);
    const c2 = col2.padEnd(c2Width);
    const rightLen = this.cols - c1Width - c2Width;
    const c3 = col3.padStart(Math.max(0, rightLen));
    this.textLine(c1 + c2 + c3);
    return this;
  }

  cut(full: boolean = false) {
    this.lineFeed(3);
    this.buffer.push(GS, 0x56, full ? 0x00 : 0x01); // GS V Cut
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  getBase64(): string {
    const bytes = this.getBytes();
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Builds standard ESC/POS byte sequence for a Lucky Desk bill
 */
export function buildBillEscPos(
  bill: Bill,
  config: PrinterConfig,
  cityMap: Record<string, string>
): EscPosBuilder {
  const builder = new EscPosBuilder(config.width);

  // Header
  builder.alignCenter();
  builder.doubleHeight(true);
  builder.bold(true);
  builder.textLine(config.storeName);
  builder.doubleHeight(false);
  builder.bold(false);
  builder.textLine(bill.counter);
  builder.doubleSeparator();

  // Receipt info
  builder.alignLeft();
  builder.twoColumnRow('Receipt: ' + bill.receipt, 'Slot: ' + bill.slot);
  builder.twoColumnRow('Date: ' + bill.date, bill.timeLabel);
  if (bill.customer) {
    builder.textLine('Customer: ' + bill.customer);
  }
  builder.doubleSeparator();

  // Group items by City and Type
  const items = bill.items && bill.items.length > 0
    ? bill.items
    : [{
        cityId: bill.cityId,
        cityName: cityMap[bill.cityId] || 'City',
        type: bill.type,
        number: bill.number,
        units: bill.units || 1,
        amount: bill.amount,
      }];

  const groups: Record<string, { cityId: string; type: 1 | 2; items: typeof items }> = {};
  items.forEach((item) => {
    const cid = item.cityId || bill.cityId;
    const type = item.type || bill.type;
    const key = `${cid}|${type}`;
    if (!groups[key]) {
      groups[key] = { cityId: cid, type, items: [] };
    }
    groups[key].items.push(item);
  });

  Object.values(groups).forEach((group) => {
    const cName = cityMap[group.cityId] || 'CITY';
    builder.bold(true);
    builder.textLine(cName.toUpperCase());
    builder.bold(false);
    builder.textLine(group.type === 2 ? 'DOUBLE-DIGIT (00-99)' : 'SINGLE-DIGIT (0-9)');
    builder.separator('-');

    group.items.forEach((item) => {
      const numStr = String(item.number);
      const qtyStr = `x ${item.units}`;
      const amtStr = `Rs ${Number(item.amount).toFixed(2)}`;
      builder.threeColumnRow(numStr, qtyStr, amtStr);
    });

    builder.separator('-');
  });

  // Totals
  builder.bold(true);
  builder.twoColumnRow('TOTAL UNITS:', String(bill.unitsTotal || items.reduce((s, i) => s + i.units, 0)));
  builder.doubleHeight(true);
  builder.twoColumnRow('TOTAL:', `Rs ${Number(bill.amount).toFixed(2)}`);
  builder.doubleHeight(false);
  builder.bold(false);
  builder.doubleSeparator();

  // Footer
  builder.alignCenter();
  builder.textLine(config.footerText);
  builder.lineFeed(config.paperFeedLines);

  if (config.autoCut) {
    builder.cut(false);
  }

  return builder;
}

/**
 * Builds plain text receipt for preview and copy
 */
export function buildReceiptPlainText(
  bill: Bill,
  config: PrinterConfig,
  cityMap: Record<string, string>
): string {
  const lineLen = config.width === '80mm' ? 44 : 32;
  const sep = '='.repeat(lineLen);
  const thinSep = '-'.repeat(lineLen);

  const lines: string[] = [
    sep,
    centerText(config.storeName, lineLen),
    centerText(bill.counter, lineLen),
    sep,
    `Receipt: ${bill.receipt}`,
    `Date:    ${bill.date} ${bill.timeLabel}`,
    `Draw:    ${bill.slot}`,
  ];

  if (bill.customer) {
    lines.push(`Cust:    ${bill.customer}`);
  }
  lines.push(sep);

  const items = bill.items && bill.items.length > 0 ? bill.items : [];
  const groups: Record<string, { cityId: string; type: 1 | 2; items: typeof items }> = {};

  items.forEach((item) => {
    const cid = item.cityId || bill.cityId;
    const type = item.type || bill.type;
    const key = `${cid}|${type}`;
    if (!groups[key]) {
      groups[key] = { cityId: cid, type, items: [] };
    }
    groups[key].items.push(item);
  });

  Object.values(groups).forEach((g) => {
    const cName = cityMap[g.cityId] || 'CITY';
    lines.push(`>> ${cName.toUpperCase()}`);
    lines.push(g.type === 2 ? '   DOUBLE-DIGIT (00-99)' : '   SINGLE-DIGIT (0-9)');
    lines.push(thinSep);
    g.items.forEach((it) => {
      const col1 = String(it.number).padEnd(6);
      const col2 = `x ${it.units}`.padEnd(8);
      const col3 = `₹${Number(it.amount).toFixed(2)}`.padStart(lineLen - 14);
      lines.push(`${col1}${col2}${col3}`);
    });
    lines.push(thinSep);
  });

  lines.push(`TOTAL UNITS:  ${bill.unitsTotal}`);
  lines.push(`TOTAL AMOUNT: ₹${Number(bill.amount).toFixed(2)}`);
  lines.push(sep);
  lines.push(centerText(config.footerText, lineLen));
  lines.push(sep);

  return lines.join('\n');
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return ' '.repeat(left) + text;
}

/**
 * Sends raw bytes in chunks over Web Bluetooth GATT characteristic
 */
async function writeBytesChunked(
  characteristic: BluetoothRemoteGATTCharacteristic,
  bytes: Uint8Array,
  chunkSize: number = 100
) {
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    // Small delay to let thermal printer hardware buffer catch up
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

/**
 * Universal print function for Lucky Desk
 */
export async function printBill(
  bill: Bill,
  config: PrinterConfig,
  cityMap: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  // Method 1: Web Bluetooth
  if (config.method === 'bluetooth') {
    if (!btState.characteristic || btState.status !== 'connected') {
      const connected = await connectBluetoothPrinter();
      if (!connected || !btState.characteristic) {
        return {
          success: false,
          message: 'Bluetooth printer is not connected. Tap "Connect Printer" or choose RawBT / Browser Print.',
        };
      }
    }

    try {
      const escPos = buildBillEscPos(bill, config, cityMap);
      await writeBytesChunked(btState.characteristic, escPos.getBytes());
      return { success: true, message: 'Printed via Bluetooth successfully!' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: 'Bluetooth print failed: ' + errorMsg };
    }
  }

  // Method 2: Android RawBT Intent
  if (config.method === 'rawbt') {
    try {
      const escPos = buildBillEscPos(bill, config, cityMap);
      const b64 = escPos.getBase64();
      // RawBT Android intent URL scheme
      window.location.href = `rawbt:base64,${b64}`;
      return { success: true, message: 'Sent to RawBT thermal print service!' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: 'RawBT trigger failed: ' + errorMsg };
    }
  }

  // Method 3: Browser print dialog fallback
  window.print();
  return { success: true, message: 'Browser print triggered.' };
}

/**
 * Prints a test receipt to verify connection and paper alignment
 */
export async function printTestReceipt(
  config: PrinterConfig
): Promise<{ success: boolean; message: string }> {
  const dummyBill: Bill = {
    receipt: 'LD-TEST01',
    date: new Date().toISOString().slice(0, 10),
    timeLabel: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date().toISOString(),
    counter: 'Counter 1 (Test)',
    slot: '12:00 PM',
    cityId: 'test_city',
    type: 2,
    number: '77',
    units: 1,
    unitsTotal: 3,
    amount: 30,
    items: [
      { cityId: 'test_city', type: 2, number: '07', units: 1, amount: 10 },
      { cityId: 'test_city', type: 2, number: '77', units: 2, amount: 20 },
    ],
  };

  const cityMap = { test_city: 'DEMO CITY' };
  return printBill(dummyBill, config, cityMap);
}
