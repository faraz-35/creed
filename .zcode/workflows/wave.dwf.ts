/* zcode-workflow
description: "Annotate a wave of chapters of any book in public/books/: resolve
  targets, annotate in parallel, validate and repair once, update the ledger,
  build the site."
whenToUse: "To annotate the next batch of chapters of a book (default: next 3
  pending in book order) or specific chapter ids for a reading edition."
args:
  book:
    type: string
    description: Book id — the directory name under public/books/ (e.g. "karamazov").
  chapters:
    type: json
    description: Explicit chapter ids to annotate, e.g. ["01-02-04","01-02-06"].
      Overrides count.
  count:
    type: number
    description: How many pending chapters to take, in book order, when no explicit
      ids are given.
    default: 3
  model:
    type: string
    description: Model id for the annotator/repair agents ("provider/model$level").
      Defaults to GLM-5.3-Flash at high reasoning.
*/
/** One wave of the annotation pipeline for one book: resolve targets →
 *  parallel annotators → validate + one repair round → ledger + build.
 *  Everything book-specific (identity, gold standard, editorial rules)
 *  comes from the book's public/books/<id>/book.json. scripts/validate.py
 *  is the only quality gate and owns the ledgers (annotations/index.json,
 *  the pipeline.md count, progress.log, the books.json catalog). */

interface ChapterTarget {
  /** Chapter id like "01-02-04"; every file is <id>.json. */
  id: string;
  /** "Book II. An Unfortunate Gathering, Chapter IV — Title", from next_targets.py. */
  title: string;
}

interface ChapterCounts {
  /** Notes placed inline (dotted-underline hover). */
  inline: number;
  /** Orientation notes placed before a paragraph. */
  before: number;
  /** Analysis blocks placed after a paragraph. */
  after: number;
  /** Deep click-through pages. */
  page: number;
  /** Vocabulary notes (inline, type vocab). */
  vocab: number;
}

interface BookConfig {
  title: string;
  author: string;
  translator: string;
  pipeline: { gold_standard: string; editorial: string };
}

interface Finding {
  /** Workspace-relative path, with a line when it applies: "src/a.ts:42". */
  where: string;
  /** One sentence: what is wrong, or what was found. */
  what: string;
  /** What showed it: the lines read, or the command and the output that proved it. */
  evidence: string;
  /** "verified" when an independent subagent or a deterministic check confirmed it; "unconfirmed" when confirmation failed or was not attempted. */
  status: "verified" | "unconfirmed";
  /** How much it matters. Reserve "high" for data loss, a crash, or a wrong result. */
  severity: "low" | "medium" | "high";
}
interface WorkflowReport {
  /** Two or three sentences answering what the user asked for. */
  conclusion: string;
  findings: Finding[];
  /** What the run checked and how: the commands it ran, the files it covered. */
  verified: string[];
  /** What the run did not look at or could not check, and why. */
  notCovered: string[];
}

const DEFAULT_MODEL = "account:zai-individual-coding-plan/GLM-5.3-Flash$high";

const bookId = typeof args.book === "string" ? args.book.trim() : "";
const MODEL = model(
  typeof args.model === "string" && args.model ? args.model : DEFAULT_MODEL,
);

/** FAIL lines from validate output, keyed by annotations file name. */
function parseFailures(stdout: string): Map<string, string[]> {
  const failures = new Map<string, string[]>();
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("FAIL ")) continue;
    const file = line.slice(5).split(/[:#]/)[0];
    const lines = failures.get(file) ?? [];
    lines.push(line);
    failures.set(file, lines);
  }
  return failures;
}

function describeCounts(counts: ChapterCounts | undefined): string {
  return counts === undefined
    ? ""
    : `${counts.inline} inline · ${counts.before} before · ${counts.after} after · ${counts.page} page · ${counts.vocab} vocab`;
}

function titleOf(targets: ChapterTarget[], id: string): string {
  return targets.find((t) => t.id === id)?.title ?? "";
}

