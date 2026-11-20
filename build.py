#!/usr/bin/env python3
"""Builds the Sarah's Books website.

Reads the words and settings in content/*.json (which Sarah edits in the Pages CMS
dashboard) and writes the finished website into the _site/ folder.

    python3 build.py

The host (Cloudflare Pages) runs this automatically after every change, with
build command `python3 build.py` and output directory `_site`.
Uses only the Python standard library.
"""

import html
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
OUT = ROOT / "_site"

FONTS_BASE = ("family=Cinzel:wght@400;600;700"
              "&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500"
              "&family=Lora:ital,wght@0,400;0,600;1,400")
FONTS_HERO = ("&family=Cinzel+Decorative&family=Yellowtail"
              "&family=UnifrakturMaguntia&family=Anton")

# Built-in pages and their fixed places in the main menu. Pages from
# content/pages.json slot in between them using their "menu position".
SPECIAL_MENU = [
    ("home", "index.html", "Home", 10),
    ("blog", "blog.html", "Blog", 20),
    ("contact", "contact.html", "Contact", 40),
    ("in-progress", "in-progress.html", "In Progress", 50),
]
SPECIAL_SLUGS = {"index", "blog", "contact", "in-progress", "404", "books", "assets"}
BOOKS_PAGE = "books"  # the page whose menu item holds the "Under My Books" dropdown

BOOK_LISTS = {"my-books": "My Books", "anthologies": "Anthologies",
              "igs-files": "IGS: Files", "subscribers": "Subscribers"}

WARNINGS = []


def warn(msg):
    WARNINGS.append(msg)
    print("WARNING:", msg)


# ----------------------------------------------------------------------------
# Small helpers
# ----------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s or ""), quote=True)


def text(v):
    """A field value as a clean string ('' for missing)."""
    if v is None:
        return ""
    return str(v).strip()


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    return s or "page"


def squash(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def as_list(v):
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return v
    return [p for p in re.split(r"\s*,\s*", str(v)) if p]


def truthy(v):
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("true", "yes", "1", "on")


def list_key(v):
    """Turns a 'show on' value (name or label) into one of BOOK_LISTS' keys."""
    want = squash(v)
    for key, label in BOOK_LISTS.items():
        if want in (squash(key), squash(label)):
            return key
    return None


def asset_url(path, p):
    """A picture or file path from the dashboard, made relative to the page."""
    path = text(path)
    if not path:
        return ""
    if re.match(r"^(https?:)?//", path, re.I):
        return path
    return p + path.lstrip("/")


def link_url(url, p):
    """A link typed by Sarah. Web addresses stay as they are; site pages get the right prefix."""
    url = text(url)
    if not url:
        return ""
    if re.match(r"^(https?:|mailto:|tel:|#)", url, re.I):
        return url
    if re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I):  # javascript: and other schemes
        return "#"
    return p + url.lstrip("/")


def nice_date(value):
    v = text(value)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", v)
    if not m:
        return v
    try:
        d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return v
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def date_key(value):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text(value))
    return m.group(0) if m else "0000-00-00"


# ----------------------------------------------------------------------------
# Markdown (what the dashboard's text editor saves) -> HTML
# ----------------------------------------------------------------------------

def smart_quotes(s):
    s = re.sub(r'(^|[\s(\[{\u2014-])"', "\\1\u201c", s)
    s = s.replace('"', "\u201d")
    s = re.sub(r"(^|[\s(\[{\u2014-])'", "\\1\u2018", s)
    return s.replace("'", "\u2019")


ALLOWED_TAGS = re.compile(r"&lt;(/?)(u|s|em|strong|sup|sub|mark)&gt;|&lt;br\s*/?&gt;", re.I)


