#!/bin/sh
# Sarah's Books: put the website backup on the QNAP's schedule.
#
# QNAP can forget scheduled jobs after a restart or firmware update, so call this from the
# NAS start-up script (it's safe to run any number of times; it adds the job only once):
#
#   sh /share/CACHEDEV3_DATA/scb-site-backup/qnap-install.sh >> /share/CACHEDEV3_DATA/scb-site-backup/install.log 2>&1 || true
#
# The time comes from SCHEDULE in sarahs-books-backup.conf (default: every night at 3:17).
# To take the job off the schedule:   sh qnap-install.sh remove

set -eu
PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
export PATH

HERE=$(cd "$(dirname "$0")" && pwd)
CONF="$HERE/sarahs-books-backup.conf"
SCRIPT="$HERE/sarahs-books-backup.sh"
CRONTAB=/etc/config/crontab                 # QNAP's lasting copy of the schedule
MARK="# sarahs-books-backup"
say()  { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { say "INSTALL FAILED: $*" >&2; exit 1; }

[ -f "$CRONTAB" ] || fail "$CRONTAB not found (is this a QNAP?)"
[ -r "$SCRIPT" ] || fail "can't find $SCRIPT"

SCHEDULE="17 3 * * *"
if [ -r "$CONF" ]; then
  # shellcheck disable=SC1090
  . "$CONF"
else
  [ "${1:-}" = "remove" ] || fail "can't find $CONF (copy sarahs-books-backup.conf.example and fill it in)"
fi
case "${BACKUP_KEY:-}" in ""|*PASTE*) [ "${1:-}" = "remove" ] || say "Note: BACKUP_KEY in $CONF isn't filled in yet, so backups will fail until it is." ;; esac

LINE="$SCHEDULE /bin/sh $SCRIPT >/dev/null 2>&1 $MARK"
TMP="$CRONTAB.sarahs-books.tmp"
grep -vF "$MARK" "$CRONTAB" > "$TMP" || true
if [ "${1:-}" = "remove" ]; then
  say "Taking the website backup off the schedule"
else
  printf '%s\n' "$LINE" >> "$TMP"
fi

if cmp -s "$TMP" "$CRONTAB"; then
  rm -f "$TMP"
  if [ "${1:-}" = "remove" ]; then say "It wasn't on the schedule"; else say "Schedule already up to date: $SCHEDULE"; fi
else
  [ -f "$HERE/crontab.before-install" ] || cp "$CRONTAB" "$HERE/crontab.before-install"   # the original, kept once
  cat "$TMP" > "$CRONTAB"                   # same file, same permissions
  rm -f "$TMP"
  if [ "${1:-}" = "remove" ]; then say "Removed from the schedule"; else say "Schedule saved: $SCHEDULE"; fi
fi

# Load the schedule into the running scheduler.
crontab "$CRONTAB"
if [ -x /etc/init.d/crond.sh ]; then /etc/init.d/crond.sh restart >/dev/null 2>&1 || say "Note: couldn't restart crond"; fi
say "Done"
