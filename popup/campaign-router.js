(function () {
  "use strict";

  var campaigns = {
    "high-protein": {
      id: "high-protein",
      name: "High Protein Meals",
      dashboardLabel: "High Protein Popup",
      configPath: "popup/variants.js",
      publishPath: "popup/variants.js"
    },
    "anti-inflammatory": {
      id: "anti-inflammatory",
      name: "Anti-Inflammatory Diet",
      dashboardLabel: "Anti-Inflammatory Popup",
      configPath: "popup/campaigns/anti-inflammatory.js",
      publishPath: "popup/campaigns/anti-inflammatory.js"
    }
  };

  function normalizePath(value) {
    try {
      return decodeURIComponent(String(value || "")).toLowerCase();
    } catch (error) {
      return String(value || "").toLowerCase();
    }
  }

  function selectCampaign(pathname) {
    var path = normalizePath(pathname);

    // Protein wins when an article intentionally targets both topics.
    if (path.indexOf("high-protein") >= 0) return campaigns["high-protein"];
    if (path.indexOf("anti-inflammatory") >= 0 || path.indexOf("inflammation") >= 0) {
      return campaigns["anti-inflammatory"];
    }
    return campaigns["high-protein"];
  }

  function campaignById(id) {
    return campaigns[id] || campaigns["high-protein"];
  }

  window.LL_POPUP_CAMPAIGN_ROUTER = {
    campaigns: campaigns,
    select: selectCampaign,
    byId: campaignById
  };
})();