def inline(src, p=""):
    """Inline Markdown: **bold**, *italic*, ~~strike~~, `code`, [links](url), ![images](src)."""
    src = str(src or "")
    tokens = []

    def keep(rendered):
        tokens.append(rendered)
        return f"\x00{len(tokens) - 1}\x00"

    # backslash escapes (\* \_ \# ...)
    src = re.sub(r"\\([\\`*_{}\[\]()#+\-.!>~|])", lambda m: keep(esc(m.group(1))), src)
    # code spans
    src = re.sub(r"`([^`]+)`", lambda m: keep("<code>" + esc(m.group(1)) + "</code>"), src)
    # images
    src = re.sub(r"!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)",
                 lambda m: keep(f'<img src="{esc(asset_url(m.group(2), p))}" alt="{esc(m.group(1))}" loading="lazy">'),
                 src)
    # links
    src = re.sub(r"\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)",
                 lambda m: keep(f'<a href="{esc(link_url(m.group(2), p))}">{inline(m.group(1), p)}</a>'),
                 src)
    # bare web addresses in <...>
    src = re.sub(r"<(https?://[^>\s]+)>", lambda m: keep(f'<a href="{esc(m.group(1))}">{esc(m.group(1))}</a>'), src)

    out = esc(smart_quotes(src)).replace("&#x27;", "'")
    out = ALLOWED_TAGS.sub(lambda m: "<br>" if m.group(2) is None else f"<{m.group(1)}{m.group(2).lower()}>", out)
    out = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"__(.+?)__", r"<strong>\1</strong>", out)
    out = re.sub(r"~~(.+?)~~", r"<s>\1</s>", out)
    out = re.sub(r"(?<![*\w])\*(?![\s*])(.+?)(?<!\s)\*(?!\*)", r"<em>\1</em>", out)
    out = re.sub(r"(?<![_\w])_(?![\s_])(.+?)(?<!\s)_(?![_\w])", r"<em>\1</em>", out)
    return re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m.group(1))], out)


SCRIPTURE_REF = re.compile(r"^[\u2014\u2013-]?\s*(?:[1-3]\s?)?[A-Z][A-Za-z]+\.?\s+\d+:\d+")


def markdown(src, p=""):
    """Block Markdown. Heading 1/2 -> section heading, Heading 3 -> big display line,
    quote -> boxed note (or a Bible-verse style when it ends with a reference like John 1:5)."""
    lines = str(src or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out = []
    i = 0

    def para(buf):
        parts = []
        for j, ln in enumerate(buf):
            hard = ln.endswith("\\") or ln.endswith("  ")
            ln = ln.rstrip("\\").rstrip() if hard else ln.strip()
            parts.append(inline(ln, p))
            if j < len(buf) - 1:
                parts.append("<br>")
        return "<p>" + "".join(parts) + "</p>"

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        # horizontal rule
        if re.match(r"^([-*_])(\s*\1){2,}$", stripped):
            out.append("<hr>")
            i += 1
            continue
        # headings
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*$", stripped)
        if m:
            level, content = len(m.group(1)), inline(m.group(2), p)
            if level <= 2:
                out.append(f"<h2>{content}</h2>")
            elif level == 3:
                out.append(f'<p class="feature-title">{content}</p>')
            else:
                out.append(f"<h3>{content}</h3>")
            i += 1
            continue
        # quote
        if stripped.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            plain = [b.rstrip("\\").strip() for b in buf if b.strip()]
            if plain and SCRIPTURE_REF.match(plain[-1]) and len(plain) > 1:
                body = markdown("\n".join(buf[:-1] if buf[-1].strip() else buf[:-2]), p)
                out.append(f'<blockquote class="verse">{body}<cite>{inline(plain[-1], p)}</cite></blockquote>')
            else:
                out.append(f'<div class="callout">{markdown(chr(10).join(buf), p)}</div>')
            continue
        # lists
        if re.match(r"^\s*([-*+]|\d+[.)])\s+", line):
            ordered = bool(re.match(r"^\s*\d+[.)]\s+", line))
            items = []
            while i < len(lines):
                ln = lines[i]
                mm = re.match(r"^\s*([-*+]|\d+[.)])\s+(.*)$", ln)
                if mm:
                    items.append(mm.group(2).strip())
                    i += 1
                    continue
                if ln.strip() and items and ln.startswith((" ", "\t")):
                    items[-1] += " " + ln.strip()
                    i += 1
                    continue
                if not ln.strip():
                    k = i
                    while k < len(lines) and not lines[k].strip():
                        k += 1
                    if (k < len(lines) and re.match(r"^\s*([-*+]|\d+[.)])\s+", lines[k])
                            and bool(re.match(r"^\s*\d+[.)]\s+", lines[k])) == ordered):
                        i = k
                        continue
                break
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(it, p)}</li>" for it in items) + f"</{tag}>")
            continue
        # paragraph
        buf = []
        while i < len(lines):
            ln = lines[i]
            s = ln.strip()
            if (not s or re.match(r"^(#{1,6})\s", s) or s.startswith(">")
                    or re.match(r"^([-*_])(\s*\1){2,}$", s) or re.match(r"^\s*([-*+]|\d+[.)])\s+", ln)):
                break
            buf.append(ln)
            i += 1
        out.append(para(buf))
    return "\n".join(out)


