import { PrismaClient } from "@prisma/client";
import {
  DeploymentStatus,
  EvidenceStatus,
  EvidenceType,
  RiskCategory
} from "../lib/db-enums";
import { computeGapData, recomputeGaps } from "../lib/gaps";
import { computeScoreBreakdown } from "../lib/scoring";
import { getActiveRulebook } from "../lib/rulebook";
import { QUESTIONNAIRE_SECTIONS } from "../lib/questionnaire";

const prisma = new PrismaClient();
const SAMPLE = "[SAMPLE DATA]";

const sectionSeeds = QUESTIONNAIRE_SECTIONS;

async function seedQuestionnaire() {
  for (const sectionSeed of sectionSeeds) {
    const section = await prisma.questionnaireSection.upsert({
      where: { sectionKey: sectionSeed.sectionKey },
      update: {
        title: sectionSeed.title,
        displayOrder: sectionSeed.displayOrder
      },
      create: {
        sectionKey: sectionSeed.sectionKey,
        title: sectionSeed.title,
        displayOrder: sectionSeed.displayOrder
      }
    });

    for (const questionSeed of sectionSeed.questions) {
      await prisma.question.upsert({
        where: { questionKey: questionSeed.questionKey },
        update: {
          sectionId: section.id,
          prompt: questionSeed.prompt,
          required: questionSeed.required,
          displayOrder: questionSeed.displayOrder
        },
        create: {
          sectionId: section.id,
          questionKey: questionSeed.questionKey,
          prompt: questionSeed.prompt,
          required: questionSeed.required,
          displayOrder: questionSeed.displayOrder
        }
      });
    }
  }
}

async function seedDemoScenario() {
  const user = await prisma.user.upsert({
    where: { email: "sample.owner@truecite.local" },
    update: { name: `${SAMPLE} Governance Owner` },
    create: {
      email: "sample.owner@truecite.local",
      name: `${SAMPLE} Governance Owner`
    }
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: "sample-workspace-id" },
    update: {
      name: `${SAMPLE} Truecite Workspace`,
      ownerId: user.id
    },
    create: {
      id: "sample-workspace-id",
      name: `${SAMPLE} Truecite Workspace`,
      ownerId: user.id
    }
  });

  const existingSystem = await prisma.aiSystem.findFirst({
    where: {
      workspaceId: workspace.id,
      systemName: `${SAMPLE} EU HR Screening Assistant`
    }
  });

  const system = existingSystem
    ? await prisma.aiSystem.update({
        where: { id: existingSystem.id },
        data: {
          owner: `${SAMPLE} Governance Owner`,
          businessPurpose: "Screen candidate applications for EU-based hiring workflows.",
          deploymentStatus: DeploymentStatus.PILOT,
          geography: "EU",
          modelProviderDetails: "Open-weight model hosted by approved vendor (v2026.03).",
          humanOversightDescription: "Recruiters review and approve all recommendation outputs.",
          intendedUsers: "Internal recruiting operations staff",
          affectedStakeholders: "Job applicants, recruiting managers, HR compliance team",
          riskCategory: RiskCategory.HIGH,
          versionReleaseIdentifier: "demo-v1.0"
        }
      })
    : await prisma.aiSystem.create({
        data: {
          workspaceId: workspace.id,
          systemName: `${SAMPLE} EU HR Screening Assistant`,
          owner: `${SAMPLE} Governance Owner`,
          businessPurpose: "Screen candidate applications for EU-based hiring workflows.",
          deploymentStatus: DeploymentStatus.PILOT,
          geography: "EU",
          modelProviderDetails: "Open-weight model hosted by approved vendor (v2026.03).",
          humanOversightDescription: "Recruiters review and approve all recommendation outputs.",
          intendedUsers: "Internal recruiting operations staff",
          affectedStakeholders: "Job applicants, recruiting managers, HR compliance team",
          riskCategory: RiskCategory.HIGH,
          versionReleaseIdentifier: "demo-v1.0"
        }
      });

  const seededAnswers = [
    {
      questionKey: "overview-main-function",
      response:
        "The system scores incoming candidate applications and summarizes strengths and risks for recruiter review."
    },
    {
      questionKey: "purpose-use-case",
      response:
        "Reduce manual triage time while keeping humans in control of all hiring decisions."
    },
    {
      questionKey: "data-sources-list",
      response: "Candidate CV text, job descriptions, and recruiter-entered role requirements."
    },
    {
      questionKey: "model-details-architecture",
      response: "Hosted transformer model with prompt templates and guardrail policy checks."
    },
    {
      questionKey: "risk-controls-mitigations",
      response:
        "Bias testing, confidence thresholds, recruiter approval gates, and monthly risk review."
    },
    {
      questionKey: "monitoring-approach",
      response: "Weekly drift checks with alerting for score-distribution shifts."
    },
    {
      questionKey: "incident-response-plan",
      response: "Incidents are triaged by severity and handled through the internal IR playbook."
    },
    {
      questionKey: "vendor-third-party-list",
      response: "Managed cloud compute provider and document-parsing vendor."
    },
    {
      questionKey: "security-access-controls",
      response: "Role-based access, SSO for internal users, and audit logging."
    },
    {
      questionKey: "change-management-process",
      response: "Changes require ticket approval, testing sign-off, and release notes."
    }
  ];

  for (const seededAnswer of seededAnswers) {
    const question = await prisma.question.findUnique({
      where: { questionKey: seededAnswer.questionKey }
    });
    if (!question) {
      continue;
    }

    await prisma.answer.upsert({
      where: {
        systemId_questionId: {
          systemId: system.id,
          questionId: question.id
        }
      },
      update: { response: seededAnswer.response },
      create: {
        systemId: system.id,
        questionId: question.id,
        response: seededAnswer.response
      }
    });
  }

  await prisma.evidenceItem.deleteMany({
    where: {
      systemId: system.id,
      title: {
        startsWith: SAMPLE
      }
    }
  });

  const monitoringSection = await prisma.questionnaireSection.findUnique({
    where: { sectionKey: "monitoring" }
  });
  const riskControlsSection = await prisma.questionnaireSection.findUnique({
    where: { sectionKey: "risk-controls" }
  });

  await prisma.evidenceItem.createMany({
    data: [
      {
        systemId: system.id,
        sectionId: riskControlsSection?.id,
        title: `${SAMPLE} Bias Test Report`,
        description: "Quarterly fairness analysis report.",
        type: EvidenceType.URL,
        sourceUrl: "https://example.com/sample-bias-report",
        owner: `${SAMPLE} Governance Owner`,
        status: EvidenceStatus.COMPLETE,
        lastReviewedAt: new Date()
      },
      {
        systemId: system.id,
        sectionId: monitoringSection?.id,
        title: `${SAMPLE} Monitoring SOP`,
        description: "Operational monitoring procedure.",
        type: EvidenceType.FILE,
        filePath: "/uploads/sample-monitoring-sop.pdf",
        owner: `${SAMPLE} Governance Owner`,
        status: EvidenceStatus.COMPLETE,
        lastReviewedAt: new Date("2025-01-10T00:00:00.000Z")
      }
    ]
  });

  await seedSampleAssessment(system.id);
}

