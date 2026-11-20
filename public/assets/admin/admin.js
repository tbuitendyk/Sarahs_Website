// Sarah's Books admin: edit everything on the website, then press Save.
import { SECTIONS, BUILT_IN_PICTURES } from "./schema.js";
import { createRichEditor } from "./editor.js";
import { api } from "./api.js";
import { assetUrl } from "./markdown.js";

const app = document.getElementById("app");
const state = {
  data: null, version: 0, savedJSON: "", savedAt: null,
  section: (location.hash.slice(1) || "books"),
  open: new WeakSet(), saving: false, editors: new Set(),
};

// ---------------------------------------------------------------- small helpers

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
let uid = 0;
const nextId = (p) => `${p}-${++uid}`;
const slugify = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
const preview = (v) => assetUrl(v, "");
const isDirty = () => state.data && JSON.stringify(state.data) !== state.savedJSON;
const when = (iso) => {
  if (!iso) return "the starting version";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

// A button that asks "are you sure?" by needing a second click.
function confirmButton(label, confirmLabel, onConfirm, cls = "btn btn-small btn-danger-quiet") {
  let armed = false, timer;
  const b = h("button", { type: "button", class: cls }, label);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!armed) {
      armed = true; b.textContent = confirmLabel; b.classList.add("armed");
      timer = setTimeout(() => { armed = false; b.textContent = label; b.classList.remove("armed"); }, 4000);
      return;
    }
    clearTimeout(timer);
    onConfirm();
  });
  return b;
}

// ---------------------------------------------------------------- status bar & saving

let statusEl, saveBtn, msgEl;
function setMessage(text, kind = "") {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = "status-msg " + kind;
}
function refreshStatus() {
  if (!saveBtn) return;
  const dirty = isDirty();
  saveBtn.disabled = !dirty || state.saving;
  saveBtn.textContent = state.saving ? "Saving…" : dirty ? "Save changes" : "Saved";
  statusEl.textContent = dirty ? "You have unsaved changes" : state.savedAt ? `Last saved ${when(state.savedAt)}` : "No changes yet";
  statusEl.className = "status-text" + (dirty ? " dirty" : "");
}
const changed = () => { refreshStatus(); if (isDirty()) setMessage(""); };

async function save() {
  if (state.saving || !isDirty()) return;
  state.editors.forEach((ed) => ed.isConnected && ed.flush());
  state.saving = true;
  refreshStatus();
  try {
    const res = await api.saveContent(state.data, state.version);
    state.version = res.version;
    state.savedAt = res.savedAt;
    state.savedJSON = JSON.stringify(state.data);
    const warn = (res.warnings || []).join(" ");
    const done = api.demo ? "Saved (practice only: the real website isn’t changed)." : "Saved! The website is updated.";
    setMessage(warn ? `${done} Note: ${warn}` : done, warn ? "warn" : "ok");
  } catch (err) {
    setMessage(err.message, "error");
  } finally {
    state.saving = false;
    refreshStatus();
  }
}

window.addEventListener("beforeunload", (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
});

// ---------------------------------------------------------------- fields

function fieldRow(f, control, id, inline = false) {
  const help = f.help ? h("p", { class: "help", id: `${id}-help` }, f.help) : null;
  if (help && control.setAttribute && !control.getAttribute("aria-describedby")) control.setAttribute("aria-describedby", `${id}-help`);
  if (inline) return h("div", { class: "field field-inline" }, control, h("label", { for: id }, f.label), help);
  return h("div", { class: "field" }, h("label", { for: id, class: "field-label" }, f.label, f.required ? h("span", { class: "req" }, " (needed)") : null), control, help);
}