# ----------------------------------------------------------------------------
# Loading content
# ----------------------------------------------------------------------------

def load(name, default):
    path = CONTENT / name
    if not path.exists():
        warn(f"{name} is missing; using an empty one.")
        return default
    try:
        data = json.loads(path.read_text(encoding="utf-8") or "null")
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: content/{name} isn't valid JSON ({e}). The site was not rebuilt.")
    if data is None:
        return default
    if isinstance(default, list) and isinstance(data, dict):
        # tolerate {"items": [...]} or similar
        for v in data.values():
            if isinstance(v, list):
                return v
        return default
    return data


# ----------------------------------------------------------------------------
# Page shell: head, header (menu), footer
# ----------------------------------------------------------------------------

class Site:
    def __init__(self):
        self.settings = load("site.json", {})
        self.home = load("home.json", {})
        self.contact = load("contact.json", {})
        self.progress = load("in-progress.json", {})
        self.blog = load("blog.json", [])
        self.pages = load("pages.json", [])
        self.books = load("books.json", [])
        self.prepare()

    # -- tidy up pages and books ------------------------------------------------
    def prepare(self):
        seen = set()
        pages = []
        for raw in self.pages:
            if not isinstance(raw, dict) or not text(raw.get("title")):
                continue
            pg = dict(raw)
            slug = slugify(text(pg.get("slug")) or pg["title"])
            if slug in SPECIAL_SLUGS and slug != BOOKS_PAGE:
                warn(f'Page "{pg["title"]}": the address "{slug}" is taken by a built-in page; using "{slug}-page".')
                slug += "-page"
            while slug in seen:
                slug += "-2"
            seen.add(slug)
            pg["slug"] = slug
            pg["hidden"] = truthy(pg.get("hidden"))
            pages.append(pg)
        self.pages = pages

        seen = set()
        books = []
        for raw in self.books:
            if not isinstance(raw, dict) or not text(raw.get("title")):
                continue
            bk = dict(raw)
            bid = slugify(text(bk.get("id")) or bk["title"])
            while bid in seen:
                bid += "-2"
            seen.add(bid)
            bk["id"] = bid
            bk["lists"] = [k for k in (list_key(v) for v in as_list(bk.get("show_on"))) if k]
            bk["hidden"] = truthy(bk.get("hidden"))
            bk["has_page"] = bool(text(bk.get("description")) or text(bk.get("download")))
            books.append(bk)
        self.books = books

    # -- menu ---------------------------------------------------------------
    def menu(self):
        top, under = [], []
        for key, href, label, pos in SPECIAL_MENU:
            top.append({"key": key, "href": href, "label": label, "pos": pos, "children": []})
        for pg in self.pages:
            where = squash(pg.get("menu"))
            if pg["hidden"] or where in ("", "no", "none", "notinthemenu"):
                continue
            item = {"key": pg["slug"], "href": pg["slug"] + ".html",
                    "label": text(pg.get("menu_label")) or pg["title"], "children": []}
            try:
                item["pos"] = float(pg.get("menu_position") or 100)
            except (TypeError, ValueError):
                item["pos"] = 100
            (under if "under" in where else top).append(item)
        top.sort(key=lambda x: x["pos"])
        under.sort(key=lambda x: x["pos"])
        parent = next((t for t in top if t["key"] == BOOKS_PAGE), None)
        if parent:
            parent["children"] = under
        else:
            top.extend(under)
        return top

    def header(self, p, current, section):
        def cur(key):
            if key == current:
                return ' aria-current="page"'
            if key == section:
                return ' aria-current="true"'
            return ""

        items = []
        for it in self.menu():
            if it["children"]:
                subs = "\n".join(
                    f'              <li><a href="{p}{c["href"]}"{cur(c["key"])}>{esc(c["label"])}</a></li>'
                    for c in it["children"])
                items.append(f'          <li class="has-sub">\n'
                             f'            <a href="{p}{it["href"]}"{cur(it["key"])}>{esc(it["label"])}</a>\n'
                             f'            <ul class="sub">\n{subs}\n            </ul>\n'
                             f'          </li>')
            else:
                items.append(f'          <li><a href="{p}{it["href"]}"{cur(it["key"])}>{esc(it["label"])}</a></li>')
        name = esc(text(self.settings.get("site_name")) or "Sarah’s Books")
        tagline = esc(text(self.settings.get("tagline")))
        nav = "\n".join(items)
        return f"""  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="{p}index.html">
        <img src="{p}assets/images/logo.png" alt="" width="60" height="59">
        <span>
          <span class="brand-name">{name}</span>
          <span class="brand-tagline">{tagline}</span>
        </span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav id="site-nav" class="site-nav" aria-label="Main">
        <ul>
{nav}
        </ul>
      </nav>
    </div>
  </header>
"""

    def footer(self, p):
        links = "\n".join(f'        <li><a href="{p}{it["href"]}">{esc(it["label"])}</a></li>' for it in self.menu())
        email = text(self.settings.get("email"))
        email_html = f'      <p class="footer-email"><a href="mailto:{esc(email)}">{esc(email)}</a></p>\n' if email else ""
        return f"""  <footer class="site-footer">
    <div class="wrap">
      <img src="{p}assets/images/logo.png" alt="" width="72" height="70">
      <p class="footer-tagline">{esc(text(self.settings.get("tagline")))}</p>
      <ul class="footer-nav">
{links}
      </ul>
{email_html}      <p class="copyright">{esc(text(self.settings.get("copyright")))}</p>
    </div>
  </footer>
"""

    def write(self, path, title, body, current, section=None, description="", hero_fonts=False, noindex=False):
        depth = path.count("/")
        p = "../" * depth
        name = text(self.settings.get("site_name")) or "Sarah’s Books"
        full_title = name if current == "home" else f"{title} – {name}"
        description = description or text(self.settings.get("description"))
        fonts = (FONTS_BASE + (FONTS_HERO if hero_fonts else "")).replace("&", "&amp;")
        robots = '  <meta name="robots" content="noindex, nofollow">\n' if noindex else ""
        doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(full_title)}</title>
  <meta name="description" content="{esc(description)}">
{robots}  <link rel="icon" href="{p}assets/images/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="{p}assets/images/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&amp;display=swap">
  <link rel="stylesheet" href="{p}assets/css/style.css">
  <script>document.documentElement.className += " js";</script>
  <script src="{p}assets/js/site.js" defer></script>
