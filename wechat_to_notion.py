import argparse
import hashlib
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from collections.abc import Iterable
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


def _paragraph_with_link(label: str, url: str) -> dict:
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
            "rich_text": [
                {"type": "text", "text": {"content": f"{label}: "}},
                {"type": "text", "text": {"content": url[:1800], "link": {"url": url[:2000]}}},
            ]
        },
    }


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


def is_miromind_share_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    return host == "dr.miromind.ai" and path.startswith("/share/")


def is_xiaoyuzhou_episode_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    return "xiaoyuzhoufm.com" in host and path.startswith("/episode/")


def _extract_miromind_share_id(url: str) -> str:
    try:
        path = urlparse(url).path or ""
    except Exception:
        return ""
    m = re.match(r"^/share/([0-9a-fA-F-]{36})/?$", path)
    if not m:
        return ""
    return m.group(1)


def _strip_think_blocks(text: str) -> str:
    text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _iter_nested_texts(value: object, path: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(value, str):
        yield path, value
        return
    if isinstance(value, list):
        for idx, item in enumerate(value):
            next_path = f"{path}.{idx}" if path else str(idx)
            yield from _iter_nested_texts(item, next_path)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            next_path = f"{path}.{key}" if path else str(key)
            yield from _iter_nested_texts(item, next_path)


def _score_miromind_candidate(path: str, text: str) -> tuple[int, int]:
    lower_path = path.lower()
    score = 0
    if ".payload.text" in lower_path:
        score += 6
    if any(k in lower_path for k in ["final", "answer", "response", "output"]):
        score += 3
    if any(k in lower_path for k in [".input.", ".result", ".search", ".tool"]):
        score -= 4
    if len(text) >= 180:
        score += 2
    if len(text) >= 600:
        score += 2
    return score, len(text)


def _extract_miromind_assistant_text(content: object) -> str:
    candidates: List[tuple[tuple[int, int], str]] = []
    for path, raw_text in _iter_nested_texts(content):
        text = _strip_think_blocks(raw_text)
        if len(text) < 30:
            continue
        if text.startswith("{") and text.endswith("}") and len(text) > 200:
            continue
        score = _score_miromind_candidate(path, text)
        candidates.append((score, text))
    if not candidates:
        return ""
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def fetch_miromind_share_article(url: str, timeout: float = 20.0) -> dict:
    share_id = _extract_miromind_share_id(url)
    if not share_id:
        raise RuntimeError(f"Unsupported miromind share URL format: {url}")
    parsed = urlparse(url)
    base = f"{parsed.scheme or 'https'}://{parsed.netloc}"
    api_url = f"{base}/api/share/{share_id}"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
    }
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers, trust_env=False) as client:
        resp = client.get(api_url)
        resp.raise_for_status()
        payload = resp.json()

    if not payload.get("success"):
        msg = payload.get("message") or payload.get("error") or "unknown error"
        raise RuntimeError(f"miromind share api returned unsuccessful response: {msg}")

    data = payload.get("data") or {}
    history = data.get("history") or []
    if not isinstance(history, list) or not history:
        raise RuntimeError("miromind share api returned empty history")

    user_prompt = ""
    assistant_answer = ""
    for row in history:
        if not isinstance(row, dict):
            continue
        role = str(row.get("role", "")).lower()
        content = row.get("content")
        if role == "user" and not user_prompt and isinstance(content, str):
            user_prompt = content.strip()
        elif role == "assistant" and not assistant_answer:
            if isinstance(content, str):
                assistant_answer = _strip_think_blocks(content)
            else:
                assistant_answer = _extract_miromind_assistant_text(content)

    text_parts: List[str] = []
    if user_prompt:
        text_parts.append(f"User Prompt:\n{user_prompt}")
    if assistant_answer:
        text_parts.append(f"Assistant Answer:\n{assistant_answer}")

    content_text = "\n\n".join(text_parts).strip()
    if not content_text:
        raise RuntimeError("miromind share api parsed no usable text content")

    title_seed = user_prompt or f"Share {share_id}"
    title = f"Miromind Share - {title_seed[:120]}"
    return {"url": url, "title": title, "content_text": content_text}


