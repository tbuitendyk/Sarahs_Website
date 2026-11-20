// Saves a plain copy of the website (and a practice version of the admin) into a folder,
// for previews. The real site doesn't use this; Cloudflare runs functions/[[path]].js.
// In the copy, nothing is sent to Kit (a practice script shows Kit's messages), and any
// subscriber password opens "Subscribers only" pages (they are saved as *.unlocked.html too).
//
//   node tools/export-static.mjs [output-folder] [content.json]
//
// Without a content file it uses the starting content in src/defaults.js.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Site } from "../src/render.js";
import defaults from "../src/defaults.js";
import { loginPage, adminPage } from "../src/admin-pages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "_preview"));
const content = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : defaults;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "public", "assets"), path.join(OUT, "assets"), { recursive: true });

const site = new Site(content);
const unlockedName = (p) => p.replace(/\.html$/, ".unlocked.html");
const practice = (html, p) => {
  const up = "../".repeat(p.split("/").length - 1);
  return html
    // Kit: never send anything from a preview
    .replace('<script src="https://f.convertkit.com/ckjs/ck.5.js" defer></script>', `<script src="${up}assets/preview/kit-practice.js" defer></script>`)
    .replace(/action="https:\/\/app\.kit\.com\/forms\/\d+\/subscriptions"/g, 'action="#"');
};
const write = (p, html) => {
  const file = path.join(OUT, p);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};
const locked = [];
for (const p of site.allPaths()) {
  const r = site.render("/" + p);
  if (r.locked) locked.push(p);
  write(p, practice(r.html, p));
}
// Locked pages: the password box opens the unlocked copy (any password, preview only).
for (const p of locked) {
  const base = path.basename(p);
  let lockedHtml = fs.readFileSync(path.join(OUT, p), "utf8")
    .replace(/<form class="lock-form" method="post" action="[^"]*">/, `<form class="lock-form" method="get" action="${unlockedName(base)}">`)
    .replace("</body>", `<script>document.querySelector(".lock-form").addEventListener("submit", function (e) { e.preventDefault(); location.href = "${unlockedName(base)}"; });</script>\n</body>`);
  write(p, lockedHtml);
  let open = practice(site.render("/" + p, { subscriber: true }).html, p);
  for (const q of locked) open = open.split(`/${path.basename(q)}"`).join(`/${unlockedName(path.basename(q))}"`).split(`"${q}"`).join(`"${unlockedName(q)}"`);
  write(unlockedName(p), open);
}
fs.mkdirSync(path.join(OUT, "assets", "preview"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "tools", "preview", "kit-practice.js"), path.join(OUT, "assets", "preview", "kit-practice.js"));

// Practice admin: any password works, and changes stay in the browser.
const rel = (html) => html.replace(/(href|src)="\/(?!\/)/g, '$1="');
fs.writeFileSync(path.join(OUT, "admin-login.html"),
  rel(loginPage()).replace('action="/admin/login"', 'action="admin.html"').replace('method="post"', 'method="get"').replace('href="/"', 'href="index.html"')
    .replace("</body>", '  <script>document.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); location.href = "admin.html"; });</script>\n</body>'));
fs.writeFileSync(path.join(OUT, "admin.html"),
  rel(adminPage()).replace('<script type="module"', '<script>window.SB_DEMO = true;</script>\n  <script type="module"'));
fs.writeFileSync(path.join(OUT, "demo-content.json"), JSON.stringify(content));

console.log(`Saved ${site.allPaths().length} pages and the practice admin to ${path.relative(process.cwd(), OUT) || "."}/`);
if (site.warnings.length) console.log("Warnings:", site.warnings.join(" "));
