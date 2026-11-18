# Hippocodex Roadmap

> **Your sources, remembered and quoted.**
> A local-first, Rust-built study vault for students. Store documents, search them offline, and get compact answers made only of passages from your own library — with page numbers, highlights, and quotes.

---

## 1. Vision

Students drown in PDFs, slides, guidelines, case law, and feeds. Tools that invent fluent prose are a liability in medicine and law.

Hippocodex is deliberately not one of them. It is a **retrieval-and-extract tool**:

- It searches with **BM25 keyword search**, not a language model.
- It answers by **selecting and arranging existing sentences**, never by generating new ones.
- If the library is silent, it says **“Not found in your sources.”**
- Every response item links back to a document, page, and exact quote.

The product should feel helpful like an answer engine while remaining auditable like an index card box.

**Launch audience:** medical students → **next:** law students → **later:** any field with a citable corpus.

---

## 2. Guiding Principles

1. **Quote or stay silent.** Every output word comes from a source. No paraphrase, no synthesis, no invented filler.
2. **No model in the core.** No LLM, no embeddings, no model downloads, no inference runtime in the desktop or Android app.
3. **Offline is the product.** Indexing, retrieval, answer assembly, and reading all work without a network connection.
4. **Desktop builds the index; mobile consumes it.** Android is a fast read-and-search companion, not a heavy ingestion device.
5. **Evidence first.** A result is a quote with provenance; the “answer” is a layout of quotes.
6. **Structure before cleverness.** Headings, sections, pages, and sentence boundaries carry more value than statistical tricks.
7. **Study aid, not advice.** Persistent disclaimers for medical and legal use.
8. **Portable and inspectable.** SQLite is the source of truth; indexes are disposable and rebuildable.
9. **Boring, reliable Rust.** Small crates, strong types, heavy testing, reproducible builds.

---

## 3. Architecture Overview

```
hippocodex/
├─ Cargo.toml                workspace
├─ crates/
│  ├─ core/       shared types, errors, config, pack definitions
│  ├─ store/      SQLite metadata, file storage, migrations
│  ├─ ingest/     PDF, EPUB, HTML, Markdown, DOCX, OCR, RSS
│  ├─ index/      tantivy BM25 index, query parsing, snippets
│  ├─ answer/     query classification, passage scoring, extractive assembly
│  ├─ bundle/     portable vault bundles for Android import
│  ├─ sync/       RSS/web refresh, dedup, change detection
│  ├─ packs/      medicine/, law/ (sources, rules, dictionaries, disclaimers)
│  └─ cli/        `hippo` command-line tool
└─ app/           Tauri 2 shell + React UI (desktop and Android)
```

**Core flow**

`Source → Extract → Chunk → Index (BM25) → Retrieve → Select passages → Assemble quote-only answer → Verify offsets → Display with page links`

**Tech choices**

| Concern | Starting choice |
|---|---|
| App shell | Tauri 2 (desktop + Android) |
| Async runtime | tokio |
| Database | SQLite via `rusqlite` or `sqlx`; SQLCipher for encryption |
| Search | `tantivy` (BM25, phrase, fuzzy, field filters) |
| Stemming | `rust-stemmers` + domain dictionaries |
| Answer assembly | Rule-based extractor in `answer/` |
| PDF display | `pdfjs-dist` in the webview |
| PDF extraction | `pdfium-render` or `lopdf`, with page mapping |
| OCR | `leptess` (Tesseract), desktop first |
| Web / RSS | `reqwest`, `scraper`, `feed-rs` |
| Android storage | Scoped storage via Tauri plugins; app-private vault directory |
| Logging | `tracing` |

Deliberately absent from v1: LLMs, local or online inference, embedding models, vector indexes, reranker models, and chat-style generation.

---

## 4. Phases

### Phase 0: Foundations *(setup)*
**Goal:** a workspace that builds, tests, and ships on CI.

