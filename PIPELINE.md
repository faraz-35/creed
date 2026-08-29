# Pipeline plan — annotating the remaining chapters

Status: **3 of 96 chapters done** (`01-02-02`, `01-02-05`, `01-02-08` — all
Book II; 01-02-08 is the hand-made gold standard, the other two are
wave-0 agent output that passed review). Observed cost: ~175k–700k
subagent tokens per chapter. Size waves to quota; the resume ledger
(files on disk + `validate.py` + `index.json`) makes stopping free.

## Where the rules live (canonical order)

1. `~/.zcode/agents/bk-annotator.md` — THE annotator prompt (name, schema,
   hard rules, editorial rules, commentary style). Edit this when rules
   change; the embedded copies below are history, not authority.
2. `~/.zcode/agents/bk-verifier.md` — the audit prompt.
3. This file — wave procedure + status only.

## Rules digest (for humans; the agent file is authoritative)

- Schema v2: every annotation carries `placement` —
  `inline` (dotted gold underline, hover note, ≤~50 words — PREFER this:
  annotations show in place),
  `before` (orientation block above the paragraph),
  `after` (analysis block below — RESTRAINT: 2–4/chapter, load-bearing
  only, never stacked, cut if commentary covers it),
  `page` (SOLID gold underline + ❯, opens overlay; requires `title`;
  2–4/chapter; NO after-paragraph cards — the underline is the single
  entry point).
- Vocab layer: type `vocab`, 8–12/chapter, words a strong non-native
  reader half-knows (older-sense shifts, archaic/period words); when in
  doubt, leave it out.
- Commentary: one voice, `scholarly` — scholarship is the spine, the
  scene is the evidence; STRICTLY chapter-specific (nothing pasteable
  across chapters); no plot summary.
- Honesty: never invent references/dates/amounts; `confidence` flags;
  spoiler: true for later-book dependencies.
- Annotations never mix with book text: no prose injected, marked words
  keep the book's color.

## Wave procedure (from a ZCode session in the repo)

1. Pick the next 8–10 unannotated chapters (book order; the Book II
   dinner arc is the current priority).
2. Spawn one bk-annotator per chapter, in parallel. (If the named agents
   aren't loaded — e.g. this is a pre-restart session — spawn
   general-purpose agents with the prompt body from
   `~/.zcode/agents/bk-annotator.md`.)
3. `npm run validate` — the mechanical gate (anchors, exact-quote
   substrings, schema). Failures get ONE repair prompt, then re-validate;
   still failing → delete the file, re-queue.
4. Review each file against the digest above; fix violations directly
   (wave-0 example: three too-easy vocab entries trimmed).
5. Every ~3 waves: run bk-verifier on the output (or all files, quota
   permitting) for fact spot-checks.
6. `npm run build`; the reader picks everything up automatically.

## Stage D — book-level pass (after all chapters pass)

Run by the main session (needs cross-chapter context): callbacks and
cross-references per book, an ideas index, and a character map — written
as data (`annotations/<book>/crossrefs.json`) and surfaced as a book-end
section. Deferred extras: in-paragraph quote highlighting, Russian-original
side column, Vercel deploy once Book I–II are annotated.
