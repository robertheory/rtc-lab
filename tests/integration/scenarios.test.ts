import { describe, expect, it } from 'vitest';
import { BASE, manifest, payload, scenarioUrl, type EngineId } from './helpers';

describe.each(['regular', 'simples', 'danfse'] as EngineId[])('scenario catalog: %s', (engine) => {
  const m = manifest(engine);

  it.each(m.scenarios.map((s) => [s.id, s] as const))('%s behaves as declared', async (_id, s) => {
    const res = await fetch(scenarioUrl(m.basePath, s), { method: s.method, headers: { 'Content-Type': s.contentType }, body: payload(engine, s) });
    expect(res.status).toBe(s.expected.status);
    if (s.expected.contentType) expect(res.headers.get('content-type')).toContain(s.expected.contentType);
    if (s.expected.contentType === 'application/pdf') {
      const bytes = Buffer.from(await res.arrayBuffer());
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      return;
    }
    if (s.expected.estadoItens) {
      const body = (await res.json()) as { objetos: { estadoItem: string }[] };
      expect(body.objetos.map((o) => o.estadoItem)).toEqual(s.expected.estadoItens);
    }
  });

  it('has unique ids and existing payload files', () => {
    expect(new Set(m.scenarios.map((s) => s.id)).size).toBe(m.scenarios.length);
    for (const s of m.scenarios) expect(() => payload(engine, s)).not.toThrow();
  });
});

describe('error handling (business errors reach the client untouched)', () => {
  it('regular: rejects invalid JSON with 400', async () => {
    const res = await fetch(`${BASE}/api/regular/calculadora/regime-geral`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    expect(res.status).toBe(400);
  });

  it('regular: 422 problem+json carries the engine error code', async () => {
    const m = manifest('regular');
    const s = m.scenarios.find((x) => x.id === 'erro-classificacao')!;
    const res = await fetch(scenarioUrl(m.basePath, s), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload('regular', s) });
    expect(res.status).toBe(422);
    expect(res.headers.get('content-type')).toContain('problem+json');
    expect(JSON.stringify(await res.json())).toContain('NCM não vinculada');
  });

  it('danfse: empty body and bad stc return the engine JSON error', async () => {
    const empty = await fetch(`${BASE}/api/danfse`, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: '' });
    expect(empty.status).toBe(400);
    expect((await empty.json()).sucesso).toBe(false);
    const bad = await fetch(`${BASE}/api/danfse?stc=9`, { method: 'POST', body: '<x/>' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).mensagem).toContain('stc');
  });

  it('danfse: upload above the limit is refused before reaching the engine', async () => {
    const res = await fetch(`${BASE}/api/danfse`, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: Buffer.alloc(7 * 1024 * 1024, 'a') });
    expect(res.status).toBe(413);
  });

  it('regular: oversized JSON is refused with 413', async () => {
    const res = await fetch(`${BASE}/api/regular/calculadora/regime-geral`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.alloc(2 * 1024 * 1024, 'a') });
    expect(res.status).toBe(413);
  });
});
