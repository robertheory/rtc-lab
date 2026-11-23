import { field, fieldRow, itemsEditor, optionalGroup, section, type FieldSpec, type FormCtx } from '../../components/fieldForm';
import { send } from '../../services/http';
import { h } from '../../utils/dom';

type Json = Record<string, unknown>;

/** Empty operation: every field blank, one empty item. */
export const simplesBlank = (): Json => ({ itens: [{ numero: 1 }] });

const opt = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

const TP_DOC = opt([['55', '55 · NF-e'], ['65', '65 · NFC-e'], ['57', '57'], ['67', '67'], ['63', '63'], ['93', '93'], ['62', '62'], ['91', '91 · NFS-e']]);

const HEADER: FieldSpec[] = [
  { path: 'id', label: 'Identificador (id)', kind: 'text', span: 4 },
  { path: 'versao', label: 'Versão (versao)', kind: 'text', span: 2, placeholder: '3.0.0' },
  { path: 'data', label: 'Data do fato gerador', kind: 'date', rerender: true, span: 3, help: 'Rege todas as vigências (atividades, alíquotas, classificações).' },
  { path: 'tpDoc', label: 'Tipo de documento (tpDoc)', kind: 'select', options: TP_DOC, rerender: true, span: 3, help: 'Define quais campos se aplicam: documentos com CRT (NF-e etc.) ou NFS-e (91).' },
];

const WITH_CRT: FieldSpec[] = [
  { path: 'CRT', label: 'CRT', kind: 'select', options: opt([['1', '1 · Simples'], ['2', '2 · Excesso de sublimite'], ['3', '3 · Regime normal'], ['4', '4 · MEI']]), span: 4, help: 'Obrigatório nos documentos com CRT.' },
  { path: 'tpRegimeIBSCBS', label: 'Regime do IBS/CBS', kind: 'text', span: 4, help: 'Opcional (tpRegimeIBSCBS).' },
  { path: 'tpEnteGov', label: 'Ente governamental', kind: 'select', options: opt([['1', '1 · União'], ['2', '2 · Estado'], ['3', '3 · Distrito Federal'], ['4', '4 · Município']]), span: 4, help: 'Compra governamental (tpEnteGov).' },
];

const NFSE: FieldSpec[] = [
  { path: 'opSimpNac', label: 'Opção pelo Simples', kind: 'select', options: opt([['1', '1 · Não optante'], ['2', '2 · MEI'], ['3', '3 · ME/EPP'], ['4', '4 · Opção pendente']]), span: 4, help: 'opSimpNac' },
  { path: 'regApIBSCBSSN', label: 'Apuração do IBS/CBS', kind: 'select', options: opt([['1', '1 · IBS e CBS pelo Simples'], ['2', '2 · CBS pelo Simples, IBS regular'], ['3', '3 · Os dois pelo regime regular']]), span: 4, help: 'regApIBSCBSSN' },
  { path: 'regApTribSN', label: 'Apuração dos tributos', kind: 'select', options: opt([['1', '1 · Federais e ISS pelo Simples'], ['2', '2 · Federais pelo Simples, ISS fora'], ['3', '3 · Federais e ISS fora']]), span: 4, help: 'regApTribSN' },
];

const PAIR: FieldSpec[] = [
  { path: 'pCBSSN', label: 'pCBSSN (%)', kind: 'numstr', span: 3 },
  { path: 'pIBSSN', label: 'pIBSSN (%)', kind: 'numstr', span: 3 },
];
const PAIR_WITH_ISS: FieldSpec[] = [
  ...PAIR,
  { path: 'semRedistribuicaoISS.pCBSSN', label: 'pCBSSN sem redistribuição do ISS', kind: 'numstr', span: 3 },
  { path: 'semRedistribuicaoISS.pIBSSN', label: 'pIBSSN sem redistribuição do ISS', kind: 'numstr', span: 3 },
];

const activityCache = new Map<string, Promise<{ codigo: string; descricao: string }[]>>();

