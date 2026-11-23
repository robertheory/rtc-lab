import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE, DASHBOARD, ROOT } from './helpers';

describe('stack startup and routing (real engines through Traefik)', () => {
  it.each([
    ['/health/regular', 'UP'],
    ['/health/simples', 'UP'],
    ['/api/danfse/health/ready', 'ok'],
  ])('%s reports the engine itself as healthy', async (path, status) => {
    const res = await fetch(BASE + path);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe(status);
  });

  it('serves the web app on / and real 404 for unknown paths', async () => {
    const home = await fetch(BASE + '/');
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('RTC Lab');
    expect((await fetch(BASE + '/nao-existe')).status).toBe(404);
  });

  it('routes each engine under its prefix', async () => {
    expect((await fetch(`${BASE}/api/regular/calculadora/dados-abertos/versao`)).status).toBe(200);
    const simples = await fetch(`${BASE}/api/simples/versao`);
    expect(simples.status).toBe(200);
    expect(await simples.json()).toHaveProperty('versaoApp');
  });

  it('does not expose metrics or actuator beyond /health/<engine>', async () => {
    for (const p of ['/metrics', '/health/metrics', '/health']) {
      expect((await fetch(BASE + p)).status).toBe(404);
    }
  });

  it('keeps the Traefik dashboard off the public port', async () => {
    expect((await fetch(`${BASE}/dashboard/`)).status).toBe(404);
    expect((await fetch(`${DASHBOARD}/dashboard/`)).status).toBe(200);
  });

  it('does not publish engine ports on the host', async () => {
    for (const port of [8080, 8082, 9101, 9103]) {
      await expect(fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) })).rejects.toThrow();
    }
  });

  it('keeps engines.lock.json in sync with the pinned submodules', () => {
    const lock = JSON.parse(readFileSync(resolve(ROOT, 'apps/web/public/engines.lock.json'), 'utf8')) as Record<string, { commit: string }>;
    const status = execFileSync('git', ['submodule', 'status'], { cwd: ROOT, encoding: 'utf8' });
    const sha = (dir: string) => new RegExp(`^[ +-]?([0-9a-f]{40}) services/${dir}`, 'm').exec(status)?.[1];
    expect(sha('regime-regular')).toBe(lock.regular.commit);
    expect(sha('simples-nacional')).toBe(lock.simples.commit);
    expect(sha('danfse')).toBe(lock.danfse.commit);
  });
});
