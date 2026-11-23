import type { EngineId, Manifest } from '../types';
import { ENGINES } from '../services/engines';
import { loadManifest } from '../services/scenarios';
import { clear, h } from '../utils/dom';
import { consultasTab, type Tool } from './consultasTab';
import { operationPanel, type OperationHandle, type OperationOptions } from './operationPanel';
import { alertBox, spinner, tabs } from './ui';

export interface EnginePageOptions {
  engine: EngineId;
  query: URLSearchParams;
  operation: Omit<OperationOptions, 'engine' | 'manifest'>;
  /** Tools of the Consultas tab; receives a function that applies an activity code to the operation. */
  tools: (applyToOperation: (change: (state: Record<string, unknown>) => void) => void) => Tool[];
}

/** Page of a JSON engine: tabs "Operação" (workbench) and "Consultas". */
export function mountEnginePage(root: HTMLElement, o: EnginePageOptions): () => void {
  const info = ENGINES[o.engine];
  const page = h('div', { class: 'rtc-page' }, h('div', { class: 'rtc-page-head' }, h('h1', null, info.label), h('p', null, info.description)));
  const body = h('div', { class: 'rtc-page-body d-flex flex-column flex-fill', style: 'min-height:0' }, spinner('Carregando cenários...'));
  page.appendChild(body);
  clear(root);
  root.appendChild(page);

  loadManifest(o.engine)
    .then((manifest: Manifest) => {
      let op: OperationHandle | undefined;
      let strip: ReturnType<typeof tabs> | undefined;
      const operation = operationPanel({ engine: o.engine, manifest, ...o.operation });
      op = operation;
      const apply = (change: (state: Record<string, unknown>) => void) => {
        strip?.select('operation');
        op?.patchState(change);
      };
      strip = tabs([
        { id: 'operation', label: 'Operação', render: () => operation.el },
        { id: 'consultas', label: 'Consultas', render: () => consultasTab({ engine: o.engine, basePath: manifest.basePath, manifest, tools: o.tools(apply) }) },
      ], 'operation', { fill: true, compact: true });
      clear(body);
      body.appendChild(strip.el);
      const scenario = o.query.get('cenario');
      if (scenario) void operation.loadScenario(scenario, o.query.get('executar') === '1');
    })
    .catch((e: unknown) => {
      clear(body);
      body.appendChild(alertBox('danger', e instanceof Error ? e.message : 'Catálogo de cenários indisponível.'));
    });
  return () => undefined;
}