- Cargo workspace, crate boundaries, lint/format rules (`clippy`, `rustfmt`, `deny`)
- CI: build + test on Linux, macOS, Windows; Android cross-check job
- Error-handling convention (`thiserror` in libs, `anyhow` in binaries)
- Logging/tracing conventions
- Project docs: README, CONTRIBUTING, SECURITY, ARCHITECTURE
- License decision (see §8)
- Name checks: crates.io, GitHub, domains, trademark

**Exit criteria:** `cargo test` green on desktop targets; empty CLI runs; Android target check runs.

---

### Phase 1: Viewer and vault MVP *(v0.1)*
**Goal:** a trustworthy document viewer with a local library.

- SQLite schema + migrations for documents, tags, collections, and jobs
- Import: PDF, Markdown, plain text/code, images, CSV/TSV, DOCX, PowerPoint. PPTX decks are drawn from their own shapes, theme, pictures, tables and cached chart values, with a local slide show, speaker notes and hidden-slide skipping; the separate text projection keeps bullet/nesting-aware slide text, notes and hidden-slide markers for retrieval. Legacy PPT gets best-effort text recovery. OOXML inflation is guarded before any part is decompressed.
- Content-hash deduplication
- Text extraction with page mapping
- Recents, drag-and-drop, keyboard shortcuts, themes, frosted-glass option
- New note button and editor for Markdown/plain-text notes: desktop reads and writes only inside the configured Library with manual save (Ctrl/⌘+S); browser preview keeps notes session-only
- Sidebar file search walks the whole Library by file name or relative path on desktop
- External links always open in the real browser
- CLI: `hippo import`, `hippo list`, `hippo open`

**Exit criteria:** open any supported file from disk; recents persist; no network calls.

---

### Phase 2: Offline index and search *(v0.2)*
**Goal:** search the whole vault quickly and precisely.

- Structure-aware chunking (headings, sections, tables, captions; page provenance)
- Tantivy schema with fields: text, title, heading path, page range, source date, collection, tags, evidence level
- Query parsing: phrases, fuzzy terms, field filters, synonyms, abbreviations
- Snippet generation with hit highlighting and “open at page”
- Incremental indexing with a resumable job queue
- Portable bundle format: documents + prebuilt index + metadata + manifest
- Retrieval eval harness: recall@k, MRR, latency, index size

**Exit criteria:** on a 10k-document vault, search p95 < 300 ms; a hit opens the exact page.

---

### Phase 3: Extractive answers and evidence UI *(v0.3)*
**Goal:** feel like an answer engine without generating a single word.

- Query classifier: definition, comparison, list, cause, summary, unknown
- Passage scoring: query-term overlap, sentence position, heading context, definition cues
- Answer templates that arrange verbatim sentences and bullets
- Citation records with document ID, page range, exact quote offsets, and support label
- Confidence thresholds and explicit “not found in your sources” path
- Evidence panel: answer fragments on the left, source quotes on the right
- “Show retrieved but unused passages” for inspection
- Saved searches and answer snapshots (query + source versions + rule versions)

**Exit criteria:** 100% of displayed answer text is verbatim source text; refusals are correct on the gold set.

---

### Phase 4: Study tools *(v0.4)*
**Goal:** turn reading into retention.

- Highlights with page/position anchors
- Flashcards generated from extracted definitions and user highlights
- Spaced repetition (SM-2 first, FSRS later)
- Cloze deletion by hiding key terms in a saved quote
- Tags, collections, saved searches, and weak-topic tracking
- Zotero/Obsidian import and Markdown export
- Citation export: BibTeX, RIS, CSL-JSON, APA/AMA/Bluebook

---

### Phase 5: Android companion *(v0.5)*
**Goal:** a fast, private read-and-search companion for the same vault.

