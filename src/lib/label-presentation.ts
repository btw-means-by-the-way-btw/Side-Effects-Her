import { labelTopics, type LabelFragment } from "./label-layout.ts";
import type { DrugLabelRecord } from "./evidence/types.ts";

export const LABEL_SECTIONS = ["boxedWarnings", "warnings", "warningsAndCautions", "adverseReactions"] as const;
export type LabelSection = typeof LABEL_SECTIONS[number];
export type LabelTopic = { heading: string | null; text: string };

export function isLabelSection(value: unknown): value is LabelSection {
  return typeof value === "string" && LABEL_SECTIONS.includes(value as LabelSection);
}

export function labelSectionParagraphs(label: DrugLabelRecord, section: LabelSection): string[] {
  return label[section];
}

export function presentLabelTopics(paragraphs: string[]): LabelTopic[] {
  const topics: LabelTopic[] = [];
  for (const fragment of paragraphs.flatMap(text => labelTopics(text))) {
    const last = topics.at(-1);
    if (fragment.continuation && last?.heading === fragment.heading) last.text += " " + fragment.text;
    else topics.push({ heading: fragment.heading, text: fragment.text });
  }
  // Standalone section titles have no warning body. They remain in the complete original.
  return topics.filter(topic => topicBody(topic).trim() && !/^(?:BOXED WARNINGS?|WARNINGS?(?: AND (?:PRECAUTIONS|CAUTIONS))?|ADVERSE REACTIONS)\s*[:.]?$/i.test(topic.text.trim()));
}

export function topicBody(topic: LabelFragment): string {
  return topic.heading && topic.text.startsWith(topic.heading)
    ? topic.text.slice(topic.heading.length).replace(/^\s*:\s*/, "").trim()
    : topic.text;
}

export function fallbackLabelHeading(section: LabelSection, en = false): string {
  if (section === "adverseReactions") return en ? "General information about adverse reactions" : "Informacje ogólne o działaniach niepożądanych";
  if (section === "boxedWarnings") return en ? "Important safety warning" : "Ważne ostrzeżenie o bezpieczeństwie";
  return en ? "General safety information" : "Ogólne informacje o bezpieczeństwie";
}

export const LABEL_HEADINGS_PL: Record<string, string> = {"Cardiovascular Thrombotic Events":"Zdarzenia zakrzepowe — układ krążenia","Cardiovascular Effects":"Układ krążenia","Gastrointestinal Bleeding, Ulceration, and Perforation":"Krwawienie, owrzodzenie i perforacja przewodu pokarmowego","Gastrointestinal Effects":"Przewód pokarmowy","Heart Failure and Edema":"Niewydolność serca i obrzęki","Renal Effects":"Nerki","Advanced Renal Disease":"Zaawansowana choroba nerek","Anaphylactoid Reactions":"Reakcje anafilaktoidalne","Serious Skin Reactions":"Ciężkie reakcje skórne","Fetal Toxicity":"Wpływ na płód — temat etykiety","Pregnancy":"Ciąża","Allergy alert":"Ostrzeżenie o alergii","Stomach bleeding warning":"Ostrzeżenie o krwawieniu z przewodu pokarmowego","Heart attack and stroke warning":"Ostrzeżenie o zawale i udarze","GASTROINTESTINAL":"Przewód pokarmowy","CENTRAL NERVOUS SYSTEM":"Ośrodkowy układ nerwowy","DERMATOLOGIC":"Skóra","CARDIOVASCULAR":"Układ krążenia","ENDOCRINE":"Układ hormonalny","HEMATOLOGIC":"Krew","RENAL":"Nerki","HEPATIC":"Wątroba","SPECIAL SENSES":"Zmysły","Cardiovascular Disorders":"Układ krążenia","Malignant Neoplasms":"Nowotwory","Endometrial Cancer":"Rak endometrium","Breast Cancer":"Rak piersi","Ovarian Cancer":"Rak jajnika","Probable Dementia":"Otępienie — temat etykiety","Visual Abnormalities":"Zaburzenia widzenia","Elevated Blood Pressure":"Podwyższone ciśnienie","Liver Dysfunction":"Zaburzenia wątroby","Fluid Retention":"Zatrzymanie płynów","Gallbladder Disease":"Choroby pęcherzyka żółciowego","Hypercalcemia":"Hiperkalcemia","Hypertriglyceridemia":"Hipertriglicerydemia","Anaphylactic Reaction and Angioedema":"Reakcja anafilaktyczna i obrzęk naczynioruchowy",
  "Gastrointestinal Risk":"Ryzyko działań ze strony przewodu pokarmowego",
  "Drug Reaction with Eosinophilia and Systemic Symptoms":"Reakcja polekowa z eozynofilią i objawami ogólnoustrojowymi",
  "Premature Closure of Fetal Ductus Arteriosus":"Przedwczesne zamknięcie przewodu tętniczego u płodu",
  "Oligohydramnios/Neonatal Renal Impairment":"Małowodzie i zaburzenia czynności nerek u noworodków",
  "Renal Toxicity and Hyperkalemia":"Toksyczność dla nerek i hiperkaliemia",
  "Hepatotoxicity":"Toksyczność dla wątroby",
  "Hypertension":"Nadciśnienie tętnicze",
  "Anaphylactic Reactions":"Reakcje anafilaktyczne",
  "Exacerbation of Asthma Related to Aspirin Sensitivity":"Zaostrzenie astmy związane z nadwrażliwością na aspirynę",
  "Hematologic Toxicity":"Toksyczność dla układu krwiotwórczego",
  "Masking of Inflammation and Fever":"Maskowanie stanu zapalnego i gorączki",
  "Laboratory Monitoring":"Kontrola badań laboratoryjnych",
  "Clinical Trials Experience":"Obserwacje z badań klinicznych",
  "Postmarketing Experience":"Zgłoszenia po wprowadzeniu leku do obrotu",
  "Drug Interactions":"Interakcje z innymi lekami",
  "Use in Specific Populations":"Stosowanie w określonych grupach pacjentów"
};

export function polishLabelHeading(heading: string | null): string | null {
  if (!heading) return null;
  const literal = heading.replace(/^\d+\.?\s*/, "").trim().toLowerCase();
  return Object.entries(LABEL_HEADINGS_PL).find(([source]) => source.toLowerCase() === literal)?.[1] ?? null;
}
