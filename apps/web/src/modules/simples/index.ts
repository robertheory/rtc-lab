import { mountEnginePage } from '../../components/enginePage';
import { buildSimplesForm, simplesBlank } from './form';
import { simplesTools } from './tools';

export function mountSimples(root: HTMLElement, query: URLSearchParams): () => void {
  return mountEnginePage(root, {
    engine: 'simples',
    query,
    operation: {
      endpoints: [{ endpoint: '/calculadora/observabilidade/simples-nacional/nao-assistido', label: 'Cálculo com observabilidade por item' }],
      blank: simplesBlank,
      buildForm: buildSimplesForm,
    },
    tools: (apply) =>
      simplesTools((code) =>
        apply((state) => {
          const items = (Array.isArray(state.itens) ? state.itens : []) as Record<string, unknown>[];
          const target = items.find((it) => !it.cAtivSN) ?? items[items.length - 1];
          if (target) target.cAtivSN = code;
        })),
  });
}
