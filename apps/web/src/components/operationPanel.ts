import type { EngineId, Manifest, Scenario } from '../types';
import { runAndRecord } from '../services/runner';
import { buildUrl, loadPayload } from '../services/scenarios';
import { getPref, setPref } from '../services/uiPrefs';
import { clear, h } from '../utils/dom';
import { validateJsonText } from '../utils/files';
import { tryParseJson } from '../utils/format';
import { fieldErrorsFrom } from '../utils/pointer';
import { createEditor, type Editor } from './editor';
import type { FormCtx } from './fieldForm';
import { responsePane } from './responsePane';
import { scenarioCard, scenarioSelect, type ScenarioCard } from './scenarioSelect';
import { alertBox } from './ui';
import { workbench } from './workbench';

type Json = Record<string, unknown>;

export interface OperationOptions {
  engine: EngineId;
  manifest: Manifest;
  /** Calculation endpoints (all have a form) with a friendly label. */
  endpoints: { endpoint: string; label: string }[];
  blank: () => Json;
  buildForm: (host: HTMLElement, ctx: FormCtx) => void;
}

export interface OperationHandle {
  el: HTMLElement;
  loadScenario(id: string, run?: boolean): Promise<void>;
  /** Applies a change to the payload and refreshes form and editor. */
  patchState(change: (state: Json) => void): void;
}

/**
 * The "Operação" workbench: form (and, in advanced mode, the raw JSON body) on the left,
 * the engine's response always visible on the right.
 */
