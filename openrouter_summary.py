import json
import os
import re
from typing import Dict, List, Optional, Tuple

import httpx


def _normalize_for_dedupe(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r"\s+", "", t)
    t = re.sub(r"[，。！？、；：,.!?;:（）()【】\[\]\"'“”‘’`~\-_\\/]", "", t)
    return t


def _dedupe_texts(items: List[str], max_items: int) -> List[str]:
    kept: List[str] = []
    seen: List[str] = []
    for raw in items:
        item = str(raw).strip()
        if not item:
            continue
        n = _normalize_for_dedupe(item)
        if not n:
            continue
        if any(n == ex for ex in seen):
            continue
        kept.append(item)
        seen.append(n)
        if len(kept) >= max_items:
            break
    return kept


def _sanitize_nodes(raw_nodes: object, depth: int = 1, max_depth: int = 6, max_siblings: int = 80) -> List[Dict[str, object]]:
    if depth > max_depth or not isinstance(raw_nodes, list):
        return []

    nodes: List[Dict[str, object]] = []
    sibling_seen: List[str] = []
    for raw in raw_nodes:
        text = ""
        children_raw: object = []
        if isinstance(raw, str):
            text = raw.strip()
        elif isinstance(raw, dict):
            text = str(raw.get("text", "") or raw.get("title", "") or raw.get("heading", "")).strip()
            children_raw = raw.get("children", [])
        else:
            continue

        if not text:
            continue
        normalized = _normalize_for_dedupe(text)
        if not normalized or normalized in sibling_seen:
            continue

        child_nodes = _sanitize_nodes(children_raw, depth=depth + 1, max_depth=max_depth, max_siblings=max_siblings)
        nodes.append({"text": text[:800], "children": child_nodes})
        sibling_seen.append(normalized)
        if len(nodes) >= max_siblings:
            break
    return nodes


def summarize_with_openrouter(
    title: str,
    content_text: str,
    content_kind: str = "article",
    model: Optional[str] = None,
    timeout: float = 60.0,
) -> Tuple[List[str], List[str], List[Dict[str, object]]]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY")

    model_name = model or os.environ.get("OPENROUTER_MODEL") or "openai/gpt-4o-mini"

    system_prompt = (
        "你不是做摘要，而是做结构化转述。"
        "目标：先给核心概括，再把原文段落改写成多层级 bullet list，保持原文逻辑关系与信息覆盖。"
        "输出严格 JSON，字段为 core_summary(长度2-4字符串数组)、tags(长度3-8字符串数组) 和 outline(树状数组)。"
        "outline 每个节点必须包含 text 和 children 字段；children 是同结构数组。"
        "要求："
        "0) core_summary 必须是几句话，先说明文章核心主题、主结论、适用边界。"
        "1) 优先保留原文子标题与顺序；无子标题时提炼简短标题。"
        "2) 不要把所有信息压扁成并列点，要体现“总-分/因果/条件/例子/结论”的层次。"
        "3) 删除重复或同义重复，但不要遗漏主体信息。"
        "4) 不添加原文没有的新事实，不做评价。"
        "5) text 用完整陈述句，尽可能保留原句中的限定词与上下文，优先保留实体名、时间、数字、条件。"
        "6) 每个 bullet 不要只写短语，优先写成一句话；信息密集处可以用较长句。"
        "7) 深度控制在2-6层。"
        "8) 必须完整覆盖页面内主要内容，不允许只保留少数点。"
        "9) 如果原文信息很多，请增加节点数量，而不是过度压缩。"
        "只输出 JSON，不要 markdown，不要解释。"
    )

    user_prompt = (
        f"标题：{title}\n"
        f"内容类型：{content_kind}\n\n"
        "正文：\n"
        f"{content_text[:26000]}\n\n"
        "请先输出 core_summary，再输出 tags 和 outline。"
    )

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://localhost",
        "X-Title": "wechat-notion-tool",
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"].strip()
    parsed = json.loads(content)

    core_summary = _dedupe_texts(
        [str(x).strip() for x in parsed.get("core_summary", []) if str(x).strip()],
        max_items=4,
    )
    tags = _dedupe_texts([str(x).strip() for x in parsed.get("tags", []) if str(x).strip()], max_items=8)
    outline = _sanitize_nodes(parsed.get("outline", []), max_depth=6, max_siblings=80)

    if not core_summary:
        raise RuntimeError("OpenRouter returned empty core_summary")
    if not outline:
        raise RuntimeError("OpenRouter returned empty outline")

    return core_summary, tags, outline
