(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var requested = params.get("campaign") || "high-protein";
  var router = window.LL_POPUP_CAMPAIGN_ROUTER;
  var campaign = router ? router.byId(requested) : {
    id: "high-protein",
    name: "High Protein Meals",
    dashboardLabel: "High Protein Popup",
    configPath: "popup/variants.js",
    publishPath: "popup/variants.js"
  };

  window.LL_POPUP_DASHBOARD_CAMPAIGN = campaign;
  document.write('<script src="../' + campaign.configPath + '?dashboard=' + Date.now() + '"><\/script>');
})();
