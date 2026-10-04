import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenRouterLabelTranslator, validateTranslation, splitTranslationText } from '../src/lib/label-translation/adapter.ts';
import { createTranslationCache, translationCacheKey } from '../src/lib/label-translation/cache.ts';
import { planLabelTranslation, translatedLabelTopics } from '../src/lib/label-translation/plan.ts';
import { presentLabelTopics, polishLabelHeading, fallbackLabelHeading, isLabelSection } from '../src/lib/label-presentation.ts';
import { parseLabelTranslationRequest, sourceTranslationTopics } from '../src/lib/label-translation/request.ts';

const source = [{ id: '0:body:0', text: 'Events may occur in 2% of patients. Do not exceed 200 mg.' }];
const translated = [{ id: '0:body:0', text: 'Zdarzenia mogą wystąpić u 2% pacjentów. Nie należy przekraczać 200 mg.' }];
const ok = { status: 'ok', language: 'pl', segments: translated };
const response = (segments, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content: JSON.stringify({ segments }) } }] });

test('paragraph translation accepts only identifiers and an integer source index, never client text or personal history', () => {
  const request = { medicationId: '3f734f8a-7caa-4122-b603-502ae0bb5fd1', labelId: '5e595111-2e13-4cde-826f-a7d4d9c97bab', section: 'adverseReactions', paragraphIndex: 0 };
  assert.deepEqual(parseLabelTranslationRequest(request), request);
  const { paragraphIndex, ...sectionRequest } = request;
  assert.deepEqual(parseLabelTranslationRequest(sectionRequest), sectionRequest);
  for (const extra of [{ text: 'client text' }, { history: 'personal entry' }, { paragraphIndex: -1 }, { paragraphIndex: 1.5 }, { paragraphIndex: '0' }, { paragraphIndex: null }, { paragraphIndex: 1001 }, { medicationId: 'invalid' }, { section: 'patientHistory' }]) {
    assert.equal(parseLabelTranslationRequest({ ...request, ...extra }), null);
  }
});

test('quote context translates the complete authoritative paragraph with all headings and qualifiers intact', () => {
  const label = { adverseReactions: ['ADVERSE REACTIONS Dizziness may occur. Causality has not been established.', 'A separate public source paragraph.'], warnings: ['Different section.'] };
  const topics = sourceTranslationTopics(label, { section: 'adverseReactions', paragraphIndex: 0 });
  assert.deepEqual(topics, [{ heading: null, text: label.adverseReactions[0] }]);
  assert.equal(planLabelTranslation(topics).map(segment => segment.text).join(''), label.adverseReactions[0]);
  assert.deepEqual(sourceTranslationTopics(label, { section: 'adverseReactions', paragraphIndex: 5 }), []);
  assert.deepEqual(sourceTranslationTopics(label, { section: 'warnings', paragraphIndex: 0 }), [{ heading: null, text: 'Different section.' }]);
});

test('literal translation adapter sends only public source segments with strict JSON schema', async () => {
  let calls = 0;
  const adapter = createOpenRouterLabelTranslator({ apiKey: 'mock-key', fetcher: async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'deepseek/deepseek-v4.1-flash');
    assert.equal(request.response_format.json_schema.strict, true);
    assert.equal(request.provider.require_parameters, true);
    assert.deepEqual(JSON.parse(request.messages[1].content), { segments: source, requiredNumericTokens: [{ id: source[0].id, tokens: ['2%', '200'] }] });
    assert.equal(request.tools, undefined);
    return response(translated);
  } });
  assert.deepEqual(await adapter.translate(source), ok);
  assert.equal(calls, 1);
});

test('translation rejects missing, reordered, extra, truncated and mechanically altered source information', () => {
  assert.deepEqual(validateTranslation({ segments: translated }, source), translated);
  for (const text of [
    translated[0].text.replace('2%', '20%'),
    translated[0].text.replace('mg', 'mcg'),
    translated[0].text.replace('Nie należy', 'Należy'),
    translated[0].text.replace('mogą wystąpić', 'występują'),
    '<b>' + translated[0].text + '</b>',
    '2% 200 mg',
  ]) assert.equal(validateTranslation({ segments: [{ ...translated[0], text }] }, source), null);
  assert.equal(validateTranslation({ segments: [] }, source), null);
  assert.equal(validateTranslation({ segments: [{ ...translated[0], diagnosis: 'extra' }] }, source), null);
  assert.equal(validateTranslation({ segments: translated, advice: 'extra' }, source), null);
  assert.equal(validateTranslation({ segments: [{ ...translated[0], id: 'different' }] }, source), null);
});

test('missing credentials, provider failures, incomplete output and invalid JSON fail without replacing the source', async () => {
  assert.equal((await createOpenRouterLabelTranslator({}).translate(source)).reason, 'not_configured');
  for (const fetcher of [
    async () => new Response('', { status: 429 }),
    async () => { throw Error('offline'); },
    async () => response(translated, 'length'),
    async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'invalid' } }] }),
  ]) {
    const result = await createOpenRouterLabelTranslator({ apiKey: 'mock', fetcher }).translate(source);
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.segments, []);
  }
  assert.equal((await createOpenRouterLabelTranslator({ apiKey: 'mock' }).translate([{ id: 'x', text: 'a'.repeat(4001) }])).reason, 'too_long');
});

