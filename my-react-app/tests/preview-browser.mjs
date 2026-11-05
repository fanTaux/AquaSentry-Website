// Uses an already installed Playwright and Microsoft Edge; never downloads a browser.
// npm run build
// npm run test:browser -- "<path-to-playwright>/index.mjs"
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preview } from 'vite';
import { OrthographicCamera, Vector3 } from 'three';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightModule = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : 'playwright';
const { chromium } = await import(playwrightModule);
const artifacts = resolve(root, 'tests/artifacts');
await mkdir(artifacts, { recursive: true });

const server = await preview({ root, configFile: false, preview: { host: '127.0.0.1', port: 0, open: false } });
const address = server.httpServer.address();
const baseURL = `http://127.0.0.1:${address.port}`;
let browser;

async function prepareContext(options = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const mutations = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseURL) return route.continue();
    if (url.origin === 'http://localhost:8000') {
      const method = route.request().method();
      if (!['GET', 'OPTIONS'].includes(method)) mutations.push(`${method} ${url.pathname}`);
      let body = { ok: true, data: [] };
      if (url.pathname === '/api/auth/login') {
        body = { ok: true, token: 'local-test-session', user: { name: 'Preview Tester', role: 'operator' } };
      } else if (url.pathname === '/api/telemetry/latest') {
        body = { ok: true, is_esp_online: true, is_testing: false, device_status: 'standby', history_count: 0, ai_prediction: 'Low', data: { tds_ppm: 140, turbidity_ntu: 90, timestamp: Date.now() } };
      } else if (url.pathname === '/api/wifi/config') {
        body = { ok: true, data: { ssid: 'Test Network', ip: '192.0.2.1', rssi: -55 } };
      }
      return route.fulfill({ json: body, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    // Block fonts, maps, and all other external resources during local tests.
    return route.abort();
  });
  return { context, mutations };
}

async function ready(page) {
  await page.getByText('Model 3D interaktif', { exact: true }).waitFor({ timeout: 30000 });
  assert.equal(await page.locator('canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2');
    return Boolean(gl && !gl.isContextLost());
  }), true);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function login(page) {
  await page.getByRole('button', { name: 'Masuk Ke Sistem' }).click();
  await page.getByRole('heading', { name: 'Di balik AquaSentry.' }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('button').count(), 4);
  assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).getAttribute('aria-pressed'), 'true');
  await ready(page);
}

async function assertNoOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Page must not overflow horizontally');
}

