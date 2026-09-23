const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

async function run() {
  const base = process.env.PWR_BROWSER_URL || 'http://localhost:8080/pangya-world-record/';
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local test server.');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('button', { name: 'Buscar ↗', exact: true }).waitFor();
    for (const region of ['header', 'footer']) {
      await page.locator(region).getByRole('link', { name: 'Comunidade', exact: true }).click();
      await page.getByRole('heading', { name: 'Comunidade', exact: true }).waitFor();
      assert.match(page.url(), /#\/community$/);
      await page.locator('header').getByRole('link', { name: 'Ranking', exact: true }).click();
      await page.getByRole('button', { name: 'Buscar ↗', exact: true }).waitFor();
    }
    const course = page.getByRole('combobox', { name: 'Campo', exact: true });
    await course.click();
    await page.getByRole('listbox').waitFor();
    await page.getByRole('option', { name: 'Blue Lagoon', exact: true }).click();
    assert.equal(await page.locator('select').first().inputValue(), 'blue_lagoon');
    await page.getByRole('button', { name: 'Buscar ↗', exact: true }).waitFor();
    await course.press('ArrowDown');
    await course.press('Home');
    await course.press('ArrowDown');
    await course.press('Enter');
    assert.equal(await page.locator('select').first().inputValue(), 'blue_water');
    await course.click();
    await course.press('Escape');
    assert.equal(await page.getByRole('listbox').count(), 0);
    await course.click();
    await page.getByRole('heading', { level: 1 }).click();
    assert.equal(await page.getByRole('listbox').count(), 0);
    await course.click();
    const appearance = await course.evaluate(el => { const s = getComputedStyle(el); return { shadow: s.boxShadow, border: s.borderColor }; });
    assert.equal(appearance.shadow, 'rgb(180, 242, 114) 0px 0px 0px 1px');
    assert.equal(appearance.border, 'rgb(143, 183, 101)');
    await page.screenshot({ path: '/tmp/pwr-dropdown-desktop.png' });
    await course.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await course.click();
    const bounds = await page.getByRole('listbox').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/tmp/pwr-dropdown-mobile.png' });
    await course.press('Escape');

    // Register a session only in this local server, then verify required native form semantics.
    const api = new URL('/exec', base).href;
    const login = await (await page.request.post(api, { data: { action: 'login', email: 'admin@test.com', password: 'admin123' } })).json();
    assert.ok(login.token);
    await page.evaluate(login => { localStorage.setItem('pwr_token', login.token); localStorage.setItem('pwr_user', JSON.stringify(login.user)); }, login);
    await page.goto(base + '#/submit-record');
    await page.reload();
    await page.getByRole('heading', { name: 'Meus records', exact: true }).waitFor();
    const numberInput = page.getByLabel('Força', { exact: true });
    await numberInput.focus();
    const inputAppearance = await numberInput.evaluate(el => {
      const style = getComputedStyle(el);
      return { outline: style.outlineStyle, shadow: style.boxShadow, border: style.borderColor };
    });
    assert.equal(inputAppearance.outline, 'none');
    assert.equal(inputAppearance.shadow, 'rgb(180, 242, 114) 0px 0px 0px 1px');
    assert.equal(inputAppearance.border, 'rgb(143, 183, 101)');
    const requiredSelect = page.locator('select[required]').first();
    assert.equal(await requiredSelect.evaluate(el => el.reportValidity()), false);
    const requiredTrigger = page.getByRole('combobox', { name: 'Campo', exact: true });
    assert.equal(await requiredTrigger.getAttribute('aria-invalid'), 'true');
    await requiredTrigger.click();
    await page.getByRole('option', { name: 'Blue Water', exact: true }).click();
    assert.equal(await requiredSelect.evaluate(el => el.checkValidity()), true);
    await page.goto(base + '#/profile?me=1');
    await page.getByRole('heading', { name: 'Admin', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Salvar perfil', exact: true }).waitFor();

    await page.setViewportSize({ width: 1280, height: 900 });
    const accountMenu = page.locator('header').getByRole('button', { name: 'Admin', exact: true });
    await accountMenu.click();
    await page.getByRole('menu').getByRole('link', { name: 'Perfil', exact: true }).waitFor();
    await page.getByRole('menu').getByRole('button', { name: 'Sair', exact: true }).count();
    await accountMenu.click();

    // Every public and authenticated route must fit a phone viewport without page-level overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['#/', '#/community', '#/login', '#/register', '#/submit-record', '#/profile?me=1', '#/admin', '#/privacy']) {
      await page.goto(base + route);
      await page.locator('main').waitFor();
      await page.waitForFunction(() => document.querySelector('main')?.textContent.trim().length > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `mobile overflow: ${route}`);
    }
    await page.evaluate(() => localStorage.clear());

    // Public community: failure and retry must never leave a blank screen.
    await page.route('**/exec?**', route => {
      if (new URL(route.request().url()).searchParams.get('action') === 'listRecords') return route.fulfill({ status: 503, body: '{}' });
      return route.continue();
    });
    await page.goto(base + '#/community');
    await page.reload();
    await page.getByRole('button', { name: 'Tentar novamente' }).waitFor();
    await page.unroute('**/exec?**');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByText('Sem candidatos no momento.', { exact: true }).waitFor();
    assert.equal(await page.locator('main [role="alert"]').count(), 0);
    assert.deepEqual(errors, []);

    // Stale lazy bundle: simulate a missing Community chunk once, then a new build.
    const fresh = await browser.newPage();
    let intercepted = 0;
    await fresh.route('**/CommunityView-*.js', route => ++intercepted === 1 ? route.abort() : route.continue());
    await fresh.goto(base);
    await fresh.getByRole('navigation').first().getByRole('link', { name: 'Comunidade', exact: true }).click();
    await fresh.getByRole('heading', { name: 'Comunidade', exact: true }).waitFor();
    await fresh.getByText('Sem candidatos no momento.', { exact: true }).waitFor();
    assert.ok(intercepted >= 2, 'missing chunk recovered via one reload');
    console.log('OK: custom dropdown click/keyboard/Escape/outside/mobile/form validation; community error/retry; stale chunk recovery.');
  } finally { await browser.close(); }
}
module.exports = run;
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
