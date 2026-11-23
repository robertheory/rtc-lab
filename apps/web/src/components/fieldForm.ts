import { h } from '../utils/dom';
import { isDateOnly, isoToLocalInput, localInputToIso } from '../utils/datetime';
import { getPath, setPath } from '../utils/path';
import { chipGroup, joinChips, splitChips, type ChipOption } from './chips';

type Json = Record<string, unknown>;

export interface FormCtx {
  state: Json;
  /** Advanced mode is on: forms may reveal extra optional groups. */
  advanced: boolean;
  /** Field-level errors reported by the engine, keyed by absolute payload path (e.g. itens.3.ncm). */
  errors: Map<string, string>;
  /** The payload changed: refresh the JSON editor. */
  changed(): void;
  /** Structure changed (items, conditional fields): rebuild the form. */
  rerender(): void;
}

export interface FieldSpec {
  path: string;
  label: string;
  kind: 'text' | 'number' | 'numstr' | 'select' | 'bool' | 'date' | 'datetime' | 'chips';
  options?: ChipOption[];
  /** Select values are stored as numbers. */
  numeric?: boolean;
  placeholder?: string;
  help?: string;
  /** Rebuild the form after this field changes (it drives conditional fields). */
  rerender?: boolean;
  /** Suggestions for free-text fields (datalist). */
  suggestions?: string[];
  /** Width in 12-column units. The pane width decides how many columns actually fit. */
  span?: number;
}

let uid = 0;
const abs = (scope: string, path: string) => (scope ? `${scope}.${path}` : path);

function closeHelps(except?: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.rtc-help[aria-expanded="true"]').forEach((b) => {
    if (b === except) return;
    b.setAttribute('aria-expanded', 'false');
    document.getElementById(b.getAttribute('aria-controls') ?? '')?.setAttribute('hidden', '');
  });
}
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.rtc-help, .rtc-help-pop')) closeHelps();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHelps();
});

function helpButton(label: string, text: string): { button: HTMLElement; pop: HTMLElement } {
  const id = `help${++uid}`;
  const pop = h('div', { class: 'rtc-help-pop', id, role: 'note', hidden: true }, text);
  const button = h('button', { type: 'button', class: 'rtc-help', 'aria-label': `Ajuda: ${label}`, 'aria-expanded': 'false', 'aria-controls': id });
  button.textContent = 'i';
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    closeHelps(button);
    button.setAttribute('aria-expanded', String(open));
    pop.hidden = !open;
  });
  return { button, pop };
}

export function field(ctx: FormCtx, target: Json, spec: FieldSpec, scope = ''): HTMLElement {
  const id = `f${++uid}`;
  const key = abs(scope, spec.path);
  const current = getPath(target, spec.path);
  const errorId = `${id}-err`;
  const errorText = ctx.errors.get(key);

  const cell = h('div', { class: `rtc-f s${spec.span ?? 4}` });
  const labelRow = h('div', { class: 'rtc-f-label' }, h('label', { for: id }, spec.label));
  cell.appendChild(labelRow);
  if (spec.help) {
    const help = helpButton(spec.label, spec.help);
    labelRow.appendChild(help.button);
    cell.appendChild(help.pop);
  }

  let errorEl: HTMLElement | null = null;
  const markInvalid = (control: HTMLElement) => {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', errorId);
    control.classList.add('is-invalid');
  };
  const clearError = (control: HTMLElement) => {
    if (!ctx.errors.has(key)) return;
    ctx.errors.delete(key);
    errorEl?.remove();
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
    control.classList.remove('is-invalid');
  };
  const commit = (control: HTMLElement, value: unknown, final: boolean) => {
    clearError(control);
    setPath(target, spec.path, value);
    ctx.changed();
    if (final && spec.rerender) ctx.rerender();
  };

  let control: HTMLElement;
  switch (spec.kind) {
    case 'select': {
      const sel = h('select', { id, class: 'form-select form-select-sm', 'data-abs': key, onChange: () => commit(sel, sel.value === '' ? undefined : spec.numeric ? Number(sel.value) : sel.value, true) },
        h('option', { value: '' }, 'Selecione...'), ...(spec.options ?? []).map((o) => h('option', { value: o.value }, o.label)));
      sel.value = current === undefined || current === null ? '' : String(current);
      control = sel;
      break;
    }
    case 'bool': {
      const box = h('input', { id, type: 'checkbox', class: 'form-check-input', role: 'switch', checked: current === true, 'data-abs': key, onChange: () => commit(box, box.checked, true) });
      const text = h('span', null, current === true ? 'Sim' : 'Não');
      box.addEventListener('change', () => (text.textContent = box.checked ? 'Sim' : 'Não'));
      control = h('div', { class: 'rtc-switchbox' }, box, text);
      break;
    }
    case 'date': {
      const input = h('input', { id, type: 'date', class: 'form-control form-control-sm', value: isDateOnly(current) ? current : '', 'data-abs': key, onChange: () => commit(input, input.value || undefined, true) });
      control = input;
      break;
    }
    case 'datetime': {
      const input = h('input', { id, type: 'datetime-local', class: 'form-control form-control-sm', value: isoToLocalInput(current), 'data-abs': key, onChange: () => {
        const iso = localInputToIso(input.value, getPath(target, spec.path));
        commit(input, iso || undefined, true);
      } });
      control = input;
      break;
    }
    case 'chips': {
      control = chipGroup({ options: spec.options ?? [], selected: splitChips(current), label: spec.label, onChange: (v) => commit(control, joinChips(v), true) });
      control.setAttribute('data-abs', key);
      break;
    }
    default: {
      const listId = spec.suggestions ? `${id}-list` : undefined;
      const input = h('input', {
        id,
        class: 'form-control form-control-sm',
        type: 'text',
        inputMode: spec.kind === 'number' ? 'decimal' : 'text',
        placeholder: spec.placeholder ?? '',
        value: current === undefined || current === null ? '' : String(current),
        list: listId,
        'data-abs': key,
        // Keep the payload in sync on every keystroke; rebuild only when the field is done.
        onInput: () => update(false),
        onChange: () => update(true),
      });
      const update = (final: boolean) => {
        const raw = input.value.trim();
        let value: unknown = raw === '' ? undefined : raw;
        if (spec.kind === 'number' && raw !== '') {
          const n = Number(raw.replace(',', '.'));
          value = Number.isFinite(n) ? n : raw;
        }
        commit(input, value, final);
      };
      control = input;
      if (listId) {
        cell.appendChild(h('datalist', { id: listId }, (spec.suggestions ?? []).map((s) => h('option', { value: s }))));
      }
    }
  }
  cell.appendChild(control);
  if (errorText) {
    errorEl = h('div', { class: 'rtc-f-error', id: errorId, role: 'alert' }, errorText);
    cell.appendChild(errorEl);
    markInvalid(control.matches('input,select') ? control : (control.querySelector('input') ?? control));
  }
  return cell;
}

