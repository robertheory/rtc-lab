import type { EngineRequest, EngineResponse, Scenario } from '../types';
import { looksUnavailable } from '../services/http';
import { buildCurl } from '../utils/curl';
import { h } from '../utils/dom';
import { copyText, prettyJson, statusClass, tryParseJson } from '../utils/format';
import { formatBytes } from '../utils/files';
import { pointerToPath } from '../utils/pointer';
import { createEditor } from './editor';
import { alertBox, badge, tabs } from './ui';

const RELEVANT_HEADERS = ['content-type', 'content-disposition', 'content-length', 'x-calc-app-version', 'x-calc-db-version', 'x-warning-dados-simulados', 'x-request-id'];

interface EngineError {
  code?: string;
  title?: string;
  pointer?: string;
  detail?: string;
}
interface ItemObject {
  nObj?: number;
  estadoItem?: string;
  erros?: EngineError[];
}

const STATE_TONE: Record<string, string> = {
  CALCULADO: 'success',
  CALCULO_SIMULADO: 'info',
  INCONSISTENCIA_ENTRADA: 'warning',
  NAO_CALCULADO: 'warning',
  NAO_IMPLEMENTADO: 'secondary',
  FALHA_TECNICA: 'danger',
};

export interface ViewerOptions {
  request?: EngineRequest;
  expected?: Scenario['expected'];
  /** Fill the parent height and scroll inside (workbench panes). */
  fill?: boolean;
  /** Extra content shown at the top of the summary (e.g. a table with actions). */
  summaryExtra?: Node | null;
  /** Called with a payload path (itens.3.ncm) when the user asks to jump to the field. */
  onGoToField?: (path: string) => void;
}

/** Renders an engine response exactly as received: status bar, summary, body, headers, sent request. */
export function renderResponse(res: EngineResponse, opts: ViewerOptions = {}): HTMLElement {
  const root = h('div', { class: `rtc-resp${opts.fill ? ' rtc-resp--fill' : ''}`, 'data-testid': 'response' });
  const body = h('div', { class: 'rtc-resp-body' });
  const status = h('div', { class: 'rtc-resp-status' });
  root.append(status, body);

  const request = opts.request;
  const actions = h('span', { class: 'ms-auto' });
  if (!res.error && res.text !== undefined) actions.appendChild(copyButton('Copiar resposta', () => res.text ?? ''));
  if (request) actions.appendChild(copyButton('Copiar curl', () => buildCurl({ method: request.method, url: request.url, headers: request.headers, body: typeof request.body === 'string' ? request.body : undefined })));

  if (res.error) {
    status.append(badge(res.error.kind === 'cancelled' ? 'Cancelado' : 'Sem resposta', res.error.kind === 'cancelled' ? 'secondary' : 'danger'), badge(`${res.durationMs} ms`, 'light'), actions);
    body.appendChild(alertBox(res.error.kind === 'cancelled' ? 'info' : 'danger', h('strong', null, res.error.kind === 'timeout' ? 'Tempo esgotado. ' : res.error.kind === 'cancelled' ? '' : 'Falha de comunicação. '), res.error.message));
    return root;
  }

  const size = res.blob ? res.blob.size : new TextEncoder().encode(res.text ?? '').length;
  status.append(
    h('span', { class: `badge fs-6 text-bg-${statusClass(res.status)}`, 'data-testid': 'http-status' }, `HTTP ${res.status} ${res.statusText}`.trim()),
    badge(`${res.durationMs} ms`, 'light'),
    ...(res.contentType ? [badge(res.contentType, 'light')] : []),
    badge(formatBytes(size), 'light'),
    actions);

  if (looksUnavailable(res)) body.appendChild(alertBox('danger', 'O motor parece indisponível (resposta de gateway). Verifique o status no painel.'));

  const parsed = tryParseJson(res.text);
  const summary: Node[] = [];
  if (opts.expected) {
    const matches = res.status === opts.expected.status;
    summary.push(alertBox(matches ? 'success' : 'warning', h('strong', null, matches ? 'Confere com o esperado: ' : `Esperado HTTP ${opts.expected.status}, recebido ${res.status}: `), opts.expected.summary));
  }
  const problem = parsed as { title?: string; detail?: string; errors?: EngineError[] } | undefined;
  if (res.status >= 400 && problem?.title && !problem.errors) summary.push(alertBox('warning', h('strong', null, `${problem.title}. `), problem.detail ?? ''));
  const objetos = (parsed as { objetos?: ItemObject[] } | undefined)?.objetos;
  if (Array.isArray(objetos) && objetos.some((o) => o.estadoItem)) summary.push(itemSummary(objetos, opts.onGoToField));
  if (Array.isArray(problem?.errors) && problem.errors.length > 0) summary.push(errorList(problem.errors, opts.onGoToField));
  const warning = res.headers['x-warning-dados-simulados'];
  if (warning) summary.push(alertBox('info', h('strong', null, 'Aviso do motor (x-warning-dados-simulados): '), warning));
  if (opts.summaryExtra) summary.unshift(opts.summaryExtra);

  const headerRows = Object.entries(res.headers)
    .sort(([a], [b]) => Number(RELEVANT_HEADERS.includes(b)) - Number(RELEVANT_HEADERS.includes(a)) || a.localeCompare(b))
    .map(([k, v]) => h('tr', { class: RELEVANT_HEADERS.includes(k) ? 'table-active' : '' }, h('th', { class: 'font-monospace fw-normal' }, k), h('td', { class: 'font-monospace text-break' }, v)));

  const items = [
    ...(summary.length > 0 ? [{ id: 'summary', label: 'Resumo', render: () => h('div', null, ...summary) }] : []),
    { id: 'body', label: 'Corpo', render: () => (res.blob ? h('p', { class: 'text-secondary' }, `Resposta binária (${res.contentType || 'sem tipo'}), ${formatBytes(res.blob.size)}.`) : bodyView(res, Boolean(opts.fill))) },
    { id: 'headers', label: `Headers (${Object.keys(res.headers).length})`, render: () => h('table', { class: 'table table-sm' }, h('tbody', null, headerRows)) },
    ...(request ? [{ id: 'request', label: 'Requisição enviada', render: () => requestView(request) }] : []),
  ];
  body.appendChild(tabs(items, items[0].id, { fill: true, compact: true }).el);
  return root;
}

