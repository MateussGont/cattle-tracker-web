# Cattle Tracker — aplicação web

Aplicação de rastreamento do rebanho: frontend React/Vite/MapLibre, API Fastify/TypeScript, PostgreSQL/PostGIS e Mosquitto. Firmware e hardware ficam em [cattle-tracker-lora](https://github.com/MateussGont/cattle-tracker-lora).

## Organização

- [Project central](https://github.com/users/MateussGont/projects/1) e [próximos passos](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/backlog.md).
- [Manual de cadastro do brinco](docs/manual-cadastro-brinco.md).
- [Arquitetura](docs/architecture.md), [plano de evolução](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/plano-evolucao.md) e [revisão de código](https://github.com/MateussGont/cattle-tracker-lora/blob/main/docs/revisao-cattle-tracker-lora.md).
- [Contrato de integração e origem da extração](docs/separacao-repositorios.md).

Frontend e backend permanecem em workspaces npm do mesmo repositório. O gateway físico pertence ao repositório de firmware; o broker faz parte da infraestrutura web. A API concentra autorização e acesso ao banco.

## Preparar ambiente de desenvolvimento

Revise backend/.env.example e frontend/.env.example e crie os arquivos .env locais. Configure segredos próprios de JWT e gateway, endereço do banco, credenciais MQTT e origens HTTP/WebSocket. A configuração Docker incluída é de desenvolvimento.

1. Com Node e npm preparados, instale as versões do lockfile com `npm ci` na raiz.
2. Prepare infra/mosquitto/passwd com um usuário do Mosquitto correspondente a MQTT_USERNAME/MQTT_PASSWORD. O arquivo deve ser legível pelo container. Não versione esse arquivo.
3. Inicie os serviços com `docker compose -f infra/docker-compose.yml up -d --wait`.
4. Aplique migrations com `npm run db:migrate` ao banco desejado. Faça backup antes de alterar um banco existente.
5. Apenas em um banco novo de demonstração, `npm run db:seed` cria dados e o acesso admin@cattletracker.local / ChangeMe123!. Esse acesso não deve ser utilizado em produção.
6. Em terminais separados: `npm run dev:backend` e `npm run dev:frontend`.

API: localhost:3000; site: localhost:5173; PostgreSQL: localhost:5432; MQTT: localhost:1883. No ambiente hospedado, configure VITE_API_URL, VITE_WS_URL e CORS_ORIGIN e prepare HTTPS/WSS.

## Firmware no assistente USB

O site inicia e compila sem PlatformIO. Para oferecer gravação de uma placa nova, importe previamente uma imagem completa do repositório de firmware:

```text
npm run firmware:import -- "../cattle-tracker-lora/dist/firmware/collar-latest.bin" "versao-ou-commit" "sha256-da-imagem"
```

O importador verifica hash, tamanho e cabeçalhos ESP32-S3 e gera frontend/public/firmware/collar-latest.bin e manifest.json, ignorados pelo Git. Importe antes de gerar a distribuição que oferecerá gravação. A ausência do binário impede apenas essa etapa do cadastro; consulte o [manual](docs/manual-cadastro-brinco.md).

## Testes e builds

Com as dependências instaladas:

```text
npm run test:backend
npm run test:frontend
npm run build:backend
npm run build:frontend
```

A extração preserva os arquivos de negócio e as versões das dependências. Nesta organização foram conferidos hashes, estrutura do lockfile e o importador de artefato; não foram executados os testes Vitest, builds completos, banco Docker nem gravação física. Os problemas descobertos na revisão estão nas issues abertas e precisam ser corrigidos antes de uso operacional.

## Histórico

Snapshot extraído de cattle-tracker-lora@4a85dff8f089703848c17a84e3efa5dc6f7a9943. O histórico anterior continua no repositório de origem. Os antigos atalhos de início/parada não foram trazidos: o preparo do ambiente e a execução agora são explícitos. Veja [CONTRIBUTING.md](CONTRIBUTING.md).
