// Shows the blog posts written in content/blog-posts.txt on the Blog page.
// The writing format is explained at the top of that file.
(function () {
  var box = document.getElementById("blog-posts");
  if (!box) return;

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Only allow ordinary web, email and on-site links.
  function safeUrl(url) {
    url = url.trim();
    if (/^(https?:|mailto:)/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "#";
    return url;
  }

  // Straight quotes typed in the text file become curly ones, like the rest of the site.
  function smartQuotes(s) {
    return s
      .replace(/(^|[\s(\[{—-])"/g, "$1“")
      .replace(/"/g, "”")
      .replace(/(^|[\s(\[{—-])'/g, "$1‘")
      .replace(/'/g, "’");
  }

  // **bold** and *italic*
  function format(text) {
    var s = escapeHtml(smartQuotes(text));
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>");
    return s;
  }

  // [link text](https://example.com)
  function inline(text) {
    var out = "", last = 0, m, re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    while ((m = re.exec(text))) {
      out += format(text.slice(last, m.index));
      out += '<a href="' + escapeHtml(safeUrl(m[2])) + '">' + format(m[1]) + "</a>";
      last = re.lastIndex;
    }
    return out + format(text.slice(last));
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "post";
  }

  function parse(source) {
    var posts = [], current = null;
    source.replace(/\r\n?/g, "\n").split("\n").forEach(function (line) {
      if (/^\s*\/\//.test(line)) return; // notes for Sarah, never shown
      var heading = line.match(/^\s*===\s*(.*?)\s*===\s*$/);
      if (heading) {
        var bits = heading[1].split("|");
        current = bits.length > 1
          ? { date: bits[0].trim(), title: bits.slice(1).join("|").trim(), lines: [] }
          : { date: "", title: heading[1].trim(), lines: [] };
        posts.push(current);
        return;
      }
      if (current) current.lines.push(line);
    });
    return posts;
  }

  function body(lines) {
    var html = [], para = [], list = [];
    function flushPara() {
      if (para.length) html.push("<p>" + para.map(inline).join("<br>") + "</p>");
      para = [];
    }
    function flushList() {
      if (list.length) {
        html.push("<ul>" + list.map(function (item) { return "<li>" + inline(item) + "</li>"; }).join("") + "</ul>");
      }
      list = [];
    }
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flushPara(); flushList(); return; }
      if (/^-{3,}$/.test(line)) { flushPara(); flushList(); html.push("<hr>"); return; }
      var item = line.match(/^[-*]\s+(.*)$/);
      if (item) { flushPara(); list.push(item[1]); return; }
      flushList();
      para.push(line);
    });
    flushPara();
    flushList();
    return html.join("\n");
  }

  function render(posts) {
    posts = posts.filter(function (p) { return p.title || p.lines.join("").trim(); });
    if (!posts.length) {
      box.innerHTML = '<p class="coming-soon">Coming soon…</p>';
      return;
    }
    var used = {};
    box.innerHTML = posts.map(function (p) {
      var id = slug(p.date + " " + p.title);
      while (used[id]) id += "-2";
      used[id] = true;
      return '<article class="post" id="' + id + '">' +
        (p.date ? '<p class="post-date">' + escapeHtml(p.date) + "</p>" : "") +
        '<h2><a href="#' + id + '">' + format(p.title) + "</a></h2>" +
        '<div class="prose">' + body(p.lines) + "</div>" +
        "</article>";
    }).join("\n");
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  fetch(box.getAttribute("data-source"), { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (text) { render(parse(text)); })
    .catch(function () {
      box.innerHTML = '<p class="coming-soon">The blog posts couldn’t be loaded right now. Please try again later.</p>';
    });
})();
