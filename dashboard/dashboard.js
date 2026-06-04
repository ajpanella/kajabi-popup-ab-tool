(function () {
  "use strict";

  var originalConfig = window.LL_POPUP_CONFIG || { variants: [] };
  var DRAFT_KEY = "ll_popup_dashboard_config_" + sanitizeKey(originalConfig.testId || "default");
  var ASSET_BASE_KEY = "ll_popup_dashboard_asset_base";
  var CSV_URL_KEY = "ll_popup_dashboard_csv_url";
  var config = loadDraftConfig();
  var urlParams = new URLSearchParams(window.location.search);
  var defaultCsvUrl = urlParams.get("csv") || localStorage.getItem(CSV_URL_KEY) || "";
  var googleDocUrl = urlParams.get("doc") || "";
  var trackingSheetUrl = urlParams.get("sheet") || "https://docs.google.com/spreadsheets/d/1qIp6VXteTDFmDH60CSkXhssxKZ3Iwb96C_ezVdREGHY";
  var rows = [];
  var charts = {};
  var previewMode = "desktop";
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
    downloadConfig: document.getElementById("download-config"),
    copyConfig: document.getElementById("copy-config"),
    webhookUrl: document.getElementById("webhook-url"),
    formMode: document.getElementById("form-mode"),
    leadWebhookUrl: document.getElementById("lead-webhook-url"),
    delaySeconds: document.getElementById("delay-seconds"),
    scrollDepth: document.getElementById("scroll-depth"),
    kajabiFormEmbed: document.getElementById("kajabi-form-embed"),
    kajabiEmbedMode: document.getElementById("kajabi-embed-mode"),
    configVersion: document.getElementById("config-version"),
    changeNote: document.getElementById("change-note"),
    savedColors: document.getElementById("saved-colors"),
    recommendations: document.getElementById("recommendation-list"),
    history: document.getElementById("variation-history"),
    previews: document.getElementById("variant-previews"),
    desktopPreview: document.getElementById("desktop-preview"),
    mobilePreview: document.getElementById("mobile-preview"),
    warning: document.getElementById("sample-warning"),
    body: document.getElementById("performance-body")
  };

  els.csvUrl.value = defaultCsvUrl;
  els.assetBaseUrl.value = localStorage.getItem(ASSET_BASE_KEY) || defaultAssetBaseUrl();
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
  [els.webhookUrl, els.formMode, els.leadWebhookUrl, els.delaySeconds, els.scrollDepth, els.kajabiFormEmbed, els.kajabiEmbedMode, els.configVersion, els.changeNote].forEach(function (element) {
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

  els.mobilePreview.addEventListener("click", function () {
    setPreviewMode("mobile");
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
    els.formMode.value = config.formMode || "zapier";
    els.leadWebhookUrl.value = config.leadWebhookUrl || "";
    var delayMs = Number(config.triggers && config.triggers.delayMs);
    var scrollDepth = Number(config.triggers && config.triggers.scrollDepth);
    els.delaySeconds.value = Math.round((Number.isFinite(delayMs) ? delayMs : 35000) / 1000);
    els.scrollDepth.value = Math.round((Number.isFinite(scrollDepth) ? scrollDepth : 0.5) * 100);
    els.kajabiFormEmbed.value = config.kajabiFormEmbed || "";
    els.kajabiEmbedMode.value = config.kajabiEmbedMode || "auto";
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
        editorInput("buttonText", index, "CTA button text", variant.buttonText || "Submit", "text"),
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
        "<button class=\"dash-test-popup-button\" data-test-popup=\"" + index + "\" type=\"button\">Test Popup</button>",
        "<button class=\"dash-save-test\" data-save-test=\"" + index + "\" type=\"button\">Save & Test</button>"
      ].join("");
      els.editors.appendChild(card);
    });
  }

  function onGlobalConfigInput() {
    config.webhookUrl = els.webhookUrl.value.trim();
    config.formMode = els.formMode.value;
    config.leadWebhookUrl = els.leadWebhookUrl.value.trim();
    config.triggers = config.triggers || {};
    config.triggers.delayMs = Math.max(0, Number(els.delaySeconds.value || 0)) * 1000;
    config.triggers.scrollDepth = Math.min(1, Math.max(0, Number(els.scrollDepth.value || 0) / 100));
    config.kajabiFormEmbed = els.kajabiFormEmbed.value.trim();
    config.kajabiEmbedMode = els.kajabiEmbedMode.value;
    config.configVersion = els.configVersion.value.trim() || "v1";
    config.changeNote = els.changeNote.value.trim();
    saveDraftConfig();
    renderEmbedCode();
    populateFilters();
    updateDashboard();
  }

  function onEditorInput(event) {
    var target = event.target;
    if (!target || !target.dataset || target.dataset.variantIndex === undefined) return;

    var variant = activeVariants()[Number(target.dataset.variantIndex)];
    if (!variant) return;

    var key = target.dataset.field;
    var value = target.isContentEditable ? sanitizeRichHtml(target.innerHTML) : (target.type === "checkbox" ? target.checked : target.value);
    if (key === "width" || key === "height" || key === "trafficSplit") value = value === "" ? "" : Number(value);
    variant[key] = value;
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
      if (row.eventType === "popup_submit_attempt" || row.eventType === "kajabi_form_submitted") item.submits += 1;
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
        submits: item.submits,
        submitRate: conversionRate,
        closes: item.closes,
        closeRate: rate(item.closes, item.views),
        lift: 0
      };
    });

    var controlRates = {};
    result.forEach(function (item) {
      if (item.variant === "A") controlRates[item.configVersion] = item.submitRate;
    });
    result.forEach(function (item) {
      var controlRate = controlRates[item.configVersion] || 0;
      item.lift = controlRate > 0 ? (item.submitRate / controlRate) - 1 : 0;
    });

    return result;
  }

  function renderStats(metrics) {
    var totals = metrics.reduce(function (sum, item) {
      sum.views += item.views;
      sum.clicks += item.clicks;
      sum.submits += item.submits;
      sum.closes += item.closes;
      return sum;
    }, { views: 0, clicks: 0, submits: 0, closes: 0 });

    document.getElementById("stat-views").textContent = formatNumber(totals.views);
    document.getElementById("stat-clicks").textContent = formatNumber(totals.clicks);
    document.getElementById("stat-submits").textContent = formatNumber(totals.submits);
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
        formatNumber(item.submits),
        formatPercent(item.submitRate),
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
      } else if (item.clickRate > 0.12 && item.submitRate < 0.04) {
        messages.push("Variant " + item.variant + " / " + item.configVersion + " gets clicks but few submit attempts. The form or offer may need less friction.");
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
        label: "Submit attempt rate",
        data: metrics.map(function (item) { return Math.round(item.submitRate * 1000) / 10; }),
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
        label: "Submit attempts",
        data: metrics.map(function (item) { return item.submits; }),
        backgroundColor: "#c2410c"
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
    activeVariants().forEach(function (variant) {
      var card = document.createElement("article");
      card.className = "dash-preview-card";

      var title = document.createElement("div");
      title.className = "dash-preview-title";
      title.innerHTML = "<strong>Variant " + escapeHtml(variant.id) + "</strong><span>" + escapeHtml(variant.trafficSplit) + "% split</span>";

      var stage = document.createElement("div");
      stage.className = "dash-preview-stage" + (mode === "mobile" ? " is-mobile" : "");
      stage.appendChild(buildPreview(variant));

      card.appendChild(title);
      card.appendChild(stage);
      els.previews.appendChild(card);
    });
  }

  function buildPreview(variant) {
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
    copy.innerHTML = "<h2 class=\"ll-popup-headline\">" + escapeHtml(variant.headline || "") + "</h2><p class=\"ll-popup-subheadline\">" + sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || "")) + "</p>";
    copy.querySelector(".ll-popup-headline").style.textAlign = variant.textAlign || "left";
    copy.querySelector(".ll-popup-subheadline").style.textAlign = variant.textAlign || "left";

    var form = document.createElement("div");
    form.className = "ll-popup-form";
    form.innerHTML = "<div class=\"dash-fake-field\">First Name</div><div class=\"dash-fake-field\">Email</div><button class=\"dash-fake-button\" type=\"button\">" + escapeHtml(variant.buttonText || "Submit") + "</button>";

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

    if (config.formMode === "zapier") {
      renderZapierPreviewForm(form, variant);
    } else if (config.kajabiFormEmbed && config.kajabiFormEmbed.indexOf("YOUR_FORM_ID") === -1) {
      form.innerHTML = "";
      injectKajabiForm(form);
    } else {
      form.innerHTML = "<div class=\"ll-popup-form-status\">Paste your Kajabi form embed in the editor to preview live form fields here.</div>";
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
    els.mobilePreview.classList.toggle("is-active", mode === "mobile");
    renderPreviews(mode);
  }

  function renderEmbedCode() {
    var base = normalizedAssetBaseUrl();
    els.embedCode.value = [
      "<link rel=\"stylesheet\" href=\"" + base + "/popup/popup.css\">",
      "<script src=\"" + base + "/popup/variants.js\"></script>",
      "<script src=\"" + base + "/popup/popup.js\" defer></script>"
    ].join("\n");
  }

  function normalizedAssetBaseUrl() {
    var value = els.assetBaseUrl.value.trim() || defaultAssetBaseUrl();
    return value.replace(/\/+$/, "");
  }

  function defaultAssetBaseUrl() {
    if (window.location.protocol.indexOf("http") === 0) return window.location.origin;
    return "https://YOUR-HOST/kajabi-popup-ab-tool";
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
    var original = "Save & Test";
    button.textContent = text;
    window.setTimeout(function () {
      button.textContent = original;
    }, 2200);
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
      if (row.eventType === "popup_submit_attempt" || row.eventType === "kajabi_form_submitted") item.submits += 1;
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
      els.history.innerHTML = "<p class=\"dash-empty-state\">No historical variation rows yet. Click Save & Test on a variant to record the first one.</p>";
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
    var parts = [
      "CTA: " + (variant.buttonText || "Submit"),
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
      trafficSplit: variant.trafficSplit || ""
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
      return ensureConfigDefaults(JSON.parse(localStorage.getItem(DRAFT_KEY)) || cloneConfig(originalConfig));
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
    value.leadWebhookUrl = value.leadWebhookUrl || originalConfig.leadWebhookUrl || "";
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
    });
    return value;
  }

  function saveDraftConfig() {
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
