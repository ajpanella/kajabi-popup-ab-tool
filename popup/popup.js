(function () {
  "use strict";

  var config = window.LL_POPUP_CONFIG;
  if (!config || !Array.isArray(config.variants)) return;

  var STORAGE_PREFIX = "ll_popup_" + sanitizeKey(config.testId || "default") + "_";
  var SESSION_KEY = STORAGE_PREFIX + "session_id";
  var ASSIGNMENT_KEY = STORAGE_PREFIX + "assignment_" + sanitizeKey(config.configVersion || "v1");
  var COOLDOWN_KEY = STORAGE_PREFIX + "cooldown_until";
  var hasShown = false;
  var variant = getAssignedVariant();

  if (!variant || isInCooldown()) return;

  attachTriggerListeners();

  function attachTriggerListeners() {
    var delayMs = Number(config.triggers && config.triggers.delayMs) || 35000;
    window.setTimeout(showPopup, delayMs);
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function onScroll() {
    var triggerDepth = Number(config.triggers && config.triggers.scrollDepth) || 0.5;
    var doc = document.documentElement;
    var scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
    var depth = (window.scrollY || doc.scrollTop || 0) / scrollable;
    if (depth >= triggerDepth) showPopup();
  }

  function showPopup() {
    if (hasShown || isInCooldown() || document.querySelector(".ll-popup-root")) return;
    hasShown = true;
    window.removeEventListener("scroll", onScroll);

    var root = document.createElement("div");
    root.className = "ll-popup-root";
    if (Number(variant.height) > 0) root.classList.add("ll-popup-has-height");
    if (variant.sizeToImage) root.classList.add("ll-popup-size-to-image");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "ll-popup-headline");
    root.style.setProperty("--ll-popup-width", (Number(variant.width) || 560) + "px");
    root.style.setProperty("--ll-popup-height", (Number(variant.height) || 640) + "px");
    root.style.setProperty("--ll-popup-bg", variant.backgroundColor || "#ffffff");
    root.style.setProperty("--ll-popup-text", variant.textColor || "#172026");
    root.style.setProperty("--ll-popup-accent", variant.accentColor || "#1f6feb");
    root.style.setProperty("--ll-popup-font", variant.fontFamily || "Arial, Helvetica, sans-serif");
    root.style.setProperty("--ll-popup-align", variant.textAlign || "left");

    var overlay = document.createElement("div");
    overlay.className = "ll-popup-overlay";
    overlay.addEventListener("click", closePopup);

    var modal = document.createElement("div");
    modal.className = "ll-popup-modal";

    var close = document.createElement("button");
    close.className = "ll-popup-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close popup");
    close.innerHTML = "&times;";
    close.addEventListener("click", closePopup);

    var content = document.createElement("div");
    content.className = "ll-popup-content";

    if (variant.imageUrl) {
      var image = document.createElement("img");
      image.className = "ll-popup-image";
      image.alt = variant.imageAlt || "";
      image.addEventListener("load", function () {
        sizeToImage(root, image);
        schedulePopupFit(root);
      });
      image.src = variant.imageUrl;
      content.appendChild(image);
      if (image.complete) {
        sizeToImage(root, image);
        schedulePopupFit(root);
      }
    }

    var copy = document.createElement("div");
    copy.className = "ll-popup-copy";
    copy.style.textAlign = variant.textAlign || "left";

    var headline = document.createElement("h2");
    headline.className = "ll-popup-headline";
    headline.id = "ll-popup-headline";
    headline.textContent = variant.headline || "";
    headline.style.textAlign = variant.textAlign || "left";

    var subheadline = document.createElement("p");
    subheadline.className = "ll-popup-subheadline";
    subheadline.innerHTML = sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || ""));
    subheadline.style.textAlign = variant.textAlign || "left";

    copy.appendChild(headline);
    copy.appendChild(subheadline);
    content.appendChild(copy);

    var form = document.createElement("div");
    form.className = "ll-popup-form";
    content.appendChild(form);

    modal.appendChild(close);
    modal.appendChild(content);
    root.appendChild(overlay);
    root.appendChild(modal);
    document.body.appendChild(root);
    document.body.classList.add("ll-popup-lock-scroll");

    injectKajabiForm(form);
    bindFormTracking(form);
    schedulePopupFit(root);
    window.addEventListener("resize", onResize);

    window.requestAnimationFrame(function () {
      root.classList.add("ll-popup-is-visible");
      close.focus();
      schedulePopupFit(root);
    });

    trackEvent("popup_view");

    function closePopup() {
      root.classList.remove("ll-popup-is-visible");
      document.body.classList.remove("ll-popup-lock-scroll");
      window.removeEventListener("resize", onResize);
      setCooldown(config.cooldownDaysAfterClose || 7);
      trackEvent("popup_close");
      window.setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, 150);
    }

    function onResize() {
      sizeToImage(root, root.querySelector(".ll-popup-image"));
      schedulePopupFit(root);
    }
  }

  function injectKajabiForm(container) {
    if (config.formMode === "zapier") {
      renderZapierForm(container);
      return;
    }

    var embed = String(config.kajabiFormEmbed || "");
    var scriptUrl = getKajabiScriptUrl(embed);

    if (scriptUrl && config.kajabiEmbedMode !== "iframe") {
      executeEmbedHtml(container, embed);
      schedulePopupFit(container.closest(".ll-popup-root"));
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
      return;
    }

    if (scriptUrl) {
      injectKajabiIframe(container, scriptUrl);
      return;
    }

    container.innerHTML = embed;
  }

  function renderZapierForm(container) {
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
      trackEvent("popup_lead_submit");
      setCooldown(config.cooldownDaysAfterSubmitAttempt || 90);
      showFormStatus(container, "Thanks. Check your inbox for the next step.");
      schedulePopupFit(container.closest(".ll-popup-root"));
    });
  }

  function showFormStatus(container, message) {
    var status = document.createElement("div");
    status.className = "ll-popup-form-status";
    status.textContent = message;
    container.innerHTML = "";
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

  function sizeToImage(root, image) {
    if (!root || !variant.sizeToImage || !image || !image.naturalWidth || !image.naturalHeight) return;

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

  function schedulePopupFit(root) {
    if (!root) return;
    window.requestAnimationFrame(function () {
      fitPopupToViewport(root);
    });
  }

  function fitPopupToViewport(root) {
    var modal = root && root.querySelector(".ll-popup-modal");
    if (!modal) return;

    var viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 1024);
    var viewportHeight = Math.max(420, window.innerHeight || document.documentElement.clientHeight || 768);
    var availableHeight = viewportHeight - (viewportWidth <= 640 ? 24 : 48);
    var availableWidth = viewportWidth - 32;
    var image = root.querySelector(".ll-popup-image");

    root.style.setProperty("--ll-popup-scale", "1");
    root.style.removeProperty("--ll-popup-content-padding");
    root.style.removeProperty("--ll-popup-content-gap");

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

  function bindFormTracking(container) {
    var hasFocused = false;
    var hasClicked = false;
    var hasAttemptedSubmit = false;

    container.addEventListener("focusin", function () {
      if (hasFocused) return;
      hasFocused = true;
      trackEvent("popup_form_focus");
    });

    container.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      if (target.closest("button, input[type='submit'], .form-btn, a")) {
        if (hasClicked) return;
        hasClicked = true;
        trackEvent("popup_form_click");
      }
    });

    container.addEventListener("submit", function () {
      submitAttempt();
    }, true);

    container.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("button[type='submit'], input[type='submit'], .form-btn")) {
        submitAttempt();
      }
    }, true);

    function submitAttempt() {
      if (hasAttemptedSubmit) return;
      hasAttemptedSubmit = true;
      setCooldown(config.cooldownDaysAfterSubmitAttempt || 90);
      trackEvent("popup_submit_attempt");
    }
  }

  function getAssignedVariant() {
    var activeVariants = config.variants.filter(function (item) {
      return item && item.active !== false && Number(item.trafficSplit) > 0;
    });
    if (!activeVariants.length) return null;

    var stored = readJson(ASSIGNMENT_KEY);
    if (stored && stored.variantId && stored.expiresAt > Date.now()) {
      var existing = activeVariants.find(function (item) {
        return item.id === stored.variantId;
      });
      if (existing) return existing;
    }

    var selected = chooseWeighted(activeVariants);
    writeJson(ASSIGNMENT_KEY, {
      variantId: selected.id,
      expiresAt: Date.now() + daysToMs(config.assignmentDays || 30)
    });
    return selected;
  }

  function chooseWeighted(variants) {
    var total = variants.reduce(function (sum, item) {
      return sum + Number(item.trafficSplit || 0);
    }, 0);
    var cursor = Math.random() * total;

    for (var i = 0; i < variants.length; i += 1) {
      cursor -= Number(variants[i].trafficSplit || 0);
      if (cursor <= 0) return variants[i];
    }

    return variants[variants.length - 1];
  }

  function trackOnce(key, eventType) {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    trackEvent(eventType);
  }

  function trackEvent(eventType) {
    if (!config.webhookUrl) return;

    var payload = buildPayload(eventType);
    sendPayload(config.webhookUrl, payload);
  }

  function sendPayload(url, payload) {
    if (!url) return;
    if (/^https:\/\/script\.google\.com\/macros\/s\//i.test(url)) {
      sendFormPayload(url, payload);
      return;
    }

    var json = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      var blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }

    window.fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true
    }).catch(function () {});
  }

  function sendFormPayload(url, payload) {
    var frameName = "ll_popup_webhook_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    var iframe = document.createElement("iframe");
    var form = document.createElement("form");

    iframe.name = frameName;
    iframe.style.display = "none";
    form.method = "POST";
    form.action = url;
    form.target = frameName;
    form.style.display = "none";
    form.enctype = "application/x-www-form-urlencoded";

    Object.keys(payload).forEach(function (key) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = typeof payload[key] === "string" ? payload[key] : JSON.stringify(payload[key] || "");
      form.appendChild(input);
    });

    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();

    window.setTimeout(function () {
      if (form.parentNode) form.parentNode.removeChild(form);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 10000);
  }

  function sendLeadPayload(url, payload) {
    if (!url) return;
    var body = new URLSearchParams();
    body.set("name", payload.name || "");
    body.set("email", payload.email || "");

    if (navigator.sendBeacon) {
      if (navigator.sendBeacon(url, body)) return;
    }

    window.fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function buildPayload(eventType) {
    var params = new URLSearchParams(window.location.search);
    return {
      timestamp: new Date().toISOString(),
      testId: config.testId || "",
      configVersion: config.configVersion || "v1",
      changeNote: config.changeNote || "",
      variant: variant.id,
      variantLabel: getVariantLabel(),
      variantSnapshot: getVariantSnapshot(),
      eventType: eventType,
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrer: document.referrer,
      deviceType: getDeviceType(),
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      userAgent: navigator.userAgent,
      sessionId: getSessionId()
    };
  }

  function getVariantSnapshot() {
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
      accentColor: variant.accentColor || "",
      fontFamily: variant.fontFamily || "",
      textAlign: variant.textAlign || "",
      trafficSplit: variant.trafficSplit || ""
    });
  }

  function getVariantLabel() {
    return [
      "CTA: " + (variant.buttonText || "Submit"),
      "Button: " + (variant.accentColor || ""),
      "BG: " + (variant.backgroundColor || ""),
      "Width: " + (variant.width || ""),
      variant.height ? "Height: " + variant.height : "",
      variant.sizeToImage ? "Size to image" : "",
      "Font: " + String(variant.fontFamily || "Arial").split(",")[0],
      "Align: " + (variant.textAlign || "left"),
      variant.imageUrl ? "Image" : "No image"
    ].filter(Boolean).join(" | ");
  }

  function getSessionId() {
    var current = sessionStorage.getItem(SESSION_KEY);
    if (current) return current;
    current = "lls_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, current);
    return current;
  }

  function getDeviceType() {
    var width = window.innerWidth || document.documentElement.clientWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  function isInCooldown() {
    return Number(localStorage.getItem(COOLDOWN_KEY) || 0) > Date.now();
  }

  function setCooldown(days) {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now() + daysToMs(days)));
  }

  function daysToMs(days) {
    return Number(days) * 24 * 60 * 60 * 1000;
  }

  function sanitizeKey(value) {
    return String(value).replace(/[^a-z0-9_-]/gi, "_");
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

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
})();
