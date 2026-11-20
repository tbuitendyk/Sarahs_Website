// The two admin screens the server sends: the login page and the editor shell.
// The editor itself is public/assets/admin/admin.js, which talks to /api/admin/*.

import { esc } from "../public/assets/admin/markdown.js";

const head = (title) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)}</title>
  <link rel="icon" href="/assets/images/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,500&amp;family=Lora:ital,wght@0,400;0,600;1,400&amp;display=swap">
  <link rel="stylesheet" href="/assets/admin/admin.css">
</head>`;

export function loginPage({ error = "", notSetUp = false } = {}) {
  const message = error ? `<p class="login-error" role="alert">${esc(error)}</p>` : "";
  const setup = notSetUp
    ? '<p class="login-error" role="alert">The admin password hasn’t been set up yet. Follow step 3 in SETUP.md (add the ADMIN_PASSWORD secret in Cloudflare).</p>'
    : "";
  return `${head("Log in – Sarah’s Books admin")}
<body class="login-body">
  <main class="login-card">
    <img src="/assets/images/logo.png" alt="" width="88" height="86">
    <h1>Sarah’s Books</h1>
    <p class="login-sub">Admin</p>
    ${message}${setup}
    <form method="post" action="/admin/login">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit" class="btn btn-primary">Log in</button>
    </form>
    <p class="login-back"><a href="/">← Back to the website</a></p>
  </main>
</body>
</html>
`;
}

export function adminPage() {
  return `${head("Admin – Sarah’s Books")}
<body>
  <div id="app" class="app-loading">Loading…</div>
  <noscript>The admin needs JavaScript turned on.</noscript>
  <script type="module" src="/assets/admin/admin.js"></script>
</body>
</html>
`;
}

// Security headers for every admin response.
export const ADMIN_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; "),
};
