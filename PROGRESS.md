# PROGRESS

> Public engineering log. Older entries describe the state at the time they were written and are intentionally retained as history; `README.md`, the current schema, tests, and CI are authoritative for present behavior. Reviewed 2026-08-11: no secrets or private conversation transcripts are present.

## Architecture

- **App stack:** Next.js 14 App Router, React 18, TypeScript, Server Actions.
- **Data layer:** Prisma ORM with `@prisma/client`, datasource configured for PostgreSQL (Neon) in `prisma/schema.prisma`. Schema is synced via `prisma db push` (no migration history). The `pgvector` extension backs an `Unsupported("vector(768)")` embedding column on `RegulationChunk`.
- **Grounded RAG assessment:** `lib/assessment.ts` embeds a retrieval query (Gemini `RETRIEVAL_QUERY`, 768-dim), fetches the nearest `RegulationChunk` rows by cosine distance (`embedding <=> $query::vector`), and grounds the Gemini call on those clauses. The model returns only the narrative `summary` and `articleRef`-cited `recommendations`; readiness `score`/`level` are computed deterministically (see below). Retrieved `citations` and a retrieval-distance-based `confidence` are persisted per assessment.
- **Deterministic scoring:** `computeReadinessScore` / `deriveLevel` in `lib/assessment.ts` derive a 0–100 score from the system's own data — questionnaire completion ratio (weight 60) + evidence coverage across sections (weight 40), minus penalties for stale evidence and missing-evidence sections — reusing `GapMetrics` from `computeGapData` in `lib/gaps.ts`. Level bands: `<40` Not Ready, `40–75` Partially Ready, `>75` Audit-Ready.
- **Regulation knowledge base:** `data/eu-ai-act-key-provisions.md` holds faithful summaries of EU AI Act high-risk obligations; `scripts/setup-pgvector.ts` enables the extension and `scripts/ingest-regulation.ts` chunks + embeds (`gemini-embedding-001`, `RETRIEVAL_DOCUMENT`) and inserts rows.
- **AI integration:** Gemini via `@google/genai` in `lib/assessment.ts` (chat model `gemini-2.5-flash`, embeddings `gemini-embedding-001`).
- **Validation and domain helpers:** Zod schemas in `lib/validation.ts`, enum constants in `lib/db-enums.ts`, gap + coverage-metric computation in `lib/gaps.ts` (`computeGapData`, `recomputeGaps`).
- **Export pipeline:** Markdown pack generation in `lib/export-pack.ts`, download route at `app/systems/[systemId]/export/route.ts`.
- **Smoke test:** `scripts/smoke-test.ts` (`npm run smoke`) runs the full pipeline against the seeded `[SAMPLE DATA] EU HR Screening Assistant` and prints chunk count, retrieved clauses (articleRef + distance), score/level/confidence, cited recommendations, and explicit PASS/FAIL checks.
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
  - `schema.prisma`, `seed.ts` (schema synced via `prisma db push`; no migrations directory)
- `data/`
  - `eu-ai-act-key-provisions.md`
- `scripts/`
  - `setup-pgvector.ts`, `ingest-regulation.ts`, `smoke-test.ts`
- Root docs/config: `README.md`, `PRODUCT_SPEC.md`, `package.json`, `tsconfig.json`, `next.config.mjs`

## Features

- Create/list AI systems in a primary workspace.
- Capture system metadata (owner, purpose, deployment status, geography, provider details, oversight, stakeholders, risk, version).
- Complete a seeded multi-section questionnaire with per-question save.
- Attach evidence by URL or file, with owner/status/last-reviewed metadata.
- Import JSON/Markdown system cards to draft registry fields, answers, and evidence.
- Recompute and display open gaps (missing evidence, unanswered required questions, stale evidence, missing required section responses).
- Export Markdown evidence packs with system summary, responses, evidence index, open gaps, timestamps, and latest AI readiness assessment when available.
- Generate a grounded AI Readiness Assessment: a deterministic, data-derived `score`/`level` paired with a Gemini-generated `summary` and EU AI Act `articleRef`-cited `recommendations`, retrieved from a pgvector regulation knowledge base. Citations and a retrieval-confidence flag are stored and rendered on system detail pages and in exports.
- Fail-closed citation gate drops recommendations that cite articles outside the retrieved set.
- Public REST API (`/api/v1/*`) for list/create/import/evidence/assess plus optional demo reset.
- Shareable assessment page at `/systems/[systemId]/assessment`.
- Offline unit tests + citation eval corpus gated in CI.
- Verify the end-to-end RAG pipeline with a CLI smoke test (`npm run smoke`).

## Changelog

### 2026-08-11

