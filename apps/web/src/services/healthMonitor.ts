import { checkHealth, ENGINE_IDS, type HealthResult } from './engines';
import type { EngineId } from '../types';

type Listener = (state: Record<EngineId, HealthResult>) => void;

const INTERVAL_MS = 15_000;
const state = Object.fromEntries(ENGINE_IDS.map((id) => [id, { state: 'checking', detail: '', durationMs: 0 } as HealthResult])) as Record<EngineId, HealthResult>;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | undefined;

export async function refreshHealth(): Promise<void> {
  await Promise.all(ENGINE_IDS.map(async (id) => {
    state[id] = await checkHealth(id);
    emit();
  }));
}

function emit(): void {
  for (const l of listeners) l({ ...state });
}

/** Subscribes to health updates. Polling runs only while there is at least one subscriber. */
export function subscribeHealth(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  if (!timer) {
    void refreshHealth();
    timer = setInterval(() => void refreshHealth(), INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
