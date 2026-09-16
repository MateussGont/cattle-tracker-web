# Manual de provisionamento do brinco

O aplicativo provisiona unidades que já saem com a mesma imagem genérica de firmware. Ele identifica o hardware antes de criar dados e o operador não escolhe o ID LoRa.

## Passo a passo

1. Use Chrome ou Edge em HTTPS/localhost, entre como administrador e abra **Dispositivos → Novo dispositivo**.
2. Conecte somente o brinco desejado e selecione sua porta USB. O aplicativo lê `hardwareUid`, versão e estado antes de qualquer cadastro.
3. Informe `deviceIdentifier` e, opcionalmente, modelo, gateway e animal.
4. Clique **Reservar ID e configurar**. O backend cria ou retoma uma sessão idempotente e reserva transacionalmente um `radioDeviceId` entre 1 e 65535.
5. O firmware grava UID lógico, ID e revisão em NVS, relê os dados e confirma a operação.
6. Reinicie o brinco e clique **Verificar após reinício e ativar**. O dispositivo só fica ativo quando a leitura USB coincide exatamente com a reserva.

O `hardwareUid` vem do MAC de fábrica do ESP32-S3 e não muda. O valor zero identifica unidade não provisionada. Associação a animal/gateway permanece no backend e não exige regravação.

Uma interrupção pode ser retomada conectando novamente o mesmo hardware. Uma unidade já provisionada recusa mudança casual de ID; recondicionamento deverá ter fluxo administrativo próprio. A atualização de firmware aparece como manutenção e não faz parte do caminho normal.

## Contrato serial

O frontend usa JSON Lines correlacionado por `requestId`: `get_info` para identificar e `provision` com `hardwareUid`, `radioDeviceId` e `configRevision`. Eventos espontâneos e respostas de outra requisição são ignorados. `GET_STATUS` permanece somente para leitura legada; `SET_RADIO_ID` é recusado.

## Validação

Registre por unidade: `deviceIdentifier | hardwareUid | radioDeviceId | configRevision | firmware | gateway | animal | leitura após reinício | primeira telemetria | responsável`.

Builds e testes automatizados não substituem a prova com placa real, navegador e backend conectados.
