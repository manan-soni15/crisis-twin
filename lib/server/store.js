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

const IS_VERCEL = process.env.VERCEL === '1';
const DEMO_CACHE_KEY = '__CRISIS_TWIN_DEMO_STORE__';

// Temporary demo fallback only: Vercel serverless memory is not durable or shared
// between instances. Use a database for reliable multi-user/persistent deployment.
export function readStore() {
  if (IS_VERCEL && globalThis[DEMO_CACHE_KEY]) {
    return structuredClone(globalThis[DEMO_CACHE_KEY]);
  }
  let raw;
  try {
    raw = fs.readFileSync(STORE_PATH, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const empty = createEmptyStore();
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    writeStore(empty);
    return structuredClone(empty);
  }

  // A malformed existing file is a data-recovery problem, not a reason to overwrite it.
  // Throwing preserves the original bytes so operators can restore/recover the data.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`The Crisis Twin data store at ${STORE_PATH} is not valid JSON. It was not overwritten. Restore a backup or repair the file before retrying. (${error.message})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`The Crisis Twin data store at ${STORE_PATH} has an invalid top-level shape. It was not overwritten.`);
  }

  const defaults = createEmptyStore();
  for (const key of Object.keys(defaults)) {
    if (!Array.isArray(parsed[key])) parsed[key] = defaults[key];
  }
  if (!parsed.portfolios.some((portfolio) => portfolio?.id === 'default')) {
    parsed.portfolios.push(defaults.portfolios[0]);
  }
  if (IS_VERCEL) globalThis[DEMO_CACHE_KEY] = structuredClone(parsed);
  return parsed;
}

export function writeStore(data) {
  if (IS_VERCEL) {
    // Avoid failing on Vercel's read-only deployment filesystem.
    // This survives only while this particular serverless instance stays warm.
    globalThis[DEMO_CACHE_KEY] = structuredClone(data);
    return;
  }
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(tmp, STORE_PATH);
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
  }
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
