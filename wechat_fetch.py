import argparse
import json
import re
from datetime import datetime
from dataclasses import dataclass, asdict
from html import unescape

import httpx
from bs4 import BeautifulSoup


@dataclass
class WechatArticle:
    url: str
    title: str
    author: str
    publish_time: str
    publish_time_source: str
    digest: str
    content_text: str


def _extract_js_var(html: str, var_name: str) -> str:
    pattern = re.compile(rf"\\b{re.escape(var_name)}\\s*=\\s*['\"](.*?)['\"]", re.S)
    m = pattern.search(html)
    return unescape(m.group(1)).strip() if m else ""


def _extract_js_number(html: str, var_name: str) -> str:
    pattern = re.compile(rf"\\b{re.escape(var_name)}\\s*=\\s*(\\d+)", re.S)
    m = pattern.search(html)
    return m.group(1).strip() if m else ""


def _to_iso8601_from_unix(ts_str: str) -> str:
    if not ts_str:
        return ""
    try:
        ts = int(ts_str)
        return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return ""


def fetch_wechat_article(url: str, timeout: float = 20.0) -> WechatArticle:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }

    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
        resp = client.get(url)
        resp.raise_for_status()
        html = resp.text
        final_url = str(resp.url)

    soup = BeautifulSoup(html, "html.parser")

    title = ""
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    if not title:
        t = soup.find("title")
        title = t.get_text(strip=True) if t else ""

    digest = ""
    og_desc = soup.find("meta", attrs={"property": "og:description"})
    if og_desc and og_desc.get("content"):
        digest = og_desc["content"].strip()

    author = _extract_js_var(html, "nickname")
    if not author:
        author = _extract_js_var(html, "user_name")

    publish_time = _extract_js_var(html, "publish_time")
    publish_time_source = "js:publish_time" if publish_time else ""
    if not publish_time:
        publish_time = _to_iso8601_from_unix(_extract_js_number(html, "ct"))
        if publish_time:
            publish_time_source = "js:ct"
    if not publish_time:
        meta_time = (
            soup.find("meta", attrs={"property": "article:published_time"})
            or soup.find("meta", attrs={"name": "publish_time"})
            or soup.find("meta", attrs={"itemprop": "datePublished"})
        )
        if meta_time and meta_time.get("content"):
            publish_time = meta_time["content"].strip()
            publish_time_source = "meta"
    if not publish_time:
        # Fallback: infer from plausible 10-digit unix timestamps in HTML.
        candidates = []
        for ts in re.findall(r"(?<!\\d)(1[6-9]\\d{8})(?!\\d)", html):
            iso = _to_iso8601_from_unix(ts)
            if iso:
                candidates.append(iso)
        if candidates:
            publish_time = min(candidates)
            publish_time_source = "inferred"

    content_div = soup.find(id="js_content")
    content_text = ""
    if content_div:
        for bad in content_div.find_all(["script", "style"]):
            bad.decompose()
        content_text = "\n".join(
            line.strip() for line in content_div.get_text("\n").splitlines() if line.strip()
        )

    return WechatArticle(
        url=final_url,
        title=title,
        author=author,
        publish_time=publish_time,
        publish_time_source=publish_time_source,
        digest=digest,
        content_text=content_text,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch public WeChat article from URL")
    parser.add_argument("url", help="WeChat article URL")
    parser.add_argument("--json", action="store_true", help="Print JSON")
    args = parser.parse_args()

    article = fetch_wechat_article(args.url)
    if args.json:
        print(json.dumps(asdict(article), ensure_ascii=False, indent=2))
    else:
        print(f"title: {article.title}")
        print(f"author: {article.author}")
        print(f"publish_time: {article.publish_time}")
        print(f"publish_time_source: {article.publish_time_source}")
        print(f"digest: {article.digest}")
        print("content_preview:")
        print(article.content_text[:1200])


if __name__ == "__main__":
    main()
