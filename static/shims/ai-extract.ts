// The static build has no server to hold an API key, so pitch import always uses the rule-based parser.
import type { ExtractResult } from "../../lib/extract";

export function aiConfigured(): boolean {
  return false;
}

export async function extractWithAI(): Promise<ExtractResult> {
  throw new Error("AI extraction needs the server build");
}
