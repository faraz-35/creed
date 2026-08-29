import type { ChapterMeta, Manifest } from "./types";
import { loadProgress } from "./App";

const EPIGRAPH =
  "Verily, verily, I say unto you, except a corn of wheat fall into the ground and die, it abideth alone: but if it die, it bringeth forth much fruit.";
const EPIGRAPH_REF = "— John xii. 24, the novel’s epigraph";

export default function Home({
  flat,
  manifest,
  annIndex,
}: {
  flat: ChapterMeta[];
  manifest: Manifest;
  annIndex: Set<string>;
}) {
  const saved = loadProgress();
  const resume = saved ? flat.find((c) => c.file === saved.file) : null;
  const begin = flat[0];

  return (
    <div className="home">
      <div className="home-inner">
        <div className="overline">Garnett translation · 1912 · a reading edition</div>
        <h1 className="home-title">
          The Brothers
          <br />
          Karamazov
        </h1>
        <div className="home-author">Fyodor Dostoevsky</div>

        <blockquote className="epigraph">
          “{EPIGRAPH}”
          <footer>{EPIGRAPH_REF}</footer>
        </blockquote>

        <div className="home-actions">
          {resume && (
            <a className="btn primary" href={`#/c/${resume.file}`}>
              Continue — ch. {resume.roman}. {resume.title}
            </a>
          )}
          {begin && (
            <a className={"btn" + (resume ? "" : " primary")} href={`#/c/${begin.file}`}>
              Begin reading
            </a>
          )}
        </div>

        <div className="home-meta">
          {flat.length} chapters · {manifest.book.translator} · text:{" "}
          {manifest.book.source}
          <br />
          {annIndex.size} chapter{annIndex.size === 1 ? "" : "s"} annotated —
          notes, translations &amp; commentary grow chapter by chapter
        </div>

        <div className="home-keys">
          <span className="kbd">j</span>/<span className="kbd">k</span> scroll ·{" "}
          <span className="kbd">n</span>/<span className="kbd">p</span> chapter ·{" "}
          <span className="kbd">t</span> contents ·{" "}
          <span className="kbd">a</span> clean mode ·{" "}
          <span className="kbd">?</span> all shortcuts
        </div>
      </div>
    </div>
  );
}
