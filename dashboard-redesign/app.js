(function () {
  "use strict";

  var variants = {
    A: {
      name: "Winning control",
      headline: "Eat More Protein <i>Without</i> Complicated Meals",
      plainHeadline: "Eat More Protein Without Complicated Meals",
      subheadline: "Get a <b>free 7-day high-protein meal plan</b> with simple meals, a personalized grocery list, and protein already calculated."
    },
    B: {
      name: "Less Guessing",
      headline: "More Protein, Less Guessing",
      plainHeadline: "More Protein, Less Guessing",
      subheadline: "Get 7 days of simple high-protein meals planned for you, with a personalized grocery list and protein already calculated."
    },
    C: {
      name: "Planned in Seconds",
      headline: "Get Your High-Protein Week Planned in Seconds",
      plainHeadline: "Get Your High-Protein Week Planned in Seconds",
      subheadline: "Simple meals, a personalized grocery list, and protein already calculated - so you can stay full without overthinking your meals."
    }
  };

  var selectedVariant = "A";
  var previewStage = document.getElementById("preview-stage");
  var basePreview = document.getElementById("popup-preview");
  var settingsDrawer = document.getElementById("settings-drawer");
  var drawerScrim = document.getElementById("drawer-scrim");
  var publishDialog = document.getElementById("publish-dialog");

  renderOverviewPreviews();
  bindNavigation();
  bindBuilder();
  bindDrawers();
  refreshIcons();

  function bindNavigation() {
    Array.from(document.querySelectorAll("[data-view]")).forEach(function (button) {
      button.addEventListener("click", function () { showView(button.dataset.view); });
    });
    Array.from(document.querySelectorAll("[data-view-link]")).forEach(function (button) {
      button.addEventListener("click", function () { showView(button.dataset.viewLink); });
    });
  }

  function showView(viewName) {
    Array.from(document.querySelectorAll("[data-view]")).forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.view === viewName);
    });
    Array.from(document.querySelectorAll("[data-view-panel]")).forEach(function (panel) {
      var active = panel.dataset.viewPanel === viewName;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    document.getElementById("workspace-name").textContent = titleCase(viewName);
  }

  function bindBuilder() {
    Array.from(document.querySelectorAll(".variant-tab")).forEach(function (button) {
      button.addEventListener("click", function () { selectVariant(button.dataset.variant); });
    });

    Array.from(document.querySelectorAll("[data-editor-tab]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var tab = button.dataset.editorTab;
        Array.from(document.querySelectorAll("[data-editor-tab]")).forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        Array.from(document.querySelectorAll("[data-editor-panel]")).forEach(function (panel) {
          panel.classList.toggle("is-active", panel.dataset.editorPanel === tab);
        });
      });
    });

    Array.from(document.querySelectorAll("[data-device]")).forEach(function (button) {
      button.addEventListener("click", function () {
        Array.from(document.querySelectorAll("[data-device]")).forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        previewStage.classList.toggle("is-mobile", button.dataset.device === "mobile");
        previewStage.classList.remove("is-compare");
        renderSinglePreview();
      });
    });

    document.getElementById("compare-variants").addEventListener("click", renderComparison);
    document.getElementById("headline-input").addEventListener("input", syncDraftCopy);
    document.getElementById("subheadline-input").addEventListener("input", syncDraftCopy);
  }

  function selectVariant(id) {
    selectedVariant = id;
    Array.from(document.querySelectorAll(".variant-tab")).forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.variant === id);
    });
    ["editor-variant-letter", "preview-variant-letter", "footer-variant-letter"].forEach(function (elementId) {
      document.getElementById(elementId).textContent = id;
    });
    document.getElementById("headline-input").value = variants[id].plainHeadline;
    document.getElementById("subheadline-input").value = stripHtml(variants[id].subheadline);
    previewStage.classList.remove("is-compare");
    renderSinglePreview();
  }

  function syncDraftCopy() {
    document.getElementById("preview-headline").textContent = document.getElementById("headline-input").value;
    document.getElementById("preview-subheadline").textContent = document.getElementById("subheadline-input").value;
    document.querySelector(".builder-footer small").textContent = "Unpublished changes";
  }

  function renderSinglePreview() {
    previewStage.innerHTML = "";
    var preview = basePreview.cloneNode(true);
    preview.id = "popup-preview";
    preview.querySelector("h3").innerHTML = variants[selectedVariant].headline;
    preview.querySelector(".popup-preview-copy > div").innerHTML = variants[selectedVariant].subheadline;
    previewStage.appendChild(preview);
    basePreview = preview;
  }

  function renderComparison() {
    previewStage.classList.remove("is-mobile");
    previewStage.classList.add("is-compare");
    previewStage.innerHTML = "";
    Object.keys(variants).forEach(function (id) {
      var preview = basePreview.cloneNode(true);
      preview.removeAttribute("id");
      preview.setAttribute("aria-label", "Variant " + id + " preview");
      preview.querySelector("h3").innerHTML = variants[id].headline;
      preview.querySelector(".popup-preview-copy > div").innerHTML = variants[id].subheadline;
      previewStage.appendChild(preview);
    });
  }

  function bindDrawers() {
    [document.getElementById("open-settings"), document.getElementById("open-global-settings")].forEach(function (button) {
      button.addEventListener("click", openSettings);
    });
    document.getElementById("close-settings").addEventListener("click", closeSettings);
    drawerScrim.addEventListener("click", closeSettings);
    document.getElementById("open-publish").addEventListener("click", function () { publishDialog.showModal(); });
    document.getElementById("close-publish").addEventListener("click", function () { publishDialog.close(); });
    document.getElementById("cancel-publish").addEventListener("click", function () { publishDialog.close(); });
    document.getElementById("toggle-filters").addEventListener("click", function () {
      document.getElementById("analysis-filterbar").classList.toggle("is-collapsed");
    });
    Array.from(document.querySelectorAll("[data-settings-tab]")).forEach(function (button) {
      button.addEventListener("click", function () {
        var tab = button.dataset.settingsTab;
        Array.from(document.querySelectorAll("[data-settings-tab]")).forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        Array.from(document.querySelectorAll("[data-settings-panel]")).forEach(function (panel) {
          panel.classList.toggle("is-active", panel.dataset.settingsPanel === tab);
        });
      });
    });
  }

  function openSettings() {
    settingsDrawer.classList.add("is-open");
    settingsDrawer.setAttribute("aria-hidden", "false");
    drawerScrim.classList.add("is-open");
  }

  function closeSettings() {
    settingsDrawer.classList.remove("is-open");
    settingsDrawer.setAttribute("aria-hidden", "true");
    drawerScrim.classList.remove("is-open");
  }

  function renderOverviewPreviews() {
    var target = document.getElementById("overview-preview-grid");
    target.innerHTML = Object.keys(variants).map(function (id) {
      return [
        "<article class=\"mini-popup\">",
        "<img src=\"https://res.cloudinary.com/dsvlnioq9/image/upload/v1782135119/protien_plan_calculate_preview_and_male_female_pomke9.png\" alt=\"Variant " + id + " preview\">",
        "<div><span>Variant " + id + "</span><h3>" + variants[id].headline + "</h3></div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function stripHtml(value) {
    var node = document.createElement("div");
    node.innerHTML = value;
    return node.textContent || "";
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
})();