</head>
<body>
{self.header(p, current, section)}
  <main id="main">
{indent(body.replace("{P}", p), 4)}
  </main>

{self.footer(p)}</body>
</html>
"""
        target = OUT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(doc, encoding="utf-8")
        return path

    # ------------------------------------------------------------------------
    # Pieces shared by several pages
    # ------------------------------------------------------------------------
    def book_href(self, bk):
        return f"{{P}}books/{bk['id']}.html" if bk["has_page"] else "#"

    def cover(self, bk):
        if text(bk.get("cover")):
            return (f'<img class="cover" src="{esc(asset_url(bk["cover"], "{P}"))}" '
                    f'alt="Cover of {esc(bk["title"])}" width="663" height="1024">')
        return ('<div class="cover-placeholder">\n'
                f'  <span class="ph-title">{esc(bk["title"])}</span>\n'
                f'  <span class="ph-author">{esc(text(self.settings.get("author")) or "Sarah Buitendyk")}</span>\n'
                '  <span class="ph-note">Cover coming soon</span>\n'
                "</div>")

    def second_button(self, bk):
        if text(bk.get("download")):
            return f'<a class="btn" href="{esc(asset_url(bk["download"], "{P}"))}" download>Download</a>'
        buy = link_url(bk.get("buy"), "{P}") or "#"
        return f'<a class="btn" href="{esc(buy)}">Buy the book</a>'

    def book_card(self, bk):
        learn = self.book_href(bk)
        cover = self.cover(bk)
        if learn != "#":
            cover = f'<a class="cover-link" href="{learn}">\n{indent(cover, 2)}\n</a>'
        parts = ['<article class="book-card">', indent(cover, 2), f'  <h3>{esc(bk["title"])}</h3>']
        if text(bk.get("label")):
            parts.append(f'  <p class="book-meta">{esc(bk["label"])}</p>')
        if text(bk.get("card_text")):
            parts.append(f'  <p>{inline(bk["card_text"], "{P}")}</p>')
        parts += ['  <div class="btn-row">',
                  f'    <a class="btn btn-outline" href="{learn}">Learn more</a>',
                  f'    {self.second_button(bk)}',
                  '  </div>', '</article>']
        return "\n".join(parts)

    def book_grid(self, key):
        shown = [b for b in self.books if key in b["lists"]]
        if not shown:
            return '<p class="coming-soon">Coming soon…</p>'
        return '<div class="book-grid">\n' + indent("\n\n".join(self.book_card(b) for b in shown), 2) + "\n</div>"

    @staticmethod
    def page_hero(title, eyebrow="", lede=""):
        parts = ['<section class="page-hero">', '  <div class="wrap">']
        if text(eyebrow):
            parts.append(f'    <p class="eyebrow">{esc(eyebrow)}</p>')
        parts.append(f"    <h1>{esc(title)}</h1>")
        if text(lede):
            parts.append(f'    <p class="lede">{inline(lede, "{P}")}</p>')
        parts += ["  </div>", "</section>"]
        return "\n".join(parts)

    # ------------------------------------------------------------------------
    # Pages
    # ------------------------------------------------------------------------
    def build_home(self):
        h = self.home
        rr = h.get("recent_release") or {}
        ab = h.get("about") or {}
        hero = h.get("hero") or {}

        recent = ""
        if text(rr.get("title")):
            cover = ""
            if text(rr.get("cover")):
                img = (f'<img class="cover" src="{esc(asset_url(rr["cover"], "{P}"))}" '
                       f'alt="Cover of {esc(rr["title"])}" width="663" height="1024">')
                learn = link_url(rr.get("learn_more"), "{P}")
                cover = (f'      <a class="feature-media" href="{esc(learn)}">\n        {img}\n      </a>' if learn
                         else f'      <div class="feature-media">\n        {img}\n      </div>')
            quote = ""
            if text(rr.get("quote")):
                cite = f'\n          <cite>{esc(rr.get("quote_source"))}</cite>' if text(rr.get("quote_source")) else ""
                quote = (f'        <blockquote class="verse">\n          <p>{inline(rr["quote"], "{P}")}</p>{cite}\n'
                         f'        </blockquote>\n')
            buttons = []
            if text(rr.get("learn_more")):
                buttons.append(f'          <a class="btn btn-outline" href="{esc(link_url(rr["learn_more"], "{P}"))}">Learn more</a>')
            if text(rr.get("buy")):
                buttons.append(f'          <a class="btn" href="{esc(link_url(rr["buy"], "{P}"))}">Buy the book</a>')
            btns = ('        <div class="btn-row">\n' + "\n".join(buttons) + "\n        </div>\n") if buttons else ""
            eyebrow = f'        <p class="eyebrow">{esc(rr.get("label"))}</p>\n' if text(rr.get("label")) else ""
            recent = f"""
