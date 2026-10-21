# PostgreSQL pelo DBeaver via VPN

Implementação da [issue #30](https://github.com/MateussGont/cattle-tracker-web/issues/30). Pré-requisito: stack privada/pública e rede `cattle-tracker_private` existentes. Não substitui nem recria a aplicação. Depende da infraestrutura das PRs [#27](https://github.com/MateussGont/cattle-tracker-web/pull/27) e [#29](https://github.com/MateussGont/cattle-tracker-web/pull/29).

## Desenho e limites

Windows com WireGuard → UDP51820 → container `cattle-access-vpn` → proxy TCP na interface privada → PostgreSQL interno. A porta 5432 não é publicada no host. O gateway físico permanece no MQTT TLS; não utiliza esta VPN.

- Servidor VPN/banco: `10.203.77.1`; perfis individuais `10.203.77.2` e `.3`.
- O cliente recebe apenas a rota `10.203.77.1/32`, sem DNS e sem rota padrão. Outra VPN pode impor restrições próprias; coexistência precisa ser testada sem alterar a VPN corporativa.
- Namespace próprio, somente `NET_ADMIN`, sem modo privilegiado, rede do host, socket Docker ou montagem de módulos do kernel. Kernel do host precisa oferecer WireGuard.
- Encaminhamento IPv4 desabilitado e política FORWARD DROP. INPUT aceita somente WireGuard externo, TCP5432 destinado ao IP VPN, loopback e respostas. Não dá acesso a SSH, demais containers, internet ou outro cliente.
- O proxy resolve `postgres` pelo DNS Docker em cada conexão. WireGuard cifra o trecho entre computador e VPS; PostgreSQL usa SCRAM e tráfego interno da VPS não usa TLS adicional. Não marcar SSL obrigatório no DBeaver neste desenho.
- Usuários `ct_mateus` e `ct_colaborador` têm SELECT apenas em `public.devices`, `public.gateways`, `public.locations`. Sem superusuário, DDL, escrita, leitura de `users` ou concessão automática a tabelas futuras. Limites: 5 conexões, consulta 30s, transação ociosa 60s. `default_transaction_read_only` é defesa auxiliar; as ACLs são o controle de escrita.
- Contas permitem consultar todos os registros dessas tabelas, não isolamento por propriedade. São acessos administrativos de diagnóstico, não contas de cliente final.
- Nome `colaborador` representa um único segundo usuário, não conta compartilhada entre várias pessoas. Só entregar após identificar o destinatário.

## Preparação reproduzível na VPS

Antes de executar: backup do banco/configuração; confirmar ausência de conflito com `10.203.77.0/24`, UDP51820 livre, contas não existentes, rede privada correta e kernel com módulo WireGuard. A versão Alpine é fixada por digest; pacotes são obtidos do repositório Alpine3.22 durante o build. Guardar a imagem/release e atualizar dependências em manutenção planejada.

1. Publicar fonte revisada em `/opt/cattle-tracker/releases/<commit>`, mantendo arquivos sensíveis fora do checkout.
2. Construir a imagem usando `VPN_RELEASE=<commit> docker compose -f infra/production/vpn/compose.yml build` dentro da release.
3. Criar `/opt/cattle-tracker/shared/vpn` com permissão 0700. Inicializar uma única vez:

```sh
docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges:true \
  --read-only --tmpfs /tmp \
  -v /opt/cattle-tracker/shared/vpn:/state \
  --entrypoint python3 cattle-access:<commit> /app/init.py
```

4. Aplicar `apply-roles.sql` por stdin no `psql -X -q -v ON_ERROR_STOP=1 -U postgres -d cattle_tracker` dentro do container PostgreSQL. Não exibir o arquivo, usar shell trace nem gravar saída de erro com SQL/segredos em logs compartilhados. Aplicação é transacional; não reexecutar o gerador sobre diretório existente. Interrupção requer inspeção de roles/arquivos antes de continuar, nunca regeneração cega.
5. Carregar módulo `wireguard` no host; liberar UDP51820 no firewall do host e, se utilizado, no firewall do provedor. Não liberar TCP5432. A publicação Docker pode contornar regras UFW; a restrição de tráfego VPN está também dentro do container.
6. Apontar `/opt/cattle-tracker/vpn` para a release e usar `sh /opt/cattle-tracker/vpn/infra/production/compose-vpn.sh up -d --wait`.
7. Testar handshake, autenticação, recusas de acesso, reinício do container e saúde dos serviços existentes. Teste em container na VPS não comprova conectividade do Windows pela internet.

O inicializador guarda servidor e clientes em diretórios separados. O serviço monta somente `server/`, nunca senhas de banco/perfis dos clientes. Credenciais aleatórias, PSK individual e verificador SCRAM gerados sem impressão. Distribuição dos arquivos por SSH autenticado, armazenamento local fora de Git e OneDrive, ACL somente usuário/SYSTEM/Administradores.

## Windows e DBeaver

1. Instalar [WireGuard oficial](https://www.wireguard.com/install/); a instalação/importação pode exigir administrador do Windows.
2. Importar somente `cattle-mateus.conf` (ou o perfil do colaborador) e ativar.
3. Criar conexão **PostgreSQL**, não SQL Server, no DBeaver:

| Campo | Valor |
| --- | --- |
| Host | `10.203.77.1` |
| Porta | `5432` |
| Banco | `cattle_tracker` |
| Usuário | `ct_mateus` ou `ct_colaborador` |
| Senha | arquivo privado `database-<pessoa>.json` |
| SSH | desabilitado; a VPN fornece o caminho privado |
| SSL PostgreSQL | desabilitado neste desenho; túnel WireGuard ativo obrigatório |

```sql
SELECT current_user, current_database();
SELECT count(*) FROM public.devices;
SELECT count(*) FROM public.gateways;
SELECT count(*) FROM public.locations;
```

As senhas são distintas das credenciais do site, SSH e MQTT. Não enviar perfis, senhas ou QR codes em issue/chat público. Não compartilhar o perfil pessoal. Desconectar a VPN deve tornar `10.203.77.1:5432` inacessível.

## Operação, revogação e rollback

- Status: `sh /opt/cattle-tracker/vpn/infra/production/compose-vpn.sh ps`. Healthcheck confere WireGuard, firewall/encaminhamento, listener e PostgreSQL; não comprova handshake de cada cliente.
- Diagnóstico de conexão: `wg show wg0 latest-handshakes` dentro do container (não usar `showconf` ou `dump`, que podem revelar chaves). Evitar publicar IPs dos clientes em logs compartilhados.
- Revogar uma pessoa: remover seu bloco `[Peer]` de `server/wg0.conf` e aplicar `wg syncconf wg0 /configuration/wg0.conf` dentro do container; executar `ALTER ROLE ct_<pessoa> NOLOGIN` e encerrar sessões existentes desse usuário via `pg_terminate_backend`. Remover somente o peer correspondente, nunca regenerar o servidor para revogar um cliente.
- Revogar só a VPN não encerra necessariamente sessões TCP já estabelecidas no PostgreSQL: revogar ambos os controles e terminar sessões.
- Rollback do serviço: `compose-vpn.sh down` (sem `-v`); fechar UDP51820 no firewall e desabilitar as duas roles. Não altera containers/volumes da aplicação nem remove dados. Preservar segredos para recuperação controlada.
- Backup diário existente inclui `shared/vpn`; backup local não é cópia externa. Restore do banco não restaura roles automaticamente: reaplicar SQL de roles privado numa instância nova, revisar permissões e testar restauração antes de declarar recuperação validada.
- Se um perfil/arquivo de senha vazar, revogar e emitir novo par de credenciais. Não usar chave ou senha compartilhada entre pessoas.

Referências: [WireGuard quick start](https://www.wireguard.com/quickstart/), [namespaces](https://www.wireguard.com/netns/), [PostgreSQL GRANT](https://www.postgresql.org/docs/16/sql-grant.html), [firewall Docker](https://docs.docker.com/engine/network/firewall-iptables/).

## Evidência

Em 2026-10-21, sobre a implementação inicial `ad1c25d`, VPS Ubuntu24.04/Docker Compose5.5.1:

- Backup prévio `20261021T213038Z`; configuração privada criada com arquivos 0600 e diretórios 0700, sem imprimir segredos.
- Build Alpine3.22 e validação Compose/shell/Python aprovados. Container VPN saudável.
- `verify.py` executado em clientes descartáveis com namespace separado, usando os dois perfis: handshake WireGuard e autenticação SCRAM aprovados; SELECT nas três tabelas permitido.
- Senha inválida, SELECT em `users`, DELETE/UPDATE e DDL recusados. Testes de escrita usam transação explícita READ WRITE e rollback, comprovando ACL independentemente do default read-only.
- Cliente alterado propositalmente para anunciar rotas mais amplas continuou sem acesso a SSH/HTTP da VPN e SSH da bridge privada. Segundo cliente com listener TCP5432 real também permaneceu inacessível a partir do primeiro.
- TCP5432 público não respondeu a partir do Windows, em IPv4 e IPv6. Isso é evidência adicional, não substitui inspeção de bindings/firewall.
- Perfil do proprietário transferido por SSH para pasta privada em `%LOCALAPPDATA%\CattleTracker\vpn`, fora de OneDrive e Git. ACL de diretório restrita ao proprietário, SYSTEM e Administradores. Perfil do colaborador não entregue.

Os clientes de teste estavam dentro da VPS, alcançando o endpoint público pelo próprio host. **Não comprovam travessia da internet a partir do Windows**. A instalação WireGuard1.1.1 foi detectada no computador; importação, ativação e consulta no DBeaver ainda precisam de validação assistida. Nenhum teste físico do gateway integra esta entrega.

Para repetir `verify.py`, montar o script em `/verify.py` e somente o diretório privado de clientes em `/clients:ro`, em container efêmero da imagem VPN com `NET_ADMIN`, rede `cattle-access_edge`, rootfs somente leitura e `/tmp` em tmpfs. Executar `python3 /verify.py mateus` ou `colaborador`. Não rodar com o mesmo perfil ativo no computador, pois WireGuard atualiza o endpoint do peer. O modo `colaborador listen` mantém listener de isolamento por até 120s; `CHECK_PEER=1` exige iniciar e conferir esse listener antes do teste do proprietário.
