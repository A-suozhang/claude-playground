import os
from datetime import datetime
from notion_client import Client


def test_create_notion_page():
    token = os.environ.get("NOTION_ACCESS_TOKEN")
    parent_page_id = os.environ.get("NOTION_PARENT_PAGE_ID")
    assert token, "Missing NOTION_ACCESS_TOKEN"
    assert parent_page_id, "Missing NOTION_PARENT_PAGE_ID"

    notion = Client(auth=token)

    title = f"WeChat Sync Test {datetime.now().isoformat(timespec='seconds')}"
    resp = notion.pages.create(
        parent={"page_id": parent_page_id},
        properties={
            "title": [
                {
                    "type": "text",
                    "text": {"content": title},
                }
            ]
        },
        children=[
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {"type": "text", "text": {"content": "This is a test page."}}
                    ]
                },
            }
        ],
    )

    assert resp["object"] == "page"
    assert "id" in resp
    assert resp["url"].startswith("https://www.notion.so/")