/** One timestamped line in the book's progress.log, the pipeline's on-disk history. */
async function progress(message: string): Promise<void> {
  const code =
    "import datetime;open('public/books/" + bookId + "/progress.log','a').write(" +
    "datetime.datetime.now().strftime('%H:%M:%S')+' '+" + JSON.stringify(message + "\n") + ")";
  await world.run("python3", ["-c", code]);
}

artifact.board("wave", {
  title: "Wave progress",
  key: "id",
  status: "status",
  columns: ["annotating", "repairing", "done", "excluded"],
  cardTitle: "id",
  detail: [
    { field: "title", label: "Chapter" },
    { field: "note", label: "Notes" },
  ],
});

phase("Load the book's pipeline config");
if (!bookId) {
  return {
    conclusion: 'No book id given — run the workflow with { book: "karamazov" } (a directory under public/books/).',
    findings: [],
    verified: [],
    notCovered: ["everything — no book was specified"],
  };
}
const cfgRun = await world.run("cat", [`public/books/${bookId}/book.json`]);
if (cfgRun.exitCode !== 0) {
  return {
    conclusion: `No book.json for "${bookId}" — world.run cat exited ${cfgRun.exitCode}. A book needs public/books/${bookId}/book.json with a pipeline section (gold_standard, editorial) before waves can run.`,
    findings: [],
    verified: [],
    notCovered: ["everything — no book config"],
  };
}
const cfg = JSON.parse(cfgRun.stdout) as BookConfig;
if (!cfg.pipeline?.gold_standard || !cfg.pipeline?.editorial) {
  return {
    conclusion: `book.json for "${bookId}" has no pipeline.gold_standard / pipeline.editorial — the wave refuses to run without a gold standard and explicit editorial rules.`,
    findings: [],
    verified: [],
    notCovered: ["everything — incomplete book config"],
  };
}
const B = `public/books/${bookId}`;

const ANNOTATOR = `You annotate ONE chapter of ${cfg.title} (${cfg.author}, ${cfg.translator}) for a reading edition.

Everything you need is in this prompt. Before writing anything, read these
two files completely:

1. ${B}/${cfg.pipeline.gold_standard} — the gold standard. Mirror its
   exact JSON structure (schema v2: \`placement\` field, \`vocab\` type,
   \`commentary.scholarly\` as the single voice).
2. Your assigned chapter file: ${B}/chapters/<FILE>

(Do NOT read pipeline.md or any other file — the rules are all below and
pipeline.md is a status page, not rules.)

Write exactly one file: ${B}/annotations/<FILE> — and nothing else.
Never touch index.json or any other file; the wave owns the ledger.

## Hard rules (scripts/validate.py enforces these mechanically)

- Every \`quote\` must be an exact substring of that paragraph's text.
  Copy verbatim — curly quotes (’ “ ”), em-dashes (—), accents. Quotes are
  plain text; they may span an italics boundary in the source.
- \`anchor\` must be an existing paragraph id (p1..pN).
- \`placement\` ∈ {inline, before, after, page};
  \`type\` ∈ {foreign, allusion, context, translation, term, idea, vocab};
  \`confidence\` ∈ {certain, likely, uncertain}.
- \`page\` placement requires a short \`title\`. Its \`note\` may use blank-line
  (\\n\\n) paragraph breaks.
- Inline notes ≤ ~50 words.
- Unique ids n01, n02, …
- NEVER invent references, dates, amounts, or quotations. Facts you are
  sure of: "certain". Anything you would hedge: "likely". Half-remembered:
  "uncertain", and phrase the note so it admits the doubt. No fabricated
  bibliography.
- \`spoiler: true\` on any note that depends on events AFTER this chapter.

## Editorial rules (the reader's explicit instructions)

${cfg.pipeline.editorial}

## Process — aim for exactly ONE Write

Read the whole chapter first. Compose the full annotations file, then
re-check every quote character-by-character against the chapter text you
read — fix mismatches BEFORE writing. Only write the file when every
quote is verified. A second Write (full-file correction) is a failure
mode that doubles your cost: use it only if you discover a real error
after the first Write.

If you are blocked — the chapter file is missing, the text is unreadable,
or two rules conflict — escalate and say so plainly rather than improvising.`;

