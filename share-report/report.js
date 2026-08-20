(function () {
  "use strict";

  var config = null;
  var currentMetricAccumulators = {};
  var summarizedCurrentMetrics = {};
  var historyGroups = {};
  var processedRows = 0;
  var compactPayloadBytes = 0;
  var usingCompactSummary = false;
  var els = {
    status: document.getElementById("report-status"),
    updated: document.getElementById("report-updated"),
    version: document.getElementById("report-version"),
    currentGrid: document.getElementById("current-variant-grid"),
    leaderboard: document.getElementById("historical-leaderboard"),
    history: document.getElementById("previous-test-history"),
    copyLink: document.getElementById("copy-report-link"),
    print: document.getElementById("print-report")
  };

  els.copyLink.addEventListener("click", copyReportLink);
  els.print.addEventListener("click", function () { window.print(); });
  loadReport();

  async function loadReport() {
    try {
      await loadFreshConfig();
      config = window.LL_POPUP_CONFIG || { variants: [] };
      if (!config.trackingCsvUrl) throw new Error("The tracking source is not configured.");
      initializeAggregates();
      renderCurrentVariants();
      els.leaderboard.innerHTML = emptyState("Loading historical results...");
      els.history.innerHTML = emptyState("Loading previous tests...");
      usingCompactSummary = await loadCompactPulseSummary();
      if (!usingCompactSummary) {
        await streamTrackingCsv(config.trackingCsvUrl, consumeTrackingRow, updateLoadingState);
      }
      renderCurrentVariants();
      renderHistoricalLeaderboard();
      renderPreviousTests();
      renderReadyState();
    } catch (error) {
      renderError(error);
    }
  }

  function loadFreshConfig() {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "../popup/variants.js?report=" + Date.now();
      script.onload = resolve;
      script.onerror = function () { reject(new Error("The current popup configuration could not be loaded.")); };
      document.head.appendChild(script);
    });
  }

  function cacheBustedUrl(url) {
    var separator = String(url).indexOf("?") >= 0 ? "&" : "?";
    return String(url) + separator + "report=" + Date.now();
  }

  function initializeAggregates() {
    currentMetricAccumulators = {};
    summarizedCurrentMetrics = {};
    historyGroups = {};
    processedRows = 0;
    compactPayloadBytes = 0;
    usingCompactSummary = false;
    activeVariants().forEach(function (variant) {
      currentMetricAccumulators[variant.id] = metricAccumulator(variant.id);
      summarizedCurrentMetrics[variant.id] = emptyMetric(variant.id);
    });
  }

  async function loadCompactPulseSummary() {
    var endpoint = config.trackingSummaryUrl || config.webhookUrl;
    if (!endpoint) return false;
    var separator = String(endpoint).indexOf("?") >= 0 ? "&" : "?";
    var url = String(endpoint) + separator + "mode=pulse&testId=" + encodeURIComponent(config.testId || "") + "&report=" + Date.now();
    try {
      els.status.textContent = "Loading compact tracking summary...";
      var response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return false;
      var text = await response.text();
      compactPayloadBytes = new Blob([text]).size;
      var summary = JSON.parse(text);
      if (!summary || summary.ok !== true || !Array.isArray(summary.groups)) return false;
      applyCompactPulseSummary(summary);
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyCompactPulseSummary(summary) {
    processedRows = Number(summary.rowsProcessed || 0);
    summary.groups.forEach(function (group) {
      if (config.testId && group.testId && group.testId !== config.testId) return;
      var version = normalizeVersion(group.version || "unversioned");
      var variant = String(group.variant || "Unknown");
      var key = version + "::" + variant;
      var item = createHistoryItem(variant, version, group.snapshot || null, group.label || "");
      item.firstSeen = parseDate(group.firstSeen);
      item.summary = {
        sessions: Number(group.sessions || 0),
        leads: Number(group.leads || 0)
      };
      historyGroups[key] = item;

      var liveVariant = liveVariantForRow({ variant: variant, configVersion: version }, activeVariants());
      if (liveVariant && summarizedCurrentMetrics[liveVariant.id]) {
        summarizedCurrentMetrics[liveVariant.id].sessions += item.summary.sessions;
        summarizedCurrentMetrics[liveVariant.id].leads += item.summary.leads;
      }
    });
    Object.keys(summarizedCurrentMetrics).forEach(function (variantId) {
      var metric = summarizedCurrentMetrics[variantId];
      metric.cvr = rate(metric.leads, metric.sessions);
    });
  }

  function consumeTrackingRow(row) {
    processedRows += 1;
    row.configVersion = normalizeRowConfigVersion(row);
    if (config.testId && row.testId !== config.testId) return;

    var variants = activeVariants();
    var liveVariant = liveVariantForRow(row, variants);
    if (liveVariant && currentMetricAccumulators[liveVariant.id]) {
      accumulateMetric(currentMetricAccumulators[liveVariant.id], row);
    }

    if (!row.variantSnapshot && !row.variantLabel) return;
    var version = normalizeVersion(row.configVersion || "unversioned");
    var variant = row.variant || "Unknown";
    var key = version + "::" + variant;
    if (!historyGroups[key]) {
      historyGroups[key] = createHistoryItem(variant, version, parseSnapshot(row.variantSnapshot), row.variantLabel);
    }
    accumulateMetric(historyGroups[key].metric, row);
    var timestamp = parseDate(row.timestamp);
    if (timestamp && (!historyGroups[key].firstSeen || timestamp < historyGroups[key].firstSeen)) {
      historyGroups[key].firstSeen = timestamp;
    }
  }

  function updateLoadingState(bytesRead, totalBytes) {
    var loaded = formatBytes(bytesRead);
    var total = totalBytes ? " of " + formatBytes(totalBytes) : "";
    els.status.className = "report-status";
    els.status.textContent = "Refreshing tracking data... " + loaded + total;
    els.updated.textContent = formatNumber(processedRows) + " events processed";
  }

  function renderReadyState() {
    var refreshedAt = new Date();
    els.status.className = "report-status is-ready";
    els.status.textContent = usingCompactSummary
      ? "Compact tracking summary loaded: " + formatBytes(compactPayloadBytes) + "."
      : "Latest aggregate tracking data loaded successfully. " + formatNumber(processedRows) + " events processed.";
    els.updated.textContent = "Updated " + refreshedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    els.version.textContent = "Live configuration: " + (config.configVersion || "Current") + (config.publishedAt ? " · Published " + formatDate(new Date(config.publishedAt)) : "");
  }

  function renderError(error) {
    els.status.className = "report-status is-error";
    els.status.textContent = error && error.message ? error.message : "This report could not be refreshed.";
    els.updated.textContent = "Refresh the page to try again";
    if (!els.currentGrid.children.length) els.currentGrid.innerHTML = emptyState("Current variant data is temporarily unavailable.");
    if (!els.leaderboard.children.length) els.leaderboard.innerHTML = emptyState("Historical results are temporarily unavailable.");
    if (!els.history.children.length) els.history.innerHTML = emptyState("Previous test results are temporarily unavailable.");
  }

  function renderCurrentVariants() {
    var variants = activeVariants();
    var metrics = buildCurrentMetrics(variants);
    var leader = metrics.slice().sort(function (a, b) {
      if (b.cvr !== a.cvr) return b.cvr - a.cvr;
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.sessions - a.sessions;
    })[0];
    els.currentGrid.innerHTML = variants.map(function (variant) {
      var metric = metrics.find(function (item) { return item.variant === variant.id; }) || emptyMetric(variant.id);
      return renderVariantCard(variant, metric, Boolean(leader && leader.variant === variant.id && leader.sessions > 0));
    }).join("");
  }

  function renderVariantCard(variant, metric, isLeader) {
    var preview = variantPreview(variant);
    var progress = preview.progressEnabled
      ? "<div class=\"popup-miniature-progress\"><span>" + escapeHtml(preview.progressLabel) + "</span><strong>1/" + Math.max(1, preview.stepCount) + "</strong></div><div class=\"popup-miniature-progress-track\"><span style=\"width:" + Math.round(100 / Math.max(1, preview.stepCount)) + "%\"></span></div>"
      : "";
    var firstStepContent = preview.firstStepType === "question" && preview.choices.length
      ? "<div class=\"popup-miniature-question\">" + escapeHtml(preview.questionLabel) + "</div><div class=\"popup-miniature-choices\">" + preview.choices.map(function (choice) { return "<span>" + escapeHtml(choice) + "</span>"; }).join("") + "</div>"
      : "<div class=\"popup-miniature-input\">" + escapeHtml(preview.emailPlaceholder) + "</div><div class=\"popup-miniature-button\">" + escapeHtml(preview.buttonText) + "</div>";
    return [
      "<article class=\"variant-report-card" + (isLeader ? " is-current-leader" : "") + "\">",
      isLeader ? "<span class=\"current-leader-flag\">Current leader</span>" : "",
      "<header class=\"variant-report-heading\"><div><span>Variant " + escapeHtml(variant.id) + " · " + formatNumber(variant.trafficSplit) + "% traffic</span><strong>" + escapeHtml(variant.trackingLabel || variant.name || getTrackingVersion(variant)) + "</strong></div><b class=\"variant-badge\">" + escapeHtml(variant.id) + "</b></header>",
      "<div class=\"popup-miniature" + (preview.imageUrl ? "" : " no-image") + "\" style=\"--popup-bg:" + safeColor(variant.backgroundColor, "#fbfaf7") + ";--popup-text:" + safeColor(variant.textColor, "#172026") + ";--popup-button:" + safeColor(variant.accentColor, "#ea8011") + ";--popup-brand:" + safeColor(variant.brandAccentColor, "#06b00b") + ";--popup-font:" + safeFont(variant.fontFamily) + ";--popup-align:" + safeAlignment(variant.textAlign) + ";--headline-weight:" + safeWeight(variant.headlineFontWeight, 700) + ";--body-weight:" + safeWeight(variant.bodyFontWeight, 400) + ";--button-weight:" + safeWeight(variant.buttonFontWeight, 700) + "\">",
      preview.imageUrl ? "<img class=\"popup-miniature-image\" src=\"" + escapeHtmlAttr(preview.imageUrl) + "\" alt=\"\">" : "<span class=\"popup-miniature-image\"></span>",
      "<div class=\"popup-miniature-copy\"><h3>" + escapeHtml(preview.headline) + "</h3><p>" + escapeHtml(preview.subheadline) + "</p></div>",
      "<div class=\"popup-miniature-form\">" + progress + firstStepContent + "</div>",
      "</div>",
      "<div class=\"variant-report-stats\"><div><span>Unique sessions</span><strong>" + formatNumber(metric.sessions) + "</strong></div><div><span>Leads</span><strong>" + formatNumber(metric.leads) + "</strong></div><div><span>CVR</span><strong>" + formatPercent(metric.cvr) + "</strong></div></div>",
      "</article>"
    ].join("");
  }

  function renderHistoricalLeaderboard() {
    var history = buildHistoricalVariants();
    var leaders = historicalTopThree(history);
    if (!leaders.length) {
      els.leaderboard.innerHTML = emptyState("No archived variant has reached 25 unique visitor sessions yet.");
      return;
    }
    els.leaderboard.innerHTML = leaders.map(function (item, index) {
      var match = bestLiveMatch(item.snapshot);
      return [
        "<article class=\"historical-leader\">",
        "<b class=\"leader-rank\">#" + (index + 1) + "</b>",
        "<div class=\"leader-identity\"><span>" + escapeHtml(item.version) + "</span><strong>" + escapeHtml(item.headline || "Historical variant") + "</strong><small>Tested " + escapeHtml(item.publishedLabel || "date unavailable") + "</small></div>",
        "<div class=\"leader-stat\"><span>Sessions</span><strong>" + formatNumber(item.sessions) + "</strong></div>",
        "<div class=\"leader-stat\"><span>Leads</span><strong>" + formatNumber(item.leads) + "</strong></div>",
        "<div class=\"leader-stat\"><span>CVR</span><strong>" + formatPercent(item.cvr) + "</strong></div>",
        "<span class=\"leader-match\">" + formatPercent(match.score) + " match to Live " + escapeHtml(match.variant || "A") + "</span>",
        "<div class=\"leader-attributes\"><span>What was different</span><p>" + escapeHtml(describeVariantAttributes(item.snapshot)) + "</p></div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderPreviousTests() {
    var history = previousTests(buildHistoricalVariants());
    if (!history.length) {
      els.history.innerHTML = emptyState("No archived variant has reached 200 unique sessions yet.");
      return;
    }
    els.history.innerHTML = [
      "<div class=\"history-table-scroll\"><table class=\"history-table\">",
      "<thead><tr><th>Previous variant</th><th>Tested</th><th>Unique sessions</th><th>Leads</th><th>CVR</th><th>Closest live match</th><th>Attributes</th></tr></thead>",
      "<tbody>",
      history.map(function (item) {
        var match = bestLiveMatch(item.snapshot);
        return [
          "<tr>",
          "<td><span class=\"history-version\">" + escapeHtml(item.version) + "</span><strong>" + escapeHtml(item.headline || "Historical variant") + "</strong></td>",
          "<td data-label=\"Tested\">" + escapeHtml(item.publishedLabel || "Unavailable") + "</td>",
          "<td data-label=\"Unique sessions\"><strong>" + formatNumber(item.sessions) + "</strong></td>",
          "<td data-label=\"Leads\"><strong>" + formatNumber(item.leads) + "</strong></td>",
          "<td data-label=\"CVR\"><strong class=\"history-cvr\">" + formatPercent(item.cvr) + "</strong></td>",
          "<td data-label=\"Closest live match\"><span class=\"history-match\">" + formatPercent(match.score) + " to Live " + escapeHtml(match.variant || "A") + "</span></td>",
          "<td data-label=\"Attributes\"><span class=\"history-attributes\">" + escapeHtml(describeVariantAttributes(item.snapshot)) + "</span></td>",
          "</tr>"
        ].join("");
      }).join(""),
      "</tbody></table></div>",
      "<p class=\"history-count\">Showing " + formatNumber(history.length) + " archived variant" + (history.length === 1 ? "" : "s") + " with 200+ unique sessions.</p>"
    ].join("");
  }

  function buildCurrentMetrics(variants) {
    if (usingCompactSummary) {
      return variants.map(function (variant) {
        return summarizedCurrentMetrics[variant.id] || emptyMetric(variant.id);
      });
    }
    return variants.map(function (variant) {
      return finalizeMetric(currentMetricAccumulators[variant.id] || metricAccumulator(variant.id));
    });
  }

  function liveVariantForRow(row, variants) {
    var rowVariant = String(row.variant || "");
    var rowVersion = normalizeVersion(row.configVersion || "unversioned");
    return variants.find(function (variant) {
      if (variant.id === rowVariant && getTrackingVersion(variant) === rowVersion) return true;
      return (Array.isArray(variant.trackingSources) ? variant.trackingSources : []).some(function (source) {
        return String(source.variant || "") === rowVariant && normalizeVersion(source.configVersion || "") === rowVersion;
      });
    }) || null;
  }

  function metricAccumulator(variant) {
    return {
      variant: variant,
      sessions: new Set(),
      actionSessions: new Set(),
      leadSessions: new Set(),
      views: 0,
      leadEvents: 0,
      actionEvents: 0
    };
  }

  function accumulateMetric(metric, row) {
    var type = eventType(row);
    var sessionId = String(row.sessionId || "");
    if (["popup_quiz_submit", "popup_lead_submit", "kajabi_form_submitted", "popup_submit_attempt"].indexOf(type) >= 0) {
      metric.actionEvents += 1;
      if (sessionId) metric.actionSessions.add(sessionId);
    }
    if (type === "popup_view") {
      metric.views += 1;
      if (sessionId) metric.sessions.add(sessionId);
    }
    if (type === "popup_lead_submit" || type === "kajabi_form_submitted") {
      metric.leadEvents += 1;
      if (sessionId) metric.leadSessions.add(sessionId);
    }
  }

  function finalizeMetric(metric) {
    metric.actionSessions.forEach(function (sessionId) { metric.sessions.add(sessionId); });
    var sessions = metric.sessions.size || Math.max(metric.views, metric.actionEvents, metric.leadEvents);
    var leads = metric.leadSessions.size || metric.leadEvents;
    return { variant: metric.variant, sessions: sessions, leads: leads, cvr: rate(leads, sessions) };
  }

  function emptyMetric(variant) {
    return { variant: variant, sessions: 0, leads: 0, cvr: 0 };
  }

  function buildHistoricalVariants() {
    var liveVersions = activeVariants().reduce(function (map, variant) {
      map[variant.id] = getTrackingVersion(variant);
      return map;
    }, {});
    return Object.keys(historyGroups).map(function (key) {
      var item = historyGroups[key];
      var metric = item.summary
        ? { sessions: item.summary.sessions, leads: item.summary.leads, cvr: rate(item.summary.leads, item.summary.sessions) }
        : finalizeMetric(item.metric);
      var snapshot = item.snapshot || {};
      var preview = variantPreview(snapshot);
      item.sessions = metric.sessions;
      item.leads = metric.leads;
      item.cvr = metric.cvr;
      item.headline = preview.headline || item.version;
      item.publishedLabel = item.firstSeen ? formatDate(item.firstSeen) : "";
      item.isLive = liveVersions[item.variant] === item.version;
      return item;
    });
  }

  function createHistoryItem(variant, version, snapshot, label) {
    return {
      variant: variant,
      version: version,
      snapshot: snapshot,
      label: label || "",
      metric: metricAccumulator(variant),
      firstSeen: null,
      sessions: 0,
      leads: 0,
      cvr: 0,
      isLive: false,
      summary: null
    };
  }

  function historicalTopThree(history) {
    var signatures = {};
    return history.filter(function (item) {
      return !item.isLive && item.sessions >= 25;
    }).sort(function (a, b) {
      var scoreDifference = leaderboardScore(b) - leaderboardScore(a);
      if (Math.abs(scoreDifference) > 0.000001) return scoreDifference;
      if (b.cvr !== a.cvr) return b.cvr - a.cvr;
      return b.sessions - a.sessions;
    }).filter(function (item) {
      var signature = approachSignature(item.snapshot);
      if (signatures[signature]) return false;
      signatures[signature] = true;
      return true;
    }).slice(0, 3);
  }

  function previousTests(history) {
    return history.filter(function (item) {
      return !item.isLive && item.sessions >= 200;
    }).sort(function (a, b) {
      var aTime = a.firstSeen ? a.firstSeen.getTime() : 0;
      var bTime = b.firstSeen ? b.firstSeen.getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      if (a.version !== b.version) return String(b.version).localeCompare(String(a.version));
      return String(a.variant).localeCompare(String(b.variant));
    });
  }

  function leaderboardScore(item) {
    var visitors = Math.max(0, Number(item.sessions || 0));
    var leads = Math.max(0, Math.min(visitors, Number(item.leads || 0)));
    if (!visitors) return 0;
    var z = 1.645;
    var proportion = leads / visitors;
    var denominator = 1 + (z * z / visitors);
    var center = proportion + (z * z / (2 * visitors));
    var margin = z * Math.sqrt((proportion * (1 - proportion) / visitors) + (z * z / (4 * visitors * visitors)));
    return Math.max(0, (center - margin) / denominator);
  }

  function approachSignature(snapshot) {
    var preview = variantPreview(snapshot || {});
    var quiz = snapshot && snapshot.proteinQuiz || {};
    return [
      normalizeText(preview.headline),
      normalizeText(preview.subheadline),
      normalizeText(preview.buttonText),
      normalizeText(preview.imageUrl),
      normalizeText(snapshot && snapshot.accentColor),
      quiz.showQuizStep === false ? "single" : "quiz",
      quiz.showFirstName === false ? "no-name" : "name",
      quiz.progressEnabled ? "progress" : "no-progress"
    ].join("|");
  }

  function bestLiveMatch(snapshot) {
    var best = activeVariants().map(function (variant) {
      return { variant: variant.id, score: variantSimilarity(snapshot || {}, variant) };
    }).sort(function (a, b) { return b.score - a.score; })[0];
    return best || { variant: "", score: 0 };
  }

  function variantSimilarity(history, live) {
    var left = variantPreview(history);
    var right = variantPreview(live);
    var historyQuiz = history.proteinQuiz || {};
    var liveQuiz = live.proteinQuiz || {};
    var attributes = [
      [25, textSimilarity(left.headline, right.headline)],
      [15, textSimilarity(left.subheadline, right.subheadline)],
      [10, textSimilarity(left.buttonText, right.buttonText)],
      [15, exactSimilarity(left.imageUrl, right.imageUrl)],
      [10, exactSimilarity(flowType(history), flowType(live))],
      [5, exactSimilarity(history.accentColor, live.accentColor)],
      [5, exactSimilarity(history.backgroundColor, live.backgroundColor)],
      [5, exactSimilarity(history.width, live.width)],
      [5, exactSimilarity(Boolean(historyQuiz.progressEnabled), Boolean(liveQuiz.progressEnabled))],
      [5, exactSimilarity(historyQuiz.showFirstName !== false, liveQuiz.showFirstName !== false)]
    ];
    var total = attributes.reduce(function (sum, item) { return sum + item[0]; }, 0);
    return total ? attributes.reduce(function (sum, item) { return sum + item[0] * item[1]; }, 0) / total : 0;
  }

  function variantPreview(variant) {
    variant = variant || {};
    var steps = Array.isArray(variant.flowSteps) ? variant.flowSteps.filter(function (step) { return step.enabled !== false; }) : [];
    var first = steps[0] || {};
    var lead = steps.filter(function (step) { return step.type === "lead"; })[0] || first;
    var quiz = variant.proteinQuiz || {};
    var firstHasImageSetting = Object.prototype.hasOwnProperty.call(first, "imageUrl");
    return {
      headline: stripHtml(first.headlineHtml || variant.headlineHtml || variant.headline || quiz.leadHeadline || ""),
      subheadline: stripHtml(first.subheadlineHtml || variant.subheadlineHtml || variant.subheadline || quiz.leadSubheadline || ""),
      buttonText: lead.buttonText || quiz.leadButtonText || variant.buttonText || "Continue",
      imageUrl: firstHasImageSetting ? (first.imageUrl || "") : (variant.imageUrl || ""),
      emailPlaceholder: lead.emailPlaceholder || quiz.emailPlaceholder || "Email",
      progressEnabled: lead.progressEnabled !== undefined ? lead.progressEnabled : Boolean(quiz.progressEnabled),
      progressLabel: lead.progressLabel || quiz.progressSingleStepLabel || "Step 1",
      stepCount: Math.max(1, steps.length),
      firstStepType: first.type || (steps.length === 1 ? "lead" : ""),
      questionLabel: first.questionLabel || "",
      choices: flowChoiceLabels(first)
    };
  }

  function flowChoiceLabels(step) {
    if (!step || step.type !== "question" || step.answerStyle !== "ranges") return [];
    return String(step.optionsText || "").split(/\r?\n/).map(function (line) {
      return String(line || "").split("|")[0].trim();
    }).filter(Boolean);
  }

  function describeVariantAttributes(snapshot) {
    snapshot = snapshot || {};
    var preview = variantPreview(snapshot);
    var quiz = snapshot.proteinQuiz || {};
    var parts = [];
    parts.push(flowType(snapshot) === "single" ? "Email-only" : flowType(snapshot) === "multi" ? "Multi-step" : "Quiz-first");
    if (quiz.progressEnabled || preview.progressEnabled) parts.push("Progress bar");
    if (quiz.showFirstName === false) parts.push("No first name");
    parts.push(preview.imageUrl ? imageType(preview.imageUrl) : "No image");
    if (snapshot.width) parts.push(snapshot.width + "px wide");
    if (snapshot.accentColor) parts.push(snapshot.accentColor + " CTA");
    return unique(parts).join(" · ");
  }

  function flowType(snapshot) {
    snapshot = snapshot || {};
    var steps = Array.isArray(snapshot.flowSteps) ? snapshot.flowSteps.filter(function (step) { return step.enabled !== false; }) : [];
    var quiz = snapshot.proteinQuiz || {};
    if (steps.length > 2 || quiz.multiStepEnabled === true) return "multi";
    if (steps.length === 1 || quiz.showQuizStep === false) return "single";
    return "quiz";
  }

  function imageType(url) {
    var value = String(url || "").toLowerCase();
    if (value.indexOf("mockup") >= 0 || value.indexOf("preview") >= 0) return "Mockup visual";
    if (value.indexOf("male") >= 0 || value.indexOf("female") >= 0 || value.indexOf("people") >= 0) return "People visual";
    return "Image visual";
  }

  function activeVariants() {
    return (config && Array.isArray(config.variants) ? config.variants : []).filter(function (variant) { return variant.active !== false; });
  }

  function getTrackingVersion(variant) {
    return normalizeVersion(variant && (variant.trackingVersion || config.configVersion) || "unversioned");
  }

  function eventType(row) {
    var raw = String(row && row.eventType || "").trim().toLowerCase();
    var normalized = raw.replace(/[^a-z0-9]/g, "");
    var aliases = {
      popupview: "popup_view",
      view: "popup_view",
      impression: "popup_view",
      popupquizsubmit: "popup_quiz_submit",
      quizsubmit: "popup_quiz_submit",
      quizcompletion: "popup_quiz_submit",
      popupsubmitattempt: "popup_submit_attempt",
      submitattempt: "popup_submit_attempt",
      submit: "popup_submit_attempt",
      popupleadsubmit: "popup_lead_submit",
      leadsubmit: "popup_lead_submit",
      lead: "popup_lead_submit",
      kajabiformsubmitted: "kajabi_form_submitted",
      formsubmitted: "kajabi_form_submitted"
    };
    return aliases[normalized] || raw;
  }

  async function streamTrackingCsv(url, onRecord, onProgress) {
    var response = await fetch(cacheBustedUrl(url), { cache: "no-store" });
    if (!response.ok) throw new Error("The latest tracking data could not be loaded.");
    var totalBytes = Number(response.headers.get("content-length") || 0);
    var parser = createCsvRecordParser(onRecord);
    var bytesRead = 0;
    var lastProgress = 0;

    if (!response.body || !response.body.getReader || typeof TextDecoder === "undefined") {
      var text = await response.text();
      parser.write(text);
      parser.finish();
      onProgress(text.length, text.length);
      return;
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    while (true) {
      var result = await reader.read();
      if (result.done) break;
      bytesRead += result.value.byteLength;
      parser.write(decoder.decode(result.value, { stream: true }));
      if (bytesRead - lastProgress >= 1024 * 1024) {
        lastProgress = bytesRead;
        onProgress(bytesRead, totalBytes);
        await yieldToBrowser();
      }
    }
    parser.write(decoder.decode());
    parser.finish();
    onProgress(bytesRead, totalBytes);
  }

  function createCsvRecordParser(onRecord) {
    var headers = null;
    var wantedIndexes = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    var quotePending = false;
    var wantedHeaders = {
      timestamp: true,
      testId: true,
      configVersion: true,
      variant: true,
      variantLabel: true,
      variantSnapshot: true,
      eventType: true,
      sessionId: true
    };

    function emitRow() {
      row.push(cell);
      cell = "";
      if (!headers) {
        headers = row.map(canonicalHeader);
        headers.forEach(function (header, index) {
          if (wantedHeaders[header]) wantedIndexes.push([index, header]);
        });
      } else if (row.some(Boolean)) {
        var record = {};
        wantedIndexes.forEach(function (entry) {
          record[entry[1]] = String(row[entry[0]] || "").trim();
        });
        onRecord(record);
      }
      row = [];
    }

    function processCharacter(character) {
      if (quotePending) {
        if (character === "\"") {
          cell += "\"";
          quotePending = false;
          return;
        }
        quotePending = false;
        inQuotes = false;
      }
      if (inQuotes) {
        if (character === "\"") quotePending = true;
        else cell += character;
      } else if (character === "\"") {
        inQuotes = true;
      } else if (character === ",") {
        row.push(cell);
        cell = "";
      } else if (character === "\n") {
        emitRow();
      } else if (character !== "\r") {
        cell += character;
      }
    }

    return {
      write: function (chunk) {
        for (var i = 0; i < chunk.length; i += 1) processCharacter(chunk[i]);
      },
      finish: function () {
        if (quotePending) {
          quotePending = false;
          inQuotes = false;
        }
        if (cell || row.length) emitRow();
      }
    };
  }

  function yieldToBrowser() {
    return new Promise(function (resolve) { window.setTimeout(resolve, 0); });
  }

  function normalizeRowConfigVersion(record) {
    var version = normalizeVersion(record && record.configVersion);
    if (version === "6/30/2026" && isCorrectedSingleStepRow(record)) return "6/30/2026 Single Step";
    return version;
  }

  function isCorrectedSingleStepRow(record) {
    var label = String(record && record.variantLabel || "");
    var snapshot = String(record && record.variantSnapshot || "");
    return label.indexOf("Flow: Single-step") >= 0 || snapshot.indexOf("\"showQuizStep\":false") >= 0;
  }

  function canonicalHeader(header) {
    var normalized = String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    var aliases = {
      timestamp: "timestamp",
      datetime: "timestamp",
      date: "timestamp",
      testid: "testId",
      test: "testId",
      configversion: "configVersion",
      version: "configVersion",
      variant: "variant",
      variantid: "variant",
      variantlabel: "variantLabel",
      label: "variantLabel",
      variantsnapshot: "variantSnapshot",
      snapshot: "variantSnapshot",
      eventtype: "eventType",
      event: "eventType",
      type: "eventType",
      sessionid: "sessionId",
      session: "sessionId"
    };
    return aliases[normalized] || String(header || "").trim();
  }

  function parseSnapshot(value) {
    if (!value) return null;
    try {
      var parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function normalizeVersion(value) {
    var version = String(value || "");
    var automatic = version.match(/^test-(\d{4})(\d{2})(\d{2})(?:\d{4})?$/);
    return automatic ? Number(automatic[2]) + "/" + Number(automatic[3]) + "/" + automatic[1] : (version || "unversioned");
  }

  function parseDate(value) {
    var date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function formatDate(date) {
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "";
  }

  function textSimilarity(left, right) {
    var a = tokens(left);
    var b = tokens(right);
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    var union = unique(a.concat(b));
    var intersection = unique(a.filter(function (token) { return b.indexOf(token) >= 0; }));
    return union.length ? intersection.length / union.length : 0;
  }

  function exactSimilarity(left, right) {
    return normalizeText(left) === normalizeText(right) ? 1 : 0;
  }

  function tokens(value) {
    return unique(normalizeText(stripHtml(value)).split(" ").filter(function (token) { return token.length > 2 || /^\d+$/.test(token); }));
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9#]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function stripHtml(value) {
    var element = document.createElement("div");
    element.innerHTML = String(value || "");
    return String(element.textContent || element.innerText || "").replace(/\s+/g, " ").trim();
  }

  function copyReportLink() {
    var url = window.location.origin + window.location.pathname;
    var promise = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(url)
      : fallbackCopy(url);
    Promise.resolve(promise).then(function () {
      var original = els.copyLink.textContent;
      els.copyLink.textContent = "Link Copied";
      window.setTimeout(function () { els.copyLink.textContent = original; }, 1600);
    });
  }

  function fallbackCopy(value) {
    var textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function safeColor(value, fallback) {
    var color = String(value || "").trim();
    return /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|[a-z]+)$/i.test(color) ? color : fallback;
  }

  function safeFont(value) {
    return String(value || "Arial, Helvetica, sans-serif").replace(/[^a-z0-9,\-\s'\"]/gi, "");
  }

  function safeAlignment(value) {
    return ["left", "center", "right"].indexOf(String(value || "")) >= 0 ? value : "center";
  }

  function safeWeight(value, fallback) {
    var weight = Number(value);
    return Number.isFinite(weight) && weight >= 100 && weight <= 900 ? weight : fallback;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatBytes(value) {
    var bytes = Number(value || 0);
    if (bytes < 1024 * 1024) return Math.max(0, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatPercent(value) {
    return (Number(value || 0) * 100).toFixed(1) + "%";
  }

  function rate(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
  }

  function unique(values) {
    return values.filter(function (value, index, array) { return value !== undefined && array.indexOf(value) === index; });
  }

  function emptyState(message) {
    return "<div class=\"report-empty\">" + escapeHtml(message) + "</div>";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function escapeHtmlAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
