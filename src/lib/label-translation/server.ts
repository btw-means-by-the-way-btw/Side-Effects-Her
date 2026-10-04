import "server-only";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createOpenRouterLabelTranslator } from "./adapter";
import { createTranslationCache } from "./cache";
import { planLabelTranslation, translatedLabelTopics } from "./plan";
import type { LabelTopic } from "../label-presentation";

function service() {
  const model = process.env.OPENROUTER_TRANSLATION_MODEL?.trim() || "deepseek/deepseek-v4.1-flash";
  const translator = createOpenRouterLabelTranslator({ apiKey: process.env.OPENROUTER_API_KEY?.trim(), model });
  const directory = join(process.cwd(), ".cache", "fda-translations");
  return createTranslationCache({
    model, translate: segments => translator.translate(segments),
    store: {
      async get(key) {
        const text = await readFile(join(directory, `${key}.json`), "utf8");
        return text.length <= 500_000 ? JSON.parse(text) : null;
      },
      async set(key, value) {
        await mkdir(directory, { recursive: true });
        const temporary = join(directory, `${key}.${randomUUID()}.tmp`);
        try { await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 }); await rename(temporary, join(directory, `${key}.json`)); }
        finally { await unlink(temporary).catch(() => {}); }
      },
    },
  });
}
const globalTranslation = globalThis as typeof globalThis & { sideEffectHerTranslationV2?: ReturnType<typeof service>; sideEffectHerTranslationQueue?: { active: number; waiting: Array<() => void> } };

export async function translateSourceTopics(topics: LabelTopic[]) {
  globalTranslation.sideEffectHerTranslationV2 ??= service();
  globalTranslation.sideEffectHerTranslationQueue ??= { active: 0, waiting: [] };
  const queue = globalTranslation.sideEffectHerTranslationQueue;
  if (queue.active >= 2) await new Promise<void>(resolve => queue.waiting.push(resolve));
  else queue.active++;
  try {
    const { result, cached } = await globalTranslation.sideEffectHerTranslationV2.translate(planLabelTranslation(topics));
    return result.status === "ok"
      ? { status: "ok" as const, language: "pl" as const, cached, topics: translatedLabelTopics(topics, result.segments) }
      : { status: "unavailable" as const, reason: result.reason, topics: [] };
  } finally {
    const next = queue.waiting.shift();
    if (next) next(); else queue.active--;
  }
}
