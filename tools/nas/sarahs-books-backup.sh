#!/bin/sh
# Sarah's Books: download a complete backup of the website to this NAS.
#
# One-time setup (details in BACKUP.md):
#   1. Put this script and sarahs-books-backup.conf in a folder on the NAS.
#   2. In the website's admin: Backups -> "Create a backup key". Paste it into the .conf file.
#   3. Schedule it (e.g. every night):   sh /path/to/sarahs-books-backup.sh
#
# Each run saves ONE file:  <BACKUP_DIR>/sarahs-books-YYYY-MM-DD_HHMMSS.tar.gz
# and keeps the newest KEEP of them. Exit code 0 means the backup worked.
# Needs only: sh, curl, tar, gzip (standard on QNAP, Synology, TrueNAS, Unraid, Linux).
#
# Test the "backup failed" notice without running a backup:  sh sarahs-books-backup.sh --test-alert

set -eu
# Scheduled jobs often can't see /sbin (where QNAP keeps curl and log_tool).
PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
export PATH

TEST_ALERT=""
[ "${1:-}" = "--test-alert" ] && { TEST_ALERT=1; shift; }
HERE=$(cd "$(dirname "$0")" && pwd)
CONF="${1:-$HERE/sarahs-books-backup.conf}"
log()  { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# When a backup fails: a warning in the NAS's own system log (QNAP: System Logs, which
# Notification Center can e-mail), and an e-mail to ALERT_EMAIL if that is set.
alert() {
  msg="Sarah's Books website backup FAILED: $*"
  if command -v log_tool >/dev/null 2>&1; then
    log_tool -t 2 -a "$msg" >/dev/null 2>&1 || true
  elif command -v logger >/dev/null 2>&1; then
    logger -t sarahs-books-backup "$msg" >/dev/null 2>&1 || true
  fi
  if [ -n "${ALERT_EMAIL:-}" ] && command -v sendmail >/dev/null 2>&1; then
    printf 'To: %s\nSubject: %s\n\n%s\n\nSee %s\n' "$ALERT_EMAIL" "Website backup failed" "$msg" "${LOG_FILE:-the NAS}" \
      | sendmail -t >/dev/null 2>&1 || true
  fi
}
fail() { log "BACKUP FAILED: $*" >&2; alert "$*"; exit 1; }

[ -r "$CONF" ] || fail "settings file not found: $CONF"
# shellcheck disable=SC1090
. "$CONF"

# Optional log file (kept to the last 1,000 lines).
if [ -n "${LOG_FILE:-}" ]; then
  if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE" | tr -d ' ')" -gt 2000 ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
  exec >> "$LOG_FILE" 2>&1
fi

if [ -n "$TEST_ALERT" ]; then
  alert "this is only a test of the failure notice (nothing is wrong)"
  log "Test notice sent"
  exit 0
fi
[ -n "${SITE:-}" ]       || fail "SITE is not set in $CONF"
case "${BACKUP_KEY:-}" in ""|*PASTE*) fail "BACKUP_KEY is not filled in, in $CONF" ;; esac
[ -n "${BACKUP_DIR:-}" ] || fail "BACKUP_DIR is not set in $CONF"
KEEP="${KEEP:-60}"
SITE="${SITE%/}"

command -v curl >/dev/null 2>&1 || fail "curl is not installed"
command -v tar  >/dev/null 2>&1 || fail "tar is not installed"
mkdir -p "$BACKUP_DIR"

# Only one run at a time. A lock left behind by a run that was cut off (power cut, restart) is cleared.
LOCK="$BACKUP_DIR/.backup-running"
if ! mkdir "$LOCK" 2>/dev/null; then
  old=$(cat "$LOCK/pid" 2>/dev/null || true)
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then fail "another backup is still running (process $old)"; fi
  log "Clearing a lock left by an earlier backup that didn't finish"
  rm -rf "$LOCK"
  mkdir "$LOCK" || fail "could not create $LOCK"
fi
echo $$ > "$LOCK/pid"
# Work inside the backup folder: a NAS's /tmp is often very small.
rm -rf "$BACKUP_DIR"/.work.* 2>/dev/null || true
WORK=$(mktemp -d "$BACKUP_DIR/.work.XXXXXX") || fail "could not create a work folder in $BACKUP_DIR"
cleanup() { rm -rf "$WORK" "$LOCK"; }
trap cleanup EXIT
trap 'exit 1' INT TERM HUP

get() {  # get <address on the site> <file to save to>
  curl -fsS --retry 3 --retry-delay 5 --connect-timeout 20 --max-time 900 \
       -H "Authorization: Bearer $BACKUP_KEY" "$SITE$1" -o "$2"
}

log "Starting backup of $SITE"
get /api/backup/list "$WORK/list.txt" || fail "could not get the list from $SITE (check SITE and BACKUP_KEY)"
head -n 1 "$WORK/list.txt" | grep -q '^# sarahs-books backup list 1' || fail "unexpected answer from $SITE"

items=0
bytes=0
TAB=$(printf '\t')
mkdir -p "$WORK/pkg"
while IFS="$TAB" read -r kind size path url; do
  case "$kind" in ''|'#'*) continue ;; esac
  case "$path" in /*|*..*) fail "unsafe name in the list: $path" ;; esac
  mkdir -p "$WORK/pkg/$(dirname "$path")"
  get "$url" "$WORK/pkg/$path" || fail "could not download $path"
  got=$(wc -c < "$WORK/pkg/$path" | tr -d ' ')
  if [ "$size" != "-" ] && [ "$got" != "$size" ]; then fail "$path is $got bytes, expected $size"; fi
  items=$((items + 1))
  bytes=$((bytes + got))
done < "$WORK/list.txt"

[ -s "$WORK/pkg/content.json" ] || fail "the backup has no content.json"

STAMP=$(date '+%Y-%m-%d_%H%M%S')
OUT="$BACKUP_DIR/sarahs-books-$STAMP.tar.gz"
(cd "$WORK/pkg" && tar -czf "$WORK/package.tar.gz" .) || fail "could not create the package"
tar -tzf "$WORK/package.tar.gz" >/dev/null 2>&1 || fail "the package could not be read back"
mv "$WORK/package.tar.gz" "$OUT"         # same folder, so the finished file appears in one step
chmod 600 "$OUT" 2>/dev/null || true
log "Saved $OUT ($items items, $bytes bytes)"

# Let the website know it worked (shown in the admin under Backups).
get "/api/backup/done?items=$items&bytes=$bytes" "$WORK/done.json" || log "Note: could not tell the website the backup finished"

# Keep only the newest $KEEP backups (names sort by date).
ls -1 "$BACKUP_DIR"/sarahs-books-*.tar.gz 2>/dev/null | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old" && log "Removed old backup $(basename "$old")"
done
log "Done"
