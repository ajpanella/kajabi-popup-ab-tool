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
  var config = loadDraftConfig();
  var urlParams = new URLSearchParams(window.location.search);
  var defaultCsvUrl = urlParams.get("csv") || localStorage.getItem(CSV_URL_KEY) || "";
  var googleDocUrl = urlParams.get("doc") || "";
  var trackingSheetUrl = urlParams.get("sheet") || "https://docs.google.com/spreadsheets/d/1fjbkrBO5r1XaJf3x-WNT0UNjEtn0IlDlAA9e2Sza69w";
  var rows = [];
  var charts = {};
  var previewMode = "desktop";
  var previewStep = "quiz";
  var lastColorTarget = null;

  var els = {
    csvUrl: document.getElementById("csv-url"),
    loadData: document.getElementById("load-data"),
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
    warning: document.getElementById("sample-warning"),
    body: document.getElementById("performance-body")
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
  populateFilters();
  updateDashboard();

  els.loadData.addEventListener("click", loadCsv);
  [els.testId, els.variant, els.version, els.start, els.end, els.pageUrl, els.device].forEach(function (element) {
    element.addEventListener("input", updateDashboard);
  });
  [els.webhookUrl, els.leadMagnetMode, els.leadWebhookUrl, els.proteinPlanUrl, els.delaySeconds, els.scrollDepth, els.configVersion, els.changeNote].forEach(function (element) {
    element.addEventListener("input", onGlobalConfigInput);
  });
  els.editors.addEventListener("input", onEditorInput);
  els.editors.addEventListener("click", onEditorClick);
  els.editors.addEventListener("focusin", onEditorFocus);
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

  els.quizStepPreview.addEventListener("click", function () {
    setPreviewStep("quiz");
  });

  els.leadStepPreview.addEventListener("click", function () {
    setPreviewStep("lead");
  });

  if (defaultCsvUrl) loadCsv();

  function loadCsv() {
    var csvUrl = els.csvUrl.value.trim();
    if (!csvUrl) return;
    localStorage.setItem(CSV_URL_KEY, csvUrl);

    fetch(csvUrl)
      .then(function (response) {
        if (!response.ok) throw new Error("Unable to load CSV");
        return response.text();
      })
      .then(function (text) {
        rows = parseCsv(text);
        populateFilters();
        updateDashboard();
      })
      .catch(function (error) {
        window.alert(error.message);
      });
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
    els.scrollDepth.value = Math.round((Number.isFinite(scrollDepth) ? scrollDepth : 0.5) * 100);
    els.configVersion.value = config.configVersion || "v1";
    els.changeNote.value = config.changeNote || "";
    renderPalette();
    activeVariants().forEach(function (variant, index) {
      var label = buildVariantLabel(variant);
      var card = document.createElement("article");
      card.className = "dash-editor-card";
      card.innerHTML = [
        "<div class=\"dash-editor-title\"><h3>Variant " + escapeHtml(variant.id) + "</h3><span>" + escapeHtml(label) + "</span></div>",
        editorInput("headline", index, "Headline", variant.headline || "", "text"),
        editorRichText("subheadlineHtml", index, "Subheadline", variant.subheadlineHtml || escapeHtml(variant.subheadline || "")),
        config.leadMagnetMode === "protein_plan" ? "" : editorInput("buttonText", index, "CTA button text", variant.buttonText || "Submit", "text"),
        editorInput("imageUrl", index, "Image URL", variant.imageUrl || "", "url"),
        editorInput("imageAlt", index, "Image alt text", variant.imageAlt || "", "text"),
        "<div class=\"dash-color-row\">",
        editorInput("backgroundColor", index, "Background", variant.backgroundColor || "#ffffff", "color"),
        editorInput("textColor", index, "Text", variant.textColor || "#172026", "color"),
        editorInput("accentColor", index, "Button", variant.accentColor || "#1f6feb", "color"),
        "</div>",
        editorSelect("fontFamily", index, "Font", variant.fontFamily || "Arial, Helvetica, sans-serif"),
        editorAlignmentSelect("textAlign", index, "Text alignment", variant.textAlign || "left"),
        editorInput("width", index, "Width px", String(variant.width || 560), "number"),
        editorInput("height", index, "Height px", String(variant.height || ""), "number"),
        editorCheckbox("sizeToImage", index, "Size to Image", Boolean(variant.sizeToImage)),
        editorInput("trafficSplit", index, "Traffic split", String(variant.trafficSplit || 0), "number"),
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
    if (key === "width" || key === "height" || key === "trafficSplit") value = value === "" ? "" : Number(value);
    setNestedValue(variant, key, value);
    if (key === "subheadlineHtml") {
      variant.subheadline = target.textContent || "";
    }

    saveDraftConfig();
    var label = target.closest(".dash-editor-card").querySelector(".dash-editor-title span");
    if (label) label.textContent = buildVariantLabel(variant);
    renderPreviews(previewMode);
    renderEmbedCode();
    populateFilters();
    updateDashboard();
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
    var testButton = event.target.closest("[data-test-popup]");
    if (testButton) {
      var testVariant = activeVariants()[Number(testButton.dataset.testPopup)];
      if (testVariant) showDashboardTestPopup(testVariant);
      return;
    }

    var richButton = event.target.closest("[data-rich-command]");
    if (richButton) {
      applyRichCommand(richButton);
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
    var quiz = getProteinQuizConfig(variant);
    return [
      "<div class=\"dash-flow-editor dash-variant-flow-editor\">",
      "<div class=\"dash-flow-head\"><strong>Protein Quiz Flow</strong><span>Variant-specific quiz labels, placeholders, and step-two copy.</span></div>",
      "<div class=\"dash-global-editor\">",
      editorInput("proteinQuiz.targetWeightLabel", index, "Target weight label", quiz.targetWeightLabel, "text"),
      editorInput("proteinQuiz.targetWeightPlaceholder", index, "Target weight placeholder", quiz.targetWeightPlaceholder, "text"),
      editorInput("proteinQuiz.strengthDaysLabel", index, "Strength days label", quiz.strengthDaysLabel, "text"),
      editorInput("proteinQuiz.strengthDaysPlaceholder", index, "Strength dropdown placeholder", quiz.strengthDaysPlaceholder, "text"),
      editorInput("proteinQuiz.ageLabel", index, "Age label", quiz.ageLabel, "text"),
      editorInput("proteinQuiz.agePlaceholder", index, "Age placeholder", quiz.agePlaceholder, "text"),
      editorInput("proteinQuiz.quizButtonText", index, "Quiz button text", quiz.quizButtonText, "text"),
      "<div class=\"dash-flow-divider\"><span>After visitor clicks quiz submit</span></div>",
      editorInput("proteinQuiz.leadHeadline", index, "Lead-step headline", quiz.leadHeadline, "text"),
      editorTextarea("proteinQuiz.leadSubheadline", index, "Lead-step subheadline", quiz.leadSubheadline),
      editorInput("proteinQuiz.firstNameLabel", index, "First name label", quiz.firstNameLabel, "text"),
      editorInput("proteinQuiz.firstNamePlaceholder", index, "First name placeholder", quiz.firstNamePlaceholder, "text"),
      editorInput("proteinQuiz.emailLabel", index, "Email label", quiz.emailLabel, "text"),
      editorInput("proteinQuiz.emailPlaceholder", index, "Email placeholder", quiz.emailPlaceholder, "text"),
      editorInput("proteinQuiz.leadButtonText", index, "Lead button text", quiz.leadButtonText, "text"),
      "</div>",
      "</div>"
    ].join("");
  }

  function editorInput(field, index, label, value, type) {
    return "<label>" + escapeHtml(label) + "<input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"" + type + "\" value=\"" + escapeHtml(value) + "\"></label>";
  }

  function editorCheckbox(field, index, label, checked) {
    return "<label class=\"dash-checkbox-label\"><input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"checkbox\"" + (checked ? " checked" : "") + "><span>" + escapeHtml(label) + "</span></label>";
  }

  function editorTextarea(field, index, label, value) {
    return "<label>" + escapeHtml(label) + "<textarea data-variant-index=\"" + index + "\" data-field=\"" + field + "\">" + escapeHtml(value) + "</textarea></label>";
  }

  function editorRichText(field, index, label, value) {
    return [
      "<div class=\"dash-rich-field\">",
      "<span>" + escapeHtml(label) + "</span>",
      "<div class=\"dash-rich-toolbar\">",
      "<button type=\"button\" data-rich-command=\"bold\">B</button>",
      "<button type=\"button\" data-rich-command=\"italic\">I</button>",
      "<button type=\"button\" data-rich-command=\"underline\">U</button>",
      "<input type=\"color\" data-rich-command=\"foreColor\" value=\"#c2410c\" aria-label=\"Subheadline text color\">",
      "</div>",
      "<div class=\"dash-rich-editor\" contenteditable=\"true\" data-variant-index=\"" + index + "\" data-field=\"" + field + "\">" + sanitizeRichHtml(value) + "</div>",
      "</div>"
    ].join("");
  }

  function applyRichCommand(control) {
    var card = control.closest(".dash-editor-card");
    var editor = card && card.querySelector(".dash-rich-editor");
    if (!editor) return;

    editor.focus();
    if (control.dataset.richCommand === "foreColor") {
      document.execCommand("foreColor", false, control.value);
    } else {
      document.execCommand(control.dataset.richCommand, false, null);
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function editorSelect(field, index, label, value) {
    var options = [
      "Arial, Helvetica, sans-serif",
      "Georgia, serif",
      "Inter, Arial, sans-serif",
      "Helvetica Neue, Arial, sans-serif",
      "Verdana, Geneva, sans-serif"
    ];
    return "<label>" + escapeHtml(label) + "<select data-variant-index=\"" + index + "\" data-field=\"" + field + "\">" + options.map(function (option) {
      return "<option value=\"" + escapeHtml(option) + "\"" + (option === value ? " selected" : "") + ">" + escapeHtml(option.split(",")[0]) + "</option>";
    }).join("") + "</select></label>";
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
    renderPalette();
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

    setOptions(els.version, unique(["", config.configVersion].concat(rows.map(function (row) {
      return row.configVersion || "unversioned";
    }))), "All versions");
  }

  function setOptions(select, values, allLabel) {
    var current = select.value;
    select.innerHTML = "";
    values.filter(Boolean).forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    select.insertBefore(all, select.firstChild);
    select.value = values.indexOf(current) >= 0 ? current : "";
  }

  function updateDashboard() {
    var filtered = applyFilters(rows);
    var metrics = buildMetrics(filtered);
    renderStats(metrics);
    renderTable(metrics);
    renderCharts(metrics);
    renderRecommendations(metrics);
    renderVariationHistory(filtered);
  }

  function applyFilters(data) {
    var start = els.start.value ? new Date(els.start.value + "T00:00:00") : null;
    var end = els.end.value ? new Date(els.end.value + "T23:59:59") : null;
    var pageNeedle = els.pageUrl.value.trim().toLowerCase();

    return data.filter(function (row) {
      var timestamp = row.timestamp ? new Date(row.timestamp) : null;
      if (els.testId.value && row.testId !== els.testId.value) return false;
      if (els.variant.value && row.variant !== els.variant.value) return false;
      if (els.version.value && (row.configVersion || "unversioned") !== els.version.value) return false;
      if (els.device.value && row.deviceType !== els.device.value) return false;
      if (start && timestamp && timestamp < start) return false;
      if (end && timestamp && timestamp > end) return false;
      if (pageNeedle && String(row.pageUrl || "").toLowerCase().indexOf(pageNeedle) === -1) return false;
      return true;
    });
  }

  function buildMetrics(data) {
    var variants = activeVariants();
    var byVariant = {};

    variants.forEach(function (variant) {
      var defaultKey = metricKey(config.configVersion || "v1", variant.id);
      byVariant[defaultKey] = {
        variant: variant.id,
        configVersion: config.configVersion || "v1",
        sessions: new Set(),
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
          views: 0,
          clicks: 0,
          quizSubmits: 0,
          leads: 0,
          submits: 0,
          closes: 0
        };
      }

      var item = byVariant[rowKey];
      if (row.eventType === "popup_view") {
        if (row.sessionId) item.sessions.add(row.sessionId);
        item.views += 1;
      }
      if (row.eventType === "popup_form_click") item.clicks += 1;
      if (row.eventType === "popup_quiz_submit") item.quizSubmits += 1;
      if (row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted") item.leads += 1;
      if (row.eventType === "popup_submit_attempt" || row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted") item.submits += 1;
      if (row.eventType === "popup_close") item.closes += 1;
    });

    var result = Object.keys(byVariant).sort().map(function (key) {
      var item = byVariant[key];
      var sessionCount = item.sessions.size || item.views;
      var conversionRate = rate(item.submits, item.views);
      return {
        variant: item.variant,
        configVersion: item.configVersion,
        sessions: sessionCount,
        views: item.views,
        viewRate: rate(item.views, sessionCount),
        clicks: item.clicks,
        clickRate: rate(item.clicks, item.views),
        quizSubmits: item.quizSubmits,
        quizRate: rate(item.quizSubmits, item.views),
        leads: item.leads,
        leadRate: rate(item.leads, item.views),
        submits: item.submits,
        submitRate: conversionRate,
        closes: item.closes,
        closeRate: rate(item.closes, item.views),
        lift: 0
      };
    });

    var controlRates = {};
    result.forEach(function (item) {
      if (item.variant === "A") controlRates[item.configVersion] = item.leadRate || item.submitRate;
    });
    result.forEach(function (item) {
      var controlRate = controlRates[item.configVersion] || 0;
      var comparisonRate = item.leadRate || item.submitRate;
      item.lift = controlRate > 0 ? (comparisonRate / controlRate) - 1 : 0;
    });

    return result;
  }

  function renderStats(metrics) {
    var totals = metrics.reduce(function (sum, item) {
      sum.views += item.views;
      sum.clicks += item.clicks;
      sum.quizSubmits += item.quizSubmits;
      sum.leads += item.leads;
      sum.submits += item.submits;
      sum.closes += item.closes;
      return sum;
    }, { views: 0, clicks: 0, quizSubmits: 0, leads: 0, submits: 0, closes: 0 });

    document.getElementById("stat-views").textContent = formatNumber(totals.views);
    document.getElementById("stat-quiz-submits").textContent = formatNumber(totals.quizSubmits);
    document.getElementById("stat-leads").textContent = formatNumber(totals.leads || totals.submits);
    document.getElementById("stat-close-rate").textContent = formatPercent(rate(totals.closes, totals.views));
  }

  function renderTable(metrics) {
    els.body.innerHTML = "";
    els.warning.hidden = !metrics.some(function (item) {
      return activeVariants().some(function (variant) {
        return variant.id === item.variant;
      }) && item.views > 0 && item.views < 100;
    });

    metrics.forEach(function (item) {
      var row = document.createElement("tr");
      [
        item.variant,
        item.configVersion,
        formatNumber(item.sessions),
        formatNumber(item.views),
        formatPercent(item.viewRate),
        formatNumber(item.clicks),
        formatPercent(item.clickRate),
        formatNumber(item.quizSubmits),
        formatPercent(item.quizRate),
        formatNumber(item.leads || item.submits),
        formatPercent(item.leadRate || item.submitRate),
        formatNumber(item.closes),
        formatPercent(item.closeRate),
        item.variant === "A" ? "Control" : formatPercent(item.lift, true)
      ].forEach(function (value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      els.body.appendChild(row);
    });
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
      } else if (item.closeRate > 0.65 && item.clickRate < 0.08) {
        messages.push("Variant " + item.variant + " / " + item.configVersion + " has a high close rate and low click rate. Test a stronger headline or a more specific image.");
      } else if (item.clickRate > 0.12 && (item.leadRate || item.submitRate) < 0.04) {
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

    drawChart("conversion-chart", "bar", labels, [
      {
        label: "Lead rate",
        data: metrics.map(function (item) { return Math.round((item.leadRate || item.submitRate) * 1000) / 10; }),
        backgroundColor: "#06b00b"
      },
      {
        label: "Quiz completion rate",
        data: metrics.map(function (item) { return Math.round(item.quizRate * 1000) / 10; }),
        backgroundColor: "#2563eb"
      },
      {
        label: "Click-through rate",
        data: metrics.map(function (item) { return Math.round(item.clickRate * 1000) / 10; }),
        backgroundColor: "#0f766e"
      }
    ]);

    drawChart("event-chart", "bar", labels, [
      {
        label: "Views",
        data: metrics.map(function (item) { return item.views; }),
        backgroundColor: "#475467"
      },
      {
        label: "Quiz completions",
        data: metrics.map(function (item) { return item.quizSubmits; }),
        backgroundColor: "#2563eb"
      },
      {
        label: "Leads",
        data: metrics.map(function (item) { return item.leads || item.submits; }),
        backgroundColor: "#06b00b"
      }
    ]);
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
      stage.appendChild(buildPreview(variant, previewStep));

      card.appendChild(title);
      card.appendChild(stage);
      els.previews.appendChild(card);
    });
  }

  function buildPreview(variant, step) {
    step = step || "quiz";
    var quiz = getProteinQuizConfig(variant);
    var root = document.createElement("div");
    root.className = "ll-popup-root ll-popup-is-visible";
    if (Number(variant.height) > 0) root.classList.add("ll-popup-has-height");
    if (variant.sizeToImage) root.classList.add("ll-popup-size-to-image");
    root.style.setProperty("--ll-popup-width", (Number(variant.width) || 560) + "px");
    root.style.setProperty("--ll-popup-height", (Number(variant.height) || 640) + "px");
    root.style.setProperty("--ll-popup-bg", variant.backgroundColor || "#ffffff");
    root.style.setProperty("--ll-popup-text", variant.textColor || "#172026");
    root.style.setProperty("--ll-popup-accent", variant.accentColor || "#1f6feb");
    root.style.setProperty("--ll-popup-font", variant.fontFamily || "Arial, Helvetica, sans-serif");
    root.style.setProperty("--ll-popup-align", variant.textAlign || "left");

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
        schedulePopupFit(root, variant);
      });
      image.src = variant.imageUrl;
      content.appendChild(image);
      if (image.complete) {
        sizePreviewToImage(root, image, variant);
        schedulePopupFit(root, variant);
      }
    }

    var copy = document.createElement("div");
    copy.className = "ll-popup-copy";
    copy.style.textAlign = variant.textAlign || "left";
    copy.innerHTML = step === "lead" && config.leadMagnetMode === "protein_plan"
      ? "<h2 class=\"ll-popup-headline\">" + escapeHtml(quiz.leadHeadline) + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(quiz.leadSubheadline) + "</p>"
      : "<h2 class=\"ll-popup-headline\">" + escapeHtml(variant.headline || "") + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || "")) + "</p>";
    copy.querySelector(".ll-popup-headline").style.textAlign = variant.textAlign || "left";
    copy.querySelector(".ll-popup-subheadline").style.textAlign = variant.textAlign || "left";

    var form = document.createElement("div");
    form.className = "ll-popup-form";
    form.innerHTML = config.leadMagnetMode === "protein_plan" && step === "lead"
      ? "<button class=\"ll-popup-step-back\" type=\"button\" aria-label=\"Back\">&#8592;</button><div class=\"dash-fake-field\">" + escapeHtml(quiz.firstNameLabel) + "</div><div class=\"dash-fake-field\">" + escapeHtml(quiz.emailLabel) + "</div><button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(quiz.leadButtonText) + "</button>"
      : config.leadMagnetMode === "protein_plan"
      ? "<div class=\"dash-fake-field\">" + escapeHtml(quiz.targetWeightLabel) + "</div><div class=\"dash-fake-field\">" + escapeHtml(quiz.strengthDaysLabel) + "</div><div class=\"dash-fake-field\">" + escapeHtml(quiz.ageLabel) + "</div><button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(quiz.quizButtonText) + "</button>"
      : "<div class=\"dash-fake-field\">First Name</div><div class=\"dash-fake-field\">Email</div><button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(variant.buttonText || "Submit") + "</button>";

    content.appendChild(copy);
    content.appendChild(form);
    modal.appendChild(close);
    modal.appendChild(content);
    root.appendChild(modal);
    return root;
  }

  function showDashboardTestPopup(variant) {
    var existing = document.querySelector(".dash-dashboard-test-popup");
    if (existing) existing.remove();

    var root = buildPreview(variant);
    root.classList.add("dash-dashboard-test-popup");

    var overlay = document.createElement("div");
    overlay.className = "ll-popup-overlay";
    root.insertBefore(overlay, root.firstChild);

    var close = root.querySelector(".ll-popup-close");
    var form = root.querySelector(".ll-popup-form");

    if (config.leadMagnetMode === "protein_plan") {
      renderProteinPlanPreviewForm(form, variant);
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
    var quizData = {};
    var root = container.closest(".ll-popup-root");
    var headline = root && root.querySelector(".ll-popup-headline");
    var subheadline = root && root.querySelector(".ll-popup-subheadline");
    var quiz = getProteinQuizConfig(variant);
    renderQuizStep();

    function renderQuizStep() {
      if (headline) headline.textContent = variant.quizHeadline || variant.headline || "";
      if (subheadline) subheadline.innerHTML = sanitizeRichHtml(variant.quizSubheadlineHtml || variant.subheadlineHtml || escapeHtml(variant.subheadline || ""));
      container.innerHTML = [
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
          StrengthDays: form.elements.strengthDays.value
        };
        renderLeadStep();
      });
      schedulePopupFit(container.closest(".ll-popup-root"));
    }

    function renderLeadStep() {
      if (headline) headline.textContent = quiz.leadHeadline;
      if (subheadline) subheadline.innerHTML = sanitizeRichHtml(quiz.leadSubheadline);
      container.innerHTML = [
        "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Back\">&#8592;</button>",
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form\" data-step=\"lead\">",
        "<label><span>" + escapeHtml(quiz.firstNameLabel) + "</span><input name=\"name\" autocomplete=\"given-name\" placeholder=\"" + escapeHtmlAttr(quiz.firstNamePlaceholder) + "\" required></label>",
        "<label><span>" + escapeHtml(quiz.emailLabel) + "</span><input name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"" + escapeHtmlAttr(quiz.emailPlaceholder) + "\" required></label>",
        "<button type=\"submit\">" + escapeHtml(quiz.leadButtonText || variant.buttonText || "Show My Protein Plan") + "</button>",
        "</form>"
      ].join("");

      var form = container.querySelector("form");
      container.querySelector(".ll-popup-step-back").addEventListener("click", renderQuizStep);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        sendLeadPayload(config.leadWebhookUrl, {
          name: form.elements.name.value,
          email: form.elements.email.value,
          targetWeightLbs: quizData.targetWeightLbs,
          TargetWeight: quizData.TargetWeight || quizData.targetWeightLbs,
          age: quizData.age,
          Age: quizData.Age || quizData.age,
          strengthDays: quizData.strengthDays,
          StrengthDays: quizData.StrengthDays || quizData.strengthDays,
          source: "protein_popup",
          ctaVariant: "show_my_protein_plan",
          popupVariant: variant.id
        });
        showFormStatus(container, config.leadWebhookUrl ? "Test sent to Zapier with protein quiz fields." : "Add your Zapier lead webhook URL before testing the lead submission.");
      });
      schedulePopupFit(container.closest(".ll-popup-root"));
    }
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

    var viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 1024);
    var viewportHeight = Math.max(420, window.innerHeight || document.documentElement.clientHeight || 768);
    var horizontalPadding = 96;
    var verticalReserve = 320;
    var maxImageWidth = viewportWidth - horizontalPadding;
    var maxImageHeight = Math.max(180, viewportHeight - verticalReserve);
    var scale = Math.min(1, maxImageWidth / image.naturalWidth, maxImageHeight / image.naturalHeight);
    var imageWidth = Math.round(image.naturalWidth * scale);
    var imageHeight = Math.round(image.naturalHeight * scale);
    var modalWidth = Math.max(Number(variant.width) || 560, imageWidth + 64);

    root.style.setProperty("--ll-popup-width", Math.min(modalWidth, viewportWidth - 32) + "px");
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
    els.quizStepPreview.classList.toggle("is-active", step === "quiz");
    els.leadStepPreview.classList.toggle("is-active", step === "lead");
    renderPreviews(previewMode);
  }

  function renderEmbedCode() {
    var base = normalizedAssetBaseUrl();
    els.embedCode.value = [
      "<link rel=\"stylesheet\" href=\"" + base + "/popup/popup.css?v=live\">",
      "<script src=\"" + base + "/popup/variants.js?v=live\"></script>",
      "<script src=\"" + base + "/popup/popup.js?v=live\" defer></script>"
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

    saveDraftConfig();

    if (canUseLocalPublisher()) {
      publishConfigWithLocalServer(path, message);
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
        setPublishStatus("Published popup/variants.js to GitHub (" + commitSha + "). GitHub Pages may take 1-2 minutes to refresh.", "success");
      })
      .catch(function (error) {
        setPublishStatus(error.message, "error");
      });
  }

  function canUseLocalPublisher() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  function publishConfigWithLocalServer(path, message) {
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
        setPublishStatus(note + " GitHub Pages may take 1-2 minutes to refresh.", "success");
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
      configVersion: config.configVersion || "v1",
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
      if (row.eventType === "popup_view") item.views += 1;
      if (row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted") item.leads += 1;
    });

    return Object.keys(groups).map(function (key) {
      var item = groups[key];
      item.leadRate = rate(item.leads, item.views);
      return item;
    }).filter(function (item) {
      return item.views >= minimumViews;
    }).sort(function (a, b) {
      if (b.leadRate !== a.leadRate) return b.leadRate - a.leadRate;
      return b.views - a.views;
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
    data.forEach(function (row) {
      var label = row.variantLabel || labelFromSnapshot(row.variantSnapshot) || [row.variant || "Unknown", row.configVersion || "unversioned"].join(" / ");
      var key = [
        row.testId || "",
        row.configVersion || "unversioned",
        row.variant || "Unknown",
        label
      ].join("::");

      if (!groups[key]) {
        groups[key] = {
          label: label,
          variant: row.variant || "Unknown",
          configVersion: row.configVersion || "unversioned",
          changeNote: row.changeNote || "",
          sessions: new Set(),
          views: 0,
          clicks: 0,
          submits: 0,
          saves: 0,
          lastSeen: ""
        };
      }

      var item = groups[key];
      if (row.eventType === "popup_view") {
        if (row.sessionId) item.sessions.add(row.sessionId);
        item.views += 1;
      }
      if (row.eventType === "popup_form_click") item.clicks += 1;
      if (row.eventType === "popup_lead_submit" || row.eventType === "kajabi_form_submitted" || row.eventType === "popup_submit_attempt") item.submits += 1;
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
      return [
        "<article class=\"dash-history-card\">",
        "<div><strong>" + escapeHtml(item.label) + "</strong><span>" + escapeHtml(item.variant) + " / " + escapeHtml(item.configVersion) + "</span></div>",
        "<dl>",
        "<div><dt>Unique impressions</dt><dd>" + formatNumber(uniqueImpressions) + "</dd></div>",
        "<div><dt>Views</dt><dd>" + formatNumber(item.views) + "</dd></div>",
        "<div><dt>Click rate</dt><dd>" + formatPercent(rate(item.clicks, item.views)) + "</dd></div>",
        "<div><dt>Conversion rate</dt><dd>" + formatPercent(rate(item.submits, item.views)) + "</dd></div>",
        "</dl>",
        item.changeNote ? "<p>" + escapeHtml(item.changeNote) + "</p>" : "",
        item.saves ? "<small>Saved/tested " + formatNumber(item.saves) + " time" + (item.saves === 1 ? "" : "s") + "</small>" : "",
        "</article>"
      ].join("");
    }).join("");
  }

  function buildVariantLabel(variant) {
    var quiz = getProteinQuizConfig(variant);
    var parts = [
      "CTA: " + (config.leadMagnetMode === "protein_plan" ? quiz.leadButtonText : (variant.buttonText || "Submit")),
      "Button: " + (variant.accentColor || ""),
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
      subheadline: variant.subheadline || "",
      subheadlineHtml: variant.subheadlineHtml || "",
      buttonText: variant.buttonText || "",
      imageUrl: variant.imageUrl || "",
      imageAlt: variant.imageAlt || "",
      width: variant.width || "",
      height: variant.height || "",
      sizeToImage: Boolean(variant.sizeToImage),
      backgroundColor: variant.backgroundColor || "",
      textColor: variant.textColor || "",
      accentColor: variant.accentColor || "",
      fontFamily: variant.fontFamily || "",
      textAlign: variant.textAlign || "",
      trafficSplit: variant.trafficSplit || "",
      proteinQuiz: cloneConfig(variant.proteinQuiz || {})
    };
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
    var allowed = ["B", "STRONG", "I", "EM", "U", "SPAN", "BR"];

    Array.prototype.slice.call(template.content.querySelectorAll("*")).forEach(function (node) {
      if (allowed.indexOf(node.nodeName) === -1) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }

      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        if (node.nodeName === "SPAN" && attr.name === "style" && /^color:\s*#[0-9a-f]{3,8};?$/i.test(attr.value.trim())) return;
        node.removeAttribute(attr.name);
      });
    });

    return template.innerHTML;
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
      return headers.reduce(function (record, header, index) {
        record[header.trim()] = (line[index] || "").trim();
        return record;
      }, {});
    });
  }

  function activeVariants() {
    return config.variants.filter(function (variant) {
      return variant.active !== false;
    });
  }

  function metricKey(version, variant) {
    return String(version || "unversioned") + "::" + String(variant || "Unknown");
  }

  function loadDraftConfig() {
    try {
      var draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
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
    value.kajabiFormEmbed = value.kajabiFormEmbed || originalConfig.kajabiFormEmbed || "";
    value.kajabiEmbedMode = value.kajabiEmbedMode || originalConfig.kajabiEmbedMode || "auto";
    value.formMode = value.formMode || originalConfig.formMode || "zapier";
    value.leadMagnetMode = value.leadMagnetMode || originalConfig.leadMagnetMode || "";
    value.leadWebhookUrl = value.leadWebhookUrl || originalConfig.leadWebhookUrl || "";
    value.proteinPlanUrl = value.proteinPlanUrl || originalConfig.proteinPlanUrl || "";
    value.proteinQuiz = Object.assign(getProteinQuizDefaults(), originalConfig.proteinQuiz || {}, value.proteinQuiz || {});
    value.triggers = value.triggers || originalConfig.triggers || {};
    value.triggers.delayMs = Number(value.triggers.delayMs);
    if (!Number.isFinite(value.triggers.delayMs)) value.triggers.delayMs = 35000;
    value.triggers.scrollDepth = Number(value.triggers.scrollDepth);
    if (!Number.isFinite(value.triggers.scrollDepth)) value.triggers.scrollDepth = 0.5;
    value.savedColors = (value.savedColors || originalConfig.savedColors || defaultColors).slice(0, 10).concat(defaultColors).slice(0, 10);
    value.variants = value.variants || [];
    value.variants.forEach(function (variant) {
      var originalVariant = (originalConfig.variants || []).find(function (item) {
        return item.id === variant.id;
      }) || {};
      variant.fontFamily = variant.fontFamily || "Arial, Helvetica, sans-serif";
      variant.textAlign = variant.textAlign || originalVariant.textAlign || "left";
      variant.height = variant.height || originalVariant.height || "";
      variant.sizeToImage = Boolean(variant.sizeToImage || originalVariant.sizeToImage);
      variant.subheadlineHtml = variant.subheadlineHtml || originalVariant.subheadlineHtml || escapeHtml(variant.subheadline || "");
      variant.imageAlt = variant.imageAlt || "";
      variant.proteinQuiz = Object.assign(getProteinQuizDefaults(), value.proteinQuiz || {}, originalVariant.proteinQuiz || {}, variant.proteinQuiz || {});
    });
    return value;
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
})();
