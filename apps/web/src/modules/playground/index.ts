import { createEditor } from '../../components/editor';
import { responsePane } from '../../components/responsePane';
import { alertBox } from '../../components/ui';
import { workbench } from '../../components/workbench';
import { ENGINE_IDS, ENGINES } from '../../services/engines';
import { isAllowedPath } from '../../services/http';
import { runAndRecord } from '../../services/runner';
import { buildUrl, loadManifest, loadPayload } from '../../services/scenarios';
import type { EngineId, EngineRequest, Scenario } from '../../types';
import { buildCurl } from '../../utils/curl';
import { clear, h } from '../../utils/dom';
import { byteLength, formatBytes } from '../../utils/files';
import { copyText } from '../../utils/format';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** Parses "Name: value" lines. Returns the headers or an error message. */
export function parseHeaders(text: string): { headers: Record<string, string>; error?: string } {
  const headers: Record<string, string> = {};
  for (const [i, raw] of text.split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx <= 0) return { headers, error: `Linha ${i + 1} de headers inválida. Use "Nome: valor".` };
    headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { headers };
}

export function mountPlayground(root: HTMLElement): () => void {
  const wb = workbench({ prefKey: 'playground', leftTitle: 'Requisição', rightTitle: 'Resposta' });
  const preset = h('select', { class: 'form-select form-select-sm', 'aria-label': 'Carregar cenário', 'data-testid': 'preset' }, h('option', { value: '' }, 'Carregar cenário... (requisição em branco)'));
  const sendBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-action': 'send', title: 'Enviar (Ctrl/Cmd + Enter)' }, 'Enviar');
  const curlBtn = h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', 'data-action': 'copy-curl' }, 'Copiar curl');
  const jsonBtn = h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm' }, 'Copiar corpo');
  wb.leftBar.append(preset, sendBtn, curlBtn, jsonBtn);

  const method = h('select', { class: 'form-select form-select-sm', 'aria-label': 'Método', 'data-testid': 'method' }, h('option', null, 'POST'), h('option', null, 'GET'));
  const url = h('input', { class: 'form-control form-control-sm font-monospace', value: '/api/regular/calculadora/regime-geral', 'aria-label': 'Caminho', 'data-testid': 'url' });
  const contentType = h('select', { class: 'form-select form-select-sm', 'aria-label': 'Content-Type', 'data-testid': 'content-type' }, h('option', { value: 'application/json' }, 'application/json'), h('option', { value: 'application/xml' }, 'application/xml'), h('option', { value: '' }, '(sem corpo)'));
  const headersArea = h('textarea', { class: 'form-control form-control-sm font-monospace', rows: 3, placeholder: 'Accept: application/json', 'aria-label': 'Headers adicionais', 'data-testid': 'headers' });
  const editor = createEditor({ language: 'json', value: '{}', minHeight: '16rem', maxHeight: '36rem' });
  const messages = h('div', { class: 'mt-2' });

  wb.leftBody.append(
    h('section', { class: 'rtc-section' }, h('legend', null, 'Destino'),
      h('div', { class: 'rtc-grid' },
        h('div', { class: 'rtc-f s2' }, h('div', { class: 'rtc-f-label' }, 'Método'), method),
        h('div', { class: 'rtc-f s6' }, h('div', { class: 'rtc-f-label' }, 'Caminho (somente os motores)'), url),
        h('div', { class: 'rtc-f s4' }, h('div', { class: 'rtc-f-label' }, 'Content-Type'), contentType),
        h('div', { class: 'rtc-f s12', style: 'grid-column: 1 / -1' }, h('div', { class: 'rtc-f-label' }, 'Headers adicionais (um por linha)'), headersArea))),
    h('section', { class: 'rtc-section' }, h('legend', null, 'Corpo'), editor.el),
    messages);

  const pane = responsePane(wb.rightBody, { title: 'Nenhuma requisição enviada', hint: 'Monte a requisição e clique em Enviar. A resposta original do motor aparece aqui.' });

  const presets = new Map<string, { engine: EngineId; scenario: Scenario; basePath: string }>();
  void Promise.all(ENGINE_IDS.map((id) => loadManifest(id).then((m) => m.scenarios.forEach((s) => {
    const key = `${id}:${s.id}`;
    presets.set(key, { engine: id, scenario: s, basePath: m.basePath });
    preset.appendChild(h('option', { value: key }, `${ENGINES[id].short} · ${s.name}`));
  })))).catch(() => undefined);

  preset.addEventListener('change', async () => {
    const p = presets.get(preset.value);
    if (!p) {
      editor.setValue('');
      return;
    }
    method.value = p.scenario.method;
    url.value = buildUrl(p.basePath, p.scenario.endpoint, p.scenario.query);
    contentType.value = p.scenario.contentType;
    editor.setLanguage(p.scenario.contentType.includes('xml') ? 'xml' : 'json');
    editor.setValue(await loadPayload(p.engine, p.scenario));
  });
  contentType.addEventListener('change', () => editor.setLanguage(contentType.value.includes('xml') ? 'xml' : 'json'));

  function buildRequest(): { request?: EngineRequest; error?: string } {
    if (!isAllowedPath(url.value.trim())) return { error: 'Use um caminho em /api/regular, /api/simples ou /api/danfse (o playground só fala com os motores via Traefik).' };
    const parsed = parseHeaders(headersArea.value);
    if (parsed.error) return { error: parsed.error };
    const headers = { ...parsed.headers };
    if (contentType.value) headers['Content-Type'] = contentType.value;
    const body = method.value === 'GET' || !contentType.value ? undefined : editor.getValue();
    if (body !== undefined && byteLength(body) > MAX_BODY_BYTES) return { error: `Corpo acima do limite (${formatBytes(MAX_BODY_BYTES)}).` };
    return { request: { method: method.value, url: url.value.trim(), headers, body } };
  }

  let busy = false;
  async function send(): Promise<void> {
    if (busy) return;
    clear(messages);
    const { request, error } = buildRequest();
    if (error || !request) return void messages.append(alertBox('danger', error ?? 'Requisição inválida.'));
    const controller = new AbortController();
    busy = true;
    sendBtn.disabled = true;
    sendBtn.setAttribute('aria-busy', 'true');
    pane.loading(() => controller.abort());
    wb.showResponse();
    const response = await runAndRecord('playground', { ...request, signal: controller.signal }, { scenarioName: 'Playground' }).finally(() => {
      busy = false;
      sendBtn.disabled = false;
      sendBtn.removeAttribute('aria-busy');
    });
    pane.show(response, { request });
  }
  sendBtn.addEventListener('click', () => void send());
  wb.el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void send();
    }
  });

  const flash = (btn: HTMLButtonElement, label: string, ok: boolean) => {
    btn.textContent = ok ? 'Copiado' : 'Falhou';
    setTimeout(() => (btn.textContent = label), 1500);
  };
  curlBtn.addEventListener('click', async () => {
    const { request, error } = buildRequest();
    if (error || !request) return void messages.replaceChildren(alertBox('danger', error ?? 'Requisição inválida.'));
    flash(curlBtn, 'Copiar curl', await copyText(buildCurl({ method: request.method, url: request.url, headers: request.headers, body: typeof request.body === 'string' ? request.body : undefined })));
  });
  jsonBtn.addEventListener('click', async () => flash(jsonBtn, 'Copiar corpo', await copyText(editor.getValue())));

  clear(root);
  root.appendChild(h('div', { class: 'rtc-page' },
    h('div', { class: 'rtc-page-head' }, h('h1', null, 'Playground de APIs'), h('p', null, 'Monte requisições para os motores e veja a resposta original, o status, o tempo e os headers.')),
    wb.el));
  return () => editor.destroy();
}
