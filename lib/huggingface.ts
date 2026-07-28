import {
  DeploymentStatus,
  EvidenceStatus,
  EvidenceType,
  RiskCategory
} from "@/lib/db-enums";
import type { SystemCard } from "@/lib/system-card";

type HfModelResponse = {
  id?: string;
  author?: string;
  sha?: string;
  pipeline_tag?: string;
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  cardData?: {
    license?: string;
    language?: string[] | string;
    datasets?: string[] | string;
    library_name?: string;
    model_name?: string;
    limitations?: string | string[];
    intended_use?: string | string[];
  };
};

function normalizeSlug(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Hugging Face URL or model id is required.");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.hostname !== "huggingface.co") {
      throw new Error("Only huggingface.co URLs are supported.");
    }

    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .filter((part) => !["tree", "blob", "resolve"].includes(part));

    if (parts.length < 2) {
      throw new Error("Could not detect a model slug from the Hugging Face URL.");
    }

    return `${parts[0]}/${parts[1]}`;
  }

  if (!trimmed.includes("/")) {
    throw new Error("Use a full Hugging Face URL or owner/model slug.");
  }

  return trimmed;
}

function toArray(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function sentence(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value.join(" ") : value;
  return raw?.trim() || fallback;
}

function inferRisk(tags: string[]) {
  const joined = tags.join(" ").toLowerCase();
  if (/medical|health|biometric|recruit|hiring|credit|insurance|law|legal/.test(joined)) {
    return RiskCategory.HIGH;
  }
  if (/moderation|classification|detection/.test(joined)) {
    return RiskCategory.LIMITED;
  }
  return RiskCategory.LIMITED;
}

function purposeFromPipeline(pipelineTag: string | undefined) {
  if (!pipelineTag) {
    return "Evaluate and document a publicly available Hugging Face model before adoption.";
  }

  const label = pipelineTag.replace(/-/g, " ");
  return `Assess governance readiness for adopting a Hugging Face ${label} model in internal AI workflows.`;
}

export async function buildSystemCardFromHuggingFace(input: string): Promise<SystemCard> {
  const slug = normalizeSlug(input);
  const response = await fetch(`https://huggingface.co/api/models/${slug}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Hugging Face model lookup failed (${response.status}).`);
  }

  const data = (await response.json()) as HfModelResponse;
  const modelId = data.id || slug;
  const tags = data.tags ?? [];
  const cardData = data.cardData ?? {};
  const pipelineTag = data.pipeline_tag || "foundation-model";
  const datasets = toArray(cardData.datasets);
  const languages = toArray(cardData.language);
  const version = data.sha?.slice(0, 7) || "hf-main";
  const owner = data.author || slug.split("/")[0] || "Hugging Face publisher";
  const license = cardData.license || "Unknown license";
  const limitations = sentence(
    cardData.limitations,
    "Review the public model card for domain-specific limitations and misuse risks."
  );
  const intendedUse = sentence(
    cardData.intended_use,
    "Use the public model card and deployment context to define intended internal use."
  );

  return {
    system: {
      systemName: `${modelId} (Hugging Face import)`,
      owner,
      businessPurpose: purposeFromPipeline(pipelineTag),
      deploymentStatus: DeploymentStatus.PILOT,
      geography: "Global / configurable",
      modelProviderDetails: [
        `Model: ${modelId}`,
        `Pipeline: ${pipelineTag}`,
        `Library: ${cardData.library_name || "unspecified"}`,
        `License: ${license}`,
        `Downloads: ${data.downloads ?? "unknown"}`,
        `Likes: ${data.likes ?? "unknown"}`
      ].join(" · "),
      humanOversightDescription:
        "Humans must review outputs before use in any regulated or user-impacting workflow.",
      intendedUsers: "ML engineers, product teams, and internal reviewers evaluating a public model.",
      affectedStakeholders: "End users of downstream applications, product owners, and compliance reviewers.",
      riskCategory: inferRisk(tags),
      versionReleaseIdentifier: version
    },
    answers: {
      "overview-main-function": `${modelId} is a publicly available Hugging Face model for ${pipelineTag.replace(/-/g, " ")}.`,
      "purpose-use-case": intendedUse,
      "data-sources-list": datasets.length > 0 ? datasets.join(", ") : "Refer to the Hugging Face model card for dataset provenance.",
      "model-details-architecture": `Imported from Hugging Face. Tags: ${tags.slice(0, 12).join(", ") || "none listed"}.`,
      "risk-controls-mitigations": "Document acceptable use, domain limits, prompt/output review, and any additional fine-tuning or guardrails before production deployment.",
      "oversight-escalation": "Assign a human reviewer for deployment decisions, output overrides, and incident escalation.",
      "monitoring-approach": "Track latency, output quality, safety incidents, and prompt failure cases after adoption.",
      "incident-response-plan": "Disable the downstream feature, roll back the model version, and notify reviewers if unsafe or materially wrong outputs are observed.",
      "vendor-third-party-list": `Hugging Face model publisher (${owner}) and any downstream inference host used for deployment.`,
      "security-access-controls": "Restrict access to inference credentials, monitor usage, and review third-party hosting controls.",
      "change-management-process": `Version-pin ${modelId} (${version}) and run offline evaluation before promotion to production.`
    },
    evidence: [
      {
        title: "Hugging Face model card",
        description: "Public model metadata and intended-use documentation.",
        type: EvidenceType.URL,
        sourceUrl: `https://huggingface.co/${modelId}`,
        sectionKey: "model-details",
        owner,
        status: EvidenceStatus.COMPLETE
      },
      {
        title: "Hugging Face config / repo metadata",
        description: `Pipeline=${pipelineTag}; languages=${languages.join(", ") || "unknown"}; lastModified=${data.lastModified ?? "unknown"}.`,
        type: EvidenceType.URL,
        sourceUrl: `https://huggingface.co/api/models/${modelId}`,
        sectionKey: "system-overview",
        owner,
        status: EvidenceStatus.COMPLETE
      },
      {
        title: "Known limitations review",
        description: limitations,
        type: EvidenceType.URL,
        sourceUrl: `https://huggingface.co/${modelId}`,
        sectionKey: "risk-controls",
        owner,
        status: EvidenceStatus.COMPLETE
      }
    ]
  };
}
