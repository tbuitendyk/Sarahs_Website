// Builds every page of the website from the site content (what Sarah edits in /admin).
// The same design as before; all words come from the content object.

import { esc, text, assetUrl, linkUrl, inline, markdown } from "../public/assets/admin/markdown.js";

const FONTS_BASE = "family=Cinzel:wght@400;600;700" +
  "&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500" +
  "&family=Lora:ital,wght@0,400;0,600;1,400";
const FONTS_HERO = "&family=Cinzel+Decorative&family=Yellowtail&family=UnifrakturMaguntia&family=Anton";

// Built-in pages and their fixed places in the main menu.
const SPECIAL_MENU = [
  { key: "home", href: "index.html", label: "Home", pos: 10 },
  { key: "blog", href: "blog.html", label: "Blog", pos: 20 },
  { key: "contact", href: "contact.html", label: "Contact", pos: 40 },
  { key: "in-progress", href: "in-progress.html", label: "In Progress", pos: 50 },
];
export const SPECIAL_SLUGS = new Set(["index", "blog", "contact", "in-progress", "404", "books", "assets", "admin", "api", "files"]);
const BOOKS_PAGE = "books"; // the page whose menu item holds the "Under My Books" dropdown

export const BOOK_LISTS = {
  "my-books": "My Books",
  "anthologies": "Anthologies",
  "igs-files": "IGS: Files",
  "subscribers": "Subscribers",
};

// ---------------------------------------------------------------- helpers

export function slugify(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
}
const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const truthy = (v) => (typeof v === "boolean" ? v : ["true", "yes", "1", "on"].includes(String(v ?? "").trim().toLowerCase()));
function asList(v) {
  if (v === null || v === undefined || v === "") return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/\s*,\s*/).filter(Boolean);
}
function listKey(v) {
  const want = squash(v);
  for (const [key, label] of Object.entries(BOOK_LISTS)) {
    if (want === squash(key) || want === squash(label)) return key;
  }
  return null;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function niceDate(value) {
  const v = text(value);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return v;
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}
function dateKey(value) {
  const m = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : "0000-00-00";
}
export function indent(s, n) {
  const pad = " ".repeat(n);
  return String(s).split("\n").map((ln) => (ln.trim() ? pad + ln : ln)).join("\n");
}
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

// What a download is called on its button, from its file type.
const FORMAT_NAMES = { pdf: "PDF", doc: "Word document", docx: "Word document", epub: "EPUB (for e-readers)", txt: "Text file" };
export function formatName(file) {
  const ext = (String(file || "").toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/) || [])[1] || "";
  return FORMAT_NAMES[ext] || (ext ? ext.toUpperCase() : "File");
}
const arr = (v) => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------- the site

export class Site {
  constructor(content) {
    const c = obj(content);
    this.warnings = [];
    this.settings = obj(c.site);
    this.home = obj(c.home);
    this.contact = obj(c.contact);
    this.newsletter = obj(c.newsletter);
    this.progress = c.progress;
    this.blog = arr(c.blog);
    this.pages = [];
    this.books = [];
    this.prepare(arr(c.pages), arr(c.books));
  }

  warn(msg) { this.warnings.push(msg); }

  prepare(pagesIn, booksIn) {
    const seenPages = new Set();
    for (const raw of pagesIn) {
      if (!raw || typeof raw !== "object" || !text(raw.title)) continue;
      const pg = { ...raw, title: text(raw.title) };
      let slug = slugify(text(pg.slug) || pg.title);
      if (SPECIAL_SLUGS.has(slug) && slug !== BOOKS_PAGE) {
        this.warn(`Page "${pg.title}": the address "${slug}" is taken by a built-in page, so it uses "${slug}-page".`);
        slug += "-page";
      }
      while (seenPages.has(slug)) slug += "-2";
      seenPages.add(slug);
      pg.slug = slug;
      pg.hidden = truthy(pg.hidden);
      this.pages.push(pg);
    }
    const seenBooks = new Set();
    for (const raw of booksIn) {
      if (!raw || typeof raw !== "object" || !text(raw.title)) continue;
      const bk = { ...raw, title: text(raw.title) };
      let id = slugify(text(bk.id) || bk.title);
      while (seenBooks.has(id)) id += "-2";
      seenBooks.add(id);
      bk.id = id;
      bk.lists = asList(bk.show_on).map(listKey).filter(Boolean);
      bk.hidden = truthy(bk.hidden);
      // Download files: the "downloads" list (one per format), plus an older single "download" if present.
      bk.files = [];
      for (const d of arr(bk.downloads)) {
        const file = text(obj(d).file);
        if (file && !bk.files.some((f) => f.file === file)) bk.files.push({ file, label: text(obj(d).label) || formatName(file) });
      }
      if (text(bk.download) && !bk.files.some((f) => f.file === text(bk.download))) {
        bk.files.push({ file: text(bk.download), label: formatName(bk.download) });
      }
      bk.has_page = Boolean(text(bk.description) || bk.files.length);
      this.books.push(bk);
    }
  }

