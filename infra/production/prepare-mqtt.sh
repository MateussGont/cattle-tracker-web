#!/bin/bash
# Executar na VPS como root; nunca imprime credenciais.
set -euo pipefail
set +x
umask 077
state_dir=/opt/cattle-tracker/shared
image=eclipse-mosquitto:2.1.2-alpine@sha256:38c0da4f2ef84284d47b3b3eeea1cb3bdeabe81ee10caf0cd5c5ff61ee3ea408
test "$(id -u)" = 0
test "$(readlink -f "$state_dir")" = "$state_dir"
test "$(stat -c '%a:%u:%g' "$state_dir/.env")" = 600:0:0
exec 9>"$state_dir/.mqtt-setup.lock"
flock -x 9
if test -e "$state_dir/mosquitto/passwd" || test -e "$state_dir/gateway-access.json"; then
  echo 'Credenciais MQTT existentes: nenhuma substituição foi feita. Revise antes de continuar.' >&2
  exit 1
fi
backend_password=$(awk -F= '$1=="MQTT_BACKEND_PASSWORD" {print $2}' "$state_dir/.env")
gateway_api_key=$(awk -F= '$1=="GATEWAY_API_KEY" {print $2}' "$state_dir/.env")
domain=$(awk -F= '$1=="APP_DOMAIN" {print $2}' "$state_dir/.env")
[[ "$backend_password" =~ ^[a-f0-9]{64}$ ]]
[[ "$gateway_api_key" =~ ^[a-f0-9]{64}$ ]]
[[ "$domain" =~ ^[a-z0-9]+([.-][a-z0-9]+)+$ ]]
gateway_password=$(openssl rand -hex 32)
stage=$(mktemp -d "$state_dir/mqtt-setup.XXXXXXXX")
# O diretório temporário privado é preservado se houver falha para diagnóstico/recuperação.
printf 'backend:%s\ngateway:%s\n' "$backend_password" "$gateway_password" > "$stage/passwd"
docker run --rm --user 0 --entrypoint mosquitto_passwd -v "$stage:/work" "$image" -U /work/passwd
awk -F: 'NF!=2 || $2 !~ /^\$/ {bad=1} END {if(NR!=2 || bad) exit 1}' "$stage/passwd"
printf '{\n  "mqttHost": "127.0.0.1 (via tunel SSH)",\n  "mqttPort": 1883,\n  "mqttUsername": "gateway",\n  "mqttPassword": "%s",\n  "mqttTopic": "cattle-tracker/telemetry",\n  "httpEndpoint": "https://%s/api/telemetry",\n  "gatewayApiKey": "%s"\n}\n' "$gateway_password" "$domain" "$gateway_api_key" > "$stage/gateway-access.json"
install -d -m 0750 "$state_dir/mosquitto"
chown 0:1883 "$stage/passwd"
chmod 0640 "$stage/passwd"
mv "$stage/passwd" "$state_dir/mosquitto/passwd"
mv "$stage/gateway-access.json" "$state_dir/gateway-access.json"
rmdir "$stage"
unset backend_password gateway_password gateway_api_key
echo 'Credenciais MQTT preparadas. Senha do backend preservada; arquivo do broker contém hashes.'
