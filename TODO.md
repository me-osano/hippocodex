# Hippocodex TODO

Working checklist that maps to [ROADMAP.md](./ROADMAP.md).
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 💡 optional/bright idea · ⚠️ needs a decision

Core constraint for every phase: **BM25 retrieval, extractive quote-only answers, no model runtime, no embeddings, no vector index, no online AI.** Android consumes desktop-built bundles and needs no network permission.

---

## 🔥 Next 10 actions (start here)

- [ ] 1. Check name availability: crates.io (`hippocodex`), GitHub org/repo, `.com`/`.app`/`.io`, trademark classes 9/42
- [ ] 2. ⚠️ Pick a license (MIT/Apache-2.0 vs AGPL vs split)
- [ ] 3. Create workspace with crates: `core`, `store`, `ingest`, `index`, `answer`, `bundle`, `sync`, `packs`, `cli`
- [ ] 4. Set up CI (build + test + clippy + fmt + deny + audit on Linux/macOS/Windows; Android target check)
- [ ] 5. Write SQLite schema v1 (documents, chunks, sources, tags, collections, quote refs, jobs) with version columns and tombstones
- [ ] 6. Implement `hippo import <file.pdf>` with text extraction and page mapping
- [ ] 7. Implement `hippo search <query>` with Tantivy BM25 and page-anchored snippets
- [ ] 8. Create a small public-domain test corpus (10–20 docs) in `fixtures/`
- [ ] 9. Draft 30 medicine gold questions with expected verbatim quotes and refusal cases
- [ ] 10. Write ARCHITECTURE.md, the index-rebuild contract, and a first `SECURITY.md` threat model

---

## Phase 0: Foundations

### Repo and tooling
- [ ] Root Cargo workspace with shared `[workspace.dependencies]` (the `crates/` directory is currently empty)
- [ ] `rust-toolchain.toml`, `rustfmt.toml`, clippy config (deny warnings in CI)
- [ ] `cargo deny` (licenses, advisories) and `cargo audit` in CI
- [ ] Pre-commit hooks (fmt, clippy)
- [ ] Release profile tuning (LTO, codegen-units) once builds stabilize
- [ ] Android cross-compile check job in CI

### Conventions
- [ ] Error handling: `thiserror` in libraries, `anyhow` in binaries
- [ ] `tracing` + structured logs; log levels documented
- [ ] Config format and platform-appropriate location (`directories` crate)
- [ ] Naming and module layout guide
- [ ] Version fields for parser, chunker, BM25 schema, extraction rules, and pack

### Docs and community
- [ ] README with tagline “Your sources, remembered and quoted.”, screenshots placeholder, quick start
- [ ] CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, ARCHITECTURE.md
- [ ] Threat model in `SECURITY.md` (file parsers, Tauri commands, webview, packs, updater)
- [ ] Issue/PR templates
- [ ] Disclaimer text draft (“study aid, not clinical or legal advice”)
- [ ] 💡 Short “Why Hippocodex?” page: quote-only answers, cite or stay silent, no models
- [ ] ⚠️ Decide Tauri app identifier before shipping (currently `app.hippocodex.viewer`)

---

## Phase 1: Viewer and vault MVP (v0.1)

### Storage (`store`)
- [ ] Choose `rusqlite` vs `sqlx` (⚠️ decision)
- [ ] Migrations framework
- [ ] Tables: `documents`, `chunks`, `sources`, `tags`, `collections`, `quote_refs`, `jobs`
- [ ] File storage layout on disk (content-addressed by SHA-256)
- [ ] Content-hash dedup on import
- [ ] Soft delete + trash
- [ ] Unit tests with in-memory DB
- [ ] Portable workspace export spec and round-trip test (reused by Android bundles)

### Ingestion (`ingest`)
- [ ] `Source` trait and `RawDoc` type
- [ ] PDF text extraction with per-page output (`pdfium-render` / `lopdf`)
- [ ] Plain text and Markdown import pipeline
- [ ] HTML import with main-content extraction
- [ ] DOCX/EPUB extraction with guarded ZIP inflation
- [ ] Metadata extraction (title, authors, date) with manual override
- [ ] Folder import + watch for changes
- [ ] Import progress + error reporting per file
- [ ] Extraction quality score stored and surfaced as a citation gate

