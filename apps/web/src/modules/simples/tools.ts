import { DEFAULT_QUERY_DATE, type Tool, type ToolParam } from '../../components/consultasTab';
import { badge } from '../../components/ui';
import { h } from '../../utils/dom';
import { tryParseJson } from '../../utils/format';

const date: ToolParam = { name: 'data', label: 'Data', in: 'query', required: true, default: DEFAULT_QUERY_DATE, type: 'date' };

interface Activity {
  codigo: string;
  descricao: string;
  anexoSemFatorR?: string | null;
  anexoComFatorR?: string | null;
  modoFatorR?: string;
  admissivelNoDocumento?: boolean;
}

/** Simples Nacional lookups. `onUseActivity` applies an activity code to the operation items. */
export function simplesTools(onUseActivity: (code: string) => void): Tool[] {
  return [
    {
      id: 'atividades',
      label: 'Atividades do Simples Nacional',
      group: 'Consultas',
      method: 'GET',
      path: '/calculadora/simples-nacional/atividades',
      params: [
        date,
        { name: 'tpDoc', label: 'Tipo de documento', in: 'query', type: 'select', options: [{ value: '55', label: '55 · NF-e' }, { value: '65', label: '65 · NFC-e' }, { value: '91', label: '91 · NFS-e' }] },
        { name: 'anexos', label: 'Anexos', in: 'query', type: 'chips', options: ['I', 'II', 'III', 'IV', 'V'].map((v) => ({ value: v, label: `Anexo ${v}` })) },
        { name: 'cClassTrib', label: 'cClassTrib', in: 'query', placeholder: '000001' },
      ],
      help: 'Lista as atividades vigentes na data. Use "Usar nos itens" para aplicar o código ao formulário da aba Operação.',
      extra: (res) => {
        const list = tryParseJson(res.text);
        if (res.status !== 200 || !Array.isArray(list)) return null;
        return h('div', { class: 'table-responsive mb-2' },
          h('table', { class: 'table table-sm align-middle', 'data-testid': 'activities-table' },
            h('thead', null, h('tr', null, ['Código', 'Descrição', 'Anexo', 'Fator R', 'No documento', ''].map((c) => h('th', null, c)))),
            h('tbody', null, (list as Activity[]).map((a) => h('tr', { 'data-activity': a.codigo },
              h('td', null, h('code', null, a.codigo)),
              h('td', null, a.descricao),
              h('td', null, [a.anexoSemFatorR, a.anexoComFatorR].filter(Boolean).join(' / ') || '—'),
              h('td', null, a.modoFatorR ?? '—'),
              h('td', null, a.admissivelNoDocumento === undefined ? '—' : a.admissivelNoDocumento ? badge('Admissível', 'success') : badge('Não admissível', 'secondary')),
              h('td', null, h('button', { type: 'button', class: 'btn btn-sm btn-outline-primary', 'data-action': 'use-activity', onClick: () => onUseActivity(a.codigo) }, 'Usar nos itens')))))));
      },
    },
    { id: 'atividade', label: 'Atividade por código', group: 'Consultas', method: 'GET', path: '/calculadora/simples-nacional/atividades/{codigo}', params: [{ name: 'codigo', label: 'Código', in: 'path', required: true, default: '09' }, date] },
    { id: 'erro', label: 'Descrição de um código de erro (VSN-###)', group: 'Consultas', method: 'GET', path: '/calculadora/observabilidade/simples-nacional/erros', params: [{ name: 'codigo', label: 'Código', in: 'query', required: true, default: 'VSN-050' }] },
    { id: 'versao', label: 'Versão do motor e da base', group: 'Consultas', method: 'GET', path: '/versao', params: [] },
  ];
}
