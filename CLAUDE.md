# Sarah's Books — author website

The website of **Sarah Buitendyk**, a young Christian author who writes clean contemporary, suspense and fantasy stories with romance woven in. The tagline is "Writing for God's glory".

The site was moved here in November 2026 from WordPress.com (sarahbuitendykbooks.wordpress.com).

**Sarah edits all the content herself at `/admin` on the live site**, with a password. She explicitly does not want to depend on GitHub, Claude or any other service for everyday edits, and she doesn't want to pay for anything. Claude's job is the design, the code and any new kinds of content. Whatever you add, make it editable in the admin.

## Working with Sarah

- **Her words are hers. Copy them exactly.** Never paraphrase, shorten, summarise or "polish" her text. If you spot a typo, point it out and let her decide.
- Explain what you changed in plain language, with no jargon.
- After any visual change, run the site locally and show her a screenshot at desktop and phone widths.
- Free only: no paid services or plans. Ask before adding any third-party service.

## How it works

Cloudflare Pages, free plan. There's no build step.

```
functions/[[path]].js   Runs every request except /assets/* (see public/_routes.json): website pages,
                        /files/*, /admin, /admin/login|logout and /api/admin/*
src/render.js           Builds each page from the content (the design's HTML). Pages are rendered per visit
src/store.js            Cloudflare KV (bound as SITE): content, 180-day backups, uploads
src/auth.js             Password check, signed session cookie, wrong-password limit, password change
src/admin-pages.js      Login page and admin shell HTML, plus the admin's security headers
src/defaults.js         Starting content, used only until the first save. Live content is in KV, NOT in this repo
public/                 Static files (Pages output directory)
  assets/css, js, images, downloads   the website's design and built-in files
  assets/admin/         The admin editor (no libraries):
    admin.js            the app: sections, forms, lists, uploads, saving, history, password
    schema.js           which boxes each section shows (keys must match what render.js reads)
    editor.js           word-processor text box; converts its HTML to Markdown
    markdown.js         Markdown -> HTML; shared by render.js and the editor
    api.js              calls /api/admin/*; demo mode for previews (window.SB_DEMO)
  _routes.json          /assets/css|js|images|admin are served directly; everything else (incl. downloads) goes to the function
tools/dev-server.mjs    Local copy of Cloudflare (Node 18+), with KV kept in .dev/kv.json
tools/export-static.mjs Saves a static copy of the site plus a practice admin, for previews
                        (Kit replaced by tools/preview/kit-practice.js; locked pages get *.unlocked.html copies)
SETUP.md                One-time Cloudflare setup, written for non-developers
```

Run locally:

```bash
ADMIN_PASSWORD=pick-a-test-password node tools/dev-server.mjs
```

Then open http://localhost:8788 and http://localhost:8788/admin. Use `KV_FILE=memory` for a throwaway store.

## Content model

KV key `content` = `{ data, version, savedAt }`, where `data` has:

- `site`: name, tagline, author, email, description, copyright
- `newsletter`:
  - the Kit form: `kit_form_id`, `kit_uid`, heading, text, picture, placeholder, button, small_print, success_message, subscribed_message
  - `subscriber_password`, `remember_days` (default 30), `locked_message`, `subscriber_page` (slug the "Already a subscriber?" box opens) and `unlock_prompt` for the subscriber lock
- `home`: hero, recent release, about, reviews, newsletter
- `contact`
- `progress`: title, eyebrow and `items` (each with `show_bar` and `percent` 0–100)
- `blog`: posts with title, date (yyyy-mm-dd) and body
- `pages`: title, slug, menu (`main`, `under-my-books`, `no`), menu_position, body, book_list, signup, unlock_box, subscribers_only, hidden…
- `books`: title, id, label, cover, buy, show_on[], card_text, description, download, subscribers_only, hidden…
- `home.newsletter.show_signup` and `contact.show_signup` place the sign-up form.

## Newsletter (Kit) and the subscriber lock

**Sign-up form.**
- `Site.signupBox()` renders Kit's own form markup (`data-sv-form`, `data-uid`, `data-options`), and loads `https://f.convertkit.com/ckjs/ck.5.js` on that page only.
- Kit's script submits to `app.kit.com/forms/<id>/subscriptions`, shows `success_message` in place of the fields, and remembers the sign-up in localStorage (`cksubscribed-<uid>`). On later visits it replaces the form with `subscribed_message`, inserted with innerHTML, so `render.js` escapes it.
- The site's CSS styles Kit's class names.
- Never test by submitting to the real Kit form, because that adds a real subscriber. Intercept `app.kit.com` in Playwright instead.

