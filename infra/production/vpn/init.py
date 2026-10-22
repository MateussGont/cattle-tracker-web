"""Inicialização única, offline. Nunca imprime chaves, senhas ou SQL gerado.

Executar em container --network none, com /state privado e vazio. Não rotaciona
credenciais existentes. SQL deve ser aplicado pelo operador com psql local.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import subprocess


def b64(value):
    return base64.b64encode(value).decode("ascii")


def scram(password):
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 16384)
    stored = hashlib.sha256(hmac.digest(salted, b"Client Key", "sha256")).digest()
    server = hmac.digest(salted, b"Server Key", "sha256")
    return f"SCRAM-SHA-256$16384:{b64(salt)}${b64(stored)}:{b64(server)}"


def keypair():
    private = subprocess.check_output(["wg", "genkey"], text=True).strip()
    public = subprocess.check_output(["wg", "pubkey"], input=private, text=True).strip()
    return private, public


def main():
    os.umask(0o077)
    state = Path("/state")
    if any(state.iterdir()):
        raise SystemExit("Diretório não vazio: não sobrescrever credenciais; revisar estado manualmente.")
    (state / "server").mkdir(mode=0o700)
    (state / "clients").mkdir(mode=0o700)
    server_private, server_public = keypair()
    config = f"[Interface]\nPrivateKey = {server_private}\nListenPort = 51820\n"
    sql = [
        "BEGIN;",
        "SET LOCAL log_statement = 'none';",
        "SET LOCAL log_min_error_statement = 'panic';",
        "CREATE ROLE ct_vpn_readonly NOLOGIN;",
        "GRANT CONNECT ON DATABASE cattle_tracker TO ct_vpn_readonly;",
        "GRANT USAGE ON SCHEMA public TO ct_vpn_readonly;",
        "GRANT SELECT ON public.devices, public.gateways, public.locations TO ct_vpn_readonly;",
    ]
    for index, name in enumerate(("mateus", "colaborador"), start=2):
        private, public = keypair()
        psk = subprocess.check_output(["wg", "genpsk"], text=True).strip()
        address = f"10.203.77.{index}"
        role = f"ct_{name}"
        password = secrets.token_urlsafe(32)
        config += f"\n[Peer]\nPublicKey = {public}\nPresharedKey = {psk}\nAllowedIPs = {address}/32\n"
        profile = (
            f"[Interface]\nPrivateKey = {private}\nAddress = {address}/32\nMTU = 1380\n\n"
            f"[Peer]\nPublicKey = {server_public}\nPresharedKey = {psk}\n"
            "Endpoint = 2.25.238.167:51820\nAllowedIPs = 10.203.77.1/32\nPersistentKeepalive = 25\n"
        )
        (state / "clients" / f"cattle-{name}.conf").write_text(profile)
        credentials = dict(host="10.203.77.1", port=5432, database="cattle_tracker",
                           username=role, password=password, access="SELECT: devices, gateways, locations")
        (state / "clients" / f"database-{name}.json").write_text(json.dumps(credentials, indent=2) + "\n")
        # Somente verificador SCRAM no SQL; senha clara fica no arquivo privado.
        sql += [
            f"CREATE ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5 PASSWORD '{scram(password)}';",
            f"GRANT ct_vpn_readonly TO {role};",
            f"ALTER ROLE {role} SET default_transaction_read_only = on;",
            f"ALTER ROLE {role} SET statement_timeout = '30s';",
            f"ALTER ROLE {role} SET idle_in_transaction_session_timeout = '60s';",
        ]
    sql.append("COMMIT;")
    (state / "server" / "wg0.conf").write_text(config)
    (state / "apply-roles.sql").write_text("\n".join(sql) + "\n")
    print("Configuração privada gerada. Nenhuma credencial foi exibida.")


if __name__ == "__main__":
    main()
