import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Bill, City, Counter, Result, Settings } from '../types';

const SUPABASE_CONFIG_KEY = 'luckyDesk_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  // 1. Environment variables take highest priority (secure server / .env / Vercel)
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  // 2. Fallback to localStorage if configured
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch {
    // ignore
  }

  return { url: '', anonKey: '' };
}

export function getMaskedSupabaseInfo(): { isConfigured: boolean; projectHost: string } {
  const config = getStoredSupabaseConfig();
  if (!config.url) return { isConfigured: false, projectHost: 'Not Configured' };
  try {
    const u = new URL(config.url);
    return { isConfigured: true, projectHost: u.hostname };
  } catch {
    return { isConfigured: true, projectHost: 'Configured' };
  }
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  initSupabaseClient();
}

let supabaseInstance: SupabaseClient | null = null;

export function initSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (config.url && config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      return supabaseInstance;
    } catch (e) {
      console.warn('Supabase initialization error:', e);
      supabaseInstance = null;
    }
  } else {
    supabaseInstance = null;
  }
  return supabaseInstance;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    return initSupabaseClient();
  }
  return supabaseInstance;
}

export function isSupabaseConnected(): boolean {
  return getSupabase() !== null;
}

// Data synchronization API

export async function fetchCloudData(): Promise<{
  cities: City[];
  settings: Settings;
  bills: Bill[];
  results: Result[];
} | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const [citiesRes, settingsRes, countersRes, billsRes, resultsRes] = await Promise.all([
      sb.from('cities').select('*').order('sort_order', { ascending: true }),
      sb.from('settings').select('*').eq('id', 'primary').maybeSingle(),
      sb.from('counters').select('*').order('created_at', { ascending: true }),
      sb.from('bills').select('*').order('timestamp', { ascending: false }).limit(200),
      sb.from('results').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (citiesRes.error) throw citiesRes.error;

    const cities: City[] = (citiesRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      enabled: c.enabled,
      sort_order: c.sort_order,
    }));

    const counters: Counter[] = (countersRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      password: c.password,
      enabled: c.enabled,
    }));

    const s = settingsRes.data;
    const settings: Settings = s
      ? {
          start: s.start_time,
          end: s.end_time,
          interval: Number(s.interval_mins) || 40,
          lockMins: Number(s.lock_mins) || 1,
          counterCount: counters.length,
          manualLock: Boolean(s.manual_lock),
          priceTwoDigit: Number(s.price_two_digit) || 10,
          priceOneDigit: Number(s.price_one_digit) || 10,
          adminPin: s.admin_pin || '2468',
          counters: counters,
        }
      : {
          start: '09:00',
          end: '19:00',
          interval: 40,
          lockMins: 1,
          counterCount: counters.length || 3,
          manualLock: false,
          priceTwoDigit: 10,
          priceOneDigit: 10,
          adminPin: '2468',
          counters: counters,
        };

    const bills: Bill[] = (billsRes.data || []).map((b) => ({
      id: b.id,
      receipt: b.receipt,
      date: b.date,
      slot: b.slot,
      timeLabel: b.time_label,
      timestamp: b.timestamp,
      counter: b.counter,
      customer: b.customer || '',
      cityId: b.city_id,
      type: b.type,
      number: b.number,
      units: b.units,
      unitsTotal: b.units_total,
      amount: Number(b.amount),
      items: b.items || [],
    }));

    const results: Result[] = (resultsRes.data || []).map((r) => ({
      id: r.id,
      date: r.date,
      slot: r.slot,
      cityId: r.city_id,
      cityName: r.city_name || '',
      type: r.type,
      number: r.number,
      prizePerUnit: Number(r.prize_per_unit),
      totalPrize: Number(r.total_prize),
      winners: r.winners || [],
    }));

    return { cities, settings, bills, results };
  } catch (err) {
    console.warn('Failed to fetch data from Supabase cloud:', err);
    return null;
  }
}

export async function cloudInsertBill(bill: Bill): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('bills').insert({
      receipt: bill.receipt,
      date: bill.date,
      slot: bill.slot,
      time_label: bill.timeLabel,
      timestamp: bill.timestamp,
      counter: bill.counter,
      customer: bill.customer || null,
      city_id: bill.cityId,
      type: bill.type,
      number: bill.number,
      units: bill.units,
      units_total: bill.unitsTotal,
      amount: bill.amount,
      items: bill.items,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error inserting bill to cloud:', e);
    return false;
  }
}

export async function cloudInsertResult(result: Result): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('results').insert({
      date: result.date,
      slot: result.slot,
      city_id: result.cityId,
      city_name: result.cityName,
      type: result.type,
      number: result.number,
      prize_per_unit: result.prizePerUnit,
      total_prize: result.totalPrize,
      winners: result.winners,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error inserting result to cloud:', e);
    return false;
  }
}

export async function cloudSaveSettings(settings: Settings): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('settings').upsert({
      id: 'primary',
      start_time: settings.start,
      end_time: settings.end,
      interval_mins: settings.interval,
      lock_mins: settings.lockMins,
      counter_count: settings.counters.length,
      manual_lock: settings.manualLock,
      price_two_digit: settings.priceTwoDigit,
      price_one_digit: settings.priceOneDigit,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error saving settings to cloud:', e);
    return false;
  }
}

export async function cloudUpsertCity(city: City): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('cities').upsert({
      id: city.id,
      name: city.name,
      enabled: city.enabled,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error saving city to cloud:', e);
    return false;
  }
}

export async function cloudUpsertCounter(counter: Counter): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('counters').upsert({
      id: counter.id,
      name: counter.name,
      email: counter.email,
      password: counter.password || '123456',
      enabled: counter.enabled,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error saving counter to cloud:', e);
    return false;
  }
}

export async function cloudDeleteCounter(counterId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('counters').delete().eq('id', counterId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Error deleting counter from cloud:', e);
    return false;
  }
}
