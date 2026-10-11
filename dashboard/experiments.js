(function () {
  "use strict";
  var api = window.LLExperimentStudio, engine = window.LLExperiment;
  var content = document.getElementById("experiment-content"), status = document.getElementById("experiment-status");
  var queue = [], report = null, history = [], summary = null, busy = false;
  var remote = "https://raw.githubusercontent.com/ajpanella/kajabi-popup-ab-tool/main/experiments/high-protein-monitor.json";
  function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (s) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]; }); }
  function pct(value) { return (value * 100).toFixed(2) + "%"; }
  function button(action, icon, label, disabled) { return '<button class="studio-secondary-command" type="button" data-experiment-action="' + action + '"' + (disabled ? ' disabled' : '') + '><i data-lucide="' + icon + '"></i> ' + label + '</button>'; }
  async function json(url) {
    var response = await fetch(url, {cache:"no-store",signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error("Could not load experiment data.");
    var reader = response.body.getReader(), chunks = [], bytes = 0;
    while (true) {
      var chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 500000) { await reader.cancel(); throw new Error("Experiment response was unexpectedly large."); }
      chunks.push(chunk.value);
    }
    var text = await new Blob(chunks).text();
    try { return JSON.parse(text); } catch (_) { throw new Error("One-time tracker update required."); }
  }
  async function refresh() {
    if (busy) return; busy = true;
    var config = api.getLive();
    if (config.campaignId !== "high-protein") { status.textContent = "Assisted experiments are currently enabled only for High Protein."; content.innerHTML = ""; busy = false; return; }
    status.textContent = "Loading compact round data...";
    try {
      queue = (await json("../experiments/queue.json")).items;
      report = await json(remote + "?t=" + Date.now()).catch(function () { return null; });
      history = await json(remote.replace("high-protein-monitor.json", "round-history.json") + "?t=" + Date.now()).catch(function () { return []; });
      summary = null;
      if (config.experiment) {
        var url = new URL(config.webhookUrl); url.searchParams.set("mode", "experiment"); url.searchParams.set("testId", config.testId); url.searchParams.set("roundId", config.experiment.id);
        summary = await json(url.href);
        if (summary.schemaVersion !== 4) throw new Error("One-time tracker update required.");
      }
      status.textContent = "Updated " + new Date().toLocaleString();
    } catch (error) { status.textContent = error.message; }
    render(); busy = false;
  }
  function render() {
    var config = api.getLive(), round = config.experiment;
    var current = report && round && report.roundId === round.id && Date.now() - Date.parse(report.checkedAt) < 12 * 3600000 ? report : null;
    var ready = current && ["winner-review", "inconclusive"].indexOf(current.status) >= 0;
    var groups = summary && summary.schemaVersion === 4 && round && summary.roundId === round.id ? summary.groups : [];
    var reason = current ? current.reason : round ? "Waiting for the cloud monitor. Publishing always requires your approval." : "No round is currently being monitored.";
    var html = '<section class="experiment-band"><div class="experiment-summary"><div><strong>Assisted</strong><small>Approval before publishing</small></div><div><strong>700 sessions</strong><small>First checkpoint per challenger</small></div><div><strong>7-28 days</strong><small>Round duration</small></div><div><strong>' + escape(round ? "Control " + round.controlId : "Not started") + '</strong><small>Lifetime totals preserved</small></div></div>';
    html += '<p class="experiment-round-reason' + (current && current.status === "blocked" ? ' experiment-alert' : '') + '">' + escape(reason) + '</p>';
    if (round) html += '<h2>' + escape(round.variable.charAt(0).toUpperCase() + round.variable.slice(1)) + ' test</h2><p>' + escape(round.hypothesis) + '</p><small>' + escape(round.id) + '</small>';
    html += '<div class="experiment-actions">' + button("tracker", "copy", "Copy tracker update") + (round ? button("pause", "pause", "Prepare pause") : button("start", "play", "Prepare current headline round")) + '</div></section>';
    if (round) {
      html += '<section class="experiment-band"><h2>This round</h2><div class="dash-table-wrap"><table class="experiment-table"><thead><tr><th>Variant</th><th>Sessions</th><th>Leads</th><th>CVR</th><th>Settled sessions</th><th>Leads / eligible</th></tr></thead><tbody>';
      round.arms.forEach(function (arm) {
        var g = groups.find(function (row) { return row.variant === arm.id && row.version === arm.version; });
        html += '<tr><td><b>' + arm.id + '</b> ' + escape(arm.label) + '</td><td>' + (g ? g.sessions : '-') + '</td><td>' + (g ? g.leads : '-') + '</td><td>' + (g ? pct(g.sessions ? g.leads / g.sessions : 0) : '-') + '</td><td>' + (g ? g.settledSessions : '-') + '</td><td>' + (g ? pct(g.eligible ? g.leads / g.eligible : 0) : '-') + '</td></tr>';
      });
      html += '</tbody></table></div><p>Decision data: 24-hour attribution; complete UTC cohorts settle within 48 hours. Repeated popup displays count once per session.</p>';
      if (current) html += '<small>Cloud review: ' + escape(new Date(current.checkedAt).toLocaleString()) + '. ' + current.looks.length + ' of 3 checkpoints evaluated.</small>';
      html += '</section>';
    }
    html += '<section class="experiment-band"><h2>Research-backed queue</h2><ol class="experiment-queue">';
    queue.forEach(function (item) {
      var used = (config.experimentLog || []).some(function (log) { return log.queueId === item.id || log.nextQueueId === item.id; }) || round && round.queueId === item.id;
      html += '<li><details><summary>' + item.priority + '. ' + escape(item.title) + '<span>' + escape(used ? "Previously scheduled" : item.status.replace(/-/g, " ")) + '</span></summary><p>' + escape(item.hypothesis) + '</p><p>' + escape(item.evidence) + '</p><p>' + item.sources.map(function (url, i) { return '<a target="_blank" rel="noopener" href="' + escape(url) + '">Source ' + (i + 1) + '</a>'; }).join("") + '</p>';
      if (item.values.length) html += '<p>B: ' + escape(item.values[0]) + ' &middot; C: ' + escape(item.values[1]) + '</p>';
      html += button("draft:" + item.id, "file-pen-line", "Prepare next-round drafts", !ready || item.approvalRequired || used) + '</details></li>';
    });
    html += '</ol></section><section class="experiment-band"><h2>Round decisions</h2>';
    (current && current.looks || []).forEach(function (look) { html += '<p><b>' + look.threshold + '-session checkpoint:</b> ' + escape(look.skipped ? look.reason : look.winnerId ? "Review winner " + look.winnerId : "Inconclusive; control retained") + '</p>'; });
    if (!current || !current.looks.length) html += '<p>No completed checkpoints.</p>';
    html += '</section>';
    if (Array.isArray(history) && history.length) {
      html += '<section class="experiment-band"><h2>Previous rounds</h2><ol class="experiment-queue">';
      history.slice().reverse().forEach(function (past) {
        html += '<li><details><summary>' + escape(past.round && past.round.variable || "Experiment") + '<span>' + escape(past.status) + '</span></summary><p>' + escape(past.round && past.round.hypothesis || past.roundId) + '</p><p>' + escape(past.reason) + '</p>';
        (past.metrics || []).forEach(function (m) { html += '<p><b>' + escape(m.id) + '</b> ' + escape(m.label) + ': ' + m.settledLeads + ' leads / ' + m.settledSessions + ' settled sessions (' + pct(m.settledSessions ? m.settledLeads / m.settledSessions : 0) + ')</p>'; });
        html += '</details></li>';
      });
      html += '</ol></section>';
    }
    content.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }
  content.addEventListener("click", async function (event) {
    var target = event.target.closest("[data-experiment-action]"); if (!target) return;
    var action = target.dataset.experimentAction, config = api.getLive();
    try {
      if (action === "tracker") {
        var response = await fetch("../server/google-apps-script-protein-tracker.js");
        if (!response.ok) throw new Error("Tracker source unavailable.");
        await navigator.clipboard.writeText(await response.text());
        status.textContent = "Tracker copied. In the tracking Sheet: Extensions > Apps Script. Replace the code, Save, then Deploy > Manage deployments > Edit > New version > Deploy. Keep the existing URL; do not rebuild history."; return;
      }
      if (action !== "pause" && api.hasUnsavedChanges()) throw new Error("Reset your existing variant edits before preparing experiment drafts. They have not been overwritten.");
      if (action === "pause") {
        var paused = api.getDraft(); paused.experimentPause = config.experiment.id; delete paused.experiment; delete paused.experimentDraft; api.setDraft(paused);
      } else if (action === "start") {
        var started = api.getDraft(); started.experiment = engine.createRound(started, "C", "headline", "Compare meal simplicity and reduced daily guesswork against the current planned-in-seconds control.", new Date().toISOString()); api.setDraft(started);
      } else if (action.indexOf("draft:") === 0) {
        if (!report || report.roundId !== config.experiment.id || ["winner-review", "inconclusive"].indexOf(report.status) < 0 || Date.now() - Date.parse(report.checkedAt) > 12 * 3600000) throw new Error("A fresh completed cloud review is required.");
        var item = queue.find(function (q) { return q.id === action.slice(6); });
        var history = api.getHistory();
        if (!history.length) throw new Error("Load history before preparing drafts so previous tests can be checked.");
        var draft = engine.prepareDraft(config, report.winnerId || config.experiment.controlId, item, history);
        draft.experimentDraft.decision = report.status;
        api.setDraft(draft);
      }
      status.textContent = "Draft prepared. Review it in Build, then Review & Publish. The live website has not changed.";
    } catch (error) { status.textContent = error.message; }
  });
  document.getElementById("experiment-refresh").addEventListener("click", refresh);
  document.querySelector('[data-workspace-button="experiments"]').addEventListener("click", refresh);
})();
