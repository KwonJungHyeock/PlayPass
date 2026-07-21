// Tiny JSON-file backed data store. No external dependencies.
//
// Runtime behaviour:
//  - Local (`node server.js`): state persists to data/db.json (gitignored),
//    seeded from data/seed.json on first run.
//  - Serverless (Vercel): the filesystem is read-only, so writes are best-effort.
//    State lives in memory for the life of the warm function instance and is
//    re-seeded from data/seed.json on each cold start. Perfect for a demo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const dbPath = join(dataDir, 'db.json');
const seedPath = join(dataDir, 'seed.json');

let canPersist = true;

function readSeed() {
  return JSON.parse(readFileSync(seedPath, 'utf8'));
}

function load() {
  // Prefer an existing writable db.json (local dev); otherwise seed in memory.
  try {
    if (existsSync(dbPath)) return JSON.parse(readFileSync(dbPath, 'utf8'));
  } catch {
    /* fall through to seed */
  }
  const seed = readSeed();
  // Try to materialise db.json for local persistence; ignore on read-only FS.
  try {
    writeFileSync(dbPath, JSON.stringify(seed, null, 2));
  } catch {
    canPersist = false;
  }
  return seed;
}

let state = load();

function persist() {
  if (!canPersist) return; // serverless / read-only — keep in memory only
  try {
    writeFileSync(dbPath, JSON.stringify(state, null, 2));
  } catch {
    canPersist = false;
  }
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
    state = readSeed();
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
