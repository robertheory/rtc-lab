import type { EngineId, EngineRequest, Manifest, Scenario } from '../types';

const manifests = new Map<EngineId, Promise<Manifest>>();

export function loadManifest(engine: EngineId): Promise<Manifest> {
  let p = manifests.get(engine);
  if (!p) {
    p = fetch(`/scenarios/${engine}/manifest.json`, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`Catálogo de cenários indisponível (HTTP ${r.status}).`);
      return r.json() as Promise<Manifest>;
    });
    manifests.set(engine, p);
    p.catch(() => manifests.delete(engine));
  }
  return p;
}

export async function loadPayload(engine: EngineId, scenario: Scenario): Promise<string> {
  const r = await fetch(`/scenarios/${engine}/payloads/${scenario.payload}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Payload do cenário "${scenario.name}" indisponível (HTTP ${r.status}).`);
  return r.text();
}

export function buildUrl(basePath: string, endpoint: string, query?: Record<string, string>): string {
  let url = `${basePath}${endpoint}`;
  if (query && Object.keys(query).length > 0) {
    url += (url.includes('?') ? '&' : '?') + new URLSearchParams(query).toString();
  }
  return url;
}

export function buildRequest(manifest: Manifest, scenario: Scenario, payload: string): EngineRequest {
  return {
    method: scenario.method,
    url: buildUrl(manifest.basePath, scenario.endpoint, scenario.query),
    headers: { 'Content-Type': scenario.contentType },
    body: payload,
    responseType: scenario.expected.contentType === 'application/pdf' ? 'blob' : 'text',
  };
}

export async function findScenario(engine: EngineId, id: string): Promise<Scenario | undefined> {
  return (await loadManifest(engine)).scenarios.find((s) => s.id === id);
}
