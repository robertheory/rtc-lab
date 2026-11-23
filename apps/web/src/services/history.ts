import type { EngineRequest, EngineResponse, HistoryEntry } from '../types';

const KEY = 'rtc-lab:history:v1';
export const MAX_ENTRIES = 50;
export const MAX_FIELD_CHARS = 20_000;
export const MAX_TOTAL_CHARS = 1_500_000;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function truncate(text: string, max = MAX_FIELD_CHARS): { text: string; truncated: boolean } {
  return text.length > max ? { text: text.slice(0, max), truncated: true } : { text, truncated: false };
}

/** Keeps the newest entries within both the entry count and the total size budget. */
export function trimToBudget(entries: HistoryEntry[], maxEntries = MAX_ENTRIES, maxChars = MAX_TOTAL_CHARS): HistoryEntry[] {
  const kept: HistoryEntry[] = [];
  let total = 0;
  for (const entry of entries.slice(0, maxEntries)) {
    const size = JSON.stringify(entry).length;
    if (total + size > maxChars) break;
    kept.push(entry);
    total += size;
  }
  return kept;
}

export function listHistory(): HistoryEntry[] {
  const s = storage();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded: keep only the newest half and try once more.
    try {
      s.setItem(KEY, JSON.stringify(entries.slice(0, Math.max(1, Math.floor(entries.length / 2)))));
    } catch {
      /* storage unavailable: history simply does not persist */
    }
  }
}

export function clearHistory(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function removeHistoryEntry(id: string): void {
  save(listHistory().filter((e) => e.id !== id));
}

const isSensitiveType = (contentType: string) => /xml|pdf/i.test(contentType);

export interface RecordInput {
  engine: HistoryEntry['engine'];
  request: EngineRequest;
  response: EngineResponse;
  scenarioId?: string;
  scenarioName?: string;
}

/**
 * Builds the history record. Fiscal XML payloads and XML/PDF results are never stored:
 * only metadata is kept for them.
 */
export function buildEntry(input: RecordInput, now = new Date()): HistoryEntry {
  const { request, response } = input;
  const reqType = request.headers?.['Content-Type'] ?? '';
  const entry: HistoryEntry = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
    engine: input.engine,
    scenarioId: input.scenarioId,
    scenarioName: input.scenarioName,
    method: request.method,
    url: request.url,
    contentType: reqType,
    status: response.status,
    durationMs: response.durationMs,
    error: response.error?.message,
  };
  if (typeof request.body === 'string' && request.body !== '') {
    if (isSensitiveType(reqType)) entry.payloadOmitted = true;
    else {
      const t = truncate(request.body);
      entry.payload = t.text;
      if (t.truncated) entry.payloadOmitted = true;
    }
  }
  if (response.text !== undefined) {
    if (isSensitiveType(response.contentType)) entry.resultOmitted = true;
    else {
      const t = truncate(response.text);
      entry.result = t.text;
      entry.resultTruncated = t.truncated;
    }
  } else if (response.blob) {
    entry.resultOmitted = true;
  }
  return entry;
}

export function recordHistory(input: RecordInput): HistoryEntry {
  const entry = buildEntry(input);
  save(trimToBudget([entry, ...listHistory()]));
  return entry;
}
