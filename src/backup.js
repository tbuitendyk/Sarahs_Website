// Full backups of everything the site keeps in Cloudflare, for Sarah's NAS.
//
// The NAS script (tools/nas/sarahs-books-backup.sh) uses a read-only "backup key" created in
// the admin (Backups). It asks for /api/backup/list, downloads every item on it, and packs them
// into one .tar.gz. The admin's "Download a backup now" button builds the same package in the
// browser. Restoring is done with tools/nas/sarahs-books-restore.sh (needs the admin password).
//
// Package layout:
//   README.txt        what's inside and how to restore
//   manifest.json     list of everything, with dates and sizes
//   content.json      all the site's words and settings ({ data, version, savedAt })
//   files/<name>      pictures and files uploaded in the admin
//   assets/...        built-in pictures/files the content uses (from the site's design folder)
//   history/<...>     earlier saved versions (Undo & history)

import * as store from "./store.js";

const enc = new TextEncoder();
const KEY_RECORD = "auth:backup_key";
const LAST_RUN = "meta:last-auto-backup";

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sha256(s) { return toHex(await crypto.subtle.digest("SHA-256", enc.encode(String(s)))); }
function same(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// ---------------------------------------------------------------- the backup key

export async function createKey(env) {
  const key = "sbk_" + b64url(crypto.getRandomValues(new Uint8Array(32)));
  // Only a fingerprint of the key is stored; the key itself is shown to Sarah once.
  await env.SITE.put(KEY_RECORD, JSON.stringify({ hash: await sha256(key), created: new Date().toISOString() }));
  return key;
}

export async function deleteKey(env) {
  await env.SITE.delete(KEY_RECORD);
}

async function keyInfo(env) {
  const v = await env.SITE.get(KEY_RECORD, { type: "json" });
  return v && v.hash ? v : null;
}

// True when the request carries the current backup key ("Authorization: Bearer sbk_...").
export async function hasValidKey(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!m) return false;
  const info = await keyInfo(env);
  return Boolean(info) && same(await sha256(m[1]), info.hash);
}

// ---------------------------------------------------------------- the NAS's runs

export async function recordRun(env, request, fields) {
  const prev = (await env.SITE.get(LAST_RUN, { type: "json" })) || {};
  // At most one note of each kind every 5 minutes, so a misbehaving script can't use up the
  // free plan's 1,000 saves a day (which Sarah needs for her own edits).
  const kind = fields.started ? "started" : "finished";
  if (prev[kind] && Date.now() - Date.parse(prev[kind]) < 5 * 60 * 1000) return;
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  await env.SITE.put(LAST_RUN, JSON.stringify({ ...prev, ...fields, from: ip }));
}

export async function status(env) {
  const info = await keyInfo(env);
  const last = (await env.SITE.get(LAST_RUN, { type: "json" })) || {};
  return { key: info ? { created: info.created } : null, lastStarted: last.started || null, lastFinished: last.finished || null,
    lastFiles: last.items ?? null, lastBytes: last.bytes ?? null };
}

// ---------------------------------------------------------------- what goes in a backup

// Built-in files the content points to, e.g. "/assets/images/sarah.jpg".
function referencedAssets(data) {
  const found = new Set();
  const text = JSON.stringify(data || {});
  for (const m of text.matchAll(/\/assets\/[A-Za-z0-9._\/-]+\.[A-Za-z0-9]+/g)) {
    if (!m[0].includes("..")) found.add(m[0]);
  }
  return [...found].sort();
}

function historyName(h) {
  const when = h.savedAt ? String(h.savedAt).replace(/[:.]/g, "-") : "starting-version";
  return `${when}_v${h.version ?? 0}_${h.key.slice("backup:".length)}.json`;
}

export async function collect(env) {
  const content = await store.getContent(env);
  const files = await store.listFiles(env);
  const history = await store.listAllBackups(env);
  const assets = referencedAssets(content.data);
  const items = [
    { kind: "readme", path: "README.txt", url: "/api/backup/readme" },
    { kind: "manifest", path: "manifest.json", url: "/api/backup/manifest" },
    { kind: "content", path: "content.json", url: "/api/backup/content" },
    ...files.map((f) => ({ kind: "file", path: `files/${f.name}`, size: f.size, url: `/api/backup/files/${f.name}` })),
    ...assets.map((a) => ({ kind: "asset", path: a.slice(1), url: `/api/backup/${a.slice(1)}` })),
    ...history.map((h) => ({ kind: "history", path: `history/${historyName(h)}`, url: `/api/backup/history/${h.key.slice("backup:".length)}` })),
  ];
  return { content, files, history, assets, items };
}

// One line per item: kind, size (or -), path inside the package, address to download it from.
export function listText(items) {
  return "# sarahs-books backup list 1\n" +
    items.map((i) => [i.kind, i.size ?? "-", i.path, i.url].join("\t")).join("\n") + "\n";
}

export function manifest(c, origin) {
  return {
    format: "sarahs-books-backup",
    format_version: 1,
    created: new Date().toISOString(),
    site: origin,
    content: { version: c.content.version, savedAt: c.content.savedAt },
    counts: { files: c.files.length, assets: c.assets.length, history: c.history.length },
    files: c.files.map((f) => ({ name: f.name, size: f.size, type: f.type, uploaded: f.uploaded, original: f.original })),
    assets: c.assets,
    history: c.history.map((h) => ({ file: `history/${historyName(h)}`, savedAt: h.savedAt, version: h.version })),
  };
}

export function readme(origin) {
  return `Sarah's Books: website backup
=============================

Made ${new Date().toISOString()} from ${origin}

What's inside
-------------
content.json    All the words and settings of the website: books, blog posts, pages,
                home page, contact page, newsletter settings (including the subscriber
                password), progress bars and site settings.
files/          Every picture and file uploaded in the admin (covers, photos, PDF, Word
                and EPUB downloads).
assets/         The built-in pictures and files the content uses (they also live in the
                website's code on GitHub).
history/        Earlier saved versions of content.json (what "Undo & history" shows).
manifest.json   A list of everything above, with dates and sizes.

Not included: the admin password (only a secret fingerprint of it is ever stored) and
the website's design and code, which are kept on GitHub.

How to restore
--------------
Use sarahs-books-restore.sh (next to the backup script on the NAS):

    sh sarahs-books-restore.sh /path/to/this-backup.tar.gz https://sarah.buitendyk.ca

It asks for the admin password, puts every uploaded file back, then puts content.json
back. The version that was live just before is kept under "Undo & history", so a
restore can itself be undone.

To look at a single earlier version, open the matching file in history/: the words
are readable in any text editor.
`;
}