const REPAIR = `You repair ONE annotations file for the ${cfg.title} reading
edition so it passes scripts/validate.py. The failures are almost always
quote punctuation: every quote must be an exact substring of the chapter
text — copy it verbatim from the chapter file (curly quotes ’ “ ”,
em-dashes —, period inside the closing quote). Read the chapter file and
the annotations file, fix exactly what the validator flagged, and write
the annotations file back. Change nothing else; never weaken or delete an
annotation to make a check pass. If a failure cannot be fixed this way,
escalate and say so plainly.`;

phase("Resolve which chapters to annotate");
const explicitIds = Array.isArray(args.chapters) ? args.chapters.map(String) : [];
const count = typeof args.count === "number" && args.count > 0 ? args.count : 3;
const resolve = await world.run(
  "python3",
  explicitIds.length > 0
    ? ["scripts/next_targets.py", bookId, ...explicitIds]
    : ["scripts/next_targets.py", bookId, String(count)],
);
if (resolve.exitCode !== 0) {
  return {
    conclusion: `Could not resolve targets — scripts/next_targets.py exited ${resolve.exitCode}: ${resolve.stderr.trim().slice(0, 300)}`,
    findings: [],
    verified: [],
    notCovered: ["everything — no chapter was annotated"],
  };
}
const targets: ChapterTarget[] = resolve.stdout.trim().split("\n").filter(Boolean).map((line) => {
  const cut = line.indexOf(" | ");
  return cut === -1 ? { id: line, title: "" } : { id: line.slice(0, cut), title: line.slice(cut + 3) };
});
if (targets.length === 0) {
  return {
    conclusion: `Nothing to do — every chapter of "${bookId}" already has annotations.`,
    findings: [],
    verified: [],
    notCovered: [],
  };
}
log(`Annotating ${targets.length} chapters: ${targets.map((t) => t.id).join(", ")}`);
await progress(`wave start: ${explicitIds.length > 0 ? explicitIds.join(" ") : `next ${count}`} — ${targets.length} chapters`);

phase("Annotate each chapter in parallel");
const sessionFailed = new Set<string>();
const countsById = new Map<string, ChapterCounts>();
await Promise.all(
  targets.map(async (t) => {
    report({ id: t.id, status: "annotating", title: t.title, note: "" }, "wave");
    try {
      const counts = await agent(`Annotator ${t.id}`, { model: MODEL, system: ANNOTATOR })
        .ask<ChapterCounts>(
          `Annotate chapter ${t.id}.json for the ${cfg.title} reading edition.\n\n` +
          `- Chapter file: ${B}/chapters/${t.id}.json (${t.title})\n` +
          `- Write the annotations file to: ${B}/annotations/${t.id}.json\n\n` +
          `Follow your spec exactly: schema v2 placement model, every quote verified ` +
          `character-by-character before the single Write. Return the note counts.`,
        );
      countsById.set(t.id, counts);
    } catch {
      sessionFailed.add(t.id);
    }
    report(
      sessionFailed.has(t.id)
        ? { id: t.id, status: "excluded", title: t.title, note: "annotator session failed; the validator decides the file's fate" }
        : { id: t.id, status: "done", title: t.title, note: describeCounts(countsById.get(t.id)) },
      "wave",
    );
  }),
);

