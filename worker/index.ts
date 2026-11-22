/**
 * The only server code idle.beer has: POST /api/event files anonymous play statistics in
 * Workers Analytics Engine. Every other address is a static file and never reaches this.
 *
 * One row per moment. The columns (the order is the schema; see DESIGN.md "Play statistics"):
 *   index1   player id (random, per browser)
 *   blob1    event      blob2 label     blob3 language   blob4 device
 *   blob5    country    blob6 referring site
 *   double1  the event's own value
 *   double2… the game's progress, in the order of progress() in src/core/telemetry.ts
 */

interface Dataset {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}
interface Env {
  EVENTS?: Dataset;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const MAX_BODY = 32 * 1024;
const MAX_EVENTS = 50;
const MAX_NUMBERS = 19;

/** A short, plain token: anything else in a name is dropped rather than stored. */
const word = (value: unknown, max = 48): string =>
  (typeof value === 'string' ? value : '').replace(/[^\w.:-]/g, '').slice(0, max);
const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/event') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });

    // Only the game's own pages report here.
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return new Response(null, { status: 403 });

    const text = await request.text();
    if (text.length > MAX_BODY) return new Response(null, { status: 413 });
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return new Response(null, { status: 400 });
    }
    const player = word(body?.p, 32);
    if (!player || !Array.isArray(body.events)) return new Response(null, { status: 400 });

    const language = word(body.g, 8);
    const device = word(body.d, 12);
    const referrer = word(body.r, 64);
    const country = word((request as Request & { cf?: { country?: string } }).cf?.country, 2);

    for (const item of body.events.slice(0, MAX_EVENTS) as Record<string, unknown>[]) {
      const event = word(item?.e, 32);
      if (!event) continue;
      const progress = Array.isArray(item.c) ? item.c.slice(0, MAX_NUMBERS).map(number) : [];
      env.EVENTS?.writeDataPoint({
        indexes: [player],
        blobs: [event, word(item.l), language, device, country, referrer],
        doubles: [number(item.n), ...progress],
      });
    }
    return new Response(null, { status: 204 });
  },
};
