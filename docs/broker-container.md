# Broker MQTT em container

Etapa da [issue #25](https://github.com/MateussGont/cattle-tracker-web/issues/25), após o [banco](database-container.md). O broker recebe mensagens MQTT; a futura API irá consumir essas mensagens e gravar telemetria no PostgreSQL. Esta etapa sozinha não conecta o mapa nem valida um gateway físico.

## Configuração e segurança

`infra/production/broker.yml` define Eclipse Mosquitto 2.1.2, com digest fixo, reinício `unless-stopped`, processo UID/GID 1883, filesystem somente leitura (exceto volume de dados) e logs rotacionados. Usa a rede interna `cattle-tracker_private` e o volume `cattle-tracker_mosquitto_data`, do projeto Compose `cattle-tracker`.

O listener 1883 é acessível aos containers dessa rede e a `127.0.0.1:1883` da VPS. Não é publicado em interfaces públicas. O acesso sem TLS pressupõe essa rede privada; acesso remoto exige túnel SSH ou uma etapa própria de TLS/VPN. A [documentação do Mosquitto](https://mosquitto.org/man/mosquitto-conf-5.html) alerta que usuário/senha sem criptografia não devem trafegar por redes não confiáveis.

| Usuário | Permissão |
| --- | --- |
| `gateway` | Publicar exclusivamente em `cattle-tracker/telemetry` |
| `backend` | Ler exclusivamente `cattle-tracker/telemetry` |
| Anônimo | Conexão recusada |

As ACLs não autenticam individualmente `gatewayId` do JSON: isso continua pendente na [issue #14](https://github.com/MateussGont/cattle-tracker-web/issues/14). Não reutilizar a conta única de bancada para múltiplos gateways de produção sem rever identidade e ACL.

## Inicialização em outra VPS

Copie `broker.yml`, `mosquitto.conf`, `mosquitto.acl` e `prepare-mqtt.sh`, preservando a estrutura. Prepare `/opt/cattle-tracker/shared/.env` com `STATE_DIR`, `APP_DOMAIN`, `MQTT_BACKEND_PASSWORD` e `GATEWAY_API_KEY`; segredos hexadecimais independentes de 32 bytes. Diretório 0700 e `.env` 0600, root:root. Na raiz da cópia do repositório:

```bash
bash infra/production/prepare-mqtt.sh
docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/broker.yml config --quiet
docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/broker.yml up -d --wait mosquitto
```

O preparador gera uma senha exclusiva para o gateway, reaproveita a senha do backend e usa `mosquitto_passwd` em container para gerar hashes. Recusa sobrescrever credenciais existentes. O arquivo `shared/mosquitto/passwd` fica root:1883, 0640, montado somente leitura no broker. `shared/gateway-access.json` fica root:root, 0600; contém os dados privados para configurar o gateway futuramente. A URL HTTP nesse arquivo é uma referência para etapa posterior, não comprova API publicada.

Para as etapas separadas, execute apenas os serviços explicitamente escolhidos; não use `--remove-orphans`, pois banco e broker compartilham o nome do projeto. O Compose completo em preparação herda os mesmos serviços por `extends`.

## Comandos para acompanhar

```bash
docker ps
docker logs --tail 30 cattle-tracker-mosquitto-1
docker volume ls
docker port cattle-tracker-mosquitto-1
```

O último comando deve mostrar `1883/tcp -> 127.0.0.1:1883`. Healthcheck verifica que a porta responde; os testes de autenticação/ACL e mensagens são verificações adicionais.

A persistência do Mosquitto guarda estado MQTT aplicável (como mensagens retidas e sessões persistentes) e grava periodicamente ou no encerramento normal. Não transforma automaticamente telemetria QoS 0 em entrega garantida e não substitui o histórico no banco nem backup. Nenhuma mensagem sintética de validação deve permanecer retida ao encerrar os testes.

O firmware atual usa `WiFiClient` sem TLS. Seu host MQTT não deve ser apontado diretamente para o IP público nesta etapa. Um túnel para `localhost` do computador também não fica automaticamente acessível ao ESP32: conexão física será preparada depois, via TLS ou ponte privada.
