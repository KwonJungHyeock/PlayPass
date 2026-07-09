// Tiny JSON-file backed data store. No external dependencies.
// The runtime database lives at data/db.json (gitignored). It is created
// from data/seed.json on first run so the seed stays pristine.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const dbPath = join(dataDir, 'db.json');
const seedPath = join(dataDir, 'seed.json');

function load() {
  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, readFileSync(seedPath, 'utf8'));
  }
  return JSON.parse(readFileSync(dbPath, 'utf8'));
}

let state = load();

function persist() {
  writeFileSync(dbPath, JSON.stringify(state, null, 2));
}

export const db = {
  get all() {
    return state;
  },
  facilities: () => state.facilities,
  facility: (id) => state.facilities.find((f) => f.id === id),
  promotions: () => state.promotions,
  reservations: () => state.reservations,
  passes: () => state.passes,
  // mutate + persist in one shot
  update(mutator) {
    mutator(state);
    persist();
    return state;
  },
  reset() {
    state = JSON.parse(readFileSync(seedPath, 'utf8'));
    persist();
    return state;
  },
};

// Generate a short unique-ish id without external deps.
let counter = 0;
export function makeId(prefix) {
  counter += 1;
  const stamp = process.hrtime.bigint().toString(36).slice(-6);
  return `${prefix}-${stamp}${counter}`;
}