### CLI
- [ ] `hippo import`, `hippo list`, `hippo open`, `hippo rm`
- [ ] `--json` output for scripting

### UI (Tauri + React) — viewer milestone complete
- [x] Tauri 2 shell + React/TypeScript/Vite app scaffolded
- [x] Lazy-loaded viewers: PDF (pdf.js), Markdown, text/code, images, CSV/TSV, DOCX, PowerPoint (drawn PPTX slides with shapes, pictures, tables and charts; text/bullets/notes retrieval projection; guarded ZIP inflation; legacy PPT text recovery)
- [x] Local PPTX slide show with notes, hidden-slide skipping, presenter view and zoom/fit; text view and citation-friendly slide text remain available
- [x] Recents, welcome/dropzone, drag-and-drop file detection
- [x] New note button with `.md`/`.txt` choice; confined Library write on desktop, session-only notes in browser preview
- [x] Edit Library Markdown/text notes in a textarea with dirty state, Cancel, and manual Ctrl/⌘+S save; browser edits stay session-only
- [x] Sidebar search bar for whole-Library filename/path search on desktop (bounded recursive walk)
- [x] Toast notifications, loading overlays, keyboard shortcut modal, mobile drawer
- [x] Four themes: default, AMOLED, Studio, Canvas & Sand
- [x] Default theme Auto/Light/Dark mode and persisted optional frosted glass (`hippocodex.glass`)
- [x] Pre-paint theme script (`public/theme-init.js`) and native window background color
- [x] External links intercepted and opened in the real browser
- [ ] Library view (list/grid, tags, collections)
- [ ] Search page with snippets and “open at page” (lands in Phase 2)
- [ ] Extraction quality warnings in the UI
- [ ] Accessibility basics: keyboard-only, screen-reader labels, contrast checks

### Exit checks
- [ ] Import 1,000 files without crashes
- [ ] Recents persist and the app makes no network calls
- [ ] PDF display opens at the requested page (hit-driven jump lands in Phase 2)

---

## Phase 2: Offline index and search (v0.2)

### Chunking
- [ ] `Chunker` trait
- [ ] Heading/section-aware chunker (300–500 tokens, sentence boundaries, small overlap)
- [ ] Table handling (keep tables intact, or serialize with context)
- [ ] Caption + figure association
- [ ] Chunk metadata: page, heading path, source date, collection, tags, evidence level
- [ ] Property tests: chunks cover the document, no empties, monotonic page ranges

### Index (`index`)
- [ ] Tantivy schema, writer lifecycle, and incremental segments
- [ ] BM25 over fields: text, title, heading path, page range, source date, collection, tags, evidence level
- [ ] Query parsing: phrases, fuzzy terms, field filters
- [ ] `rust-stemmers` plus domain dictionaries, abbreviations, and synonym maps
- [ ] Snippet generation with hit highlighting and “open at page”
- [ ] Incremental indexing with a resumable job queue
- [ ] Derived-index rebuild contract: `hippo reindex --from-db`
- [ ] Retrieval eval harness: recall@k, MRR, latency p95, index size
- [ ] Keep the core free of embedding indexes, vector stores, and learned rerankers

### OCR (desktop only)
- [ ] Detect scanned pages automatically
- [ ] Tesseract OCR via `leptess` with language selection
- [ ] Store OCR confidence; flag low-confidence pages
- [ ] 💡 Side-by-side view: scan vs recognized text, with fix-it editing

### Evaluation
- [ ] `hippo eval` command
- [ ] Medicine gold set written before/alongside the first index
- [ ] Rule bake-offs (tokenizers, synonym sets, scoring weights) on the same gold set
- [ ] Store eval results over time (CSV/JSON in repo)

---

## Phase 3: Extractive answers and evidence UI (v0.3)

### Answer assembly (`answer`)
- [ ] Rule-based query classifier: definition, comparison, list, cause, summary, unknown
- [ ] Passage scoring: query-term overlap, sentence position, heading context, cue phrases, source quality, extraction quality, contradiction count
- [ ] Answer templates that arrange verbatim sentences and bullets — never generated prose
- [ ] Quote records with document ID, page range, exact character offsets, support label, rule version
- [ ] Confidence thresholds and explicit “Not found in your sources” path
- [ ] Quote-offset verifier: every displayed answer string resolves to stored source text
- [ ] “Show retrieved but unused passages” from the retrieval trace
- [ ] Saved searches and answer snapshots (query + source versions + rule versions)

