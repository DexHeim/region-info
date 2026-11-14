"""Import the public Region Wiki facts into the static reference site."""

import argparse
import concurrent.futures
import gzip
import http.client
import json
import html
import os
import re
import time
import threading
import unicodedata
import urllib.parse
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "spreadsheet-work" / "wiki-source"
ORIGIN = "https://wiki.region.game"
SECTIONS = {
    "vehicles": "Транспорт",
    "items": "Предметы",
    "clothes": "Одежда",
    "estate": "Недвижимость",
    "business": "Бизнесы",
    "appearance": "Внешность",
    "map": "Карта",
    "cases": "Кейсы",
    "animations": "Анимации",
    "season": "Сезонный пропуск",
    "achievements": "Достижения",
    "levels": "Уровни",
    "factions": "Фракции",
    "rentals": "Прокат и парковки",
    "articles": "Механики",
    "updates": "Обновления",
}
CATEGORIES = {
    "start": "Начало игры", "jobs": "Работы", "hobby": "Хобби",
    "factions": "Фракции", "families": "Семьи", "crime": "Криминал",
    "vehicles": "Транспорт", "guides": "Гайды",
    "economy": "Деньги и имущество", "systems": "Системы",
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
CONNECTIONS = threading.local()
WORKERS = 8
USE_CACHE = True
FUEL_GRADES = {60: 92, 80: 95, 100: 100}


class Node:
    def __init__(self, tag="root", attrs=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children = []

    def find_all(self, tag=None, **attrs):
        found = []
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and all(
                    child.attrs.get(key) == value for key, value in attrs.items()
                ):
                    found.append(child)
                found.extend(child.find_all(tag, **attrs))
        return found

    def find(self, tag=None, **attrs):
        return next(iter(self.find_all(tag, **attrs)), None)

    def text(self):
        return "".join(child.text() if isinstance(child, Node) else child for child in self.children)


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def clean(value):
    return re.sub(r"\s+", " ", value).strip().replace("\ue000", " RC")


def decode_astro(value):
    if isinstance(value, dict):
        return {key: decode_astro(item) for key, item in value.items()}
    if isinstance(value, list) and value and isinstance(value[0], int):
        kind = value[0]
        item = value[1] if len(value) > 1 else None
        if kind == 0:
            return decode_astro(item)
        if kind == 1:
            return [decode_astro(child) for child in item]
        return item
    return value


def fetch(path):
    cache = CACHE / ((path.strip("/") or "home").replace("/", "__") + ".html")
    if USE_CACHE and cache.exists():
        return path, cache.read_text(encoding="utf-8")
    for attempt in range(3):
        try:
            connection = getattr(CONNECTIONS, "wiki", None)
            if connection is None:
                connection = http.client.HTTPSConnection("wiki.region.game", timeout=45)
                CONNECTIONS.wiki = connection
            connection.request("GET", path, headers={"User-Agent": "RegionInfo reference importer/1.0", "Accept-Encoding": "gzip"})
            response = connection.getresponse()
            body = response.read()
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")
            if response.getheader("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            source = body.decode("utf-8")
            cache.write_text(source, encoding="utf-8")
            return path, source
        except Exception:
            if getattr(CONNECTIONS, "wiki", None):
                CONNECTIONS.wiki.close()
                CONNECTIONS.wiki = None
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def fetch_many(paths):
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return dict(pool.map(fetch, sorted(set(paths))))


def get_props(doc):
    return [
        {"component": node.attrs.get("component-url", ""),
         "data": decode_astro(json.loads(node.attrs["props"]))}
        for node in doc.find_all("astro-island") if node.attrs.get("props")
    ]


def internal_links(doc):
    paths = set()
    for node in doc.find_all("a"):
        url = urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN, node.attrs.get("href", "")))
        if url.netloc == "wiki.region.game" and url.path.endswith("/"):
            paths.add(url.path)
    return paths


DROP = {"script", "style", "svg", "noscript", "dialog", "input", "select", "template"}
KEEP = {"p", "h2", "h3", "h4", "h5", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "dl", "dt", "dd", "strong", "em", "b", "i", "a", "code", "kbd", "figure", "figcaption", "img", "details", "summary", "br", "hr", "video", "source", "section", "div", "span", "aside"}
CONTENT_CLASSES = {
    "hero": "imported-hero", "pp-hero": "imported-hero",
    "stage": "imported-stage", "pp-stage": "imported-stage",
    "info": "imported-info", "pp-info": "imported-info",
    "swatches": "gallery", "where": "shop-list", "where-row": "shop-row",
    "cl-shops": "shop-logos", "kpis": "imported-kpis", "kpi": "imported-kpi",
    "groups": "imported-groups",
    "pp-stats": "detail-metrics", "pp-badge": "detail-badge", "pp-photo": "detail-photo",
    "pp-cat": "detail-category", "pp-rows": "detail-rows", "pp-sec": "detail-section",
    "pg-head": "detail-heading", "is-price": "metric-price", "is-text": "metric-text",
    "pc-fallback": "detail-fallback", "ic-fallback": "detail-fallback",
    "ic-card": "related-card", "pc-card": "related-card--property", "cl-card": "related-card--clothes",
    "vc-card": "related-card--vehicle", "ic-stage": "related-media", "pc-photo": "related-media",
    "cl-stage": "related-media", "vc-stage": "related-media", "is-contain": "related-media--contain",
    "ic-body": "related-body", "cl-body": "related-body", "ic-cat": "related-category",
    "cl-meta": "related-category", "ic-name": "related-title", "cl-name": "related-title",
    "pc-head": "related-head", "pc-price": "related-price", "cl-price": "related-price",
    "vc-price": "related-price", "pc-foot": "related-stats", "cl-foot": "related-foot",
    "ic-rar": "related-badge", "cl-rar": "related-badge", "pc-blip": "related-blip",
    "pc-sub": "related-description", "rt-img": "reward-image", "rt-video": "reward-video",
    "rt-glyph": "reward-glyph", "rt-sign": "reward-sign", "vc-brandmark": "brand-watermark",
    "vc-car": "vehicle-image", "flag": "country-flag", "vc-head": "related-body",
    "vc-names": "related-names", "vc-brand": "related-category", "vc-specs": "related-stats",
    "vc-tags": "related-tags", "vc-class": "related-badge", "am-card": "article-link",
    "am-cat": "article-link-category", "am-title": "article-link-title", "am-desc": "article-link-summary",
    "am-go": "article-link-arrow", "lv-unlocks": "detail-unlocks", "lv-nav": "detail-pager",
    "sp-tracks": "reward-tracks", "sp-track": "reward-track", "sp-stars": "detail-stars",
    "cl-colors": "detail-colors", "cl-li": "related-clothing", "cl-note": "related-description",
    "fr-n": "rank-number", "fr-name": "rank-name", "fr-pay": "rank-pay",
    "pp-floorbar": "floor-tabs", "pp-flatlist": "flat-list", "pp-flat-name": "flat-name",
    "pp-flat-meta": "flat-meta", "pp-flat-lvl": "flat-level", "pp-flat-price": "flat-price",
    "pp-flat-go": "flat-arrow", "sp-products": "pass-products", "sp-product": "pass-product",
    "sp-prices": "pass-prices", "sp-places": "leaderboard-prizes", "sp-place": "leaderboard-prize",
    "sp-tasks": "season-tasks", "vc-table-wrap": "detail-table-wrap", "vc-table": "detail-table",
    "sp-note": "detail-note",
    "stat-wrap": "article-stat-wrap", "stat-grid": "article-stats", "stat-v": "article-stat-value",
    "callout": "article-callout", "callout-title": "callout-title", "callout-body": "callout-body",
    "steps": "article-steps", "kbds": "key-group", "kbd": "key-cap",
    "photo": "article-photo", "photo-cap": "image-caption", "scr": "article-screenshot",
    "scr-frame": "screenshot-frame", "scr-marks": "screen-annotations", "scr-mark": "screen-annotation",
    "scr-cap": "image-caption",
}


def safe_url(url):
    url = urllib.parse.urljoin(ORIGIN + "/", url)
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in {"http", "https"}:
        return ""
    return url


def serialize(node):
    if isinstance(node, str):
        return html.escape(node.replace("\ue000", " RC"))
    classes = (node.attrs.get("class") or "").split()
    if node.tag in DROP or ("hidden" in node.attrs and "pp-flatlist" not in classes) or node.attrs.get("aria-hidden") == "true":
        return ""
    if "sr-only" in classes or node.tag in {"nav", "footer", "header"} or (node.tag == "aside" and "callout" not in classes):
        return ""
    if node.tag == "astro-island":
        return ""
    if node.tag == "h1":
        return ""
    inner = " ".join(serialize(child) for child in node.children)
    if node.tag not in KEEP:
        return inner
    attrs = {}
    mapped = list(dict.fromkeys(CONTENT_CLASSES[value] for value in classes if value in CONTENT_CLASSES))
    if any(value in classes for value in ("pc-grid", "ic-grid", "cl-grid", "vc-grid")):
        mapped.append("related-grid")
    if "vc-grid" in classes:
        mapped.append("related-grid--vehicles")
    if "cl-grid" in classes:
        mapped.append("related-grid--clothes")
    if mapped:
        attrs["class"] = " ".join(mapped)
    tone = re.search(r"--tone\s*:\s*(#[0-9a-fA-F]{3,8})(?:\s*[;} ]|$)", node.attrs.get("style", ""))
    if tone:
        attrs["style"] = f"--tone:{tone.group(1)}"
    if "pp-flatlist" in classes and "hidden" in node.attrs:
        attrs["hidden"] = ""
    if "scr-mark" in classes:
        dot = next((child for child in node.find_all("span") if "scr-dot" in (child.attrs.get("class") or "").split()), None)
        coordinates = re.search(r"--x:([\d.]+);\s*--y:([\d.]+)", dot.attrs.get("style", "")) if dot else None
        if coordinates and all(0 <= float(value) <= 100 for value in coordinates.groups()):
            attrs["data-x"], attrs["data-y"] = coordinates.groups()
    if node.tag == "div" and "data-thumbs" in node.attrs:
        attrs["class"] = "gallery"
    if node.attrs.get("id"):
        attrs["data-anchor"] = node.attrs["id"]
    if node.tag == "a":
        url = node.attrs.get("href", "")
        attrs["href"] = url if url.startswith("#") else safe_url(url)
    if node.tag in {"img", "video", "source"}:
        src = node.attrs.get("src")
        if not src:
            return ""
        attrs["src"] = safe_url(src)
        if node.tag == "img":
            attrs.update({"alt": node.attrs.get("alt", ""), "loading": "lazy"})
            if node.attrs.get("data-full"):
                attrs["data-full"] = safe_url(node.attrs["data-full"])
        if node.tag == "video":
            attrs.update({"controls": "", "muted": "", "loop": "", "preload": "none"})
            if node.attrs.get("poster"):
                attrs["poster"] = safe_url(node.attrs["poster"])
    for key in ("colspan", "rowspan"):
        if node.attrs.get(key):
            attrs[key] = node.attrs[key]
    if not inner.strip() and node.tag not in VOID and node.tag != "video":
        return ""
    attributes = "".join(f' {key}="{html.escape(value, quote=True)}"' for key, value in attrs.items())
    start = f"<{node.tag}{attributes}>"
    return start if node.tag in VOID else start + inner + f"</{node.tag}>"


def text_only(node):
    if isinstance(node, str):
        return node
    if node.tag in DROP or "hidden" in node.attrs or node.attrs.get("aria-hidden") == "true":
        return ""
    return " ".join(text_only(child) for child in node.children)


def article_summary(doc):
    article = doc.find("article")
    if article:
        header = article.find("header")
        paragraph = header.find("p") if header else None
        if paragraph:
            return clean(text_only(paragraph))
    meta = doc.find("meta", name="description")
    return meta.attrs.get("content", "") if meta else ""


def extract_document(path, source):
    doc = Document(source).root
    main = doc.find("main") or doc
    title = main.find("h1") or doc.find("title")
    article = main.find("article")
    content = main
    if article:
        content = next((node for node in article.find_all("div") if "prose-wiki" in (node.attrs.get("class") or "").split()), article)
    else:
        content = next((node for node in main.find_all("div") if "data-pagefind-body" in node.attrs and node.attrs.get("class") != "sr-only"), main)
    metadata = next((node.attrs for node in main.find_all("span") if "data-sk-kind" in node.attrs), {})
    headings = [{"id": node.attrs.get("id", ""), "title": clean(text_only(node))} for node in content.find_all("h2")]
    return {
        "path": path,
        "title": content.attrs.get("data-pf-title") or (clean(text_only(title)).removesuffix(" — Region Wiki") if title else path),
        "summary": article_summary(doc),
        "image": safe_url(metadata["data-sk-image"]) if metadata.get("data-sk-image") else "",
        "html": serialize(content),
        "headings": headings,
        "text": clean(text_only(content)),
        "widgets": get_props(doc),
    }, internal_links(content)


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(temporary, path)


def synchronize_legacy_cars(vehicles):
    path = ROOT / "data" / "cars.json"
    cars = json.loads(path.read_text(encoding="utf-8"))

    def name_key(value):
        return re.sub(r"[\W_]", "", unicodedata.normalize("NFKD", value).casefold())

    names = {}
    models = {vehicle["model"]: vehicle for vehicle in vehicles}
    for vehicle in vehicles:
        key = name_key(vehicle["brand"] + " " + vehicle["name"])
        names.setdefault(key, []).append(vehicle)
    fields = {
        "fuel_l": "fuel_capacity_l", "trunk_kg": "trunk_kg",
        "max_speed_kmh": "max_speed_kmh", "acceleration_0_100_s": "t100_s",
        "price_rub": "price_dealer",
    }
    for car in cars:
        known_model = models.get(car.get("wiki_model"))
        variants = [known_model] if known_model else names.get(name_key(car["name"]), [])
        dealer_models = [vehicle for vehicle in variants if vehicle["price_dealer"] is not None]
        candidates = dealer_models or variants
        if len(candidates) != 1:
            raise ValueError(f"Cannot uniquely match legacy vehicle {car['name']!r}")
        vehicle = candidates[0]
        car["wiki_model"] = vehicle["model"]
        for target, source in fields.items():
            car[target] = vehicle[source]
        if vehicle["price_dealer"] is None:
            car["active"] = False
        if vehicle["fuel_type"] == "Gas":
            car["fuel_type"] = f"АИ-{FUEL_GRADES[vehicle['fuel_grade']]}"
            car["fuel_unit"] = "л"
        elif vehicle["fuel_type"] == "Electric":
            car["fuel_type"] = "Электро"
            car["fuel_unit"] = "кВт·ч"
        else:
            car["fuel_type"] = "Дизель"
            car["fuel_unit"] = "л"
        if "state_price_rub" in car:
            car["state_price_rub"] = round(vehicle["price_dealer"] * .7) if vehicle["price_dealer"] is not None else None
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(cars, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def vehicle_brands(source, vehicles):
    models = {vehicle["model"]: vehicle["brand_slug"] for vehicle in vehicles}
    brands = {}
    for card in Document(source).root.find_all():
        if "vc-card" not in card.attrs.get("class", "").split():
            continue
        link = card.find("a")
        model = link.attrs.get("href", "").strip("/").split("/")[-1] if link else ""
        if model not in models:
            continue
        images = card.find_all("img")
        logo = next((image.attrs["src"] for image in images if "vc-brandmark" in image.attrs.get("class", "").split()), "")
        flag = next((image for image in images if "flag" in image.attrs.get("class", "").split()), None)
        brands[models[model]] = {
            "logo": urllib.parse.urljoin(ORIGIN, logo) if logo else "",
            "flag": urllib.parse.urljoin(ORIGIN, flag.attrs["src"]) if flag else "",
            "country": flag.attrs.get("alt", "") if flag else "",
        }
    return dict(sorted(brands.items()))


def main():
    global USE_CACHE
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true")
    parser.add_argument("--refresh", action="store_true", help="Fetch fresh pages instead of reusing the local HTML cache")
    args = parser.parse_args()
    USE_CACHE = not args.refresh
    CACHE.mkdir(parents=True, exist_ok=True)
    sources = fetch_many(["/"] + [f"/{section}/" for section in SECTIONS])
    catalog_data = {}
    for path, source in sources.items():
        doc = Document(source).root
        props = get_props(doc)
        section = path.strip("/") or "home"
        catalog_data[section] = props
        print(section, [(item["component"].split("/")[-1], {
            key: f"{type(value).__name__}({len(value)})" if isinstance(value, (list, dict)) else value
            for key, value in item["data"].items()
        }) for item in props], flush=True)
    (CACHE / "catalog-props.json").write_text(json.dumps(catalog_data, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.inspect:
        return
    for section in ("clothes", "appearance"):
        _, content = fetch(f"/{section}/catalog.json")
        catalog_data[section][0]["data"]["rows"] = json.loads(content)
    pending = set()
    for path, source in sources.items():
        pending.update(internal_links(Document(source).root))
    for islands in catalog_data.values():
        for island in islands:
            for row in island["data"].get("rows", []):
                if isinstance(row, dict) and row.get("href"):
                    pending.add(urllib.parse.urlsplit(row["href"]).path)
    clothes = catalog_data["clothes"][0]["data"]["rows"]
    pending.update(f"/clothes/{row[0]}/" for row in clothes)
    pending = {path for path in pending if len(path.strip("/").split("/")) > 1 and path != "/vehicles/compare/"}
    sections = {key: {"title": title, "data": catalog_data[key], "description": article_summary(Document(sources[f"/{key}/"]).root), "documents": {}} for key, title in SECTIONS.items()}
    seen = set(sources)
    failed = {}
    total = 0
    while pending:
        batch = sorted(pending - seen)
        pending = set()
        if not batch:
            break
        print(f"Importing {len(batch)} detail pages", flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(fetch, path): path for path in batch}
            for future in concurrent.futures.as_completed(futures):
                path = futures[future]
                seen.add(path)
                try:
                    _, source = future.result()
                    document, links = extract_document(path, source)
                    section = path.strip("/").split("/")[0]
                    if section not in sections:
                        continue
                    sections[section]["documents"][path] = document
                    pending.update(link for link in links if len(link.strip("/").split("/")) > 1 and link not in seen and link != "/vehicles/compare/")
                    total += 1
                    if total % 100 == 0:
                        print(f"Imported {total} pages", flush=True)
                except Exception as error:
                    failed[path] = str(error)
                    print(f"FAILED {path}: {error}", flush=True)
    if failed:
        raise RuntimeError(f"{len(failed)} pages failed. The existing data has been preserved. Retry the import to complete it.")
    output = ROOT / "data" / "wiki"
    page_index = []
    for key, section in sections.items():
        section["documents"] = dict(sorted(section["documents"].items()))
        documents = list(section["documents"].items())
        for start in range(0, len(documents), 40):
            chunk_name = f"{key}-{start // 40}.json"
            chunk = {}
            for path, document in documents[start:start + 40]:
                document.pop("text", None)
                chunk[path] = document
                page_index.append({
                    "path": path, "title": document["title"], "summary": document["summary"],
                    "section": key, "image": document["image"], "chunk": chunk_name,
                })
            dump(output / "details" / chunk_name, chunk)
        payload = {"title": section["title"], "data": section["data"], "description": section["description"]}
        if key == "vehicles":
            payload["brands"] = vehicle_brands(sources["/vehicles/"], section["data"][0]["data"]["vehicles"])
        if key == "season":
            header = next((node for node in Document(sources["/season/"]).root.find_all("section") if "pg-head" in (node.attrs.get("class") or "").split()), None)
            payload["headerHtml"] = serialize(header) if header else ""
            payload["seasonTitle"] = clean(text_only(header.find("h1"))) if header and header.find("h1") else ""
        dump(output / f"{key}.json", payload)
    index = {
        "source": ORIGIN,
        "importedAt": datetime.now(timezone.utc).isoformat(),
        "categories": CATEGORIES,
        "sections": [{"id": key, "title": section["title"], "documents": len(section["documents"])} for key, section in sections.items()],
        "pages": page_index,
        "failed": failed,
    }
    dump(output / "index.json", index)
    synchronize_legacy_cars(catalog_data["vehicles"][0]["data"]["vehicles"])
    print(json.dumps({"pages": total, "failed": failed}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
