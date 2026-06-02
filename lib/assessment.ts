import { GoogleGenAI } from "@google/genai";
import type { Assessment } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;
const VALID_LEVELS = new Set(["Not Ready", "Partially Ready", "Audit-Ready"]);
const WEAK_RETRIEVAL_DISTANCE = 0.45;

type ConfidenceLevel = "low" | "high";

export type RecommendationWithCitation = {
  text: string;
  articleRef: string;
};

type ParsedAssessment = {
  score: number;
  level: string;
  summary: string;
  confidence: ConfidenceLevel;
  recommendations: RecommendationWithCitation[];
};

type RetrievedClause = {
  articleRef: string;
  title: string;
  text: string;
  distance: number;
};

export type AssessmentGenerationResult =
  | {
      status: "success";
      message: string;
      assessment: Assessment;
    }
  | {
      status: "error";
      message: string;
    };

function stripCodeFences(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
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
  return bestDistance > WEAK_RETRIEVAL_DISTANCE;
}

function parseAssessmentPayload(rawText: string): ParsedAssessment | null {
  try {
    const parsed = JSON.parse(stripCodeFences(rawText)) as Partial<ParsedAssessment>;
    const score = parsed.score;

    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100 ||
      typeof parsed.level !== "string" ||
      !VALID_LEVELS.has(parsed.level) ||
      typeof parsed.summary !== "string" ||
      !parsed.summary.trim() ||
      (parsed.confidence !== "low" && parsed.confidence !== "high") ||
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
      score,
      level: parsed.level,
      summary: parsed.summary.trim(),
      confidence: parsed.confidence,
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

    const queryEmbedding = await embedRetrievalQuery(ai, retrievalQuery);
    const retrievedClauses = await retrieveRelevantClauses(queryEmbedding);
    if (retrievedClauses.length === 0) {
      return {
        status: "error",
        message: "No regulation clauses were available for grounding."
      };
    }

    const weakRetrieval = retrievalIsWeak(retrievedClauses);
    const prompt = [
      "You are an AI governance reviewer.",
      'Return STRICT JSON only with keys: "score", "level", "summary", "confidence", "recommendations".',
      'Rules: score must be an integer 0-100; level must be one of "Not Ready", "Partially Ready", "Audit-Ready"; summary must be 2-3 sentences.',
      'Rules: confidence must be "low" or "high". Set confidence to "low" when retrieval evidence is weak, sparse, or only partially relevant.',
      'Rules: recommendations must be an array of objects with keys "text" and "articleRef"; each recommendation must cite one of the retrieved articleRef values.',
      "Ground every finding in retrieved clauses only. Do not invent citations.",
      "Do not include markdown fences or extra text.",
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

    const response = await ai.models.generateContent({ model: MODEL, contents: prompt });
    const text = response.text;

    if (!text) {
      return {
        status: "error",
        message: "Gemini returned an empty assessment response."
      };
    }

    const parsed = parseAssessmentPayload(text);
    if (!parsed) {
      return {
        status: "error",
        message: "Could not parse assessment response from Gemini."
      };
    }

    const confidence: ConfidenceLevel =
      weakRetrieval || parsed.confidence === "low" ? "low" : "high";

    const assessment = await prisma.assessment.create({
      data: {
        systemId,
        score: parsed.score,
        level: parsed.level,
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

    return {
      status: "success",
      message: "Assessment generated.",
      assessment
    };
  } catch {
    return {
      status: "error",
      message: "Assessment generation failed. Please try again."
    };
  }
}
