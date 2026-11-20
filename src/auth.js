// Admin login: password check, the "logged in" cookie, and a limit on wrong guesses.
//
// The first password comes from the ADMIN_PASSWORD secret set in Cloudflare (see SETUP.md).
// Once Sarah changes it in /admin, a salted hash is stored in KV ("auth:password") and used instead.

const enc = new TextEncoder();
export const COOKIE = "__Host-sb_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 30; // stay logged in for 30 days
const MAX_TRIES = 10;                       // wrong passwords allowed...
const LOCK_SECONDS = 15 * 60;               // ...per 15 minutes, per internet address
// Password hashing strength. Kept moderate because Cloudflare's free plan allows about 10 ms of
// computing per request (100,000 rounds takes ~17 ms). Guessing is already limited to 10 tries
// per 15 minutes, and the hash is only stored privately in KV.
const ITERATIONS = 20000;

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function sameString(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64url(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

async function storedPassword(env) {
  const v = await env.SITE.get("auth:password", { type: "json" });
  return v && v.hash && v.salt ? v : null;
}

// What the login cookie is signed with. Changing the password changes it, which logs out old sessions.
async function sessionSecret(env) {
  const stored = await storedPassword(env);
  if (stored) return "kv:" + stored.hash;
  if (env.ADMIN_PASSWORD) return "env:" + env.ADMIN_PASSWORD;
  return null;
}

export async function isConfigured(env) {
  return Boolean(await sessionSecret(env));
}

export async function checkPassword(env, password) {
  password = String(password || "");
  if (!password) return false;
  const stored = await storedPassword(env);
  if (stored) return sameString(await pbkdf2(password, fromB64url(stored.salt), stored.iterations || ITERATIONS), stored.hash);
  if (env.ADMIN_PASSWORD) {
    // Compare signatures rather than the passwords themselves, so the check takes the same time either way.
    const k = crypto.getRandomValues(new Uint8Array(16)).join(",");
    return sameString(await hmac(k, password), await hmac(k, env.ADMIN_PASSWORD));
  }
  return false;
}

export async function setPassword(env, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  await env.SITE.put("auth:password", JSON.stringify({ salt: b64url(salt), hash, iterations: ITERATIONS, changed: new Date().toISOString() }));
}

export async function sessionCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const sig = await hmac(await sessionSecret(env), `session|${exp}`);
  return `${COOKIE}=${exp}.${sig}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearCookie() {
  return `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export async function isLoggedIn(request, env) {
  const cookies = request.headers.get("Cookie") || "";
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE.replace(/[-]/g, "\\-")}=([^;]+)`));
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  const secret = await sessionSecret(env);
  if (!secret) return false;
  return sameString(await hmac(secret, `session|${exp}`), sig);
}

// ---------------------------------------------------------------- wrong-password limit

export function clientAddress(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "local";
}

// kind: "tries" for the admin login, "subtries" for the subscriber password.
export async function tooManyTries(env, ip, kind = "tries") {
  return (Number(await env.SITE.get(`${kind}:${ip}`)) || 0) >= MAX_TRIES;
}

export async function recordWrongTry(env, ip, kind = "tries") {
  const n = (Number(await env.SITE.get(`${kind}:${ip}`)) || 0) + 1;
  await env.SITE.put(`${kind}:${ip}`, String(n), { expirationTtl: LOCK_SECONDS });
}

export async function clearTries(env, ip, kind = "tries") {
  await env.SITE.delete(`${kind}:${ip}`);
}

// ---------------------------------------------------------------- subscriber password
// One shared password (set by Sarah in the admin, under Newsletter) opens "Subscribers only"
// pages, stories and downloads. Capital letters and spaces around it don't matter.
// The cookie is signed with the site's secret AND the password, so changing the password
// locks everyone out until they enter the new one.

export const SUB_COOKIE = "__Host-sb_sub";
// How long a device remembers the subscriber password (Sarah sets the days under Newsletter).
export function rememberSeconds(days) {
  const d = Math.round(Number(days));
  return (Number.isFinite(d) && d >= 1 ? Math.min(d, 365) : 30) * 24 * 60 * 60;
}
const normal = (pw) => String(pw || "").trim().toLowerCase();

export async function subscriberPasswordMatches(given, expected) {
  if (!normal(expected) || !normal(given)) return false;
  const k = crypto.getRandomValues(new Uint8Array(16)).join(",");
  return sameString(await hmac(k, normal(given)), await hmac(k, normal(expected)));
}

export async function subscriberCookie(env, password, days) {
  const seconds = rememberSeconds(days);
  const secret = await sessionSecret(env);
  if (!secret || !normal(password)) return null;
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const sig = await hmac(secret, `subscriber|${exp}|${normal(password)}`);
  // Lax (not Strict) so the page opens when someone arrives from a link in the newsletter email.
  return `${SUB_COOKIE}=${exp}.${sig}; Max-Age=${seconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function isSubscriber(request, env, password) {
  if (!normal(password)) return false;
  const cookies = request.headers.get("Cookie") || "";
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${SUB_COOKIE.replace(/[-]/g, "\\-")}=([^;]+)`));
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  const secret = await sessionSecret(env);
  if (!secret) return false;
  return sameString(await hmac(secret, `subscriber|${exp}|${normal(password)}`), sig);
}