<section class="section">
  <div class="wrap">
    <h2 class="section-title">{esc(text(rr.get("section_title")) or "Recent Release")}</h2>
    <div class="feature">
{cover}
      <div>
{eyebrow}        <h3 class="feature-title">{esc(rr["title"])}</h3>
{quote}        {markdown(rr.get("text"), "{P}")}
{btns}      </div>
    </div>
  </div>
</section>
"""
        about = ""
        if text(ab.get("text")):
            photo = ""
            if text(ab.get("photo")):
                photo = (f'      <div class="feature-media">\n        <img class="portrait" src="{esc(asset_url(ab["photo"], "{P}"))}" '
                         f'alt="{esc(text(ab.get("photo_description")) or "Sarah Buitendyk")}" width="645" height="883">\n      </div>\n')
            layout = "feature feature-reverse" if photo else "prose prose-center"
            about = f"""
<section class="section section-alt">
  <div class="wrap">
    <h2 class="section-title">{esc(text(ab.get("section_title")) or "About Me")}</h2>
    <div class="{layout}">
{photo}      <div class="prose">
{indent(markdown(ab.get("text"), "{P}"), 8)}
      </div>
    </div>
  </div>
</section>
"""
        cols = []
        for k in ("reviews", "newsletter"):
            blk = h.get(k) or {}
            if text(blk.get("title")):
                cols.append(f'      <div>\n        <h2 class="section-title">{esc(blk["title"])}</h2>\n'
                            f'        <div class="coming-soon">{markdown(blk.get("text"), "{P}")}</div>\n      </div>')
        extra = ""
        if cols:
            extra = ('\n<section class="section">\n  <div class="wrap">\n    <div class="two-col">\n'
                     + "\n".join(cols) + "\n    </div>\n  </div>\n</section>\n")

        middle_words = "\n".join(f'        <span class="g-epic">{esc(w)}</span>'
                                 for w in text(hero.get("middle")).split())
        body = f"""<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <p class="hero-welcome">{esc(text(hero.get("welcome")))}</p>
    <h1 class="hero-genres" id="hero-title">
      <span class="g-romance">{esc(text(hero.get("left")))}</span>
      <span class="g-middle">
{middle_words}
        <span class="g-and">{esc(text(hero.get("middle_small")))}</span>
      </span>
      <span class="g-suspense">{esc(text(hero.get("right")))}</span>
    </h1>
  </div>
