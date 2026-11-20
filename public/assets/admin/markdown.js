// Turns the formatted text Sarah writes in the admin (stored as Markdown) into HTML.
// Used by the website (src/render.js) and by the admin editor, so text looks the same in both.
//
//   ## Heading       -> section heading
//   ### Big line     -> big display line (e.g. "Hi!")
//   > quote          -> boxed note, or Bible-verse style when its last line is a reference like "John 1:5"
//   - item / 1. item -> lists        --- -> divider
//   **bold**  *italic*  ~~strike~~  [link](https://...)  ![picture](/files/x.jpg)

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function text(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

// A picture or file path, made relative to the page (p is "" or "../").
export function assetUrl(path, p = "") {
  path = text(path);
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path) || /^(blob|data):/i.test(path)) return path;
  return p + path.replace(/^\/+/, "");
}

// A link typed by Sarah. Web addresses stay as they are; site pages get the right prefix.
export function linkUrl(url, p = "") {
  url = text(url);
  if (!url) return "";
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "#"; // javascript: and other schemes
  return p + url.replace(/^\/+/, "");
}

export function smartQuotes(s) {
  return s
    .replace(/(^|[\s(\[{—-])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s(\[{—-])'/g, "$1‘")
    .replace(/'/g, "’");
}

const ALLOWED_TAGS = /&lt;(\/?)(u|s|em|strong|sup|sub|mark)&gt;|&lt;br\s*\/?&gt;/gi;

export function inline(src, p = "") {
  src = String(src ?? "");
  const tokens = [];
  const keep = (html) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };
  src = src.replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, (_, c) => keep(esc(c)));
  src = src.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  src = src.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (_, alt, url) => keep(`<img src="${esc(assetUrl(url, p))}" alt="${esc(alt)}" loading="lazy">`));
  src = src.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (_, label, url) => keep(`<a href="${esc(linkUrl(url, p))}">${inline(label, p)}</a>`));
  src = src.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => keep(`<a href="${esc(u)}">${esc(u)}</a>`));

  let out = esc(smartQuotes(src));
  out = out.replace(ALLOWED_TAGS, (m, slash, tag) => (tag === undefined ? "<br>" : `<${slash}${tag.toLowerCase()}>`));
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  out = out.replace(/~~(.+?)~~/g, "<s>$1</s>");
  out = out.replace(/(?<![*\p{L}\p{N}_])\*(?![\s*])(.+?)(?<!\s)\*(?!\*)/gu, "<em>$1</em>");
  out = out.replace(/(?<![_\p{L}\p{N}])_(?![\s_])(.+?)(?<!\s)_(?![_\p{L}\p{N}])/gu, "<em>$1</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}

const SCRIPTURE_REF = /^[—–-]?\s*(?:[1-3]\s?)?[A-Z][A-Za-z]+\.?\s+\d+:\d+/;
const HR = /^([-*_])(\s*\1){2,}$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+/;

// options.editor: plain tags (h3, blockquote) that the admin's editor understands.
export function markdown(src, p = "", options = {}) {
  const editor = !!options.editor;
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const para = (buf) => {
    const parts = [];
    buf.forEach((ln, j) => {
      const hard = ln.endsWith("\\") || ln.endsWith("  ");
      ln = hard ? ln.replace(/\\+$/, "").trimEnd() : ln.trim();
      parts.push(inline(ln, p));
      if (j < buf.length - 1) parts.push("<br>");
    });
    return "<p>" + parts.join("") + "</p>";
  };

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.trim();
    if (!stripped) { i++; continue; }

    if (HR.test(stripped)) { out.push("<hr>"); i++; continue; }

    const h = stripped.match(HEADING);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], p);
      if (level <= 2) out.push(`<h2>${content}</h2>`);
      else if (level === 3) out.push(editor ? `<h3>${content}</h3>` : `<p class="feature-title">${content}</p>`);
      else out.push(`<h3>${content}</h3>`);
      i++;
      continue;
    }

    if (stripped.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const plain = buf.filter((b) => b.trim()).map((b) => b.replace(/\\+$/, "").trim());
      if (editor) {
        out.push(`<blockquote>${markdown(buf.join("\n"), p, options)}</blockquote>`);
      } else if (plain.length > 1 && SCRIPTURE_REF.test(plain[plain.length - 1])) {
        const bodyLines = buf[buf.length - 1].trim() ? buf.slice(0, -1) : buf.slice(0, -2);
        out.push(`<blockquote class="verse">${markdown(bodyLines.join("\n"), p)}<cite>${inline(plain[plain.length - 1], p)}</cite></blockquote>`);
      } else {
        out.push(`<div class="callout">${markdown(buf.join("\n"), p)}</div>`);
      }
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length) {
        const ln = lines[i];
        const mm = ln.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (mm) { items.push(mm[2].trim()); i++; continue; }
        if (ln.trim() && items.length && /^[ \t]/.test(ln)) { items[items.length - 1] += " " + ln.trim(); i++; continue; }
        if (!ln.trim()) {
          let k = i;
          while (k < lines.length && !lines[k].trim()) k++;
          if (k < lines.length && LIST_ITEM.test(lines[k]) && /^\s*\d+[.)]\s+/.test(lines[k]) === ordered) { i = k; continue; }
        }
        break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>` + items.map((it) => `<li>${inline(it, p)}</li>`).join("") + `</${tag}>`);
      continue;
    }

    const buf = [];
    while (i < lines.length) {
      const ln = lines[i];
      const s = ln.trim();
      if (!s || /^(#{1,6})\s/.test(s) || s.startsWith(">") || HR.test(s) || LIST_ITEM.test(ln)) break;
      buf.push(ln);
      i++;
    }
    out.push(para(buf));
  }
  return out.join("\n");
}
