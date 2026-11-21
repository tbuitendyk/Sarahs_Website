// Runs the site on this computer the way Cloudflare Pages runs it, for testing.
//
//   ADMIN_PASSWORD=choose-a-test-password node tools/dev-server.mjs   (or: npm run dev)
//   then open http://localhost:8788 and http://localhost:8788/admin
//
// Saved content and uploads are kept in .dev/kv.json, and visitor counts in .dev/stats.sqlite (not part of the site).
// KV_FILE=memory keeps both in memory only (STATS_FILE=<file> picks the counts file). STATS=off runs without visitor counting, like a site whose
// Cloudflare setup has no STATS database yet. Visitor counting needs Node 22.13 or newer (node:sqlite).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 8788);
const STORE_FILE = process.env.KV_FILE || path.join(ROOT, ".dev", "kv.json");

// ---------------------------------------------------------------- a small stand-in for Cloudflare KV
class LocalKV {
  constructor(file) {
    this.file = file;
    this.map = new Map();
    if (file && fs.existsSync(file)) {
      for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(file, "utf8")))) {
        this.map.set(k, { ...v, value: v.binary ? Buffer.from(v.value, "base64") : v.value });
      }
    }
  }
  persist() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const out = {};
    for (const [k, v] of this.map) out[k] = { ...v, value: v.binary ? Buffer.from(v.value).toString("base64") : v.value };
    fs.writeFileSync(this.file, JSON.stringify(out));
  }
  live(key) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiration && e.expiration < Date.now() / 1000) { this.map.delete(key); return null; }
    return e;
  }
  convert(e, type) {
    if (!e) return null;
    if (type === "arrayBuffer") {
      const b = e.binary ? Buffer.from(e.value) : Buffer.from(String(e.value));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    const s = e.binary ? Buffer.from(e.value).toString("utf8") : e.value;
    return type === "json" ? JSON.parse(s) : s;
  }
  async get(key, opts) { return this.convert(this.live(key), typeof opts === "string" ? opts : opts?.type); }
  async getWithMetadata(key, opts) {
    const e = this.live(key);
    return { value: this.convert(e, typeof opts === "string" ? opts : opts?.type), metadata: e?.metadata ?? null };
  }
  async put(key, value, opts = {}) {
    const binary = typeof value !== "string";
    const v = binary ? Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value) : value;
    const expiration = opts.expirationTtl ? Math.floor(Date.now() / 1000) + opts.expirationTtl : undefined;
    this.map.set(key, { value: v, binary, metadata: opts.metadata ?? null, expiration });
    this.persist();
  }
  async delete(key) { this.map.delete(key); this.persist(); }
  async list({ prefix = "", limit = 1000, cursor } = {}) {
    const names = [...this.map.keys()].filter((k) => k.startsWith(prefix) && this.live(k)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = names.slice(start, start + limit);
    const done = start + limit >= names.length;
    return {
      keys: page.map((name) => ({ name, metadata: this.map.get(name).metadata ?? undefined })),
      list_complete: done,
      cursor: done ? undefined : String(start + limit),
    };
  }
}

// ---------------------------------------------------------------- a small stand-in for Cloudflare D1
let DatabaseSync = null;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* older Node: no visitor counting locally */ }

class LocalD1 {
  constructor(file) { this.db = new DatabaseSync(file); }
  prepare(sql) { return new LocalStatement(this.db, sql, []); }
  async batch(statements) {
    this.db.exec("BEGIN");
    try {
      const out = statements.map((s) => s.execute());
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
}
class LocalStatement {
  constructor(db, sql, args) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new LocalStatement(this.db, this.sql, args); }
  execute() {
    const st = this.db.prepare(this.sql);
    if (/^\s*(SELECT|WITH)\b/i.test(this.sql)) return { success: true, results: st.all(...this.args).map((r) => ({ ...r })), meta: {} };
    const r = st.run(...this.args);
    return { success: true, results: [], meta: { changes: Number(r.changes) } };
  }
  async run() { return this.execute(); }
  async all() { return this.execute(); }
  async first(col) { const row = this.execute().results[0] ?? null; return col ? row?.[col] ?? null : row; }
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function serveStatic(pathname) {
  const file = path.join(PUBLIC, decodeURIComponent(pathname));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(fs.readFileSync(file), { headers: { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" } });
}

const routes = JSON.parse(fs.readFileSync(path.join(PUBLIC, "_routes.json"), "utf8"));
const excluded = (p) => routes.exclude.some((r) => (r.endsWith("/*") ? p.startsWith(r.slice(0, -1)) : p === r));

const { onRequest } = await import(pathToFileURL(path.join(ROOT, "functions", "[[path]].js")).href);
const env = {
  SITE: new LocalKV(STORE_FILE === "memory" ? null : STORE_FILE),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
  ASSETS: { fetch: async (req) => serveStatic(new URL(req.url).pathname) }, // like Cloudflare's env.ASSETS
};
if (DatabaseSync && process.env.STATS !== "off") {
  if (STORE_FILE !== "memory") fs.mkdirSync(path.join(ROOT, ".dev"), { recursive: true });
  env.STATS = new LocalD1(process.env.STATS_FILE || (STORE_FILE === "memory" ? ":memory:" : path.join(ROOT, ".dev", "stats.sqlite")));
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let response;
    if (excluded(url.pathname)) {
      response = serveStatic(url.pathname);
    } else {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length && !["GET", "HEAD"].includes(req.method) ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body });
      response = await onRequest({ request, env, next: () => serveStatic(url.pathname), waitUntil: (p) => p.catch(() => {}) });
    }
    const headers = {};
    response.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
    const cookies = response.headers.getSetCookie?.() || [];
    if (cookies.length) headers["set-cookie"] = cookies;
    res.writeHead(response.status, headers);
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Local server error: " + err.message);
  }
}).listen(PORT, () => {
  console.log(`Site:  http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin  ${env.ADMIN_PASSWORD ? "" : "(set ADMIN_PASSWORD to log in)"}`);
  console.log(`Visitor counting: ${env.STATS ? "on" : "off"}`);
});
