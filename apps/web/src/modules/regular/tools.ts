import { DEFAULT_QUERY_DATE, type Tool, type ToolParam } from '../../components/consultasTab';

const date: ToolParam = { name: 'data', label: 'Data', in: 'query', required: true, default: DEFAULT_QUERY_DATE, type: 'date' };
const DADOS = '/calculadora/dados-abertos';
const CLASS = `${DADOS}/classificacoes-tributarias`;
const text = (name: string, label: string, def: string, where: 'path' | 'query' = 'query'): ToolParam => ({ name, label, in: where, required: true, default: def });

const get = (id: string, label: string, path: string, params: ToolParam[]): Tool => ({ id, label, group: 'Consultas', method: 'GET', path, params });

export const REGULAR_TOOLS: Tool[] = [
  get('class-cbs-ibs', 'Classificações tributárias (CBS/IBS)', `${CLASS}/cbs-ibs`, [date]),
  get('class-cbs-ibs-cod', 'Classificação por cClassTrib (CBS/IBS)', `${CLASS}/cbs-ibs/class-trib/{cClassTrib}`, [text('cClassTrib', 'cClassTrib', '200003', 'path'), date]),
  get('class-is', 'Classificações do Imposto Seletivo', `${CLASS}/imposto-seletivo`, [date]),
  get('sit-cbs-ibs', 'Situações tributárias (CBS/IBS)', `${DADOS}/situacoes-tributarias/cbs-ibs`, [date]),
  get('aliq-uniao', 'Alíquotas da União', `${DADOS}/aliquota-uniao`, [date]),
  get('aliq-uf', 'Alíquotas da UF', `${DADOS}/aliquota-uf`, [text('codigoUf', 'Código da UF (IBGE)', '43'), date]),
  get('aliq-mun', 'Alíquotas do município', `${DADOS}/aliquota-municipio`, [text('codigoMunicipio', 'Código do município (IBGE)', '4314902'), date]),
  get('ncm', 'Consultar NCM', `${DADOS}/ncm`, [text('ncm', 'NCM', '24021000'), date]),
  get('ncm-vigentes', 'NCMs vigentes', `${DADOS}/ncm/vigentes`, [date]),
  get('nbs', 'Consultar NBS', `${DADOS}/nbs`, [text('nbs', 'NBS', '101011100'), date]),
  get('nbs-aplicaveis', 'NBS aplicáveis a uma classificação', `${DADOS}/nbs-aplicaveis`, [text('cClassTrib', 'cClassTrib', '200028'), date]),
  get('fund-legais', 'Fundamentações legais', `${DADOS}/fundamentacoes-legais`, [date]),
  get('ufs', 'UFs', `${DADOS}/ufs`, []),
  get('municipios', 'Municípios de uma UF', `${DADOS}/ufs/municipios`, [text('siglaUf', 'Sigla da UF', 'RS')]),
  get('erro', 'Descrição de um código de erro', '/calculadora/observabilidade/erros', [text('codigo', 'Código', 'REG-011')]),
  get('versao', 'Versão do motor e da base', `${DADOS}/versao`, []),
  {
    id: 'base-calculo',
    label: 'Base de cálculo unificada',
    group: 'Ferramentas',
    method: 'POST',
    path: '/calculadora/base-calculo/base-calculo-unificada',
    params: [],
    help: 'Calcula baseRG, baseIS e baseSN a partir dos componentes da nota (JSON).',
    body: { contentType: 'application/json', scenarioIds: ['base-calculo-unificada'] },
  },
  {
    id: 'xml-gerar',
    label: 'Gerar XML tributário',
    group: 'Ferramentas',
    method: 'POST',
    path: '/calculadora/xml/generate',
    params: [{ name: 'tipo', label: 'Tipo de documento', in: 'query', required: true, type: 'select', default: 'nfe', optionsFrom: '/calculadora/xml/generate' }],
    help: 'Envie o resultado de um cálculo (ROC em JSON) e receba o XML tributário do documento escolhido.',
    body: { contentType: 'application/json', scenarioIds: ['xml-gerar'] },
  },
  {
    id: 'xml-validar',
    label: 'Validar XML',
    group: 'Ferramentas',
    method: 'POST',
    path: '/calculadora/xml/validate',
    params: [
      { name: 'tipo', label: 'Tipo de documento', in: 'query', required: true, type: 'select', default: 'nfse', optionsFrom: '/calculadora/xml/validate', extraOptions: [{ value: 'nfse', label: 'NFSe (nfse)' }] },
      { name: 'subtipo', label: 'Subtipo', in: 'query', required: true, type: 'select', default: 'nota', options: [{ value: 'nota', label: 'nota (documento completo)' }, { value: 'grupo', label: 'grupo (trecho tributário)' }] },
    ],
    help: 'O motor valida o XML contra o XSD do tipo escolhido. O conteúdo enviado não é guardado no histórico.',
    body: { contentType: 'application/xml', scenarioIds: ['xml-validar-nfse'], upload: true, maxBytes: 500 * 1024 },
  },
];
