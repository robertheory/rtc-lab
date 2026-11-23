import type { EngineRequest, EngineResponse } from '../types';

export const DEFAULT_TIMEOUT_MS = 30_000;

/** Only same-origin paths below these prefixes may be called from the UI. */
const ALLOWED_PREFIXES = ['/api/regular/', '/api/simples/', '/api/danfse', '/health/'];

export function isAllowedPath(url: string): boolean {
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  const path = url.split('?')[0];
  if (path.includes('..')) return false;
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p));
}

/**
 * Sends a request to an engine through Traefik. Never throws: network failures and
 * timeouts are reported in `error`. Business errors (4xx/5xx) are returned untouched.
 */
export async function send(req: EngineRequest): Promise<EngineResponse> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  if (!isAllowedPath(req.url)) {
    return failure('network', `Destino não permitido: ${req.url}`, elapsed());
  }

  const controller = new AbortController();
  let cancelled = false;
  req.signal?.addEventListener('abort', () => {
    cancelled = true;
    controller.abort();
  });
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      signal: controller.signal,
      cache: 'no-store',
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => (headers[key] = value));
    const contentType = res.headers.get('content-type') ?? '';
    const base = {
      received: true,
      status: res.status,
      statusText: res.statusText,
      headers,
      contentType,
    };
    if (req.responseType === 'blob') {
      const blob = await res.blob();
      return { ...base, blob, durationMs: elapsed() };
    }
    const text = await res.text();
    return { ...base, text, durationMs: elapsed() };
  } catch (err) {
    if (cancelled) return failure('cancelled', 'Execução cancelada.', elapsed());
    if (controller.signal.aborted) {
      return failure('timeout', `Tempo esgotado após ${(req.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s.`, elapsed());
    }
    return failure('network', err instanceof Error ? err.message : 'Falha de rede.', elapsed());
  } finally {
    clearTimeout(timer);
  }
}

function failure(kind: 'timeout' | 'network' | 'cancelled', message: string, durationMs: number): EngineResponse {
  return {
    received: false,
    status: 0,
    statusText: '',
    headers: {},
    contentType: '',
    durationMs,
    error: { kind, message },
  };
}

/** Gateway-level statuses suggest the engine itself is unreachable. */
export function looksUnavailable(res: EngineResponse): boolean {
  return !res.received || [502, 503, 504].includes(res.status);
}
