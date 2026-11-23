import { describe, expect, it } from 'vitest';
import type { EngineResponse, HistoryEntry } from '../types';
import { buildEntry, MAX_FIELD_CHARS, trimToBudget } from './history';

const res = (over: Partial<EngineResponse> = {}): EngineResponse => ({ received: true, status: 200, statusText: 'OK', headers: {}, contentType: 'application/json', text: '{"ok":true}', durationMs: 5, ...over });

describe('history entries', () => {
  it('stores JSON payload and result', () => {
    const e = buildEntry({ engine: 'regular', request: { method: 'POST', url: '/api/regular/x', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' }, response: res() });
    expect(e.payload).toBe('{"a":1}');
    expect(e.result).toBe('{"ok":true}');
  });
  it('never stores fiscal XML payloads or PDF results', () => {
    const e = buildEntry({ engine: 'danfse', request: { method: 'POST', url: '/api/danfse', headers: { 'Content-Type': 'application/xml' }, body: '<NFSe/>' }, response: res({ contentType: 'application/pdf', text: undefined, blob: new Blob(['x']) }) });
    expect(e.payload).toBeUndefined();
    expect(e.payloadOmitted).toBe(true);
    expect(e.result).toBeUndefined();
    expect(e.resultOmitted).toBe(true);
  });
  it('truncates huge results and omits huge payloads', () => {
    const big = 'x'.repeat(MAX_FIELD_CHARS + 10);
    const e = buildEntry({ engine: 'regular', request: { method: 'POST', url: '/a', headers: { 'Content-Type': 'application/json' }, body: big }, response: res({ text: big }) });
    expect(e.resultTruncated).toBe(true);
    expect(e.result?.length).toBe(MAX_FIELD_CHARS);
    expect(e.payloadOmitted).toBe(true);
  });
});

describe('trimToBudget', () => {
  const entry = (i: number): HistoryEntry => ({ id: String(i), at: '', engine: 'regular', method: 'GET', url: '/x'.repeat(10), contentType: '', status: 200, durationMs: 1 });
  const list = Array.from({ length: 10 }, (_, i) => entry(i));
  it('caps the entry count keeping the newest', () => expect(trimToBudget(list, 3).map((e) => e.id)).toEqual(['0', '1', '2']));
  it('caps the total size', () => expect(trimToBudget(list, 50, JSON.stringify(list[0]).length * 2 + 5)).toHaveLength(2));
});
