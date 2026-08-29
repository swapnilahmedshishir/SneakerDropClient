import { useEffect, useState } from 'react';

// The server (Postgres / Prisma) returns timestamps such as
// "2026-08-29 10:20:15.938+06". Normalize both the space separator and the
// bare-hour offset so every JS engine (including Safari) parses it reliably:
//   "2026-08-29 10:20:15.938+06"  -> "2026-08-29T10:20:15.938+06:00"
//   "2026-08-29T10:20:15.938+0630" -> "2026-08-29T10:20:15.938+06:30"
function toTimestamp(timestamp) {
  if (!timestamp) return NaN;
  let normalized = String(timestamp).replace(' ', 'T');
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  normalized = normalized.replace(/([+-]\d{2})$/, '$1:00');
  return new Date(normalized).getTime();
}

export function msUntil(timestamp) {
  const target = toTimestamp(timestamp);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, target - Date.now());
}

export function formatCountdown(totalMs) {
  const totalSeconds = Math.ceil(Math.max(0, totalMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Ticks down to the server-provided `expiresAt`. The countdown is purely a
 * display: the backend/database remains the authority on whether a reservation
 * is still valid.
 *
 * The initial state is computed once at mount (lazy initializer) and the
 * interval callback updates it — there is no synchronous setState in the
 * effect, so React's compiler lints stay quiet. Mount it fresh per reservation
 * (e.g. via `key={reservation.id}`) so the initial value is always correct.
 */
export function useCountdown(expiresAt) {
  const [remainingMs, setRemainingMs] = useState(() => msUntil(expiresAt));

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setRemainingMs(msUntil(expiresAt));
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [expiresAt]);

  return remainingMs;
}