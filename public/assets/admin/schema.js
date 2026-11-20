// What the admin shows: each section of the sidebar and the boxes in it.
// Field keys must match what src/render.js reads from the content.

const today = () => new Date().toISOString().slice(0, 10);

const LIST_CHOICES = [
  { value: "my-books", label: "My Books" },
  { value: "anthologies", label: "Anthologies" },
  { value: "igs-files", label: "IGS: Files" },
  { value: "subscribers", label: "Hidden subscriber page" },
];

const RICH_HELP = "“Heading” makes a section heading and “Big line” a large line of text. “Quote” makes a boxed note, or a Bible verse when its last line is the reference (like John 1:5).";

export const BOOK_FIELDS = [
  { key: "title", label: "Title", type: "string", required: true },
  { key: "label", label: "Small gold label", type: "string", help: "Optional words above the title, e.g. “IGS: Files” or “Anthology · Books for Bibles Press”." },
  { key: "cover", label: "Cover picture", type: "image", help: "Leave empty for a dark “Cover coming soon” cover." },
  { key: "buy", label: "Buy link", type: "url", help: "Where people can buy the book (copy the address from Amazon, etc.). Leave empty and the Buy the book button stays greyed out." },
  { key: "show_on", label: "Show this book on", type: "multiselect", choices: LIST_CHOICES, help: "Books appear on each list in the order of this Books section. My Books is for books and anthologies, not short stories." },
  { key: "card_text", label: "Text under the cover", type: "text", help: "Optional words shown under the cover on the book lists." },
  { key: "description", label: "The book’s own page", type: "rich", help: "Write anything here and the book gets its own page, and its Learn more button turns on. " + RICH_HELP },
  { key: "download", label: "Free download file", type: "file", help: "Only for free stories. Shows a Download button instead of Buy the book." },
  { key: "download_note", label: "Note under the download", type: "string" },
  { key: "id", label: "Web address name", type: "slug", help: "Used in the book page’s address, e.g. igs-1 gives books/igs-1.html. Leave empty to make one from the title. Don’t change it once people have the link." },
  { key: "subscribers_only", label: "Subscribers only: the book’s page and download need the subscriber password (set it under Newsletter)", type: "boolean" },
  { key: "hidden", label: "Keep this book’s page out of search engines (for subscriber-only stories)", type: "boolean" },
];

export const PAGE_FIELDS = [
  { key: "title", label: "Title", type: "string", required: true },
  { key: "eyebrow", label: "Small gold words above the title", type: "string" },
  { key: "intro", label: "Italic line under the title", type: "text" },
  { key: "photo", label: "Photo beside the text", type: "image" },
  { key: "photo_description", label: "What the photo shows", type: "string", help: "For people who can’t see pictures, e.g. “Sarah Buitendyk”." },
  { key: "body", label: "Page text", type: "rich", help: RICH_HELP },
  { key: "centered", label: "Centre the text", type: "boolean" },
  { key: "signup", label: "Show the newsletter sign-up form on this page", type: "boolean" },
  { key: "unlock_box", label: "Show the “Already a subscriber?” password box (it opens the subscriber stories page chosen under Newsletter)", type: "boolean" },
  {
    key: "book_list", label: "Book list on this page", type: "select",
    choices: [{ value: "none", label: "No book list" }, ...LIST_CHOICES],
    help: "Shows the books that have this list ticked under Books.",
  },
  { key: "book_list_heading", label: "Heading above the book list", type: "string" },
  {
    key: "menu", label: "Show in the menu", type: "select",
    choices: [{ value: "main", label: "Main menu" }, { value: "under-my-books", label: "Under “My Books”" }, { value: "no", label: "Not in the menu" }],
  },
  { key: "menu_label", label: "Menu wording", type: "string", help: "The words in the menu, if different from the title." },
  { key: "menu_position", label: "Menu position", type: "number", help: "Lower numbers come first. Main menu: Home 10, Blog 20, About 30, Contact 40, In Progress 50, My Books 60. Under My Books: IGS: Files 10, Anthologies 20, Short Stories 30. Use a number in between to fit a page in, e.g. 35." },
  { key: "subscribers_only", label: "Subscribers only: visitors need the subscriber password to see this page (set it under Newsletter)", type: "boolean" },
  { key: "hidden", label: "Hidden page: not in the menu and kept out of search engines. Only people with the link can open it.", type: "boolean" },
  { key: "slug", label: "Web address name", type: "slug", help: "e.g. “about” gives about.html. Leave empty to make one from the title. Don’t change it once people have the link." },
  { key: "description", label: "Description for search engines", type: "text" },
];

