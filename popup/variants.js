(function () {
  window.LL_POPUP_CONFIG = {
    testId: "blog-optin-v1",
    configVersion: "v1",
    changeNote: "Initial popup copy and styling.",
    savedColors: ["#111827", "#ffffff", "#f8fafc", "#172026", "#1f6feb", "#0f766e", "#c2410c", "#fbfaf7", "#1c2520", "#d9dee7"],
    kajabiEmbedMode: "auto",
    formMode: "zapier",
    leadWebhookUrl: "",
    webhookUrl: "",
    kajabiFormEmbed: "<script src=\"https://app.kajabi.com/forms/YOUR_FORM_ID/embed.js\"></script>",
    cooldownDaysAfterClose: 7,
    cooldownDaysAfterSubmitAttempt: 90,
    assignmentDays: 30,
    triggers: {
      delayMs: 35000,
      scrollDepth: 0.5
    },
    variants: [
      {
        id: "A",
        name: "Control",
        active: true,
        trafficSplit: 50,
        headline: "Get the free guide",
        subheadline: "A practical resource to help you take the next step with more clarity.",
        imageUrl: "",
        width: 560,
        height: "",
        sizeToImage: false,
        backgroundColor: "#ffffff",
        textColor: "#172026",
        accentColor: "#1f6feb",
        fontFamily: "Arial, Helvetica, sans-serif",
        textAlign: "left",
        buttonText: "Send me the guide"
      },
      {
        id: "B",
        name: "Benefit Led",
        active: true,
        trafficSplit: 50,
        headline: "Make your next move simpler",
        subheadline: "Join the list and get the same framework I use to turn messy ideas into a clear plan.",
        imageUrl: "",
        width: 560,
        height: "",
        sizeToImage: false,
        backgroundColor: "#fbfaf7",
        textColor: "#1c2520",
        accentColor: "#0f766e",
        fontFamily: "Arial, Helvetica, sans-serif",
        textAlign: "center",
        buttonText: "Get instant access"
      }
    ]
  };
})();
