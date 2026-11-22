/**
 * Play statistics from Cloudflare's Analytics Engine, printed as tables.
 *
 *   CF_ACCOUNT_ID=… CF_API_TOKEN=… npm run stats -- [days]
 *
 * The token needs the "Account Analytics: Read" permission. Columns are described at the top of
 * worker/index.ts; the numbers after double1 follow progress() in src/core/telemetry.ts.
 */
const { CF_ACCOUNT_ID, CF_API_TOKEN } = process.env;
const days = Math.max(1, Number(process.argv[2]) || 7);
const DATASET = 'idle_beer_events';

if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error('Set CF_ACCOUNT_ID and CF_API_TOKEN (Account Analytics: Read) first.');
  process.exit(1);
}

type Row = Record<string, string | number>;

async function query(sql: string): Promise<Row[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${CF_API_TOKEN}` },
    body: `${sql} FORMAT JSON`,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return ((await res.json()) as { data: Row[] }).data;
}

const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
const median = (list: number[]) => {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const time = (seconds: number) => (seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} h` : `${Math.round(seconds / 60)} min`);
const section = (title: string, rows: unknown[]) => {
  console.log(`\n${title}`);
  if (rows.length) console.table(rows);
  else console.log('  (nothing yet)');
};

// One row per player per event: enough to count players and take medians here, without
// leaning on SQL the Analytics Engine may not have.
const perPlayer = await query(
  `SELECT index1 AS player, blob1 AS event, blob2 AS label, min(double2) AS play_seconds, count() AS times
   FROM ${DATASET} WHERE ${since} AND blob1 NOT IN ('heartbeat', 'session_end', 'achievement', 'free_round')
   GROUP BY player, event, label LIMIT 100000`,
);
const group = (rows: Row[], key: (r: Row) => string) => {
  const out = new Map<string, Row[]>();
  for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), r]);
  return out;
};
const players = (rows: Row[]) => new Set(rows.map((r) => r.player)).size;

const everyone = players(perPlayer.filter((r) => r.event === 'load')) || 1;
const funnel = ['load', 'start', 'first_drink', 'first_drinker', 'last_orders'].map((event) => {
  const n = players(perPlayer.filter((r) => r.event === event));
  return { step: event, players: n, 'of visitors': `${Math.round((n / everyone) * 100)}%` };
});
section(`How far people get (last ${days} days)`, funnel);

for (const event of ['pub', 'beer']) {
  const rows = [...group(perPlayer.filter((r) => r.event === event), (r) => String(r.label))].map(([label, list]) => ({
    [event]: label,
    players: players(list),
    'median play time to reach': time(median(list.map((r) => Number(r.play_seconds)))),
  }));
  section(`Players reaching each ${event}`, rows.sort((a, b) => Number(b.players) - Number(a.players)));
}

// The longest any report said a visit had lasted is how long the visit was.
const sessions = await query(
  `SELECT index1 AS player, double4 AS session, max(double3) AS seconds, max(double2) AS play_seconds
   FROM ${DATASET} WHERE ${since} GROUP BY player, session LIMIT 100000`,
);
const lengths = sessions.map((r) => Number(r.seconds));
const byPlayer = group(sessions, (r) => String(r.player));
section('How long people play', [{
  players: byPlayer.size,
  visits: sessions.length,
  'median visit': time(median(lengths)),
  'visits over 10 min': `${Math.round((lengths.filter((s) => s >= 600).length / (lengths.length || 1)) * 100)}%`,
  'came back for a second visit': `${Math.round(([...byPlayer.values()].filter((v) => v.length > 1).length / (byPlayer.size || 1)) * 100)}%`,
  'median total play time': time(median([...byPlayer.values()].map((v) => Math.max(...v.map((r) => Number(r.play_seconds)))))),
}]);

for (const [title, column] of [['Language', 'blob3'], ['Device', 'blob4'], ['Country', 'blob5'], ['Came from', 'blob6']]) {
  const rows = await query(
    `SELECT ${column} AS value, index1 AS player FROM ${DATASET} WHERE ${since} AND blob1 = 'load' GROUP BY value, player LIMIT 100000`,
  );
  const table = [...group(rows, (r) => String(r.value || '(direct)'))].map(([value, list]) => ({ [title.toLowerCase()]: value, players: list.length }));
  section(title, table.sort((a, b) => b.players - a.players).slice(0, 15));
}
export {};
