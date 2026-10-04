import test from "node:test";
import assert from "node:assert/strict";
import { createOpenFdaAdapter, parseMedicationName } from "../src/lib/evidence/openfda.ts";

const labelBody = {
  meta: { last_updated: "2026-09-01", results: { total: 2 } },
  results: [{
    id: "label-1",
    set_id: "set-1",
    effective_time: "20260801",
    openfda: { brand_name: ["Advil"], generic_name: ["Ibuprofen"], product_type: ["HUMAN OTC DRUG"] },
    boxed_warning: ["Source boxed warning text"],
    warnings: ["Source warning text"],
    adverse_reactions: ["Source adverse reaction text"],
  }],
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function queuedFetch(responses) {
  const calls = [];
  const fetcher = async (input) => {
    calls.push(new URL(input));
    const next = responses.shift();
    assert.ok(next, "Unexpected upstream request");
    return next;
  };
  return { fetcher, calls };
}

test("validates medication names before they become openFDA search terms", () => {
  assert.equal(parseMedicationName("  Ibuprofen   200 "), "Ibuprofen 200");
  assert.equal(parseMedicationName('ibuprofen" OR serious:1'), null);
  assert.equal(parseMedicationName(""), null);
});

test("adapter rejects unsafe names without calling openFDA", async () => {
  const { fetcher, calls } = queuedFetch([]);
  const result = await createOpenFdaAdapter({ fetcher }).lookupLabels('drug" OR serious:1');
  assert.equal(result.status, "invalid_request");
  assert.equal(result.data, null);
  assert.equal(calls.length, 0);
});

test("Drug Label projects source text, keeps the key private, and caches a successful lookup", async () => {
  const { fetcher, calls } = queuedFetch([jsonResponse(labelBody)]);
  const adapter = createOpenFdaAdapter({ apiKey: "test-key", fetcher });

  const first = await adapter.lookupLabels("Advil");
  assert.equal(first.status, "ok");
  assert.equal(first.cached, false);
  assert.equal(first.data.totalMatchingLabels, 2);
  assert.deepEqual(first.data.labels[0].warnings, ["Source warning text"]);
  assert.deepEqual(first.data.labels[0].adverseReactions, ["Source adverse reaction text"]);
  assert.equal(calls[0].searchParams.get("api_key"), "test-key");
  assert.match(calls[0].searchParams.get("search"), /openfda\.brand_name\.exact/);
  assert.equal(JSON.stringify(first).includes("test-key"), false);

  const second = await adapter.lookupLabels("Advil");
  assert.equal(second.status, "ok");
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
});

test("Drug Label returns not_found after name variants and expires negative cache", async () => {
  let clock = 0;
  const misses = Array.from({ length: 6 }, () => jsonResponse({ error: { code: "NOT_FOUND" } }, 404));
  const { fetcher, calls } = queuedFetch(misses);
  const adapter = createOpenFdaAdapter({ fetcher, now: () => clock, notFoundTtlMs: 1000 });

  const first = await adapter.lookupLabels("adVil");
  assert.equal(first.status, "not_found");
  assert.equal(first.data, null);
  assert.equal(calls.length, 3);
  assert.equal((await adapter.lookupLabels("adVil")).cached, true);
  assert.equal(calls.length, 3);
  clock = 1001;
  assert.equal((await adapter.lookupLabels("adVil")).cached, false);
  assert.equal(calls.length, 6);
});

test("empty label result arrays are handled as missing data", async () => {
  const { fetcher, calls } = queuedFetch([
    jsonResponse({ results: [] }),
    jsonResponse({ results: [] }),
    jsonResponse({ results: [] }),
  ]);
  const result = await createOpenFdaAdapter({ fetcher }).lookupLabels("adVil");
  assert.equal(result.status, "not_found");
  assert.equal(calls.length, 3);
});

test("Drug Event returns report and raw reported-sex counts without a risk calculation", async () => {
  const { fetcher, calls } = queuedFetch([
    jsonResponse({ meta: { last_updated: "2026-09-01", results: { total: 123 } }, results: [{ safetyreportid: "example" }] }),
    jsonResponse({ results: [{ term: 2, count: 77 }, { term: 1, count: 33 }, { term: 0, count: 2 }] }),
    jsonResponse({ meta:{last_updated:"2026-09-01"}, results:[{term:"Headache",count:21},{term:"Nausea",count:13}] }),
  ]);
  const adapter = createOpenFdaAdapter({ fetcher });

  const result = await adapter.lookupEvents("Ibuprofen");
  assert.equal(result.status, "ok");
  assert.equal(result.data.matchedReportCount, 123);
  assert.deepEqual(result.data.reportedSexCounts, [
    { code: "2", reportCount: 77 },
    { code: "1", reportCount: 33 },
    { code: "0", reportCount: 2 },
  ]);
  assert.equal(result.data.sexCountStatus, "available");
  assert.equal("risk" in result.data, false);
  assert.equal(calls[0].searchParams.get("search"), 'patient.drug.medicinalproduct:"Ibuprofen"');
  assert.equal(calls[1].searchParams.get("count"), "patient.patientsex");
  assert.equal(calls[2].searchParams.get("search"), '(patient.drug.medicinalproduct:"Ibuprofen") AND patient.patientsex:2');
  assert.equal(calls[2].searchParams.get("count"), "patient.reaction.reactionmeddrapt.exact");
  assert.equal(calls[2].searchParams.get("limit"), "4");
  assert.deepEqual(result.data.femaleReactions.counts,[{term:"Headache",reportCount:21},{term:"Nausea",reportCount:13}]);
  assert.equal(result.data.femaleReactions.status,"available");
  assert.match(result.data.femaleReactions.sourceUrl,/patient.patientsex/);
  assert.equal((await adapter.lookupEvents("Ibuprofen")).cached,true);
  assert.equal(calls.length,3);
});

test("Drug Event distinguishes no reports from reports lacking sex counts", async () => {
  const missing = queuedFetch([jsonResponse({ error: { code: "NOT_FOUND" } }, 404)]);
  const missingResult = await createOpenFdaAdapter({ fetcher: missing.fetcher }).lookupEvents("UnknownDrug");
  assert.equal(missingResult.status, "not_found");
  assert.equal(missing.calls.length, 1);

  const partial = queuedFetch([
    jsonResponse({ meta: { results: { total: 10 } }, results: [{}] }),
    jsonResponse({ error: { code: "NOT_FOUND" } }, 404),
    jsonResponse({ error: { code: "NOT_FOUND" } }, 404),
  ]);
  const partialResult = await createOpenFdaAdapter({ fetcher: partial.fetcher }).lookupEvents("TestDrug");
  assert.equal(partialResult.status, "ok");
  assert.equal(partialResult.data.matchedReportCount, 10);
  assert.equal(partialResult.data.reportedSexCounts, null);
  assert.equal(partialResult.data.sexCountStatus, "missing");
  assert.equal(partialResult.data.femaleReactions.status,"missing");
  assert.equal(partialResult.data.femaleReactions.counts,null);

  const emptyBuckets = queuedFetch([
    jsonResponse({ meta: { results: { total: 4 } }, results: [{}] }),
    jsonResponse({ results: [] }),
    jsonResponse({ results: [] }),
  ]);
  const emptyResult = await createOpenFdaAdapter({ fetcher: emptyBuckets.fetcher }).lookupEvents("TestDrug");
  assert.equal(emptyResult.status, "ok");
  assert.deepEqual(emptyResult.data.reportedSexCounts, []);
  assert.equal(emptyResult.data.sexCountStatus, "missing");
  assert.equal(emptyResult.data.femaleReactions.status,"missing");
});

test("female reaction lookup failures preserve sex counts and retry with a short cache lifetime",async()=>{
 let clock=0;
 const {fetcher,calls}=queuedFetch([
  jsonResponse({meta:{results:{total:100}},results:[{}]}),
  jsonResponse({results:[{term:2,count:77}]}),jsonResponse({},429),
  jsonResponse({meta:{results:{total:100}},results:[{}]}),
  jsonResponse({results:[{term:2,count:77}]}),jsonResponse({results:[{term:"Headache",count:12}]}),
 ]);
 const adapter=createOpenFdaAdapter({fetcher,apiKey:"private-test-key",now:()=>clock,notFoundTtlMs:1000,successTtlMs:60000});
 const result=await adapter.lookupEvents("Ibuprofen");
 assert.equal(result.status,"ok");assert.equal(result.data.sexCountStatus,"available");
 assert.equal(result.data.femaleReactions.status,"unavailable");assert.equal(result.data.femaleReactions.counts,null);
 assert.equal(JSON.stringify(result).includes("private-test-key"),false);
 assert.equal((await adapter.lookupEvents("Ibuprofen")).cached,true);assert.equal(calls.length,3);
 clock=1001;const retried=await adapter.lookupEvents("Ibuprofen");assert.equal(retried.data.femaleReactions.status,"available");assert.equal(calls.length,6);
});

test("invalid reaction terms or counts fail closed without substituting example values",async()=>{
 for(const results of [[{term:"Headache",count:-1}],[{term:2,count:10}],[{term:"Headache",count:3},{term:"Headache",count:2}],null]){
  const {fetcher}=queuedFetch([jsonResponse({meta:{results:{total:10}},results:[{}]}),jsonResponse({results:[{term:0,count:2}]}),jsonResponse({results})]);
  const result=await createOpenFdaAdapter({fetcher}).lookupEvents("TestDrug");
  assert.equal(result.status,"ok");assert.equal(result.data.femaleReactions.status,"unavailable");assert.equal(result.data.femaleReactions.counts,null);
 }
});

test("upstream rate limits and malformed responses fail without invented evidence", async () => {
  const limited = queuedFetch([jsonResponse({}, 429)]);
  const limitedResult = await createOpenFdaAdapter({ fetcher: limited.fetcher }).lookupEvents("Ibuprofen");
  assert.equal(limitedResult.status, "unavailable");
  assert.equal(limitedResult.reason, "rate_limited");
  assert.equal(limitedResult.data, null);

  const malformed = queuedFetch([jsonResponse({ unexpected: true })]);
  const malformedResult = await createOpenFdaAdapter({ fetcher: malformed.fetcher }).lookupLabels("Advil");
  assert.equal(malformedResult.status, "unavailable");
  assert.equal(malformedResult.reason, "invalid_response");
  assert.equal(malformedResult.data, null);
});
