import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_XML = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/web/public/scenarios/danfse/payloads');
