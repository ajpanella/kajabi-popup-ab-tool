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
  var config = loadDraftConfig();
  var legacyTrackingVariantIds = [];
  initializeVariantTracking();
  var urlParams = new URLSearchParams(window.location.search);
  var defaultCsvUrl = urlParams.get("csv") || localStorage.getItem(CSV_URL_KEY) || "";
  var googleDocUrl = urlParams.get("doc") || "";
  var trackingSheetUrl = urlParams.get("sheet") || "https://docs.google.com/spreadsheets/d/1fjbkrBO5r1XaJf3x-WNT0UNjEtn0IlDlAA9e2Sza69w";
  var rows = [];
  var charts = {};
  var previewMode = "desktop";
  var previewStep = "quiz";
  var lastColorTarget = null;
  var versionFilterInitialized = false;

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
    hiddenMetricsStatus: document.getElementById("hidden-metrics-status"),
    showHiddenMetrics: document.getElementById("show-hidden-metrics"),
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
  els.history.addEventListener("click", onHistoryClick);
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
        reconcileLegacyVariantVersions();
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
        editorRichText("headlineHtml", index, "Headline", variant.headlineHtml || escapeHtml(variant.headline || ""), false, "headlineFontSize", variant.headlineFontSize, 32, variant.textColor || "#172026"),
        editorRichText("subheadlineHtml", index, "Subheadline", variant.subheadlineHtml || escapeHtml(variant.subheadline || ""), false, "subheadlineFontSize", variant.subheadlineFontSize, 17, variant.textColor || "#172026"),
        editorRichText("valueLineHtml", index, "Value Line", variant.valueLineHtml || escapeHtml(variant.valueLine || ""), false, "valueLineFontSize", variant.valueLineFontSize, 15, variant.brandAccentColor || "#06b00b"),
        config.leadMagnetMode === "protein_plan" ? editorCompactSizeInput("buttonFontSize", index, "Button CTA size", variant.buttonFontSize, 16) : editorTextWithSize("buttonText", "buttonFontSize", index, "CTA button text", variant.buttonText || "Submit", variant.buttonFontSize, 16),
        editorInput("imageUrl", index, "Image URL", variant.imageUrl || "", "url"),
        editorInput("imageAlt", index, "Image alt text", variant.imageAlt || "", "text"),
        "<div class=\"dash-color-row\">",
        editorInput("backgroundColor", index, "Background", variant.backgroundColor || "#ffffff", "color"),
        editorInput("textColor", index, "Text", variant.textColor || "#172026", "color"),
        editorInput("brandAccentColor", index, "Accent text", variant.brandAccentColor || "#06b00b", "color"),
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
    return [
      "proteinQuiz.showQuizStep",
      "proteinQuiz.showFirstName",
      "proteinQuiz.showEmail",
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
    var quiz = getProteinQuizConfig(variant);
    var showQuiz = quiz.showQuizStep !== false;
    var showProgress = quiz.progressEnabled;
    var showProgressText = showProgress && showQuiz;
    var showFirstName = quiz.showFirstName !== false;
    var showEmail = quiz.showEmail !== false;
    return [
      "<div class=\"dash-flow-editor dash-variant-flow-editor\">",
      "<div class=\"dash-flow-head\"><strong>Protein Quiz Flow</strong><span>Variant-specific quiz labels, placeholders, and step-two copy.</span></div>",
      "<div class=\"dash-global-editor\">",
      editorCheckbox("proteinQuiz.showQuizStep", index, "Show quiz step before lead form", quiz.showQuizStep !== false),
      editorCheckbox("proteinQuiz.showFirstName", index, "Show first name field", quiz.showFirstName !== false),
      editorCheckbox("proteinQuiz.showEmail", index, "Show email field", quiz.showEmail !== false),
      editorCheckbox("proteinQuiz.progressEnabled", index, "Show progress bar and step framing", quiz.progressEnabled),
      showQuiz ? "" : "<div class=\"dash-flow-divider\"><span>Single-step visible copy</span></div>",
      showQuiz ? "" : editorInput("imageUrl", index, "Single-step hero image URL", variant.imageUrl || "", "url"),
      showQuiz ? "" : editorRichText("headlineHtml", index, "Single-step headline", variant.headlineHtml || escapeHtml(variant.headline || ""), false, "headlineFontSize", variant.headlineFontSize, 32, variant.textColor || "#172026"),
      showQuiz ? "" : editorRichText("subheadlineHtml", index, "Single-step subheadline", variant.subheadlineHtml || escapeHtml(variant.subheadline || ""), false, "subheadlineFontSize", variant.subheadlineFontSize, 17, variant.textColor || "#172026"),
      showQuiz ? "" : editorRichText("valueLineHtml", index, "Single-step value line", variant.valueLineHtml || escapeHtml(variant.valueLine || ""), false, "valueLineFontSize", variant.valueLineFontSize, 15, variant.brandAccentColor || "#06b00b"),
      editorTextWithSize("proteinQuiz.progressSingleStepLabel", "proteinQuiz.progressSingleStepLabelFontSize", index, "Single-step progress label", quiz.progressSingleStepLabel || "Step 1", quiz.progressSingleStepLabelFontSize, 12, !showProgress || showQuiz),
      editorInput("proteinQuiz.progressStepOneLabel", index, "Step 1 progress label", quiz.progressStepOneLabel, "text", !showProgressText),
      editorTextarea("proteinQuiz.progressStepOneText", index, "Step 1 framing text", quiz.progressStepOneText, !showProgressText),
      editorInput("proteinQuiz.targetWeightLabel", index, "Target weight label", quiz.targetWeightLabel, "text", !showQuiz),
      editorInput("proteinQuiz.targetWeightPlaceholder", index, "Target weight placeholder", quiz.targetWeightPlaceholder, "text", !showQuiz),
      editorInput("proteinQuiz.strengthDaysLabel", index, "Strength days label", quiz.strengthDaysLabel, "text", !showQuiz),
      editorInput("proteinQuiz.strengthDaysPlaceholder", index, "Strength dropdown placeholder", quiz.strengthDaysPlaceholder, "text", !showQuiz),
      editorInput("proteinQuiz.ageLabel", index, "Age label", quiz.ageLabel, "text", !showQuiz),
      editorInput("proteinQuiz.agePlaceholder", index, "Age placeholder", quiz.agePlaceholder, "text", !showQuiz),
      editorInput("proteinQuiz.quizButtonText", index, "Quiz button text", quiz.quizButtonText, "text", !showQuiz),
      "<div class=\"dash-flow-divider\"><span>After visitor clicks quiz submit</span></div>",
      editorProteinTargetPreviewSelect("proteinQuiz.targetPreviewStyle", index, "Step 2 target display", quiz.targetPreviewStyle, !showQuiz),
      editorInput("proteinQuiz.targetPreviewLabel", index, "Target display label", quiz.targetPreviewLabel, "text", !showQuiz || quiz.targetPreviewStyle === "off"),
      editorInput("proteinQuiz.progressStepTwoLabel", index, "Step 2 progress label", quiz.progressStepTwoLabel, "text", !showProgressText),
      editorTextarea("proteinQuiz.progressStepTwoText", index, "Step 2 framing text", quiz.progressStepTwoText, !showProgressText),
      editorInput("proteinQuiz.leadHeadline", index, "Lead-step headline", quiz.leadHeadline, "text", !showQuiz),
      editorTextarea("proteinQuiz.leadSubheadline", index, "Lead-step subheadline", quiz.leadSubheadline, !showQuiz),
      editorInput("proteinQuiz.firstNameLabel", index, "First name label", quiz.firstNameLabel, "text", !showFirstName),
      editorInput("proteinQuiz.firstNamePlaceholder", index, "First name placeholder", quiz.firstNamePlaceholder, "text", !showFirstName),
      editorInput("proteinQuiz.emailLabel", index, "Email label", quiz.emailLabel, "text", !showEmail),
      editorInput("proteinQuiz.emailPlaceholder", index, "Email placeholder", quiz.emailPlaceholder, "text", !showEmail),
      editorTextWithSize("proteinQuiz.leadButtonText", "buttonFontSize", index, showQuiz ? "Lead button text" : "Button CTA", quiz.leadButtonText, variant.buttonFontSize, 16),
      "</div>",
      "</div>"
    ].join("");
  }

  function editorInput(field, index, label, value, type, disabled) {
    if (type === "color") return editorColorInput(field, index, label, value, disabled);
    return "<label" + disabledFieldClass(disabled) + ">" + escapeHtml(label) + "<input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"" + type + "\" value=\"" + escapeHtmlAttr(value) + "\"" + disabledAttr(disabled) + "></label>";
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

  function editorCheckbox(field, index, label, checked) {
    return "<label class=\"dash-checkbox-label\"><input data-variant-index=\"" + index + "\" data-field=\"" + field + "\" type=\"checkbox\"" + (checked ? " checked" : "") + "><span>" + escapeHtml(label) + "</span></label>";
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
    var builtMetrics = buildMetrics(filtered);
    var metrics = getVisibleMetrics(builtMetrics);
    renderHiddenMetricsNotice(builtMetrics.length - metrics.length);
    renderStats(metrics);
    renderTable(metrics);
    renderCharts(metrics);
    renderRecommendations(metrics);
    renderVariationHistory(historyFiltered);
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

  function buildMetrics(data) {
    var variants = publishedActiveVariants();
    var byVariant = {};

    variants.forEach(function (variant) {
      var liveVersion = getVariantTrackingVersion(variant);
      var defaultKey = metricKey(liveVersion, variant.id);
      byVariant[defaultKey] = {
        variant: variant.id,
        configVersion: liveVersion,
        sessions: new Set(),
        actionSessions: new Set(),
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
      if (type === "popup_lead_submit" || type === "kajabi_form_submitted") item.leads += 1;
      if (type === "popup_submit_attempt" || type === "popup_lead_submit" || type === "kajabi_form_submitted") item.submits += 1;
      if (type === "popup_close") item.closes += 1;
    });

    var result = Object.keys(byVariant).sort().map(function (key) {
      var item = byVariant[key];
      item.actionSessions.forEach(function (sessionId) {
        if (!item.sessions.has(sessionId)) item.sessions.add(sessionId);
      });
      var inferredViews = Math.max(item.views, item.sessions.size, item.quizSubmits, item.leads, item.submits);
      var sessionCount = item.sessions.size || inferredViews;
      var fullSubmissions = fullSubmissionCount(item.leads, item.submits);
      var fullConversionRate = rate(fullSubmissions, inferredViews);
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

  function eventType(row) {
    return String(row && row.eventType || "").trim().toLowerCase();
  }

  function renderStats(metrics) {
    var allSingleStep = metrics.length > 0 && metrics.every(isSingleStepMetric);
    updateMetricLabels(allSingleStep);
    var totals = metrics.reduce(function (sum, item) {
      sum.views += item.views;
      sum.clicks += item.clicks;
      sum.quizSubmits += item.quizSubmits;
      sum.leads += item.leads;
      sum.fullSubmissions += item.fullSubmissions;
      sum.submits += item.submits;
      sum.closes += item.closes;
      return sum;
    }, { views: 0, clicks: 0, quizSubmits: 0, leads: 0, fullSubmissions: 0, submits: 0, closes: 0 });

    document.getElementById("stat-views").textContent = formatNumber(totals.views);
    document.getElementById("stat-quiz-submits").textContent = allSingleStep ? "N/A" : formatNumber(totals.quizSubmits);
    document.getElementById("stat-leads").textContent = formatNumber(totals.fullSubmissions);
    document.getElementById("stat-close-rate").textContent = formatPercent(rate(totals.fullSubmissions, totals.views));
  }

  function updateMetricLabels(allSingleStep) {
    var quizLabel = document.getElementById("stat-quiz-label");
    var clicksHeading = document.getElementById("metric-clicks-heading");
    var clickRateHeading = document.getElementById("metric-click-rate-heading");
    if (quizLabel) quizLabel.textContent = allSingleStep ? "Quiz completions" : "Quiz completions";
    if (clicksHeading) clicksHeading.textContent = allSingleStep ? "Submit Clicks" : "Clicks";
    if (clickRateHeading) clickRateHeading.textContent = allSingleStep ? "Submit Click Rate" : "Click Rate";
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
    });
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
      var preview = buildPreview(variant, previewStep);
      stage.appendChild(preview);

      card.appendChild(title);
      card.appendChild(stage);
      els.previews.appendChild(card);
      var previewImage = preview.querySelector(".ll-popup-image");
      if (previewImage && previewImage.complete) sizePreviewToImage(preview, previewImage, variant);
      scheduleDashboardPreviewFit(preview);
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
    root.style.setProperty("--ll-popup-accent", variant.brandAccentColor || "#06b00b");
    root.style.setProperty("--ll-popup-button-bg", variant.accentColor || "#1f6feb");
    root.style.setProperty("--ll-popup-font", variant.fontFamily || "Arial, Helvetica, sans-serif");
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
      ? targetPreview + "<h2 class=\"ll-popup-headline\">" + escapeHtml(quiz.leadHeadline) + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(quiz.leadSubheadline) + "</p>"
      : "<h2 class=\"ll-popup-headline\">" + sanitizeRichHtml(variant.headlineHtml || escapeHtml(variant.headline || "")) + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || "")) + "</p>" + (variant.valueLineHtml || variant.valueLine ? "<p class=\"ll-popup-value-line\">" + sanitizeRichHtml(variant.valueLineHtml || escapeHtml(variant.valueLine || "")) + "</p>" : "");
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
    return root;
  }

  function scheduleDashboardPreviewFit(root) {
    if (!root || !root.closest(".dash-preview-stage")) return;
    window.requestAnimationFrame(function () {
      fitDashboardPreviewToStage(root);
      window.requestAnimationFrame(function () {
        fitDashboardPreviewToStage(root);
      });
    });
  }

  function fitDashboardPreviewToStage(root) {
    var stage = root && root.closest(".dash-preview-stage");
    var modal = root && root.querySelector(".ll-popup-modal");
    if (!stage || !modal || stage.classList.contains("is-mobile")) return;

    stage.classList.remove("has-scaled-preview");
    stage.style.removeProperty("--dash-preview-stage-height");
    root.style.setProperty("--dash-preview-scale", "1");
    var stageStyles = window.getComputedStyle(stage);
    var availableWidth = stage.clientWidth - parseFloat(stageStyles.paddingLeft || 0) - parseFloat(stageStyles.paddingRight || 0);
    var minStageHeight = stage.classList.contains("is-compare") ? 520 : 620;
    var availableHeight = minStageHeight - parseFloat(stageStyles.paddingTop || 0) - parseFloat(stageStyles.paddingBottom || 0);
    var modalWidth = modal.scrollWidth || modal.offsetWidth || modal.getBoundingClientRect().width;
    var modalHeight = modal.scrollHeight || modal.offsetHeight || modal.getBoundingClientRect().height;
    if (!availableWidth || !availableHeight || !modalWidth || !modalHeight) return;

    var scale = Math.min(1, availableWidth / modalWidth, availableHeight / modalHeight);
    root.style.setProperty("--dash-preview-scale", Math.max(0.01, scale).toFixed(3));
    stage.style.setProperty("--dash-preview-stage-height", Math.max(minStageHeight, Math.ceil((modalHeight * scale) + parseFloat(stageStyles.paddingTop || 0) + parseFloat(stageStyles.paddingBottom || 0))) + "px");
    stage.classList.add("has-scaled-preview");
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
    var quizData = {};
    var root = container.closest(".ll-popup-root");
    var headline = root && root.querySelector(".ll-popup-headline");
    var subheadline = root && root.querySelector(".ll-popup-subheadline");
    var valueLine = root && root.querySelector(".ll-popup-value-line");
    var quiz = getProteinQuizConfig(variant);
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
    } else {
      renderQuizStep();
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
        singleStep ? renderProteinProgressHtml(quiz, 1, true) : renderProteinProgressHtml(quiz, 2),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form\" data-step=\"lead\">",
        quiz.showFirstName === false ? "" : "<label><span>" + escapeHtml(quiz.firstNameLabel) + "</span><input name=\"name\" autocomplete=\"given-name\" placeholder=\"" + escapeHtmlAttr(quiz.firstNamePlaceholder) + "\" required></label>",
        quiz.showEmail === false ? "" : "<label><span>" + escapeHtml(quiz.emailLabel) + "</span><input name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"" + escapeHtmlAttr(quiz.emailPlaceholder) + "\" required></label>",
        "<button type=\"submit\">" + escapeHtml(quiz.leadButtonText || variant.buttonText || "Show My Protein Plan") + "</button>",
        "</form>"
      ].join("");

      var form = container.querySelector("form");
      var backButton = container.querySelector(".ll-popup-step-back");
      if (backButton) backButton.addEventListener("click", renderQuizStep);
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
    els.quizStepPreview.classList.toggle("is-active", step === "quiz");
    els.leadStepPreview.classList.toggle("is-active", step === "lead");
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
      var fullSubmissions = fullSubmissionCount(item.leads, item.submits);
      var isSingleStep = item.label.indexOf("Flow: Single-step") >= 0;
      return [
        "<article class=\"dash-history-card\" data-history-key=\"" + escapeHtmlAttr(item.key) + "\">",
        "<button class=\"dash-history-remove\" type=\"button\" data-history-remove=\"" + escapeHtmlAttr(item.key) + "\" aria-label=\"Hide historical variation\">&times;</button>",
        "<div><strong>" + escapeHtml(item.label) + "</strong><span>" + escapeHtml(item.variant) + " / " + escapeHtml(item.configVersion) + "</span></div>",
        "<dl>",
        "<div><dt>Unique impressions</dt><dd>" + formatNumber(uniqueImpressions) + "</dd></div>",
        "<div><dt>Views</dt><dd>" + formatNumber(item.views) + "</dd></div>",
        "<div><dt>Click rate</dt><dd>" + formatPercent(rate(item.clicks, item.views)) + "</dd></div>",
        "<div><dt>Full CVR</dt><dd>" + formatPercent(rate(fullSubmissions, item.views)) + "</dd></div>",
        "<div><dt>Quiz CVR</dt><dd>" + (isSingleStep ? "N/A" : formatPercent(rate(item.quizSubmits, item.views))) + "</dd></div>",
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
    var parts = [
      "Flow: " + (quiz.showQuizStep === false ? "Single-step" : "Quiz + form"),
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
      textAlign: variant.textAlign || "",
      trafficSplit: variant.trafficSplit || "",
      proteinQuiz: cloneConfig(variant.proteinQuiz || {})
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
        record[header.trim()] = (line[index] || "").trim();
        return record;
      }, {});
      record.configVersion = normalizeRowConfigVersion(record);
      return record;
    });
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