</section>
{recent}{about}{extra}"""
        return self.write("index.html", "Home", body, "home", hero_fonts=True)

    def build_contact(self):
        c = self.contact
        email = text(self.settings.get("email"))
        note = f'    <div class="callout">\n      {markdown(c.get("note"), "{P}")}\n    </div>\n' if text(c.get("note")) else ""
        button = text(c.get("button_label"))
        btn = (f'    <div class="btn-row btn-row-center">\n      <a class="btn" href="mailto:{esc(email)}">{esc(button)}</a>\n    </div>\n'
               if button and email else "")
        direct = (f'    <p class="contact-direct">{inline(c.get("direct_text"), "{P}")}<br>\n'
                  f'      <a class="email-big" href="mailto:{esc(email)}">{esc(email)}</a></p>\n') if email else ""
        heading = f'    <h2 class="section-title">{esc(c.get("heading"))}</h2>\n' if text(c.get("heading")) else ""
        body = self.page_hero(text(c.get("title")) or "Contact") + f"""

<section class="section">
  <div class="wrap wrap-narrow center">
{note}{heading}    {markdown(c.get("text"), "{P}")}
{btn}{direct}  </div>
</section>
"""
        return self.write("contact.html", text(c.get("title")) or "Contact", body, "contact",
                          description=text(c.get("description")))

    def build_progress(self):
        pr = self.progress if isinstance(self.progress, dict) else {"items": self.progress}
        cards = []
        for it in pr.get("items") or []:
            if not isinstance(it, dict) or not text(it.get("title")):
                continue
            link = link_url(it.get("link"), "{P}")
            title = f'<a href="{esc(link)}">{esc(it["title"])}</a>' if link else esc(it["title"])
            bar = ""
            if truthy(it.get("show_bar")):
                try:
                    pct = max(0.0, min(100.0, float(it.get("percent") or 0)))
                except (TypeError, ValueError):
                    pct = 0.0
                bar = (f'\n  <div class="progress" style="--percent: {pct:g}" aria-hidden="true">'
                       f'<div class="progress-fill"></div></div>')
            cards.append(f'<article class="wip">\n  <h3>{title}</h3>\n  {markdown(it.get("text"), "{P}")}{bar}\n</article>')
        listing = ('<div class="wip-list">\n' + indent("\n\n".join(cards), 2) + "\n</div>") if cards \
            else '<p class="coming-soon">Coming soon…</p>'
        title = text(pr.get("title")) or "In Progress"
        body = self.page_hero(title, eyebrow=text(pr.get("eyebrow"))) + f"""

