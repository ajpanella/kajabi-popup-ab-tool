const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function configTest() {
  const sandbox = {window:{}};
  vm.runInNewContext(read('popup/campaigns/anti-inflammatory.js'), sandbox);
  const config = JSON.parse(JSON.stringify(sandbox.window.LL_POPUP_CONFIG));
  assert.equal(config.testId, 'anti-inflammatory-youtube-v1');
  assert.deepEqual(config.variants.map(v => v.buttonText), [
    'Explore My YouTube Channel', 'Get Simple Tips on YouTube', 'Subscribe on YouTube'
  ]);
  assert.equal(new Set(config.variants.map(v => v.trackingVersion)).size, 3);
  const designs = config.variants.map(v => {
    assert.equal(v.trackingStartedAt, config.publishedAt);
    assert(v.trackingVersion.startsWith('10/8/2026'));
    assert.deepEqual(v.trackingSources, []);
    assert.equal(v.headline, 'Make Anti-Inflammatory Eating Feel Simple');
    assert.equal(v.flowSteps[0].headlineHtml, v.headlineHtml);
    assert.equal(v.flowSteps[0].subheadlineHtml, v.subheadlineHtml);
    assert.equal(v.flowSteps[0].buttonText, v.buttonText);
    assert.equal(v.proteinQuiz.leadButtonText, v.buttonText);
    assert.equal(v.flowSteps[0].destinationUrl, 'https://www.youtube.com/@Longevity_EDU');
    for (const key of ['id','name','trafficSplit','trackingVersion','trackingLabel','buttonText']) delete v[key];
    delete v.flowSteps[0].id;
    delete v.flowSteps[0].buttonText;
    delete v.proteinQuiz.leadButtonText;
    return v;
  });
  assert.deepEqual(designs[0], designs[1], 'A and B differ only in button copy and identity');
  assert.deepEqual(designs[0], designs[2], 'A and C differ only in button copy and identity');
}

async function assertButtonsFit(page, selector) {
  const buttons = await page.locator(selector).evaluateAll(labels => labels.map(label => {
    const box = label.getBoundingClientRect();
    const button = label.parentElement.getBoundingClientRect();
    const text = label.firstElementChild.getBoundingClientRect();
    const icon = label.querySelector('svg').getBoundingClientRect();
    const container = label.closest('.ll-popup-modal, .variant-report-card').getBoundingClientRect();
    return {fits:box.left >= button.left && box.right <= button.right && text.right <= icon.left
        && button.left >= container.left && button.right <= container.right,
      oneLine:text.height <= parseFloat(getComputedStyle(label).lineHeight) + 1,
      visible:icon.width > 0, text:label.textContent};
  }));
  assert(buttons.length > 0);
  for (const button of buttons) assert(button.fits && button.oneLine && button.visible, JSON.stringify(button));
}

function trackerTest() {
  const context = vm.createContext({ console });
  vm.runInContext(read('server/google-apps-script-protein-tracker.js'), context);
  const sheets = new Map();
  context.getSupportSheet = name => {
    if (!sheets.has(name)) sheets.set(name, {
      rows: [],
      appendRow(row) { this.rows.push([...row]); },
      getRange(row, column, height, width) {
        return {
          getValues: () => [Array.from({length:width}, (_,i) => this.rows[row-2][column-1+i] ?? '')],
          setValues: values => { this.rows[row-2] = [...values[0]]; }
        };
      }
    });
    return sheets.get(name);
  };
  context.findKeyRow = (sheet,key) => {
    const index = sheet.rows.findIndex(row => row[0] === key);
    return index < 0 ? 0 : index+2;
  };
  function event(type, session, group='youtube') {
    context.updatePulseState({groupKey:group,pulseSessionId:session,eventType:type,
      timestamp:'2026-09-30T13:00:00.000Z',testId:group,version:'v1',variant:'A',label:'Test',changeNote:''});
  }
  event('popup_view','one'); event('popup_view','one');
  event('popup_cta_click','one'); event('popup_cta_click','one');
  event('popup_cta_click','two'); event('popup_view','two');
  event('popup_view','three');
  event('popup_cta_click','unviewed');
  const row = sheets.get('Popup Pulse Summary').rows[0];
  assert.equal(row[8],3, 'viewers deduplicate by session');
  assert.equal(row[10],0, 'URL clicks never become leads');
  assert.equal(row[12],2, 'clicks deduplicate and require a viewed session, in either event order');
  event('popup_view','protein','protein'); event('popup_lead_submit','protein','protein');
  const protein = sheets.get('Popup Pulse Summary').rows[1];
  assert.equal(protein[10],1); assert.equal(protein[12],0);
}

