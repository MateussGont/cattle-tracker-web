# Banco em container — implantação por etapas

Escopo da [issue #25](https://github.com/MateussGont/cattle-tracker-web/issues/25): PostgreSQL 16 com PostGIS 3.5, isolado da internet, volume persistente e configuração reproduzível. Não inicia backend, site, MQTT nem cria tabelas de negócio. O banco sozinho não representa validação do fluxo brinco → mapa.

## Configuração

`infra/production/database.yml` pode ser executado sozinho. O Compose completo em preparação herda esse mesmo serviço via `extends`. Ambos usam o projeto `cattle-tracker`, a rede interna `cattle-tracker_private` e o volume `cattle-tracker_postgres16_data`; ao avançar para o Compose completo, não é necessário copiar o banco.

A imagem Alpine é fixada por digest para replicar exatamente os mesmos binários. Mantém PostgreSQL 16, como no ambiente local, com PostGIS 3.5. A variante Debian inicialmente consultada continha PostgreSQL 16.9; a variante Alpine selecionada contém 16.15, atualização corrente da série na [política de versões do PostgreSQL](https://www.postgresql.org/support/versioning/) consultada em 2026-09-23. O [projeto da imagem PostGIS](https://github.com/postgis/docker-postgis) documenta versões e extensões. Patches futuros exigem atualizar o digest e validar, não ocorrem silenciosamente. Não reutilize diretamente um diretório de dados Debian em Alpine: diferenças de locale/collation exigem planejamento e migração lógica.

Credenciais ficam exclusivamente no `.env` privado da VPS:

- `POSTGRES_ADMIN_PASSWORD`: senha do administrador `postgres`.
- `POSTGRES_PASSWORD`: senha do usuário `cattle_tracker`, usada futuramente pela aplicação.

O usuário da aplicação é dono apenas do banco do projeto; pode aplicar suas migrations, mas não é superusuário e não pode criar outros bancos ou papéis. O PostGIS é instalado pelo processo inicial da imagem, com o administrador. `pg_hba.conf` exige SCRAM-SHA-256 em toda conexão TCP, inclusive loopback; a variável `POSTGRES_HOST_AUTH_METHOD` sozinha não substitui regras locais anteriores criadas pela imagem. A conexão por socket dentro do container é administrativa e exige acesso ao Docker da VPS.

## Preparar outra máquina

1. Instale Docker e Compose e copie os arquivos `database.yml`, `20-app-role.sql` e `pg_hba.conf`, preservando a mesma pasta.
2. Prepare um `.env` com as duas senhas aleatórias distintas. Restrinja o diretório a 0700 e o arquivo a 0600; não use senhas de outra máquina sem uma estratégia explícita de restauração.
3. Na raiz da cópia do repositório, valide e inicie apenas o banco:

```bash
docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/database.yml config --quiet
docker compose --env-file /opt/cattle-tracker/shared/.env -f infra/production/database.yml up -d --wait postgres
```

`up` cria a rede e o volume se ainda não existirem. `-d` mantém o container em segundo plano; `--wait` aguarda o healthcheck. A política `unless-stopped` religa o banco após reinício do host, salvo quando ele foi parado manualmente.

As variáveis de senha e os scripts de inicialização só criam usuários no **primeiro início de um volume vazio**. Alterar o `.env` depois não altera senhas já gravadas no PostgreSQL. Não apague o volume para tentar corrigir uma credencial: use uma rotação planejada.

## Consultas úteis

```bash
docker ps
docker volume ls
docker logs --tail 30 cattle-tracker-postgres-1
docker exec cattle-tracker-postgres-1 pg_isready -U postgres -d cattle_tracker
docker exec cattle-tracker-postgres-1 psql -U postgres -d cattle_tracker -c 'SELECT PostGIS_Version();'
```

`5432/tcp` em `docker ps` descreve uma porta dentro do container. Um mapeamento como `0.0.0.0:5432->5432/tcp` significaria exposição no host; esta configuração não publica essa porta. A futura API acessará `postgres:5432` pela rede privada do Compose.

Volumes persistem se o container for recriado, mas **não são backups**. Para migrar dados a outra VPS, faça dump/restore; copiar apenas o Compose cria um banco novo. Não execute `docker compose down -v` ou `docker volume prune` neste ambiente. Agendamento de backup e restauração serão tratados separadamente.

O comando `docker compose config` sem `--quiet` e a inspeção completa do container podem mostrar senhas interpoladas. Use os comandos de consulta acima para acompanhar sem revelar credenciais.
