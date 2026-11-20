# Sarah's Books — author website

The website of **Sarah Buitendyk**, a young Christian author who writes clean contemporary, suspense and fantasy stories with romance woven in. The tagline is "Writing for God's glory".

The site was moved here in November 2026 from WordPress.com (sarahbuitendykbooks.wordpress.com). Sarah builds it out by asking Claude for changes, so assume the person you're talking to may not be a developer.

## Working with Sarah

- **Her words are hers. Copy them exactly.** Never paraphrase, shorten, summarise or "polish" her text, including blurbs and short versions on book cards. When a card needs a blurb, use her original text word for word. If you spot a typo, point it out and let her decide.
- Explain what you changed in plain language, with no jargon.
- After any visual change, preview the page and show her a screenshot at desktop and phone widths.
- Ask before big redesigns, frameworks or build tools, or third-party services (contact forms, newsletter tools, analytics).

## How the site works

Plain HTML pages, one stylesheet and a few small scripts, with **no build step**. What's in the repo is exactly what gets published.

Preview locally from the repo folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The blog and the book lists load from text files, so they need this local server; opening the HTML files directly won't work.

```
index.html             Home: hero, recent release, about, reviews and newsletter placeholders
about.html             About Me
contact.html           Contact (email link)
blog.html              Blog. Shows the posts written in content/blog-posts.txt
in-progress.html       Works in progress, with progress bars
books.html             My Books (book list comes from content/books.txt)
anthologies.html       Anthologies (under My Books; list from content/books.txt)
igs-files.html         IGS: Files series page (under My Books; list from content/books.txt)
short-stories.html     Short Stories for Subscribers: public placeholder (under My Books)
subscriber-stories-iud5ltq5.html
                       HIDDEN subscriber page. Only reachable by the link in the newsletter
book.html              Automatic page for any book in content/books.txt, e.g. book.html#igs-1
books/<slug>.html      Hand-made pages for older books (Light Through His Love, Words of Love)
content/books.txt      Every book card and automatic book page, as plain text. Sarah can edit this herself
content/blog-posts.txt All blog posts, as plain text. Sarah can edit this herself
assets/css/style.css   All styling. Colours and fonts are CSS variables at the top
assets/js/site.js      Mobile menu button
assets/js/text-format.js  Shared: turns the plain-text files into formatted text
assets/js/blog.js      Reads content/blog-posts.txt and shows it on the Blog page
assets/js/books.js     Reads content/books.txt: fills the book lists and book.html
assets/images/         Logo, favicons, photo of Sarah; covers/ holds book covers
assets/downloads/      Files readers can download (e.g. words-of-love.docx)
.nojekyll              Tells GitHub Pages to serve files as they are
```

Places Sarah can edit herself are marked with ✏️ comments in the HTML.

## Rules for every edit

- **The header and footer are repeated in every page.** When you change the menu, the tagline, the footer or the email address, change it in *every* `.html` file. `grep -rl 'id="site-nav"' --include=*.html .` lists them all.
- **Use relative paths, never leading-slash paths.** Pages at the root use `assets/...` and `books/x.html`. Pages in `books/` use `../assets/...` and `../index.html`.
- **Mark the current page in the menu.** Its menu link gets `aria-current="page"`. On a book page, "My Books" gets `aria-current="true"`.
- **Book cards live in `content/books.txt`, not in the HTML.** Every cover gets a "Learn more" button and a "Buy the book" button (Sarah asked for this on all book lists). Free stories with `Download:` get "Download" instead of "Buy the book".
- **A button with `href="#"` shows greyed out** and can't be clicked. In `books.txt`, an empty `Buy:` or a book with no description (so no page yet) produces this.
- **Never link to the hidden subscriber page** (`subscriber-stories-iud5ltq5.html`) from anywhere on the site, and keep its `noindex` meta tag. It's only shared in Sarah's newsletter. `books/words-of-love.html` is a subscriber story, so it has `noindex` too.
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

**Add a new book, or fill in an IGS book**
Everything is in `content/books.txt`; the format is explained at the top of the file. Each book is a block:

```
=== igs-1 ===
Title: IGS #1
Label: IGS: Files
Cover: igs-1.jpg
Buy: https://www.amazon.com/...
Show on: IGS: Files, My Books
Card text: Optional words under the cover.

The description. This becomes the book's own page at book.html#igs-1.
```

- Books show in file order. On My Books, Sarah's rule is publication order, newest first, and **no short stories**.
- `Show on:` takes My Books, Anthologies, IGS: Files and Subscribers.
- Cover pictures go in `assets/images/covers/`; `Cover:` is just the file name.
- Writing a description creates the book's page and turns on its Learn more button.
- `Page:` points Learn more at a hand-made page instead (used by the two older books).
- Ask whether a new book should replace the "Recent Release" on the home page.

There are four IGS cards (IGS #1 to #4), from "One team. Three romances. Four stories.". Only IGS #1 has a description, so far just its line from In Progress.

**Add a story to the hidden subscriber page**
Add it to `content/books.txt` with `Show on: Subscribers`. For a free download, put the file in `assets/downloads/` and add `Download: file-name.docx`.

**Change colours or fonts**
Edit the variables at the top of `assets/css/style.css`. The brand colours come from the logo: ink `#171717` and gold `#ffbd59`. On light backgrounds use `--gold-deep` for text, because bright gold is unreadable there.

## Open items

- **Words of Love has no cover.** The image was already missing (404) on WordPress, so the page uses a typographic placeholder.
- **Words of Love** is listed only on the hidden subscriber page. That's an assumption: it was unlinked on WordPress and looked like a subscriber story.
- **The hidden subscriber page is unlisted, not locked.** Anyone who has the link can open it, including people a newsletter is forwarded to. While the GitHub repo is public, anyone browsing it can also see the page's name and the stories, so the repo should be made private before launch (see Publishing).
- **The contact form became an email link.** Sarah's original sentence ends "…send a message with the form below." That part is left off because there is no form. A form would need a service such as Formspree; ask first.
- The **newsletter signup** and **reader reviews** sections still say "Coming soon…".
- **IGS #3 and #4** are placeholders based on "Four stories"; their real titles aren't known yet.

## Publishing

The site isn't live from this repo yet; the WordPress site is still the public one. Sarah doesn't want to pay for anything, so hosting must be free.

- **Recommended: Cloudflare Pages (free).** It works with a **private** GitHub repo, which keeps the hidden subscriber page's name out of public view. The address is `https://<chosen-name>.pages.dev`. No build command; the output directory is the repo root.
- GitHub Pages is also free, but only for public repos. Its address would be `https://tbuitendyk.github.io/Sarahs_Website/`.
- A personalised address needs a domain name, which usually costs a small yearly fee. Sarah's email is at `buitendyk.ca`, though, so whoever controls that domain could point a free subdomain (for example `books.buitendyk.ca`) at the site.
