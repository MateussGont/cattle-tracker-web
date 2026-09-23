-- Executado somente na inicialização de um volume vazio, depois do PostGIS.
-- A senha vem do ambiente; não é passada em argumentos nem gravada no código.
\getenv app_password POSTGRES_APP_PASSWORD
CREATE ROLE cattle_tracker WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
ALTER DATABASE cattle_tracker OWNER TO cattle_tracker;
\connect cattle_tracker
GRANT USAGE, CREATE ON SCHEMA public TO cattle_tracker;
\unset app_password
