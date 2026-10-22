#!/bin/bash
set -euo pipefail
set +x
umask 077
state=/opt/cattle-tracker/shared
test "$(id -u)" = 0
test "$(readlink -f "$state")" = "$state"
test -f "$state/mosquitto/passwd"
test ! -L "$state/mosquitto/passwd"
test ! -L "$state/mosquitto/gateway-passwd"
# Preserva a senha existente, sem imprimir nem levar credencial à linha de comando.
stage=$(mktemp "$state/mosquitto/.gateway-passwd.XXXXXXXX")
awk -F: '$1=="gateway" {print; n++} END {if(n!=1) exit 1}' "$state/mosquitto/passwd" > "$stage"
chown 1883:1883 "$stage"
chmod 0600 "$stage"
mv "$stage" "$state/mosquitto/gateway-passwd"
echo 'Arquivo de autenticação externa preparado somente com o usuário gateway.'
