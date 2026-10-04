// Configuración compartida de los tests e2e (Playwright y scripts de base de datos).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Los scripts de pnpm y Playwright se ejecutan desde frontend/.
// (Sin import.meta: Playwright carga la config como CommonJS.)
const backendEnvPath = resolve(process.cwd(), '../backend/.env');

export const E2E_DB_NAME = 'cassandra_e2e';
export const BACKEND_PORT = 18080;
export const FRONTEND_PORT = 4300;
export const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

export const E2E_USER = {
  nombre: 'Usuario E2E',
  // alias no puede ser NULL: el repositorio de usuarios del backend lo lee en un string.
  alias: 'e2e',
  email: 'e2e@cassandra.test',
  password: 'e2e-Cassandra-2026',
  // bcrypt (cost 10) de `password`, generado con golang.org/x/crypto/bcrypt.
  passwordHash: '$2a$10$TyaWbd1JvGM3uwRhDMis0..7XGc9q2EsI1CnC6sFFZM9BLT7vRBaq',
};

function readBackendEnv(key) {
  if (!existsSync(backendEnvPath)) return undefined;
  for (const line of readFileSync(backendEnvPath, 'utf8').split('\n')) {
    const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`));
    if (match) return match[1].replace(/^['"]|['"]$/g, '');
  }
  return undefined;
}

function withDatabase(url, dbName) {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

/**
 * URL de la base de datos e2e. En CI se pasa E2E_DATABASE_URL; en local se deriva
 * del DATABASE_URL_LOCAL de backend/.env cambiando el nombre de la base de datos.
 */
export function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const local = readBackendEnv('DATABASE_URL_LOCAL');
  if (!local) {
    throw new Error('Define E2E_DATABASE_URL o DATABASE_URL_LOCAL en backend/.env');
  }
  return withDatabase(local, E2E_DB_NAME);
}

/** URL al mismo servidor, pero a la base de datos de mantenimiento `postgres`. */
export function adminDatabaseUrl() {
  return withDatabase(e2eDatabaseUrl(), 'postgres');
}

export function e2eDatabaseName() {
  return new URL(e2eDatabaseUrl()).pathname.slice(1);
}
