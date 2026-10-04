export type LabelFragment = { heading: string | null; text: string; continuation?: boolean };

/** Literal source headings only; no inferred medical topics or altered wording. */
export function labelTopics(source: string): LabelFragment[] {
  const headings = /\b(?:Cardiovascular Thrombotic Events|Cardiovascular Effects|Gastrointestinal Bleeding, Ulceration, and Perforation|Gastrointestinal Effects|Gastrointestinal Risk|Heart Failure and Edema|Advanced Renal Disease|Renal Effects|Anaphylactoid Reactions|Serious Skin Reactions|Drug Reaction with Eosinophilia and Systemic Symptoms|Premature Closure of Fetal Ductus Arteriosus|Oligohydramnios\/Neonatal Renal Impairment|Fetal Toxicity|Pregnancy|Allergy alert|Stomach bleeding warning|Heart attack and stroke warning|GASTROINTESTINAL|CENTRAL NERVOUS SYSTEM|DERMATOLOGIC|CARDIOVASCULAR|ENDOCRINE|HEMATOLOGIC|RENAL|HEPATIC|SPECIAL SENSES|Renal Toxicity and Hyperkalemia|Hepatotoxicity|Hypertension|Anaphylactic Reactions|Exacerbation of Asthma Related to Aspirin Sensitivity|Hematologic Toxicity|Masking of Inflammation and Fever|Laboratory Monitoring|Clinical Trials Experience|Postmarketing Experience|Drug Interactions|Use in Specific Populations)\b/gi;
  const matches = [...source.matchAll(headings)].filter(match => {
    const following = source.slice(match.index! + match[0].length);
    return /^\s*(?::|[A-Z]|\([A-Z]+\)\s+[A-Z])/.test(following) || !following.trim();
  });
  if (!matches.length) return layoutLabelText(source);
  const topics: LabelFragment[] = [];
  if (matches[0].index! > 0) topics.push({heading:null,text:source.slice(0,matches[0].index).trim()});
  matches.forEach((match,index) => topics.push({heading:match[0],text:source.slice(match.index,matches[index+1]?.index ?? source.length).trim()}));
  return topics.filter(topic => topic.text);
}

/** Changes presentation only. All fragments stay in source order; no summary or medical categorisation. */
export function layoutLabelText(source: string): LabelFragment[] {
  if (!source.trim()) return [];
  const boundaries = [0];
  // Explicit source bullets, numbered items, and paragraph breaks.
  const markers = /(?:\n\s*\n+)|(?:\s+(?=•\s))|(?:\s+(?=\d{1,2}\.\s+[A-Z]))/g;
  let expectedNumber = /^1\.\s/.test(source.trimStart()) ? 2 : 1;
  for (const match of source.matchAll(markers)) {
    const position = match.index! + match[0].length;
    const suffix = source.slice(position);
    const number = suffix.match(/^(\d{1,2})\.\s/);
    if (number) {
      // A sentence ending in a quantity ("through 5. In...") is not a source heading.
      if (Number(number[1]) !== expectedNumber || !sourceHeading(suffix)) continue;
      expectedNumber++;
    }
    boundaries.push(position);
  }
  boundaries.push(source.length);
  const fragments: LabelFragment[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const block = source.slice(boundaries[index], boundaries[index + 1]).trim();
    if (!block) continue;
    // Split long plain paragraphs only after sentence punctuation, preserving every character.
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const heading = sourceHeading(block);
    let continuation = false;
    let text = "";
    for (const sentence of sentences) {
      if (text.length >= 600) { fragments.push({ heading, text, continuation }); text = ""; continuation = Boolean(heading); }
      text += `${text ? " " : ""}${sentence}`;
    }
    if (text) fragments.push({ heading, text, continuation });
  }
  return fragments;
}

function sourceHeading(text: string): string | null {
  // Only literal, explicit numbered headings. Unrecognised text has no inferred heading.
  const match = text.match(/^\d{1,2}\.\s+((?:[A-Z][a-zA-Z’'-]+|and|of|the|or)(?:\s+(?:[A-Z][a-zA-Z’'-]+|and|of|the|or)){0,9})/);
  if (!match) return null;
  const candidate = match[0].split(/\s+(?=An\b|A\b|The\b|In\b|Patients\b|Women\b|There\b|Should\b)/)[0];
  return candidate.length > 5 ? candidate : null;
}