def _extract_xiaoyuzhou_episode_data(soup: BeautifulSoup) -> dict:
    node = soup.find("script", id="__NEXT_DATA__")
    if not node or not node.string:
        return {}
    try:
        payload = json.loads(node.string)
    except Exception:
        return {}
    episode = ((payload.get("props") or {}).get("pageProps") or {}).get("episode") or {}
    return episode if isinstance(episode, dict) else {}


def _find_first_audio_url(text: str) -> str:
    candidates = re.findall(r"https?://[^\s\"'<>]+", text)
    for url in candidates:
        lower = url.lower()
        if any(ext in lower for ext in [".m4a", ".mp3", ".mp4a", ".wav", ".webm"]):
            return url
        if "media.xyzcdn.net" in lower or "ximalaya.com" in lower:
            return url
    return ""


def _html_to_plain_text(raw_html: str) -> str:
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text("\n")
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)


def _extract_episode_id_from_xiaoyuzhou_url(url: str) -> str:
    try:
        path = urlparse(url).path or ""
    except Exception:
        return ""
    m = re.match(r"^/episode/([^/?#]+)", path)
    return m.group(1) if m else ""


def _discover_rss_urls_from_xiaoyuzhou_html(soup: BeautifulSoup, html: str, episode: dict) -> List[str]:
    urls: List[str] = []
    for link in soup.find_all("link"):
        href = (link.get("href") or "").strip()
        typ = (link.get("type") or "").strip().lower()
        rel = " ".join(link.get("rel") or []).lower() if isinstance(link.get("rel"), list) else ""
        if not href:
            continue
        if "rss" in typ or "rss" in rel or "rss" in href.lower() or href.lower().endswith(".xml"):
            urls.append(href)

    podcast = episode.get("podcast") if isinstance(episode, dict) else None
    if isinstance(podcast, dict):
        for key in ["rss", "rssUrl", "rss_url", "feedUrl", "feed_url", "feed"]:
            val = podcast.get(key)
            if isinstance(val, str) and val.strip():
                urls.append(val.strip())

    urls.extend(re.findall(r"https?://[^\s\"'<>]+", html))
    filtered: List[str] = []
    for u in urls:
        lu = u.lower()
        if "rss" in lu or lu.endswith(".xml"):
            filtered.append(u)

    uniq: List[str] = []
    seen = set()
    for u in filtered:
        if u in seen:
            continue
        seen.add(u)
        uniq.append(u)
    return uniq


def _parse_rss_item_for_episode(feed_xml: str, episode_id: str, episode_url: str) -> dict:
    try:
        root = ET.fromstring(feed_xml)
    except Exception:
        return {}

    channel = root.find("channel")
    if channel is None:
        return {}

    episode_url_norm = normalize_source_url(episode_url)
    best_item: ET.Element | None = None
    for item in channel.findall("item"):
        link = (item.findtext("link") or "").strip()
        guid = (item.findtext("guid") or "").strip()
        if episode_id and (episode_id in link or episode_id in guid):
            best_item = item
            break
        if link and normalize_source_url(link) == episode_url_norm:
            best_item = item
            break

    if not best_item:
        return {}

    title = (best_item.findtext("title") or "").strip()
    description = (best_item.findtext("description") or "").strip()

    content_encoded = ""
    for child in list(best_item):
        if isinstance(child.tag, str) and child.tag.endswith("encoded"):
            content_encoded = (child.text or "").strip()
            if content_encoded:
                break

    enclosure = best_item.find("enclosure")
    audio_url = ""
    if enclosure is not None and enclosure.get("url"):
        audio_url = enclosure.get("url").strip()

    notes_html = content_encoded or description
    notes_text = _html_to_plain_text(notes_html)
    return {"title": title, "shownotes_text": notes_text, "audio_url": audio_url}


