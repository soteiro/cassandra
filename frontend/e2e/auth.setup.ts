import { test as setup } from '@playwright/test';
import { E2E_USER } from './support/env.mjs';
import { sql } from './support/db';
import { expectLoggedIn, login } from './support/auth';

export const STORAGE_STATE = 'e2e/.auth/user.json';

setup('crear usuario e2e e iniciar sesión', async ({ page }) => {
  // La tabla users la crean las migraciones del backend al arrancar.
  sql(
    `INSERT INTO users (nombre, alias, email, password) VALUES (:'nombre', :'alias', :'email', :'hash')
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, eliminado = false;`,
    { nombre: E2E_USER.nombre, alias: E2E_USER.alias, email: E2E_USER.email, hash: E2E_USER.passwordHash },
  );

  await login(page);
  await expectLoggedIn(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
