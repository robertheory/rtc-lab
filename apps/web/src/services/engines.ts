import type { EngineId } from '../types';
import { send } from './http';

export interface EngineInfo {
  id: EngineId;
  label: string;
  short: string;
  description: string;
  basePath: string;
  healthPath: string;
  /** Path of a version endpoint, when the engine has one. */
  versionPath?: string;
  route: string;
  repository: string;
}

export const ENGINES: Record<EngineId, EngineInfo> = {
  regular: {
    id: 'regular',
    label: 'Regime Regular',
    short: 'Regular',
    description: 'Cálculo de CBS, IBS e Imposto Seletivo, classificações tributárias, alíquotas e XML tributário.',
    basePath: '/api/regular',
    healthPath: '/health/regular',
    versionPath: '/api/regular/calculadora/dados-abertos/versao',
    route: '#/regular',
    repository: 'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular',
  },
  simples: {
    id: 'simples',
    label: 'Simples Nacional',
    short: 'Simples',
    description: 'Cálculo de CBS e IBS para operações do Simples Nacional, atividades e observabilidade por item.',
    basePath: '/api/simples',
    healthPath: '/health/simples',
    versionPath: '/api/simples/versao',
    route: '#/simples',
    repository: 'https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional',
  },
  danfse: {
    id: 'danfse',
    label: 'Gerador DANFSe',
    short: 'DANFSe',
    description: 'Recebe o XML de uma NFS-e e devolve o DANFSe em PDF.',
    basePath: '/api/danfse',
    healthPath: '/api/danfse/health/ready',
    route: '#/danfse',
    repository: 'https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse',
  },
};

export const ENGINE_IDS = Object.keys(ENGINES) as EngineId[];

export type HealthState = 'checking' | 'up' | 'down';

export interface HealthResult {
  state: HealthState;
  detail: string;
  durationMs: number;
}

/**
 * Asks the engine's real health endpoint. "up" requires the engine itself to
 * answer UP/ok, a running container is not enough.
 */
export async function checkHealth(id: EngineId): Promise<HealthResult> {
  const res = await send({ method: 'GET', url: ENGINES[id].healthPath, timeoutMs: 5000 });
  if (!res.received) return { state: 'down', detail: res.error?.message ?? 'Sem resposta.', durationMs: res.durationMs };
  let status = '';
  try {
    status = String((JSON.parse(res.text ?? '{}') as { status?: unknown }).status ?? '');
  } catch {
    status = '';
  }
  const up = res.status === 200 && ['UP', 'ok'].includes(status);
  return {
    state: up ? 'up' : 'down',
    detail: up ? 'Respondendo' : `HTTP ${res.status}${status ? ` (${status})` : ''}`,
    durationMs: res.durationMs,
  };
}

export interface LockEntry {
  name: string;
  repository: string;
  tag: string;
  commit: string;
}
export type EnginesLock = Record<EngineId, LockEntry>;

let lockCache: Promise<EnginesLock | null> | undefined;
export function loadLock(): Promise<EnginesLock | null> {
  lockCache ??= fetch('/engines.lock.json', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<EnginesLock>) : null))
    .catch(() => null);
  return lockCache;
}

export interface VersionInfo {
  app?: string;
  db?: string;
  dbDescription?: string;
  dbDate?: string;
}

/** Live version reported by the Java engines (DANFSe has no version endpoint). */
export async function fetchVersion(id: EngineId): Promise<VersionInfo | null> {
  const path = ENGINES[id].versionPath;
  if (!path) return null;
  const res = await send({ method: 'GET', url: path, timeoutMs: 5000 });
  if (!res.received || res.status !== 200 || !res.text) return null;
  try {
    const j = JSON.parse(res.text) as Record<string, string>;
    return {
      app: j.versaoApp ?? j.descricaoVersaoApp,
      db: j.versaoDb,
      dbDescription: j.descricaoVersaoDb,
      dbDate: j.dataVersaoDb,
    };
  } catch {
    return null;
  }
}
