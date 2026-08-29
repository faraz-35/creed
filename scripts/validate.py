#!/usr/bin/env python3
"""Validation gate for the annotation layer.

Checks, for every public/data/annotations/<file>.json:
  1. the referenced chapter file exists
  2. every annotation anchor (paragraph id) exists in that chapter
  3. every quoted snippet actually appears in the chapter text
     (tags stripped, whitespace collapsed, quotes/dashes normalized)
  4. annotation ids are unique; commentary has at least one voice

Exit code 1 on any failure. This gate is what makes hallucinated
anchors/quotes impossible to ship: they are checked against the
actual chapter text, mechanically.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CH = ROOT / "public" / "data" / "chapters"
AN = ROOT / "public" / "data" / "annotations"

ALLOWED_TYPES = {"foreign", "allusion", "context", "translation", "term", "idea", "vocab"}
ALLOWED_CONF = {"certain", "likely", "uncertain"}
ALLOWED_PLACEMENTS = {"inline", "before", "after", "page"}


def norm(s: str) -> str:
    s = re.sub(r"</?em>", "", s)
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("—", "--").replace("–", "-")
    s = re.sub(r"\s+", " ", s)
    return s


def main() -> int:
    failures = 0
    checked = 0
    files = sorted(f for f in AN.glob("*.json") if f.name != "index.json")
    if not files:
        print("no annotation files found")
        return 0
    for f in files:
        doc = json.loads(f.read_text(encoding="utf-8"))
        ch_path = CH / f.name
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
    (AN / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n{checked} annotations checked, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
