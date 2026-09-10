> **Contexto após a separação:** backend/frontend/infra agora estão em [cattle-tracker-web](https://github.com/MateussGont/cattle-tracker-web); firmware/protocolo/hardware permanecem em [cattle-tracker-lora](https://github.com/MateussGont/cattle-tracker-lora). Este documento registra a arquitetura anterior e decisões históricas; afirmações de completude devem ser confrontadas com a [revisão técnica](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/revisao-cattle-tracker-lora.md). O [contrato atual](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/separacao-repositorios.md) e o [plano](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/plano-evolucao.md) orientam novas mudanças.

# Arquitetura do sistema

## Visão geral

```text
Colar (ESP32-S3 + GNSS + LoRa)
  --LoRa P2P 915 MHz-->
Receptor/Gateway (Heltec WiFi LoRa 32 V2)
  --Wi-Fi + MQTT-->
Backend (Node.js + Fastify + TypeScript)
  --SQL / PostGIS-->
PostgreSQL + PostGIS
  --REST + WebSocket-->
Frontend (React + Vite + TypeScript + MapLibre GL)
```

A regra de acesso é sempre `Aplicativo → API/Backend → Banco de dados`. O
frontend nunca acessa o PostgreSQL diretamente.

## Stack e justificativas

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Firmware | C++ / Arduino framework, RadioLib, TinyGPSPlus | Já em uso no protótipo; RadioLib suporta SX1262 e SX1276 com a mesma API. |
| Gateway → Backend | MQTT (Mosquitto) | Desacopla o transporte IoT do backend — trocar de gateway/protocolo não exige mudar o backend, só o adaptador em `backend/src/integrations/mqtt`. |
| Backend | Node.js + TypeScript + Fastify | Mais rápido que Express, validação de schema nativa; `@fastify/websocket` cobre o tempo real sem uma stack adicional. |
| Validação | Zod | Um único schema (`backend/src/schemas/telemetry.ts`) valida telemetria tanto no caminho MQTT quanto no fallback HTTP. |
| ORM | Drizzle | Prisma tem suporte fraco a tipos geométricos do PostGIS; Drizzle permite cair para SQL cru nas consultas espaciais (`ST_Contains`, `ST_AsGeoJSON`) mantendo type-safety no resto. |
| Banco | PostgreSQL 16 + PostGIS | Índices GiST para consultas espaciais, `geography`/`geometry` nativos para geofencing e histórico de trajetórias, maduro para milhões de registros de GPS. |
| Tempo real (app) | WebSocket | Mais simples que SSE para push bidirecional; o MQTT fica restrito ao lado IoT (gateway → backend). |
| Mapa | MapLibre GL + tiles OpenStreetMap | Sem custo por carregamento de mapa (ao contrário do Google Maps Platform), qualidade vetorial equivalente. Ver `frontend/src/lib/mapStyle.ts` — trocar o provedor de tiles para produção com tráfego real é uma troca de um arquivo só. |
| Frontend | React + TypeScript + Vite + Tailwind + React Router + TanStack Query | Conforme especificação; TanStack Query cuida de cache/refetch do REST. |

## Modelagem de dados

Entidades principais (`backend/src/db/schema.ts`): `users`, `properties`,
`user_properties` (controle de acesso por propriedade), `animals`,
`devices`, `device_assignments`, `locations`, `geofences`, `alerts`,
`settings`.

Duas decisões que se afastam do esquema sugerido no requisito original:

- **`device_assignments` em vez de FK bidirecional** (`animal.device_id` ⇄
  `device.animal_id`): evita duas fontes de verdade conflitantes e mantém um
  histórico completo de quando cada dispositivo foi associado/desassociado
  de um animal (necessário para a seção "gerenciamento de dispositivos").
- **`settings` (chave/valor)**: os limiares de ONLINE/ATENÇÃO/OFFLINE e de
  bateria baixa são configuráveis via `GET /api/settings`, nunca fixos no
  frontend.

`devices.last_latitude`/`last_longitude`/`battery_level`/`last_seen` são
atualizados a cada telemetria recebida (heartbeat) e servem de cache para o
mapa e o dashboard não precisarem varrer a tabela `locations` (que acumula
um registro por transmissão) a cada carregamento de tela.

## Ponte entre o rádio e o domínio de negócio

O pacote LoRa (`firmware/common/protocol.h`) carrega um `deviceId: uint16`
compacto para economizar airtime. Esse valor é o `radio_device_id` da tabela
`devices`. Um dispositivo precisa ser provisionado (`POST /api/devices`,
associando `device_identifier` tipo `BRINCO-0001` ao `radioDeviceId`
numérico) antes que sua telemetria seja aceita — telemetria de um
`radioDeviceId` desconhecido é descartada com um aviso no log, não
armazenada silenciosamente.

## Fluxo de telemetria

1. O gateway (`firmware/receiver`) decodifica o pacote LoRa e publica JSON em
   `cattle-tracker/telemetry` via MQTT (`firmware/receiver/mqtt_publisher.h`).
2. `backend/src/integrations/mqtt/telemetrySubscriber.ts` valida o payload
   (Zod) e chama `telemetryService.ingestTelemetry`.
3. O serviço resolve o dispositivo pelo `radioDeviceId`, atualiza o heartbeat
   do dispositivo, grava um registro em `locations` **apenas quando o GNSS
   tem fixação válida** (coordenadas zero de "sem fixação" nunca são
   tratadas como uma posição real) e resolve o animal atualmente associado.
4. Regras de negócio disparadas na mesma passada: geofencing (`ST_Contains`
   contra os polígonos ativos da propriedade) e bateria baixa — ambos usam
   `alertService.raiseAlertOnce`/`clearAlert` para não duplicar alertas a
   cada ciclo enquanto a condição persiste.
5. O resultado é publicado no WebSocket (`backend/src/websocket/realtime.ts`)
   e o frontend invalida as queries do mapa/dashboard/alertas
   (`frontend/src/hooks/useRealtimeUpdates.ts`).

`POST /api/telemetry` (autenticado por um header `x-gateway-key` — um
segredo de dispositivo, não um JWT de usuário) existe como caminho
alternativo para gateways que não falam MQTT, e roda exatamente o mesmo
`telemetryService`.

## Autenticação e autorização

JWT (`@fastify/jwt`) para usuários; o WebSocket é autenticado pelo mesmo
token via query string. O acesso é restrito por propriedade:
administradores veem tudo, os demais papéis só veem as propriedades listadas
em `user_properties` (`backend/src/middlewares/authenticate.ts`).

## Limites conhecidos / riscos técnicos

- **Bateria**: o colar hoje envia `batteryMv=0` (o XIAO ESP32-S3 não expõe
  leitura de bateria por padrão) — a conversão para percentual em
  `backend/src/utils/battery.ts` é uma aproximação linear de LiPo, não uma
  medição de fuel-gauge. Sem hardware de leitura de tensão, a flag
  `kFlagBatteryValid` nunca é setada e o campo fica `null`.
- **Segurança do rádio**: o protocolo LoRa usa CRC-16 para detectar
  corrupção, não para autenticar a origem do pacote — não há criptografia
  nem assinatura. Isso é aceitável para o protótipo, mas deve ser endereçado
  antes de um deploy em produção (fase de segurança).
- **Gateway único**: hoje só uma Heltec recebe. O tópico MQTT já carrega
  `gatewayId`, então propriedades grandes com múltiplos gateways não exigem
  mudança de esquema — só mais receptores publicando no mesmo tópico.
- **`radio.receive()` é bloqueante**: no gateway, a manutenção de Wi-Fi/MQTT
  (`mqttPublisher.loop()`) só roda nos intervalos entre pacotes recebidos.
  Compatível com o intervalo de transmissão atual do colar (10 s); um
  gateway multi-colar exigiria recepção assíncrona.
- **Sincronização de horário**: `gnssUnixTime` só é confiável quando o GNSS
  tem fixação de horário (`kFlagGnssTimeValid`); caso contrário o backend usa
  o horário de ingestão como `recordedAt`.

## O que foi validado nesta sessão

- Backend: type-check limpo, suíte de testes (vitest) passando, migration
  gerada a partir do schema sem erros, servidor sobe e responde em
  `/healthz`.
- Frontend: type-check limpo, build de produção com code-splitting do mapa,
  testes (vitest) passando, servidor de desenvolvimento serve todas as rotas
  principais sem erro de transformação.
- Firmware: os dois ambientes (`collar_xiao_sx1262` e `receiver_heltec_v2`,
  este último já com PubSubClient/ArduinoJson) compilam e linkam com sucesso
  via PlatformIO (`pio run`), incluindo o novo `mqtt_publisher.cpp`.

Não foi validado ainda:

- Fluxo ponta a ponta contra PostgreSQL/Mosquitto reais rodando em
  containers (depende do Docker Desktop/WSL2 — instalados nesta sessão, mas
  a ativação do WSL2 exige um reboot do Windows que ainda não aconteceu).
- Upload/execução em hardware físico (colar, receptor, GNSS).
- O teste nativo `test/test_protocol.cpp` não foi recompilado nesta sessão
  por falta de um toolchain C++ de host (g++/MSVC) nesta máquina; a lógica de
  `protocol.h` foi exercitada indiretamente pelos dois firmwares compilando
  com sucesso.