<section class="section">
  <div class="wrap">
{indent(listing, 4)}
  </div>
</section>
"""
        return self.write("in-progress.html", title, body, "in-progress", description=text(pr.get("description")))

    def build_blog(self):
        posts = [x for x in self.blog if isinstance(x, dict) and (text(x.get("title")) or text(x.get("body")))]
        posts.sort(key=lambda x: date_key(x.get("date")), reverse=True)
        used = set()
        arts = []
        for post in posts:
            pid = slugify(f'{text(post.get("date"))} {text(post.get("title"))}')
            while pid in used:
                pid += "-2"
            used.add(pid)
            when = nice_date(post.get("date"))
            date_html = (f'  <p class="post-date"><time datetime="{esc(date_key(post.get("date")))}">{esc(when)}</time></p>\n'
                         if when else "")
            arts.append(f'<article class="post" id="{pid}">\n{date_html}'
                        f'  <h2><a href="#{pid}">{esc(text(post.get("title")))}</a></h2>\n'
                        f'  <div class="prose">\n{indent(markdown(post.get("body"), "{P}"), 4)}\n  </div>\n</article>')
        feed = ('<div class="post-feed">\n' + indent("\n\n".join(arts), 2) + "\n</div>") if arts \
            else '<p class="coming-soon">Coming soon…</p>'
        body = self.page_hero("Blog") + f"""

<section class="section">
  <div class="wrap">
{indent(feed, 4)}
  </div>
