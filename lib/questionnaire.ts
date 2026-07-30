/**
 * The questionnaire taxonomy: the sections and questions every assessed system answers.
 *
 * This is deliberately rulebook-neutral. Rulebooks map their obligations onto these
 * section keys, which is what lets a single questionnaire serve a regulation, a security
 * framework, and an internal readiness review without re-interviewing the user.
 * Adding a section here requires updating the rulebooks that should reference it.
 */
export const QUESTIONNAIRE_SECTIONS = [
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

export const QUESTIONNAIRE_SECTION_KEYS: readonly string[] = QUESTIONNAIRE_SECTIONS.map(
  (section) => section.sectionKey
);
