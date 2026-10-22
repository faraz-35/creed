# Pipeline plan — annotating the remaining chapters

Status: **13 of 96 chapters done**. The annotation files on disk are the
ledger — stopping is free. This count is rewritten by
`scripts/validate.py`. `01-02-08` is the hand-made gold standard.
~15 min/chapter wall in a parallel wave; annotators run GLM-5.3-Flash,
thought level high.

## Where the rules live

1. `.zcode/workflows/bk-wave.dwf.ts` — the wave workflow: the annotator
   spec (its persona), parallel annotation, validate + one repair round,
   ledger, build — all as code. Run it by name with `{ count: N }` for
   the next N chapters, or `{ chapters: ["01-02-04", ...] }` for exact
   ids.
2. This file — status only.

`scripts/validate.py` is the only quality gate: anchors exist, quotes are
verbatim, ids unique. It also rewrites `annotations/index.json`, the
count above, and appends to `PROGRESS.log`. No review or fact-check
pass — the annotator persona carries all editorial judgment.

## Stage D — book-level pass (after all chapters are done)

Run by the main session (needs cross-chapter context): callbacks and
cross-references per book, an ideas index, and a character map — written
as data (`annotations/<book>/crossrefs.json`) and surfaced as a book-end
section. Deferred extras: in-paragraph quote highlighting, Russian-original
side column, Vercel deploy once Book I–II are annotated.
