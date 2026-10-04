import { expect, Page } from '@playwright/test';
import { E2E_USER } from './env.mjs';

export async function login(page: Page, email = E2E_USER.email, password = E2E_USER.password) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
}

export async function expectLoggedIn(page: Page) {
  await expect(page).toHaveURL(/\/home$/);
}
