import type { Catalog } from "./types";

export default function Library({ catalog }: { catalog: Catalog }) {
  return (
    <div className="home library">
      <div className="home-inner">
        <div className="overline">reading editions</div>

        <div className="library-list">
          {catalog.books.map((b) => (
            <a key={b.id} className="library-book" href={`#/b/${b.id}`}>
              <div className="library-book-title">{b.title}</div>
              <div className="library-book-author">
                {b.author}
                {b.translator ? ` · ${b.translator}` : ""}
              </div>
              <div className="library-book-meta">
                {b.annotated} of {b.chapters} chapters annotated
              </div>
            </a>
          ))}
        </div>

        <div className="home-keys" style={{ marginTop: 36 }}>
          <span className="kbd">t</span> contents ·{" "}
          <span className="kbd">m</span> theme ·{" "}
          <span className="kbd">?</span> all shortcuts
        </div>
      </div>
    </div>
  );
}
