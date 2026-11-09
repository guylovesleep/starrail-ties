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

# audio candidate filenames
cands = []
for q in quotes:
    if q["title"].lower().startswith("about "):
        fname = "VO Archive %s %s.ogg" % (q["from"], q["title"])
        fname = fname.replace("/", "-")
        cands.append(fname)
uniq = sorted(set(cands))
print("unique audio candidates", len(uniq))

found = {}
for i in range(0, len(uniq), 40):
    chunk = uniq[i:i+40]
    titles = "|".join("File:" + c for c in chunk)
    data = api({"action": "query", "titles": titles, "prop": "imageinfo", "iiprop": "url|size"})
    norm = {}
    for n in data.get("query", {}).get("normalized", []):
        norm[n["to"]] = n["from"]
    for p in data.get("query", {}).get("pages", []):
        title = p["title"]
        orig = norm.get(title, title)
        fname = orig[5:] if orig.startswith("File:") else orig
        if p.get("imageinfo"):
            found[fname] = p["imageinfo"][0]["url"]
    time.sleep(0.15)
print("audio found", len(found), "rate", len(found) / max(1, len(uniq)))
for k, v in list(found.items())[:5]:
    print(k, "->", v[:120])

# npc images
npc_files = ["NPC Pom-Pom.png", "NPC Huaiyan.png", "NPC Svarog.png", "NPC Cocolia.png",
             "NPC Tail Normal.png", "NPC Mr. Reca.png", "NPC Screwllum.png", "NPC Elio.png",
             "NPC Kuchiba.png"]
titles = "|".join("File:" + f for f in npc_files)
data = api({"action": "query", "titles": titles, "prop": "imageinfo", "iiprop": "url|size"})
print("\nNPC images:")
for p in data.get("query", {}).get("pages", []):
    print(p["title"], "->", (p.get("imageinfo") or [{}])[0].get("url", "MISSING")[:150])

json.dump({"audio": found}, open("audio_urls.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
