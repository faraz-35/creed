#!/usr/bin/env python3
"""Split the Gutenberg Garnett text into per-chapter JSON files.

Deterministic: same input -> same output. Every paragraph gets a stable id
("p1", "p2", ...) that the annotation layer anchors to.

Output:
  public/data/manifest.json
  public/data/chapters/<part>-<book>-<chap>.json   (epilogue: ep-<chap>.json)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "texts" / "raw" / "pg28054.txt"
OUT_CH = ROOT / "public" / "data" / "chapters"
OUT_MANIFEST = ROOT / "public" / "data" / "manifest.json"

ROMAN = "IVXLC"


def unwrap(block: str) -> str:
    """Join hard-wrapped Gutenberg lines into one line per paragraph."""
    lines = [l.strip() for l in block.splitlines()]
    lines = [l for l in lines if l]
    return " ".join(lines)


def para_html(p: str) -> str:
    """Gutenberg _italics_ -> <em>; keep everything else as plain text."""
    p = re.sub(r"_([^_]+)_", r"<em>\1</em>", p)
    return p


def main() -> None:
    text = RAW.read_text(encoding="utf-8")
    # Strip Gutenberg boilerplate.
    start = text.index("*** START OF THE PROJECT GUTENBERG EBOOK")
    start = text.index("\n", start) + 1
    end = text.index("*** END OF THE PROJECT GUTENBERG EBOOK")
    text = text[start:end].strip("\n")

    # The novel's epigraph sits between the author's note and PART I; capture it
    # separately by finding the epigraph page marker.
    lines = text.splitlines()

    part_re = re.compile(r"^PART ([IVX]+)\s*$")
    book_re = re.compile(r"^Book ([IVX]+)\.\s*(.*)$")
    chap_re = re.compile(r"^Chapter ([IVX]+)\.\s*$")
    epilogue_re = re.compile(r"^EPILOGUE\s*$")

    # Structure walk: build a list of (kind, number, title, start_line) then
    # slice chapter bodies between consecutive headers.
    parts: list[dict] = []
    cur_part = None
    cur_book = None
    chapters: list[dict] = []  # every chapter, flat, in order
    epilogue_books = None

    i = 0
    # Preface: everything before the first PART header is "From the Author".
    first_part = next(
        n for n, l in enumerate(lines) if part_re.match(l.strip())
    )
    preface_block = "\n".join(lines[:first_part]).strip()

    for n in range(first_part, len(lines)):
        l = lines[n].strip()
        m = part_re.match(l)
        if m:
            cur_part = {
                "n": len(parts) + 1,
                "roman": m.group(1),
                "books": [],
            }
            parts.append(cur_part)
            cur_book = None
            epilogue_books = None
            continue
        if epilogue_re.match(l):
            epilogue_books = {
                "n": 13,
                "roman": "Epilogue",
                "title": "Epilogue",
                "chapters": [],
            }
            cur_book = epilogue_books
            if cur_part is None:  # safety, should not happen
                cur_part = {"n": 5, "roman": "V", "books": []}
                parts.append(cur_part)
            cur_part["books"].append(epilogue_books)
            continue
        m = book_re.match(l)
        if m:
            cur_book = {
                "roman": m.group(1),
                "title": m.group(2).strip(),
                "chapters": [],
            }
            assert cur_part is not None, f"Book before PART at line {n}"
            cur_part["books"].append(cur_book)
            continue
        m = chap_re.match(l)
        if m:
            # Chapter title = next non-empty line (sometimes same line).
            t = n + 1
            while t < len(lines) and not lines[t].strip():
                t += 1
            title = lines[t].strip()
            chap = {
                "part": len(parts),
                "book_roman": cur_book["roman"] if cur_book else "",
                "book_title": cur_book["title"] if cur_book else "",
                "roman": m.group(1),
                "title": title,
                "from": n + 1,
                "to": None,
            }
            chapters.append(chap)
            assert cur_book is not None, f"Chapter before Book at line {n}"
            cur_book["chapters"].append(chap)
            continue

    # Chapter bodies run from just after the title line to the next header of
    # any kind; find all header line numbers for slicing.
    headers = sorted(
        [c["from"] - 1 for c in chapters]
        + [
            n
            for n, l in enumerate(lines)
            if part_re.match(l.strip()) or book_re.match(l.strip()) or epilogue_re.match(l.strip())
        ]
    )
    for idx, c in enumerate(chapters):
        c["to"] = min(
            (h for h in headers if h > c["from"]),
            default=len(lines),
        )

    # Assign chapter numbers within book + global order.
    book_counters: dict[str, int] = {}
    manifest_parts = []
    flat = []
    order = 0
    for p in parts:
        mp = {"n": p["n"], "roman": p["roman"], "books": []}
        for b in p["books"]:
            mb = {"roman": b["roman"], "title": b["title"], "chapters": []}
            for c in b["chapters"]:
                order += 1
                chap_n = len(mb["chapters"]) + 1
                fname = f"{p['n']:02d}-{int_or_epilogue(b['roman']):02d}-{chap_n:02d}.json"
                entry = {
                    "file": fname,
                    "n": chap_n,
                    "roman": c["roman"],
                    "title": c["title"],
                    "order": order,
                }
                mb["chapters"].append(entry)
                flat.append((entry, c))
            mp["books"].append(mb)
        manifest_parts.append(mp)

    OUT_CH.mkdir(parents=True, exist_ok=True)
    manifest = {
        "book": {
            "title": "The Brothers Karamazov",
            "author": "Fyodor Dostoevsky",
            "translator": "Constance Garnett (1912)",
            "source": "Project Gutenberg eBook #28054",
        },
        "parts": manifest_parts,
    }
    OUT_MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    for entry, c in flat:
        body = "\n".join(lines[c["from"] + 1 : c["to"]])
        paras = []
        for block in body.split("\n\n"):
            txt = unwrap(block)
            if not txt:
                continue
            # skip stray header remnants and asterisk separators
            if re.match(r"^Chapter [IVX]+\.$", txt):
                continue
            if set(txt) <= {"*", " "}:
                continue
            paras.append(txt)
        doc = {
            "file": entry["file"],
            "order": entry["order"],
            "part": c["part"],
            "book_roman": c["book_roman"],
            "book_title": c["book_title"],
            "n": entry["n"],
            "roman": entry["roman"],
            "title": entry["title"],
            "paragraphs": [
                {"id": f"p{i+1}", "html": para_html(t)} for i, t in enumerate(paras)
            ],
        }
        (OUT_CH / entry["file"]).write_text(
            json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    total_paras = sum(
        len((OUT_CH / e["file"]).read_text(encoding="utf-8").split('"id":')) - 1
        for e, _ in flat
    )
    print(f"parts={len(parts)} books={sum(len(p['books']) for p in parts)} chapters={len(flat)} paragraphs={total_paras}")


def int_or_epilogue(roman: str) -> int:
    vals = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "Epilogue": 13}
    return vals.get(roman, 99)


if __name__ == "__main__":
    main()
