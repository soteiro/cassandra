import { expect, test } from '@playwright/test';
import { expectLoggedIn, login } from './support/auth';
import { sql } from './support/db';
import { E2E_USER } from './support/env.mjs';

test.describe('sin sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirige a /login al entrar a una ruta protegida', async ({ page }) => {
    await page.goto('/proyectos');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Cassandra Auth' })).toBeVisible();
  });

  test('muestra un error con credenciales inválidas', async ({ page }) => {
    await login(page, 'e2e@cassandra.test', 'contraseña-incorrecta');
    await expect(page.getByText('Credenciales inválidas', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('inicia sesión y la mantiene al recargar', async ({ page }) => {
    await login(page);
    await expectLoggedIn(page);
    await expect(page.getByText('Bienvenido a Cassandra')).toBeVisible();

    await page.reload();
    await expectLoggedIn(page);
  });

  test('cierra sesión y vuelve a proteger las rutas', async ({ page, isMobile }) => {
    // Sesión propia: el logout borra solo su refresh token, no el de los demás tests.
    await login(page);
    await expectLoggedIn(page);

    if (isMobile) {
      await page.getByRole('button', { name: 'Más opciones' }).click();
    }
    await page.getByRole('button', { name: 'Cerrar Sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);
  });

  // Regresión: users.alias admite NULL y antes impedía iniciar sesión.
  test('inicia sesión con un usuario sin alias', async ({ page }, testInfo) => {
    const email = `sin-alias-${testInfo.project.name}@cassandra.test`;
    sql(
      `INSERT INTO users (nombre, email, password) VALUES ('Sin alias', :'email', :'hash')
       ON CONFLICT (email) DO NOTHING;`,
      { email, hash: E2E_USER.passwordHash },
    );
    await login(page, email);
    await expectLoggedIn(page);
  });
});

test.describe('con sesión', () => {
  test('entra directo a /home', async ({ page }) => {
    await page.goto('/');
    await expectLoggedIn(page);
  });
});
