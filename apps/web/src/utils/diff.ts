export type DiffKind = 'changed' | 'added' | 'removed';

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  /** Value on side A (undefined when added). */
  a?: unknown;
  /** Value on side B (undefined when removed). */
  b?: unknown;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural diff of two JSON values. It only reports which paths differ and the two
 * values found there. It never computes anything from those values.
 */
export function diffJson(a: unknown, b: unknown, path = ''): DiffEntry[] {
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: DiffEntry[] = [];
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const p = `${path}[${i}]`;
      if (i >= a.length) out.push({ path: p, kind: 'added', b: b[i] });
      else if (i >= b.length) out.push({ path: p, kind: 'removed', a: a[i] });
      else out.push(...diffJson(a[i], b[i], p));
    }
    return out;
  }
  if (isObject(a) && isObject(b)) {
    const out: DiffEntry[] = [];
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const key of keys) {
      const p = path ? `${path}.${key}` : key;
      if (!(key in a)) out.push({ path: p, kind: 'added', b: b[key] });
      else if (!(key in b)) out.push({ path: p, kind: 'removed', a: a[key] });
      else out.push(...diffJson(a[key], b[key], p));
    }
    return out;
  }
  if (Object.is(a, b) || a === b) return [];
  return [{ path: path || '(raiz)', kind: 'changed', a, b }];
}
