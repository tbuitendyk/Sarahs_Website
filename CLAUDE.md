# Sarah's Books — author website

The website of **Sarah Buitendyk**, a young Christian author who writes clean contemporary, suspense and fantasy stories with romance woven in. The tagline is "Writing for God's glory".

The site was moved here in November 2026 from WordPress.com (sarahbuitendykbooks.wordpress.com).

**Sarah edits all the content herself** in a Pages CMS dashboard (app.pagescms.org), logging in with her email. She explicitly does not want to depend on GitHub or Claude for everyday edits. Claude's job is the design, the build and any new kinds of content. Whatever you add, keep it editable from the dashboard.

## Working with Sarah

- **Her words are hers. Copy them exactly.** Never paraphrase, shorten, summarise or "polish" her text, including blurbs on book cards. If you spot a typo, point it out and let her decide.
- Explain what you changed in plain language, with no jargon.
- After any visual change, build, preview, and show her a screenshot at desktop and phone widths.
- She doesn't want to pay for anything: no paid services or plans.
- Ask before big redesigns or adding third-party services.

## How the site works

```
content/*.json      ALL words, settings and lists. Edited by Sarah through the dashboard
.pages.yml          Dashboard settings: which boxes Sarah sees for each content file
build.py            Turns content/*.json into the finished site in _site/ (Python standard library only)
assets/css/style.css  All styling. Colours and fonts are CSS variables at the top
assets/js/site.js   Mobile menu button
assets/images/      Logo, favicons, photos; covers/ holds book covers. The dashboard uploads pictures here
assets/downloads/   Free downloads (e.g. words-of-love.docx). The dashboard uploads files here
_site/              Built output. Never edit, never commit (in .gitignore)
SETUP.md            One-time setup for Cloudflare Pages + Pages CMS, written for non-developers
```

Build and preview:

```bash
python3 build.py
```

```bash
python3 -m http.server 8000 -d _site
```

The host (Cloudflare Pages) runs `python3 build.py` with output directory `_site` after every commit. That includes every save in the dashboard, since Pages CMS commits to the repo.

What gets built:
- `index.html`, `blog.html`, `contact.html` and `in-progress.html` come from `home.json`, `blog.json`, `contact.json` and `in-progress.json`.
- One `<slug>.html` per entry in `pages.json`: About, My Books, IGS: Files, Anthologies, Short Stories, the hidden subscriber page, and any page Sarah adds.
- `books/<id>.html` for each book in `books.json` that has a description or a download.
- `404.html`.

## Rules for every change

- **Keep three things in sync:** the fields in `.pages.yml`, the keys in `content/*.json`, and what `build.py` reads. If you add a field, add it to all three. Check with `ruby -ryaml -e 'YAML.safe_load(File.read(".pages.yml"))'` that the config is valid YAML.
- **Don't hard-code Sarah's words in `build.py` or the HTML.** Text belongs in `content/*.json`, so she can edit it. The only fixed labels are small UI words (Learn more, Buy the book, Download, Docs Download:, Coming soon…).
- **Never edit `_site/`.** Change `build.py`, `assets/` or `content/` and rebuild.
- **Build must never crash on odd content.** Sarah may leave fields empty, type numbers as text, and so on. Read fields with `text()`/`truthy()`, skip entries without a title, and print a `WARNING:` rather than failing. Invalid JSON is the one case that stops the build, and then the live site simply keeps the previous version.
- **Relative paths only** in the built HTML. Pages at the root use `assets/...`; pages in `books/` use `../`. The `{P}` placeholder in `build.py` is replaced with the right prefix. The dashboard saves uploads as `/assets/...`, and `asset_url()` makes them relative. The one exception is `404.html`, which uses root paths.
- **Every book card has "Learn more" and "Buy the book"** (Sarah asked for this). Free stories with a download show "Download" instead. A button with `href="#"` is greyed out: no page yet, or no buy link yet.
- **Never link to the hidden subscriber page** (`subscriber-stories-iud5ltq5.html`, `"hidden": true` in `pages.json`) from anywhere. Hidden pages and hidden books get `noindex`. Words of Love is a hidden book.
- Every image needs `alt` text. Keep images under about 300 KB.

## How Sarah's text is formatted

Rich-text fields are saved as Markdown, and `build.py`'s `markdown()` turns them into HTML:
- Heading 1 and 2 become a section heading. Heading 3 becomes a big display line (e.g. "Hi!"); on centred pages it's a centred italic tagline.
- A quote whose last line is a Bible reference (`John 1:5`) shows in verse style. Any other quote is a boxed note.
- Lists, bold, italic, links, images and dividers work as usual. Raw HTML is escaped, except a few harmless tags (`<u>`, `<br>`…).
- Straight quotes become curly quotes.

## The menu

Built-in pages have fixed positions: Home 10, Blog 20, Contact 40, In Progress 50. Pages in `pages.json` set `menu` (`main`, `under-my-books`, `no`) and `menu_position`. About is 30 and My Books is 60. Under My Books: IGS: Files 10, Anthologies 20, Short Stories 30. "Under My Books" items hang off the page whose slug is `books`.

## Open items

- **One-time setup isn't done yet.** The site isn't live, and the WordPress site is still public. See `SETUP.md`: make the repo private, connect Cloudflare Pages, connect Pages CMS and invite Sarah's email.
- **Words of Love has no cover.** The image was missing on WordPress too.
- **The hidden subscriber page is unlisted, not locked.** Anyone with the link can open it.
- **The contact form became an email link.** Sarah's original sentence ends "…send a message with the form below."; that part is left off because there's no form.
- The **newsletter signup** and **reader reviews** sections still say "Coming soon…".
- **IGS #3 and #4** are placeholders based on "Four stories".
