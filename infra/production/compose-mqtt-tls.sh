#!/bin/sh
set -eu
release=$(readlink -f /opt/cattle-tracker/mqtt-tls)
case "$release" in /opt/cattle-tracker/releases/*) ;; *) echo 'Release MQTT inválida.' >&2; exit 1;; esac
cd "$release"
# API/site continuam na release pública existente; não renomear imagens sem build.
RELEASE_TAG=$(cat /opt/cattle-tracker/shared/deployed-release)
export RELEASE_TAG
exec docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/public.yml -f infra/production/mqtt-tls.yml "$@"