export function fieldRow(ctx: FormCtx, target: Json, specs: FieldSpec[], scope = ''): HTMLElement {
  return h('div', { class: 'rtc-grid' }, specs.map((s) => field(ctx, target, s, scope)));
}

export function section(title: string, note: string | null, ...children: (Node | null)[]): HTMLElement {
  return h('fieldset', { class: 'rtc-section' },
    h('legend', null, title),
    note ? h('p', { class: 'rtc-section-note' }, note) : null,
    ...children);
}

/** Optional nested object toggled with a checkbox (e.g. impostoSeletivo). */
export function optionalGroup(ctx: FormCtx, target: Json, key: string, title: string, build: (obj: Json, scope: string) => Node[], opts: { help?: string; scope?: string } = {}): HTMLElement {
  const scope = abs(opts.scope ?? '', key);
  const present = typeof target[key] === 'object' && target[key] !== null;
  const box = h('input', { type: 'checkbox', class: 'form-check-input', checked: present, id: `g${++uid}`, 'data-group': scope, onChange: () => {
    if (box.checked) target[key] = {};
    else delete target[key];
    ctx.changed();
    ctx.rerender();
  } });
  return h('div', { class: 'rtc-subgroup' },
    h('div', { class: 'form-check' }, box, h('label', { class: 'form-check-label small fw-semibold', for: box.id }, title)),
    opts.help ? h('div', { class: 'rtc-section-note mb-1' }, opts.help) : null,
    present ? h('div', { class: 'mt-2' }, ...build(target[key] as Json, scope)) : null);
}

/** List of items with add/remove. `render` builds the fields of one item. */
export function itemsEditor(ctx: FormCtx, opts: { label: string; factory: (index: number) => Json; render: (item: Json, index: number, scope: string) => Node[] }): HTMLElement {
  if (!Array.isArray(ctx.state.itens)) ctx.state.itens = [];
  const items = ctx.state.itens as Json[];
  const list = h('div', { class: 'd-flex flex-column gap-3' }, items.map((item, i) =>
    h('div', { class: 'card rtc-item', 'data-item': String(i) },
      h('div', { class: 'card-header d-flex justify-content-between align-items-center py-1' },
        h('strong', { class: 'small' }, `${opts.label} ${i + 1}`),
        h('button', { type: 'button', class: 'btn btn-sm btn-outline-danger', disabled: items.length <= 1, 'data-action': 'remove-item', onClick: () => {
          items.splice(i, 1);
          items.forEach((it, idx) => { it.numero = idx + 1; });
          ctx.errors.clear();
          ctx.changed();
          ctx.rerender();
        } }, 'Remover')),
      h('div', { class: 'card-body py-2' }, ...opts.render(item, i, `itens.${i}`)))));
  const add = h('button', { type: 'button', class: 'btn btn-sm btn-outline-primary mt-2', 'data-action': 'add-item', onClick: () => {
    items.push(opts.factory(items.length));
    ctx.changed();
    ctx.rerender();
  } }, `Adicionar ${opts.label.toLowerCase()}`);
  return h('div', null, list, add);
}
