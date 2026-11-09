# -*- coding: utf-8 -*-
import json, re, urllib.parse, urllib.request, time

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"}
BASE = "https://honkai-star-rail.fandom.com/api.php"

def api(params):
    params = dict(params)
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    u = BASE + "?" + urllib.parse.urlencode(params)
    for a in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if a == 2:
                raise
            time.sleep(2)

d = json.load(open("raw_quotes.json", encoding="utf-8"))
quotes = d["quotes"]

cands = []
for q in quotes:
    f = q.get("file", "")
    if not f:
        continue
    f = f.replace("VO_{language}_", "VO_")
    f = f.replace("{character}", q["from"])
    f = f.replace(" ", "_")
    cands.append(f)
uniq = sorted(set(cands))
print("unique audio candidates", len(uniq))

found = {}
for i in range(0, len(uniq), 40):
    chunk = uniq[i:i+40]
    titles = "|".join("File:" + c for c in chunk)
    data = api({"action": "query", "titles": titles, "prop": "imageinfo", "iiprop": "url|size"})
    norm = {n["to"]: n["from"] for n in data.get("query", {}).get("normalized", [])}
    for p in data.get("query", {}).get("pages", []):
        title = p["title"]
        orig = norm.get(title, title)
        fname = orig[5:] if orig.startswith("File:") else orig
        if p.get("imageinfo"):
            found[fname] = p["imageinfo"][0]["url"]
    time.sleep(0.15)
print("audio found", len(found), "rate", len(found) / max(1, len(uniq)))
for k, v in list(found.items())[:5]:
    print(k, "->", v[:140])

json.dump({"audio": found}, open("audio_urls.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
