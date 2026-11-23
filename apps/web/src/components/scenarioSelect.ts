import type { Scenario } from '../types';
import { h } from '../utils/dom';
import { categoryLabel } from '../utils/labels';
import { badge } from './ui';

export interface ScenarioSelect {
  el: HTMLSelectElement;
  setValue(id: string): void;
}

/** "Carregar cenário" select, grouped by category. The empty option means "no scenario". */
export function scenarioSelect(scenarios: Scenario[], onChange: (id: string) => void): ScenarioSelect {
  const select = h('select', { class: 'form-select form-select-sm', 'aria-label': 'Carregar cenário', 'data-testid': 'scenario-select' },
    h('option', { value: '' }, 'Carregar cenário... (formulário em branco)'));
  const groups = new Map<string, Scenario[]>();
  for (const s of scenarios) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  for (const [category, list] of groups) {
    select.appendChild(h('optgroup', { label: categoryLabel(category) }, list.map((s) => h('option', { value: s.id }, s.name))));
  }
  select.addEventListener('change', () => onChange(select.value));
  return { el: select, setValue: (id) => (select.value = id) };
}

export interface ScenarioCard {
  el: HTMLElement;
  setDirty(dirty: boolean): void;
}

/** Description of the loaded scenario. Only exists while a scenario is loaded. */
export function scenarioCard(s: Scenario, onRestore: () => void): ScenarioCard {
  const dirtyBadge = h('span', { hidden: true, 'data-testid': 'scenario-dirty' }, badge('modificado', 'warning'), ' ',
    h('button', { type: 'button', class: 'btn btn-link btn-sm py-0', 'data-action': 'restore', onClick: onRestore }, 'Restaurar cenário'));
  const el = h('section', { class: 'rtc-scenario', 'data-testid': 'scenario-card', 'aria-label': 'Cenário carregado' },
    h('div', { class: 'd-flex flex-wrap align-items-center gap-2' }, h('h2', null, s.name), badge(categoryLabel(s.category), s.category === 'erro' ? 'warning' : 'secondary'), dirtyBadge),
    h('p', { class: 'mb-1 mt-1' }, s.description),
    h('p', { class: 'mb-1' }, h('strong', null, 'O que demonstra: '), s.explanation),
    h('p', { class: 'mb-1' }, h('strong', null, 'Esperado: '), `HTTP ${s.expected.status}. ${s.expected.summary}`),
    h('details', null, h('summary', null, 'Origem do exemplo'), h('p', { class: 'mb-0 mt-1 text-secondary' }, `${s.source.repository} ${s.source.tag} · ${s.source.path}${s.source.note ? ` (${s.source.note})` : ''}`)));
  return { el, setDirty: (d) => (dirtyBadge.hidden = !d) };
}
