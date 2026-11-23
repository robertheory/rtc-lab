const LOCAL_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;
const OFFSET_RE = /([+-]\d{2}:\d{2}|Z)$/;

/** ISO 8601 with offset -> value accepted by <input type="datetime-local">. */
export function isoToLocalInput(iso: unknown): string {
  const m = typeof iso === 'string' ? LOCAL_RE.exec(iso) : null;
  return m ? m[1] : '';
}

/**
 * datetime-local value -> ISO 8601 with offset. Keeps the offset (and seconds) of the
 * previous value when the minute did not change, otherwise uses Brasilia time (-03:00).
 */
export function localInputToIso(local: string, previous?: unknown): string {
  if (!local) return '';
  const prev = typeof previous === 'string' ? previous : '';
  const offset = OFFSET_RE.exec(prev)?.[1] ?? '-03:00';
  if (isoToLocalInput(prev) === local) return prev;
  return `${local}:00${offset}`;
}

export const isDateOnly = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