export function operationPanel(opts: OperationOptions): OperationHandle {
  const wb = workbench({ prefKey: opts.engine, leftTitle: 'Requisição', rightTitle: 'Resposta' });
  const endpointSet = new Set(opts.endpoints.map((e) => e.endpoint));
  const scenarios = opts.manifest.scenarios.filter((s) => endpointSet.has(s.endpoint));

  let state: Json = opts.blank();
  let endpoint = opts.endpoints[0].endpoint;
  let loaded: { scenario: Scenario; baseline: string } | null = null;
  let advanced = getPref<boolean>(`advanced:${opts.engine}`, false);
  let view: 'form' | 'editor' = 'form';
  let editor: Editor | null = null;
  let syncing = false;
  let busy = false;
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  const errors = new Map<string, string>();

  const ctx: FormCtx = {
    get state() {
      return state;
    },
    get advanced() {
      return advanced;
    },
    errors,
    changed() {
      syncEditor();
      updateDirty();
    },
    rerender: () => renderForm(),
  };

  // ---------- left pane: action bar ----------
  const select = scenarioSelect(scenarios, (id) => (id === '' ? clearAll(true) : void loadScenario(id)));
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-action': 'run-operation', title: 'Executar (Ctrl/Cmd + Enter)' }, 'Executar');
  const clearBtn = h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', 'data-action': 'clear-form', onClick: () => clearAll(true) }, 'Limpar');
  const advBox = h('input', { type: 'checkbox', class: 'form-check-input', role: 'switch', id: `adv-${opts.engine}`, checked: advanced, 'data-testid': 'advanced-toggle' });
  const advLabel = h('label', { class: 'form-check-label small', for: advBox.id }, 'Modo avançado');
  const undoHost = h('div', { class: 'w-100', 'aria-live': 'polite' });
  wb.leftBar.append(select.el, runBtn, clearBtn, h('div', { class: 'form-check form-switch mb-0 ms-auto' }, advBox, advLabel), undoHost);

  // ---------- left pane: body ----------
  const cardHost = h('div');
  const endpointSel = h('select', { class: 'form-select form-select-sm', 'data-testid': 'endpoint-select', 'aria-label': 'Operação do motor' },
    opts.endpoints.map((e) => h('option', { value: e.endpoint }, e.label)));
  const urlHint = h('code', { class: 'small text-secondary' });
  const endpointRow = h('div', { class: 'mb-3' }, h('label', { class: 'form-label small fw-bold mb-1' }, 'Operação do motor'), endpointSel, h('div', { class: 'mt-1' }, urlHint));
  const viewSwitch = h('div', { class: 'rtc-seg mb-3', role: 'group', 'aria-label': 'Visão da requisição' });
  const formBtn = h('button', { type: 'button', 'aria-pressed': 'true', 'data-view': 'form', onClick: () => setView('form') }, 'Formulário');
  const bodyBtn = h('button', { type: 'button', 'aria-pressed': 'false', 'data-view': 'editor', onClick: () => setView('editor') }, 'Corpo (JSON)');
  viewSwitch.append(formBtn, bodyBtn);
  const formHost = h('div', { class: 'rtc-form', 'data-testid': 'operation-form' });
  const editorHost = h('div', { 'data-testid': 'operation-editor', hidden: true });
  const editorStatus = h('div', { class: 'small mt-1' });
  wb.leftBody.append(cardHost, endpointRow, viewSwitch, formHost, editorHost);

  const pane = responsePane(wb.rightBody, {
    title: 'Nenhuma execução ainda',
    hint: 'Carregue um cenário ou preencha o formulário e clique em Executar. A resposta do motor aparece aqui.',
    action: { label: 'Escolher um cenário', onClick: () => select.el.focus() },
  });

  // ---------- behaviour ----------
  let card: ScenarioCard | null = null;

  function currentSignature(): string {
    return JSON.stringify(state) + endpoint;
  }
  function updateDirty(): void {
    card?.setDirty(Boolean(loaded) && currentSignature() !== loaded?.baseline);
  }
  function isDirty(): boolean {
    return Boolean(loaded) && currentSignature() !== loaded?.baseline;
  }

  function renderForm(): void {
    clear(formHost);
    opts.buildForm(formHost, ctx);
  }

  function renderCard(): void {
    clear(cardHost);
    card = null;
    if (!loaded) return;
    card = scenarioCard(loaded.scenario, () => void loadScenario(loaded!.scenario.id));
    cardHost.appendChild(card.el);
    updateDirty();
  }

  function syncEditor(): void {
    if (!editor) return;
    syncing = true;
    editor.setValue(JSON.stringify(state, null, 2));
    syncing = false;
    validateEditor();
  }

  function validateEditor(): string | null {
    if (!editor) return null;
    const error = validateJsonText(editor.getValue());
    editorStatus.className = `small mt-1 ${error ? 'text-danger' : 'text-success'}`;
    editorStatus.textContent = error ?? 'JSON válido.';
    return error;
  }

  function ensureEditor(): void {
    if (editor) return;
    editor = createEditor({
      value: JSON.stringify(state, null, 2),
      language: 'json',
      minHeight: '22rem',
      maxHeight: '40rem',
      onChange: (text) => {
        if (syncing) return;
        if (validateEditor()) return;
        const parsed = tryParseJson(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          state = parsed as Json;
          errors.clear();
          renderForm();
          updateDirty();
        }
      },
    });
    editorHost.append(editor.el, editorStatus);
    validateEditor();
  }

  function applyMode(): void {
    advBox.checked = advanced;
    viewSwitch.hidden = !advanced;
    endpointRow.hidden = !(advanced || opts.endpoints.length > 1);
    urlHint.textContent = advanced ? `POST ${opts.manifest.basePath}${endpoint}` : '';
    if (!advanced) view = 'form';
    formHost.hidden = view !== 'form';
    editorHost.hidden = view !== 'editor';
    formBtn.setAttribute('aria-pressed', String(view === 'form'));
    bodyBtn.setAttribute('aria-pressed', String(view === 'editor'));
    if (view === 'editor') {
      ensureEditor();
      syncEditor();
    }
  }

  function setView(v: 'form' | 'editor'): void {
    view = v;
    applyMode();
  }

  advBox.addEventListener('change', () => {
    advanced = advBox.checked;
    setPref(`advanced:${opts.engine}`, advanced);
    renderForm();
    applyMode();
  });
  endpointSel.addEventListener('change', () => {
    endpoint = endpointSel.value;
    urlHint.textContent = advanced ? `POST ${opts.manifest.basePath}${endpoint}` : '';
    updateDirty();
  });

  function renderAll(): void {
    endpointSel.value = endpoint;
    renderForm();
    renderCard();
    applyMode();
  }

  function showUndo(snapshot: { state: Json; endpoint: string; loaded: typeof loaded }): void {
    clearTimeout(undoTimer);
    clear(undoHost);
    const toast = h('div', { class: 'rtc-toast', 'data-testid': 'undo-toast' }, 'Formulário limpo.',
      h('button', { type: 'button', 'data-action': 'undo-clear', onClick: () => {
        clearTimeout(undoTimer);
        clear(undoHost);
        state = snapshot.state;
        endpoint = snapshot.endpoint;
        loaded = snapshot.loaded;
        select.setValue(loaded?.scenario.id ?? '');
        errors.clear();
        renderAll();
      } }, 'Desfazer'));
    undoHost.appendChild(toast);
    undoTimer = setTimeout(() => clear(undoHost), 8000);
  }

  function clearAll(withUndo: boolean): void {
    const snapshot = { state: structuredClone(state), endpoint, loaded };
    state = opts.blank();
    endpoint = opts.endpoints[0].endpoint;
    loaded = null;
    errors.clear();
    select.setValue('');
    pane.empty();
    renderAll();
    if (withUndo) showUndo(snapshot);
  }

  async function loadScenario(id: string, run = false): Promise<void> {
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    clearTimeout(undoTimer);
    clear(undoHost);
    try {
      const text = await loadPayload(opts.engine, s);
      state = JSON.parse(text) as Json;
    } catch (e) {
      pane.showNode(alertBox('danger', e instanceof Error ? e.message : 'Falha ao carregar o cenário.'));
      return;
    }
    endpoint = s.endpoint;
    loaded = { scenario: s, baseline: JSON.stringify(state) + endpoint };
    errors.clear();
    select.setValue(s.id);
    pane.empty();
    renderAll();
    if (run) await execute();
  }

  function goToField(path: string): void {
    wb.showRequest();
    if (advanced && view !== 'form') setView('form');
    const el = formHost.querySelector<HTMLElement>(`[data-abs="${CSS.escape(path)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el?.matches('input,select') ? el : el?.querySelector('input'))?.focus();
  }

  async function execute(): Promise<void> {
    if (busy) return;
    if (editor && view === 'editor' && validateEditor()) return;
    const body = JSON.stringify(state);
    const invalid = validateJsonText(body);
    if (invalid) {
      pane.showNode(alertBox('danger', invalid));
      wb.showResponse();
      return;
    }
    const controller = new AbortController();
    busy = true;
    runBtn.disabled = true;
    runBtn.setAttribute('aria-busy', 'true');
    runBtn.textContent = 'Executando...';
    pane.loading(() => controller.abort());
    wb.showResponse();
    const request = { method: 'POST', url: buildUrl(opts.manifest.basePath, endpoint), headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal };
    const meta = { scenarioId: loaded?.scenario.id, scenarioName: loaded?.scenario.name ?? 'Formulário' };
    const response = await runAndRecord(opts.engine, request, meta).finally(() => {
      busy = false;
      runBtn.disabled = false;
      runBtn.removeAttribute('aria-busy');
      runBtn.textContent = 'Executar';
    });
    errors.clear();
    for (const e of fieldErrorsFrom(tryParseJson(response.text))) if (!errors.has(e.path)) errors.set(e.path, e.message);
    if (errors.size > 0) renderForm();
    pane.show(response, { request, expected: loaded && !isDirty() ? loaded.scenario.expected : undefined, onGoToField: goToField });
  }

  runBtn.addEventListener('click', () => void execute());
  wb.el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void execute();
    }
  });

  renderAll();

  return {
    el: wb.el,
    loadScenario,
    patchState(change) {
      change(state);
      errors.clear();
      renderForm();
      syncEditor();
      updateDirty();
    },
  };
}

