# OWASP Top 10 for LLM Applications — 2025 (owasp-llm-top10-v1)

Paraphrased summaries of the OWASP Top 10 for LLM Applications, 2025 edition.
Rulebook id: **owasp-llm-top10-v1**. Consult the OWASP GenAI Security Project for authoritative text.

## LLM01 — Prompt Injection

A prompt injection occurs when untrusted content alters the model's behaviour in ways the application did not intend. Direct injection comes from the end user; indirect injection arrives through content the model ingests, such as a retrieved document, a web page, a code comment, or a tool response. Because instructions and data share a single channel, no amount of prompt wording reliably separates them. Mitigations are architectural: constrain what the model is permitted to do rather than what it is asked to do, treat every retrieved or tool-supplied string as hostile, segregate trusted system instructions from untrusted context, require human confirmation for irreversible actions, and validate model output against an expected schema before it reaches a downstream system. Adversarial testing should include injection payloads embedded in retrieved documents, not only in user messages.

Keywords: prompt injection, indirect injection, jailbreak, untrusted content, retrieved document, instruction hierarchy, adversarial testing

## LLM02 — Sensitive Information Disclosure

LLM applications leak sensitive data through several paths: the model reproduces personal or proprietary information memorised during training or fine-tuning, the retrieval layer surfaces documents the requesting user is not entitled to see, the prompt itself embeds secrets or customer records, or logs and traces persist raw inputs and outputs containing personal data. Cross-tenant leakage through a shared vector index is a common and severe variant. Controls include scrubbing and classifying data before it enters training sets or indexes, enforcing per-user or per-tenant authorisation inside the retrieval query rather than after it, redacting sensitive fields before they are logged, setting retention limits on prompt and completion logs, and documenting what the system may and may not disclose so reviewers can test the boundary.

Keywords: sensitive information, PII, data leakage, redaction, tenant isolation, authorisation, log retention, memorisation

## LLM03 — Supply Chain

An LLM application inherits risk from every component it does not build: base models and their weights, adapters and fine-tunes pulled from public hubs, embedding models, third-party inference APIs, vector databases, agent frameworks, plugins, and the datasets behind all of them. Compromised or misrepresented artefacts can carry backdoors, unexpected licence obligations, or silent behavioural changes when a hosted model is updated beneath a pinned name. Controls include maintaining an inventory of models, datasets, and dependencies with versions and provenance, verifying artefact integrity and publisher identity, pinning model and library versions and re-testing on upgrade, reviewing licence terms for both weights and training data, and monitoring for deprecation or silent replacement of hosted endpoints.

Keywords: supply chain, model provenance, SBOM, AIBOM, third party, dependency, licence, version pinning, model hub

## LLM04 — Data and Model Poisoning

Poisoning is the deliberate manipulation of data used for pre-training, fine-tuning, embedding, or retrieval so that the resulting system behaves incorrectly under conditions the attacker chooses. Backdoors can be triggered by rare tokens, biased outputs can be induced by skewed samples, and a retrieval corpus can be poisoned simply by writing content the system will later index. Systems that learn continuously from user feedback are exposed to poisoning through that feedback loop. Controls include verifying the provenance of every training and retrieval source, reviewing or gating user-contributed content before indexing, testing for anomalous behaviour on trigger-like inputs, holding out clean evaluation sets that poisoned data cannot influence, and tracking dataset versions so a regression can be traced to the data that caused it.

Keywords: poisoning, backdoor, training data integrity, fine-tuning, retrieval corpus, feedback loop, dataset version, provenance

## LLM05 — Improper Output Handling

Improper output handling is the failure to treat model output as untrusted input to whatever consumes it. Passing generated text into a shell, a SQL query, a template renderer, a browser, or a tool invocation without validation converts a language-model weakness into a conventional injection vulnerability with full application impact. The risk grows with agentic designs where output becomes an action. Controls include validating output against a strict schema before use, encoding or parameterising anything passed to an interpreter, allow-listing permitted tool calls and their argument shapes, refusing to execute output that fails validation rather than repairing it, and applying the same output-encoding rules that apply to any other untrusted source.

