---
systemName: EU Resume Ranker
owner: Talent Platform
businessPurpose: Rank applicant resumes for recruiter shortlist review in EU hiring workflows.
deploymentStatus: PILOT
geography: EU
modelProviderDetails: Hosted embedding + reranker stack (vendor-y v3)
humanOversightDescription: Recruiters must approve every shortlist before candidates are contacted.
intendedUsers: Internal recruiting operations
affectedStakeholders: Applicants, hiring managers, HR compliance
riskCategory: HIGH
versionReleaseIdentifier: resume-ranker-v0.9
evidenceUrl: https://example.com/resume-ranker-bias-report
evidenceTitle: Bias test report
evidenceSectionKey: risk-controls
---

## Overview
Ranks resumes against a job description and returns a shortlist with rationale snippets.

## Purpose
Reduce recruiter triage time while preserving human hiring decisions.

## Data Sources
Candidate CV text, job descriptions, recruiter-entered must-have skills.

## Model
Embedding retrieval plus cross-encoder rerank with policy filters.

## Risk Controls
Demographic slice testing, confidence thresholds, and recruiter approval gates.

## Human Oversight
Recruiters can discard rankings and escalate disputed cases to compliance.

## Monitoring
Weekly score-distribution drift checks and false-positive sampling.

## Incident Handling
Incidents follow the HR IR playbook with temporary ranking freeze capability.

## Vendors
Managed inference host and document parsing vendor.

## Security
SSO, least-privilege roles, and access audit logs.

## Change Management
Model and prompt changes require ticket approval and offline eval sign-off.