- Added opaque browser-session workspace isolation and ownership checks across pages, APIs, server actions, assessment history, and exports; retained the curated demo as a shared read-only workspace.
- Added database-backed rate limits for assessment generation and both import paths.
- Replaced reference-only narrative gating with fail-closed prose grounding: summaries and recommendations require a retrieved clause reference plus a verbatim supporting quote found in that clause.
- Restricted evidence URLs to HTTP(S), bounded imported text/card sizes, and disabled hosted file uploads until private object storage exists.
- Removed database writes from detail-page rendering and download GETs; added friendly error/not-found pages.
- Added a five-stage workflow stepper, action-specific pending states, clearer questionnaire-vs-readiness labeling, actionable gaps, a How-it-works page, legal pages, responsive/mobile fixes, and reduced-motion support.
- Added metadata, favicon, generated social card, security headers, a production build gate, committed-eval verification, migration SQL, and an MIT license.
- Documented the negative ablation honestly: gap-aware boost and no-boost retrieval metrics remain identical on the committed 36-case golden set.

### 2026-08-10

- Rebranded audience-facing product name to **Truecite** (UI, docs, exports, health service id).

### 2026-07-30

- UI / UX polish for portfolio demos:
  - Brand landing at `/` (ink + signal teal, Fraunces/Manrope) instead of a bare redirect.
  - Sticky site header; systems hub decluttered (advanced create collapsed).
  - System workspace restores PRODUCT_SPEC layout: left section nav + progress, gaps-first main column, always-visible evidence rail.
  - Shareable assessment page cleaned up as the recruiter handoff artifact.
- Pluggable rulebook engine (option 23):
  - `lib/rulebook.ts` loads manifests from `rulebooks/<id>/`; shipped EU AI Act, OWASP LLM Top 10, LLM Prod Readiness.
  - Generalized ingest (`scripts/ingest-rulebook.ts`), citation aliases, `clauseRef` rename with legacy `articleRef` read compat.
- Real evaluation harness (option 24):
  - Offline gate + retrieval suites (`eval/gate-cases.json`, `eval/retrieval-golden.json`), metrics, ablation, committed snapshot.
  - Ablation caught a gap-boost demotion of unscored clauses (Art 72); fixed via routing rules + regression guard.
- Structural assessment diff (option 25):
  - `lib/assessment-diff.ts` attributes score/recommendation movement to scoring version, corpus, inputs, or model.
  - CLI (`npm run diff`), API (`GET /api/v1/systems/:id/diff`), system-page UI section.
- Failure taxonomy (option 26):
  - `lib/failure-taxonomy.ts` + labeled corpus in `eval/annotations.json`.
  - `npm run taxonomy` / `npm run annotate` produce a fix queue grouped by where the change goes.

### 2026-07-28

- Senior ML/systems upgrade pack:
  - Expanded regulation corpus to `eu-ai-act-v2` (Arts 6/8/9–16/26/72) with keywords + versioned ingest.
  - Added hybrid retrieval (`lib/retrieval.ts`: vector + keyword + gap-aware boost).
  - Added `scoring_v2` obligation coverage matrix (`lib/scoring.ts`, `lib/obligations.ts`) with documentation vs control readiness.
  - Persisted `scoringVersion`, `corpusVersion`, `scoreBreakdown` on Assessment; added `AssessmentRun` observability + `/api/v1/systems/:id/runs`.
  - UI: Why this score, obligation coverage, assessment history/delta, shareable link.
  - Expanded offline eval corpus; health endpoint reports scoring/corpus versions.
- Post-merge production verification + polish:
  - Confirmed production serves demo banner, import UI, `/api/v1/health`, systems API, shareable assessment, and Markdown export.
  - Pointed README + demo banner at canonical production URLs (removed temporary preview wording).

### 2026-07-27

- Follow-up hardening after preview verification:
  - Added `GET /api/v1/health` (DB + regulation chunk readiness).
  - Extended smoke test to assert recommendation citations ⊆ retrieved clauses.
  - Updated `PRODUCT_SPEC.md` for system-card/API phase 1.5.
  - Documented live preview URL + shareable sample assessment in README/demo banner.
- Productized the demo/use-case path for recruiters and external systems:
  - Rewrote `README.md` (removed merge-conflict leftovers) with live demo URL, 5-minute walkthrough, system-card connect path, and API docs.
  - Added demo banner + system-card import UI on `/systems`.
  - Added `lib/system-card.ts` + `examples/system-card.json` / `.md` for JSON and Markdown+YAML imports.
  - Added shared service helpers in `lib/services/systems.ts`.
  - Added public API routes under `app/api/v1/` (systems CRUD-ish, evidence, assess, import, demo reset) with optional `EVIDENCEPACK_API_KEY` / `DEMO_RESET_KEY`.
  - Added shareable assessment page at `app/systems/[systemId]/assessment/page.tsx`.
