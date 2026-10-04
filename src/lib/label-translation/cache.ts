import { createHash } from "node:crypto";
import { TRANSLATION_VERSION, validateTranslation, type SourceSegment, type TranslationResult } from "./adapter.ts";

export interface TranslationStore { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }
export function translationCacheKey(segments: SourceSegment[], model: string): string {
  return createHash("sha256").update(JSON.stringify({ version: TRANSLATION_VERSION, language: "pl", model, segments })).digest("hex");
}

export function createTranslationCache(options: { translate(segments: SourceSegment[]): Promise<TranslationResult>; model: string; store?: TranslationStore; now?: () => number }) {
  const now = options.now ?? Date.now;
  const memory = new Map<string, { expires: number; result: TranslationResult }>();
  const pending = new Map<string, Promise<{ result: TranslationResult; cached: boolean }>>();
  const ttl = 7 * 24 * 60 * 60_000;
  return {
    async translate(segments: SourceSegment[]): Promise<{ result: TranslationResult; cached: boolean }> {
      const key = translationCacheKey(segments, options.model), saved = memory.get(key);
      if (saved && saved.expires > now()) return { result: saved.result, cached: true };
      if (pending.has(key)) return pending.get(key)!;
      const work = (async () => {
        if (options.store) {
          try {
            const disk = await options.store.get(key) as { expires?: unknown; result?: TranslationResult } | null;
            if (disk && typeof disk.expires === "number" && disk.expires > now() && disk.expires <= now() + ttl && disk.result?.status === "ok" && disk.result.language === "pl") {
              const checked = validateTranslation({ segments: disk.result.segments }, segments);
              if (checked) {
                const result: TranslationResult = { status: "ok", language: "pl", segments: checked };
                memory.set(key, { expires: disk.expires, result });
                return { result, cached: true };
              }
            }
          } catch { /* Cache storage is optional; evidence remains available. */ }
        }
        const result = await options.translate(segments);
        const entry = { expires: now() + (result.status === "ok" ? ttl : 30_000), result };
        memory.delete(key); memory.set(key, entry);
        if (memory.size > 128) memory.delete(memory.keys().next().value!);
        if (result.status === "ok" && options.store) { try { await options.store.set(key, entry); } catch { /* Use the successful in-memory result. */ } }
        return { result, cached: false };
      })();
      pending.set(key, work);
      try { return await work; } finally { pending.delete(key); }
    },
  };
}
