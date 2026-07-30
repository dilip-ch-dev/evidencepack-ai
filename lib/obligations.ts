/**
 * Version pins and rulebook-derived obligation lookups.
 *
 * The obligation catalog itself is no longer hardcoded here — it comes from the
 * active rulebook manifest (see `lib/rulebook.ts`). This module keeps the scoring
 * version constants and provides the rulebook-bound helpers the pipeline uses.
 */
import {
  getActiveRulebook,
  obligationsForSection as obligationsForSectionIn,
  preferredClauseRefsForGaps,
  type ObligationDef
} from "@/lib/rulebook";

export type { ObligationDef } from "@/lib/rulebook";

export const SCORING_VERSION_V1 = "scoring_v1";
export const SCORING_VERSION_V2 = "scoring_v2";
export const CURRENT_SCORING_VERSION =
  process.env.SCORING_VERSION?.trim() || SCORING_VERSION_V2;

/**
 * The corpus version is the active rulebook id: ingestion tags every chunk with it
 * and retrieval filters on it, so switching rulebooks switches corpora atomically.
 */
export const CURRENT_CORPUS_VERSION = getActiveRulebook().id;

export function currentObligations(): ObligationDef[] {
  return getActiveRulebook().obligations;
}

export function obligationsForSection(sectionKey: string): ObligationDef[] {
  return obligationsForSectionIn(getActiveRulebook(), sectionKey);
}

export function preferredArticlesForGaps(gapMessages: string[]): string[] {
  return preferredClauseRefsForGaps(getActiveRulebook(), gapMessages);
}
