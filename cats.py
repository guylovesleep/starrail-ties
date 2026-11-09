# -*- coding: utf-8 -*-
import json, re, urllib.parse, urllib.request, time, os

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"}
d = json.load(open("raw_quotes.json", encoding="utf-8"))
pages = d["pages"]
out = {}
for i in range(0, len(pages), 20):
    chunk = pages[i:i+20]
    params = {"action": "query", "titles": "|".join(chunk), "prop": "categories", "cllimit": "500",
              "format": "json", "formatversion": "2"}
    url = "https://honkai-star-rail.fandom.com/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        data = json.loads(r.read().decode("utf-8"))
    for p in data["query"]["pages"]:
        out[p["title"]] = [c["title"].replace("Category:", "") for c in p.get("categories", [])]
    time.sleep(0.3)

json.dump(out, open("categories.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p in pages:
    cats = [c for c in out.get(p, []) if not c.startswith(("Pages", "Article", "CS1", "Characters with", "Voice-Overs", "Playable"))]
    print(p, "::", ", ".join(cats[:14]))