export const SECTIONS = [
  {
    id: "books", label: "Books", kind: "list", key: "books", fields: BOOK_FIELDS,
    intro: "Every book on the site. Books show on the lists in this order, so keep the newest at the top.",
    addLabel: "Add a book", addAt: "start",
    newItem: () => ({ title: "New book", id: "", label: "", cover: "", buy: "", show_on: ["my-books"], card_text: "", description: "", download: "", download_note: "", hidden: false }),
    pageUrl: (b, slugify) => ((b.description || b.download) ? `/books/${slugify(b.id || b.title)}.html` : null),
  },
  {
    id: "blog", label: "Blog posts", kind: "list", key: "blog",
    intro: "Posts show on the Blog page, newest date first.",
    addLabel: "Write a new post", addAt: "start",
    newItem: () => ({ title: "New post", date: today(), body: "" }),
    fields: [
      { key: "title", label: "Title", type: "string", required: true },
      { key: "date", label: "Date", type: "date" },
      { key: "body", label: "Post", type: "rich", help: RICH_HELP },
    ],
    pageUrl: () => "/blog.html",
  },
  {
    id: "pages", label: "Pages", kind: "list", key: "pages", fields: PAGE_FIELDS,
    intro: "The site’s pages (Home, Blog, Contact and In Progress have their own sections). Add a page here and choose where it goes in the menu.",
    addLabel: "Add a page", addAt: "end",
    newItem: () => ({ title: "New page", slug: "", menu: "main", menu_label: "", menu_position: 55, eyebrow: "", intro: "", photo: "", photo_description: "", body: "", book_list: "none", book_list_heading: "", centered: false, hidden: false, description: "" }),
    pageUrl: (pg, slugify) => `/${slugify(pg.slug || pg.title)}.html`,
  },
  {
    id: "home", label: "Home page", kind: "object", key: "home", pageUrl: () => "/",
    fields: [
      { key: "hero", label: "Welcome banner", type: "group", fields: [
        { key: "welcome", label: "Top line", type: "string" },
        { key: "left", label: "Left word (script letters)", type: "string" },
        { key: "middle", label: "Middle words (old-style letters, one word per line)", type: "string" },
        { key: "middle_small", label: "Small middle word", type: "string" },
        { key: "right", label: "Right word (bold letters)", type: "string" },
      ] },
      { key: "recent_release", label: "Recent release", type: "group", fields: [
        { key: "section_title", label: "Section heading", type: "string" },
        { key: "label", label: "Small gold label", type: "string" },
        { key: "title", label: "Book title", type: "string" },
        { key: "cover", label: "Cover picture", type: "image" },
        { key: "quote", label: "Verse or quote", type: "text" },
        { key: "quote_source", label: "Where the verse is from", type: "string" },
        { key: "text", label: "Text", type: "rich" },
        { key: "learn_more", label: "Learn more link", type: "url", help: "e.g. books/light-through-his-love.html" },
        { key: "buy", label: "Buy link", type: "url" },
      ] },
      { key: "about", label: "About me", type: "group", fields: [
        { key: "section_title", label: "Section heading", type: "string" },
        { key: "photo", label: "Photo", type: "image" },
        { key: "photo_description", label: "What the photo shows", type: "string" },
        { key: "text", label: "Text", type: "rich", help: RICH_HELP },
      ] },
      { key: "reviews", label: "What readers are saying", type: "group", fields: [
        { key: "title", label: "Section heading", type: "string" },
        { key: "text", label: "Text", type: "rich" },
      ] },
      { key: "newsletter", label: "Newsletter signup", type: "group", fields: [
        { key: "title", label: "Section heading", type: "string" },
        { key: "show_signup", label: "Show the sign-up form (its words are under Newsletter)", type: "boolean" },
        { key: "text", label: "Extra text above the form (optional)", type: "rich" },
      ] },
    ],
  },
  {
    id: "progress", label: "In Progress", kind: "object", key: "progress", pageUrl: () => "/in-progress.html",
    fields: [
      { key: "title", label: "Page title", type: "string" },
      { key: "eyebrow", label: "Small gold words above the title", type: "string" },
      {
        key: "items", label: "Works in progress", type: "list", addLabel: "Add a work in progress",
        newItem: () => ({ title: "New story", text: "", link: "", show_bar: true, percent: 0 }),
        fields: [
          { key: "title", label: "Title", type: "string", required: true },
          { key: "text", label: "Text", type: "rich" },
          { key: "show_bar", label: "Show a progress bar", type: "boolean" },
          { key: "percent", label: "Progress bar", type: "percent" },
          { key: "link", label: "Link", type: "url", help: "Optional page the title links to, e.g. igs-files.html or books/igs-1.html." },
        ],
      },
      { key: "description", label: "Description for search engines", type: "text" },
    ],
  },
  {
    id: "contact", label: "Contact page", kind: "object", key: "contact", pageUrl: () => "/contact.html",
    fields: [
      { key: "title", label: "Page title", type: "string" },
      { key: "show_signup", label: "Show the newsletter sign-up form at the top", type: "boolean" },
      { key: "note", label: "Note in a box at the top (optional)", type: "rich" },
      { key: "heading", label: "Heading", type: "string" },
      { key: "text", label: "Text", type: "rich" },
      { key: "button_label", label: "Email button wording", type: "string" },
      { key: "direct_text", label: "Words before the email address", type: "string" },
      { key: "description", label: "Description for search engines", type: "text" },
    ],
  },
  {
    id: "newsletter", label: "Newsletter", kind: "object", key: "newsletter", pageUrl: () => "/",
    intro: "The sign-up form (from Kit) and the subscriber password. The form shows wherever “Show the sign-up form” is ticked.",
    fields: [
      { key: "subscriber_password", label: "Subscriber password", type: "string", help: "Opens every page and story marked “Subscribers only”. Put it in the email Kit sends when someone confirms, or in your newsletters. If you change it, everyone needs the new one. Capital letters don’t matter. Until a password is set, subscriber pages stay closed." },
      { key: "locked_message", label: "Message on locked pages", type: "rich" },
      { key: "subscriber_page", label: "Subscriber stories page (its web address name)", type: "slug", help: "The page the “Already a subscriber?” box opens, e.g. subscriber-stories-iud5ltq5." },
      { key: "unlock_prompt", label: "Words above the “Already a subscriber?” password box", type: "rich" },
      { key: "heading", label: "Form heading", type: "string" },
      { key: "text", label: "Form text", type: "rich" },
      { key: "picture", label: "Picture on the form", type: "image" },
      { key: "placeholder", label: "Words inside the email box", type: "string" },
      { key: "button", label: "Button wording", type: "string" },
      { key: "small_print", label: "Small print under the button", type: "string" },
      { key: "success_message", label: "Message after someone subscribes", type: "string", help: "Keep this the same as in Kit." },
      { key: "subscribed_message", label: "Message when someone who already subscribed comes back", type: "string", help: "Kit remembers people who signed up on that device and shows this instead of the form." },
      { key: "kit_form_id", label: "Kit form number", type: "string", help: "From the form’s HTML code in Kit: the number after /forms/ (e.g. 10220250). Only change this if you make a new form in Kit." },
      { key: "kit_uid", label: "Kit form code", type: "string", help: "From the same code: the value after data-uid= (e.g. ab3680b7b5)." },
    ],
  },
  {
    id: "site", label: "Site settings", kind: "object", key: "site", pageUrl: () => "/",
    fields: [
      { key: "site_name", label: "Site name", type: "string" },
      { key: "tagline", label: "Tagline", type: "string" },
      { key: "author", label: "Author name (shown on “coming soon” covers)", type: "string" },
      { key: "email", label: "Email address", type: "string", help: "Shown on the Contact page and at the bottom of every page." },
      { key: "copyright", label: "Line at the very bottom", type: "string" },
      { key: "description", label: "Description for search engines", type: "text" },
    ],
  },
  { id: "files", label: "Pictures & files", kind: "files" },
  { id: "history", label: "Undo & history", kind: "history" },
  { id: "account", label: "Password", kind: "account" },
];

// Pictures that are part of the site's design, offered in the picture chooser.
export const BUILT_IN_PICTURES = [
  { url: "/assets/images/sarah.jpg", name: "sarah.jpg" },
  { url: "/assets/images/covers/light-through-his-love.jpg", name: "light-through-his-love.jpg" },
  { url: "/assets/images/logo.png", name: "logo.png" },
];
