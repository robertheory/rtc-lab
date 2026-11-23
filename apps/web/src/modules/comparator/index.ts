import { createEditor } from '../../components/editor';
import { renderResponse } from '../../components/responseViewer';
import { alertBox, badge, spinner, tabs } from '../../components/ui';
import { ENGINES } from '../../services/engines';
import { runAndRecord } from '../../services/runner';
import { buildUrl, loadManifest, loadPayload } from '../../services/scenarios';
import type { EngineId, EngineRequest, EngineResponse, Manifest, Scenario } from '../../types';
import { clear, h } from '../../utils/dom';
import { diffJson, type DiffEntry } from '../../utils/diff';
import { validateJsonText } from '../../utils/files';
import { prettyJson, tryParseJson } from '../../utils/format';

type JsonEngine = Extract<EngineId, 'regular' | 'simples'>;

/** Groups diff paths by the part of the response they belong to. */
export function bucketOf(path: string): string {
  if (/^(objetos|oper|resolucaoAliquotas)\b/.test(path)) return path.startsWith('objetos') ? 'Valores e classificação por item' : 'Operação e alíquotas';
  if (path.startsWith('total')) return 'Totais';
  if (/erros|errors|avisos|detail|title|status/.test(path)) return 'Erros e advertências';
  return 'Outros campos';
}

