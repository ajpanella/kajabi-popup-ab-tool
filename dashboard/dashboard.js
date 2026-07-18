(function () {
  "use strict";

  var originalConfig = window.LL_POPUP_CONFIG || { variants: [] };
  var DRAFT_KEY = "ll_popup_dashboard_config_" + sanitizeKey(originalConfig.testId || "default");
  var ASSET_BASE_KEY = "ll_popup_dashboard_asset_base";
  var PUBLIC_ASSET_BASE_URL = "https://ajpanella.github.io/kajabi-popup-ab-tool";
  var CSV_URL_KEY = "ll_popup_dashboard_csv_url";
  var GITHUB_OWNER_KEY = "ll_popup_dashboard_github_owner";
  var GITHUB_REPO_KEY = "ll_popup_dashboard_github_repo";
  var GITHUB_BRANCH_KEY = "ll_popup_dashboard_github_branch";
  var GITHUB_PATH_KEY = "ll_popup_dashboard_github_path";
  var GITHUB_TOKEN_KEY = "ll_popup_dashboard_github_token";
  var LATEST_TWO_VERSIONS = "__latest_two_versions";
  var HIDDEN_HISTORY_KEY = "ll_popup_dashboard_hidden_history";
  var HIDDEN_METRICS_KEY = "ll_popup_dashboard_hidden_metrics";
  var IDEA_BANK_KEY = "ll_popup_dashboard_idea_bank_v1";
  var config = loadDraftConfig();
  var legacyTrackingVariantIds = [];
  initializeVariantTracking();
  var urlParams = new URLSearchParams(window.location.search);
  var defaultCsvUrl = urlParams.get("csv") || localStorage.getItem(CSV_URL_KEY) || config.trackingCsvUrl || originalConfig.trackingCsvUrl || "";
  var googleDocUrl = urlParams.get("doc") || "";
  var trackingSheetUrl = urlParams.get("sheet") || "https://docs.google.com/spreadsheets/d/1fjbkrBO5r1XaJf3x-WNT0UNjEtn0IlDlAA9e2Sza69w";
  var rows = [];
  var charts = {};
  var previewMode = "desktop";
  var previewStep = 0;
  var selectedFlowSteps = {};
  var lastColorTarget = null;
  var versionFilterInitialized = false;
  var fullHistorySort = { key: "published", direction: "desc" };
  var compareFullHistoryToLive = false;
  var ideaBank = loadIdeaBank();

  var els = {
    csvUrl: document.getElementById("csv-url"),
    loadData: document.getElementById("load-data"),
    csvLoadStatus: document.getElementById("csv-load-status"),
    docLink: document.getElementById("google-doc-link"),
    trackingSheetLink: document.getElementById("tracking-sheet-link"),
    testId: document.getElementById("filter-test-id"),
    variant: document.getElementById("filter-variant"),
    version: document.getElementById("filter-version"),
    start: document.getElementById("filter-start"),
    end: document.getElementById("filter-end"),
    pageUrl: document.getElementById("filter-page-url"),
    device: document.getElementById("filter-device"),
    assetBaseUrl: document.getElementById("asset-base-url"),
    embedCode: document.getElementById("embed-code"),
    copyEmbed: document.getElementById("copy-embed"),
    editors: document.getElementById("variant-editors"),
    resetConfig: document.getElementById("reset-config"),
    restoreWinner: document.getElementById("restore-winner"),
    downloadConfig: document.getElementById("download-config"),
    copyConfig: document.getElementById("copy-config"),
    githubOwner: document.getElementById("github-owner"),
    githubRepo: document.getElementById("github-repo"),
    githubBranch: document.getElementById("github-branch"),
    githubPath: document.getElementById("github-path"),
    githubToken: document.getElementById("github-token"),
    githubMessage: document.getElementById("github-message"),
    publishGithub: document.getElementById("publish-github"),
    publishStatus: document.getElementById("github-publish-status"),
    webhookUrl: document.getElementById("webhook-url"),
    leadMagnetMode: document.getElementById("lead-magnet-mode"),
    leadWebhookUrl: document.getElementById("lead-webhook-url"),
    proteinPlanUrl: document.getElementById("protein-plan-url"),
    delaySeconds: document.getElementById("delay-seconds"),
    reopenAfterCloseSeconds: document.getElementById("reopen-after-close-seconds"),
    scrollDepth: document.getElementById("scroll-depth"),
    configVersion: document.getElementById("config-version"),
    changeNote: document.getElementById("change-note"),
    savedColors: document.getElementById("saved-colors"),
    recommendations: document.getElementById("recommendation-list"),
    history: document.getElementById("variation-history"),
    previews: document.getElementById("variant-previews"),
    desktopPreview: document.getElementById("desktop-preview"),
    comparePreview: document.getElementById("compare-preview"),
    mobilePreview: document.getElementById("mobile-preview"),
    quizStepPreview: document.getElementById("quiz-step-preview"),
    leadStepPreview: document.getElementById("lead-step-preview"),
    flowPreviewTabs: document.getElementById("flow-preview-tabs"),
    warning: document.getElementById("sample-warning"),
    hiddenMetricsStatus: document.getElementById("hidden-metrics-status"),
    showHiddenMetrics: document.getElementById("show-hidden-metrics"),
    body: document.getElementById("performance-body"),
    fullHistoryBody: document.getElementById("full-history-body"),
    fullHistoryInsights: document.getElementById("full-history-insights"),
    conversionCoach: document.getElementById("conversion-coach"),
    fullHistoryTable: document.querySelector(".dash-full-history-table"),
    historySearch: document.getElementById("history-search"),
    historyStatus: document.getElementById("history-status"),
    historyFlow: document.getElementById("history-flow"),
    historyMinViews: document.getElementById("history-min-views"),
    historyMinLeads: document.getElementById("history-min-leads"),
    historyMinCvr: document.getElementById("history-min-cvr"),
    historyMaxCvr: document.getElementById("history-max-cvr"),
    compareLiveHistory: document.getElementById("compare-live-history"),
    ideaForm: document.getElementById("idea-form"),
    ideaText: document.getElementById("idea-text"),
    ideaCategory: document.getElementById("idea-category"),
    ideaPriority: document.getElementById("idea-priority"),
    ideaSearch: document.getElementById("idea-search"),
    ideaStatusFilter: document.getElementById("idea-status-filter"),
    ideaList: document.getElementById("idea-list"),
    ideaCount: document.getElementById("idea-count"),
    exportIdeas: document.getElementById("export-ideas"),
    importIdeas: document.getElementById("import-ideas"),
    importIdeasFile: document.getElementById("import-ideas-file")
  };

  els.csvUrl.value = defaultCsvUrl;
  els.assetBaseUrl.value = savedAssetBaseUrl();
  els.githubOwner.value = localStorage.getItem(GITHUB_OWNER_KEY) || els.githubOwner.value || "ajpanella";
  els.githubRepo.value = localStorage.getItem(GITHUB_REPO_KEY) || els.githubRepo.value || "kajabi-popup-ab-tool";
  els.githubBranch.value = localStorage.getItem(GITHUB_BRANCH_KEY) || els.githubBranch.value || "main";
  els.githubPath.value = localStorage.getItem(GITHUB_PATH_KEY) || els.githubPath.value || "popup/variants.js";
  els.githubToken.value = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  if (googleDocUrl) els.docLink.href = googleDocUrl;
  if (trackingSheetUrl) els.trackingSheetLink.href = trackingSheetUrl;

  renderEditors();
  renderPreviews(previewMode);
  renderEmbedCode();
  renderIdeaBank();
  populateFilters();
  updateDashboard();

  els.loadData.addEventListener("click", loadCsv);
  els.csvUrl.addEventListener("change", function () {
    persistCsvUrl();
    loadCsv();
  });
  [els.testId, els.variant, els.version, els.start, els.end, els.pageUrl, els.device].forEach(function (element) {
    element.addEventListener("input", updateDashboard);
  });
  [els.historySearch, els.historyStatus, els.historyFlow, els.historyMinViews, els.historyMinLeads, els.historyMinCvr, els.historyMaxCvr].forEach(function (element) {
    element.addEventListener("input", updateDashboard);
  });
  els.compareLiveHistory.addEventListener("click", function () {
    compareFullHistoryToLive = !compareFullHistoryToLive;
    els.compareLiveHistory.classList.toggle("is-active", compareFullHistoryToLive);
    els.compareLiveHistory.setAttribute("aria-pressed", compareFullHistoryToLive ? "true" : "false");
    updateDashboard();
  });
  [els.webhookUrl, els.leadMagnetMode, els.leadWebhookUrl, els.proteinPlanUrl, els.delaySeconds, els.reopenAfterCloseSeconds, els.scrollDepth, els.configVersion, els.changeNote].forEach(function (element) {
    element.addEventListener("input", onGlobalConfigInput);
  });
  els.editors.addEventListener("input", onEditorInput);
  els.editors.addEventListener("click", onEditorClick);
  els.editors.addEventListener("focusin", onEditorFocus);
  els.history.addEventListener("click", onHistoryClick);
  els.fullHistoryTable.addEventListener("click", onFullHistoryTableClick);
  els.ideaForm.addEventListener("submit", addIdea);
  els.ideaList.addEventListener("input", onIdeaListInput);
  els.ideaList.addEventListener("change", onIdeaListInput);
  els.ideaList.addEventListener("click", onIdeaListClick);
  els.ideaSearch.addEventListener("input", renderIdeaBank);
  els.ideaStatusFilter.addEventListener("change", renderIdeaBank);
  els.exportIdeas.addEventListener("click", exportIdeaBank);
  els.importIdeas.addEventListener("click", function () { els.importIdeasFile.click(); });
  els.importIdeasFile.addEventListener("change", importIdeaBank);
  els.body.addEventListener("click", onMetricRowClick);
  els.savedColors.addEventListener("input", onPaletteInput);
  els.savedColors.addEventListener("click", onPaletteClick);
  els.assetBaseUrl.addEventListener("input", function () {
    localStorage.setItem(ASSET_BASE_KEY, els.assetBaseUrl.value.trim());
    renderEmbedCode();
  });
  els.copyEmbed.addEventListener("click", function () {
    copyText(els.embedCode.value);
  });
  els.copyConfig.addEventListener("click", function () {
    copyText(generateVariantsJs());
  });
  els.downloadConfig.addEventListener("click", downloadConfig);
  els.restoreWinner.addEventListener("click", restoreWinningVariant);
  els.publishGithub.addEventListener("click", publishConfigToGitHub);
  els.showHiddenMetrics.addEventListener("click", clearHiddenMetrics);
  [els.githubOwner, els.githubRepo, els.githubBranch, els.githubPath, els.githubToken].forEach(function (element) {
    element.addEventListener("input", saveGitHubPublishSettings);
  });
  els.resetConfig.addEventListener("click", function () {
    localStorage.removeItem(DRAFT_KEY);
    config = cloneConfig(originalConfig);
    renderEditors();
    renderPreviews(previewMode);
    renderEmbedCode();
    populateFilters();
    updateDashboard();
  });

  els.desktopPreview.addEventListener("click", function () {
    setPreviewMode("desktop");
  });

  els.comparePreview.addEventListener("click", function () {
    setPreviewMode("compare");
  });

  els.mobilePreview.addEventListener("click", function () {
    setPreviewMode("mobile");
  });

  els.flowPreviewTabs.addEventListener("click", function (event) {
    var button = event.target.closest("[data-preview-flow-step]");
    if (button) setPreviewStep(Number(button.dataset.previewFlowStep));
  });

  if (defaultCsvUrl) loadCsv();

  function addIdea(event) {
    event.preventDefault();
    var text = els.ideaText.value.trim();
    if (!text) {
      els.ideaText.focus();
      return;
    }

    var now = new Date().toISOString();
    ideaBank.unshift({
      id: "idea_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
      text: text,
      category: els.ideaCategory.value || "Other",
      priority: els.ideaPriority.value || "medium",
      status: "backlog",
      createdAt: now,
      updatedAt: now
    });
    saveIdeaBank();
    els.ideaText.value = "";
    renderIdeaBank();
    els.ideaText.focus();
  }

  function renderIdeaBank() {
    if (!els.ideaList) return;
    var search = String(els.ideaSearch.value || "").trim().toLowerCase();
    var status = els.ideaStatusFilter.value || "";
    var visible = ideaBank.filter(function (idea) {
      if (status && idea.status !== status) return false;
      if (search && [idea.text, idea.category, idea.priority, idea.status].join(" ").toLowerCase().indexOf(search) === -1) return false;
      return true;
    }).sort(compareIdeas);

    els.ideaCount.textContent = String(ideaBank.length);
    if (!visible.length) {
      els.ideaList.innerHTML = "<p class=\"dash-empty-state\">" + (ideaBank.length ? "No ideas match these filters." : "Your next strong test idea can start here.") + "</p>";
      return;
    }

    els.ideaList.innerHTML = visible.map(function (idea) {
      return [
        "<article class=\"dash-idea-card dash-idea-priority-" + escapeHtmlAttr(idea.priority) + "\" data-idea-id=\"" + escapeHtmlAttr(idea.id) + "\">",
        "<textarea class=\"dash-idea-copy\" data-idea-field=\"text\" aria-label=\"Idea notes\">" + escapeHtml(idea.text) + "</textarea>",
        "<div class=\"dash-idea-meta\">",
        ideaSelect("category", idea.category, ["Headline", "Offer", "CTA", "Flow", "Visual", "Trust", "Timing", "Other"]),
        ideaSelect("priority", idea.priority, ["high", "medium", "low"]),
        ideaSelect("status", idea.status, ["backlog", "next", "testing", "completed"]),
        "<button class=\"dash-idea-use\" type=\"button\" data-idea-action=\"use-note\">Use as Change Note</button>",
        "<button class=\"dash-idea-delete\" type=\"button\" data-idea-action=\"delete\" aria-label=\"Delete idea\">&times;</button>",
        "</div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function ideaSelect(field, current, values) {
    var labels = { high: "High priority", medium: "Medium priority", low: "Low priority", backlog: "Backlog", next: "Test Next", testing: "Testing", completed: "Completed" };
    return "<select data-idea-field=\"" + field + "\" aria-label=\"" + field + "\">" + values.map(function (value) {
      return "<option value=\"" + escapeHtmlAttr(value) + "\"" + (value === current ? " selected" : "") + ">" + escapeHtml(labels[value] || value) + "</option>";
    }).join("") + "</select>";
  }

  function compareIdeas(a, b) {
    var statusOrder = { next: 0, testing: 1, backlog: 2, completed: 3 };
    var priorityOrder = { high: 0, medium: 1, low: 2 };
    var statusDifference = (statusOrder[a.status] == null ? 9 : statusOrder[a.status]) - (statusOrder[b.status] == null ? 9 : statusOrder[b.status]);
    if (statusDifference) return statusDifference;
    var priorityDifference = (priorityOrder[a.priority] == null ? 9 : priorityOrder[a.priority]) - (priorityOrder[b.priority] == null ? 9 : priorityOrder[b.priority]);
    if (priorityDifference) return priorityDifference;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  }

  function onIdeaListInput(event) {
    var field = event.target.dataset.ideaField;
    var card = event.target.closest("[data-idea-id]");
    if (!field || !card) return;
    var idea = ideaBank.find(function (item) { return item.id === card.dataset.ideaId; });
    if (!idea) return;
    idea[field] = event.target.value;
    idea.updatedAt = new Date().toISOString();
    saveIdeaBank();
    if (event.type === "change" && field !== "text") renderIdeaBank();
  }

  function onIdeaListClick(event) {
    var button = event.target.closest("[data-idea-action]");
    var card = event.target.closest("[data-idea-id]");
    if (!button || !card) return;
    var index = ideaBank.findIndex(function (item) { return item.id === card.dataset.ideaId; });
    if (index < 0) return;

    if (button.dataset.ideaAction === "delete") {
      if (!window.confirm("Delete this test idea?")) return;
      ideaBank.splice(index, 1);
      saveIdeaBank();
      renderIdeaBank();
      return;
    }

    if (button.dataset.ideaAction === "use-note") {
      els.changeNote.value = ideaBank[index].text;
      onGlobalConfigInput();
      els.changeNote.scrollIntoView({ behavior: "smooth", block: "center" });
      els.changeNote.focus();
    }
  }

  function loadIdeaBank() {
    try {
      var stored = JSON.parse(localStorage.getItem(IDEA_BANK_KEY)) || [];
      return Array.isArray(stored) ? stored.map(normalizeIdea).filter(function (idea) { return idea.text; }) : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeIdea(idea) {
    var now = new Date().toISOString();
    return {
      id: String(idea && idea.id || "idea_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
      text: String(idea && idea.text || "").trim(),
      category: String(idea && idea.category || "Other"),
      priority: ["high", "medium", "low"].indexOf(idea && idea.priority) >= 0 ? idea.priority : "medium",
      status: ["backlog", "next", "testing", "completed"].indexOf(idea && idea.status) >= 0 ? idea.status : "backlog",
      createdAt: String(idea && idea.createdAt || now),
      updatedAt: String(idea && idea.updatedAt || now)
    };
  }

  function saveIdeaBank() {
    localStorage.setItem(IDEA_BANK_KEY, JSON.stringify(ideaBank));
  }

  function exportIdeaBank() {
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ideas: ideaBank }, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "popup-test-idea-bank.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function importIdeaBank(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || "{}"));
        var imported = Array.isArray(parsed) ? parsed : parsed.ideas;
        if (!Array.isArray(imported)) throw new Error("Invalid idea bank file.");
        ideaBank = imported.map(normalizeIdea).filter(function (idea) { return idea.text; });
        saveIdeaBank();
        renderIdeaBank();
      } catch (error) {
        window.alert("That file is not a valid Test Idea Bank backup.");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function loadCsv() {
    var csvUrl = els.csvUrl.value.trim();
    if (!csvUrl) {
      renderCsvLoadStatus([], "Add a Published CSV URL first.");
      return;
    }
    persistCsvUrl();
    setCsvLoading(true);

    fetch(csvUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Unable to load CSV");
        return response.text();
      })
      .then(function (text) {
        rows = parseCsv(text);
        renderCsvLoadStatus(rows);
        reconcileLegacyVariantVersions();
        populateFilters();
        updateDashboard();
      })
      .catch(function (error) {
        renderCsvLoadStatus([], error.message);
      })
      .finally(function () {
        setCsvLoading(false);
      });
  }

  function persistCsvUrl() {
    var csvUrl = els.csvUrl.value.trim();
    if (!csvUrl) return;
    localStorage.setItem(CSV_URL_KEY, csvUrl);
    config.trackingCsvUrl = csvUrl;
    saveDraftConfig();
  }

  function setCsvLoading(isLoading) {
    els.loadData.disabled = isLoading;
    els.loadData.textContent = isLoading ? "Loading..." : "Refresh Data";
    if (isLoading && els.csvLoadStatus) {
      els.csvLoadStatus.classList.remove("is-error");
      els.csvLoadStatus.textContent = "Loading latest tracking data...";
    }
  }

  function renderCsvLoadStatus(data, errorMessage) {
    if (!els.csvLoadStatus) return;
    if (errorMessage) {
      els.csvLoadStatus.textContent = "Load failed: " + errorMessage;
      els.csvLoadStatus.classList.add("is-error");
      return;
    }

    var counts = data.reduce(function (counts, row) {
      var type = eventType(row);
      counts.total += 1;
      if (type === "popup_view") counts.views += 1;
      if (type === "popup_quiz_submit") counts.quiz += 1;
      if (type === "popup_lead_submit" || type === "kajabi_form_submitted") counts.leads += 1;
      if (type === "popup_submit_attempt") counts.submitAttempts += 1;
      return counts;
    }, { total: 0, views: 0, quiz: 0, leads: 0, submitAttempts: 0 });

    els.csvLoadStatus.classList.remove("is-error");
    els.csvLoadStatus.textContent = [
      "Loaded " + formatNumber(counts.total) + " rows",
      formatNumber(counts.views) + " views",
      formatNumber(counts.quiz) + " quiz",
      formatNumber(counts.leads) + " leads",
      formatNumber(counts.submitAttempts) + " submit attempts"
    ].join(" | ");
  }

  function renderEditors() {
    els.editors.innerHTML = "";
    els.webhookUrl.value = config.webhookUrl || "";
    els.leadMagnetMode.value = config.leadMagnetMode || "";
    els.leadWebhookUrl.value = config.leadWebhookUrl || "";
    els.proteinPlanUrl.value = config.proteinPlanUrl || "";
    var delayMs = Number(config.triggers && config.triggers.delayMs);
    var scrollDepth = Number(config.triggers && config.triggers.scrollDepth);
    els.delaySeconds.value = Math.round((Number.isFinite(delayMs) ? delayMs : 35000) / 1000);
    els.reopenAfterCloseSeconds.value = Math.max(0, Number(config.reopenAfterCloseSeconds || 0));
    els.scrollDepth.value = Math.round((Number.isFinite(scrollDepth) ? scrollDepth : 0.5) * 100);
    els.configVersion.value = config.configVersion || "v1";
    els.changeNote.value = config.changeNote || "";
    renderPalette();
    activeVariants().forEach(function (variant, index) {
      ensureFlowSteps(variant);
      var label = buildVariantLabel(variant);
      var card = document.createElement("article");
      card.className = "dash-editor-card";
      card.innerHTML = [
        "<div class=\"dash-editor-title\"><h3>Variant " + escapeHtml(variant.id) + "</h3><span>" + escapeHtml(label) + "</span></div>",
        config.leadMagnetMode === "protein_plan" ? "" : editorRichText("headlineHtml", index, "Headline", variant.headlineHtml || escapeHtml(variant.headline || ""), false, "headlineFontSize", variant.headlineFontSize, 32, variant.textColor || "#172026"),
        config.leadMagnetMode === "protein_plan" ? "" : editorRichText("subheadlineHtml", index, "Subheadline", variant.subheadlineHtml || escapeHtml(variant.subheadline || ""), false, "subheadlineFontSize", variant.subheadlineFontSize, 17, variant.textColor || "#172026"),
        config.leadMagnetMode === "protein_plan" ? "" : editorRichText("valueLineHtml", index, "Value Line", variant.valueLineHtml || escapeHtml(variant.valueLine || ""), false, "valueLineFontSize", variant.valueLineFontSize, 15, variant.brandAccentColor || "#06b00b"),
        "<details class=\"dash-design-panel\"><summary>Design & popup settings</summary><div class=\"dash-global-editor\">",
        "<div class=\"dash-color-row\">",
        editorInput("backgroundColor", index, "Background", variant.backgroundColor || "#ffffff", "color"),
        editorInput("textColor", index, "Text", variant.textColor || "#172026", "color"),
        editorInput("brandAccentColor", index, "Accent text", variant.brandAccentColor || "#06b00b", "color"),
        editorInput("accentColor", index, "Button", variant.accentColor || "#1f6feb", "color"),
        "</div>",
        editorSelect("fontFamily", index, "Font", variant.fontFamily || "Arial, Helvetica, sans-serif"),
        editorFontWeightSelect("headlineFontWeight", index, "Headline weight", variant.headlineFontWeight || 700),
        editorFontWeightSelect("bodyFontWeight", index, "Body weight", variant.bodyFontWeight || 400),
        editorFontWeightSelect("buttonFontWeight", index, "CTA weight", variant.buttonFontWeight || 700),
        editorAlignmentSelect("textAlign", index, "Text alignment", variant.textAlign || "left"),
        editorInput("width", index, "Width px", String(variant.width || 560), "number"),
        editorInput("height", index, "Height px", String(variant.height || ""), "number"),
        editorCheckbox("sizeToImage", index, "Size to Image", Boolean(variant.sizeToImage)),
        editorInput("trafficSplit", index, "Traffic split", String(variant.trafficSplit || 0), "number"),
        editorCompactSizeInput("headlineFontSize", index, "Default headline size", variant.headlineFontSize, 32),
        editorCompactSizeInput("subheadlineFontSize", index, "Default subheadline size", variant.subheadlineFontSize, 17),
        editorCompactSizeInput("valueLineFontSize", index, "Default value line size", variant.valueLineFontSize, 15),
        editorCompactSizeInput("buttonFontSize", index, "Default button size", variant.buttonFontSize, 16),
        "</div></details>",
        renderProteinFlowEditor(variant, index),
        "<button class=\"dash-test-popup-button\" data-test-popup=\"" + index + "\" type=\"button\">Load Variant Preview (Dashboard Only)</button>",
        "<button class=\"dash-save-test\" data-save-test=\"" + index + "\" type=\"button\">Save Draft + Log Version</button>"
      ].join("");
      els.editors.appendChild(card);
    });
  }

  function onGlobalConfigInput() {
    config.webhookUrl = els.webhookUrl.value.trim();
    config.formMode = "zapier";
    config.leadMagnetMode = els.leadMagnetMode.value;
    config.leadWebhookUrl = els.leadWebhookUrl.value.trim();
    config.proteinPlanUrl = els.proteinPlanUrl.value.trim();
    config.triggers = config.triggers || {};
    config.triggers.delayMs = Math.max(0, Number(els.delaySeconds.value || 0)) * 1000;
    config.reopenAfterCloseSeconds = Math.max(0, Number(els.reopenAfterCloseSeconds.value || 0));
    config.triggers.scrollDepth = Math.min(1, Math.max(0, Number(els.scrollDepth.value || 0) / 100));
    config.configVersion = els.configVersion.value.trim() || "v1";
    config.changeNote = els.changeNote.value.trim();
    saveDraftConfig();
    renderPreviews(previewMode);
    renderEmbedCode();
    populateFilters();
    updateDashboard();
  }

  function getProteinQuizConfig(variant) {
    return Object.assign(getProteinQuizDefaults(), config.proteinQuiz || {}, variant && variant.proteinQuiz || {});
  }

  function getProteinQuizDefaults() {
    return {
      targetWeightLabel: "Target weight in lbs",
      targetWeightPlaceholder: "155",
      strengthDaysLabel: "Strength training days",
      strengthDaysPlaceholder: "Select days",
      ageLabel: "Age",
      agePlaceholder: "48",
      multiStepEnabled: false,
      targetWeightAnswerStyle: "dropdown",
      strengthDaysAnswerStyle: "dropdown",
      ageAnswerStyle: "dropdown",
      progressEnabled: false,
      progressStepOneLabel: "Step 1 of 2: Quick Calculator",
      progressStepOneText: "Answer 3 quick questions to calculate your personalized protein target immediately.",
      progressStepTwoLabel: "Step 2 of 2: Send Your Plan",
      progressStepTwoText: "Your personalized target is ready. Tell us where to send the full plan.",
      progressSingleStepLabel: "Step 1",
      progressSingleStepLabelFontSize: "",
      targetPreviewStyle: "off",
      targetPreviewLabel: "Your Daily Target:",
      showQuizStep: true,
      showFirstName: true,
      showEmail: true,
      quizButtonText: "Continue",
      leadHeadline: "Get your free personalized protein goal + 7-day high-protein meal plan",
      leadSubheadline: "Tell us where to send it, then your plan will open right away.",
      firstNameLabel: "First name",
      firstNamePlaceholder: "First Name",
      emailLabel: "Email",
      emailPlaceholder: "Email",
      leadButtonText: "Show My Protein Plan",
      backButtonText: "Back"
    };
  }

  function onEditorInput(event) {
    var target = event.target;
    if (!target || !target.dataset || target.dataset.variantIndex === undefined) return;

    var variant = activeVariants()[Number(target.dataset.variantIndex)];
    if (!variant) return;

    var key = target.dataset.field;
    var value = target.isContentEditable ? sanitizeRichHtml(target.innerHTML) : (target.type === "checkbox" ? target.checked : target.value);
    if (key === "width" || key === "height" || key === "trafficSplit" || key === "headlineFontSize" || key === "subheadlineFontSize" || key === "valueLineFontSize" || key === "buttonFontSize") value = value === "" ? "" : Number(value);
    setNestedValue(variant, key, value);
    syncLegacyVariantFromFlow(variant);
    if (key === "headlineHtml") {
      variant.headline = target.isContentEditable ? (target.textContent || "") : htmlToPlainText(value);
    }
    if (key === "subheadlineHtml") {
      variant.subheadline = target.isContentEditable ? (target.textContent || "") : htmlToPlainText(value);
    }
    if (key === "valueLineHtml") {
      variant.valueLine = target.isContentEditable ? (target.textContent || "") : htmlToPlainText(value);
    }

    saveDraftConfig();
    if (shouldRerenderEditorsForField(key)) {
      renderEditors();
    } else {
      var label = target.closest(".dash-editor-card").querySelector(".dash-editor-title span");
      if (label) label.textContent = buildVariantLabel(variant);
    }
    renderPreviews(previewMode);
    renderEmbedCode();
    populateFilters();
    updateDashboard();
  }

  function shouldRerenderEditorsForField(key) {
    if (/^flowSteps\.\d+\.(type|field|answerStyle|progressEnabled|enabled)$/.test(key)) return true;
    return [
      "proteinQuiz.showQuizStep",
      "proteinQuiz.showFirstName",
      "proteinQuiz.showEmail",
      "proteinQuiz.multiStepEnabled",
      "proteinQuiz.progressEnabled",
      "proteinQuiz.targetPreviewStyle"
    ].indexOf(key) >= 0;
  }

  function setNestedValue(target, path, value) {
    var parts = String(path || "").split(".");
    if (parts.length === 1) {
      target[path] = value;
      return;
    }

    var cursor = target;
    parts.slice(0, -1).forEach(function (part) {
      cursor[part] = cursor[part] || {};
      cursor = cursor[part];
    });
    cursor[parts[parts.length - 1]] = value;
  }

  function onEditorClick(event) {
    var flowAction = event.target.closest("[data-flow-action]");
    if (flowAction) {
      handleFlowAction(flowAction);
      return;
    }
    var testButton = event.target.closest("[data-test-popup]");
    if (testButton) {
      var testVariant = activeVariants()[Number(testButton.dataset.testPopup)];
      if (testVariant) {
        previewStep = Number(selectedFlowSteps[testVariant.id] || 0);
        renderPreviews(previewMode);
        showDashboardTestPopup(testVariant);
      }
      return;
    }

    var richButton = event.target.closest("[data-rich-command]");
    if (richButton) {
      applyRichCommand(richButton);
      return;
    }

    var richColorButton = event.target.closest("[data-rich-color]");
    if (richColorButton) {
      applyRichColor(richColorButton);
      return;
    }

    var colorButton = event.target.closest("[data-color-swatch-field]");
    if (colorButton) {
      applyInlineColor(colorButton);
      return;
    }

    var button = event.target.closest("[data-save-test]");
    if (!button) return;

    var variant = activeVariants()[Number(button.dataset.saveTest)];
    if (!variant) return;

    saveDraftConfig();
    sendSaveTestEvent(variant, button);
    showDashboardTestPopup(variant);
  }

  function onEditorFocus(event) {
    if (event.target && event.target.type === "color") {
      lastColorTarget = event.target;
    }
  }

  function renderProteinFlowEditor(variant, index) {
    var steps = ensureFlowSteps(variant);
    var selected = Math.min(Number(selectedFlowSteps[variant.id] || 0), Math.max(0, steps.length - 1));
    selectedFlowSteps[variant.id] = selected;
    var step = steps[selected];
    return [
      "<div class=\"dash-flow-editor dash-variant-flow-editor\">",
      "<div class=\"dash-flow-head\"><strong>Flow Builder</strong><span>Build the popup in the same order visitors experience it.</span></div>",
      renderFlowPresetBar(variant, index),
      "<div class=\"dash-step-sequence\">" + steps.map(function (item, stepIndex) { return renderFlowStepTab(item, stepIndex, selected, index); }).join("") + "<button class=\"dash-add-step\" type=\"button\" data-flow-action=\"add\" data-variant-index=\"" + index + "\">+ Add Step</button></div>",
      renderFlowStepEditor(variant, step, selected, index),
      "</div>"
    ].join("");
  }

  function editorInput(field, index, label, value, type, disabled) {
    if (type === "color") return editorColorInput(field, index, label, value, disabled);
    return "<label" + disabledFieldClass(disabled) + ">" + escapeHtml(label) + "<input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"" + type + "\" value=\"" + escapeHtmlAttr(value) + "\"" + disabledAttr(disabled) + "></label>";
  }

  function ensureFlowSteps(variant) {
    if (Array.isArray(variant.flowSteps) && variant.flowSteps.length) return variant.flowSteps;
    var quiz = getProteinQuizConfig(variant);
    var shared = {
      headlineHtml: variant.headlineHtml || escapeHtml(variant.headline || ""),
      subheadlineHtml: variant.subheadlineHtml || escapeHtml(variant.subheadline || ""),
      valueLineHtml: variant.valueLineHtml || escapeHtml(variant.valueLine || ""),
      imageUrl: variant.imageUrl || ""
    };
    var lead = Object.assign({}, shared, {
      id: flowStepId(), name: "Lead Form", type: "lead", enabled: true,
      headlineHtml: quiz.showQuizStep === false ? shared.headlineHtml : escapeHtml(quiz.leadHeadline || ""),
      subheadlineHtml: quiz.showQuizStep === false ? shared.subheadlineHtml : escapeHtml(quiz.leadSubheadline || ""),
      fields: [quiz.showFirstName === false ? "" : "name", quiz.showEmail === false ? "" : "email"].filter(Boolean),
      firstNameLabel: quiz.firstNameLabel, firstNamePlaceholder: quiz.firstNamePlaceholder,
      emailLabel: quiz.emailLabel, emailPlaceholder: quiz.emailPlaceholder,
      buttonText: quiz.leadButtonText || variant.buttonText || "Submit",
      progressEnabled: Boolean(quiz.progressEnabled), progressLabel: quiz.progressSingleStepLabel || "Step 1",
      targetPreviewStyle: quiz.showQuizStep === false ? "off" : quiz.targetPreviewStyle,
      targetPreviewLabel: quiz.targetPreviewLabel
    });
    lead.showFirstName = lead.fields.indexOf("name") >= 0;
    lead.showEmail = lead.fields.indexOf("email") >= 0;
    if (quiz.showQuizStep === false) variant.flowSteps = [lead];
    else if (quiz.multiStepEnabled === true) variant.flowSteps = [
      makeQuestionStep("Target Weight", "targetWeight", quiz.targetWeightLabel, quiz.targetWeightPlaceholder, quiz.targetWeightAnswerStyle, shared, quiz),
      makeQuestionStep("Strength Training", "strengthDays", quiz.strengthDaysLabel, quiz.strengthDaysPlaceholder, quiz.strengthDaysAnswerStyle, shared, quiz),
      makeQuestionStep("Age", "age", quiz.ageLabel, quiz.agePlaceholder, quiz.ageAnswerStyle, shared, quiz),
      lead
    ];
    else variant.flowSteps = [Object.assign({}, shared, {
      id: flowStepId(), name: "Protein Questions", type: "questions", enabled: true,
      fields: ["targetWeight", "strengthDays", "age"], buttonText: quiz.quizButtonText,
      targetWeightLabel: quiz.targetWeightLabel, targetWeightPlaceholder: quiz.targetWeightPlaceholder,
      strengthDaysLabel: quiz.strengthDaysLabel, strengthDaysPlaceholder: quiz.strengthDaysPlaceholder,
      ageLabel: quiz.ageLabel, agePlaceholder: quiz.agePlaceholder,
      progressEnabled: Boolean(quiz.progressEnabled), progressLabel: quiz.progressStepOneLabel,
      progressText: quiz.progressStepOneText
    }), lead];
    return variant.flowSteps;
  }

  function makeQuestionStep(name, field, label, placeholder, answerStyle, shared, quiz) {
    return Object.assign({}, shared, {
      id: flowStepId(), name: name, type: "question", enabled: true, field: field,
      questionLabel: label, placeholder: placeholder, answerStyle: answerStyle || "dropdown",
      required: true, autoAdvance: answerStyle === "ranges", buttonText: quiz.quizButtonText || "Continue",
      progressEnabled: Boolean(quiz.progressEnabled), progressLabel: "Question {current} of {total}"
    });
  }

  function flowStepId() {
    return "step_" + Math.random().toString(36).slice(2, 8);
  }

  function renderFlowPresetBar(variant, index) {
    return "<div class=\"dash-flow-presets\"><span>Start from:</span>" + [
      ["email", "Email Only"], ["combined", "All Questions + Email"], ["multi", "One Question Per Step"]
    ].map(function (preset) {
      return "<button type=\"button\" data-flow-action=\"preset\" data-preset=\"" + preset[0] + "\" data-variant-index=\"" + index + "\">" + preset[1] + "</button>";
    }).join("") + "</div>";
  }

  function renderFlowStepTab(step, stepIndex, selected, variantIndex) {
    return "<button class=\"dash-step-tab" + (stepIndex === selected ? " is-active" : "") + "\" type=\"button\" data-flow-action=\"select\" data-step-index=\"" + stepIndex + "\" data-variant-index=\"" + variantIndex + "\"><strong>" + (stepIndex + 1) + ". " + escapeHtml(step.name || step.type) + "</strong><span>" + escapeHtml(flowStepTypeLabel(step)) + "</span></button>";
  }

  function flowStepTypeLabel(step) {
    if (step.type === "lead") return "Lead form";
    if (step.type === "questions") return "3 questions";
    if (step.type === "message") return "Message";
    return step.answerStyle === "ranges" ? "Choice buttons" : (step.answerStyle || "Question");
  }

  function renderFlowStepEditor(variant, step, stepIndex, variantIndex) {
    if (!step) return "";
    var path = "flowSteps." + stepIndex + ".";
    var questionOptions = [{label:"Target Weight",value:"targetWeight"},{label:"Strength Training",value:"strengthDays"},{label:"Age",value:"age"},{label:"Custom Question",value:"custom"}];
    return [
      "<div class=\"dash-step-editor\"><div class=\"dash-step-editor-head\"><div><span>STEP " + (stepIndex + 1) + "</span><h4>" + escapeHtml(step.name || "Popup step") + "</h4></div><div class=\"dash-step-actions\">",
      stepIndex > 0 ? flowActionButton("up", "↑", variantIndex, stepIndex, "Move earlier") : "",
      stepIndex < variant.flowSteps.length - 1 ? flowActionButton("down", "↓", variantIndex, stepIndex, "Move later") : "",
      flowActionButton("duplicate", "Duplicate", variantIndex, stepIndex, "Duplicate step"),
      variant.flowSteps.length > 1 ? flowActionButton("delete", "Delete", variantIndex, stepIndex, "Delete step") : "",
      "</div></div><div class=\"dash-step-settings\">",
      editorInput(path + "name", variantIndex, "Internal step name", step.name || "", "text"),
      editorCheckbox(path + "enabled", variantIndex, "Step enabled", step.enabled !== false),
      editorOptionSelect(path + "type", variantIndex, "Step type", step.type, [{label:"Single question",value:"question"},{label:"Combined questions",value:"questions"},{label:"Lead form",value:"lead"},{label:"Message / result",value:"message"}]),
      editorInput(path + "imageUrl", variantIndex, "Hero image URL", step.imageUrl || "", "url"),
      editorRichText(path + "eyebrowHtml", variantIndex, "Eyebrow", step.eyebrowHtml || "", false, path + "eyebrowFontSize", step.eyebrowFontSize, 15, variant.brandAccentColor),
      editorRichText(path + "headlineHtml", variantIndex, "Headline", step.headlineHtml || "", false, path + "headlineFontSize", step.headlineFontSize || variant.headlineFontSize, 32, variant.textColor),
      editorRichText(path + "subheadlineHtml", variantIndex, "Subheadline", step.subheadlineHtml || "", false, path + "subheadlineFontSize", step.subheadlineFontSize || variant.subheadlineFontSize, 17, variant.textColor),
      editorRichText(path + "valueLineHtml", variantIndex, "Value line", step.valueLineHtml || "", false, path + "valueLineFontSize", step.valueLineFontSize || variant.valueLineFontSize, 15, variant.brandAccentColor),
      editorInput(path + "backgroundColor", variantIndex, "Step background (optional)", step.backgroundColor || variant.backgroundColor || "#ffffff", "color"),
      editorInput(path + "buttonColor", variantIndex, "Step button color", step.buttonColor || variant.accentColor || "#1f6feb", "color"),
      editorInput(path + "progressColor", variantIndex, "Progress color", step.progressColor || variant.brandAccentColor || "#06b00b", "color"),
      step.type === "question" ? editorOptionSelect(path + "field", variantIndex, "Question", step.field, questionOptions) : "",
      step.type === "question" ? editorInput(path + "questionLabel", variantIndex, "Question text", step.questionLabel || "", "text") : "",
      step.type === "question" ? editorOptionSelect(path + "answerStyle", variantIndex, "Answer style", step.answerStyle || "dropdown", [{label:"Dropdown",value:"dropdown"},{label:"Choice buttons",value:"ranges"},{label:"Number field",value:"number"},{label:"Text field",value:"text"}]) : "",
      step.type === "question" && step.answerStyle === "ranges" ? editorOptionSelect(path + "answerLayout", variantIndex, "Choice button layout", step.answerLayout || "grid", [{label:"Stacked (one column)",value:"stacked"},{label:"Grid (two columns)",value:"grid"}]) : "",
      step.type === "question" && step.answerStyle === "ranges" ? editorCompactSizeInput(path + "choiceButtonFontSize", variantIndex, "Choice button size", step.choiceButtonFontSize, 16) : "",
      step.type === "question" ? editorFontWeightSelect(path + "questionFontWeight", variantIndex, "Question weight", step.questionFontWeight || variant.bodyFontWeight || 400) : "",
      step.type === "question" && step.answerStyle === "ranges" ? editorFontWeightSelect(path + "choiceButtonFontWeight", variantIndex, "Choice button weight", step.choiceButtonFontWeight || variant.buttonFontWeight || 700) : "",
      step.type === "question" && step.answerStyle === "ranges" ? editorOptionSelect(path + "choiceButtonTransform", variantIndex, "Choice button capitalization", step.choiceButtonTransform || "none", [{label:"As written",value:"none"},{label:"ALL CAPS",value:"uppercase"}]) : "",
      step.type === "question" ? editorInput(path + "placeholder", variantIndex, "Placeholder", step.placeholder || "", "text") : "",
      step.type === "question" && step.answerStyle === "ranges" ? editorTextarea(path + "optionsText", variantIndex, "Choice buttons (Label | calculator value, one per line)", step.optionsText || defaultFlowOptionsText(step.field)) : "",
      step.type === "question" ? editorCheckbox(path + "required", variantIndex, "Required", step.required !== false) : "",
      step.type === "question" ? editorCheckbox(path + "autoAdvance", variantIndex, "Advance immediately after a choice", Boolean(step.autoAdvance)) : "",
      step.type === "questions" ? editorInput(path + "targetWeightLabel", variantIndex, "Target weight label", step.targetWeightLabel || "Target weight in lbs", "text") : "",
      step.type === "questions" ? editorInput(path + "targetWeightPlaceholder", variantIndex, "Target weight placeholder", step.targetWeightPlaceholder || "155", "text") : "",
      step.type === "questions" ? editorInput(path + "strengthDaysLabel", variantIndex, "Strength days label", step.strengthDaysLabel || "Strength training days", "text") : "",
      step.type === "questions" ? editorInput(path + "strengthDaysPlaceholder", variantIndex, "Strength days placeholder", step.strengthDaysPlaceholder || "Select days", "text") : "",
      step.type === "questions" ? editorInput(path + "ageLabel", variantIndex, "Age label", step.ageLabel || "Age", "text") : "",
      step.type === "questions" ? editorInput(path + "agePlaceholder", variantIndex, "Age placeholder", step.agePlaceholder || "48", "text") : "",
      step.type === "lead" ? editorCheckbox(path + "showFirstName", variantIndex, "Collect first name", (step.fields || []).indexOf("name") >= 0) : "",
      step.type === "lead" ? editorCheckbox(path + "showEmail", variantIndex, "Collect email", (step.fields || []).indexOf("email") >= 0) : "",
      step.type === "lead" ? editorInput(path + "firstNamePlaceholder", variantIndex, "First name placeholder", step.firstNamePlaceholder || "First Name", "text") : "",
      step.type === "lead" ? editorInput(path + "emailPlaceholder", variantIndex, "Email placeholder", step.emailPlaceholder || "Email", "text") : "",
      step.type === "lead" ? editorProteinTargetPreviewSelect(path + "targetPreviewStyle", variantIndex, "Protein target display", step.targetPreviewStyle || "off") : "",
      editorTextWithSize(path + "buttonText", path + "buttonFontSize", variantIndex, "Button CTA", step.buttonText || "Continue", step.buttonFontSize || variant.buttonFontSize, 16),
      "<div class=\"dash-flow-divider\"><span>Progress & navigation</span></div>",
      editorCheckbox(path + "progressEnabled", variantIndex, "Show progress bar", Boolean(step.progressEnabled)),
      editorOptionSelect(path + "progressScope", variantIndex, "Progress counts", step.progressScope || "all", [{label:"All visible steps",value:"all"},{label:"Questions only",value:"questions"}], !step.progressEnabled),
      editorInput(path + "progressLabel", variantIndex, "Progress label", step.progressLabel || "Step {current} of {total}", "text", !step.progressEnabled),
      editorCheckbox(path + "showBack", variantIndex, "Show back arrow", stepIndex > 0 && step.showBack !== false, stepIndex === 0),
      "</div></div>"
    ].join("");
  }

  function flowActionButton(action, text, variantIndex, stepIndex, label) {
    return "<button type=\"button\" data-flow-action=\"" + action + "\" data-variant-index=\"" + variantIndex + "\" data-step-index=\"" + stepIndex + "\" aria-label=\"" + label + "\">" + text + "</button>";
  }

  function handleFlowAction(button) {
    var variantIndex = Number(button.dataset.variantIndex);
    var variant = activeVariants()[variantIndex];
    if (!variant) return;
    var steps = ensureFlowSteps(variant);
    var index = Number(button.dataset.stepIndex || 0);
    var action = button.dataset.flowAction;
    if (action === "select") selectedFlowSteps[variant.id] = index;
    if (action === "add") {
      steps.push(makeBlankFlowStep("question", variant));
      selectedFlowSteps[variant.id] = steps.length - 1;
    }
    if (action === "delete" && steps.length > 1) {
      steps.splice(index, 1);
      selectedFlowSteps[variant.id] = Math.max(0, index - 1);
    }
    if (action === "duplicate") {
      var copy = cloneConfig(steps[index]); copy.id = flowStepId(); copy.name = (copy.name || "Step") + " Copy";
      steps.splice(index + 1, 0, copy); selectedFlowSteps[variant.id] = index + 1;
    }
    if ((action === "up" && index > 0) || (action === "down" && index < steps.length - 1)) {
      var next = action === "up" ? index - 1 : index + 1;
      var moved = steps.splice(index, 1)[0]; steps.splice(next, 0, moved); selectedFlowSteps[variant.id] = next;
    }
    if (action === "preset") applyFlowPreset(variant, button.dataset.preset);
    syncLegacyVariantFromFlow(variant);
    saveDraftConfig(); renderEditors(); renderPreviews(previewMode); renderEmbedCode(); updateDashboard();
  }

  function makeBlankFlowStep(type, variant) {
    return {id:flowStepId(),name:"New Question",type:type,enabled:true,field:"custom",questionLabel:"Your question",answerStyle:"text",answerLayout:"grid",choiceButtonFontSize:16,choiceButtonTransform:"none",placeholder:"",required:true,autoAdvance:false,eyebrowHtml:"",eyebrowFontSize:15,headlineHtml:"",subheadlineHtml:"",valueLineHtml:"",imageUrl:variant.imageUrl || "",buttonText:"Continue",buttonColor:variant.accentColor || "",progressColor:variant.brandAccentColor || "",progressEnabled:true,progressLabel:"Step {current} of {total}",showBack:true};
  }

  function applyFlowPreset(variant, preset) {
    delete variant.flowSteps;
    var quiz = variant.proteinQuiz = variant.proteinQuiz || {};
    quiz.showQuizStep = preset !== "email";
    quiz.multiStepEnabled = preset === "multi";
    quiz.showFirstName = false; quiz.showEmail = true;
    ensureFlowSteps(variant);
    selectedFlowSteps[variant.id] = 0;
  }

  function syncLegacyVariantFromFlow(variant) {
    var steps = variant.flowSteps || [];
    var lead = steps.filter(function (step) { return step.enabled !== false && step.type === "lead"; })[0];
    var quiz = variant.proteinQuiz = variant.proteinQuiz || {};
    quiz.showQuizStep = steps.some(function (step) { return step.enabled !== false && (step.type === "question" || step.type === "questions"); });
    quiz.multiStepEnabled = steps.filter(function (step) { return step.enabled !== false && step.type === "question"; }).length > 1;
    if (lead) {
      lead.fields = [lead.showFirstName ? "name" : "", lead.showEmail === false ? "" : "email"].filter(Boolean);
      quiz.showFirstName = lead.fields.indexOf("name") >= 0; quiz.showEmail = lead.fields.indexOf("email") >= 0;
      quiz.leadButtonText = lead.buttonText || quiz.leadButtonText; quiz.leadHeadline = htmlToPlainText(lead.headlineHtml); quiz.leadSubheadline = htmlToPlainText(lead.subheadlineHtml);
    }
    var first = steps[0];
    if (first) { variant.headlineHtml = first.headlineHtml || ""; variant.headline = htmlToPlainText(first.headlineHtml); variant.subheadlineHtml = first.subheadlineHtml || ""; variant.subheadline = htmlToPlainText(first.subheadlineHtml); variant.valueLineHtml = first.valueLineHtml || ""; variant.imageUrl = first.imageUrl || ""; }
  }

  function editorColorInput(field, index, label, value, disabled) {
    return [
      "<label" + disabledFieldClass(disabled) + ">",
      escapeHtml(label),
      "<div class=\"dash-color-control-row\">",
      "<input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"color\" value=\"" + escapeHtmlAttr(value) + "\"" + disabledAttr(disabled) + ">",
      renderSavedColorButtons("data-color-swatch-field=\"" + escapeHtmlAttr(field) + "\" data-variant-index=\"" + index + "\"", disabled),
      "</div>",
      "</label>"
    ].join("");
  }

  function editorTextWithSize(textField, sizeField, index, label, textValue, sizeValue, defaultSize, disabled) {
    return [
      "<label" + disabledFieldClass(disabled) + ">",
      escapeHtml(label),
      "<div class=\"dash-inline-size-row\">",
      "<input data-variant-index=\"" + index + "\" data-field=\"" + textField + "\" type=\"text\" value=\"" + escapeHtmlAttr(textValue) + "\"" + disabledAttr(disabled) + ">",
      renderInlineSizeInput(sizeField, index, sizeValue, defaultSize, disabled, label + " size"),
      "</div>",
      "</label>"
    ].join("");
  }

  function editorCompactSizeInput(field, index, label, value, defaultValue, disabled) {
    return [
      "<label" + disabledFieldClass(disabled) + ">",
      escapeHtml(label),
      renderInlineSizeInput(field, index, value, defaultValue, disabled, label),
      "</label>"
    ].join("");
  }

  function editorCheckbox(field, index, label, checked, disabled) {
    return "<label class=\"dash-checkbox-label" + (disabled ? " dash-disabled-field" : "") + "\"><input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"checkbox\"" + (checked ? " checked" : "") + disabledAttr(disabled) + "><span>" + escapeHtml(label) + "</span></label>";
  }

  function editorTextarea(field, index, label, value, disabled) {
    return "<label" + disabledFieldClass(disabled) + ">" + escapeHtml(label) + "<textarea data-variant-index=\"" + index + "\" data-field=\"" + field + "\"" + disabledAttr(disabled) + ">" + escapeHtml(value) + "</textarea></label>";
  }

  function htmlToPlainText(value) {
    var template = document.createElement("template");
    template.innerHTML = sanitizeRichHtml(value || "");
    return template.content.textContent || "";
  }

  function editorRichText(field, index, label, value, disabled, sizeField, sizeValue, defaultSize, colorValue) {
    var pickerColor = richTextInputColor(value, colorValue || "#172026");
    return [
      "<div class=\"dash-rich-field" + (disabled ? " dash-disabled-field" : "") + "\">",
      "<span>" + escapeHtml(label) + "</span>",
      "<div class=\"dash-rich-toolbar\">",
      "<button type=\"button\" data-rich-command=\"bold\"" + disabledAttr(disabled) + ">B</button>",
      "<button type=\"button\" data-rich-command=\"italic\"" + disabledAttr(disabled) + ">I</button>",
      "<button type=\"button\" data-rich-command=\"underline\"" + disabledAttr(disabled) + ">U</button>",
      "<input type=\"color\" data-rich-command=\"foreColor\" value=\"" + escapeHtmlAttr(pickerColor) + "\" aria-label=\"" + escapeHtmlAttr(label) + " text color\"" + disabledAttr(disabled) + ">",
      renderSavedColorButtons("data-rich-color=\"true\"", disabled),
      sizeField ? renderInlineSizeInput(sizeField, index, sizeValue, defaultSize, disabled, label + " size") : "",
      "</div>",
      "<div class=\"dash-rich-editor\" contenteditable=\"" + (disabled ? "false" : "true") + "\" data-variant-index=\"" + index + "\" data-field=\"" + field + "\">" + sanitizeRichHtml(value) + "</div>",
      "</div>"
    ].join("");
  }

  function renderInlineSizeInput(field, index, value, defaultValue, disabled, label) {
    var visibleValue = value || defaultValue || "";
    return "<span class=\"dash-size-control\"><input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"number\" min=\"8\" max=\"96\" step=\"1\" value=\"" + escapeHtmlAttr(visibleValue) + "\" aria-label=\"" + escapeHtmlAttr(label || "Text size") + "\"" + disabledAttr(disabled) + "><em>px</em></span>";
  }

  function applyRichCommand(control) {
    var field = control.closest(".dash-rich-field");
    var editor = field && field.querySelector(".dash-rich-editor");
    if (!editor) return;

    editor.focus();
    if (control.dataset.richCommand === "foreColor") {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, control.value);
    } else {
      document.execCommand(control.dataset.richCommand, false, null);
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyRichColor(button) {
    var field = button.closest(".dash-rich-field");
    var colorInput = field && field.querySelector("input[data-rich-command=\"foreColor\"]");
    if (!colorInput) return;
    colorInput.value = button.dataset.color || colorInput.value;
    applyRichCommand(colorInput);
  }

  function applyInlineColor(button) {
    var card = button.closest(".dash-editor-card");
    var input = card && card.querySelector("input[data-field=\"" + cssEscape(button.dataset.colorSwatchField || "") + "\"][data-variant-index=\"" + cssEscape(button.dataset.variantIndex || "") + "\"]");
    if (!input) return;
    input.value = button.dataset.color || input.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderSavedColorButtons(attributes, disabled) {
    return "<span class=\"dash-inline-swatches\">" + getSavedColors().slice(0, 4).map(function (color) {
      return "<button type=\"button\" " + attributes + " data-color=\"" + escapeHtmlAttr(color) + "\" style=\"background:" + escapeHtmlAttr(color) + "\" aria-label=\"Apply saved color " + escapeHtmlAttr(color) + "\"" + disabledAttr(disabled) + "></button>";
    }).join("") + "</span>";
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(String(value || ""));
    return String(value || "").replace(/["\\]/g, "\\$&");
  }

  function editorSelect(field, index, label, value) {
    var options = [
      { label: "Poppins", value: "Poppins, Arial, sans-serif" },
      { label: "Montserrat", value: "Montserrat, Arial, sans-serif" },
      { label: "DM Sans", value: "'DM Sans', Arial, sans-serif" },
      { label: "Nunito Sans", value: "'Nunito Sans', Arial, sans-serif" },
      { label: "League Spartan", value: "'League Spartan', Arial, sans-serif" },
      { label: "Oswald", value: "Oswald, Arial, sans-serif" },
      { label: "Arial", value: "Arial, Helvetica, sans-serif" },
      { label: "Inter", value: "Inter, Arial, sans-serif" },
      { label: "Helvetica Neue", value: "'Helvetica Neue', Arial, sans-serif" },
      { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
      { label: "Georgia", value: "Georgia, serif" }
    ];
    return "<label>" + escapeHtml(label) + "<select data-variant-index=\"" + index + "\" data-field=\"" + field + "\">" + options.map(function (option) {
      return "<option value=\"" + escapeHtmlAttr(option.value) + "\"" + (option.value === value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("") + "</select></label>";
  }

  function editorFontWeightSelect(field, index, label, value) {
    return editorOptionSelect(field, index, label, String(value || 400), [
      { label: "Regular (400)", value: "400" },
      { label: "Medium (500)", value: "500" },
      { label: "Semi-bold (600)", value: "600" },
      { label: "Bold (700)", value: "700" },
      { label: "Extra-bold (800)", value: "800" }
    ]);
  }

  function editorAlignmentSelect(field, index, label, value) {
    var options = [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" }
    ];
    return "<label>" + escapeHtml(label) + "<select data-variant-index=\"" + index + "\" data-field=\"" + field + "\">" + options.map(function (option) {
      return "<option value=\"" + escapeHtml(option.value) + "\"" + (option.value === value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("") + "</select></label>";
  }

  function editorProteinTargetPreviewSelect(field, index, label, value, disabled) {
    var options = [
      { label: "Off", value: "off" },
      { label: "Inline text", value: "inline" },
      { label: "Calculator box", value: "box" }
    ];
    return "<label" + disabledFieldClass(disabled) + ">" + escapeHtml(label) + "<select data-variant-index=\"" + index + "\" data-field=\"" + field + "\"" + disabledAttr(disabled) + ">" + options.map(function (option) {
      return "<option value=\"" + escapeHtmlAttr(option.value) + "\"" + (option.value === value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("") + "</select></label>";
  }

  function editorOptionSelect(field, index, label, value, options, disabled) {
    return "<label" + disabledFieldClass(disabled) + ">" + escapeHtml(label) + "<select data-variant-index=\"" + index + "\" data-field=\"" + field + "\"" + disabledAttr(disabled) + ">" + options.map(function (option) {
      return "<option value=\"" + escapeHtmlAttr(option.value) + "\"" + (option.value === value ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
    }).join("") + "</select></label>";
  }

  function disabledFieldClass(disabled) {
    return disabled ? " class=\"dash-disabled-field\"" : "";
  }

  function disabledAttr(disabled) {
    return disabled ? " disabled aria-disabled=\"true\"" : "";
  }

  function renderPalette() {
    var colors = getSavedColors();
    els.savedColors.innerHTML = colors.map(function (color, index) {
      return [
        "<div class=\"dash-palette-swatch\">",
        "<button type=\"button\" data-palette-apply=\"" + index + "\" style=\"background:" + escapeHtml(color) + "\" aria-label=\"Apply saved color " + escapeHtml(color) + "\"></button>",
        "<input type=\"color\" data-palette-index=\"" + index + "\" value=\"" + escapeHtml(color) + "\">",
        "</div>"
      ].join("");
    }).join("");
  }

  function onPaletteInput(event) {
    var target = event.target;
    if (!target || target.dataset.paletteIndex === undefined) return;

    var colors = getSavedColors();
    colors[Number(target.dataset.paletteIndex)] = target.value;
    config.savedColors = colors;
    saveDraftConfig();
    renderEditors();
    renderPreviews(previewMode);
  }

  function onPaletteClick(event) {
    var button = event.target.closest("[data-palette-apply]");
    if (!button) return;

    var color = getSavedColors()[Number(button.dataset.paletteApply)];
    if (!lastColorTarget || !lastColorTarget.dataset) return;

    lastColorTarget.value = color;
    lastColorTarget.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function getSavedColors() {
    var defaults = ["#111827", "#ffffff", "#f8fafc", "#172026", "#1f6feb", "#0f766e", "#c2410c", "#fbfaf7", "#1c2520", "#d9dee7"];
    return (config.savedColors || defaults).slice(0, 10).concat(defaults).slice(0, 10);
  }

  function populateFilters() {
    setOptions(els.testId, unique(["", config.testId].concat(rows.map(function (row) {
      return row.testId;
    }))), "All tests");

    setOptions(els.variant, unique([""].concat(config.variants.map(function (variant) {
      return variant.id;
    })).concat(rows.map(function (row) {
      return row.variant;
    }))), "All variants");

    setOptions(els.version, unique(["", LATEST_TWO_VERSIONS, originalConfig.configVersion, config.configVersion].concat(publishedActiveVariants().map(function (variant) {
      return getVariantTrackingVersion(variant);
    })).concat(activeVariants().map(function (variant) {
      return getVariantTrackingVersion(variant);
    })).concat(rows.map(function (row) {
      return row.configVersion || "unversioned";
    }))), "All versions");

    if (!versionFilterInitialized) {
      els.version.value = LATEST_TWO_VERSIONS;
      versionFilterInitialized = true;
    }
  }

  function setOptions(select, values, allLabel) {
    var current = select.value;
    select.innerHTML = "";
    values.filter(Boolean).forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = optionLabel(value);
      select.appendChild(option);
    });

    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    select.insertBefore(all, select.firstChild);
    select.value = values.indexOf(current) >= 0 ? current : "";
  }

  function optionLabel(value) {
    if (value === LATEST_TWO_VERSIONS) return "Current live variants";
    return value;
  }

  function updateDashboard() {
    var filtered = applyFilters(rows);
    var historyFiltered = applyHistoryFilters(rows);
    var fullHistoryFiltered = applyFullHistoryBaseFilters(rows);
    var builtMetrics = buildMetrics(filtered);
    var metrics = getVisibleMetrics(builtMetrics);
    var sinceLastUpdateMetrics = buildUnchangedSinceLastUpdateMetrics(filtered, metrics);
    renderHiddenMetricsNotice(builtMetrics.length - metrics.length);
    renderStats(metrics);
    renderTable(metrics, sinceLastUpdateMetrics);
    renderCharts(metrics);
    renderRecommendations(metrics);
    renderVariationHistory(historyFiltered);
    renderFullVariantHistory(fullHistoryFiltered);
  }

  function applyFilters(data) {
    var start = els.start.value ? new Date(els.start.value + "T00:00:00") : null;
    var end = els.end.value ? new Date(els.end.value + "T23:59:59") : null;
    var pageNeedle = els.pageUrl.value.trim().toLowerCase();
    var liveVersions = els.version.value === LATEST_TWO_VERSIONS ? getLiveVariantVersions() : null;

    return data.filter(function (row) {
      var timestamp = row.timestamp ? new Date(row.timestamp) : null;
      if (els.testId.value && row.testId !== els.testId.value) return false;
      if (els.variant.value && row.variant !== els.variant.value) return false;
      if (liveVersions && (row.configVersion || "unversioned") !== liveVersions[row.variant]) return false;
      if (els.version.value && els.version.value !== LATEST_TWO_VERSIONS && (row.configVersion || "unversioned") !== els.version.value) return false;
      if (els.device.value && row.deviceType !== els.device.value) return false;
      if (start && timestamp && timestamp < start) return false;
      if (end && timestamp && timestamp > end) return false;
      if (pageNeedle && String(row.pageUrl || "").toLowerCase().indexOf(pageNeedle) === -1) return false;
      return true;
    });
  }

  function applyHistoryFilters(data) {
    var start = els.start.value ? new Date(els.start.value + "T00:00:00") : null;
    var end = els.end.value ? new Date(els.end.value + "T23:59:59") : null;
    var pageNeedle = els.pageUrl.value.trim().toLowerCase();
    var liveVersions = els.version.value === LATEST_TWO_VERSIONS ? getLiveVariantVersions() : null;

    return data.filter(function (row) {
      var timestamp = row.timestamp ? new Date(row.timestamp) : null;
      if (els.testId.value && row.testId !== els.testId.value) return false;
      if (els.variant.value && row.variant !== els.variant.value) return false;
      if (liveVersions && (row.configVersion || "unversioned") !== liveVersions[row.variant]) return false;
      if (els.version.value && els.version.value !== LATEST_TWO_VERSIONS && (row.configVersion || "unversioned") !== els.version.value) return false;
      if (els.device.value && row.deviceType !== els.device.value) return false;
      if (start && timestamp && timestamp < start) return false;
      if (end && timestamp && timestamp > end) return false;
      if (pageNeedle && String(row.pageUrl || "").toLowerCase().indexOf(pageNeedle) === -1) return false;
      return true;
    });
  }

  function applyFullHistoryBaseFilters(data) {
    var start = els.start.value ? new Date(els.start.value + "T00:00:00") : null;
    var end = els.end.value ? new Date(els.end.value + "T23:59:59") : null;
    var pageNeedle = els.pageUrl.value.trim().toLowerCase();

    return data.filter(function (row) {
      var timestamp = row.timestamp ? new Date(row.timestamp) : null;
      if (els.testId.value && row.testId !== els.testId.value) return false;
      if (els.device.value && row.deviceType !== els.device.value) return false;
      if (start && timestamp && timestamp < start) return false;
      if (end && timestamp && timestamp > end) return false;
      if (pageNeedle && String(row.pageUrl || "").toLowerCase().indexOf(pageNeedle) === -1) return false;
      return true;
    });
  }

  function buildMetrics(data, seedVariants) {
    var variants = seedVariants || publishedActiveVariants();
    var byVariant = {};

    variants.forEach(function (variant) {
      var liveVersion = getVariantTrackingVersion(variant);
      var defaultKey = metricKey(liveVersion, variant.id);
      byVariant[defaultKey] = {
        variant: variant.id,
        configVersion: liveVersion,
        sessions: new Set(),
        actionSessions: new Set(),
        leadSessions: new Set(),
        submitSessions: new Set(),
        views: 0,
        clicks: 0,
        quizSubmits: 0,
        leads: 0,
        submits: 0,
        closes: 0
      };
    });

    data.forEach(function (row) {
      var rowVersion = row.configVersion || "unversioned";
      var rowKey = metricKey(rowVersion, row.variant || "Unknown");
      if (!byVariant[rowKey]) {
        byVariant[rowKey] = {
          variant: row.variant || "Unknown",
          configVersion: rowVersion,
          sessions: new Set(),
          actionSessions: new Set(),
          leadSessions: new Set(),
          submitSessions: new Set(),
          views: 0,
          clicks: 0,
          quizSubmits: 0,
          leads: 0,
          submits: 0,
          closes: 0
        };
      }

      var item = byVariant[rowKey];
      var type = eventType(row);
      if (row.sessionId && (type === "popup_quiz_submit" || type === "popup_lead_submit" || type === "kajabi_form_submitted" || type === "popup_submit_attempt")) {
        item.actionSessions.add(row.sessionId);
      }
      if (type === "popup_view") {
        if (row.sessionId) item.sessions.add(row.sessionId);
        item.views += 1;
      }
      if (type === "popup_form_click") item.clicks += 1;
      if (type === "popup_quiz_submit") item.quizSubmits += 1;
      if (type === "popup_lead_submit" || type === "kajabi_form_submitted") {
        item.leads += 1;
        if (row.sessionId) item.leadSessions.add(row.sessionId);
      }
      if (type === "popup_submit_attempt" || type === "popup_lead_submit" || type === "kajabi_form_submitted") {
        item.submits += 1;
        if (row.sessionId) item.submitSessions.add(row.sessionId);
      }
      if (type === "popup_close") item.closes += 1;
    });

    var result = Object.keys(byVariant).sort().map(function (key) {
      var item = byVariant[key];
      item.actionSessions.forEach(function (sessionId) {
        if (!item.sessions.has(sessionId)) item.sessions.add(sessionId);
      });
      var inferredViews = Math.max(item.views, item.sessions.size, item.quizSubmits, item.leads, item.submits);
      var sessionCount = item.sessions.size || inferredViews;
      var fullSubmissions = uniqueFullSubmissionCount(item);
      var fullConversionRate = rate(fullSubmissions, sessionCount);
      return {
        variant: item.variant,
        configVersion: item.configVersion,
        sessions: sessionCount,
        views: inferredViews,
        trackedViews: item.views,
        inferredViews: Math.max(0, inferredViews - item.views),
        viewRate: rate(inferredViews, sessionCount),
        clicks: item.clicks,
        clickRate: rate(item.clicks, inferredViews),
        quizSubmits: item.quizSubmits,
        quizRate: rate(item.quizSubmits, inferredViews),
        leads: item.leads,
        fullSubmissions: fullSubmissions,
        leadRate: fullConversionRate,
        submits: item.submits,
        submitRate: fullConversionRate,
        closes: item.closes,
        closeRate: rate(item.closes, inferredViews),
        cvr: fullConversionRate,
        lift: 0
      };
    });

    var controlRates = {};
    var liveControl = null;
    result.forEach(function (item) {
      if (item.variant === "A") controlRates[item.configVersion] = item.cvr;
      if (item.variant === "A" && isLiveMetricRow(item)) liveControl = item;
    });
    result.forEach(function (item) {
      var controlRate = controlRates[item.configVersion] || (isLiveMetricRow(item) && liveControl ? liveControl.cvr : 0);
      var comparisonRate = item.cvr;
      item.lift = controlRate > 0 ? (comparisonRate / controlRate) - 1 : 0;
    });

    return result;
  }

  function buildUnchangedSinceLastUpdateMetrics(filteredRows, visibleMetrics) {
    if (els.version.value !== LATEST_TWO_VERSIONS) return [];

    var publishVersion = originalConfig.configVersion || config.configVersion || "";
    if (!publishVersion) return [];

    var liveVariants = publishedActiveVariants();
    var changedVariants = liveVariants.filter(function (variant) {
      return getVariantTrackingVersion(variant) === publishVersion;
    });
    var unchangedVariants = liveVariants.filter(function (variant) {
      return getVariantTrackingVersion(variant) !== publishVersion;
    });

    if (!changedVariants.length || !unchangedVariants.length) return [];

    var changedIds = changedVariants.map(function (variant) {
      return variant.id;
    });
    var unchangedIds = unchangedVariants.map(function (variant) {
      return variant.id;
    });
    var liveVersions = getLiveVariantVersions();
    var boundary = filteredRows.reduce(function (earliest, row) {
      if (changedIds.indexOf(row.variant) < 0) return earliest;
      if ((row.configVersion || "unversioned") !== publishVersion) return earliest;
      var timestamp = parseRowTimestamp(row);
      if (!timestamp) return earliest;
      return earliest && earliest < timestamp ? earliest : timestamp;
    }, null);

    if (!boundary) return [];

    var subsetRows = filteredRows.filter(function (row) {
      if (unchangedIds.indexOf(row.variant) < 0) return false;
      if ((row.configVersion || "unversioned") !== liveVersions[row.variant]) return false;
      var timestamp = parseRowTimestamp(row);
      return timestamp && timestamp >= boundary;
    });

    var visibleKeys = (visibleMetrics || []).reduce(function (keys, item) {
      keys[metricRowKey(item)] = true;
      return keys;
    }, {});

    return buildMetrics(subsetRows, unchangedVariants).filter(function (item) {
      return visibleKeys[metricRowKey(item)];
    }).map(function (item) {
      item.isSinceLastUpdate = true;
      item.sinceLabel = "Since " + publishVersion + " update";
      return item;
    });
  }

  function parseRowTimestamp(row) {
    var timestamp = row && row.timestamp ? new Date(row.timestamp) : null;
    return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
  }

  function eventType(row) {
    var raw = String(row && row.eventType || "").trim().toLowerCase();
    var normalized = raw.replace(/[^a-z0-9]/g, "");
    var aliases = {
      popupview: "popup_view",
      view: "popup_view",
      impression: "popup_view",
      popupformclick: "popup_form_click",
      formclick: "popup_form_click",
      click: "popup_form_click",
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
      formsubmitted: "kajabi_form_submitted",
      popupclose: "popup_close",
      close: "popup_close",
      variantsavetest: "variant_save_test"
    };
    return aliases[normalized] || raw;
  }

  function renderStats(metrics) {
    var allSingleStep = metrics.length > 0 && metrics.every(isSingleStepMetric);
    updateMetricLabels(allSingleStep);
    var totals = metrics.reduce(function (sum, item) {
      sum.views += item.views;
      sum.sessions += item.sessions;
      sum.clicks += item.clicks;
      sum.quizSubmits += item.quizSubmits;
      sum.leads += item.leads;
      sum.fullSubmissions += item.fullSubmissions;
      sum.submits += item.submits;
      sum.closes += item.closes;
      return sum;
    }, { sessions: 0, views: 0, clicks: 0, quizSubmits: 0, leads: 0, fullSubmissions: 0, submits: 0, closes: 0 });

    document.getElementById("stat-views").textContent = formatNumber(totals.views);
    document.getElementById("stat-quiz-submits").textContent = allSingleStep ? "N/A" : formatNumber(totals.quizSubmits);
    document.getElementById("stat-leads").textContent = formatNumber(totals.fullSubmissions);
    document.getElementById("stat-close-rate").textContent = formatPercent(rate(totals.fullSubmissions, totals.sessions));
  }

  function updateMetricLabels(allSingleStep) {
    var quizLabel = document.getElementById("stat-quiz-label");
    var clicksHeading = document.getElementById("metric-clicks-heading");
    var clickRateHeading = document.getElementById("metric-click-rate-heading");
    if (quizLabel) quizLabel.textContent = allSingleStep ? "Quiz completions" : "Quiz completions";
    if (clicksHeading) clicksHeading.textContent = allSingleStep ? "Submit Clicks" : "Clicks";
    if (clickRateHeading) clickRateHeading.textContent = allSingleStep ? "Submit Click Rate" : "Click Rate";
  }

  function renderTable(metrics, sinceLastUpdateMetrics) {
    els.body.innerHTML = "";
    els.warning.hidden = !metrics.some(function (item) {
      return activeVariants().some(function (variant) {
        return variant.id === item.variant;
      }) && item.views > 0 && item.views < 100;
    });

    var sinceByVariant = (sinceLastUpdateMetrics || []).reduce(function (map, item) {
      map[item.variant] = item;
      return map;
    }, {});

    metrics.forEach(function (item) {
      var row = document.createElement("tr");
      var live = isLiveMetricRow(item);
      var singleStep = isSingleStepMetric(item);
      [
        { html: escapeHtml(item.variant) + (live ? " <span class=\"dash-live-badge\">Live</span>" : "") },
        item.configVersion,
        formatNumber(item.sessions),
        formatNumber(item.views),
        formatPercent(item.viewRate),
        formatNumber(item.clicks),
        formatPercent(item.clickRate),
        singleStep ? "N/A" : formatNumber(item.quizSubmits),
        singleStep ? "N/A" : formatPercent(item.quizRate),
        formatNumber(item.fullSubmissions),
        formatPercent(item.cvr),
        formatNumber(item.closes),
        item.variant === "A" ? "Control" : formatPercent(item.lift, true),
        { html: "<button class=\"dash-row-remove\" type=\"button\" data-metric-remove=\"" + escapeHtmlAttr(metricRowKey(item)) + "\" aria-label=\"Hide performance row\">&times;</button>" }
      ].forEach(function (value) {
        var cell = document.createElement("td");
        if (value && typeof value === "object" && value.html) {
          cell.innerHTML = value.html;
        } else {
          cell.textContent = value;
        }
        row.appendChild(cell);
      });
      els.body.appendChild(row);
      if (live && sinceByVariant[item.variant]) {
        els.body.appendChild(buildSinceLastUpdateRow(sinceByVariant[item.variant]));
      }
    });
  }

  function buildSinceLastUpdateRow(item) {
    var row = document.createElement("tr");
    row.className = "dash-submetric-row";
    var singleStep = isSingleStepMetric(item);
    [
      { html: "<span class=\"dash-submetric-variant\">" + escapeHtml(item.variant) + "</span> <span class=\"dash-submetric-label\">" + escapeHtml(item.sinceLabel || "Since last update") + "</span>" },
      item.configVersion,
      formatNumber(item.sessions),
      formatNumber(item.views),
      formatPercent(item.viewRate),
      formatNumber(item.clicks),
      formatPercent(item.clickRate),
      singleStep ? "N/A" : formatNumber(item.quizSubmits),
      singleStep ? "N/A" : formatPercent(item.quizRate),
      formatNumber(item.fullSubmissions),
      formatPercent(item.cvr),
      formatNumber(item.closes),
      item.variant === "A" ? "Control" : formatPercent(item.lift, true),
      ""
    ].forEach(function (value) {
      var cell = document.createElement("td");
      if (value && typeof value === "object" && value.html) {
        cell.innerHTML = value.html;
      } else {
        cell.textContent = value;
      }
      row.appendChild(cell);
    });
    return row;
  }

  function getVisibleMetrics(metrics) {
    var hidden = getHiddenMetricKeys();
    return metrics.filter(function (item) {
      return hidden.indexOf(metricRowKey(item)) < 0;
    });
  }

  function renderHiddenMetricsNotice(hiddenCount) {
    if (!els.hiddenMetricsStatus || !els.showHiddenMetrics) return;

    els.hiddenMetricsStatus.hidden = hiddenCount <= 0;
    els.showHiddenMetrics.hidden = hiddenCount <= 0;
    els.hiddenMetricsStatus.textContent = hiddenCount > 0
      ? hiddenCount + " performance row" + (hiddenCount === 1 ? "" : "s") + " hidden."
      : "";
  }

  function clearHiddenMetrics() {
    localStorage.removeItem(HIDDEN_METRICS_KEY);
    updateDashboard();
  }

  function onMetricRowClick(event) {
    var button = event.target.closest("[data-metric-remove]");
    if (!button) return;

    var key = button.dataset.metricRemove;
    var hidden = getHiddenMetricKeys();
    if (hidden.indexOf(key) < 0) hidden.push(key);
    localStorage.setItem(HIDDEN_METRICS_KEY, JSON.stringify(hidden));
    updateDashboard();
  }

  function metricRowKey(item) {
    return [item && item.configVersion || "unversioned", item && item.variant || "Unknown"].join("::");
  }

  function getHiddenMetricKeys() {
    try {
      var value = JSON.parse(localStorage.getItem(HIDDEN_METRICS_KEY)) || [];
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function isLiveMetricRow(item) {
    if (!item) return false;
    return publishedActiveVariants().some(function (variant) {
      return variant.id === item.variant && item.configVersion === getVariantTrackingVersion(variant);
    });
  }

  function isSingleStepMetric(item) {
    if (!item) return false;
    var variant = publishedActiveVariants().find(function (candidate) {
      return candidate.id === item.variant && item.configVersion === getVariantTrackingVersion(candidate);
    });
    if (!variant) return false;
    return getProteinQuizConfig(variant).showQuizStep === false;
  }

  function renderRecommendations(metrics) {
    var messages = [];
    var active = metrics.filter(function (item) {
      return item.views > 0;
    });

    if (!active.length) {
      messages.push("Load published Sheet data to see recommendations. For now, keep tests simple: one meaningful change per version.");
    }

    active.forEach(function (item) {
      if (item.views < 100) {
        messages.push("Variant " + item.variant + " / " + item.configVersion + " has " + item.views + " views. Wait for at least 100 views before making a decision.");
      } else if (!isSingleStepMetric(item) && item.quizRate > 0.12 && item.cvr < 0.04) {
        messages.push("Variant " + item.variant + " / " + item.configVersion + " gets quiz completions but few leads. The lead step may need less friction or stronger copy.");
      } else if (item.clickRate > 0.12 && item.cvr < 0.04) {
        messages.push("Variant " + item.variant + " / " + item.configVersion + " gets clicks but few leads. The form or offer may need less friction.");
      } else if (item.lift > 0.15) {
        messages.push("Variant " + item.variant + " / " + item.configVersion + " is showing positive lift. Consider shifting more traffic only after sample size is strong.");
      }
    });

    els.recommendations.innerHTML = messages.map(function (message) {
      return "<p>" + escapeHtml(message) + "</p>";
    }).join("");
  }

  function renderCharts(metrics) {
    var labels = metrics.map(function (item) {
      return item.variant + " / " + item.configVersion;
    });

    var showQuizDataset = metrics.some(function (item) {
      return !isSingleStepMetric(item);
    });
    var conversionDatasets = [
      {
        label: "Full CVR",
        data: metrics.map(function (item) { return Math.round(item.cvr * 1000) / 10; }),
        backgroundColor: "#06b00b"
      }
    ];
    if (showQuizDataset) {
      conversionDatasets.push({
        label: "Quiz completion rate",
        data: metrics.map(function (item) { return isSingleStepMetric(item) ? 0 : Math.round(item.quizRate * 1000) / 10; }),
        backgroundColor: "#2563eb"
      });
    }
    conversionDatasets.push(
      {
        label: "Click-through rate",
        data: metrics.map(function (item) { return Math.round(item.clickRate * 1000) / 10; }),
        backgroundColor: "#0f766e"
      }
    );
    drawChart("conversion-chart", "bar", labels, conversionDatasets);

    var eventDatasets = [
      {
        label: "Views",
        data: metrics.map(function (item) { return item.views; }),
        backgroundColor: "#475467"
      }
    ];
    if (showQuizDataset) {
      eventDatasets.push({
        label: "Quiz completions",
        data: metrics.map(function (item) { return isSingleStepMetric(item) ? 0 : item.quizSubmits; }),
        backgroundColor: "#2563eb"
      });
    }
    eventDatasets.push(
      {
        label: "Leads",
        data: metrics.map(function (item) { return item.fullSubmissions; }),
        backgroundColor: "#06b00b"
      }
    );
    drawChart("event-chart", "bar", labels, eventDatasets);
  }

  function drawChart(id, type, labels, datasets) {
    if (!window.Chart) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), {
      type: type,
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderPreviews(mode) {
    renderPreviewFlowTabs();
    els.previews.innerHTML = "";
    els.previews.classList.toggle("is-compare", mode === "compare");
    els.previews.classList.toggle("is-mobile", mode === "mobile");
    activeVariants().forEach(function (variant) {
      var card = document.createElement("article");
      card.className = "dash-preview-card";

      var title = document.createElement("div");
      title.className = "dash-preview-title";
      title.innerHTML = "<strong>Variant " + escapeHtml(variant.id) + "</strong><span>" + escapeHtml(variant.trafficSplit) + "% split</span>";

      var stage = document.createElement("div");
      stage.className = "dash-preview-stage" + (mode === "mobile" ? " is-mobile" : "") + (mode === "compare" ? " is-compare" : "");
      var steps = ensureFlowSteps(variant);
      var preview = buildPreview(variant, Math.min(Number(previewStep || 0), steps.length - 1));
      stage.appendChild(preview);

      card.appendChild(title);
      card.appendChild(stage);
      els.previews.appendChild(card);
      var previewImage = preview.querySelector(".ll-popup-image");
      if (previewImage && previewImage.complete) sizePreviewToImage(preview, previewImage, variant);
      scheduleDashboardPreviewFit(preview);
    });
  }

  function renderPreviewFlowTabs() {
    var variant = activeVariants()[0];
    if (!variant || !els.flowPreviewTabs) return;
    var steps = ensureFlowSteps(variant);
    if (Number(previewStep) >= steps.length) previewStep = 0;
    els.flowPreviewTabs.innerHTML = steps.map(function (step, index) {
      return "<button type=\"button\" data-preview-flow-step=\"" + index + "\" class=\"" + (Number(previewStep) === index ? "is-active" : "") + "\">" + (index + 1) + ". " + escapeHtml(step.name || step.type) + "</button>";
    }).join("");
  }

  function buildPreview(variant, step) {
    step = Number(step || 0);
    var quiz = getProteinQuizConfig(variant);
    var root = document.createElement("div");
    root.className = "ll-popup-root ll-popup-is-visible";
    if (Number(variant.height) > 0) root.classList.add("ll-popup-has-height");
    if (variant.sizeToImage) root.classList.add("ll-popup-size-to-image");
    root.style.setProperty("--ll-popup-width", (Number(variant.width) || 560) + "px");
    root.style.setProperty("--ll-popup-height", (Number(variant.height) || 640) + "px");
    root.style.setProperty("--ll-popup-bg", variant.backgroundColor || "#ffffff");
    root.style.setProperty("--ll-popup-text", variant.textColor || "#172026");
    root.style.setProperty("--ll-popup-accent", variant.brandAccentColor || "#06b00b");
    root.style.setProperty("--ll-popup-button-bg", variant.accentColor || "#1f6feb");
    root.style.setProperty("--ll-popup-font", variant.fontFamily || "Arial, Helvetica, sans-serif");
    root.style.setProperty("--ll-popup-headline-weight", String(variant.headlineFontWeight || 700));
    root.style.setProperty("--ll-popup-body-weight", String(variant.bodyFontWeight || 400));
    root.style.setProperty("--ll-popup-button-weight", String(variant.buttonFontWeight || 700));
    root.style.setProperty("--ll-popup-align", variant.textAlign || "left");
    setPopupTextSizeVariables(root, variant);

    var modal = document.createElement("div");
    modal.className = "ll-popup-modal";

    var close = document.createElement("button");
    close.className = "ll-popup-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close preview");
    close.innerHTML = "&times;";

    var content = document.createElement("div");
    content.className = "ll-popup-content";

    if (variant.imageUrl) {
      var image = document.createElement("img");
      image.className = "ll-popup-image";
      image.alt = variant.imageAlt || "";
      image.addEventListener("load", function () {
        sizePreviewToImage(root, image, variant);
        scheduleDashboardPreviewFit(root);
        schedulePopupFit(root, variant);
      });
      image.src = variant.imageUrl;
      content.appendChild(image);
      if (image.complete) {
        sizePreviewToImage(root, image, variant);
        scheduleDashboardPreviewFit(root);
        schedulePopupFit(root, variant);
      }
    }

    var copy = document.createElement("div");
    copy.className = "ll-popup-copy";
    copy.style.textAlign = variant.textAlign || "left";
    var isProteinPlan = config.leadMagnetMode === "protein_plan";
    var isSingleStep = isProteinPlan && quiz.showQuizStep === false;
    if (isSingleStep) root.classList.add("ll-popup-single-step");
    var targetPreview = step === "lead" && isProteinPlan && !isSingleStep
      ? renderProteinTargetPreviewHtml(quiz, getSampleProteinTarget(quiz))
      : "";
    copy.innerHTML = step === "lead" && isProteinPlan && !isSingleStep
      ? targetPreview + "<p class=\"ll-popup-eyebrow\" hidden></p><h2 class=\"ll-popup-headline\">" + escapeHtml(quiz.leadHeadline) + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(quiz.leadSubheadline) + "</p>"
      : "<p class=\"ll-popup-eyebrow\" hidden></p><h2 class=\"ll-popup-headline\">" + sanitizeRichHtml(variant.headlineHtml || escapeHtml(variant.headline || "")) + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || "")) + "</p>" + (variant.valueLineHtml || variant.valueLine ? "<p class=\"ll-popup-value-line\">" + sanitizeRichHtml(variant.valueLineHtml || escapeHtml(variant.valueLine || "")) + "</p>" : "");
    copy.querySelector(".ll-popup-headline").style.textAlign = variant.textAlign || "left";
    copy.querySelector(".ll-popup-subheadline").style.textAlign = variant.textAlign || "left";
    var valueLine = copy.querySelector(".ll-popup-value-line");
    if (valueLine) valueLine.style.textAlign = variant.textAlign || "left";

    var form = document.createElement("div");
    form.className = "ll-popup-form";
    form.innerHTML = isProteinPlan && (step === "lead" || isSingleStep)
      ? (isSingleStep ? renderProteinProgressHtml(quiz, 1, true) : "<button class=\"ll-popup-step-back\" type=\"button\" aria-label=\"Back\">&#8592;</button>" + renderProteinProgressHtml(quiz, 2)) + (quiz.showFirstName === false ? "" : "<div class=\"dash-fake-field\">" + escapeHtml(quiz.firstNameLabel) + "</div>") + (quiz.showEmail === false ? "" : "<div class=\"dash-fake-field\">" + escapeHtml(quiz.emailLabel) + "</div>") + "<button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(quiz.leadButtonText) + "</button>"
      : isProteinPlan
      ? renderProteinProgressHtml(quiz, 1) + "<div class=\"dash-fake-field\">" + escapeHtml(quiz.targetWeightLabel) + "</div><div class=\"dash-fake-field\">" + escapeHtml(quiz.strengthDaysLabel) + "</div><div class=\"dash-fake-field\">" + escapeHtml(quiz.ageLabel) + "</div><button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(quiz.quizButtonText) + "</button>"
      : "<div class=\"dash-fake-field\">First Name</div><div class=\"dash-fake-field\">Email</div><button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(variant.buttonText || "Submit") + "</button>";

    content.appendChild(copy);
    content.appendChild(form);
    modal.appendChild(close);
    modal.appendChild(content);
    root.appendChild(modal);
    if (isProteinPlan && Array.isArray(variant.flowSteps) && variant.flowSteps.length) {
      renderProteinPlanPreviewForm(form, variant);
    }
    return root;
  }

  function scheduleDashboardPreviewFit(root) {
    if (!root || !root.closest(".dash-preview-stage")) return;
    window.requestAnimationFrame(function () {
      fitDashboardPreviewGroup(root);
      window.requestAnimationFrame(function () {
        fitDashboardPreviewGroup(root);
      });
    });
  }

  function fitDashboardPreviewGroup(root) {
    var stage = root && root.closest(".dash-preview-stage");
    if (!stage || stage.classList.contains("is-mobile")) return;
    if (!stage.classList.contains("is-compare")) {
      fitDashboardPreviewToStage(root);
      return;
    }

    var grid = stage.closest(".dash-preview-grid");
    var roots = grid ? Array.from(grid.querySelectorAll(".dash-preview-stage.is-compare .ll-popup-root")) : [root];
    var scale = roots.reduce(function (currentScale, previewRoot) {
      var previewStage = previewRoot.closest(".dash-preview-stage");
      var modal = previewRoot.querySelector(".ll-popup-modal");
      var availableWidth = getPreviewStageAvailableWidth(previewStage);
      var modalWidth = getPreviewModalWidth(modal);
      if (!availableWidth || !modalWidth) return currentScale;
      return Math.min(currentScale, availableWidth / modalWidth);
    }, 1);

    scale = Math.max(0.01, Math.min(1, scale));
    roots.forEach(function (previewRoot) {
      applyDashboardPreviewScale(previewRoot, scale);
    });
  }

  function fitDashboardPreviewToStage(root) {
    var stage = root && root.closest(".dash-preview-stage");
    var modal = root && root.querySelector(".ll-popup-modal");
    if (!stage || !modal || stage.classList.contains("is-mobile")) return;

    var availableWidth = getPreviewStageAvailableWidth(stage);
    var modalWidth = getPreviewModalWidth(modal);
    if (!availableWidth || !modalWidth) return;

    applyDashboardPreviewScale(root, Math.max(0.01, Math.min(1, availableWidth / modalWidth)));
  }

  function applyDashboardPreviewScale(root, scale) {
    var stage = root && root.closest(".dash-preview-stage");
    var modal = root && root.querySelector(".ll-popup-modal");
    if (!stage || !modal) return;

    stage.classList.remove("has-scaled-preview");
    stage.style.removeProperty("--dash-preview-stage-height");
    root.style.setProperty("--dash-preview-scale", "1");

    var stageStyles = window.getComputedStyle(stage);
    var modalHeight = modal.scrollHeight || modal.offsetHeight || modal.getBoundingClientRect().height;
    if (!modalHeight) return;

    root.style.setProperty("--dash-preview-scale", scale.toFixed(3));
    stage.style.setProperty("--dash-preview-stage-height", Math.ceil((modalHeight * scale) + parseFloat(stageStyles.paddingTop || 0) + parseFloat(stageStyles.paddingBottom || 0)) + "px");
    stage.classList.add("has-scaled-preview");
  }

  function getPreviewStageAvailableWidth(stage) {
    if (!stage) return 0;
    var stageStyles = window.getComputedStyle(stage);
    return stage.clientWidth - parseFloat(stageStyles.paddingLeft || 0) - parseFloat(stageStyles.paddingRight || 0);
  }

  function getPreviewModalWidth(modal) {
    return modal ? (modal.scrollWidth || modal.offsetWidth || modal.getBoundingClientRect().width) : 0;
  }

  function showDashboardTestPopup(variant) {
    var existing = document.querySelector(".dash-dashboard-test-popup");
    if (existing) existing.remove();

    var root = buildPreview(variant, previewStep);
    root.classList.add("dash-dashboard-test-popup");

    var overlay = document.createElement("div");
    overlay.className = "ll-popup-overlay";
    root.insertBefore(overlay, root.firstChild);

    var close = root.querySelector(".ll-popup-close");
    var form = root.querySelector(".ll-popup-form");

    if (config.leadMagnetMode === "protein_plan") {
      renderProteinPlanPreviewForm(form, variant, previewStep);
    } else if (config.kajabiFormEmbed && config.kajabiFormEmbed.indexOf("YOUR_FORM_ID") === -1) {
      form.innerHTML = "";
      injectKajabiForm(form);
    } else {
      renderZapierPreviewForm(form, variant);
    }

    overlay.addEventListener("click", closeTestPopup);
    close.addEventListener("click", closeTestPopup);
    document.body.appendChild(root);
    document.body.classList.add("ll-popup-lock-scroll");
    schedulePopupFit(root, variant);
    window.addEventListener("resize", onResize);
    close.focus();

    function closeTestPopup() {
      document.body.classList.remove("ll-popup-lock-scroll");
      window.removeEventListener("resize", onResize);
      root.remove();
    }

    function onResize() {
      sizePreviewToImage(root, root.querySelector(".ll-popup-image"), variant);
      schedulePopupFit(root, variant);
    }
  }

  function injectKajabiForm(container) {
    var embed = String(config.kajabiFormEmbed || "");
    var scriptUrl = getKajabiScriptUrl(embed);

    if (scriptUrl && config.kajabiEmbedMode !== "iframe") {
      executeEmbedHtml(container, embed);
      schedulePopupFit(container.closest(".ll-popup-root"));
      if (config.kajabiEmbedMode !== "script") {
        window.setTimeout(function () {
          schedulePopupFit(container.closest(".ll-popup-root"));
          if (!container.querySelector("input, textarea, select, button, iframe")) {
            injectKajabiIframe(container, scriptUrl);
            window.setTimeout(function () {
              schedulePopupFit(container.closest(".ll-popup-root"));
              if (!container.querySelector("input, textarea, select, button")) {
                showFormStatus(container, "Kajabi form did not expose visible fields in this preview. Try Kajabi embed mode: Iframe, and confirm the pasted embed is the form embed script ending in /embed.js.");
              }
            }, 2200);
          }
        }, 1800);
      }
      return;
    }

    if (scriptUrl) {
      injectKajabiIframe(container, scriptUrl);
      return;
    }

    container.innerHTML = embed;
  }

  function renderZapierPreviewForm(container, variant) {
    container.innerHTML = [
      "<form class=\"ll-popup-zapier-form\">",
      "<label><input name=\"name\" autocomplete=\"given-name\" placeholder=\"First Name\" required></label>",
      "<label><input name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"Email\" required></label>",
      "<button type=\"submit\">" + escapeHtml(variant.buttonText || "Submit") + "</button>",
      "</form>"
    ].join("");

    var form = container.querySelector("form");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      sendLeadPayload(config.leadWebhookUrl, {
        name: form.elements.name.value,
        email: form.elements.email.value
      });
      showFormStatus(container, config.leadWebhookUrl ? "Test sent to Zapier with name and email." : "Add your Zapier lead webhook URL before testing the lead submission.");
      schedulePopupFit(container.closest(".ll-popup-root"));
    });
  }

  function renderProteinPlanPreviewForm(container, variant) {
    if (Array.isArray(variant.flowSteps) && variant.flowSteps.length) {
      renderFlowPlanPreviewForm(container, variant, Number(previewStep || 0));
      return;
    }
    var quizData = {};
    var root = container.closest(".ll-popup-root");
    var eyebrow = root && root.querySelector(".ll-popup-eyebrow");
    var headline = root && root.querySelector(".ll-popup-headline");
    var subheadline = root && root.querySelector(".ll-popup-subheadline");
    var valueLine = root && root.querySelector(".ll-popup-value-line");
    var quiz = getProteinQuizConfig(variant);
    var multiQuestions = [
      { key: "targetWeight", labelKey: "targetWeightLabel", placeholderKey: "targetWeightPlaceholder", styleKey: "targetWeightAnswerStyle" },
      { key: "strengthDays", labelKey: "strengthDaysLabel", placeholderKey: "strengthDaysPlaceholder", styleKey: "strengthDaysAnswerStyle" },
      { key: "age", labelKey: "ageLabel", placeholderKey: "agePlaceholder", styleKey: "ageAnswerStyle" }
    ];

    if (quiz.showQuizStep === false || previewStep === "lead") {
      if (quiz.showQuizStep !== false) {
        quizData = {
          targetWeightLbs: "155",
          TargetWeight: "155",
          age: "48",
          Age: "48",
          strengthDays: "3",
          StrengthDays: "3",
          proteinTarget: getSampleProteinTarget()
        };
      }
      renderLeadStep(quiz.showQuizStep === false);
    } else if (quiz.multiStepEnabled === true) {
      renderMultiQuizStep(0);
    } else {
      renderQuizStep();
    }

    function renderMultiQuizStep(index) {
      var question = multiQuestions[index];
      renderProteinTargetPreview(root, quiz, null);
      if (headline) headline.innerHTML = sanitizeRichHtml(variant.quizHeadline || variant.headlineHtml || escapeHtml(variant.headline || ""));
      if (subheadline) subheadline.innerHTML = sanitizeRichHtml(variant.quizSubheadlineHtml || variant.subheadlineHtml || escapeHtml(variant.subheadline || ""));
      setPopupValueLine(valueLine, variant.valueLineHtml || escapeHtml(variant.valueLine || ""));
      container.innerHTML = [
        index > 0 ? "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Previous question\">&#8592;</button>" : "",
        renderMultiProgressHtml(quiz, index + 1, 3),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form ll-popup-multi-question\"><fieldset><legend>" + escapeHtml(quiz[question.labelKey]) + "</legend>",
        renderMultiQuestionControl(question, quiz),
        "</fieldset>",
        quiz[question.styleKey] === "ranges" ? "" : "<button type=\"submit\">" + escapeHtml(index === 2 ? quiz.quizButtonText : "Continue") + "</button>",
        "</form>"
      ].join("");
      var form = container.querySelector("form");
      var backButton = container.querySelector(".ll-popup-step-back");
      if (backButton) backButton.addEventListener("click", function () { renderMultiQuizStep(index - 1); });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var value = getFormValue(form, question.key);
        if (!value) return;
        quizData[question.key] = value;
        quizData[question.key === "targetWeight" ? "targetWeightLbs" : question.key === "age" ? "Age" : "StrengthDays"] = value;
        if (index < 2) return renderMultiQuizStep(index + 1);
        quizData.proteinTarget = calculateProteinTarget(quizData.targetWeight, quizData.age, quizData.strengthDays);
        renderLeadStep();
      });
      form.querySelectorAll("[data-auto-answer]").forEach(function (button) {
        button.addEventListener("click", function () {
          form.elements[question.key].value = button.dataset.value;
          form.requestSubmit();
        });
      });
      schedulePopupFit(root);
    }

    function renderQuizStep() {
      renderProteinTargetPreview(root, quiz, null);
      if (headline) headline.innerHTML = sanitizeRichHtml(variant.quizHeadline || variant.headlineHtml || escapeHtml(variant.headline || ""));
      if (subheadline) subheadline.innerHTML = sanitizeRichHtml(variant.quizSubheadlineHtml || variant.subheadlineHtml || escapeHtml(variant.subheadline || ""));
      setPopupValueLine(valueLine, variant.valueLineHtml || escapeHtml(variant.valueLine || ""));
      container.innerHTML = [
        renderProteinProgressHtml(quiz, 1),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form\" data-step=\"quiz\">",
        "<label><span>" + escapeHtml(quiz.targetWeightLabel) + "</span><input name=\"targetWeight\" type=\"number\" inputmode=\"numeric\" min=\"80\" max=\"350\" step=\"1\" placeholder=\"" + escapeHtmlAttr(quiz.targetWeightPlaceholder) + "\" required></label>",
        "<label><span>" + escapeHtml(quiz.strengthDaysLabel) + "</span><select name=\"strengthDays\" required>",
        "<option value=\"\">" + escapeHtml(quiz.strengthDaysPlaceholder) + "</option>",
        "<option value=\"0\">0 days</option>",
        "<option value=\"1\">1 day</option>",
        "<option value=\"2\">2 days</option>",
        "<option value=\"3\">3 days</option>",
        "<option value=\"4\">4 days</option>",
        "<option value=\"5\">5 days</option>",
        "<option value=\"6\">6 days</option>",
        "<option value=\"7\">7 days</option>",
        "</select></label>",
        "<label><span>" + escapeHtml(quiz.ageLabel) + "</span><input name=\"age\" type=\"number\" inputmode=\"numeric\" min=\"18\" max=\"100\" step=\"1\" placeholder=\"" + escapeHtmlAttr(quiz.agePlaceholder) + "\" required></label>",
        "<button type=\"submit\">" + escapeHtml(quiz.quizButtonText) + "</button>",
        "</form>"
      ].join("");

      container.querySelector("form").addEventListener("submit", function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        quizData = {
          targetWeightLbs: form.elements.targetWeight.value,
          TargetWeight: form.elements.targetWeight.value,
          age: form.elements.age.value,
          Age: form.elements.age.value,
          strengthDays: form.elements.strengthDays.value,
          StrengthDays: form.elements.strengthDays.value,
          proteinTarget: calculateProteinTarget(form.elements.targetWeight.value, form.elements.age.value, form.elements.strengthDays.value)
        };
        renderLeadStep();
      });
      schedulePopupFit(container.closest(".ll-popup-root"));
    }

    function renderLeadStep(singleStep) {
      if (headline) headline.innerHTML = singleStep ? sanitizeRichHtml(variant.headlineHtml || escapeHtml(variant.headline || "")) : escapeHtml(quiz.leadHeadline);
      if (subheadline) subheadline.innerHTML = singleStep ? sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || "")) : sanitizeRichHtml(quiz.leadSubheadline);
      setPopupValueLine(valueLine, singleStep ? (variant.valueLineHtml || escapeHtml(variant.valueLine || "")) : "");
      renderProteinTargetPreview(root, quiz, singleStep ? null : quizData.proteinTarget);
      container.innerHTML = [
        singleStep ? "" : "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Back\">&#8592;</button>",
        singleStep ? renderProteinProgressHtml(quiz, 1, true) : (quiz.multiStepEnabled === true ? renderMultiProgressHtml(quiz, 3, 3) : renderProteinProgressHtml(quiz, 2)),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form\" data-step=\"lead\">",
        quiz.showFirstName === false ? "" : "<label><span>" + escapeHtml(quiz.firstNameLabel) + "</span><input name=\"name\" autocomplete=\"given-name\" placeholder=\"" + escapeHtmlAttr(quiz.firstNamePlaceholder) + "\" required></label>",
        quiz.showEmail === false ? "" : "<label><span>" + escapeHtml(quiz.emailLabel) + "</span><input name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"" + escapeHtmlAttr(quiz.emailPlaceholder) + "\" required></label>",
        "<button type=\"submit\">" + escapeHtml(quiz.leadButtonText || variant.buttonText || "Show My Protein Plan") + "</button>",
        "</form>"
      ].join("");

      var form = container.querySelector("form");
      var backButton = container.querySelector(".ll-popup-step-back");
      if (backButton) backButton.addEventListener("click", function () { quiz.multiStepEnabled === true ? renderMultiQuizStep(2) : renderQuizStep(); });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        sendLeadPayload(config.leadWebhookUrl, {
          name: getFormValue(form, "name"),
          email: getFormValue(form, "email"),
          targetWeightLbs: quizData.targetWeightLbs,
          TargetWeight: quizData.TargetWeight || quizData.targetWeightLbs,
          age: quizData.age,
          Age: quizData.Age || quizData.age,
          strengthDays: quizData.strengthDays,
          StrengthDays: quizData.StrengthDays || quizData.strengthDays,
          proteinTargetRange: quizData.proteinTarget && quizData.proteinTarget.rangeText,
          ProteinTargetRange: quizData.proteinTarget && quizData.proteinTarget.rangeText,
          proteinDailyGoalGrams: quizData.proteinTarget && quizData.proteinTarget.dailyGoalGrams,
          ProteinDailyGoalGrams: quizData.proteinTarget && quizData.proteinTarget.dailyGoalGrams,
          source: "protein_popup",
          ctaVariant: "show_my_protein_plan",
          popupVariant: variant.id
        });
        showFormStatus(container, config.leadWebhookUrl ? "Test sent to Zapier with protein quiz fields." : "Add your Zapier lead webhook URL before testing the lead submission.");
      });
      schedulePopupFit(container.closest(".ll-popup-root"));
    }
  }

  function renderFlowPlanPreviewForm(container, variant, initialStep) {
    var steps = variant.flowSteps.filter(function (step) { return step && step.enabled !== false; });
    var root = container.closest(".ll-popup-root");
    var eyebrow = root && root.querySelector(".ll-popup-eyebrow");
    var headline = root && root.querySelector(".ll-popup-headline");
    var subheadline = root && root.querySelector(".ll-popup-subheadline");
    var valueLine = root && root.querySelector(".ll-popup-value-line");
    renderStep(Math.min(initialStep, steps.length - 1));

    function renderStep(index) {
      var step = steps[index];
      if (!step) return;
      if (eyebrow) { eyebrow.innerHTML = sanitizeRichHtml(step.eyebrowHtml || ""); eyebrow.hidden = !step.eyebrowHtml; }
      if (headline) headline.innerHTML = sanitizeRichHtml(step.headlineHtml || "");
      if (subheadline) { subheadline.innerHTML = sanitizeRichHtml(step.subheadlineHtml || ""); subheadline.hidden = !step.subheadlineHtml; }
      setPopupValueLine(valueLine, step.valueLineHtml || "");
      root.style.setProperty("--ll-popup-bg", step.backgroundColor || variant.backgroundColor || "#ffffff");
      root.style.setProperty("--ll-popup-button-bg", step.buttonColor || variant.accentColor || "#1f6feb");
      root.style.setProperty("--ll-popup-accent", step.progressColor || variant.brandAccentColor || "#06b00b");
      setOptionalPixelVariable(root, "--ll-popup-headline-size", step.headlineFontSize || variant.headlineFontSize, 18, 72);
      setOptionalPixelVariable(root, "--ll-popup-eyebrow-size", step.eyebrowFontSize || 15, 10, 28);
      setOptionalPixelVariable(root, "--ll-popup-subheadline-size", step.subheadlineFontSize || variant.subheadlineFontSize, 12, 36);
      setOptionalPixelVariable(root, "--ll-popup-value-line-size", step.valueLineFontSize || variant.valueLineFontSize, 11, 32);
      setOptionalPixelVariable(root, "--ll-popup-button-size", step.buttonFontSize || variant.buttonFontSize, 12, 28);
      setOptionalPixelVariable(root, "--ll-popup-choice-font-size", step.choiceButtonFontSize || 16, 12, 28);
      root.style.setProperty("--ll-popup-choice-columns", step.answerLayout === "stacked" ? "1" : "2");
      root.style.setProperty("--ll-popup-choice-transform", step.choiceButtonTransform === "uppercase" ? "uppercase" : "none");
      root.style.setProperty("--ll-popup-question-weight", String(step.questionFontWeight || variant.bodyFontWeight || 400));
      root.style.setProperty("--ll-popup-choice-weight", String(step.choiceButtonFontWeight || variant.buttonFontWeight || 700));
      var image = root.querySelector(".ll-popup-image");
      if (image) { image.hidden = !step.imageUrl; if (step.imageUrl) image.src = step.imageUrl; }
      var progress = flowPreviewPosition(steps, index, step.progressScope || "all");
      container.innerHTML = (index > 0 && step.showBack !== false ? "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Previous step\">&#8592;</button>" : "") + renderFlowPreviewProgress(step, progress.current, progress.total) + renderFlowPreviewForm(step);
      var back = container.querySelector(".ll-popup-step-back"); if (back) back.addEventListener("click", function () { renderStep(index - 1); });
      var form = container.querySelector("form"); if (form) form.addEventListener("submit", function (event) { event.preventDefault(); if (index < steps.length - 1) renderStep(index + 1); });
      container.querySelectorAll("[data-flow-answer]").forEach(function (button) { button.addEventListener("click", function () { if (index < steps.length - 1) renderStep(index + 1); }); });
      schedulePopupFit(root);
    }

    function renderFlowPreviewForm(step) {
      var content = "";
      if (step.type === "lead") {
        var fields = step.fields || [];
        if (fields.indexOf("name") >= 0) content += "<label><span>" + escapeHtml(step.firstNameLabel || "First name") + "</span><input placeholder=\"" + escapeHtmlAttr(step.firstNamePlaceholder || "First Name") + "\"></label>";
        if (fields.indexOf("email") >= 0) content += "<label><span>" + escapeHtml(step.emailLabel || "Email") + "</span><input type=\"email\" placeholder=\"" + escapeHtmlAttr(step.emailPlaceholder || "Email") + "\"></label>";
      } else if (step.type === "questions") content = "<label><span>" + escapeHtml(step.targetWeightLabel || "Target weight in lbs") + "</span><input placeholder=\"" + escapeHtmlAttr(step.targetWeightPlaceholder || "155") + "\"></label><label><span>" + escapeHtml(step.strengthDaysLabel || "Strength training days") + "</span><select><option>" + escapeHtml(step.strengthDaysPlaceholder || "Select days") + "</option></select></label><label><span>" + escapeHtml(step.ageLabel || "Age") + "</span><input placeholder=\"" + escapeHtmlAttr(step.agePlaceholder || "48") + "\"></label>";
      else if (step.type === "message") content = "";
      else content = "<fieldset><legend>" + escapeHtml(step.questionLabel || step.name) + "</legend>" + renderFlowPreviewControl(step) + "</fieldset>";
      var hide = step.type === "question" && step.answerStyle === "ranges" && step.autoAdvance !== false;
      return "<form class=\"ll-popup-zapier-form ll-popup-protein-form" + (step.type === "question" ? " ll-popup-multi-question" : "") + "\">" + content + (hide ? "" : "<button type=\"submit\">" + escapeHtml(step.buttonText || "Continue") + "</button>") + "</form>";
    }

    function renderFlowPreviewControl(step) {
      var options = getFlowStepOptions(step);
      if (step.answerStyle === "ranges") return "<div class=\"ll-popup-answer-grid\">" + options.ranges.map(function (option) { return "<button type=\"button\" data-flow-answer>" + escapeHtml(option.label) + "</button>"; }).join("") + "</div>";
      if (step.answerStyle === "dropdown") return "<select><option>" + escapeHtml(step.placeholder || "Select one") + "</option>" + options.dropdown.slice(0, 20).map(function (option) { return "<option>" + escapeHtml(option.label) + "</option>"; }).join("") + "</select>";
      return "<input type=\"" + (step.answerStyle === "number" ? "number" : "text") + "\" placeholder=\"" + escapeHtmlAttr(step.placeholder || "") + "\">";
    }
  }

  function renderFlowPreviewProgress(step, current, total) {
    if (!step.progressEnabled) return "";
    var label = String(step.progressLabel || "Step {current} of {total}").replace(/\{current\}/g, current).replace(/\{total\}/g, total);
    return "<div class=\"ll-popup-progress\"><div class=\"ll-popup-progress-top\"><span>" + escapeHtml(label) + "</span><strong>" + current + "/" + total + "</strong></div><div class=\"ll-popup-progress-track\"><span style=\"width:" + Math.round(current / total * 100) + "%\"></span></div></div>";
  }

  function flowPreviewPosition(steps, index, scope) {
    if (scope !== "questions") return {current:index + 1,total:Math.max(1,steps.length)};
    var questionIndexes = [];
    steps.forEach(function (step, stepIndex) { if (step.type === "question" || step.type === "questions") questionIndexes.push(stepIndex); });
    var position = questionIndexes.indexOf(index);
    return {current: position >= 0 ? position + 1 : Math.max(1, questionIndexes.length), total: Math.max(1, questionIndexes.length)};
  }

  function getFlowStepOptions(step) {
    if (!step.optionsText && step.field !== "custom") return getMultiQuestionOptions(step.field);
    var lines = String(step.optionsText || defaultFlowOptionsText(step.field)).split(/\n/).filter(Boolean).map(function (line) { var parts = line.split("|"); return {label:parts[0].trim(),value:(parts[1] || parts[0]).trim()}; });
    return {dropdown:lines,ranges:lines};
  }

  function defaultFlowOptionsText(field) {
    if (field === "custom") return "Yes | yes\nNo | no";
    return getMultiQuestionOptions(field).ranges.map(function (option) {
      return option.label + " | " + option.value;
    }).join("\n");
  }

  function getFormValue(form, name) {
    return form && form.elements && form.elements[name] ? form.elements[name].value : "";
  }

  function setPopupValueLine(element, text) {
    if (!element) return;
    element.innerHTML = sanitizeRichHtml(text || "");
    element.hidden = !text;
  }

  function setPopupTextSizeVariables(root, variant) {
    if (!root || !variant) return;
    var quiz = getProteinQuizConfig(variant);
    setOptionalPixelVariable(root, "--ll-popup-headline-size", variant.headlineFontSize, 18, 72);
    setOptionalPixelVariable(root, "--ll-popup-subheadline-size", variant.subheadlineFontSize, 12, 36);
    setOptionalPixelVariable(root, "--ll-popup-value-line-size", variant.valueLineFontSize, 11, 32);
    setOptionalPixelVariable(root, "--ll-popup-button-size", variant.buttonFontSize, 12, 28);
    setOptionalPixelVariable(root, "--ll-popup-progress-label-size", quiz.progressSingleStepLabelFontSize, 9, 28);
  }

  function setOptionalPixelVariable(root, name, value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return;
    root.style.setProperty(name, clampNumber(number, min, max) + "px");
  }

  function renderProteinProgressHtml(quiz, step, singleStep) {
    if (!quiz || !quiz.progressEnabled) return "";

    var label = singleStep ? (quiz.progressSingleStepLabel || "Step 1") : (step === 2 ? quiz.progressStepTwoLabel : quiz.progressStepOneLabel);
    var text = singleStep ? "" : (step === 2 ? quiz.progressStepTwoText : quiz.progressStepOneText);
    var percent = singleStep ? 50 : (step === 2 ? 100 : 50);
    var countText = singleStep ? "" : step + "/2";

    return [
      "<div class=\"ll-popup-progress\" aria-label=\"" + escapeHtmlAttr(label || ("Step " + step + " of 2")) + "\">",
      "<div class=\"ll-popup-progress-top\"><span>" + escapeHtml(label || (singleStep ? "Step 1" : ("Step " + step + " of 2"))) + "</span>" + (countText ? "<strong>" + escapeHtml(countText) + "</strong>" : "") + "</div>",
      "<div class=\"ll-popup-progress-track\" role=\"progressbar\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"" + percent + "\"><span style=\"width:" + percent + "%\"></span></div>",
      text ? "<p>" + escapeHtml(text) + "</p>" : "",
      "</div>"
    ].join("");
  }

  function renderMultiProgressHtml(quiz, step, total) {
    if (!quiz || !quiz.progressEnabled) return "";
    var percent = Math.round((step / total) * 100);
    return "<div class=\"ll-popup-progress ll-popup-progress-multi\"><div class=\"ll-popup-progress-top\"><span>Question " + step + " of " + total + "</span><strong>" + step + "/" + total + "</strong></div><div class=\"ll-popup-progress-track\"><span style=\"width:" + percent + "%\"></span></div></div>";
  }

  function renderMultiQuestionControl(question, quiz) {
    var options = getMultiQuestionOptions(question.key);
    if (quiz[question.styleKey] === "ranges") {
      return "<input type=\"hidden\" name=\"" + question.key + "\"><div class=\"ll-popup-answer-grid\">" + options.ranges.map(function (option) { return "<button type=\"button\" data-auto-answer data-value=\"" + option.value + "\">" + escapeHtml(option.label) + "</button>"; }).join("") + "</div>";
    }
    return "<select name=\"" + question.key + "\" required><option value=\"\">" + escapeHtml(quiz[question.placeholderKey]) + "</option>" + options.dropdown.map(function (option) { return "<option value=\"" + option.value + "\">" + escapeHtml(option.label) + "</option>"; }).join("") + "</select>";
  }

  function getMultiQuestionOptions(key) {
    var values = [], ranges = [], i;
    if (key === "strengthDays") {
      for (i = 0; i <= 7; i += 1) values.push({value:String(i),label:i + (i === 1 ? " day" : " days")});
      ranges = values;
    } else if (key === "age") {
      for (i = 18; i <= 100; i += 1) values.push({value:String(i),label:String(i)});
      ranges = [{value:"24",label:"18-29"},{value:"35",label:"30-39"},{value:"45",label:"40-49"},{value:"55",label:"50-59"},{value:"65",label:"60-69"},{value:"75",label:"70+"}];
    } else {
      for (i = 80; i <= 350; i += 5) values.push({value:String(i),label:i + " lbs"});
      ranges = [{value:"110",label:"Under 120 lbs"},{value:"130",label:"120-139 lbs"},{value:"150",label:"140-159 lbs"},{value:"170",label:"160-179 lbs"},{value:"190",label:"180-199 lbs"},{value:"220",label:"200-239 lbs"},{value:"260",label:"240+ lbs"}];
    }
    return {dropdown:values,ranges:ranges};
  }

  function renderProteinTargetPreview(root, quiz, target) {
    if (!root) return;

    var copy = root.querySelector(".ll-popup-copy");
    var existing = copy && copy.querySelector(".ll-popup-target-preview");
    if (existing) existing.remove();
    if (!copy || !target) return;

    var html = renderProteinTargetPreviewHtml(quiz, target);
    if (!html) return;

    var template = document.createElement("template");
    template.innerHTML = html;
    var preview = template.content.firstElementChild;
    var headline = copy.querySelector(".ll-popup-headline");
    if (headline) {
      copy.insertBefore(preview, headline);
    } else {
      copy.insertBefore(preview, copy.firstChild);
    }
  }

  function renderProteinTargetPreviewHtml(quiz, target) {
    if (!quiz || quiz.showQuizStep === false || !target || quiz.targetPreviewStyle === "off") return "";
    return [
      "<div class=\"ll-popup-target-preview ll-popup-target-preview-" + (quiz.targetPreviewStyle === "box" ? "box" : "inline") + "\">",
      "<span>" + escapeHtml(quiz.targetPreviewLabel || "Your Daily Target:") + "</span>",
      "<strong>" + escapeHtml(target.dailyGoalGrams + "g/day") + "</strong>",
      "<small>Recommended range: " + escapeHtml(target.rangeText) + "</small>",
      "</div>"
    ].join("");
  }

  function getSampleProteinTarget() {
    return calculateProteinTarget(155, 48, 3);
  }

  function calculateProteinTarget(targetWeight, age, strengthDays) {
    var weight = Number(targetWeight);
    var years = Number(age);
    var strength = Number(strengthDays);
    var low = Math.round(weight * 0.6);
    var high = Math.round(weight);
    var strengthAdjustments = {
      0: 0,
      1: 0.1,
      2: 0.2,
      3: 0.25,
      4: 0.3,
      5: 0.35,
      6: 0.38,
      7: 0.4
    };
    var rawMultiplier = 0.6 + (strengthAdjustments[strength] || 0) + getProteinAgeAdjustment(years);
    var multiplier = clampNumber(rawMultiplier, 0.6, 1);
    var dailyGoal = clampNumber(roundToFive(weight * multiplier), low, high);

    return {
      lowGrams: low,
      highGrams: high,
      rangeText: low + "-" + high + "g/day",
      multiplier: Number(multiplier.toFixed(2)),
      dailyGoalGrams: dailyGoal
    };
  }

  function getProteinAgeAdjustment(age) {
    if (age >= 70) return 0.1;
    if (age >= 60) return 0.08;
    if (age >= 50) return 0.05;
    return 0;
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundToFive(value) {
    return Math.round(value / 5) * 5;
  }

  function showFormStatus(container, message) {
    var status = document.createElement("div");
    status.className = "ll-popup-form-status";
    status.textContent = message;
    container.appendChild(status);
    schedulePopupFit(container.closest(".ll-popup-root"));
  }

  function getKajabiScriptUrl(embed) {
    var match = String(embed || "").match(/<script[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*><\/script>/i);
    if (match) return match[1] || match[2] || match[3];
    var trimmed = String(embed || "").trim();
    if (/^https?:\/\/.+\.js(\?.*)?$/i.test(trimmed)) return trimmed;
    var formMatch = trimmed.match(/^(https?:\/\/[^/]+\/forms\/[^/?#]+)(?:[/?#].*)?$/i);
    if (formMatch) return formMatch[1].replace(/\/$/, "") + "/embed.js";
    return "";
  }

  function executeEmbedHtml(container, embed) {
    var template = document.createElement("template");
    template.innerHTML = embed;
    container.innerHTML = "";

    Array.prototype.slice.call(template.content.childNodes).forEach(function (node) {
      if (node.nodeName.toLowerCase() === "script") {
        var script = document.createElement("script");
        Array.prototype.slice.call(node.attributes).forEach(function (attr) {
          script.setAttribute(attr.name, attr.value);
        });
        script.text = node.text || node.textContent || "";
        container.appendChild(script);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });

    if (!container.childNodes.length && getKajabiScriptUrl(embed)) {
      var scriptOnly = document.createElement("script");
      scriptOnly.src = getKajabiScriptUrl(embed);
      scriptOnly.async = true;
      container.appendChild(scriptOnly);
    }
  }

  function injectKajabiIframe(container, scriptUrl) {
    container.innerHTML = "";
    var iframe = document.createElement("iframe");
    iframe.title = "Kajabi form";
    iframe.setAttribute("loading", "lazy");
    iframe.src = getKajabiFormPageUrl(scriptUrl);
    container.appendChild(iframe);
    schedulePopupFit(container.closest(".ll-popup-root"));
  }

  function getKajabiFormPageUrl(scriptUrl) {
    return String(scriptUrl || "").replace(/\/embed\.js(?:\?.*)?$/i, "");
  }

  function sizePreviewToImage(root, image, variant) {
    if (!root || !variant || !variant.sizeToImage || !image || !image.naturalWidth || !image.naturalHeight) return;

    var stage = root.closest(".dash-preview-stage");
    var isMobile = stage && stage.classList.contains("is-mobile");
    var stageWidth = stage ? stage.clientWidth : 0;
    var stageHeight = stage ? stage.clientHeight : 0;
    var previewWidth = stageWidth || (window.innerWidth || document.documentElement.clientWidth || 1024);
    var previewHeight = stageHeight || (window.innerHeight || document.documentElement.clientHeight || 768);
    var viewportWidth = Math.max(320, previewWidth);
    var viewportHeight = Math.max(420, previewHeight);
    var availableWidth = isMobile ? Math.min(360, Math.max(280, viewportWidth - 24)) : Math.max(280, viewportWidth - 24);
    var horizontalPadding = isMobile ? 48 : 48;
    var baseModalWidth = Number(variant.width) || 560;
    var verticalReserve = isMobile ? 360 : 320;
    var maxImageWidth = isMobile ? Math.max(220, availableWidth - horizontalPadding) : Math.max(220, baseModalWidth - horizontalPadding);
    var maxImageHeight = Math.max(isMobile ? 120 : 180, viewportHeight - verticalReserve);
    var scale = Math.min(1, maxImageWidth / image.naturalWidth, maxImageHeight / image.naturalHeight);
    var imageWidth = Math.round(image.naturalWidth * scale);
    var imageHeight = Math.round(image.naturalHeight * scale);
    var modalWidth = Math.max(baseModalWidth, imageWidth + 64);

    root.style.setProperty("--ll-popup-width", (isMobile ? Math.min(modalWidth, availableWidth) : modalWidth) + "px");
    root.style.setProperty("--ll-popup-image-max-height", imageHeight + "px");
    image.style.maxWidth = imageWidth + "px";
    image.style.maxHeight = imageHeight + "px";
  }

  function schedulePopupFit(root, variant) {
    if (!root) return;
    window.requestAnimationFrame(function () {
      fitPopupToViewport(root, variant);
    });
  }

  function fitPopupToViewport(root, variant) {
    var modal = root && root.querySelector(".ll-popup-modal");
    if (!modal || root.closest(".dash-preview-stage")) return;

    var viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 1024);
    var viewportHeight = Math.max(420, window.innerHeight || document.documentElement.clientHeight || 768);
    var availableHeight = viewportHeight - (viewportWidth <= 640 ? 24 : 48);
    var availableWidth = viewportWidth - 32;
    var image = root.querySelector(".ll-popup-image");

    root.style.setProperty("--ll-popup-scale", "1");
    root.style.removeProperty("--ll-popup-content-padding");
    root.style.removeProperty("--ll-popup-content-gap");

    if (variant && variant.sizeToImage && image) {
      sizePreviewToImage(root, image, variant);
    }

    if (image) {
      fitImageToRemainingSpace(root, modal, image, availableHeight);
    }

    if (modal.scrollHeight > availableHeight) {
      root.style.setProperty("--ll-popup-content-padding", viewportWidth <= 640 ? "18px 16px 16px" : "24px");
      root.style.setProperty("--ll-popup-content-gap", "12px");
      if (image) fitImageToRemainingSpace(root, modal, image, availableHeight);
    }

    var scale = Math.min(1, availableHeight / Math.max(1, modal.scrollHeight), availableWidth / Math.max(1, modal.scrollWidth));
    root.style.setProperty("--ll-popup-scale", String(Math.floor(scale * 1000) / 1000));
  }

  function fitImageToRemainingSpace(root, modal, image, availableHeight) {
    if (!image) return;
    var currentImageHeight = image.getBoundingClientRect().height || image.naturalHeight || 0;
    var nonImageHeight = modal.scrollHeight - currentImageHeight;
    var maxImageHeight = Math.floor(availableHeight - nonImageHeight - 2);
    var imageFloor = Math.min(90, Math.max(48, availableHeight * 0.18));

    if (maxImageHeight < currentImageHeight) {
      image.style.maxHeight = Math.max(imageFloor, maxImageHeight) + "px";
    }
  }

  function setPreviewMode(mode) {
    previewMode = mode;
    els.desktopPreview.classList.toggle("is-active", mode === "desktop");
    els.comparePreview.classList.toggle("is-active", mode === "compare");
    els.mobilePreview.classList.toggle("is-active", mode === "mobile");
    renderPreviews(mode);
  }

  function setPreviewStep(step) {
    previewStep = step;
    renderPreviews(previewMode);
  }

  function renderEmbedCode() {
    var base = normalizedAssetBaseUrl();
    els.embedCode.value = [
      "<script src=\"" + base + "/popup/popup-loader.js?v=2\" defer></script>"
    ].join("\n");
  }

  function normalizedAssetBaseUrl() {
    var value = els.assetBaseUrl.value.trim() || defaultAssetBaseUrl();
    return value.replace(/\/+$/, "");
  }

  function savedAssetBaseUrl() {
    var saved = localStorage.getItem(ASSET_BASE_KEY) || "";
    if (!saved || /^https?:\/\/localhost(?::\d+)?(?:\/|$)/i.test(saved) || /^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/i.test(saved)) {
      localStorage.setItem(ASSET_BASE_KEY, defaultAssetBaseUrl());
      return defaultAssetBaseUrl();
    }
    return saved;
  }

  function defaultAssetBaseUrl() {
    return PUBLIC_ASSET_BASE_URL;
  }

  function generateVariantsJs() {
    return "(function () {\n  window.LL_POPUP_CONFIG = " + JSON.stringify(config, null, 2) + ";\n})();\n";
  }

  function downloadConfig() {
    var blob = new Blob([generateVariantsJs()], { type: "text/javascript" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "variants.js";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function saveGitHubPublishSettings() {
    localStorage.setItem(GITHUB_OWNER_KEY, els.githubOwner.value.trim());
    localStorage.setItem(GITHUB_REPO_KEY, els.githubRepo.value.trim());
    localStorage.setItem(GITHUB_BRANCH_KEY, els.githubBranch.value.trim());
    localStorage.setItem(GITHUB_PATH_KEY, els.githubPath.value.trim());
    localStorage.setItem(GITHUB_TOKEN_KEY, els.githubToken.value.trim());
  }

  function publishConfigToGitHub() {
    var owner = els.githubOwner.value.trim();
    var repo = els.githubRepo.value.trim();
    var branch = els.githubBranch.value.trim() || "main";
    var path = els.githubPath.value.trim() || "popup/variants.js";
    var token = els.githubToken.value.trim();
    var message = els.githubMessage.value.trim() || "Publish popup variants from dashboard";

    saveGitHubPublishSettings();
    setPublishStatus("Preparing publish...", "");

    if (!owner || !repo || !path) {
      setPublishStatus("Add repository owner, repository name, and publish path before publishing.", "error");
      return;
    }

    normalizeVariantSlotIdentities(config);
    var versionMessage = ensureFreshPublishVersion();
    versionMessage += prepareVariantVersionsForPublish();
    saveDraftConfig();

    if (canUseLocalPublisher()) {
      publishConfigWithLocalServer(path, message, versionMessage);
      return;
    }

    if (!token) {
      setPublishStatus("Add a GitHub token before publishing from the hosted dashboard, or use the local dashboard at http://localhost:3102/dashboard/.", "error");
      return;
    }

    var apiBase = "https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
    var headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    fetch(apiBase + "?ref=" + encodeURIComponent(branch), { headers: headers })
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load current GitHub file. Check repo, branch, path, and token permissions.");
        return response.json();
      })
      .then(function (currentFile) {
        return fetch(apiBase, {
          method: "PUT",
          headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            message: message,
            content: encodeBase64(generateVariantsJs()),
            branch: branch,
            sha: currentFile.sha
          })
        });
      })
      .then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () {
            return {};
          }).then(function (body) {
            throw new Error(body.message || "GitHub publish failed.");
          });
        }
        return response.json();
      })
      .then(function (result) {
        var commitSha = result.commit && result.commit.sha ? result.commit.sha.slice(0, 7) : "published";
        promotePublishedConfig();
        showLatestTwoVersions();
        setPublishStatus(versionMessage + "Published popup/variants.js to GitHub (" + commitSha + "). GitHub Pages may take 1-2 minutes to refresh.", "success");
      })
      .catch(function (error) {
        setPublishStatus(error.message, "error");
      });
  }

  function ensureFreshPublishVersion() {
    config.configVersion = els.configVersion.value.trim() || formatDateVersion(new Date());
    els.configVersion.value = config.configVersion;
    return "";
  }

  function showLatestTwoVersions() {
    populateFilters();
    els.version.value = LATEST_TWO_VERSIONS;
    updateDashboard();
  }

  function prepareVariantVersionsForPublish() {
    var changed = [];
    activeVariants().forEach(function (variant) {
      var fingerprint = variantFingerprint(variant);
      var publishedVariant = publishedActiveVariants().find(function (candidate) {
        return candidate.id === variant.id;
      });
      var publishedFingerprint = publishedVariant ? variantFingerprint(publishedVariant) : "";

      if (publishedVariant && fingerprint === publishedFingerprint) {
        variant.trackingVersion = getVariantTrackingVersion(publishedVariant);
        variant.trackingFingerprint = publishedFingerprint;
        return;
      }

      if (variant.trackingFingerprint !== fingerprint) {
        variant.trackingVersion = config.configVersion || "v1";
        variant.trackingFingerprint = fingerprint;
        changed.push(variant.id);
      }
    });

    if (!changed.length) return "No variant content changed; existing tracking versions were retained. ";
    return "Started a new tracking version for Variant " + changed.join(" and ") + "; unchanged variants keep their existing data. ";
  }

  function canUseLocalPublisher() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  function publishConfigWithLocalServer(path, message, versionMessage) {
    fetch("/api/publish-github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: path,
        message: message,
        content: generateVariantsJs()
      })
    })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          if (!response.ok || body.ok === false) {
            throw new Error(body.error || "Local GitHub publish failed.");
          }
          return body;
        });
      })
      .then(function (body) {
        var note = body.status === "unchanged" ? "No file changes were needed." : "Published popup/variants.js to GitHub.";
        promotePublishedConfig();
        showLatestTwoVersions();
        setPublishStatus((versionMessage || "") + note + " GitHub Pages may take 1-2 minutes to refresh.", "success");
      })
      .catch(function (error) {
        setPublishStatus(error.message, "error");
      });
  }

  function setPublishStatus(message, type) {
    els.publishStatus.textContent = message || "";
    els.publishStatus.classList.toggle("is-error", type === "error");
    els.publishStatus.classList.toggle("is-success", type === "success");
  }

  function promotePublishedConfig() {
    originalConfig = cloneConfig(config);
    saveDraftConfig();
    renderEditors();
    renderPreviews(previewMode);
    populateFilters();
    updateDashboard();
  }

  function encodeBase64(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallbackCopy);
      return;
    }
    fallbackCopy();

    function fallbackCopy() {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  function sendSaveTestEvent(variant, button) {
    var payload = buildDashboardPayload("variant_save_test", variant);
    rows.push(payload);
    populateFilters();
    updateDashboard();

    if (!config.webhookUrl) {
      setButtonStatus(button, "Saved locally - add webhook URL");
      return;
    }

    postEvent(payload).then(function () {
      setButtonStatus(button, "Saved to Sheet");
    }).catch(function () {
      setButtonStatus(button, "Saved locally - webhook failed");
    });
  }

  function buildDashboardPayload(eventType, variant) {
    return {
      timestamp: new Date().toISOString(),
      testId: config.testId || "",
      configVersion: getEventVariantVersion(variant),
      changeNote: config.changeNote || "",
      variant: variant.id || "",
      variantLabel: buildVariantLabel(variant),
      variantSnapshot: JSON.stringify(getVariantSnapshot(variant)),
      eventType: eventType,
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrer: document.referrer,
      deviceType: getDeviceType(),
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_content: "",
      utm_term: "",
      userAgent: navigator.userAgent,
      sessionId: getDashboardSessionId()
    };
  }

  function postEvent(payload) {
    var json = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      var blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(config.webhookUrl, blob)) return Promise.resolve();
    }

    return fetch(config.webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true
    });
  }

  function sendLeadPayload(url, payload) {
    if (!url) return;
    var body = new URLSearchParams();
    body.set("name", payload.name || "");
    body.set("email", payload.email || "");

    if (navigator.sendBeacon) {
      if (navigator.sendBeacon(url, body)) return;
    }

    fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function setButtonStatus(button, text) {
    var original = "Save Draft + Log Version";
    button.textContent = text;
    window.setTimeout(function () {
      button.textContent = original;
    }, 2200);
  }

  function restoreWinningVariant() {
    var winner = findWinningVariant(rows);
    if (!winner) {
      window.alert("No eligible winning variant yet. A winner needs at least 1,000 popup views.");
      return;
    }

    var targetIndex = config.variants.findIndex(function (variant) {
      return variant.id === winner.variant;
    });
    if (targetIndex < 0) {
      targetIndex = config.variants.findIndex(function (variant) {
        return variant.active !== false;
      });
    }
    if (targetIndex < 0) {
      window.alert("I found a winner, but there is no active variant slot to restore it into.");
      return;
    }

    var current = config.variants[targetIndex] || {};
    var restored = Object.assign({}, current, winner.snapshot, {
      id: current.id || winner.variant,
      active: current.active !== false,
      trafficSplit: current.trafficSplit
    });

    config.variants[targetIndex] = restored;
    config.configVersion = "restored-" + new Date().toISOString().slice(0, 10) + "-" + sanitizeKey(restored.id || "winner");
    config.changeNote = [
      "Restored winning variant ",
      winner.variant,
      " after ",
      formatNumber(winner.views),
      " views at ",
      formatPercent(winner.leadRate),
      " lead conversion."
    ].join("");
    config = ensureConfigDefaults(config);
    saveDraftConfig();
    renderEditors();
    renderPreviews(previewMode);
    renderEmbedCode();
    populateFilters();
    updateDashboard();
    window.alert("Restored Variant " + restored.id + " from the best eligible test: " + formatPercent(winner.leadRate) + " lead conversion across " + formatNumber(winner.views) + " views.");
  }

  function findWinningVariant(data) {
    var minimumViews = 1000;
    var groups = {};

    data.forEach(function (row) {
      var snapshot = parseVariantSnapshot(row.variantSnapshot);
      if (!snapshot) return;

      var key = [
        row.testId || "",
        row.configVersion || "unversioned",
        row.variant || "Unknown",
        row.variantSnapshot || ""
      ].join("::");

      if (!groups[key]) {
        groups[key] = {
          variant: row.variant || "Unknown",
          configVersion: row.configVersion || "unversioned",
          snapshot: snapshot,
          sessions: new Set(),
          leadSessions: new Set(),
          views: 0,
          leads: 0,
          firstSeen: null,
          lastSeen: null
        };
      }

      var item = groups[key];
      var timestamp = parseTimestamp(row.timestamp);
      if (timestamp) {
        if (!item.firstSeen || timestamp < item.firstSeen) item.firstSeen = timestamp;
        if (!item.lastSeen || timestamp > item.lastSeen) item.lastSeen = timestamp;
      }
      if (row.eventType === "popup_view") {
        item.views += 1;
        if (row.sessionId) item.sessions.add(row.sessionId);
      }
      if (row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted") {
        item.leads += 1;
        if (row.sessionId) item.leadSessions.add(row.sessionId);
      }
    });

    return Object.keys(groups).map(function (key) {
      var item = groups[key];
      item.uniqueVisitors = item.sessions.size || item.views;
      item.uniqueLeads = item.leadSessions.size || item.leads;
      item.leadRate = rate(item.uniqueLeads, item.uniqueVisitors);
      return item;
    }).filter(function (item) {
      return item.uniqueVisitors >= minimumViews;
    }).sort(function (a, b) {
      if (b.leadRate !== a.leadRate) return b.leadRate - a.leadRate;
      return b.uniqueVisitors - a.uniqueVisitors;
    })[0] || null;
  }

  function parseVariantSnapshot(value) {
    if (!value) return null;
    try {
      var snapshot = JSON.parse(value);
      return snapshot && typeof snapshot === "object" ? snapshot : null;
    } catch (error) {
      return null;
    }
  }

  function parseTimestamp(value) {
    if (!value) return null;
    var timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  }

  function renderVariationHistory(data) {
    var groups = {};
    var hidden = getHiddenHistoryKeys();
    data.forEach(function (row) {
      var label = row.variantLabel || labelFromSnapshot(row.variantSnapshot) || [row.variant || "Unknown", row.configVersion || "unversioned"].join(" / ");
      var key = [
        row.testId || "",
        row.configVersion || "unversioned",
        row.variant || "Unknown"
      ].join("::");

      if (hidden.indexOf(key) >= 0) return;

      if (!groups[key]) {
        groups[key] = {
          key: key,
          label: label,
          variant: row.variant || "Unknown",
          configVersion: row.configVersion || "unversioned",
          changeNote: row.changeNote || "",
          sessions: new Set(),
          leadSessions: new Set(),
          views: 0,
          clicks: 0,
          quizSubmits: 0,
          leads: 0,
          submits: 0,
          saves: 0,
          lastSeen: ""
        };
      }

      var item = groups[key];
      if (!item.lastSeen || String(row.timestamp) >= item.lastSeen) {
        item.label = label;
      }
      if (row.eventType === "popup_view") {
        if (row.sessionId) item.sessions.add(row.sessionId);
        item.views += 1;
      }
      if (row.eventType === "popup_form_click") item.clicks += 1;
      if (row.eventType === "popup_quiz_submit") item.quizSubmits += 1;
      if (row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted") item.leads += 1;
      if (row.eventType === "popup_submit_attempt" || row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted") item.submits += 1;
      if (row.eventType === "variant_save_test") item.saves += 1;
      if (!item.changeNote && row.changeNote) item.changeNote = row.changeNote;
      if (!item.lastSeen || String(row.timestamp) > item.lastSeen) item.lastSeen = row.timestamp || "";
    });

    var history = Object.keys(groups).map(function (key) {
      return groups[key];
    }).sort(function (a, b) {
      return String(b.lastSeen).localeCompare(String(a.lastSeen));
    });

    if (!history.length) {
      els.history.innerHTML = "<p class=\"dash-empty-state\">No historical variation rows yet. Click Save Draft + Log Version on a variant to record the first one.</p>";
      return;
    }

    els.history.innerHTML = history.map(function (item) {
      var uniqueImpressions = item.sessions.size || item.views;
      var fullSubmissions = item.leadSessions.size || fullSubmissionCount(item.leads, item.submits);
      var isSingleStep = item.label.indexOf("Flow: Single-step") >= 0;
      return [
        "<article class=\"dash-history-card\" data-history-key=\"" + escapeHtmlAttr(item.key) + "\">",
        "<button class=\"dash-history-remove\" type=\"button\" data-history-remove=\"" + escapeHtmlAttr(item.key) + "\" aria-label=\"Hide historical variation\">&times;</button>",
        "<div><strong>" + escapeHtml(item.label) + "</strong><span>" + escapeHtml(item.variant) + " / " + escapeHtml(item.configVersion) + "</span></div>",
        "<dl>",
        "<div><dt>Unique impressions</dt><dd>" + formatNumber(uniqueImpressions) + "</dd></div>",
        "<div><dt>Views</dt><dd>" + formatNumber(item.views) + "</dd></div>",
        "<div><dt>Click rate</dt><dd>" + formatPercent(rate(item.clicks, item.views)) + "</dd></div>",
        "<div><dt>Full CVR</dt><dd>" + formatPercent(rate(fullSubmissions, uniqueImpressions)) + "</dd></div>",
        "<div><dt>Quiz CVR</dt><dd>" + (isSingleStep ? "N/A" : formatPercent(rate(item.quizSubmits, uniqueImpressions))) + "</dd></div>",
        "<div><dt>Lead-step CVR</dt><dd>" + (isSingleStep ? "N/A" : formatPercent(rate(fullSubmissions, item.quizSubmits))) + "</dd></div>",
        "</dl>",
        item.changeNote ? "<p>" + escapeHtml(item.changeNote) + "</p>" : "",
        item.saves ? "<small>Saved/tested " + formatNumber(item.saves) + " time" + (item.saves === 1 ? "" : "s") + "</small>" : "",
        "</article>"
      ].join("");
    }).join("");
  }

  function onHistoryClick(event) {
    var button = event.target.closest("[data-history-remove]");
    if (!button) return;

    var key = button.dataset.historyRemove;
    var hidden = getHiddenHistoryKeys();
    if (hidden.indexOf(key) < 0) hidden.push(key);
    localStorage.setItem(HIDDEN_HISTORY_KEY, JSON.stringify(hidden));
    updateDashboard();
  }

  function renderFullVariantHistory(data) {
    if (!els.fullHistoryBody) return;
    var history = sortFullVariantHistory(applyFullHistoryFilters(buildFullVariantHistory(data)));
    updateFullHistorySortHeaders();
    renderFullHistoryInsights(history);
    renderConversionCoach(history);

    if (!history.length) {
      els.fullHistoryBody.innerHTML = "<tr><td colspan=\"15\">No matching historical variants yet.</td></tr>";
      return;
    }

    els.fullHistoryBody.innerHTML = history.map(function (item) {
      var snapshotHtml = item.snapshot
        ? "<details class=\"dash-history-details\"><summary>View</summary><pre>" + escapeHtml(JSON.stringify(item.snapshot, null, 2)) + "</pre></details>"
        : "";
      var matchHtml = renderLiveMatchBadge(item);
      var rowClass = compareFullHistoryToLive ? " class=\"dash-history-match-row dash-history-match-" + escapeHtmlAttr(item.liveMatchLevel) + "\"" : "";
      return [
        "<tr" + rowClass + ">",
        "<td>" + (item.isLive ? "<span class=\"dash-live-badge\">Live</span>" : "<span class=\"dash-archive-badge\">Archived</span>") + "</td>",
        "<td>" + escapeHtml(item.configVersion) + "</td>",
        "<td>" + escapeHtml(item.publishedLabel) + "</td>",
        "<td>" + escapeHtml(item.daysLabel) + "</td>",
        "<td class=\"dash-history-text-cell\">" + escapeHtml(item.headline) + "</td>",
        "<td class=\"dash-history-text-cell\">" + escapeHtml(item.cta) + "</td>",
        "<td>" + escapeHtml(item.flowLabel) + "</td>",
        "<td><span class=\"dash-color-pill\" style=\"--pill-color:" + escapeHtmlAttr(item.buttonColor) + "\"></span>" + escapeHtml(item.buttonColor) + "</td>",
        "<td>" + formatNumber(item.views) + "</td>",
        "<td>" + formatNumber(item.fullSubmissions) + "</td>",
        "<td>" + formatPercent(item.cvr) + "</td>",
        "<td>" + matchHtml + "</td>",
        "<td>" + renderPatternTags(item) + "</td>",
        "<td class=\"dash-history-text-cell\">" + escapeHtml(item.uniqueAttributes) + "</td>",
        "<td><button class=\"dash-history-restore\" type=\"button\" data-history-restore=\"" + escapeHtmlAttr(item.key) + "\">Restore as Draft</button>" + snapshotHtml + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderFullHistoryInsights(history) {
    if (!els.fullHistoryInsights) return;
    var insights = buildFullHistoryInsights(history);
    els.fullHistoryInsights.innerHTML = insights.map(function (insight) {
      return [
        "<article class=\"dash-history-insight dash-history-insight-" + escapeHtmlAttr(insight.tone) + "\">",
        "<span>" + escapeHtml(insight.label) + "</span>",
        "<strong>" + escapeHtml(insight.title) + "</strong>",
        "<p>" + escapeHtml(insight.body) + "</p>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderConversionCoach(history) {
    if (!els.conversionCoach) return;
    var recommendation = buildConversionCoachRecommendation(history);
    var actions = recommendation.actions.map(function (action) {
      return "<li>" + escapeHtml(action) + "</li>";
    }).join("");
    var keep = recommendation.keep.map(function (item) {
      return "<li>" + escapeHtml(item) + "</li>";
    }).join("");

    els.conversionCoach.innerHTML = [
      "<div class=\"dash-coach-head\">",
      "<span>Conversion Coach</span>",
      "<strong>" + escapeHtml(recommendation.title) + "</strong>",
      "<p>" + escapeHtml(recommendation.summary) + "</p>",
      "</div>",
      "<div class=\"dash-coach-grid\">",
      "<section><h3>Next Move</h3><ul>" + actions + "</ul></section>",
      "<section><h3>Keep Stable</h3><ul>" + keep + "</ul></section>",
      "<section><h3>Why</h3><p>" + escapeHtml(recommendation.why) + "</p></section>",
      "</div>"
    ].join("");
  }

  function buildConversionCoachRecommendation(history) {
    var qualified = history.filter(function (item) { return item.views > 0; });
    var live = qualified.filter(function (item) { return item.isLive; }).sort(function (a, b) { return b.cvr - a.cvr; });
    var patternGroups = aggregatePatternGroups(qualified).filter(function (group) { return group.views >= 50; }).sort(function (a, b) { return b.cvr - a.cvr; });
    var strongest = patternGroups[0] || null;
    var weakest = patternGroups.length ? patternGroups.slice().sort(function (a, b) { return a.cvr - b.cvr; })[0] : null;

    if (!qualified.length) {
      return {
        title: "Load data to generate a next-test brief",
        summary: "Once the dashboard has event rows, the coach will identify the lower-performing live variant and suggest one clean change.",
        actions: ["Load published CSV data.", "Keep each A/B test limited to one meaningful change.", "Publish only when Variant A and Variant B are clearly named."],
        keep: ["Current tracking setup", "One-variable testing discipline", "Current live embed"],
        why: "The coach needs views and leads before it can compare variants responsibly."
      };
    }

    if (live.length < 2) {
      return {
        title: "Let both live variants collect data",
        summary: "The coach sees traffic, but it needs both live variants represented before recommending which one to edit.",
        actions: ["Confirm both live variants are active.", "Wait until each live variant has meaningful views.", strongest ? "Watch whether " + strongest.label + " continues leading." : "Avoid interpreting isolated rows too aggressively."],
        keep: ["Current live winner", "Current traffic split", "Current tracking version names"],
        why: "A true A/B test needs a live comparison, not just historical pattern data."
      };
    }

    var winner = live[0];
    var loser = live[live.length - 1];
    var cvrGap = winner.cvr - loser.cvr;
    var targetPattern = strongest ? strongest.label : "the strongest-performing pattern";
    var weakPattern = weakest && weakest.label !== targetPattern ? weakest.label : "";
    var action = coachActionForPattern(loser, strongest, weakest);

    return {
      title: "Edit Live " + loser.variant + " next",
      summary: "Live " + winner.variant + " is ahead at " + formatPercent(winner.cvr) + " vs Live " + loser.variant + " at " + formatPercent(loser.cvr) + ".",
      actions: [
        action,
        "Keep the test to one major change so the next read is clean.",
        "Name the new version with the changed attribute, then Save & Publish."
      ],
      keep: [
        "Keep Live " + winner.variant + " unchanged as the current control.",
        "Keep the same traffic split until the new test has enough views.",
        weakPattern ? "Avoid stacking multiple fixes for " + weakPattern + " in one publish." : "Avoid changing headline, image, and CTA all at once."
      ],
      why: cvrGap > 0
        ? "The live gap is " + formatPercent(cvrGap) + ". Historical tags currently point toward " + targetPattern + " as the clearest pattern to borrow."
        : "The live variants are close. A small single-variable change toward " + targetPattern + " is the cleanest way to learn without muddying the test."
    };
  }

  function coachActionForPattern(loser, strongest, weakest) {
    var pattern = strongest && strongest.label || "";
    var weak = weakest && weakest.label || "";
    var variantLabel = "Live " + loser.variant;

    if (pattern.indexOf("CTA") >= 0) return "Change " + variantLabel + " button color/text toward " + pattern + ".";
    if (pattern === "Email-only") return "Keep " + variantLabel + " as a single-step email opt-in and test copy or image only.";
    if (pattern === "Quiz-first") return "Test whether " + variantLabel + " should reintroduce the quiz step before email capture.";
    if (pattern === "No first name") return "Remove first name from " + variantLabel + " so email is the only required field.";
    if (pattern === "Progress bar") return "Add or keep the progress bar on " + variantLabel + " while changing no other structural field.";
    if (pattern.indexOf("visual") >= 0 || pattern === "Image-sized") return "Change only the image treatment on " + variantLabel + " toward " + pattern + ".";
    if (weak) return "Move " + variantLabel + " away from " + weak + " and toward " + pattern + ".";
    return "Change one high-visibility element on " + variantLabel + ", preferably headline or image, while keeping the rest stable.";
  }

  function renderLiveMatchBadge(item) {
    if (!item.liveMatchLabel) return "<span class=\"dash-match-muted\">-</span>";
    var details = compareFullHistoryToLive && item.liveMatchDetails && item.liveMatchDetails.length
      ? "<ul class=\"dash-live-match-list\">" + item.liveMatchDetails.map(function (detail) {
        return "<li class=\"dash-live-match-item dash-live-match-item-" + escapeHtmlAttr(detail.status) + "\">" + escapeHtml(detail.label) + "</li>";
      }).join("") + "</ul>"
      : "";
    return [
      "<span class=\"dash-live-match dash-live-match-" + escapeHtmlAttr(item.liveMatchLevel) + "\">",
      escapeHtml(item.liveMatchLabel),
      "</span>",
      "<small class=\"dash-live-match-detail\">",
      escapeHtml(Math.round(Number(item.liveMatchScore || 0) * 100) + "% vs Live " + item.liveMatchVariant),
      "</small>",
      details
    ].join("");
  }

  function renderPatternTags(item) {
    if (!item.patternTags || !item.patternTags.length) return "<span class=\"dash-match-muted\">-</span>";
    return [
      "<ul class=\"dash-pattern-tags\">",
      item.patternTags.map(function (tag) {
        return "<li class=\"dash-pattern-tag dash-pattern-tag-" + escapeHtmlAttr(tag.tone) + "\">" + escapeHtml(tag.label) + "</li>";
      }).join(""),
      "</ul>"
    ].join("");
  }

  function buildFullHistoryInsights(history) {
    var qualified = history.filter(function (item) {
      return item.views > 0;
    });
    var totalViews = qualified.reduce(function (sum, item) { return sum + item.views; }, 0);

    if (!qualified.length) {
      return [{
        tone: "neutral",
        label: "Pattern Read",
        title: "Load data to unlock recommendations",
        body: "Once the sheet has views and leads, this section will summarize which popup attributes appear to help or hurt conversion."
      }];
    }

    if (totalViews < 100) {
      return [{
        tone: "warn",
        label: "Sample Size",
        title: formatNumber(totalViews) + " total views in this slice",
        body: "Early signals are visible, but wait for at least 100 views before treating pattern recommendations as decision-grade."
      }].concat(bestLiveInsight(qualified));
    }

    var groups = aggregatePatternGroups(qualified);
    var eligible = groups.filter(function (group) {
      return group.views >= 50;
    }).sort(function (a, b) {
      return b.cvr - a.cvr;
    });

    if (!eligible.length) {
      return [{
        tone: "warn",
        label: "Pattern Read",
        title: "Not enough repeated pattern data yet",
        body: "You have traffic, but no individual pattern has enough views to compare confidently. Keep tests simple so the next few variants create cleaner signals."
      }].concat(bestLiveInsight(qualified));
    }

    var best = eligible[0];
    var weakest = eligible.slice().sort(function (a, b) { return a.cvr - b.cvr; })[0];
    var insights = [{
      tone: "good",
      label: "Working Pattern",
      title: best.label + " is leading",
      body: formatPercent(best.cvr) + " CVR across " + formatNumber(best.views) + " views and " + formatNumber(best.leads) + " leads."
    }];

    if (weakest && weakest.label !== best.label && best.cvr - weakest.cvr >= 0.01) {
      insights.push({
        tone: "bad",
        label: "Weak Pattern",
        title: weakest.label + " is lagging",
        body: formatPercent(weakest.cvr) + " CVR across " + formatNumber(weakest.views) + " views. Consider changing this attribute before retesting."
      });
    }

    insights.push(nextTestInsight(best, weakest, qualified));
    return insights.concat(bestLiveInsight(qualified)).slice(0, 4);
  }

  function aggregatePatternGroups(history) {
    var groups = {};
    history.forEach(function (item) {
      (item.patternTags || []).forEach(function (tag) {
        if (["Live test", "Archived", "Needs more views", "No views yet"].indexOf(tag.label) >= 0) return;
        if (!groups[tag.label]) {
          groups[tag.label] = { label: tag.label, views: 0, leads: 0, rows: 0, cvr: 0 };
        }
        groups[tag.label].views += item.views;
        groups[tag.label].leads += item.fullSubmissions;
        groups[tag.label].rows += 1;
      });
    });

    return Object.keys(groups).map(function (key) {
      var group = groups[key];
      group.cvr = rate(group.leads, group.views);
      return group;
    });
  }

  function nextTestInsight(best, weakest, history) {
    var liveRows = history.filter(function (item) { return item.isLive; });
    var liveWithViews = liveRows.filter(function (item) { return item.views > 0; }).sort(function (a, b) { return b.cvr - a.cvr; });

    if (liveWithViews.length >= 2 && liveWithViews[0].cvr > liveWithViews[1].cvr) {
      return {
        tone: "neutral",
        label: "Next Test",
        title: "Change the lower performer first",
        body: "Keep Live " + liveWithViews[0].variant + " stable and test one change on Live " + liveWithViews[1].variant + ", preferably toward the strongest pattern: " + best.label + "."
      };
    }

    if (weakest && weakest.label !== best.label) {
      return {
        tone: "neutral",
        label: "Next Test",
        title: "Test toward " + best.label,
        body: "Your cleanest next experiment is to keep most copy/design stable and swap one weaker attribute toward the stronger pattern."
      };
    }

    return {
      tone: "neutral",
      label: "Next Test",
      title: "Keep isolating one change",
      body: "The history is starting to form patterns. Keep each new variant limited to one major change so recommendations get sharper."
    };
  }

  function bestLiveInsight(history) {
    var live = history.filter(function (item) {
      return item.isLive && item.views > 0;
    }).sort(function (a, b) {
      return b.cvr - a.cvr;
    });

    if (!live.length) return [];
    return [{
      tone: "neutral",
      label: "Live Read",
      title: "Live " + live[0].variant + " is currently ahead",
      body: formatPercent(live[0].cvr) + " CVR across " + formatNumber(live[0].views) + " views. Use this as directional until both live variants have enough traffic."
    }];
  }

  function onFullHistoryTableClick(event) {
    var restoreButton = event.target.closest("[data-history-restore]");
    if (restoreButton) {
      restoreHistoricalVariant(restoreButton.dataset.historyRestore);
      return;
    }

    var button = event.target.closest("[data-history-sort]");
    if (!button) return;

    var key = button.dataset.historySort;
    if (fullHistorySort.key === key) {
      fullHistorySort.direction = fullHistorySort.direction === "asc" ? "desc" : "asc";
    } else {
      fullHistorySort.key = key;
      fullHistorySort.direction = defaultFullHistorySortDirection(key);
    }
    updateDashboard();
  }

  function restoreHistoricalVariant(historyKey) {
    var item = buildFullVariantHistory(rows).find(function (candidate) {
      return candidate.key === historyKey;
    });

    if (!item || !item.snapshot) {
      window.alert("This historical row does not contain a restorable variant snapshot.");
      return;
    }

    var livePerformance = getCurrentLiveVariantPerformance();
    if (livePerformance.length < 2 || livePerformance.every(function (item) { return item.sessions === 0; })) {
      window.alert("Load the tracking CSV first so the dashboard can identify the lower-converting live variant safely.");
      return;
    }

    var lowerPerformer = livePerformance[0];
    var higherPerformer = livePerformance[1];
    var slotId = lowerPerformer.variant;
    var confirmed = window.confirm(
      "Restore this historical design into lower-performing Variant " + slotId + "?\n\n" +
      "Variant " + lowerPerformer.variant + ": " + formatPercent(lowerPerformer.cvr) + " CVR\n" +
      "Variant " + higherPerformer.variant + ": " + formatPercent(higherPerformer.cvr) + " CVR\n\n" +
      "This only creates an editable draft. Nothing will go live until you explicitly publish to GitHub."
    );
    if (!confirmed) return;

    var targetIndex = (config.variants || []).findIndex(function (variant) {
      return variant.id === slotId;
    });
    if (targetIndex < 0) targetIndex = slotId === "B" ? 1 : 0;

    var current = config.variants[targetIndex] || { id: slotId, name: "Variant " + slotId, active: true, trafficSplit: 50 };
    var restored = Object.assign({}, current, cloneConfig(item.snapshot), {
      id: slotId,
      name: current.name || "Variant " + slotId,
      active: true,
      trafficSplit: current.trafficSplit == null ? 50 : current.trafficSplit,
      trackingVersion: current.trackingVersion,
      trackingFingerprint: current.trackingFingerprint
    });

    config.variants[targetIndex] = restored;
    normalizeVariantSlotIdentities(config);
    ensureFlowSteps(restored);
    selectedFlowSteps[slotId] = 0;
    config.changeNote = "Restored " + slotId + " from " + item.configVersion;
    saveDraftConfig();
    renderEditors();
    renderPreviews(previewMode);
    renderEmbedCode();
    populateFilters();
    updateDashboard();

    var editor = els.editors.querySelectorAll(".dash-editor-card")[targetIndex];
    if (editor) editor.scrollIntoView({ behavior: "smooth", block: "start" });
    window.alert("Restored the historical design into lower-performing Variant " + slotId + " as a draft. The winning variant and live website were not changed. Edit or preview the draft, then publish only when ready.");
  }

  function getCurrentLiveVariantPerformance() {
    var liveVersions = getLiveVariantVersions();
    var currentTestId = originalConfig.testId || config.testId || "";
    var liveRows = rows.filter(function (row) {
      if (currentTestId && row.testId !== currentTestId) return false;
      return liveVersions[row.variant] && (row.configVersion || "unversioned") === liveVersions[row.variant];
    });

    return buildMetrics(liveRows, publishedActiveVariants()).filter(function (item) {
      return liveVersions[item.variant] === item.configVersion;
    }).sort(function (a, b) {
      if (a.cvr !== b.cvr) return a.cvr - b.cvr;
      if (a.fullSubmissions !== b.fullSubmissions) return a.fullSubmissions - b.fullSubmissions;
      if (a.sessions !== b.sessions) return b.sessions - a.sessions;
      return a.variant === "A" ? -1 : 1;
    });
  }

  function sortFullVariantHistory(history) {
    var key = fullHistorySort.key || "published";
    var direction = fullHistorySort.direction === "asc" ? 1 : -1;
    return history.slice().sort(function (a, b) {
      if (key === "published" && a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      var comparison = compareFullHistoryValues(sortFullHistoryValue(a, key), sortFullHistoryValue(b, key));
      if (comparison === 0) comparison = compareFullHistoryValues(sortFullHistoryValue(a, "published"), sortFullHistoryValue(b, "published"));
      return comparison * direction;
    });
  }

  function sortFullHistoryValue(item, key) {
    if (key === "published") return item.firstSeen ? item.firstSeen.getTime() : 0;
    if (key === "days") return Number(item.daysLabel || 0);
    if (key === "views") return item.views;
    if (key === "fullSubmissions") return item.fullSubmissions;
    if (key === "cvr") return item.cvr;
    if (key === "liveMatchScore") return item.liveMatchScore;
    if (key === "patternTagsText") return item.patternTagsText;
    if (key === "status") return item.status;
    if (key === "flow") return item.flowLabel;
    if (key === "buttonColor") return item.buttonColor;
    if (key === "headline") return item.headline;
    if (key === "cta") return item.cta;
    if (key === "uniqueAttributes") return item.uniqueAttributes;
    return item[key] || "";
  }

  function compareFullHistoryValues(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
  }

  function defaultFullHistorySortDirection(key) {
    return ["published", "days", "views", "fullSubmissions", "cvr", "liveMatchScore"].indexOf(key) >= 0 ? "desc" : "asc";
  }

  function updateFullHistorySortHeaders() {
    if (!els.fullHistoryTable) return;
    Array.from(els.fullHistoryTable.querySelectorAll("[data-history-sort]")).forEach(function (button) {
      var active = button.dataset.historySort === fullHistorySort.key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-sort", active ? (fullHistorySort.direction === "asc" ? "ascending" : "descending") : "none");
      button.setAttribute("data-sort-direction", active ? fullHistorySort.direction : "");
    });
  }

  function buildFullVariantHistory(data) {
    var liveVersions = getLiveVariantVersions();
    var liveComparisonItems = buildLiveComparisonItems();
    var groups = {};

    publishedActiveVariants().forEach(function (variant) {
      var version = getVariantTrackingVersion(variant);
      var key = fullHistoryKey(originalConfig.testId || config.testId || "", version, variant.id);
      var snapshot = getVariantSnapshot(variant);
      if (!groups[key]) groups[key] = createFullHistoryItem({
        testId: originalConfig.testId || config.testId || "",
        variant: variant.id,
        configVersion: version,
        variantLabel: buildVariantLabel(snapshot),
        variantSnapshot: JSON.stringify(snapshot)
      }, snapshot);
    });

    data.forEach(function (row) {
      var snapshot = parseVariantSnapshot(row.variantSnapshot);
      if (!snapshot && !row.variantLabel) return;
      var key = fullHistoryBaseKey(row);

      if (!groups[key]) groups[key] = createFullHistoryItem(row, snapshot);
    });

    data.forEach(function (row) {
      var snapshot = parseVariantSnapshot(row.variantSnapshot);
      var key = fullHistoryBaseKey(row);

      if (!groups[key]) groups[key] = createFullHistoryItem(row, snapshot);
      updateFullHistoryItem(groups[key], row, snapshot);
    });

    return Object.keys(groups).map(function (key) {
      var item = groups[key];
      item.key = key;
      item.publishedLabel = item.firstSeen ? shortDateTime(item.firstSeen) : "";
      item.daysLabel = item.firstSeen && item.lastSeen ? String(Math.max(1, Math.ceil((item.lastSeen - item.firstSeen) / (24 * 60 * 60 * 1000)))) : "";
      item.actionSessions.forEach(function (sessionId) {
        if (!item.sessions.has(sessionId)) item.sessions.add(sessionId);
      });
      item.views = Math.max(item.views, item.sessions.size, item.quizSubmits, item.leads, item.submits);
      item.fullSubmissions = fullHistorySubmissionCount(item);
      item.uniqueVisitors = item.sessions.size || item.views;
      item.cvr = rate(item.fullSubmissions, item.uniqueVisitors);
      item.closeRate = rate(item.closes, item.views);
      item.uniqueAttributes = describeVariantAttributes(item.snapshot, item.label);
      item.isLive = item.configVersion === liveVersions[item.variant];
      item.liveMatch = compareHistoryItemToLive(item, liveComparisonItems);
      item.liveMatchScore = item.liveMatch.score;
      item.liveMatchVariant = item.liveMatch.variant;
      item.liveMatchLevel = item.liveMatch.level;
      item.liveMatchLabel = item.liveMatch.label;
      item.liveMatchDetails = item.liveMatch.details;
      item.patternTags = buildPatternTags(item);
      item.patternTagsText = item.patternTags.map(function (tag) { return tag.label; }).join(", ");
      item.status = item.isLive ? "live" : "archived";
      item.searchText = [
        item.status,
        item.variant,
        item.configVersion,
        item.changeNote,
        item.label,
        item.headline,
        item.subheadline,
        item.cta,
        item.flowLabel,
        item.buttonColor,
        item.patternTagsText,
        item.uniqueAttributes
      ].join(" ").toLowerCase();
      return item;
    }).sort(function (a, b) {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return (b.lastSeen ? b.lastSeen.getTime() : 0) - (a.lastSeen ? a.lastSeen.getTime() : 0);
    });
  }

  function fullHistoryBaseKey(row) {
    return fullHistoryKey(row.testId || "", row.configVersion || "unversioned", row.variant || "Unknown");
  }

  function fullHistoryKey(testId, version, variant) {
    return [
      version || "unversioned",
      variant || "Unknown"
    ].join("::");
  }

  function createFullHistoryItem(row, snapshot) {
    var label = row.variantLabel || labelFromSnapshot(row.variantSnapshot) || "";
    var source = snapshot || {};
    var quiz = source.proteinQuiz || {};
    var flowSteps = Array.isArray(source.flowSteps) ? source.flowSteps.filter(function (step) { return step.enabled !== false; }) : [];
    var firstFlowStep = flowSteps[0] || {};
    var leadFlowStep = flowSteps.filter(function (step) { return step.type === "lead"; })[0] || {};
    var isSingleStep = quiz.showQuizStep === false || label.indexOf("Flow: Single-step") >= 0;
    return {
      variant: row.variant || "Unknown",
      configVersion: row.configVersion || "unversioned",
      label: label || [row.variant || "Unknown", row.configVersion || "unversioned"].join(" / "),
      snapshot: snapshot,
      changeNote: row.changeNote || "",
      headline: cleanHistoryText(firstFlowStep.headlineHtml || source.headlineHtml || source.headline || headlineFromLabel(label) || ""),
      subheadline: cleanHistoryText(firstFlowStep.subheadlineHtml || source.subheadlineHtml || source.subheadline || ""),
      cta: leadFlowStep.buttonText || quiz.leadButtonText || source.buttonText || "",
      flow: flowSteps.length > 2 ? "multi" : (isSingleStep ? "single" : "quiz"),
      flowLabel: flowSteps.length ? flowSteps.length + "-step custom flow" : (isSingleStep ? "Single-step" : (quiz.multiStepEnabled === true ? "Multi-step quiz + lead form" : "Quiz + lead form")),
      buttonColor: source.accentColor || "",
      firstSeen: null,
      lastSeen: null,
      sessions: new Set(),
      actionSessions: new Set(),
      leadSessions: new Set(),
      submitSessions: new Set(),
      views: 0,
      clicks: 0,
      quizSubmits: 0,
      leads: 0,
      submits: 0,
      closes: 0,
      fullSubmissions: 0,
      cvr: 0,
      closeRate: 0,
      isLive: false,
      status: "archived",
      uniqueAttributes: "",
      searchText: ""
    };
  }

  function updateFullHistoryItem(item, row, snapshot) {
    var timestamp = parseTimestamp(row.timestamp);
    if (timestamp) {
      if (!item.firstSeen || timestamp < item.firstSeen) item.firstSeen = timestamp;
      if (!item.lastSeen || timestamp > item.lastSeen) item.lastSeen = timestamp;
    }
    if (!item.snapshot && snapshot) item.snapshot = snapshot;
    if (!item.changeNote && row.changeNote) item.changeNote = row.changeNote;
    var type = eventType(row);
    if (row.sessionId && (type === "popup_quiz_submit" || type === "popup_lead_submit" || type === "kajabi_form_submitted" || type === "popup_submit_attempt")) {
      item.actionSessions.add(row.sessionId);
    }
    if (type === "popup_view") {
      if (row.sessionId) item.sessions.add(row.sessionId);
      item.views += 1;
    }
    if (type === "popup_form_click") item.clicks += 1;
    if (type === "popup_quiz_submit") item.quizSubmits += 1;
    if (type === "popup_lead_submit" || type === "kajabi_form_submitted") {
      item.leads += 1;
      if (row.sessionId) item.leadSessions.add(row.sessionId);
    }
    if (type === "popup_submit_attempt" || type === "popup_lead_submit" || type === "kajabi_form_submitted") {
      item.submits += 1;
      if (row.sessionId) item.submitSessions.add(row.sessionId);
    }
    if (type === "popup_close") item.closes += 1;
  }

  function fullHistorySubmissionCount(item) {
    if (item.leadSessions && item.leadSessions.size) return item.leadSessions.size;
    var leads = Number(item.leads || 0);
    if (leads > 0) return leads;
    if (config.leadMagnetMode !== "protein_plan" && item.submitSessions && item.submitSessions.size) return item.submitSessions.size;
    return config.leadMagnetMode === "protein_plan" ? 0 : Number(item.submits || 0);
  }

  function buildPatternTags(item) {
    var snapshot = item.snapshot || {};
    var quiz = snapshot.proteinQuiz || {};
    var tags = [];

    addPatternTag(tags, item.isLive ? "Live test" : "Archived", item.isLive ? "live" : "neutral");

    if (item.views >= 100) {
      if (item.cvr >= 0.05) addPatternTag(tags, "High CVR", "good");
      else if (item.cvr >= 0.025) addPatternTag(tags, "Mid CVR", "neutral");
      else addPatternTag(tags, "Low CVR", "bad");
    } else if (item.views > 0) {
      addPatternTag(tags, "Needs more views", "warn");
    } else {
      addPatternTag(tags, "No views yet", "muted");
    }

    if (item.fullSubmissions > 0) addPatternTag(tags, item.fullSubmissions + " lead" + (item.fullSubmissions === 1 ? "" : "s"), "good");
    if (item.flow === "single") addPatternTag(tags, "Email-only", "neutral");
    else addPatternTag(tags, "Quiz-first", "neutral");
    if (quiz.showFirstName === false) addPatternTag(tags, "No first name", "neutral");
    if (quiz.progressEnabled) addPatternTag(tags, "Progress bar", "neutral");
    if (snapshot.sizeToImage) addPatternTag(tags, "Image-sized", "neutral");
    if (snapshot.accentColor) addPatternTag(tags, colorNameTag(snapshot.accentColor) + " CTA", "neutral");
    if (snapshot.imageUrl) addPatternTag(tags, imageAttributeLabel(snapshot.imageUrl), "neutral");

    return tags.slice(0, 8);
  }

  function addPatternTag(tags, label, tone) {
    if (!label || tags.some(function (tag) { return tag.label === label; })) return;
    tags.push({ label: label, tone: tone || "neutral" });
  }

  function colorNameTag(color) {
    var value = String(color || "").toLowerCase();
    if (value === "#ea8011" || value.indexOf("orange") >= 0) return "Orange";
    if (value === "#06b00b" || value === "#07b00c" || value.indexOf("green") >= 0) return "Green";
    if (value === "#050505" || value === "#000000" || value.indexOf("black") >= 0) return "Black";
    if (value === "#ffffff" || value === "#fcfcfc" || value.indexOf("white") >= 0) return "White";
    return value ? value.toUpperCase() : "Custom";
  }

  function buildLiveComparisonItems() {
    return publishedActiveVariants().map(function (variant) {
      var snapshot = getVariantSnapshot(variant);
      return {
        variant: variant.id,
        snapshot: snapshot,
        headline: cleanHistoryText(snapshot.headlineHtml || snapshot.headline || ""),
        cta: liveSnapshotCta(snapshot),
        flow: liveSnapshotFlow(snapshot),
        buttonColor: normalizeComparableText(snapshot.accentColor),
        backgroundColor: normalizeComparableText(snapshot.backgroundColor),
        imageUrl: normalizeComparableText(snapshot.imageUrl),
        width: String(snapshot.width || ""),
        textAlign: normalizeComparableText(snapshot.textAlign)
      };
    });
  }

  function compareHistoryItemToLive(item, liveItems) {
    if (!liveItems.length) return { score: 0, variant: "", level: "low", label: "Different", details: [] };

    var best = liveItems.reduce(function (best, live) {
      var score = liveSimilarityScore(item, live);
      return !best || score > best.score ? { score: score, variant: live.variant, live: live } : best;
    }, null);

    var level = best.score >= 0.85 ? "high" : best.score >= 0.55 ? "medium" : "low";
    var label = level === "high" ? "Strong" : level === "medium" ? "Similar" : "Different";
    return {
      score: best.score,
      variant: best.variant,
      level: level,
      label: label,
      details: liveDifferenceDetails(item, best.live).slice(0, 6)
    };
  }

  function liveDifferenceDetails(item, live) {
    var snapshot = item.snapshot || {};
    var comparisons = [
      {
        name: "Flow",
        score: item.flow === live.flow ? 1 : 0,
        same: "Same flow",
        close: "Similar flow",
        different: "Different flow"
      },
      {
        name: "Headline",
        score: textSimilarity(item.headline || cleanHistoryText(snapshot.headlineHtml || snapshot.headline || ""), live.headline),
        same: "Same headline",
        close: "Similar headline",
        different: "Different headline"
      },
      {
        name: "CTA",
        score: textSimilarity(item.cta || liveSnapshotCta(snapshot), live.cta),
        same: "Same CTA",
        close: "Similar CTA",
        different: "Different CTA"
      },
      {
        name: "Image",
        score: exactSimilarity(snapshot.imageUrl, live.imageUrl),
        same: "Same image",
        close: "Similar image",
        different: "Different image"
      },
      {
        name: "Button",
        score: exactSimilarity(item.buttonColor || snapshot.accentColor, live.buttonColor),
        same: "Same button color",
        close: "Similar button color",
        different: "Different button color"
      },
      {
        name: "Background",
        score: exactSimilarity(snapshot.backgroundColor, live.backgroundColor),
        same: "Same background",
        close: "Similar background",
        different: "Different background"
      },
      {
        name: "Fields",
        score: exactSimilarity(Boolean(snapshot.proteinQuiz && snapshot.proteinQuiz.showFirstName === false), Boolean(live.snapshot.proteinQuiz && live.snapshot.proteinQuiz.showFirstName === false)),
        same: "Same fields",
        close: "Similar fields",
        different: "Different fields"
      },
      {
        name: "Progress",
        score: exactSimilarity(Boolean(snapshot.proteinQuiz && snapshot.proteinQuiz.progressEnabled), Boolean(live.snapshot.proteinQuiz && live.snapshot.proteinQuiz.progressEnabled)),
        same: "Same progress",
        close: "Similar progress",
        different: "Different progress"
      }
    ];

    return comparisons.map(function (item) {
      var status = item.score >= 0.85 ? "same" : item.score >= 0.45 ? "close" : "different";
      return {
        name: item.name,
        status: status,
        score: item.score,
        label: status === "same" ? item.same : status === "close" ? item.close : item.different
      };
    }).sort(function (a, b) {
      var order = { different: 0, close: 1, same: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.name.localeCompare(b.name);
    });
  }

  function liveSimilarityScore(item, live) {
    var snapshot = item.snapshot || {};
    var total = 0;
    var score = 0;

    function add(weight, matched) {
      total += weight;
      score += weight * matched;
    }

    add(18, item.flow === live.flow ? 1 : 0);
    add(18, textSimilarity(item.headline || cleanHistoryText(snapshot.headlineHtml || snapshot.headline || ""), live.headline));
    add(12, textSimilarity(item.cta || liveSnapshotCta(snapshot), live.cta));
    add(10, exactSimilarity(item.buttonColor || snapshot.accentColor, live.buttonColor));
    add(8, exactSimilarity(snapshot.backgroundColor, live.backgroundColor));
    add(12, exactSimilarity(snapshot.imageUrl, live.imageUrl));
    add(5, exactSimilarity(snapshot.width, live.width));
    add(5, exactSimilarity(snapshot.textAlign, live.textAlign));
    add(6, exactSimilarity(Boolean(snapshot.sizeToImage), Boolean(live.snapshot.sizeToImage)));
    add(3, exactSimilarity(Boolean(snapshot.proteinQuiz && snapshot.proteinQuiz.showFirstName === false), Boolean(live.snapshot.proteinQuiz && live.snapshot.proteinQuiz.showFirstName === false)));
    add(3, exactSimilarity(Boolean(snapshot.proteinQuiz && snapshot.proteinQuiz.progressEnabled), Boolean(live.snapshot.proteinQuiz && live.snapshot.proteinQuiz.progressEnabled)));

    return total ? score / total : 0;
  }

  function liveSnapshotFlow(snapshot) {
    var quiz = snapshot && snapshot.proteinQuiz || {};
    var flowSteps = snapshot && Array.isArray(snapshot.flowSteps) ? snapshot.flowSteps.filter(function (step) { return step.enabled !== false; }) : [];
    if (flowSteps.length > 2) return "multi";
    if (flowSteps.length === 1) return "single";
    if (quiz.showQuizStep === false) return "single";
    return quiz.multiStepEnabled === true ? "multi" : "quiz";
  }

  function liveSnapshotCta(snapshot) {
    var quiz = snapshot && snapshot.proteinQuiz || {};
    return quiz.leadButtonText || snapshot.buttonText || "";
  }

  function exactSimilarity(a, b) {
    var left = normalizeComparableText(a);
    var right = normalizeComparableText(b);
    if (!left && !right) return 1;
    return left === right ? 1 : 0;
  }

  function textSimilarity(a, b) {
    var left = tokenizeComparableText(a);
    var right = tokenizeComparableText(b);
    if (!left.length && !right.length) return 1;
    if (!left.length || !right.length) return 0;
    var union = unique(left.concat(right));
    var intersection = left.filter(function (token) {
      return right.indexOf(token) >= 0;
    });
    return union.length ? unique(intersection).length / union.length : 0;
  }

  function tokenizeComparableText(value) {
    return unique(normalizeComparableText(cleanHistoryText(value)).split(" ").filter(function (token) {
      return token.length > 2;
    }));
  }

  function normalizeComparableText(value) {
    return String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9#]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function applyFullHistoryFilters(history) {
    var search = String(els.historySearch && els.historySearch.value || "").trim().toLowerCase();
    var status = els.historyStatus ? els.historyStatus.value : "";
    var flow = els.historyFlow ? els.historyFlow.value : "";
    var minViews = Math.max(0, Number(els.historyMinViews && els.historyMinViews.value || 0));
    var minLeads = Math.max(0, Number(els.historyMinLeads && els.historyMinLeads.value || 0));
    var minCvr = parseOptionalPercentFilter(els.historyMinCvr);
    var maxCvr = parseOptionalPercentFilter(els.historyMaxCvr);

    return history.filter(function (item) {
      if (search && item.searchText.indexOf(search) === -1) return false;
      if (status && item.status !== status) return false;
      if (flow && item.flow !== flow) return false;
      if (minViews && item.views < minViews) return false;
      if (minLeads && item.fullSubmissions < minLeads) return false;
      if (minCvr !== null && item.cvr < minCvr) return false;
      if (maxCvr !== null && item.cvr > maxCvr) return false;
      return true;
    });
  }

  function parseOptionalPercentFilter(input) {
    var raw = input ? String(input.value || "").trim() : "";
    if (!raw) return null;
    var value = Number(raw);
    return Number.isFinite(value) ? value / 100 : null;
  }

  function describeVariantAttributes(snapshot, label) {
    if (!snapshot) return cleanHistoryText(label || "");
    var quiz = snapshot.proteinQuiz || {};
    var parts = [];
    parts.push(quiz.showQuizStep === false ? "Email-only single step" : "Quiz first");
    if (quiz.progressEnabled) parts.push("Progress bar");
    if (quiz.showFirstName === false) parts.push("No first name");
    if (quiz.showEmail !== false) parts.push("Email field");
    if (snapshot.sizeToImage) parts.push("Image-sized");
    if (snapshot.width) parts.push(String(snapshot.width) + "px wide");
    if (snapshot.textAlign) parts.push(String(snapshot.textAlign) + " aligned");
    if (snapshot.imageUrl) parts.push(imageAttributeLabel(snapshot.imageUrl));
    return unique(parts).join(", ");
  }

  function imageAttributeLabel(url) {
    var value = String(url || "").toLowerCase();
    if (value.indexOf("mockup") >= 0 || value.indexOf("preview") >= 0) return "Mockup visual";
    if (value.indexOf("female") >= 0 || value.indexOf("male") >= 0 || value.indexOf("people") >= 0) return "People visual";
    return "Image visual";
  }

  function cleanHistoryText(value) {
    return stripHtml(String(value || "")).replace(/\s+/g, " ").trim();
  }

  function stripHtml(value) {
    var div = document.createElement("div");
    div.innerHTML = value;
    return div.textContent || div.innerText || "";
  }

  function headlineFromLabel(label) {
    var match = String(label || "").match(/CTA:\s*([^|]+)/i);
    return match ? match[1].trim() : "";
  }

  function shortDateTime(date) {
    if (!date) return "";
    return (date.getMonth() + 1) + "/" + date.getDate() + "/" + String(date.getFullYear()).slice(-2);
  }

  function getHiddenHistoryKeys() {
    try {
      var value = JSON.parse(localStorage.getItem(HIDDEN_HISTORY_KEY)) || [];
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function buildVariantLabel(variant) {
    var quiz = getProteinQuizConfig(variant);
    var flowCount = Array.isArray(variant.flowSteps) ? variant.flowSteps.filter(function (step) { return step.enabled !== false; }).length : 0;
    var parts = [
      "Flow: " + (flowCount ? flowCount + "-step custom flow" : (quiz.showQuizStep === false ? "Single-step" : (quiz.multiStepEnabled === true ? "Multi-step quiz + form" : "Quiz + form"))),
      "Fields: " + [
        quiz.showFirstName === false ? "" : "Name",
        quiz.showEmail === false ? "" : "Email"
      ].filter(Boolean).join("+"),
      "CTA: " + (config.leadMagnetMode === "protein_plan" ? quiz.leadButtonText : (variant.buttonText || "Submit")),
      "Button: " + (variant.accentColor || ""),
      "Accent: " + (variant.brandAccentColor || "#06b00b"),
      "BG: " + (variant.backgroundColor || ""),
      "Width: " + (variant.width || ""),
      variant.height ? "Height: " + variant.height : "",
      variant.sizeToImage ? "Size to image" : "",
      "Font: " + String(variant.fontFamily || "Arial").split(",")[0],
      "Align: " + (variant.textAlign || "left"),
      variant.imageUrl ? "Image" : "No image"
    ];
    return parts.filter(Boolean).join(" | ");
  }

  function getVariantSnapshot(variant) {
    return {
      headline: variant.headline || "",
      headlineHtml: variant.headlineHtml || "",
      headlineFontSize: variant.headlineFontSize || "",
      subheadline: variant.subheadline || "",
      subheadlineHtml: variant.subheadlineHtml || "",
      subheadlineFontSize: variant.subheadlineFontSize || "",
      valueLine: variant.valueLine || "",
      valueLineHtml: variant.valueLineHtml || "",
      valueLineFontSize: variant.valueLineFontSize || "",
      buttonText: variant.buttonText || "",
      buttonFontSize: variant.buttonFontSize || "",
      imageUrl: variant.imageUrl || "",
      imageAlt: variant.imageAlt || "",
      width: variant.width || "",
      height: variant.height || "",
      sizeToImage: Boolean(variant.sizeToImage),
      backgroundColor: variant.backgroundColor || "",
      textColor: variant.textColor || "",
      brandAccentColor: variant.brandAccentColor || "",
      accentColor: variant.accentColor || "",
      fontFamily: variant.fontFamily || "",
      headlineFontWeight: variant.headlineFontWeight || 700,
      bodyFontWeight: variant.bodyFontWeight || 400,
      buttonFontWeight: variant.buttonFontWeight || 700,
      textAlign: variant.textAlign || "",
      trafficSplit: variant.trafficSplit || "",
      proteinQuiz: cloneConfig(variant.proteinQuiz || {}),
      flowSteps: cloneConfig(variant.flowSteps || [])
    };
  }

  function initializeVariantTracking() {
    (config.variants || []).forEach(function (variant) {
      var originalVariant = (originalConfig.variants || []).find(function (item) {
        return item.id === variant.id;
      }) || variant;

      if (!variant.trackingVersion) {
        legacyTrackingVariantIds.push(variant.id);
        variant.trackingVersion = originalVariant.trackingVersion || originalConfig.configVersion || config.configVersion || "v1";
      }
      variant.trackingVersion = normalizeTrackedVersion(variant.trackingVersion);
      if (!variant.trackingFingerprint) {
        variant.trackingFingerprint = variantFingerprint(originalVariant);
      }
    });
  }

  function reconcileLegacyVariantVersions() {
    if (!legacyTrackingVariantIds.length || !rows.length) return;

    legacyTrackingVariantIds.slice().forEach(function (variantId) {
      var variant = activeVariants().find(function (item) {
        return item.id === variantId;
      });
      if (!variant) return;

      var fingerprint = legacyVariantFingerprint(getVariantSnapshot(variant));
      var matches = rows.filter(function (row) {
        if (row.variant !== variantId || !row.variantSnapshot) return false;
        var snapshot = parseVariantSnapshot(row.variantSnapshot);
        return snapshot && legacyVariantFingerprint(snapshot) === fingerprint;
      }).sort(function (a, b) {
        var aTime = parseTimestamp(a.timestamp);
        var bTime = parseTimestamp(b.timestamp);
        return (aTime ? aTime.getTime() : 0) - (bTime ? bTime.getTime() : 0);
      });

      if (matches.length) variant.trackingVersion = matches[0].configVersion || variant.trackingVersion;
      variant.trackingFingerprint = variantFingerprint(variant);
    });

    legacyTrackingVariantIds = [];
    saveDraftConfig();
  }

  function variantFingerprint(variant) {
    return JSON.stringify(getVariantSnapshot(variant));
  }

  function legacyVariantFingerprint(variant) {
    return JSON.stringify({
      headline: variant.headline || "",
      subheadline: variant.subheadline || "",
      buttonText: variant.buttonText || "",
      imageUrl: variant.imageUrl || "",
      imageAlt: variant.imageAlt || "",
      width: variant.width || "",
      height: variant.height || "",
      sizeToImage: Boolean(variant.sizeToImage),
      backgroundColor: variant.backgroundColor || "",
      textColor: variant.textColor || "",
      brandAccentColor: variant.brandAccentColor || "",
      accentColor: variant.accentColor || "",
      fontFamily: variant.fontFamily || "",
      textAlign: variant.textAlign || "",
      trafficSplit: variant.trafficSplit || ""
    });
  }

  function getVariantTrackingVersion(variant) {
    return variant && variant.trackingVersion || config.configVersion || "v1";
  }

  function getEventVariantVersion(variant) {
    if (!variant) return config.configVersion || "v1";
    return variantFingerprint(variant) === variant.trackingFingerprint
      ? getVariantTrackingVersion(variant)
      : config.configVersion || "v1";
  }

  function getLiveVariantVersions() {
    return publishedActiveVariants().reduce(function (versions, variant) {
      versions[variant.id] = getVariantTrackingVersion(variant);
      return versions;
    }, {});
  }

  function normalizeTrackedVersion(value) {
    var version = String(value || "");
    var automatic = version.match(/^test-(\d{4})(\d{2})(\d{2})(?:\d{4})?$/);
    if (!automatic) return version || "unversioned";
    return Number(automatic[2]) + "/" + Number(automatic[3]) + "/" + automatic[1];
  }

  function formatDateVersion(date) {
    return (date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear();
  }

  function labelFromSnapshot(value) {
    if (!value) return "";
    try {
      return buildVariantLabel(JSON.parse(value));
    } catch (error) {
      return "";
    }
  }

  function sanitizeRichHtml(value) {
    var template = document.createElement("template");
    template.innerHTML = String(value || "");
    var allowed = ["B", "STRONG", "I", "EM", "U", "SPAN", "BR", "FONT"];

    Array.prototype.slice.call(template.content.querySelectorAll("*")).forEach(function (node) {
      if (node.nodeName === "FONT") {
        var color = normalizeCssColor(node.getAttribute("color"));
        var span = document.createElement("span");
        if (color) span.setAttribute("style", "color: " + color + ";");
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
        return;
      }

      if (allowed.indexOf(node.nodeName) === -1) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }

      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        if (node.nodeName === "SPAN" && attr.name === "style") {
          var color = extractAllowedColor(attr.value);
          if (color) {
            node.setAttribute("style", "color: " + color + ";");
            return;
          }
        }
        node.removeAttribute(attr.name);
      });
    });

    return template.innerHTML;
  }

  function extractAllowedColor(value) {
    var match = String(value || "").match(/color:\s*(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))/i);
    return normalizeCssColor(match && match[1]);
  }

  function richTextInputColor(value, fallback) {
    var template = document.createElement("template");
    template.innerHTML = sanitizeRichHtml(value || "");
    var styled = template.content.querySelector("span[style*='color']");
    if (styled) {
      var explicitColor = cssColorToInputHex(extractAllowedColor(styled.getAttribute("style")));
      if (explicitColor) return explicitColor;
    }
    return cssColorToInputHex(fallback) || "#172026";
  }

  function cssColorToInputHex(value) {
    var color = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return ("#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]).toLowerCase();
    }
    var rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!rgb) return "";
    return "#" + rgb.slice(1).map(function (channel) {
      return clampNumber(Number(channel), 0, 255).toString(16).padStart(2, "0");
    }).join("");
  }

  function normalizeCssColor(value) {
    var color = String(value || "").trim();
    if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
    var rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!rgb) return "";
    var channels = rgb.slice(1).map(function (channel) {
      return clampNumber(Number(channel), 0, 255);
    });
    return "rgb(" + channels.join(", ") + ")";
  }

  function getDashboardSessionId() {
    var key = "ll_popup_dashboard_session";
    var current = sessionStorage.getItem(key);
    if (current) return current;
    current = "lld_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, current);
    return current;
  }

  function getDeviceType() {
    var width = window.innerWidth || document.documentElement.clientWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  function parseCsv(text) {
    var lines = [];
    var row = [];
    var cell = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i += 1) {
      var char = text[i];
      var next = text[i + 1];
      if (char === "\"" && inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (char === "\"") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        lines.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    if (cell || row.length) {
      row.push(cell);
      lines.push(row);
    }

    var headers = lines.shift() || [];
    return lines.filter(function (line) {
      return line.some(Boolean);
    }).map(function (line) {
      var record = headers.reduce(function (record, header, index) {
        var rawHeader = String(header || "").trim();
        var value = (line[index] || "").trim();
        var canonicalHeader = canonicalCsvHeader(rawHeader);
        if (rawHeader) record[rawHeader] = value;
        if (canonicalHeader) record[canonicalHeader] = value;
        return record;
      }, {});
      record.configVersion = normalizeRowConfigVersion(record);
      return record;
    });
  }

  function canonicalCsvHeader(header) {
    var normalized = String(header || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    var aliases = {
      timestamp: "timestamp",
      datetime: "timestamp",
      date: "timestamp",
      testid: "testId",
      test: "testId",
      configversion: "configVersion",
      version: "configVersion",
      changenote: "changeNote",
      note: "changeNote",
      notes: "changeNote",
      variant: "variant",
      variantid: "variant",
      variantlabel: "variantLabel",
      label: "variantLabel",
      variantsnapshot: "variantSnapshot",
      snapshot: "variantSnapshot",
      eventtype: "eventType",
      event: "eventType",
      type: "eventType",
      pageurl: "pageUrl",
      url: "pageUrl",
      pagetitle: "pageTitle",
      title: "pageTitle",
      devicetype: "deviceType",
      device: "deviceType",
      sessionid: "sessionId",
      session: "sessionId"
    };
    return aliases[normalized] || header;
  }

  function normalizeRowConfigVersion(record) {
    var version = normalizeTrackedVersion(record && record.configVersion);
    if (version === "6/30/2026" && isCorrectedSingleStepRow(record)) {
      return "6/30/2026 Single Step";
    }
    return version;
  }

  function isCorrectedSingleStepRow(record) {
    var label = String(record && record.variantLabel || "");
    var snapshot = String(record && record.variantSnapshot || "");
    var note = String(record && record.changeNote || "");
    return label.indexOf("Flow: Single-step") >= 0
      || snapshot.indexOf("\"showQuizStep\":false") >= 0
      || note.indexOf("Single step form (corrected)") >= 0;
  }

  function activeVariants() {
    return config.variants.filter(function (variant) {
      return variant.active !== false;
    });
  }

  function publishedActiveVariants() {
    return (originalConfig.variants || []).filter(function (variant) {
      return variant.active !== false;
    });
  }

  function metricKey(version, variant) {
    return String(version || "unversioned") + "::" + String(variant || "Unknown");
  }

  function loadDraftConfig() {
    try {
      var draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
      var resetToken = originalConfig.dashboardDraftResetToken || "";
      if (draft && resetToken && draft.dashboardDraftResetToken !== resetToken) {
        draft = cloneConfig(originalConfig);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
      if (draft && originalConfig.leadMagnetMode === "protein_plan" && draft.leadMagnetMode !== "protein_plan") {
        draft = Object.assign(cloneConfig(originalConfig), {
          webhookUrl: draft.webhookUrl || originalConfig.webhookUrl || "",
          leadWebhookUrl: draft.leadWebhookUrl || originalConfig.leadWebhookUrl || ""
        });
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
      return ensureConfigDefaults(draft || cloneConfig(originalConfig));
    } catch (error) {
      return ensureConfigDefaults(cloneConfig(originalConfig));
    }
  }

  function ensureConfigDefaults(value) {
    var defaultColors = ["#111827", "#ffffff", "#f8fafc", "#172026", "#1f6feb", "#0f766e", "#c2410c", "#fbfaf7", "#1c2520", "#d9dee7"];
    value.configVersion = value.configVersion || "v1";
    value.changeNote = value.changeNote || "";
    value.trackingCsvUrl = value.trackingCsvUrl || originalConfig.trackingCsvUrl || "";
    value.kajabiFormEmbed = value.kajabiFormEmbed || originalConfig.kajabiFormEmbed || "";
    value.kajabiEmbedMode = value.kajabiEmbedMode || originalConfig.kajabiEmbedMode || "auto";
    value.formMode = value.formMode || originalConfig.formMode || "zapier";
    value.leadMagnetMode = value.leadMagnetMode || originalConfig.leadMagnetMode || "";
    value.leadWebhookUrl = value.leadWebhookUrl || originalConfig.leadWebhookUrl || "";
    value.proteinPlanUrl = value.proteinPlanUrl || originalConfig.proteinPlanUrl || "";
    value.reopenAfterCloseSeconds = Number(value.reopenAfterCloseSeconds);
    if (!Number.isFinite(value.reopenAfterCloseSeconds)) value.reopenAfterCloseSeconds = Number(originalConfig.reopenAfterCloseSeconds || 0);
    value.proteinQuiz = Object.assign(getProteinQuizDefaults(), originalConfig.proteinQuiz || {}, value.proteinQuiz || {});
    value.triggers = value.triggers || originalConfig.triggers || {};
    value.triggers.delayMs = Number(value.triggers.delayMs);
    if (!Number.isFinite(value.triggers.delayMs)) value.triggers.delayMs = 35000;
    value.triggers.scrollDepth = Number(value.triggers.scrollDepth);
    if (!Number.isFinite(value.triggers.scrollDepth)) value.triggers.scrollDepth = 0.5;
    value.savedColors = (value.savedColors || originalConfig.savedColors || defaultColors).slice(0, 10).concat(defaultColors).slice(0, 10);
    value.variants = value.variants || [];
    normalizeVariantSlotIdentities(value);
    value.variants.forEach(function (variant) {
      var originalVariant = (originalConfig.variants || []).find(function (item) {
        return item.id === variant.id;
      }) || {};
      variant.fontFamily = variant.fontFamily || "Arial, Helvetica, sans-serif";
      variant.headlineFontWeight = variant.headlineFontWeight || 700;
      variant.bodyFontWeight = variant.bodyFontWeight || 400;
      variant.buttonFontWeight = variant.buttonFontWeight || 700;
      variant.textAlign = variant.textAlign || originalVariant.textAlign || "left";
      variant.height = variant.height || originalVariant.height || "";
      variant.sizeToImage = Boolean(variant.sizeToImage || originalVariant.sizeToImage);
      variant.brandAccentColor = variant.brandAccentColor || originalVariant.brandAccentColor || "#06b00b";
      variant.headlineHtml = variant.headlineHtml || originalVariant.headlineHtml || escapeHtml(variant.headline || "");
      variant.headlineFontSize = variant.headlineFontSize || originalVariant.headlineFontSize || "";
      variant.subheadlineHtml = variant.subheadlineHtml || originalVariant.subheadlineHtml || escapeHtml(variant.subheadline || "");
      variant.subheadlineFontSize = variant.subheadlineFontSize || originalVariant.subheadlineFontSize || "";
      variant.valueLine = variant.valueLine || originalVariant.valueLine || "";
      variant.valueLineHtml = variant.valueLineHtml || originalVariant.valueLineHtml || escapeHtml(variant.valueLine || "");
      variant.valueLineFontSize = variant.valueLineFontSize || originalVariant.valueLineFontSize || "";
      variant.buttonFontSize = variant.buttonFontSize || originalVariant.buttonFontSize || "";
      variant.imageAlt = variant.imageAlt || "";
      variant.proteinQuiz = Object.assign(getProteinQuizDefaults(), value.proteinQuiz || {}, originalVariant.proteinQuiz || {}, variant.proteinQuiz || {});
    });
    return value;
  }

  function normalizeVariantSlotIdentities(targetConfig) {
    var variants = targetConfig && Array.isArray(targetConfig.variants) ? targetConfig.variants : [];
    if (variants[0]) variants[0].id = "A";
    if (variants[1]) variants[1].id = "B";
    return variants;
  }

  function saveDraftConfig() {
    config.draftSavedAt = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
  }

  function cloneConfig(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeKey(value) {
    return String(value).replace(/[^a-z0-9_-]/gi, "_");
  }

  function rate(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
  }

  function fullSubmissionCount(leads, submits) {
    if (config.leadMagnetMode === "protein_plan") return Number(leads || 0);
    return Number(leads || submits || 0);
  }

  function uniqueFullSubmissionCount(item) {
    if (item.leadSessions && item.leadSessions.size) return item.leadSessions.size;
    if (Number(item.leads || 0) > 0) return Number(item.leads || 0);
    if (config.leadMagnetMode !== "protein_plan" && item.submitSessions && item.submitSessions.size) return item.submitSessions.size;
    return config.leadMagnetMode === "protein_plan" ? 0 : Number(item.submits || 0);
  }

  function unique(values) {
    return values.filter(function (value, index, array) {
      return value !== undefined && array.indexOf(value) === index;
    });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatPercent(value, signed) {
    var percent = (Number(value || 0) * 100).toFixed(1) + "%";
    return signed && value > 0 ? "+" + percent : percent;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function escapeHtmlAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
