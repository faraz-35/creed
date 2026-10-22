import type { Manifest } from "./types";

export default function Toc({
  book,
  manifest,
  currentFile,
  annIndex,
  onClose,
}: {
  book: string;
  manifest: Manifest;
  currentFile: string | null;
  annIndex: Set<string>;
  onClose: () => void;
}) {
  const multiPart = manifest.parts.length > 1;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="toc" onClick={(e) => e.stopPropagation()}>
        <div className="toc-head">
          <span className="overline">Contents</span>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {manifest.parts.map((p) => (
          <div key={p.n} className="toc-part">
            {multiPart && (
              <div className="toc-part-title">Part {p.roman}</div>
            )}
            {p.books.map((b) => (
              <div key={b.roman} className="toc-book">
                <div className="toc-book-title">
                  {b.roman}. {b.title}
                </div>
                {b.chapters.map((c) => (
                  <a
                    key={c.file}
                    href={`#/b/${book}/c/${c.file}`}
                    className={
                      "toc-row" + (c.file === currentFile ? " current" : "")
                    }
                    onClick={onClose}
                  >
                    <span className="toc-roman">{c.roman}.</span>
                    <span className="toc-title">{c.title}</span>
                    {annIndex.has(c.file) && <span className="loc-dot" />}
                  </a>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
