# Backups to the NAS

The website keeps Sarah's words, settings, uploads and earlier versions in Cloudflare.
Every night, a small script on the NAS downloads all of it as **one backup file**.

- **The NAS does the fetching.** It only makes ordinary outgoing web requests, like a browser.
  The website never connects to the NAS, so no ports need opening and no remote access is needed.
- **It uses a backup key, not the admin password.** The key can only *read* a backup. It can't
  change anything on the site, and it can be replaced or switched off any time in the admin.
- **The admin shows whether it's working.** **Backups** in the admin shows the last
  backup. It turns orange if there hasn't been one for 3 days.
- **Any time, without the NAS:** **Backups → Download a backup now** in the admin saves the same
  backup file to whatever computer you're on.

Set this up **after the site is online** (see [SETUP.md](SETUP.md)).

## What's in a backup

Each backup is one file, `sarahs-books-YYYY-MM-DD_HHMMSS.tar.gz`. It opens with 7-Zip on
Windows, or by double-clicking on a Mac.

| Inside | What it is |
| --- | --- |
| `content.json` | All the words and settings: books, pages, blog posts, home page, newsletter settings… |
| `files/` | Every picture and file uploaded in the admin |
| `assets/` | The built-in pictures and downloads the content uses (covers, photos, Words of Love) |
| `history/` | The earlier versions listed under **Undo & history** (kept 6 months on the site) |
| `stats/` | Visitor counts, one spreadsheet (`.csv`) per month, once visitor counting is switched on. They're kept for reference: a restore doesn't put them back. |
| `manifest.json`, `README.txt` | When it was made, what's in it, and how to restore it |

Backups contain the subscriber password, so keep the backup folder private (admin only).
They don't contain the admin password.

## Set it up (once)

On the NAS, everything lives in one folder: **`/share/CACHEDEV3_DATA/scb-site-backup`**.

1. **Create the folder.** In QTS, use **Control Panel → Shared Folders → Create**. Name it
   `scb-site-backup`, put it on the volume behind `CACHEDEV3_DATA`, and give access to admin only.
   Or, over SSH:

   ```bash
   mkdir -p /share/CACHEDEV3_DATA/scb-site-backup
   ```

2. **Put the scripts in it.** Copy the four files from the repository's
   [`tools/nas`](tools/nas) folder into `scb-site-backup`, using File Station or the network share:
   - `sarahs-books-backup.sh`
   - `sarahs-books-restore.sh`
   - `qnap-install.sh`
   - `sarahs-books-backup.conf.example`

   (On GitHub: **Code → Download ZIP**, or ask Claude to send them to you.)

3. **Create the backup key.** In the website's admin, open **Backups → Create a backup key** and click
   **Copy**. It is shown only once. If it's lost, just create a new one.

4. **Make the settings file.** Over SSH, paste these lines. Put your key in place of `sbk_YOUR-KEY` first:

   ```bash
   cd /share/CACHEDEV3_DATA/scb-site-backup
   cp sarahs-books-backup.conf.example sarahs-books-backup.conf
   chmod 600 sarahs-books-backup.conf
   sed -i 's|PASTE-THE-BACKUP-KEY-HERE|sbk_YOUR-KEY|' sarahs-books-backup.conf
   ```

   The other settings are already filled in:
   - **Where backups go:** `scb-site-backup/backups`.
   - **How many to keep:** 60.
   - **Log file:** `backup.log`.
   - **When it runs:** every night at 3:17.

   Change any of them by editing the file.

5. **Try it.**

   ```bash
   sh /share/CACHEDEV3_DATA/scb-site-backup/sarahs-books-backup.sh
   ```

   ```bash
   tail /share/CACHEDEV3_DATA/scb-site-backup/backup.log
   ```

   The log should end with `Saved …` and `Done`. A file should appear in `scb-site-backup/backups`.
   The admin's **Backups** page should turn green.

6. **Put it on the schedule.** Run this once now:

   ```bash
   sh /share/CACHEDEV3_DATA/scb-site-backup/qnap-install.sh
   ```

   QNAP can forget scheduled jobs after a restart or a firmware update. So also add this line
   to the NAS start-up script (`/share/ICLDRVol2/datadr/startup.sh`). It puts the job back at
   every start-up, and running it again never adds a second copy:

   ```
   sh /share/CACHEDEV3_DATA/scb-site-backup/qnap-install.sh >> /share/CACHEDEV3_DATA/scb-site-backup/install.log 2>&1 || true
   ```

   The installer only touches its own line in `/etc/config/crontab`, which ends in `# sarahs-books-backup`.
   The first time, it saves a copy of the original as `scb-site-backup/crontab.before-install`.

