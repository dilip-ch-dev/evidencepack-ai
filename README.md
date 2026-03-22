# EvidencePack

**EvidencePack** is a full-stack workflow product for documenting AI systems through structured evidence, gap tracking, and exportable governance packs.

It helps a team move from scattered notes, forms, and compliance fragments to a single working flow:

**create system → complete questionnaire → attach evidence → review gaps → export pack**

This project is built around a real and growing operational need in 2026: teams shipping AI systems need a practical way to capture what a system does, who owns it, what evidence supports it, and what is still missing.

## What EvidencePack does

EvidencePack provides a focused workflow for internal AI system documentation:

- create and register an AI system
- complete a guided governance questionnaire
- attach supporting evidence by section
- automatically surface missing gaps
- export a usable markdown evidence pack

The goal is not to be a giant “AI governance platform.”  
The goal is to make documentation and evidence collection actually usable.

## Current product status

The current version already supports the core loop end to end:

- AI system creation
- seeded multi-section questionnaire
- evidence attachment via URL or file
- automatic gap generation for missing evidence / missing responses
- markdown export pack generation
- SQLite-based local development
- working Next.js + Prisma full-stack flow

## Why this matters

AI documentation work is usually fragmented across:
- spreadsheets
- internal docs
- compliance notes
- screenshots
- ad hoc evidence folders

That creates three recurring problems:

1. teams don’t know what documentation is still missing  
2. evidence is hard to trace back to the right system or section  
3. exports for review or handoff are painful and manual  

EvidencePack turns that into one structured workflow.

## Core workflow

### 1. Create system
Register an AI system with key metadata such as:
- name
- owner
- purpose
- geography
- model/provider
- stakeholders
- oversight details

### 2. Complete questionnaire
Answer sectioned questions across the system lifecycle and governance process.

### 3. Attach evidence
Attach URL-based or file-based evidence to specific sections.

### 4. Review open gaps
See what is still missing:
- unanswered questions
- missing evidence
- stale evidence

### 5. Export pack
Generate a markdown evidence pack containing:
- system summary
- responses
- evidence index
- current gaps

## Stack

- **Next.js 14**
- **TypeScript**
- **Prisma**
- **SQLite** for local MVP development
- App Router
- Server Actions

## Live demo

**Coming soon**

A public deployment link will be added after the first hosted release.

## Local development

Clone the repo and run:

```bash
npm install
npm run dev
Then open:
http://localhost:3000

This project currently uses SQLite for local development.
Docker/PostgreSQL is not required for the current local workflow.

Current limitations

This is a focused first release, not a full enterprise platform.

Known limitations:

URL validation currently still relies partly on browser-native validation
no multi-user auth flow in the current app routes
no advanced gap-resolution workflow yet
no PDF export yet
no enterprise permissions or integrations yet



---

