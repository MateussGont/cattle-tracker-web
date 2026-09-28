#!/bin/sh
set -eu
release=$(readlink -f /opt/cattle-tracker/current)
case "$release" in /opt/cattle-tracker/releases/*) ;; *) echo 'Release inválida.' >&2; exit 1;; esac
cd "$release"
RELEASE_TAG=$(basename "$release")
export RELEASE_TAG
exec docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/public.yml "$@"
