import test from "node:test";
import assert from "node:assert/strict";
import { calendarStage, estimateCycle } from "../src/lib/cycle-estimate.ts";
import { layoutLabelText, labelTopics } from "../src/lib/label-layout.ts";
import { groupLabelQuotes } from "../src/lib/label-quotes.ts";

test("identical label quotes display once and retain every distinct label and query", () => {
  const first = { id: "a", symptom_group_id: "headache", exact_phrase: "headache", label_id: "label-a", label_effective_time: "20261001", source_url: "https://example.test/labels" };
  const second = { ...first, id: "b", label_id: "label-b", label_effective_time: "20260901" };
  const anotherQuery = { ...first, id: "c", source_url: "https://example.test/other-labels" };
  const quotes = groupLabelQuotes([first, second, { ...first, id: "duplicate" }, anotherQuery]);
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].phrase, "headache");
  assert.deepEqual(quotes[0].sources, [first, second, anotherQuery]);
});

test("display grouping preserves different source wording, qualifiers, casing and symptom categories", () => {
  const source = { id: "a", symptom_group_id: "nausea", exact_phrase: "Nausea", label_id: "unavailable-label", label_effective_time: null, source_url: "https://example.test/labels" };
  const inputs = [source, { ...source, id: "b", exact_phrase: "nausea and vomiting" }, { ...source, id: "c", exact_phrase: "nausea" }, { ...source, id: "d", symptom_group_id: "other" }];
  assert.deepEqual(groupLabelQuotes(inputs).map(quote => [quote.groupId, quote.phrase, quote.sources]), inputs.map(item => [item.symptom_group_id, item.exact_phrase, [item]]));
  assert.deepEqual(groupLabelQuotes([]), []);
});

test("literal unnumbered label topics retain qualifiers and every source word", () => {
  const source = "WARNINGS Cardiovascular Effects Serious events may occur. Renal Effects The study does not establish individual risk. Pregnancy Ask a clinician.";
  const topics = labelTopics(source);
  assert.ok(topics.some(topic => topic.heading === "Renal Effects"));
  assert.equal(topics.map(topic => topic.text).join(" "), source);
  assert.equal(labelTopics("An unfamiliar safety paragraph.")[0].heading, null);
});

const periods = ["2026-07-01", "2026-07-29", "2026-08-26", "2026-09-23"].map(started_on => ({ started_on, ended_on: null }));
test("calendar estimates fail closed without context or sufficient history", () => {
  assert.deepEqual(estimateCycle("2026-10-03", periods, "unknown"), { status: "insufficient", reason: "context" });
  assert.equal(estimateCycle("2026-10-03", periods, "affected").status, "insufficient");
  assert.deepEqual(estimateCycle("2026-10-03", periods.slice(1), "natural"), { status: "insufficient", reason: "history" });
  assert.equal(estimateCycle("2026-02-30", periods, "natural").reason, "date");
});
test("calendar uses uncertainty ranges rather than a fixed ovulation day or fertility percentage", () => {
  const result = estimateCycle("2026-10-03", periods, "natural");
  assert.equal(result.status, "estimated");
  assert.deepEqual(result.ovulation, { from: "2026-10-05", to: "2026-10-11" });
  assert.deepEqual(result.nextBleeding, { from: "2026-10-21", to: "2026-10-21" });
  assert.deepEqual(result.possibleFertileWindow, { from: "2026-09-28", to: "2026-10-12" });
  assert.equal(calendarStage("2026-10-04", result), "follicular");
  assert.equal(calendarStage("2026-10-05", result), "uncertain");
  assert.equal(calendarStage("2026-10-11", result), "uncertain");
  assert.equal(calendarStage("2026-10-12", result), "luteal");
  assert.equal("risk" in result || "probability" in result || "hormoneLevel" in result, false);
});
test("variable, duplicate and overdue records suppress predictions; future records cannot backfill historical estimates", () => {
  assert.equal(estimateCycle("2026-10-21", periods, "natural").reason, "stale");
  assert.equal(estimateCycle("2026-09-03", periods, "natural").reason, "history");
  assert.equal(estimateCycle("2026-10-03", [...periods, periods[0]], "natural").reason, "history");
  const variable = ["2026-06-01", "2026-07-10", "2026-08-01", "2026-09-01"].map(started_on => ({ started_on, ended_on: null }));
  assert.equal(estimateCycle("2026-09-10", variable, "natural").reason, "variable");
  const reversed = [{ started_on: "2026-09-01", ended_on: "2026-08-31" }];
  assert.equal(estimateCycle("2026-09-10", reversed, "natural").reason, "date");
});
const normalise = text => text.replace(/\s+/g, " ").trim();
test("label presentation preserves all source text, qualifiers, order, decimals and bullets", () => {
  const text = "WARNINGS See BOXED WARNINGS. 1. Cardiovascular Disorders An increased risk has been reported with combined therapy (0.625 mg). This finding may not apply to all products. 2. Malignant Neoplasms In a study, observations differed.\n\n• First source bullet. • Second source bullet with a qualifier.";
  const fragments = layoutLabelText(text);
  assert.equal(normalise(fragments.map(item => item.text).join(" ")), normalise(text));
  assert.equal(fragments.find(item => item.heading === "1. Cardiovascular Disorders")?.text.includes("combined therapy"), true);
  assert.equal(fragments.find(item => item.heading === "2. Malignant Neoplasms")?.text.includes("observations differed"), true);
  assert.equal(fragments.some(item => item.text.includes("0.625 mg")), true);
});
test("long label fragments and unknown structures preserve content without inventing headings", () => {
  const text = "This is source wording with an important qualification. ".repeat(70);
  const fragments = layoutLabelText(text);
  assert.ok(fragments.length > 1);
  assert.equal(normalise(fragments.map(item => item.text).join(" ")), normalise(text));
  assert.ok(fragments.every(item => item.heading === null));
  assert.deepEqual(layoutLabelText("   "), []);
  const headed = layoutLabelText("1. Cardiovascular Disorders An observation from the source. " + "Another qualified observation. ".repeat(80));
  assert.ok(headed.every(item => item.heading === "1. Cardiovascular Disorders"));
  assert.equal(headed[1].continuation, true);
  const numberedSentence = "WARNINGS 1. Cardiovascular Disorders Observations ran through years 2 to 5. In another study, results varied. 2. Malignant Neoplasms A separate source topic follows.";
  const sections = layoutLabelText(numberedSentence);
  assert.equal(sections.length, 3);
  assert.equal(sections[1].text.includes("5. In another study"), true);
  assert.equal(normalise(sections.map(item => item.text).join(" ")), normalise(numberedSentence));
});