</section>
"""
        return self.write("blog.html", "Blog", body, "blog", description="News and writing updates from author Sarah Buitendyk.")

    def build_page(self, pg):
        slug = pg["slug"]
        section = BOOKS_PAGE if "under" in squash(pg.get("menu")) else None
        hero = self.page_hero(pg["title"], eyebrow=text(pg.get("eyebrow")), lede=text(pg.get("intro")))
        list_key_ = list_key(pg.get("book_list")) if text(pg.get("book_list")) else None
        body_md = text(pg.get("body"))
        centered = truthy(pg.get("centered"))

        parts = [hero]
        if body_md or text(pg.get("photo")):
            content = markdown(body_md, "{P}")
            if text(pg.get("photo")):
                inner = (f'<div class="feature">\n  <div class="feature-media">\n'
                         f'    <img class="portrait" src="{esc(asset_url(pg["photo"], "{P}"))}" '
                         f'alt="{esc(text(pg.get("photo_description")) or pg["title"])}">\n  </div>\n'
                         f'  <div class="prose">\n{indent(content, 4)}\n  </div>\n</div>')
            elif centered:
                inner = f'<div class="prose prose-center center">\n{indent(content, 2)}\n</div>'
            else:
                inner = f'<div class="prose prose-center">\n{indent(content, 2)}\n</div>'
            parts.append(f'\n<section class="section">\n  <div class="wrap">\n{indent(inner, 4)}\n  </div>\n</section>')
        if list_key_:
            heading = text(pg.get("book_list_heading"))
            alt = " section-alt" if body_md else ""
            head_html = f'    <h2 class="section-title">{esc(heading)}</h2>\n' if heading else ""
            parts.append(f'\n<section class="section{alt}">\n  <div class="wrap">\n{head_html}'
                         f'{indent(self.book_grid(list_key_), 4)}\n  </div>\n</section>')
        return self.write(f"{slug}.html", pg["title"], "\n".join(parts) + "\n", slug, section=section,
                          description=text(pg.get("description")), noindex=pg["hidden"])

    def build_book(self, bk):
        cover = self.cover(bk)
        buy = link_url(bk.get("buy"), "{P}")
        if buy and not text(bk.get("download")):
            cover = f'<a class="feature-media" href="{esc(buy)}">\n{indent(cover, 2)}\n</a>'
        else:
            cover = f'<div class="feature-media">\n{indent(cover, 2)}\n</div>'
        content = markdown(bk.get("description"), "{P}") or '<p class="coming-soon">More about this book coming soon…</p>'
        extra = ""
        if text(bk.get("download")):
            extra += ('\n<h2>Docs Download:</h2>\n<div class="download">\n'
                      f'  <span class="download-name">{esc(bk["title"])}</span>\n'
                      f'  {self.second_button(bk)}\n</div>')
            if text(bk.get("download_note")):
                extra += f'\n<p><strong>{inline(bk["download_note"], "{P}")}</strong></p>'
        else:
            extra += f'\n<div class="btn-row">\n  {self.second_button(bk)}\n</div>'
        body = self.page_hero(bk["title"], eyebrow=text(bk.get("label"))) + f"""

<section class="section">
  <div class="wrap">
    <div class="feature">
{indent(cover, 6)}
      <div class="prose">
{indent(content + extra, 8)}
      </div>
    </div>
  </div>
</section>
"""
        return self.write(f"books/{bk['id']}.html", bk["title"], body, "book-" + bk["id"], section=BOOKS_PAGE,
                          description=text(bk.get("card_text"))[:200], noindex=bk["hidden"])

    def build_404(self):
        body = self.page_hero("Page not found") + """

<section class="section">
  <div class="wrap center">
    <p>Sorry, that page couldn’t be found.</p>
    <div class="btn-row btn-row-center"><a class="btn" href="{P}index.html">Go to the home page</a></div>
  </div>
</section>
"""
        path = self.write("404.html", "Page not found", body, "404", noindex=True)
        # The 404 page is shown at any address, so its links must start from the site's root.
        f = OUT / path
        f.write_text(re.sub(r'(href|src)="(?!https?:|mailto:|#|/)', r'\1="/', f.read_text(encoding="utf-8")),
                     encoding="utf-8")
        return path

    def build(self):
        if OUT.exists():
            shutil.rmtree(OUT)
        OUT.mkdir()
        shutil.copytree(ROOT / "assets", OUT / "assets")
        written = [self.build_home(), self.build_contact(), self.build_progress(), self.build_blog()]
        written += [self.build_page(pg) for pg in self.pages]
        written += [self.build_book(bk) for bk in self.books if bk["has_page"]]
        written.append(self.build_404())
        return written


def indent(s, n):
    pad = " " * n
    return "\n".join(pad + ln if ln.strip() else ln for ln in str(s).split("\n"))


if __name__ == "__main__":
    pages = Site().build()
    print(f"Built {len(pages)} pages into {OUT.relative_to(ROOT)}/:")
    for pth in pages:
        print("  ", pth)
    if WARNINGS:
        print(f"{len(WARNINGS)} warning(s) above.")
