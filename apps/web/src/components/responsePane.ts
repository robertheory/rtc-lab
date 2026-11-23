import type { EngineResponse } from '../types';
import { clear, h } from '../utils/dom';
import { renderResponse, type ViewerOptions } from './responseViewer';
import { spinner } from './ui';

export interface EmptyState {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}

export interface ResponsePane {
  empty(): void;
  loading(onCancel: () => void): void;
  show(res: EngineResponse, opts?: ViewerOptions): void;
  /** Shows custom content (e.g. the generated PDF) in the pane. */
  showNode(node: Node): void;
}

/** Controller for the right-hand pane of a workbench. Announces status changes to screen readers. */
export function responsePane(host: HTMLElement, empty: EmptyState): ResponsePane {
  const live = h('div', { class: 'rtc-status-live', role: 'status', 'aria-live': 'polite' });
  const content = h('div', { class: 'flex-fill d-flex flex-column', style: 'min-height:0' });
  host.append(content, live);

  const set = (node: Node) => {
    clear(content);
    content.appendChild(node);
  };
  const api: ResponsePane = {
    empty() {
      live.textContent = '';
      set(h('div', { class: 'rtc-empty', 'data-testid': 'response-empty' },
        h('div', null, h('strong', null, empty.title), h('p', { class: 'mb-0' }, empty.hint)),
        empty.action ? h('div', null, h('button', { type: 'button', class: 'btn btn-outline-primary btn-sm', onClick: empty.action.onClick }, empty.action.label)) : null));
    },
    loading(onCancel) {
      live.textContent = 'Executando no motor...';
      set(h('div', { class: 'rtc-empty', 'data-testid': 'response-loading' }, spinner('Executando no motor...'),
        h('div', null, h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', 'data-action': 'cancel', onClick: onCancel }, 'Cancelar'))));
    },
    show(res, opts = {}) {
      live.textContent = res.error ? 'Execução sem resposta.' : `Resposta recebida: HTTP ${res.status}.`;
      set(renderResponse(res, { fill: true, ...opts }));
    },
    showNode(node) {
      live.textContent = 'Resultado disponível.';
      set(node);
    },
  };
  api.empty();
  return api;
}
