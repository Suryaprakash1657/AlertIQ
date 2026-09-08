import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getClient, closePool, testConnection } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");

/**
 * Initializes the database by creating migration tracking and applying pending SQL migrations.
 */
async function initializeDatabase() {
  console.log("===============================================================");
  console.log("   AlertIQ Module 3.24 — PostgreSQL Database Initialization    ");
  console.log("===============================================================\n");

  // Step 1: Probe Database Connection
  console.log("[1/4] Probing PostgreSQL connectivity...");
  const connStatus = await testConnection();
  if (!connStatus.ok) {
    console.error(`  ✖ Database connection failed to ${connStatus.host}:${connStatus.port}/${connStatus.database}`);
    console.error(`    Error: ${connStatus.error}`);
    console.error("\nPlease check your PostgreSQL service and environment variables in .env.");
    process.exit(1);
  }
  console.log(`  ✓ Successfully connected to PostgreSQL (${connStatus.host}:${connStatus.port}/${connStatus.database})`);

  let client;
  try {
    client = await getClient();

    // Step 2: Ensure schema_migrations table exists
    console.log("\n[2/4] Ensuring schema_migrations tracking table exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("  ✓ schema_migrations table is ready");

    // Step 3: Fetch applied migrations
    const appliedResult = await client.query("SELECT version FROM schema_migrations ORDER BY version ASC;");
    const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));

    // Step 4: Read migration files
    console.log("\n[3/4] Discovering migration scripts in database/migrations/...");
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new Error(`Migrations directory not found at: ${MIGRATIONS_DIR}`);
    }

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (migrationFiles.length === 0) {
      console.log("  ⚠ No migration files found.");
    } else {
      console.log(`  Found ${migrationFiles.length} migration file(s):`);
      migrationFiles.forEach((file) => {
        const isApplied = appliedVersions.has(file.split("_")[0]);
        console.log(`    - ${file} [${isApplied ? "ALREADY APPLIED" : "PENDING"}]`);
      });
    }

    console.log("\n[4/4] Applying pending migrations...");
    let appliedCount = 0;

    for (const file of migrationFiles) {
      const version = file.split("_")[0];
      if (appliedVersions.has(version)) {
        continue;
      }

      console.log(`  Applying ${file}...`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf8");

      await client.query("BEGIN;");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, filename, applied_at) VALUES ($1, $2, NOW());",
          [version, file]
        );
        await client.query("COMMIT;");
        console.log(`  ✓ Successfully applied and recorded: ${file}`);
        appliedCount++;
      } catch (migrationErr) {
        await client.query("ROLLBACK;");
        console.error(`  ✖ Failed executing migration ${file}:`, migrationErr.message);
        throw migrationErr;
      }
    }

    console.log(`\n===============================================================`);
    if (appliedCount > 0) {
      console.log(`✔ Database initialization successful: ${appliedCount} migration(s) applied.`);
    } else {
      console.log(`✔ Database is up to date: 0 migrations needed.`);
    }
    console.log("===============================================================");
  } catch (error) {
    console.error("\n✖ Database initialization encountered a fatal error:", error.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    await closePool();
  }
}

initializeDatabase();
