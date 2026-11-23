type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> | null | undefined;

/** Tiny hyperscript helper: h('div', {class: 'x', onClick: fn}, child, ...). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'for') el.setAttribute('for', String(value));
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'style' || key.startsWith('aria-') || key.startsWith('data-') || key === 'role') {
      el.setAttribute(key, String(value));
    } else if (key in el && key !== 'list') {
      // `list` is a read-only property on inputs and must be set as an attribute.
      (el as unknown as Record<string, unknown>)[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: (Child | Child[])[]): void {
  for (const child of children) {
    if (Array.isArray(child)) append(parent, child);
    else if (child === null || child === undefined || child === false) continue;
    else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mountInto(el: Element, ...children: (Child | Child[])[]): void {
  clear(el);
  append(el, children);
}