### UI
- [ ] Evidence panel: answer fragments on the left, source quotes on the right
- [ ] Support labels, not just citation chips (supported / partial / contradicted / not found)
- [ ] Structured Views: user-defined tables of verbatim extracts with per-cell evidence (rules, not prompts)
- [ ] Source scoping controls: library / collection / folder / selected documents; web always off
- [ ] “Check these notes” workflow: rule-based support lookup for user-authored notes
- [ ] Contradiction view: side-by-side quotes with dates, source types, jurisdictions
- [ ] Staleness and source-date warnings on every quote
- [ ] Provenance header: scope, rule versions, retrieval date, source versions, verification summary
- [ ] Per-answer “report bad quote” button (stored locally)
- [ ] Persistent study-aid disclaimer banner / first-run scope screen

### Quality gates
- [ ] 100% of displayed answer text is verbatim source text
- [ ] Gold set includes unanswerable, false-premise, leading, conflicting-source, abstract-only, and stale-source cases
- [ ] Adversarial instruction-like text in documents stays data; rules never execute it
- [ ] CI gates: quote fidelity, support precision, correct-refusal rate, false-refusal rate
- [ ] Publish an honest eval report with limitations

---

## Phase 4: Study tools (v0.4)

- [ ] Highlights with page/position anchors
- [ ] Flashcards generated from extracted definitions and user highlights (quote-only fronts/backs)
- [ ] Spaced repetition (SM-2 first, FSRS later)
- [ ] Cloze deletion by hiding key terms in a saved quote
- [ ] Tags, collections, saved searches, and weak-topic tracking
- [ ] Zotero/Obsidian import and Markdown export
- [ ] Citation export: BibTeX, RIS, CSL-JSON, APA/AMA/Bluebook
- [ ] Quiz mode with cited quotes
- [ ] 💡 Anki export (and import)

---

## Phase 5: Android companion (v0.5)

### Bundle (`bundle`)
- [ ] Bundle format: documents + prebuilt Tantivy index + metadata + manifest + checksums
- [ ] `hippo bundle create --collection <name>` on desktop
- [ ] Per-collection bundles with sizes shown before import
- [ ] Bundle import validation, checksum verification, and clear errors
- [ ] No copyrighted content bundled; per-source licenses recorded

### Android app
- [ ] Tauri 2 Android target from the shared web UI and Rust crates
- [ ] Import a bundle over USB, shared folder, or local file picker — no network required
- [ ] Read documents and run BM25 searches entirely offline, including airplane mode
- [ ] Extractive answers use the same rule versions as desktop
- [ ] Android scoped storage: app-private vault directory; explicit user picker for external files
- [ ] Android Keystore for the vault key; SQLCipher on device
- [ ] Battery-aware jobs; no background sync or indexing on battery
- [ ] Small single-file imports indexed only while charging; notes/text/PDF display only
- [ ] No OCR, no parsers heavier than text/PDF display, no model runtimes on phone
- [ ] Offline build requests zero network permissions; release fails if a permission appears

### Exit checks
- [ ] Bundle imports on a low-end device in < 2 minutes for a 5k-document vault
- [ ] Search and quote-only answers work in airplane mode
- [ ] No network permission in the offline build

---

## Phase 6: Medicine Pack (v0.6)

### Sources and licensing
- [ ] Research licenses: PubMed/PMC open access subset, NIH, WHO, CDC, NICE, guideline repositories
- [ ] Build suggested-source list (OPML + metadata) with license per source
- [ ] Legal review of what can be bundled vs only suggested

### Domain features
- [ ] Medical chunking rules (abstract/methods/results/tables/monographs)
- [ ] Abbreviation expansion and synonym search
- [ ] Drug brand ↔ generic mapping
- [ ] Evidence-level labels (guideline / SR / RCT / case report / textbook / news)
- [ ] Staleness threshold + warnings
- [ ] Guardrails: no personalized dosing/diagnosis advice phrasing; quotes stay verbatim
- [ ] 💡 “Compare guidelines” view with side-by-side quoted passages

### Study tools
- [ ] Highlight → flashcard with source quote
- [ ] FSRS scheduler (or SM-2 first)
- [ ] Quiz mode with cited explanations
- [ ] Active-recall mode: app quizzes from your documents
- [ ] Weak-spot map
- [ ] 💡 Anki export (and import)

