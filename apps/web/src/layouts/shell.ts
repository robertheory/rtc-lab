import { ENGINE_IDS, ENGINES } from '../services/engines';
import { subscribeHealth } from '../services/healthMonitor';
import { getPref, setPref } from '../services/uiPrefs';
import { h } from '../utils/dom';
import { ROUTES } from '../pages/routes';

export const DISCLAIMER = 'Projeto independente, não oficial da Receita Federal. Cálculos dos motores open source oficiais. Use só para experimentar e aprender.';

export interface Shell {
  view: HTMLElement;
  setActive(path: string): void;
}

const COLLAPSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 7-5 5 5 5M18 7l-5 5 5 5"/></svg>';
const MENU_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

function icon(svg: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'd-inline-flex';
  span.innerHTML = svg; // static, trusted markup defined in this repository
  return span;
}

/** Collapsible sidebar + header + main area, with the disclaimer as a thin centered banner on top. */
export function buildShell(app: HTMLElement): Shell {
  const links = new Map<string, HTMLElement>();
  const navGroup = (title: string | null, group: string) => [
    title ? h('div', { class: 'rtc-nav-title' }, title) : null,
    ...ROUTES.filter((r) => r.group === group).map((r) => {
      const a = h('a', { class: 'rtc-nav-link', href: `#${r.path}`, 'data-nav': r.path, title: r.nav }, icon(r.icon), h('span', { class: 'rtc-nav-label' }, r.nav));
      links.set(r.path, a);
      return a;
    }),
  ];

  const dots = new Map(ENGINE_IDS.map((id) => [id, h('span', { class: 'rtc-dot', 'data-dot': id, title: ENGINES[id].label })]));
  const sidebar = h('aside', { class: 'rtc-sidebar', id: 'rtc-sidebar' },
    h('a', { class: 'rtc-brand', href: '#/', title: 'RTC Lab' }, h('span', { class: 'rtc-logo', 'aria-hidden': 'true' }, 'RTC'), h('span', { class: 'rtc-brand-text' }, h('strong', null, 'RTC Lab'), h('small', null, 'Laboratório'))),
    h('nav', { 'aria-label': 'Navegação principal' }, ...navGroup(null, 'home'), ...navGroup('Motores', 'engines'), ...navGroup('Ferramentas', 'tools')));

  const shellEl = h('div', { class: 'rtc-shell', 'data-collapsed': String(getPref('sidebar-collapsed', false)) });

  // Collapse/expand control pinned to the bottom of the sidebar.
  const collapseLabel = h('span', { class: 'rtc-nav-label' });
  const collapseBtn = h('button', { type: 'button', class: 'rtc-nav-link rtc-collapse', 'data-testid': 'sidebar-toggle' }, icon(COLLAPSE_ICON), collapseLabel);
  sidebar.appendChild(collapseBtn);
  const syncCollapse = () => {
    const collapsed = shellEl.dataset.collapsed === 'true';
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    collapseBtn.title = collapsed ? 'Expandir' : 'Recolher';
    collapseLabel.textContent = collapsed ? 'Expandir' : 'Recolher';
  };
  collapseBtn.addEventListener('click', () => {
    const next = shellEl.dataset.collapsed !== 'true';
    shellEl.dataset.collapsed = String(next);
    setPref('sidebar-collapsed', next);
    syncCollapse();
  });
  syncCollapse();

  const menuBtn = h('button', { type: 'button', class: 'rtc-icon-btn d-lg-none', 'aria-label': 'Abrir menu', 'aria-controls': 'rtc-sidebar', onClick: () => sidebar.classList.toggle('open') }, icon(MENU_ICON));
  const header = h('header', { class: 'rtc-header' },
    menuBtn,
    h('div', { class: 'rtc-header-title' }, h('strong', null, 'RTC Lab'), h('span', { class: 'd-none d-md-inline text-secondary' }, ' · laboratório dos motores da Reforma Tributária do Consumo')),
    h('div', { class: 'rtc-status', 'aria-label': 'Disponibilidade dos motores' }, ...ENGINE_IDS.map((id) => h('span', { class: 'rtc-status-item' }, dots.get(id)!, ENGINES[id].short))));

  const view = h('main', { class: 'rtc-view', id: 'view' });
  const banner = h('div', { class: 'rtc-disclaimer', role: 'note', title: DISCLAIMER, 'data-testid': 'disclaimer' }, DISCLAIMER);

  shellEl.append(banner, sidebar, h('div', { class: 'rtc-main' }, header, view));
  app.append(shellEl);
  sidebar.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) sidebar.classList.remove('open');
  });

  subscribeHealth((state) => {
    for (const id of ENGINE_IDS) dots.get(id)?.setAttribute('data-state', state[id].state);
  });

  return {
    view,
    setActive(path) {
      for (const [p, a] of links) a.classList.toggle('active', p === path);
    },
  };
}