  // -- menu ------------------------------------------------------------------
  menu() {
    const top = SPECIAL_MENU.map((m) => ({ ...m, children: [] }));
    const under = [];
    for (const pg of this.pages) {
      const where = squash(pg.menu);
      if (pg.hidden || ["", "no", "none", "notinthemenu"].includes(where)) continue;
      const raw = pg.menu_position;
      let pos = raw === "" || raw === null || raw === undefined ? 100 : Number(raw);
      if (!Number.isFinite(pos)) pos = 100;
      const item = { key: pg.slug, href: `${pg.slug}.html`, label: text(pg.menu_label) || pg.title, pos, children: [] };
      (where.includes("under") ? under : top).push(item);
    }
    top.sort((a, b) => a.pos - b.pos);
    under.sort((a, b) => a.pos - b.pos);
    const parent = top.find((t) => t.key === BOOKS_PAGE);
    if (parent) parent.children = under;
    else top.push(...under);
    return top;
  }

  header(p, current, section) {
    const cur = (key) => (key === current ? ' aria-current="page"' : key === section ? ' aria-current="true"' : "");
    const items = this.menu().map((it) => {
      if (it.children.length) {
        const subs = it.children
          .map((c) => `              <li><a href="${p}${c.href}"${cur(c.key)}>${esc(c.label)}</a></li>`)
          .join("\n");
        return `          <li class="has-sub">\n` +
          `            <a href="${p}${it.href}"${cur(it.key)}>${esc(it.label)}</a>\n` +
          `            <ul class="sub">\n${subs}\n            </ul>\n` +
          `          </li>`;
      }
      return `          <li><a href="${p}${it.href}"${cur(it.key)}>${esc(it.label)}</a></li>`;
    }).join("\n");
    const name = esc(text(this.settings.site_name) || "Sarah’s Books");
    const tagline = esc(text(this.settings.tagline));
    return `  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="${p}index.html">
        <img src="${p}assets/images/logo.png" alt="" width="60" height="59">
        <span>
          <span class="brand-name">${name}</span>
          <span class="brand-tagline">${tagline}</span>
        </span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav id="site-nav" class="site-nav" aria-label="Main">
        <ul>
${items}
        </ul>
      </nav>
    </div>
  </header>
`;
  }

  footer(p) {
    const links = this.menu().map((it) => `        <li><a href="${p}${it.href}">${esc(it.label)}</a></li>`).join("\n");
    const email = text(this.settings.email);
    const emailHtml = email ? `      <p class="footer-email"><a href="mailto:${esc(email)}">${esc(email)}</a></p>\n` : "";
    return `  <footer class="site-footer">
    <div class="wrap">
      <img src="${p}assets/images/logo.png" alt="" width="72" height="70">
      <p class="footer-tagline">${esc(text(this.settings.tagline))}</p>
      <ul class="footer-nav">
${links}
      </ul>
${emailHtml}      <p class="copyright">${esc(text(this.settings.copyright))}</p>
    </div>
  </footer>
`;
  }

