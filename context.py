# -*- coding: utf-8 -*-
import json, urllib.parse, urllib.request, time, re

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"}
names = ["Ashveil","Evanescia","The Dahlia","Sparxie","Pearl","Yao Guang","Mortenax Blade","Cyrene","Cerydra",
         "Hysilens","Evernight","Himeko • Nova","Dan Heng • Permansor Terrae","Rin Tohsaka","Gilgamesh",
         "Kuchiba","Terravox","Ishtar","Suyi","Oleg","Elio","Pom-Pom","Huaiyan","Svarog","Cocolia",
         "Mr. Reca","Screwllum","Tail","Trailblazer"]
for i in range(0, len(names), 10):
    chunk = names[i:i+10]
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
        txt = re.sub(r"\{\{[^{}]*\}\}", "", txt)
        txt = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", txt)
        txt = re.sub(r"\[\[([^\]]+)\]\]", r"\1", txt)
        txt = re.sub(r"'''?", "", txt)
        print("\n=====", p["title"], "=====")
        print(txt[:700].replace("\n", " "))
    time.sleep(0.3)