def fetch_xiaoyuzhou_episode_article(url: str, timeout: float = 30.0) -> dict:
    headers = {
        # Keep a minimal UA. Some richer browser-like UA profiles trigger anti-bot 403 here.
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    episode_id = _extract_episode_id_from_xiaoyuzhou_url(url)
    candidate_urls: List[str] = []
    if episode_id:
        candidate_urls.append(f"https://www.xiaoyuzhoufm.com/episodes/{episode_id}")
        candidate_urls.append(f"https://www.xiaoyuzhoufm.com/episode/{episode_id}")
    candidate_urls.append(url)

    html = ""
    fetched_url = ""
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers, trust_env=False) as client:
        for candidate in candidate_urls:
            try:
                resp = client.get(candidate)
                if not resp.is_success:
                    continue
                text = resp.text
                # Prefer pages that actually contain Next.js data payload.
                if "__NEXT_DATA__" not in text and candidate != candidate_urls[-1]:
                    continue
                html = text
                fetched_url = str(resp.url)
                break
            except Exception:
                continue

    soup = BeautifulSoup(html or "", "html.parser")
    episode = _extract_xiaoyuzhou_episode_data(soup)
    episode_id = episode_id or _extract_episode_id_from_xiaoyuzhou_url(fetched_url or url)

    og_title = soup.find("meta", attrs={"property": "og:title"})
    og_desc = soup.find("meta", attrs={"property": "og:description"})

    title = (episode.get("title") or "").strip()
    if not title and og_title and og_title.get("content"):
        title = og_title["content"].strip()
    if not title:
        t = soup.find("title")
        title = t.get_text(strip=True) if t else (fetched_url or url)

    description = (episode.get("description") or "").strip()
    if not description and og_desc and og_desc.get("content"):
        description = og_desc["content"].strip()

    shownotes_html = str(episode.get("shownotes") or "")
    shownotes_text = _html_to_plain_text(shownotes_html)

    rss_urls = _discover_rss_urls_from_xiaoyuzhou_html(soup, html, episode)
    rss_notes = ""
    rss_audio_url = ""
    used_rss_url = ""
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
        for rss_url in rss_urls:
            try:
                feed_resp = client.get(rss_url)
                if not feed_resp.is_success:
                    continue
                parsed = _parse_rss_item_for_episode(feed_resp.text, episode_id, fetched_url or url)
                if not parsed:
                    continue
                used_rss_url = rss_url
                if parsed.get("title"):
                    title = parsed["title"]
                rss_notes = parsed.get("shownotes_text", "")
                rss_audio_url = parsed.get("audio_url", "")
                break
            except Exception:
                continue

    podcast_title = ""
    podcast = episode.get("podcast")
    if isinstance(podcast, dict):
        podcast_title = str(podcast.get("title") or "").strip()
    duration = episode.get("duration")

    parts: List[str] = []
    if podcast_title:
        parts.append(f"Podcast: {podcast_title}")
    if duration:
        parts.append(f"Duration (seconds): {duration}")
    if used_rss_url:
        parts.append(f"RSS URL: {used_rss_url}")
    if rss_audio_url:
        parts.append(f"Audio URL (from RSS): {rss_audio_url}")

    # Keep Notion input content focused on usable episode text instead of error strings.
    notes_for_summary = ""
    notes_source = ""
    if rss_notes:
        notes_for_summary = rss_notes
        notes_source = "RSS"
    elif shownotes_text:
        notes_for_summary = shownotes_text
        notes_source = "Page"
    elif description:
        notes_for_summary = description
        notes_source = "Description"

    if description and notes_source != "Description":
        parts.append(f"Description:\n{description}")
    if notes_for_summary:
        parts.append(f"Show Notes (from {notes_source}):\n{notes_for_summary}")
    else:
        raise RuntimeError(
            "Failed to read Xiaoyuzhou content (no RSS notes / page shownotes / description). "
            "Source likely blocked by anti-bot (HTTP 403)."
        )

    content_text = "\n\n".join(parts).strip()
    if not content_text:
        raise RuntimeError("xiaoyuzhou episode parsed no usable text content")
    # Keep source URL as original stack link for stable dedup/update.
    return {"url": url, "title": title, "content_text": content_text}


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
    if any(k in host for k in ["mp.weixin.qq.com", "medium.com", "substack.com", "xiaoyuzhoufm.com"]):
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
        if is_miromind_share_url(url):
            article = fetch_miromind_share_article(url)
        elif is_xiaoyuzhou_episode_url(url):
            article = fetch_xiaoyuzhou_episode_article(url)
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
    children.append(_paragraph_with_link("Source URL", article_url))
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
