// Where the site's content and Sarah's uploads are kept: Cloudflare KV (bound as env.SITE).
//
//   content          the whole site content { data, version, savedAt }
//   backup:<n>       the content as it was before each save (kept 180 days; newest first)
//   file:<name>      an uploaded picture or file, served at /files/<name>
//   auth:password    Sarah's password hash (see auth.js)
//   tries:<ip>       wrong-password counter (see auth.js)

import defaults from "./defaults.js";

const BACKUP_SECONDS = 60 * 60 * 24 * 180;
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const clone = (v) => JSON.parse(JSON.stringify(v));

export async function getContent(env) {
  const stored = await env.SITE.get("content", { type: "json" });
  if (stored && stored.data) return stored;
  return { data: clone(defaults), version: 0, savedAt: null };
}

// Checks that the content still has the shape the website expects.
export function checkShape(data) {
  const problems = [];
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(data)) return ["The content is empty or damaged."];
  for (const k of ["site", "home", "contact"]) if (!isObj(data[k])) problems.push(`"${k}" is missing.`);
  if (!isObj(data.progress) && !Array.isArray(data.progress)) problems.push('"progress" is missing.');
  for (const k of ["blog", "pages", "books"]) {
    if (!Array.isArray(data[k])) problems.push(`"${k}" should be a list.`);
    else if (data[k].some((x) => !isObj(x))) problems.push(`"${k}" has an item that isn't filled in properly.`);
  }
  return problems;
}

function backupKey() {
  // Newest first when KV lists keys in alphabetical order.
  return `backup:${String(9999999999999 - Date.now()).padStart(13, "0")}`;
}

export async function saveContent(env, data, baseVersion) {
  const problems = checkShape(data);
  if (problems.length) return { error: problems.join(" ") };
  const json = JSON.stringify(data);
  if (json.length > MAX_CONTENT_BYTES) return { error: "The content is too large to save." };

  const current = await getContent(env);
  if (baseVersion !== undefined && baseVersion !== null && Number(baseVersion) !== Number(current.version)) {
    return { conflict: true, version: current.version, savedAt: current.savedAt };
  }
  await env.SITE.put(backupKey(), JSON.stringify(current), {
    expirationTtl: BACKUP_SECONDS,
    metadata: { savedAt: current.savedAt, version: current.version },
  });
  const next = { data, version: (Number(current.version) || 0) + 1, savedAt: new Date().toISOString() };
  await env.SITE.put("content", JSON.stringify(next));
  return { ok: true, version: next.version, savedAt: next.savedAt };
}

export async function listBackups(env, limit = 60) {
  const res = await env.SITE.list({ prefix: "backup:", limit });
  return res.keys.map((k) => ({ key: k.name, savedAt: k.metadata?.savedAt || null, version: k.metadata?.version ?? null }));
}

export async function restoreBackup(env, key) {
  if (!/^backup:\d{13}$/.test(String(key))) return { error: "That backup doesn't exist." };
  const old = await env.SITE.get(key, { type: "json" });
  if (!old || !old.data) return { error: "That backup has expired or doesn't exist." };
  return saveContent(env, old.data);
}

// ---------------------------------------------------------------- uploads

const TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  epub: "application/epub+zip",
  txt: "text/plain; charset=utf-8",
};
export const UPLOAD_EXTENSIONS = Object.keys(TYPES);

export function isImageName(name) {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

export async function putFile(env, filename, bytes) {
  const m = String(filename || "").toLowerCase().match(/^(.*?)\.([a-z0-9]+)$/);
  if (!m || !TYPES[m[2]]) return { error: `Only these kinds of files can be uploaded: ${UPLOAD_EXTENSIONS.join(", ")}.` };
  if (!bytes || bytes.byteLength === 0) return { error: "The file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { error: "The file is too big (10 MB at most)." };
  const base = m[1].replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  const rand = [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const name = `${base}-${rand}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
  const meta = { type: TYPES[m[2]], size: bytes.byteLength, uploaded: new Date().toISOString(), original: String(filename).slice(0, 120) };
  await env.SITE.put(`file:${name}`, bytes, { metadata: meta });
  return { ok: true, name, url: `/files/${name}`, ...meta };
}

export async function getFile(env, name) {
  if (!/^[a-z0-9-]+\.[a-z0-9]+$/.test(name)) return null;
  const { value, metadata } = await env.SITE.getWithMetadata(`file:${name}`, { type: "arrayBuffer" });
  return value ? { value, metadata: metadata || {} } : null;
}

export async function listFiles(env) {
  const files = [];
  let cursor;
  do {
    const res = await env.SITE.list({ prefix: "file:", cursor, limit: 1000 });
    for (const k of res.keys) {
      const name = k.name.slice(5);
      files.push({ name, url: `/files/${name}`, ...(k.metadata || {}) });
    }
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return files.sort((a, b) => String(b.uploaded || "").localeCompare(String(a.uploaded || "")));
}

export async function deleteFile(env, name) {
  if (!/^[a-z0-9-]+\.[a-z0-9]+$/.test(name)) return { error: "No such file." };
  await env.SITE.delete(`file:${name}`);
  return { ok: true };
}
