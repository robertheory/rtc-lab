import { createEditor } from '../../components/editor';
import { renderResponse } from '../../components/responseViewer';
import { alertBox, badge, spinner } from '../../components/ui';
import { workbench } from '../../components/workbench';
import { clearHistory, listHistory, removeHistoryEntry } from '../../services/history';
import { ENGINES } from '../../services/engines';
import { runAndRecord, runScenario } from '../../services/runner';
import { findScenario, loadManifest } from '../../services/scenarios';
import type { EngineResponse, HistoryEntry } from '../../types';
import { clear, h } from '../../utils/dom';
import { copyText, formatDateTime, prettyJson, statusClass } from '../../utils/format';

const engineLabel = (e: HistoryEntry['engine']) => (e === 'playground' ? 'Playground' : ENGINES[e].short);

export function mountHistory(root: HTMLElement): () => void {
  const filter = h('select', { class: 'form-select form-select-sm', style: 'max-width:12rem', 'data-testid': 'history-filter' },
    h('option', { value: '' }, 'Todos os motores'), h('option', { value: 'regular' }, 'Regular'), h('option', { value: 'simples' }, 'Simples'), h('option', { value: 'danfse' }, 'DANFSe'), h('option', { value: 'playground' }, 'Playground'));
  const wb = workbench({ prefKey: 'history', leftTitle: 'Execuções', rightTitle: 'Detalhe' });
  const table = h('div', { 'data-testid': 'history-table' });
  const detail = h('div', { class: 'p-3', 'data-testid': 'history-detail' });
  const editors: { destroy(): void }[] = [];

  function canRerun(e: HistoryEntry): boolean {
    return (e.payload !== undefined && !e.payloadOmitted) || e.method === 'GET' || (e.payloadOmitted === true && Boolean(e.scenarioId) && e.engine !== 'playground');
  }

  async function rerun(e: HistoryEntry): Promise<void> {
    clear(detail);
    wb.showResponse();
    detail.append(spinner('Reexecutando...'));
    let response: EngineResponse;
    let request;
    if (e.payload !== undefined && !e.payloadOmitted) {
      request = { method: e.method, url: e.url, headers: e.contentType ? { 'Content-Type': e.contentType } : undefined, body: e.payload };
      response = await runAndRecord(e.engine, request, { scenarioId: e.scenarioId, scenarioName: e.scenarioName });
    } else if (e.method === 'GET') {
      request = { method: 'GET', url: e.url };
      response = await runAndRecord(e.engine, request, { scenarioId: e.scenarioId, scenarioName: e.scenarioName });
    } else if (e.scenarioId && e.engine !== 'playground') {
      const s = await findScenario(e.engine, e.scenarioId);
      if (!s) {
        clear(detail);
        return void detail.append(alertBox('warning', 'O cenário deste registro não existe mais no catálogo.'));
      }
      const out = await runScenario(e.engine, await loadManifest(e.engine), s);
      request = out.request;
      response = out.response;
    } else {
      clear(detail);
      return void detail.append(alertBox('warning', 'O conteúdo enviado não é guardado no histórico.'));
    }
    clear(detail);
    detail.append(h('h2', { class: 'h6' }, 'Resultado da reexecução'), renderResponse(response, { request }));
    render();
  }

  function view(e: HistoryEntry): void {
    editors.splice(0).forEach((x) => x.destroy());
    clear(detail);
    wb.showResponse();
    const pay = createEditor({ value: e.payload ? (e.contentType.includes('json') ? prettyJson(e.payload) : e.payload) : '', language: e.contentType.includes('xml') ? 'xml' : 'json', readOnly: true, minHeight: '3rem', maxHeight: '20rem' });
    const res = createEditor({ value: e.result ? prettyJson(e.result) : '', language: 'json', readOnly: true, minHeight: '3rem', maxHeight: '20rem' });
    editors.push(pay, res);
    detail.append(
      h('h2', { class: 'h6' }, `${e.scenarioName ?? 'Chamada'} · ${formatDateTime(e.at)}`),
      h('p', { class: 'small' }, h('code', null, `${e.method} ${e.url}`)),
      h('div', { class: 'row g-3' },
        h('div', { class: 'col-12' }, h('div', { class: 'small fw-semibold mb-1' }, 'Payload enviado'),
          e.payloadOmitted ? h('p', { class: 'small text-secondary' }, 'Não guardado: documentos XML (ou conteúdos muito grandes) ficam fora do histórico.') : pay.el),
        h('div', { class: 'col-12' }, h('div', { class: 'small fw-semibold mb-1' }, `Resultado${e.resultTruncated ? ' (truncado)' : ''}`),
          e.resultOmitted ? h('p', { class: 'small text-secondary' }, 'Não guardado: respostas XML ou PDF ficam fora do histórico.') : res.el)));
  }

  function render(): void {
    const entries = listHistory().filter((e) => !filter.value || e.engine === filter.value);
    clear(table);
    if (entries.length === 0) {
      table.append(alertBox('info', 'Nenhuma execução registrada ainda. Execute um cenário e ele aparecerá aqui.'));
      return;
    }
    table.append(h('div', { class: 'table-responsive' },
      h('table', { class: 'table table-sm align-middle' },
        h('thead', null, h('tr', null, ['Data e hora', 'Motor', 'Cenário', 'Requisição', 'Status', 'Tempo', ''].map((c) => h('th', null, c)))),
        h('tbody', null, entries.map((e) => h('tr', { 'data-history-id': e.id },
          h('td', { class: 'text-nowrap small' }, formatDateTime(e.at)),
          h('td', null, engineLabel(e.engine)),
          h('td', null, e.scenarioName ?? '—'),
          h('td', { class: 'small font-monospace text-break' }, `${e.method} ${e.url}`),
          h('td', null, badge(e.status ? String(e.status) : 'erro', statusClass(e.status))),
          h('td', { class: 'small' }, `${e.durationMs} ms`),
          h('td', { class: 'text-nowrap' },
            h('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary me-1', 'data-action': 'view', onClick: () => view(e) }, 'Ver'),
            h('button', { type: 'button', class: 'btn btn-sm btn-outline-primary me-1', 'data-action': 'rerun', disabled: !canRerun(e), onClick: () => void rerun(e) }, 'Reexecutar'),
            h('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary me-1', 'data-action': 'copy', disabled: e.payload === undefined, onClick: () => void copyText(e.payload ?? '') }, 'Copiar payload'),
            h('button', { type: 'button', class: 'btn btn-sm btn-outline-danger', 'data-action': 'remove', onClick: () => { removeHistoryEntry(e.id); render(); } }, 'Remover'))))))));
  }

  filter.addEventListener('change', render);
  const clearBtn = h('button', { type: 'button', class: 'btn btn-outline-danger btn-sm', 'data-action': 'clear-history', onClick: () => {
    if (!window.confirm('Apagar todo o histórico deste navegador?')) return;
    clearHistory();
    clear(detail);
    render();
  } }, 'Limpar histórico');

  wb.leftBar.append(filter, clearBtn);
  wb.leftBody.append(table);
  detail.append(h('p', { class: 'text-secondary' }, 'Selecione uma execução (Ver ou Reexecutar) para ver os detalhes aqui.'));
  wb.rightBody.append(detail);
  clear(root);
  root.append(h('div', { class: 'rtc-page' },
    h('div', { class: 'rtc-page-head' }, h('h1', null, 'Histórico local'),
      h('p', null, 'As execuções ficam apenas no seu navegador (localStorage). XMLs fiscais e PDFs nunca são guardados.')),
    wb.el));
  render();
  return () => editors.splice(0).forEach((x) => x.destroy());
}
