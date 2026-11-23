import { createEditor } from '../../components/editor';
import { responsePane } from '../../components/responsePane';
import { scenarioCard, scenarioSelect, type ScenarioCard } from '../../components/scenarioSelect';
import { alertBox, spinner } from '../../components/ui';
import { workbench } from '../../components/workbench';
import { ENGINES } from '../../services/engines';
import { runAndRecord } from '../../services/runner';
import { loadManifest, loadPayload } from '../../services/scenarios';
import type { EngineResponse, Manifest, Scenario } from '../../types';
import { clear, h } from '../../utils/dom';
import { checkWellFormedXml, DANFSE_MAX_BYTES, formatBytes, validateXmlFile, validateXmlText } from '../../utils/files';

const ENDPOINT = '/api/danfse';

export function mountDanfse(root: HTMLElement, query: URLSearchParams): () => void {
  const engine = ENGINES.danfse;
  let objectUrl: string | null = null;
  let disposeEditor: (() => void) | undefined;

  const body = h('div', { class: 'd-flex flex-column flex-fill', style: 'min-height:0' }, spinner('Carregando cenários...'));
  clear(root);
  root.appendChild(h('div', { class: 'rtc-page' }, h('div', { class: 'rtc-page-head' }, h('h1', null, engine.label), h('p', null, engine.description)), body));

  /** Frees the previous PDF Object URL so memory is not retained across generations. */
  const releaseUrl = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };

  loadManifest('danfse')
    .then((manifest) => {
      clear(body);
      disposeEditor = build(manifest);
    })
    .catch((e: unknown) => {
      clear(body);
      body.appendChild(alertBox('danger', e instanceof Error ? e.message : 'Catálogo indisponível.'));
    });

  function build(manifest: Manifest): () => void {
    const wb = workbench({ prefKey: 'danfse', leftTitle: 'Requisição', rightTitle: 'DANFSe' });
    body.appendChild(wb.el);

    let loaded: { scenario: Scenario; baseline: string } | null = null;
    let card: ScenarioCard | null = null;
    let busy = false;
    let undoTimer: ReturnType<typeof setTimeout> | undefined;

    const select = scenarioSelect(manifest.scenarios, (id) => (id === '' ? clearAll() : void loadScenario(id)));
    const generateBtn = h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-action': 'generate-pdf', title: 'Gerar PDF (Ctrl/Cmd + Enter)' }, 'Gerar PDF');
    const clearBtn = h('button', { type: 'button', class: 'btn btn-outline-secondary btn-sm', 'data-action': 'clear-form', onClick: () => clearAll() }, 'Limpar');
    const undoHost = h('div', { class: 'w-100', 'aria-live': 'polite' });
    wb.leftBar.append(select.el, generateBtn, clearBtn, undoHost);

    const cardHost = h('div');
    const fileInput = h('input', { type: 'file', accept: '.xml,application/xml,text/xml', class: 'form-control form-control-sm', id: 'danfse-file', 'data-testid': 'xml-file' });
    const fileError = h('div', { class: 'small text-danger mt-1', role: 'alert', 'data-testid': 'file-error' });
    const situacao = h('select', { class: 'form-select form-select-sm', id: 'danfse-stc', 'data-testid': 'stc', onChange: () => updateDirty() },
      h('option', { value: '0' }, 'Normal'), h('option', { value: '1' }, 'Substituída'), h('option', { value: '2' }, 'Cancelada'));
    const canhoto = h('input', { type: 'checkbox', class: 'form-check-input', role: 'switch', id: 'canhoto', checked: true, 'data-testid': 'canhoto', onChange: () => updateDirty() });
    const messages = h('div', { class: 'mt-2' });
    const editor = createEditor({ language: 'xml', minHeight: '18rem', maxHeight: '34rem', value: '', onChange: () => updateDirty() });

    wb.leftBody.append(
      cardHost,
      h('section', { class: 'rtc-section' },
        h('legend', null, 'Documento'),
        h('p', { class: 'rtc-section-note' }, `Envie um arquivo .xml (até ${formatBytes(DANFSE_MAX_BYTES)}) ou cole o conteúdo. O XML não é armazenado.`),
        h('div', { class: 'rtc-grid' },
          h('div', { class: 'rtc-f s6' }, h('div', { class: 'rtc-f-label' }, h('label', { for: 'danfse-file' }, 'Arquivo XML')), fileInput, fileError),
          h('div', { class: 'rtc-f s3' }, h('div', { class: 'rtc-f-label' }, h('label', { for: 'danfse-stc' }, 'Situação da nota (stc)')), situacao),
          h('div', { class: 'rtc-f s3' }, h('div', { class: 'rtc-f-label' }, h('label', { for: 'canhoto' }, 'Canhoto')), h('div', { class: 'rtc-switchbox' }, canhoto, h('span', null, 'Exibir')))),
        h('div', { class: 'rtc-f-label' }, h('strong', null, 'Conteúdo XML')),
        editor.el, messages));

    const pane = responsePane(wb.rightBody, {
      title: 'Nenhum PDF gerado ainda',
      hint: 'Carregue um cenário ou envie um XML de NFS-e e clique em Gerar PDF. O DANFSe aparece aqui.',
      action: { label: 'Escolher um cenário', onClick: () => select.el.focus() },
    });

    const signature = () => `${editor.getValue()}|${situacao.value}|${canhoto.checked}`;
    function updateDirty(): void {
      card?.setDirty(Boolean(loaded) && signature() !== loaded?.baseline);
    }
    const isDirty = () => Boolean(loaded) && signature() !== loaded?.baseline;

    function renderCard(): void {
      clear(cardHost);
      card = null;
      if (!loaded) return;
      card = scenarioCard(loaded.scenario, () => void loadScenario(loaded!.scenario.id));
      cardHost.appendChild(card.el);
      updateDirty();
    }

    fileInput.addEventListener('change', async () => {
      fileError.textContent = '';
      const file = fileInput.files?.[0];
      if (!file) return;
      const error = validateXmlFile(file, DANFSE_MAX_BYTES);
      if (error) {
        fileError.textContent = error;
        fileInput.value = '';
        return;
      }
      editor.setValue(await file.text());
    });

    function showUndo(snapshot: { xml: string; stc: string; canhoto: boolean; loaded: typeof loaded }): void {
      clearTimeout(undoTimer);
      clear(undoHost);
      undoHost.appendChild(h('div', { class: 'rtc-toast', 'data-testid': 'undo-toast' }, 'Formulário limpo.',
        h('button', { type: 'button', 'data-action': 'undo-clear', onClick: () => {
          clearTimeout(undoTimer);
          clear(undoHost);
          editor.setValue(snapshot.xml);
          situacao.value = snapshot.stc;
          canhoto.checked = snapshot.canhoto;
          loaded = snapshot.loaded;
          select.setValue(loaded?.scenario.id ?? '');
          renderCard();
        } }, 'Desfazer')));
      undoTimer = setTimeout(() => clear(undoHost), 8000);
    }

    function clearAll(): void {
      const snapshot = { xml: editor.getValue(), stc: situacao.value, canhoto: canhoto.checked, loaded };
      releaseUrl();
      editor.setValue('');
      situacao.value = '0';
      canhoto.checked = true;
      fileInput.value = '';
      fileError.textContent = '';
      clear(messages);
      loaded = null;
      select.setValue('');
      renderCard();
      pane.empty();
      showUndo(snapshot);
    }

    async function loadScenario(id: string, run = false): Promise<void> {
      const s = manifest.scenarios.find((x) => x.id === id);
      if (!s) return;
      clearTimeout(undoTimer);
      clear(undoHost);
      editor.setValue(await loadPayload('danfse', s));
      situacao.value = s.query?.stc ?? '0';
      canhoto.checked = (s.query?.canhoto ?? 'true') !== 'false';
      fileInput.value = '';
      clear(messages);
      loaded = { scenario: s, baseline: signature() };
      select.setValue(s.id);
      releaseUrl();
      pane.empty();
      renderCard();
      if (run) await generate();
    }

    async function generate(): Promise<void> {
      if (busy) return;
      clear(messages);
      const xml = editor.getValue();
      const error = validateXmlText(xml, DANFSE_MAX_BYTES) ?? checkWellFormedXml(xml);
      if (error) {
        messages.append(alertBox('danger', error));
        return;
      }
      const controller = new AbortController();
      busy = true;
      generateBtn.disabled = true;
      generateBtn.setAttribute('aria-busy', 'true');
      generateBtn.textContent = 'Gerando...';
      releaseUrl();
      pane.loading(() => controller.abort());
      wb.showResponse();
      const request = {
        method: 'POST',
        url: `${ENDPOINT}?${new URLSearchParams({ stc: situacao.value, canhoto: String(canhoto.checked) })}`,
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
        responseType: 'blob' as const,
        timeoutMs: 60_000,
        signal: controller.signal,
      };
      const res = await runAndRecord('danfse', request, { scenarioId: loaded?.scenario.id, scenarioName: loaded?.scenario.name ?? 'Geração manual' }).finally(() => {
        busy = false;
        generateBtn.disabled = false;
        generateBtn.removeAttribute('aria-busy');
        generateBtn.textContent = 'Gerar PDF';
      });
      if (res.received && res.status === 200 && res.blob && /pdf/i.test(res.contentType)) {
        objectUrl = URL.createObjectURL(res.blob);
        const expectedOk = loaded && !isDirty() ? res.status === loaded.scenario.expected.status : null;
        pane.showNode(h('div', { class: 'rtc-resp rtc-resp--fill', 'data-testid': 'pdf-output' },
          h('div', { class: 'rtc-resp-status' },
            h('span', { class: 'badge fs-6 text-bg-success', 'data-testid': 'http-status' }, `HTTP ${res.status}`),
            h('span', { class: 'badge text-bg-light' }, `${res.durationMs} ms`),
            h('span', { class: 'badge text-bg-light' }, formatBytes(res.blob.size)),
            expectedOk ? h('span', { class: 'badge text-bg-success' }, 'Confere com o esperado') : null,
            h('span', { class: 'ms-auto' }, h('a', { class: 'btn btn-sm btn-outline-primary', href: objectUrl, download: 'danfse.pdf', 'data-testid': 'download-pdf' }, 'Baixar PDF'))),
          h('iframe', { class: 'rtc-pdf', src: objectUrl, title: 'DANFSe gerado', 'data-testid': 'pdf-frame' })));
        return;
      }
      // Engine errors come as JSON text: show them untouched.
      const asText: EngineResponse = res.blob ? { ...res, text: await res.blob.text(), blob: undefined } : res;
      pane.show(asText, { request: { ...request, signal: undefined } });
    }

    generateBtn.addEventListener('click', () => void generate());
    wb.el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void generate();
      }
    });
    renderCard();
    const initial = query.get('cenario');
    if (initial) void loadScenario(initial, query.get('executar') === '1');

    return () => {
      clearTimeout(undoTimer);
      editor.destroy();
    };
  }

  return () => {
    releaseUrl();
    disposeEditor?.();
  };
}
