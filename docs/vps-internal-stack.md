# VPS privada — antes dos endpoints públicos

Entrega parcial da [issue #25](https://github.com/MateussGont/cattle-tracker-web/issues/25), continuidade do [PR #26](https://github.com/MateussGont/cattle-tracker-web/pull/26). O limite autorizado é concluir a operação interna e parar antes da exposição pública. O Compose desta etapa é **`infra/production/internal.yml`**. Rascunhos locais de `compose.yml`, HTTPS e configuração do host não representam implantação e não devem substituir esta configuração.

## Serviços e conexões

| Serviço | Função e acesso |
| --- | --- |
| `postgres` | PostgreSQL 16/PostGIS 3.5; `postgres:5432` na rede privada; sem porta publicada |
| `mosquitto` | MQTT autenticado; `mosquitto:1883` privado e `127.0.0.1:1883` no host |
| `backend` | API, ingestão MQTT, persistência e WebSocket; `backend:3000`, sem porta publicada |
| `web` | Site estático e proxy de `/api/*`, `/ws` e `/healthz`; somente `127.0.0.1:8080` |
| `backup` | Dump completo do banco e cópia privada da configuração, sem porta e sem Docker socket |

Banco/broker/backend/backup compartilham `private` (`internal: true`). Web e backend se comunicam por `application` (também interna). Web e broker têm redes bridge auxiliares separadas para o bind de loopback; o site não participa da rede do banco. Portas 80/443 presentes nos metadados da imagem Caddy não significam publicação no host.

Imagens base fixadas por digest; tags das imagens da aplicação correspondem à release. Backend e web rodam sem root, sem capabilities, com filesystem somente leitura e armazenamento temporário explícito. Foi removida da imagem web a capability do binário Caddy destinada a portas privilegiadas: usamos 8080. Todos os serviços usam `unless-stopped` e logs rotacionados. Healthcheck do backend verifica HTTP e uma consulta ao banco; o do broker verifica o listener, não a ingestão completa. O fluxo MQTT precisa do teste funcional adicional.

## Preparar e atualizar

Use uma release extraída de `git archive` em `/opt/cattle-tracker/releases/<commit>`, com as dependências e Docker preparados. Pré-requisitos: [banco](database-container.md), [broker](broker-container.md) e `.env` privado em `shared`, root 0600, diretório root 0700. Nunca substitua segredos existentes nem use seed de demonstração.

Na release, prepare a conta exclusiva de leitura para backup e as credenciais administrativas:

```bash
bash infra/production/prepare-backup.sh
docker run --rm --network none --user 0 \
  -v /opt/cattle-tracker/shared:/state \
  -v "$PWD/infra/production/prepare-admin.mjs:/prepare-admin.mjs:ro" \
  node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c \
  node /prepare-admin.mjs admin@cattletracker.tech
export RELEASE_TAG=<commit-da-release>
dc() { docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/internal.yml "$@"; }
dc config --quiet
dc build backend web
```

O banco precisa estar ativo antes de `prepare-backup.sh`. A conta `cattle_backup` herda `pg_read_all_data`: lê inclusive schemas auxiliares do PostGIS, sem superusuário, escrita, criação de bancos/papéis ou bypass de RLS. Esta concessão supõe cluster exclusivo do projeto; não reutilize em um cluster de outros clientes. A senha independente é acrescentada ao `.env`; reexecuções não rotacionam valores. Futuras tabelas com RLS exigem rever o plano de backup.

Antes de migrations, faça backup do banco atual; depois aplique migrations e crie o administrador:

```bash
dc run --rm --no-deps -T backup once
dc run --rm --no-deps -T backend node dist/db/migrate.js
dc run --rm --no-deps -T backend node create-admin.mjs < /opt/cattle-tracker/shared/admin.json
dc up -d --no-deps --wait backend web backup
```

`create-admin.mjs` não imprime a senha nem altera uma conta existente. `admin.json` contém uma senha aleatória e fica root 0600, exclusivamente na VPS. O e-mail é identificador de login; não há envio/recuperação de senha por e-mail. A migração cria estruturas legadas de animais/cercas/regras, mas não cria animais, propriedades ou dados de exemplo e não amplia a interface de bancada.

Somente após validar a release, atualize `/opt/cattle-tracker/current` para ela e registre seu commit em `shared/deployed-release`. O helper `compose-private.sh` resolve esse symlink e define a tag de imagem. Não execute `down -v`, `volume prune` ou `--remove-orphans`; os serviços iniciais foram implantados em etapas e seus volumes são os mesmos. Para voltar o código, preserve a release/imagens anteriores e verifique compatibilidade com o esquema antes de alterar `current`.

## Acompanhar e acessar de forma privada

```bash
docker ps
docker stats --no-stream
docker logs --tail 30 cattle-tracker-backend-1
docker logs --tail 20 cattle-tracker-backup-1
curl -fsS http://127.0.0.1:8080/healthz
sh /opt/cattle-tracker/current/infra/production/compose-private.sh ps
```

Evite `docker inspect` completo ou `docker compose config` sem `--quiet`: o ambiente dos containers contém credenciais. Não cole `admin.json`, `.env` ou `gateway-access.json` em logs/chats/issues.

Para usar a interface sem expor portas públicas, faça um túnel SSH no computador: encaminhamento local **8080 → 127.0.0.1:8080 da VPS**. Com OpenSSH já configurado, a forma é `ssh -N -L 127.0.0.1:8080:127.0.0.1:8080 root@<IP-da-VPS>`; com PuTTY/Plink use sua chave, host key verificada e o mesmo encaminhamento. OpenSSH não lê uma chave `.ppk` diretamente. Acesse `http://localhost:8080` no navegador, preservando exatamente esse host/porta: esta build usa `http://localhost:8080` e `ws://localhost:8080/ws`. O túnel protege o trecho pela internet; não publique HTTP sem TLS. Um túnel no computador não conecta automaticamente o ESP32 ao broker.

## Backup e recuperação

O container executa uma cópia ao iniciar e repete a cada 24 horas após sucesso; em falha tenta novamente em uma hora. Não há timer systemd nesta etapa. O healthcheck fica não saudável em falha ou se a última cópia tem mais de 26 horas. Não há alerta externo automático, cópia externa ou expurgo automático: acompanhe saúde e espaço em disco. Volume não é backup; backup na mesma VPS não protege contra perda da VPS.

Cada pasta `/opt/cattle-tracker/backups/<UTC>` completa contém `database.dump`, `config.tar.gz`, `SHA256SUMS` e `COMPLETE`. Diretórios 0700, arquivos privados 0600. Sem `COMPLETE`, a tentativa é incompleta e não deve ser usada. `config.tar.gz` contém segredos em texto claro dentro do arquivo comprimido: nunca disponibilize publicamente; exportação futura requer criptografia e destino privado. A cópia do banco é um snapshot consistente do `pg_dump`; não há coordenação transacional entre o banco e os arquivos de configuração. Faça rotação/deploy fora da janela de backup ou gere nova cópia ao concluir.

A cópia contém banco/configuração, não mensagens/sessões persistentes do volume Mosquitto, imagens Docker ou firmware. O histórico de medições fica no banco; reconstrução dos serviços usa código versionado e os digests. O broker não promete recuperação de mensagens em trânsito.

Para gerar uma cópia manual:

```bash
sh /opt/cattle-tracker/current/infra/production/compose-private.sh run --rm --no-deps -T backup once
```

Restaure somente um backup confiável em **outro banco vazio**, nunca sobre `cattle_tracker` sem plano e autorização próprios. Confira `SHA256SUMS`; use `createdb -U postgres -O cattle_tracker -T template0 <banco-de-teste>` dentro do container e alimente `pg_restore -U postgres -d <banco-de-teste> --exit-on-error` com o dump. A restauração administrativa também recria extensões. Compare tabelas, registros, geometrias, migrations e sequências antes de remover exclusivamente o banco temporário. A [documentação de pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html) detalha opções e riscos de arquivos não confiáveis.

`verify-restore.mjs` compara as 15 tabelas da aplicação/Drizzle, todos seus registros e sequências entre origem e banco restaurado; recusa nomes fora de `cattle_restore_check_<14 dígitos>`. O ensaio espera duas medições sintéticas e deve ocorrer sem alterações concorrentes. A configuração privada foi extraída em diretório temporário e comparada byte a byte, sem imprimir conteúdo.

## Validação de bancada

`verify-internal.mjs` requer `ALLOW_BENCH_VALIDATION=yes`, credenciais montadas somente leitura em `/run/admin.json` e `/run/gateway-access.json`, pasta privada `/validation` e ambiente de backend. Execute com a imagem backend, montando o script em `/app/backend/verify-internal.mjs` para resolver suas dependências. O modo `exercise` recusa uma base com dispositivos/gateways existentes; cria um gateway e um brinco sintéticos, faz testes e deixa a fixture somente para o ensaio de backup/recriação. O modo `verify-clean` reconfirma os dados, remove os registros sintéticos por UUID/identidade exatos e mantém o administrador. Não execute contra dispositivos reais ou com medições concorrentes.

O provisionamento nesse teste simula a confirmação de hardware por API: **não comprova gravação USB/NVS, GNSS, LoRa ou gateway físico**.

## Limite para a próxima etapa

Não há publicação em `cattletracker.tech`, certificado TLS ou listener público HTTP/HTTPS. Para publicar será necessário configurar a build com URLs HTTPS/WSS, CORS, proxy e certificados, revisar DNS, abrir somente as portas planejadas e testar autenticação/tempo real pelo domínio. Banco e MQTT não devem ganhar portas públicas como consequência.

O ambiente é de validação do MVP, não certificação geral de produção. Permanecem as demandas de identidade do gateway (#14), atomicidade/recuperação da ingestão (#10), horário/deduplicação e reconexão de WebSocket (#16). Contas manager/viewer e dados de outros clientes não foram liberados por esta implantação. A imagem completa do firmware USB não acompanha o site; dispositivos pré-gravados e gravação física exigem ensaio próprio. Tiles do mapa dependem do provedor externo e da conexão do navegador.

## Evidência — 2026-09-28

Ambiente: VPS Ubuntu 24.04, Docker 29.8.1/Compose 5.5.1. Release de backend/web/backup **`5ce106121e76`**, em `/opt/cattle-tracker/releases/5ce106121e76`, apontada por `current`. Banco e broker preservam as releases anteriores (`da9679b4dfe5` e `8d769178c1d6`) e seus volumes. Node 22.23.3 e Caddy 2.11.4, fixados por digest. Não houve alteração de firewall/DNS, certificado emitido ou reinício da VPS.

Resultados comprovados:

- 22 testes unitários de backend e 9 de frontend passaram; ambos os builds locais e Docker concluídos. Auditoria npm das dependências de produção sem vulnerabilidades reportadas na consulta. As dependências de desenvolvimento ainda tiveram avisos moderados durante o build; não foi feita atualização forçada. Bundle do mapa mantém aviso de tamanho.
- Backup pré-migrations criado em arquivo privado antes da primeira alteração. Banco estava sem tabelas de negócio; cinco migrations aplicadas e segunda execução bem-sucedida sem duplicação.
- Administrador `admin@cattletracker.tech` criado sem seed; login válido passou, senha incorreta e consultas sem autenticação recusadas. Reexecução do preparo preservou o arquivo privado byte a byte.
- Site respondeu por proxy privado; rota SPA `/map`, bundle JS, URLs internas e 404 para asset inexistente verificados via HTTP. Não foi feita inspeção visual em navegador nesta etapa.
- API criou gateway/brinco sintéticos sem animais, repetiu reserva idempotente, recusou prova divergente e concluiu configuração/confirmacão simuladas. Sem placa ou USB conectados.
- MQTT → backend → PostGIS → WebSocket autenticado passou. Também passaram ingestão HTTP autenticada, rejeição de coordenada inválida, consulta do mapa com a posição final e heartbeat do gateway. WebSocket anônimo encerrado com 4401.
- Snapshot `20260928T151659Z` restaurado em banco separado; 15 tabelas públicas/Drizzle, todos seus registros e sequências conferiram, incluindo duas posições sintéticas. Configuração privada extraída separadamente e comparada byte a byte. Banco e cópia temporária do ensaio removidos após confirmação.
- Backend/web recriados com novos IDs; login, mapa e posições persistiram. Dispositivo, gateway, sessões e medições sintéticas foram removidos da base ativa; backups históricos do ensaio foram preservados e não são a base operacional.
- Backup automático em container iniciou e concluiu novo snapshot limpo `20260928T151742Z`, após a limpeza. Lock, checksums, marcador `COMPLETE` e healthcheck utilizados. Ainda não decorreram 24 horas para comprovar uma segunda execução agendada; execução inicial e manual foram verificadas.
- Conferência final às **15:20 UTC / 12:20 America/Sao_Paulo**: cinco containers saudáveis; 1 usuário, 0 dispositivos, 0 gateways, 0 posições, 0 animais e 5 migrations. Contas da aplicação/backup sem privilégios administrativos.
- Sem portas publicadas para banco/API/backup; web somente `127.0.0.1:8080`, MQTT somente `127.0.0.1:1883`. Redes de dados e aplicação internas. UFW somente SSH em IPv4/IPv6. Do Windows, TCP 22 acessível e tentativas a 80/443/1883/3000/5432/8080 sem conexão no limite de 3 segundos por espera.
- Aproximadamente 44 GB livres em disco e 3,1 GiB de memória disponível na conferência final. Credenciais root 0600, diretórios privados 0700; nenhuma senha foi copiada ao Git ou ao computador.

Problemas encontrados e corrigidos durante a implantação: capability desnecessária no binário Caddy impedia execução com `cap_drop ALL`; a conta da aplicação não podia copiar schemas auxiliares do PostGIS, resolvido com conta separada de backup somente leitura. Tentativas incompletas de backup permanecem privadas e sem `COMPLETE`.
