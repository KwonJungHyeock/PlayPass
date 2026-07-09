// Reset the runtime database (db.json) from the immutable seed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const seed = readFileSync(join(here, 'seed.json'), 'utf8');
writeFileSync(join(here, 'db.json'), seed);
console.log('✔ data/db.json 을 seed.json 기준으로 초기화했습니다.');