- Hardened groundedness and portfolio eval posture (patterns adapted from `agent-platform-private`):
  - Added `lib/citations.ts` fail-closed citation filter and wired it into `generateAssessment`.
  - Added offline eval corpus `eval/corpus.json` + `npm run eval`.
  - Added unit tests for scoring, citations, and system-card parsing (`npm run test`).
  - Added GitHub Actions CI for typecheck/unit/eval.
- Updated `.env.example` with API/demo key guidance.

### 2026-06-02

- Fixed Tailwind/PostCSS compatibility for Next.js 14 build stability:
  - Downgraded to Tailwind v3 by installing `tailwindcss@3` with `autoprefixer` and `postcss`.
  - Kept `postcss.config.js` in v3-compatible plugin format (`tailwindcss`, `autoprefixer`).
  - Updated `tailwind.config.ts` to v3-style minimal config with `content: ["./app/**/*.{ts,tsx}"]`, standard `theme.extend`, and empty `plugins`.
  - Verified `app/globals.css` uses v3 directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`).
  - Verified local production build succeeds via `npm run build`.
- Improved demo resilience against Gemini free-tier quota limits:
  - `prisma/seed.ts` now idempotently pre-generates an assessment for `[SAMPLE DATA] EU HR Screening Assistant` only when none exists, so demo pages can load with persisted assessment data and citations without a live API call.
  - Seed generation now handles rate limiting gracefully: when generation is rate-limited, seeding logs a skip message and continues (a later seed run can backfill; once persisted it is never regenerated by seed).
  - `lib/assessment.ts` now respects API-provided retry delays on transient errors (including 429 `retryDelay` values) and returns a friendly structured `rate_limited` result with fallback to the most recent saved assessment instead of a hard failure.
  - `app/systems/[systemId]/actions.ts` maps the `rate_limited` result to a successful action response so the UI can display the fallback note.
  - `scripts/smoke-test.ts` now spaces repeated runs with a ~5s inter-run delay to reduce self-induced per-minute quota hits.
- Hardened intermittent assessment failures in `lib/assessment.ts`:
  - Added structured-output enforcement on Gemini generation with `responseMimeType: "application/json"` and typed `responseSchema` for `{ summary, recommendations[{text, articleRef}] }` (validated against the installed `@google/genai` type definitions).
  - Added a transient retry helper for Gemini embed/generate calls (up to 2 retries with incremental ~500ms backoff) handling network/429/5xx/connection-closed style failures.
  - Added stage-aware failure diagnostics (`embed`, `retrieve`, `generate`, `parse`, `persist`) in structured error results so smoke tests can report exact failure stage, message, and stack.
- Extended `scripts/smoke-test.ts` with repeat mode:
  - Reads run count from argv or `SMOKE_REPEAT_COUNT` (default `1`).
  - Runs `generateAssessment` repeatedly and prints `N succeeded / M failed`.
  - Prints per-failure stage, full error message, and stack trace.
- Made readiness `score` and `level` deterministic instead of LLM-generated:
  - Added `computeReadinessScore` and `deriveLevel` to `lib/assessment.ts`; score = questionnaire completion ratio (weight 60) + evidence coverage across sections (weight 40), minus stale-evidence and missing-evidence penalties. Level bands: `<40` Not Ready, `40–75` Partially Ready, `>75` Audit-Ready.
  - Refactored `lib/gaps.ts` to expose a read-only `computeGapData` returning `gapRows` + `GapMetrics`; `recomputeGaps` now reuses it, giving scoring and gap persistence one source of truth.
  - Removed `score`/`level` from the Gemini prompt contract and `parseAssessmentPayload`; the model now returns only `summary` and cited `recommendations`. Confirmed via `npm run smoke` (x2) that the score is identical across runs (35 / Not Ready) while the narrative varies.
- Added `scripts/smoke-test.ts` (`npm run smoke`, `import "dotenv/config"`) exercising the full pipeline against `[SAMPLE DATA] EU HR Screening Assistant` with explicit PASS/FAIL checks; added `dotenv` dev dependency.
- Repo cleanup: removed leftover SQLite-era artifacts — `docker-compose.yml`, `prisma/migrations/20260320014401_init_sqlite/`, and `prisma/migrations/migration_lock.toml` (schema is managed via `prisma db push`). Kept `PRODUCT_SPEC.md`.
- Calibrated retrieval confidence in `lib/assessment.ts`:
  - Added named constant `LOW_CONFIDENCE_DISTANCE = 0.45`.
  - Confidence now depends on retrieval distance only: low confidence is set only when the best retrieved distance exceeds `0.45`.
- Stabilized Gemini scoring by setting generation temperature to `0.2` in assessment generation.

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
