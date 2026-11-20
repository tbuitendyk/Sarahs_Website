// Builds the book lists (My Books, Anthologies, IGS: Files, the subscriber page)
// and each book's own page (book.html#name) from content/books.txt.
// The writing format is explained at the top of that file.
// Needs text-format.js to be loaded first.
(function () {
  var T = window.SarahText;
  var grids = document.querySelectorAll("[data-books]");
  var pageBox = document.getElementById("book-page");
  if (!T || (!grids.length && !pageBox)) return;

  var SOURCE = "content/books.txt";
  var FIELDS = {
    "title": "title", "label": "label", "cover": "cover", "buy": "buy",
    "show on": "showOn", "card text": "cardText", "page": "page", "download": "download"
  };

  function squash(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); }

  function parse(source) {
    return T.blocks(source).map(function (b) {
      var book = { id: T.slug(b.heading), title: "", label: "", cover: "", buy: "",
                   showOn: [], cardText: "", page: "", download: "", lines: [] };
      var i = 0;
      // The "Field: value" lines come first, before the first empty line.
      for (; i < b.lines.length; i++) {
        var m = b.lines[i].match(/^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/);
        var key = m && FIELDS[m[1].toLowerCase()];
        if (!key) break;
        var value = m[2].trim();
        book[key] = key === "showOn"
          ? value.split(",").map(squash).filter(Boolean)
          : value;
      }
      book.lines = b.lines.slice(i);
      if (!book.title) book.title = b.heading;
      return book;
    });
  }

  function coverSrc(name) {
    if (/^(https?:)?\/\//i.test(name) || name.indexOf("/") !== -1) return T.safeUrl(name);
    return "assets/images/covers/" + name;
  }

  function downloadHref(name) {
    if (/^(https?:)?\/\//i.test(name) || name.indexOf("/") !== -1) return T.safeUrl(name);
    return "assets/downloads/" + name;
  }

  // Where "Learn more" goes: the book's own hand-made page, the automatic
  // page if it has a description, or nowhere yet (greyed-out button).
  function learnMoreHref(book) {
    if (book.page) return T.safeUrl(book.page);
    if (T.hasText(book.lines)) return "book.html#" + book.id;
    return "#";
  }

  function coverHtml(book) {
    if (book.cover) {
      return '<img class="cover" src="' + T.escapeHtml(coverSrc(book.cover)) + '" alt="Cover of ' +
        T.escapeHtml(book.title) + '" width="663" height="1024">';
    }
    return '<div class="cover-placeholder">' +
      '<span class="ph-title">' + T.format(book.title) + "</span>" +
      '<span class="ph-author">Sarah Buitendyk</span>' +
      '<span class="ph-note">Cover coming soon</span>' +
      "</div>";
  }

  function secondButton(book) {
    if (book.download) {
      return '<a class="btn" href="' + T.escapeHtml(downloadHref(book.download)) + '" download>Download</a>';
    }
    return '<a class="btn" href="' + T.escapeHtml(book.buy ? T.safeUrl(book.buy) : "#") + '">Buy the book</a>';
  }

  function cardHtml(book) {
    var learn = learnMoreHref(book);
    var cover = learn === "#"
      ? coverHtml(book)
      : '<a class="cover-link" href="' + T.escapeHtml(learn) + '">' + coverHtml(book) + "</a>";
    return '<article class="book-card">' + cover +
      "<h3>" + T.format(book.title) + "</h3>" +
      (book.label ? '<p class="book-meta">' + T.format(book.label) + "</p>" : "") +
      (book.cardText ? "<p>" + T.inline(book.cardText) + "</p>" : "") +
      '<div class="btn-row">' +
      '<a class="btn btn-outline" href="' + T.escapeHtml(learn) + '">Learn more</a>' +
      secondButton(book) +
      "</div></article>";
  }

  function fillGrids(books) {
    Array.prototype.forEach.call(grids, function (grid) {
      var where = squash(grid.getAttribute("data-books"));
      var shown = books.filter(function (b) { return b.showOn.indexOf(where) !== -1; });
      grid.innerHTML = shown.length
        ? shown.map(cardHtml).join("\n")
        : '<p class="coming-soon">Coming soon…</p>';
    });
  }

  function renderPage(books) {
    var id = decodeURIComponent(location.hash.slice(1));
    var book = books.filter(function (b) { return b.id === id; })[0];

    if (book && book.page) { location.replace(book.page); return; }

    if (!book) {
      document.title = "Book not found – Sarah’s Books";
      pageBox.innerHTML =
        '<section class="page-hero"><div class="wrap"><h1>Book not found</h1></div></section>' +
        '<section class="section"><div class="wrap center">' +
        "<p>This book’s page couldn’t be found.</p>" +
        '<div class="btn-row btn-row-center"><a class="btn" href="books.html">See all my books</a></div>' +
        "</div></section>";
      return;
    }

    document.title = book.title + " – Sarah’s Books";
    pageBox.innerHTML =
      '<section class="page-hero"><div class="wrap">' +
      (book.label ? '<p class="eyebrow">' + T.format(book.label) + "</p>" : "") +
      "<h1>" + T.format(book.title) + "</h1></div></section>" +
      '<section class="section"><div class="wrap"><div class="feature">' +
      '<div class="feature-media">' + coverHtml(book) + "</div>" +
      '<div class="prose">' +
      (T.hasText(book.lines) ? T.body(book.lines) : '<p class="coming-soon">More about this book coming soon…</p>') +
      '<div class="btn-row">' + secondButton(book) + "</div>" +
      "</div></div></div></section>";
    window.scrollTo(0, 0);
  }

  T.load(SOURCE)
    .then(function (text) {
      var books = parse(text);
      if (grids.length) fillGrids(books);
      if (pageBox) {
        renderPage(books);
        window.addEventListener("hashchange", function () { renderPage(books); });
      }
    })
    .catch(function () {
      var msg = '<p class="coming-soon">The books couldn’t be loaded right now. Please try again later.</p>';
      Array.prototype.forEach.call(grids, function (grid) { grid.innerHTML = msg; });
      if (pageBox) pageBox.innerHTML = '<section class="section"><div class="wrap">' + msg + "</div></section>";
    });
})();
