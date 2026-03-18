import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null) {
  if (!value) {
    return "N/A";
  }
  return value.toISOString().slice(0, 10);
}

export async function buildMarkdownPack(systemId: string) {
  const system = await prisma.aiSystem.findUnique({
    where: { id: systemId },
    include: {
      workspace: true,
      answers: {
        include: {
          question: {
            include: {
              section: true
            }
          }
        }
      },
      evidenceItems: {
        include: {
          section: true
        },
        orderBy: { createdAt: "asc" }
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
    return null;
  }

  const lines: string[] = [];
  const generatedAt = new Date();

  lines.push("# EvidencePack AI Export");
  lines.push("");
  lines.push("## Cover Page");
  lines.push(`- Workspace: ${system.workspace.name}`);
  lines.push(`- AI System: ${system.systemName}`);
  lines.push(`- Version: ${system.versionReleaseIdentifier}`);
  lines.push(`- Generated At: ${generatedAt.toISOString()}`);
  lines.push("");
  lines.push("## System Summary");
  lines.push(`- Owner: ${system.owner}`);
  lines.push(`- Business Purpose: ${system.businessPurpose}`);
  lines.push(`- Deployment Status: ${system.deploymentStatus}`);
  lines.push(`- Geography: ${system.geography}`);
  lines.push(`- Model/Provider Details: ${system.modelProviderDetails}`);
  lines.push(`- Human Oversight: ${system.humanOversightDescription}`);
  lines.push(`- Intended Users: ${system.intendedUsers}`);
  lines.push(`- Affected Stakeholders: ${system.affectedStakeholders}`);
  lines.push(`- Risk Category: ${system.riskCategory}`);
  lines.push("");

  lines.push("## Completed Responses");
  const answersBySection = new Map<
    string,
    {
      title: string;
      items: Array<{ prompt: string; response: string }>;
    }
  >();

  for (const answer of system.answers) {
    const sectionId = answer.question.section.id;
    const sectionEntry = answersBySection.get(sectionId) ?? {
      title: answer.question.section.title,
      items: []
    };
    sectionEntry.items.push({
      prompt: answer.question.prompt,
      response: answer.response
    });
    answersBySection.set(sectionId, sectionEntry);
  }

  for (const sectionEntry of answersBySection.values()) {
    lines.push(`### ${sectionEntry.title}`);
    for (const item of sectionEntry.items) {
      lines.push(`- **Q:** ${item.prompt}`);
      lines.push(`  - **A:** ${item.response}`);
    }
    lines.push("");
  }

  lines.push("## Evidence Index");
  if (system.evidenceItems.length === 0) {
    lines.push("- No evidence attached.");
  } else {
    for (const evidenceItem of system.evidenceItems) {
      lines.push(`- ${evidenceItem.title}`);
      lines.push(`  - Section: ${evidenceItem.section?.title ?? "Unassigned"}`);
      lines.push(`  - Type: ${evidenceItem.type}`);
      lines.push(`  - Owner: ${evidenceItem.owner}`);
      lines.push(`  - Status: ${evidenceItem.status}`);
      lines.push(`  - Last Reviewed: ${formatDate(evidenceItem.lastReviewedAt)}`);
      if (evidenceItem.sourceUrl) {
        lines.push(`  - URL: ${evidenceItem.sourceUrl}`);
      }
      if (evidenceItem.filePath) {
        lines.push(`  - File: ${evidenceItem.filePath}`);
      }
    }
  }
  lines.push("");

  lines.push("## Open Gaps");
  if (system.gaps.length === 0) {
    lines.push("- No open gaps.");
  } else {
    for (const gap of system.gaps) {
      lines.push(`- [${gap.type}] ${gap.message}`);
    }
  }
  lines.push("");
  lines.push("## Timestamps");
  lines.push(`- System Created At: ${system.createdAt.toISOString()}`);
  lines.push(`- System Updated At: ${system.updatedAt.toISOString()}`);
  lines.push(`- Export Generated At: ${generatedAt.toISOString()}`);

  return {
    fileName: `${system.systemName.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase()}-evidence-pack.md`,
    content: lines.join("\n")
  };
}
