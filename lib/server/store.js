import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = path.join(process.cwd(), 'data', 'crisis-twin.json');
const createEmptyStore = () => ({
  portfolios: [{ id: 'default', name: 'My Portfolio', user_id: 'user_default', cash_balance: 0 }],
  holdings: [],
  paper_trades: [],
  profiles: [],
  runs: [],
  agent_logs: [],
  drill_results: [],
  assistant_logs: [],
});

export function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    // Backfill new collections without replacing an existing user's saved data.
    const defaults = createEmptyStore();
    for (const key of Object.keys(defaults)) {
      if (!Array.isArray(parsed[key])) parsed[key] = defaults[key];
    }
    if (!Array.isArray(parsed.portfolios) || !parsed.portfolios.some((p) => p.id === 'default')) {
      parsed.portfolios = defaults.portfolios;
    }
    return parsed;
  } catch {
    const empty = createEmptyStore();
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    writeStore(empty);
    return structuredClone(empty);
  }
}

export function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

export function mutateStore(fn) {
  const db = readStore();
  const result = fn(db);
  writeStore(db);
  return result;
}

export function now() {
  return new Date().toISOString();
}
