import { PrismaClient, DeploymentStatus, EvidenceStatus, EvidenceType, RiskCategory } from "@prisma/client";

const prisma = new PrismaClient();
const SAMPLE = "[SAMPLE DATA]";

const sectionSeeds = [
  {
    sectionKey: "system-overview",
    title: "System Overview",
    displayOrder: 1,
    questions: [
      {
        questionKey: "overview-main-function",
        prompt: "Describe the AI system and its primary function.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "intended-purpose",
    title: "Intended Purpose",
    displayOrder: 2,
    questions: [
      {
        questionKey: "purpose-use-case",
        prompt: "What business outcome does this system support?",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "data-sources",
    title: "Data Sources",
    displayOrder: 3,
    questions: [
      {
        questionKey: "data-sources-list",
        prompt: "List all data sources used by this system.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "model-details",
    title: "Model Details",
    displayOrder: 4,
    questions: [
      {
        questionKey: "model-details-architecture",
        prompt: "Provide model/provider details and version information.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "risk-controls",
    title: "Risk Controls",
    displayOrder: 5,
    questions: [
      {
        questionKey: "risk-controls-mitigations",
        prompt: "What controls are in place to reduce identified risks?",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "human-oversight",
    title: "Human Oversight",
    displayOrder: 6,
    questions: [
      {
        questionKey: "oversight-escalation",
        prompt: "Describe human escalation and override procedures.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "monitoring",
    title: "Monitoring",
    displayOrder: 7,
    questions: [
      {
        questionKey: "monitoring-approach",
        prompt: "How is performance and drift monitored in production?",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "incident-handling",
    title: "Incident Handling",
    displayOrder: 8,
    questions: [
      {
        questionKey: "incident-response-plan",
        prompt: "Describe incident detection, triage, and remediation steps.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "vendor-third-party",
    title: "Vendor / Third-Party Dependencies",
    displayOrder: 9,
    questions: [
      {
        questionKey: "vendor-third-party-list",
        prompt: "List external vendors and third-party services.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "security-access",
    title: "Security and Access",
    displayOrder: 10,
    questions: [
      {
        questionKey: "security-access-controls",
        prompt: "Document authentication, authorization, and access controls.",
        required: true,
        displayOrder: 1
      }
    ]
  },
  {
    sectionKey: "change-management",
    title: "Change Management",
    displayOrder: 11,
    questions: [
      {
        questionKey: "change-management-process",
        prompt: "Describe change approval and release governance.",
        required: true,
        displayOrder: 1
      }
    ]
  }
] as const;

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
    where: { email: "sample.owner@evidencepack.local" },
    update: { name: `${SAMPLE} Governance Owner` },
    create: {
      email: "sample.owner@evidencepack.local",
      name: `${SAMPLE} Governance Owner`
    }
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: "sample-workspace-id" },
    update: {
      name: `${SAMPLE} EvidencePack Workspace`,
      ownerId: user.id
    },
    create: {
      id: "sample-workspace-id",
      name: `${SAMPLE} EvidencePack Workspace`,
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