### Validation
- [ ] Recruit pilot med students and a faculty reviewer
- [ ] 100+ question gold set (reviewed)
- [ ] Pilot feedback survey + interviews

---

## Phase 7: Law Pack (v0.7)

### Sources and licensing
- [ ] Research terms: CourtListener, govinfo, state/national legislation portals
- [ ] Suggested-source list with jurisdiction metadata

### Domain features
- [ ] Jurisdiction + court-level as first-class filters
- [ ] Statute chunker (section/subsection) and case chunker (headnote/facts/holding/reasoning)
- [ ] Citation parser (Bluebook and others) + link resolution; evaluate `eyecite`
- [ ] “Cites / cited by” graph view
- [ ] As-of date handling for statutes
- [ ] Good-law caution flags + prominent limits-of-data warning
- [ ] Guardrails: no “you should file…” style advice; verbatim passages only
- [ ] 💡 Case-brief organizer (IRAC) built from verbatim opinion passages
- [ ] 💡 Issue-spotting practice mode

### Validation
- [ ] Recruit pilot law students and a faculty reviewer
- [ ] 100+ question gold set (reviewed)
- [ ] Verify zero fabricated citations in test runs

---

## Phase 8: Polish, security, distribution (v1.0)

### Security
- [ ] SQLCipher-encrypted vault + passphrase flow
- [ ] Encrypted backup/export and restore
- [ ] Threat model updated per phase; dependency audit; fuzz extractors (PDF/HTML parsers)
- [ ] Sandbox untrusted parsing where practical
- [ ] ⚠️ Confirm Tauri app identifier (`app.hippocodex.viewer` is provisional)

### Accessibility and i18n
- [ ] Screen reader + keyboard-only pass
- [ ] High-contrast theme, adjustable fonts
- [ ] i18n framework; UI string extraction
- [ ] ⚠️ Decide language scope at v1 (English first unless a pilot market needs otherwise)

### Distribution
- [ ] Windows installer, macOS notarized app, Linux AppImage/deb/flatpak
- [ ] Signed auto-updates with pack update channel
- [ ] Crash reporting (strictly opt-in, local-first, content-free)

### Docs and launch
- [ ] Docs site, tutorials, sample vault
- [ ] Short demo video
- [ ] Launch checklist and feedback channels

---

## 💡 Bright Ideas Backlog (unscheduled)

- [ ] Figure/table extraction with caption search
- [ ] User-provided lecture transcript import (plain text), indexed like any other note
- [ ] Staleness radar across the whole library
- [ ] Pack marketplace (source lists + rules only, no executable code)
- [ ] Per-course “starter vault” recipes
- [ ] Classroom mode: shared reading lists and annotations
- [ ] WASM plugin API for community extractors/packs (post-1.0, sandboxed)
- [ ] Knowledge-graph view of citations across documents
- [ ] Optional E2E-encrypted device-to-device sync (post-1.0)
- [ ] Publish open eval datasets per domain
- [ ] Benchmarks in CI (indexing speed, search latency, memory)
- [ ] Optional semantic search only if it can be shipped without a model dependency

---

## ⚠️ Decisions Log (fill in as you decide)

| # | Decision | Options | Chosen | Date |
|---|---|---|---|---|
| 1 | License | MIT/Apache-2.0 · AGPL · split | | |
| 2 | DB crate | rusqlite · sqlx | | |
| 3 | Search engine | Tantivy BM25 (SQLite FTS5 only if index lifecycle cost is unacceptable) | | |
| 4 | UI framework | React (already in use) | | |
| 5 | Language scope at v1 | English only · multilingual | | |
| 6 | Monetization | free core + ? | | |
| 7 | Android bundle transport | USB file copy · shared folder · local sync | | |
| 8 | Tauri app identifier | `app.hippocodex.viewer` · new id | | |

---

## Definition of Done (for any task)

- [ ] Tests added or updated
- [ ] `cargo fmt`, `cargo clippy` clean; `npm run build` clean for UI changes
- [ ] Docs/comments updated where behavior changed
- [ ] No new network calls without a documented, user-visible reason; core v1 makes none
- [ ] No inference runtime, embedding index, vector store, or online service added to the core plan
- [ ] Quote fidelity, support precision, and refusal metrics not regressed
