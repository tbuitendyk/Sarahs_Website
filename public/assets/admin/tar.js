// Makes a .tar.gz file in the browser (for "Download a backup now" in the admin).
// Same layout as the NAS backup script's packages, so either can be restored the same way.

const enc = new TextEncoder();

function field(h, text, offset, length) {
  h.set(enc.encode(text).slice(0, length), offset);
}

function octal(n, length) {
  return n.toString(8).padStart(length - 1, "0") + "\0";
}

function header(path, size, mtime) {
  const h = new Uint8Array(512);
  let name = path;
  let prefix = "";
  if (enc.encode(name).length > 100) {           // long names: split into prefix/name (ustar)
    const cut = path.lastIndexOf("/");
    prefix = path.slice(0, cut);
    name = path.slice(cut + 1);
  }
  field(h, name, 0, 100);
  field(h, "0000644\0", 100, 8);                 // file mode
  field(h, "0000000\0", 108, 8);                 // owner
  field(h, "0000000\0", 116, 8);                 // group
  field(h, octal(size, 12), 124, 12);
  field(h, octal(mtime, 12), 136, 12);
  field(h, "        ", 148, 8);                  // checksum is worked out with spaces here
  field(h, "0", 156, 1);                         // ordinary file
  field(h, "ustar\0", 257, 6);
  field(h, "00", 263, 2);
  field(h, prefix, 345, 155);
  let sum = 0;
  for (const b of h) sum += b;
  field(h, sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}

// entries: [{ path: "files/x.jpg", data: Uint8Array }]  ->  Blob (.tar.gz)
export async function tarGz(entries) {
  const mtime = Math.floor(Date.now() / 1000);
  const parts = [];
  for (const e of entries) {
    parts.push(header(e.path, e.data.length, mtime), e.data);
    const pad = (512 - (e.data.length % 512)) % 512;
    if (pad) parts.push(new Uint8Array(pad));
  }
  parts.push(new Uint8Array(1024));              // end of archive
  const gz = new Blob(parts).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(gz).blob();
}
