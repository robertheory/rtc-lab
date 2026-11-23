import { field, fieldRow, itemsEditor, optionalGroup, section, type FieldSpec, type FormCtx } from '../../components/fieldForm';
import { h } from '../../utils/dom';

type Json = Record<string, unknown>;

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** Empty operation: every field blank, one empty item. */
export const regularBlank = (): Json => ({ itens: [{ numero: 1 }] });

const HEADER: FieldSpec[] = [
  { path: 'id', label: 'Identificador (id)', kind: 'text', span: 4 },
  { path: 'versao', label: 'Versão (versao)', kind: 'text', span: 2, placeholder: '1.0.0' },
  { path: 'dhFatoGerador', label: 'Fato gerador (dhFatoGerador)', kind: 'datetime', rerender: true, span: 6, help: 'Data e hora do fato gerador. A partir de 2027 as alíquotas nominais são obrigatórias; antes disso são proibidas.' },
  { path: 'municipio', label: 'Município (código IBGE)', kind: 'number', placeholder: '4314902', span: 4 },
  { path: 'uf', label: 'UF', kind: 'select', options: UFS.map((u) => ({ value: u, label: u })), span: 2 },
  { path: 'tpDoc', label: 'Tipo de documento (tpDoc)', kind: 'number', suggestions: ['55', '65'], span: 3, help: 'Opcional. 55 = NF-e, 65 = NFC-e. Quando informado, o motor valida o vínculo da classificação com o tipo de documento.' },
];

const ITEM_MAIN: FieldSpec[] = [
  { path: 'numero', label: 'Nº', kind: 'number', span: 1 },
  { path: 'ncm', label: 'NCM', kind: 'text', span: 3 },
  { path: 'nbs', label: 'NBS', kind: 'text', span: 3 },
  { path: 'cst', label: 'CST', kind: 'text', placeholder: '000', span: 2 },
  { path: 'cClassTrib', label: 'cClassTrib', kind: 'text', placeholder: '000001', span: 3 },
  { path: 'baseCalculo', label: 'Base de cálculo', kind: 'number', span: 3 },
  { path: 'quantidade', label: 'Quantidade', kind: 'number', span: 2 },
  { path: 'unidade', label: 'Unidade', kind: 'text', placeholder: 'KG', span: 2 },
];

const IS_FIELDS: FieldSpec[] = [
  { path: 'cst', label: 'CST do IS', kind: 'text', span: 2 },
  { path: 'cClassTrib', label: 'cClassTrib do IS', kind: 'text', span: 3 },
  { path: 'baseCalculo', label: 'Base de cálculo', kind: 'number', span: 3 },
  { path: 'quantidade', label: 'Quantidade', kind: 'number', span: 2 },
  { path: 'unidade', label: 'Unidade', kind: 'text', span: 2 },
  { path: 'impostoInformado', label: 'Imposto informado', kind: 'number', span: 3 },
];

const REGULAR_TAX: FieldSpec[] = [
  { path: 'cst', label: 'CST (tributação regular)', kind: 'text', span: 3 },
  { path: 'cClassTrib', label: 'cClassTrib (tributação regular)', kind: 'text', span: 4 },
];

const NOMINAL: FieldSpec[] = [
  { path: 'cbs', label: 'CBS (%)', kind: 'number', span: 3 },
  { path: 'ibsEstadual', label: 'IBS estadual (%)', kind: 'number', span: 3 },
  { path: 'ibsMunicipal', label: 'IBS municipal (%)', kind: 'number', span: 3 },
  { path: 'impostoSeletivo.adValorem', label: 'IS ad valorem (%)', kind: 'number', span: 3 },
  { path: 'impostoSeletivo.adRem', label: 'IS ad rem', kind: 'number', span: 3 },
];

const COMPRA_GOV: FieldSpec[] = [
  { path: 'tpEnteGov', label: 'Tipo de ente (tpEnteGov)', kind: 'number', span: 4 },
  { path: 'pRedutor', label: 'Percentual redutor (pRedutor)', kind: 'text', span: 4 },
  { path: 'tpOperGov', label: 'Tipo de operação (tpOperGov)', kind: 'number', span: 4 },
];

/** Year of the fact-generating date, used to decide whether nominal rates apply. */
export function factYear(state: Json): number | null {
  const m = /^(\d{4})-/.exec(String(state.dhFatoGerador ?? state.dataHoraEmissao ?? ''));
  return m ? Number(m[1]) : null;
}

export function buildRegularForm(host: HTMLElement, ctx: FormCtx): void {
  const state = ctx.state;
  const year = factYear(state);
  const nominalRequired = year !== null && year >= 2027;
  const nominalForbidden = year !== null && year < 2027;

  host.appendChild(section('Operação', 'Dados gerais do documento.', fieldRow(ctx, state, HEADER)));
  if (ctx.advanced) {
    host.appendChild(section('Compra governamental (avançado)', 'Grupo opcional gCompraGov.',
      optionalGroup(ctx, state, 'gCompraGov', 'Informar compra governamental', (obj, sc) => [fieldRow(ctx, obj, COMPRA_GOV, sc)])));
  }

  host.appendChild(section('Itens', 'Cada item exige numero, cst e cClassTrib. Os grupos abaixo são opcionais.',
    itemsEditor(ctx, {
      label: 'Item',
      factory: (i) => ({ numero: i + 1 }),
      render: (item, _i, scope) => {
        const it = item;
        return [
          fieldRow(ctx, it, ITEM_MAIN, scope),
          optionalGroup(ctx, it, 'impostoSeletivo', 'Imposto Seletivo', (obj, sc) => [fieldRow(ctx, obj, IS_FIELDS, sc)], { scope }),
          optionalGroup(ctx, it, 'tributacaoRegular', 'Tributação regular', (obj, sc) => [fieldRow(ctx, obj, REGULAR_TAX, sc)], { scope, help: 'Informe quando a classificação do item exigir tributação regular.' }),
          optionalGroup(ctx, it, 'aliquotasNominais', `Alíquotas nominais${nominalRequired ? ' (obrigatórias a partir de 2027)' : nominalForbidden ? ' (proibidas antes de 2027)' : ''}`, (obj, sc) => [fieldRow(ctx, obj, NOMINAL, sc)], {
            scope,
            help: nominalRequired ? 'O fato gerador é de 2027 ou posterior: o motor exige este grupo.' : nominalForbidden ? 'O fato gerador é anterior a 2027: o motor rejeita este grupo.' : undefined,
          }),
        ];
      },
    })));

  if (!ctx.advanced) host.appendChild(h('p', { class: 'rtc-section-note' }, 'Campos menos comuns (gCompraGov, gComponentesBC) ficam disponíveis no modo avançado.'));
}

export { field };