phase("Validate every file and repair once");
const findings: Finding[] = [];
let doomed: string[] = [];
const first = await world.run("npm", ["run", "validate"]);
const failing = parseFailures(first.stdout);
if (first.exitCode === 0) {
  log("Validate clean on the first pass");
} else {
  log(`Validate flagged ${failing.size} file(s): ${[...failing.keys()].join(", ")}`);
  await Promise.all(
    [...failing.entries()].map(async ([file, lines]) => {
      const id = file.replace(/\.json$/, "");
      report({ id, status: "repairing", title: titleOf(targets, id), note: `${lines.length} validator failure(s)` }, "wave");
      await agent(`Repair ${id}`, { model: MODEL, system: REPAIR }).ask(
        `scripts/validate.py failed on ${B}/annotations/${file}:\n\n` +
        `${lines.join("\n")}\n\n` +
        `- Annotations file: ${B}/annotations/${file}\n` +
        `- Chapter file: ${B}/chapters/${file}\n\n` +
        `Fix exactly what is flagged and write the annotations file back.`,
      );
    }),
  );
  const second = await world.run("npm", ["run", "validate"]);
  const still = parseFailures(second.stdout);
  for (const [file, lines] of failing) {
    if (still.has(file)) continue;
    findings.push({
      where: `${B}/annotations/${file}`,
      what: "Validator failures repaired (quote punctuation, usually)",
      evidence: lines.join(" · "),
      status: "verified",
      severity: "low",
    });
  }
  doomed = targets.filter((t) => still.has(`${t.id}.json`)).map((t) => t.id);
  if (doomed.length > 0) {
    await world.run("rm", doomed.map((id) => `${B}/annotations/${id}.json`));
    for (const id of doomed) {
      report({ id, status: "excluded", title: titleOf(targets, id), note: "still failing after repair — file deleted, becomes a target again next wave" }, "wave");
      findings.push({
        where: `${B}/annotations/${id}.json`,
        what: "Still failing after one repair round — file deleted, chapter excluded this wave",
        evidence: (still.get(`${id}.json`) ?? []).join(" · "),
        status: "verified",
        severity: "medium",
      });
    }
  }
  const foreign = [...still.keys()].filter((f) => !targets.some((t) => `${t.id}.json` === f));
  if (foreign.length > 0) {
    findings.push({
      where: `${B}/annotations`,
      what: `Chapters outside this wave still failing after repair: ${foreign.join(", ")}`,
      evidence: "validate exit 1 on the second pass",
      status: "verified",
      severity: "high",
    });
  }
}

phase("Update the ledger and build the site");
// validate.py rewrites index.json, the pipeline.md count, progress.log and
// the books.json catalog on every run — a clean pass here is the ledger
// update and the final gate.
const gate = await world.run("npm", ["run", "validate"]);
if (gate.exitCode !== 0) {
  const gateFailing = [...parseFailures(gate.stdout).keys()];
  await progress(`wave aborted: still failing after repair — ${gateFailing.join(" ")}`);
  return {
    conclusion: `Validate still failing after the repair round (${gateFailing.join(", ")}) — build skipped. The files are on disk for a manual look; nothing is committed.`,
    findings,
    verified: [],
    notCovered: ["the site build — skipped because validation did not pass"],
  };
}
for (const id of sessionFailed) {
  if (doomed.includes(id)) continue;
  findings.push({
    where: `${B}/annotations/${id}.json`,
    what: "The annotator session failed, but its file is on disk and passed the gate",
    evidence: "ask rejected during annotation; validate exit 0 afterwards",
    status: "verified",
    severity: "low",
  });
}
const build = await world.run("npm", ["run", "build"], { timeoutMs: 600_000 });
if (build.exitCode !== 0) {
  findings.push({
    where: "npm run build",
    what: "The site build failed after validation passed",
    evidence: build.stderr.trim().slice(0, 500),
    status: "verified",
    severity: "high",
  });
}
const shipped = targets.filter((t) => !doomed.includes(t.id)).map((t) => t.id);
const filesChecked = gate.stdout.split("\n").filter((l) => l.startsWith("ok ")).length;
const verified = [
  `npm run validate — 0 failures across ${filesChecked} annotation files (anchors exist, quotes verbatim, ids unique)`,
];
if (build.exitCode === 0) verified.push("npm run build — passed");
await progress(`wave complete: ${shipped.join(" ")} annotated, validate clean${build.exitCode === 0 ? ", build clean" : ", build FAILED"}`);
return {
  conclusion: build.exitCode === 0
    ? `${shipped.length} of ${targets.length} chapters of "${bookId}" annotated and shipped: ${shipped.join(", ")}. Validate passed with 0 failures, ledger updated, build passed.`
    : `${shipped.length} of ${targets.length} chapters of "${bookId}" annotated and shipped: ${shipped.join(", ")}. Validate passed and the ledger is updated, but the site build failed — see findings.`,
  findings,
  verified,
  notCovered: doomed.length > 0
    ? [`${doomed.join(", ")} excluded — no annotations shipped; they become targets again next wave`]
    : [],
};
