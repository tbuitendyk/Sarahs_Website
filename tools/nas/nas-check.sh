#!/bin/sh
# Looks at the NAS and prints what's needed to set up the website backups.
# It only reads: nothing is installed or changed (one tiny test file is made in /tmp and deleted).
# Run it with:  sh nas-check.sh      then copy everything it prints back to Claude.

say() { printf '%s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
show() { [ -r "$1" ] && { say "--- $1"; grep -v '^[[:space:]]*$' "$1" 2>/dev/null | head -n 20; }; }

say "=== NAS check for Sarah's Books backups ==="
say "Date: $(date 2>/dev/null)   UTC: $(date -u 2>/dev/null)"

say ""
say "=== System ==="
uname -a 2>/dev/null
say "Architecture: $(uname -m 2>/dev/null)"
show /etc/os-release
show /etc.defaults/VERSION          # Synology DSM
show /etc/VERSION
show /etc/version                   # TrueNAS SCALE, WD
show /etc/unraid-version            # Unraid
[ -r /proc/sys/kernel/syno_hw_version ] && say "Synology model: $(cat /proc/sys/kernel/syno_hw_version)"
if have getcfg; then                # QNAP QTS / QuTS
  say "QNAP model: $(getcfg System Model -f /etc/config/uLinux.conf 2>/dev/null)"
  say "QNAP version: $(getcfg System Version -f /etc/config/uLinux.conf 2>/dev/null) build $(getcfg System 'Build Number' -f /etc/config/uLinux.conf 2>/dev/null)"
fi
have freebsd-version && say "FreeBSD (TrueNAS CORE?): $(freebsd-version 2>/dev/null)"
have dpkg-query && dpkg-query -W -f='OpenMediaVault: ${Version}\n' openmediavault 2>/dev/null
[ -r /etc/nas.conf ] && grep -i -m 3 'version\|model' /etc/nas.conf 2>/dev/null   # Asustor

say ""
say "=== Who and which shell ==="
id 2>/dev/null
say "This shell: $(readlink /proc/$$/exe 2>/dev/null || echo "${SHELL:-unknown}")"
ls -l /bin/sh 2>/dev/null
have busybox && say "BusyBox: $(busybox 2>&1 | head -n 1)"

say ""
say "=== Tools the backup script uses ==="
for t in sh curl wget tar gzip mktemp sort tail find stty sha256sum crontab python3 openssl; do
  p=$(command -v "$t" 2>/dev/null)
  printf '%-10s %s\n' "$t" "${p:-MISSING}"
done
have curl && curl --version 2>/dev/null | head -n 2
have tar && say "tar: $(tar --version 2>&1 | head -n 1)"

T=$(mktemp -d 2>/dev/null || echo "/tmp/sb-check-$$")
mkdir -p "$T" 2>/dev/null
if [ -d "$T" ]; then
  printf 'test\n' > "$T/a.txt"
  if (cd "$T" && tar -czf b.tar.gz a.txt && tar -tzf b.tar.gz | grep -q a.txt); then say "tar with gzip: works"; else say "tar with gzip: FAILED"; fi
  rm -rf "$T"
fi
TAB=$(printf '\t')
printf 'one\ttwo\n' | { IFS=$TAB read -r a b; [ "$b" = two ] && say "reading tab-separated lines: works" || say "reading tab-separated lines: FAILED"; }

say ""
say "=== Internet (HTTPS to Cloudflare) ==="
if have curl; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://www.cloudflare.com/ 2>&1)
  say "curl https://www.cloudflare.com -> $code   (200 or 301/302 means OK)"
else
  say "curl is missing"
fi

say ""
say "=== Scheduling and notices ==="
for f in /usr/syno/bin/synoschedtask /usr/syno/bin/synodsmnotify /etc/crontab /etc/config/crontab /var/spool/cron/crontabs; do
  [ -e "$f" ] && say "found: $f"
done
for t in sendmail ssmtp msmtp mail; do have "$t" && say "mail tool: $(command -v "$t")"; done

say ""
say "=== Storage ==="
df -h 2>/dev/null | grep -v -E '^(tmpfs|devtmpfs|none|overlay|shm|udev)' | head -n 25

say ""
say "=== Done. Copy everything above back to Claude. ==="
