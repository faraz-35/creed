#!/usr/bin/env python3
"""Print wave targets for one book: the next N unannotated chapters in book
order, or the explicitly requested chapter ids.

Usage: next_targets.py <book_id> [N | chapter_id ...]
"""
import glob
import json
import os
import sys

argv = sys.argv[1:]
if not argv:
    sys.exit("usage: next_targets.py <book_id> [N | chapter_id ...]")
book = argv[0]
rest = argv[1:]
n = int(rest[0]) if rest and rest[0].isdigit() else 3
explicit = [a[:-5] if a.endswith(".json") else a for a in rest if not a.isdigit()]
root = f"public/books/{book}"
done = {os.path.basename(f)[:-5] for f in glob.glob(f"{root}/annotations/*.json")}
allc = {os.path.basename(f)[:-5] for f in glob.glob(f"{root}/chapters/*.json")}
if not allc:
    sys.exit(f"no chapters for book '{book}' under {root}")
if explicit:
    unknown = [t for t in explicit if t not in allc]
    if unknown:
        sys.exit(f"no such chapters: {', '.join(unknown)}")
    targets = explicit
else:
    targets = [c for c in sorted(allc) if c not in done][:n]
m = json.load(open(f"{root}/manifest.json"))
loc = {
    c["file"]: f"Book {b['roman']}. {b['title']}, Chapter {c['roman']} — {c['title']}"
    for p in m["parts"]
    for b in p["books"]
    for c in b["chapters"]
}
for t in targets:
    print(t, "|", loc.get(t + ".json", "?"))
