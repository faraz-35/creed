import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Annotation,
  AnnotationsDoc,
  ChapterDoc,
  ChapterMeta,
} from "./types";
import { TYPE_LABEL, VOICE_LABEL } from "./types";
import { loadProgress, saveProgress } from "./App";

const CONFIDENCE_GLYPH: Record<string, string> = {
  certain: "●",
  likely: "◐",
  uncertain: "○",
};

const PLACEMENT_LABEL: Record<string, string> = {
  inline: "inline",
  before: "before",
  after: "after",
  page: "reference pages",
};

/** Wrap the exact quote inside a rendered paragraph with a span.
 * Works across element boundaries (e.g. a quote crossing an <em>). */
function wrapQuote(p: HTMLElement, a: Annotation, cls: string) {
  if (p.querySelector(`[data-aid="${a.id}"]`)) return; // idempotent
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      let el: HTMLElement | null = n.parentElement;
      while (el && el !== p) {
        if (el.classList.contains("ann-pop") || el.classList.contains("vw-pop"))
          return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const texts: Text[] = [];
  const starts: number[] = [];
  let cum = "";
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    starts.push(cum.length);
    cum += t.data;
    texts.push(t);
  }
  const idx = cum.indexOf(a.quote);
  if (idx < 0) return;
  const end = idx + a.quote.length;
  let si = 0;
  while (si < texts.length - 1 && starts[si + 1] <= idx) si++;
  let ei = si;
  while (ei < texts.length - 1 && starts[ei + 1] < end) ei++;
  const range = document.createRange();
  range.setStart(texts[si], idx - starts[si]);
  range.setEnd(texts[ei], end - starts[ei]);
  const span = document.createElement("span");
  span.className = cls;
  span.setAttribute("data-aid", a.id);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  if (cls === "ann-inline") {
    const pop = document.createElement("span");
    pop.className = "ann-pop";
    const chip = document.createElement("span");
    chip.className = "ann-pop-type";
    chip.textContent = `${TYPE_LABEL[a.type]} · ${a.confidence}`;
    const body = document.createElement("span");
    body.className = "ann-pop-body";
    body.textContent = a.label ? `${a.label} — ${a.note}` : a.note;
    pop.append(chip, body);
    span.appendChild(pop);
  } else if (cls === "ann-vocab") {
    // dictionary-style hover card, visually quieter than editorial notes
    const pop = document.createElement("span");
    pop.className = "vw-pop";
    const word = document.createElement("span");
    word.className = "vw-word";
    word.textContent = a.label ?? a.quote;
    const def = document.createElement("span");
    def.className = "vw-def";
    def.textContent = a.note;
    pop.append(word, def);
    span.appendChild(pop);
  }
}

