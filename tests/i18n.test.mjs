import test from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/lib/i18n.ts";
import { UI_MESSAGES } from "../src/lib/i18n-ui.ts";
import { reportedReactionLabel } from "../src/lib/reported-reaction-label.ts";

test("reporting terms translate only exact known names and preserve source wording for English or unknown terms", () => {
  assert.deepEqual(reportedReactionLabel("OVARIAN HYPERSTIMULATION SYNDROME", "pl"), { label: "Zespół hiperstymulacji jajników", translated: true });
  assert.deepEqual(reportedReactionLabel(" drug ineffective ", "pl"), { label: "Brak skuteczności leku", translated: true });
  assert.deepEqual(reportedReactionLabel("INJECTION SITE PAIN", "pl"), { label: "Ból w miejscu wstrzyknięcia", translated: true });
  assert.equal(reportedReactionLabel("HEADACHE", "pl").label, "Ból głowy");
  for (const term of ["HEADACHE", "Headache and an unfamiliar reaction", "UNKNOWN TERM", "constructor", "__proto__"]) {
    assert.deepEqual(reportedReactionLabel(term, "en"), { label: term, translated: false });
  }
  for (const term of ["Severe headache", "UNKNOWN TERM", "constructor", "__proto__"]) {
    assert.deepEqual(reportedReactionLabel(term, "pl"), { label: term, translated: false });
  }
});

test("Polish navigation and cycle labels remain Polish while English preferences translate them", () => {
  const labels = {
    "Twoja historia": "Your story", "ma znaczenie.": "matters.",
    "Miesiączka": "Menstrual", "Faza folikularna": "Follicular",
    "Owulacja": "Ovulation", "Faza lutealna": "Luteal",
    "Twój zapis samopoczucia": "Your check-in", "Samopoczucie zapisane.": "Check-in saved.",
    "Polski": "Polish", "Angielski": "English", "Wyróżnione ostrzeżenie": "Boxed warning",
  };
  for (const [pl, en] of Object.entries(labels)) {
    assert.equal(translate(pl, "pl"), pl);
    assert.equal(translate(pl, "en"), en);
  }
});

test("API errors and legacy bilingual authentication messages render in just the selected language", () => {
  for (const [key, messages] of Object.entries(UI_MESSAGES)) {
    assert.equal(translate(key, "pl"), messages.pl);
    assert.equal(translate(key, "en"), messages.en);
    assert.equal(translate(messages.pl, "pl"), messages.pl);
    assert.equal(translate(messages.en, "en"), messages.en);
    assert.ok(!messages.pl.includes(" / "));
  }
});

test("unknown text and original source wording are preserved without fabricated translations", () => {
  for (const text of ["Headache was reported in clinical trials.", "My own words: headache at 08:00", "constructor", "toString", "__proto__"]) {
    assert.equal(translate(text, "pl"), text);
    assert.equal(translate(text, "en"), text);
  }
  assert.equal(translate("Dzień 12 od zapisanego początku", "en"), "Day 12 from recorded start");
  assert.equal(translate("Twój zapis samopoczucia: sen — 6 godzin.", "en"), "Your check-in: sleep - 6 hours.");
});
