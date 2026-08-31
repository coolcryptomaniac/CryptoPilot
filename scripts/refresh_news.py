#!/usr/bin/env python3
import json, re, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SOURCES = [
    ("coindesk", "CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("cointelegraph", "Cointelegraph", "https://cointelegraph.com/rss"),
    ("investing", "Investing.com", "https://www.investing.com/rss/news_301.rss"),
]
UA = "CryptoPilot/2.1 GitHub news refresher (+https://github.com/coolcryptomaniac/CryptoPilot)"

def text(node, name):
    child = node.find(name)
    if child is not None and child.text:
        return re.sub(r"\s+", " ", child.text).strip()
    for c in node:
        if c.tag.split('}')[-1].lower() == name.lower() and c.text:
            return re.sub(r"\s+", " ", c.text).strip()
    return ""

def fetch(source_id, source_name, url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read()
        root = ET.fromstring(raw)
        items = []
        for item in root.iter():
            if item.tag.split('}')[-1].lower() != 'item':
                continue
            title = text(item, 'title')
            link = text(item, 'link') or text(item, 'guid')
            published = text(item, 'pubDate') or text(item, 'date')
            if title and link:
                items.append({"source": source_name, "sourceId": source_id, "title": title[:240], "url": link, "published": published})
            if len(items) >= 24:
                break
        return {"source": source_id, "ok": bool(items), "count": len(items), "error": None if items else "No RSS items parsed"}, items
    except Exception as e:
        return {"source": source_id, "ok": False, "count": 0, "error": str(e)[:180]}, []

def sort_key(item):
    # RSS date formats vary; source order is acceptable when parsing fails.
    return item.get('published') or ''

def main():
    statuses, items = [], []
    for source in SOURCES:
        status, news = fetch(*source)
        statuses.append(status)
        items.extend(news)
    # Deduplicate identical URLs/titles and retain a compact public feed.
    seen, out = set(), []
    for item in items:
        key = item['url'].strip().lower() or item['title'].strip().lower()
        if key in seen:
            continue
        seen.add(key); out.append(item)
    out = out[:60]
    payload = {
        "items": out,
        "sources": statuses,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "mode": "github-actions-rss-cache",
        "copyright": "Headlines and publisher links only; full articles remain with their publishers."
    }
    dest = Path('data/news.json')
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({"items": len(out), "sources": statuses}, indent=2))

if __name__ == '__main__':
    main()
