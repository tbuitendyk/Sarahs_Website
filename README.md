# Sarah's Books

The author website of Sarah Buitendyk, *Writing for God's glory*. It was moved from
[sarahbuitendykbooks.wordpress.com](https://sarahbuitendykbooks.wordpress.com) in November 2026.

## Editing the site

Sarah edits everything at **/admin** on the live site (**https://sarah.buitendyk.ca/admin** once it's
online), with her password:

- books, covers and buy links
- blog posts
- pages and the menu
- the home page, contact page and progress bars
- pictures and downloads
- the newsletter sign-up form (from Kit) and the subscriber password that opens the subscriber-only stories

Every save keeps the previous version, so changes can be undone. The admin's **Backups** section
saves a complete backup, and a script on the NAS does it every night: see **[BACKUP.md](BACKUP.md)**.

To put the site online the first time, follow **[SETUP.md](SETUP.md)** once.

## How it works

- Runs on Cloudflare Pages (free plan). `functions/[[path]].js` builds each page when it's
  visited, from content saved in Cloudflare KV.
- `public/` holds the design (styles, pictures) and the admin editor (`public/assets/admin/`).
- `src/` has the page templates (`render.js`), saving (`store.js`), login (`auth.js`),
  backups (`backup.js`) and the starting content (`defaults.js`).
- `tools/nas/` has the NAS backup, restore and scheduling scripts.

To try it on a computer (Node 18 or newer), run:

```bash
ADMIN_PASSWORD=pick-a-test-password node tools/dev-server.mjs
```

Then open http://localhost:8788 and http://localhost:8788/admin.

Developers (and Claude): see [`CLAUDE.md`](CLAUDE.md).
