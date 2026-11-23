import type { EngineId, EngineResponse, Manifest, Scenario } from '../types';
import { send } from '../services/http';
import { runAndRecord } from '../services/runner';
import { loadPayload } from '../services/scenarios';
import { clear, h } from '../utils/dom';
import { JSON_MAX_BYTES, validateJsonText, validateXmlFile, validateXmlText } from '../utils/files';
import { tryParseJson } from '../utils/format';
import { chipGroup, joinChips, type ChipOption } from './chips';
import { createEditor, type Editor } from './editor';
import { responsePane } from './responsePane';
import { alertBox } from './ui';
import { workbench } from './workbench';

export const DEFAULT_QUERY_DATE = '2027-03-15';

export interface ToolParam {
  name: string;
  label: string;
  in: 'path' | 'query';
  required?: boolean;
  default?: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'select' | 'chips';
  options?: ChipOption[];
  /** Engine-relative GET returning [{nome, mnemonico}] used to fill a select. */
  optionsFrom?: string;
  extraOptions?: ChipOption[];
}

export interface Tool {
  id: string;
  label: string;
  group: 'Consultas' | 'Ferramentas';
  method: 'GET' | 'POST';
  path: string;
  params: ToolParam[];
  help?: string;
  body?: { contentType: 'application/json' | 'application/xml'; scenarioIds: string[]; upload?: boolean; maxBytes?: number };
  /** Extra summary content for the response (e.g. a table with actions). */
  extra?: (res: EngineResponse) => Node | null;
}

