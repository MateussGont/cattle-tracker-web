# Separação de repositórios e contrato de integração
## Decisão
cattle-tracker-lora passa a concentrar firmware de brinco/gateway, protocolo e hardware. cattle-tracker-web concentra frontend React, backend Fastify, migrations e infraestrutura de PostgreSQL/Mosquitto. O broker permanece na infraestrutura web; o cliente MQTT embarcado permanece no gateway.
O Project pessoal nº 1 é o quadro central. Issues antigas úteis são preservadas; issues exclusivamente web podem ser transferidas, com referências qualificadas pelo repositório.

## Base e histórico
Extração a partir de MateussGont/cattle-tracker-lora@4a85dff8f089703848c17a84e3efa5dc6f7a9943. O novo repositório começa com um snapshot rastreável; o histórico detalhado anterior permanece no original. Não há migração de banco ou alteração de dados por separar arquivos. Credenciais locais, passwd, .env, secrets.h, node_modules e binários não fazem parte da extração.

## Contratos que permanecem
- LoRa v1: 26 bytes, magic 0xCA71, versão 1, little endian, CRC-16/CCITT com estado inicial 0xFFFF.
- JSON gateway→API: gatewayId, radioDeviceId, sequence, latitude, longitude, gnssUnixTime, batteryMv, flags; RSSI/SNR opcionais. Tópico padrão cattle-tracker/telemetry.
- HTTP alternativo: POST /api/telemetry com x-gateway-key.
- Serial: GET_STATUS e SET_RADIO_ID N, uma linha encerrada por LF; resposta JSON conforme firmware atual.
- Artefato do brinco: imagem completa ESP32-S3 com bootloader em 0x0, partições em 0x8000, boot_app0 em 0xe000 e aplicação em 0x10000.
- Caminho web mantido temporariamente: /firmware/collar-latest.bin. A mudança de nomenclatura para brinco será coordenada; não renomear somente um lado.

## Gerar e importar firmware
No repositório de firmware, com o ambiente PlatformIO já preparado:
```text
pio run -e collar_xiao_sx1262
node scripts/sync-firmware.mjs
```
Saída: dist/firmware/collar-latest.bin. O script também informa o SHA-256. Essa é a imagem completa; não usar somente .pio/build/.../firmware.bin no gravador do navegador.
Na aplicação web:
```text
npm run firmware:import -- "../cattle-tracker-lora/dist/firmware/collar-latest.bin" "versao-ou-commit" "sha256-informado-na-geracao"
```
O importador valida hash, limites, posições de cabeçalho e identificação ESP32-S3; essas verificações não equivalem a teste de funcionamento ou assinatura do fabricante. Use um artefato do projeto gerado pelo responsável técnico.
A saída fica em frontend/public/firmware, junto ao manifesto. Em desenvolvimento, Vite serve o arquivo; antes de um build de distribuição que ofereça gravação USB, importe o artefato. As telas comuns compilam sem PlatformIO. Sem imagem, o botão de gravação retorna erro de download.
Binários e manifesto gerado permanecem fora do Git. A automação de release/download com versão e compatibilidade será implementada na issue de CI/releases. Não publicar firmware de gateway que contenha credenciais de secrets.h.

## Executar a aplicação
Use Node compatível com as dependências travadas no package-lock; os testes desta organização utilizaram Node 24 para verificações independentes, sem instalar as dependências web.
Preparação explícita: revisar os .env.example, instalar dependências com npm ci quando autorizado, preparar credencial Mosquitto, iniciar infraestrutura conforme infra/docker-compose.yml, aplicar migrations e, somente em ambiente de demonstração novo, executar seed.
Com dependências/serviços preparados:
```text
npm run dev:backend
npm run dev:frontend
```
Em terminais separados, na raiz de cattle-tracker-web. API padrão localhost:3000; frontend localhost:5173. Configure VITE_API_URL, VITE_WS_URL e CORS_ORIGIN para o ambiente real. Os scripts antigos de início automático foram retirados porque instalavam dependências, aplicavam seed e encerravam processos sem limitar o projeto; nenhum serviço foi iniciado ou encerrado durante esta migração.

## Validação e retorno
Comparar arquivos de backend/frontend/infra com o commit de origem, exceto manifests/scripts de desacoplamento documentados. Executar testes/build web, migrations em banco descartável, dois builds PlatformIO e importação/gravação em placa para aceitar uma release completa.
A migração organizacional não corrige os bugs de negócio listados na revisão. Para consultar o monorepositório anterior, usar a tag pre-web-split-4a85dff8. Para reverter a separação do original, reverter o commit de migração em uma branch e revisar; não apagar volumes nem recriar banco.
