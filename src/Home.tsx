import type { ChapterMeta, Manifest } from "./types";
import { loadProgress } from "./App";

export default function Home({
  book,
  flat,
  manifest,
  annIndex,
}: {
  book: string;
  flat: ChapterMeta[];
  manifest: Manifest;
  annIndex: Set<string>;
}) {
  const saved = loadProgress(book);
  const resume = saved ? flat.find((c) => c.file === saved.file) : null;
  const begin = flat[0];
  const b = manifest.book;

  return (
    <div className="home">
      <div className="home-inner">
        {b.edition_label && <div className="overline">{b.edition_label}</div>}
        <h1 className="home-title">{b.title}</h1>
        <div className="home-author">{b.author}</div>

        {b.epigraph && (
          <blockquote className="epigraph">
            “{b.epigraph.text}”
            <footer>— {b.epigraph.ref}</footer>
          </blockquote>
        )}

        <div className="home-actions">
          {resume && (
            <a
              className="btn primary"
              href={`#/b/${book}/c/${resume.file}`}
            >
              Continue — ch. {resume.roman}. {resume.title}
            </a>
          )}
          {begin && (
            <a
              className={"btn" + (resume ? "" : " primary")}
              href={`#/b/${book}/c/${begin.file}`}
            >
              Begin reading
            </a>
          )}
        </div>

        <div className="home-meta">
          {flat.length} chapters · {b.translator} · text: {b.source}
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
