FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
RUN apk add --no-cache wireguard-tools iproute2 iptables socat python3 postgresql16-client
COPY entrypoint.sh health.sh init.py /app/
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