7. **Get told when a backup fails.** A failed backup writes an **Error** to the NAS's system log
   (QuLog Center, or System Logs in older QTS). To get an e-mail about it, set up a rule in
   **Notification Center** for error events. Test it (nothing is backed up and nothing breaks):

   ```bash
   sh /share/CACHEDEV3_DATA/scb-site-backup/sarahs-books-backup.sh --test-alert
   ```

   Another way: put an address in `ALERT_EMAIL` in the settings file. That uses the NAS's own e-mail settings.

## Everyday use

Nothing to do. Now and then, glance at **Backups** in the admin.

- **Change the time:** edit `SCHEDULE` in the settings file, then run `qnap-install.sh` again.
- **Keep more or fewer:** change `KEEP`. Each nightly file is small (well under 1 MB to start with).
- **A second copy somewhere else:** point QNAP's Hybrid Backup Sync, or rsync, at
  `scb-site-backup/backups`. (rsync can't talk to Cloudflare directly; that's why the script
  downloads over the web.)

## Putting a backup back

- **Undo a recent change:** no backup needed. Use **Undo & history** in the admin.
- **Put a whole backup back:** over SSH on the NAS, run:

  ```bash
  cd /share/CACHEDEV3_DATA/scb-site-backup
  ```

  ```bash
  sh sarahs-books-restore.sh backups/sarahs-books-2026-12-01_031700.tar.gz https://sarah.buitendyk.ca
  ```

  It shows the backup's date, asks you to confirm, then asks for the admin password. Then it puts back
  every uploaded file and all the content. Whatever was on the site just before is kept under
  **Undo & history**, so a restore can itself be undone. It works with backups from the admin's
  **Download a backup now** too: copy the file to the NAS first.
- **If the Cloudflare project itself is gone:** do [SETUP.md](SETUP.md) steps 1–5 again. The design
  and code come back from GitHub. Then restore the newest backup as above.

`assets/` doesn't need restoring, because those files come back with the code from GitHub.
The files in `history/` are for reference. Open one in a text editor to read an older version's words.

## If something goes wrong

| In `backup.log` | What to do |
| --- | --- |
| `could not get the list … (check SITE and BACKUP_KEY)` | The key was replaced or switched off in the admin, or `SITE` is wrong. Create a new key and put it in the settings file. |
| `SSL certificate problem` | The NAS's list of trusted certificates is too old for the site. Update the NAS firmware, or ask Claude. |
| `another backup is still running` | Two runs overlapped. It sorts itself out. A run that was cut off (power cut, restart) is cleared automatically next time. |
| `BACKUP_KEY is not filled in` | Do step 4. |
| Nothing new in the log | The job isn't scheduled. Run `qnap-install.sh` and check the start-up script line (step 6). |

**To switch backups off:**
- In the admin: **Backups → Turn off automatic backups** (the key stops working at once).
- On the NAS:

  ```bash
  sh /share/CACHEDEV3_DATA/scb-site-backup/qnap-install.sh remove
  ```

  Then also remove the line from the start-up script.

## For developers

- **Endpoints:** `GET /api/backup/*`. Each one takes the backup key (`Authorization: Bearer sbk_…`)
  or an admin login, and is `no-store` and `noindex`.
- **The list:** `list` is tab-separated `kind, size|-, path, url`, after the header line
  `# sarahs-books backup list 1`. `done?items=&bytes=` records a finished run.
- **The key:** only its SHA-256 is stored, in KV `auth:backup_key`. The last run is kept in `meta:last-auto-backup`.
- **Admin side:** `GET backup` (status), `POST backup/key`, `DELETE backup/key` and `PUT files/<name>`
  (used by the restore script).
- **Code:** `src/backup.js` decides what a backup holds. Anything new that's saved in KV must be added to `collect()`.
- **Visitor counts:** they live in D1 (`STATS`), not KV. `collect()` lists one `stats/visitors-YYYY-MM.csv` per month
  (`/api/backup/stats/YYYY-MM`). They aren't restored.
- **Scripts:** the NAS scripts are POSIX `sh` and are tested with BusyBox (as on QNAP) and dash. They need
  only curl, tar and gzip.
