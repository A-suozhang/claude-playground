import argparse
import time
from typing import List

from stack_reader import fetch_all_stack_links
from wechat_to_notion import sync_url_to_notion


def sync_stack_to_notion(
    stack_site_url: str,
    limit: int = 0,
    retries: int = 2,
    retry_delay: float = 2.0,
    max_seconds: int = 0,
) -> List[str]:
    started = time.monotonic()
    links = fetch_all_stack_links(stack_site_url, retries=retries, retry_delay=retry_delay)
    if limit and limit > 0:
        links = links[:limit]

    page_urls: List[str] = []
    failed: List[str] = []
    for idx, link in enumerate(links):
        if max_seconds > 0 and time.monotonic() - started > max_seconds:
            print(f"[timeout] reached max_seconds={max_seconds}, stop remaining links")
            failed.extend(links[idx:])
            break
        last_err = None
        for attempt in range(1, retries + 2):
            if max_seconds > 0 and time.monotonic() - started > max_seconds:
                last_err = RuntimeError(f"overall timeout reached ({max_seconds}s)")
                print(f"[timeout] {link}: {last_err}")
                break
            try:
                page_url = sync_url_to_notion(link)
                page_urls.append(page_url)
                print(f"{link} -> {page_url}")
                last_err = None
                break
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                if attempt <= retries:
                    print(f"[retry {attempt}/{retries}] {link} failed: {exc}")
                    time.sleep(retry_delay)
                else:
                    print(f"[failed] {link}: {exc}")
        if last_err is not None:
            failed.append(link)

    print(f"Done. success={len(page_urls)} failed={len(failed)}")
    if failed:
        print("Failed links:")
        for link in failed:
            print(f"- {link}")
    return page_urls


def main() -> None:
    parser = argparse.ArgumentParser(description="Read links from stack site and sync all to Notion")
    parser.add_argument("--stack-site-url", default="https://a-suozhang.xyz/link-stack-app/")
    parser.add_argument("--limit", type=int, default=0, help="Only sync first N links, 0 for all")
    parser.add_argument("--retries", type=int, default=2, help="Retries per link on failure")
    parser.add_argument("--retry-delay", type=float, default=2.0, help="Seconds to wait before retry")
    parser.add_argument("--max-seconds", type=int, default=0, help="Overall timeout for whole sync, 0 means no limit")
    args = parser.parse_args()

    sync_stack_to_notion(args.stack_site_url, args.limit, args.retries, args.retry_delay, args.max_seconds)


if __name__ == "__main__":
    main()
