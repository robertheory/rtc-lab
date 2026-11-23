import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = process.env.RTC_URL ?? 'http://localhost';
export const DASHBOARD = process.env.RTC_DASHBOARD_URL ?? 'http://localhost:8088';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SCENARIOS = resolve(ROOT, 'apps/web/public/scenarios');

export type EngineId = 'regular' | 'simples' | 'danfse';

export interface Scenario {
  id: string;
  method: string;
  endpoint: string;
  contentType: string;
  payload: string;
  query?: Record<string, string>;
  expected: { status: number; contentType?: string; estadoItens?: string[] };
}

export function manifest(engine: EngineId): { basePath: string; scenarios: Scenario[] } {
  return JSON.parse(readFileSync(resolve(SCENARIOS, engine, 'manifest.json'), 'utf8'));
}

export function payload(engine: EngineId, s: Scenario): Buffer {
  return readFileSync(resolve(SCENARIOS, engine, 'payloads', s.payload));
}

export function scenarioUrl(basePath: string, s: Scenario): string {
  const qs = s.query ? `?${new URLSearchParams(s.query)}` : '';
  return `${BASE}${basePath}${s.endpoint}${qs}`;
}