- Tauri 2 Android target from the shared web UI and Rust crates
- Import a vault bundle over USB, shared folder, or local sync
- Read documents and run BM25 searches entirely offline
- On-device indexing for a single newly imported PDF or note, only while charging by default
- Android scoped storage: app-private vault directory; explicit user picker for external files
- Android Keystore for the vault key; SQLCipher on device
- Battery-aware jobs; no background sync or indexing on battery
- Show bundle collection sizes and support per-collection export
- No OCR, no parsers heavier than text/PDF display, no model runtimes on phone

**Desktop/Android split**

| Capability | Desktop | Android companion |
|---|---|---|
| Full-text index build | Yes | Bundle import; small single-file imports |
| Search | BM25 + filters | BM25 + filters |
| Answers | Extractive quotes | Extractive quotes |
| OCR | Yes, explicit | Deferred |
| Study tools | Full | Reading, highlights, review queue |
| Model features | None | None |

**Exit criteria:** a bundle imports on a low-end device; search works in airplane mode; no network permission is required for the offline build.

---

### Phase 6: Medicine Pack *(v0.6, first domain release)*
**Goal:** a great experience for medical students.

- Open source suggestions: PubMed/PMC open access, NIH, WHO, CDC, NICE, guideline repositories
- Medical chunking: abstracts, methods, results, tables, drug monographs
- Abbreviation expansion, MeSH-style synonyms, drug brand/generic mapping
- Evidence labels per source (guideline / systematic review / RCT / case report / textbook / news)
- Date and version warnings on stale guidance
- Study tools: flashcards, spaced repetition, quiz mode with cited quotes
- Guardrails: no dosing/diagnosis phrasing as advice; “verify with current guidelines”

**Exit criteria:** pilot with real med students; gold-set targets met.

---

### Phase 7: Law Pack *(v0.7)*
**Goal:** the same engine, tuned for legal study.

- Sources: CourtListener, govinfo, legislation portals
- Jurisdiction and court-level filters as first-class concepts
- Legal chunking: statutes by section/subsection; cases by facts/holding/reasoning
- Citation parsing and linking; “cites / cited by” graph
- Good-law caution flags, effective-date handling, strong data-limit disclaimers
- IRAC/case-brief organizer built from verbatim opinion passages
- Issue-spotting practice with cited passages

**Exit criteria:** pilot with law students; zero fabricated citations by construction.

---

### Phase 8: Polish, security, distribution *(v1.0)*
**Goal:** something people trust daily.

- Encrypted vault (SQLCipher) with optional passphrase
- Encrypted backup/export (`age`-style), import from backup
- Accessibility pass (screen reader, keyboard-only, high contrast)
- Installers: Windows, macOS (notarized), Linux (AppImage/deb/flatpak)
- Signed auto-updates with pack update channel
- Localization framework
- Docs site, tutorials, sample vaults
- Security review and dependency audit (`cargo audit`, `cargo deny`)

---

### Beyond 1.0 *(ideas, not promises)*
- End-to-end-encrypted sync between a user’s own devices
- Cohort/classroom mode: shared reading lists and annotations
- More packs: nursing, pharmacy, engineering standards, patents, history, theology, finance
- Sandboxed WASM plugin API for community extractors and packs
- Knowledge-graph view across documents
- Optional semantic search only if it can be shipped without a model dependency

---

## 5. Product Decisions

### Answer format
- **Definition:** best definition sentence + one supporting sentence.
- **Comparison:** two columns of matching quotes with source labels.
- **List:** extracted bullets or numbered passages.
- **Cause:** passages containing causal cues, with hedging preserved.
- **Summary:** extractive top sentences from the highest-scoring section, in source order.
- **Unknown:** “Not found in your sources,” with the closest passages offered separately.

### Query understanding
Rules only: normalization, stemming, domain abbreviations, synonym dictionaries, and field filters. No learned ranker and no query rewriting through a model.

