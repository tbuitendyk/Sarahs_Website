// Visitor counts for the admin's Visitors section, kept in a free Cloudflare D1 database bound as STATS.
// Without that binding nothing is counted and the website works as normal (see SETUP.md, step 9).
//
// Table "hits": one row per (UTC hour, kind, item) with a count n.
//   view      item = page address, e.g. /about.html     every page shown to a person
//   visitor   item = ""                                  a person's first page that day
//   country   item = two-letter country code             counted once per visitor a day
//   ref       item = the other website that linked here  e.g. google.com
//   download  item = file address, e.g. /files/x.pdf
//   unlock    item = ""                                  subscriber password entered correctly
// Table "seen": (UTC day, visitor code), so a person counts once a day. Rows older than 2 days are deleted.
//
// The visitor code scrambles the internet address and browser name with a secret that changes every day.
// It can't be turned back into an address and can't follow anyone from one day to the next. No cookies.
// Counting runs after the page has been sent (waitUntil) and never stops a page from working.

const enc = new TextEncoder();
const BOTS = /bot\b|bot\/|crawl|spider|slurp|archiver|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skypeuri|headless|phantomjs|lighthouse|pingdom|uptime|monitor|python|curl|wget|httpclient|okhttp|java\/|go-http|node-fetch|axios|libwww|scrapy|feedfetcher|validator/i;
const BUMP = "INSERT INTO hits (hour, kind, item, n) VALUES (?, ?, ?, 1) ON CONFLICT (hour, kind, item) DO UPDATE SET n = n + 1";

let ready = null;
function setup(db) {
  if (!ready) {
    ready = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS hits (hour TEXT NOT NULL, kind TEXT NOT NULL, item TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (hour, kind, item)) WITHOUT ROWID"),
      db.prepare("CREATE TABLE IF NOT EXISTS seen (day TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (day, id)) WITHOUT ROWID"),
    ]).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

export const enabled = (env) => Boolean(env.STATS);
const hourOf = (d) => d.toISOString().slice(0, 13); // "2026-11-21T20" (UTC)
const dayOf = (d) => d.toISOString().slice(0, 10);

// A person in a browser, not a search engine or link preview, and not Sarah while she's logged in to the admin.
function isPerson(request) {
  if (request.method !== "GET") return false;
  const ua = request.headers.get("user-agent") || "";
  if (ua.length < 20 || BOTS.test(ua)) return false;
  if (/(?:^|;\s*)__Host-sb_admin=/.test(request.headers.get("cookie") || "")) return false;
  return true;
}

