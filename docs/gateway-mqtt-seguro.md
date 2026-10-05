# Gateway → VPS por MQTT seguro

Entrega de servidor da [issue #28](https://github.com/MateussGont/cattle-tracker-web/issues/28), dependente da infraestrutura da [PR #27](https://github.com/MateussGont/cattle-tracker-web/pull/27). Data: **2026-10-05**. Recorte: um gateway de bancada; não certifica hardware, operação multi-cliente nem entrega sem perdas.

## O que está disponível para o responsável pelo gateway

| Parâmetro | Valor |
| --- | --- |
| Host MQTT (sem `https://`) | `cattletracker.tech` |
| Porta TCP | `8883` |
| Transporte | MQTT sobre TLS 1.2 ou superior |
| Versão MQTT | 3.1.1 (compatível com PubSubClient) ou 5 |
| Usuário | `gateway` |
| Senha | Compartilhada privadamente pelo responsável; nunca no Git/chat/log |
| Tópico permitido | `cattle-tracker/telemetry`, somente publicação |
| Certificado do servidor | Cadeia pública Let's Encrypt; validar CA, hostname e validade |
| Certificado de cliente | Não exigido: autenticação MQTT por usuário/senha dentro do TLS |
| Wi-Fi e `GATEWAY_ID` | Configurados no equipamento, identificador único por unidade |

**Sim, outra pessoa pode configurar o gateway sem acesso administrativo à VPS.** Entregue o roteiro e somente a credencial MQTT. Não envie chave SSH/PPK, senha do site, `.env`, `admin.json`, chave privada TLS ou o arquivo antigo `gateway-access.json` (ele também contém uma chave da API HTTP).

O proprietário pode consultar **no próprio terminal SSH**:

```bash
cat /opt/cattle-tracker/shared/gateway-mqtt.json
```

Esse arquivo root 0600 contém apenas os parâmetros MQTT e a senha do piloto. Compartilhe por um gerenciador de senhas ou outro canal privado, com acesso limitado. Não coloque o conteúdo em issue, PR ou captura de tela. O segredo permite enviar telemetria; não é apropriado distribuí-lo entre gateways/clientes independentes. Rotação deve atualizar o hash dos dois arquivos Mosquitto, os arquivos privados de entrega e o dispositivo, com teste de revogação.

## Antes de gravar o gateway: falta implementar TLS no firmware

O firmware revisado foi [cattle-tracker-lora@c854e9edceaadd5bc49d9ee1af4cdeccaa16aaf4](https://github.com/MateussGont/cattle-tracker-lora/tree/c854e9edceaadd5bc49d9ee1af4cdeccaa16aaf4). `firmware/receiver/mqtt_publisher.h` usa `WiFiClient`, que não fornece TLS. **Somente mudar host/porta/senha não funciona.** O repositório de firmware não foi alterado nesta entrega.

Checklist para quem desenvolver/configurar a placa:

1. Usar o ambiente PlatformIO `receiver_heltec_v2` e conferir placa e antena reais.
2. Trocar o transporte por `WiFiClientSecure` (ou equivalente da versão Arduino-ESP32 usada), configurar a CA antes da conexão e manter esse cliente como transporte do `PubSubClient`.
3. Usar certificados-raiz oficiais de confiança da Let's Encrypt, não o certificado de curta duração do servidor. Conferir a cadeia servida e suporte da biblioteca; preparar atualização das raízes se necessário. Não fixar o intermediário YE2 nem a data atual de emissão.
4. Sincronizar UTC por SNTP após obter Wi-Fi, com prazo limite e estado de falha; não tentar TLS com relógio inválido. Manter retentativas limitadas, sem espera infinita no loop LoRa.
5. Conectar usando o nome `cattletracker.tech` e porta 8883. **Nunca usar `setInsecure()`, desabilitar validação de hostname ou fazer fallback para 1883 pública.**
6. Copiar `secrets.h.example` para `secrets.h` local/ignorado; ajustar Wi-Fi, host, porta, usuário, senha, tópico e identificador único. Não publicar binário do gateway contendo credenciais.
7. Preservar o JSON de telemetria e o protocolo LoRa. Dimensionar o buffer PubSubClient para payload + tópico + cabeçalhos; tratar erro de publicação. QoS0 não comprova persistência no banco.
8. Compilar, gravar e validar em placa. Registrar commit, modelo, data e evidência sem credenciais.

Fontes técnicas: [cliente seguro oficial Arduino-ESP32](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/examples/WiFiClientSecure/WiFiClientSecure.ino), [raízes oficiais Let's Encrypt](https://letsencrypt.org/certificates/), [contrato dos repositórios](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/separacao-repositorios.md).

## Aceite físico pendente

- Relógio sincroniza e MQTT conecta com certificado validado.
- Senha errada, CA errada e hostname errado são recusados; não há fallback inseguro.
- Reconexão após perda de Wi-Fi/broker, sem declarar recuperação de pacotes QoS0 não confirmados.
- Brinco cadastrado transmite pacote; gateway encaminha, API persiste e mapa mostra posição real.
- Registrar firmware/placa e evidência; simulação de cliente MQTT não substitui esse ensaio.

O `gatewayId` continua no payload; esta camada de TLS não o vincula criptograficamente à credencial. A [issue #14](https://github.com/MateussGont/cattle-tracker-web/issues/14) permanece aberta. Também não corrige duplicatas/horários, autorização multi-cliente ou recepção LoRa bloqueante.

## Arquitetura e operação na VPS

- Listener interno 1883 preservado em rede Docker e `127.0.0.1` do host.
- Listener público 8883, IPv4/IPv6, TLS mínimo 1.2, sem anônimos e máximo de 20 conexões. Arquivo de senha externo contém **somente gateway**; credencial backend não é aceita externamente. ACL preservada: gateway publica no tópico; backend lê internamente.
- `mqtt-cert-sync` lê o volume Caddy somente leitura, valida domínio, validade e par chave/certificado, escreve geração completa e troca symlink atomicamente. Verifica a cada 60 s e pede recarga SIGHUP ao Mosquitto na mudança e no primeiro ciclo após restart.
- Container sem rede, sem socket Docker, filesystem somente leitura fora do volume de saída. UID 0/GID1883 com apenas DAC_OVERRIDE para ler certificados protegidos e KILL para sinalizar o broker no namespace de processos compartilhado. Não acessa os processos do host. Certificados copiados root:1883, diretórios 0750 e arquivos 0640.
- Healthcheck acusa mais de 5 min sem sincronização ou menos de 7 dias de validade. Ainda não há notificação externa automática: `unhealthy` exige acompanhamento. Rotação real pela autoridade certificadora continua dependendo do ciclo futuro; teste de cópia/recarga não significa renovação ACME já observada.
- Certificados persistem em `cattle-tracker_mqtt_certs` e `cattle-tracker_caddy_data`. Gerações anteriores preservadas; sem expurgo automático. Backup local de `shared` inclui credenciais, **não** esses volumes. Recuperação exige preservar certificados privadamente ou reemitir pelo Caddy e reinicializar a cópia.

Release MQTT inicial: **a6fcf8c2fe1c**, apontada por `/opt/cattle-tracker/mqtt-tls`. API/site permanecem em **cb41393fbf54**, referenciados por `/opt/cattle-tracker/current` e `shared/deployed-release`. A implantação não recompilou o app nem aplicou migrations.

Use o helper MQTT como comando completo da instalação a partir desta etapa:

```bash
sh /opt/cattle-tracker/mqtt-tls/infra/production/compose-mqtt-tls.sh ps
docker logs --tail 10 cattle-tracker-mqtt-cert-sync-1
curl -fsS https://cattletracker.tech/healthz
```

**Não use o helper público antigo para `up mosquitto`/`up` da stack inteira:** ele volta ao listener privado e remove a publicação TLS. Para recriar o broker, pare o sincronizador e recrie ambos na ordem broker → sincronizador, com `--no-deps --wait`; use `--force-recreate` também no sincronizador, pois ele compartilha o namespace do broker. Não use `down -v`, `volume prune` ou `--remove-orphans`.

### Implantação reproduzível

1. Preparar a stack HTTPS conforme [domínio público](vps-public-domain.md), com certificado Caddy válido. Fazer backup.
2. Extrair release versionada e validar `public.yml` + `mqtt-tls.yml` usando `config --quiet`. `RELEASE_TAG` deve continuar apontando para as imagens reais do app até um novo build/deploy.
3. Executar `prepare-mqtt-tls.sh` na VPS como root: preserva a senha e deriva `shared/mosquitto/gateway-passwd` somente com o hash gateway. Se o arquivo estiver montado em container existente, recriar o broker para usar o novo inode.
4. Executar serviço de perfil `setup`, `mqtt-cert-init once`, antes de iniciar o listener TLS. Ele não sinaliza processo algum.
5. Validar configuração num broker isolado, com persistência temporária, sem usar o volume de dados ativo e sem publicar portas.
6. Atualizar somente `mosquitto`, depois `mqtt-cert-sync`. Liberar 8883/TCP nos firewalls aplicáveis. Docker faz NAT e suas portas publicadas não devem ser consideradas protegidas apenas pelo UFW; conferir bind/portas e testar externamente.
7. Executar os verificadores, atualizar symlink MQTT/marcador somente após sucesso, preparar `gateway-mqtt.json` com `prepare-gateway-handoff.mjs` e fazer novo backup. Não imprimir credenciais.

### Rollback

Em janela combinada: parar `mqtt-cert-sync`; recriar somente Mosquitto usando `public.yml` da release **cb41393fbf54** e a tag de imagens correta. Conferir backend reconectado e HTTPS saudável; remover permissão 8883 do UFW e verificar externamente que a porta fechou. O sincronizador parado, volume de certificados e registros de release podem ser preservados para retomada. Não apagar dados/volumes nem restaurar banco para desfazer transporte. Registrar que o modo TLS ficou inativo e não usar o helper MQTT até reativação intencional.

## Evidências — 2026-10-05

- Teste automatizado em Node22/Linux/OpenSSL: validade, hostname, par chave/certificado, troca de geração, idempotência, falha de recarga e preservação do último certificado válido.
- Preflight Mosquitto2.1.2 isolado, sem portas externas nem dados de produção: listeners1883/8883 iniciados. Container de teste removido; somente arquivos temporários sintéticos foram descartados.
- Cliente MQTT na rede de saída da VPS usando o domínio: anonimato/senha errada/backend externo recusados; MQTT3.1.1 e5 autenticados; publicação autorizada recebida por assinante interno; leitura pelo gateway e publicação fora do tópico recusadas.
- Teste usou marcador JSON fora do schema de telemetria, sem criar dispositivo/gateway/posição; não representa medição física.
- Cliente Windows externo: TLS1.2/1.3 com cadeia confiável e validade até 2026-12-27; hostname/CA errados, TLS1.1, MQTT sem TLS e anônimo recusados; 1883 não acessível.
- Site permaneceu saudável. Banco, API, web e backup não foram reiniciados; broker foi recriado com persistência preservada. SSH não foi modificado.
- Backup antes da mudança: `20261005T220812Z`. Backups diários observados até `20261005T214242Z`.
- Backup posterior, incluindo `gateway-mqtt.json` privado: `20261005T221403Z`. Seis containers saudáveis; contagens após testes: zero dispositivos, gateways e posições. Recarga SIGHUP registrada pelo broker; não houve renovação ACME forçada.