/** Activities that apply to a date and document type, used as suggestions for cAtivSN. */
export function loadActivities(data: string, tpDoc: string): Promise<{ codigo: string; descricao: string }[]> {
  const key = `${data}|${tpDoc}`;
  let p = activityCache.get(key);
  if (!p) {
    const qs = new URLSearchParams({ data });
    if (tpDoc) qs.set('tpDoc', tpDoc);
    p = send({ method: 'GET', url: `/api/simples/calculadora/simples-nacional/atividades?${qs}`, timeoutMs: 8000 }).then((r) => {
      try {
        const list = JSON.parse(r.text ?? '[]') as { codigo: string; descricao: string }[];
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    });
    activityCache.set(key, p);
  }
  return p;
}

export function buildSimplesForm(host: HTMLElement, ctx: FormCtx): void {
  const state = ctx.state;
  const tpDoc = String(state.tpDoc ?? '');
  const isNfse = tpDoc === '91';

  host.appendChild(section('Operação', 'Identificação e documento fiscal de origem.',
    fieldRow(ctx, state, HEADER),
    tpDoc === '' ? h('p', { class: 'rtc-section-note mb-0' }, 'Escolha o tipo de documento para ver os campos que se aplicam a ele.') : fieldRow(ctx, state, isNfse ? NFSE : WITH_CRT)));

  host.appendChild(section('Alíquotas efetivas', 'Linha de alíquotas efetivas do contribuinte no período, em pontos percentuais, como texto.',
    optionalGroup(ctx, state, 'aliquotasEfetivas', 'Informar alíquotas efetivas', (obj, sc) => [
      fieldRow(ctx, obj, [
        { path: 'fatorR', label: 'Fator R ≥ 28%', kind: 'bool', span: 3, help: 'Verdadeiro: Anexo III para a atividade 09. Falso: Anexo V.' },
        { path: 'impedimentoSublimite', label: 'Impedimento por sublimite', kind: 'bool', span: 3, help: 'Impedido de recolher IBS e ISS pelo Simples por exceder o sublimite.' },
      ], sc),
      ...(['anexoI', 'anexoII', 'anexoIII', 'anexoIV', 'anexoV'] as const).map((key) =>
        optionalGroup(ctx, obj, key, `Anexo ${key.replace('anexo', '')}`, (o, sc2) => [fieldRow(ctx, o, key === 'anexoI' || key === 'anexoII' ? PAIR : PAIR_WITH_ISS, sc2)], { scope: sc })),
    ])));

  const itemSpecific = (): FieldSpec[] => {
    if (tpDoc === '') return [];
    return isNfse
      ? [
          { path: 'nbs', label: 'NBS', kind: 'text', span: 3 },
          { path: 'tribISSQN', label: 'Tributação do ISSQN', kind: 'select', options: opt([['1', '1 · Tributável'], ['2', '2 · Imunidade'], ['3', '3 · Exportação'], ['4', '4 · Não incidência']]), span: 3 },
          { path: 'tpRetISSQN', label: 'Retenção do ISSQN', kind: 'select', options: opt([['1', '1 · Não retido'], ['2', '2 · Retido pelo tomador'], ['3', '3 · Retido pelo intermediário']]), span: 3 },
          { path: 'tpBM', label: 'Benefício municipal (tpBM)', kind: 'select', options: opt([['1', '1 · Isenção'], ['2', '2 · Redução da base em %'], ['3', '3 · Redução da base em R$'], ['4', '4 · Alíquota diferenciada']]), span: 3 },
        ]
      : [
          { path: 'ncm', label: 'NCM', kind: 'text', span: 3 },
          { path: 'valorImpostoSeletivo', label: 'Imposto Seletivo (vIS)', kind: 'numstr', placeholder: '0.00', span: 3 },
        ];
  };

  host.appendChild(section('Itens', isNfse ? 'Uma NFS-e admite exatamente um item.' : 'Um ou mais itens.',
    itemsEditor(ctx, {
      label: 'Item',
      factory: (i) => ({ numero: i + 1 }),
      render: (item, _i, scope) => {
        const specs: FieldSpec[] = [
          { path: 'numero', label: 'Nº', kind: 'number', span: 1 },
          { path: 'cAtivSN', label: 'Atividade (cAtivSN)', kind: 'text', suggestions: [], span: 3, help: 'Código oficial da atividade do Simples. Consulte a lista em Consultas > Atividades.' },
          { path: 'cClassTrib', label: 'cClassTrib', kind: 'text', span: 3, placeholder: '000001' },
          { path: 'baseCalculo', label: 'Base de cálculo', kind: 'numstr', placeholder: '1000.00', span: 3 },
          ...itemSpecific(),
        ];
        const row = fieldRow(ctx, item, specs, scope);
        const datalist = row.querySelector('datalist');
        if (datalist && state.data) {
          void loadActivities(String(state.data), tpDoc).then((list) => {
            for (const a of list) datalist.appendChild(h('option', { value: a.codigo }, a.descricao));
          });
        }
        return [row];
      },
    })));
}

export { field };
