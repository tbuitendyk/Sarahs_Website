// A simple word-processor style text box for the admin.
// Shows formatted text; saves it as Markdown (see markdown.js), which the website turns back into HTML.

import { markdown, esc } from "./markdown.js";

// ---------------------------------------------------------------- HTML -> Markdown

const BLOCK = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "HR", "PRE",
  "SECTION", "ARTICLE", "HEADER", "FOOTER", "TABLE", "FIGURE", "ASIDE", "NAV", "MAIN", "DL"]);

function escapeText(s) {
  return s.replace(/ /g, " ").replace(/([\\`*_\[\]~])/g, "\\$1");
}

// Stop a line that starts with "#", ">", "-", "+" or "1." from turning into a heading, quote or list.
function protectLineStarts(s) {
  return s.split("\n").map((ln) => ln.replace(/^(\s*)(#{1,6}\s|>|[-+]\s|\d+[.)]\s|-{3,}\s*$)/, "$1\\$2")).join("\n");
}

function wrap(inner, mark) {
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
}

function inlineMd(node) {
  if (node.nodeType === 3) return escapeText(node.nodeValue);
  if (node.nodeType !== 1) return "";
  const tag = node.tagName;
  const kids = () => Array.from(node.childNodes).map(inlineMd).join("");
  switch (tag) {
    case "BR": return "\\\n";
    case "STRONG": case "B": return wrap(kids(), "**");
    case "EM": case "I": case "CITE": return wrap(kids(), "*");
    case "U": { const k = kids(); return k.trim() ? `<u>${k}</u>` : k; }
    case "S": case "STRIKE": case "DEL": return wrap(kids(), "~~");
    case "CODE": return "`" + node.textContent.replace(/`/g, "") + "`";
    case "A": {
      const href = (node.getAttribute("href") || "").trim();
      const label = kids();
      return href && label.trim() && !/^javascript:/i.test(href) ? `[${label}](${href.replace(/\s/g, "%20").replace(/\)/g, "%29")})` : label;
    }
    case "IMG": {
      const src = node.getAttribute("src") || "";
      return src && !/^(blob|data):/i.test(src) ? `![${(node.getAttribute("alt") || "").replace(/[\[\]]/g, "")}](${src})` : "";
    }
    case "SCRIPT": case "STYLE": case "TEMPLATE": return "";
    case "SPAN": case "FONT": {
      // Text pasted from Google Docs / Word marks bold and italic with styles.
      let k = kids();
      const st = node.getAttribute("style") || "";
      if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(st)) k = wrap(k, "**");
      if (/font-style\s*:\s*italic/i.test(st)) k = wrap(k, "*");
      return k;
    }
    default: return kids();
  }
}

function inlineOf(node) {
  return protectLineStarts(Array.from(node.childNodes).map(inlineMd).join("").replace(/[ \t]+/g, " ").replace(/ ?\\\n ?/g, "\\\n").trim())
    .replace(/(\\\n)+$/, "");
}

const hasBlockChild = (node) => Array.from(node.childNodes).some((c) => c.nodeType === 1 && BLOCK.has(c.tagName));

function blocksOf(root) {
  const out = [];
  let loose = [];
  const flush = () => {
    if (!loose.length) return;
    const holder = root.ownerDocument.createElement("p");
    loose.forEach((n) => holder.appendChild(n.cloneNode(true)));
    const t = inlineOf(holder);
    if (t) out.push(t);
    loose = [];
  };
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === 1 && BLOCK.has(node.tagName)) {
      flush();
      const b = blockMd(node);
      if (b) out.push(b);
    } else if (node.nodeType === 1 && node.tagName === "BR" && !loose.length) {
      continue;
    } else {
      loose.push(node);
    }
  }
  flush();
  return out;
}

function blockMd(node) {
  const tag = node.tagName;
  if (tag === "HR") return "---";
  if (tag === "H1" || tag === "H2") { const t = inlineOf(node).replace(/\\\n/g, " "); return t ? `## ${t}` : ""; }
  if (tag === "H3" || node.classList?.contains("feature-title")) { const t = inlineOf(node).replace(/\\\n/g, " "); return t ? `### ${t}` : ""; }
  if (/^H[4-6]$/.test(tag)) { const t = inlineOf(node).replace(/\\\n/g, " "); return t ? `#### ${t}` : ""; }
  if (tag === "UL" || tag === "OL") {
    const items = [];
    let n = 1;
    for (const li of Array.from(node.children)) {
      if (li.tagName === "UL" || li.tagName === "OL") { items.push(...blockMd(li).split("\n")); continue; }
      const nested = Array.from(li.children).filter((c) => c.tagName === "UL" || c.tagName === "OL");
      const clone = li.cloneNode(true);
      clone.querySelectorAll("ul,ol").forEach((x) => x.remove());
      const t = (hasBlockChild(clone) ? blocksOf(clone).join(" ") : inlineOf(clone)).replace(/\\\n/g, " ");
      if (t) items.push(`${tag === "OL" ? `${n++}.` : "-"} ${t}`);
      nested.forEach((x) => items.push(...blockMd(x).split("\n").filter(Boolean)));
    }
    return items.join("\n");
  }
  if (tag === "BLOCKQUOTE" || node.classList?.contains("callout")) {
    const clone = node.cloneNode(true);
    const cites = Array.from(clone.querySelectorAll("cite")).map((c) => { const t = inlineOf(c); c.remove(); return t; });
    const inner = (hasBlockChild(clone) ? blocksOf(clone) : [inlineOf(clone)]).filter(Boolean);
    const lines = inner.join("\n\n").split("\n");
    if (cites.length) lines[lines.length - 1] += "\\", lines.push(...cites);
    return lines.length && lines.some((l) => l.trim()) ? lines.map((l) => (l ? `> ${l}` : ">")).join("\n") : "";
  }
  if (tag === "LI") return `- ${inlineOf(node)}`;
  if (hasBlockChild(node)) return blocksOf(node).join("\n\n");
  return inlineOf(node);
}

export function htmlToMarkdown(root) {
  return blocksOf(root).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------- the editor

const BUTTONS = [
  { cmd: "bold", label: "B", title: "Bold", cls: "tb-bold" },
  { cmd: "italic", label: "I", title: "Italic", cls: "tb-italic" },
  { cmd: "h2", label: "Heading", title: "Section heading" },
  { cmd: "h3", label: "Big line", title: "A large line of text, like “Hi!”" },
  { cmd: "ul", label: "• List", title: "Bulleted list" },
  { cmd: "ol", label: "1. List", title: "Numbered list" },
  { cmd: "quote", label: "Quote", title: "Boxed note, or a Bible verse if its last line is the reference (e.g. John 1:5)" },
  { cmd: "link", label: "Link", title: "Turn the selected words into a link" },
  { cmd: "hr", label: "Divider", title: "A divider line" },
  { cmd: "clear", label: "Plain", title: "Remove formatting from the selected text" },
];

function currentBlock(area) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.getRangeAt(0).startContainer;
  while (n && n !== area) {
    if (n.nodeType === 1 && /^(P|H1|H2|H3|H4|BLOCKQUOTE|LI|DIV)$/.test(n.tagName) && n.parentNode === area) return n;
    if (n.nodeType === 1 && n.tagName === "BLOCKQUOTE") return n;
    n = n.parentNode;
  }
  return null;
}

// Quote on/off. Works on whole paragraphs (including lines split with Shift+Enter), so a verse
// and its reference stay together. Inside a quote it takes out just the selected paragraph(s).
function placeCaretAtEnd(el) {
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function toggleQuote(area) {
  const doc = area.ownerDocument;
  const sel = window.getSelection();
  if (!sel.rangeCount || !area.contains(sel.getRangeAt(0).startContainer)) return;
  const range = sel.getRangeAt(0);
  const quoteOf = (n) => { while (n && n !== area) { if (n.nodeType === 1 && n.tagName === "BLOCKQUOTE" && n.parentNode === area) return n; n = n.parentNode; } return null; };
  const quote = quoteOf(range.startContainer);

  if (quote) {
    // Take the selected paragraphs out of the quote; whatever is before/after stays quoted.
    const childOf = (n) => { while (n && n.parentNode !== quote) n = n.parentNode; return n; };
    const kids = Array.from(quote.childNodes);
    const first = childOf(range.startContainer) || kids[0];
    const last = (quote.contains(range.endContainer) && childOf(range.endContainer)) || first;
    const i = kids.indexOf(first), j = Math.max(i, kids.indexOf(last));
    const before = kids.slice(0, i), picked = kids.slice(i, j + 1), after = kids.slice(j + 1);
    const asBlock = (n) => {
      if (n.nodeType === 1 && BLOCK.has(n.tagName)) return n;
      const para = doc.createElement("p");
      para.appendChild(n);
      return para;
    };
    const out = picked.map(asBlock);
    const tail = after.length ? doc.createElement("blockquote") : null;
    if (tail) after.forEach((k) => tail.appendChild(k));
    quote.after(...out, ...(tail ? [tail] : []));
    if (!before.length) quote.remove();
    placeCaretAtEnd(out[out.length - 1]);
    return;
  }

  const top = (n) => { while (n && n.parentNode !== area) n = n.parentNode; return n; };
  const startBlock = top(range.startContainer);
  const endBlock = top(range.endContainer) || startBlock;
  const blocks = [];
  for (let n = startBlock; n; n = n.nextSibling) { blocks.push(n); if (n === endBlock) break; }
  const q = doc.createElement("blockquote");
  if (!blocks.length) { q.innerHTML = "<p><br></p>"; area.appendChild(q); }
  else {
    blocks[0].before(q);
    for (const b of blocks) {
      if (b.nodeType === 1 && b.tagName === "BLOCKQUOTE") { Array.from(b.childNodes).forEach((k) => q.appendChild(k)); b.remove(); }
      else if (b.nodeType === 1 && BLOCK.has(b.tagName)) q.appendChild(b);
      else { const para = doc.createElement("p"); para.appendChild(b); q.appendChild(para); }
    }
  }
  placeCaretAtEnd(q);
}

// Enter on an empty line inside a quote steps out of the quote (like other word processors).
function leaveQuoteOnEmptyLine(area, e) {
  if (e.key !== "Enter" || e.shiftKey) return;
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return;
  let n = sel.getRangeAt(0).startContainer;
  while (n && n !== area && !(n.nodeType === 1 && n.tagName === "P")) n = n.parentNode;
  if (!n || n === area) return;
  const quote = n.parentNode;
  if (!quote || quote.tagName !== "BLOCKQUOTE" || quote.parentNode !== area) return;
  if (n.textContent.trim() !== "" || n.querySelector("img")) return;
  e.preventDefault();
  const rest = Array.from(quote.childNodes).slice(Array.from(quote.childNodes).indexOf(n) + 1);
  const tail = rest.length ? area.ownerDocument.createElement("blockquote") : null;
  if (tail) rest.forEach((k) => tail.appendChild(k));
  quote.after(n, ...(tail ? [tail] : []));
  if (!quote.childNodes.length) quote.remove();
  if (!n.childNodes.length) n.appendChild(area.ownerDocument.createElement("br"));
  placeCaretAtEnd(n);
}

export function createRichEditor(value, onChange, { id } = {}) {
  const wrapEl = document.createElement("div");
  wrapEl.className = "rich";
  const bar = document.createElement("div");
  bar.className = "rich-toolbar";
  bar.setAttribute("role", "toolbar");
  const area = document.createElement("div");
  area.className = "rich-area";
  area.contentEditable = "true";
  area.setAttribute("role", "textbox");
  area.setAttribute("aria-multiline", "true");
  if (id) area.id = id;
  area.innerHTML = markdown(value || "", "", { editor: true }) || "<p><br></p>";

  // Link popover
  const pop = document.createElement("div");
  pop.className = "rich-link";
  pop.hidden = true;
  pop.innerHTML = '<label>Link address <input type="url" placeholder="https://… or about.html"></label>' +
    '<button type="button" class="btn btn-small btn-primary" data-act="add">Add link</button>' +
    '<button type="button" class="btn btn-small" data-act="remove">Remove link</button>' +
    '<button type="button" class="btn btn-small" data-act="cancel">Cancel</button>';
  const linkInput = pop.querySelector("input");
  let savedRange = null;

  let timer = null;
  const emit = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(htmlToMarkdown(area)), 250);
  };
  const flushNow = () => { clearTimeout(timer); onChange(htmlToMarkdown(area)); };

  const exec = (cmd, arg = null) => {
    area.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  for (const b of BUTTONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = b.label;
    btn.title = b.title;
    btn.className = "tb " + (b.cls || "");
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep the text selection
    btn.addEventListener("click", () => {
      const blk = currentBlock(area);
      const tag = blk?.tagName;
      switch (b.cmd) {
        case "bold": exec("bold"); break;
        case "italic": exec("italic"); break;
        case "h2": exec("formatBlock", tag === "H2" ? "<p>" : "<h2>"); break;
        case "h3": exec("formatBlock", tag === "H3" ? "<p>" : "<h3>"); break;
        case "ul": exec("insertUnorderedList"); break;
        case "ol": exec("insertOrderedList"); break;
        case "quote": area.focus(); toggleQuote(area); emit(); updateToolbar(); break;
        case "hr": exec("insertHorizontalRule"); break;
        case "clear": exec("removeFormat"); exec("formatBlock", "<p>"); break;
        case "link": {
          const sel = window.getSelection();
          savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
          const a = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest("a");
          linkInput.value = a ? a.getAttribute("href") : "";
          pop.hidden = false;
          linkInput.focus();
          break;
        }
      }
    });
    bar.appendChild(btn);
  }

  const restore = () => {
    area.focus();
    if (savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  };
  pop.addEventListener("click", (e) => {
    const act = e.target.dataset?.act;
    if (!act) return;
    if (act === "add") {
      const url = linkInput.value.trim();
      restore();
      if (url) {
        const sel = window.getSelection();
        if (sel.isCollapsed) document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(url)}</a>`);
        else document.execCommand("createLink", false, url);
      }
      emit();
    } else if (act === "remove") {
      restore();
      document.execCommand("unlink");
      emit();
    }
    pop.hidden = true;
  });
  linkInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); pop.querySelector('[data-act="add"]').click(); }
    if (e.key === "Escape") { pop.hidden = true; restore(); }
  });

  area.addEventListener("keydown", (e) => { leaveQuoteOnEmptyLine(area, e); });

  // Light up the toolbar buttons for what the cursor is in.
  const buttonsByCmd = {};
  bar.querySelectorAll("button").forEach((b, i) => { buttonsByCmd[BUTTONS[i].cmd] = b; });
  const updateToolbar = () => {
    const sel = window.getSelection();
    if (!sel.rangeCount || !area.contains(sel.anchorNode)) return;
    const inTag = (tag) => { let n = sel.anchorNode; while (n && n !== area) { if (n.nodeType === 1 && n.tagName === tag) return true; n = n.parentNode; } return false; };
    const state = {
      bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"),
      h2: inTag("H2"), h3: inTag("H3"), ul: inTag("UL"), ol: inTag("OL"), quote: inTag("BLOCKQUOTE"), link: inTag("A"),
    };
    for (const [cmd, on] of Object.entries(state)) buttonsByCmd[cmd]?.setAttribute("aria-pressed", on ? "true" : "false");
  };
  document.addEventListener("selectionchange", updateToolbar);
  area.addEventListener("input", emit);
  area.addEventListener("blur", flushNow);
  area.addEventListener("focus", () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* old browsers */ } });

  // Pasted text keeps bold, italics, links, headings, lists and quotes, and drops everything else.
  area.addEventListener("paste", (e) => {
    const html = e.clipboardData?.getData("text/html");
    const plain = e.clipboardData?.getData("text/plain") || "";
    e.preventDefault();
    let md;
    if (html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      md = htmlToMarkdown(doc.body);
    } else {
      md = plain.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((p) => protectLineStarts(escapeText(p)).replace(/\n/g, "\\\n")).join("\n\n");
    }
    document.execCommand("insertHTML", false, markdown(md, "", { editor: true }));
    emit();
  });

  wrapEl.append(bar, pop, area);
  wrapEl.flush = flushNow;
  return wrapEl;
}
