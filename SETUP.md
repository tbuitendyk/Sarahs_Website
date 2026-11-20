# One-time setup: put the site online and switch on Sarah's dashboard

Do this **once**. It takes about 15 minutes and costs nothing. Whoever owns the
GitHub account (`tbuitendyk`) does steps 1–3. After step 4, Sarah edits everything from
her dashboard with just her email address, and never needs GitHub or Claude.

## 1. Make the repository private (recommended)

This keeps the hidden subscriber page's address and the stories out of public view.

GitHub → the **Sarahs_Website** repository → **Settings** → **General** → scroll to
**Danger Zone** → **Change visibility** → **Make private**.

## 2. Put the site online with Cloudflare (free)

1. Create a free account at **dash.cloudflare.com**.
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (sometimes
   labelled "Import an existing Git repository").
3. Connect your GitHub account when asked, and pick **Sarahs_Website**.
4. Fill in the settings:
   - **Project name:** what you want in the address, e.g. `sarahsbooks` gives
     `https://sarahsbooks.pages.dev`
   - **Production branch:** the repository's branch (currently `claude/sarahs-website-nbke6r`)
   - **Framework preset:** None
   - **Build command:** `python3 build.py`
   - **Build output directory:** `_site`
5. Click **Save and Deploy**. After a minute or two the site is live at the address
   above. From then on it updates by itself every time something is saved in the
   dashboard.

Optional: under the project's **Custom domains**, an address like `books.buitendyk.ca`
can be added for free by whoever manages the `buitendyk.ca` domain.

## 3. Switch on the dashboard (Pages CMS, free)

1. Go to **app.pagescms.org** and sign in with the GitHub account.
2. When asked, install the Pages CMS app on the **Sarahs_Website** repository.
3. Open **Sarahs_Website** in Pages CMS and choose the same branch as in step 2.
   You'll see Books, Blog posts, Pages, Home page, In Progress, Contact page and Site
   settings in the sidebar.
4. Open the project's settings and find **Collaborators**. Invite **Sarah's email
   address**.

## 4. Sarah logs in

Sarah opens the invitation email and logs in to **app.pagescms.org** with her email.
That's all she needs from now on: change something, press **Save**, and the
website updates itself a minute or two later.

## What Sarah can do in the dashboard

- **Books:** add a book, upload its cover, add the buy link, and choose which lists it
  shows on. Writing in "The book's own page" gives the book its own page and turns
  on its Learn more button.
- **Blog posts:** write, edit or delete posts.
- **Pages:** edit any page's text, or add a new page and put it in the menu (Main menu
  or Under My Books, at any position). A page can also be made hidden, like the
  subscriber page.
- **Home page, In Progress, Contact page:** change any of the words. In Progress has
  a number from 0 to 100 for each progress bar.
- **Site settings:** the site name, tagline, email address and footer line.
- **Pictures and downloads:** upload them right inside the dashboard.
