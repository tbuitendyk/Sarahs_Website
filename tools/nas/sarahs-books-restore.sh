#!/bin/sh
# Sarah's Books: put a backup back onto the website.
#
#   sh sarahs-books-restore.sh <backup .tar.gz file> <site address>
#   e.g. sh sarahs-books-restore.sh /volume1/backups/sarahs-books/sarahs-books-2026-12-01_0215.tar.gz https://sarah.buitendyk.ca
#
# Asks for the admin password, then puts back every uploaded file and the content.
# The content that was live just before is kept under "Undo & history" in the admin.
# Works on a brand-new site too (set it up with SETUP.md first).

set -eu
PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
export PATH
fail() { echo "RESTORE FAILED: $*" >&2; exit 1; }
[ $# -eq 2 ] || { echo "Usage: sh $0 <backup .tar.gz file> <site address>" >&2; exit 2; }
PKG=$1
SITE=${2%/}
[ -r "$PKG" ] || fail "can't read $PKG"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"

# Unpack next to the backup file (a NAS's /tmp is often very small), or in /tmp if that folder is read-only.
WORK=$(mktemp -d "$(dirname "$PKG")/.restore.XXXXXX" 2>/dev/null || mktemp -d "${TMPDIR:-/tmp}/sarahs-books-restore.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
trap 'exit 1' INT TERM HUP
tar -xzf "$PKG" -C "$WORK" || fail "$PKG isn't a readable backup"
[ -s "$WORK/content.json" ] || fail "no content.json inside: is this a Sarah's Books backup?"

saved=$(sed -n 's/^  "savedAt": "\([^"]*\)".*/\1/p' "$WORK/content.json" | tail -n 1)
nfiles=0
[ -d "$WORK/files" ] && nfiles=$(find "$WORK/files" -type f | wc -l | tr -d ' ')
echo "Backup: content saved ${saved:-(unknown date)}, with $nfiles uploaded file(s)."
printf 'This replaces the content of %s with this backup. Continue? [y/N] ' "$SITE"
read -r answer
case "$answer" in y|Y|yes|YES) ;; *) echo "Nothing changed."; exit 0 ;; esac

printf 'Admin password for %s (it won’t show as you type): ' "$SITE"
if stty -echo 2>/dev/null; then
  read -r PW; stty echo 2>/dev/null || true
else
  read -rs PW 2>/dev/null || read -r PW     # QNAP has no stty; its shell's read -s hides the typing
fi
echo
COOKIE=$(printf '%s' "$PW" | curl -sS -D - -o /dev/null --data-urlencode "password@-" "$SITE/admin/login" \
  | tr -d '\r' | sed -n 's/^[Ss]et-[Cc]ookie: \(__Host-sb_admin=[^;]*\).*/\1/p' | head -n 1)
PW=""
[ -n "$COOKIE" ] || fail "couldn't log in (wrong password, or too many tries: wait 15 minutes)"

put() {  # put <api path> <file> <content type>
  curl -fsS -X PUT -H "Cookie: $COOKIE" -H "X-SB-Admin: 1" -H "Content-Type: $3" \
       --data-binary "@$2" "$SITE/api/admin/$1" -o /dev/null
}

if [ "$nfiles" -gt 0 ]; then
  for f in "$WORK"/files/*; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    put "files/$name" "$f" application/octet-stream || fail "couldn't put back files/$name"
    echo "  put back files/$name"
  done
fi
put content "$WORK/content.json" application/json || fail "couldn't put back the content"
echo "Done: the content and $nfiles uploaded file(s) are back on $SITE."
echo "The content that was there before is under Undo & history in the admin."
