import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import type { Assessment } from "@prisma/client";
import { computeGapData, type GapMetrics } from "@/lib/gaps";
import { prisma } from "@/lib/prisma";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;
const LOW_CONFIDENCE_DISTANCE = 0.45;
const RETRY_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 500;

// Deterministic scoring weights (questionnaire completion vs evidence coverage).
const COMPLETION_WEIGHT = 60;
const EVIDENCE_WEIGHT = 40;
const STALE_EVIDENCE_PENALTY = 5;
const MISSING_EVIDENCE_PENALTY = 3;

type ConfidenceLevel = "low" | "high";

export type RecommendationWithCitation = {
  text: string;
  articleRef: string;
};

// The model is responsible only for the narrative summary and grounded
// recommendations; score and level are computed deterministically from data.
type ParsedAssessment = {
  summary: string;
  recommendations: RecommendationWithCitation[];
};

/**
 * Deterministic readiness score (0–100) derived purely from the system's data:
 * questionnaire completion ratio, evidence coverage across sections, and a
 * penalty for missing/stale evidence (gap data from lib/gaps.ts).
 */
export function computeReadinessScore(metrics: GapMetrics): number {
  const completionRatio =
    metrics.totalRequiredQuestions === 0
      ? 1
      : metrics.answeredRequiredQuestions / metrics.totalRequiredQuestions;
  const evidenceCoverage =
    metrics.totalSections === 0 ? 1 : metrics.sectionsWithEvidence / metrics.totalSections;

  const base = completionRatio * COMPLETION_WEIGHT + evidenceCoverage * EVIDENCE_WEIGHT;
  const penalty =
    metrics.staleEvidenceCount * STALE_EVIDENCE_PENALTY +
    metrics.missingEvidenceSections * MISSING_EVIDENCE_PENALTY;

  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

export function deriveLevel(score: number): string {
  if (score < 40) {
    return "Not Ready";
  }
  if (score <= 75) {
    return "Partially Ready";
  }
  return "Audit-Ready";
}

type RetrievedClause = {
  articleRef: string;
  title: string;
  text: string;
  distance: number;
};

export type AssessmentFailureStage = "embed" | "retrieve" | "generate" | "parse" | "persist";

export type AssessmentFailure = {
  stage: AssessmentFailureStage;
  errorMessage: string;
  stack?: string;
};

export type AssessmentGenerationResult =
  | {
      status: "success";
      message: string;
      assessment: Assessment;
    }
  | {
      status: "rate_limited";
      message: string;
      assessment: Assessment | null;
      failure?: AssessmentFailure;
    }
  | {
      status: "error";
      message: string;
      failure?: AssessmentFailure;
    };

const ASSESSMENT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["summary", "recommendations"],
  properties: {
    summary: {
      type: Type.STRING,
      description: "2-3 sentence compliance posture summary."
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["text", "articleRef"],
        properties: {
          text: {
            type: Type.STRING,
            description: "Actionable recommendation."
          },
          articleRef: {
            type: Type.STRING,
            description: "Exact article reference from retrieved clauses."
          }
        }
      }
    }
  }
};

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const status = "status" in error ? error.status : undefined;
  if (typeof status === "number") {
    return status;
  }

  const statusCode = "statusCode" in error ? error.statusCode : undefined;
  if (typeof statusCode === "number") {
    return statusCode;
  }

  return undefined;
}

function errorContainsRateLimit(error: unknown) {
  const message = getErrorMessage(error, "");
  return /resource_exhausted|rate.?limit|quota exceeded|429/i.test(message);
}

function isTransientError(error: unknown) {
  const status = getErrorStatus(error);
  if (status === 429 || (typeof status === "number" && status >= 500)) {
    return true;
  }

  const message = getErrorMessage(error, "");
  return /429|5\d\d|timeout|timed out|network|connection closed|socket hang up|econnreset|eai_again|enotfound|etimedout/i.test(
    message
  );
}

