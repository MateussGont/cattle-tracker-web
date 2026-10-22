"""Cliente de integração descartável; executar apenas antes da entrega dos perfis.

Monta /clients somente leitura, configura WireGuard num namespace isolado e
não imprime credenciais, resultado de tabelas ou detalhes de endpoints.
Requer NET_ADMIN, /tmp gravável, python3, psql e ferramentas WireGuard.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time


def run(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, timeout=25, **kwargs)


def require(condition, label):
    if not condition:
        raise SystemExit(f"FAIL: {label}")
    print(f"PASS: {label}", flush=True)


def main():
    person = sys.argv[1] if len(sys.argv) > 1 else "mateus"
    require(person in ("mateus", "colaborador"), "known test identity")
    os.umask(0o077)
    profile = Path(f"/clients/cattle-{person}.conf").read_text()
    Path("/tmp/wg-test.conf").write_text(profile)
    data = json.loads(Path(f"/clients/database-{person}.json").read_text())
    require(run(["wg-quick", "up", "/tmp/wg-test.conf"]).returncode == 0, "client tunnel configured")
    env = {**os.environ, "PGHOST": data["host"], "PGPORT": str(data["port"]),
           "PGDATABASE": data["database"], "PGUSER": data["username"],
           "PGPASSWORD": data["password"], "PGCONNECT_TIMEOUT": "5", "PGSSLMODE": "disable"}

    def sql(query, password=None):
        connection_env = dict(env)
        if password is not None:
            connection_env["PGPASSWORD"] = password
        return run(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query], env=connection_env)

    try:
        for _ in range(5):
            result = sql("SELECT current_user;")
            if result.returncode == 0:
                break
            time.sleep(1)
        require(result.returncode == 0 and result.stdout.strip() == data["username"], "SCRAM login over WireGuard")
        handshake = run(["wg", "show", "wg-test", "latest-handshakes"])
        require(handshake.returncode == 0 and int(handshake.stdout.split()[-1]) > 0, "encrypted handshake completed")
        if len(sys.argv) > 2 and sys.argv[2] == "listen":
            require(person == "colaborador", "isolation test listener identity")
            # Listener real no segundo peer; outro peer não deve alcançá-lo.
            with socket.socket() as listener:
                listener.bind(("10.203.77.3", 5432))
                listener.listen(2)
                listener.settimeout(1)
                Path("/tmp/listener-ready").touch()
                deadline = time.monotonic() + 120
                while time.monotonic() < deadline:
                    try:
                        connection, _ = listener.accept()
                        connection.close()
                    except TimeoutError:
                        pass
            return
        for table in ("devices", "gateways", "locations"):
            require(sql(f"SELECT count(*) FROM public.{table};").returncode == 0, f"SELECT {table}")
        bad = sql("SELECT 1;", password="intentionally-invalid-test-password")
        require(bad.returncode != 0 and "password authentication failed" in bad.stderr, "wrong password rejected")
        require("permission denied" in sql("SELECT password_hash FROM public.users LIMIT 0;").stderr, "users table denied")
        for query, label in (
            ("DELETE FROM public.devices WHERE false", "DELETE denied even in explicit READ WRITE transaction"),
            ("UPDATE public.gateways SET name=name WHERE false", "UPDATE denied"),
            ("CREATE TABLE public.ct_vpn_forbidden_test (id integer)", "DDL denied"),
        ):
            result = sql(f"BEGIN READ WRITE; {query}; ROLLBACK;")
            require(result.returncode != 0 and "permission denied" in result.stderr, label)
        # Provar que a ACL, e não apenas AllowedIPs do cliente, bloqueia outros destinos.
        peer = run(["wg", "show", "wg-test", "peers"]).stdout.strip()
        require(run(["wg", "set", "wg-test", "peer", peer, "allowed-ips", "10.203.77.0/24,172.16.1.0/24"]).returncode == 0, "adversarial client route configured")
        for subnet in ("10.203.77.0/24", "172.16.1.0/24"):
            require(run(["ip", "route", "replace", subnet, "dev", "wg-test"]).returncode == 0, "adversarial route installed")
        blocked = [("10.203.77.1", 22), ("10.203.77.1", 80), ("172.16.1.1", 22)]
        if os.environ.get("CHECK_PEER") == "1":
            blocked.append(("10.203.77.3", 5432))
        for host, port in blocked:
            try:
                with socket.create_connection((host, port), timeout=2):
                    allowed = True
            except OSError:
                allowed = False
            require(not allowed, f"non-database destination blocked: {host}:{port}")
    finally:
        run(["wg-quick", "down", "/tmp/wg-test.conf"])


if __name__ == "__main__":
    main()
