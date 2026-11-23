import { h } from '../utils/dom';

export interface ChipOption {
  value: string;
  label: string;
}

/** Multiple-choice chips (checkbox group). `onChange` receives the selected values in option order. */
export function chipGroup(opts: { options: ChipOption[]; selected?: string[]; label: string; onChange: (values: string[]) => void }): HTMLElement {
  const selected = new Set(opts.selected ?? []);
  const boxes = opts.options.map((o) => h('input', { type: 'checkbox', value: o.value, checked: selected.has(o.value), 'data-chip': o.value }));
  const emit = () => opts.onChange(boxes.filter((b) => b.checked).map((b) => b.value));
  boxes.forEach((b) => b.addEventListener('change', emit));
  return h('div', { class: 'rtc-chips', role: 'group', 'aria-label': opts.label },
    opts.options.map((o, i) => h('label', { class: 'rtc-chip' }, boxes[i], o.label)));
}

export const joinChips = (values: string[]): string | undefined => (values.length > 0 ? values.join(',') : undefined);
export const splitChips = (value: unknown): string[] => (typeof value === 'string' && value ? value.split(',').map((v) => v.trim()).filter(Boolean) : []);