function toFailure(stage: AssessmentFailureStage, error: unknown, fallback: string): AssessmentFailure {
  return {
    stage,
    errorMessage: getErrorMessage(error, fallback),
    stack: error instanceof Error ? error.stack : undefined
  };
}

function parseSecondsToMs(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*s/i);
  if (!match) {
    return undefined;
  }
  const seconds = Number.parseFloat(match[1]);
  if (!Number.isFinite(seconds)) {
    return undefined;
  }
  return Math.max(0, Math.ceil(seconds * 1000));
}

function getRetryDelayMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const maybeAny = error as Record<string, unknown>;
  const responseData = maybeAny["responseData"];
  if (responseData && typeof responseData === "object") {
    const details = (responseData as { error?: { details?: unknown } }).error?.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (!detail || typeof detail !== "object") {
          continue;
        }
        const retryDelay = (detail as { retryDelay?: unknown }).retryDelay;
        if (typeof retryDelay === "string") {
          const parsed = parseSecondsToMs(retryDelay);
          if (typeof parsed === "number") {
            return parsed;
          }
        }
      }
    }
  }

  const message = getErrorMessage(error, "");
  const fromMessage = parseSecondsToMs(message);
  if (typeof fromMessage === "number") {
    return fromMessage;
  }

  return undefined;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= RETRY_ATTEMPTS) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_ATTEMPTS || !isTransientError(error)) {
        throw error;
      }
      const retryDelayMs = getRetryDelayMs(error);
      await sleep(retryDelayMs ?? RETRY_BACKOFF_MS * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError;
}

async function embedRetrievalQuery(ai: GoogleGenAI, content: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: content,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: OUTPUT_DIMENSIONALITY
    }
  });

  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== OUTPUT_DIMENSIONALITY) {
    throw new Error("Unexpected query embedding shape.");
  }

  return values;
}

async function retrieveRelevantClauses(queryEmbedding: number[]): Promise<RetrievedClause[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const rows = await prisma.$queryRawUnsafe<RetrievedClause[]>(
    `SELECT "articleRef", title, text, embedding <=> $1::vector AS distance
     FROM "RegulationChunk"
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT 4;`,
    vectorLiteral
  );

  return rows.filter((row) => Number.isFinite(row.distance));
}

function retrievalIsWeak(clauses: RetrievedClause[]) {
  if (clauses.length === 0) {
    return true;
  }

  const bestDistance = Math.min(...clauses.map((clause) => clause.distance));
  return bestDistance > LOW_CONFIDENCE_DISTANCE;
}

function parseAssessmentPayload(rawText: string): ParsedAssessment | null {
  try {
    const parsed = JSON.parse(stripCodeFences(rawText)) as Partial<ParsedAssessment>;

    if (
      typeof parsed.summary !== "string" ||
      !parsed.summary.trim() ||
      !Array.isArray(parsed.recommendations)
    ) {
      return null;
    }

    const recommendations = parsed.recommendations
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const textValue = "text" in item ? item.text : null;
        const articleRefValue = "articleRef" in item ? item.articleRef : null;
        if (typeof textValue !== "string" || typeof articleRefValue !== "string") {
          return null;
        }

        const text = textValue.trim();
        const articleRef = articleRefValue.trim();
        if (!text || !articleRef) {
          return null;
        }

        return { text, articleRef };
      })
      .filter((item): item is RecommendationWithCitation => Boolean(item));

    if (recommendations.length === 0) {
      return null;
    }

    return {
      summary: parsed.summary.trim(),
      recommendations
    };
  } catch {
    return null;
  }
}

export function parseRecommendations(recommendations: string) {
  try {
    const parsed = JSON.parse(recommendations) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (typeof item === "string") {
          const text = item.trim();
          return text ? { text, articleRef: "Not cited" } : null;
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        const textValue = "text" in item ? item.text : null;
        const articleRefValue = "articleRef" in item ? item.articleRef : null;
        if (typeof textValue !== "string" || typeof articleRefValue !== "string") {
          return null;
        }

        const text = textValue.trim();
        const articleRef = articleRefValue.trim();
        if (!text || !articleRef) {
          return null;
        }

        return { text, articleRef };
      })
      .filter((item): item is RecommendationWithCitation => Boolean(item));
  } catch {
    return [];
  }
}