function renderField(obj, f, onAnyChange) {
  const id = nextId(f.key);
  const set = (v) => { obj[f.key] = v; onAnyChange?.(f.key); changed(); };
  const val = obj[f.key];

  switch (f.type) {
    case "string": case "url": case "slug": {
      const input = h("input", {
        id, type: "text", value: val ?? "", spellcheck: f.type === "string" ? "true" : "false",
        inputmode: f.type === "url" ? "url" : null, placeholder: f.type === "url" ? "https://…" : null,
        oninput: (e) => set(e.target.value),
      });
      return fieldRow(f, input, id);
    }
    case "text": {
      const ta = h("textarea", { id, rows: "3", oninput: (e) => set(e.target.value) });
      ta.value = val ?? "";
      return fieldRow(f, ta, id);
    }
    case "rich": {
      const ed = createRichEditor(val ?? "", (md) => { if (md !== (obj[f.key] ?? "")) set(md); }, { id });
      state.editors.add(ed);
      return fieldRow(f, ed, id);
    }
    case "number": {
      const input = h("input", { id, type: "number", step: "any", value: val ?? "", oninput: (e) => set(e.target.value === "" ? "" : Number(e.target.value)) });
      return fieldRow(f, input, id);
    }
    case "percent": {
      const num = Math.max(0, Math.min(100, Number(val) || 0));
      const out = h("output", { for: id, class: "pct-out" }, `${num}%`);
      const fill = h("div", { class: "progress-preview-fill" });
      fill.style.width = `${num}%`; // set directly: the admin's security rules block style="" attributes
      const preview = h("div", { class: "progress-preview" }, fill);
      const range = h("input", {
        id, type: "range", min: "0", max: "100", step: "1", value: String(num),
        oninput: (e) => { const n = Number(e.target.value); out.textContent = `${n}%`; preview.firstChild.style.width = `${n}%`; set(n); },
      });
      return fieldRow({ ...f, help: f.help || "Drag to move the bar. 0% is empty and 100% is full." }, h("div", { class: "pct" }, range, out, preview), id);
    }
    case "boolean": {
      const cb = h("input", { id, type: "checkbox", checked: val === true || val === "true", onchange: (e) => set(e.target.checked) });
      return fieldRow(f, cb, id, true);
    }
    case "date": {
      const input = h("input", { id, type: "date", value: val ?? "", oninput: (e) => set(e.target.value) });
      return fieldRow(f, input, id);
    }
    case "select": {
      const sel = h("select", { id, onchange: (e) => set(e.target.value) });
      const choices = [...f.choices];
      if (val && !choices.some((c) => c.value === val)) choices.push({ value: val, label: val });
      for (const c of choices) sel.append(h("option", { value: c.value, selected: c.value === val }, c.label));
      if (!val) sel.value = choices[0].value;
      return fieldRow(f, sel, id);
    }
    case "multiselect": {
      const current = () => (Array.isArray(obj[f.key]) ? obj[f.key] : String(obj[f.key] || "").split(/\s*,\s*/).filter(Boolean));
      const box = h("div", { class: "checks", id, role: "group" });
      for (const c of f.choices) {
        const cid = nextId("opt");
        const cb = h("input", {
          id: cid, type: "checkbox", checked: current().includes(c.value),
          onchange: (e) => {
            const now = current().filter((x) => x !== c.value);
            if (e.target.checked) now.push(c.value);
            set(f.choices.map((x) => x.value).filter((x) => now.includes(x)));
          },
        });
        box.append(h("label", { for: cid, class: "check" }, cb, " ", c.label));
      }
      return h("div", { class: "field" }, h("span", { class: "field-label" }, f.label), box, f.help ? h("p", { class: "help" }, f.help) : null);
    }
    case "image": return fieldRow(f, pictureField(obj, f, set), id);
    case "file": return fieldRow(f, fileField(obj, f, set), id);
    case "group": {
      if (!obj[f.key] || typeof obj[f.key] !== "object") obj[f.key] = {};
      const fs = h("fieldset", { class: "group" }, h("legend", {}, f.label));
      for (const sub of f.fields) fs.append(renderField(obj[f.key], sub));
      return fs;
    }
    case "list": {
      if (!Array.isArray(obj[f.key])) obj[f.key] = [];
      return h("div", { class: "field" }, h("span", { class: "field-label" }, f.label), f.help ? h("p", { class: "help" }, f.help) : null, listEditor(obj[f.key], f));
    }
    default: return h("p", {}, `(Unknown box type: ${f.type})`);
  }
}

// ---------------------------------------------------------------- pictures & files

async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, name: file.name };
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return { blob: file, name: file.name }; }
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= 400 * 1024) return { blob: file, name: file.name };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  let keepPng = false;
  if (file.type === "image/png") {
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < px.length; i += 16) if (px[i] < 250) { keepPng = true; break; }
  }
  if (!keepPng) {
    // Pictures without see-through parts become smaller JPEGs.
    const flat = document.createElement("canvas");
    flat.width = canvas.width; flat.height = canvas.height;
    const fctx = flat.getContext("2d");
    fctx.fillStyle = "#fff"; fctx.fillRect(0, 0, flat.width, flat.height); fctx.drawImage(canvas, 0, 0);
    const blob = await new Promise((r) => flat.toBlob(r, "image/jpeg", 0.85));
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  }
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".png" };
}

