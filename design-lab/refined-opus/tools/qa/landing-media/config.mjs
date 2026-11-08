import {resolve} from 'node:path';
export const root = process.env.LANDING_QA_URL || 'http://127.0.0.1:8720/design-lab/refined-opus/landing/site/';
if (!process.env.MEDIA_QA_OUT) throw Error('Run node tools/qa/landing-media-gate.mjs, not an individual suite without an output directory');
export const out = resolve(process.env.MEDIA_QA_OUT);
export function target(query = '', hash = '') {
  const url = new URL(root);
  url.search = query;
  url.hash = hash;
  return url.href;
}
