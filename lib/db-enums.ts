/** String constants stored in SQLite (Prisma enums are not supported with sqlite provider). */

export const DeploymentStatus = {
  PLANNED: "PLANNED",
  PILOT: "PILOT",
  PRODUCTION: "PRODUCTION",
  RETIRED: "RETIRED"
} as const;
export type DeploymentStatus =
  (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const RiskCategory = {
  MINIMAL: "MINIMAL",
  LIMITED: "LIMITED",
  HIGH: "HIGH",
  UNACCEPTABLE: "UNACCEPTABLE"
} as const;
export type RiskCategory = (typeof RiskCategory)[keyof typeof RiskCategory];

export const EvidenceType = {
  FILE: "FILE",
  URL: "URL"
} as const;
export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];

export const EvidenceStatus = {
  INCOMPLETE: "INCOMPLETE",
  COMPLETE: "COMPLETE"
} as const;
export type EvidenceStatus =
  (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

export const GapType = {
  MISSING_REQUIRED_SECTION: "MISSING_REQUIRED_SECTION",
  MISSING_EVIDENCE: "MISSING_EVIDENCE",
  STALE_EVIDENCE: "STALE_EVIDENCE",
  UNANSWERED_QUESTION: "UNANSWERED_QUESTION"
} as const;
export type GapType = (typeof GapType)[keyof typeof GapType];

export const GapStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED"
} as const;
export type GapStatus = (typeof GapStatus)[keyof typeof GapStatus];

export const ExportFormat = {
  MARKDOWN: "MARKDOWN"
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ExportStatus = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
} as const;
export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];
