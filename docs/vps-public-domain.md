# Domínio público do MVP

Continuidade da [issue #25](https://github.com/MateussGont/cattle-tracker-web/issues/25) e do [PR #27](https://github.com/MateussGont/cattle-tracker-web/pull/27), após a [validação privada](vps-internal-stack.md). Publicação autorizada pelo responsável em 2026-09-28. Ambiente de validação de bancada, não aceite do hardware ou da operação multi-cliente.

## Acesso e fronteira pública

- Site: **https://cattletracker.tech**. HTTP e `www` redirecionam para o domínio principal com HTTPS.
- API: `https://cattletracker.tech/api/...`; as rotas de negócio exigem autenticação.
- Tempo real: `wss://cattletracker.tech/ws`, com JWT; conexão anônima recusada.
- Login inicial: `admin@cattletracker.tech`. Senha preservada em `shared/admin.json`, root 0600, somente na VPS. Não há envio de senha por e-mail.
- MQTT continua privado (`mosquitto:1883` e loopback da VPS). Publicar o site **não** configura TLS no firmware nem conecta o gateway físico automaticamente.

| Porta no host | Exposição |
| --- | --- |
| 22/TCP | SSH por chave, administração |
| 80/TCP | Caddy: redirecionamento e desafio de certificado |
| 443/TCP | Caddy: HTTPS e WSS |
| 1883/TCP | Apenas `127.0.0.1`, broker |
| 3000/5432 | Não publicadas, API/banco em redes Docker internas |
| 8080/8081/8443/2019 | Não publicadas diretamente no host |

Dentro do container, Caddy usa 8080/8443, mapeadas explicitamente às portas públicas 80/443 em IPv4 e IPv6. Assim roda como UID 1000, sem capabilities, filesystem somente leitura. O healthcheck utiliza 8081 no loopback do container; administração Caddy desabilitada. HTTP/3/UDP não foi habilitado. As portas declaradas pela imagem base em `docker ps` não implicam publicação.

`public.yml` reutiliza os serviços de `internal.yml`, substitui o site e ajusta CORS para o domínio HTTPS. A API continua sem `ports`. Caddy substitui os cabeçalhos de encaminhamento pelo IP/protocolo da conexão real; Fastify confia em exatamente um salto apenas nesta configuração (`TRUST_PROXY_HOPS=1`, padrão 0). Isso permite rate limiting por origem, sem aceitar uma cadeia forjada pelo navegador. Não habilite essa confiança em uma API diretamente exposta.

TLS é gerenciado pelo [HTTPS automático do Caddy](https://caddyserver.com/docs/automatic-https). Os volumes `cattle-tracker_caddy_data` e `cattle-tracker_caddy_config` persistem o estado, são graváveis somente pelo usuário do servidor web e não devem ser apagados. O encaminhamento para portas internas segue as [opções oficiais de portas](https://caddyserver.com/docs/caddyfile/options). HSTS inicial de um dia, sem preload ou includeSubDomains. Renovação é automática, mas ainda requer acompanhar validade e falhas.

Sem access log no proxy; filtro global remove URI e cabeçalhos de credenciais dos registros estruturados de erro. O backend silencia logs da rota WebSocket porque o JWT é enviado na query. Não habilite logging irrestrito dessas URLs ou de corpos/headers de autenticação.

## Operação

Release pública operacional: **`cb41393fbf54`**, em `/opt/cattle-tracker/releases/cb41393fbf54`; `current` aponta para ela. `shared/deployed-release` contém o commit e `shared/deployment-mode` contém `public`. Use o helper público, não o privado nem o rascunho `compose.yml`:

```bash
sh /opt/cattle-tracker/current/infra/production/compose-public.sh ps
docker logs --tail 30 cattle-tracker-web-1
docker logs --tail 30 cattle-tracker-backend-1
docker logs --tail 10 cattle-tracker-backup-1
curl -fsS https://cattletracker.tech/healthz
sh /opt/cattle-tracker/current/infra/production/compose-public.sh run --rm --no-deps -T backup once
```

Não use `docker compose config` sem `--quiet` nem inspeção integral do ambiente: ambos podem revelar segredos. Evite copiar `admin.json` ou `.env` para o computador/OneDrive.

Para preparar uma nova release, extraia o código versionado, defina `RELEASE_TAG` com o commit, use `public.yml`, valide `config --quiet`, construa `backend web` e valide o Caddyfile com `run --rm --no-deps -T web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`. Faça backup antes da atualização/migration. Atualize somente os serviços necessários e valide TLS, login e WSS antes de apontar `current` para a nova release. Não remova volumes nem serviços órfãos durante essa transição. Mudanças de `APP_DOMAIN` exigem rebuild do frontend, além de DNS/CORS/proxy coerentes.

Em outra VPS, prepare primeiro banco, broker, credenciais e backup conforme o runbook privado. Antes do primeiro uso, inicialize a propriedade dos diretórios raiz dos volumes Caddy para UID/GID 1000, modo 0700; confirme que são volumes novos ou a identidade correta, sem sobrescrever certificados. DNS A/AAAA deve corresponder às interfaces da máquina. Abra apenas 80/443 TCP além do SSH, e teste também o firewall do provedor. Não publique o Compose privado por engano.

Para retornar à etapa privada, a release `5ce106121e76` e suas imagens foram preservadas: em janela combinada, inicie **somente backend/web** pelo `internal.yml` daquela release, com a tag correspondente; verifique `127.0.0.1:8080`, remova as permissões públicas 80/443, atualize `current` e os marcadores da implantação. Banco e broker não precisam ser recriados. HSTS pode permanecer no navegador até expirar; o acesso privado usa localhost. Não restaure o banco para reverter apenas proxy/frontend.

## Evidências — 2026-09-28

- DNS A e AAAA conferem com a VPS e `www` é CNAME do domínio raiz. Não foi necessário alterar registros.
- Backup anterior à publicação: `20260928T213941Z`; backup posterior: `20260928T214238Z`. Credenciais administrativas e de serviços preservadas. Não houve migration, seed ou modificação de dados de negócio nesta etapa.
- 24 testes de backend passaram (incluindo dois novos testes de confiança no proxy), build TypeScript e builds Docker concluídos. As 9 verificações de frontend da etapa anterior continuam registradas; a build pública usa URLs HTTPS/WSS, sem localhost.
- Certificado confiável de Let's Encrypt para `cattletracker.tech`, validade observada até **2026-12-27**; emissão para `www` também comprovada por requisição TLS válida. Renovação futura não foi simulada.
- Cliente Windows externo: HTTPS 200, HTTP 308 para HTTPS, `www` HTTPS 301 para domínio principal; headers HSTS/nosniff/frame protection presentes. Sem ignorar validação de certificado.
- Requisições IPv4 e IPv6 feitas na VPS ao domínio retornaram `healthz` 200.
- Cliente temporário na rede de saída da VPS, pelo domínio público: login válido, API autenticada, consultas anônimas recusadas, senha errada recusada e CORS verificado. WebSocket WSS autenticado completou ping/pong e anônimo foi encerrado com 4401.
- Rota SPA `/map`, asset JavaScript com URLs HTTPS/WSS e asset inexistente 404 comprovados. A validação não equivale a ensaio visual de todas as telas ou hardware físico.
- Cabeçalho `X-Forwarded-For` sintético enviado pelo cliente não foi tratado como IP real pela API. A política de um salto foi testada também sem proxy para manter o padrão fechado.
- Cinco containers saudáveis. Banco/broker preservaram suas releases e não foram reiniciados; backend/site/backup atualizados. Portas internas 1883/3000/5432/8080/8081/8443/2019 sem conexão no teste externo a partir do Windows; UFW só permite 22/80/443 TCP em IPv4/IPv6.

`verify-public.mjs` é uma verificação somente leitura: rode com a imagem backend em uma rede com saída, montando a credencial administrativa em `/run/admin.json` e o script em `/app/backend/verify-public.mjs`. Ele usa exclusivamente o domínio do projeto e não imprime senhas/tokens. Não monte essas credenciais no container web.

## Limites preservados

Backups continuam locais, sem cópia externa/alertas/expurgo; o backup de configuração não inclui as chaves/certificados dos volumes Caddy. Eles sobrevivem à recriação local, mas uma recuperação completa em outra VPS precisará preservá-los por cópia privada separada ou emitir novos certificados. O backup não contém mensagens MQTT em trânsito. A renovação futura e a próxima execução diária ainda precisam ser observadas na operação.

Publicação não resolve as issues de identidade por gateway, ingestão atômica, horários/deduplicação, reconexão WebSocket ou autorização multi-cliente. Somente a conta administrativa do MVP foi preparada. Firmware USB completo e gateway físico permanecem sujeitos a validação própria. O Project deve manter esta entrega em validação até o responsável aceitar o acesso e o fluxo esperado.
