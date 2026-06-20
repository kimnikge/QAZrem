/**
 * Frontend E2E дымовые тесты — критический путь пользователя.
 *
 * Запуск: npx playwright test (из корня проекта)
 * Требуется: запущенный backend (npm run dev:api) или dev-сервер
 */

import { test, expect } from '@playwright/test';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'MISTIK-XXX';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Detka0300304345';

test.describe('Авторизация и навигация', () => {

  test('страница логина загружается', async ({ page }) => {
    await page.goto('/');
    // Должна быть форма логина
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /войти/i })).toBeVisible();
  });

  test('вход с админскими учётными данными', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').first().fill(ADMIN_LOGIN);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();

    // После входа — редирект на дашборд
    await expect(page).toHaveURL(/\/?$/, { timeout: 10000 });
    await expect(page.locator('text=Заказы').first()).toBeVisible({ timeout: 10000 });
  });

  test('навигация: вкладки переключаются', async ({ page }) => {
    // Логин
    await page.goto('/');
    await page.locator('input[type="text"]').first().fill(ADMIN_LOGIN);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/?$/, { timeout: 10000 });

    // Переход на страницу финансов
    await page.locator('a[href="/finance"]').click();
    await page.waitForURL(/\/finance/, { timeout: 5000 });
    await expect(page.locator('h2')).toContainText('Финансы');
  });
});

test.describe('Работа с заказами', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').first().fill(ADMIN_LOGIN);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/?$/, { timeout: 10000 });
  });

  test('отображается список заказов', async ({ page }) => {
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
  });

  test('кнопка "Новый заказ" открывает форму', async ({ page }) => {
    await page.locator('a[href="/create-order"]').first().click();
    await page.waitForURL(/\/create-order/, { timeout: 5000 });
    await expect(page.locator('h2')).toContainText('Новый заказ');
  });
});

test.describe('Кассы (Finance → Кассы)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="text"]').first().fill(ADMIN_LOGIN);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /войти/i }).click();
    await page.waitForURL(/\/?$/, { timeout: 10000 });

    // Переход через клик по ссылке в сайдбаре (SPA-навигация)
    await page.locator('a[href="/finance"]').click();
    await page.waitForURL(/\/finance/, { timeout: 10000 });
    await expect(page.locator('h2')).toContainText('Финансы', { timeout: 10000 });
  });

  test('вкладка "Кассы" отображает список касс', async ({ page }) => {
    await page.locator('.ro-tab', { hasText: 'Кассы' }).click();
    await expect(page.locator('text=Наличные')).toBeVisible({ timeout: 5000 });
  });

  test('кнопка "Приход" открывает модальное окно', async ({ page }) => {
    await page.locator('.ro-tab', { hasText: 'Кассы' }).click();
    await expect(page.locator('text=Наличные')).toBeVisible({ timeout: 5000 });

    await page.locator('button[title="Приход"]').click();
    await expect(page.locator('text=Приход в кассу')).toBeVisible({ timeout: 3000 });
  });

  test('кнопка "Расход" открывает модальное окно', async ({ page }) => {
    await page.locator('.ro-tab', { hasText: 'Кассы' }).click();
    await expect(page.locator('text=Наличные')).toBeVisible({ timeout: 5000 });

    await page.locator('button[title="Расход"]').click();
    await expect(page.locator('text=Расход из кассы')).toBeVisible({ timeout: 3000 });
  });
});
