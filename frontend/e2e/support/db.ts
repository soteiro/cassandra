import { execFileSync } from 'node:child_process';
import { e2eDatabaseUrl } from './env.mjs';

/** Ejecuta SQL contra la base de datos e2e. Los valores van como variables de psql (-v), no interpolados. */
export function sql(query: string, vars: Record<string, string> = {}): string {
  const args = [e2eDatabaseUrl(), '-v', 'ON_ERROR_STOP=1', '-Atq'];
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  return execFileSync('psql', args, { input: query, encoding: 'utf8' }).trim();
}