async function visitorCode(request, env, day) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const ua = request.headers.get("user-agent") || "";
  const key = await crypto.subtle.importKey("raw", enc.encode(`visitors:${day}:${env.ADMIN_PASSWORD || "sarahs-books"}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${ip}\n${ua}`)));
  return [...sig.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The other website a visitor came from (just its name), or "" for this site, bookmarks, e-mails and apps.
function referrerSite(request) {
  const ref = request.headers.get("referer");
  if (!ref) return "";
  try {
    const r = new URL(ref);
    const here = new URL(request.url).hostname.replace(/^www\./, "");
    if (r.protocol !== "https:" && r.protocol !== "http:") return "";
    const host = r.hostname.replace(/^www\./, "").toLowerCase();
    return host && host !== here ? host.slice(0, 100) : "";
  } catch {
    return "";
  }
}

function country(request) {
  const cc = String(request.cf?.country || request.headers.get("cf-ipcountry") || "").toUpperCase();
  return /^[A-Z]{2}$/.test(cc) && cc !== "XX" && cc !== "T1" ? cc : "";
}

async function bumpAll(env, stmtsFor) {
  const db = env.STATS;
  try {
    await setup(db);
    const now = new Date();
    const bump = (kind, item) => db.prepare(BUMP).bind(hourOf(now), kind, String(item).slice(0, 200));
    const stmts = await stmtsFor(db, bump, now);
    if (stmts.length) await db.batch(stmts);
  } catch (err) {
    console.error("Visitor count failed:", err?.message || err);
  }
}

export function trackView(request, env, path) {
  if (!env.STATS || !isPerson(request)) return Promise.resolve();
  return bumpAll(env, async (db, bump, now) => {
    const day = dayOf(now);
    const stmts = [bump("view", path === "/index.html" ? "/" : path)];
    const first = await db.prepare("INSERT OR IGNORE INTO seen (day, id) VALUES (?, ?)").bind(day, await visitorCode(request, env, day)).run();
    if (first?.meta?.changes) {
      stmts.push(bump("visitor", ""));
      const cc = country(request);
      if (cc) stmts.push(bump("country", cc));
    }
    const from = referrerSite(request);
    if (from) stmts.push(bump("ref", from));
    if (Math.random() < 0.02) stmts.push(db.prepare("DELETE FROM seen WHERE day < ?").bind(dayOf(new Date(now - 2 * 86400000))));
    return stmts;
  });
}

export function trackDownload(request, env, path) {
  if (!env.STATS || !isPerson(request)) return Promise.resolve();
  const range = request.headers.get("range");
  if (range && !/^bytes=0-/.test(range)) return Promise.resolve(); // the rest of a download already counted
  return bumpAll(env, async (db, bump) => [bump("download", path)]);
}

export function trackUnlock(request, env) {
  if (!env.STATS) return Promise.resolve();
  return bumpAll(env, async (db, bump) => [bump("unlock", "")]);
}

// ---------------------------------------------------------------- for the admin

const HOUR = /^\d{4}-\d{2}-\d{2}T\d{2}$/;

// Totals between two UTC hours ("2026-11-01T06" up to, not including, "2026-12-01T06").
// by "hour" or "day" sets the step of the series; the admin groups it into the viewer's own days or months.
export async function report(env, { from, to, by }) {
  const db = env.STATS;
  if (!db) return { enabled: false };
  if (!HOUR.test(String(from)) || !HOUR.test(String(to))) throw new Error("Unclear date range.");
  await setup(db);
  const t = by === "day" ? "substr(hour, 1, 10)" : "hour";
  const [series, top, first] = await db.batch([
    db.prepare(`SELECT ${t} AS t, kind, SUM(n) AS n FROM hits WHERE hour >= ? AND hour < ? AND kind IN ('view', 'visitor', 'download', 'unlock') GROUP BY t, kind ORDER BY t`).bind(from, to),
    db.prepare("SELECT kind, item, SUM(n) AS n FROM hits WHERE hour >= ? AND hour < ? AND kind IN ('view', 'download', 'ref', 'country') GROUP BY kind, item ORDER BY n DESC").bind(from, to),
    db.prepare("SELECT MIN(hour) AS since FROM hits"),
  ]);
  return {
    enabled: true,
    by: by === "day" ? "day" : "hour",
    series: series.results.map((r) => ({ t: r.t, kind: r.kind, n: Number(r.n) })),
    top: top.results.map((r) => ({ kind: r.kind, item: r.item, n: Number(r.n) })),
    since: first.results[0]?.since || null,
  };
}

// ---------------------------------------------------------------- for backups: one CSV file per month

export async function months(env) {
  const db = env.STATS;
  if (!db) return [];
  await setup(db);
  const { results } = await db.prepare("SELECT DISTINCT substr(hour, 1, 7) AS m FROM hits ORDER BY m").all();
  return results.map((r) => r.m).filter((m) => /^\d{4}-\d{2}$/.test(m));
}

export async function monthCsv(env, month) {
  const db = env.STATS;
  if (!db || !/^\d{4}-\d{2}$/.test(String(month))) return null;
  await setup(db);
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const { results } = await db.prepare("SELECT hour, kind, item, n FROM hits WHERE hour >= ? AND hour < ? ORDER BY hour, kind, item")
    .bind(`${month}-01T00`, `${next}-01T00`).all();
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return "hour_utc,kind,item,count\n" + results.map((r) => [r.hour, r.kind, r.item, r.n].map(cell).join(",")).join("\n") + "\n";
}
