# Sarah's Books

The author website of Sarah Buitendyk, *Writing for God's glory*. It was moved from [sarahbuitendykbooks.wordpress.com](https://sarahbuitendykbooks.wordpress.com) in November 2026.

## Editing the site

Sarah edits everything (books, blog posts, pages, pictures, progress bars) in her own
dashboard at **app.pagescms.org**, logging in with her email. She doesn't need GitHub
or Claude for this. To get it running the first time, follow **[SETUP.md](SETUP.md)**
once.

## How it works

- `content/*.json` holds all the words and settings. The dashboard edits these files;
  `.pages.yml` says which boxes the dashboard shows.
- `build.py` turns them into the finished website in `_site/`, using the shared design
  in `assets/`. The host (Cloudflare Pages) runs it automatically after each change.

To preview on a computer, run:

```bash
python3 build.py
```

```bash
python3 -m http.server 8000 -d _site
```

Then open http://localhost:8000.

Developers (and Claude): see [`CLAUDE.md`](CLAUDE.md).
