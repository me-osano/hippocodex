# Hippocodex — Competitive and Technical Review

> **Scope:** Paperwren, Anara, Obsidian, and adjacent tools, libraries, and research that inform Hippocodex.
> **Date of review:** 2026-11-07 (finalized 2026-11-09; no-model reframe 2026-11-17). Pricing, licenses, star counts, and product behavior change; verify before making commitments.
> **Status:** Research input for [ROADMAP.md](./ROADMAP.md) and [TODO.md](./TODO.md). This document is not a replacement for either.
> **Method:** Public documentation, product pages, repository source trees, configuration files, security/OCR write-ups, and GitHub metadata. No private source code, no paid-plan testing, no independent benchmark reproduction.

---

## 1. Executive summary

Hippocodex is aiming at a real gap, but not the gap the current feature list first suggests.

The market is crowded with tools that answer questions over documents. NotebookLM, Anara, Elicit, Consensus, Scite, Khoj, Reor, AnythingLLM, PrivateGPT, RAGFlow, and dozens of Obsidian plugins all do some version of "upload sources, ask a question, get an answer with citations." Hippocodex will not compete by adding a chat box, a generative model, or a vector index. Those are table stakes for other products, not capabilities in the no-model core plan.

The defensible gap is narrower and harder:

1. **Offline-first, with no network in the core.** Ingestion, indexing, retrieval, answer assembly, and reading happen on-device; the Android build requests no network permission.
2. **Quote-only answers.** Every displayed word is copied verbatim from a source. If the library is silent, the app says "Not found in your sources."
3. **Verification that is honest about what it verifies.** Quote offsets, page anchors, and support labels are structural and inspectable; partial or conflicting evidence is visible, not hidden behind fluent prose.
4. **Domain-specific study workflows** — medicine first, law second — where guideline version, evidence level, jurisdiction, and source date are first-class data, not decorative labels.
5. **A durable, inspectable library** whose source of truth is SQLite and content-addressed files, not a proprietary cloud workspace.

Paperwren is the most useful engineering reference in the set, despite being a document viewer rather than a research assistant. Its architecture — one tested platform boundary, a thin Rust shell, pure TypeScript domain logic, extensive fixtures, a documented security audit, and an honest OCR evaluation — is a better model for a small trustworthy desktop app than most "AI knowledge base" projects. Copy its discipline, not its feature list.

Anara is the most useful product reference. Its source scoping, inline citations that open at the passage, claim verification, citation graph, structured "Views" with per-cell evidence, and candid documentation that "a citation is not a guarantee of accuracy" are close to the UX Hippocodex should build. Anara is cloud-first and — according to its own privacy policy — describes collection of prompts, files, usage/analytics data, and use of cookies and targeted advertising. That is the opening.

Obsidian is the most useful ecosystem reference. It proves that local Markdown files, a plugin API, and a paid sync service can coexist for a large audience. It also demonstrates the cost: plugins execute arbitrary code, sync is not backup, and local-first does not automatically mean encrypted or auditable.

The single most important recommendation in this review:

> **Do not treat "citation validity ≥ 99%" as the primary quality metric.** In a quote-only system, quote fidelity should be 100% by construction. Make the headline metrics **support precision** (does the selected quote support the point it is used for?), **coverage** (is every answer slot filled by a quote?), and **correct-refusal rate** (does the app stay silent when the sources are silent?). Keep structural validity as a cheap gate, not the story.

The second most important recommendation:

> **Move encryption, backup/export, and citation export earlier than Phase 8.** They are trust features, not polish. A student's medical school notes and a lawyer's case library are exactly the data people will refuse to store in a tool that cannot be backed up, moved, or locked.

The third:

> **Treat the domain pack boundary as a data/configuration boundary, not a plugin boundary.** Ship medicine and law as declarative packs (source lists, section rules, dictionaries, evidence labels, answer templates, disclaimers, evaluation sets) before inventing a WASM plugin API. Paperwren's "one platform boundary" lesson applies: every additional extension surface is a security and maintenance liability.

---

## 2. How to read this review

Each project is reviewed on five axes:

- **What it is** — the product and its actual scope.
- **What is worth borrowing** — concrete ideas, patterns, or code-level decisions.
- **What to avoid** — failure modes, costs, or mismatches with Hippocodex's principles.
- **Relevance to Hippocodex** — direct, indirect, or cautionary.
- **Verification status** — what was actually inspected versus inferred from documentation.

The comparison matrix in §5 is deliberately blunt. The gap analysis in §7 maps findings to specific ROADMAP phases and TODO items. The recommendations in §8 are prioritized. §9 is the most important conceptual section: it defines what a verified quote and a supported answer fragment mean in an extractive, no-model system.

A note on sources: repository metadata (stars, license, last push) is a snapshot from GitHub on 2026-11-07 and is included only to indicate maturity and activity, not quality. Product pricing is included only where it informs positioning; verify current numbers before quoting them publicly. Where a competitor uses AI, models, or vectors, that is described as market context — not as a recommendation for Hippocodex's core.

---

## 3. Hippocodex, restated

From `ROADMAP.md`, Hippocodex is:

- A **local-first, Rust-built study vault** for students and researchers.
- Launch audience: **medical students**, then **law students**, then any field with a citable corpus.
- Core promise: **answers made only of verbatim quotes** from the user's sources, with page numbers and exact offsets. "Not found in your sources" is a valid answer.
- Architecture: Rust workspace (`core`, `store`, `ingest`, `index`, `answer`, `bundle`, `sync`, `packs`, `cli`) plus a Tauri app for desktop and Android.
- Flow: `Source → Extract → Chunk → Index (Tantivy BM25) → Retrieve → Score passages → Assemble verbatim quotes → Verify offsets → Display with page links`.
- Deliberately absent from v1: LLMs, local or online inference, embeddings, vector indexes, learned rerankers, and chat generation.
- Differentiators: privacy, offline mode, desktop-built Android bundles, domain packs, study tools, and quote fidelity.

This review accepts that vision and asks three questions:

1. Which existing projects already do parts of it well enough to learn from or integrate with?
2. Which roadmap assumptions are riskier than they look?
3. What should change in the roadmap and TODO before code is written?

---

## 4. Project-by-project review

### 4.1 Paperwren

**What it is.** A feather-light document viewer for Android, Windows, and macOS, built with Tauri 2 and a React/TypeScript web layer. It opens PDF, Word, Excel, PowerPoint, OpenDocument, RTF, EPUB, CSV, Markdown, plain text, source code, comic books, and images. It includes PDF tools (scan, OCR, fill and sign, merge, split, compress), highlights and notes, read-aloud, and nine interface languages. MIT licensed. Repository: <https://github.com/Razee4315/Paperwren>.

At review time the repository was small (roughly 47 stars) but unusually mature in its engineering write-ups: a development guide, a features document, a security audit dated October 2026, and an OCR evaluation dated 2026-10-31. The app is a viewer, not a research assistant: it has no retrieval, no LLM, no embeddings, and no citation verification.

**Architecture worth studying.**

The repository describes "one web layer runs everywhere; a thin Tauri 2 shell wraps it." The Rust side is deliberately small:

- `src-tauri/src/store.rs` — atomic JSON store.
- `src-tauri/src/imports.rs` — managed copies of imported files.
- `src-tauri/src/open.rs` — desktop hand-offs and files Finder asks for.
- `src-tauri/src/save.rs` — saving a copy and renaming.
- `src-tauri/src/error.rs` — error boundary.

Everything else lives in `src/lib/` as pure, unit-tested TypeScript: format registry and magic-byte sniffing, recents, settings validation and migration, the one platform boundary (`backend.ts`), environment/layout detection, window state, keyboard handling, i18n, Office/ODF readers, PPTX parsing, sheet styles, print layout, and a worker for SheetJS and legacy Office parsing. The browser preview uses an in-memory backend, so the same UI can run without Tauri.

This is the inverse of the usual Tauri architecture, where most logic drifts into Rust commands and the webview becomes a thin renderer. Paperwren's choice has costs (heavy parsing in JavaScript/WASM, a large web bundle) but big benefits: the domain logic is testable in Vitest, the platform boundary is one file, and the Rust surface that touches untrusted bytes is small.

**Security discipline worth copying.**

The October 2026 security audit reads every layer that touches untrusted bytes: Tauri commands, the Android bridge, parsers, DOM sinks, the dependency tree, and the release pipeline. It documents fixed issues and deliberate residual risks, including:

- DOMPurify advisories and the decision to keep sanitizing all untrusted HTML.
- Guarded ZIP inflation for OOXML/ODF containers.
- Origin-checked Android bridge messages.
- A release build that fails if the Android app acquires network permission.
- Deliberate residual risks: unbounded inflation for some legacy formats, broad read-only filesystem scope, and a rename-extension issue.

The audit is valuable less for its findings than for its form: it names what was fixed, what was accepted, and what remains. A Hippocodex `SECURITY.md` should do the same, from Phase 0, not Phase 8.

The OCR evaluation is similarly honest. It reports measured character error rates for nine languages, states that the pages were synthetic and that no phone was used, discloses that Nastaliq Urdu is poor (~35% character error on clean pages), and explains why the larger `tessdata_best` model was not worth the size. It also lists what was *not* tested: real scans, multi-column pages, tables, pages with photographs, long documents, and the Tauri app itself. This is the tone Hippocodex should use for extraction-quality and citation-quality claims.

**Other engineering details.**

- Release profile: `lto = true`, `codegen-units = 1`, `opt-level = "s"`, `strip = true`, `panic = "abort"`.
- Android build has no network access and asks for zero permissions; the release fails if a permission sneaks in.
- No analytics, no account, no ads. Windows/macOS optionally check GitHub for updates; nothing about the user or files is sent.
- Files are never modified when opened; the only exception is an explicit rename.
- The app uses pdf.js for PDF display, Tesseract.js WASM for OCR, DOMPurify for HTML sanitization, and guarded ZIP inflation for Office formats.
- Extensive fixtures: generated Office/ODF/RTF samples, rich fixtures for styled workbooks and password-protected files, feature fixtures, and real files from Apache POI and LibreOffice test suites.
- CI runs lint, type check, unit tests, and Rust tests; release builds are manual and signed.

**PPTX handling comparison (2026-11-17, expanded 2026-11-18).** Paperwren's `src/lib/pptx/parse.ts` is a visual renderer: it resolves master → layout → slide inheritance, converts EMU geometry to CSS pixels, and lays out positioned shapes, pictures, tables, charts, SmartArt, theme colours, and bidi text. Its `src/lib/safeZip.ts` preflights the ZIP central directory and charges every inflated entry against a byte budget before handing bytes to the renderer.

Hippocodex now borrows that presentation stack extensively for display, while keeping its own text-first retrieval projection intact:

- Adapted Paperwren's OOXML core into `app/src/lib/slides/`: theme and colour resolution, master/layout/slide inheritance, EMU geometry and group matrices, preset and freeform shapes, gradients/shadows, pictures with crop and effects, tables, cached chart values, SmartArt saved drawings, symbol bullets, numbering, and RTL detection.
- Adapted the positioned slide renderer and SVG chart renderer into `app/src/components/slides/`, plus a compact local slide show with hidden-slide skipping, notes, presenter view, keyboard/touch navigation, and a laser pointer.
- Kept Hippocodex's guarded JSZip reader in `app/src/lib/safeZip.ts` as the security boundary; the visual parser inflates only referenced XML/rels and image parts, with a separate media budget.
- Kept `parsePresentation()` and the existing bullet/nesting/notes/hidden-slide text model unchanged so retrieval, search, and citations continue to work. The text card remains available through the viewer's Text toggle and stays in the DOM for search-oriented checks.

Deliberately not adopted: animations, transitions, password-protected OOXML decryption, and Paperwren's app shell, workers, settings, and i18n wiring. Attribution is in `THIRD_PARTY_NOTICES.md`.

**What to borrow.**

1. **One platform boundary.** Hippocodex will have many more capabilities than Paperwren, but the principle still holds: isolate every OS/Tauri/filesystem/keychain/network call behind a small, well-tested interface. Keep domain logic in Rust crates and test it without Tauri.
2. **Pure logic, thin shell.** The more logic lives in ordinary Rust crates with unit tests, the less of the app is only testable through the UI.
3. **Content-based format detection.** Magic-byte sniffing beats file extensions. For Hippocodex ingestion, detect the real format and treat the extension as a hint.
4. **Fixtures as first-class infrastructure.** Hippocodex needs a checked-in public-domain corpus plus adversarial fixtures (encrypted PDFs, malformed ZIPs, giant pages, scanned pages, RTL text, tables, two-column layouts). Paperwren's fixture scripts are a good template.
5. **Documented residual risk.** Write down what the security audit did not fix. This builds more trust than a claim of zero risk.
6. **Honest evaluation reports.** State the hardware, the test set, the languages, the failure modes, and what was not tested.
7. **Small release profile.** `opt-level = "s"`, LTO, stripping, and `panic = "abort"` are appropriate for a desktop study app where binary size and cold start matter.
8. **No-network Android posture.** If Hippocodex ever ships a mobile companion, the Paperwren model — no network permission at all in the offline build — is the strongest possible privacy claim.

**What not to copy.**

- **Web-layer-heavy parsing as the retrieval boundary.** Hippocodex does use a local TypeScript PPTX reader to draw slides in the webview, following Paperwren's safe-ZIP discipline. It should not become the long-term extraction/indexing boundary: cited retrieval should move to confined Rust-native extraction with explicit memory limits. The webview parser never fetches, executes, or sends anything.
- **JSON file store.** Paperwren's atomic JSON store is fine for recents and settings; it is not a model for Hippocodex's document/chunk metadata. Use SQLite with migrations, transactions, and indexes.
- **Viewer scope creep.** Paperwren supports an enormous format matrix. Hippocodex should not. Every format is a parser attack surface and a maintenance cost. Start with PDF, HTML, Markdown, DOCX, EPUB, and plain text; add others only when a domain pack needs them.
- **No sync/backup model.** Paperwren is intentionally a local viewer. Hippocodex stores irreplaceable study annotations and answers; it needs export and backup from day one of real use.

**Relevance: high, as an engineering-discipline reference.** Not as a feature roadmap, and not as a competitor. Paperwren is a viewer; Hippocodex is a retrieval-and-verification system.

**Verification status.** README, development guide, features document, Cargo.toml, package.json, security audit, and OCR evaluation were read directly from the repository. Claims about runtime behavior beyond those documents were not independently tested.

---

### 4.2 Anara

**What it is.** A cloud-first AI research workspace for finding, reading, comparing, and writing with sources. It combines a library, web search, connectors, notes, citations, claim verification, a citation graph, structured extraction views, and systematic-review workflows. Product: <https://anara.com/>. Documentation: <https://docs.anara.com/>.

