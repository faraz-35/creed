import { useEffect, useMemo, useState } from "react";
import type { ChapterMeta, Manifest } from "./types";
import Home from "./Home";
import Reader from "./Reader";
import Toc from "./Toc";
import Help from "./Help";

type Theme = "dark" | "paper";

export function loadProgress(): { file: string; pct: number } | null {
  try {
    const raw = localStorage.getItem("bk.last");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProgress(file: string, pct: number) {
  try {
    localStorage.setItem("bk.last", JSON.stringify({ file, pct }));
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
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [annIndex, setAnnIndex] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("bk.theme") as Theme) || "dark"
  );
  const [tocOpen, setTocOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const route = useRoute();

  useEffect(() => {
    fetch("/data/manifest.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch((e) => setErr(String(e)));
    fetch("/data/annotations/index.json")
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files: string[] }) => setAnnIndex(new Set(d.files)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bk.theme", theme);
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

  const chapterMatch = route.match(/^#\/c\/(.+)$/);
  const rawFile = chapterMatch ? chapterMatch[1].replace(/\.json$/, "") : null;
  const currentFile = rawFile ? `${rawFile}.json` : null;

  if (err)
    return (
      <div className="page-error">
        couldn’t load the book — <code>{err}</code>
      </div>
    );
  if (!manifest) return <div className="page-loading">…</div>;

  return (
    <>
      <header className="top-bar">
        <div className="top-left">
          <a href="#/" className="brand">
            The Brothers Karamazov
          </a>
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
      {currentFile ? (
        <Reader key={currentFile} file={currentFile} flat={flat} />
      ) : (
        <Home flat={flat} manifest={manifest} annIndex={annIndex} />
      )}
      {tocOpen && (
        <Toc
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
