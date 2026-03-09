import json
import os
from typing import List, Optional, Tuple

import httpx


def summarize_with_openrouter(
    title: str,
    content_text: str,
    model: Optional[str] = None,
    timeout: float = 60.0,
) -> Tuple[List[str], List[str]]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY")

    model_name = model or os.environ.get("OPENROUTER_MODEL") or "openai/gpt-4o-mini"

    system_prompt = (
        "你是内容编辑助手。请基于输入文章输出严格 JSON，字段为"
        "overview(长度2-3的字符串数组)和key_points(长度4-6的字符串数组)。"
        "要求：简洁、去噪、避免广告口吻和免责声明、不要输出 markdown。"
    )

    user_prompt = (
        f"标题：{title}\n\n"
        "正文：\n"
        f"{content_text[:20000]}\n\n"
        "只返回 JSON，不要解释。"
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

    overview = [str(x).strip() for x in parsed.get("overview", []) if str(x).strip()]
    key_points = [str(x).strip() for x in parsed.get("key_points", []) if str(x).strip()]

    if not overview and not key_points:
        raise RuntimeError("OpenRouter returned empty summary")

    return overview[:3], key_points[:6]