Anara is the closest product analogue to the *workflow* Hippocodex wants, while being almost the opposite on *architecture and privacy*. That makes it the best source of UX patterns and the best cautionary tale.

**Features worth studying.**

- **Source scoping.** Users open source controls in the chat composer and can disable web, disable library-wide search, or mention a specific file/folder. The documentation explicitly says a source setting does not guarantee completeness or correctness, and tells users to check citations. This is the right humility.
- **`@` mentions.** The composer supports library sources, web sources, connected apps, files, folders, and actions such as create note, edit note, create citation, create image, and plan. This is a strong interaction model: the same affordance selects evidence and invokes tools.
- **Inline citations that open at the passage.** A library citation opens the file at the relevant passage; a web/database citation links out. The documentation warns that a paper with only an abstract cannot support claims about methods or results absent from the abstract. That is exactly the kind of source-scope honesty Hippocodex needs.
- **Claim verification.** A draft-level check that asks whether claims are supported by sources. This is the feature that distinguishes "cited" from "supported."
- **Citation graph.** Visual exploration of how sources cite each other.
- **Views.** Structured extraction tables where each cell carries evidence. This is a major idea: instead of forcing every question into chat, let users define a table (e.g., study, population, intervention, outcome, effect size) and populate cells with cited extracts. For medicine and law, this is more useful than a chat transcript.
- **Systematic review workflow.** Search, title/abstract screening, full-text data extraction, and a final report. Elicit has a similar workflow; both validate that structured review is a real student/researcher need.
- **Export.** PDF, Word, Markdown, HTML, LaTeX, with citation formatting.
- **Citation styles.** Global citation format setting, searchable catalog, custom styles.
- **Read and annotate.** Reading and annotation inside the workspace.
- **File types.** PDFs and common research documents; availability varies by plan and connector.

Anara's documentation is unusually candid for a commercial product:

> "AI-generated answers can contain errors or omit relevant evidence. Open the cited source, check the surrounding context, and verify that it supports the specific claim before relying on it. A citation is a way to inspect evidence, not a guarantee of accuracy."

and

> "A citation beside a sentence does not by itself establish that the sentence is correct."

Hippocodex should adopt that language almost verbatim, then go further by making the verification structural rather than advisory.

**Business and privacy model.**

Anara is a subscription SaaS with a free tier and several paid tiers (roughly $10 to $200 per month at review time; verify current pricing). It offers team/enterprise plans. Its privacy policy (last updated 2026-09-22) describes collection of prompts, files, account information, and usage/analytics data; use of cookies and targeted advertising; and use of third-party LLM providers. That is normal for a cloud AI product, and it is precisely the model Hippocodex's principles reject.

This is not a criticism of Anara's ethics; it is a description of the trade. Anara can offer web search, large frontier models, connectors, and collaboration because it runs in the cloud. Hippocodex can offer privacy, offline guarantees, and local auditability because it does not. The two products should not compete on the same axis.

**What to borrow.**

1. **Source scoping as a first-class control.** "Use only this folder," "disable web," "answer only from these three documents" must be visible, persistent, and reflected in the answer's provenance.
2. **Citations open at the passage, with surrounding context.** Not just page numbers. Highlight the exact quote and let the user expand.
3. **Claim verification as a separate workflow.** Do not hide it inside answer generation. Let users run a check over a draft or a set of notes and see unsupported claims.
4. **Structured Views with per-cell evidence.** This is probably the strongest product idea in the set for medicine and law. A table of extracted facts, each with a quote and page, is more trustworthy and more study-useful than prose.
5. **Citation graph.** For law especially, "cites / cited by" is a core workflow, not a nice-to-have.
6. **Systematic-review framing.** Medicine students already learn PRISMA-style workflows. Hippocodex can support screening and extraction without pretending to replace a systematic review.
7. **Honest caveats in the UI.** "This source has only an abstract; it cannot support a methods claim" is a product feature.
8. **Export with citation styles.** Students need to move work into Word, LaTeX, and reference managers.

**What to avoid.**

- **Cloud dependency.** Anara's core value depends on sending documents and prompts to servers. Hippocodex cannot copy that architecture without abandoning its main differentiator.
- **Chat-only interaction.** Anara itself has moved toward structured views and workflows. Hippocodex should not over-index on a chat transcript.
- **Feature sprawl.** Anara's surface area is large: library, web, connectors, notes, citations, graph, views, systematic reviews, writing. A small team cannot match it. Pick the study-critical subset.
- **Citation-as-decoration.** A citation chip that opens a source is necessary but not sufficient. If the passage does not support the claim, the citation is worse than no citation because it creates false confidence.

**Relevance: high, as a product/UX reference and as the clearest example of the cloud trade-off.**

**Verification status.** Product pages, documentation guides (sources, citations, claim verification, citation graph, views, systematic reviews, file types, annotate/read), `llms.txt`, `llms-full.txt`, privacy policy, and pricing page were reviewed. Paid features were not tested. Pricing should be re-checked before citing.

---

### 4.3 Obsidian

**What it is.** A proprietary but free-for-all-uses Markdown editor and knowledge base. Notes are plain text files in a local folder ("vault"), with an `.obsidian` configuration folder. Obsidian adds links, backlinks, graph view, Canvas (open JSON Canvas format), Bases (database-like views over Markdown properties), a plugin ecosystem, and paid Sync and Publish services. Product: <https://obsidian.md/>. Help: <https://help.obsidian.md/>.

Obsidian is not a research assistant and does not do retrieval-augmented answering natively. It matters to Hippocodex for three reasons: it is the dominant local-first knowledge tool, it proves the viability of a plugin ecosystem, and it shows the limits of "local files" as a trust story.

**Architecture and data model.**

- Notes are Markdown files in a vault folder. The user can edit them with any text editor; Obsidian watches for external changes.
- The `.obsidian` folder holds configuration, themes, plugins, and workspace state.
- Obsidian maintains a metadata cache and uses IndexedDB for some local state. The files remain the source of truth for note content.
- Vaults can be synced with Obsidian Sync, Dropbox, iCloud, OneDrive, Git, and other services. Obsidian explicitly warns that vaults within vaults are a bad idea because internal links are vault-local.
- Sync is end-to-end encrypted by default (AES-256-GCM with scrypt key derivation); a standard encryption option is available. Obsidian states it does not collect telemetry.
- Sync is not backup. Obsidian's own help distinguishes version history from a backup strategy.
- Canvas uses the open JSON Canvas format, which is a good example of an inspectable, portable data format.
- Bases are views over Markdown properties, not a separate database. This keeps data portable but limits query power.

**Plugin ecosystem.**

Obsidian's plugin API is TypeScript. Community plugins can execute arbitrary code with the same privileges as the app. Obsidian offers Restricted Mode and warns users, but plugins are not sandboxed in the way a WASM plugin would be. Plugins do not auto-update by default; users choose when to update.

This is the central lesson for Hippocodex's "plugin API (WASM)" idea: a plugin ecosystem is powerful but expensive. Obsidian can afford it because it is a large, mature company with a huge user base. Hippocodex should ship declarative domain packs first, and only add a sandboxed plugin API when there is demonstrated demand and a real security model.

**Pricing and licensing.**

Obsidian is free for all purposes, including personal, commercial, and non-profit use; Catalyst and Commercial licenses are optional support purchases. Sync and Publish are paid add-ons. At review time, Sync was roughly $4/user/month billed annually ($5 monthly) and Publish roughly $8/site/month annually ($10 monthly). The app itself is not open source. The JSON Canvas format is open (MIT).

**What to borrow.**

1. **Plain-text portability.** Hippocodex's notes, highlights, and generated study cards should be exportable to Markdown/JSON without loss. Users should never feel trapped.
2. **Local folder as a first-class concept.** A vault is a folder. Hippocodex's "workspace" should map to a directory users can back up, inspect, and move.
3. **Open formats for structured data.** JSON Canvas is a good model. Hippocodex should define open schemas for annotations, citation records, and study cards.
4. **Restricted mode / explicit plugin trust.** If Hippocodex ever supports third-party code, default to off, require explicit trust, and show permissions.
5. **Sync ≠ backup.** Say this loudly. Offer export and backup separately from sync.
6. **Bases-like structured views.** Obsidian's Bases show that users want table/database views over their notes. Anara's Views show the same for evidence. Hippocodex should combine them: structured views over *cited extracts*.
7. **Ecosystem patience.** Obsidian's plugin API succeeded because the core app was already useful. Do not build an extension platform before the core is good.

**What to avoid.**

- **Assuming "local files" equals "private."** Obsidian vaults are plain text by default. Anyone with disk access can read them. Hippocodex handles medical and legal material; "local" is necessary but not sufficient. Encryption at rest matters.
- **Plugin privilege.** Obsidian plugins run with full app privileges. Hippocodex should not repeat that for untrusted community code.
- **Sync as an afterthought.** Obsidian's paid Sync is a major part of its business and its user trust. Hippocodex's roadmap puts sync beyond 1.0; that is reasonable for a solo local app, but backup/export cannot wait that long.
- **Markdown-only thinking.** Markdown is excellent for notes but poor for page-anchored citations, tables with provenance, and binary annotations. Hippocodex needs a richer internal model and a Markdown *export*, not Markdown as the database.

**Relevance: high, as an ecosystem and local-first reference; medium as a direct competitor (different job).**

**Verification status.** Obsidian help pages on data storage, community plugins, Sync introduction/security/local-vs-remote, Bases, Canvas, backup guidance, and plugin development were reviewed. Pricing and licensing pages were reviewed. The proprietary app was not reverse-engineered.

---

### 4.4 NotebookLM

**What it is.** Google's source-grounded notebook. Users upload sources (documents, slides, URLs, text, audio), and Gemini answers questions with inline citations back to the sources. It also generates notes, study guides, FAQs, timelines, and Audio Overviews. Product: <https://notebooklm.google.com/>.

**What is worth borrowing.**

- **Source-grounded answers with inline citations.** NotebookLM popularized the "your sources, not the model's memory" interaction for a mass audience. The citation is clickable and jumps to the passage.
- **Source set as the boundary.** The notebook is a container of sources; answers are scoped to it. Hippocodex's workspace/collection model should be equally obvious.
- **Generated study artifacts.** Audio Overviews, study guides, and FAQs show that students want transformations of sources, not just Q&A. Hippocodex's flashcards, quizzes, and case briefs are the right direction, but must keep citations attached.
- **Low-friction ingestion.** Paste a URL, upload a PDF, drop in a YouTube link. Hippocodex can be stricter about what it ingests, but the onboarding should be this easy for supported formats.

**What to avoid.**

- **Cloud-only.** Everything is uploaded to Google. This is a non-starter for Hippocodex's privacy promise.
- **Opaque model behavior.** NotebookLM's citations are useful but the user cannot inspect retrieval, scores, or discarded passages. Hippocodex should expose more.
- **Citation validity is not support.** NotebookLM can cite a real passage that does not fully support a claim. The interface does not make that distinction prominent.
- **Feature gravity toward content generation.** Audio Overviews are impressive but not the core job. Hippocodex should resist becoming a content-generation toy.

**Relevance: high as a UX baseline; low as an architecture reference.**

**Verification status.** Product page and public documentation/reviews were reviewed. The product was not tested with a paid account.

---

### 4.5 Zotero

**What it is.** A free, open-source reference manager for collecting, organizing, annotating, citing, and sharing research. It stores metadata in a local SQLite database (`zotero.sqlite`), attachments in a data directory, uses CSL citation styles, and has a large translator/plugin ecosystem. Since Zotero 7, the desktop app exposes a local REST API at `http://localhost:23119/api/`. License: AGPL-3.0. Repository: <https://github.com/zotero/zotero>. Docs: <https://www.zotero.org/support/>.

**What is worth borrowing.**

1. **A mature bibliographic data model.** Zotero's item types, creators, fields, attachments, notes, annotations, collections, tags, and relations are the result of years of real-world use. Hippocodex should not invent a citation metadata model from scratch; align with CSL/Zotero concepts where possible.
2. **CSL citation styles.** Use Citation Style Language for formatting rather than hard-coding APA/AMA/Bluebook variants. `citeproc-rs` is a work-in-progress Rust CSL processor; a mature JS CSL processor may be a safer short-term choice.
3. **Local API.** Zotero 7's local REST API is a strong integration pattern: other tools can read/write a local library without cloud access. Hippocodex should offer a local API or at least a documented import/export format for Zotero libraries.
4. **Translators.** Zotero's web translators extract metadata from publisher pages and repositories. Hippocodex's ingestion can learn from this, especially for medicine (PubMed) and law (court sites).
5. **Annotations as first-class objects.** Zotero stores highlights and notes with page/position data and links them to items. Hippocodex's evidence model should be at least this rich.
6. **AGPL licensing as a precedent.** Zotero shows that a successful open-source research tool can use AGPL and still achieve broad adoption. This is relevant to Hippocodex's license decision.

**What to avoid.**

- **Desktop-only, sync-later complexity.** Zotero's sync model is powerful but complex, with storage tiers, group libraries, and conflict handling. Hippocodex should start with single-device local storage and a clean export, not a half-built sync protocol.
- **Aging UI assumptions.** Zotero is powerful but not a study app. Its information architecture is built around references, not around answering questions or learning.
- **Direct SQLite coupling.** Reading `zotero.sqlite` directly is fragile across versions; prefer the local API or an export format.

**Integration opportunity.** A Hippocodex importer that reads a Zotero export (or talks to the local API) would immediately make the tool useful to existing researchers and avoid duplicate metadata entry. This is a higher-value early integration than a generic "import from Obsidian" feature.

**Relevance: high, as a metadata/citation model and integration target.**

**Verification status.** Zotero documentation on the data directory, licensing, JavaScript API, and local API was reviewed. The application was not run.

---

### 4.6 Sioyek

**What it is.** A keyboard-driven PDF viewer focused on textbooks and research papers. It supports deep links, named destinations, a citation graph of sorts, portals (e.g., arXiv, Google Scholar), and extensive keyboard navigation. License: GPL-3.0. Repository: <https://github.com/ahrm/sioyek>.

**What is worth borrowing.**

- **Reader-first design.** Sioyek treats reading as the primary activity and optimizes navigation: jump to bibliography, follow citations, go back, open referenced paper, search within a document.
- **Deep links and named destinations.** Per-page/per-section links are essential for citation UX.
- **Keyboard-heavy workflows.** Students read a lot; fast navigation matters.
- **Citation graph lite.** Following references from a paper is a simple but powerful form of graph browsing.

**What to avoid.**

- **Steep learning curve.** Sioyek's keyboard model is powerful but idiosyncratic. Hippocodex should offer discoverable defaults plus shortcuts.
- **Viewer-only scope.** Sioyek does not ingest, index, or answer. It is a component, not a competitor.

**Relevance: medium, as a reading/navigation reference.** If Hippocodex uses pdf.js for display, it can borrow Sioyek's navigation ideas without adopting its implementation.

