# One-time setup: put the site online

## Where things stand

These decisions are made. Nothing has been set up yet.

| | |
| --- | --- |
| **Hosting** | Cloudflare Pages, free plan. The site's code comes from this GitHub repository. Sarah's content is kept in Cloudflare (KV). |
| **Address** | **https://sarah.buitendyk.ca**. `buitendyk.ca` is already ours, with its own DNS servers (`ns1`–`ns3.buitendyk.ca`), so nothing is bought and nothing moves to Cloudflare's DNS. Only one new line, `sarah`, is added. |
| **Backups** | Every night to the NAS: see [BACKUP.md](BACKUP.md). |
| **Old site** | sarahbuitendykbooks.wordpress.com stays exactly as it is until the new site has been checked. |

**Going back is always possible.** Nothing that exists today is changed:
- The WordPress site isn't touched.
- In the `buitendyk.ca` zone, only the new `sarah` line is added. The website, `www` and mail records are left alone.
- The code is marked with a `before-launch` tag first (step 0).

To undo the launch, delete the `sarah` line.

The whole setup takes about an hour, plus waiting for the address to start working. It costs nothing.
Afterwards, Sarah edits everything at **https://sarah.buitendyk.ca/admin** with her password,
without GitHub or Claude.

Cloudflare sometimes renames menu items. If a name below doesn't match exactly, look for
the closest one.

## 0. Before starting: make the restore point and make the repository private

1. **Restore point.** Ask Claude: *"Tag the current version as before-launch."* That marks this exact
   version of the code, so it can always be returned to.
2. **Make this repository private.** It's public at the moment, so anyone can read it:
   - the code, including the hidden subscriber page's address;
   - the Words of Love file, which is in `public/assets/downloads/`.

   Private repositories are free.
   On GitHub, go to **repository → Settings → General → Danger Zone → Change visibility → Private**.
   Cloudflare still works with a private repository: in step 3, allow it access when GitHub asks.

   Even when the repository is private, its earlier public versions may have been copied. So after
   launch, consider changing the hidden page's address: **Pages → that page → Web address name** in
   the admin. Then put the new link in Kit (step 8).

## 1. Create a free Cloudflare account

Go to **dash.cloudflare.com** and sign up. The free plan is all you need; no card is required.

## 2. Make a storage space for the site's content

This is where the site keeps its words, pictures and uploads.

1. In the left menu, open **Storage & Databases → KV** (in some dashboards it's
   **Workers & Pages → KV**).
2. Click **Create** (or "Create a namespace"), name it `sarahs-books`, and save.

## 3. Connect the website

1. Open **Workers & Pages** and click **Create** (or "Create application").
2. Choose the **Pages** option, then **Connect to Git** ("Import an existing Git repository").
3. Sign in to GitHub when asked, and pick the **Sarahs_Website** repository.
   This is the only time GitHub is needed.