export default function Reader({
  file,
  flat,
}: {
  file: string;
  flat: ChapterMeta[];
}) {
  const [doc, setDoc] = useState<ChapterDoc | null>(null);
  const [ann, setAnn] = useState<AnnotationsDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [clean, setClean] = useState(false);
  const [spoilers, setSpoilers] = useState(
    () => localStorage.getItem("bk.spoilers") === "1"
  );
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [openPage, setOpenPage] = useState<Annotation | null>(null);
  const [voice, setVoice] = useState<string>("scholarly");
  const bodyRef = useRef<HTMLDivElement>(null);

  const idx = flat.findIndex((c) => c.file === file);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  useEffect(() => {
    setDoc(null);
    setAnn(null);
    setErr(null);
    setOpenPage(null);
    Promise.all([
      fetch(`/data/chapters/${file}`).then((r) => {
        if (!r.ok) throw new Error(`chapter ${file}: ${r.status}`);
        return r.json();
      }),
      fetch(`/data/annotations/${file}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([d, a]) => {
        setDoc(d);
        setAnn(a);
        const saved = loadProgress();
        if (saved && saved.file === file && saved.pct > 0.01) {
          requestAnimationFrame(() => {
            const h =
              document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo({ top: saved.pct * h });
          });
        } else {
          window.scrollTo({ top: 0 });
        }
      })
      .catch((e) => setErr(String(e)));
  }, [file]);

  useEffect(() => {
    localStorage.setItem("bk.spoilers", spoilers ? "1" : "0");
  }, [spoilers]);

  // scroll: hairline progress
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        const p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
        setPct(p);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [file]);

  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => saveProgress(file, pct),
      400
    ) as unknown as number;
    return () => window.clearTimeout(saveTimer.current);
  }, [pct, file]);

  // reading keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j")
        window.scrollBy({
          top: window.innerHeight * 0.7,
          behavior: "smooth",
        });
      else if (e.key === "k")
        window.scrollBy({
          top: -window.innerHeight * 0.7,
          behavior: "smooth",
        });
      else if (e.key === "n" && next) location.hash = `#/c/${next.file}`;
      else if (e.key === "p" && prev) location.hash = `#/c/${prev.file}`;
      else if (e.key === "a") setClean((v) => !v);
      else if (e.key === "s") setSpoilers((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const byAnchor = useMemo(() => {
    const m = new Map<string, Annotation[]>();
    if (!ann) return m;
    for (const a of ann.annotations) {
      const list = m.get(a.anchor) ?? [];
      list.push(a);
      m.set(a.anchor, list);
    }
    return m;
  }, [ann]);

  // inline + page-link spans: DOM post-processing after render
  useEffect(() => {
    const container = bodyRef.current;
    if (!container || !doc) return;
    if (clean || !ann) return;
    for (const a of ann.annotations) {
      if (a.placement !== "inline" && a.placement !== "page") continue;
      const p = container.querySelector<HTMLElement>(
        `[data-pid="${a.anchor}"]`
      );
      if (!p) continue;
      const cls =
        a.placement === "page"
          ? "ann-page-link"
          : a.type === "vocab"
            ? "ann-vocab"
            : "ann-inline";
      wrapQuote(p, a, cls);
    }
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest(
        ".ann-inline, .ann-page-link, .ann-vocab"
      );
      if (!t) return;
      const id = t.getAttribute("data-aid");
      const a = ann.annotations.find((x) => x.id === id);
      if (!a) return;
      if (a.placement === "page") {
        setOpenPage(a);
      } else {
        t.classList.toggle("open");
        e.stopPropagation();
      }
    };
    container.addEventListener("click", onClick);
    return () => {
      container.removeEventListener("click", onClick);
      container
        .querySelectorAll(".ann-inline, .ann-page-link, .ann-vocab")
        .forEach((el) => {
          const parent = el.parentNode;
          if (!parent) return;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          parent.normalize();
        });
    };
  }, [doc, ann, clean]);

  if (err)
    return (
      <div className="page-error">
        couldn’t load this chapter — <code>{err}</code>
      </div>
    );
  if (!doc) return <div className="page-loading">…</div>;

  const voices = Object.keys(ann?.commentary ?? {}).filter(
    (v) => (ann?.commentary[v] ?? []).length > 0
  );

  const placementCounts = ann
    ? (["inline", "before", "after", "page"] as const)
        .map((pl) => ({
          pl,
          n: ann.annotations.filter((a) => a.placement === pl).length,
        }))
        .filter((x) => x.n > 0)
    : [];

  const vocabN = ann
    ? ann.annotations.filter((a) => a.type === "vocab").length
    : 0;

  const pageHidden =
    openPage &&
    openPage.spoiler &&
    !spoilers &&
    !revealed.has(openPage.id);

  return (
    <>
      <div className="progress-hairline" style={{ width: `${pct * 100}%` }} />
      <div className="reader" ref={bodyRef}>
        <div className="chapter-col">
          <header className="chapter-head">
            <div className="book-label">
              Part {doc.part} · {doc.book_roman}. {doc.book_title}
            </div>
            <h1 className="chapter-title">
              <span className="chapter-roman">{doc.roman}.</span> {doc.title}
            </h1>
            {ann && !clean && placementCounts.length > 0 && (
              <div className="notes-count">
                {ann.annotations.length} notes —{" "}
                {[
                  ...placementCounts.map((x) =>
                    x.pl === "inline"
                      ? `${x.n - vocabN} inline`
                      : `${x.n} ${PLACEMENT_LABEL[x.pl]}`
                  ),
                  ...(vocabN > 0 ? [`${vocabN} word meanings`] : []),
                ].join(" · ")}
                {ann.annotations.some((a) => a.spoiler) && !spoilers
                  ? " · one reference page hides a spoiler (s to reveal all)"
                  : ""}
              </div>
            )}
          </header>

          <div className={"chapter-body" + (clean ? " clean" : "")}>
            {doc.paragraphs.map((p, i) => {
              const notes = byAnchor.get(p.id) ?? [];
              const before = notes.filter((a) => a.placement === "before");
              const after = notes.filter((a) => a.placement === "after");
              return (
                <div key={p.id} className="para-wrap">
                  {!clean &&
                    before.map((a) => (
                      <NoteBlock key={a.id} a={a} kind="before" />
                    ))}
                  <p
                    className={i === 0 ? "first" : undefined}
                    data-pid={p.id}
                    dangerouslySetInnerHTML={{ __html: p.html }}
                  />
                  {!clean &&
                    after.map((a) => (
                      <NoteBlock key={a.id} a={a} kind="after" />
                    ))}
                </div>
              );
            })}
          </div>

          {ann && !clean && voices.length > 0 && (
            <section className="commentary">
              <div className="commentary-rule" />
              <div className="commentary-head">
                <span className="overline">Commentary</span>
                {voices.length > 1 && (
                  <div className="voice-pills">
                    {voices.map((v) => (
                      <button
                        key={v}
                        className={"pill" + (voice === v ? " on" : "")}
                        onClick={() => setVoice(v)}
                      >
                        {VOICE_LABEL[v] ?? v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(ann.commentary[voice] ?? ann.commentary[voices[0]] ?? []).map(
                (para, i) => (
                  <p key={i}>{para}</p>
                )
              )}
            </section>
          )}

          <nav className="chapter-nav">
            {prev ? (
              <a className="nav-link prev" href={`#/c/${prev.file}`}>
                <span className="nav-dir">← p</span>
                <span className="nav-title">{prev.title}</span>
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a className="nav-link next" href={`#/c/${next.file}`}>
                <span className="nav-dir">n →</span>
                <span className="nav-title">{next.title}</span>
              </a>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </div>

      {openPage && (
        <div className="overlay" onClick={() => setOpenPage(null)}>
          <div className="page-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="page-head">
              <span className="overline">
                {TYPE_LABEL[openPage.type]} · reference page
              </span>
              <button className="icon-btn" onClick={() => setOpenPage(null)}>
                ✕
              </button>
            </div>
            <h2 className="page-title">{openPage.title ?? openPage.label}</h2>
            <div className="page-meta">
              <span className="confidence" title="confidence">
                {CONFIDENCE_GLYPH[openPage.confidence]}{" "}
                {openPage.confidence}
              </span>
            </div>
            <blockquote className="note-quote">“{openPage.quote}”</blockquote>
            {openPage.type === "foreign" && openPage.original && (
              <div className="foreign-block">
                <div className="foreign-original">{openPage.original}</div>
                {openPage.render && (
                  <div className="foreign-render">“{openPage.render}”</div>
                )}
              </div>
            )}
            <div className={"page-body" + (pageHidden ? " hidden" : "")}>
              {openPage.note.split("\n\n").map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
            {pageHidden && (
              <button
                className="reveal-btn"
                onClick={() =>
                  setRevealed((s) => new Set(s).add(openPage.id))
                }
              >
                reveal spoiler
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NoteBlock({
  a,
  kind,
}: {
  a: Annotation;
  kind: "before" | "after";
}) {
  return (
    <div className={"note-block " + kind}>
      <div className="note-block-head">
        <span className="nb-kind">
          {kind === "before" ? "before you read" : "after you read"}
        </span>
        <span className={"chip t-" + a.type}>{TYPE_LABEL[a.type]}</span>
        <span className="confidence" title={"confidence: " + a.confidence}>
          {CONFIDENCE_GLYPH[a.confidence]}
        </span>
      </div>
      {a.label && <div className="note-block-label">{a.label}</div>}
      <div className="note-block-body">{a.note}</div>
    </div>
  );
}
