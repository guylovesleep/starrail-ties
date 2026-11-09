# -*- coding: utf-8 -*-
"""Scrape Honkai: Star Rail 'About' voice lines from the Fandom wiki."""
import json, os, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://honkai-star-rail.fandom.com/api.php"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
CACHE = os.path.join(os.path.dirname(__file__), "cache")
os.makedirs(CACHE, exist_ok=True)


def api(params, cache_name=None):
    params = dict(params)
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = BASE + "?" + urllib.parse.urlencode(params)
    path = os.path.join(CACHE, (cache_name or re.sub(r"[^a-zA-Z0-9_-]", "_", url)) + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                data = json.loads(r.read().decode("utf-8"))
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            return data
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)


def clean(text):
    if not text:
        return ""
    text = text.replace("<br/>", "\n").replace("<br />", "\n").replace("<br>", "\n")
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[https?://[^\s\]]+\s+([^\]]+)\]", r"\1", text)
    text = re.sub(r"\[https?://[^\]]+\]", "", text)
    text = text.replace("'''", "").replace("''", "")
    text = re.sub(r"<[^>]+>", "", text)
    for a, b in [("&mdash;", "—"), ("&ndash;", "–"), ("&quot;", '"'), ("&apos;", "'"),
                 ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " "), ("&#39;", "'")]:
        text = text.replace(a, b)
    text = text.replace("\\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main():
    cat = api({"action": "query", "list": "categorymembers", "cmtitle": "Category:Playable Characters",
               "cmlimit": "500"}, "playable")
    pages = [m["title"] for m in cat["query"]["categorymembers"]]
    pages.sort()
    print("playable:", len(pages))

    raw = {}
    def fetch(page):
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", page)
        return page, api({"action": "parse", "page": page + "/Voice-Overs", "prop": "wikitext"}, "vo_" + slug)

    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(fetch, p) for p in pages]
        for i, f in enumerate(as_completed(futs), 1):
            page, d = f.result()
            try:
                raw[page] = d["parse"]["wikitext"]
            except Exception:
                print("MISS", page, str(d)[:120])
            if i % 20 == 0:
                print("fetched", i)

    quotes = []
    for page in pages:
        text = raw.get(page, "")
        if not text:
            continue
        # Each About Others block begins with |vo_07_XX_title
        for m in re.finditer(r"\|vo_07_(\d+)_title\s*=\s*([^\n]*)", text):
            start = m.start()
            nxt_match = re.compile(r"\n\|vo_07_\d+_title").search(text, start + 5)
            nxt = nxt_match.start() if nxt_match else -1
            end = nxt if nxt != -1 else text.find("\n<!--", start)
            if end == -1:
                end = text.find("\n}}", start)
            if end == -1:
                end = start + 2500
            block = text[start:end]
            def field(k):
                mm = re.search(r"\|" + re.escape(k) + r"\s*=\s*([^\n]*)", block)
                return mm.group(1).strip() if mm else ""
            title = clean(m.group(2))
            body = clean(field("vo_07_%s_tx" % m.group(1)))
            mentions = [clean(x).strip() for x in field("vo_07_%s_mention" % m.group(1)).split(",") if x.strip()]
            audio = field("vo_07_%s_file" % m.group(1))
            if not body:
                continue
            if not mentions:
                mentions = [clean(x) for x in re.findall(r"\[\[([^\]|]+)", m.group(2))]
            mentions = [x for x in mentions if x and x.lower() != "trailblazer" or x == "Trailblazer"]
            quotes.append({"from": page, "to": mentions, "title": title, "text": body, "file": audio})

    out = os.path.join(os.path.dirname(__file__), "raw_quotes.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"pages": pages, "quotes": quotes}, f, ensure_ascii=False, indent=1)
    print("quotes", len(quotes), "mentions", len({x for q in quotes for x in q["to"]}))
    print("wrote", out)


if __name__ == "__main__":
    main()