Keywords: output handling, injection, schema validation, sanitisation, downstream system, tool call, code execution, encoding

## LLM06 — Excessive Agency

Excessive agency is granting an LLM-based system more capability, permission, or autonomy than its task requires. It appears as tools with broader scope than needed, credentials with standing write access, chained tool calls with no confirmation step, or an agent permitted to retry destructive operations. The harm is that an ordinary model error or a successful prompt injection becomes a consequential action. Controls include giving each tool the minimum scope required, separating read from write capabilities, requiring explicit human approval for irreversible or high-value operations, bounding the number of autonomous steps and the blast radius of each, and logging every tool invocation with its arguments so an action can be reconstructed after the fact.

Keywords: excessive agency, autonomy, tool permissions, least privilege, human approval, blast radius, agent loop, audit log

## LLM07 — System Prompt Leakage

System prompt leakage is the disclosure of instructions, configuration, or context the application intended to keep private. Prompts are recoverable in practice through direct requests, role-play framing, encoding tricks, and error messages, so the prompt must not be treated as a confidentiality boundary. The real failure is placing secrets, credentials, entitlement rules, or security-relevant logic in the prompt, where disclosure becomes a privilege problem rather than an embarrassment. Controls include keeping credentials and authorisation decisions outside the prompt entirely, enforcing access rules in application code where they can be tested, documenting what the prompt contains so its exposure can be assessed, and versioning prompts so a change in disclosed content is reviewable.

Keywords: system prompt leakage, prompt extraction, secrets in prompt, authorisation logic, prompt versioning, confidentiality boundary

## LLM08 — Vector and Embedding Weaknesses

Retrieval-augmented systems introduce risks specific to their vector layer. Access control applied after retrieval rather than inside it allows documents to leak across users or tenants sharing an index. Embedding inversion can partially reconstruct source text from stored vectors, making the index itself sensitive data. Retrieved chunks can carry injection payloads, and unvalidated writes let an attacker place content that will later be retrieved as authority. Chunking and staleness problems produce confidently wrong answers from correct sources. Controls include filtering by tenant and entitlement within the retrieval query, treating the vector store with the same sensitivity as its source documents, validating and attributing anything written to the index, versioning the corpus so retrieval behaviour is reproducible, and measuring retrieval quality rather than assuming it.

Keywords: vector store, embedding inversion, tenant isolation, retrieval permissions, corpus version, chunking, index poisoning, retrieval quality

## LLM09 — Misinformation

Misinformation is confidently presented output that is factually wrong, fabricated, or unsupported by the sources the system claims to rely on. Fabricated citations, invented API surfaces, and plausible but incorrect reasoning are the common forms, and the damage is amplified when users defer to the output because it reads authoritatively. Controls include grounding answers in retrieved sources and verifying that every claim maps to one, refusing or flagging output that fails that check instead of returning it unmarked, exposing the supporting sources to the user, disclosing known limitations and the intended scope of use, and measuring groundedness and factual accuracy continuously rather than at launch only.

Keywords: misinformation, hallucination, fabricated citation, groundedness, verification, overreliance, disclosure, limitations

## LLM10 — Unbounded Consumption

Unbounded consumption is the absence of limits on the resources a request can consume. Unbounded context, unlimited output length, uncapped agent iteration, and unthrottled tool use allow a single caller to exhaust budget, capacity, or rate allowance, degrading service for everyone and producing surprise cost. Where inference is billed per token, denial of service and denial of wallet are the same attack. Extraction of model behaviour through high-volume querying is a related concern. Controls include per-user and per-tenant rate and token quotas, hard caps on input size, output length, and agent step count, timeouts and circuit breakers on tool calls, cost and latency alerting with a defined response, and graceful degradation when a limit is reached rather than uncontrolled retry.

Keywords: unbounded consumption, denial of wallet, rate limiting, token quota, cost control, timeout, circuit breaker, agent step limit, degradation
