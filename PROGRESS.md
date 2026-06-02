# PROGRESS

## Architecture

- **App stack:** Next.js 14 App Router, React 18, TypeScript, Server Actions.
- **Data layer:** Prisma ORM with `@prisma/client`, datasource configured for PostgreSQL in `prisma/schema.prisma`.
- **AI integration:** Gemini via `@google/genai` in `lib/assessment.ts`.
- **Validation and domain helpers:** Zod schemas in `lib/validation.ts`, enum constants in `lib/db-enums.ts`, gap recomputation in `lib/gaps.ts`.
- **Export pipeline:** Markdown pack generation in `lib/export-pack.ts`, download route at `app/systems/[systemId]/export/route.ts`.
- **Runtime flow:** root route redirects to `/systems`; CRUD + questionnaire/evidence actions live in `app/systems/actions.ts` and `app/systems/[systemId]/actions.ts`.

### Folder Structure (current)

- `app/`
  - `layout.tsx`, `globals.css`, `page.tsx`
  - `systems/`
    - `page.tsx`, `create-system-form.tsx`, `actions.ts`, `action-state.ts`
    - `[systemId]/`
      - `page.tsx`, `question-answer-form.tsx`, `evidence-form.tsx`
      - `assessment-form.tsx`, `actions.ts`
      - `export/route.ts`
- `lib/`
  - `prisma.ts`, `workspace.ts`, `validation.ts`, `db-enums.ts`
  - `gaps.ts`, `export-pack.ts`, `assessment.ts`
- `prisma/`
  - `schema.prisma`, `seed.ts`
  - `migrations/20260320014401_init_sqlite/`
- Root docs/config: `README.md`, `PRODUCT_SPEC.md`, `package.json`, `tsconfig.json`, `next.config.mjs`, `docker-compose.yml`

## Features

- Create/list AI systems in a primary workspace.
- Capture system metadata (owner, purpose, deployment status, geography, provider details, oversight, stakeholders, risk, version).
- Complete a seeded multi-section questionnaire with per-question save.
- Attach evidence by URL or file, with owner/status/last-reviewed metadata.
- Recompute and display open gaps (missing evidence, unanswered required questions, stale evidence, missing required section responses).
- Export Markdown evidence packs with system summary, responses, evidence index, open gaps, timestamps, and latest AI readiness assessment when available.
- Generate AI Readiness Assessment using Gemini (`score`, `level`, `summary`, `recommendations`) and render latest result on system detail pages.

## Changelog

### 2026-06-01

- Upgraded assessment generation to retrieval-grounded output with citations:
  - `lib/assessment.ts` now embeds a retrieval query from system attributes + open gaps using Gemini `RETRIEVAL_QUERY`, fetches top 4 `RegulationChunk` rows via raw SQL (`ORDER BY embedding <=> $query::vector LIMIT 4`), injects retrieved clauses into the prompt, and requires recommendation-level `articleRef` citations.
  - Added assessment confidence handling (`low` when retrieval similarity is weak), persisted with each assessment.
  - Persisted retrieved citations on each assessment for traceability.
  - Added `parseCitations` support and upgraded recommendation parsing to cited recommendation objects.
  - Updated system detail UI to show cited articles per recommendation and a low-confidence indicator where applicable.
  - Updated markdown export to include cited recommendations, confidence, and retrieved citation details.
- Extended `Assessment` schema with `confidence` and `citations` fields to store grounding metadata.
- Added grounded-retrieval data layer (no existing routes changed):
  - Enabled pgvector on Neon via `scripts/setup-pgvector.ts` (`CREATE EXTENSION IF NOT EXISTS vector` through Prisma `$executeRawUnsafe`).
  - Added Prisma `RegulationChunk` model (`id`, `articleRef`, `title`, `text`, `createdAt`) with an `embedding` column typed `Unsupported("vector(768)")`; synced with `prisma db push`.
  - Authored `data/eu-ai-act-key-provisions.md` with faithful summaries of EU AI Act high-risk obligations (Art 9, 10, 11+Annex IV, 12, 13, 14, 15).
  - Added `scripts/ingest-regulation.ts` that chunks per article section, embeds with `@google/genai` (`gemini-embedding-001`, `RETRIEVAL_DOCUMENT`, `outputDimensionality: 768`), and inserts rows via raw SQL casting the float array to `::vector`. Confirmed the embedding float array lives at `response.embeddings[0].values` before writing the insert loop.
  - Verification gate: ingest produced 7 `RegulationChunk` rows, all with non-null 768-dim embeddings.
- Added project progress tracking in `PROGRESS.md` with architecture, features, and changelog sections.
- Added standing maintenance rule: at the end of every task, append a dated changelog entry in this file describing what changed.

### 2026-05-31

- Added AI Readiness Assessment capability:
  - Prisma `Assessment` model linked to `AiSystem`.
  - Gemini-backed generation in `lib/assessment.ts` using `@google/genai`.
  - Server action wiring in `app/systems/[systemId]/actions.ts`.
  - UI section/form on `app/systems/[systemId]/page.tsx`.
  - Markdown export inclusion in `lib/export-pack.ts`.
