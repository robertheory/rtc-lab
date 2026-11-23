import type { EngineId, EngineRequest, EngineResponse, Manifest, Scenario } from '../types';
import { recordHistory } from './history';
import { send } from './http';
import { buildRequest, loadPayload } from './scenarios';

/** Sends a request and records it in the local history. */
export async function runAndRecord(
  engine: EngineId | 'playground',
  request: EngineRequest,
  meta?: { scenarioId?: string; scenarioName?: string },
): Promise<EngineResponse> {
  const response = await send(request);
  recordHistory({ engine, request, response, ...meta });
  return response;
}

export async function runScenario(
  engine: EngineId,
  manifest: Manifest,
  scenario: Scenario,
  payloadOverride?: string,
): Promise<{ request: EngineRequest; response: EngineResponse }> {
  const payload = payloadOverride ?? (await loadPayload(engine, scenario));
  const request = buildRequest(manifest, scenario, payload);
  const response = await runAndRecord(engine, request, { scenarioId: scenario.id, scenarioName: scenario.name });
  return { request, response };
}
