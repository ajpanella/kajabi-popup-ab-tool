(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../vendor/jstat-1.9.6.min.js").jStat);
  else root.LLExperiment = factory(root.jStat);
})(typeof window !== "undefined" ? window : this, function (stats) {
  "use strict";
  var POLICY = { checkpoints: [700, 1400, 2800], minDays: 7, maxDays: 28, alpha: 0.05, minRelativeLift: 0.1, minAbsoluteLift: 0.001 };
  var META = ["id", "name", "active", "trafficSplit", "trackingVersion", "trackingStartedAt", "trackingLabel", "trackingLabelManual", "trackingFingerprint", "trackingSources"];
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (out, key) {
      if (META.indexOf(key) < 0) out[key] = canonical(value[key]);
      return out;
    }, {});
  }
  function fingerprint(variant) { return JSON.stringify(canonical(Object.assign({ eyebrowColor: "#6b7280" }, variant))); }
  function differences(a, b, path) {
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return [path];
    return Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).reduce(function (out, key) {
      return out.concat(differences(a[key], b[key], path ? path + "." + key : key));
    }, []);
  }
  function changedFields(a, b) { return differences(canonical(a), canonical(b), ""); }
  function environment(config) {
    return JSON.stringify(canonical({ triggers: config.triggers, campaignEnabled: config.campaignEnabled,
      leadMagnetMode: config.leadMagnetMode, formMode: config.formMode, webhookUrl: config.webhookUrl,
      leadWebhookUrl: config.leadWebhookUrl, proteinPlanUrl: config.proteinPlanUrl,
      cooldownDaysAfterClose: config.cooldownDaysAfterClose, cooldownDaysAfterSubmitAttempt: config.cooldownDaysAfterSubmitAttempt,
      assignmentDays: config.assignmentDays, reopenAfterCloseSeconds: config.reopenAfterCloseSeconds }));
  }
  function allowedField(variable, field) {
    if (variable === "headline") return /(^|\.)(headline|headlineHtml|leadHeadline)$/.test(field);
    if (variable === "image") return /(^|\.)(imageUrl|imageAlt)$/.test(field);
    if (variable === "cta") return /(^|\.)(buttonText|leadButtonText)$/.test(field);
    if (variable === "repeat") return field === "reopenAfterCloseSeconds";
    return false;
  }
  function validateRound(config) {
    var round = config.experiment;
    if (!round || round.mode !== "assisted") return "Assisted monitoring is not enabled.";
    if (JSON.stringify(round.policy) !== JSON.stringify(POLICY)) return "Decision rules changed during this round. Start a new round.";
    if (round.environment !== environment(config)) return "Delivery settings changed during this round. Start a new round.";
    var active = config.variants.filter(function (v) { return v.active !== false; });
    if (active.length !== 3 || !active.some(function (v) { return v.id === round.controlId; })) return "A round requires three active variants and its original control.";
    if (active.reduce(function (sum, v) { return sum + Number(v.trafficSplit); }, 0) !== 100) return "Traffic shares must total 100%.";
    for (var i = 0; i < active.length; i++) {
      var arm = (round.arms || []).find(function (a) { return a.id === active[i].id; });
      if (!arm || arm.version !== active[i].trackingVersion || arm.fingerprint !== fingerprint(active[i]) || arm.trafficSplit !== active[i].trafficSplit) return "The live configuration changed during this round. Start a new round before comparing results.";
    }
    return "";
  }
  function createRound(config, controlId, variable, hypothesis, now, queueId) {
    var active = config.variants.filter(function (v) { return v.active !== false; });
    var control = active.find(function (v) { return v.id === controlId; });
    if (!control || active.length !== 3) throw new Error("Choose a control from three active variants.");
    active.filter(function (v) { return v !== control; }).forEach(function (v) {
      var fields = changedFields(control, v);
      if (!fields.length || fields.some(function (field) { return !allowedField(variable, field); })) throw new Error("This round must change only " + variable + " in both challengers.");
    });
    return { id: "protein-round-" + now.replace(/[^0-9]/g, ""), mode: "assisted", variable: variable,
      hypothesis: hypothesis, queueId: queueId || "", controlId: controlId, startedAt: now, policy: clone(POLICY), environment: environment(config),
      arms: active.map(function (v) { return { id: v.id, version: v.trackingVersion, label: v.trackingLabel || v.name,
        trafficSplit: v.trafficSplit, fingerprint: fingerprint(v), snapshot: clone(v) }; }) };
  }
  function interval(successes, trials, alpha) {
    if (!trials) return [0, 1];
    return [successes === 0 ? 0 : stats.beta.inv(alpha / 2, successes, trials - successes + 1),
      successes === trials ? 1 : stats.beta.inv(1 - alpha / 2, successes + 1, trials - successes)];
  }
  function evaluate(config, summary, previous, now) {
    var round = config.experiment;
    var result = { schemaVersion: 1, roundId: round && round.id || "", checkedAt: now, status: "blocked", reason: "", metrics: [], looks: [] };
    result.looks = previous && previous.roundId === result.roundId ? clone(previous.looks || []) : [];
    result.reason = validateRound(config);
    if (result.reason) return result;
    if (!summary || summary.schemaVersion !== 4 || summary.testId !== config.testId || summary.roundId !== round.id || !Array.isArray(summary.groups)) {
      result.reason = "The tracker needs its one-time round-summary update."; return result;
    }
    if (!Number.isFinite(Date.parse(summary.generatedAt)) || Math.abs(Date.parse(now) - Date.parse(summary.generatedAt)) > 3600000) {
      result.reason = "Tracking summary is stale. No decision was made."; return result;
    }
    var policy = round.policy;
    result.looks = previous && previous.roundId === round.id ? clone(previous.looks || []) : [];
    for (var i = 0; i < round.arms.length; i++) {
      var arm = round.arms[i];
      var group = summary.groups.find(function (g) { return g.variant === arm.id && g.version === arm.version; });
      if (!group) { result.reason = "Waiting for round tracking from all three variants."; return result; }
      var counts = [group.sessions, group.leads, group.eligible, group.settledSessions, group.settledLeads, group.settledEligible];
      if (counts.some(function (n) { return !Number.isSafeInteger(n) || n < 0; }) || group.settledLeads > group.settledSessions || group.settledLeads > group.leads || group.leads > group.sessions || group.settledSessions > group.sessions || group.settledSessions > group.settledEligible || group.settledEligible > group.eligible || group.sessions > group.eligible) {
        result.reason = "Round counts failed validation. No decision was made."; return result;
      }
      result.metrics.push(Object.assign({ id: arm.id, label: arm.label, cvr: group.sessions ? group.leads / group.sessions : 0 }, group));
    }
    if (summary.groups.some(function (g) { return !round.arms.some(function (a) { return a.id === g.variant && a.version === g.version; }); })) {
      result.reason = "Unexpected versions are reporting into this round."; return result;
    }
    var first = Math.min.apply(null, summary.groups.map(function (g) { return Date.parse(g.firstSeen); }));
    if (!Number.isFinite(first) || first < Date.parse(round.startedAt) - 60000) { result.reason = "Round start could not be verified."; return result; }
    result.days = Math.max(0, (Date.parse(now) - first) / 86400000);
    var total = result.metrics.reduce(function (sum, m) { return sum + m.eligible; }, 0);
    var chi = result.metrics.reduce(function (sum, m) {
      var expected = total * round.arms.find(function (a) { return a.id === m.id; }).trafficSplit / 100;
      return sum + (expected ? Math.pow(m.eligible - expected, 2) / expected : 0);
    }, 0);
    if (total >= 300 && 1 - stats.chisquare.cdf(chi, 2) < 0.001) { result.reason = "Traffic allocation is unexpectedly uneven. Check assignment and tracking before proceeding."; return result; }
    var priorWinner = result.looks.find(function (look) { return look.winnerId; });
    if (priorWinner) { result.status = "winner-review"; result.winnerId = priorWinner.winnerId; result.reason = "A winner is ready for your review. Nothing publishes automatically."; return result; }
    var minimum = Math.min.apply(null, result.metrics.map(function (m) { return m.settledSessions; }));
    var next = policy.checkpoints.find(function (threshold) { return !result.looks.some(function (l) { return l.threshold === threshold; }); });
    result.nextCheckpoint = next || null;
    result.status = "collecting";
    result.reason = "Collecting settled sessions for the next review.";
    if (result.days >= policy.minDays && next && minimum >= next) {
      // Exact binomial bounds with Bonferroni correction across three arms and three fixed looks.
      var alpha = policy.alpha / (round.arms.length * policy.checkpoints.length);
      var measurements = result.metrics.map(function (m) { return { id: m.id, sessions: m.settledSessions, leads: m.settledLeads,
        rate: m.settledLeads / m.settledSessions, interval: interval(m.settledLeads, m.settledSessions, alpha) }; });
      var ranked = measurements.slice().sort(function (a, b) { return b.rate - a.rate; });
      var best = ranked[0];
      var wins = ranked.slice(1).every(function (other) { return best.interval[0] > other.interval[1]
        && best.rate - other.rate >= policy.minAbsoluteLift && best.rate >= other.rate * (1 + policy.minRelativeLift); });
      result.looks.push({ threshold: next, capturedAt: now, measurements: measurements, winnerId: wins ? best.id : null });
      if (wins) { result.status = "winner-review"; result.winnerId = best.id; result.reason = "A winner is ready for your review. Nothing publishes automatically."; }
      else { result.status = "continue"; result.reason = "No clear winner at this checkpoint. Keep the current control."; }
      // Consume only one look per observation, never repeatedly retest the same data.
      policy.checkpoints.filter(function (n) { return n > next && n <= minimum; }).forEach(function (n) {
        result.looks.push({ threshold: n, capturedAt: now, skipped: true, reason: "Already passed when the earlier checkpoint was captured." });
      });
    }
    if (result.status !== "winner-review" && (result.days >= policy.maxDays || result.looks.length === policy.checkpoints.length)) {
      result.status = "inconclusive"; result.reason = "Round finished without a clear winner. Retain the control and review the next test.";
    }
    return result;
  }
  function duplicateStatus(candidate, records) {
    var exact = (records || []).filter(function (record) { return fingerprint(record.snapshot || record) === fingerprint(candidate); });
    return { exact: exact.length > 0, matches: exact };
  }
  function prepareDraft(config, controlId, item, records) {
    if (!item || item.approvalRequired || !Array.isArray(item.values) || item.values.length !== 2) throw new Error("This idea needs assets or a design review before drafts can be prepared.");
    if ((config.experimentLog || []).some(function (log) { return log.queueId === item.id || log.nextQueueId === item.id; }) || config.experiment && config.experiment.queueId === item.id) throw new Error("This experiment concept was already scheduled. A repeat requires an explicit review.");
    var control = config.variants.find(function (v) { return v.id === controlId; });
    if (!control) throw new Error("Control is missing.");
    var output = clone(config);
    var slots = ["A", "B", "C"];
    output.variants = slots.map(function (slot, index) {
      var v = clone(control); v.id = slot; v.trafficSplit = index === 0 ? 34 : 33;
      if (!index) {
        if (control.id !== "A") v.trackingSources = (v.trackingSources || []).concat([{ variant: control.id, configVersion: control.trackingVersion }]);
        return v;
      }
      var value = item.values[index - 1];
      if (item.variable === "headline") {
        v.headline = value; v.headlineHtml = value;
        if (v.proteinQuiz) v.proteinQuiz.leadHeadline = value;
        if (v.flowSteps && v.flowSteps[0]) v.flowSteps[0].headlineHtml = value;
      } else if (item.variable === "cta") {
        v.buttonText = value;
        if (v.proteinQuiz) v.proteinQuiz.leadButtonText = value;
        (v.flowSteps || []).filter(function (step) { return step.type === "lead"; }).forEach(function (step) { step.buttonText = value; });
      } else if (item.variable === "repeat") v.reopenAfterCloseSeconds = value;
      else throw new Error("This variable needs a design review first.");
      if (duplicateStatus(v, (records || []).concat(config.variants)).exact) throw new Error("An identical treatment is already live or archived. Choose a different idea.");
      var fields = changedFields(control, v);
      if (!fields.length || fields.some(function (field) { return !allowedField(item.variable, field); })) throw new Error("The draft changed more than one variable.");
      v.name = item.labels[index - 1]; v.trackingLabel = v.name; v.trackingLabelManual = true;
      delete v.trackingVersion; delete v.trackingStartedAt; delete v.trackingFingerprint; v.trackingSources = [];
      return v;
    });
    delete output.experiment;
    output.experimentDraft = { sourceRoundId: config.experiment && config.experiment.id || "", sourceControlId: control.id,
      controlFingerprint: fingerprint(control), variable: item.variable, hypothesis: item.hypothesis, queueId: item.id };
    return output;
  }
  return { POLICY: POLICY, clone: clone, fingerprint: fingerprint, changedFields: changedFields, validateRound: validateRound,
    createRound: createRound, evaluate: evaluate, interval: interval, duplicateStatus: duplicateStatus, prepareDraft: prepareDraft };
});
