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
  siteUrl: (path) => path,
  logoutUrl: "/admin/logout",
};

function demoApi() {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let state = null;
  const files = [];
  const backups = [];
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
    siteUrl: (path) => (path === "/" ? "index.html" : path.replace(/^\//, "")),
    logoutUrl: "admin-login.html",
  };
}

export const api = window.SB_DEMO ? demoApi() : realApi;