  shell({ p, title, body, current, section = null, description = "", heroFonts = false, noindex = false }) {
    const name = text(this.settings.site_name) || "Sarah’s Books";
    const fullTitle = current === "home" ? name : `${title} – ${name}`;
    description = description || text(this.settings.description);
    const fonts = (FONTS_BASE + (heroFonts ? FONTS_HERO : "")).replace(/&/g, "&amp;");
    const robots = noindex ? '  <meta name="robots" content="noindex, nofollow">\n' : "";
    const kit = (this.usedSubscriberBox ? `\n  <script src="${p}assets/js/subscriber-box.js" defer></script>` : "") +
      (this.usedSignup ? '\n  <script src="https://f.convertkit.com/ckjs/ck.5.js" defer></script>' : "");
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}">
${robots}  <link rel="icon" href="${p}assets/images/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="${p}assets/images/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&amp;display=swap">
  <link rel="stylesheet" href="${p}assets/css/style.css">
  <script>document.documentElement.className += " js";</script>
  <script src="${p}assets/js/site.js" defer></script>${kit}
</head>
<body>
${this.header(p, current, section)}
  <main id="main">
${indent(body.replaceAll("{P}", p), 4)}
  </main>

${this.footer(p)}</body>
</html>
`;
  }

  // -- shared pieces -----------------------------------------------------------
  bookHref(bk) { return bk.has_page ? `{P}books/${bk.id}.html` : "#"; }

  cover(bk) {
    if (text(bk.cover)) {
      return `<img class="cover" src="${esc(assetUrl(bk.cover, "{P}"))}" alt="Cover of ${esc(bk.title)}" width="663" height="1024">`;
    }
    return '<div class="cover-placeholder">\n' +
      `  <span class="ph-title">${esc(bk.title)}</span>\n` +
      `  <span class="ph-author">${esc(text(this.settings.author) || "Sarah Buitendyk")}</span>\n` +
      '  <span class="ph-note">Cover coming soon</span>\n' +
      "</div>";
  }

  secondButton(bk) {
    if (bk.files.length === 1) {
      return `<a class="btn" href="${esc(assetUrl(bk.files[0].file, "{P}"))}" download>Download</a>`;
    }
    if (bk.files.length > 1) return `<a class="btn" href="${this.bookHref(bk)}">Download</a>`;
    const buy = linkUrl(bk.buy, "{P}") || "#";
    return `<a class="btn" href="${esc(buy)}">Buy the book</a>`;
  }

  // opts.noDownloads: leave out the Download button (readers download from the story's own page).
  bookCard(bk, opts = {}) {
    const learn = this.bookHref(bk);
    let cover = this.cover(bk);
    if (learn !== "#") cover = `<a class="cover-link" href="${learn}">\n${indent(cover, 2)}\n</a>`;
    const parts = ['<article class="book-card">', indent(cover, 2), `  <h3>${esc(bk.title)}</h3>`];
    if (text(bk.label)) parts.push(`  <p class="book-meta">${esc(bk.label)}</p>`);
    if (text(bk.card_text)) parts.push(`  <p>${inline(bk.card_text, "{P}")}</p>`);
    const second = opts.noDownloads && bk.files.length ? "" : `    ${this.secondButton(bk)}`;
    parts.push('  <div class="btn-row">',
      `    <a class="btn btn-outline" href="${learn}">Learn more</a>`,
      ...(second ? [second] : []),
      "  </div>", "</article>");
    return parts.join("\n");
  }

  bookGrid(key, opts = {}) {
    const shown = this.books.filter((b) => b.lists.includes(key));
    if (!shown.length) return '<p class="coming-soon">Coming soon…</p>';
    return '<div class="book-grid">\n' + indent(shown.map((b) => this.bookCard(b, opts)).join("\n\n"), 2) + "\n</div>";
  }

  // ---------------------------------------------------------------- newsletter (Kit)
  // The sign-up form keeps Kit's own markup and script (ck.5.js), so Kit's success message
  // and "already subscribed" message work as set up in Kit; the site's CSS styles it.
  signupBox({ heading = true } = {}) {
    const n = this.newsletter;
    const formId = text(n.kit_form_id).replace(/\D/g, "");
    const uid = text(n.kit_uid).replace(/[^a-z0-9]/gi, "");
    if (!formId || !uid) return "";
    this.usedSignup = true;
    const options = {
      settings: {
        after_subscribe: { action: "message", success_message: text(n.success_message) || "Thank you for signing up.", redirect_url: "" },
        analytics: { google: null, fathom: null, facebook: null, segment: null, pinterest: null, sparkloop: null, googletagmanager: null },
        modal: { trigger: "timer", scroll_percentage: null, timer: 5, devices: "all", show_once_every: 15 },
        powered_by: { show: true, url: "https://kit.com/features/forms?utm_campaign=poweredby&utm_content=form&utm_medium=referral&utm_source=dynamic" },
        recaptcha: { enabled: false },
        // Kit puts this message in with innerHTML, so it is escaped here.
        return_visitor: text(n.subscribed_message)
          ? { action: "custom_content", custom_content: esc(text(n.subscribed_message)) }
          : { action: "show", custom_content: "" },
        slide_in: { display_in: "bottom_right", trigger: "timer", scroll_percentage: null, timer: 5, devices: "all", show_once_every: 15 },
        sticky_bar: { display_in: "top", trigger: "timer", scroll_percentage: null, timer: 5, devices: "all", show_once_every: 15 },
      },
      version: "5",
    };
    const parts = ['<div class="signup">'];
    if (text(n.picture)) parts.push(`  <img class="signup-picture" src="${esc(assetUrl(n.picture, "{P}"))}" alt="" width="349" height="303">`);
    if (heading && text(n.heading)) parts.push(`  <h2 class="signup-heading">${esc(n.heading)}</h2>`);
    if (text(n.text)) parts.push(`  <div class="signup-text">${markdown(n.text, "{P}")}</div>`);
    parts.push(
      `  <form action="https://app.kit.com/forms/${formId}/subscriptions" class="seva-form formkit-form signup-form" method="post" ` +
      `data-sv-form="${formId}" data-uid="${uid}" data-format="inline" data-version="5" data-options="${esc(JSON.stringify(options))}">`,
      '    <ul class="formkit-alert formkit-alert-error" data-element="errors" data-group="alert"></ul>',
      '    <div data-element="fields" class="seva-fields formkit-fields">',
      `      <div class="formkit-field"><input class="formkit-input" name="email_address" type="email" required autocomplete="email" aria-label="Email address" placeholder="${esc(text(n.placeholder) || "Email Address")}"></div>`,
      `      <button data-element="submit" class="formkit-submit"><span class="formkit-spinner"><span></span><span></span><span></span></span><span class="formkit-label">${esc(text(n.button) || "Subscribe")}</span></button>`,
      "    </div>",
      text(n.small_print) ? `    <p class="formkit-guarantee" data-element="guarantee">${esc(n.small_print)}</p>` : "",
      '    <p class="formkit-powered-by-convertkit-container"><a href="https://kit.com/features/forms?utm_campaign=poweredby&amp;utm_content=form&amp;utm_medium=referral&amp;utm_source=dynamic" data-element="powered-by" class="formkit-powered-by-convertkit" target="_blank" rel="nofollow noopener">Built with Kit</a></p>',
      "  </form>",
      "</div>");
    return parts.filter(Boolean).join("\n");
  }

  subscriberPassword() { return text(this.newsletter.subscriber_password); }

  // Shown instead of a "Subscribers only" page or story until the subscriber password is entered.
  lockedView(title, eyebrow, pathname, error) {
    const n = this.newsletter;
    const message = markdown(text(n.locked_message) || "This page is for newsletter subscribers. Please enter the subscriber password from your newsletter email.", "{P}");
    const form = this.subscriberPassword()
      ? `<form class="lock-form" method="post" action="{P}subscribers/unlock">
    <input type="hidden" name="next" value="${esc(pathname)}">
    <label for="sub-password">Subscriber password</label>
    <div class="lock-row">
      <input id="sub-password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit" class="btn">Open</button>
    </div>
  </form>`
      : '<p class="coming-soon">This page isn’t open yet.</p>';
    const err = error ? `\n  <p class="lock-error" role="alert">${esc(error)}</p>` : "";
    const signup = this.signupBox();
    return this.pageHero(title, eyebrow) + `

<section class="section">
  <div class="wrap">
    <div class="lock">
      ${message}${err}
      ${form}
    </div>${signup ? "\n" + indent(`<div class="lock-signup">\n${indent(signup, 2)}\n</div>`, 4) : ""}
  </div>
</section>
`;
  }

  // The page the "Already a subscriber?" box opens (set under Newsletter; a page's web address name).
  subscriberPage() {
    const want = slugify(text(this.newsletter.subscriber_page));
    return this.pages.find((pg) => pg.slug === want) || this.pages.find((pg) => truthy(pg.subscribers_only)) || null;
  }

  // "Already a subscriber?" box for public pages. A subscriber who already entered the password gets a button instead.
  unlockBox(currentPath, opts = {}) {
    const target = this.subscriberPage();
    if (!target || !this.subscriberPassword()) return "";
    const href = `{P}${target.slug}.html`;
    const prompt = markdown(text(this.newsletter.unlock_prompt) || "Already a subscriber? Enter the subscriber password from your newsletter email to read the stories.", "{P}");
    if (opts.subscriber) {
      return `<div class="lock lock-public">\n  <div class="btn-row btn-row-center"><a class="btn" href="${href}">Open the subscriber stories</a></div>\n</div>`;
    }
    const err = opts.error ? `\n  <p class="lock-error" role="alert">${esc(opts.error)}</p>` : "";
    return `<div class="lock lock-public">
  ${prompt}${err}
  <form class="lock-form" method="post" action="{P}subscribers/unlock">
    <input type="hidden" name="next" value="/${esc(target.slug)}.html">
    <input type="hidden" name="back" value="${esc(currentPath)}">
    <label for="sub-password">Subscriber password</label>
    <div class="lock-row">
      <input id="sub-password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit" class="btn">Open</button>
    </div>
  </form>
</div>`;
  }

  // Downloads of "Subscribers only" books (e.g. "assets/downloads/words-of-love.docx" or "files/x.pdf").
  isProtectedFile(pathname) {
    const want = String(pathname || "").replace(/^\/+/, "");
    return this.books.some((b) => truthy(b.subscribers_only) && b.files.some((f) => f.file.replace(/^\/+/, "") === want));
  }

  // The book a download file belongs to.
  bookForFile(pathname) {
    const want = String(pathname || "").replace(/^\/+/, "");
    return this.books.find((b) => b.files.some((f) => f.file.replace(/^\/+/, "") === want)) || null;
  }

  pageHero(title, eyebrow = "", lede = "") {
    const parts = ['<section class="page-hero">', '  <div class="wrap">'];
    if (text(eyebrow)) parts.push(`    <p class="eyebrow">${esc(eyebrow)}</p>`);
    parts.push(`    <h1>${esc(title)}</h1>`);
    if (text(lede)) parts.push(`    <p class="lede">${inline(lede, "{P}")}</p>`);
    parts.push("  </div>", "</section>");
    return parts.join("\n");
  }

  // -- pages -------------------------------------------------------------------
  home_(p) {
    const h = this.home;
    const rr = obj(h.recent_release);
    const ab = obj(h.about);
    const hero = obj(h.hero);

    let recent = "";
    if (text(rr.title)) {
      let cover = "";
      if (text(rr.cover)) {
        const img = `<img class="cover" src="${esc(assetUrl(rr.cover, "{P}"))}" alt="Cover of ${esc(rr.title)}" width="663" height="1024">`;
        const learn = linkUrl(rr.learn_more, "{P}");
        cover = learn
          ? `      <a class="feature-media" href="${esc(learn)}">\n        ${img}\n      </a>`
          : `      <div class="feature-media">\n        ${img}\n      </div>`;
      }
      let quote = "";
      if (text(rr.quote)) {
        const cite = text(rr.quote_source) ? `\n          <cite>${esc(rr.quote_source)}</cite>` : "";
        quote = `        <blockquote class="verse">\n          <p>${inline(rr.quote, "{P}")}</p>${cite}\n        </blockquote>\n`;
      }
      const buttons = [];
      if (text(rr.learn_more)) buttons.push(`          <a class="btn btn-outline" href="${esc(linkUrl(rr.learn_more, "{P}"))}">Learn more</a>`);
      if (text(rr.buy)) buttons.push(`          <a class="btn" href="${esc(linkUrl(rr.buy, "{P}"))}">Buy the book</a>`);
      const btns = buttons.length ? '        <div class="btn-row">\n' + buttons.join("\n") + "\n        </div>\n" : "";
      const eyebrow = text(rr.label) ? `        <p class="eyebrow">${esc(rr.label)}</p>\n` : "";
      recent = `
<section class="section">
  <div class="wrap">
    <h2 class="section-title">${esc(text(rr.section_title) || "Recent Release")}</h2>
    <div class="feature">
${cover}
      <div>
${eyebrow}        <h3 class="feature-title">${esc(rr.title)}</h3>
${quote}        ${markdown(rr.text, "{P}")}
${btns}      </div>
    </div>
  </div>
</section>
`;
    }

    let about = "";
    if (text(ab.text)) {
      let photo = "";
      if (text(ab.photo)) {
        photo = `      <div class="feature-media">\n        <img class="portrait" src="${esc(assetUrl(ab.photo, "{P}"))}" ` +
          `alt="${esc(text(ab.photo_description) || "Sarah Buitendyk")}" width="645" height="883">\n      </div>\n`;
      }
      const layout = photo ? "feature feature-reverse" : "prose prose-center";
      about = `
<section class="section section-alt">
  <div class="wrap">
    <h2 class="section-title">${esc(text(ab.section_title) || "About Me")}</h2>
    <div class="${layout}">
${photo}      <div class="prose">
${indent(markdown(ab.text, "{P}"), 8)}
      </div>
    </div>
  </div>
</section>
`;
    }

    const cols = [];
    for (const k of ["reviews", "newsletter"]) {
      const blk = obj(h[k]);
      if (text(blk.title)) {
        const words = text(blk.text) ? `        <div class="coming-soon">${markdown(blk.text, "{P}")}</div>\n` : "";
        const form = k === "newsletter" && truthy(blk.show_signup) ? this.signupBox({ heading: false }) : "";
        cols.push(`      <div>\n        <h2 class="section-title">${esc(blk.title)}</h2>\n${words}` +
          (form ? indent(form, 8) + "\n" : "") + "      </div>");
      }
    }
    const extra = cols.length
      ? '\n<section class="section">\n  <div class="wrap">\n    <div class="two-col">\n' + cols.join("\n") + "\n    </div>\n  </div>\n</section>\n"
      : "";

    const middleWords = text(hero.middle).split(/\s+/).filter(Boolean)
      .map((w) => `        <span class="g-epic">${esc(w)}</span>`).join("\n");
    const body = `<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <p class="hero-welcome">${esc(text(hero.welcome))}</p>
    <h1 class="hero-genres" id="hero-title">
      <span class="g-romance">${esc(text(hero.left))}</span>
      <span class="g-middle">
${middleWords}
        <span class="g-and">${esc(text(hero.middle_small))}</span>
      </span>
      <span class="g-suspense">${esc(text(hero.right))}</span>
    </h1>
  </div>
</section>
${recent}${about}${extra}`;
    return this.shell({ p, title: "Home", body, current: "home", heroFonts: true });
  }

  contact_(p) {
    const c = this.contact;
    const email = text(this.settings.email);
    const note = text(c.note) ? `    <div class="callout">\n      ${markdown(c.note, "{P}")}\n    </div>\n` : "";
    const button = text(c.button_label);
    const btn = button && email
      ? `    <div class="btn-row btn-row-center">\n      <a class="btn" href="mailto:${esc(email)}">${esc(button)}</a>\n    </div>\n`
      : "";
    const direct = email
      ? `    <p class="contact-direct">${inline(c.direct_text, "{P}")}<br>\n      <a class="email-big" href="mailto:${esc(email)}">${esc(email)}</a></p>\n`
      : "";
    const heading = text(c.heading) ? `    <h2 class="section-title">${esc(c.heading)}</h2>\n` : "";
    const signup = truthy(c.show_signup) ? this.signupBox() : "";
    const top = signup ? indent(`<div class="contact-signup">\n${indent(signup, 2)}\n</div>`, 4) + "\n" : "";
    const title = text(c.title) || "Contact";
    const body = this.pageHero(title) + `

<section class="section">
  <div class="wrap wrap-narrow center">
${note}${top}${heading}    ${markdown(c.text, "{P}")}
${btn}${direct}  </div>
</section>
`;
    return this.shell({ p, title, body, current: "contact", description: text(c.description) });
  }

  progress_(p) {
    const pr = Array.isArray(this.progress) ? { items: this.progress } : obj(this.progress);
    const cards = [];
    for (const it of arr(pr.items)) {
      if (!it || typeof it !== "object" || !text(it.title)) continue;
      const link = linkUrl(it.link, "{P}");
      const title = link ? `<a href="${esc(link)}">${esc(it.title)}</a>` : esc(it.title);
      let bar = "";
      if (truthy(it.show_bar)) {
        let pct = Number(it.percent || 0);
        if (!Number.isFinite(pct)) pct = 0;
        pct = Math.max(0, Math.min(100, pct));
        bar = `\n  <div class="progress" style="--percent: ${pct}" aria-hidden="true"><div class="progress-fill"></div></div>`;
      }
      cards.push(`<article class="wip">\n  <h3>${title}</h3>\n  ${markdown(it.text, "{P}")}${bar}\n</article>`);
    }
    const listing = cards.length
      ? '<div class="wip-list">\n' + indent(cards.join("\n\n"), 2) + "\n</div>"
      : '<p class="coming-soon">Coming soon…</p>';
    const title = text(pr.title) || "In Progress";
    const body = this.pageHero(title, text(pr.eyebrow)) + `

<section class="section">
  <div class="wrap">
${indent(listing, 4)}
  </div>
</section>
`;
    return this.shell({ p, title, body, current: "in-progress", description: text(pr.description) });
  }

  blog_(p) {
    const posts = this.blog.filter((x) => x && typeof x === "object" && (text(x.title) || text(x.body)));
    posts.sort((a, b) => (dateKey(a.date) < dateKey(b.date) ? 1 : dateKey(a.date) > dateKey(b.date) ? -1 : 0));
    const used = new Set();
    const arts = posts.map((post) => {
      let pid = slugify(`${text(post.date)} ${text(post.title)}`);
      while (used.has(pid)) pid += "-2";
      used.add(pid);
      const when = niceDate(post.date);
      const dateHtml = when ? `  <p class="post-date"><time datetime="${esc(dateKey(post.date))}">${esc(when)}</time></p>\n` : "";
      return `<article class="post" id="${pid}">\n${dateHtml}` +
        `  <h2><a href="#${pid}">${esc(text(post.title))}</a></h2>\n` +
        `  <div class="prose">\n${indent(markdown(post.body, "{P}"), 4)}\n  </div>\n</article>`;
    });
    const feed = arts.length
      ? '<div class="post-feed">\n' + indent(arts.join("\n\n"), 2) + "\n</div>"
      : '<p class="coming-soon">Coming soon…</p>';
    const body = this.pageHero("Blog") + `

<section class="section">
  <div class="wrap">
${indent(feed, 4)}
  </div>
</section>
`;
    return this.shell({ p, title: "Blog", body, current: "blog", description: "News and writing updates from author Sarah Buitendyk." });
  }

  page_(pg, p, opts = {}) {
    const section = squash(pg.menu).includes("under") ? BOOKS_PAGE : null;
    if (truthy(pg.subscribers_only) && !opts.subscriber) {
      return this.shell({ p, title: pg.title, body: this.lockedView(pg.title, text(pg.eyebrow), opts.pathname, opts.error),
        current: pg.slug, section, description: text(pg.description), noindex: true });
    }
    const parts = [this.pageHero(pg.title, text(pg.eyebrow), text(pg.intro))];
    const key = text(pg.book_list) ? listKey(pg.book_list) : null;
    const bodyMd = text(pg.body);
    if (bodyMd || text(pg.photo)) {
      const content = markdown(bodyMd, "{P}");
      let inner;
      if (text(pg.photo)) {
        inner = '<div class="feature">\n  <div class="feature-media">\n' +
          `    <img class="portrait" src="${esc(assetUrl(pg.photo, "{P}"))}" alt="${esc(text(pg.photo_description) || pg.title)}">\n  </div>\n` +
          `  <div class="prose">\n${indent(content, 4)}\n  </div>\n</div>`;
      } else if (truthy(pg.centered)) {
        inner = `<div class="prose prose-center center">\n${indent(content, 2)}\n</div>`;
      } else {
        inner = `<div class="prose prose-center">\n${indent(content, 2)}\n</div>`;
      }
      parts.push(`\n<section class="section">\n  <div class="wrap">\n${indent(inner, 4)}\n  </div>\n</section>`);
    }
    // "Already a subscriber?" password box comes before the sign-up form.
    if (truthy(pg.unlock_box)) {
      const box = this.unlockBox(opts.pathname, opts);
      // The password box is only for people who signed up (Kit remembers that on their device), so it
      // starts hidden and subscriber-box.js shows it. It stays visible after a wrong try, and people who
      // already entered the password get the "Open the subscriber stories" button instead.
      const startHidden = box && !opts.subscriber && !opts.error;
      if (startHidden) this.usedSubscriberBox = true;
      if (box) parts.push(`\n<section class="section section-unlock"${startHidden ? " data-subscriber-box hidden" : ""}>\n  <div class="wrap">\n${indent(box, 4)}\n  </div>\n</section>`);
    }
    if (truthy(pg.signup)) {
      const signup = this.signupBox();
      if (signup) parts.push(`\n<section class="section section-signup">\n  <div class="wrap">\n${indent(signup, 4)}\n  </div>\n</section>`);
    }
    if (key) {
      const heading = text(pg.book_list_heading);
      const alt = bodyMd ? " section-alt" : "";
      const head = heading ? `    <h2 class="section-title">${esc(heading)}</h2>\n` : "";
      parts.push(`\n<section class="section${alt}">\n  <div class="wrap">\n${head}${indent(this.bookGrid(key, { noDownloads: truthy(pg.hide_card_downloads) }), 4)}\n  </div>\n</section>`);
    }
    return this.shell({ p, title: pg.title, body: parts.join("\n") + "\n", current: pg.slug, section,
      description: text(pg.description), noindex: pg.hidden });
  }

  book_(bk, p, opts = {}) {
    if (truthy(bk.subscribers_only) && !opts.subscriber) {
      return this.shell({ p, title: bk.title, body: this.lockedView(bk.title, text(bk.label), opts.pathname, opts.error),
        current: `book-${bk.id}`, section: BOOKS_PAGE, noindex: true });
    }
    let cover = this.cover(bk);
    const buy = linkUrl(bk.buy, "{P}");
    cover = buy && !bk.files.length
      ? `<a class="feature-media" href="${esc(buy)}">\n${indent(cover, 2)}\n</a>`
      : `<div class="feature-media">\n${indent(cover, 2)}\n</div>`;
    const content = markdown(bk.description, "{P}") || '<p class="coming-soon">More about this book coming soon…</p>';
    let extra = "";
    if (bk.files.length) {
      // Older content has no heading field: keep Sarah's original "Docs Download:" there.
      const heading = bk.download_heading === undefined ? "Docs Download:" : text(bk.download_heading);
      if (heading) extra += `\n<h2>${esc(heading)}</h2>`;
      extra += '\n<div class="downloads">';
      for (const f of bk.files) {
        extra += '\n  <div class="download">\n' +
          `    <span class="download-name">${esc(bk.title)} <small>${esc(f.label)}</small></span>\n` +
          `    <a class="btn" href="${esc(assetUrl(f.file, "{P}"))}" download aria-label="Download ${esc(bk.title)} as ${esc(f.label)}">Download</a>\n` +
          "  </div>";
      }
      extra += "\n</div>";
      if (text(bk.download_note)) extra += `\n<p><strong>${inline(bk.download_note, "{P}")}</strong></p>`;
    } else {
      extra += `\n<div class="btn-row">\n  ${this.secondButton(bk)}\n</div>`;
    }
    const body = this.pageHero(bk.title, text(bk.label)) + `

<section class="section">
  <div class="wrap">
    <div class="feature">
${indent(cover, 6)}
      <div class="prose">
${indent(content + extra, 8)}
      </div>
    </div>
  </div>
</section>
`;
    return this.shell({ p, title: bk.title, body, current: `book-${bk.id}`, section: BOOKS_PAGE,
      description: text(bk.card_text).slice(0, 200), noindex: bk.hidden });
  }

  notFound_(p) {
    const body = this.pageHero("Page not found") + `

<section class="section">
  <div class="wrap center">
    <p>Sorry, that page couldn’t be found.</p>
    <div class="btn-row btn-row-center"><a class="btn" href="{P}index.html">Go to the home page</a></div>
  </div>
</section>
`;
    return this.shell({ p, title: "Page not found", body, current: "404", noindex: true });
  }

  // -- addresses ---------------------------------------------------------------
  // Returns { status, html } for a path like "/", "/about.html", "/books/igs-1.html".
  // opts.subscriber: the visitor entered the subscriber password. opts.error: message for the lock screen.
  render(pathname, opts = {}) {
    this.usedSignup = false;
    this.usedSubscriberBox = false;
    const lockOpts = { subscriber: !!opts.subscriber, error: opts.error || "", pathname: pathname || "/" };
    let path = decodeURIComponent(pathname || "/");
    const depth = Math.max(0, path.replace(/^\/+/, "").split("/").length - 1);
    const p = "../".repeat(depth);
    path = path.replace(/^\/+/, "").replace(/\.html$/, "");
    if (path === "" || path === "index") return { status: 200, html: this.home_(p) };
    if (path === "blog") return { status: 200, html: this.blog_(p) };
    if (path === "contact") return { status: 200, html: this.contact_(p) };
    if (path === "in-progress") return { status: 200, html: this.progress_(p) };
    const bm = path.match(/^books\/([a-z0-9-]+)$/);
    if (bm) {
      const bk = this.books.find((b) => b.id === bm[1] && b.has_page);
      if (bk) return { status: 200, html: this.book_(bk, p, lockOpts), locked: truthy(bk.subscribers_only) };
    } else if (/^[a-z0-9-]+$/.test(path)) {
      const pg = this.pages.find((x) => x.slug === path);
      if (pg) return { status: 200, html: this.page_(pg, p, lockOpts), locked: truthy(pg.subscribers_only) || truthy(pg.unlock_box) };
    }
    return { status: 404, html: this.notFound_(p) };
  }

  // Every address on the site, for the static copy used by previews.
  allPaths() {
    return ["index.html", "blog.html", "contact.html", "in-progress.html",
      ...this.pages.map((pg) => `${pg.slug}.html`),
      ...this.books.filter((b) => b.has_page).map((b) => `books/${b.id}.html`)];
  }
}
