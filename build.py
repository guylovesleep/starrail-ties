# -*- coding: utf-8 -*-
"""Build the Honkai: Star Rail Ties dataset and local artwork."""
import json, os, re, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
ICONS = os.path.join(ASSETS, "icons")
SPLASH = os.path.join(ASSETS, "splash")
os.makedirs(ICONS, exist_ok=True)
os.makedirs(SPLASH, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Referer": "https://honkai-star-rail.fandom.com/"}

raw = json.load(open(os.path.join(HERE, "raw_quotes.json"), encoding="utf-8"))
meta = json.load(open(os.path.join(HERE, "meta.json"), encoding="utf-8"))
fac = json.load(open(os.path.join(HERE, "factions.json"), encoding="utf-8"))
audio = json.load(open(os.path.join(HERE, "audio_urls.json"), encoding="utf-8"))["audio"]

# ---------------------------------------------------------------- identities
# Alternate playable forms are folded into one person.
MERGE = {
    "Aventurine • Waveflair": "Aventurine",
    "Dan Heng • Imbibitor Lunae": "Dan Heng",
    "Dan Heng • Permansor Terrae": "Dan Heng",
    "Himeko • Nova": "Himeko",
    "Mortenax Blade": "Blade",
    "Robin • Summeretto": "Robin",
    "Silver Wolf LV.999": "Silver Wolf",
    "The Herta": "Herta",
    "Fugue": "Tingyun",
}
# extra mention aliases
MENTION_ALIAS = {
    "Topaz and Numby": "Topaz & Numby",
    "Trianne": "Tribbie",
    "Trinnon": "Tribbie",
    "Tribios": "Tribbie",
    "Dan Feng": "Dan Heng",
}
CANON = {p: MERGE.get(p, p) for p in raw["pages"]}

def cname(n):
    n = MENTION_ALIAS.get(n, n)
    return MERGE.get(n, n)

# base playable name -> StarRailRes id
# Pinned ids cover characters whose archive page name and metadata name differ,
# or that were added after the metadata snapshot was captured.
BASE_ID = {
    "Trailblazer": "8001",
    "Yukong": "1207",
    "Misha": "1312",
    "Cipher": "1406",
}
for k, v in meta.items():
    if v["name"] in raw["pages"] and v["name"] not in MERGE:
        BASE_ID.setdefault(v["name"], k)

# ---------------------------------------------------------------- worlds
WORLDS = [
    ("express", "Astral Express"),
    ("hss", "Herta Space Station"),
    ("jarilo", "Jarilo-VI"),
    ("xianzhou", "Xianzhou Luofu"),
    ("penacony", "Penacony"),
    ("amphoreus", "Amphoreus"),
    ("planarcadia", "Planarcadia"),
    ("cosmos", "The Cosmos"),
]
WORLD_OF = {
    # Astral Express
    "Trailblazer": "express", "March 7th": "express", "Dan Heng": "express",
    "Himeko": "express", "Welt": "express", "Sunday": "express",
    # Herta Space Station
    "Asta": "hss", "Arlan": "hss", "Herta": "hss", "Ruan Mei": "hss",
    # Jarilo-VI
    "Bronya": "jarilo", "Seele": "jarilo", "Clara": "jarilo", "Gepard": "jarilo",
    "Serval": "jarilo", "Pela": "jarilo", "Hook": "jarilo", "Natasha": "jarilo",
    "Luka": "jarilo", "Lynx": "jarilo", "Sampo": "jarilo",
    # Xianzhou
    "Jing Yuan": "xianzhou", "Yanqing": "xianzhou", "Yunli": "xianzhou",
    "Feixiao": "xianzhou", "Jingliu": "xianzhou", "Blade": "xianzhou",
    "Bailu": "xianzhou", "Fu Xuan": "xianzhou", "Qingque": "xianzhou",
    "Sushang": "xianzhou", "Luocha": "xianzhou", "Yukong": "xianzhou",
    "Tingyun": "xianzhou", "Hanya": "xianzhou", "Xueyi": "xianzhou",
    "Huohuo": "xianzhou", "Jiaoqiu": "xianzhou", "Moze": "xianzhou",
    "Lingsha": "xianzhou", "Guinaifen": "xianzhou", "Yao Guang": "xianzhou",
    # Penacony
    "Acheron": "penacony", "Aventurine": "penacony", "Black Swan": "penacony",
    "Boothill": "penacony", "Firefly": "penacony", "Gallagher": "penacony",
    "Rappa": "penacony", "Robin": "penacony", "Sparkle": "penacony",
    "The Dahlia": "penacony", "Misha": "penacony",
    # Amphoreus
    "Aglaea": "amphoreus", "Anaxa": "amphoreus", "Castorice": "amphoreus",
    "Cerydra": "amphoreus", "Cipher": "amphoreus", "Cyrene": "amphoreus",
    "Evernight": "amphoreus", "Hyacine": "amphoreus", "Hysilens": "amphoreus",
    "Mydei": "amphoreus", "Phainon": "amphoreus", "Tribbie": "amphoreus",
    # Planarcadia
    "Ashveil": "planarcadia", "Evanescia": "planarcadia", "Pearl": "planarcadia",
    "Sparxie": "planarcadia",
    # Cosmos
    "Argenti": "cosmos", "Dr. Ratio": "cosmos", "Jade": "cosmos", "Kafka": "cosmos",
    "Silver Wolf": "cosmos", "Topaz & Numby": "cosmos", "Saber": "cosmos",
    "Archer": "cosmos", "Gilgamesh": "cosmos", "Rin Tohsaka": "cosmos",
}

NPCS = {
    "Pom-Pom": ("express", 10),
    "Huaiyan": ("xianzhou", 11),
    "Svarog": ("jarilo", 8),
    "Tail": ("xianzhou", 7),
    "Cocolia": ("jarilo", 5),
    "Mr. Reca": ("penacony", 4),
    "Screwllum": ("hss", 4),
    "Elio": ("cosmos", 3),
    "Kuchiba": ("planarcadia", 3),
}
NPC_ALIASES = {"Tail": "Tail"}
missing_ids = sorted(n for n in set(CANON.values()) if n not in BASE_ID and n not in NPCS)
if missing_ids:
    print("warning: no StarRailRes id for", missing_ids)
SKIP_MENTIONS = {
    "Ten-Lords Commission", "Astral Express Crew", "Chrysos Heirs", "Stellaron Hunters",
    "The Nameless", "Intelligentsia Guild", "Masked Fools", "The Moles", "Cloud-Piercer",
    "Xuanquan", "Divination Commission", "Sky-Faring Commission", "The Watchmaker",
    "Ashen Detective Agency", "Twilight Courtyard", "Grove of Epiphany", "Flamewheel Octet",
    "Stars", "Astral Express", "Herta Space Station", "Belobog", "Xianzhou Alliance",
}

ELEMENT_COLOR = {
    "Physical": "#d9d4c5", "Fire": "#ff7a59", "Ice": "#7fd6f0", "Thunder": "#c39bf5",
    "Wind": "#6fe0b0", "Quantum": "#8f8cff", "Imaginary": "#f4d46a",
}
PATH_NAME = {
    "Knight": "Preservation", "Mage": "Erudition", "Warrior": "Destruction",
    "Rogue": "The Hunt", "Shaman": "Harmony", "Warlock": "Nihility",
    "Priest": "Abundance", "Memory": "Remembrance", "Elation": "Elation",
}

# ---------------------------------------------------------------- characters
canonical = sorted({CANON[p] for p in raw["pages"]})
chars = []
for name in canonical:
    m = None
    for k, v in meta.items():
        if v["name"] == name:
            m = v
            break
    wid = WORLD_OF.get(name)
    if wid is None:
        print("!! no world for", name)
        wid = "cosmos"
    info = fac.get(name, {})
    chars.append({
        "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
        "name": name,
        "world": wid,
        "element": ELEMENT_COLOR.get(m.get("element") if m else "Physical", "#d9d4c5"),
        "elementName": (m.get("element") if m else "Physical") or "Physical",
        "path": PATH_NAME.get((m.get("path") if m else "Warrior") or "Warrior", "Trailblaze"),
        "rarity": int(m.get("rarity") or 4) if m else 4,
        "aliases": [p for p in raw["pages"] if CANON[p] == name],
        "npc": False,
    })

for name, (wid, _) in NPCS.items():
    chars.append({
        "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
        "name": name,
        "world": wid,
        "element": "#d8c08a",
        "elementName": "",
        "path": "NPC",
        "rarity": 0,
        "aliases": [name],
        "npc": True,
    })

name_to_id = {}
for c in chars:
    for a in c["aliases"]:
        name_to_id[a] = c["id"]
    name_to_id[c["name"]] = c["id"]

# ---------------------------------------------------------------- quotes
quotes = []
for q in raw["quotes"]:
    src_canon = CANON.get(q["from"], q["from"])
    src_id = name_to_id.get(src_canon)
    if not src_id:
        continue
    targets = []
    for t in q["to"]:
        t = cname(t.strip())
        tid = name_to_id.get(t)
        if tid and tid != src_id and tid not in targets:
            targets.append(tid)
    if not targets:
        continue
    # audio: English archive file
    af = q.get("file", "")
    audio_url = None
    if af:
        cand = af.replace("VO_{language}_", "VO_").replace("{character}", q["from"]).replace(" ", "_")
        audio_url = audio.get(cand)
        if not audio_url:
            alt = cand.replace("_•_", "_").replace("•", "")
            audio_url = audio.get(alt)
    quotes.append({
        "from": src_id,
        "to": targets,
        "title": q["title"],
        "text": q["text"],
        "form": q["from"] if q["from"] != src_canon else "",
        "audio": audio_url or "",
    })

# unique quote lines (a line can target several people)
print("quotes", len(quotes), "edges", sum(len(q["to"]) for q in quotes))

# ---------------------------------------------------------------- images
def fetch(url):
    for a in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            if a == 2:
                raise
            time.sleep(2)

def save_icon(c, data=None):
    if data is None:
        return
    im = Image.open(BytesIO(data)).convert("RGBA")
    im = im.resize((160, 160), Image.LANCZOS)
    im.save(os.path.join(ICONS, c["id"] + ".webp"), "WEBP", quality=86, method=6)

def save_splash(c, data=None):
    if data is None:
        return
    im = Image.open(BytesIO(data)).convert("RGBA")
    im.thumbnail((640, 640), Image.LANCZOS)
    im.save(os.path.join(SPLASH, c["id"] + ".webp"), "WEBP", quality=82, method=6)

def placeholder(name):
    im = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((8, 8, 312, 312), fill=(24, 29, 48, 255), outline=(211, 188, 142, 180), width=3)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/georgia.ttf", 118)
    except Exception:
        font = ImageFont.load_default()
    d.text((160, 158), name[:1].upper(), fill=(236, 229, 216, 255), anchor="mm", font=font)
    return im

print("downloading playable portraits...")
for i, c in enumerate(chars, 1):
    icon_path = os.path.join(ICONS, c["id"] + ".webp")
    splash_path = os.path.join(SPLASH, c["id"] + ".webp")
    if c["npc"]:
        continue
    pid = BASE_ID.get(c["name"])
    if not pid:
        # generic placeholder, same size as downloaded icons
        placeholder(c["name"]).resize((160, 160), Image.LANCZOS).save(icon_path, "WEBP", quality=86)
        continue
    try:
        if not os.path.exists(icon_path):
            save_icon(c, fetch("https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/icon/character/%s.png" % pid))
        if not os.path.exists(splash_path):
            save_splash(c, fetch("https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/image/character_portrait/%s.png" % pid))
    except Exception as e:
        print("image fail", c["name"], e)
        try:
            proxy = "https://wsrv.nl/?url=" + urllib.parse.quote(
                "cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/icon/character/%s.png" % pid, safe="/") + "&w=160&output=webp"
            save_icon(c, fetch(proxy))
        except Exception:
            placeholder(c["name"]).resize((160, 160), Image.LANCZOS).save(icon_path, "WEBP", quality=86)
    if i % 20 == 0:
        print(" ", i)

# NPC images
NPC_FILES = {
    "Pom-Pom": "NPC Pom-Pom.png", "Huaiyan": "NPC Huaiyan.png", "Svarog": "NPC Svarog.png",
    "Cocolia": "NPC Cocolia.png", "Tail": "NPC Tail Normal.png", "Mr. Reca": "NPC Mr. Reca.png",
    "Screwllum": "NPC Screwllum.png", "Elio": None, "Kuchiba": "NPC Kuchiba.png",
}
print("downloading npc portraits...")
for c in chars:
    if not c["npc"]:
        continue
    icon_path = os.path.join(ICONS, c["id"] + ".webp")
    splash_path = os.path.join(SPLASH, c["id"] + ".webp")
    fname = NPC_FILES.get(c["name"])
    if not fname:
        placeholder(c["name"]).convert("RGBA").resize((160, 160), Image.LANCZOS).save(icon_path, "WEBP", quality=86)
        continue
    try:
        # resolve file url via imageinfo, then fetch through an image proxy (static.wikia blocks scripted hits)
        u = ("https://honkai-star-rail.fandom.com/api.php?action=query&titles=" +
             urllib.parse.quote("File:" + fname) +
             "&prop=imageinfo&iiprop=url&format=json&formatversion=2")
        j = json.loads(fetch(u).decode("utf-8"))
        url = j["query"]["pages"][0]["imageinfo"][0]["url"]
        bare = url.split("?")[0].replace("https://", "")
        proxy = "https://wsrv.nl/?url=" + urllib.parse.quote(bare, safe="/") + "&w=640&output=webp"
        data = fetch(proxy)
        im = Image.open(BytesIO(data)).convert("RGBA")
        im.thumbnail((640, 640), Image.LANCZOS)
        im.save(splash_path, "WEBP", quality=82, method=6)
        # square crop biased to the head
        w, h = im.size
        side = min(w, h)
        left = (w - side) // 2
        top = max(0, int(h * 0.03))
        if top + side > h:
            top = h - side
        crop = im.crop((left, top, left + side, top + side)).resize((160, 160), Image.LANCZOS)
        crop.save(icon_path, "WEBP", quality=86, method=6)
        print("  npc ok", c["name"], im.size)
    except Exception as e:
        print("  npc fail", c["name"], e)
        placeholder(c["name"]).convert("RGBA").resize((160, 160), Image.LANCZOS).save(icon_path, "WEBP", quality=86)

# any missing icon -> placeholder
for c in chars:
    p = os.path.join(ICONS, c["id"] + ".webp")
    if not os.path.exists(p):
        placeholder(c["name"]).convert("RGBA").resize((160, 160), Image.LANCZOS).save(p, "WEBP", quality=86)

# ---------------------------------------------------------------- stats
by_id = {c["id"]: c for c in chars}
playable = [c for c in chars if not c["npc"]]
npc_ids = {c["id"] for c in chars if c["npc"]}

out_by = defaultdict(list)   # (from,to) -> quotes
in_by = defaultdict(list)
for q in quotes:
    for t in q["to"]:
        out_by[(q["from"], t)].append(q)
        in_by[(t, q["from"])].append(q)

pair_keys = set()
for (a, b) in out_by:
    if a in npc_ids or b in npc_ids:
        continue
    pair_keys.add(tuple(sorted((a, b))))

# The Trailblazer is in the web, but left out of the headline counts: almost
# everyone has an "About the Trailblazer" line, which would flatten the stats.
trail_id = name_to_id.get("Trailblazer")
stat_pairs = {p for p in pair_keys if trail_id not in p}
mutual = [p for p in stat_pairs if (p[0], p[1]) in out_by and (p[1], p[0]) in out_by]
oneway = [p for p in stat_pairs if not ((p[0], p[1]) in out_by and (p[1], p[0]) in out_by)]

stat_chars = [c for c in playable if c["id"] != trail_id]
most_in = max(stat_chars, key=lambda c: (len({qq["from"] for qq in quotes if c["id"] in qq["to"] and qq["from"] not in npc_ids}), c["name"]))
most_out = max(stat_chars, key=lambda c: (len({t for qq in quotes if qq["from"] == c["id"] for t in qq["to"] if t not in npc_ids}), c["name"]))

def pair_lines(a, b):
    return len(out_by.get((a, b), [])), len(out_by.get((b, a), []))

best_pair = max(mutual, key=lambda p: (pair_lines(p[0], p[1])[0] + pair_lines(p[0], p[1])[1], p))
one_sided = []
for p in oneway:
    a, b = p
    fa, fb = pair_lines(a, b)
    if fa == 0:
        a, b, fa, fb = b, a, fb, fa
    one_sided.append((fa, fb, a, b))
one_sided.sort(key=lambda x: (-x[0], x[2]))
off_web = [c for c in playable
           if not any(q["from"] == c["id"] for q in quotes) and not any(c["id"] in q["to"] for q in quotes)]
npc_edges = sum(1 for q in quotes for t in q["to"] if t in npc_ids)

data = {
    "worlds": [{"id": w, "name": n} for w, n in WORLDS],
    "characters": chars,
    "quotes": quotes,
    "stats": {
        "playable": len(playable),
        "voiceLines": len(quotes),
        "mutual": len(mutual),
        "oneway": len(oneway),
        "npcs": len(NPCS),
        "npcMentions": npc_edges,
        "audioLines": sum(1 for q in quotes if q["audio"]),
    },
    "highlights": {
        "mostIn": {"id": most_in["id"],
                   "count": len({qq["from"] for qq in quotes if most_in["id"] in qq["to"] and qq["from"] not in npc_ids})},
        "mostOut": {"id": most_out["id"],
                    "count": len({t for qq in quotes if qq["from"] == most_out["id"] for t in qq["to"] if t not in npc_ids})},
        "bestPair": {"a": by_id[best_pair[0]]["id"], "b": by_id[best_pair[1]]["id"],
                     "aCount": pair_lines(best_pair[0], best_pair[1])[0],
                     "bCount": pair_lines(best_pair[0], best_pair[1])[1]},
        "oneSided": [{"a": by_id[a]["id"], "b": by_id[b]["id"], "count": fa}
                     for fa, fb, a, b in one_sided[:3]],
        "offWeb": [c["id"] for c in off_web],
    },
}

with open(os.path.join(HERE, "data.js"), "w", encoding="utf-8") as f:
    f.write("window.STARRAIL_TIES = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("\nSTATS", json.dumps(data["stats"], ensure_ascii=False))
print("HIGHLIGHTS", json.dumps(data["highlights"], ensure_ascii=False))
print("most in", most_in["name"], data["highlights"]["mostIn"]["count"])
print("most out", most_out["name"], data["highlights"]["mostOut"]["count"])
print("best pair", by_id[best_pair[0]]["name"], by_id[best_pair[1]]["name"], pair_lines(*best_pair))
print("off web", [by_id[i]["name"] for i in data["highlights"]["offWeb"]])
print("npc edges", npc_edges)
print("wrote data.js")