### Confidence and refusal
Confidence is derived from retrieval and extraction signals: BM25 score margin, term coverage, source quality, extraction quality, and contradiction count. Low confidence produces a refusal or a qualified quote list, never invented prose.

### Index location
Build indexes on desktop and ship them in bundles. Android imports prebuilt indexes; small single-file imports are indexed in the background only when charging.

### Domain packs
Declarative data only: source lists, section rules, dictionaries, evidence labels, answer templates, disclaimers, and evaluation sets. Packs never execute code.

---

## 6. Quality and Evaluation

- **Gold question sets** per domain: question, expected supporting passages, expected refusal cases.
- **Metrics:** recall@k, MRR, quote-match rate, support precision, correct-refusal rate, latency, index size, battery use on Android.
- **Structural gates:** every displayed quote must resolve to stored text at the stated page and offsets; no answer string may appear in the codebase outside templates.
- **Regression gates:** a release cannot ship if quote fidelity, support precision, or refusal accuracy drops.
- **Human review loop:** thumbs up/down plus “this quote doesn’t support the point” report stored locally.
- **Rule bake-offs:** compare tokenizers, synonym sets, and scoring weights on the same gold set. No model bake-offs.

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Keyword search misses vocabulary gaps | Domain dictionaries, stemming, abbreviation maps, structure-aware filters |
| Extractive answers read awkwardly | Better sentence scoring and templates; never rewrite source text |
| False premise or vague question | Query classifier, explicit refusal path, closest-passage suggestions |
| Outdated medical/legal information | Source dates, staleness warnings, version archive, scope labels |
| Copyright / licensing problems | Bundle nothing copyrighted; per-source licenses; takedown path |
| Heavy indexing drains phone battery | Desktop-built bundles; charging-only on-device imports |
| Scoped storage complicates vault layout | App-private vault directory; explicit import/export flows |
| Index size on low-end devices | Per-collection bundles; show sizes before import |
| Poor extraction from messy PDFs | Extraction quality score, OCR fallback, manual correction |
| Over-reliance by students | Evidence-first UI, “verify at the source” reminders, disclaimers |
| Maintainer burnout | Small crates, realistic phase gates, declarative packs |

---

## 8. Open Questions

- **License:** MIT/Apache-2.0 for adoption, or AGPL/source-available to protect against closed forks? Consider a split.
- **Monetization:** free local core; optional paid sync, institutional licenses, or premium packs?
- **Primary UI stack:** React is already in use; keep it unless mobile testing shows a blocker.
- **Language scope:** English first, or design multilingual stemming/dictionaries from the start?
- **Bundle transport:** USB file copy, shared folder, or local Wi-Fi sync first?
- **On-device import:** which file types are worth indexing on Android beyond notes and single PDFs?
- **Regulatory review:** does a medical study aid need additional positioning in target markets?

---

## 9. Success Metrics

- Time from install to first quoted answer: **< 10 minutes**
- Verbatim quote fidelity on eval sets: **100%**
- Support precision on eval sets: **≥ 95%**
- Search latency on a 10k-document vault: **< 300 ms** p95
- Android bundle import on a low-end device: **< 2 minutes** for a 5k-document vault
- Works fully offline after setup: **yes, always**
- Pilot satisfaction: majority of pilot students use it weekly
- Community: first external contributors and first community pack

---

## 10. Milestone Summary

| Version | Theme | Headline feature |
|---|---|---|
| v0.1 | Viewer | Import, view, themes, recents |
| v0.2 | Search | Offline BM25 index with page-anchored hits |
| v0.3 | Evidence | Extractive answers made only of quotes |
| v0.4 | Study | Flashcards, spaced repetition, saved searches |
| v0.5 | Android | Offline companion with prebuilt vault bundles |
| v0.6 | Medicine Pack | Evidence labels, abbreviations, guarded study tools |
| v0.7 | Law Pack | Jurisdiction filters, legal section parsing |
| v1.0 | Trust | Encryption, installers, accessibility, audits |
