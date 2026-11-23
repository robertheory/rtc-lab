/**
 * RFC 6901 JSON pointer (as sent by the engines, e.g. "#/itens/3/ncm") -> dotted payload path
 * ("itens.3.ncm"). Returns null for anything that is not a field pointer.
 */
export function pointerToPath(pointer: string | undefined): string | null {
  if (!pointer || !pointer.startsWith('#/')) return null;
  const parts = pointer.slice(2).split('/').map((p) => decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~'));
  return parts.length > 0 && parts.every((p) => p !== '') ? parts.join('.') : null;
}

export interface EngineFieldError {
  path: string;
  message: string;
  code?: string;
}

interface RawError {
  code?: string;
  title?: string;
  detail?: string;
  pointer?: string;
}

/** Collects field-level errors from an observability or problem+json response body. */
export function fieldErrorsFrom(body: unknown): EngineFieldError[] {
  const out: EngineFieldError[] = [];
  const b = body as { objetos?: { erros?: RawError[] }[]; errors?: RawError[] } | undefined;
  const raw: RawError[] = [...(b?.objetos?.flatMap((o) => o.erros ?? []) ?? []), ...(b?.errors ?? [])];
  for (const e of raw) {
    const path = pointerToPath(e.pointer);
    if (path) out.push({ path, code: e.code, message: [e.title, e.detail].filter(Boolean).join(': ') || e.code || 'Erro informado pelo motor.' });
  }
  return out;
}
