import argparse
import hashlib
import os
import re
import time
from datetime import datetime
from typing import Optional, List
from urllib.parse import parse_qsl, urlencode, urlparse, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup
from notion_client import Client

from openrouter_summary import summarize_with_openrouter
from wechat_fetch import fetch_wechat_article


def _rt(text: str):
    return [{"type": "text", "text": {"content": text[:1800]}}]


def _paragraph(text: str):
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rt(text)}}


def _bulleted_nested(text: str, children: Optional[List[dict]] = None) -> dict:
    payload = {"rich_text": _rt(text)}
    if children:
        payload["children"] = children
    return {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": payload}


def _outline_node_to_block(node: dict, depth: int = 1) -> Optional[dict]:
    text = str(node.get("text", "")).strip()
    if not text:
        return None
    if depth >= 3:
        return _bulleted_nested(text)
    raw_children = node.get("children", [])
    child_blocks: List[dict] = []
    if isinstance(raw_children, list):
        for child in raw_children:
            if isinstance(child, dict):
                cb = _outline_node_to_block(child, depth=depth + 1)
                if cb:
                    child_blocks.append(cb)
    return _bulleted_nested(text, child_blocks)


def _extract_plain_text_from_block(block: dict) -> str:
    btype = block.get("type")
    if not btype:
        return ""
    payload = block.get(btype, {})
    parts = payload.get("rich_text", [])
    return "".join(p.get("plain_text", "") for p in parts if isinstance(p, dict))


def _rt_prop(text: str) -> dict:
    return {"rich_text": [{"type": "text", "text": {"content": text[:1900]}}]}


def _title_prop(text: str) -> dict:
    return {"title": [{"type": "text", "text": {"content": text[:200]}}]}


def normalize_source_url(url: str) -> str:
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    scheme = parts.scheme.lower() or "https"
    path = parts.path or "/"

    pairs = parse_qsl(parts.query, keep_blank_values=False)
    keep = []
    for k, v in pairs:
        lk = k.lower()
        if lk.startswith("utm_") or lk in {"scene", "from", "spm", "share_source", "share_medium"}:
            continue
        keep.append((k, v))
    keep.sort()
    query = urlencode(keep, doseq=True)

    return urlunsplit((scheme, host, path, query, ""))


def build_source_id(url: str) -> str:
    digest = hashlib.sha256(normalize_source_url(url).encode("utf-8")).hexdigest()
    return f"src_{digest[:20]}"


def _has_parent_date_heading(notion: Client, parent_page_id: str, date_text: str) -> bool:
    cursor = None
    while True:
        resp = (
            notion.blocks.children.list(block_id=parent_page_id, start_cursor=cursor)
            if cursor
            else notion.blocks.children.list(block_id=parent_page_id)
        )
        for block in resp.get("results", []):
            if block.get("type") != "heading_2":
                continue
            if _extract_plain_text_from_block(block) == date_text:
                return True
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return False


def _ensure_parent_date_heading(notion: Client, parent_page_id: str, date_text: str) -> None:
    if _has_parent_date_heading(notion, parent_page_id, date_text):
        return
    notion.blocks.children.append(
        block_id=parent_page_id,
        children=[
            {
                "object": "block",
                "type": "heading_2",
                "heading_2": {"rich_text": _rt(date_text)},
            }
        ],
    )


def _resolve_data_source_id(notion: Client, database_id: str) -> str:
    db = notion.databases.retrieve(database_id=database_id)
    dss = db.get("data_sources", [])
    if dss and isinstance(dss, list) and dss[0].get("id"):
        return dss[0]["id"]
    raise RuntimeError(f"No data source found for database {database_id}")


def _ensure_index_data_source_schema(notion: Client, data_source_id: str) -> None:
    ds = notion.data_sources.retrieve(data_source_id=data_source_id)
    props = ds.get("properties", {}) or {}
    required = {
        "Source ID": {"rich_text": {}},
        "Source URL": {"url": {}},
        "Canonical URL": {"url": {}},
        "Page URL": {"url": {}},
        "Source Type": {"rich_text": {}},
        "Link Type": {
            "select": {
                "options": [
                    {"name": "wechat_article", "color": "green"},
                    {"name": "bilibili_video", "color": "red"},
                    {"name": "article_link", "color": "blue"},
                    {"name": "web_link", "color": "gray"},
                ]
            }
        },
        "Tags": {"multi_select": {"options": []}},
        "Status": {"select": {"options": [{"name": "synced", "color": "green"}]}},
        "Synced At": {"date": {}},
    }
    missing = {k: v for k, v in required.items() if k not in props}
    if missing:
        notion.data_sources.update(data_source_id=data_source_id, properties=missing)


def _ensure_index_database(notion: Client, parent_page_id: str) -> tuple:
    env_db_id = os.environ.get("NOTION_INDEX_DATABASE_ID", "").strip()
    if env_db_id:
        ds_id = _resolve_data_source_id(notion, env_db_id)
        _ensure_index_data_source_schema(notion, ds_id)
        return env_db_id, ds_id

    db_title = os.environ.get("NOTION_INDEX_DATABASE_TITLE", "Synced Links Index")
    cursor = None
    while True:
        resp = (
            notion.blocks.children.list(block_id=parent_page_id, start_cursor=cursor)
            if cursor
            else notion.blocks.children.list(block_id=parent_page_id)
        )
        for block in resp.get("results", []):
            if block.get("type") != "child_database":
                continue
            title = (block.get("child_database", {}) or {}).get("title", "")
            if title == db_title:
                db_id = block.get("id", "")
                if not db_id:
                    raise RuntimeError("Found child_database block without id")
                ds_id = _resolve_data_source_id(notion, db_id)
                _ensure_index_data_source_schema(notion, ds_id)
                return db_id, ds_id
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")

    created = notion.databases.create(
        parent={"type": "page_id", "page_id": parent_page_id},
        title=[{"type": "text", "text": {"content": db_title}}],
        properties={
            "Name": {"title": {}},
            "Source ID": {"rich_text": {}},
            "Source URL": {"url": {}},
            "Canonical URL": {"url": {}},
            "Page URL": {"url": {}},
            "Source Type": {"rich_text": {}},
            "Link Type": {
                "select": {
                    "options": [
                        {"name": "wechat_article", "color": "green"},
                        {"name": "bilibili_video", "color": "red"},
                        {"name": "article_link", "color": "blue"},
                        {"name": "web_link", "color": "gray"},
                    ]
                }
            },
            "Tags": {"multi_select": {"options": []}},
            "Status": {"select": {"options": [{"name": "synced", "color": "green"}]}},
            "Synced At": {"date": {}},
        },
    )
    db_id = created["id"]
    ds_id = _resolve_data_source_id(notion, db_id)
    _ensure_index_data_source_schema(notion, ds_id)
    return db_id, ds_id


def _upsert_index_record(
    notion: Client,
    database_id: str,
    data_source_id: str,
    source_id: str,
    title: str,
    source_type: str,
    link_type: str,
    tags: List[str],
    source_url: str,
    canonical_url: str,
    page_url: str,
) -> None:
    query = notion.data_sources.query(
        data_source_id=data_source_id,
        filter={"property": "Source ID", "rich_text": {"equals": source_id}},
        page_size=1,
    )
    props = {
        "Name": _title_prop(title),
        "Source ID": _rt_prop(source_id),
        "Source URL": {"url": source_url[:2000]},
        "Canonical URL": {"url": canonical_url[:2000]},
        "Page URL": {"url": page_url[:2000]},
        "Source Type": _rt_prop(source_type),
        "Link Type": {"select": {"name": link_type}},
        "Tags": {"multi_select": [{"name": t[:100]} for t in tags if t.strip()]},
        "Status": {"select": {"name": "synced"}},
        "Synced At": {"date": {"start": datetime.now().strftime("%Y-%m-%d")}},
    }

    rows = query.get("results", [])
    if rows:
        notion.pages.update(page_id=rows[0]["id"], properties=props)
    else:
        notion.pages.create(parent={"database_id": database_id}, properties=props)


def _find_existing_page_by_source_key(notion: Client, parent_page_id: str, canonical_url: str, source_id: str) -> str:
    cursor = None
    while True:
        resp = (
            notion.blocks.children.list(block_id=parent_page_id, start_cursor=cursor)
            if cursor
            else notion.blocks.children.list(block_id=parent_page_id)
        )
        for block in resp.get("results", []):
            if block.get("type") != "child_page":
                continue
            page_id = block.get("id")
            if not page_id:
                continue
            children = notion.blocks.children.list(block_id=page_id, page_size=50)
            for child in children.get("results", []):
                txt = _extract_plain_text_from_block(child)
                if source_id in txt or canonical_url in txt:
                    return page_id
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
    return ""


def _delete_all_children(notion: Client, page_id: str) -> None:
    cursor = None
    while True:
        resp = (
            notion.blocks.children.list(block_id=page_id, start_cursor=cursor)
            if cursor
            else notion.blocks.children.list(block_id=page_id)
        )
        for child in resp.get("results", []):
            cid = child.get("id")
            if cid:
                notion.blocks.delete(block_id=cid)
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")


def _append_children_in_batches(notion: Client, page_id: str, children: List[dict], batch_size: int = 80) -> None:
    for i in range(0, len(children), batch_size):
        notion.blocks.children.append(block_id=page_id, children=children[i : i + batch_size])


def is_wechat_url(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return host == "mp.weixin.qq.com" or host.endswith(".mp.weixin.qq.com")


def fetch_generic_web_article(url: str, timeout: float = 20.0) -> dict:
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
        title = t.get_text(strip=True) if t else final_url

    for bad in soup.find_all(["script", "style", "noscript"]):
        bad.decompose()
    text = soup.get_text("\n")
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln and len(ln) > 8]
    content_text = "\n".join(lines[:1200])

    return {"url": final_url, "title": title, "content_text": content_text}


def _detect_link_type(url: str, source_type: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if source_type == "wechat":
        return "wechat_article"
    if host in {"www.bilibili.com", "m.bilibili.com", "bilibili.com", "b23.tv"}:
        return "bilibili_video"
    if any(k in host for k in ["mp.weixin.qq.com", "medium.com", "substack.com"]):
        return "article_link"
    return "web_link"


def sync_url_to_notion(url: str) -> str:
    token = os.environ.get("NOTION_ACCESS_TOKEN")
    parent_page_id = os.environ.get("NOTION_PARENT_PAGE_ID")
    if not token:
        raise RuntimeError("Missing NOTION_ACCESS_TOKEN")
    if not parent_page_id:
        raise RuntimeError("Missing NOTION_PARENT_PAGE_ID")

    if is_wechat_url(url):
        article = fetch_wechat_article(url)
        source_type = "wechat"
        article_url = article.url
        title = article.title or f"WeChat Article {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        content_text = article.content_text
    else:
        article = fetch_generic_web_article(url)
        source_type = "web"
        article_url = article["url"]
        title = article["title"] or f"Web Article {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        content_text = article["content_text"]

    canonical_url = normalize_source_url(article_url)
    source_id = build_source_id(canonical_url)

    model_name = os.environ.get("OPENROUTER_MODEL") or "openai/gpt-4o-mini"
    summary_source = "openrouter"
    link_type = _detect_link_type(article_url, source_type)
    max_retries = int(os.environ.get("SUMMARY_MAX_RETRIES", "3"))
    retry_delay = float(os.environ.get("SUMMARY_RETRY_DELAY_SECONDS", "1.5"))
    core_summary: List[str] = []
    tags: List[str] = []
    outline: List[dict] = []
    for attempt in range(1, max_retries + 1):
        try:
            core_summary, tags, outline = summarize_with_openrouter(
                title, content_text, content_kind=link_type
            )
            if not core_summary:
                raise RuntimeError("LLM core_summary is empty")
            if not outline:
                raise RuntimeError("LLM outline is empty")
            break
        except Exception as exc:
            if attempt < max_retries:
                time.sleep(retry_delay * attempt)
                continue
            raise RuntimeError(
                f"OpenRouter summarization failed after {max_retries} attempts: {exc}"
            ) from exc

    children: List[dict] = []
    children.append(_paragraph(f"Source ID: {source_id}"))
    children.append(_paragraph(f"Source Type: {source_type}"))
    children.append(_paragraph(f"Summary Source: {summary_source}"))
    children.append(_paragraph(f"Summary Model: {model_name}"))
    children.append(_paragraph(f"Link Type: {link_type}"))
    children.append(_paragraph(f"Tags: {', '.join(tags)}"))
    children.append(_paragraph(f"Source URL: {article_url}"))
    children.append(_paragraph(f"Canonical URL: {canonical_url}"))

    children.append(
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt("Core Summary")}}
    )
    for item in core_summary:
        children.append(_bulleted_nested(item))

    children.append(
        {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt("Structured Rewrite")}}
    )
    for node in outline:
        if isinstance(node, dict):
            block = _outline_node_to_block(node)
            if block:
                children.append(block)

    include_preview = os.environ.get("INCLUDE_CONTENT_PREVIEW", "0") == "1"
    if include_preview:
        children.append(
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt("Content Preview")}}
        )
        preview = content_text[:3000] if content_text else "(empty content)"
        for chunk_start in range(0, len(preview), 1500):
            children.append(_paragraph(preview[chunk_start : chunk_start + 1500]))

    notion = Client(auth=token)
    index_db_id, index_ds_id = _ensure_index_database(notion, parent_page_id)
    existing_page_id = _find_existing_page_by_source_key(notion, parent_page_id, canonical_url, source_id)
    if existing_page_id:
        notion.pages.update(
            page_id=existing_page_id,
            properties={"title": [{"type": "text", "text": {"content": title[:200]}}]},
        )
        _delete_all_children(notion, existing_page_id)
        _append_children_in_batches(notion, existing_page_id, children)
        updated = notion.pages.retrieve(page_id=existing_page_id)
        page_url = updated["url"]
        _upsert_index_record(
            notion=notion,
            database_id=index_db_id,
            data_source_id=index_ds_id,
            source_id=source_id,
            title=title,
            source_type=source_type,
            link_type=link_type,
            tags=tags,
            source_url=article_url,
            canonical_url=canonical_url,
            page_url=page_url,
        )
        return page_url

    _ensure_parent_date_heading(notion, parent_page_id, datetime.now().strftime("%Y-%m-%d"))

    resp = notion.pages.create(
        parent={"page_id": parent_page_id},
        properties={
            "title": [
                {
                    "type": "text",
                    "text": {"content": title[:200]},
                }
            ]
        },
        children=children[:80],
    )
    if len(children) > 80:
        _append_children_in_batches(notion, resp["id"], children[80:])
    page_url = resp["url"]
    _upsert_index_record(
        notion=notion,
        database_id=index_db_id,
        data_source_id=index_ds_id,
        source_id=source_id,
        title=title,
        source_type=source_type,
        link_type=link_type,
        tags=tags,
        source_url=article_url,
        canonical_url=canonical_url,
        page_url=page_url,
    )
    return page_url


def sync_wechat_url_to_notion(url: str) -> str:
    return sync_url_to_notion(url)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch article, summarize, and write to Notion page")
    parser.add_argument("url", help="Article URL")
    args = parser.parse_args()

    page_url = sync_wechat_url_to_notion(args.url)
    print(page_url)


if __name__ == "__main__":
    main()
