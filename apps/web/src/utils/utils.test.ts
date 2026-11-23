import { describe, expect, it } from 'vitest';
import { buildCurl } from './curl';
import { diffJson } from './diff';
import { byteLength, validateJsonText, validateXmlFile, validateXmlText } from './files';
import { getPath, setPath } from './path';

describe('buildCurl', () => {
  it('builds a command with headers and an escaped body', () => {
    const cmd = buildCurl({ method: 'post', url: '/api/x', headers: { 'Content-Type': 'application/json' }, body: `{"a":"it's"}`, origin: 'http://localhost' });
    expect(cmd).toBe(`curl -X POST 'http://localhost/api/x' -H 'Content-Type: application/json' --data-binary '{"a":"it'\\''s"}'`);
  });
  it('uses a file reference for very large bodies and skips GET bodies', () => {
    expect(buildCurl({ method: 'POST', url: '/a', body: 'x'.repeat(5000), origin: 'http://h' })).toContain(`'@payload'`);
    expect(buildCurl({ method: 'GET', url: '/a', body: 'ignored', origin: 'http://h' })).not.toContain('--data-binary');
  });
});

describe('diffJson', () => {
  it('reports changed, added and removed paths without computing anything', () => {
    const d = diffJson({ a: 1, b: { c: '1' }, l: [1, 2], gone: true }, { a: 2, b: { c: '1' }, l: [1], added: 1 });
    expect(d).toEqual([
      { path: 'a', kind: 'changed', a: 1, b: 2 },
      { path: 'l[1]', kind: 'removed', a: 2 },
      { path: 'gone', kind: 'removed', a: true },
      { path: 'added', kind: 'added', b: 1 },
    ]);
  });
  it('is empty for equal values', () => expect(diffJson({ x: [1, { y: 2 }] }, { x: [1, { y: 2 }] })).toEqual([]));
});

describe('file validation', () => {
  it('rejects wrong extension, empty and oversized files', () => {
    expect(validateXmlFile({ name: 'a.pdf', size: 10 })).toMatch(/\.xml/);
    expect(validateXmlFile({ name: 'a.xml', size: 0 })).toMatch(/vazio/);
    expect(validateXmlFile({ name: 'a.xml', size: 6 * 1024 * 1024 })).toMatch(/limite/);
    expect(validateXmlFile({ name: 'A.XML', size: 100 })).toBeNull();
  });
  it('validates text size and JSON syntax', () => {
    expect(validateXmlText('')).toMatch(/Informe/);
    expect(validateXmlText('<a/>')).toBeNull();
    expect(validateJsonText('{')).toMatch(/inválido/);
    expect(validateJsonText('{"a":1}')).toBeNull();
    expect(byteLength('é')).toBe(2);
  });
});

describe('path helpers', () => {
  it('sets nested values and prunes empty parents on removal', () => {
    const o: Record<string, unknown> = {};
    setPath(o, 'a.b.c', 1);
    expect(getPath(o, 'a.b.c')).toBe(1);
    setPath(o, 'a.b.c', undefined);
    expect(o).toEqual({});
  });
});
