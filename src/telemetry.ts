/**
 * Anonymous play statistics: how far games get and how long people play. Moments are queued and
 * posted in small batches to /api/event (worker/index.ts), which files them in Cloudflare's
 * Analytics Engine. There is a random id per browser so one player's moments can be counted as
 * one player; no name, no cookie, nothing typed. Browsers asking not to be tracked send nothing,
 * and neither does the dev server or the debug panel.
 */
import type { GameState } from './core/state';
import { moments, progress, snapshot, type Moment, type Snapshot } from './core/telemetry';
import { currentLocale } from './i18n';

const ENDPOINT = '/api/event';
const PLAYER = 'idleBeer.pid';
const SESSIONS = 'idleBeer.sessions';
const FLUSH_MS = 15_000;
const HEARTBEAT_SECONDS = 60;
const BATCH = 40;

interface Queued { e: string; l: string; n: number; c: number[] }

const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
const enabled = import.meta.env.PROD
  && !new URLSearchParams(location.search).has('debug')
  && nav.doNotTrack !== '1'
  && !nav.globalPrivacyControl;

function remembered(key: string, make: (old: string | null) => string): string {
  try {
    const value = make(localStorage.getItem(key));
    localStorage.setItem(key, value);
    return value;
  } catch {
    return make(null); // private browsing: a new player every visit
  }
}

const player = enabled
  ? remembered(PLAYER, (old) => old ?? [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join(''))
  : '';
const session = enabled ? Number(remembered(SESSIONS, (old) => String((Number(old) || 0) + 1))) : 0;
const device = matchMedia('(pointer: coarse)').matches ? (Math.min(innerWidth, innerHeight) < 600 ? 'phone' : 'tablet') : 'desktop';

let queue: Queued[] = [];
let getState: (() => GameState) | null = null;
let last: Snapshot | null = null;
/** Seconds this visit with the tab in view. */
let sessionSeconds = 0;
let sinceHeartbeat = 0;
let watching = false;

/** Count one moment, with where the game stands right now. `now` posts it at once (the page is about to go). */
export function track(event: string, label = '', value = 0, now = false): void {
  if (!enabled || !getState) return;
  queue.push({ e: event, l: label, n: value, c: progress(getState(), sessionSeconds, session) });
  if (now) flush(true);
  else if (queue.length >= BATCH) flush();
}

function flush(leaving = false): void {
  if (!queue.length) return;
  const body = JSON.stringify({ p: player, g: currentLocale().path || 'en', d: device, r: referrer(), events: queue.splice(0, BATCH) });
  try {
    if (leaving && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
    else void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch {
    // Statistics never get in the way of the game.
  }
}

/** The site that sent them here, if it wasn't this one. */
function referrer(): string {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    return host === location.hostname ? '' : host;
  } catch {
    return '';
  }
}

/** Start counting for this game. `returning` is whether there was a save to come back to. */
export function startTelemetry(state: () => GameState, returning: boolean): void {
  if (!enabled || watching) return;
  watching = true;
  getState = state;
  last = snapshot(state());
  track('load', returning ? 'returning' : 'new', returning ? 1 : 0);
  setInterval(() => flush(), FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    track('session_end', '', Math.round(sessionSeconds));
    flush(true);
  });
}

/** Call about once a second with the time since the last call: notices whatever has changed. */
export function observe(elapsed: number): void {
  if (!enabled || !getState || !last) return;
  const now = snapshot(getState());
  for (const m of moments(last, now) as Moment[]) track(m.event, m.label, m.value);
  last = now;
  if (document.visibilityState !== 'visible') return;
  // A tab left in the background catches up in one long step: that isn't time spent looking at it.
  const seen = Math.min(elapsed, 5);
  sessionSeconds += seen;
  sinceHeartbeat += seen;
  if (sinceHeartbeat >= HEARTBEAT_SECONDS) {
    sinceHeartbeat = 0;
    track('heartbeat', '', Math.round(sessionSeconds));
  }
}