function pictureField(obj, f, set) {
  const box = h("div", { class: "pic" });
  const status = h("p", { class: "pic-status", "aria-live": "polite" });
  const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", hidden: true });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    status.textContent = "Uploading…";
    try {
      const { blob, name } = await prepareImage(file);
      const res = await api.upload(blob, name);
      set(res.url);
      status.textContent = "Uploaded. Press Save changes to put it on the website.";
      draw();
    } catch (err) {
      status.textContent = err.message;
    }
  });
  function draw() {
    const v = obj[f.key] || "";
    box.replaceChildren(
      v ? h("img", { src: preview(v), alt: "", class: "pic-img" }) : h("div", { class: "pic-empty" }, "No picture"),
      h("div", { class: "pic-actions" },
        h("button", { type: "button", class: "btn btn-small btn-primary", onclick: () => input.click() }, v ? "Upload a different picture" : "Upload a picture"),
        h("button", { type: "button", class: "btn btn-small", onclick: () => choosePicture((url) => { set(url); draw(); }) }, "Choose an uploaded picture"),
        v ? h("button", { type: "button", class: "btn btn-small btn-danger-quiet", onclick: () => { set(""); draw(); } }, "Remove picture") : null,
      ),
      status, input,
    );
  }
  draw();
  return box;
}

function fileField(obj, f, set) {
  const box = h("div", { class: "pic" });
  const status = h("p", { class: "pic-status", "aria-live": "polite" });
  const input = h("input", { type: "file", accept: ".pdf,.doc,.docx,.epub,.txt", hidden: true });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    status.textContent = "Uploading…";
    try {
      const res = await api.upload(file, file.name);
      set(res.url);
      status.textContent = "Uploaded. Press Save changes to put it on the website.";
      draw();
    } catch (err) {
      status.textContent = err.message;
    }
  });
  function draw() {
    const v = obj[f.key] || "";
    box.replaceChildren(
      v ? h("p", { class: "file-name" }, "Current file: ", h("a", { href: preview(v), target: "_blank", rel: "noopener" }, v.split("/").pop())) : h("p", { class: "pic-empty small" }, "No file"),
      h("div", { class: "pic-actions" },
        h("button", { type: "button", class: "btn btn-small btn-primary", onclick: () => input.click() }, v ? "Upload a different file" : "Upload a file"),
        v ? h("button", { type: "button", class: "btn btn-small btn-danger-quiet", onclick: () => { set(""); draw(); } }, "Remove file") : null,
      ),
      status, input,
    );
  }
  draw();
  return box;
}

