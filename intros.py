# -*- coding: utf-8 -*-
import json, urllib.parse, urllib.request, time

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"}
d = json.load(open("raw_quotes.json", encoding="utf-8"))
pages = d["pages"]

# StarRailRes metadata
url = "https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/index_min/en/characters.json"
with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
    meta = json.loads(r.read().decode("utf-8"))
json.dump(meta, open("meta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
by_name = {v["name"]: v for v in meta.values()}
print("meta names", len(by_name))

# intros
intro = {}
for i in range(0, len(pages), 10):
    chunk = pages[i:i+10]
    params = {"action": "query", "titles": "|".join(chunk), "prop": "extracts", "exintro": "1",
              "explaintext": "1", "exchars": "500", "format": "json", "formatversion": "2"}
    u = "https://honkai-star-rail.fandom.com/api.php?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45) as r:
            data = json.loads(r.read().decode("utf-8"))
        for p in data["query"]["pages"]:
            intro[p["title"]] = p.get("extract", "")
    except Exception as e:
        print("ERR", chunk[:2], e)
    time.sleep(0.25)

json.dump(intro, open("intros.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p in pages:
    m = by_name.get(p, {})
    print(f"{p} | {m.get('element','?')} | {m.get('path','?')} | {m.get('rarity','?')} | {intro.get(p,'')[:180].replace(chr(10),' ')}")
