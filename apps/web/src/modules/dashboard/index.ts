import { badge, healthBadge } from '../../components/ui';
import { ENGINE_IDS, ENGINES, fetchVersion, loadLock, type HealthResult, type VersionInfo } from '../../services/engines';
import { subscribeHealth } from '../../services/healthMonitor';
import { loadManifest } from '../../services/scenarios';
import type { EngineId, Scenario } from '../../types';
import { clear, h } from '../../utils/dom';

export function mountDashboard(root: HTMLElement): () => void {
  const cards = new Map<EngineId, { badge: HTMLElement; detail: HTMLElement; version: HTMLElement }>();

  const engineCards = ENGINE_IDS.map((id) => {
    const e = ENGINES[id];
    const healthHost = h('span', null, healthBadge('checking'));
    const detail = h('div', { class: 'small text-secondary' }, 'Verificando...');
    const version = h('div', { class: 'small', 'data-testid': `version-${id}` }, 'Versão: ...');
    const quick = h('ul', { class: 'list-unstyled small mb-0' });
    cards.set(id, { badge: healthHost, detail, version });

    void loadManifest(id).then((m) => {
      const picks: Scenario[] = m.scenarios.slice(0, 3);
      for (const s of picks) quick.appendChild(h('li', null, h('a', { href: `${e.route}?cenario=${s.id}&executar=1` }, s.name)));
    }).catch(() => quick.appendChild(h('li', { class: 'text-secondary' }, 'Catálogo indisponível.')));

    return h('div', { class: 'col-lg-4' },
      h('div', { class: 'card h-100 rtc-card', 'data-engine': id },
        h('div', { class: 'card-body d-flex flex-column' },
          h('div', { class: 'd-flex justify-content-between align-items-start mb-2' }, h('h2', { class: 'h5 mb-0' }, e.label), healthHost),
          h('p', { class: 'small text-secondary' }, e.description),
          detail, version,
          h('h3', { class: 'h6 mt-3' }, 'Cenários de demonstração'), quick,
          h('div', { class: 'mt-auto pt-3 d-flex gap-2' },
            h('a', { class: 'btn btn-primary btn-sm', href: e.route }, 'Experimentar'),
            h('a', { class: 'btn btn-outline-secondary btn-sm', href: e.repository, target: '_blank', rel: 'noopener noreferrer' }, 'Repositório oficial')))));
  });

  clear(root);
  root.append(
    h('section', { class: 'rtc-hero mb-4' },
      h('h1', { class: 'display-6 fw-semibold' }, 'RTC Lab'),
      h('p', { class: 'lead mb-2' }, 'Laboratório interativo para experimentar os motores open source da Receita Federal para a Reforma Tributária do Consumo.'),
      h('p', { class: 'mb-0 text-secondary' }, 'Você escolhe um cenário, executa e vê a resposta real do motor oficial. Nenhuma regra tributária é reimplementada aqui.')),
    h('div', { class: 'row g-3' }, engineCards),
    h('div', { class: 'row g-3 mt-1' },
      h('div', { class: 'col-md-4' }, shortcut('#/playground', 'Playground de APIs', 'Monte requisições, veja a resposta original e copie o curl.')),
      h('div', { class: 'col-md-4' }, shortcut('#/comparador', 'Comparador', 'Execute duas operações parecidas e compare as respostas.')),
      h('div', { class: 'col-md-4' }, shortcut('#/historico', 'Histórico local', 'Reveja e reexecute as chamadas feitas neste navegador.'))),
  );

  const unsubscribe = subscribeHealth((state) => {
    for (const id of ENGINE_IDS) {
      const c = cards.get(id);
      if (!c) continue;
      const r: HealthResult = state[id];
      c.badge.replaceChildren(healthBadge(r.state));
      c.detail.textContent = r.state === 'checking' ? 'Verificando...' : `${r.detail}${r.state === 'up' ? ` · ${r.durationMs} ms` : ''}`;
    }
  });

  void renderVersions(cards);
  const versionTimer = setInterval(() => void renderVersions(cards), 60_000);
  return () => {
    unsubscribe();
    clearInterval(versionTimer);
  };
}

function shortcut(href: string, title: string, text: string): HTMLElement {
  return h('a', { class: 'card rtc-card rtc-shortcut text-decoration-none h-100', href },
    h('div', { class: 'card-body' }, h('h2', { class: 'h6' }, title), h('p', { class: 'small text-secondary mb-0' }, text)));
}

async function renderVersions(cards: Map<EngineId, { version: HTMLElement }>): Promise<void> {
  const lock = await loadLock();
  await Promise.all(ENGINE_IDS.map(async (id) => {
    const target = cards.get(id)?.version;
    if (!target) return;
    const pinned = lock?.[id];
    const live: VersionInfo | null = await fetchVersion(id);
    const parts: (Node | string | null)[] = [
      pinned ? h('div', null, 'Versão fixada: ', badge(pinned.tag, 'dark'), ' ', h('span', { class: 'text-secondary' }, pinned.commit.slice(0, 7))) : 'Versão fixada: indisponível',
      live?.app ? h('div', null, 'Aplicação: ', h('code', null, live.app)) : null,
      live?.db ? h('div', { title: live.dbDescription ?? '' }, 'Base de dados: ', h('code', null, live.db), live.dbDate ? ` (${live.dbDate})` : '') : null,
      id === 'danfse' ? h('div', { class: 'text-secondary' }, 'O motor não expõe endpoint de versão.') : null,
    ];
    target.replaceChildren(...parts.filter((p): p is Node | string => p !== null));
  }));
}
