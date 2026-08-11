import { z } from "zod";
import {
  DeploymentStatus,
  EvidenceStatus,
  EvidenceType,
  RiskCategory
} from "@/lib/db-enums";
import { createSystemSchema, httpUrl } from "@/lib/validation";

export const MAX_SYSTEM_CARD_BYTES = 100_000;

export const KNOWN_QUESTION_KEYS = [
  "overview-main-function",
  "purpose-use-case",
  "data-sources-list",
  "model-details-architecture",
  "risk-controls-mitigations",
  "oversight-escalation",
  "monitoring-approach",
  "incident-response-plan",
  "vendor-third-party-list",
  "security-access-controls",
  "change-management-process"
] as const;

export type KnownQuestionKey = (typeof KNOWN_QUESTION_KEYS)[number];

const evidenceCardSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  type: z.nativeEnum(EvidenceType).default(EvidenceType.URL),
  sourceUrl: httpUrl.optional(),
  sectionKey: z.string().trim().max(160).optional(),
  owner: z.string().trim().min(1).max(160).optional(),
  status: z.nativeEnum(EvidenceStatus).default(EvidenceStatus.COMPLETE),
  lastReviewedDate: z.string().trim().optional()
});

export const systemCardSchema = z.object({
  system: createSystemSchema,
  answers: z
    .record(z.string().trim().min(1).max(160), z.string().trim().min(1).max(4000))
    .refine((value) => Object.keys(value).length <= 50, "Too many questionnaire answers")
    .default({}),
  evidence: z.array(evidenceCardSchema).max(50, "Too many evidence items").default([])
});

export type SystemCard = z.infer<typeof systemCardSchema>;
export type SystemCardEvidence = z.infer<typeof evidenceCardSchema>;

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

function parseSimpleYamlObject(yamlBlock: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of yamlBlock.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

function parseMarkdownSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = body.split(/\n(?=##\s+)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("## ")) {
      continue;
    }
    const lines = trimmed.split("\n");
    const heading = lines[0].replace(/^##\s+/, "").trim().toLowerCase();
    const content = lines.slice(1).join("\n").trim();
    if (!content) {
      continue;
    }
    sections[heading] = content;
  }
  return sections;
}

const MARKDOWN_QUESTION_MAP: Record<string, KnownQuestionKey> = {
  overview: "overview-main-function",
  "system overview": "overview-main-function",
  purpose: "purpose-use-case",
  "intended purpose": "purpose-use-case",
  "data sources": "data-sources-list",
  data: "data-sources-list",
  model: "model-details-architecture",
  "model details": "model-details-architecture",
  "risk controls": "risk-controls-mitigations",
  risks: "risk-controls-mitigations",
  oversight: "oversight-escalation",
  "human oversight": "oversight-escalation",
  monitoring: "monitoring-approach",
  incidents: "incident-response-plan",
  "incident handling": "incident-response-plan",
  vendors: "vendor-third-party-list",
  "third party": "vendor-third-party-list",
  security: "security-access-controls",
  "change management": "change-management-process"
};

/**
 * Parse a JSON system card or a Markdown model/system card with YAML frontmatter.
 */
export function parseSystemCard(raw: string):
  | { ok: true; card: SystemCard }
  | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "System card content is empty." };
  }
  if (Buffer.byteLength(trimmed, "utf8") > MAX_SYSTEM_CARD_BYTES) {
    return { ok: false, message: "System card exceeds the 100 KB limit." };
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsedJson = JSON.parse(trimmed) as unknown;
      const parsed = systemCardSchema.safeParse(parsedJson);
      if (!parsed.success) {
        return {
          ok: false,
          message: parsed.error.issues[0]?.message || "Invalid system card JSON."
        };
      }
      return { ok: true, card: parsed.data };
    } catch {
      return { ok: false, message: "System card JSON could not be parsed." };
    }
  }

  const match = trimmed.match(FRONTMATTER_RE);
  if (!match) {
    return {
      ok: false,
      message:
        "Markdown system cards require YAML frontmatter between --- fences, plus ## sections for answers."
    };
  }

  const meta = parseSimpleYamlObject(match[1]);
  const sections = parseMarkdownSections(match[2]);

  const systemInput = {
    systemName: meta.systemName || meta.name || "",
    owner: meta.owner || "",
    businessPurpose: meta.businessPurpose || meta.purpose || sections.purpose || "",
    deploymentStatus: meta.deploymentStatus || DeploymentStatus.PLANNED,
    geography: meta.geography || "",
    modelProviderDetails: meta.modelProviderDetails || meta.model || sections.model || "",
    humanOversightDescription:
      meta.humanOversightDescription || meta.oversight || sections.oversight || sections["human oversight"] || "",
    intendedUsers: meta.intendedUsers || "",
    affectedStakeholders: meta.affectedStakeholders || "",
    riskCategory: meta.riskCategory || RiskCategory.LIMITED,
    versionReleaseIdentifier: meta.versionReleaseIdentifier || meta.version || "imported-v1"
  };

  const answers: Record<string, string> = {};
  for (const [heading, content] of Object.entries(sections)) {
    const questionKey = MARKDOWN_QUESTION_MAP[heading];
    if (questionKey) {
      answers[questionKey] = content;
    }
  }

  const evidence: SystemCardEvidence[] = [];
  if (meta.evidenceUrl) {
    evidence.push({
      title: meta.evidenceTitle || "Imported evidence link",
      description: meta.evidenceDescription || "Evidence imported from system card frontmatter.",
      type: EvidenceType.URL,
      sourceUrl: meta.evidenceUrl,
      sectionKey: meta.evidenceSectionKey || "risk-controls",
      owner: systemInput.owner || "Imported",
      status: EvidenceStatus.COMPLETE
    });
  }

  const parsed = systemCardSchema.safeParse({
    system: systemInput,
    answers,
    evidence
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Invalid Markdown system card."
    };
  }

  return { ok: true, card: parsed.data };
}