async function seedSampleAssessment(systemId: string) {
  const existingAssessment = await prisma.assessment.findFirst({
    where: { systemId },
    orderBy: { createdAt: "desc" }
  });

  if (existingAssessment) {
    return;
  }

  await recomputeGaps(systemId);
  const { metrics, sections } = await computeGapData(systemId);
  const rulebook = getActiveRulebook();
  const breakdown = computeScoreBreakdown(metrics, sections, "scoring_v2", rulebook);
  const retrievedClauses = [
    {
      clauseRef: "Art 9",
      title: "Risk management system",
      distance: 0.19,
      evidenceQuote: "maintain a risk management system that runs as a continuous, iterative process"
    },
    {
      clauseRef: "Art 14",
      title: "Human oversight",
      distance: 0.16,
      evidenceQuote: "decide not to use the system or to disregard, override, or reverse its output"
    }
  ];

  await prisma.assessment.create({
    data: {
      systemId,
      score: breakdown.score,
      level: breakdown.level,
      summary:
        "The walkthrough documents meaningful human oversight and risk controls, but open evidence gaps keep it from being review-ready. Close the remaining gaps and refresh stale support before relying on the pack.",
      recommendations: JSON.stringify([
        {
          text: "Document how reviewers disregard, override, or reverse system output during hiring decisions.",
          clauseRef: "Art 14",
          evidenceQuote: retrievedClauses[1].evidenceQuote
        },
        {
          text: "Record a recurring lifecycle review for the risk-management process and its residual risks.",
          clauseRef: "Art 9",
          evidenceQuote: retrievedClauses[0].evidenceQuote
        }
      ]),
      confidence: "high",
      citations: JSON.stringify(retrievedClauses.map(({ evidenceQuote: _quote, ...clause }) => clause)),
      scoringVersion: breakdown.scoringVersion,
      corpusVersion: rulebook.id,
      scoreBreakdown: JSON.stringify(breakdown)
    }
  });

  await prisma.assessmentRun.create({
    data: {
      systemId,
      status: "success",
      stage: "seeded-demo",
      scoringVersion: breakdown.scoringVersion,
      corpusVersion: rulebook.id,
      retrievedCount: retrievedClauses.length,
      droppedCitations: 1,
      retrievalLog: JSON.stringify(retrievedClauses)
    }
  });
}

async function main() {
  await seedQuestionnaire();
  await seedDemoScenario();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
