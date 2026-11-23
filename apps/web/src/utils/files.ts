export const DANFSE_MAX_BYTES = 5 * 1024 * 1024;
/** The regular and Simples engines read request bodies up to 500 KB in memory. */
export const JSON_MAX_BYTES = 500 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Returns an error message in Portuguese, or null when the file is acceptable. */
export function validateXmlFile(file: { name: string; size: number }, maxBytes = DANFSE_MAX_BYTES): string | null {
  if (!/\.xml$/i.test(file.name)) return 'O arquivo precisa ter a extensão .xml.';
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > maxBytes) return `O arquivo tem ${formatBytes(file.size)} e o limite é ${formatBytes(maxBytes)}.`;
  return null;
}

export function validateXmlText(text: string, maxBytes = DANFSE_MAX_BYTES): string | null {
  if (text.trim() === '') return 'Informe o XML da NFS-e.';
  const size = byteLength(text);
  if (size > maxBytes) return `O XML tem ${formatBytes(size)} e o limite é ${formatBytes(maxBytes)}.`;
  return null;
}

/** Well-formedness check through the browser parser. Returns null when well-formed. */
export function checkWellFormedXml(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.querySelector('parsererror');
  return err ? 'O XML não está bem formado.' : null;
}

export function validateJsonText(text: string, maxBytes = JSON_MAX_BYTES): string | null {
  if (text.trim() === '') return 'Informe o JSON da requisição.';
  const size = byteLength(text);
  if (size > maxBytes) return `O JSON tem ${formatBytes(size)} e o limite é ${formatBytes(maxBytes)}.`;
  try {
    JSON.parse(text);
  } catch (e) {
    return `JSON inválido: ${e instanceof Error ? e.message : 'erro de sintaxe'}.`;
  }
  return null;
}