async function popupTest() {
  const sandbox = {window:{}};
  vm.runInNewContext(read('popup/campaigns/anti-inflammatory.js'), sandbox);
  const config = sandbox.window.LL_POPUP_CONFIG;
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    for (const width of [1280,390,320]) {
      for (const variant of config.variants) {
        const page = await browser.newPage({viewport:{width,height:900}});
        let navigated = false;
        const emitted = [];
        await page.exposeFunction('recordBeacon', body => emitted.push(new URLSearchParams(body).get('eventType')));
        await page.route('**/*', route => {
          if (route.request().url().endsWith('/andrew-inflammation-protocols.png')) return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'popup/assets/uploads/andrew-inflammation-protocols.png'))});
          if (route.request().url() === variant.flowSteps[0].destinationUrl) navigated = true;
          return route.fulfill({status:200,contentType:'text/html',body:'<html><body>Test destination</body></html>'});
        });
        await page.goto('http://popup.test/');
        await page.addStyleTag({content:read('popup/popup.css')});
        await page.evaluate(({config,variant}) => {
          window.events=[];
          navigator.sendBeacon = (url,body) => { window.recordBeacon(String(body)); return true; };
          window.LL_POPUP_CONFIG={...config,campaignEnabled:true,triggers:{delayMs:1},variants:[{...variant,trafficSplit:100}]};
        },{config,variant});
        await page.addScriptTag({content:read('popup/popup.js')});
        await page.locator('.ll-popup-root').waitFor();
        assert.equal(await page.locator('.ll-popup-root input').count(),0);
        assert.equal(await page.locator('.ll-popup-headline').textContent(),variant.headline);
        if (variant.imageUrl) await page.waitForFunction(()=>document.querySelector('.ll-popup-image').naturalWidth > 0);
        const box = await page.locator('.ll-popup-modal').boundingBox();
        assert(box.x>=0 && box.x+box.width<=width+1, 'popup fits horizontally');
        await assertButtonsFit(page, '.ll-popup-root .ll-youtube-button-label');
        await page.screenshot({path:path.join(root,'outputs',`youtube-${variant.id}-${width}.png`)});
        // Prevent navigation after recording it so we can inspect all emitted events.
        await page.route(variant.flowSteps[0].destinationUrl, route => { navigated=true; return route.abort(); });
        await page.getByRole('button',{name:variant.buttonText,exact:true}).click();
        await page.waitForTimeout(100);
        assert(navigated,'CTA navigates to the configured destination');
        assert.deepEqual(emitted,['popup_cta_click'],'URL action emits a click, never a lead or quiz completion');
        await page.close();
      }
    }
  } finally { await browser.close(); }
}

async function reportingTest() {
  const sandbox = {window:{}};
  vm.runInNewContext(read('popup/campaigns/anti-inflammatory.js'), sandbox);
  const config = sandbox.window.LL_POPUP_CONFIG;
  const fields = ['timestamp','testId','configVersion','variant','eventType','sessionId'];
  const rows = config.variants.flatMap(variant => ['popup_view','popup_view','popup_view','popup_cta_click','popup_cta_click'].map((event,index) => [config.publishedAt,config.testId,variant.trackingVersion,variant.id,event,index===2?'second':'first']));
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/andrew-inflammation-protocols.png')) return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'popup/assets/uploads/andrew-inflammation-protocols.png'))});
      if(url.hostname==='script.google.com') {
        const data = url.searchParams.get('mode')==='pulse'
          ? {ok:true,schemaVersion:3,groups:config.variants.map(v=>({testId:config.testId,version:v.trackingVersion,variant:v.id,sessions:2,ctaClicks:1,leads:0,quizCompletions:0,snapshot:v}))}
          : {ok:true,fields,rows,snapshots:{},rowsProcessed:rows.length};
        return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      }
      if(url.hostname!=='studio.test') return route.fulfill({contentType:'application/javascript',body:'window.Chart=class{destroy(){}};window.lucide={createIcons(){}};'});
      let relative=decodeURIComponent(url.pathname).replace(/^\//,''); if(relative.endsWith('/'))relative+='index.html';
      const file=path.join(root,relative);
      if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
    });
    await page.goto('http://studio.test/dashboard/?campaign=anti-inflammatory');
    await page.getByRole('button',{name:'Analyze',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('stat-leads').textContent==='3');
    assert.equal(await page.locator('#stat-close-rate').textContent(),'50.0%');
    assert((await page.locator('#stat-leads').locator('..').textContent()).includes('YouTube clicks'));
    await page.screenshot({path:path.join(root,'outputs','youtube-dashboard.png')});
    await page.goto('http://studio.test/share-report/?campaign=anti-inflammatory');
    await page.waitForFunction(()=>document.querySelector('#report-status.is-ready'));
    assert.equal(await page.locator('.variant-report-stats').count(),3);
    assert.equal(await page.locator('.popup-miniature-input').count(),0);
    assert((await page.locator('.variant-report-stats').first().textContent()).includes('50.0%'));
    assert.deepEqual(await page.locator('.popup-miniature-button').allTextContents(), Array.from(config.variants,v=>v.buttonText));
    await assertButtonsFit(page, '.popup-miniature-button .ll-youtube-button-label');
    await page.screenshot({path:path.join(root,'outputs','youtube-pulse.png')});
    await page.locator('[data-report-preview-mode="mobile"]').click();
    await assertButtonsFit(page, '.popup-miniature-button .ll-youtube-button-label');
    await page.screenshot({path:path.join(root,'outputs','youtube-pulse-mobile.png')});
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
}

(async()=>{configTest();trackerTest();await popupTest();await reportingTest();console.log('External CTA tests passed: isolated button-copy test, deduplication, event delivery, protein regression, desktop/mobile popups, dashboard and Pulse.');})().catch(error=>{console.error(error);process.exitCode=1;});
