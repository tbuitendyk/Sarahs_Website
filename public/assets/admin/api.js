// How the admin editor loads and saves. Talks to /api/admin/* on the real site.
// In the private preview (window.SB_DEMO), a pretend server keeps changes in the browser instead.

async function call(method, path, body, isRaw) {
  const opts = { method, headers: { "X-SB-Admin": "1" }, credentials: "same-origin" };
  if (body !== undefined) {
    if (isRaw) { opts.body = body; opts.headers["Content-Type"] = body.type || "application/octet-stream"; }
    else { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
  }
  let res;
  try {
    res = await fetch(`/api/admin/${path}`, opts);
  } catch {
    throw new Error("Couldn’t reach the website. Check the internet connection and try again.");
  }
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (res.status === 401) { window.location.href = "/admin"; throw new Error(data.error || "Please log in again."); }
  if (!res.ok) {
    const err = new Error(data.error || `Something went wrong (${res.status}). Please try again.`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Plain download from the site while logged in (used for backups).
async function raw(url) {
  let res;
  try { res = await fetch(url, { credentials: "same-origin" }); } catch {
    throw new Error("Couldn’t reach the website. Check the internet connection and try again.");
  }
  if (res.status === 401) { window.location.href = "/admin"; throw new Error("Please log in again."); }
  if (!res.ok) throw new Error(`Couldn’t download ${url} (${res.status}).`);
  return res;
}

const realApi = {
  demo: false,
  loadContent: () => call("GET", "content"),
  saveContent: (data, baseVersion) => call("PUT", "content", { data, baseVersion }),
  listFiles: () => call("GET", "files"),
  upload: (blob, filename) => call("POST", `upload?filename=${encodeURIComponent(filename)}`, blob, true),
  deleteFile: (name) => call("DELETE", `files/${encodeURIComponent(name)}`),
  history: () => call("GET", "history"),
  restore: (key) => call("POST", "restore", { key }),
  changePassword: (current, next) => call("POST", "password", { current, next }),
  backupStatus: () => call("GET", "backup"),
  stats: (from, to, by) => call("GET", `stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&by=${by}`),
  createBackupKey: () => call("POST", "backup/key", {}),
  deleteBackupKey: () => call("DELETE", "backup/key"),
  async backupList() { return (await raw("/api/backup/list")).text(); },
  async backupItem(url) { return new Uint8Array(await (await raw(url)).arrayBuffer()); },
  siteUrl: (path) => path,
  logoutUrl: "/admin/logout",
};

function demoApi() {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let state = null;
  const files = [];
  const backups = [];
  let demoKey = null;
  const ready = fetch(window.SB_DEMO_CONTENT || "demo-content.json").then((r) => r.json()).then((d) => {
    state = { data: d, version: 1, savedAt: new Date().toISOString() };
  });
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
  return {
    demo: true,
    async loadContent() { await ready; return clone(state); },
    async saveContent(data) {
      await ready; await wait();
      backups.unshift({ key: `backup:${Date.now()}`, savedAt: state.savedAt, version: state.version, data: clone(state.data) });
      state = { data: clone(data), version: state.version + 1, savedAt: new Date().toISOString() };
      return { ok: true, version: state.version, savedAt: state.savedAt, warnings: [] };
    },
    async listFiles() { await wait(100); return { files: files.slice() }; },
    async upload(blob, filename) {
      await wait(400);
      const name = filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const f = { name, url: URL.createObjectURL(blob), type: blob.type, size: blob.size, uploaded: new Date().toISOString() };
      files.unshift(f);
      return f;
    },
    async deleteFile(name) { const i = files.findIndex((f) => f.name === name); if (i >= 0) files.splice(i, 1); return { ok: true }; },
    async history() { await wait(100); return { backups: backups.map(({ key, savedAt, version }) => ({ key, savedAt, version })) }; },
    async restore(key) {
      const b = backups.find((x) => x.key === key);
      if (!b) throw new Error("That backup doesn’t exist.");
      return this.saveContent(b.data);
    },
    async changePassword() { await wait(); return { ok: true }; },
    // Made-up numbers for the practice admin, the same every time for the same day.
    async stats(from, to, by) {
      await ready; await wait(150);
      const series = [];
      const rand = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
      const step = by === "day" ? 86400000 : 3600000;
      let days = 0;
      for (let t = Date.parse(from + ":00:00Z"); t < Date.parse(to + ":00:00Z"); t += step) {
        const d = new Date(t);
        if (by === "hour" && d.getUTCHours() !== 18) continue;
        days++;
        const seed = Math.floor(t / 86400000);
        const visitors = 4 + Math.floor(rand(seed) * 14) + (d.getUTCDay() === 0 ? 6 : 0);
        const key = by === "day" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 13);
        series.push({ t: key, kind: "visitor", n: visitors }, { t: key, kind: "view", n: Math.round(visitors * (2 + rand(seed + 1))) });
        if (rand(seed + 2) > 0.6) series.push({ t: key, kind: "download", n: 1 + Math.floor(rand(seed + 3) * 3) });
        if (rand(seed + 4) > 0.8) series.push({ t: key, kind: "unlock", n: 1 });
      }
      const k = Math.max(1, days / 7);
      const top = [
        ["view", "/", 40], ["view", "/books.html", 22], ["view", "/igs-files.html", 17], ["view", "/about.html", 12],
        ["view", "/books/light-through-his-love.html", 9], ["view", "/short-stories.html", 7], ["view", "/blog.html", 4],
        ["download", "/assets/downloads/words-of-love.docx", 5],
        ["ref", "google.com", 14], ["ref", "facebook.com", 8], ["ref", "instagram.com", 5], ["ref", "booksforbibles.wordpress.com", 3],
        ["country", "MX", 20], ["country", "US", 16], ["country", "CA", 9], ["country", "GB", 3],
      ].map(([kind, item, n]) => ({ kind, item, n: Math.round(n * k) }));
      return { enabled: true, practice: true, by, series, top, since: from };
    },
    async backupStatus() { await wait(100); return { key: demoKey ? { created: demoKey } : null, lastFinished: null, lastStarted: null }; },
    async createBackupKey() { await wait(); demoKey = new Date().toISOString(); return { key: "sbk_PRACTICE-ONLY-this-is-not-a-real-key" }; },
    async deleteBackupKey() { await wait(); demoKey = null; return { ok: true }; },
    async backupList() {
      await ready;
      return "# sarahs-books backup list 1\nreadme\t-\tREADME.txt\tdemo:readme\ncontent\t-\tcontent.json\tdemo:content\n";
    },
    async backupItem(url) {
      const enc = new TextEncoder();
      if (url === "demo:content") return enc.encode(JSON.stringify(state, null, 2));
      return enc.encode("Practice backup from the preview. A real backup also has files/, assets/ and history/.\n");
    },
    siteUrl: (path) => (path === "/" ? "index.html" : path.replace(/^\//, "")),
    logoutUrl: "admin-login.html",
  };
}

export const api = window.SB_DEMO ? demoApi() : realApi;
