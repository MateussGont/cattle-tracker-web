#!/bin/bash
# Executar como root após o banco estar ativo. Nunca imprime credenciais.
set -euo pipefail
set +x
umask 077
state=/opt/cattle-tracker/shared
test "$(id -u)" = 0
test "$(readlink -f "$state")" = "$state"
test "$(stat -c '%a:%u:%g' "$state/.env")" = 600:0:0
exec 9>"$state/.backup-setup.lock"
flock -x 9
if ! grep -q '^POSTGRES_BACKUP_PASSWORD=' "$state/.env"; then
  printf '\nPOSTGRES_BACKUP_PASSWORD=%s\n' "$(openssl rand -hex 32)" >> "$state/.env"
fi
backup_password=$(awk -F= '$1=="POSTGRES_BACKUP_PASSWORD" {print $2}' "$state/.env")
[[ "$backup_password" =~ ^[a-f0-9]{64}$ ]]
# pg_read_all_data inclui os schemas PostGIS auxiliares; não torna a conta
# superusuária, não concede escrita e não ignora RLS. Cluster dedicado ao projeto.
docker exec -i cattle-tracker-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d cattle_tracker <<SQL
\set backup_password '$backup_password'
SELECT format('CREATE ROLE cattle_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'backup_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='cattle_backup') \gexec
GRANT pg_read_all_data TO cattle_backup;
\unset backup_password
SQL
unset backup_password
echo 'Conta de backup preparada; credenciais existentes preservadas.'
