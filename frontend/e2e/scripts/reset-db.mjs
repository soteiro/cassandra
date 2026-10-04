// Borra y recrea la base de datos e2e. El backend aplica las migraciones al arrancar.
import { execFileSync } from 'node:child_process';
import { adminDatabaseUrl, e2eDatabaseName } from '../support/env.mjs';

const dbName = e2eDatabaseName();

// Protección: nunca tocar una base de datos que no sea de e2e.
if (!/^[a-z0-9_]+_e2e$/.test(dbName)) {
  console.error(`Nombre de base de datos no permitido para e2e: "${dbName}" (debe terminar en _e2e)`);
  process.exit(1);
}

const psql = (sql) =>
  execFileSync('psql', [adminDatabaseUrl(), '-v', 'ON_ERROR_STOP=1', '-qc', sql], { stdio: 'inherit' });

psql(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
psql(`CREATE DATABASE ${dbName}`);
console.log(`Base de datos ${dbName} recreada`);
