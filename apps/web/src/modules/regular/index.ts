import { mountEnginePage } from '../../components/enginePage';
import { buildRegularForm, regularBlank } from './form';
import { REGULAR_TOOLS } from './tools';

export function mountRegular(root: HTMLElement, query: URLSearchParams): () => void {
  return mountEnginePage(root, {
    engine: 'regular',
    query,
    operation: {
      endpoints: [
        { endpoint: '/calculadora/regime-geral', label: 'Cálculo (regime-geral)' },
        { endpoint: '/calculadora/observabilidade/regime-geral', label: 'Cálculo com observabilidade' },
      ],
      blank: regularBlank,
      buildForm: buildRegularForm,
    },
    tools: () => REGULAR_TOOLS,
  });
}
