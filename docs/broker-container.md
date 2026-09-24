# Broker MQTT em container

Etapa da [issue #25](https://github.com/MateussGont/cattle-tracker-web/issues/25), após o [banco](database-container.md). O broker recebe mensagens MQTT; a futura API irá consumir essas mensagens e gravar telemetria no PostgreSQL. Esta etapa sozinha não conecta o mapa nem valida um gateway físico.

## Configuração e segurança

`infra/production/broker.yml` define Eclipse Mosquitto 2.1.2, com digest fixo, reinício `unless-stopped`, processo UID/GID 1883, filesystem somente leitura (exceto volume de dados) e logs rotacionados. Usa a rede interna `cattle-tracker_private` e o volume `cattle-tracker_mosquitto_data`, do projeto Compose `cattle-tracker`.

O listener 1883 é acessível aos containers dessa rede e a `127.0.0.1:1883` da VPS. Não é publicado em interfaces públicas. A rede auxiliar `cattle-tracker_broker_access` (bridge não interna) permite o mapeamento de loopback: nesta VPS, somente a rede `internal: true` não ativou o mapeamento. Essa rede auxiliar admite saída do broker, mas não contém o banco; o bind explícito em `127.0.0.1` restringe a entrada à VPS. Consulte [publicação de portas do Docker](https://docs.docker.com/engine/network/port-publishing/).

O acesso sem TLS pressupõe essa rede privada; acesso remoto exige túnel SSH ou uma etapa própria de TLS/VPN. A [documentação do Mosquitto](https://mosquitto.org/man/mosquitto-conf-5.html) alerta que usuário/senha sem criptografia não devem trafegar por redes não confiáveis.

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
docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/broker.yml up -d --force-recreate --wait mosquitto
```

O preparador gera uma senha exclusiva para o gateway, reaproveita a senha do backend e usa `mosquitto_passwd` em container para gerar hashes. Se ambos os arquivos de credenciais já existirem, preserva seus valores e atualiza somente a ACL e as permissões; uma configuração parcial interrompe a execução. `shared/mosquitto/passwd` e `shared/mosquitto/acl` ficam 1883:1883, 0600, protegidos pelo diretório pai root 0700 e montados somente leitura no broker. O proprietário específico evita avisos e futuras recusas do Mosquitto. `shared/gateway-access.json` fica root:root, 0600; contém os dados privados para configurar o gateway futuramente. A URL HTTP nesse arquivo é uma referência para etapa posterior, não comprova API publicada.

Para as etapas separadas, execute apenas os serviços explicitamente escolhidos; não use `--remove-orphans`, pois banco e broker compartilham o nome do projeto. O Compose completo em preparação herda os mesmos serviços por `extends`.

Após atualizar a ACL pelo preparador, recrie somente o broker conforme o comando acima: o arquivo é um bind mount e o container precisa carregar a versão atual. Há uma breve interrupção MQTT; combine a janela quando houver clientes reais.

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

## Evidência da etapa — 2026-09-23 (America/Sao_Paulo)

Configuração `8d769178c1d6`, branch `codex/vps-mvp-deployment`, aplicada na VPS Ubuntu 24.04, Docker 29.8.1 e Compose 5.5.1. Fonte em `/opt/cattle-tracker/releases/8d769178c1d6`; `/opt/cattle-tracker/broker` aponta para essa release. Validação final em 2026-09-24 às 01:57 UTC (22:57 de 2026-09-23 em São Paulo).

Resultados comprovados com clientes temporários em containers, sem hardware físico:

- `cattle-tracker-mosquitto-1` saudável, UID/GID 1883, filesystem somente leitura e reinício `unless-stopped`.
- Publicação como `gateway` e leitura como `backend` em MQTT 3.1.1, compatível com o transporte do firmware; leitura autenticada adicional usando o loopback do host.
- Conexões anônimas e senha incorreta recusadas; publicação pelo backend e publicação do gateway em outro tópico negadas. Gateway não conseguiu ler a mensagem de teste.
- Mensagem retida sintética persistiu após recriação do container (ID alterado), foi removida e sua ausência foi confirmada. Isso testa persistência MQTT, não ingestão no banco ou entrega garantida de telemetria.
- `docker port` e `ss` confirmaram exclusivamente `127.0.0.1:1883`. Tentativa TCP ao IP público da VPS, a partir do Windows, terminou sem conexão dentro de cinco segundos.
- Banco continuou saudável, sem porta publicada e ligado somente à rede interna. UFW manteve apenas SSH liberado em IPv4/IPv6.
- Nova execução do preparador preservou integralmente `.env`, arquivo privado do gateway e hashes MQTT (comparação sem imprimir conteúdo). Arquivos MQTT com modo 0600 e UID/GID 1883; segredos somente na VPS.

O teste inicial detectou ausência do mapeamento de loopback quando o broker estava somente na rede interna. A rede auxiliar foi adicionada e todos os testes acima passaram na configuração final. Nenhuma senha foi versionada. Credenciais temporárias dos clientes e a mensagem sintética foram removidas.

API, migrations de negócio, site/HTTPS, administrador, backups e conexão com gateway físico ainda não foram implantados/validados nesta etapa. O PR [#26](https://github.com/MateussGont/cattle-tracker-web/pull/26) permanece rascunho da entrega parcial.
