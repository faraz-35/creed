# Pipeline — annotating the remaining chapters

Status: **13 of 96 chapters done**. The annotation files on disk are the
ledger — stopping is free. This count is rewritten by
`scripts/validate.py`. `01-02-08` is the hand-made gold standard.
~15 min/chapter wall in a parallel wave; annotators run GLM-5.3-Flash,
thought level high.

## Where the rules live

1. `.zcode/workflows/wave.dwf.ts` — the wave workflow: parallel
   annotation, validate + one repair round, ledger, build — all as code.
   Run it by name with `{ book: "karamazov", count: N }` for the next N
   chapters, or `{ book: "karamazov", chapters: ["01-03-01", ...] }` for
   exact ids.
2. `book.json` (this directory) — the book's identity and its pipeline
   section: the gold standard and the editorial rules the annotators
   follow. This is where editorial taste is edited.
3. This file — status only.

`scripts/validate.py` is the only quality gate: anchors exist, quotes are
verbatim, ids unique. It also rewrites `annotations/index.json`, the
count above, `progress.log`, and the `public/books.json` catalog. No
review or fact-check pass — the editorial rules carry the judgment.

## Stage D — book-level pass (after all chapters are done)

Run by the main session (needs cross-chapter context): callbacks and
cross-references per book, an ideas index, and a character map — written
as data (`annotations/<book>/crossrefs.json`) and surfaced as a book-end
section. Deferred extras: in-paragraph quote highlighting, Russian-original
side column, deploy once Book I–II are annotated.
