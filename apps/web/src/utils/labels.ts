export const CATEGORY_LABEL: Record<string, string> = {
  basico: 'Básico',
  completo: 'Completo',
  'reducao-tributaria': 'Redução tributária',
  'imposto-seletivo': 'Imposto Seletivo',
  observabilidade: 'Observabilidade',
  consulta: 'Consulta',
  xml: 'XML',
  erro: 'Erro proposital',
  situacao: 'Situação da nota',
  'tratamento-diferenciado': 'Tratamento diferenciado',
  'multiplos-itens': 'Múltiplos itens',
};

export const categoryLabel = (c: string): string => CATEGORY_LABEL[c] ?? c;
