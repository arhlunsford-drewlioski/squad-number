// Records the golden fixtures: `npx tsx scripts/golden.ts`. Commit the result only when an engine change is meant.
import { writeFileSync } from 'node:fs';
import { allFixtures } from './golden-lib';

const t0 = Date.now();
writeFileSync(new URL('../fixtures/golden.json', import.meta.url), JSON.stringify(allFixtures(), null, 1) + '\n');
console.log(`wrote fixtures/golden.json in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
