import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiSymptomExtractor, readConfirmedDraft, validateCandidates, validateConfirmedCandidates } from "../src/lib/symptom-draft/openai.ts";

const candidate = { symptom: "Headache", severity: 3, onsetOn: "2026-10-03", note: "Lasted all evening" };

function modelResponse(candidates) {
  return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ candidates }) }] }] }), { status: 200 });
}

test("extractor sends only the user's statement and requests strict JSON without storage or tools", async () => {
  let request;
  const extract = createOpenAiSymptomExtractor({ apiKey: "test-only", fetcher: async (url, init) => {
    request = { url, init };
    return modelResponse([candidate]);
  } });
  const result = await extract("I had a headache on 2026-10-03, rated 3/5. It lasted all evening.");
  assert.deepEqual(result, { status: "ok", candidates: [candidate] });
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  const sent = JSON.parse(request.init.body);
  assert.equal(sent.input, "I had a headache on 2026-10-03, rated 3/5. It lasted all evening.");
  assert.equal(sent.store, false);
  assert.equal(sent.text.format.type, "json_schema");
  assert.equal(sent.text.format.strict, true);
  assert.equal(sent.tools, undefined);
  assert.equal(JSON.stringify(sent).includes("openFDA"), false);
  assert.equal(JSON.stringify(sent).includes("medicationId"), false);
});

test("model omissions remain missing and require user completion before saving", async () => {
  const incomplete = { symptom: "Nausea", severity: null, onsetOn: null, note: null };
  const extract = createOpenAiSymptomExtractor({ apiKey: "test-only", fetcher: async () => modelResponse([incomplete]) });
  assert.deepEqual(await extract("I felt nauseous"), { status: "ok", candidates: [incomplete] });
  assert.equal(validateConfirmedCandidates([incomplete]), null);
  assert.deepEqual(validateConfirmedCandidates([candidate]), [candidate]);
});

test("a draft cannot pass the save gate without explicit confirmation", () => {
  const data = new FormData();
  data.set("candidates", JSON.stringify([candidate]));
  assert.equal(readConfirmedDraft(data), null);
  data.set("confirmed", "on");
  assert.deepEqual(readConfirmedDraft(data), [candidate]);
  data.set("candidates", JSON.stringify([{ ...candidate, severity: null }]));
  assert.equal(readConfirmedDraft(data), null);
});

test("local validation rejects invented fields, bad dates, out-of-range severity, and excess candidates", () => {
  assert.equal(validateCandidates({ candidates: [{ ...candidate, diagnosis: "migraine" }] }), null);
  assert.equal(validateCandidates({ candidates: [{ ...candidate, onsetOn: "2026-02-30" }] }), null);
  assert.equal(validateCandidates({ candidates: [{ ...candidate, severity: 6 }] }), null);
  assert.equal(validateCandidates({ candidates: Array(6).fill(candidate) }), null);
  assert.equal(validateCandidates({ candidates: [{ symptom: "Headache", severity: 2, onsetOn: "2026-10-03" }] }), null);
});

test("unconfigured or invalid upstream responses produce no draft", async () => {
  let called = false;
  const noKey = createOpenAiSymptomExtractor({ fetcher: async () => { called = true; throw new Error("unexpected"); } });
  assert.equal((await noKey("Headache")).status, "unavailable");
  assert.equal(called, false);
  const malformed = createOpenAiSymptomExtractor({ apiKey: "test-only", fetcher: async () => modelResponse([{ ...candidate, medicalAdvice: "stop taking it" }]) });
  assert.equal((await malformed("Headache")).status, "invalid_response");
  const refused = createOpenAiSymptomExtractor({ apiKey: "test-only", fetcher: async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }), { status: 200 }) });
  assert.equal((await refused("Headache")).status, "invalid_response");
});
