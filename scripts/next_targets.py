#!/usr/bin/env python3
"""Print wave targets with titles: the next N unannotated chapters in book
order, or the explicitly requested chapter ids."""
import glob
import json
import os
import sys

argv = sys.argv[1:]
n = int(argv[0]) if argv and argv[0].isdigit() else 3
explicit = [a[:-5] if a.endswith(".json") else a for a in argv if not a.isdigit()]
done = {os.path.basename(f)[:-5] for f in glob.glob("public/data/annotations/*.json")}
allc = {os.path.basename(f)[:-5] for f in glob.glob("public/data/chapters/*.json")}
if explicit:
    unknown = [t for t in explicit if t not in allc]
    if unknown:
        sys.exit(f"no such chapters: {', '.join(unknown)}")
    targets = explicit
else:
    targets = [c for c in sorted(allc) if c not in done][:n]
m = json.load(open("public/data/manifest.json"))
loc = {
    c["file"]: f"Book {b['roman']}. {b['title']}, Chapter {c['roman']} — {c['title']}"
    for p in m["parts"]
    for b in p["books"]
    for c in b["chapters"]
}
for t in targets:
    print(t, "|", loc.get(t + ".json", "?"))