**Subscriber lock.**
- Pages and books with `subscribers_only` render `lockedView()` until the visitor has entered `newsletter.subscriber_password` at `POST /subscribers/unlock`.
- Unlocking sets the `__Host-sb_sub` cookie for `remember_days` days (1–365, default 30), signed with the admin secret plus the password. After that, or once the password changes, the visitor must enter it again.
- Matching ignores capital letters and surrounding spaces. Wrong tries are limited to 10 per 15 minutes per address (`subtries:`).
- Downloads of subscriber books (`/assets/downloads/*` and `/files/*`) also need the cookie. That's why `public/_routes.json` sends `/assets/downloads/*` through the function.
- Locked responses are `private, no-store` and `noindex`.
- With no subscriber password set, locked pages say "This page isn't open yet."
- Pages with `unlock_box` show an "Already a subscriber?" password box. It posts `next` (the subscriber page) and `back` (this page), so a wrong password shows the error where it was typed. Once unlocked, the box becomes an "Open the subscriber stories" button. Otherwise the box section starts `hidden`, and `public/assets/js/subscriber-box.js` shows it only on devices where Kit recorded a sign-up (localStorage `cksubscribed-*`, or Kit's `ckjs:submission:complete` event right after signing up). It is also shown after a wrong try (`?wrong=1`). These pages vary per visitor, so they are `private, no-store`. The public Short Stories page has it.

Rich-text fields are Markdown: `##` heading, `###` big line, `>` quote (verse style when its last line is a Bible reference such as "John 1:5"), lists, `**bold**`, `*italic*`, links.

Addresses:
- `/` is home; `/blog.html`, `/contact.html` and `/in-progress.html` are built in.
- `/<slug>.html` is a page.
- `/books/<id>.html` is a book's page; it exists only if the book has a description or a download.
- `/files/<name>` serves an upload.

Menu positions: Home 10, Blog 20, Contact 40, In Progress 50, About 30, My Books 60. Pages "under My Books" hang off the page with slug `books`.

## Rules for every change

- **Keep `schema.js` (admin boxes) and `render.js` (what the site reads) in sync.** Add new fields to both. If the starting content should have them, add them to `defaults.js` too.
- **Don't hard-code Sarah's words** in templates. Only small UI labels are fixed (Learn more, Buy the book, Download, Docs Download:, Coming soon…).
- **Rendering must never crash on odd content.** Use `text()`, `truthy()` and the `obj()`/`arr()` guards, and skip entries without a title.
- **Escape everything** with `esc()` or `inline()`/`markdown()`. Raw HTML from content is escaped, apart from a few harmless tags.
- **Relative links in the site's HTML.** The `{P}` placeholder in render.js becomes `""` or `../` depending on page depth. Uploads are saved as `/files/x` or `/assets/...`, and `assetUrl()` makes them relative.
- **Security:**
  - Keep the admin CSP: no inline scripts or `style=""` attributes in admin code (set `.style.x` in JS instead).
  - Every `/api/admin/*` request needs the login cookie, and writes also need the `X-SB-Admin: 1` header.
  - Uploads are limited to the extensions in `store.js` (no html or svg).
  - Never link to hidden pages (`hidden: true`); they and hidden books get `noindex`.
- **Free-plan limits:** about 10 ms of CPU per request (so PBKDF2 uses 20,000 rounds), KV allows 1,000 writes a day, and uploads are limited to 10 MB.
- **Test before committing:**
  - Run the dev server.
  - Check pages with curl or Playwright.
  - Log in, edit, save and check the page changed.
  - Check `/api/admin/*` returns 401 when logged out.
- Every image needs `alt` text.

## Previews

```bash
node tools/export-static.mjs _preview
```

This writes the site plus `admin-login.html` and `admin.html` (a practice admin where any password works and changes stay in the browser). That folder can be published as a private preview.

## Open items

- **One-time setup isn't done yet** (see `SETUP.md`). The site isn't live, and the WordPress site is still public.
- **Words of Love has no cover.** The image was missing on WordPress too.
- **The subscriber password isn't set yet.** Until Sarah sets it under Newsletter, subscriber pages say "This page isn't open yet". It goes in Kit's confirmation or welcome email.
- **The contact form became an email link.** Sarah's original sentence ends "…send a message with the form below."; that part is left off because there's no form.
- The **newsletter signup** and **reader reviews** sections still say "Coming soon…".
- **IGS #3 and #4** are placeholders based on "Four stories".
