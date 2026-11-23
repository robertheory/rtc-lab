import { getPref, setPref } from '../services/uiPrefs';
import { h } from '../utils/dom';

export interface Workbench {
  el: HTMLElement;
  leftBar: HTMLElement;
  leftBody: HTMLElement;
  rightBody: HTMLElement;
  showRequest(): void;
  showResponse(): void;
}

const MIN_PANE_PX = 448; // 28rem

/**
 * Two-pane workbench, the usual API-client layout: request on the left, response on the right.
 * The divider is draggable (and keyboard-operable), its position is remembered per `prefKey`.
 * Below 1200px the panes stack and a switch chooses which one is visible.
 */
export function workbench(opts: { prefKey: string; leftTitle: string; rightTitle: string }): Workbench {
  const key = `split:${opts.prefKey}`;
  const root = h('div', { class: 'rtc-wb', 'data-view': 'request', 'data-testid': 'workbench' });
  const setRatio = (pct: number, persist: boolean) => {
    const width = root.getBoundingClientRect().width || window.innerWidth;
    const min = Math.min(45, (MIN_PANE_PX / width) * 100);
    const clamped = Math.round(Math.min(100 - min, Math.max(min, pct)) * 10) / 10;
    root.style.setProperty('--wb-left', `${clamped}%`);
    split.setAttribute('aria-valuenow', String(Math.round(clamped)));
    if (persist) setPref(key, clamped);
    return clamped;
  };

  const leftBar = h('div', { class: 'rtc-wb-bar', role: 'toolbar', 'aria-label': opts.leftTitle }, h('h2', { class: 'rtc-wb-title' }, opts.leftTitle));
  const leftBody = h('div', { class: 'rtc-wb-body' });
  const left = h('section', { class: 'rtc-wb-pane rtc-wb-left', 'aria-label': opts.leftTitle }, leftBar, leftBody);

  const rightBar = h('div', { class: 'rtc-wb-bar' }, h('h2', { class: 'rtc-wb-title' }, opts.rightTitle));
  const rightBody = h('div', { class: 'rtc-wb-body rtc-wb-body--flush', 'data-testid': 'response-pane' });
  const right = h('section', { class: 'rtc-wb-pane rtc-wb-right', 'aria-label': opts.rightTitle }, rightBar, rightBody);

  const split = h('div', { class: 'rtc-wb-split', role: 'separator', tabindex: 0, 'aria-orientation': 'vertical', 'aria-label': 'Redimensionar painéis', 'aria-valuemin': 20, 'aria-valuemax': 80, 'aria-valuenow': 46, 'data-testid': 'splitter' });
  split.addEventListener('pointerdown', (e) => {
    split.setPointerCapture(e.pointerId);
    split.dataset.drag = 'true';
    const rect = root.getBoundingClientRect();
    const move = (ev: PointerEvent) => setRatio(((ev.clientX - rect.left) / rect.width) * 100, false);
    const up = (ev: PointerEvent) => {
      split.releasePointerCapture(ev.pointerId);
      delete split.dataset.drag;
      split.removeEventListener('pointermove', move);
      split.removeEventListener('pointerup', up);
      setRatio(((ev.clientX - rect.left) / rect.width) * 100, true);
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up);
  });
  split.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const now = Number(split.getAttribute('aria-valuenow') ?? 46);
    setRatio(now + (e.key === 'ArrowRight' ? 2 : -2), true);
  });

  const reqBtn = h('button', { type: 'button', 'aria-pressed': 'true', onClick: () => view('request') }, 'Requisição');
  const resBtn = h('button', { type: 'button', 'aria-pressed': 'false', onClick: () => view('response') }, 'Resposta');
  const view = (v: 'request' | 'response') => {
    root.dataset.view = v;
    reqBtn.setAttribute('aria-pressed', String(v === 'request'));
    resBtn.setAttribute('aria-pressed', String(v === 'response'));
  };

  root.append(h('div', { class: 'rtc-wb-switch rtc-seg', role: 'group', 'aria-label': 'Painel visível' }, reqBtn, resBtn), left, split, right);
  queueMicrotask(() => setRatio(getPref(key, 46), false));

  return { el: root, leftBar, leftBody, rightBody, showRequest: () => view('request'), showResponse: () => view('response') };
}
