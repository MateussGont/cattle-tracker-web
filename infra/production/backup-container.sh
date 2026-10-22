#!/bin/sh
set -eu
umask 077

case "${1:-once}" in
  health)
    test -f /backups/last-success
    test ! -f /backups/last-failure
    age=$(( $(date +%s) - $(cat /backups/last-success) ))
    test "$age" -ge 0 && test "$age" -lt 93600
    exit
    ;;
  loop)
    trap 'exit 0' TERM INT
    while :; do
      if /bin/sh "$0" once; then
        delay=86400
      else
        date +%s > /backups/last-failure
        echo 'Backup falhou; nova tentativa em uma hora.' >&2
        delay=3600
      fi
      sleep "$delay" &
      wait $! || true
    done
    ;;
  once) ;;
  *) echo 'Uso: backup-container.sh [once|loop|health]' >&2; exit 2 ;;
esac

# Lock liberado pelo kernel, inclusive após interrupção do container.
exec 9>/backups/.lock
flock -n 9 || { echo 'Outro backup está em execução.' >&2; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target=/backups/$stamp
mkdir -m 0700 "$target"
trap 'date +%s > /backups/last-failure' EXIT
pg_dump -Fc --file="$target/database.dump.partial"
pg_restore --list "$target/database.dump.partial" > /dev/null
mv "$target/database.dump.partial" "$target/database.dump"
tar -czf "$target/config.tar.gz.partial" -C /configuration .
mv "$target/config.tar.gz.partial" "$target/config.tar.gz"
cd "$target"
sha256sum database.dump config.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS > /dev/null
touch COMPLETE
date +%s > /backups/last-success.partial
mv /backups/last-success.partial /backups/last-success
# Apenas o marcador de falha deste serviço; nunca remove backups.
rm -f /backups/last-failure
trap - EXIT
echo "Backup local concluído: $stamp"
