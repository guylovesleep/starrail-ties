# -*- coding: utf-8 -*-
import json, re, urllib.parse, urllib.request, time

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"}
d = json.load(open("raw_quotes.json", encoding="utf-8"))
pages = d["pages"]
out = {}
for i in range(0, len(pages), 10):
    chunk = pages[i:i+10]
    params = {"action":"query","titles":"|".join(chunk),"prop":"revisions","rvslots":"main","rvprop":"content",
              "format":"json","formatversion":"2"}
    u = "https://honkai-star-rail.fandom.com/api.php?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        data = json.loads(r.read().decode("utf-8"))
    for p in data["query"]["pages"]:
        txt = ""
        try:
            txt = p["revisions"][0]["slots"]["main"]["content"]
        except Exception:
            pass
        info = {}
        for key in ["world", "faction", "faction2", "faction3", "faction4", "faction5", "faction6", "faction7", "faction8", "faction9", "faction10", "faction11", "faction12", "faction13"]:
            m = re.search(r"\|\s*" + key + r"\s*=\s*([^\n|]*)", txt)
            if m:
                v = re.sub(r"<ref[^>]*>.*?</ref>", "", m.group(1), flags=re.S)
                v = re.sub(r"<ref[^>]*/>", "", v)
                v = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", v)
                v = re.sub(r"\[\[([^\]]+)\]\]", r"\1", v)
                v = v.strip()
                if v and v.lower() not in ("", "none"):
                    info[key] = v
        out[p["title"]] = info
    time.sleep(0.25)
json.dump(out, open("factions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for p in pages:
    i = out.get(p, {})
    print(p, "::", i)
