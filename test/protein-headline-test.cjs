const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = { window: {} };
vm.runInNewContext(read('popup/variants.js'), context);
const config = JSON.parse(JSON.stringify(context.window.LL_POPUP_CONFIG));
const control = config.variants.find(variant => variant.id === 'C');
const headlines = [
  'Eat More Protein Without Complicated Meals',
  'Get Your High-Protein Week Planned Without the Daily Guesswork',
  'Get Your High-Protein Week Planned in Seconds'
];

function comparable(variant) {
  const copy = structuredClone(variant);
  for (const key of ['id', 'name', 'trafficSplit', 'headline', 'headlineHtml', 'trackingVersion',
    'trackingFingerprint', 'trackingStartedAt', 'trackingSources', 'trackingLabel', 'trackingLabelManual']) delete copy[key];
  delete copy.proteinQuiz.leadHeadline;
  delete copy.flowSteps[0].headlineHtml;
  return copy;
}

assert.equal(control.trackingVersion, '9/14/2026 · female-results-oriented-ponytail');
assert.equal(control.trackingStartedAt, '2026-09-14T17:34:10.638Z');
config.variants.forEach((variant, index) => {
  assert.equal(variant.headline, headlines[index]);
  assert.equal(variant.flowSteps[0].headlineHtml, headlines[index]);
  assert.equal(variant.proteinQuiz.leadHeadline, headlines[index]);
  assert.deepEqual(comparable(variant), comparable(control), 'Only headline and tracking metadata differ');
  assert.equal(JSON.parse(variant.trackingFingerprint).headline, headlines[index]);
  if (variant.id !== 'C') {
    assert.notEqual(variant.trackingVersion, control.trackingVersion);
    assert.deepEqual(variant.trackingSources, [], 'Challengers do not inherit control statistics');
  }
});

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [1280, 390, 320]) {
      for (const variant of config.variants) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
          if (route.request().url().endsWith('mockup-female-results-oriented-ponytail.jpg')) {
            return route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(root, 'popup/assets/uploads/mockup-female-results-oriented-ponytail.jpg')) });
          }
          return route.fulfill({ contentType: 'text/html', body: '<html><body>Preview test</body></html>' });
        });
        await page.goto('http://protein.test/');
        await page.addStyleTag({ content: read('popup/popup.css') });
        await page.evaluate(({ config, variant }) => {
          navigator.sendBeacon = () => true;
          window.LL_POPUP_CONFIG = { ...config, triggers: { delayMs: 1 }, variants: [{ ...variant, trafficSplit: 100 }] };
        }, { config, variant });
        await page.addScriptTag({ content: read('popup/popup.js') });
        await page.locator('.ll-popup-root').waitFor();
        await page.waitForFunction(() => document.querySelector('.ll-popup-image').naturalWidth > 0);
        assert.equal(await page.locator('.ll-popup-headline').textContent(), variant.headline);
        assert.equal(await page.locator('.ll-popup-root input[type=email]').count(), 1);
        assert.equal(await page.getByRole('button', { name: 'Build My Free Plan', exact: true }).count(), 1);
        const box = await page.locator('.ll-popup-modal').boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width + 1, 'Popup fits viewport');
        const headlineBox = await page.locator('.ll-popup-headline').boundingBox();
        assert(headlineBox.x >= box.x && headlineBox.x + headlineBox.width <= box.x + box.width + 1);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(root, 'outputs', `protein-headline-${variant.id}-${width}.png`) });
        await page.close();
      }
    }
    const report = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await report.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'script.google.com') return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, schemaVersion: 3, groups: [
          { testId: config.testId, variant: 'A', version: '7/25/2026 #2', sessions: 100, leads: 5 },
          { testId: config.testId, variant: 'B', version: '9/14/2026 · female-results-oriented', sessions: 100, leads: 5 },
          { testId: config.testId, variant: 'C', version: control.trackingVersion, sessions: 100, leads: 5 }
        ] })
      });
      if (url.pathname.endsWith('mockup-female-results-oriented-ponytail.jpg')) return route.fulfill({
        contentType: 'image/jpeg', body: fs.readFileSync(path.join(root, 'popup/assets/uploads/mockup-female-results-oriented-ponytail.jpg'))
      });
      if (url.hostname !== 'studio.test') return route.fulfill({ body: '' });
      let relative = url.pathname.slice(1);
      if (relative.endsWith('/')) relative += 'index.html';
      const file = path.join(root, relative);
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
    });
    await report.goto('http://studio.test/share-report/?campaign=high-protein');
    await report.locator('#report-status.is-ready').waitFor();
    const stats = await report.locator('.variant-report-stats').allTextContents();
    assert.equal(stats.length, 3);
    assert(!stats[0].includes('100'), 'Old A history must not transfer into the new A');
    assert(!stats[1].includes('100'), 'Old B history must not transfer into the new B');
    assert(stats[2].includes('100') && stats[2].includes('5.0%'), 'C retains its existing history');
    for (const headline of headlines) assert.equal(await report.getByRole('heading', { name: headline, exact: true }).count(), 1);
    await report.screenshot({ path: path.join(root, 'outputs', 'protein-headline-pulse.png'), fullPage: true });
    await report.close();
    console.log('Protein headline test passed: matching designs, fresh challenger identities, preserved C, desktop/mobile rendering and Pulse history isolation.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
