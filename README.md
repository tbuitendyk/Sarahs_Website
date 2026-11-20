# Sarah's Books

The author website of Sarah Buitendyk, *Writing for God's glory*. It was moved from [sarahbuitendykbooks.wordpress.com](https://sarahbuitendykbooks.wordpress.com) in November 2026.

It's a plain HTML and CSS site with no build step, so any static host (GitHub Pages, Netlify, etc.) can serve it as it is.

## Write a blog post

1. Open [`content/blog-posts.txt`](content/blog-posts.txt). On GitHub, click the pencil icon to edit it.
2. Under the notes at the top, add a title line and then the post:

   ```
   === December 1, 2026 | My Post Title ===
   First paragraph.

   Second paragraph.
   ```

3. Save (on GitHub: **Commit changes**). The post appears at the top of the Blog page.

## Move a progress bar

In [`in-progress.html`](in-progress.html), find `--percent: 85` and change the number to anything from 0 (empty) to 100 (full).

## Add covers and links for the IGS books

In [`igs-files.html`](igs-files.html), each IGS book has a ✏️ note explaining how to swap in its cover and links. The buttons stay greyed out until a link is added.

## Preview it

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Editing with Claude

Sarah can also ask Claude Code to make any of these changes. [`CLAUDE.md`](CLAUDE.md) explains how the site is organised and gives the step-by-step for common jobs.
