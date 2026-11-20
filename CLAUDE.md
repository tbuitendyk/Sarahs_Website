# Sarah's Books — author website

The website of **Sarah Buitendyk**, a young Christian author who writes clean contemporary, suspense and fantasy stories with romance woven in. The tagline is "Writing for God's glory".

The site was moved here in November 2026 from WordPress.com (sarahbuitendykbooks.wordpress.com). Sarah builds it out by asking Claude for changes, so assume the person you're talking to may not be a developer.

## Working with Sarah

- **Her words are hers. Copy them exactly.** Never paraphrase, shorten, summarise or "polish" her text, including blurbs and short versions on book cards. When a card needs a blurb, use her original text word for word. If you spot a typo, point it out and let her decide.
- Explain what you changed in plain language, with no jargon.
- After any visual change, preview the page and show her a screenshot at desktop and phone widths.
- Ask before big redesigns, frameworks or build tools, or third-party services (contact forms, newsletter tools, analytics).

## How the site works

Plain HTML pages, one stylesheet and two small scripts, with **no build step**. What's in the repo is exactly what gets published.

Preview locally from the repo folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The blog loads its posts from a file, so it needs this local server; opening the HTML file directly won't work.

```
index.html             Home: hero, recent release, about, reviews and newsletter placeholders
about.html             About Me
contact.html           Contact (email link)
blog.html              Blog. Shows the posts written in content/blog-posts.txt
in-progress.html       Works in progress, with progress bars
books.html             My Books
anthologies.html       Anthologies (under My Books)
igs-files.html         IGS: Files series page, with a cover and buttons for each book (under My Books)
short-stories.html     Short Stories for Subscribers (under My Books; placeholder)
books/<slug>.html      One page per book or story
content/blog-posts.txt All blog posts, as plain text. Sarah can edit this herself
assets/css/style.css   All styling. Colours and fonts are CSS variables at the top
assets/js/site.js      Mobile menu button
assets/js/blog.js      Reads content/blog-posts.txt and shows it on the Blog page
assets/images/         Logo, favicons, photo of Sarah; covers/ holds book covers
assets/downloads/      Files readers can download (e.g. words-of-love.docx)
.nojekyll              Tells GitHub Pages to serve files as they are
```

Places Sarah can edit herself are marked with ✏️ comments in the HTML.

## Rules for every edit

- **The header and footer are repeated in every page.** When you change the menu, the tagline, the footer or the email address, change it in *every* `.html` file. `grep -rl 'id="site-nav"' --include=*.html .` lists them all.
- **Use relative paths, never leading-slash paths.** Pages at the root use `assets/...` and `books/x.html`. Pages in `books/` use `../assets/...` and `../index.html`.
- **Mark the current page in the menu.** Its menu link gets `aria-current="page"`. On a book page, "My Books" gets `aria-current="true"`.
- **Every book cover gets two buttons under it: "Learn more" and "Buy the book".** Sarah asked for this on all book lists. Copy the `<article class="book-card">` markup from `books.html`.
- **A button with `href="#"` shows greyed out** and can't be clicked. It turns on by itself once a real link replaces the `#`. Use this for links that don't exist yet.
- **Every image needs `alt` text** and explicit `width` and `height` attributes. Keep images under about 300 KB; covers about 700 px wide is plenty.
- Use curly quotes and apostrophes (’ “ ”) in HTML to match the rest of the site.
- Update the `<title>` and `<meta name="description">` of every new page.

## Common tasks

**Add a blog post**
Add it at the **top** of `content/blog-posts.txt`, under the notes. The format is explained in the file:

```
=== December 1, 2026 | My Post Title ===
First paragraph.

Second paragraph with **bold**, *italic* and a [link](https://example.com).
```

Posts appear on the Blog page newest first; an empty file shows "Coming soon…". Each post gets its own link: `blog.html#december-1-2026-my-post-title`. Straight quotes typed in the file are shown as curly quotes automatically.

**Move a progress bar** (`in-progress.html`)
Change the number in `style="--percent: 85"`. It takes any number from 0 to 100. To add a bar to another book, copy its two `progress` lines.

**Add a new book**
1. Copy `books/light-through-his-love.html` to `books/<slug>.html`. Update the title, description, eyebrow, cover and text.
2. Copy a `book-card` block to the **top** of the grid in `books.html`. Sarah's rule for that page: books in publication order, newest first, and **no short stories**.
3. If it's an anthology, also add it to `anthologies.html`. If it's an IGS book, fill in its card on `igs-files.html`.
4. Ask whether it should replace the "Recent Release" on the home page.

**Fill in an IGS book** (`igs-files.html`)
There are four cards, IGS #1 to #4, from "One team. Three romances. Four stories.". Each has a "Cover coming soon" placeholder and greyed-out buttons. To add a cover, replace the `cover-placeholder` div with an `<img class="cover" …>`. To activate a button, put the link in place of its `#`. The ✏️ comment above each card spells this out.

**Change colours or fonts**
Edit the variables at the top of `assets/css/style.css`. The brand colours come from the logo: ink `#171717` and gold `#ffbd59`. On light backgrounds use `--gold-deep` for text, because bright gold is unreadable there.

## Open items

- **Words of Love has no cover.** The image was already missing (404) on WordPress, so the page uses a typographic placeholder.
- **Words of Love isn't linked from any other page**, exactly as on WordPress. It is probably meant for subscribers. Ask Sarah where it should appear.
- **Short Stories for Subscribers** was password-protected on WordPress and its content could not be copied. A static site can't truly password-protect a page.
- **The contact form became an email link.** Sarah's original sentence ends "…send a message with the form below." That part is left off because there is no form. A form would need a service such as Formspree; ask first.
- The **newsletter signup** and **reader reviews** sections still say "Coming soon…".
- **IGS #3 and #4** are placeholders based on "Four stories"; their real titles aren't known yet.

## Publishing

The site isn't live from this repo yet; the WordPress site is still the public one. The simplest host is GitHub Pages: in the repo's **Settings → Pages**, set **Deploy from a branch**, then pick the branch and `/ (root)`.
