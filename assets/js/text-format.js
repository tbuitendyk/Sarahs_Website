// Shared helpers that turn Sarah's plain-text files (content/*.txt) into web pages.
// Used by blog.js and books.js. Load this file before them.
window.SarahText = (function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Only allow ordinary web, email and on-site links.
  function safeUrl(url) {
    url = String(url || "").trim();
    if (/^(https?:|mailto:)/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "#";
    return url;
  }

  // Straight quotes typed in the text files become curly ones, like the rest of the site.
  function smartQuotes(s) {
    return s
      .replace(/(^|[\s(\[{—-])"/g, "$1“")
      .replace(/"/g, "”")
      .replace(/(^|[\s(\[{—-])'/g, "$1‘")
      .replace(/'/g, "’");
  }

  // **bold** and *italic*
  function format(text) {
    var s = escapeHtml(smartQuotes(String(text)));
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

  // Paragraphs (separated by empty lines), "- " bullet points and "---" dividers.
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

  function hasText(lines) {
    return lines.join("").trim().length > 0;
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  // Splits a file into blocks that each start with a "=== heading ===" line.
  // Lines starting with // are notes for Sarah and are skipped.
  function blocks(source) {
    var out = [], current = null;
    source.replace(/\r\n?/g, "\n").split("\n").forEach(function (line) {
      if (/^\s*\/\//.test(line)) return;
      var heading = line.match(/^\s*===\s*(.*?)\s*===\s*$/);
      if (heading) {
        current = { heading: heading[1], lines: [] };
        out.push(current);
        return;
      }
      if (current) current.lines.push(line);
    });
    return out;
  }

  function load(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  return {
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    format: format,
    inline: inline,
    body: body,
    hasText: hasText,
    slug: slug,
    blocks: blocks,
    load: load
  };
})();
