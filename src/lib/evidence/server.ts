import "server-only";
import { createOpenFdaAdapter } from "./openfda";

type Adapter = ReturnType<typeof createOpenFdaAdapter>;
const globalEvidence = globalThis as typeof globalThis & { sideEffectHerOpenFdaReportingV2?: Adapter };

export function openFdaSource(): Adapter {
  globalEvidence.sideEffectHerOpenFdaReportingV2 ??= createOpenFdaAdapter({
    apiKey: process.env.OPENFDA_API_KEY?.trim() || undefined,
  });
  return globalEvidence.sideEffectHerOpenFdaReportingV2;
}
