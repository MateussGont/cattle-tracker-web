#!/bin/sh
set -eu
test "$(wg show wg0 listen-port)" = 51820
test "$(cat /proc/sys/net/ipv4/ip_forward)" = 0
iptables -C INPUT -i wg0 -d 10.203.77.1 -p tcp --dport 5432 -j ACCEPT
iptables -S INPUT | grep -x -- '-P INPUT DROP' >/dev/null
iptables -S FORWARD | grep -x -- '-P FORWARD DROP' >/dev/null
nc -z -w 2 10.203.77.1 5432
nc -z -w 2 postgres 5432
