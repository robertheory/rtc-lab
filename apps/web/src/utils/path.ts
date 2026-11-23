type Json = Record<string, unknown>;

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Json)[key];
  }
  return cur;
}

/** Sets a nested value, creating intermediate objects. `undefined` removes the key (and empty parents). */
export function setPath(obj: Json, path: string, value: unknown): void {
  const keys = path.split('.');
  const parents: Json[] = [obj];
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = cur[keys[i]];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) {
      if (value === undefined) return;
      cur[keys[i]] = {};
    }
    cur = cur[keys[i]] as Json;
    parents.push(cur);
  }
  const last = keys[keys.length - 1];
  if (value === undefined) {
    delete cur[last];
    for (let i = keys.length - 2; i >= 0; i--) {
      const child = parents[i + 1];
      if (Object.keys(child).length === 0) delete parents[i][keys[i]];
      else break;
    }
  } else {
    cur[last] = value;
  }
}
