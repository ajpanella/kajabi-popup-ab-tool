(function () {
  "use strict";

  var config = window.LL_POPUP_CONFIG;
  if (!config || !Array.isArray(config.variants)) return;

  var STORAGE_PREFIX = "ll_popup_" + sanitizeKey(config.testId || "default") + "_";
  var SESSION_KEY = STORAGE_PREFIX + "session_id";
  var ASSIGNMENT_KEY = STORAGE_PREFIX + "assignment_" + sanitizeKey(config.configVersion || "v1");
  var COOLDOWN_KEY = STORAGE_PREFIX + "cooldown_until";
  var hasShown = false;
  var closeReopenCount = 0;
  var reopenTimer = null;
  var reminderElement = null;
  var variant = getAssignedVariant();

  if (!variant || isInCooldown()) return;

  attachTriggerListeners();

  function attachTriggerListeners() {
    var delayMs = Number(config.triggers && config.triggers.delayMs) || 35000;
    var triggerDepth = Number(config.triggers && config.triggers.scrollDepth);
    window.setTimeout(showPopup, delayMs);
    if (Number.isFinite(triggerDepth) && triggerDepth > 0) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  function onScroll() {
    var triggerDepth = Number(config.triggers && config.triggers.scrollDepth);
    if (!Number.isFinite(triggerDepth) || triggerDepth <= 0) return;
    var doc = document.documentElement;
    var scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
    var depth = (window.scrollY || doc.scrollTop || 0) / scrollable;
    if (depth >= triggerDepth) showPopup();
  }

  function showPopup() {
    if (hasShown || isInCooldown() || document.querySelector(".ll-popup-root")) return;
    clearReopenTimer();
    removeReminderTab();
    hasShown = true;
    window.removeEventListener("scroll", onScroll);

    var root = document.createElement("div");
    root.className = "ll-popup-root";
    if (Number(variant.height) > 0) root.classList.add("ll-popup-has-height");
    if (variant.sizeToImage) root.classList.add("ll-popup-size-to-image");
    if (config.leadMagnetMode === "protein_plan" && getProteinQuizConfig(variant).showQuizStep === false) root.classList.add("ll-popup-single-step");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "ll-popup-headline");
    root.style.setProperty("--ll-popup-width", (Number(variant.width) || 560) + "px");
    root.style.setProperty("--ll-popup-height", (Number(variant.height) || 640) + "px");
    root.style.setProperty("--ll-popup-bg", variant.backgroundColor || "#ffffff");
    root.style.setProperty("--ll-popup-text", variant.textColor || "#172026");
    root.style.setProperty("--ll-popup-accent", variant.brandAccentColor || "#06b00b");
    root.style.setProperty("--ll-popup-eyebrow-color", variant.eyebrowColor || "#6b7280");
    root.style.setProperty("--ll-popup-button-bg", variant.accentColor || "#1f6feb");
    root.style.setProperty("--ll-popup-font", variant.fontFamily || "Arial, Helvetica, sans-serif");
    root.style.setProperty("--ll-popup-headline-weight", String(variant.headlineFontWeight || 700));
    root.style.setProperty("--ll-popup-body-weight", String(variant.bodyFontWeight || 400));
    root.style.setProperty("--ll-popup-button-weight", String(variant.buttonFontWeight || 700));
    root.style.setProperty("--ll-popup-align", variant.textAlign || "left");
    setPopupTextSizeVariables(root, variant);

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

    var eyebrow = document.createElement("p");
    eyebrow.className = "ll-popup-eyebrow";
    eyebrow.innerHTML = sanitizeRichHtml(variant.eyebrowHtml || "");
    eyebrow.style.textAlign = variant.textAlign || "left";
    eyebrow.hidden = !variant.eyebrowHtml;

    var headline = document.createElement("h2");
    headline.className = "ll-popup-headline";
    headline.id = "ll-popup-headline";
    headline.innerHTML = sanitizeRichHtml(variant.headlineHtml || escapeHtml(variant.headline || ""));
    headline.style.textAlign = variant.textAlign || "left";

    var subheadline = document.createElement("p");
    subheadline.className = "ll-popup-subheadline";
    subheadline.innerHTML = sanitizeRichHtml(variant.subheadlineHtml || escapeHtml(variant.subheadline || ""));
    subheadline.style.textAlign = variant.textAlign || "left";

    var valueLine = document.createElement("p");
    valueLine.className = "ll-popup-value-line";
    valueLine.innerHTML = sanitizeRichHtml(variant.valueLineHtml || escapeHtml(variant.valueLine || ""));
    valueLine.style.textAlign = variant.textAlign || "left";
    if (!variant.valueLine && !variant.valueLineHtml) valueLine.hidden = true;

    copy.appendChild(eyebrow);
    copy.appendChild(headline);
    copy.appendChild(subheadline);
    copy.appendChild(valueLine);
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
      if (root.dataset.closing === "true") return;
      root.dataset.closing = "true";
      root.classList.remove("ll-popup-is-visible");
      document.body.classList.remove("ll-popup-lock-scroll");
      window.removeEventListener("resize", onResize);
      scheduleCloseReopenOrCooldown();
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

  function scheduleCloseReopenOrCooldown() {
    var reopenSeconds = variantReopenSeconds();
    var reminderEnabled = variant.reminderEnabled !== false;
    if (closeReopenCount < 1 && (reminderEnabled || reopenSeconds > 0)) {
      closeReopenCount += 1;
      if (reminderEnabled) showReminderTab();
      if (reopenSeconds > 0) {
        reopenTimer = window.setTimeout(function () {
          reopenTimer = null;
          removeReminderTab();
          hasShown = false;
          showPopup();
        }, reopenSeconds * 1000);
      }
      return;
    }

    setCooldown(config.cooldownDaysAfterClose || 7);
  }

  function variantReopenSeconds() {
    var reopenSeconds = Number(variant.reopenAfterCloseSeconds);
    if (!Number.isFinite(reopenSeconds)) reopenSeconds = Number(config.reopenAfterCloseSeconds);
    return Number.isFinite(reopenSeconds) ? Math.max(0, reopenSeconds) : 0;
  }

  function showReminderTab() {
    removeReminderTab();

    var reminder = document.createElement("aside");
    reminder.className = "ll-popup-reminder";
    reminder.setAttribute("aria-label", "Reopen offer");
    reminder.style.setProperty("--ll-popup-reminder-bg", variant.reminderColor || variant.accentColor || "#06b00b");
    reminder.style.setProperty("--ll-popup-reminder-font", variant.fontFamily || "Arial, Helvetica, sans-serif");

    var reopenButton = document.createElement("button");
    reopenButton.className = "ll-popup-reminder-main";
    reopenButton.type = "button";
    reopenButton.textContent = variant.reminderText || "Free Protein Plan";
    reopenButton.addEventListener("click", function () {
      clearReopenTimer();
      removeReminderTab();
      hasShown = false;
      trackEvent("popup_reminder_click");
      showPopup();
    });

    var dismissButton = document.createElement("button");
    dismissButton.className = "ll-popup-reminder-close";
    dismissButton.type = "button";
    dismissButton.setAttribute("aria-label", "Dismiss offer");
    dismissButton.innerHTML = "&times;";
    dismissButton.addEventListener("click", function (event) {
      event.stopPropagation();
      clearReopenTimer();
      removeReminderTab();
      setCooldown(config.cooldownDaysAfterClose || 7);
      trackEvent("popup_reminder_close");
    });

    reminder.appendChild(reopenButton);
    reminder.appendChild(dismissButton);
    document.body.appendChild(reminder);
    reminderElement = reminder;
    window.requestAnimationFrame(function () {
      reminder.classList.add("ll-popup-reminder-is-visible");
    });
    trackEvent("popup_reminder_view");
  }

  function removeReminderTab() {
    if (!reminderElement) return;
    if (reminderElement.parentNode) reminderElement.parentNode.removeChild(reminderElement);
    reminderElement = null;
  }

  function clearReopenTimer() {
    if (reopenTimer === null) return;
    window.clearTimeout(reopenTimer);
    reopenTimer = null;
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
    if (config.leadMagnetMode === "protein_plan") {
      renderProteinPlanForm(container);
      return;
    }

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

  function renderProteinPlanForm(container) {
    if (Array.isArray(variant.flowSteps) && variant.flowSteps.length) {
      renderFlowPlanForm(container);
      return;
    }
    var quizData = {};
    var proteinQuiz = getProteinQuizConfig(variant);
    var root = container.closest(".ll-popup-root");
    var eyebrow = root && root.querySelector(".ll-popup-eyebrow");
    var headline = root && root.querySelector(".ll-popup-headline");
    var subheadline = root && root.querySelector(".ll-popup-subheadline");
    var valueLine = root && root.querySelector(".ll-popup-value-line");
    var initialHeadline = headline ? headline.textContent : "";
    var initialSubheadline = subheadline ? subheadline.innerHTML : "";

    var multiQuestions = [
      { key: "targetWeight", labelKey: "targetWeightLabel", placeholderKey: "targetWeightPlaceholder", styleKey: "targetWeightAnswerStyle" },
      { key: "strengthDays", labelKey: "strengthDaysLabel", placeholderKey: "strengthDaysPlaceholder", styleKey: "strengthDaysAnswerStyle" },
      { key: "age", labelKey: "ageLabel", placeholderKey: "agePlaceholder", styleKey: "ageAnswerStyle" }
    ];

    if (proteinQuiz.showQuizStep === false) {
      renderLeadStep(true);
    } else if (proteinQuiz.multiStepEnabled === true) {
      renderMultiQuizStep(0);
    } else {
      renderQuizStep();
    }

    function renderMultiQuizStep(index) {
      var question = multiQuestions[index];
      renderProteinTargetPreview(root, proteinQuiz, null);
      if (headline) headline.innerHTML = sanitizeRichHtml(variant.quizHeadline || variant.headlineHtml || escapeHtml(initialHeadline || "Your Personalized Protein Plan"));
      if (subheadline) subheadline.innerHTML = sanitizeRichHtml(variant.quizSubheadlineHtml || variant.subheadlineHtml || initialSubheadline || "Answer 3 quick questions and get your personalized protein target.");
      setPopupValueLine(valueLine, variant.valueLineHtml || escapeHtml(variant.valueLine || ""));
      container.innerHTML = [
        index > 0 ? "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Previous question\">&#8592;</button>" : "",
        renderMultiProgressHtml(proteinQuiz, index + 1, 3),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form ll-popup-multi-question\" data-step=\"quiz-" + (index + 1) + "\">",
        "<fieldset><legend>" + escapeHtml(proteinQuiz[question.labelKey]) + "</legend>",
        renderMultiQuestionControl(question, proteinQuiz),
        "</fieldset>",
        proteinQuiz[question.styleKey] === "ranges" ? "" : "<button type=\"submit\">" + escapeHtml(index === 2 ? proteinQuiz.quizButtonText : "Continue") + "</button>",
        "</form>"
      ].join("");

      var form = container.querySelector("form");
      var backButton = container.querySelector(".ll-popup-step-back");
      if (backButton) backButton.addEventListener("click", function () { renderMultiQuizStep(index - 1); });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var value = getFormValue(form, question.key);
        if (!value) return;
        quizData[question.key] = value;
        if (index < 2) {
          renderMultiQuizStep(index + 1);
          return;
        }
        quizData.proteinTarget = calculateProteinTarget(quizData.targetWeight, quizData.age, quizData.strengthDays);
        trackEvent("popup_quiz_submit", getProteinTrackingFields(quizData));
        renderLeadStep(false);
      });
      form.querySelectorAll("[data-auto-answer]").forEach(function (button) {
        button.addEventListener("click", function () {
          form.elements[question.key].value = button.dataset.value;
          quizData[question.key + "Range"] = button.textContent.trim();
          form.requestSubmit();
        });
      });
      schedulePopupFit(root);
    }

    function renderQuizStep() {
      renderProteinTargetPreview(root, proteinQuiz, null);
      if (headline) headline.innerHTML = sanitizeRichHtml(variant.quizHeadline || variant.headlineHtml || escapeHtml(initialHeadline || "Your Personalized Protein Plan"));
      if (subheadline) {
        subheadline.innerHTML = sanitizeRichHtml(variant.quizSubheadlineHtml || variant.subheadlineHtml || initialSubheadline || "Answer 3 quick questions and get your daily protein target plus a 7-day high-protein week.");
      }
      setPopupValueLine(valueLine, variant.valueLineHtml || escapeHtml(variant.valueLine || ""));

      container.innerHTML = [
        renderProteinProgressHtml(proteinQuiz, 1),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form\" data-step=\"quiz\">",
        "<label><span>" + escapeHtml(proteinQuiz.targetWeightLabel) + "</span><input name=\"targetWeight\" type=\"number\" inputmode=\"numeric\" min=\"80\" max=\"350\" step=\"1\" placeholder=\"" + escapeHtmlAttr(proteinQuiz.targetWeightPlaceholder) + "\" required></label>",
        "<label><span>" + escapeHtml(proteinQuiz.strengthDaysLabel) + "</span><select name=\"strengthDays\" required>",
        "<option value=\"\">" + escapeHtml(proteinQuiz.strengthDaysPlaceholder) + "</option>",
        "<option value=\"0\">0 days</option>",
        "<option value=\"1\">1 day</option>",
        "<option value=\"2\">2 days</option>",
        "<option value=\"3\">3 days</option>",
        "<option value=\"4\">4 days</option>",
        "<option value=\"5\">5 days</option>",
        "<option value=\"6\">6 days</option>",
        "<option value=\"7\">7 days</option>",
        "</select></label>",
        "<label><span>" + escapeHtml(proteinQuiz.ageLabel) + "</span><input name=\"age\" type=\"number\" inputmode=\"numeric\" min=\"18\" max=\"100\" step=\"1\" placeholder=\"" + escapeHtmlAttr(proteinQuiz.agePlaceholder) + "\" required></label>",
        "<button type=\"submit\">" + escapeHtml(proteinQuiz.quizButtonText) + "</button>",
        "</form>"
      ].join("");

      var form = container.querySelector("form");
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        quizData = {
          targetWeight: form.elements.targetWeight.value,
          strengthDays: form.elements.strengthDays.value,
          age: form.elements.age.value,
          proteinTarget: calculateProteinTarget(form.elements.targetWeight.value, form.elements.age.value, form.elements.strengthDays.value)
        };
        trackEvent("popup_quiz_submit", getProteinTrackingFields(quizData));
        renderLeadStep(false);
      });

      schedulePopupFit(root);
    }

    function renderLeadStep(singleStep) {
      if (headline) headline.innerHTML = singleStep ? sanitizeRichHtml(variant.headlineHtml || escapeHtml(initialHeadline)) : escapeHtml(proteinQuiz.leadHeadline);
      if (subheadline) subheadline.innerHTML = singleStep ? initialSubheadline : sanitizeRichHtml(proteinQuiz.leadSubheadline);
      setPopupValueLine(valueLine, singleStep ? (variant.valueLineHtml || escapeHtml(variant.valueLine || "")) : "");
      renderProteinTargetPreview(root, proteinQuiz, singleStep ? null : quizData.proteinTarget);

      container.innerHTML = [
        singleStep ? "" : "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Back\">&#8592;</button>",
        singleStep ? renderProteinProgressHtml(proteinQuiz, 1, true) : (proteinQuiz.multiStepEnabled === true ? renderMultiProgressHtml(proteinQuiz, 3, 3) : renderProteinProgressHtml(proteinQuiz, 2)),
        "<form class=\"ll-popup-zapier-form ll-popup-protein-form\" data-step=\"lead\">",
        proteinQuiz.showFirstName === false ? "" : "<label><span>" + escapeHtml(proteinQuiz.firstNameLabel) + "</span><input name=\"name\" autocomplete=\"given-name\" placeholder=\"" + escapeHtmlAttr(proteinQuiz.firstNamePlaceholder) + "\" required></label>",
        proteinQuiz.showEmail === false ? "" : "<label><span>" + escapeHtml(proteinQuiz.emailLabel) + "</span><input name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"" + escapeHtmlAttr(proteinQuiz.emailPlaceholder) + "\" required></label>",
        "<button type=\"submit\">" + escapeHtml(proteinQuiz.leadButtonText || variant.buttonText || "Show My Protein Plan") + "</button>",
        "</form>"
      ].join("");

      var form = container.querySelector("form");
      var backButton = container.querySelector(".ll-popup-step-back");
      if (backButton) backButton.addEventListener("click", function () { proteinQuiz.multiStepEnabled === true ? renderMultiQuizStep(2) : renderQuizStep(); });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var payload = {
          name: getFormValue(form, "name"),
          email: getFormValue(form, "email"),
          targetWeightLbs: quizData.targetWeight,
          TargetWeight: quizData.targetWeight,
          age: quizData.age,
          Age: quizData.age,
          strengthDays: quizData.strengthDays,
          StrengthDays: quizData.strengthDays,
          targetWeightRange: quizData.targetWeightRange || "",
          TargetWeightRange: quizData.targetWeightRange || "",
          ageRange: quizData.ageRange || "",
          AgeRange: quizData.ageRange || "",
          strengthDaysRange: quizData.strengthDaysRange || "",
          StrengthDaysRange: quizData.strengthDaysRange || "",
          proteinTargetRange: quizData.proteinTarget && quizData.proteinTarget.rangeText,
          ProteinTargetRange: quizData.proteinTarget && quizData.proteinTarget.rangeText,
          proteinDailyGoalGrams: quizData.proteinTarget && quizData.proteinTarget.dailyGoalGrams,
          ProteinDailyGoalGrams: quizData.proteinTarget && quizData.proteinTarget.dailyGoalGrams,
          source: "protein_popup",
          ctaVariant: "show_my_protein_plan",
          popupVariant: variant.id
        };

        sendLeadPayload(config.leadWebhookUrl, payload);
        trackEvent("popup_lead_submit", getProteinTrackingFields(payload));
        setCooldown(config.cooldownDaysAfterSubmitAttempt || 90);
        redirectToProteinPlan(payload);
      });

      schedulePopupFit(root);
    }
  }

  function renderFlowPlanForm(container) {
    var steps = variant.flowSteps.filter(function (step) { return step && step.enabled !== false; });
    if (!steps.length) return;
    var answers = {};
    var currentIndex = 0;
    var root = container.closest(".ll-popup-root");
    var eyebrow = root && root.querySelector(".ll-popup-eyebrow");
    var headline = root && root.querySelector(".ll-popup-headline");
    var subheadline = root && root.querySelector(".ll-popup-subheadline");
    var valueLine = root && root.querySelector(".ll-popup-value-line");
    renderStep(0);

    function renderStep(index) {
      currentIndex = Math.max(0, Math.min(index, steps.length - 1));
      var step = steps[currentIndex];
      applyFlowStepCopy(root, step, eyebrow, headline, subheadline, valueLine);
      var target = calculateFlowProteinTarget(answers);
      renderProteinTargetPreview(root, {showQuizStep:true,targetPreviewStyle:step.targetPreviewStyle || "off",targetPreviewLabel:step.targetPreviewLabel || "Your Daily Target:"}, target);
      container.innerHTML = [
        currentIndex > 0 && step.showBack !== false ? "<button type=\"button\" class=\"ll-popup-step-back\" aria-label=\"Previous step\">&#8592;</button>" : "",
        renderFlowProgressHtml(step, flowProgressPosition(steps, currentIndex, step.progressScope || "all").current, flowProgressPosition(steps, currentIndex, step.progressScope || "all").total),
        renderFlowStepForm(step)
      ].join("");
      var back = container.querySelector(".ll-popup-step-back");
      if (back) back.addEventListener("click", function () { renderStep(currentIndex - 1); });
      var form = container.querySelector("form");
      if (form) {
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          collectFlowStepAnswers(form, step, answers);
          if (currentIndex < steps.length - 1) {
            renderStep(currentIndex + 1);
            return;
          }
          submitFlowLead(step.type === "lead" ? form : null, answers);
        });
        form.querySelectorAll("[data-flow-answer]").forEach(function (button) {
          button.addEventListener("click", function () {
            var answerKey = flowAnswerKey(step);
            var input = form.elements[answerKey];
            if (input) input.value = button.dataset.value;
            answers[answerKey + "Range"] = button.textContent.trim();
            form.requestSubmit();
          });
        });
      }
      schedulePopupFit(root);
    }

    function renderFlowStepForm(step) {
      if (step.type === "message") return "<form class=\"ll-popup-zapier-form\" data-step=\"message\"><button type=\"submit\">" + escapeHtml(step.buttonText || (currentIndex < steps.length - 1 ? "Continue" : "Finish")) + "</button></form>";
      var content = "";
      if (step.type === "lead") {
        var fields = step.fields || [];
        if (fields.indexOf("name") >= 0) content += "<label><span>" + escapeHtml(step.firstNameLabel || "First name") + "</span><input name=\"name\" autocomplete=\"given-name\" placeholder=\"" + escapeHtmlAttr(step.firstNamePlaceholder || "First Name") + "\" required></label>";
        if (fields.indexOf("email") >= 0) content += "<label><span>" + escapeHtml(step.emailLabel || "Email") + "</span><input name=\"email\" type=\"email\" autocomplete=\"email\" placeholder=\"" + escapeHtmlAttr(step.emailPlaceholder || "Email") + "\" required></label>";
      } else if (step.type === "questions") {
        content = renderLegacyCombinedFields(step);
      } else {
        content = "<fieldset><legend>" + escapeHtml(step.questionLabel || step.name || "Your answer") + "</legend>" + renderFlowQuestionControl(step) + "</fieldset>";
      }
      var hideButton = step.type === "question" && step.answerStyle === "ranges" && step.autoAdvance !== false;
      return "<form class=\"ll-popup-zapier-form ll-popup-protein-form" + (step.type === "question" ? " ll-popup-multi-question" : "") + "\" data-step=\"" + escapeHtmlAttr(step.type) + "\">" + content + (hideButton ? "" : "<button type=\"submit\">" + escapeHtml(step.buttonText || "Continue") + "</button>") + "</form>";
    }

    function renderFlowQuestionControl(step) {
      var field = flowAnswerKey(step);
      var options = getFlowRuntimeOptions(step);
      if (step.answerStyle === "ranges") return "<input type=\"hidden\" name=\"" + escapeHtmlAttr(field) + "\"><div class=\"ll-popup-answer-grid\">" + options.ranges.map(function (option) { return "<button type=\"button\" data-flow-answer data-value=\"" + escapeHtmlAttr(option.value) + "\">" + escapeHtml(option.label) + "</button>"; }).join("") + "</div>";
      if (step.answerStyle === "dropdown") return "<select name=\"" + escapeHtmlAttr(field) + "\"" + (step.required === false ? "" : " required") + "><option value=\"\">" + escapeHtml(step.placeholder || "Select one") + "</option>" + options.dropdown.map(function (option) { return "<option value=\"" + escapeHtmlAttr(option.value) + "\">" + escapeHtml(option.label) + "</option>"; }).join("") + "</select>";
      var type = step.answerStyle === "number" ? "number" : "text";
      return "<input name=\"" + escapeHtmlAttr(field) + "\" type=\"" + type + "\" placeholder=\"" + escapeHtmlAttr(step.placeholder || "") + "\"" + (step.required === false ? "" : " required") + ">";
    }

    function renderLegacyCombinedFields(step) {
      return "<label><span>" + escapeHtml(step.targetWeightLabel || "Target weight in lbs") + "</span><input name=\"targetWeight\" type=\"number\" min=\"80\" max=\"350\" placeholder=\"" + escapeHtmlAttr(step.targetWeightPlaceholder || "155") + "\" required></label><label><span>" + escapeHtml(step.strengthDaysLabel || "Strength training days per week") + "</span><select name=\"strengthDays\" required><option value=\"\">" + escapeHtml(step.strengthDaysPlaceholder || "Select days") + "</option>" + getMultiQuestionOptions("strengthDays").dropdown.map(function (option) { return "<option value=\"" + option.value + "\">" + option.label + "</option>"; }).join("") + "</select></label><label><span>" + escapeHtml(step.ageLabel || "Age") + "</span><input name=\"age\" type=\"number\" min=\"18\" max=\"100\" placeholder=\"" + escapeHtmlAttr(step.agePlaceholder || "48") + "\" required></label>";
    }

    function collectFlowStepAnswers(form, step, target) {
      if (step.type === "lead") { target.name = getFormValue(form, "name"); target.email = getFormValue(form, "email"); return; }
      if (step.type === "questions") { target.targetWeight = getFormValue(form, "targetWeight"); target.strengthDays = getFormValue(form, "strengthDays"); target.age = getFormValue(form, "age"); trackEvent("popup_quiz_submit", getProteinTrackingFields(target)); return; }
      var answerKey = flowAnswerKey(step);
      target[answerKey] = getFormValue(form, answerKey);
      var remainingQuestions = steps.slice(currentIndex + 1).some(function (item) { return item.type === "question" || item.type === "questions"; });
      if (!remainingQuestions) trackEvent("popup_quiz_submit", getProteinTrackingFields(target));
    }

    function submitFlowLead(form, data) {
      if (form) collectFlowStepAnswers(form, {type:"lead"}, data);
      var proteinTarget = calculateFlowProteinTarget(data);
      var payload = buildProteinLeadPayload(data, proteinTarget);
      sendLeadPayload(config.leadWebhookUrl, payload);
      if (steps.some(function (step) { return step.type === "lead"; })) trackEvent("popup_lead_submit", getProteinTrackingFields(payload));
      setCooldown(config.cooldownDaysAfterSubmitAttempt || 90);
      redirectToProteinPlan(payload);
    }

    function buildProteinLeadPayload(data, target) {
      var payload = {name:data.name || "",email:data.email || "",targetWeightLbs:data.targetWeight || "",TargetWeight:data.targetWeight || "",age:data.age || "",Age:data.age || "",strengthDays:data.strengthDays || "",StrengthDays:data.strengthDays || "",targetWeightRange:data.targetWeightRange || "",TargetWeightRange:data.targetWeightRange || "",ageRange:data.ageRange || "",AgeRange:data.ageRange || "",strengthDaysRange:data.strengthDaysRange || "",StrengthDaysRange:data.strengthDaysRange || "",customAnswers:JSON.stringify(data),proteinTargetRange:target && target.rangeText || "",ProteinTargetRange:target && target.rangeText || "",proteinDailyGoalGrams:target && target.dailyGoalGrams || "",ProteinDailyGoalGrams:target && target.dailyGoalGrams || "",source:"protein_popup",ctaVariant:"show_my_protein_plan",popupVariant:variant.id};
      Object.keys(data || {}).forEach(function (key) {
        if (payload[key] === undefined) payload[key] = data[key];
      });
      return payload;
    }
  }

  function applyFlowStepCopy(root, step, eyebrow, headline, subheadline, valueLine) {
    if (eyebrow) { eyebrow.innerHTML = sanitizeRichHtml(step.eyebrowHtml || ""); eyebrow.hidden = !step.eyebrowHtml; }
    if (headline) headline.innerHTML = sanitizeRichHtml(step.headlineHtml || "");
    if (subheadline) { subheadline.innerHTML = sanitizeRichHtml(step.subheadlineHtml || ""); subheadline.hidden = !step.subheadlineHtml; }
    setPopupValueLine(valueLine, step.valueLineHtml || "");
    if (root) {
      root.style.setProperty("--ll-popup-bg", step.backgroundColor || variant.backgroundColor || "#ffffff");
      root.style.setProperty("--ll-popup-button-bg", step.buttonColor || variant.accentColor || "#1f6feb");
      root.style.setProperty("--ll-popup-accent", step.progressColor || variant.brandAccentColor || "#06b00b");
      root.style.setProperty("--ll-popup-eyebrow-color", step.eyebrowColor || variant.eyebrowColor || "#6b7280");
      setOptionalPixelVariable(root, "--ll-popup-headline-size", step.headlineFontSize || variant.headlineFontSize, 18, 72);
      setOptionalPixelVariable(root, "--ll-popup-eyebrow-size", step.eyebrowFontSize || 15, 10, 28);
      setOptionalPixelVariable(root, "--ll-popup-subheadline-size", step.subheadlineFontSize || variant.subheadlineFontSize, 12, 36);
      setOptionalPixelVariable(root, "--ll-popup-value-line-size", step.valueLineFontSize || variant.valueLineFontSize, 11, 32);
      setOptionalPixelVariable(root, "--ll-popup-button-size", step.buttonFontSize || variant.buttonFontSize, 12, 28);
      setOptionalPixelVariable(root, "--ll-popup-choice-font-size", step.choiceButtonFontSize || 16, 12, 28);
      root.style.setProperty("--ll-popup-choice-columns", step.answerLayout === "stacked" ? "1" : "2");
      root.style.setProperty("--ll-popup-choice-transform", step.choiceButtonTransform === "uppercase" ? "uppercase" : "none");
      root.style.setProperty("--ll-popup-question-weight", String(step.questionFontWeight || variant.bodyFontWeight || 400));
      root.style.setProperty("--ll-popup-choice-weight", String(step.choiceButtonFontWeight || variant.buttonFontWeight || 700));
    }
    var image = root && root.querySelector(".ll-popup-image");
    if (image) { image.hidden = !step.imageUrl; if (step.imageUrl) image.src = step.imageUrl; }
  }

  function renderFlowProgressHtml(step, current, total) {
    if (!step.progressEnabled) return "";
    var label = String(step.progressLabel || "Step {current} of {total}").replace(/\{current\}/g, current).replace(/\{total\}/g, total);
    var percent = Math.round((current / total) * 100);
    return "<div class=\"ll-popup-progress\"><div class=\"ll-popup-progress-top\"><span>" + escapeHtml(label) + "</span><strong>" + current + "/" + total + "</strong></div><div class=\"ll-popup-progress-track\" role=\"progressbar\" aria-valuemin=\"1\" aria-valuemax=\"" + total + "\" aria-valuenow=\"" + current + "\"><span style=\"width:" + percent + "%\"></span></div>" + (step.progressText ? "<p>" + escapeHtml(step.progressText) + "</p>" : "") + "</div>";
  }

  function calculateFlowProteinTarget(answers) {
    if (!answers.targetWeight || !answers.age || answers.strengthDays === undefined || answers.strengthDays === "") return null;
    return calculateProteinTarget(answers.targetWeight, answers.age, answers.strengthDays);
  }

  function flowProgressPosition(steps, index, scope) {
    if (scope !== "questions") return { current: index + 1, total: Math.max(1, steps.length) };
    var questionIndexes = [];
    steps.forEach(function (step, stepIndex) { if (step.type === "question" || step.type === "questions") questionIndexes.push(stepIndex); });
    var position = questionIndexes.indexOf(index);
    return { current: position >= 0 ? position + 1 : Math.max(1, questionIndexes.length), total: Math.max(1, questionIndexes.length) };
  }

  function getFlowRuntimeOptions(step) {
    if (!step.optionsText && step.field !== "custom") return getMultiQuestionOptions(step.field);
    var defaultOptions = step.field === "custom" ? "Yes|yes\nNo|no" : getMultiQuestionOptions(step.field).ranges.map(function (option) { return option.label + "|" + option.value; }).join("\n");
    var lines = String(step.optionsText || defaultOptions).split(/\n/).filter(Boolean).map(function (line) {
      var parts = line.split("|");
      return { label: parts[0].trim(), value: (parts[1] || parts[0]).trim() };
    });
    return { dropdown: lines, ranges: lines };
  }

  function getFormValue(form, name) {
    return form && form.elements && form.elements[name] ? form.elements[name].value : "";
  }

  function flowAnswerKey(step) {
    if (step && step.field !== "custom") return step.field || "customAnswer";
    var key = String(step && step.answerKey || "customAnswer").trim().replace(/[^A-Za-z0-9_]/g, "_");
    if (!key) key = "customAnswer";
    if (/^[0-9]/.test(key)) key = "answer_" + key;
    return key;
  }

  function setPopupValueLine(element, text) {
    if (!element) return;
    element.innerHTML = sanitizeRichHtml(text || "");
    element.hidden = !text;
  }

  function setPopupTextSizeVariables(root, activeVariant) {
    if (!root || !activeVariant) return;
    var quiz = getProteinQuizConfig(activeVariant);
    setOptionalPixelVariable(root, "--ll-popup-headline-size", activeVariant.headlineFontSize, 18, 72);
    setOptionalPixelVariable(root, "--ll-popup-subheadline-size", activeVariant.subheadlineFontSize, 12, 36);
    setOptionalPixelVariable(root, "--ll-popup-value-line-size", activeVariant.valueLineFontSize, 11, 32);
    setOptionalPixelVariable(root, "--ll-popup-button-size", activeVariant.buttonFontSize, 12, 28);
    setOptionalPixelVariable(root, "--ll-popup-progress-label-size", quiz.progressSingleStepLabelFontSize, 9, 28);
  }

  function setOptionalPixelVariable(root, name, value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return;
    root.style.setProperty(name, clampNumber(number, min, max) + "px");
  }

  function getProteinQuizConfig(activeVariant) {
    return Object.assign({
      targetWeightLabel: "Target weight in lbs",
      targetWeightPlaceholder: "155",
      strengthDaysLabel: "Strength training days",
      strengthDaysPlaceholder: "Select days",
      ageLabel: "Age",
      agePlaceholder: "48",
      multiStepEnabled: false,
      targetWeightAnswerStyle: "dropdown",
      strengthDaysAnswerStyle: "dropdown",
      ageAnswerStyle: "dropdown",
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
    }, config.proteinQuiz || {}, activeVariant && activeVariant.proteinQuiz || {});
  }

  function renderProteinTargetPreview(root, proteinQuiz, target) {
    if (!root) return;

    var copy = root.querySelector(".ll-popup-copy");
    var existing = copy && copy.querySelector(".ll-popup-target-preview");
    if (existing) existing.remove();
    if (!copy || !target || !proteinQuiz || proteinQuiz.showQuizStep === false || proteinQuiz.targetPreviewStyle === "off") return;

    var headline = copy.querySelector(".ll-popup-headline");
    var preview = document.createElement("div");
    preview.className = "ll-popup-target-preview ll-popup-target-preview-" + (proteinQuiz.targetPreviewStyle === "box" ? "box" : "inline");
    preview.innerHTML = [
      "<span>" + escapeHtml(proteinQuiz.targetPreviewLabel || "Your Daily Target:") + "</span>",
      "<strong>" + escapeHtml(target.dailyGoalGrams + "g/day") + "</strong>",
      "<small>Recommended range: " + escapeHtml(target.rangeText) + "</small>"
    ].join("");

    if (headline) {
      copy.insertBefore(preview, headline);
    } else {
      copy.insertBefore(preview, copy.firstChild);
    }
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

  function renderProteinProgressHtml(proteinQuiz, step, singleStep) {
    if (!proteinQuiz || !proteinQuiz.progressEnabled) return "";

    var label = singleStep ? (proteinQuiz.progressSingleStepLabel || "Step 1") : (step === 2 ? proteinQuiz.progressStepTwoLabel : proteinQuiz.progressStepOneLabel);
    var text = singleStep ? "" : (step === 2 ? proteinQuiz.progressStepTwoText : proteinQuiz.progressStepOneText);
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

  function renderMultiProgressHtml(proteinQuiz, step, total) {
    if (!proteinQuiz || !proteinQuiz.progressEnabled) return "";
    var percent = Math.round((step / total) * 100);
    return "<div class=\"ll-popup-progress ll-popup-progress-multi\" aria-label=\"Question " + step + " of " + total + "\"><div class=\"ll-popup-progress-top\"><span>Question " + step + " of " + total + "</span><strong>" + step + "/" + total + "</strong></div><div class=\"ll-popup-progress-track\" role=\"progressbar\" aria-valuemin=\"1\" aria-valuemax=\"" + total + "\" aria-valuenow=\"" + step + "\"><span style=\"width:" + percent + "%\"></span></div></div>";
  }

  function renderMultiQuestionControl(question, quiz) {
    var style = quiz[question.styleKey] || "dropdown";
    var options = getMultiQuestionOptions(question.key);
    if (style === "ranges") {
      return "<input type=\"hidden\" name=\"" + question.key + "\"><div class=\"ll-popup-answer-grid\">" + options.ranges.map(function (option) {
        return "<button type=\"button\" data-auto-answer data-value=\"" + escapeHtmlAttr(option.value) + "\">" + escapeHtml(option.label) + "</button>";
      }).join("") + "</div>";
    }
    return "<select name=\"" + question.key + "\" required><option value=\"\">" + escapeHtml(quiz[question.placeholderKey]) + "</option>" + options.dropdown.map(function (option) {
      return "<option value=\"" + option.value + "\">" + escapeHtml(option.label) + "</option>";
    }).join("") + "</select>";
  }

  function getMultiQuestionOptions(key) {
    var values = [];
    var ranges = [];
    var i;
    if (key === "strengthDays") {
      for (i = 0; i <= 7; i += 1) values.push({ value: String(i), label: i + (i === 1 ? " day" : " days") });
      ranges = [{value:"0",label:"0 days"},{value:"1",label:"1 day"},{value:"2",label:"2 days"},{value:"3",label:"3 days"},{value:"4",label:"4 days"},{value:"5",label:"5 days"},{value:"6",label:"6 days"},{value:"7",label:"7 days"}];
    } else if (key === "age") {
      for (i = 18; i <= 100; i += 1) values.push({ value: String(i), label: String(i) });
      ranges = [{value:"24",label:"18-29"},{value:"35",label:"30-39"},{value:"45",label:"40-49"},{value:"55",label:"50-59"},{value:"65",label:"60-69"},{value:"75",label:"70+"}];
    } else {
      for (i = 80; i <= 350; i += 5) values.push({ value: String(i), label: i + " lbs" });
      ranges = [{value:"110",label:"Under 120 lbs"},{value:"130",label:"120-139 lbs"},{value:"150",label:"140-159 lbs"},{value:"170",label:"160-179 lbs"},{value:"190",label:"180-199 lbs"},{value:"220",label:"200-239 lbs"},{value:"260",label:"240+ lbs"}];
    }
    return { dropdown: values, ranges: ranges };
  }

  function redirectToProteinPlan(payload) {
    var baseUrl = config.proteinPlanUrl || "/protein-plan";
    var url;
    try {
      url = new URL(baseUrl, window.location.href);
    } catch (error) {
      url = new URL("/protein-plan", window.location.href);
    }

    url.searchParams.set("FirstName", payload.name || "");
    url.searchParams.set("TargetWeight", payload.targetWeightLbs || "");
    url.searchParams.set("Age", payload.age || "");
    url.searchParams.set("StrengthDays", payload.strengthDays || "");
    if (payload.proteinTargetRange || payload.ProteinTargetRange) url.searchParams.set("ProteinTargetRange", payload.proteinTargetRange || payload.ProteinTargetRange);
    if (payload.proteinDailyGoalGrams || payload.ProteinDailyGoalGrams) url.searchParams.set("ProteinDailyGoalGrams", payload.proteinDailyGoalGrams || payload.ProteinDailyGoalGrams);

    window.setTimeout(function () {
      window.location.href = url.toString();
    }, 250);
  }

  function getProteinTrackingFields(payload) {
    return {
      targetWeightLbs: payload.targetWeightLbs || payload.targetWeight || "",
      TargetWeight: payload.TargetWeight || payload.targetWeightLbs || payload.targetWeight || "",
      age: payload.age || payload.Age || "",
      Age: payload.Age || payload.age || "",
      strengthDays: payload.strengthDays || payload.StrengthDays || "",
      StrengthDays: payload.StrengthDays || payload.strengthDays || "",
      targetWeightRange: payload.targetWeightRange || payload.TargetWeightRange || "",
      TargetWeightRange: payload.TargetWeightRange || payload.targetWeightRange || "",
      ageRange: payload.ageRange || payload.AgeRange || "",
      AgeRange: payload.AgeRange || payload.ageRange || "",
      strengthDaysRange: payload.strengthDaysRange || payload.StrengthDaysRange || "",
      StrengthDaysRange: payload.StrengthDaysRange || payload.strengthDaysRange || "",
      proteinTargetRange: payload.proteinTargetRange || payload.ProteinTargetRange || "",
      ProteinTargetRange: payload.ProteinTargetRange || payload.proteinTargetRange || "",
      proteinDailyGoalGrams: payload.proteinDailyGoalGrams || payload.ProteinDailyGoalGrams || "",
      ProteinDailyGoalGrams: payload.ProteinDailyGoalGrams || payload.proteinDailyGoalGrams || "",
      source: payload.source || "protein_popup",
      ctaVariant: payload.ctaVariant || "show_my_protein_plan",
      popupVariant: payload.popupVariant || variant.id
    };
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

    container.addEventListener("submit", function (event) {
      submitAttempt(event.target);
    }, true);

    container.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("button[type='submit'], input[type='submit'], .form-btn")) {
        submitAttempt(target.closest("form"));
      }
    }, true);

    function submitAttempt(form) {
      if (form && ["quiz", "question", "questions"].indexOf(form.getAttribute("data-step")) >= 0) return;
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

  function trackEvent(eventType, extraFields) {
    if (!config.webhookUrl) return;

    var payload = buildPayload(eventType, extraFields);
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
    Object.keys(payload || {}).forEach(function (key) {
      body.set(key, payload[key] == null ? "" : String(payload[key]));
    });

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

  function buildPayload(eventType, extraFields) {
    var params = new URLSearchParams(window.location.search);
    return Object.assign({
      timestamp: new Date().toISOString(),
      testId: config.testId || "",
      configVersion: variant.trackingVersion || config.configVersion || "v1",
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
    }, extraFields || {});
  }

  function getVariantSnapshot() {
    return JSON.stringify({
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
      headlineFontWeight: variant.headlineFontWeight || 700,
      bodyFontWeight: variant.bodyFontWeight || 400,
      buttonFontWeight: variant.buttonFontWeight || 700,
      textAlign: variant.textAlign || "",
      trafficSplit: variant.trafficSplit || "",
      reminderEnabled: variant.reminderEnabled !== false,
      reminderText: variant.reminderText || "Free Protein Plan",
      reminderColor: variant.reminderColor || variant.accentColor || "#06b00b",
      reopenAfterCloseSeconds: variantReopenSeconds(),
      proteinQuiz: cloneConfig(variant.proteinQuiz || {}),
      flowSteps: cloneConfig(variant.flowSteps || [])
    });
  }

  function getVariantLabel() {
    var quiz = getProteinQuizConfig(variant);
    var flowCount = Array.isArray(variant.flowSteps) ? variant.flowSteps.filter(function (step) { return step.enabled !== false; }).length : 0;
    return [
      "Flow: " + (flowCount ? flowCount + "-step custom flow" : (quiz.showQuizStep === false ? "Single-step" : "Quiz + form")),
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
    ].filter(Boolean).join(" | ");
  }

  function cloneConfig(value) {
    return JSON.parse(JSON.stringify(value || {}));
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
