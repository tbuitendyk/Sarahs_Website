// Saves a plain copy of the website (and a practice version of the admin) into a folder,
// for previews. The real site doesn't use this; Cloudflare runs functions/[[path]].js.
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
for (const p of site.allPaths()) {
  const file = path.join(OUT, p);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, site.render("/" + p).html);
}

// Practice admin: any password works, and changes stay in the browser.
const rel = (html) => html.replace(/(href|src)="\/(?!\/)/g, '$1="');
fs.writeFileSync(path.join(OUT, "admin-login.html"),
  rel(loginPage()).replace('action="/admin/login"', 'action="admin.html"').replace('method="post"', 'method="get"').replace('href="/"', 'href="index.html"'));
fs.writeFileSync(path.join(OUT, "admin.html"),
  rel(adminPage()).replace('<script type="module"', '<script>window.SB_DEMO = true;</script>\n  <script type="module"'));
fs.writeFileSync(path.join(OUT, "demo-content.json"), JSON.stringify(content));

console.log(`Saved ${site.allPaths().length} pages and the practice admin to ${path.relative(process.cwd(), OUT) || "."}/`);
if (site.warnings.length) console.log("Warnings:", site.warnings.join(" "));
