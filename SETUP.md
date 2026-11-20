# One-time setup: put the site online with its admin page

Do this **once**. It takes about 15 minutes, all in the Cloudflare website, and costs nothing.
After that, Sarah edits everything at **your-site-address/admin** with her password.
She never needs GitHub or Claude.

Cloudflare sometimes renames menu items. If a name below doesn't match exactly, look for
the closest one.

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
   - **Project name:** this becomes the address. For example, `sarahsbooks` gives
     `https://sarahsbooks.pages.dev`.
   - **Production branch:** the repository's branch (currently `claude/sarahs-website-nbke6r`).
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

## 5. Log in

Open `https://<your-project-name>.pages.dev/admin`, type the password, and that's it.
Sarah can change the password later inside the admin (**Password** in the side menu).

## 6. Choose the subscriber password

The hidden subscriber page and Words of Love are **Subscribers only**. They stay closed
until a subscriber password is chosen.

1. In the admin, open **Newsletter** and type a **Subscriber password**. Save.
2. In Kit, put that password, and the hidden page's address, in the email new subscribers
   get: either the confirmation email or your first welcome email.
   - The address is `https://<your-project-name>.pages.dev/subscriber-stories-iud5ltq5.html`.
3. To change the password later, change it in the admin, then put the new one in your next
   newsletter. Everyone then needs the new password.

---

## Good to know

- **The newsletter sign-up form** is Kit's own form, so sign-ups go straight to your Kit list.
  Its words and messages can be changed in the admin under **Newsletter**. Keep the two
  messages there the same as in Kit.
- **Free plan limits:** about 100,000 page visits a day and 1,000 saves a day. That's far more than an author site needs.
- **Your own web address:** in the Cloudflare project, open **Custom domains** to add one,
  such as `books.buitendyk.ca`, if you control that domain. Cloudflare shows what to change.
- **Keep the repository private** (GitHub → repository → Settings → Danger Zone → Change
  visibility). Its code includes the hidden subscriber page's address. If it stays public,
  change that page's "Web address name" in the admin after launch, so the old address stops working.
- **Undo:** every save keeps the previous version for 6 months. To undo, go to **Undo & history** in the admin.
- **Forgotten password:** in the Cloudflare project, change the `ADMIN_PASSWORD` secret
  (Settings → Variables and Secrets) and retry the deployment. If Sarah had changed the password
  in the admin, that one wins. In that case, ask Claude to clear it, or delete the `auth:password`
  entry in the `sarahs-books` KV namespace.
