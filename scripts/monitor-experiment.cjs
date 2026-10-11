const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const engine = require('../experiments/engine');
const root = path.resolve(__dirname, '..');
function readConfig() {
  const source = fs.readFileSync(path.join(root, 'popup/variants.js'), 'utf8');
  return JSON.parse(source.match(/window\.LL_POPUP_CONFIG\s*=\s*([\s\S]*);\s*\}\)\(\);\s*$/)[1]);
}
async function main() {
  const config = readConfig();
  const file = path.join(root, 'experiments/high-protein-monitor.json');
  const historyFile = path.join(root, 'experiments/round-history.json');
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (previous.roundId && previous.roundId !== (config.experiment?.id || '')) {
    const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : [];
    const retained = history.filter(item => item.roundId !== previous.roundId);
    retained.push({...previous, archivedAt:new Date().toISOString()});
    fs.writeFileSync(historyFile, JSON.stringify(retained, null, 2) + '\n');
  }
  let result;
  try {
    if (!config.experiment) throw new Error('No active assisted round. Live variants have not been changed.');
    const url = new URL(config.webhookUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'script.google.com') throw new Error('Unapproved tracking endpoint.');
    url.searchParams.set('mode', 'experiment'); url.searchParams.set('testId', config.testId);
    url.searchParams.set('roundId', config.experiment.id);
    const response = await fetch(url, {signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error('Tracking endpoint returned ' + response.status);
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 100000) { await reader.cancel(); throw new Error('Round response exceeded the compact-data limit.'); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    let summary;
    try { summary = JSON.parse(body); } catch { throw new Error('The tracker needs its one-time round-summary update.'); }
    result = engine.evaluate(config, summary, previous, new Date().toISOString());
  } catch (error) {
    result = {schemaVersion:1,roundId:config.experiment?.id || '',checkedAt:new Date().toISOString(),status:'blocked',reason:error.message,
      looks:previous.roundId === config.experiment?.id ? previous.looks || [] : [],metrics:[]};
  }
  if (config.experiment) {
    const {id, startedAt, controlId, variable, hypothesis, queueId, policy, arms} = config.experiment;
    result.round = {id, startedAt, controlId, variable, hypothesis, queueId, policy,
      arms:arms.map(({id, version, label, trafficSplit})=>({id, version, label, trafficSplit}))};
  }
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  const significant = ['winner-review','inconclusive','blocked'].includes(result.status) || result.looks.length > (previous.looks || []).length;
  const changed = result.roundId !== previous.roundId || result.status !== previous.status || result.reason !== previous.reason || result.looks.length !== (previous.looks || []).length;
  if (process.env.GITHUB_REPOSITORY && process.env.GH_TOKEN && significant && changed) {
    const title = 'Protein experiment review';
    const body = ['## ' + result.status, result.reason, 'Round: ' + result.roundId,
      'No variants were published automatically.', '[Open the studio](https://ajpanella.github.io/kajabi-popup-ab-tool/dashboard/)',
      '| Variant | Settled sessions | Settled leads |', '|---|---:|---:|',
      ...(result.metrics || []).map(m=>'| '+m.id+' | '+m.settledSessions+' | '+m.settledLeads+' |')].join('\n\n');
    const issues = JSON.parse(execFileSync('gh',['issue','list','--repo',process.env.GITHUB_REPOSITORY,'--state','open','--search',title+' in:title','--json','number,title'],{encoding:'utf8'}));
    const issue = issues.find(i=>i.title === title);
    execFileSync('gh',issue ? ['issue','comment',String(issue.number),'--repo',process.env.GITHUB_REPOSITORY,'--body',body]
      : ['issue','create','--repo',process.env.GITHUB_REPOSITORY,'--title',title,'--body',body],{stdio:'inherit'});
  }
  console.log(result.status + ': ' + result.reason);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
