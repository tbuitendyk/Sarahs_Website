# Sarah's Books — author website

The website of **Sarah Buitendyk**, a young Christian author who writes clean contemporary, suspense and fantasy stories with romance woven in. The tagline is "Writing for God's glory".

The site was moved here in November 2026 from WordPress.com (sarahbuitendykbooks.wordpress.com). Sarah builds it out by asking Claude for changes, so assume the person you're talking to may not be a developer.

## Working with Sarah

- **Her words are hers.** Don't rewrite, polish or "correct" her writing unless she asks. If you spot a typo, point it out and let her decide.
- Explain what you changed in plain language, with no jargon.
- After any visual change, preview the page and show her a screenshot at desktop and phone widths.
- Ask before big redesigns, frameworks or build tools, or third-party services (contact forms, newsletter tools, analytics).

## How the site works

Plain HTML pages, one stylesheet and a tiny script, with **no build step**. What's in the repo is exactly what gets published.

Preview locally from the repo folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

```
index.html            Home: hero, recent release, about, reviews and newsletter placeholders
about.html            About Me
contact.html          Contact (email link)
blog.html             Blog index, newest post first
in-progress.html      Works in progress, with progress bars
books.html            My Books: published books plus a "Coming Soon" section
anthologies.html      Anthologies (under My Books)
igs-files.html        IGS: Files series page (under My Books)
short-stories.html    Short Stories for Subscribers (under My Books; placeholder)
books/<slug>.html     One page per book or story
blog/<date-slug>.html One page per blog post
assets/css/style.css  All styling. Colours and fonts are CSS variables at the top
assets/js/site.js     Mobile menu button only
assets/images/        Logo, favicons, photo of Sarah; covers/ holds book covers
assets/downloads/     Files readers can download (e.g. words-of-love.docx)
.nojekyll             Tells GitHub Pages to serve files as they are
```

## Rules for every edit

- **The header and footer are repeated in every page.** When you change the menu, the tagline, the footer or the email address, change it in *every* `.html` file. `grep -rl 'id="site-nav"' --include=*.html .` lists them all.
- **Use relative paths, never leading-slash paths.** Pages at the root use `assets/...` and `books/x.html`. Pages in `books/` and `blog/` use `../assets/...` and `../index.html`. Leading-slash paths break when the site is hosted in a subfolder, as a GitHub Pages project site is.
- **Mark the current page in the menu.** Its menu link gets `aria-current="page"`. On a book page or blog post, the parent item ("My Books" or "Blog") gets `aria-current="true"`. Both turn gold.
- **Every image needs `alt` text** and explicit `width` and `height` attributes. Keep images under about 300 KB; covers about 700 px wide is plenty.
- Use curly quotes and apostrophes (’ “ ”) to match the rest of the site.
- Reuse the existing CSS classes before adding new ones: `section`, `section-alt`, `feature`, `prose`, `book-grid`, `book-card`, `cover`, `cover-placeholder`, `btn`, `btn-outline`, `callout`, `wip`, `progress`.
- Update the `<title>` and `<meta name="description">` of every new page.

## Common tasks

**Add a new book**
1. Copy `books/light-through-his-love.html` to `books/<slug>.html`. Update the title, description, eyebrow, cover and text.
2. Add a `book-card` to the **top** of the first grid in `books.html`. Sarah's rule for that page: books in publication order, newest first, and **no short stories**.
3. If it's an anthology, also add it to `anthologies.html`.
4. Ask whether it should replace the "Recent Release" on the home page.
5. Remove it from the "Coming Soon" section or from `in-progress.html` if it's listed there.

**Add a blog post**
1. Copy `blog/2025-06-20-update.html` to `blog/YYYY-MM-DD-short-title.html`, then update the `<time datetime>`, title and text. `<hr>` draws the ⁂ divider between sections.
2. Add an entry at the **top** of the list in `blog.html`.

**Update a work in progress** (`in-progress.html`)
Edit the text, then set the bar's `style="width: NN%"` to words written ÷ goal × 100. Also update `aria-valuenow`, `aria-valuemax` and `aria-valuetext` on the `.progress` element.

**Use real cover art in place of a placeholder**
Put the image in `assets/images/covers/`, then replace the `<div class="cover-placeholder">…</div>` with
`<img class="cover" src="…/covers/name.jpg" alt="Cover of Title" width="…" height="…">`.

**Change colours or fonts**
Edit the variables at the top of `assets/css/style.css`. The brand colours come from the logo: ink `#171717` and gold `#ffbd59`. On light backgrounds use `--gold-deep` for text, because bright gold is unreadable there. The fonts load from Google Fonts in each page's `<head>`. The home page also loads the four decorative hero fonts.

## Open items from the WordPress move

- **Words of Love has no cover.** The image was already missing (404) on WordPress, so the page uses a typographic placeholder.
- **Words of Love isn't linked from any other page**, exactly as on WordPress. It is probably meant for subscribers. Ask Sarah where it should appear.
- **Short Stories for Subscribers** was password-protected on WordPress and its content could not be copied. A static site can't truly password-protect a page, so this needs a decision, for example sending stories through the newsletter instead.
- **The contact form became an email link.** A form would need a service such as Formspree or Netlify Forms; ask first.
- The **newsletter signup** and **reader reviews** sections still say "Coming soon…".
- Two untitled "cover unavailable" tiles on the WordPress My Books and Anthologies pages were dropped; their images were also missing.

## Publishing

The site isn't live from this repo yet; the WordPress site is still the public one. The simplest host is GitHub Pages: in the repo's **Settings → Pages**, set **Deploy from a branch**, then pick the branch and `/ (root)`. A custom domain can be added on the same screen later.
