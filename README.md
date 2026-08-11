# Truecite

Truecite is a **governance workspace for AI systems**: register a system, complete a questionnaire, attach evidence, surface gaps, run a grounded readiness assessment against a pluggable rulebook, and export an audit-friendly pack.

Shipped rulebooks: **EU AI Act**, **OWASP LLM Top 10**, and **LLM Production Readiness**. The default active rulebook is EU AI Act; switching rulebooks switches the scored obligations and the retrieved corpus together.

It does **not** remote-control your model runtime. “Connecting” an AI system means importing its **system/model card and evidence artifacts** (UI or API), then producing reviewable readiness results.

## Live app

**https://truecite.vercel.app**

### Preferred usage flow

1. Open `/systems` in **Live mode**
2. Paste a **Hugging Face model URL** to create a real system record from public metadata
3. Review the generated system, fill gaps, and attach more evidence
4. Run the grounded assessment
5. Open the assessment view or export the evidence pack

### Demo flow

If you want a recruiter walkthrough instead of a real import:

- Switch `/systems` to **Demo mode**
- Open the seeded **`[SAMPLE DATA] EU HR Screening Assistant`**
- Review the read-only walkthrough, its open gaps, grounded assessment, and retrieved clauses

## What it does

- Create / list AI systems with governance metadata
- Complete a multi-section questionnaire
- Attach HTTPS evidence links by section (hosted file uploads stay disabled until private storage exists)
- Auto-detect gaps (unanswered questions, missing/stale evidence)
- Import a **Hugging Face model URL** into a governance-ready system draft
- Import a **system card** (JSON or Markdown + YAML frontmatter)
- Grounded RAG assessment over pluggable rulebook clauses (pgvector + Gemini)
- Fail-closed prose gate (summary and recommendations require a retrieved `clauseRef` plus a verbatim quote from that clause)
- Structural assessment diff (what changed between runs, and why)
- Labeled failure taxonomy with an actionable fix queue
- Session-scoped JSON API for create / import / evidence / assess / diff
- Export Markdown evidence packs

## Grounded assessment stack

- **Rulebooks:** `rulebooks/<id>/rulebook.json` + `clauses.md` — obligations, aliases, gap routing
- **Ingest:** `npm run ingest -- <rulebookId>` chunks and embeds a rulebook corpus
- **Retrieve:** `lib/retrieval.ts` blends vector similarity, keyword overlap, and gap-aware clause boosts
- **Generate:** Gemini returns a summary and recommendations with a clause reference and supporting quote
- **Score:** `scoring_v2` computes obligation coverage + documentation/control readiness
- **Observe:** `AssessmentRun` stores latency, stage, retrieval count, and dropped citations
- **Gate:** `lib/citations.ts` rejects prose unless its reference was retrieved and its supporting quote occurs in that clause
- **Diff:** `npm run diff` / `GET /api/v1/systems/:id/diff` attributes score movement to scoring, corpus, inputs, or model
- **Taxonomy:** `npm run taxonomy` turns labeled defects in `eval/annotations.json` into a fix queue

## Quick start

```bash
cp .env.example .env
npm install
npx prisma db push
npx prisma db seed
node --env-file=.env --import tsx scripts/setup-pgvector.ts
npm run ingest -- eu-ai-act-v2
npm run dev
```

Open http://localhost:3000

### Verify

```bash
npm run typecheck
npm run test
npm run eval
npm run taxonomy
npm run smoke
```

## Connect an existing AI system

### Option A — Hugging Face URL import (recommended)

Paste a public model URL like:

- `https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3`
- `mistralai/Mistral-7B-Instruct-v0.3`

Truecite will pull public metadata, create a system record, attach model-card evidence links, and draft questionnaire answers.

### Option B — Advanced system-card import

Paste JSON or Markdown model card content into the advanced import accordion on `/systems`.

Examples:

- `examples/system-card.json`
- `examples/system-card.md`

### Option C — API

```bash
# Hugging Face URL import
curl -sS -c .truecite-cookie -b .truecite-cookie -X POST https://truecite.vercel.app/api/v1/import/huggingface \
  -H "content-type: application/json" \
  -d '{"source":"https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3"}'

# Advanced system-card import
curl -sS -c .truecite-cookie -b .truecite-cookie -X POST https://truecite.vercel.app/api/v1/import \
  -H "content-type: application/json" \
  --data-binary @examples/system-card.json
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
| GET | `/api/v1/systems/:id/runs` | Assessment run history |
| GET | `/api/v1/systems/:id/diff` | Diff the two most recent assessments (or `?from=&to=`) |
| POST | `/api/v1/import` | Import system card |
| POST | `/api/v1/import/huggingface` | Import from Hugging Face URL |
| POST | `/api/v1/demo/reset` | Delete non-sample systems (`DEMO_RESET_KEY`) |

## Evaluation evidence

The committed 36-case gate corpus currently passes 36/36 cases. On the 36-case retrieval golden set at `topK=5`, recall is `0.8889`, MRR is `0.8485`, and hit@1 is `0.8056`.

The gap-aware retrieval boost currently has **no measurable effect** on that committed golden set: with-boost and without-boost metrics are byte-for-byte identical. The project reports that negative result rather than presenting the boost as proven value. See `eval/results/latest.json` and run `npm run eval:check`.

## Current limitations

- Browser-session isolation is not account authentication; clearing the cookie can make a private workspace inaccessible
- No automatic runtime integration with arbitrary private endpoints yet
- Hugging Face import currently uses public model metadata, not live inference behavior
- Regulation corpus is curated rather than full-text legislation
- Hosted file uploads are disabled until private object storage is configured
- The curated demo is read-only; create a private-session workspace to test writes
