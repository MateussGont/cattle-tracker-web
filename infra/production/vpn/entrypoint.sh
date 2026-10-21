#!/bin/sh
set -eu
test -s /configuration/wg0.conf
# Regras somente no namespace deste container, nunca no firewall do host.
# Aplica a política antes de subir a interface ou o listener do banco.
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT
iptables -F INPUT
iptables -F FORWARD
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT ! -i wg0 -p udp --dport 51820 -j ACCEPT
iptables -A INPUT -i wg0 -d 10.203.77.1 -p tcp --dport 5432 -j ACCEPT
ip link add wg0 type wireguard
wg setconf wg0 /configuration/wg0.conf
ip address add 10.203.77.1/24 dev wg0
ip link set dev wg0 mtu 1380 up
# Sem NAT, roteamento para outras redes, DNS ou porta TCP publicada no Docker.
# O servidor PostgreSQL continua exigindo autenticação SCRAM individual.
exec socat TCP4-LISTEN:5432,bind=10.203.77.1,reuseaddr,fork,max-children=20 TCP4:postgres:5432,connect-timeout=5
