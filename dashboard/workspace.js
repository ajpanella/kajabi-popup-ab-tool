(function () {
  "use strict";

  var selectedVariantId = "A";
  var activeEditorTabs = {};
  var editorObserverTimer = null;
  var settingsDrawer = document.getElementById("studio-settings-drawer");
  var settingsScrim = document.getElementById("studio-settings-scrim");
  var editors = document.getElementById("variant-editors");
  var variantTabs = document.getElementById("workspace-variant-tabs");

  bindWorkspaceNavigation();
  bindSettingsDrawer();
  bindBuilderWorkspace();
  bindAnalysisControls();
  observeDashboardData();
  refreshBuilderWorkspace();
  syncOverview();
  refreshIcons();

  function bindWorkspaceNavigation() {
    Array.from(document.querySelectorAll("[data-workspace-button]")).forEach(function (button) {
      button.addEventListener("click", function () {
        showWorkspace(button.dataset.workspaceButton);
      });
    });
    Array.from(document.querySelectorAll("[data-workspace-link]")).forEach(function (button) {
      button.addEventListener("click", function () {
        showWorkspace(button.dataset.workspaceLink);
      });
    });
  }

  function showWorkspace(name) {
    Array.from(document.querySelectorAll("[data-workspace-button]")).forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.workspaceButton === name);
    });
    Array.from(document.querySelectorAll("[data-workspace-panel]")).forEach(function (panel) {
      var active = panel.dataset.workspacePanel === name;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    document.getElementById("studio-workspace-name").textContent = titleCase(name);
    if (name === "build") window.setTimeout(ensureSelectedPreview, 40);
    if (name === "analyze") window.setTimeout(resizeCharts, 60);
    refreshIcons();
  }

  function bindSettingsDrawer() {
    Array.from(document.querySelectorAll("[data-open-settings]")).forEach(function (button) {
      button.addEventListener("click", function () { openSettings("test"); });
    });
    Array.from(document.querySelectorAll("[data-open-publishing]")).forEach(function (button) {
      button.addEventListener("click", function () { openSettings("publishing"); });
    });
    document.querySelector("[data-close-settings]").addEventListener("click", closeSettings);
    settingsScrim.addEventListener("click", closeSettings);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && settingsDrawer.classList.contains("is-open")) closeSettings();
    });
    Array.from(document.querySelectorAll("[data-settings-tab]")).forEach(function (button) {
      button.addEventListener("click", function () { selectSettingsTab(button.dataset.settingsTab); });
    });
  }

  function openSettings(tab) {
    selectSettingsTab(tab || "test");
    settingsDrawer.classList.add("is-open");
    settingsDrawer.setAttribute("aria-hidden", "false");
    settingsScrim.classList.add("is-open");
  }

  function closeSettings() {
    settingsDrawer.classList.remove("is-open");
    settingsDrawer.setAttribute("aria-hidden", "true");
    settingsScrim.classList.remove("is-open");
  }

  function selectSettingsTab(tab) {
    Array.from(document.querySelectorAll("[data-settings-tab]")).forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.settingsTab === tab);
    });
    Array.from(document.querySelectorAll("[data-settings-panel]")).forEach(function (panel) {
      panel.classList.toggle("is-active", panel.dataset.settingsPanel === tab);
    });
  }

  function bindBuilderWorkspace() {
    variantTabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-workspace-variant]");
      if (button) selectVariant(button.dataset.workspaceVariant);
    });

    editors.addEventListener("click", function (event) {
      var button = event.target.closest("[data-studio-editor-tab]");
      if (!button) return;
      activeEditorTabs[button.dataset.studioVariant] = button.dataset.studioEditorTab;
      activateEditorTab(button.closest(".dash-editor-card"), button.dataset.studioEditorTab);
    });

    editors.addEventListener("input", markDraftChanged);
    editors.addEventListener("change", markDraftChanged);
    settingsDrawer.addEventListener("input", markDraftChanged);
    settingsDrawer.addEventListener("change", markDraftChanged);
    document.getElementById("reset-config").addEventListener("click", function () {
      window.setTimeout(function () {
        setSaveState("Draft reset", true);
        refreshBuilderWorkspace();
      }, 20);
    });
    document.getElementById("publish-github").addEventListener("click", function () {
      setSaveState("Publishing…", false);
    });

    new MutationObserver(function () {
      window.clearTimeout(editorObserverTimer);
      editorObserverTimer = window.setTimeout(refreshBuilderWorkspace, 30);
    }).observe(editors, { childList: true });
  }

  function refreshBuilderWorkspace() {
    var cards = getVariantCards();
    if (!cards.length) return;
    if (!cards.some(function (item) { return item.id === selectedVariantId; })) selectedVariantId = cards[0].id;
    variantTabs.innerHTML = cards.map(function (item) {
      var active = item.id === selectedVariantId;
      var summary = item.card.querySelector(".dash-editor-summary");
      var status = item.card.querySelector(".dash-toolbar-status");
      var traffic = item.card.querySelector('[data-field="trafficSplit"]');
      return [
        '<button type="button" class="studio-variant-tab' + (active ? ' is-active' : '') + '" data-workspace-variant="' + escapeHtml(item.id) + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '">',
        '<b>' + escapeHtml(item.id) + '</b>',
        '<strong>' + escapeHtml(cardHeadline(item.card) || shortVariantLabel(summary ? summary.textContent : "Popup experience")) + '</strong>',
        '<small>' + escapeHtml(traffic ? traffic.value + "% traffic" : "Active variant") + '</small>',
        '<em>' + escapeHtml(compactStatus(status ? status.textContent : "Draft")) + '</em>',
        '</button>'
      ].join("");
    }).join("");
    cards.forEach(function (item) {
      organizeFlowRail(item.card);
      organizeStepEditorTabs(item.card, item.id);
      item.card.classList.toggle("is-workspace-active", item.id === selectedVariantId);
      item.card.open = true;
    });
    syncOverview();
    window.setTimeout(ensureSelectedPreview, 0);
  }

  function selectVariant(id) {
    selectedVariantId = id;
    refreshBuilderWorkspace();
  }

  function ensureSelectedPreview() {
    var selected = getVariantCards().find(function (item) { return item.id === selectedVariantId; });
    if (!selected) return;
    var previewDrawer = document.getElementById("draft-preview-drawer");
    var previewLabel = document.getElementById("draft-preview-variant");
    var alreadySelected = !previewDrawer.hidden && previewLabel.textContent.trim() === "Variant " + selectedVariantId;
    if (alreadySelected) return;
    var previewButton = selected.card.querySelector("[data-draft-preview-toggle]");
    if (previewButton) previewButton.click();
  }

  function getVariantCards() {
    return Array.from(editors.querySelectorAll(".dash-editor-card")).map(function (card, index) {
      var kicker = card.querySelector(".dash-variant-kicker");
      var match = (kicker ? kicker.textContent : "").match(/Variant\s+([A-Z])/i);
      return { card: card, id: match ? match[1].toUpperCase() : String.fromCharCode(65 + index) };
    });
  }

  function bindAnalysisControls() {
    document.getElementById("toggle-analysis-filters").addEventListener("click", function () {
      document.getElementById("analysis-filterbar").classList.toggle("is-collapsed");
    });
  }

  function observeDashboardData() {
    var targets = ["stat-views", "stat-quiz-submits", "stat-leads", "stat-close-rate", "performance-body", "idea-count", "github-publish-status"];
    targets.forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      new MutationObserver(function () {
        syncOverview();
        if (id === "github-publish-status" && /published|success/i.test(element.textContent)) setSaveState("Published", true);
      }).observe(element, { childList: true, subtree: true, characterData: true, attributes: true });
    });
  }

  function syncOverview() {
    syncText("stat-views", "overview-stat-views", "0");
    syncText("stat-quiz-submits", "overview-stat-quiz", "0");
    syncText("stat-leads", "overview-stat-leads", "0");
    syncText("stat-close-rate", "overview-stat-cvr", "0%");
    syncText("idea-count", "sidebar-idea-count", "0");
    renderOverviewVariants();
  }

  function renderOverviewVariants() {
    var target = document.getElementById("overview-live-variants");
    var cards = getVariantCards();
    target.innerHTML = cards.map(function (item) {
      var summary = item.card.querySelector(".dash-editor-summary");
      var status = item.card.querySelector(".dash-toolbar-status");
      var traffic = item.card.querySelector('[data-field="trafficSplit"]');
      return [
        '<div class="studio-live-variant-row">',
        '<b>' + escapeHtml(item.id) + '</b>',
        '<span><strong>' + escapeHtml(cardHeadline(item.card) || shortVariantLabel(summary ? summary.textContent : "Popup experience")) + '</strong><small>' + escapeHtml(traffic ? traffic.value + "% traffic" : "Active") + '</small></span>',
        '<em>' + escapeHtml(status ? status.textContent : "Draft") + '</em>',
        '<button class="studio-icon-button" type="button" data-overview-edit="' + escapeHtml(item.id) + '" aria-label="Edit Variant ' + escapeHtml(item.id) + '"><i data-lucide="arrow-right"></i></button>',
        '</div>'
      ].join("");
    }).join("");
    Array.from(target.querySelectorAll("[data-overview-edit]")).forEach(function (button) {
      button.addEventListener("click", function () {
        selectedVariantId = button.dataset.overviewEdit;
        showWorkspace("build");
        refreshBuilderWorkspace();
      });
    });
    refreshIcons();
  }

  function syncText(sourceId, targetId, fallback) {
    var source = document.getElementById(sourceId);
    var target = document.getElementById(targetId);
    if (target) target.textContent = source && source.textContent.trim() ? source.textContent.trim() : fallback;
  }

  function markDraftChanged() {
    setSaveState("Unpublished changes", false);
  }

  function setSaveState(text, saved) {
    var element = document.querySelector(".studio-save-state");
    if (!element) return;
    element.innerHTML = '<i data-lucide="' + (saved ? "check" : "circle") + '"></i> ' + escapeHtml(text);
    element.classList.toggle("is-unsaved", !saved);
    refreshIcons();
  }

  function resizeCharts() {
    if (!window.Chart || !window.Chart.instances) return;
    Object.keys(window.Chart.instances).forEach(function (key) {
      var chart = window.Chart.instances[key];
      if (chart && chart.resize) chart.resize();
    });
    window.dispatchEvent(new Event("resize"));
  }

  function shortVariantLabel(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "Popup experience";
    var headline = text.split("|")[0].replace(/^CTA:\s*/i, "").trim();
    return headline.length > 48 ? headline.slice(0, 45) + "…" : headline;
  }

  function cardHeadline(card) {
    var editor = card && card.querySelector('.dash-rich-editor[data-field*="headlineHtml"]');
    var text = editor ? editor.textContent.replace(/\s+/g, " ").trim() : "";
    return text.length > 48 ? text.slice(0, 45) + "…" : text;
  }

  function compactStatus(value) {
    return /match|live/i.test(String(value || "")) ? "Live" : "Draft";
  }

  function organizeFlowRail(card) {
    var flow = card && card.querySelector(".dash-flow-editor");
    if (!flow || flow.querySelector(":scope > .studio-flow-rail")) return;
    var rail = document.createElement("div");
    rail.className = "studio-flow-rail";
    [".dash-flow-head", ".dash-flow-presets", ".dash-step-sequence"].forEach(function (selector) {
      var element = flow.querySelector(":scope > " + selector);
      if (element) rail.appendChild(element);
    });
    flow.insertBefore(rail, flow.firstChild);
  }

  function organizeStepEditorTabs(card, variantId) {
    var stepEditor = card && card.querySelector(".dash-step-editor");
    var settings = stepEditor && stepEditor.querySelector(":scope > .dash-step-settings");
    if (!stepEditor || !settings) return;

    if (stepEditor.querySelector(":scope > .studio-step-editor-tabs")) {
      activateEditorTab(card, activeEditorTabs[variantId] || "content");
      return;
    }

    var definitions = [
      { id: "content", label: "Content", icon: "file-text", selectors: [".dash-setting-group-setup", ".dash-setting-group-content"] },
      { id: "form", label: "Form", icon: "list-checks", selectors: [".dash-setting-group-response", ".dash-setting-group-action"] },
      { id: "design", label: "Design", icon: "palette", selectors: [".dash-setting-group-appearance"] },
      { id: "behavior", label: "Behavior", icon: "route", selectors: [".dash-setting-group-navigation"] }
    ];
    var tablist = document.createElement("div");
    tablist.className = "studio-step-editor-tabs";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Step editor sections");
    var panels = document.createElement("div");
    panels.className = "studio-editor-tab-panels";

    definitions.forEach(function (definition) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "studio-step-editor-tab";
      button.dataset.studioEditorTab = definition.id;
      button.dataset.studioVariant = variantId;
      button.setAttribute("role", "tab");
      button.innerHTML = '<i data-lucide="' + definition.icon + '"></i><span>' + definition.label + '</span>';
      tablist.appendChild(button);

      var panel = document.createElement("section");
      panel.className = "studio-editor-tab-panel";
      panel.dataset.studioEditorPanel = definition.id;
      panel.setAttribute("role", "tabpanel");
      definition.selectors.forEach(function (selector) {
        var group = settings.querySelector(":scope > " + selector);
        if (group) {
          group.open = true;
          panel.appendChild(group);
        }
      });
      panels.appendChild(panel);
    });

    var designPanel = card.querySelector(":scope > .dash-design-panel");
    var designTarget = panels.querySelector('[data-studio-editor-panel="design"]');
    var behaviorTarget = panels.querySelector('[data-studio-editor-panel="behavior"]');
    if (designPanel) {
      var reminder = designPanel.querySelector(".dash-reminder-settings");
      designPanel.open = true;
      if (designTarget) designTarget.appendChild(designPanel);
      if (reminder && behaviorTarget) behaviorTarget.appendChild(reminder);
    }

    settings.classList.add("studio-tabbed-settings");
    settings.appendChild(panels);
    stepEditor.insertBefore(tablist, settings);
    activateEditorTab(card, activeEditorTabs[variantId] || "content");
    refreshIcons();
  }

  function activateEditorTab(card, tabId) {
    if (!card) return;
    var available = Array.from(card.querySelectorAll("[data-studio-editor-tab]"));
    if (!available.some(function (button) { return button.dataset.studioEditorTab === tabId; })) tabId = "content";
    available.forEach(function (button) {
      var active = button.dataset.studioEditorTab === tabId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    Array.from(card.querySelectorAll("[data-studio-editor-panel]")).forEach(function (panel) {
      panel.classList.toggle("is-active", panel.dataset.studioEditorPanel === tabId);
    });
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }
})();