test('long source splitting preserves every character and output order across batches', async () => {
  const text = 'A public source sentence. '.repeat(440);
  const chunks = splitTranslationText(text);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => chunk.length <= 4000));
  const segments = chunks.map((text, index) => ({ id: String(index), text }));
  let calls = 0;
  const adapter = createOpenRouterLabelTranslator({ apiKey: 'mock', fetcher: async (_, options) => {
    calls++;
    const batch = JSON.parse(JSON.parse(options.body).messages[1].content).segments;
    return response(batch.map(segment => ({ ...segment, text: segment.text.replaceAll('A public source sentence.', 'Publiczne zdanie źródłowe.') })));
  } });
  const result = await adapter.translate(segments);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.segments.map(segment => segment.id), segments.map(segment => segment.id));
  assert.ok(calls > 1);
});

test('cache deduplicates concurrent requests, expires and invalidates on source or model changes', async () => {
  let time = 0, calls = 0;
  const cache = createTranslationCache({ now: () => time, model: 'm', translate: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return ok; } });
  await Promise.all([cache.translate(source), cache.translate(source)]);
  assert.equal(calls, 1);
  assert.equal((await cache.translate(source)).cached, true);
  time = 7 * 24 * 60 * 60_000 + 1;
  assert.equal((await cache.translate(source)).cached, false);
  assert.equal(calls, 2);
  assert.notEqual(translationCacheKey(source, 'm'), translationCacheKey(source, 'another'));
  assert.notEqual(translationCacheKey(source, 'm'), translationCacheKey([{ ...source[0], text: source[0].text + ' New text.' }], 'm'));
});

test('persistent cache revalidates against the source; failures remain retryable and are not saved to disk', async () => {
  let calls = 0, saved = 0, time = 0;
  const store = { get: async () => ({ expires: 1000, result: { ...ok, segments: [{ ...translated[0], text: translated[0].text.replace('200', '400') }] } }), set: async () => { saved++; } };
  const cache = createTranslationCache({ now: () => time, model: 'm', store, translate: async () => { calls++; return { status: 'unavailable', reason: 'upstream', segments: [] }; } });
  assert.equal((await cache.translate(source)).result.status, 'unavailable');
  await cache.translate(source);
  assert.equal(calls, 1);
  time = 30_001;
  await cache.translate(source);
  assert.equal(calls, 2);
  assert.equal(saved, 0);
  const valid = createTranslationCache({ now: () => 0, model: 'm', store: { ...store, get: async () => ({ expires: 1000, result: ok }) }, translate: async () => { throw Error('cache should supply result'); } });
  assert.deepEqual(await valid.translate(source), { result: ok, cached: true });
});

test('named Polish topics replace numbered fragments without changing the full original', () => {
  const original = 'WARNINGS Cardiovascular Effects Events may occur. Renal Effects Not established.';
  const topics = presentLabelTopics([original]);
  assert.deepEqual(topics.map(topic => topic.heading), ['Cardiovascular Effects', 'Renal Effects']);
  assert.equal(polishLabelHeading('2. Renal Effects'), 'Nerki');
  assert.equal(polishLabelHeading('Drug Reaction with Eosinophilia and Systemic Symptoms'), 'Reakcja polekowa z eozynofilią i objawami ogólnoustrojowymi');
  assert.equal(polishLabelHeading('Novel Source Heading'), null);
  assert.equal(fallbackLabelHeading('adverseReactions'), 'Informacje ogólne o działaniach niepożądanych');
  assert.equal(isLabelSection('patientHistory'), false);
  assert.equal(isLabelSection('boxedWarnings'), true);
  const plan = planLabelTranslation(topics);
  assert.deepEqual(plan.map(segment => segment.text), ['Events may occur.', 'Not established.']);
  const result = translatedLabelTopics(topics, [{ id: '0:body:0', text: 'Zdarzenia mogą wystąpić.' }, { id: '1:body:0', text: 'Nie ustalono.' }]);
  assert.deepEqual(result, [{ heading: 'Układ krążenia', text: 'Zdarzenia mogą wystąpić.' }, { heading: 'Nerki', text: 'Nie ustalono.' }]);
  assert.equal(original, 'WARNINGS Cardiovascular Effects Events may occur. Renal Effects Not established.');
  assert.equal(presentLabelTopics(['Cardiovascular Effects']).length, 0);
  const dress = presentLabelTopics(['Serious Skin Reactions Events may occur. Drug Reaction with Eosinophilia and Systemic Symptoms (DRESS) Some events have been reported.']);
  assert.equal(dress.length, 2);
  assert.equal(polishLabelHeading(dress[1].heading), 'Reakcja polekowa z eozynofilią i objawami ogólnoustrojowymi');
});

test('unrecognised literal headings are translated separately rather than inferred from a description', () => {
  const topics = [{ heading: '1. Novel Source Heading', text: '1. Novel Source Heading A public source body.' }];
  assert.deepEqual(planLabelTranslation(topics), [{ id: '0:body:0', text: 'A public source body.' }, { id: '0:heading', text: 'Novel Source Heading' }]);
  assert.deepEqual(translatedLabelTopics(topics, [{ id: '0:body:0', text: 'Publiczna treść źródłowa.' }, { id: '0:heading', text: 'Nowy nagłówek źródłowy' }]), [{ heading: 'Nowy nagłówek źródłowy', text: 'Publiczna treść źródłowa.' }]);
});
