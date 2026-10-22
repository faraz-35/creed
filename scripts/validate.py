#!/usr/bin/env python3
"""Validation gate for the annotation layer of every book.

A book is a directory under public/books/<id>/ with chapters/ and
annotations/. For every annotations/<file>.json this script checks:
  1. the referenced chapter file exists
  2. every annotation anchor (paragraph id) exists in that chapter
  3. every quoted snippet actually appears in the chapter text
     (tags stripped, whitespace collapsed, quotes/dashes normalized)
  4. annotation ids are unique; commentary has at least one voice

Exit code 1 on any failure. This gate is what makes hallucinated
anchors/quotes impossible to ship: they are checked against the
actual chapter text, mechanically.

Side effects: rewrites each book's annotations/index.json and pipeline.md
done-count, appends a progress.log line, and regenerates the
public/books.json catalog the library page loads.

Usage: validate.py [book_id ...] — no args validates every book.
"""
import datetime
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / "public" / "books"

ALLOWED_TYPES = {"foreign", "allusion", "context", "translation", "term", "idea", "vocab"}
ALLOWED_CONF = {"certain", "likely", "uncertain"}
ALLOWED_PLACEMENTS = {"inline", "before", "after", "page"}


def norm(s: str) -> str:
    s = re.sub(r"</?em>", "", s)
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("—", "--").replace("–", "-")
    s = re.sub(r"\s+", " ", s)
    return s


def validate_book(book: Path) -> tuple[int, int, int]:
    """Validate one book directory. Returns (files, annotations, failures)."""
    ch_dir = book / "chapters"
    an_dir = book / "annotations"
    failures = 0
    checked = 0
    files = sorted(f for f in an_dir.glob("*.json") if f.name != "index.json")
    if not files:
        print(f"[{book.name}] no annotation files yet")
        return 0, 0, 0
    for f in files:
        doc = json.loads(f.read_text(encoding="utf-8"))
        ch_path = ch_dir / f.name
        if not ch_path.exists():
            print(f"FAIL {f.name}: no chapter file")
            failures += 1
            continue
        ch = json.loads(ch_path.read_text(encoding="utf-8"))
        paras = {p["id"]: norm(p["html"]) for p in ch["paragraphs"]}
        full_text = norm(" ".join(p["html"] for p in ch["paragraphs"]))
        ids = set()
        for a in doc.get("annotations", []):
            checked += 1
            tag = f"{f.name}#{a.get('id', '?')}"
            if a.get("id") in ids:
                print(f"FAIL {tag}: duplicate id")
                failures += 1
            ids.add(a.get("id"))
            if a.get("anchor") not in paras:
                print(f"FAIL {tag}: anchor {a.get('anchor')} not in chapter")
                failures += 1
                continue
            if a.get("type") not in ALLOWED_TYPES:
                print(f"FAIL {tag}: bad type {a.get('type')}")
                failures += 1
            if a.get("confidence") not in ALLOWED_CONF:
                print(f"FAIL {tag}: bad confidence {a.get('confidence')}")
                failures += 1
            pl = a.get("placement")
            if pl not in ALLOWED_PLACEMENTS:
                print(f"FAIL {tag}: bad placement {pl}")
                failures += 1
            else:
                if pl == "page" and not a.get("title"):
                    print(f"FAIL {tag}: page placement requires a title")
                    failures += 1
                if pl == "inline" and len(a.get("note", "").split()) > 80:
                    print(f"WARN {tag}: inline note is long for a hover box "
                          f"({len(a['note'].split())} words) — consider a block/page")
            q = a.get("quote")
            if not q:
                print(f"FAIL {tag}: missing quote")
                failures += 1
            elif norm(q) not in full_text:
                print(f"FAIL {tag}: quote not found in chapter: {q[:60]!r}")
                failures += 1
        comm = doc.get("commentary", {})
        if not any(v for v in comm.values()):
            print(f"FAIL {f.name}: no commentary voice")
            failures += 1
        n_ok = len(doc.get("annotations", []))
        print(f"ok   {f.name}: {n_ok} annotations, voices={sorted(k for k, v in comm.items() if v)}")

    # regenerate the annotations index consumed by the reader
    index = {"files": [f.name for f in files]}
    (an_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # keep the human status page and progress log in step with the gate
    pipeline = book / "pipeline.md"
    if pipeline.exists():
        pipeline.write_text(re.sub(
            r"(Status: \*\*)\d+( of )(\d+)( chapters done\*\*)",
            rf"\g<1>{len(files)}\g<2>\g<3>\g<4>",
            pipeline.read_text(encoding="utf-8"), count=1), encoding="utf-8")
    with (book / "progress.log").open("a") as logf:
        logf.write(f"{datetime.datetime.now():%H:%M:%S} validate: "
                   f"{len(files)} files, {checked} annotations, {failures} failures\n")
    return len(files), checked, failures


def write_catalog() -> None:
    """Regenerate public/books.json: id, title, counts for the library page."""
    books = []
    for d in sorted(p for p in BOOKS.iterdir() if p.is_dir()):
        m_path = d / "manifest.json"
        if not m_path.exists():
            print(f"[{d.name}] no manifest.json — not in catalog (run split first)")
            continue
        m = json.loads(m_path.read_text(encoding="utf-8"))
        n_ch = sum(len(b["chapters"]) for p in m["parts"] for b in p["books"])
        an_dir = d / "annotations"
        n_ann = (len([f for f in an_dir.glob("*.json") if f.name != "index.json"])
                 if an_dir.exists() else 0)
        books.append({
            "id": d.name,
            "title": m["book"]["title"],
            "author": m["book"]["author"],
            "translator": m["book"].get("translator", ""),
            "chapters": n_ch,
            "annotated": n_ann,
        })
    (ROOT / "public" / "books.json").write_text(
        json.dumps({"books": books}, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> int:
    if not BOOKS.exists():
        print("no public/books/ directory")
        return 1
    ids = sys.argv[1:]
    dirs = [BOOKS / i for i in ids] if ids else sorted(
        p for p in BOOKS.iterdir() if p.is_dir())
    missing = [d.name for d in dirs if not d.is_dir()]
    if missing:
        print(f"no such books: {', '.join(missing)}")
        return 1
    failures = 0
    for d in dirs:
        print(f"[{d.name}]")
        failures += validate_book(d)[2]
    write_catalog()
    print(f"\n{failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
