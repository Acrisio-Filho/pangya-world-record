// Optional browser smoke test. Requires Playwright and a running local mock server.
// PWR_BROWSER_URL must point to the mock server, never production.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const base = process.env.PWR_BROWSER_URL || 'http://localhost:8080/pangya-world-record/';
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use the local mock server for this test.');
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('button', { name: 'Buscar ↗', exact: true }).waitFor();
    await page.getByRole('searchbox').fill('nonexistent-player-xyz');
    await page.getByRole('button', { name: 'Buscar ↗', exact: true }).click();
    await page.getByRole('heading', { name: 'O próximo recorde pode ser seu' }).waitFor();
    await page.getByRole('button', { name: 'Ver todas as categorias' }).click();
    await page.getByRole('button', { name: 'Buscar ↗', exact: true }).waitFor();
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: '/tmp/pwr-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: '/tmp/pwr-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile overflow');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByRole('heading', { name: 'Bom te ver de novo.' }).waitFor();
    await page.goto(base + '#/submit-record');
    await page.waitForURL(/login\?redirect=/);
    await page.reload();
    await page.getByRole('heading', { name: 'Bom te ver de novo.' }).waitFor();
    await page.getByLabel('Email', { exact: true }).fill('admin@test.com');
    await page.getByLabel('Senha', { exact: true }).fill('admin123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('heading', { name: 'Meus records', exact: true }).waitFor();
    assert.ok(page.url().endsWith('#/submit-record'), 'login returns to requested route');
    await page.goto(base + '#/admin');
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.ok(page.url().endsWith('#/admin'), 'admin route authorized');
    await page.goto(base + '#/community');
    await page.getByRole('heading', { name: 'Comunidade', exact: true }).waitFor();
    await page.goto(base + '#/profile?me=1');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.goto(base + '#/register');
    await page.getByRole('heading', { name: 'Entre para o jogo.' }).waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/tmp/pwr-register.png', fullPage: true });
    await page.route('**/exec?**', route => {
      if (new URL(route.request().url()).searchParams.get('action') === 'listRecords') return route.fulfill({ status: 503, body: '{}' });
      return route.continue();
    });
    await page.goto(base);
    await page.getByRole('heading', { name: 'Não foi possível carregar o ranking' }).waitFor();
    await page.unroute('**/exec?**');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByRole('button', { name: 'Buscar ↗', exact: true }).waitFor();
    assert.equal(await page.getByRole('alert').count(), 0, 'retry clears error');
    assert.deepEqual(errors, [], 'no unhandled JavaScript errors');
    console.log('Browser OK: desktop, mobile, filters, empty state, login redirect, admin, community, profile, registration, network failure and retry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