export function mountComparator(root: HTMLElement): () => void {
  let manifest: Manifest | undefined;
  const engine = h('select', { class: 'form-select form-select-sm', 'data-testid': 'cmp-engine' },
    h('option', { value: 'regular' }, ENGINES.regular.label), h('option', { value: 'simples' }, ENGINES.simples.label));
  const scenarioSel = h('select', { class: 'form-select form-select-sm', 'data-testid': 'cmp-scenario' });
  const edA = createEditor({ language: 'json', minHeight: '16rem', maxHeight: '30rem' });
  const edB = createEditor({ language: 'json', minHeight: '16rem', maxHeight: '30rem' });
  const messages = h('div', { class: 'mt-3' });
  const result = h('div', { class: 'mt-3', 'data-testid': 'cmp-result' });
  const dupBtn = h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', 'data-action': 'duplicate' }, 'Duplicar A em B');
  const editorsBox = h('details', { open: true, 'data-testid': 'cmp-editors' }, h('summary', { class: 'mb-2' }, 'Operações A e B'),
    h('div', { class: 'row g-3' },
      h('div', { class: 'col-xl-6' }, h('div', { class: 'd-flex justify-content-between mb-1' }, h('strong', { class: 'small' }, 'Operação A (original)')), edA.el),
      h('div', { class: 'col-xl-6' }, h('div', { class: 'd-flex justify-content-between mb-1' }, h('strong', { class: 'small' }, 'Operação B (editável)'), dupBtn), edB.el)));
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary', 'data-action': 'compare' }, 'Executar ambas e comparar');

  const scenarios = (): Scenario[] => (manifest?.scenarios ?? []).filter((s) => s.contentType.includes('json') && s.method === 'POST');
  const current = () => scenarios().find((s) => s.id === scenarioSel.value);

  async function loadEngine(): Promise<void> {
    manifest = await loadManifest(engine.value as JsonEngine);
    clear(scenarioSel);
    for (const s of scenarios()) scenarioSel.appendChild(h('option', { value: s.id }, s.name));
    await loadScenario();
  }

  async function loadScenario(): Promise<void> {
    const s = current();
    if (!s) return;
    const text = prettyJson(await loadPayload(engine.value as JsonEngine, s));
    edA.setValue(text);
    edB.setValue(text);
  }

  engine.addEventListener('change', () => void loadEngine());
  scenarioSel.addEventListener('change', () => void loadScenario());
  dupBtn.addEventListener('click', () => edB.setValue(edA.getValue()));

  runBtn.addEventListener('click', async () => {
    clear(messages);
    clear(result);
    const s = current();
    if (!manifest || !s) return;
    const errA = validateJsonText(edA.getValue());
    const errB = validateJsonText(edB.getValue());
    if (errA || errB) {
      if (errA) messages.append(alertBox('danger', `Operação A: ${errA}`));
      if (errB) messages.append(alertBox('danger', `Operação B: ${errB}`));
      return;
    }
    runBtn.disabled = true;
    result.append(spinner('Executando as duas operações...'));
    const make = (body: string) => ({ method: s.method, url: buildUrl(manifest!.basePath, s.endpoint, s.query), headers: { 'Content-Type': s.contentType }, body });
    const reqA = make(edA.getValue());
    const reqB = make(edB.getValue());
    const eng = engine.value as JsonEngine;
    const [resA, resB] = await Promise.all([
      runAndRecord(eng, reqA, { scenarioId: s.id, scenarioName: `${s.name} (A)` }),
      runAndRecord(eng, reqB, { scenarioId: s.id, scenarioName: `${s.name} (B)` }),
    ]).finally(() => (runBtn.disabled = false));
    clear(result);
    result.append(renderComparison(resA, resB, reqA, reqB));
    editorsBox.open = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  clear(root);
  root.append(
    h('div', { class: 'mb-3' }, h('h1', { class: 'h3' }, 'Comparador de cenários'),
      h('p', { class: 'text-secondary mb-0' }, 'Escolha um cenário, ajuste a cópia (B) e execute as duas operações. As diferenças vêm das respostas reais dos motores: nenhum valor é calculado aqui.')),
    h('div', { class: 'row g-2 mb-3' },
      h('div', { class: 'col-md-3' }, h('label', { class: 'form-label small mb-1' }, 'Motor'), engine),
      h('div', { class: 'col-md-5' }, h('label', { class: 'form-label small mb-1' }, 'Cenário base'), scenarioSel)),
    editorsBox,
    h('div', { class: 'mt-3' }, runBtn), messages, result);

  void loadEngine().catch((e: unknown) => messages.append(alertBox('danger', e instanceof Error ? e.message : 'Catálogo indisponível.')));
  return () => {
    edA.destroy();
    edB.destroy();
  };
}

function renderComparison(a: EngineResponse, b: EngineResponse, reqA: EngineRequest, reqB: EngineRequest): HTMLElement {
  const host = h('div');
  const statusLine = h('div', { class: 'd-flex gap-3 mb-3 flex-wrap' },
    h('div', null, 'A: ', badge(a.received ? `HTTP ${a.status}` : 'sem resposta', a.status === 200 ? 'success' : 'warning'), ` ${a.durationMs} ms`),
    h('div', null, 'B: ', badge(b.received ? `HTTP ${b.status}` : 'sem resposta', b.status === 200 ? 'success' : 'warning'), ` ${b.durationMs} ms`));
  host.append(statusLine);

  const ja = tryParseJson(a.text);
  const jb = tryParseJson(b.text);
  const diffBox = h('div', { 'data-testid': 'diff' });
  if (ja === undefined || jb === undefined) {
    diffBox.append(alertBox('warning', 'Uma das respostas não é JSON: compare os textos originais na aba ao lado.'));
  } else {
    const entries = diffJson(ja, jb);
    diffBox.append(renderDiff(entries));
  }

  host.append(tabs([
    { id: 'diff', label: 'Diferenças', render: () => diffBox },
    { id: 'a', label: 'JSON original A', render: () => renderResponse(a, { request: reqA }) },
    { id: 'b', label: 'JSON original B', render: () => renderResponse(b, { request: reqB }) },
  ]).el);
  return host;
}

function renderDiff(entries: DiffEntry[]): HTMLElement {
  if (entries.length === 0) return alertBox('success', 'As duas respostas são idênticas.');
  const groups = new Map<string, DiffEntry[]>();
  for (const e of entries) {
    const key = bucketOf(e.path);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const show = (v: unknown) => (v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return h('div', null,
    h('p', { class: 'small text-secondary' }, `${entries.length} diferença(s) entre as respostas.`),
    [...groups.entries()].map(([title, rows]) => h('div', { class: 'mb-3' },
      h('h3', { class: 'h6' }, `${title} (${rows.length})`),
      h('div', { class: 'table-responsive rtc-table-scroll' },
        h('table', { class: 'table table-sm small' },
          h('thead', null, h('tr', null, h('th', null, 'Caminho'), h('th', null, 'A'), h('th', null, 'B'), h('th', null, ''))),
          h('tbody', null, rows.map((r) => h('tr', { 'data-diff-kind': r.kind },
            h('td', { class: 'font-monospace text-break' }, r.path),
            h('td', { class: 'font-monospace text-break' }, show(r.a)),
            h('td', { class: 'font-monospace text-break' }, show(r.b)),
            h('td', null, badge(r.kind === 'changed' ? 'diferente' : r.kind === 'added' ? 'só em B' : 'só em A', r.kind === 'changed' ? 'warning' : 'info'))))))))));
}