export function parseCitations(citations: string | null) {
  if (!citations) {
    return [];
  }

  try {
    const parsed = JSON.parse(citations) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const articleRefValue = "articleRef" in item ? item.articleRef : null;
        const titleValue = "title" in item ? item.title : null;
        const distanceValue = "distance" in item ? item.distance : null;
        if (
          typeof articleRefValue !== "string" ||
          typeof titleValue !== "string" ||
          typeof distanceValue !== "number"
        ) {
          return null;
        }

        return {
          articleRef: articleRefValue,
          title: titleValue,
          distance: distanceValue
        };
      })
      .filter(
        (item): item is { articleRef: string; title: string; distance: number } => Boolean(item)
      );
  } catch {
    return [];
  }
}

async function buildRateLimitedFallbackResult(
  systemId: string,
  stage: AssessmentFailureStage,
  error: unknown
): Promise<AssessmentGenerationResult> {
  const latestSavedAssessment = await prisma.assessment.findFirst({
    where: { systemId },
    orderBy: { createdAt: "desc" }
  });

  return {
    status: "rate_limited",
    message: "Rate limited - showing most recent saved assessment.",
    assessment: latestSavedAssessment,
    failure: toFailure(stage, error, "Rate limited during assessment generation.")
  };
}

export async function generateAssessment(systemId: string): Promise<AssessmentGenerationResult> {
  const system = await prisma.aiSystem.findUnique({
    where: { id: systemId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              section: true
            }
          }
        }
      },
      gaps: {
        where: { status: "OPEN" },
        include: {
          section: true,
          question: true
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!system) {
    return {
      status: "error",
      message: "System not found."
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      status: "error",
      message: "GEMINI_API_KEY is not configured."
    };
  }

  const answers = system.answers.map((answer) => ({
    section: answer.question.section.title,
    question: answer.question.prompt,
    response: answer.response
  }));

  const openGaps = system.gaps.map((gap) => ({
    type: gap.type,
    message: gap.message,
    section: gap.section?.title ?? null,
    question: gap.question?.prompt ?? null
  }));

  // Deterministic readiness score/level computed from the system's data.
  const { metrics } = await computeGapData(systemId);
  const score = computeReadinessScore(metrics);
  const level = deriveLevel(score);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const retrievalQuery = [
      `System: ${system.systemName}`,
      `Owner: ${system.owner}`,
      `Business purpose: ${system.businessPurpose}`,
      `Deployment status: ${system.deploymentStatus}`,
      `Geography: ${system.geography}`,
      `Model/provider details: ${system.modelProviderDetails}`,
      `Human oversight: ${system.humanOversightDescription}`,
      `Intended users: ${system.intendedUsers}`,
      `Affected stakeholders: ${system.affectedStakeholders}`,
      `Risk category: ${system.riskCategory}`,
      `Version: ${system.versionReleaseIdentifier}`,
      "Open gaps:",
      ...openGaps.map((gap, index) => `${index + 1}. ${gap.type}: ${gap.message}`)
    ].join("\n");

    let queryEmbedding: number[];
    try {
      queryEmbedding = await withRetry(() => embedRetrievalQuery(ai, retrievalQuery));
    } catch (error) {
      if (getErrorStatus(error) === 429 || errorContainsRateLimit(error)) {
        return buildRateLimitedFallbackResult(systemId, "embed", error);
      }

      return {
        status: "error",
        message: "Assessment generation failed. Please try again.",
        failure: toFailure("embed", error, "Failed to embed retrieval query.")
      };
    }

    let retrievedClauses: RetrievedClause[];
    try {
      retrievedClauses = await retrieveRelevantClauses(queryEmbedding);
    } catch (error) {
      return {
        status: "error",
        message: "Assessment generation failed. Please try again.",
        failure: toFailure("retrieve", error, "Failed to retrieve regulation clauses.")
      };
    }

    if (retrievedClauses.length === 0) {
      return {
        status: "error",
        message: "No regulation clauses were available for grounding.",
        failure: {
          stage: "retrieve",
          errorMessage: "No regulation clauses were returned from vector retrieval."
        }
      };
    }

    const weakRetrieval = retrievalIsWeak(retrievedClauses);
    const prompt = [
      "You are an AI governance reviewer.",
      'Return STRICT JSON only with keys: "summary", "recommendations".',
      "Rules: summary must be 2-3 sentences describing the system's compliance posture.",
      'Rules: recommendations must be an array of objects with keys "text" and "articleRef"; each recommendation must cite one of the retrieved articleRef values.',
      "Ground every finding in retrieved clauses only. Do not invent citations.",
      "Do not include a numeric score or readiness level; those are computed separately.",
      "Do not include markdown fences or extra text.",
      "",
      `Computed readiness score (for narrative context only): ${score}/100 (${level}).`,
      "",
      "System context:",
      JSON.stringify(
        {
          system: {
            systemName: system.systemName,
            owner: system.owner,
            businessPurpose: system.businessPurpose,
            deploymentStatus: system.deploymentStatus,
            geography: system.geography,
            modelProviderDetails: system.modelProviderDetails,
            humanOversightDescription: system.humanOversightDescription,
            intendedUsers: system.intendedUsers,
            affectedStakeholders: system.affectedStakeholders,
            riskCategory: system.riskCategory,
            versionReleaseIdentifier: system.versionReleaseIdentifier
          },
          answers,
          openGaps
        },
        null,
        2
      ),
      "",
      "Retrieved clauses (authoritative grounding context):",
      JSON.stringify(
        retrievedClauses.map((clause) => ({
          articleRef: clause.articleRef,
          title: clause.title,
          text: clause.text,
          distance: clause.distance
        })),
        null,
        2
      )
    ].join("\n");

    let responseText: string | undefined;
    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: ASSESSMENT_RESPONSE_SCHEMA
          }
        })
      );
      responseText = response.text;
    } catch (error) {
      if (getErrorStatus(error) === 429 || errorContainsRateLimit(error)) {
        return buildRateLimitedFallbackResult(systemId, "generate", error);
      }

      return {
        status: "error",
        message: "Assessment generation failed. Please try again.",
        failure: toFailure("generate", error, "Failed to generate grounded assessment.")
      };
    }

    if (!responseText) {
      return {
        status: "error",
        message: "Gemini returned an empty assessment response.",
        failure: {
          stage: "parse",
          errorMessage: "Gemini returned an empty response body."
        }
      };
    }

    const parsed = parseAssessmentPayload(responseText);
    if (!parsed) {
      return {
        status: "error",
        message: "Could not parse assessment response from Gemini.",
        failure: {
          stage: "parse",
          errorMessage: "Response did not match expected assessment JSON structure."
        }
      };
    }

    const confidence: ConfidenceLevel = weakRetrieval ? "low" : "high";

    let assessment: Assessment;
    try {
      assessment = await prisma.assessment.create({
        data: {
          systemId,
          score,
          level,
          summary: parsed.summary,
          recommendations: JSON.stringify(parsed.recommendations),
          confidence,
          citations: JSON.stringify(
            retrievedClauses.map((clause) => ({
              articleRef: clause.articleRef,
              title: clause.title,
              distance: clause.distance
            }))
          )
        }
      });
    } catch (error) {
      return {
        status: "error",
        message: "Assessment generation failed. Please try again.",
        failure: toFailure("persist", error, "Failed to persist assessment.")
      };
    }

    return {
      status: "success",
      message: "Assessment generated.",
      assessment
    };
  } catch (error) {
    return {
      status: "error",
      message: "Assessment generation failed. Please try again.",
      failure: toFailure("generate", error, "Assessment pipeline failed unexpectedly.")
    };
  }
}