async function pageStyles(page) {
  return page.evaluate(() => ['body', 'header', 'main h1', 'nav button'].map((selector) => {
    const style = getComputedStyle(document.querySelector(selector));
    return Object.fromEntries(['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'margin', 'padding', 'color', 'backgroundColor', 'borderRadius'].map((key) => [key, style[key]]));
  }));
}

try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1440, height: 1100 } }],
    ['mobile', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }],
    ['mobile-landscape', { viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true }],
  ]) {
    const { context, mutations } = await prepareContext(options);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    const modules = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => modules.push(request.url()));
    await page.goto(baseURL);
    await page.getByRole('button', { name: 'Masuk Ke Sistem' }).waitFor();
    assert.equal(await page.getByRole('navigation').count(), 0);
    assert.equal(modules.some((url) => /\/(?:Viewer|PreviewPage)-[^/]+\.(?:js|css)$/.test(url)), false, '3D must not load before login');
    await login(page);
    await assertNoOverflow(page);
    assert.equal(await page.locator('.component-row').count(), 12);
    assert.equal(await page.locator('header').count(), 1, 'Use only the main website header');

    if (name === 'desktop') {
      const canvas = page.locator('canvas');
      const bounds = await canvas.boundingBox();
      const camera = new OrthographicCamera(-bounds.width / 2, bounds.width / 2, bounds.height / 2, -bounds.height / 2, 0.1, 100);
      camera.position.set(10, 9, 13);
      camera.zoom = Math.min(bounds.width / 12.5, bounds.height / 8.4);
      camera.lookAt(-0.65, 1.65, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const point = new Vector3(0, 1.15 + 3.35 * 0.82 + 0.1, -0.48).project(camera);
      await canvas.click({ position: { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 } });
      assert.equal(await page.locator('.part-detail h3').innerText(), 'Tutup casing');
      const before = await canvas.screenshot();
      await page.getByRole('region', { name: /^Model 3D interaktif\./ }).focus();
      await page.keyboard.press('ArrowRight');
      const after = await canvas.screenshot();
      assert.equal(before.equals(after), false, 'Keyboard rotation must change the model');
      await page.keyboard.press('Home');
    }

    await page.getByRole('button', { name: 'Terakit', exact: true }).click();
    assert.equal(await page.getByRole('slider', { name: 'Jarak antarkomponen' }).inputValue(), '0');
    await page.getByRole('button', { name: 'Exploded', exact: true }).click();
    assert.equal(await page.getByRole('slider').inputValue(), '100');
    await page.getByRole('slider').fill('45');
    await page.getByRole('button', { name: 'Pilih ESP32', exact: true }).click();
    assert.equal(await page.locator('.part-detail h3').innerText(), 'ESP32');
    await page.getByRole('button', { name: 'Fokus ke komponen' }).click();
    await page.getByRole('button', { name: 'Sembunyikan ESP32', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Fokus ke komponen' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Tampilkan semua', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Fokus ke komponen' }).isEnabled(), true);
    await page.getByRole('button', { name: 'Tutup informasi komponen' }).click();
    for (const label of ['Atas', 'Depan', 'Perspektif', 'Perbesar model', 'Perkecil model', 'Putar model ke kiri', 'Putar model ke kanan', 'Reset kamera']) {
      await page.getByRole('button', { name: label, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Sensor', exact: true }).click();
    assert.equal(await page.locator('.component-row').count(), 2);
    await page.getByRole('button', { name: 'Semua', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Cari komponen' }).fill('ESP32');
    assert.equal(await page.locator('.component-row').count(), 1);
    await page.getByRole('searchbox').fill('tidak ada');
    await page.getByText('Komponen tidak ditemukan', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Hapus filter' }).click();
    assert.equal(await page.locator('.component-row').count(), 12);
    await page.getByRole('button', { name: 'Label komponen', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.model-label').length === 12);
    await page.getByRole('button', { name: 'Label komponen', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.model-label').length === 0);
    await page.getByRole('button', { name: 'Panduan', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Cara menggunakan', exact: true }).click();
    await page.getByRole('button', { name: 'Mulai menjelajah' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Exploded', exact: true }).click();
    await assertNoOverflow(page);
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.category-tabs').scrollLeft = 0; });
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({ path: resolve(artifacts, `${name}-preview.png`), fullPage: true });

    await page.getByRole('button', { name: 'Buka Monitoring' }).click();
    await page.getByRole('heading', { name: 'AquaSentry Device', exact: true }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0, 'Leaving Preview must unmount the WebGL canvas');
    assert.equal(await page.getByRole('button', { name: 'Monitoring', exact: true }).getAttribute('aria-pressed'), 'true');
    const styled = await pageStyles(page);
    await page.evaluate(() => { document.querySelector('link[href*="PreviewPage-"]').disabled = true; });
    assert.deepEqual(await pageStyles(page), styled, 'Preview CSS must not change existing pages');
    await page.evaluate(() => { document.querySelector('link[href*="PreviewPage-"]').disabled = false; });
    await page.getByRole('button', { name: 'Peta Lokasi', exact: true }).click();
    await page.locator('.leaflet-container').waitFor();
    await page.getByTitle('Profil Pengguna').click();
    await page.getByRole('heading', { name: 'Profil Saya' }).waitFor();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('heading', { name: 'Pengaturan Jaringan Wi-Fi ESP32' }).waitFor();
    await page.getByRole('button', { name: 'Keluar Akun' }).click();
    await page.getByRole('button', { name: 'Masuk Ke Sistem' }).waitFor();
    assert.equal(await page.locator('.aquasentry-preview').count(), 0);
    await login(page);
    await page.getByRole('button', { name: 'Monitoring', exact: true }).click();
    await page.getByRole('heading', { name: 'AquaSentry Device', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await ready(page);
    assert.equal(await page.getByRole('slider').inputValue(), '82');
    assert.deepEqual(mutations, ['POST /api/auth/login', 'POST /api/auth/login'], 'Preview controls must not issue hardware/API commands');
    assert.deepEqual(errors, [], 'No runtime errors');
    console.log(`PASS ${name}: login gate, four menus, real WebGL, picking/controls, help, CSS isolation, navigation, logout/login, canvas remount`);
    await context.close();
  }

  const { context } = await prepareContext({ viewport: { width: 375, height: 812 } });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Masuk Ke Sistem' }).click();
  await page.getByRole('heading', { name: /Browser ini belum mendukung WebGL|Model 3D belum dapat ditampilkan/ }).waitFor();
  await page.getByRole('button', { name: 'Pilih ESP32', exact: true }).click();
  assert.equal(await page.locator('.part-detail h3').innerText(), 'ESP32');
  assert.equal(await page.getByRole('button', { name: 'Fokus ke komponen' }).isDisabled(), true);
  assert.equal(await page.locator('.camera-tools').count(), 0, 'No unusable camera controls over the fallback');
  await assertNoOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.screenshot({ path: resolve(artifacts, 'mobile-no-webgl.png'), fullPage: true });
  await page.getByRole('button', { name: 'Monitoring', exact: true }).click();
  await page.getByRole('heading', { name: 'AquaSentry Device', exact: true }).waitFor();
  console.log('PASS no WebGL: component information and Monitoring remain accessible');
  await context.close();

  const offline = await prepareContext({ viewport: { width: 320, height: 720 } });
  await offline.context.route('http://localhost:8000/**', (route) => route.abort());
  const offlinePage = await offline.context.newPage();
  const offlineErrors = [];
  offlinePage.on('pageerror', (error) => offlineErrors.push(error.message));
  await offlinePage.goto(baseURL);
  await login(offlinePage);
  await assertNoOverflow(offlinePage);
  await offlinePage.getByRole('button', { name: 'Monitoring', exact: true }).click();
  await offlinePage.getByRole('heading', { name: 'AquaSentry Device', exact: true }).waitFor();
  await offlinePage.getByRole('button', { name: 'Preview', exact: true }).click();
  await ready(offlinePage);
  assert.deepEqual(offlineErrors, []);
  console.log('PASS backend offline, 320px: existing demo login, local 3D, and Monitoring navigation');
  await offline.context.close();
} finally {
  if (browser) await browser.close();
  await new Promise((done, reject) => server.httpServer.close((error) => error ? reject(error) : done()));
}