**Verification status.** README and public feature documentation were reviewed.

---

### 4.7 Elicit, Consensus, and Scite

These three are cloud research tools with different emphases. They are relevant because they define user expectations for evidence workflows.

**Elicit** (<https://elicit.com/>) focuses on systematic literature review: search, screening, data extraction into custom tables, and a final report. It claims strong extraction from tables and figures. Its workflow validates the Anara "Views" idea: researchers want a table of extracted study characteristics, not a chat.

**Consensus** (<https://consensus.app/>) focuses on asking research questions and getting answers synthesized from papers, with study-quality signals and a consensus meter. It is useful as a benchmark for "answer with evidence" UX, but its synthesis is model-generated and cloud-dependent.

**Scite** (<https://scite.ai/>) focuses on "Smart Citations": it classifies citation statements in the literature as supporting, contrasting, or mentioning, and shows the surrounding context. This is the closest existing product to the distinction Hippocodex must make. Scite's classification is about how one paper cites another, not about whether a passage supports an AI-generated claim, but the conceptual model is directly relevant.

**What to borrow.**

- **Structured extraction tables** (Elicit).
- **Evidence-quality signals** and study-type labels (Consensus, and Anara's evidence labels).
- **Citation context classification**: supporting / contrasting / mentioning (Scite). Hippocodex's verifier should output a similar label per claim–passage pair, not a binary "valid."
- **Explicit uncertainty.** All three products are useful precisely because they show the state of evidence, not just an answer.

**What to avoid.**

- **Cloud-only search.** These tools search the open web and proprietary indexes. Hippocodex searches the user's library.
- **Model-generated consensus.** A "consensus meter" can imply more certainty than the literature supports. Hippocodex should present counts and contradictions, not a single synthesized verdict, unless the evidence is strong.

**Relevance: medium-high, as evidence-UX references.** Scite's supporting/contrasting distinction should directly influence the citation verifier's output schema.

**Verification status.** Product pages, documentation, and public descriptions were reviewed. No paid accounts were tested.

---

### 4.8 Paperless-ngx

**What it is.** A community-supported document management system: scan, OCR, index, tag, correspondents, document types, and archive documents. It is a server application (Django/PostgreSQL/Redis), not a desktop app. License: GPL-3.0. Repository: <https://github.com/paperless-ngx/paperless-ngx>.

**What is worth borrowing.**

1. **Ingestion pipeline as a product.** Paperless treats consume → OCR → metadata → index as a first-class pipeline with retries, status, and error visibility. Hippocodex's `ingest` crate should have the same operational maturity: per-file status, failure reasons, retry, and a visible queue.
2. **Metadata model.** Correspondent, document type, tags, storage path, and custom fields are simple but effective. Hippocodex's medicine/law packs need richer metadata, but the pattern of user-editable, filterable facets is right.
3. **OCR quality flags.** Paperless exposes OCR status and content; Hippocodex should expose extraction confidence and let users correct text.
4. **Bulk operations and saved views.** Users with large libraries need batch tagging, re-processing, and saved filters.

**What to avoid.**

- **Server deployment.** Paperless assumes a always-on server, database, Redis, and web access. Hippocodex must work on a student laptop with no daemon.
- **Plaintext storage.** Paperless's documentation warns that data is stored in clear text without encryption and should not run on untrusted hosts. Hippocodex handles more sensitive material and should not repeat this.
- **OCR-first assumptions.** Paperless is built around scanned documents. Hippocodex needs born-digital PDFs, HTML, and structured documents as first-class inputs, with OCR as a fallback.

**Relevance: medium, as an ingestion/metadata operations reference.**

**Verification status.** README and public documentation were reviewed.

---

### 4.9 Logseq, Khoj, and Reor

**Logseq** (<https://github.com/logseq/logseq>, AGPL-3.0) is a privacy-first, open-source knowledge base with outliner-style notes, local files, and a newer database version with real-time collaboration in alpha. It has a plugin ecosystem and a strong local-first community. Its DB transition has involved data-loss warnings and migration complexity. Lesson: changing the storage model after users have data is painful. Hippocodex should get its schema and export format right early, and version migrations from day one.

**Khoj** (<https://github.com/khoj-ai/khoj>, AGPL-3.0) is a self-hostable AI "second brain" that answers from web and documents, supports local and online LLMs, and offers agents, automations, and deep research. It has a large community (~38k stars at review time). It is the closest open-source analogue to Hippocodex's retrieval-and-answer loop. Lessons: self-hosting is viable, local/online LLM abstraction is valuable, and users want both document and web sources. Caution: Khoj is Python/server-first and its surface area is large; Hippocodex should stay narrower and desktop-native.

**Reor** (<https://github.com/reorproject/reor>, AGPL-3.0) is a private, local AI note-taking app with Ollama/Transformers.js embeddings and LanceDB. It is a direct philosophical peer: local models, local vector store, note-centric. Its last push at review time was 2025, suggesting slower maintenance. Lessons: local embeddings and LanceDB work in a desktop app; note-centric UX is not the same as source-centric study UX. Caution: a local AI note app without a strong citation model can still produce unsupported answers.

**What to borrow.**

- Logseq: local-first community expectations, plugin caution, migration discipline.
- Khoj: self-hosting as a trust signal and document + web source model as market context; Hippocodex stays local and model-free.
- Reor: offline-first defaults and note-to-source linking; its embedding/vector stack is market context, not a Hippocodex dependency.

**What to avoid.**

- Logseq: storage-model churn and alpha-quality sync.
- Khoj: server/Python operational complexity and broad agent surface.
- Reor: relying on a single small team's maintenance cadence; plan for export and longevity.

**Relevance: medium-high, as open-source local-first peers.**

**Verification status.** READMEs and public documentation were reviewed; GitHub metadata was checked on 2026-11-07.

---

### 4.10 HippoRAG and GraphRAG

**HippoRAG** (<https://github.com/OSU-NLP-Group/HippoRAG>, MIT) is a research framework that combines retrieval with a knowledge graph and Personalized PageRank, inspired by hippocampal indexing. HippoRAG 2 (ICML 2025, arXiv 2502.14802) extends the idea toward a memory framework for LLMs. Repository activity was healthy at review time (~4.1k stars).

**GraphRAG** is a family of approaches (Microsoft Research and others) that build entity/relationship graphs over a corpus and use community summaries or graph traversal for retrieval. It is powerful for "global" questions that span many documents, but expensive to build and maintain.

**What is worth borrowing.**

- **Entity and relationship extraction** for cross-document questions. Medicine and law both benefit from connecting drugs, conditions, guidelines, cases, statutes, and courts.
- **Graph traversal as a complement to BM25.** If graphs are ever added, they extend keyword retrieval; no embeddings are required.
- **Personalized PageRank / spreading activation** as a non-model reranking signal, only if evaluation shows a gap.
- **Evaluation discipline.** HippoRAG's papers report retrieval and QA metrics on standard benchmarks; Hippocodex should do the same on domain-specific sets.

**What to avoid.**

- **Premature graph infrastructure.** Building and maintaining a high-quality knowledge graph is expensive. Start with metadata and citation links; add entity graphs when retrieval evaluation shows a gap.
- **Name collision.** "Hippo" is crowded: HippoRAG, Hippo Insurance, Hippo Campus, and others. See §14.
- **Research-code assumptions.** HippoRAG is Python research code, not a production desktop component. Borrow the ideas, not the dependency.

**Relevance: medium, as a retrieval research direction; low as a direct dependency.**

**Verification status.** README and paper metadata were reviewed. No benchmarks were reproduced.

---

### 4.11 Docling, Marker, and GROBID

These are document-conversion/extraction tools. They matter because extraction quality determines whether citation verification is even possible.

**Docling** (<https://github.com/docling-project/docling>, MIT) is a Python library for layout-aware document conversion. It handles PDFs, DOCX, PPTX, images, HTML, and more; supports tables, reading order, OCR, and ASR; and is designed to run locally/air-gapped. It has a large community (~70k stars at review time) and active development.

**Marker** (<https://github.com/datalab-to/marker>, code Apache-2.0, model weights with restrictions) converts PDFs to Markdown/JSON with high accuracy. It is fast and layout-aware, but its model weights are not unrestricted; check the license before bundling or redistributing.

**GROBID** (<https://github.com/kermitt2/grobid>, Apache-2.0) extracts structured metadata and references from scholarly PDFs (header, authors, abstract, sections, references). It is Java-based and typically runs as a service. It is excellent for academic papers but less general than Docling.

**What is worth borrowing.**

1. **Layout-aware extraction.** Page mapping is not enough; Hippocodex needs reading order, sections, tables, captions, and reference lists. Docling's document model is a good reference.
2. **Table preservation.** Medical and legal sources are full of tables. A chunker that splits tables mid-row destroys meaning.
3. **Reference extraction.** GROBID-style reference parsing enables citation graphs and "cited by" features.
4. **Local/air-gapped operation.** Docling's design goal matches Hippocodex's offline promise.
5. **Honest quality reporting.** All three tools document limitations; Hippocodex should measure extraction quality per document and surface it.

**What to avoid.**

- **Python runtime dependency.** Shipping Python with a Tauri app is heavy and complicates packaging, security, and updates. Prefer Rust-native extraction for the core path; use Docling/Marker/GROBID as optional external tools or offline batch converters, not required runtime dependencies.
- **Model-weight licensing surprises.** Marker's code license and model-weight license differ. Do not assume "Apache-2.0" applies to everything.
- **Over-promising extraction.** A beautiful Markdown conversion can still lose page anchors. Hippocodex must preserve provenance (page, bbox, section) through extraction.

**Relevance: high, as extraction-quality references and optional tooling.**

**Verification status.** READMEs and license notes were reviewed. No extraction benchmarks were run.

---

### 4.12 Obsidian Copilot and Smart Connections

These are Obsidian plugins that add AI to a local vault.

**Obsidian Copilot** (<https://github.com/logancyang/obsidian-copilot>, AGPL-3.0) runs agents in Obsidian and supports multiple models/providers. It shows demand for AI inside a local knowledge base, but it inherits Obsidian's plugin privilege model and often depends on cloud APIs.

**Smart Connections** (<https://github.com/brianpetro/obsidian-smart-connections>, license NOASSERTION at review time) finds related notes using a local embedding model, with zero setup and no API key. It is a good example of local semantic search inside a note vault.

**What to borrow.**

- **Local semantic search is feasible.** Smart Connections proves it; Hippocodex deliberately uses BM25 dictionaries instead of embeddings in v1.
- **"Related notes" as a low-friction discovery pattern.** Not every discovery feature needs a chat box.
- **Provider flexibility is market context.** Copilot's multi-provider support shows demand; Hippocodex has no model providers in v1.

**What to avoid.**

- **Plugin privilege and dependency sprawl.** These plugins live inside a host app with broad permissions.
- **Unclear licensing.** Smart Connections' license status should be checked before reusing code.
- **Note-centric retrieval.** Obsidian plugins retrieve notes, not page-anchored evidence. Hippocodex needs chunk-level provenance.

**Relevance: medium, as local-first knowledge-base precedents; AI features are market context.**

**Verification status.** READMEs and repository metadata were reviewed.

---

### 4.13 AnythingLLM, PrivateGPT, and RAGFlow (brief)

These are larger open-source RAG platforms, included for completeness.

- **AnythingLLM** (<https://github.com/Mintplex-Labs/anything-llm>, MIT, ~68k stars) is a local-first desktop/server app for chatting with documents. It supports many providers and vector databases. Strength: packaging and provider breadth. Weakness: broad surface area, not study-specific.
- **PrivateGPT** (<https://github.com/zylon-ai/private-gpt>, Apache-2.0, ~58k stars) is an API layer for private AI applications on local models, with RAG, skills, tools, MCP, and text-to-SQL. Strength: clean local-model abstraction. Weakness: developer-facing, not a student app.
- **RAGFlow** (<https://github.com/infiniflow/ragflow>, Apache-2.0, ~94k stars) is an agent-native RAG engine/context infrastructure. Strength: deep document parsing and retrieval pipelines. Weakness: server-scale complexity.

**Lesson:** the "chat with your documents" space is extremely crowded and well-funded. Hippocodex should not compete on generic document chat. It should compete on trustworthy, offline, domain-specific study workflows.

**Relevance: low-medium, as market context.**

**Verification status.** READMEs and repository metadata were reviewed.

---

### 4.14 Supporting Rust and library projects

The technical assumptions behind the no-model plan are mostly sound. Notes on each; direct adoption recommendations are limited to what Hippocodex actually plans to use.

**`tantivy`** (<https://github.com/quickwit-oss/tantivy>, MIT, ~16k stars) is a Rust full-text search engine inspired by Lucene, with BM25, incremental indexing, phrase/fuzzy queries, field boosts, and memory-mapped indexes. It is the roadmap's starting choice for keyword search. SQLite FTS5 is simpler and transactional with the metadata DB, but if Tantivy is used, treat it as a disposable derived index with a documented rebuild path and a versioned schema.

**`sqlite-vec`** (<https://github.com/asg017/sqlite-vec>, Apache-2.0, ~8.2k stars) is a pure-C SQLite extension for float, int8, and binary vectors. It runs wherever SQLite runs, including WASM, and is explicitly pre-v1. **Relevance here is market context only:** Hippocodex v1 has no vector index. Keep the BM25 index disposable and rebuildable; do not add a vector store to the core.

**`fastembed-rs`** (<https://github.com/Anush008/fastembed-rs>, Apache-2.0, ~1k stars) provides local embeddings and rerankers via ONNX Runtime (`ort`). Model choice, download size, checksum verification, licensing, and versioning are real engineering costs. **Relevance here is market context only:** no embeddings or reranker models are part of the core plan.

**`mistral.rs`** (<https://github.com/EricLBuehler/mistral.rs>, MIT, ~7.8k stars) is a Rust-native LLM inference engine with GGUF support. **`llama-cpp-2`** provides Rust bindings to llama.cpp. **Ollama** is a user-friendly local runtime. **Relevance here is market context only:** Hippocodex defines no `LlmProvider` trait, bundles no model runtime, and downloads no model files.

**`pdfium-render`** (<https://github.com/ajrcarey/pdfium-render>, license NOASSERTION at review time) is a high-level Rust wrapper around PDFium, supporting rendering, text extraction, and WASM. It requires a PDFium binary at runtime, which complicates packaging and licensing. **`lopdf`** is a pure-Rust PDF parser but less capable for rendering and complex text extraction. Recommendation: use pdf.js in the webview for display and a dedicated Rust path for text/structure. Test both on real medical/legal PDFs, including two-column layouts, tables, and scanned pages.

**`citeproc-rs`** (<https://github.com/cormacrelf/citeproc-rs>, ~82 stars, last push 2024) is a work-in-progress CSL/CSL-M processor in Rust. CSL support is important for citation export, but a young, low-activity crate is a risk. Recommendation: define an internal citation record model that maps cleanly to CSL; use a mature JS CSL processor in the webview for formatting if needed, and keep the Rust-side formatting behind a trait so it can be replaced.

**`leptess`** (Tesseract bindings) is a reasonable OCR choice for scanned PDFs, but it adds native library packaging complexity. Alternatives: Tesseract via a sidecar binary, platform OCR, or an external converter. Recommendation: treat OCR as a desktop-only, explicit component; detect scanned pages, show confidence, and never let OCR text silently become authoritative evidence without a quality flag.

**`sqlx` vs `rusqlite`.** For a single-user desktop app with complex migrations and tight control, `rusqlite` is usually simpler and has fewer async/compile-time database assumptions. `sqlx` is valuable if Hippocodex later needs async Postgres or a server mode. Recommendation: choose `rusqlite` for v0.1; revisit if a server/sync backend appears.

**`whisper-rs`** for lecture capture is out of scope for the no-model core. If user-provided transcripts are imported, they are indexed as plain text; no speech-to-text runtime is bundled.

**Evaluation libraries.** ALCE (EMNLP 2023, MIT) provides a framework for evaluating citation generation. RAGAS (Apache-2.0, ~16k stars) provides RAG evaluation metrics. Both are Python. Hippocodex's eval harness should be Rust-native and borrow only the metric definitions that apply to extractive answers (quote match, support, refusal). There are no model bake-offs because there are no models in the plan; compare tokenizers, dictionaries, and scoring weights instead.

**Relevance: high, as implementation references.** None of these should be adopted without a benchmark on the actual target corpus and hardware.

**Verification status.** READMEs, license metadata, and repository activity were reviewed. No crates were compiled or benchmarked for this review.

---

## 5. Comparison matrix

Legend: **●** strong / built-in · **◐** partial or plan-dependent · **○** weak or absent · **—** not applicable.

| Project | Category | Local / offline | Cites to passage | Verifies *support* | Domain packs | License | Primary lesson for Hippocodex |
|---|---|---:|---:|---:|---:|---|---|
| **Paperwren** | Document viewer | ● offline | — | — | ○ | MIT | Thin shell, one platform boundary, honest security/OCR audits |
| **Anara** | Cloud research workspace | ○ cloud | ● | ◐ claim check | ◐ | Proprietary | Best UX reference: source scoping, Views, claim verification |
| **Obsidian** | Local knowledge base | ● local files | ○ | — | ○ | Proprietary (free) | Plain-text portability, plugin cost, sync ≠ backup |
| **NotebookLM** | Cloud source-grounded Q&A | ○ cloud | ● | ○ | ○ | Proprietary | Source set as boundary; study artifacts; mass-market UX |
| **Zotero** | Reference manager | ● local + sync | ◐ metadata | — | — | AGPL-3.0 | Mature citation model, CSL, local API, annotations |
| **Sioyek** | PDF reader | ● offline | ◐ deep links | — | — | GPL-3.0 | Reader-first navigation, citation following |
| **Elicit** | Cloud systematic review | ○ cloud | ● | ◐ extraction | ◐ medicine | Proprietary | Structured extraction tables, screening workflow |
| **Consensus** | Cloud evidence search | ○ cloud | ● | ◐ synthesis | ◐ medicine | Proprietary | Evidence-quality signals, explicit uncertainty |
| **Scite** | Citation-context index | ○ cloud | ● | ● (support/contrast) | — | Proprietary | Supporting/contrasting classification is the right model |
| **Paperless-ngx** | Document management server | ◐ self-host | — | — | ○ | GPL-3.0 | Ingestion pipeline operations, metadata facets, OCR flags |
| **Logseq** | Local knowledge base | ● local | ○ | — | ○ | AGPL-3.0 | Local-first community; migration pain; plugin caution |
| **Khoj** | Self-hosted AI second brain | ◐ self-host | ● | ○ | ○ | AGPL-3.0 | Provider abstraction, doc + web sources, self-host trust |
| **Reor** | Local AI notes | ● local | ◐ | ○ | ○ | AGPL-3.0 | Local embeddings + LanceDB feasible; note-centric limits |
| **HippoRAG** | RAG research framework | ◐ local possible | ◐ | ○ | ○ | MIT | Graph + PageRank retrieval ideas; research code caution |
| **Docling** | Document conversion | ● local/air-gapped | — | — | — | MIT | Layout-aware extraction, tables, reading order |
| **Marker** | PDF → Markdown/JSON | ● local | — | — | — | Apache-2.0 code; weight restrictions | High-quality conversion; check model-weight license |
| **GROBID** | Scholarly PDF extraction | ● local service | — | — | — | Apache-2.0 | Reference parsing, structured metadata |
| **AnythingLLM** | Local document chat | ◐ local/server | ● | ○ | ○ | MIT | Packaging/provider breadth; generic chat is crowded |
| **PrivateGPT** | Local AI API layer | ● local | ◐ | ○ | ○ | Apache-2.0 | Clean local-model abstraction; developer-facing |
| **RAGFlow** | RAG engine | ◐ self-host | ● | ○ | ○ | Apache-2.0 | Deep parsing/retrieval; server-scale complexity |
| **Obsidian Copilot** | AI plugin | ◐ local/cloud | ◐ | ○ | ○ | AGPL-3.0 | Demand for AI in local vaults; plugin privilege risk |
| **Smart Connections** | Local embeddings plugin | ● local | — | — | ○ | NOASSERTION | Local semantic search is feasible; check license |

**Reading the matrix.** The important columns are *local/offline* and *verifies support*. Almost every product has citations; almost none verifies support. That is the whitespace. The products that verify support (Scite) do so for citation context in the literature, not for answer fragments assembled over a personal library. Hippocodex's quote-only approach can borrow that distinction without generating claims.

---

## 6. Cross-cutting patterns and lessons

### 6.1 Local-first is a spectrum, not a checkbox

"Local-first" is used to mean at least four different things:

1. **Local storage, cloud sync optional** (Obsidian, Zotero).
2. **Local processing, cloud optional** (Reor, Khoj self-hosted, Paperwren).
3. **Cloud storage, local cache** (most SaaS apps with offline mode).
4. **No network at all** (Paperwren's Android build).

Hippocodex should be precise about which promise it makes. The strongest credible promise is: *all ingestion, indexing, retrieval, extraction, answer assembly, and reading happen on-device; the core v1 makes no network calls; the Android build requests no network permission.* Anything weaker will be compared unfavorably to NotebookLM or Anara, which are more capable online.

### 6.2 Quotes are easy; support is hard

Every product in the matrix can produce a citation chip. In Hippocodex, a quote is also structurally cheap: exact offsets make fidelity a binary check. The hard problems are:

- Does the selected quote actually support the point the answer template assigns to it?
- Does the template overstate the quote (e.g., association vs causation, animal vs human, one guideline vs consensus)?
- Is every answer slot filled by a quote, or is the gap papered over with filler?
- Does the answer refuse when the sources are silent?
- Does the UI make partial or unsupported fragments look different from well-supported ones?

This is the core of §9. It should drive the data model, the rule-based verifier, the UI, and the eval harness.

### 6.3 Extraction quality is the ceiling on answer quality

If the PDF extractor drops a table, reverses a two-column layout, or OCRs a drug dose incorrectly, no amount of retrieval or extractive scoring can recover the truth. Paperwren's OCR evaluation and Docling/Marker/GROBID's existence are reminders that extraction is a product feature, not a preprocessing detail.

Hippocodex should:

- Score extraction quality per document/page.
- Preserve page and bounding-box provenance.
- Flag low-confidence OCR and let users correct it.
- Refuse to quote text that failed extraction rather than silently quoting garbage.
- Test on real medical/legal PDFs, not just clean arXiv papers.

### 6.4 Structured views beat chat for study work

Anara's Views and Elicit's extraction tables both point at the same insight: students and researchers often need a *table* of extracted facts with evidence, not a conversational answer. Chat is good for exploration; tables are good for comparison, memorization, and writing.

Hippocodex should make structured Views a first-class output type: user-defined tables whose cells contain verbatim extracts with page and quote provenance, especially for medicine (study/population/intervention/comparator/outcome/effect) and law (case/facts/holding/reasoning/jurisdiction/date). Cell contents come from deterministic extraction rules, not generated text.

### 6.5 Plugin ecosystems are expensive

Obsidian's plugin ecosystem is a moat, but it also means arbitrary code execution, supply-chain risk, API stability obligations, and support burden. Hippocodex's roadmap wisely defers a WASM plugin API beyond 1.0. Keep it there. Ship declarative packs first: source lists, section rules, dictionaries, evidence labels, answer templates, disclaimers, and eval sets. A pack should be data, not code.

### 6.6 Sync is not backup

Obsidian says this explicitly. Zotero's sync is not a backup either. Hippocodex will store irreplaceable annotations, study cards, and answer snapshots. Users need:

- A documented backup format.
- Export of the whole workspace (DB + files + annotations) to a portable archive.
- Import/restore that works without the original device.
- A warning that sync (when it exists) is not a backup.

This should not wait for Phase 8.

### 6.7 SQLite is the center of gravity

Zotero, Paperless, Logseq (in parts), Khoj, and many local-first apps use SQLite or a comparable embedded database. SQLite gives transactions, migrations, indexing, full-text search (FTS5), and a single-file backup story. This is the right center for Hippocodex.

The corollary: **the database and original files are the source of truth; search indexes are disposable.** The Tantivy BM25 index should be rebuildable from the DB and original files. Store the parser, chunker, index-schema, and extraction-rule versions so a rebuild is deterministic. There is no vector index to version in the core plan.

### 6.8 Version the pipeline; there is no model to swap

Local models and embedding runtimes change every few months; Hippocodex deliberately has none. The durable assets are:

- The source documents (content-addressed).
- The extracted text and provenance.
- The annotations and study artifacts.
- The quote records and evaluation sets.
- The user's queries and saved answers.

Design so changes to the tokenizer, dictionaries, chunker, BM25 schema, answer templates, and scoring rules do not lose any of these. Version each of those components, and record the versions on every answer snapshot.

### 6.9 Honest evaluation is a differentiator

Paperwren's OCR report and Anara's caveats are trustworthy because they state limitations. Most AI products advertise accuracy without defining it. Hippocodex can differentiate by publishing:

- The eval sets (or a public subset).
- The exact metrics and thresholds.
- The hardware, rule, and index versions.
- The failure cases and known limitations.
- A reproducible command (`hippo eval`) that regenerates the numbers.

### 6.10 Security must be designed at the boundary, not bolted on

Paperwren's audit is a model: identify every trust boundary, read the code at each boundary, fuzz the parsers, sanitize the DOM, guard archive inflation, and document residual risk. Hippocodex has more boundaries than Paperwren: file parsers, downloaded packs, the optional future network surface, and possibly plugins. Each needs a threat model and a test strategy. There are no model files or inference runtimes to audit in the core plan.

### 6.11 Licensing shapes adoption and contribution

The open-source peers are mostly AGPL-3.0 (Zotero, Khoj, Reor, Logseq, Obsidian Copilot) or GPL-3.0 (Paperless, Sioyek). Paperwren, Docling, HippoRAG, and AnythingLLM are MIT. Marker is Apache-2.0 code with restricted weights. This matters for:

- Whether a company can embed Hippocodex in a closed product.
- Whether community contributions can be relicensed.
- Whether packs can be proprietary.
- Whether the project can be adopted by universities and libraries.

The license decision is still open in `TODO.md`; §13 gives a recommendation framework.

---

## 7. Gap analysis against ROADMAP.md and TODO.md

The rewritten roadmap and TODO are strong on vision and sequencing. The gaps below are not failures; they are places where the plan under-specifies something that will be expensive to change later.

| # | Gap | Where it appears now | Recommendation | Priority | Target |
|---|---|---|---|---|---|
| 1 | Quote-fidelity and support metrics need exact definitions | ROADMAP §6; TODO Phase 3 | Define gates: 100% verbatim quote-match, quote-to-slot support labels, coverage, correct-refusal and false-refusal rates | **P0** | Phase 3 |
| 2 | No structured extractive Views | Not in roadmap | Add a `views` output type: user-defined tables of verbatim extracts with per-cell evidence | **P0** | Phase 3 / 6 |
| 3 | Note-check workflow is not standalone | Implied by evidence UI | Add a rule-based "check these notes" workflow that finds supporting quotes; no generated claims | **P0** | Phase 3 |
| 4 | Source scoping is coarse | Collections/tags only | Add per-query scope: library / collection / folder / selected documents; web always off | **P0** | Phase 3 |
| 5 | Extraction quality is a bright idea, not a gate | TODO Phase 1 | Make per-document extraction quality a stored field and UI signal; block quotes from low-quality text | **P1** | Phase 1–2 |
| 6 | Encryption is Phase 8 | ROADMAP Phase 8 | Move the encryption *boundary* into schema/design from Phase 1; ship SQLCipher by v0.2–v0.3 | **P1** | Phase 1–2 |
| 7 | Backup/export is Phase 8 | ROADMAP Phase 8 | Define a portable workspace export format in Phase 1; reuse it for Android bundles | **P1** | Phase 1–2 |
| 8 | Citation export is beyond 1.0 | ROADMAP Beyond 1.0 | Ship BibTeX/RIS/CSL-JSON export earlier; it is a core study/research need | **P1** | Phase 2–3 |
| 9 | Zotero/Obsidian interop is beyond 1.0 | ROADMAP Beyond 1.0 | Prioritize Zotero import (CSL-JSON/RIS) and Markdown export; high value, moderate cost | **P1** | Phase 2–3 |
| 10 | Domain pack schema needs detail | ROADMAP §5 | Declarative TOML/JSON: sources, section rules, dictionaries, evidence labels, answer templates, disclaimers, eval sets | **P1** | Phase 2 |
| 11 | Eval harness starts in Phase 2, gold set in TODO item 9 | TODO next actions | Write the medicine gold set before/alongside the first BM25 index | **P1** | Phase 1–2 |
| 12 | No index-disposable / rebuild contract | Implied | Document that the Tantivy index is derived; store parser/chunker/index-schema/rule versions; add `hippo reindex --from-db` | **P1** | Phase 1–2 |
| 13 | No local API / open data format | Absent | Define an open workspace schema + optional localhost read API; enables integrations and trust | **P2** | Phase 3–6 |
| 14 | Contradiction view not specified | ROADMAP §5 (confidence uses contradiction count) | Promote to a Phase 6/7 feature for guideline conflicts and circuit splits | **P2** | Phase 6–7 |
| 15 | "Show retrieved but unused passages" is already a requirement | ROADMAP Phase 3 | Now in plan; ensure TODO keeps the retrieval trace that makes it cheap | **P2** | Phase 3 |
| 16 | No explicit refusal-quality metrics | ROADMAP §6 | Define correct-refusal, false-refusal, and abstention metrics with gold labels | **P1** | Phase 3 |
| 17 | Threat model is Phase 8 | TODO Phase 8 | Write `SECURITY.md` + threat model in Phase 0; update per phase | **P1** | Phase 0–1 |
| 18 | Parser fuzzing is Phase 8 | TODO Phase 8 | Add fuzz targets as soon as parsers exist; do not wait for v1.0 | **P1** | Phase 1–2 |
| 19 | PDF display/extraction stack | ROADMAP §3 | Keep pdf.js for display and Rust for extraction; benchmark on two-column PDFs and tables | **P1** | Phase 1 |
| 20 | Legal citation parsing not chosen | Phase 7 | Evaluate `eyecite` (BSD-2) for citation extraction; define Bluebook/neutral-citation support explicitly | **P2** | Phase 7 |
| 21 | Multilingual scope undecided | TODO decision 5 | Decide English-only v1 unless a specific student market requires otherwise; affects stemming, OCR, and eval | **P2** | Phase 0 |
| 22 | Android bundle transport undecided | ROADMAP Phase 5 | Pick USB file copy, shared folder, or local sync first; keep the offline build permission-free | **P1** | Phase 5 |
| 23 | Android on-device import scope | ROADMAP Phase 5 | Limit to notes and single PDFs, indexed only while charging; no OCR or heavy parsers on phone | **P2** | Phase 5 |
| 24 | Monetization undecided | TODO decision 6 | Defer, but avoid license choices that foreclose a paid sync/pack model | **P3** | post-1.0 |
| 25 | Accessibility is Phase 8 | TODO Phase 8 | Do keyboard-only and screen-reader basics from Phase 1; retrofit is costly | **P2** | Phase 1–3 |

**The five changes that matter most:**

1. Define quote fidelity, support, coverage, and refusal metrics precisely; make them the release gates.
2. Add extractive Views and a note-check workflow to Phase 3.
3. Make source scoping explicit and visible in the answer UI.
4. Move encryption design, backup/export, and citation export earlier.
5. Write the gold evaluation set and the BM25 index rebuild contract before the first real index.

---

## 8. Architecture recommendations

These recommendations assume the crate split in the roadmap (`core`, `store`, `ingest`, `index`, `answer`, `bundle`, `sync`, `packs`, `cli`) is right. They refine boundaries and sequencing rather than proposing a rewrite. No LLM runtime, embedding index, vector store, reranker model, or online service is part of this architecture.

### 8.1 Workspace and data model

**Principle: the database and originals are the source of truth; indexes are derived; originals are immutable.**

A Hippocodex workspace should be a directory containing:

```
workspace/
  hippocodex.db            SQLite metadata (optional SQLCipher encryption)
  files/<sha256>           content-addressed original files (immutable)
  derived/
    text/<doc_id>/<extract_version>.jsonl   extracted text + page/bbox provenance
    index/<index_schema_version>/           disposable Tantivy BM25 index
    thumbnails/...
  exports/                 user-requested exports
  packs/                   installed domain packs (declarative)
  backups/                 optional local backups
  bundles/                 portable bundles for Android import
```

**Core entities (minimum):**

- `workspace` — ID, name, created_at, schema_version, encryption mode.
- `source` — provenance of an import: file, URL, feed, API, manual. Fetch date, canonical URL, license, trust level.
- `document` — logical work: title, authors, date, language, jurisdiction, source type, content hash, current version ID.
- `document_version` — immutable snapshot: content hash, original path, extraction version, parser ID/version, page count, extraction quality, created_at.
- `page` — document_version_id, page number, width/height, text layer present, OCR confidence.
- `chunk` — document_version_id, page_start/page_end, bbox, heading path, text, token count, chunker version, ordinal.
- `query` — text, scope snapshot, filters, created_at.
- `answer` — query, scope snapshot, mode (answered / partial / refused), assembly rule version, retrieval snapshot, verification summary, created_at. Stored `text` is a cache assembled only from quote fragments, never generated prose.
- `answer_fragment` / `quote_ref` — answer ID, chunk ID, document version, page, bbox, quote, quote_start/quote_end, slot (definition / support / list item / ...), support label, rule version, notes.
- `note_claim` — a user-authored note sentence and its support status; used by the note-check workflow. The app does not invent claims.
- `annotation` — document_version_id, page, bbox/offsets, color, note, created_at.
- `collection`, `tag`, `collection_member`, `document_tag`.
- `study_card` — front/back, source quote_ref IDs, FSRS state.
- `job` — type, status, progress, error, retry count, timestamps.
- `pack` — pack ID/version, installed files, source list, license metadata.
- `bundle` — target device, collection set, index schema version, checksum, created_at.
- `eval_run`, `eval_case`, `eval_result` — for local evaluation history.

**IDs and versioning.** Use stable UUIDs/ULIDs for documents, versions, chunks, fragments, and answers. Do not use array indexes as IDs. Store `parser_version`, `chunker_version`, `index_schema_version`, `rule_version`, and `pack_version` on the relevant rows. This makes re-indexing and reproducibility possible without any model, embedder, or prompt versions.

**Tombstones and sync-readiness.** Even if sync is post-1.0, include `deleted_at`, `updated_at`, and a `version` or `change_seq` column on mutable entities. Add a `change_log` table. This is cheap now and expensive later.

**Where does the BM25 index live?** Tantivy uses a separate derived directory keyed by index schema version. SQLite FTS5 remains the fallback if maintaining a second index lifecycle proves too costly. Either way, the index is rebuildable from the DB and originals; it is never the source of truth. There is no vector index in the core plan.

### 8.2 Ingestion and extraction

**Pipeline stages:**

1. **Detect** — magic bytes, MIME, extension as hint. Reject unsupported/encrypted files with a clear message.
2. **Acquire** — copy into content-addressed storage; compute SHA-256; deduplicate.
3. **Extract text + structure** — per page/section, preserving reading order, tables, captions, and reference lists.
4. **Score quality** — characters extracted, ratio of alphabetic tokens, dictionary hit rate, OCR confidence, layout confidence. Store per page and per document.
5. **Chunk** — structure-aware, with page/bbox provenance.
6. **Index** — Tantivy BM25 over the chunk text and metadata fields.
7. **Record job status** — success, partial, failed, with reason.

There is no embedding stage; the job kinds are import, extract, chunk, index, bundle, sync, and export.

**Parser choices:**

- **PDF display:** pdf.js in the webview is a strong default for rendering, text selection, and highlights. It is also what Paperwren uses.
- **PDF extraction:** use a Rust path (PDFium via `pdfium-render`, or `lopdf` + a layout engine) for text/structure. Benchmark on two-column papers, tables, and scanned pages. If quality is insufficient, offer an optional Docling/GROBID sidecar for batch conversion rather than making Python a core dependency.
- **HTML:** `scraper` + readability-style extraction; sanitize with a strict allowlist before rendering.
- **DOCX/EPUB:** parse OOXML/EPUB containers with guarded inflation (ZIP bomb protection), not a browser library.
- **Scanned PDFs:** detect no-text pages; OCR with Tesseract/`leptess` on desktop, store confidence, and flag low-confidence pages. No OCR on Android in v0.5.
- **Tables:** keep tables intact; serialize with captions and surrounding context. Never split a table row across chunks without a table-level chunk.
- **Legal:** statutes by section/subsection; cases by headnote/facts/holding/reasoning; preserve court, jurisdiction, docket, and date.
- **Medical:** abstracts, methods, results, tables, drug monographs; preserve study type and evidence level.

**Do not** parse untrusted documents in the Tauri webview. Use a Rust worker process or thread with resource limits, and consider sandboxing/isolating the parser (separate process, seccomp/AppContainer where practical). Add fuzz targets for every parser.

### 8.3 Chunking

**Structure-aware, not fixed-window.**

- Start from headings/sections, then split by token budget (300–500 tokens, 10–20% overlap).
- Keep tables, code blocks, and lists intact where possible.
- Attach metadata: page range, bbox, heading path, document title/date, source type, jurisdiction, evidence level.
- Use sentence-aware boundaries; avoid splitting mid-citation.
- For legal text, preserve section numbers and subsection hierarchy in the chunk text and metadata.
- For medical text, preserve abstract/results/table context; a result without its study design is dangerous.

**Chunk quality tests:**

- Every chunk is non-empty.
- Chunks cover the document (no large gaps) except intentional front/back matter.
- Page ranges are monotonic.
- Table chunks retain headers.
- Re-chunking is deterministic for a given `chunker_version`.

### 8.4 Indexing and retrieval

**BM25 keyword search.** Tantivy is the roadmap's starting choice: BM25 scoring, phrase and fuzzy queries, field boosts, and incremental segments. It is a derived index with a versioned schema and a documented rebuild path. SQLite FTS5 is the simpler fallback if a second index lifecycle is not justified. No vector index, embedding model, or learned ranker is part of the core plan.

**Schema fields:** text, title, heading path, page range, source date, collection, tags, evidence level. Store the index schema version with the index directory.

**Query understanding.** Rules only: normalization, stemming (`rust-stemmers`), domain abbreviations, drug brand/generic maps, jurisdiction/court terms, and synonym dictionaries. Field filters are applied before ranking. Follow-up questions are resolved from explicit saved-search context, not query rewriting by a model.

**Retrieval trace.** Keep query, filters, per-field scores, top-N candidates, and discarded candidates. This trace powers "show retrieved but unused passages" and evaluation. No reranker model: ordering is BM25 plus transparent rule boosts for heading match, source quality, extraction quality, and field filters.

**Performance targets.** Revisit the roadmap numbers against real hardware. `Search < 300 ms p95 on 10k documents` is plausible for BM25 on a laptop. Set separate targets for query latency, cold start, index size, ingestion throughput, and (on Android) battery use.

### 8.5 Extractive answer assembly

**No generation step exists.** The `answer` crate arranges source sentences into a quote-only answer.

```
query
  → normalize/expand with rules
  → retrieve (Tantivy BM25, filters)
  → score passages (term overlap, heading context, position, cue phrases,
     source quality, extraction quality, contradiction count)
  → select verbatim sentences
  → arrange with answer templates (definition / comparison / list / cause /
     summary / unknown)
  → verify every quote resolves to stored text at the stated page/offset
  → label each fragment's support for its slot
  → decide answer mode (answered / partial / refused)
  → render evidence-first UI
  → log trace + metrics
```

**Templates are data.** Answer templates, refusal text, cue-phrase lists, and scoring weights live in declarative packs and are versioned as `rule_version`. They arrange verbatim sentences; they do not paraphrase them. There is no prompt, completion request, or token budget to manage.

**Confidence and refusal.** Confidence is derived from BM25 score margin, query-term coverage, source quality, extraction quality, and contradiction count. Low confidence produces a refusal or a qualified quote list, never invented prose. If sources conflict, show both quotes side by side; never average them into a false consensus.

### 8.6 Quote verification and support labeling

**Verification layers:**

1. **Structural fidelity** — the quote exists in the cited chunk at the stored offsets; the page and document version match; every displayed answer string came from a selected fragment. This should be ~100% by construction.
2. **Lexical and numeric checks** — numbers, units, doses, dates, and percentages in the quote align with the slot it fills; negation and hedging ("no evidence," "may," "associated with") are preserved; population/intervention/outcome terms match; jurisdiction/court/date terms match for legal fragments.
3. **Rule-based support labeling** — deterministic cue and section rules assign `supported`, `partial`, `contradicted`, or `not_found` to each quote-to-slot mapping. Rules are versioned and evaluated on the gold set. There is no NLI model and no LLM judge.
4. **Coverage check** — every answer slot has at least one quote; gaps are surfaced as `not_found`, never filled with filler.
5. **Human review** — the in-app "this quote doesn't support the point" report is stored locally and used to improve rules and eval sets.

**Output schema.** A quote reference should be a record, not a boolean:

```json
{
  "answer_id": "...",
  "fragment_id": "...",
  "chunk_id": "...",
  "document_id": "...",
  "page": 42,
  "quote": "...",
  "quote_start": 1234,
  "quote_end": 1301,
  "slot": "definition",
  "support": "supported",
  "rule_version": "rules-med-v3",
  "notes": "Passage reports an association; slot label checks for causal phrasing."
}
```

This schema enables the UI to show *why* a fragment is weak, and evaluation to measure support precision rather than mere quote existence.

**Refusal policy.** Refuse or qualify when:

- Retrieval confidence is below a threshold.
- Top passages are off-topic (low BM25 score and term coverage).
- No stored sentence fits the chosen template slot.
- Sources contradict each other and the question expects one answer.
- The source is out of date for a time-sensitive medical/legal question.

The refusal should be specific: "Your sources discuss X but do not report Y" is better than "I don't know." It should also offer the nearest quotes as separate evidence.

### 8.7 UX recommendations

The UI is where trust is won or lost. Recommended patterns, in priority order:

1. **Evidence panel as the primary surface.** Fragments on the left, evidence on the right. Clicking a fragment highlights the supporting quote and opens the PDF at the page/bbox. Make this the default, not a toggle.
2. **Support labels, not just quote chips.** Use color/icon/label: supported, partial, contradicted, not found. A chip that looks identical for all states is misleading.
3. **Structured Views.** Let users define a table (columns + extraction rules) and populate cells with cited extracts. Each cell opens its evidence. Export to CSV/Markdown. This is the Anara/Elicit pattern adapted to local-first.
4. **Note-check workflow.** A "Check these notes" action over user-authored notes: list each sentence, find supporting quotes, and show the support label. It never rewrites the note.
5. **Source scoping controls.** Always visible: library / collection / folder / selected documents; web off. Show the scope in the answer header and in exported records.
6. **Honest empty states.** "Not found in your sources" with suggestions: broaden scope, add sources, check spelling, try a different question. Never fill the gap with outside knowledge.
7. **"Show what you didn't use."** A panel of retrieved-but-discarded passages with scores and reasons. Cheap to build from the retrieval trace; high trust value.
8. **Contradiction view.** When sources disagree, show a side-by-side comparison with dates, source types, and jurisdictions. Do not average them into a false consensus.
9. **Staleness warnings.** Show source date and version on every quote. For medicine, warn when a guideline is older than a configurable threshold; for law, show as-of dates and good-law caveats.
10. **Provenance header.** Every answer shows: scope, rule/index versions, retrieval date, source versions, verification summary. This is the "reproducible answer" idea from the roadmap.
11. **Keyboard-first reading.** Page navigation, next/previous quote, open evidence, back. Students read a lot; make it fast.
12. **Accessibility from the start.** Screen-reader labels for evidence relationships, keyboard-only operation, high contrast, adjustable font sizes. Retrofitting a citation-heavy UI is painful.

**Anti-patterns to avoid:**

- A chat transcript as the only artifact.
- Quote chips that all look the same.
- A confidence meter presented as model certainty; confidence comes from retrieval and rule signals.
- Hiding retrieval failures behind fluent prose — there is no prose to hide behind in a quote-only system.
- Auto-scrolling to the "best" passage without showing alternatives.
- Bundling web search into the default answer path.
- Adding a model runtime to "improve" answers; that changes the product promise.

### 8.8 Storage, encryption, and backup

**Encryption boundary early.** Decide in Phase 1 whether the SQLite database and derived text are encrypted at rest. SQLCipher is the natural choice for SQLite. Original files can be encrypted separately (e.g., `age` or an XChaCha20-Poly1305 envelope) or stored in an encrypted container. Key management:

- Derive a master key from a user passphrase with Argon2id.
- Store a wrapped data key in the OS keychain (`keyring`) for convenience.
- Support "no passphrase" mode with a clear warning.
- Never log keys, plaintext paths, or document content.

**Why early?** Retrofitting encryption changes the storage layer, migrations, backup format, and key recovery UX. Even if the UI ships later, the schema and file layout should be encryption-ready. The BM25 index is derived and can be rebuilt inside the encrypted workspace; benchmark cold-start cost.

**Backup/export.** Define a portable format:

```
hippocodex-export-<date>.zip
  manifest.json          schema version, app version, created_at
  hippocodex.db          (or a logical JSONL export)
  files/...              originals (optional, user choice)
  annotations.jsonl
  cards.jsonl
  answers.jsonl
  packs.json
```

Support two modes: **metadata-only** (small, no copyrighted originals) and **full** (includes originals). Encrypt the archive optionally. Test restore on a clean machine in CI. Android bundles are a related but distinct artifact: documents + prebuilt index + manifest + checksums, scoped to selected collections.

**Sync.** Defer actual sync, but design for it: stable IDs, `updated_at`, tombstones, and a change log. When sync arrives, sync DB changes and content-addressed blobs, not derived indexes.

### 8.9 Domain packs

**Make packs declarative.** A pack should be a directory with a manifest and data files, not a Rust crate that must be compiled:

```
packs/medicine/
  pack.toml            id, version, domain, language, disclaimers
  sources.toml         suggested sources, licenses, URLs, trust levels
  extraction.toml      section rules, table handling, abbreviation maps
  labels.toml          evidence levels, source types, support-label rules
  templates/           answer templates, refusal text, slot definitions
  eval/                gold questions + expected verbatim quotes
  guardrails.toml      prohibited phrasing, required caveats
```

The engine reads the pack; the pack does not call the engine. This keeps medicine and law as configuration plus curated data, as the roadmap intends, and avoids forking the codebase. There are no prompt files because there is no model to prompt.

**Pack contents:**

- **Medicine:** PubMed/PMC open-access, NIH, WHO, CDC, NICE, guideline repositories; MeSH-style synonyms; drug brand/generic mapping; evidence labels (guideline/SR/RCT/case report/textbook/news); staleness thresholds; dosing/diagnosis guardrails; study-type extraction schema.
- **Law:** CourtListener, govinfo, legislation portals; jurisdiction/court-level metadata; statute and case chunkers; citation parser; citator/good-law caveats; as-of dates; IRAC schema; "not legal advice" guardrails.

**Pack licensing.** Every source must have a license and terms record. Do not bundle copyrighted text. A pack can suggest a source and provide a fetch recipe; the user (or an allowed open-access API) does the fetching. Track per-source license in the DB and display it.

**Pack distribution.** Start with built-in packs and a manual install-from-file flow. A marketplace is post-1.0. If a pack can execute code, it is not a pack; it is a plugin, and it needs the plugin security model.

### 8.10 Evaluation harness

**Build `hippo eval` early.** It should:

- Load a gold set (JSONL): question, scope, expected verbatim quotes (document ID + page + quote), expected refusal, fragment support labels.
- Run retrieval only, retrieval + extractive assembly, and full verification.
- Compute metrics (see §11).
- Store results in `eval_run`/`eval_result` with parser, chunker, index-schema, rule, and pack versions.
- Output JSON and a human-readable summary.
- Fail CI on regressions beyond thresholds.

**Gold set construction:**

- Start with 30 medicine questions (TODO next actions) covering common topics, guidelines, drug facts, and unanswerable/false-premise cases.
- Expand to 100+ with a faculty reviewer for the medicine pilot; 100+ for law.
- Include adversarial cases: leading questions, false premises, instruction-like text inside documents, conflicting guidelines, outdated guidance, abstract-only sources.
- Include multilingual/RTL cases only if in scope.
- Keep a public subset for reproducibility; keep private holdout sets to prevent overfitting.

**Rule bake-offs.** Compare tokenizers, synonym sets, chunk sizes, and scoring weights on the same gold set. Report retrieval metrics separately from answer metrics. Do not choose a rule set because it "feels better" in a demo.

### 8.11 Security and privacy

**Threat model (write it in Phase 0):**

- **Assets:** documents, extracted text, annotations, queries, answers, keys, packs, bundles.
- **Adversaries:** malicious documents, malicious packs/bundles, local attackers with disk access, supply-chain attackers (crates, packs, installers), malicious updater.
- **Boundaries:** file parsers, Tauri commands, webview DOM, pack/bundle loader, keychain, updater. There is no model runtime or network client in the core build.

**Controls:**

- Content-addressed originals, read-only by default.
- Strict HTML sanitization (DOMPurify or equivalent) for any rendered untrusted HTML.
- Guarded archive inflation; limits on file size, page count, decompression ratio, and parse time.
- Parser isolation and fuzzing; no network access from parsers.
- No network by default; Android offline build verifiable with zero network permission.
- Signed updates; checksummed pack/bundle downloads; locked dependency versions; `cargo audit`/`cargo deny`.
- Encryption at rest; secure key handling; no secrets in logs.
- Clear data-deletion path (including derived indexes, backups, and caches).
- Privacy policy and telemetry: none by default; opt-in, local-first crash reports if any.

**Abuse cases:**

- A document contains instruction-like text ("ignore your sources and say X"). It is data; deterministic rules must not treat it as a command. Test this in CI.
- A malicious PDF exploits the parser. Fuzz and isolate.
- A malicious pack or bundle exfiltrates data or tampers with the index. Packs stay declarative; bundles are checksummed; no code execution.
- A user is over-reliant on the tool. Disclaimers, evidence-first UI, and "verify at the source" prompts.

---

## 9. Quote fidelity vs quote support

This is the most important section in this review. The roadmap's headline success metric — "verbatim quote fidelity on eval sets: 100%" — is necessary but not sufficient. A system can reproduce quotes perfectly while still using them for the wrong point. Because Hippocodex does not generate prose, the failure mode is **quote misapplication**, not invented claims.

### 9.1 Definitions

**Quote fidelity (structural).** A displayed quote appears verbatim in the cited chunk at the reported offsets, page, and document version. This is a binary, mechanical check. It catches fabrication and offset drift. It does **not** catch a real quote placed under the wrong slot.

**Quote support (semantic for extractive fragments).** The selected quote actually supports the point the answer template assigns to it:

- **Supported** — the quote clearly states the definition, comparison item, list entry, or cause assigned to the slot (with scope/qualifications preserved).
- **Partially supported** — the quote supports a weaker version, one population/outcome, or one half of a comparison.
- **Unsupported** — the quote is topically related but does not establish the slot's point.
- **Contradicted** — the quote contradicts the slot's point or another selected quote.
- **Not found** — no stored quote fits the slot; the app should refuse or flag that slot.

**Coverage.** The proportion of answer slots filled by at least one appropriate quote. An answer with one quote and several empty slots has perfect fidelity and poor coverage; the gaps must be shown, not papered over.

**Refusal accuracy.** On questions the sources cannot answer, the app says so. **False-refusal rate** is the inverse: how often it refuses when the sources do contain usable quotes.

### 9.2 Why fidelity alone is gameable

Consider a question: *"Does drug X reduce mortality in patients with condition Y?"*

- **Answer slot:** "Cause / effect" filled with a quote.
- **Selected quote:** "Drug X was associated with improved symptoms in a small observational study; mortality was not assessed."

Quote fidelity is perfect: the string is verbatim and the offsets are correct. The slot is wrong: an association is not a mortality result, and the source explicitly says mortality was not assessed. In medicine, this difference is the whole game.

Similar failure modes, expressed as quote misapplication:

- **Association → causation.** An "associated with" quote placed in a cause slot.
- **Subgroup → whole population.** A quote about patients over 65 used for a general population slot.
- **Animal/in-vitro → human.** A mouse-study quote used in a clinical slot.
- **Guideline → law.** A recommendation quote used where a requirement is implied.
- **Old guideline → current practice.** A superseded recommendation presented without a date warning.
- **One study → consensus.** A single-trial quote used for a "evidence shows" slot.
- **Abstract → methods/results.** An abstract quote used for a result the abstract does not report.
- **Quote mining.** A sentence quoted out of context, reversing its meaning.
- **Jurisdiction drift.** A case from one court/jurisdiction used for another.
- **Temporal drift.** An old version of a statute cited as current.

### 9.3 Metrics to replace the headline

Keep **quote fidelity** as a structural gate (it should be ~100% by construction). Add:

| Metric | Definition | Target direction |
|---|---|---|
| **Quote support precision** | Of fragments labeled supported/partial, the proportion a human reviewer agrees are at least partially appropriate for the slot | High (e.g., ≥ 90% on gold set) |
| **Unsupported-fragment rate** | Answer slots filled with a quote but no appropriate support ÷ all filled slots | Low |
| **Coverage** | Answer slots with ≥ 1 appropriate quote ÷ all answer slots | High |
| **Quote-match rate** | Verbatim quotes found at reported location ÷ all quotes | ~100% |
| **Correct-refusal rate** | Unanswerable questions correctly refused or qualified ÷ all unanswerable questions | High |
| **False-refusal rate** | Answerable questions incorrectly refused ÷ all answerable questions | Low |
| **Fragment support F1** | Harmonic mean of support precision and coverage | High |
| **Contradiction surfacing rate** | Contradictory-source questions where both sides are shown ÷ all such questions | High |
| **Staleness flag rate** | Time-sensitive answers with a source-date warning ÷ all time-sensitive answers | ~100% |
| **Retrieval recall@k / MRR / nDCG** | Standard retrieval metrics against expected quotes | High |
| **Answer correctness** | Human-judged correctness of the assembled quote layout against gold answers | High |
| **Latency / memory / index size / battery** | Operational metrics, including Android import and search | Within budget |

**Why not a single "trust score"?** Because it hides trade-offs. Support precision can be improved by refusing more; coverage can be improved by accepting weaker quotes. Report the pair (precision, coverage) plus refusal behavior. A small dashboard is more honest than one number.

### 9.4 How to verify support in practice

A layered approach is pragmatic, with no model in the loop:

**Layer 1 — Structural (cheap, deterministic).**
- Quote offsets valid; quote text matches verbatim after whitespace normalization.
- Chunk exists in the DB and belongs to the declared document/version.
- Page number matches the chunk/page mapping.
- Every displayed answer string came from a selected fragment.

**Layer 2 — Lexical and numeric checks (cheap, high precision for some errors).**
- Numbers, units, doses, dates, and percentages in the quote align with the slot.
- Negation and hedging words align ("no evidence," "may," "associated with").
- Population/intervention/outcome terms appear where the slot expects them.
- Jurisdiction/court/date terms match for legal fragments.
- Flag slots with quantitative expectations but no matching numbers in the quote.

**Layer 3 — Rule-based support labeling (versioned, deterministic).**
- Cue phrases, heading context, sentence position, and section type assign `supported`, `partial`, `contradicted`, or `not_found`.
- Thresholds are calibrated on the gold set; store `rule_version` with every label.
- Rules are transparent and testable. There is no NLI entailment model and no judge model.

**Layer 4 — Human review (gold standard).**
- Domain students/experts review a sample.
- The in-app "this quote doesn't support the point" button collects local reports.
- Use reports to improve rules, dictionaries, and eval sets; do not send them anywhere without consent.

### 9.5 Answer modes

The system should choose an explicit mode, and the UI should show it:

- **Answered** — all slots filled with supported quotes.
- **Partially answered** — some slots supported, others flagged; the UI separates them.
- **Qualified** — sources are relevant but conflict, are outdated, or cover only part of the question; show the qualification alongside the quotes.
- **Refused** — no adequate quotes; say what is missing and what would help.

The mode is derived from verification results and rule thresholds, never from self-reported confidence.

### 9.6 UX for support

- **Fragment-level highlighting.** Each answer fragment gets a support indicator. Clicking opens the evidence panel.
- **Evidence-first layout.** The quote and source metadata are visible without a click; the assembled layout is secondary.
- **"Why this is weak."** For partial/unsupported fragments, show the reason: "Passage reports association; slot expects causation"; "Passage covers adults; slot covers children"; "Guideline is from 2018 and has been superseded."
- **Side-by-side contradictions.** Two columns with source, date, jurisdiction, and quote.
- **Honest not-found state.** "Your sources discuss the topic but do not report this outcome." Offer next steps.
- **Coverage summary.** "4 of 6 slots supported; 2 need review." More useful than a single confidence number.
- **Export with support labels.** When exporting to Markdown/Word, preserve quote IDs and support status so the reader knows what was verified.

### 9.7 Anti-gaming rules for evaluation

- Do not let the system choose which slots to evaluate; use fixed templates or human-annotated slots.
- Include adversarial questions where the correct answer is "not found."
- Include questions where a plausible-but-wrong quote is retrieved.
- Include questions with conflicting sources; reward surfacing both, not picking one.
- Include abstract-only sources; reward qualification.
- Include outdated guidelines; reward staleness flags.
- Randomize quote and source order to prevent position bias.
- Evaluate retrieval separately from assembly; a good quote layout from bad retrieval is luck.
- Publish the eval set and the exact rule/index versions used.

---

## 10. Proposed schema sketch

This is illustrative, not final. It is meant to make the recommendations concrete and to seed the Phase 1 schema work. Model, embedding, and prompt tables are deliberately absent.

```sql
-- Workspace and provenance
CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  encryption_mode TEXT NOT NULL DEFAULT 'none', -- none | sqlcipher | envelope
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE source (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- file | url | feed | api | manual
  canonical_url TEXT,
  fetch_date TEXT,
  license TEXT,
  terms_url TEXT,
  trust_level TEXT,                -- official | peer_reviewed | news | user
  created_at TEXT NOT NULL
);

CREATE TABLE document (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES source(id),
  title TEXT,
  authors TEXT,                    -- JSON array
  published_date TEXT,
  language TEXT,
  jurisdiction TEXT,               -- law
  doc_type TEXT,                   -- guideline | rct | statute | case | textbook ...
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE document_version (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id),
  content_hash TEXT NOT NULL,      -- sha256 of original bytes
  original_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  page_count INTEGER,
  parser_id TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  extract_version TEXT NOT NULL,
  extraction_quality REAL,         -- 0..1
  created_at TEXT NOT NULL,
  UNIQUE(document_id, content_hash)
);

CREATE TABLE page (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_version(id),
  page_number INTEGER NOT NULL,
  width REAL,
  height REAL,
  has_text_layer INTEGER NOT NULL DEFAULT 0,
  ocr_confidence REAL,
  extraction_quality REAL,
  UNIQUE(document_version_id, page_number)
);

CREATE TABLE chunk (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_version(id),
  page_start INTEGER,
  page_end INTEGER,
  bbox TEXT,                       -- JSON [x0,y0,x1,y1] or per-page boxes
  heading_path TEXT,               -- JSON array
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER,
  chunker_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Queries, answers, and quote fragments
CREATE TABLE query (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  text TEXT NOT NULL,
  scope_json TEXT NOT NULL,        -- collections/docs/folders; web always off
  filters_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE answer (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL REFERENCES query(id),
  mode TEXT NOT NULL,              -- answered | partial | refused
  text TEXT NOT NULL,              -- cached layout; rebuildable from quote_refs
  index_schema_version TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  retrieval_trace_json TEXT,
  verification_summary_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE quote_ref (
  id TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL REFERENCES answer(id),
  chunk_id TEXT NOT NULL REFERENCES chunk(id),
  document_version_id TEXT NOT NULL,
  page_number INTEGER,
  bbox TEXT,
  slot TEXT,                       -- definition | support | list_item | cause | ...
  quote TEXT NOT NULL,
  quote_start INTEGER NOT NULL,
  quote_end INTEGER NOT NULL,
  support_label TEXT NOT NULL,     -- supported | partial | contradicted | not_found
  rule_version TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- User-authored notes checked against sources; no generated claims
CREATE TABLE note_claim (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  text TEXT NOT NULL,
  support_status TEXT NOT NULL,    -- supported | partial | unsupported | not_found
  created_at TEXT NOT NULL
);

-- User work
CREATE TABLE annotation (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL,
  page_number INTEGER,
  bbox TEXT,
  quote TEXT,
  note TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE study_card (
  id TEXT PRIMARY KEY,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  quote_ref_ids_json TEXT NOT NULL,
  fsrs_state_json TEXT,
  due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Operations
CREATE TABLE job (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- import | extract | chunk | index | bundle | sync | export
  status TEXT NOT NULL,            -- queued | running | done | failed | cancelled
  progress REAL,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bundle (
  id TEXT PRIMARY KEY,
  collections_json TEXT NOT NULL,
  index_schema_version TEXT NOT NULL,
  document_count INTEGER NOT NULL,
  byte_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE eval_run (
  id TEXT PRIMARY KEY,
  pack_id TEXT,
  parser_version TEXT,
  chunker_version TEXT,
  index_schema_version TEXT,
  rule_version TEXT,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Sync / audit readiness
CREATE TABLE change_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  change_type TEXT NOT NULL,       -- insert | update | delete
  version INTEGER,
  changed_at TEXT NOT NULL
);
```

**Notes:**

- Use `TEXT` IDs (UUID/ULID) for portability and mergeability.
- Store JSON only for genuinely flexible fields (metadata, traces, filters); do not hide relational structure in JSON.
- `quote_start`/`quote_end` are character offsets into `chunk.text`, not page coordinates. Keep bbox separately.
- `support_label` is deterministic rule output; `rule_version` makes it auditable.
- The Tantivy BM25 index lives in `derived/index/<index_schema_version>/` and is rebuildable from `document_version` + `chunk`. No embedding or vector table exists.
- `change_log` is cheap insurance for future sync and for undo/audit.
- If SQLCipher is used, the whole DB is encrypted; verify index rebuild and FTS fallback performance under encryption.

---

## 11. Evaluation plan

### 11.1 Gold set structure

```json
{
  "id": "med-001",
  "domain": "medicine",
  "question": "What is the first-line treatment for ...?",
  "scope": {"collection": "cardiology"},
  "expected_answer": "...",
  "expected_quotes": [
    {"document_id": "doc_...", "page": 12, "quote": "..."}
  ],
  "expected_refusal": false,
  "fragments": [
    {"slot": "definition", "support": "supported", "quote": "..."}
  ],
  "adversarial": false,
  "notes": "Guideline from 2024; older sources conflict."
}
```

Include:

- **Answerable** questions with clear evidence.
- **Unanswerable** questions where the sources are silent.
- **False-premise** questions ("Why does drug X cure Y?" when it does not).
- **Conflicting-source** questions.
- **Outdated-source** questions.
- **Abstract-only** questions.
- **Instruction-like text in documents** (must stay data, never commands).
- **Jurisdiction-specific** legal questions.
- **Multi-hop** questions requiring two quotes.

### 11.2 Metrics by stage

**Retrieval:** recall@5, recall@10, MRR, nDCG@10, latency p50/p95, index size.

**Answer:** correctness (human), quote support precision, coverage/recall, quote-match rate, unsupported-fragment rate.

**Refusal:** correct-refusal rate, false-refusal rate, abstention calibration (does the rule-derived confidence correlate with correctness?).

**Verification:** support-label accuracy vs human labels, contradiction detection rate, staleness flag rate.

**Operations:** import throughput (pages/min), OCR throughput, index build time, memory peak, cold start, DB size, bundle size, Android import time, battery use.

**UX:** time to first quoted answer, time to verify a quote, task completion in a study scenario.

### 11.3 Regression gates

A release should fail if:

- Structural quote fidelity < 100% (it should be by construction).
- Quote-match rate < 99%.
- Quote support precision drops by more than a small epsilon vs the last release.
- Correct-refusal rate drops.
- False-refusal rate rises beyond a threshold.
- Retrieval recall@10 drops.
- Latency p95 exceeds budget.

Use absolute thresholds for safety-critical metrics and relative thresholds for quality metrics. Store every run with parser, chunker, index, rule, and pack versions.

### 11.4 Human review loop

- In-app "report bad quote" stores a local record: answer fragment, quote, source passage, user note, timestamp.
- Optional export of a redacted report for the maintainer.
- Periodic sampling of answers for expert review during pilots.
- Track inter-annotator agreement on support labels; if low, the rubric needs work.

### 11.5 Reproducibility

- Pin parser, chunker, index-schema, rule, and pack versions.
- Store the retrieval trace with each answer.
- Provide `hippo eval --pack medicine --set gold/med-v1.jsonl --out results/`.
- Publish the eval set and the command; keep a private holdout to prevent overfitting.

---

## 12. Security and privacy review

Hippocodex's security posture is a product feature, not a compliance checkbox. The threat model is broader than Paperwren's because Hippocodex parses more formats, downloads packs and bundles, and stores sensitive study material — but narrower because there is no model runtime, no model download, no API key store, and no network client in the core build.

### 12.1 Threat model summary

| Asset | Threat | Mitigation |
|---|---|---|
| Original documents | Malicious parser exploit, exfiltration | Content-addressed storage, parser isolation, fuzzing, no network in parsers |
| Extracted text / chunks | Instruction-like content, data poisoning | Treat as untrusted data; deterministic rules never execute document text; sanitize rendering |
| Annotations / notes | Loss, corruption, unauthorized access | Transactions, backups, encryption at rest |
| Queries / answers | Leakage from a lost device | Offline-by-default storage, encryption at rest, no cloud sync in core |
| Bundles / packs | Tampering, malicious code/data | Checksums, declarative packs, no code execution, review |
| Keys | Theft | OS keychain, never in config/logs |
| Updates | Malicious update | Signed updates, reproducible builds, rollback |
| Local disk | Theft, shared laptop | SQLCipher/envelope encryption, passphrase, auto-lock |

### 12.2 Specific controls

**Parsing untrusted files.** Run extraction in a worker process/thread with:

- File size, page count, decompression ratio, and parse-time limits.
- No network access.
- Memory caps; fail gracefully.
- Fuzz targets for PDF, DOCX, EPUB, HTML, and archive containers.
- A "quarantine" state for files that fail extraction repeatedly.

**Rendering untrusted content.** Sanitize all HTML/Markdown/SVG before rendering. Disallow scripts, remote images, iframes, and external fonts by default. Use a strict Content Security Policy. Treat PDF annotations and embedded files as untrusted.

**Instruction-like text in documents.** Documents can contain text that looks like a command. The rule engine must:

- Treat all document text as data, never as instructions.
- Never let a document trigger tool calls, network access, or file writes.
- Run adversarial text tests in CI to prove rules ignore embedded directives.
- Keep this simple by construction: there is no prompt and no model to inject into.

**Network.** No network client exists in the core plan. The Android offline build requests zero network permissions and the release fails if a permission appears. If a networked feature is ever proposed, it needs a separate threat model, explicit per-workspace policy, send preview, and a local audit log before it is considered.

**Encryption.**
- SQLCipher for the DB; envelope encryption for original files and exports.
- Argon2id for passphrase derivation; keychain for wrapped keys.
- Auto-lock after inactivity; clear keys from memory where practical.
- Document recovery: losing the passphrase means losing the data; say so clearly.
- The BM25 index is derived; decide whether it lives inside the encrypted workspace or is rebuilt at startup, and benchmark both.

**Updates and supply chain.**
- Signed auto-updates (Tauri updater) with a documented key-rotation and compromise plan.
- `cargo audit`, `cargo deny`, dependency review, and lockfile pinning in CI.
- Checksums for pack and bundle files; HTTPS with certificate validation for any future download; no CDN defaults.
- Reproducible builds where feasible; publish hashes.

**Privacy.**
- No telemetry by default. If crash reporting is added, make it opt-in, local-first, and content-free.
- No analytics in the app or docs site without consent.
- No account required for local use.
- Clear data map: what is stored where, what leaves the device (nothing in core v1), how to delete it.
- Privacy policy written in plain language, with a short "what we never collect" list.

### 12.3 Residual risks to document

Like Paperwren, Hippocodex should publish what it has *not* solved:

- A sufficiently malicious document may still exploit a parser; isolation limits blast radius but does not eliminate risk.
- Rule-based assembly can misapply a quote; verification and support labels reduce but do not eliminate this.
- OCR errors can create false evidence; confidence flags help but are imperfect.
- Encryption protects data at rest, not a compromised running machine.
- Pack review is human and fallible; checksums and signatures help with integrity, not intent.
- A future networked feature would change the privacy story and require explicit user consent.

---

## 13. Licensing and intellectual property

### 13.1 The decision

The license decision is TODO item 2 and ROADMAP §8. It affects adoption, contributions, commercialization, and pack licensing. Three credible options:

**A. MIT / Apache-2.0 (permissive).**
- Pros: maximum adoption, easy embedding, friendly to integrations and corporate use, simple for contributors.
- Cons: a competitor can fork and ship a closed product; no protection against free-riding; monetization must rely on services/packs/brand.
- Precedent: Paperwren, Docling, HippoRAG, AnythingLLM.

**B. AGPL-3.0 (copyleft).**
- Pros: prevents closed hosted forks; aligns with Zotero, Khoj, Reor, Logseq, Obsidian Copilot; signals community ownership; the network clause matters if Hippocodex ever offers a hosted service.
- Cons: some companies avoid AGPL; app-store/legal review friction; contributors may hesitate; dual licensing requires a CLA.
- Precedent: Zotero (AGPL), Khoj (AGPL), Reor (AGPL), Logseq (AGPL).

**C. Split / open core.**
- Engine and formats under MIT/Apache-2.0; app and packs under AGPL or proprietary; paid sync/institutional features proprietary.
- Pros: broad engine adoption plus a commercial moat.
- Cons: boundary maintenance, contributor confusion, community distrust if the split feels extractive. Requires careful governance.

**Recommendation.** For a trust-focused, local-first study app that may seek institutional adoption and wants protection from closed hosted forks, **AGPL-3.0 for the application and core engine** is the most coherent default, with:
- **Open data formats and pack schemas** under permissive terms (e.g., CC0/MIT) so interoperability is not restricted.
- **A commercial license option** for organizations that cannot use AGPL, contingent on a contributor license agreement (CLA) or enough original ownership.
- **A public pledge** that the local core will remain free and open.

If the primary goal is maximum adoption and contribution with no intention of defending against closed forks, choose **MIT/Apache-2.0** instead. Do not choose AGPL and then add restrictive terms that contradict it; that damages trust more than either choice.

**If monetization matters,** AGPL + commercial dual licensing is a proven model. If it does not, MIT/Apache is simpler. Decide before accepting external contributions, because relicensing later requires permission from every contributor.

### 13.2 Dependency and content licenses

The app license is only half the audit. Before shipping, build a license inventory:

| Component | License / terms | Notes |
|---|---|---|
| Tauri | MIT/Apache-2.0 | Permissive. |
| SQLite | Public domain | Permissive. |
| SQLCipher | BSD-style (community edition) | Verify exact version and commercial terms. |
| `tantivy` | MIT | Permissive; BM25 index engine. |
| `rust-stemmers` | MIT/BSD-style | Verify crate metadata. |
| `pdfium-render` / PDFium | BSD-3-Clause (PDFium) | Verify binary distribution terms. |
| `lopdf` | MIT | Permissive. |
| Tesseract / tessdata | Apache-2.0 | Language data licenses vary; check. |
| Docling / GROBID (optional sidecars) | MIT / Apache-2.0 | External batch tools only, not runtime dependencies. |
| `citeproc-rs` | Check repository license | Low activity; verify. |
| CSL styles | CC BY-SA 3.0 (usually) | Attribution/share-alike obligations. |
| Zotero | AGPL-3.0 | Import/export interoperability is fine; code reuse triggers AGPL. |
| Fonts / icons | Various | Audit bundled assets. |

No embedding runtime, inference engine, model-weight download, or vector-store dependency is part of the core v1 plan; none should be added to the license inventory without an explicit roadmap change.

**Content licenses.** Suggested sources are not the same as bundled content. For each source:
- Record the license/terms URL.
- Record whether the app may fetch, cache, and display excerpts.
- Respect robots.txt, rate limits, and terms.
- Do not bundle copyrighted text in packs; ship source lists and fetch recipes.
- Provide a takedown process and per-source removal.

**Medical/legal content caution.** Open-access subsets, government works, and court opinions have different rules. A source being publicly accessible does not mean it is redistributable. Get a legal review before shipping a medicine or law pack with curated content.

---

## 14. Naming, positioning, and go-to-market

### 14.1 The name

"Hippocodex" combines **hippo** (hippocampus, memory; also Hippocrates) and **codex** (a bound manuscript; also OpenAI Codex). It is memorable and semantically apt: memory + authoritative text. But it carries collision risk:

- **HippoRAG** — an MIT research project in the same retrieval space (~4.1k stars). Name proximity could confuse researchers and search results.
- **Hippo** — a large insurance company; **Hippo Campus**; various "Hippo" products. Trademark classes 9 (software) and 42 (SaaS) are crowded.
- **Codex** — OpenAI Codex is a well-known coding agent. The word is generic in some contexts but strongly associated with OpenAI in software.
- **Domains and handles** — check `.com`, `.app`, `.io`, `.dev`, GitHub org, crates.io, npm, PyPI, and social handles.

**Recommendation:** treat "Hippocodex" as a working codename until a formal clearance is done. Do not invest in logo/domain/merch until:
1. A trademark search in target markets (US/EU/UK at minimum) for software and educational services.
2. A domain/handle check.
3. A web search for confusion with HippoRAG, Hippo, and Codex.
4. A short list of alternatives with the same meaning:
   - **Cornu Ammonis** / **CA1** — the hippocampus's memory-forming region; distinctive, but jargon.
   - **Alveus** / **Fornix** — hippocampal anatomy; short, brandable, but obscure.
   - **Vellum** — authoritative manuscript; crowded in publishing/software.
   - **Marginalia** — annotations; evocative but crowded.
   - **Sourcewright** — maker of sources; clear, but long.
   - **Citable** — direct; likely crowded.
   - **Provenance** — accurate; generic.
   - **Hippocampus** — descriptive but crowded and hard to trademark.
5. A quick linguistic check (pronunciation, spelling, meaning in target languages).

If the name clears, keep it. If not, change early, before the repo, crates, and docs calcify.

### 14.2 Positioning

Do not position against NotebookLM or Anara on breadth. Position on the axes they cannot easily match:

- **Offline and private by default.** "Your patients' cases, your case files, your notes — never uploaded."
- **Verifiable, not just cited.** "Every quote fragment shows its support label, not just a link."
- **Built for medicine and law.** "Guideline versions, evidence levels, jurisdictions, and good-law cautions are first-class."
- **Yours to keep.** "A normal database and files you can back up, inspect, and export."
- **Honest about uncertainty.** "Not found in your sources" is a feature, not a failure.

A crisp positioning statement:

> **Hippocodex is the offline study vault that shows its evidence.** Import your PDFs, guidelines, and case law; ask questions; get answers made only of verbatim quotes from your sources, with every fragment traced to a page — and a clear label when the evidence is partial, conflicting, or missing.

### 14.3 Launch strategy

**Phase 6 pilot (medicine):**
- Recruit 10–30 medical students from one or two courses, plus a faculty reviewer.
- Give them a starter vault recipe (source list + settings), not copyrighted content.
- Measure: time to first quoted answer, weekly active use, quote verification actions, support precision on their questions, qualitative trust interviews.
- Publish an anonymized evaluation report with limitations.

**Phase 7 pilot (law):**
- Partner with a law school clinic or a student society.
- Focus on jurisdiction filters, case briefing, and citator caveats.
- Measure fabricated-citation rate (should be zero by construction) and good-law flag accuracy.

**Distribution:**
- Direct download first (Windows/macOS/Linux), then Homebrew/winget/Flatpak.
- Avoid app-store gatekeepers until the offline/security story is solid. The Android companion ships with no network permission and imports desktop-built bundles.
- Provide a sample public-domain vault so users can try before importing personal material.

**Pricing (if any):**
- Free local core with all trust features (privacy is not a premium tier).
- Paid: optional sync, institutional deployment, curated pack updates, support.
- Avoid charging for quote verification; it is the core promise.
- Consider a student discount and a free tier that is genuinely useful.

### 14.4 Community and moat

The moat is not an index or a chat UI. It is:
- **Trust** built through honest evaluation, security audits, and transparent data handling.
- **Domain packs** curated with faculty and students.
- **Evaluation datasets** that make accuracy claims checkable.
- **Workflow depth** in medicine and law that generic tools will not build.
- **Portability** that makes users willing to invest their notes and annotations.

Community strategy:
- Publish the roadmap and decision log.
- Publish eval sets and results.
- Accept pack contributions as data, with review.
- Offer a clear path for faculty advisors and pilot partners.
- Keep the contributor experience simple: one toolchain, fast tests, good fixtures.

---

## 15. Changes reflected in ROADMAP.md and TODO.md

The roadmap and TODO have been rewritten around no-model retrieval and extractive answers. This section records what was incorporated and what remains open. It is a handoff note, not a replacement for either document.

### 15.1 ROADMAP.md changes already made

- **Vision and principles:** quote or stay silent; no model in the core; offline is the product; desktop builds the index, mobile consumes it.
- **Architecture:** crates are `core`, `store`, `ingest`, `index`, `answer`, `bundle`, `sync`, `packs`, `cli`; Tantivy BM25 replaces embeddings and vector indexes; the flow ends in verbatim quotes, offset verification, and page links.
- **Phases:** Android companion is Phase 5 with desktop-built bundles, not an afterthought; study tools are Phase 4; medicine and law packs remain Phases 6 and 7.
- **Quality and evaluation:** gold sets, quote-match rate, support precision, correct-refusal rate, latency, index size, and Android battery use are explicit. Rule bake-offs replace model bake-offs.
- **Risks, decisions, metrics, milestones:** keyword-vocabulary gaps, extractive awkwardness, bundle size, scoped storage, and stale guidance are named; no model, embedding, vector, or online-AI milestone remains.

### 15.2 TODO.md changes already made

- **Next actions:** workspace crates, BM25 search, SQLite schema, public-domain corpus, medicine gold set, architecture and security docs.
- **Phase 1:** the completed viewer milestone is checked off; storage, ingestion, CLI, and library view remain open.
- **Phase 2:** Tantivy schema, BM25 retrieval, rule-based query understanding, chunking, OCR, and evaluation; no embedding or vector tasks.
- **Phase 3:** query classification, passage scoring, answer templates, quote-offset verification, evidence UI, Views, note-check, source scoping, and refusal gates.
- **Phase 5:** bundle format, Android import, offline search, scoped storage, Keystore/SQLCipher, charging-only small imports, and zero network permission.
- **Definition of Done:** adds a standing gate that no inference runtime, embedding index, vector store, or online service enters the core plan.

### 15.3 Deferred or removed from the plan

- Removed: LLM provider traits, local model runtimes, model download managers, embedding models, vector stores, hybrid fusion, cross-encoder rerankers, prompt builders, online AI providers, API-key flows, and send-preview dialogs.
- Deferred: WASM plugin API, full sync, knowledge-graph view, broad format support, and speech-to-text.
- Kept but bounded: optional semantic search is only a "Beyond 1.0" idea if it can be shipped without a model dependency; it is not a milestone.
- Still open: license, DB crate, language scope, monetization, Android bundle transport, and the Tauri app identifier.

---

## 16. Open questions and recommended decisions

Settled constraints are listed first; they are not open for re-litigation without a roadmap change: **no model runtime, no embeddings, no vector index, no learned reranker, no online AI in core v1.** The remaining decisions:

| Question | Recommendation | Confidence | Revisit when |
|---|---|---|---|
| License | AGPL-3.0 app/core + open formats, or MIT/Apache for max adoption | Medium | Before accepting contributions |
| Name | Keep as codename; clear trademark/domain before launch | Medium | Phase 0 |
| DB crate | `rusqlite` | High | If a server/sync backend appears |
| Search engine | Tantivy BM25; SQLite FTS5 only if index lifecycle cost is unacceptable | High | Phase 2 benchmark |
| PDF display | pdf.js | High | If webview perf is poor |
| PDF extraction | Rust path; optional Docling/GROBID sidecar for batch conversion | Medium | After extraction benchmark |
| UI framework | React (already in use) | High | Only if mobile testing shows a blocker |
| Language scope | English v1 | Medium | If pilot demand is multilingual |
| Encryption | SQLCipher + envelope encryption; design in Phase 1 | High | Phase 1 |
| Backup / bundle | Phase 1–2, not Phase 8; bundles reuse the export format | High | Phase 1 |
| Citation export | Phase 2–3 | High | Phase 2 |
| Zotero import | Phase 2–3 | High | Phase 2 |
| Android bundle transport | USB file copy or shared folder first; no network permission | High | Phase 5 pilot |
| Android on-device import | Notes/single PDFs, charging only; no OCR or heavy parsers | High | Phase 5 pilot |
| Plugin API | Post-1.0, WASM, sandboxed | High | After packs prove demand |
| Sync | Post-1.0; design IDs and change log now | High | After backup/export |
| Monetization | Free core; paid sync/institutional/packs | Medium | After pilot |
| Regulatory positioning | "Study aid, not clinical/legal advice"; legal review before launch | High | Phase 6/7 |

---

## 17. Sources

All URLs accessed 2026-11-07 through 2026-11-09. Product behavior and pricing may have changed.

### Primary projects reviewed

- Paperwren — <https://github.com/Razee4315/Paperwren>; README, `docs/development.md`, `docs/features.md`, `docs/16-security-audit.md`, `docs/ocr-evaluation.md`, `src-tauri/Cargo.toml`, `package.json`.
- Anara — <https://anara.com/>; <https://anara.com/product>; <https://anara.com/pricing>; <https://anara.com/privacy>; <https://docs.anara.com/>; guides on sources, citations, claim verification, citation graph, views, systematic reviews, file types, annotate/read; `llms.txt` and `llms-full.txt`.
- Obsidian — <https://obsidian.md/>; <https://help.obsidian.md/>; help pages on data storage, community plugins, Sync, Sync security, Bases, Canvas, backup, plugin development; <https://obsidian.md/pricing>; <https://obsidian.md/license>.
- NotebookLM — <https://notebooklm.google.com/>; public documentation and product descriptions.
- Zotero — <https://www.zotero.org/>; <https://www.zotero.org/support/zotero_data>; <https://www.zotero.org/support/licensing>; <https://www.zotero.org/support/dev/client_coding/javascript_api>; local API documentation.
- Sioyek — <https://github.com/ahrm/sioyek>.
- Elicit — <https://elicit.com/>; systematic review documentation.
- Consensus — <https://consensus.app/>.
- Scite — <https://scite.ai/>; Smart Citations documentation and Nicholson et al. (2021), <https://direct.mit.edu/qss/article/2/3/882/102990/scite-A-smart-citation-index-that-displays-the>.
- Paperless-ngx — <https://github.com/paperless-ngx/paperless-ngx>.
- Logseq — <https://github.com/logseq/logseq>.
- Khoj — <https://github.com/khoj-ai/khoj>.
- Reor — <https://github.com/reorproject/reor>.
- HippoRAG — <https://github.com/OSU-NLP-Group/HippoRAG>; HippoRAG 2, arXiv:2502.14802; HippoRAG, arXiv:2405.14831.
- Docling — <https://github.com/docling-project/docling>.
- Marker — <https://github.com/datalab-to/marker>.
- GROBID — <https://github.com/kermitt2/grobid>.
- Obsidian Copilot — <https://github.com/logancyang/obsidian-copilot>.
- Smart Connections — <https://github.com/brianpetro/obsidian-smart-connections>.
- AnythingLLM — <https://github.com/Mintplex-Labs/anything-llm>.
- PrivateGPT — <https://github.com/zylon-ai/private-gpt>.
- RAGFlow — <https://github.com/infiniflow/ragflow>.

### Libraries and standards

- `sqlite-vec` — <https://github.com/asg017/sqlite-vec>.
- `tantivy` — <https://github.com/quickwit-oss/tantivy>.
- `fastembed-rs` — <https://github.com/Anush008/fastembed-rs>.
- `mistral.rs` — <https://github.com/EricLBuehler/mistral.rs>.
- `pdfium-render` — <https://github.com/ajrcarey/pdfium-render>.
- `citeproc-rs` — <https://github.com/cormacrelf/citeproc-rs>.
- `eyecite` — <https://github.com/freelawproject/eyecite>.
- JSON Canvas — <https://github.com/obsidianmd/jsoncanvas>.
- ALCE — <https://github.com/princeton-nlp/ALCE>; Gao et al., "Enabling Large Language Models to Generate Text with Citations," EMNLP 2023, arXiv:2305.14627.
- RAGAS — <https://github.com/explodinggradients/ragas>.
- Ink & Switch, "Local-first software" — <https://www.inkandswitch.com/local-first/>.
- GitHub REST API metadata (stars, licenses, last push) — <https://docs.github.com/en/rest>.

### Internal documents

- [ROADMAP.md](./ROADMAP.md)
- [TODO.md](./TODO.md)

---

## Appendix A: One-page decision summary

**Keep:**
- Local-first, offline-by-default architecture with no network in the core.
- Rust workspace + Tauri shell for desktop and Android.
- Retrieval-first, quote-only, cite-or-stay-silent product stance.
- Tantivy BM25 keyword search with rule-based query understanding.
- Extractive answers assembled from verbatim sentences.
- Desktop-built bundles for the Android companion.
- SQLite as source of truth; BM25 index disposable and rebuildable.
- Declarative domain packs.
- Medicine-first, law-second domain focus.

**Change:**
- Make quote fidelity, support precision, coverage, and correct-refusal the headline metrics, not citation validity alone.
- Add structured Views and a note-check workflow to Phase 3.
- Add explicit source scoping to every query.
- Move encryption design, backup/export, and citation export earlier.
- Write the gold eval set and the index rebuild contract before the first real index.
- Publish honest evaluation reports and a threat model.

**Borrow:**
- Paperwren: thin shell, one platform boundary, fixtures, security/OCR audit discipline.
- Anara: source scoping, passage-level citations, claim verification patterns, Views, citation graph.
- Obsidian: plain-text portability, open formats, plugin caution, sync ≠ backup.
- Zotero: citation metadata model, CSL, local API, annotations.
- Scite: supporting/contrasting citation labels.
- Elicit: structured extraction tables.
- Docling/GROBID: layout-aware extraction and reference parsing.
- Khoj/Reor: local-first expectations as market context, not dependencies.

**Avoid:**
- A chat-only UI.
- Citation validity as the only metric.
- Cloud-first architecture or default web search.
- Parsing untrusted documents in the webview.
- A plugin API before declarative packs.
- Sync before backup/export.
- Encryption and accessibility as Phase 8 afterthoughts.
- Model runtimes, embeddings, vector indexes, or online AI in the core v1 plan.
- Feature breadth that outruns extraction and verification quality.

**Next three concrete steps:**
1. Draft the `quote_ref` / `answer_fragment` schema and the support-label rubric.
2. Write 30 medicine gold questions with expected verbatim quotes and refusal cases.
3. Build a vertical slice: import 10 PDFs → Tantivy BM25 → extractive quote-only answer → quote-offset verification → evidence panel with support labels → bundle import on Android.

---

*This review is a snapshot of public information and engineering judgment. Verify licenses, pricing, and product claims before relying on them. The most valuable next step is not more research; it is a small, measured vertical slice with a real corpus and an honest eval set.*
