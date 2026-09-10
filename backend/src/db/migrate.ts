import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "../config/env.js";

const bootstrapPath = fileURLToPath(new URL("./bootstrap.sql", import.meta.url));

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query(readFileSync(bootstrapPath, "utf8"));

    const { drizzle } = await import("drizzle-orm/node-postgres");
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("Migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