async function choosePicture(onPick) {
  const close = () => dlg.remove();
  const grid = h("div", { class: "chooser-grid" }, h("p", {}, "Loading pictures…"));
  const dlg = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Choose a picture", onclick: (e) => { if (e.target === dlg) close(); } },
    h("div", { class: "modal-card" },
      h("div", { class: "modal-head" }, h("h2", {}, "Choose a picture"), h("button", { type: "button", class: "btn btn-small", onclick: close }, "Close")),
      grid));
  document.body.append(dlg);
  dlg.querySelector("button").focus();
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  let uploaded = [];
  try { uploaded = (await api.listFiles()).files.filter((x) => /^image\//.test(x.type || "") || /\.(jpe?g|png|webp|gif)$/i.test(x.name)); } catch { /* show built-ins only */ }
  const all = [...uploaded, ...BUILT_IN_PICTURES];
  grid.replaceChildren(...all.map((p) => h("button", { type: "button", class: "chooser-item", onclick: () => { onPick(p.url); close(); } },
    h("img", { src: preview(p.url), alt: "" }), h("span", {}, p.name))));
}

// ---------------------------------------------------------------- lists (books, posts, pages…)

function listEditor(arr, cfg, sectionCfg) {
  const box = h("div", { class: "list" });
  const summaryOf = (item) => (cfg.summary ? cfg.summary(item) : item.title) || "(no title yet)";

  function badges(item) {
    const out = [];
    if (sectionCfg?.id === "books") {
      const names = { "my-books": "My Books", anthologies: "Anthologies", "igs-files": "IGS: Files", subscribers: "Subscribers" };
      const lists = Array.isArray(item.show_on) ? item.show_on : String(item.show_on || "").split(/\s*,\s*/).filter(Boolean);
      lists.forEach((l) => out.push(h("span", { class: "badge" }, names[l] || l)));
      if (!lists.length) out.push(h("span", { class: "badge badge-muted" }, "Not on any list"));
      if (item.subscribers_only === true) out.push(h("span", { class: "badge badge-lock" }, "🔒 Subscribers only"));
    }
    if (sectionCfg?.id === "pages") {
      if (item.subscribers_only === true) out.push(h("span", { class: "badge badge-lock" }, "🔒 Subscribers only"));
      if (item.hidden === true) out.push(h("span", { class: "badge badge-muted" }, "Hidden"));
      else if (item.menu === "no") out.push(h("span", { class: "badge badge-muted" }, "Not in menu"));
      else out.push(h("span", { class: "badge" }, item.menu === "under-my-books" ? "Under My Books" : "Main menu"));
    }
    if (sectionCfg?.id === "blog" && item.date) out.push(h("span", { class: "badge" }, item.date));
    return out;
  }

  function card(item, i) {
    const open = state.open.has(item);
    const titleEl = h("span", { class: "item-title" }, summaryOf(item));
    const badgeEl = h("span", { class: "item-badges" }, badges(item));
    const bodyId = nextId("item");
    const toggle = h("button", { type: "button", class: "item-toggle", "aria-expanded": String(open), "aria-controls": bodyId,
      onclick: () => { if (state.open.has(item)) state.open.delete(item); else state.open.add(item); render(); } },
    h("span", { class: "chev", "aria-hidden": "true" }, open ? "▾" : "▸"), titleEl);
    const url = sectionCfg?.pageUrl?.(item, slugify);
    const controls = h("span", { class: "item-controls" },
      url ? h("a", { class: "btn btn-small", href: api.siteUrl(url), target: "_blank", rel: "noopener", title: "Opens the saved version of this page" }, "View ↗") : null,
      h("button", { type: "button", class: "btn btn-small", title: "Move up", "aria-label": `Move “${summaryOf(item)}” up`, disabled: i === 0,
        onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; changed(); render(); } }, "↑"),
      h("button", { type: "button", class: "btn btn-small", title: "Move down", "aria-label": `Move “${summaryOf(item)}” down`, disabled: i === arr.length - 1,
        onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; changed(); render(); } }, "↓"),
      confirmButton("Delete", "Click again to delete", () => { arr.splice(i, 1); changed(); render(); }),
    );
    const el = h("div", { class: "item" + (open ? " open" : "") }, h("div", { class: "item-head" }, toggle, badgeEl, controls));
    if (open) {
      const body = h("div", { class: "item-body", id: bodyId });
      for (const f of cfg.fields) {
        body.append(renderField(item, f, (key) => {
          if (key === "title" || cfg.summary) titleEl.textContent = summaryOf(item);
          if (["show_on", "menu", "hidden", "date", "subscribers_only"].includes(key)) badgeEl.replaceChildren(...badges(item));
        }));
      }
      el.append(body);
    }
    return el;
  }

  function addButton() {
    return h("button", { type: "button", class: "btn btn-primary add-btn", onclick: () => {
      const item = cfg.newItem();
      if (cfg.addAt === "start") arr.unshift(item); else arr.push(item);
      state.open.add(item);
      changed();
      render();
      const idx = arr.indexOf(item);
      const el = box.querySelectorAll(".item")[idx];
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.querySelector(".item-body input, .item-body textarea")?.focus({ preventScroll: true });
    } }, `+ ${cfg.addLabel || "Add"}`);
  }

  function render() {
    const items = arr.map(card);
    box.replaceChildren(...[
      cfg.addAt === "start" ? addButton() : null,
      ...(items.length ? items : [h("p", { class: "empty" }, "Nothing here yet.")]),
      cfg.addAt !== "start" ? addButton() : null,
    ].filter(Boolean));
  }
  render();
  return box;
}

// ---------------------------------------------------------------- the special sections

