#!/bin/sh
set -eu
release=$(readlink -f /opt/cattle-tracker/vpn)
case "$release" in /opt/cattle-tracker/releases/*) ;; *) echo 'Release VPN inválida.' >&2; exit 1;; esac
VPN_RELEASE=$(basename "$release")
export VPN_RELEASE
exec docker compose -f "$release/infra/production/vpn/compose.yml" "$@"
