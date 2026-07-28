# EvidencePack AI

EvidencePack AI is a **Governance OS for AI systems**: register a system, complete a governance questionnaire, attach evidence, surface gaps, run a grounded EU AI Act readiness assessment, and export an audit-friendly pack.

It does **not** remote-control your model runtime. “Connecting” an AI system means importing its **system/model card and evidence artifacts** (UI or API), then producing reviewable readiness results.

## Live demo

**https://evidencepack-ai.vercel.app**

**Shareable sample assessment:**  
https://evidencepack-ai.vercel.app/systems/cmn25waj5000zi9wf8335yo9j/assessment

**Health:** https://evidencepack-ai.vercel.app/api/v1/health

### 5-minute recruiter walkthrough

1. Open the seeded **`[SAMPLE DATA] EU HR Screening Assistant`** from the home page banner.
2. Review open gaps (especially oversight / missing evidence).
3. Click **Generate assessment** — readiness `score`/`level` are deterministic; recommendations cite retrieved EU AI Act articles.
4. Open **Shareable assessment** (`/systems/<id>/assessment`) or **Export Markdown Pack**.
5. Optional: import `examples/system-card.json` (or the Markdown card) via the Import panel / API.

## What it does

- Create / list AI systems with governance metadata
- Complete a multi-section questionnaire
- Attach URL or file evidence by section
- Auto-detect gaps (unanswered questions, missing/stale evidence)
- Import a **system card** (JSON or Markdown + YAML frontmatter)
- Grounded RAG assessment over EU AI Act clauses (pgvector + Gemini)
- Fail-closed citation gate (recommendations must cite retrieved `articleRef`s)
- Public JSON API for create / import / evidence / assess
- Export Markdown evidence packs

## Grounded RAG assessment

- **Ingest:** `scripts/ingest-regulation.ts` chunks `data/eu-ai-act-key-provisions.md` into `RegulationChunk` with 768-dim embeddings
- **Retrieve:** `lib/assessment.ts` embeds a query and fetches nearest clauses via pgvector
- **Generate:** Gemini returns narrative `summary` + cited `recommendations` only
- **Score:** `computeReadinessScore` / `deriveLevel` are deterministic from gap metrics
- **Gate:** `lib/citations.ts` drops any recommendation whose citation is not in the retrieved set

## Quick start

```bash
cp .env.example .env   # fill PROD_DATABASE_URL, DIRECT_URL, GEMINI_API_KEY
npm install
npx prisma db push
npx prisma db seed
node --env-file=.env --import tsx scripts/setup-pgvector.ts
node --env-file=.env --import tsx scripts/ingest-regulation.ts
npm run dev
```

Open http://localhost:3000

### Verify

```bash
npm run typecheck
npm run test          # unit tests (scoring, citations, system-card parsing)
npm run eval          # golden citation corpus (offline)
npm run smoke         # live end-to-end assessment against seeded sample
```

## Connect an existing AI system

### Option A — UI import

Paste a JSON system card or Markdown model card into **Import system card** on `/systems`.

Examples:

- `examples/system-card.json`
- `examples/system-card.md`

### Option B — API

If `EVIDENCEPACK_API_KEY` is set on the deployment, send it as `Authorization: Bearer <key>` or `x-api-key`.

```bash
# Import system card
curl -sS -X POST https://evidencepack-ai.vercel.app/api/v1/import \
  -H "content-type: application/json" \
  -H "x-api-key: $EVIDENCEPACK_API_KEY" \
  --data-binary @examples/system-card.json

# List systems
curl -sS https://evidencepack-ai.vercel.app/api/v1/systems

# Attach evidence
curl -sS -X POST https://evidencepack-ai.vercel.app/api/v1/systems/<systemId>/evidence \
  -H "content-type: application/json" \
  -H "x-api-key: $EVIDENCEPACK_API_KEY" \
  -d '{
    "title":"Bias report",
    "description":"Q2 fairness slices",
    "type":"URL",
    "sourceUrl":"https://example.com/bias",
    "sectionKey":"risk-controls",
    "owner":"Risk Ops",
    "status":"COMPLETE"
  }'

# Run assessment
curl -sS -X POST https://evidencepack-ai.vercel.app/api/v1/systems/<systemId>/assess \
  -H "x-api-key: $EVIDENCEPACK_API_KEY"
```

API surface:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | DB + regulation corpus readiness |
| GET | `/api/v1/systems` | List systems + latest assessment summary |
| POST | `/api/v1/systems` | Create system |
| GET | `/api/v1/systems/:id` | System detail |
| POST | `/api/v1/systems/:id/evidence` | Attach evidence |
| POST | `/api/v1/systems/:id/assess` | Generate grounded assessment |
| POST | `/api/v1/import` | Import system card |
| POST | `/api/v1/demo/reset` | Delete non-sample systems (`DEMO_RESET_KEY`) |

## Environment variables

Required:

- `PROD_DATABASE_URL`
- `DIRECT_URL`
- `GEMINI_API_KEY`

Optional:

- `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `GEMINI_EMBED_MODEL` (default `gemini-embedding-001`)
- `NEXT_PUBLIC_APP_NAME`
- `EVIDENCEPACK_API_KEY` — protect write APIs in production
- `DEMO_RESET_KEY` — enable `/api/v1/demo/reset`

## Design decisions (portfolio)

1. **Hybrid scoring:** LLM never owns readiness score/level — metrics do (`scoring_v2` obligation matrix by default).
2. **Grounded recommendations:** hybrid retrieval (vector + keyword + gap-aware boost) first; fail-closed citation filter second.
3. **System cards over runtime hooks:** portfolio-honest “connect your AI system” path via docs/evidence import + API.
4. **Eval before vibes:** offline corpus in `eval/corpus.json` gates citation behavior in CI.
5. **Observable runs:** `AssessmentRun` stores latency/stage/retrieval logs for glass-box demos.
6. **Versioned corpus:** regulation chunks carry `corpusVersion` (`eu-ai-act-v2`) so ingest is replace-by-version, not blind wipe.

## After deploy / schema upgrades

Production needs a one-time schema sync + corpus re-ingest when this upgrade lands:

```bash
npx prisma db push
node --env-file=.env --import tsx scripts/ingest-regulation.ts
```

Or locally: `npm run db:push && npm run ingest`

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Prisma + PostgreSQL / Neon + pgvector
- Gemini (`@google/genai`) for embeddings + narrative generation
- Zod validation + Node test runner CI

## Current limitations

- Single shared workspace (no multi-user auth yet)
- Regulation corpus is a curated high-risk obligation subset (not the full Official Journal text)
- File uploads are local/Vercel-filesystem oriented; prefer URL evidence for hosted demos
- Live smoke test needs DB + Gemini credentials (CI runs offline unit/eval only)
