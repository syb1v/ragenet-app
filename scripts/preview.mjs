import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173';
const executablePath =
  process.env.CHROMIUM_PATH ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;
const outputDir = path.resolve('screenshots');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
});
const page = await context.newPage();
const errors = [];

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(outputDir, 'onboarding.png') });

await page.getByText('Посмотреть демо').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outputDir, 'home.png') });

const sphere = page.getByTestId('particle-sphere');
const box = await sphere.boundingBox();
if (!box) throw new Error('RageNet sphere not found');

// Hold while moving inside the sphere: charge and connect after 8 seconds.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 14, { steps: 10 });
await page.waitForTimeout(320);
await page.screenshot({ path: path.join(outputDir, 'playing.png') });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(outputDir, 'charging.png') });
await page.waitForTimeout(5100);
await page.mouse.up();
await page.waitForTimeout(4200);
const dragHoldConnected = await page.getByText('Подключено', { exact: true }).isVisible();
await page.screenshot({ path: path.join(outputDir, 'connected.png') });

// Hold while moving inside the sphere: disconnect after the long charge.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 34, box.y + box.height / 2 + 18, { steps: 8 });
await page.waitForTimeout(8400);
await page.mouse.up();
await page.waitForTimeout(4200);
const dragHoldDisconnected = await page.getByText('Отключено', { exact: true }).isVisible();

// A clear tap connects.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(80);
await page.mouse.up();
await page.waitForTimeout(220);
await page.screenshot({ path: path.join(outputDir, 'reaction.png') });
await page.waitForTimeout(1600);
const tapConnected = await page.getByText('Подключено', { exact: true }).isVisible();

// A stationary hold charges, then disconnects after the long charge.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(8400);
await page.mouse.up();
await page.waitForTimeout(4200);
const holdDisconnected = await page.getByText('Отключено', { exact: true }).isVisible();

await page.getByLabel('Меню подписки').click();
await page.waitForTimeout(450);
await page.screenshot({ path: path.join(outputDir, 'subscription-menu.png') });

await page.getByText('Показать QR-код', { exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outputDir, 'qr.png') });
await page.getByLabel('Закрыть QR-код').click();
await page.waitForTimeout(300);

await page.getByLabel('Настройки').click();
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(outputDir, 'settings.png') });

await page.getByLabel('Закрыть настройки').click();
await page.waitForTimeout(400);
await page.getByLabel('Добавить ключ').click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outputDir, 'add-key.png') });

await page.getByText('Отмена', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByLabel('Выбрать сервер').click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outputDir, 'servers.png') });

await page.getByLabel('Закрыть выбор сервера').click();
await page.waitForTimeout(300);
await page.getByLabel('Меню подписки').click();
await page.waitForTimeout(300);
await page.getByText('Удалить подписку', { exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outputDir, 'delete.png') });

await page.getByRole('button', { name: 'Удалить подписку' }).click();
await page.waitForTimeout(600);
const deleted = await page.getByText('Добро пожаловать', { exact: true }).isVisible();
await page.screenshot({ path: path.join(outputDir, 'after-delete.png') });

// Reload the demo and verify press-and-hold from the disconnected state.
await page.getByText('Посмотреть демо').click();
await page.waitForTimeout(1000);
const holdBox = await page.getByTestId('particle-sphere').boundingBox();
if (!holdBox) throw new Error('RageNet sphere not found after demo reload');
await page.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2);
await page.mouse.down();
await page.waitForTimeout(8400);
await page.mouse.up();
await page.waitForTimeout(4200);
const holdConnected = await page.getByText('Подключено', { exact: true }).isVisible();

await browser.close();

console.log(
  JSON.stringify(
    {
      dragHoldConnected,
      dragHoldDisconnected,
      tapConnected,
      holdDisconnected,
      deleted,
      holdConnected,
      errors,
    },
    null,
    2,
  ),
);

if (
  !dragHoldConnected ||
  !dragHoldDisconnected ||
  !tapConnected ||
  !holdDisconnected ||
  !deleted ||
  !holdConnected ||
  errors.length > 0
) {
  process.exitCode = 1;
}
