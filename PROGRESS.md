# PROGRESS

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
- Recompute and display open gaps (missing evidence, unanswered required questions, stale evidence, missing required section responses).
- Export Markdown evidence packs with system summary, responses, evidence index, open gaps, timestamps, and latest AI readiness assessment when available.
- Generate a grounded AI Readiness Assessment: a deterministic, data-derived `score`/`level` paired with a Gemini-generated `summary` and EU AI Act `articleRef`-cited `recommendations`, retrieved from a pgvector regulation knowledge base. Citations and a retrieval-confidence flag are stored and rendered on system detail pages and in exports.
- Verify the end-to-end RAG pipeline with a CLI smoke test (`npm run smoke`).

## Changelog

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
