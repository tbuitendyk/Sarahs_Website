// Cloudflare Pages Function that runs the whole site (every address except /assets/*, see public/_routes.json).
//
//   /, /about.html, /books/igs-1.html ...   website pages, built from the saved content
//   /files/<name>                           pictures and files uploaded in the admin
//   /subscribers/unlock                     checks the subscriber password, then goes back to the page
//   /admin                                  login page, or the editor once logged in
//   /admin/login, /admin/logout             log in / out
//   /api/admin/...                          what the editor uses to load and save (login required)
//
// Needs: a KV namespace bound as SITE, and an ADMIN_PASSWORD secret (see SETUP.md).

import { Site } from "../src/render.js";
import * as store from "../src/store.js";
import * as auth from "../src/auth.js";
import { loginPage, adminPage, ADMIN_HEADERS } from "../src/admin-pages.js";

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const adminHtml = (html, status = 200, extra = {}) => new Response(html, { status, headers: { ...ADMIN_HEADERS, ...extra } });

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (!env.SITE) {
    return new Response("The site isn't finished being set up: the KV namespace isn't connected as SITE. See SETUP.md, step 2.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  try {
    if (path === "/admin/") return Response.redirect(new URL("/admin", url), 301);
    if (path === "/admin") return await adminHome(request, env);
    if (path === "/admin/login") return await login(request, env);
    if (path === "/admin/logout") {
      return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": auth.clearCookie() } });
    }
    if (path.startsWith("/api/admin/")) return await api(request, env, path.slice("/api/admin/".length));
    if (path === "/subscribers/unlock") return await unlock(request, env);
    if (path.startsWith("/files/")) return await serveFile(request, env, path.slice("/files/".length));

    // Real files in public/ (robots.txt, /assets/downloads/...) are served as they are,
    // except the downloads of "Subscribers only" stories, which need the subscriber password.
    if (path.startsWith("/assets/") || (/\.[a-z0-9]+$/i.test(path) && !path.endsWith(".html"))) {
      const locked = await lockedFile(request, env, path);
      return locked || context.next();
    }

    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

    const { data } = await store.getContent(env);
    const site = new Site(data);
    const subscriber = await auth.isSubscriber(request, env, site.subscriberPassword());
    const error = url.searchParams.get("wrong") === "1" ? "That password isn’t right. Please check your newsletter email and try again."
      : url.searchParams.get("wait") === "1" ? "Too many wrong passwords. Please wait 15 minutes, then try again." : "";
    const { status, html, locked } = site.render(path, { subscriber, error });
    return new Response(request.method === "HEAD" ? null : html, {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Subscriber pages must never be kept by a shared cache.
        "cache-control": locked ? "private, no-store" : "no-cache",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("Sorry, something went wrong on this page. Please try again in a minute.", {
      status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

// ---------------------------------------------------------------- admin screens

async function adminHome(request, env) {
  if (await auth.isLoggedIn(request, env)) return adminHtml(adminPage());
  return adminHtml(loginPage({ notSetUp: !(await auth.isConfigured(env)) }));
}

async function login(request, env) {
  if (request.method !== "POST") return Response.redirect(new URL("/admin", request.url), 303);
  if (!(await auth.isConfigured(env))) return adminHtml(loginPage({ notSetUp: true }), 503);
  const ip = auth.clientAddress(request);
  if (await auth.tooManyTries(env, ip)) {
    return adminHtml(loginPage({ error: "Too many wrong passwords. Please wait 15 minutes, then try again." }), 429);
  }
  let password = "";
  try {
    password = String((await request.formData()).get("password") || "");
  } catch { /* empty or unreadable form */ }
  if (await auth.checkPassword(env, password)) {
    await auth.clearTries(env, ip);
    return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": await auth.sessionCookie(env) } });
  }
  await auth.recordWrongTry(env, ip);
  return adminHtml(loginPage({ error: "That password isn’t right. Please try again." }), 401);
}

// ---------------------------------------------------------------- the editor's API

async function api(request, env, route) {
  if (!(await auth.isLoggedIn(request, env))) return json({ error: "Please log in again." }, 401);
  const method = request.method;
  // Only the admin editor can make changes: it always sends this header, which other websites can't.
  if (method !== "GET" && request.headers.get("X-SB-Admin") !== "1") return json({ error: "Not allowed." }, 403);

  if (route === "content" && method === "GET") {
    const c = await store.getContent(env);
    return json({ data: c.data, version: c.version, savedAt: c.savedAt });
  }
  if (route === "content" && method === "PUT") {
    const body = await readJson(request);
    if (!body) return json({ error: "Nothing was sent." }, 400);
    const res = await store.saveContent(env, body.data, body.baseVersion);
    if (res.conflict) return json({ error: "The site was changed somewhere else (another tab or device). Reload to see the latest version.", ...res }, 409);
    if (res.error) return json(res, 400);
    return json({ ...res, warnings: new Site(body.data).warnings });
  }
  if (route === "history" && method === "GET") return json({ backups: await store.listBackups(env) });
  if (route === "restore" && method === "POST") {
    const body = await readJson(request);
    const res = await store.restoreBackup(env, body?.key);
    return json(res, res.error ? 400 : 200);
  }
  if (route === "files" && method === "GET") return json({ files: await store.listFiles(env) });
  if (route === "upload" && method === "POST") {
    const filename = new URL(request.url).searchParams.get("filename") || "";
    const length = Number(request.headers.get("content-length") || 0);
    if (length > store.MAX_UPLOAD_BYTES) return json({ error: "The file is too big (10 MB at most)." }, 413);
    const res = await store.putFile(env, filename, await request.arrayBuffer());
    return json(res, res.error ? 400 : 201);
  }
  if (route.startsWith("files/") && method === "DELETE") {
    const res = await store.deleteFile(env, decodeURIComponent(route.slice(6)));
    return json(res, res.error ? 400 : 200);
  }
  if (route === "password" && method === "POST") {
    const body = await readJson(request);
    if (!(await auth.checkPassword(env, body?.current))) return json({ error: "Your current password isn’t right." }, 400);
    const next = String(body?.next || "");
    if (next.length < 10) return json({ error: "Please choose a password of at least 10 characters." }, 400);
    await auth.setPassword(env, next);
    return json({ ok: true }, 200, { "set-cookie": await auth.sessionCookie(env) });
  }
  return json({ error: "Unknown request." }, 404);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- subscriber password

async function unlock(request, env) {
  const url = new URL(request.url);
  if (request.method !== "POST") return Response.redirect(new URL("/", url), 303);
  let form;
  try { form = await request.formData(); } catch { form = new FormData(); }
  // Only go to pages on this site. "next" is where the password leads; "back" is where to show a mistake.
  const local = (v, fallback) => {
    v = String(v || "");
    return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
  };
  const next = local(form.get("next"), "/");
  const retry = local(form.get("back"), next);
  const back = (flag) => new Response(null, { status: 303, headers: { location: `${retry}?${flag}=1` } });

  const ip = auth.clientAddress(request);
  if (await auth.tooManyTries(env, ip, "subtries")) return back("wait");
  const { data } = await store.getContent(env);
  const password = new Site(data).subscriberPassword();
  if (await auth.subscriberPasswordMatches(form.get("password"), password)) {
    await auth.clearTries(env, ip, "subtries");
    const cookie = await auth.subscriberCookie(env, password);
    return new Response(null, { status: 303, headers: { location: next, ...(cookie ? { "set-cookie": cookie } : {}) } });
  }
  await auth.recordWrongTry(env, ip, "subtries");
  return back("wrong");
}

// A download that belongs to a "Subscribers only" story: show the story's lock screen instead.
async function lockedFile(request, env, path) {
  const { data } = await store.getContent(env);
  const site = new Site(data);
  if (!site.isProtectedFile(path)) return null;
  if (await auth.isSubscriber(request, env, site.subscriberPassword())) return null;
  const book = site.books.find((b) => String(b.download || "").replace(/^\/+/, "") === path.replace(/^\/+/, ""));
  const target = book && book.has_page ? `/books/${book.id}.html` : "/";
  return new Response(null, { status: 303, headers: { location: target, "cache-control": "private, no-store" } });
}

// ---------------------------------------------------------------- uploaded files

async function serveFile(request, env, name) {
  const locked = await lockedFile(request, env, `/files/${name}`);
  if (locked) return locked;
  const isPrivate = new Site((await store.getContent(env)).data).isProtectedFile(`/files/${name}`);
  const file = await store.getFile(env, decodeURIComponent(name));
  if (!file) {
    const { data } = await store.getContent(env);
    return new Response(new Site(data).render("/files/missing").html, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const headers = {
    "content-type": file.metadata.type || "application/octet-stream",
    // Subscriber downloads must never be kept by a shared cache; everything else can be cached for a year.
    "cache-control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  };
  if (!store.isImageName(name)) headers["content-disposition"] = `attachment; filename="${name}"`;
  return new Response(request.method === "HEAD" ? null : file.value, { headers });
}
