// Runs SQL in the browser with DuckDB-WASM over the site's Parquet tables (fetched with HTTP range
// requests, so only the columns and row groups a query needs are downloaded).
import { safeSql } from '../../worker/src/safe.js';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

export const TABLES = ['competitions', 'matches', 'innings', 'deliveries', 'batting', 'bowling', 'players', 'careers', 'history_matches', 'history_innings', 'history_performances'];

// 'csv' is only for local testing where the Parquet extension can't be downloaded.
const FORMAT = import.meta.env.VITE_DB_FORMAT === 'csv' ? 'csv' : 'parquet';

let connPromise = null;

// The Parquet reader is a DuckDB extension. The deploy copies it onto this site (duckdb-ext/);
// if that copy is missing, DuckDB fetches it from extensions.duckdb.org instead.
async function loadParquet(conn, site) {
  try {
    await conn.query(`SET custom_extension_repository = '${site}duckdb-ext'`);
    await conn.query('LOAD parquet');
  } catch {
    await conn.query('RESET custom_extension_repository');
    await conn.query('LOAD parquet');
  }
}

// The engine files are served from this site (no third-party CDN).
async function start(duckdb) {
  const bundle = await duckdb.selectBundle({ mvp: { mainModule: mvpWasm, mainWorker: mvpWorker }, eh: { mainModule: ehWasm, mainWorker: ehWorker } });
  const worker = new Worker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true } });
  return db;
}

export function getConnection() {
  if (!connPromise) {
    connPromise = (async () => {
      const duckdb = await import('@duckdb/duckdb-wasm');
      const db = await start(duckdb);
      const conn = await db.connect();
      const site = new URL(import.meta.env.BASE_URL, location.href).href;
      if (FORMAT === 'parquet') await loadParquet(conn, site);
      const read = FORMAT === 'csv' ? 'read_csv_auto' : 'read_parquet';
      for (const t of TABLES) await conn.query(`CREATE VIEW ${t} AS SELECT * FROM ${read}('${site}db/${t}.${FORMAT}')`);
      return conn;
    })();
    connPromise.catch(() => { connPromise = null; });
  }
  return connPromise;
}

function plain(v) {
  if (v == null) return null;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && typeof v.valueOf === 'function') {
    const p = v.valueOf();
    if (typeof p === 'number' || typeof p === 'bigint') return Number(p);
  }
  return v;
}

// Arrow column types -> display hints
function kindOf(field) {
  const t = String(field.type);
  if (/^Date/i.test(t)) return 'date';
  if (/Timestamp/i.test(t)) return 'date';
  if (/Int|Float|Decimal|Double/i.test(t)) return 'number';
  return 'text';
}

export async function runQuery(sql, maxRows = 200) {
  const safe = safeSql(sql);
  if (!safe) throw new Error('Only read-only SELECT queries can be run.');
  const conn = await getConnection();
  const res = await conn.query(`SELECT * FROM (${safe}) AS q LIMIT ${maxRows}`);
  const fields = res.schema.fields;
  const columns = fields.map((f) => f.name);
  const kinds = fields.map(kindOf);
  const rows = res.toArray().map((r) => {
    const o = r.toJSON();
    return columns.map((c, i) => {
      const v = plain(o[c]);
      if (kinds[i] === 'date' && typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
      return v;
    });
  });
  return { columns, kinds, rows };
}
