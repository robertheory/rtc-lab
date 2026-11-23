export interface CurlInput {
  method: string;
  /** Path (or absolute URL). A path is resolved against `origin`. */
  url: string;
  headers?: Record<string, string>;
  body?: string;
  origin?: string;
}

const INLINE_BODY_LIMIT = 4000;

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Builds the curl command equivalent to a request sent through the public origin. */
export function buildCurl(input: CurlInput): string {
  const origin = input.origin ?? (typeof location !== 'undefined' ? location.origin : 'http://localhost');
  const url = /^https?:\/\//.test(input.url) ? input.url : `${origin}${input.url}`;
  const parts = ['curl', '-X', input.method.toUpperCase(), quote(url)];
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    parts.push('-H', quote(`${name}: ${value}`));
  }
  const body = input.body;
  if (body && input.method.toUpperCase() !== 'GET') {
    if (body.length > INLINE_BODY_LIMIT) {
      parts.push('--data-binary', quote('@payload'));
    } else {
      parts.push('--data-binary', quote(body));
    }
  }
  return parts.join(' ');
}
