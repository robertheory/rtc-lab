import { describe, expect, it } from 'vitest';
import { isoToLocalInput, localInputToIso } from './datetime';
import { fieldErrorsFrom, pointerToPath } from './pointer';
import { getPref, setPref } from '../services/uiPrefs';

describe('datetime-local conversion', () => {
  it('converts ISO with offset to the local input value', () => {
    expect(isoToLocalInput('2027-03-10T10:00:00-03:00')).toBe('2027-03-10T10:00');
    expect(isoToLocalInput(undefined)).toBe('');
  });
  it('uses -03:00 for new values and preserves the previous offset when unchanged', () => {
    expect(localInputToIso('2027-03-10T10:00')).toBe('2027-03-10T10:00:00-03:00');
    expect(localInputToIso('2027-03-10T10:00', '2027-03-10T10:00:30+01:00')).toBe('2027-03-10T10:00:30+01:00');
    expect(localInputToIso('2027-03-10T11:00', '2027-03-10T10:00:30+01:00')).toBe('2027-03-10T11:00:00+01:00');
    expect(localInputToIso('')).toBe('');
  });
});

describe('engine error pointers', () => {
  it('maps RFC 6901 pointers to payload paths', () => {
    expect(pointerToPath('#/itens/3/ncm')).toBe('itens.3.ncm');
    expect(pointerToPath('#/a~1b/c')).toBe('a/b.c');
    expect(pointerToPath('/x')).toBeNull();
    expect(pointerToPath(undefined)).toBeNull();
  });
  it('collects field errors from observability and problem bodies', () => {
    const errs = fieldErrorsFrom({ objetos: [{ erros: [{ code: 'REG-011', title: 'NCM não vinculada', pointer: '#/itens/3/ncm' }, { code: 'X' }] }], errors: [{ pointer: '#/data', detail: 'inválida' }] });
    expect(errs.map((e) => e.path)).toEqual(['itens.3.ncm', 'data']);
    expect(errs[0].message).toContain('NCM não vinculada');
  });
});

describe('uiPrefs', () => {
  it('falls back when storage is unavailable', () => {
    expect(getPref('x', 5)).toBe(5);
    expect(() => setPref('x', 1)).not.toThrow();
  });
});
