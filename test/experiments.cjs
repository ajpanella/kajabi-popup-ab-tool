const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../experiments/engine');
const root = path.resolve(__dirname, '..');
const read = name=>fs.readFileSync(path.join(root,name),'utf8');
const context = {window:{}};
vm.runInNewContext(read('popup/variants.js'),context);
const config = engine.clone(context.window.LL_POPUP_CONFIG);
const queue = JSON.parse(read('experiments/queue.json')).items;
const clone = engine.clone;
const now = '2026-10-22T20:00:00.000Z';
function summary(n=700, leads=[3,4,3]) {
  return {schemaVersion:4,testId:config.testId,roundId:config.experiment.id,generatedAt:now,
    groups:config.variants.map((v,i)=>({variant:v.id,version:v.trackingVersion,firstSeen:'2026-10-12T00:00:00.000Z',eligible:n,sessions:n,leads:leads[i],settledEligible:n,settledSessions:n,settledLeads:leads[i]}))};
}
function engineTests() {
  assert.equal(engine.validateRound(config),'');
  config.variants.forEach(v=>assert.equal(engine.fingerprint(v),engine.fingerprint(JSON.parse(v.trackingFingerprint)),'history snapshots match live rendering attributes'));
  assert.equal(engine.evaluate(config,{},null,now).status,'blocked');
  let result=engine.evaluate(config,summary(699),null,now);
  assert.equal(result.looks.length,0);
  result=engine.evaluate(config,summary(),null,now);
  assert.equal(result.status,'continue'); assert.equal(result.looks.length,1);
  const same=engine.evaluate(config,summary(701,[3,30,3]),result,now);
  assert.equal(same.looks.length,1, 'never re-peek at a consumed checkpoint');
  const strong=engine.evaluate(config,summary(700,[3,3,100]),null,now);
  assert.equal(strong.status,'winner-review'); assert.equal(strong.winnerId,'C');
  const noWinner=engine.evaluate(config,summary(),null,'2026-11-12T00:00:00Z');
  assert.equal(noWinner.status,'blocked','stale summaries are not zero conversions');
  const timeout=summary();timeout.generatedAt='2026-11-12T00:00:00Z';
  assert.equal(engine.evaluate(config,timeout,result,timeout.generatedAt).status,'inconclusive');
  const recent=summary();recent.groups.forEach(g=>g.firstSeen='2026-10-21T00:00:00Z');
  assert.equal(engine.evaluate(config,recent,null,now).looks.length,0);
  const uneven=summary();uneven.groups[0].eligible=7000;
  assert.match(engine.evaluate(config,uneven,null,now).reason,/uneven/);
  const drift=clone(config);drift.variants[0].headline='Other';
  assert.match(engine.validateRound(drift),/changed/);
  const timing=clone(config);timing.triggers.delayMs=1;assert.match(engine.validateRound(timing),/Delivery/);
  const invalid=summary();invalid.groups[0].leads=900;assert.match(engine.evaluate(config,invalid,null,now).reason,/validation/);
  const impossible=summary();impossible.groups[0].settledLeads=5;assert.match(engine.evaluate(config,impossible,null,now).reason,/validation/);
  const previous=clone(strong);previous.roundId='old';assert.equal(engine.evaluate(config,summary(),previous,now).looks.length,1);
  const item=queue.find(i=>i.id==='cta-deliverable-01');
  const drafts=engine.prepareDraft(config,'C',item,[]);
  assert.equal(drafts.variants[0].trackingVersion,config.variants[2].trackingVersion);
  assert.equal(engine.fingerprint(drafts.variants[0]),engine.fingerprint(config.variants[2]));
  assert(drafts.variants[0].trackingSources.some(s=>s.variant==='C'));
  assert(!drafts.variants[1].trackingVersion);
  assert.deepEqual(engine.changedFields(drafts.variants[0],drafts.variants[1]).sort(),['buttonText','flowSteps.0.buttonText','proteinQuiz.leadButtonText']);
  assert.throws(()=>engine.prepareDraft(config,'C',item,[drafts.variants[1]]),/identical/);
  const used=clone(config);used.experimentLog=[{nextQueueId:item.id}];assert.throws(()=>engine.prepareDraft(used,'C',item,[]),/already scheduled/);
  assert.throws(()=>engine.prepareDraft(config,'C',queue[0],[]),/assets/);
  assert(engine.interval(0,700,0.005)[1] > 0);assert(engine.interval(700,700,0.005)[0] < 1);
}
function trackerTests() {
  let time=Date.parse('2026-10-12T12:00:00Z');
  class TestDate extends Date {constructor(...args){super(...(args.length?args:[time]));} static now(){return time;}}
  const ctx=vm.createContext({console,Date:TestDate});vm.runInContext(read('server/google-apps-script-protein-tracker.js'),ctx);
  const sheets=new Map();
  ctx.getSupportSheet=(name)=>{if(!sheets.has(name))sheets.set(name,{rows:[],appendRow(row){this.rows.push([...row]);},getLastRow(){return this.rows.length+1;},getSheetValues(row,col,n,w){return this.rows.slice(row-2,row-2+n).map(r=>r.slice(col-1,col-1+w));},getRange(row,col,n,w){return{getValues:()=>this.rows.slice(row-2,row-2+n).map(r=>r.slice(col-1,col-1+w)),setValues:v=>{this.rows[row-2]=[...v[0]];}};}});return sheets.get(name);};
  ctx.findKeyRow=(sheet,key)=>{const i=sheet.rows.findIndex(r=>r[0]===key);return i<0?0:i+2;};
  const event=(eventType,sessionId,round='round-1',variant='A')=>ctx.updateExperimentState({testId:'blog-optin-v1',experimentRoundId:round,variant,configVersion:'v1',eventType,sessionId});
  event('popup_lead_submit','one');event('popup_view','one');event('popup_eligible','one');
  ctx.updateFastTrackingSheets({testId:'blog-optin-v1',experimentRoundId:'round-1',variant:'A',configVersion:'v1',eventType:'popup_eligible',sessionId:'one'},999);
  assert.equal(sheets.size,2,'eligibility tracking must not touch lifetime reporting sheets');
  for(let i=0;i<20;i++){event('popup_view','one');event('popup_lead_submit','one');}
  event('popup_eligible','two');event('popup_view','two');
  event('popup_eligible','one','round-2');event('popup_view','one','round-2');
  let data=ctx.buildExperimentSummary('blog-optin-v1','round-1');
  assert.equal(data.groups[0].sessions,2);assert.equal(data.groups[0].leads,1);assert.equal(data.groups[0].settledSessions,0);
  time+=49*3600000;event('popup_lead_submit','two');
  data=ctx.buildExperimentSummary('blog-optin-v1','round-1');
  assert.equal(data.groups[0].settledSessions,2);assert.equal(data.groups[0].settledLeads,1,'late conversion does not mutate settled cohort');
  assert.equal(ctx.buildExperimentSummary('blog-optin-v1','round-2').groups[0].sessions,1);
  assert.equal(ctx.buildExperimentSummary('anti-inflammatory-youtube-v1','round-1').groups.length,0);
}
async function uiTests() {
  const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];let published=null,failPublish=true,trackingAvailable=true;page.on('pageerror',e=>errors.push(e.message));
    const data=summary(700,[3,3,100]);data.generatedAt=new Date().toISOString();data.groups.forEach(g=>g.firstSeen=config.experiment.startedAt);
    const review={roundId:config.experiment.id,checkedAt:new Date().toISOString(),status:'winner-review',winnerId:'C',reason:'A winner is ready for your review.',looks:[],metrics:data.groups};
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='api.github.com') {
        if(route.request().method()==='PUT') {
          if(failPublish){failPublish=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Simulated retryable publish failure'})});}
          published=Buffer.from(route.request().postDataJSON().content,'base64').toString('utf8');
        }
        return route.fulfill({contentType:'application/json',body:JSON.stringify({sha:'test-sha',commit:{sha:'test-publish'}})});
      }
      if(url.hostname==='raw.githubusercontent.com')return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('round-history.json')?[]:review)});
      if(url.hostname==='script.google.com')return route.fulfill({status:trackingAvailable || url.searchParams.get('mode')==='experiment'?200:503,contentType:'application/json',body:JSON.stringify(url.searchParams.get('mode')==='experiment'?data:{ok:true,schemaVersion:3,fields:[],rows:[],snapshots:{}})});
      if(url.hostname!=='studio.test')return route.fulfill({contentType:'application/javascript',body:'window.Chart=class{destroy(){}};window.lucide={createIcons(){}};'});
      let p=url.pathname.replace(/^\//,'');if(p.endsWith('/'))p+='index.html';const file=path.join(root,p);
      if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
    });
    await page.goto('http://studio.test/dashboard/');
    await page.getByRole('button',{name:'Experiments',exact:true}).click();
    await page.getByText('A winner is ready for your review.',{exact:true}).waitFor();
    assert.equal(await page.locator('.experiment-table tbody tr').count(),3);
    assert.equal(await page.locator('.experiment-queue li').count(),8);
    await page.screenshot({path:path.join(root,'outputs/experiment-workspace.png'),fullPage:true});
    await page.getByText('3. Name the benefit in the button',{exact:false}).click();
    await page.locator('[data-experiment-action="draft:cta-deliverable-01"]').click();
    assert((await page.locator('#experiment-status').textContent()).includes('Draft prepared'));
    const draft=await page.evaluate(()=>window.LLExperimentStudio.getDraft());
    assert.equal(draft.variants[0].trackingVersion,config.variants[2].trackingVersion);
    assert.equal(draft.variants[1].flowSteps[0].buttonText,'Get My Free 7-Day Meal Plan');
    assert.equal(await page.evaluate(()=>window.LLExperimentStudio.getLive().variants[0].headline),config.variants[0].headline);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'outputs/experiment-workspace-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-open-publishing]').click();
    await page.locator('#github-token').fill('mock-token-never-sent');
    await page.evaluate(()=>{const d=window.LLExperimentStudio.getDraft();d.variants[0].headline='Changed control';window.LLExperimentStudio.setDraft(d);});
    await page.locator('#publish-github').click();
    assert.match(await page.locator('#github-publish-status').textContent(),/retained control was edited/);
    assert.equal(published,null,'invalid draft must never reach publishing');
    await page.evaluate(d=>window.LLExperimentStudio.setDraft(d),draft);
    await page.locator('#publish-github').click();
    await page.getByText('Simulated retryable publish failure',{exact:true}).waitFor();
    assert(await page.evaluate(()=>Boolean(window.LLExperimentStudio.getDraft().experimentDraft)));
    await page.reload();
    await page.locator('[data-open-publishing]').click();
    await page.locator('#publish-github').click();
    await page.waitForFunction(()=>document.getElementById('github-publish-status').textContent.includes('Published popup/variants.js'));
    const next={window:{}};vm.runInNewContext(published,next);const nextConfig=clone(next.window.LL_POPUP_CONFIG);
    assert.equal(engine.validateRound(nextConfig),'');
    assert.equal(nextConfig.experiment.controlId,'A');
    assert.equal(nextConfig.variants[0].trackingVersion,config.variants[2].trackingVersion);
    assert(nextConfig.variants[0].trackingSources.some(s=>s.variant==='C'));
    assert.notEqual(nextConfig.variants[1].trackingVersion,config.variants[1].trackingVersion);
    assert.equal(nextConfig.experimentLog.length,(config.experimentLog || []).length + 1,'publish retries must not duplicate the round log');
    assert(!nextConfig.experimentDraft);
    await page.evaluate(c=>{delete c.experiment;localStorage.setItem('ll_popup_dashboard_config_blog-optin-v1',JSON.stringify(c));},config);
    trackingAvailable=false;
    await page.reload();
    assert.equal(await page.evaluate(()=>window.LLExperimentStudio.getDraft().experiment.id),config.experiment.id,'old drafts cannot disable monitoring');
    await page.getByRole('button',{name:'Experiments',exact:true}).click();
    await page.getByText('3. Name the benefit in the button',{exact:false}).click();
    await page.locator('[data-experiment-action="draft:cta-deliverable-01"]').click();
    assert.match(await page.locator('#experiment-status').textContent(),/Historical tracking data has not loaded/);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
}
(async()=>{engineTests();trackerTests();if(process.argv.includes('--ui'))await uiTests();console.log('Experiment tests passed.');})().catch(e=>{console.error(e);process.exitCode=1;});