function bodyView(res: EngineResponse, fill: boolean): HTMLElement {
  const raw = res.text ?? '';
  const isJson = /json/i.test(res.contentType);
  const isXml = /xml/i.test(res.contentType);
  const editor = createEditor({ value: isJson ? prettyJson(raw) : raw, language: isJson ? 'json' : isXml ? 'xml' : 'text', readOnly: true, minHeight: '4rem', maxHeight: '32rem', fill });
  const wrap = h('div', { class: fill ? 'd-flex flex-column flex-fill' : '', style: fill ? 'min-height:0' : undefined });
  if (isJson) {
    let formatted = true;
    const toggle = h('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary mb-2 align-self-start', onClick: () => {
      formatted = !formatted;
      editor.setValue(formatted ? prettyJson(raw) : raw);
      toggle.textContent = formatted ? 'Ver original' : 'Ver formatado';
    } }, 'Ver original');
    wrap.appendChild(toggle);
  }
  wrap.appendChild(editor.el);
  return wrap;
}

function requestView(r: EngineRequest): HTMLElement {
  const body = typeof r.body === 'string' ? r.body : '';
  const isJson = /json/i.test(r.headers?.['Content-Type'] ?? '');
  const editor = body ? createEditor({ value: isJson ? prettyJson(body) : body, language: isJson ? 'json' : 'xml', readOnly: true, minHeight: '3rem', maxHeight: '22rem' }) : null;
  return h('div', null,
    h('p', { class: 'mb-2' }, h('code', null, `${r.method} ${r.url}`)),
    Object.keys(r.headers ?? {}).length ? h('table', { class: 'table table-sm' }, h('tbody', null, Object.entries(r.headers ?? {}).map(([k, v]) => h('tr', null, h('th', { class: 'font-monospace fw-normal' }, k), h('td', { class: 'font-monospace' }, v))))) : null,
    editor ? editor.el : h('p', { class: 'text-secondary small' }, 'Sem corpo.'));
}

function itemSummary(objetos: ItemObject[], go?: (path: string) => void): HTMLElement {
  return h('div', { class: 'table-responsive mb-2' },
    h('table', { class: 'table table-sm align-middle mb-0', 'data-testid': 'item-summary' },
      h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', null, 'Estado'), h('th', null, 'Erros'))),
      h('tbody', null, objetos.map((o) =>
        h('tr', null,
          h('td', null, String(o.nObj ?? '')),
          h('td', null, badge(o.estadoItem ?? '—', STATE_TONE[o.estadoItem ?? ''] ?? 'secondary')),
          h('td', null, (o.erros ?? []).map((e) => errorLine(e, go))))))));
}

function errorLine(e: EngineError, go?: (path: string) => void): HTMLElement {
  const path = pointerToPath(e.pointer);
  return h('div', { class: 'small' },
    h('code', null, e.code ?? ''), ' ', e.title ?? '', e.pointer ? ` (${e.pointer})` : '',
    go && path ? h('button', { type: 'button', class: 'btn btn-link btn-sm py-0', 'data-action': 'go-to-field', onClick: () => go(path) }, 'ir ao campo') : null);
}

function errorList(errors: EngineError[], go?: (path: string) => void): HTMLElement {
  return h('ul', { class: 'list-group mb-2', 'data-testid': 'error-list' }, errors.map((e) =>
    h('li', { class: 'list-group-item list-group-item-warning small' }, errorLine(e, go), e.detail ? h('div', null, e.detail) : null)));
}

function copyButton(label: string, text: () => string): HTMLButtonElement {
  const btn = h('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary' }, label);
  btn.addEventListener('click', async () => {
    const ok = await copyText(text());
    btn.textContent = ok ? 'Copiado' : 'Falhou';
    setTimeout(() => (btn.textContent = label), 1500);
  });
  return btn;
}
