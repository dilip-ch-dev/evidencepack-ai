import {
  parseCitations,
  parseRecommendations,
  parseScoreBreakdown
} from "@/lib/assessment";
import {
  diffAssessments,
  type AssessmentDiff,
  type AssessmentSnapshot
} from "@/lib/assessment-diff";
import { prisma } from "@/lib/prisma";

/**
 * Loads persisted assessments into the shape the diff engine expects. Every field the
 * diff relies on is already recorded per assessment (versions, retrieved clauses with
 * their ranks, the score breakdown), which is what makes a retrospective diff possible
 * without re-running anything.
 */

type AssessmentRow = {
  id: string;
  createdAt: Date;
  score: number;
  level: string;
  summary: string;
  scoringVersion: string | null;
  corpusVersion: string | null;
  recommendations: string;
  citations: string | null;
  scoreBreakdown: string | null;
};

export function assessmentToSnapshot(row: AssessmentRow): AssessmentSnapshot {
  return {
    id: row.id,
    createdAt: row.createdAt,
    score: row.score,
    level: row.level,
    summary: row.summary,
    scoringVersion: row.scoringVersion,
    corpusVersion: row.corpusVersion,
    recommendations: parseRecommendations(row.recommendations),
    citations: parseCitations(row.citations),
    breakdown: parseScoreBreakdown(row.scoreBreakdown)
  };
}

export async function loadSnapshot(assessmentId: string): Promise<AssessmentSnapshot | null> {
  const row = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  return row ? assessmentToSnapshot(row) : null;
}

/** Most recent assessments for a system, newest first. */
export async function loadRecentSnapshots(
  systemId: string,
  take = 2
): Promise<AssessmentSnapshot[]> {
  const rows = await prisma.assessment.findMany({
    where: { systemId },
    orderBy: { createdAt: "desc" },
    take
  });
  return rows.map(assessmentToSnapshot);
}

export type DiffOutcome =
  | { status: "ok"; diff: AssessmentDiff }
  | { status: "insufficient_history"; message: string }
  | { status: "not_found"; message: string };

/** Diffs the two most recent assessments for a system. */
export async function diffLatestForSystem(systemId: string): Promise<DiffOutcome> {
  const [after, before] = await loadRecentSnapshots(systemId, 2);

  if (!after) {
    return { status: "insufficient_history", message: "This system has no assessments yet." };
  }
  if (!before) {
    return {
      status: "insufficient_history",
      message: "Only one assessment exists; generate another to compare."
    };
  }

  return { status: "ok", diff: diffAssessments(before, after) };
}

export async function diffByIds(beforeId: string, afterId: string): Promise<DiffOutcome> {
  const [before, after] = await Promise.all([loadSnapshot(beforeId), loadSnapshot(afterId)]);

  if (!before) {
    return { status: "not_found", message: `Assessment ${beforeId} not found.` };
  }
  if (!after) {
    return { status: "not_found", message: `Assessment ${afterId} not found.` };
  }

  return { status: "ok", diff: diffAssessments(before, after) };
}

export async function diffByIdsForSystem(
  systemId: string,
  beforeId: string,
  afterId: string
): Promise<DiffOutcome> {
  const [beforeRow, afterRow] = await Promise.all([
    prisma.assessment.findFirst({ where: { id: beforeId, systemId } }),
    prisma.assessment.findFirst({ where: { id: afterId, systemId } })
  ]);
  const before = beforeRow ? assessmentToSnapshot(beforeRow) : null;
  const after = afterRow ? assessmentToSnapshot(afterRow) : null;

  if (!before) {
    return { status: "not_found", message: `Assessment ${beforeId} not found.` };
  }
  if (!after) {
    return { status: "not_found", message: `Assessment ${afterId} not found.` };
  }

  return { status: "ok", diff: diffAssessments(before, after) };
}
