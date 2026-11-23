import { basicSetup, EditorView } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';

export type EditorLanguage = 'json' | 'xml' | 'text';

export interface Editor {
  el: HTMLElement;
  getValue(): string;
  setValue(value: string): void;
  setLanguage(language: EditorLanguage): void;
  destroy(): void;
}

export interface EditorOptions {
  value?: string;
  language?: EditorLanguage;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  /** Fill the height of the parent (which must be a flex column). */
  fill?: boolean;
  onChange?: (value: string) => void;
}

const extensionFor = (language: EditorLanguage) => (language === 'json' ? json() : language === 'xml' ? xml() : []);

export function createEditor(opts: EditorOptions = {}): Editor {
  const host = document.createElement('div');
  host.className = opts.fill ? 'rtc-editor rtc-fill' : 'rtc-editor';
  const languageSlot = new Compartment();
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: opts.value ?? '',
      extensions: [
        basicSetup,
        languageSlot.of(extensionFor(opts.language ?? 'text')),
        EditorState.readOnly.of(Boolean(opts.readOnly)),
        EditorView.editable.of(!opts.readOnly),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { ...(opts.fill ? { height: '100%' } : {}), fontSize: '0.82rem', border: '1px solid var(--bs-border-color)', borderRadius: '0.5rem', backgroundColor: 'var(--bs-body-bg)' },
          '.cm-scroller': { fontFamily: 'var(--bs-font-monospace)', overflow: 'auto', maxHeight: opts.maxHeight ?? '28rem' },
          '.cm-content': { minHeight: opts.minHeight ?? '8rem' },
          '&.cm-focused': { outline: '2px solid var(--rtc-accent)' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) opts.onChange?.(update.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    el: host,
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    setLanguage(language) {
      view.dispatch({ effects: languageSlot.reconfigure(extensionFor(language)) });
    },
    destroy: () => view.destroy(),
  };
}
