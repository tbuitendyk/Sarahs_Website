// Shows the blog posts written in content/blog-posts.txt on the Blog page.
// The writing format is explained at the top of that file.
// Needs text-format.js to be loaded first.
(function () {
  var T = window.SarahText;
  var box = document.getElementById("blog-posts");
  if (!box || !T) return;

  function render(source) {
    var posts = T.blocks(source).map(function (b) {
      var bits = b.heading.split("|");
      return bits.length > 1
        ? { date: bits[0].trim(), title: bits.slice(1).join("|").trim(), lines: b.lines }
        : { date: "", title: b.heading.trim(), lines: b.lines };
    }).filter(function (p) { return p.title || T.hasText(p.lines); });

    if (!posts.length) {
      box.innerHTML = '<p class="coming-soon">Coming soon…</p>';
      return;
    }
    var used = {};
    box.innerHTML = posts.map(function (p) {
      var id = T.slug(p.date + " " + p.title);
      while (used[id]) id += "-2";
      used[id] = true;
      return '<article class="post" id="' + id + '">' +
        (p.date ? '<p class="post-date">' + T.escapeHtml(p.date) + "</p>" : "") +
        '<h2><a href="#' + id + '">' + T.format(p.title) + "</a></h2>" +
        '<div class="prose">' + T.body(p.lines) + "</div>" +
        "</article>";
    }).join("\n");
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  T.load(box.getAttribute("data-source"))
    .then(render)
    .catch(function () {
      box.innerHTML = '<p class="coming-soon">The blog posts couldn’t be loaded right now. Please try again later.</p>';
    });
})();
