import test from "node:test";
import assert from "node:assert/strict";
import { matchSymptomGroup, normalizeSymptomText } from "../src/lib/symptom-groups.ts";
import { createOpenRouterLabelClassifier, validateLabelPhrases } from "../src/lib/classification/openrouter.ts";
import { observedCycleDay, recordedCycleIntervals } from "../src/lib/cycle-context.ts";
import { CONTEXT_QUESTIONS, questionsForGroup } from "../src/lib/context-questions.ts";

test("Polish inflections and English wording share stable headache group", () => {
  assert.equal(normalizeSymptomText("BÓLE   GŁOWY!"), "bole glowy");
  for (const wording of ["ból głowy", "bóle głowy", "Bol glowy", "headaches"]) assert.equal(matchSymptomGroup(wording), "headache");
  assert.equal(matchSymptomGroup("zawroty głowy"), "dizziness");
  assert.equal(matchSymptomGroup("ból głowy i ból brzucha"), null);
  assert.equal(matchSymptomGroup("unfamiliar observation"), null);
});

test("label phrases must be exact source substrings and match the local vocabulary", () => {
  const source = "Adverse reactions: headache, nausea, and dizziness.";
  assert.deepEqual(validateLabelPhrases({ phrases: [{ groupId: "headache", exactPhrase: "headache" }, { groupId: "nausea", exactPhrase: "nausea" }] }, source), [
    { groupId: "headache", exactPhrase: "headache" }, { groupId: "nausea", exactPhrase: "nausea" },
  ]);
  assert.equal(validateLabelPhrases({ phrases: [{ groupId: "headache", exactPhrase: "migraine" }] }, source), null);
  assert.equal(validateLabelPhrases({ phrases: [{ groupId: "nausea", exactPhrase: "headache" }] }, source), null);
  assert.equal(validateLabelPhrases({ phrases: [{ groupId: "diagnosis", exactPhrase: "headache" }] }, source), null);
  assert.equal(validateLabelPhrases({ phrases: [{ groupId: "headache", exactPhrase: "headache", risk: "high" }] }, source), null);
  assert.deepEqual(validateLabelPhrases({ phrases: [{ groupId: "headache", exactPhrase: "headache" }, { groupId: "nausea", exactPhrase: "invented" }] }, source), [{ groupId: "headache", exactPhrase: "headache" }]);
});

test("OpenRouter classifier requests strict structured output and fails closed", async () => {
  let sent;
  const classifier = createOpenRouterLabelClassifier({ apiKey: "test-only", fetcher: async (_url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ phrases: [{ groupId: "headache", exactPhrase: "headache" }] }) } }] }), { status: 200 });
  } });
  assert.deepEqual(await classifier.classify("Adverse reactions: headache."), { status: "ok", phrases: [{ groupId: "headache", exactPhrase: "headache" }] });
  assert.equal(sent.model, "deepseek/deepseek-v4.1-flash");
  assert.equal(sent.provider.require_parameters, true);
  assert.equal(sent.response_format.type, "json_schema");
  assert.equal(sent.response_format.json_schema.strict, true);
  assert.equal(sent.reasoning.effort, "none");
  assert.equal(sent.messages[1].content, "Adverse reactions: headache.");
  assert.equal(sent.tools, undefined);
  const hallucinating = createOpenRouterLabelClassifier({ apiKey: "test-only", fetcher: async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ phrases: [{ groupId: "headache", exactPhrase: "migraine" }] }) } }] }), { status: 200 }) });
  assert.equal((await hallucinating.classify("Adverse reactions: headache.")).status, "unavailable");
  const unsupported = createOpenRouterLabelClassifier({ apiKey: "test-only", fetcher: async () => new Response("{}", { status: 400 }) });
  assert.equal((await unsupported.classify("Adverse reactions: headache.")).status, "unavailable");
});

test("cycle day uses observed starts and handles variable lengths without phase predictions", () => {
  const periods = [
    { started_on: "2026-08-01", ended_on: "2026-08-05" },
    { started_on: "2026-09-04", ended_on: "2026-09-08" },
    { started_on: "2026-10-01", ended_on: null },
  ];
  assert.deepEqual(observedCycleDay("2026-09-04", periods), { day: 1, startedOn: "2026-09-04", bleedingRecorded: true });
  assert.deepEqual(observedCycleDay("2026-10-01", periods), { day: 1, startedOn: "2026-10-01", bleedingRecorded: true });
  assert.deepEqual(observedCycleDay("2026-09-10", periods), { day: 7, startedOn: "2026-09-04", bleedingRecorded: false });
  assert.equal(observedCycleDay("2026-07-31", periods), null);
  assert.deepEqual(recordedCycleIntervals(periods).map((item) => item.days), [34, 27]);
  assert.equal(observedCycleDay("2027-02-01", periods), null);
});

test("context questions are fixed recording prompts, not a diagnostic output", () => {
  assert.deepEqual(questionsForGroup("headache"), ["water_less", "meals_changed", "sleep_changed", "stress_changed", "bleeding_present"]);
  for (const id of questionsForGroup(null)) assert.equal(typeof CONTEXT_QUESTIONS[id], "string");
  assert.equal(Object.keys(CONTEXT_QUESTIONS).some((id) => id.includes("diagnosis") || id.includes("rule_out")), false);
});
