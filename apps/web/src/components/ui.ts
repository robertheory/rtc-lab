import { h } from '../utils/dom';
import type { HealthState } from '../services/engines';

export function spinner(label = 'Carregando...'): HTMLElement {
  return h('div', { class: 'd-flex align-items-center gap-2 text-secondary py-2', role: 'status' },
    h('span', { class: 'spinner-border spinner-border-sm', 'aria-hidden': 'true' }),
    h('span', null, label));
}

export function alertBox(kind: 'success' | 'info' | 'warning' | 'danger', ...content: (Node | string)[]): HTMLElement {
  return h('div', { class: `alert alert-${kind} py-2 mb-2`, role: kind === 'danger' ? 'alert' : 'status' }, ...content);
}

export function badge(text: string, tone: string = 'secondary'): HTMLElement {
  return h('span', { class: `badge text-bg-${tone}` }, text);
}

const HEALTH_LABEL: Record<HealthState, string> = { checking: 'Verificando', up: 'Disponível', down: 'Indisponível' };
const HEALTH_TONE: Record<HealthState, string> = { checking: 'secondary', up: 'success', down: 'danger' };

export function healthBadge(state: HealthState): HTMLElement {
  return h('span', { class: `badge text-bg-${HEALTH_TONE[state]}`, 'data-health': state }, HEALTH_LABEL[state]);
}

export function button(label: string, onClick: (e: MouseEvent) => void, variant = 'primary', extra: Record<string, unknown> = {}): HTMLButtonElement {
  return h('button', { type: 'button', class: `btn btn-${variant}`, onClick, ...extra }, label);
}

export interface TabItem {
  id: string;
  label: string;
  render: () => Node;
}

/** Tab strip with lazy panels. Panels are kept mounted once opened, so editor state survives tab changes. */
export function tabs(items: TabItem[], initial?: string, opts: { fill?: boolean; compact?: boolean } = {}): { el: HTMLElement; select: (id: string) => void } {
  const nav = h('ul', { class: `nav nav-tabs ${opts.compact ? 'mb-2' : 'mb-3'}`, role: 'tablist' });
  const body = h('div', { class: opts.fill ? 'rtc-tabs-body' : '' });
  const panels = new Map<string, HTMLElement>();
  const links = new Map<string, HTMLElement>();

  const select = (id: string) => {
    for (const item of items) {
      const active = item.id === id;
      links.get(item.id)?.classList.toggle('active', active);
      links.get(item.id)?.setAttribute('aria-selected', String(active));
      let panel = panels.get(item.id);
      if (active && !panel) {
        panel = h('div', { role: 'tabpanel', 'data-tab': item.id }, item.render());
        panels.set(item.id, panel);
        body.appendChild(panel);
      }
      if (panel) panel.hidden = !active;
    }
  };

  for (const item of items) {
    const link = h('button', { type: 'button', class: 'nav-link', role: 'tab', onClick: () => select(item.id), 'data-tab-link': item.id }, item.label);
    links.set(item.id, link);
    nav.appendChild(h('li', { class: 'nav-item', role: 'presentation' }, link));
  }
  select(initial ?? items[0].id);
  return { el: h('div', { class: opts.fill ? 'rtc-tabs rtc-tabs-fill' : 'rtc-tabs' }, nav, body), select };
}
