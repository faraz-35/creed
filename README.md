# karamazov — a reading edition

A single-book reader for *The Brothers Karamazov* (Garnett translation, 1912,
Project Gutenberg #28054) with a hand-built annotation layer: French
passages translated, allusions and real-world references explained, ideas
flagged, and opinionated chapter-end commentary.

Not a general-purpose ebook reader. One book, deeply annotated.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site into dist/
npm run preview    # serve the build
```

Deploy `dist/` anywhere static (Vercel, any file host).

## Pipeline

Two deterministic scripts, then an AI extraction layer:

- `npm run split` — `scripts/split.py`: Gutenberg text →
  `public/data/chapters/*.json` (96 chapters, 5,833 paragraphs, stable
  paragraph ids `p1..pN`) + `public/data/manifest.json`.
- `npm run validate` — `scripts/validate.py`: the gate every annotation
  file must pass — anchors must exist, quoted snippets must appear in the
  chapter text (normalized), schema fields checked. Also regenerates
  `public/data/annotations/index.json`.

Annotation files live in `public/data/annotations/<chapter-file>.json`,
keyed to paragraph ids. The reader works for all 96 chapters; where an
annotation file exists, margin markers, the notes panel, and commentary
appear. See `PIPELINE.md` for the plan to annotate the remaining 95.

## Layout

```
scripts/          split.py, validate.py
texts/raw/        pg28054.txt (Gutenberg source)
public/data/      manifest.json, chapters/, annotations/
public/fonts/     Source Serif 4 (SIL OFL, bundled)
src/              React app — reader, notes panel, commentary, TOC
```

## Keyboard

`j/k` scroll · `n/p` chapter · `t` contents · `a` clean mode ·
`s` spoilers · `m` dark/paper · `?` help
