// observe.ts — crash reporting + health, so a prod 500 pages YOU, not a user.
//
// Before this, a server error did two wrong things: it dumped the raw stack
// trace into the browser (ugly, and it leaks internals), and it told no one. For
// a product with real users you want the opposite: the user sees a calm page,
// and the error lands somewhere you'll see it.
//
// Provider-agnostic and env-gated, matching the Discord/Slack webhook pattern
// already in the app. Set ONE of:
//   HORDA_ERROR_WEBHOOK  — any URL; we POST a compact JSON error. Works with a
//                          Slack/Discord incoming webhook or your own endpoint.
//   SENTRY_DSN           — if you prefer Sentry; we POST to its store API.
// Neither set → errors are logged to stderr only (Render captures those logs).
// Reporting is best-effort and never throws: a down sink must not break the app.

// Read env at call-time, not module-load: the sink can be configured after this
// module is first imported, and capturing it once would silently miss it.
const webhook = () => (process.env.HORDA_ERROR_WEBHOOK || '').trim();
const sentryDsn = () => (process.env.SENTRY_DSN || '').trim();
const release = () => (process.env.HORDA_RELEASE || 'dev').trim();

// De-dupe a hot loop: don't fire the same error signature more than once every 60s.
const lastSeen = new Map<string, number>();
function throttled(sig: string): boolean {
  const now = Date.now();
  const prev = lastSeen.get(sig) ?? 0;
  if (now - prev < 60_000) return true;
  lastSeen.set(sig, now);
  if (lastSeen.size > 500) lastSeen.clear();  // bound memory
  return false;
}

export interface ErrContext { where?: string; method?: string; path?: string; }

/** Report an error to the configured sink. Best-effort; never throws. */
export function reportError(err: unknown, ctx: ErrContext = {}): void {
  const e = err as any;
  const message = String(e?.message ?? e ?? 'unknown error');
  const stack = String(e?.stack ?? '');
  const sig = `${ctx.where || ''}:${message.slice(0, 120)}`;
  // Always log — Render/stdout is the zero-config floor.
  console.error(`[error]${ctx.where ? ' ' + ctx.where : ''}${ctx.path ? ' ' + ctx.method + ' ' + ctx.path : ''}:`, e);
  if (throttled(sig)) return;

  const WEBHOOK = webhook(), SENTRY_DSN = sentryDsn(), RELEASE = release();
  try {
    if (WEBHOOK) {
      const text = `🔴 Horda error (${RELEASE})\n${ctx.method || ''} ${ctx.path || ctx.where || ''}\n${message}\n\`\`\`${stack.slice(0, 1500)}\`\`\``;
      void fetch(WEBHOOK, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        // `content` suits Discord/Slack; a custom endpoint can read `message`+`stack`.
        body: JSON.stringify({ content: text, text, message, stack, release: RELEASE, ...ctx }),
      }).catch(() => {});
    } else if (SENTRY_DSN) {
      void sendSentry(message, stack, ctx).catch(() => {});
    }
  } catch { /* a reporter that throws is worse than one that's silent */ }
}

// Minimal Sentry envelope POST — avoids pulling the SDK into a zero-dep app.
async function sendSentry(message: string, stack: string, ctx: ErrContext): Promise<void> {
  // dsn: https://<key>@<host>/<project>
  const SENTRY_DSN = sentryDsn(), RELEASE = release();
  const m = SENTRY_DSN.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return;
  const [, key, host, project] = m;
  const url = `https://${host}/api/${project}/store/?sentry_key=${key}&sentry_version=7`;
  await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message, release: RELEASE, level: 'error',
      tags: { where: ctx.where || 'request' },
      extra: { path: ctx.path, method: ctx.method, stack: stack.slice(0, 4000) },
    }),
  }).catch(() => {});
}

/** A calm, on-brand 500 page — never a raw stack trace in front of a user. */
export function errorPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Something went wrong — Horda</title>
  <style>body{margin:0;background:#151312;color:#EDE9DF;font-family:Inter,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
  .box{max-width:420px;padding:24px}h1{font-size:22px;font-weight:900;letter-spacing:-.01em;margin:0 0 8px}p{color:#a49e97;line-height:1.55;margin:0 0 18px}
  a{display:inline-block;background:#E15A40;color:#fff;text-decoration:none;border-radius:10px;padding:11px 18px;font-weight:800}</style></head>
  <body><div class="box"><h1>That one's on us.</h1><p>Something broke while loading this page. We've been notified. Try again, or head back home.</p><a href="/">Back to Horda</a></div></body></html>`;
}

/**
 * Health check that actually means something. `/` can render even when the DB is
 * degraded (demo fallback), which is how "migrations never applied" once hid in
 * plain sight. This probes: DB reachable, AND the latest migration's table is
 * present. Returns { ok, db, migrated } and a 200/503 to match — so Render fails
 * a bad deploy instead of routing users to it.
 */
export async function healthReport(db: { query: (s: string, p?: any[]) => Promise<{ rows: any[] }> }): Promise<{ ok: boolean; body: string }> {
  let dbOk = false, migrated = false;
  try {
    await db.query('SELECT 1');
    dbOk = true;
    // rights_grant is the newest migration (0044) — its presence proves the
    // migration runner reached HEAD on this database.
    const r = await db.query(`SELECT to_regclass('public.rights_grant')::text x`);
    migrated = r.rows[0]?.x != null;
  } catch { /* dbOk stays false */ }
  const ok = dbOk && migrated;
  const body = JSON.stringify({ ok, db: dbOk, migrated, release: release(), at: new Date().toISOString() });
  return { ok, body };
}
