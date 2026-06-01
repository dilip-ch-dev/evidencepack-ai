import { GoogleGenAI } from "@google/genai";
import type { Assessment } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const VALID_LEVELS = new Set(["Not Ready", "Partially Ready", "Audit-Ready"]);

type ParsedAssessment = {
  score: number;
  level: string;
  summary: string;
  recommendations: string[];
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
      !Array.isArray(parsed.recommendations)
    ) {
      return null;
    }

    const recommendations = parsed.recommendations
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (recommendations.length === 0) {
      return null;
    }

    return {
      score,
      level: parsed.level,
      summary: parsed.summary.trim(),
      recommendations
    };
  } catch {
    return null;
  }
}

export function parseRecommendations(recommendations: string) {
  try {
    const parsed = JSON.parse(recommendations);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
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

  const prompt = [
    "You are an AI governance reviewer.",
    'Return STRICT JSON only with keys: "score", "level", "summary", "recommendations".',
    'Rules: score must be an integer 0-100; level must be one of "Not Ready", "Partially Ready", "Audit-Ready"; summary must be 2-3 sentences; recommendations must be an array of short strings.',
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
    )
  ].join("\n");

  try {
    const ai = new GoogleGenAI({ apiKey });
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

    const assessment = await prisma.assessment.create({
      data: {
        systemId,
        score: parsed.score,
        level: parsed.level,
        summary: parsed.summary,
        recommendations: JSON.stringify(parsed.recommendations)
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
