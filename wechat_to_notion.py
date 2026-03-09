import argparse
import os
import re
from datetime import datetime
from typing import List

from notion_client import Client

from openrouter_summary import summarize_with_openrouter
from wechat_fetch import fetch_wechat_article


def _clean_lines(text: str) -> List[str]:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    filtered = []
    skip_prefixes = (
        "作者", "编辑", "推荐阅读", "未经", "转载", "本文核心来源", "//", "▎", "▪", "❌", "✅"
    )
    for ln in lines:
        # Remove common decorative bullet/marker prefixes from scraped WeChat text.
        ln = re.sub(r"^[\-\*\•\·\■\□\▪\▎\|]+\s*", "", ln).strip()
        ln = re.sub(r"^[（(]?[一二三四五六七八九十0-9]+[）)\.、]\s*", "", ln).strip()
        if not ln:
            continue
        if len(ln) < 14:
            continue
        if ln.startswith(skip_prefixes):
            continue
        if re.fullmatch(r"\d{1,2}", ln):
            continue
        if re.fullmatch(r"[\W_]+", ln):
            continue
        if "http://" in ln or "https://" in ln:
            continue
        filtered.append(ln)
    return filtered


def _build_overview(text: str, max_items: int = 3) -> List[str]:
    lines = _clean_lines(text)
    if not lines:
        return []
    overview = []
    for ln in lines:
        if any(k in ln for k in ("是什么", "为什么", "核心", "结论", "意义", "本质")):
            overview.append(ln)
        if len(overview) >= max_items:
            break
    if len(overview) < max_items:
        for ln in lines[:20]:
            if ln not in overview:
                overview.append(ln)
            if len(overview) >= max_items:
                break
    return overview[:max_items]


def _build_key_points(text: str, max_points: int = 6) -> List[str]:
    lines = _clean_lines(text)

    picks: List[str] = []
    seen = set()

    def add_point(line: str) -> None:
        line = re.sub(r"\s+", " ", line).strip()
        if not line or line in seen:
            return
        seen.add(line)
        picks.append(line)

    # Prefer strong explanatory statements.
    for ln in lines:
        if any(k in ln for k in ["核心", "启示", "总结", "结论", "为什么", "关键", "差异", "风险", "本质"]):
            add_point(ln)
        if len(picks) >= max_points:
            break

    # Fill with early meaningful lines.
    if len(picks) < max_points:
        for ln in lines[:60]:
            add_point(ln)
            if len(picks) >= max_points:
                break

    return picks[:max_points]


def _rt(text: str):
    return [{"type": "text", "text": {"content": text[:1800]}}]


def _paragraph(text: str):
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rt(text)}}


def _bulleted(text: str):
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": _rt(text)},
    }


def _extract_plain_text_from_block(block: dict) -> str:
    btype = block.get("type")
    if not btype:
        return ""
    payload = block.get(btype, {})
    parts = payload.get("rich_text", [])
    return "".join(p.get("plain_text", "") for p in parts if isinstance(p, dict))


def _find_existing_page_by_source_url(notion: Client, parent_page_id: str, source_url: str) -> str:
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
            first_children = notion.blocks.children.list(block_id=page_id, page_size=20)
            for child in first_children.get("results", []):
                txt = _extract_plain_text_from_block(child)
                if source_url in txt:
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


def sync_wechat_url_to_notion(url: str) -> str:
    token = os.environ.get("NOTION_ACCESS_TOKEN")
    parent_page_id = os.environ.get("NOTION_PARENT_PAGE_ID")
    if not token:
        raise RuntimeError("Missing NOTION_ACCESS_TOKEN")
    if not parent_page_id:
        raise RuntimeError("Missing NOTION_PARENT_PAGE_ID")

    article = fetch_wechat_article(url)
    strict_llm = os.environ.get("SUMMARY_STRICT_LLM", "1") == "1"
    model_name = os.environ.get("OPENROUTER_MODEL") or "openai/gpt-4o-mini"
    summary_source = "openrouter"
    try:
        overview, points = summarize_with_openrouter(article.title, article.content_text)
    except Exception as exc:
        if strict_llm:
            raise RuntimeError(f"OpenRouter summarization failed: {exc}") from exc
        summary_source = "fallback_rules"
        overview = _build_overview(article.content_text)
        points = _build_key_points(article.content_text)

    title = article.title or f"WeChat Article {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    children = []
    children.append(_paragraph(f"Summary Source: {summary_source}"))
    children.append(_paragraph(f"Summary Model: {model_name}"))
    children.append(_paragraph(f"Source URL: {article.url}"))

    if overview:
        children.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt("Overview")}})
        for item in overview:
            children.append(_bulleted(item))

    if points:
        children.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt("Key Points")}})
        for p in points:
            children.append(_bulleted(p))

    include_preview = os.environ.get("INCLUDE_CONTENT_PREVIEW", "0") == "1"
    if include_preview:
        children.append(
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rt("Content Preview")}}
        )
        preview = article.content_text[:3000] if article.content_text else "(empty content)"
        for chunk_start in range(0, len(preview), 1500):
            children.append(_paragraph(preview[chunk_start : chunk_start + 1500]))

    notion = Client(auth=token)
    existing_page_id = _find_existing_page_by_source_url(notion, parent_page_id, article.url)
    if existing_page_id:
        notion.pages.update(
            page_id=existing_page_id,
            properties={"title": [{"type": "text", "text": {"content": title[:200]}}]},
        )
        _delete_all_children(notion, existing_page_id)
        _append_children_in_batches(notion, existing_page_id, children)
        updated = notion.pages.retrieve(page_id=existing_page_id)
        return updated["url"]

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
    return resp["url"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch WeChat article, summarize, and write to Notion page")
    parser.add_argument("url", help="WeChat article URL")
    args = parser.parse_args()

    page_url = sync_wechat_url_to_notion(args.url)
    print(page_url)


if __name__ == "__main__":
    main()
