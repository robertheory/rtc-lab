export type EngineId = 'regular' | 'simples' | 'danfse';

export interface EngineRequest {
  method: string;
  /** Absolute path on the single public origin, e.g. /api/regular/calculadora/versao. */
  url: string;
  headers?: Record<string, string>;
  body?: string | Blob;
  timeoutMs?: number;
  /** Lets the caller cancel the request. */
  signal?: AbortSignal;
  responseType?: 'text' | 'blob';
}

export interface EngineResponse {
  /** True only when an HTTP response was received (any status). */
  received: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string;
  /** Raw body exactly as sent by the engine (text responses). */
  text?: string;
  blob?: Blob;
  durationMs: number;
  error?: { kind: 'timeout' | 'network' | 'cancelled'; message: string };
}

export interface ScenarioSource {
  repository: string;
  tag: string;
  path: string;
  note?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  method: string;
  endpoint: string;
  contentType: string;
  payload: string;
  query?: Record<string, string>;
  explanation: string;
  expected: {
    status: number;
    contentType?: string;
    estadoItens?: string[];
    summary: string;
  };
  source: ScenarioSource;
}

export interface Manifest {
  engine: EngineId;
  basePath: string;
  scenarios: Scenario[];
}

export interface HistoryEntry {
  id: string;
  at: string;
  engine: EngineId | 'playground';
  scenarioId?: string;
  scenarioName?: string;
  method: string;
  url: string;
  contentType: string;
  payload?: string;
  payloadOmitted?: boolean;
  status: number;
  durationMs: number;
  result?: string;
  resultOmitted?: boolean;
  resultTruncated?: boolean;
  error?: string;
}
