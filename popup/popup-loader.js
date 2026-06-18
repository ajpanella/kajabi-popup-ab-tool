(function () {
  "use strict";

  if (window.LL_POPUP_LOADER_STARTED) return;
  window.LL_POPUP_LOADER_STARTED = true;

  var currentScript = document.currentScript;
  var baseUrl = currentScript && currentScript.src
    ? currentScript.src.replace(/\/popup\/popup-loader\.js(?:\?.*)?$/, "")
    : "https://ajpanella.github.io/kajabi-popup-ab-tool";
  var cacheKey = Date.now().toString(36);

  loadStylesheet(baseUrl + "/popup/popup.css?v=" + cacheKey);
  loadScript(baseUrl + "/popup/variants.js?v=" + cacheKey, function () {
    loadScript(baseUrl + "/popup/popup.js?v=" + cacheKey);
  });

  function loadStylesheet(url) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  function loadScript(url, onload) {
    var script = document.createElement("script");
    script.src = url;
    script.async = false;
    if (onload) script.onload = onload;
    document.head.appendChild(script);
  }
})();
