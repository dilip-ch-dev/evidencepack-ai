# Product Spec — EvidencePack AI

## One-line product definition
EvidencePack AI is a web app that helps organizations generate and maintain audit-ready documentation and evidence packs for individual AI systems under the EU AI Act and ISO/IEC 42001.

## Core promise
Turn one AI system into a structured, reviewable evidence pack with:
1. required system metadata,
2. risk and governance documentation,
3. attached evidence and traceability,
4. missing-item detection,
5. exportable pack for internal review or external audit preparation.

## Target user
Primary:
- AI compliance consultants
- mid-market SaaS companies selling AI-enabled products into Europe
- internal AI governance / risk / compliance owners

Not targeting first:
- giant enterprises with long procurement cycles
- generic consumers
- pure legal teams expecting legal advice

## Problem
Organizations using or shipping AI systems need structured documentation, evidence, and governance records.
Today that work is fragmented across docs, spreadsheets, tickets, policies, Slack, Notion, and email.
The result is:
- missing evidence,
- inconsistent documentation,
- slow audit preparation,
- unclear ownership,
- poor change tracking.

## MVP scope
The MVP supports ONE workspace and multiple AI systems inside it.

For each AI system, users can:
1. create a system record,
2. answer a structured questionnaire,
3. upload or link evidence,
4. view missing requirements,
5. generate an exportable evidence pack.

## What the MVP must do
### 1. AI system registry
Each AI system record stores:
- system name
- owner
- business purpose
- deployment status
- geography
- model/provider details
- human oversight description
- intended users
- affected stakeholders
- risk category
- version / release identifier

### 2. Structured questionnaire
Sections:
- system overview
- intended purpose
- data sources
- model details
- risk controls
- human oversight
- monitoring
- incident handling
- vendor / third-party dependencies
- security and access
- change management

### 3. Evidence management
Users can attach evidence items to sections.
Each evidence item has:
- title
- description
- type
- file or URL
- owner
- status
- last reviewed date

### 4. Gap detection
The app must flag:
- missing required sections
- missing evidence
- stale evidence
- unanswered questions

### 5. Export
Generate an exportable pack in Markdown first.
PDF can come later.
Export must include:
- cover page
- system summary
- completed responses
- evidence index
- open gaps
- timestamps

## Non-goals for MVP
- no legal advice engine
- no automated legal interpretation
- no enterprise SSO
- no multi-standard rules engine
- no workflow automation platform
- no sales website builder
- no billing in phase 1
- no integrations in phase 1 except file upload and URL references

## User flow
1. User creates workspace
2. User adds AI system
3. User completes questionnaire
4. User uploads/links evidence
5. App computes missing items
6. User reviews readiness dashboard
7. User exports pack

## MVP success criteria
- a user can create one AI system and complete an evidence pack end-to-end
- all responses persist correctly
- evidence can be attached and indexed
- missing-item logic works
- export is usable and professional
- demo can be completed in under 5 minutes

## Data model
Entities:
- User
- Workspace
- AISystem
- QuestionnaireSection
- Question
- Answer
- EvidenceItem
- Gap
- ExportJob

## UX requirements
- clean enterprise look
- zero clutter
- left sidebar with sections
- progress indicator
- status chips for complete / incomplete / stale
- evidence index visible at all times

## Tech requirements
- Next.js + TypeScript
- PostgreSQL + Prisma
- server-side validation
- clean repo structure
- seed data for demo
- runnable locally with one command
- no fake APIs
- all sample data clearly marked

## First demo scenario
Create a fictional HR screening AI system sold in the EU.
Complete enough information to show:
- system description
- governance owner
- evidence upload
- missing oversight documentation
- exportable pack

## Acceptance criteria for first build
- app boots locally
- database migrations work
- can create AI system
- can answer questionnaire
- can attach evidence
- can compute missing items
- can export a Markdown pack