/** Lookups (GET) and body tools (POST) of an engine, with the same left/right layout as the operation tab. */
export function consultasTab(opts: { engine: EngineId; basePath: string; manifest: Manifest; tools: Tool[] }): HTMLElement {
  const wb = workbench({ prefKey: `${opts.engine}-consultas`, leftTitle: 'Consulta', rightTitle: 'Resposta' });
  let tool = opts.tools[0];
  let values: Record<string, string> = {};
  let editor: Editor | null = null;
  let busy = false;

  const toolSel = h('select', { class: 'form-select form-select-sm', 'aria-label': 'Consulta ou ferramenta', 'data-testid': 'tool-select' });
  for (const group of ['Consultas', 'Ferramentas'] as const) {
    const list = opts.tools.filter((t) => t.group === group);
    if (list.length > 0) toolSel.appendChild(h('optgroup', { label: group }, list.map((t) => h('option', { value: t.id }, t.label))));
  }
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-action': 'run-tool', title: 'Executar (Ctrl/Cmd + Enter)' }, 'Executar');
  const clearBtn = h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', 'data-action': 'clear-tool' }, 'Limpar');
  wb.leftBar.append(toolSel, runBtn, clearBtn);

  const help = h('p', { class: 'rtc-section-note' });
  const paramsHost = h('div', { class: 'rtc-form' });
  const bodyHost = h('div', { class: 'mt-2' });
  const messages = h('div', { class: 'mt-2' });
  wb.leftBody.append(help, paramsHost, bodyHost, messages);
  const pane = responsePane(wb.rightBody, { title: 'Nenhuma consulta executada', hint: 'Escolha a consulta, preencha os parâmetros e clique em Executar.' });

  const optionsCache = new Map<string, Promise<ChipOption[]>>();
  const loadOptions = (path: string): Promise<ChipOption[]> => {
    let p = optionsCache.get(path);
    if (!p) {
      p = send({ method: 'GET', url: `${opts.basePath}${path}`, timeoutMs: 8000 }).then((r) => {
        const list = tryParseJson(r.text);
        return Array.isArray(list) ? (list as { nome: string; mnemonico: string }[]).map((t) => ({ value: t.mnemonico, label: `${t.nome} (${t.mnemonico})` })) : [];
      });
      optionsCache.set(path, p);
    }
    return p;
  };

  function paramCell(p: ToolParam): HTMLElement {
    const id = `p-${tool.id}-${p.name}`;
    const label = h('div', { class: 'rtc-f-label' }, h('label', { for: id }, `${p.label}${p.required ? ' *' : ''}`));
    let control: HTMLElement;
    if (p.type === 'chips') {
      control = chipGroup({ options: p.options ?? [], label: p.label, onChange: (v) => (values[p.name] = joinChips(v) ?? '') });
    } else if (p.type === 'select') {
      const sel = h('select', { id, class: 'form-select form-select-sm', 'data-param': p.name, onChange: () => (values[p.name] = sel.value) },
        h('option', { value: '' }, 'Selecione...'), ...(p.options ?? []).map((o) => h('option', { value: o.value }, o.label)));
      const apply = (list: ChipOption[]) => {
        for (const o of [...list, ...(p.extraOptions ?? [])]) if (![...sel.options].some((x) => x.value === o.value)) sel.appendChild(h('option', { value: o.value }, o.label));
        if (p.default && [...sel.options].some((x) => x.value === p.default)) sel.value = p.default;
        values[p.name] = sel.value;
      };
      apply([]);
      if (p.optionsFrom) void loadOptions(p.optionsFrom).then(apply);
      control = sel;
    } else {
      const input = h('input', { id, class: 'form-control form-control-sm', type: p.type === 'date' ? 'date' : 'text', value: p.default ?? '', placeholder: p.placeholder ?? '', 'data-param': p.name, onInput: () => (values[p.name] = input.value.trim()) });
      control = input;
    }
    return h('div', { class: 'rtc-f s4' }, label, control);
  }

  function renderTool(): void {
    values = {};
    for (const p of tool.params) if (p.type !== 'select') values[p.name] = p.default ?? '';
    help.textContent = tool.help ?? '';
    clear(paramsHost);
    clear(bodyHost);
    clear(messages);
    editor?.destroy();
    editor = null;
    if (tool.params.length > 0) paramsHost.appendChild(h('div', { class: 'rtc-grid' }, tool.params.map(paramCell)));
    if (tool.body) renderBody(tool.body);
    pane.empty();
  }

  function renderBody(body: NonNullable<Tool['body']>): void {
    const isXml = body.contentType === 'application/xml';
    const maxBytes = body.maxBytes ?? JSON_MAX_BYTES;
    const examples = opts.manifest.scenarios.filter((s) => body.scenarioIds.includes(s.id));
    const sel = h('select', { class: 'form-select form-select-sm mb-2', 'aria-label': 'Carregar exemplo', 'data-testid': 'example-select' },
      h('option', { value: '' }, 'Carregar exemplo... (corpo em branco)'), ...examples.map((s) => h('option', { value: s.id }, s.name)));
    const ed = createEditor({ language: isXml ? 'xml' : 'json', minHeight: '16rem', maxHeight: '32rem' });
    editor = ed;
    sel.addEventListener('change', async () => {
      const s: Scenario | undefined = examples.find((x) => x.id === sel.value);
      ed.setValue(s ? await loadPayload(opts.engine, s) : '');
    });
    bodyHost.append(h('div', { class: 'rtc-f-label' }, h('strong', null, isXml ? 'Corpo (XML)' : 'Corpo (JSON)')), sel);
    if (body.upload) {
      const err = h('div', { class: 'small text-danger mt-1' });
      const file = h('input', { type: 'file', accept: '.xml,application/xml,text/xml', class: 'form-control form-control-sm mb-2', 'data-testid': 'xml-file', 'aria-label': 'Carregar arquivo .xml', onChange: async () => {
        err.textContent = '';
        const f = file.files?.[0];
        if (!f) return;
        const problem = validateXmlFile(f, maxBytes);
        if (problem) {
          err.textContent = problem;
          file.value = '';
          return;
        }
        ed.setValue(await f.text());
      } });
      bodyHost.append(file, err);
    }
    bodyHost.append(ed.el);
  }

  async function execute(): Promise<void> {
    if (busy) return;
    clear(messages);
    const missing = tool.params.filter((p) => p.required && !values[p.name]);
    if (missing.length > 0) return void messages.append(alertBox('warning', `Preencha: ${missing.map((p) => p.label).join(', ')}.`));
    let body: string | undefined;
    if (tool.body && editor) {
      body = editor.getValue();
      const error = tool.body.contentType === 'application/xml' ? validateXmlText(body, tool.body.maxBytes ?? JSON_MAX_BYTES) : validateJsonText(body, tool.body.maxBytes ?? JSON_MAX_BYTES);
      if (error) return void messages.append(alertBox('danger', error));
    }
    let path = tool.path;
    const query = new URLSearchParams();
    for (const p of tool.params) {
      const v = values[p.name];
      if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(v));
      else if (v) query.set(p.name, v);
    }
    const controller = new AbortController();
    const request = {
      method: tool.method,
      url: `${opts.basePath}${path}${query.size ? `?${query}` : ''}`,
      headers: tool.body ? { 'Content-Type': tool.body.contentType } : undefined,
      body,
      signal: controller.signal,
    };
    busy = true;
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    pane.loading(() => controller.abort());
    wb.showResponse();
    const response = await runAndRecord(opts.engine, request, { scenarioName: tool.label }).finally(() => {
      busy = false;
      runBtn.disabled = false;
      runBtn.removeAttribute('aria-busy');
    });
    const extra = tool.extra?.(response) ?? rowsTable(tryParseJson(response.text));
    pane.show(response, { request, summaryExtra: extra });
  }

  toolSel.addEventListener('change', () => {
    tool = opts.tools.find((t) => t.id === toolSel.value) ?? opts.tools[0];
    renderTool();
  });
  clearBtn.addEventListener('click', renderTool);
  runBtn.addEventListener('click', () => void execute());
  wb.el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void execute();
    }
  });
  toolSel.value = tool.id;
  renderTool();
  return wb.el;
}

const MAX_ROWS = 100;
const MAX_COLS = 7;

/** Table view for array results; null when the response is not a list of objects. */
export function rowsTable(value: unknown): HTMLElement | null {
  if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== 'object' || value[0] === null) return null;
  const rows = value as Record<string, unknown>[];
  const cols: string[] = [];
  for (const row of rows.slice(0, 20)) {
    for (const [k, v] of Object.entries(row)) {
      if ((typeof v !== 'object' || v === null) && !cols.includes(k) && cols.length < MAX_COLS) cols.push(k);
    }
  }
  return h('div', { class: 'mb-3' },
    h('p', { class: 'small text-secondary mb-1' }, `${rows.length} registro(s)${rows.length > MAX_ROWS ? `, exibindo ${MAX_ROWS}` : ''}. A resposta completa está na aba Corpo.`),
    h('div', { class: 'table-responsive rtc-table-scroll' },
      h('table', { class: 'table table-sm table-striped small', 'data-testid': 'query-rows' },
        h('thead', null, h('tr', null, cols.map((c) => h('th', null, c)))),
        h('tbody', null, rows.slice(0, MAX_ROWS).map((r) => h('tr', null, cols.map((c) => h('td', null, r[c] === null || r[c] === undefined ? '' : String(r[c])))))))));
}
