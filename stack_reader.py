import re
import time
from dataclasses import dataclass
from typing import List
from urllib.parse import urljoin

import httpx


@dataclass
class StackConfig:
    supabase_url: str
    anon_key: str
    table: str = "links"


def _extract_with_patterns(text: str, patterns: List[str]) -> str:
    for pattern in patterns:
        m = re.search(pattern, text)
        if m:
            return m.group(1)
    return ""


def discover_stack_config(site_url: str, retries: int = 2, retry_delay: float = 1.5) -> StackConfig:
    last_exc = None
    for attempt in range(1, retries + 2):
        try:
            with httpx.Client(timeout=20.0, follow_redirects=True) as client:
                html = client.get(site_url).text

                script_src = _extract_with_patterns(
                    html,
                    [
                        r'<script[^>]+src="([^"]*app\.js[^"]*)"',
                        r"<script[^>]+src='([^']*app\.js[^']*)'",
                    ],
                )
                if not script_src:
                    raise RuntimeError("Could not find app.js script from stack page")

                app_js_url = urljoin(site_url, script_src)
                app_js = client.get(app_js_url).text
            break
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt <= retries:
                time.sleep(retry_delay)
                continue
            raise RuntimeError(f"discover_stack_config failed after retries: {exc}") from exc

    supabase_url = _extract_with_patterns(
        app_js,
        [
            r'const\s+SUPABASE_URL\s*=\s*"([^"]+)"',
            r"const\s+SUPABASE_URL\s*=\s*'([^']+)'",
        ],
    )
    anon_key = _extract_with_patterns(
        app_js,
        [
            r'const\s+SUPABASE_ANON_KEY\s*=\s*"([^"]+)"',
            r"const\s+SUPABASE_ANON_KEY\s*=\s*'([^']+)'",
        ],
    )
    table = _extract_with_patterns(
        app_js,
        [
            r'const\s+TABLE\s*=\s*"([^"]+)"',
            r"const\s+TABLE\s*=\s*'([^']+)'",
        ],
    ) or "links"

    if not supabase_url or not anon_key:
        raise RuntimeError("Could not parse SUPABASE_URL or SUPABASE_ANON_KEY from app.js")

    return StackConfig(supabase_url=supabase_url, anon_key=anon_key, table=table)


def fetch_all_stack_links(site_url: str, retries: int = 2, retry_delay: float = 1.5) -> List[str]:
    cfg = discover_stack_config(site_url, retries=retries, retry_delay=retry_delay)
    rest_url = f"{cfg.supabase_url.rstrip('/')}/rest/v1/{cfg.table}"
    params = {"select": "url", "order": "created_at.desc"}
    headers = {
        "apikey": cfg.anon_key,
        "Authorization": f"Bearer {cfg.anon_key}",
    }

    rows = None
    last_exc = None
    for attempt in range(1, retries + 2):
        try:
            with httpx.Client(timeout=20.0, follow_redirects=True) as client:
                resp = client.get(rest_url, params=params, headers=headers)
                resp.raise_for_status()
                rows = resp.json()
            break
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt <= retries:
                time.sleep(retry_delay)
                continue
            raise RuntimeError(f"fetch_all_stack_links failed after retries: {exc}") from exc

    links: List[str] = []
    for row in rows or []:
        url = (row or {}).get("url")
        if isinstance(url, str) and url:
            links.append(url)
    return links