function filesSection() {
  const wrap = h("div", { class: "files" }, h("p", {}, "Loading…"));
  const input = h("input", { type: "file", multiple: true, hidden: true, accept: "image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.epub,.txt" });
  const status = h("p", { class: "pic-status", "aria-live": "polite" });
  input.addEventListener("change", async () => {
    const files = [...input.files];
    input.value = "";
    for (const file of files) {
      status.textContent = `Uploading ${file.name}…`;
      try {
        const ready = /^image\//.test(file.type) ? await prepareImage(file) : { blob: file, name: file.name };
        await api.upload(ready.blob, ready.name);
        status.textContent = `Uploaded ${file.name}.`;
      } catch (err) { status.textContent = err.message; }
    }
    load();
  });
  async function load() {
    let files = [];
    try { files = (await api.listFiles()).files; } catch (err) { wrap.replaceChildren(h("p", { class: "error" }, err.message)); return; }
    wrap.replaceChildren(
      h("div", { class: "files-top" }, h("button", { type: "button", class: "btn btn-primary", onclick: () => input.click() }, "+ Upload pictures or files"), status, input),
      files.length ? h("div", { class: "file-grid" }, files.map((f) => h("div", { class: "file-card" },
        /^image\//.test(f.type || "") ? h("img", { src: preview(f.url), alt: "" }) : h("div", { class: "file-icon" }, (f.name.split(".").pop() || "").toUpperCase()),
        h("p", { class: "file-card-name" }, f.name),
        h("div", { class: "pic-actions" },
          h("button", { type: "button", class: "btn btn-small", onclick: async (e) => {
            const link = new URL(api.siteUrl(f.url), location.href).href;
            try { await navigator.clipboard.writeText(link); e.target.textContent = "Copied!"; } catch { e.target.textContent = link; }
          } }, "Copy link"),
          confirmButton("Delete", "Click again to delete", async () => { try { await api.deleteFile(f.name); } catch (err) { status.textContent = err.message; } load(); }),
        )))) : h("p", { class: "empty" }, "No pictures or files uploaded yet. Pictures you upload in any picture box show up here too."),
    );
  }
  load();
  return wrap;
}

function historySection() {
  const wrap = h("div", {}, h("p", {}, "Loading…"));
  (async () => {
    let backups = [];
    try { backups = (await api.history()).backups; } catch (err) { wrap.replaceChildren(h("p", { class: "error" }, err.message)); return; }
    wrap.replaceChildren(
      h("p", {}, "Each time you save, the version before is kept here for 6 months. Restoring a version puts the whole website back the way it was then (you can undo that too)."),
      backups.length ? h("ul", { class: "history" }, backups.map((b) => h("li", {},
        h("span", {}, `Version saved ${when(b.savedAt)}`),
        confirmButton("Restore this version", "Click again to restore", async () => {
          try {
            await api.restore(b.key);
            await loadContent();
            setMessage("Restored. The website is back to that version.", "ok");
          } catch (err) { setMessage(err.message, "error"); }
        }, "btn btn-small"),
      ))) : h("p", { class: "empty" }, "Nothing here yet. Older versions appear after your first save."),
    );
  })();
  return wrap;
}

function accountSection() {
  const ids = { cur: nextId("pw"), next: nextId("pw"), again: nextId("pw") };
  const msg = h("p", { class: "pic-status", "aria-live": "polite" });
  const form = h("form", { class: "pw-form", onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (fd.get("next") !== fd.get("again")) { msg.textContent = "The two new passwords don’t match."; return; }
    if (String(fd.get("next")).length < 10) { msg.textContent = "Please choose a password of at least 10 characters."; return; }
    try {
      await api.changePassword(fd.get("current"), fd.get("next"));
      form.reset();
      msg.textContent = "Password changed. Use the new one next time you log in.";
    } catch (err) { msg.textContent = err.message; }
  } },
  h("div", { class: "field" }, h("label", { for: ids.cur, class: "field-label" }, "Current password"), h("input", { id: ids.cur, name: "current", type: "password", autocomplete: "current-password", required: true })),
  h("div", { class: "field" }, h("label", { for: ids.next, class: "field-label" }, "New password (at least 10 characters)"), h("input", { id: ids.next, name: "next", type: "password", autocomplete: "new-password", required: true, minlength: "10" })),
  h("div", { class: "field" }, h("label", { for: ids.again, class: "field-label" }, "New password again"), h("input", { id: ids.again, name: "again", type: "password", autocomplete: "new-password", required: true })),
  h("button", { type: "submit", class: "btn btn-primary" }, "Change password"), msg);
  return h("div", {}, h("p", {}, "Changing the password logs out any other devices."), form);
}

// ---------------------------------------------------------------- layout

