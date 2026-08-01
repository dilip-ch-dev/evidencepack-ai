# LLM Feature Production Readiness Review (llm-prod-readiness-v1)

An opinionated internal checklist for the question "is this LLM feature ready to carry real traffic?".
Rulebook id: **llm-prod-readiness-v1**. This is engineering practice, not a standard — adapt the checks and weights to your own risk appetite.

## PR01 — Offline evaluation coverage

The feature has an evaluation set that runs without human intervention and produces a number that can be compared across changes. The set covers the behaviours that matter: the common path, the inputs that previously broke, the adversarial or malformed inputs, and the cases where the correct answer is a refusal. Coverage is stated explicitly — how many cases, drawn from what source, and which failure modes they exercise — so a reviewer can tell what is untested. Metrics are chosen to be sensitive to the failure the team actually cares about rather than to whichever number is easiest to compute, and a baseline is recorded so a regression is visible rather than inferred. Evaluation runs in continuous integration, or there is a documented reason it cannot.

Keywords: evaluation, eval set, golden set, coverage, baseline, regression, metric, CI, refusal cases

## PR02 — Prompt and model version control

Every prompt, system instruction, tool schema, and model identifier that affects behaviour is versioned in source control, and the version in use is recoverable from a production trace. Model names are pinned to a specific version rather than a floating alias, because a silent provider-side update is indistinguishable from a regression in the application. Prompt changes go through the same review as code changes. Where prompts are edited outside the repository, the editing surface records who changed what and when, and the change is reconcilable with a deployment. The retrieval corpus, if any, is versioned alongside the prompt so a retrieval change can be attributed.

Keywords: prompt versioning, model pinning, floating alias, source control, review, corpus version, reproducibility, trace

## PR03 — Groundedness and citation policy

The feature has a stated position on what it is allowed to assert. If answers are supposed to be grounded in retrieved sources, that property is enforced in code rather than requested in the prompt: claims are checked against the retrieved set, and output that fails the check is dropped, flagged, or refused rather than returned unmarked. The policy states what happens when nothing relevant is retrieved, which is a distinct case from retrieving something weak. Users can see the supporting sources. Known limitations and the intended scope of use are written down where a user will encounter them, not only in internal documentation.

Keywords: groundedness, citation, fail closed, refusal, retrieved sources, unsupported claim, limitations, intended scope

## PR04 — Cost and token budget

Expected cost per request and per active user is estimated before launch and measured after it. There is a hard ceiling somewhere in the path — per-request token caps, per-user quotas, or per-tenant budgets — so that a single caller or a runaway loop cannot consume the whole allowance. Someone receives an alert when spend departs from the forecast, and there is a defined response to that alert rather than an intention to look into it. Retry logic is bounded and accounted for in the cost model, since retries are the usual source of surprise bills. Where a cheaper model or a cache would serve most traffic, the decision to use the expensive path is deliberate.

Keywords: cost, token budget, quota, ceiling, spend alert, retry, caching, model tiering, forecast

## PR05 — Latency budget and timeouts

The feature has a stated latency target tied to how it is used, expressed as a distribution rather than an average, and the current numbers are measured against it. Every external call has an explicit timeout shorter than the user's patience, and the behaviour on timeout is defined. Where the work is genuinely slow, the interaction is designed for it — streaming, progressive disclosure, or an asynchronous result — instead of leaving the user in front of a spinner. Sequential model calls are identified and either parallelised or justified, because chained latency is the usual reason a feature that tested well feels unusable.

Keywords: latency, p95, p99, timeout, streaming, async, budget, chained calls, perceived performance

## PR06 — Failure behaviour and fallbacks

Every dependency that can fail has a defined behaviour when it does: the provider returning an error, a rate limit, a malformed response, an empty retrieval, or a timeout. The failure is surfaced honestly rather than disguised as a confident answer, and the user is told what to do next. Where a degraded result is better than none — a cached answer, a cheaper model, a non-AI path — that fallback exists and is tested, including the case where the fallback itself fails. Retries distinguish transient from permanent errors so the system does not hammer a dependency that is refusing on principle. Partial failures leave no half-written state.

Keywords: failure mode, fallback, degradation, rate limit, transient error, retry policy, empty retrieval, honest error, idempotency

## PR07 — Sensitive data handling

What data reaches the model, and what is retained afterwards, is known and deliberate. Personal or confidential fields are minimised, redacted, or excluded before they enter a prompt, an embedding, or a log. Retrieval and vector queries enforce the requesting user's entitlements inside the query, not as a filter applied to results, and the isolation is tested with a case that would leak if it regressed. Prompt and completion logs have a retention limit and an owner. Provider data-use terms are checked, including whether inputs may be retained or used for training, and the answer is recorded where a reviewer can find it.

Keywords: PII, redaction, minimisation, tenant isolation, entitlements, log retention, provider terms, training opt-out, vector store

## PR08 — Observability and tracing

A production request can be reconstructed after the fact. Traces capture the inputs, the retrieved context, the prompt version, the model and its parameters, the raw output, token counts, latency per stage, and the outcome — including which stage failed when something did. Failures are attributed to a stage rather than logged as a single opaque error, because "the AI broke" is not a debuggable statement. Aggregate views exist for the numbers that would signal drift: refusal rate, groundedness failures, latency, cost, and error rate by stage. Someone looks at them on a schedule.

Keywords: tracing, observability, stage attribution, telemetry, token count, drift, refusal rate, dashboard, structured logs

## PR09 — Human escalation and override

Where the feature's output leads to a consequential action, a person can inspect, correct, or stop it, and the path to do so is documented and reachable in practice rather than in principle. Irreversible or high-value operations require explicit confirmation. The people expected to exercise oversight have enough context to judge the output — the sources, the confidence, the known failure modes — and are not placed in a position where approving is the only practical option. Overrides are recorded, and the record is reviewed, because a pattern of overrides is the earliest signal that the model is wrong in a specific way.

Keywords: escalation, override, human in the loop, confirmation, irreversible action, oversight context, automation bias, override log

## PR10 — Rollout, rollback, and regression gates

Changes reach users progressively — behind a flag, to a fraction of traffic, or to internal users first — and there is a specific signal that decides whether to continue. Rollback is a single deliberate action that does not depend on the person who deployed, and it has been exercised at least once. The evaluation set from PR01 gates the change: a merge that moves the number in the wrong direction is blocked or explicitly accepted with a reason, not merged silently. Prompt, model, and corpus changes are treated as deployments subject to the same gates, since each can change behaviour as much as a code change.

Keywords: rollout, canary, feature flag, rollback, regression gate, CI gate, progressive delivery, deployment, accepted regression
