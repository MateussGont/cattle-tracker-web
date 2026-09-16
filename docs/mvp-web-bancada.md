# MVP web de bancada

Decisão registrada em 2026-09-16 para o trabalho de
[cattle-tracker-web#23](https://github.com/MateussGont/cattle-tracker-web/issues/23).

## Objetivo

A aplicação serve primeiro para responder três perguntas:

1. O brinco foi identificado e provisionado corretamente?
2. A última posição recebida aparece no mapa?
3. O backend observou comunicação do gateway?

Qualquer tela que não ajude diretamente nessas respostas fica fora da
navegação do M1.

## Interface vigente

| Tela | Contrato | Responsabilidade |
| --- | --- | --- |
| Mapa | `GET /api/map/devices` | Última posição GNSS e estado de comunicação de cada brinco ativo. |
| Brincos | `GET /api/devices`, `/api/provisioning/sessions` e Web Serial | Inventário técnico, provisionamento e desativação. |
| Gateway | `GET /api/gateways` | Identificador e última comunicação observada pelo backend. |

O cadastro de brinco não solicita animal, propriedade ou gateway. Essas
associações são conceitos de operação e não devem bloquear a validação
técnica do enlace.

## Fora do recorte

Animais, propriedades, cercas virtuais, trajetórias, alertas, regras,
dashboard gerencial e configurações de produto não são exibidos. Os cartões
existentes continuam sendo a fonte para retomar esses fluxos quando houver
necessidade e contrato definidos.

O backend pode preservar tabelas, migrations e serviços dessas áreas. A
remoção destrutiva de dados não faz parte desta simplificação.

## Gateway

O gateway atual publica telemetria por MQTT e não oferece uma API HTTP de
saúde própria. Portanto, a tela não inventa um estado online/offline: mostra
`lastSeen`, atualizado quando o backend processa telemetria válida. Um
heartbeat independente deve ser especificado no contrato do receptor antes
de aparecer como indicador de saúde.

## Decisão de stack

React/Vite, Fastify, TypeScript, PostgreSQL/PostGIS e Mosquitto são mantidos.
A complexidade observada vinha do escopo antecipado das telas, não de uma
limitação estrutural da stack. Trocá-la agora repetiria autenticação,
provisionamento, ingestão e mapa sem reduzir a incerteza principal.

A arquitetura permanece separada em adaptadores HTTP/MQTT/Web Serial,
serviços e componentes pequenos. Novas telas só devem entrar quando o
backend correspondente tiver contrato, critério de aceite e evidência de
necessidade no piloto.