function renderMain(main) {
  state.editors.clear();
  const sec = SECTIONS.find((s) => s.id === state.section) || SECTIONS[0];
  const head = h("div", { class: "main-head" }, h("h1", {}, sec.label),
    sec.kind === "object" && sec.pageUrl ? h("a", { class: "btn btn-small", href: api.siteUrl(sec.pageUrl()), target: "_blank", rel: "noopener" }, "View on the website ↗") : null);
  const parts = [head];
  if (sec.intro) parts.push(h("p", { class: "intro" }, sec.intro));
  if (sec.kind === "list") {
    if (!Array.isArray(state.data[sec.key])) state.data[sec.key] = [];
    parts.push(listEditor(state.data[sec.key], sec, sec));
  } else if (sec.kind === "object") {
    let obj = state.data[sec.key];
    if (Array.isArray(obj)) obj = state.data[sec.key] = { items: obj };
    if (!obj || typeof obj !== "object") obj = state.data[sec.key] = {};
    const form = h("div", { class: "object-form" });
    for (const f of sec.fields) form.append(renderField(obj, f));
    parts.push(form);
  } else if (sec.kind === "files") parts.push(filesSection());
  else if (sec.kind === "history") parts.push(historySection());
  else if (sec.kind === "account") parts.push(accountSection());
  main.replaceChildren(...parts);
  main.scrollTop = 0;
}

function renderApp() {
  statusEl = h("span", { class: "status-text" });
  msgEl = h("span", { class: "status-msg", role: "status", "aria-live": "polite" });
  saveBtn = h("button", { type: "button", class: "btn btn-primary save-btn", onclick: save }, "Saved");
  const main = h("main", { class: "main", id: "main", tabindex: "-1" });

  const nav = h("nav", { class: "side", "aria-label": "Sections" }, h("ul", {}, SECTIONS.map((s) => h("li", {},
    h("a", { href: `#${s.id}`, "aria-current": s.id === state.section ? "page" : null, onclick: (e) => {
      e.preventDefault();
      state.section = s.id;
      history.replaceState(null, "", `#${s.id}`);
      nav.querySelectorAll("a").forEach((a) => a.removeAttribute("aria-current"));
      e.currentTarget.setAttribute("aria-current", "page");
      renderMain(main);
    } }, s.label)))));

  const top = h("header", { class: "topbar" },
    h("a", { class: "top-brand", href: api.siteUrl("/"), target: "_blank", rel: "noopener", title: "Open the website" },
      h("img", { src: "assets/images/logo.png".replace(/^/, api.demo ? "" : "/"), alt: "", width: "36", height: "35" }),
      h("span", {}, "Sarah’s Books ", h("small", {}, "Admin"))),
    h("div", { class: "top-status" }, statusEl, msgEl),
    h("div", { class: "top-actions" },
      h("a", { class: "btn btn-small btn-ghost", href: api.siteUrl("/"), target: "_blank", rel: "noopener" }, "View website ↗"),
      saveBtn,
      api.demo ? h("a", { class: "btn btn-small btn-ghost", href: api.logoutUrl }, "Log out")
        : h("form", { method: "post", action: api.logoutUrl, class: "logout" }, h("button", { type: "submit", class: "btn btn-small btn-ghost" }, "Log out"))));

  const demo = api.demo ? h("div", { class: "demo-note" }, "Preview of the admin. You can try everything, but nothing here changes the real website, and changes disappear when you close this page.") : null;
  app.className = "app";
  app.replaceChildren(...[demo, top, h("div", { class: "layout" }, nav, main)].filter(Boolean));
  renderMain(main);
  refreshStatus();
}

function upgradeContent(data) {
  for (const b of Array.isArray(data?.books) ? data.books : []) {
    if (!b || typeof b !== "object") continue;
    if (!Array.isArray(b.downloads)) b.downloads = [];
    if (b.download) {
      if (!b.downloads.some((d) => d && d.file === b.download)) b.downloads.unshift({ file: b.download, label: "" });
      delete b.download;
      if (b.download_heading === undefined) b.download_heading = "Docs Download:";
    }
  }
  return data;
}

async function loadContent() {
  const res = await api.loadContent();
  state.data = upgradeContent(res.data);
  state.version = res.version;
  state.savedAt = res.savedAt;
  state.savedJSON = JSON.stringify(res.data);
  state.open = new WeakSet();
  renderApp();
}

loadContent().catch((err) => {
  app.className = "app-loading";
  app.replaceChildren(h("p", { class: "error" }, err.message), h("p", {}, h("a", { href: "/admin" }, "Try again")));
});
