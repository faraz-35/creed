import { useEffect, useMemo, useState } from "react";
import type { Catalog, ChapterMeta, Manifest } from "./types";
import Library from "./Library";
import Home from "./Home";
import Reader from "./Reader";
import Toc from "./Toc";
import Help from "./Help";

type Theme = "dark" | "paper";

const APP_TITLE = "creed — annotated reading editions";

export function loadProgress(
  book: string
): { file: string; pct: number } | null {
  try {
    const raw = localStorage.getItem(`creed.last.${book}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProgress(book: string, file: string, pct: number) {
  try {
    localStorage.setItem(
      `creed.last.${book}`,
      JSON.stringify({ file, pct })
    );
  } catch {
    /* private mode */
  }
}

function useRoute(): string {
  const [h, setH] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const on = () => setH(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [annIndex, setAnnIndex] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("creed.theme") as Theme) || "dark"
  );
  const [tocOpen, setTocOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const route = useRoute();

  useEffect(() => {
    fetch("books.json")
      .then((r) => r.json())
      .then(setCatalog)
      .catch((e) => setErr(String(e)));
  }, []);

  // route: #/  #/b/<id>  #/b/<id>/c/<file>
  const bookMatch = route.match(/^#\/b\/([\w-]+)(?:\/c\/(.+))?$/);
  const bookId = bookMatch ? bookMatch[1] : null;
  const currentFile = bookMatch?.[2]
    ? `${bookMatch[2].replace(/\.json$/, "")}.json`
    : null;

  useEffect(() => {
    setManifest(null);
    setAnnIndex(new Set());
    if (!bookId) {
      document.title = APP_TITLE;
      return;
    }
    fetch(`books/${bookId}/manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest for "${bookId}": ${r.status}`);
        return r.json();
      })
      .then((m: Manifest) => {
        setManifest(m);
        document.title = `${m.book.title} — creed`;
      })
      .catch((e) => setErr(String(e)));
    fetch(`books/${bookId}/annotations/index.json`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files: string[] }) => setAnnIndex(new Set(d.files)))
      .catch(() => {});
  }, [bookId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("creed.theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "t") setTocOpen((v) => !v);
      else if (e.key === "m") setTheme((t) => (t === "dark" ? "paper" : "dark"));
      else if (e.key === "?") setHelpOpen((v) => !v);
      else if (e.key === "Escape") {
        setTocOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flat = useMemo<ChapterMeta[]>(() => {
    if (!manifest) return [];
    return manifest.parts.flatMap((p) => p.books.flatMap((b) => b.chapters));
  }, [manifest]);

  const multiPart = (manifest?.parts.length ?? 0) > 1;

  if (err)
    return (
      <div className="page-error">
        couldn’t load — <code>{err}</code>
      </div>
    );
  if (!catalog && !bookId) return <div className="page-loading">…</div>;

  return (
    <>
      <header className="top-bar">
        <div className="top-left">
          <a href="#/" className="brand">
            creed
          </a>
          {bookId && manifest && (
            <>
              <span className="loc-sep">·</span>
              <a href={`#/b/${bookId}`} className="book-link">
                {manifest.book.title}
              </a>
            </>
          )}
          {currentFile && (
            <LocationLabel
              flat={flat}
              currentFile={currentFile}
              annIndex={annIndex}
            />
          )}
        </div>
        <div className="top-right">
          <button
            className="icon-btn"
            title="Contents (t)"
            onClick={() => setTocOpen(true)}
          >
            ☰
          </button>
          <button
            className="icon-btn"
            title="Theme: dark / paper (m)"
            onClick={() => setTheme((t) => (t === "dark" ? "paper" : "dark"))}
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button
            className="icon-btn"
            title="Shortcuts (?)"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
        </div>
      </header>
      {bookId && currentFile && manifest ? (
        <Reader
          key={`${bookId}/${currentFile}`}
          book={bookId}
          file={currentFile}
          flat={flat}
          multiPart={multiPart}
          foreignLabel={manifest.book.foreign_label}
        />
      ) : bookId && manifest ? (
        <Home
          book={bookId}
          flat={flat}
          manifest={manifest}
          annIndex={annIndex}
        />
      ) : (
        catalog && <Library catalog={catalog} />
      )}
      {tocOpen && bookId && manifest && (
        <Toc
          book={bookId}
          manifest={manifest}
          currentFile={currentFile}
          annIndex={annIndex}
          onClose={() => setTocOpen(false)}
        />
      )}
      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
    </>
  );
}

function LocationLabel({
  flat,
  currentFile,
  annIndex,
}: {
  flat: ChapterMeta[];
  currentFile: string;
  annIndex: Set<string>;
}) {
  const ch = flat.find((c) => c.file === currentFile);
  if (!ch) return null;
  return (
    <span className="location">
      <span className="loc-sep">·</span> {ch.roman}. {ch.title}{" "}
      <span className="loc-dim">
        ({ch.order}/{flat.length})
      </span>
      {annIndex.has(ch.file) && <span className="loc-dot" title="annotated" />}
    </span>
  );
}
