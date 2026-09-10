-- Runs once before drizzle migrations. PostGIS must exist before any
-- geometry/geography column can be created by the generated migrations.
CREATE EXTENSION IF NOT EXISTS postgis;