4. Fill in:
   - **Project name:** `sarahsbooks`. This also gives the site a spare address,
     `https://sarahsbooks.pages.dev`, which keeps working. If that name is taken, pick another
     and use it wherever `sarahsbooks` appears below.
   - **Production branch:** `claude/sarahs-website-nbke6r` (the repository's main branch).
   - **Framework preset:** None.
   - **Build command:** leave empty. If Cloudflare insists, type `exit 0`.
   - **Build output directory:** `public`.
5. Click **Save and Deploy** and wait for it to finish.

## 4. Link the storage space and set the password

In the new project, open **Settings**:

1. Under **Bindings**, click **Add**, then choose **KV namespace**:
   - **Variable name:** `SITE` (exactly like that, in capitals)
   - **KV namespace:** `sarahs-books`
2. Under **Variables and Secrets**, click **Add**:
   - **Type:** Secret
   - **Variable name:** `ADMIN_PASSWORD`
   - **Value:** the password Sarah will use to log in (at least 10 characters)
3. Save. Then open **Deployments**, find the latest one, and choose **Retry deployment**,
   so the site picks up these settings.

## 5. Log in and check

Open `https://sarahsbooks.pages.dev/admin`, type the password, and that's it.
Sarah can change the password later inside the admin (**Password** in the side menu).

Look through the site at `https://sarahsbooks.pages.dev` before going on.

## 6. The address: sarah.buitendyk.ca

Do these in this order. If the DNS line goes in before Cloudflare knows about the address,
the address shows an error page until step 1 is done.

1. **In Cloudflare:** open the Pages project, then **Custom domains → Set up a custom domain**.
   Type `sarah.buitendyk.ca` and continue. Cloudflare sees that `buitendyk.ca` isn't on Cloudflare's
   DNS. It offers to set up a **CNAME** record yourself ("Begin CNAME setup"). Choose that.
   **Don't** move the domain's nameservers to Cloudflare.
2. **On the main DNS server for `buitendyk.ca`** (the one whose zone file you edit), add one line
   to the `buitendyk.ca` zone. The dot at the end matters:

   ```
   sarah    300    IN    CNAME    sarahsbooks.pages.dev.
   ```

   Then raise the zone's **serial number** (in the SOA record at the top) and reload the zone:

   ```bash
   rndc reload buitendyk.ca
   ```

   (or `systemctl reload named`, if `rndc` isn't set up on that server.)

   If `ns2` and `ns3` copy the zone from the main server, they pick the change up once the serial
   number goes up.
3. **Check** that all three servers answer `sarahsbooks.pages.dev.` (run each line on its own):

   ```bash
   dig +short sarah.buitendyk.ca @ns1.buitendyk.ca
   ```

   ```bash
   dig +short sarah.buitendyk.ca @ns2.buitendyk.ca
   ```

   ```bash
   dig +short sarah.buitendyk.ca @ns3.buitendyk.ca
   ```

4. **Wait** until Cloudflare shows the custom domain as **Active**. That takes from a few minutes to
   a day. Cloudflare makes the HTTPS certificate itself.
   - If it stays stuck: check whether the zone has **CAA** records. If it does, they must also allow
     `letsencrypt.org`, `pki.goog` and `ssl.com`, which are the certificate companies Cloudflare uses.
5. Open **https://sarah.buitendyk.ca** and **https://sarah.buitendyk.ca/admin**.

**Don't change anything else in the zone:**
- the `buitendyk.ca` and `www` records;
- the **MX record**, because e-mail depends on it;
- the NS records.

**To undo:** delete the `sarah` line, raise the serial number and reload.

## 7. Choose the subscriber password

The hidden subscriber page and Words of Love are **Subscribers only**. They stay closed
until a subscriber password is chosen.

1. In the admin, open **Newsletter** and type a **Subscriber password**. Save.
2. In Kit, put that password and the hidden page's address in the email new subscribers
   get. That can be the confirmation email or your first welcome email.
   - The address is `https://sarah.buitendyk.ca/subscriber-stories-iud5ltq5.html`. If the page's
     "Web address name" was changed (step 0), use the new name.
   - Subscribers can also type the password into the "Already a subscriber?" box on the
     public Short Stories for Subscribers page, which then takes them to the stories. That box
     only appears on a phone or computer where the person signed up.
   - Once entered, the password is remembered on that device for 30 days. Change the number
     under **Newsletter** in the admin.
3. To change the password later, change it in the admin, then put the new one in your next
   newsletter. Everyone then needs the new password.

## 8. After the launch

1. **Backups:** set up the NAS (see [BACKUP.md](BACKUP.md)). Until then, use **Backups →
   Download a backup now** in the admin.
2. **Kit:** check that the confirmation and welcome emails link to `sarah.buitendyk.ca`. Send
   yourself a test sign-up with a real address of your own.
3. **The old WordPress site:** leave it as it is for a week or two while the new site settles in.
   1. Then edit its home page to say the website has moved, with a link to https://sarah.buitendyk.ca.
      (WordPress.com's automatic redirect is a paid upgrade, so it isn't used.)
   2. Later, set it to **Private** under **Settings → General → Privacy**, or delete it.

---

## Good to know

- **The newsletter sign-up form** is Kit's own form, so sign-ups go straight to your Kit list.
  Its words and messages can be changed in the admin under **Newsletter**. Keep the two
  messages there the same as in Kit.
- **Free plan limits:** about 100,000 page visits a day and 1,000 saves a day. That's far more than an author site needs.
- **Undo:** every save keeps the previous version for 6 months. To undo, go to **Undo & history** in the admin.
- **The admin password.** The first one is the `ADMIN_PASSWORD` secret typed in at step 4.
  - **To change it:** log in, open **Password** in the side menu, type the current password,
    then the new one twice (at least 10 characters). It works straight away.
    - That device stays logged in; any other phone or computer has to log in again.
    - From then on, the old Cloudflare secret no longer opens the admin.
  - **Staying logged in:** a phone or computer stays logged in for 30 days (or until **Log out**).
  - **Wrong passwords:** after 10 wrong tries in 15 minutes, the admin makes you wait 15 minutes.
- **Forgotten password:** whoever has the Cloudflare login can reset it. It doesn't need Claude or GitHub.
  1. In Cloudflare, open **Storage & Databases → KV → `sarahs-books`**. Find the entry
     **`auth:password`** and delete it. That removes the password chosen in the admin; nothing else changes.
  2. The admin now opens with the `ADMIN_PASSWORD` secret again. If that one is forgotten too, open
     **Workers & Pages → the project → Settings → Variables and Secrets** and edit `ADMIN_PASSWORD`.
     Then open **Deployments** and choose **Retry deployment** on the latest one.
  3. Log in, and choose a new password under **Password**.
- **Changes to the design** (by Claude, in this repository) go live by themselves a minute or two
  after they're pushed to the production branch. Sarah's own edits in the admin are never affected by that.
